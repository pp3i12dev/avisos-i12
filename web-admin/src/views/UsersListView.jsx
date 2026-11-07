
import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { hasAny } from '../config/permissions';
import {
    useUsersByRole,
    useCreateUser,
    useUpdateUser,
    useToggleUserActive,
    useDeleteUser,
    useBulkDeleteStudents
} from '../hooks/useUsers';
import UserFormModal from '../components/UserFormModal';
import ConfirmDialog from '../components/ConfirmDialog';

// Normaliza los textos para buscar sin distinguir
// mayúsculas, minúsculas ni acentos.
const normalizeText = (value) => {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
};

// Extrae los valores de los campos de un usuario,
// incluidos los datos de su perfil.
// No busca dentro de objetos de relaciones externas.
const getSearchableText = (user) => {
    const values = [];

    const collectValues = (object) => {
        if (!object || typeof object !== 'object') return;

        Object.entries(object).forEach(([key, value]) => {
            // No se incluyen contraseñas ni datos de autenticación.
            if (
                [
                    'password',
                    'passwordHash',
                    'token',
                    'refreshToken'
                ].includes(key)
            ) {
                return;
            }

            if (
                typeof value === 'string' ||
                typeof value === 'number' ||
                typeof value === 'boolean'
            ) {
                values.push(String(value));
            }
        });
    };

    collectValues(user);
    collectValues(user.profile);
    const course = user.profile?.courses?.[0]?.course;
    collectValues(course);
    collectValues(course?.career);

    // Permite buscar nombre y apellido juntos,
    // independientemente de cómo se hayan escrito.
    values.push(
        `${user.firstName ?? ''} ${user.lastName ?? ''}`
    );

    values.push(
        `${user.lastName ?? ''} ${user.firstName ?? ''}`
    );

    return normalizeText(values.join(' '));
};

export default function UsersListView({ role, title }) {
    const { user: currentUser } = useContext(AuthContext);
    const canReviewSignups = role === 'student' && hasAny(currentUser?.roles, 'selfSignup:approve');
    const canManageRole = hasAny(currentUser?.roles, `${role}:manage`);
    const canDeleteUser = Boolean(currentUser?.isSuperAdmin || currentUser?.roles?.includes('SUPER_ADMIN') || currentUser?.roles?.includes('DIRECTOR'));
    const { data: users, isLoading } = useUsersByRole(role);

    const createMutation = useCreateUser(role);
    const updateMutation = useUpdateUser(role);
    const toggleMutation = useToggleUserActive(role);
    const deleteMutation = useDeleteUser(role);
    const bulkDeleteMutation = useBulkDeleteStudents();

    const [formOpen, setFormOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    // Estado independiente de búsqueda para esta vista.
    const [searchTerm, setSearchTerm] = useState('');
    const [careerFilter, setCareerFilter] = useState('');
    const [shiftFilter, setShiftFilter] = useState('');
    const [courseFilter, setCourseFilter] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [typedConfirmation, setTypedConfirmation] = useState('');
    const [bulkError, setBulkError] = useState('');
    const studentCourse = (user) => user.profile?.courses?.[0]?.course ?? null;


    // Cuando cambia el rol, limpiamos la búsqueda anterior.
    useEffect(() => {
        setSearchTerm('');
        setCareerFilter(''); setShiftFilter(''); setCourseFilter('');
        setSelectedIds([]);
    }, [role]);
    useEffect(() => { setSelectedIds([]); }, [searchTerm,careerFilter,shiftFilter,courseFilter]);

    // Los usuarios ya vienen filtrados por rol desde el hook.
    const roleUsers = useMemo(() => {
        if (Array.isArray(users)) {
            return users;
        }

        return [];
    }, [users]);

    const allStudentCourses = useMemo(() => {
        const map = new Map();
        if (role === 'student') roleUsers.forEach(u => {
            const course = u.profile?.courses?.[0]?.course;
            if (course) map.set(course.id, course);
        });
        return [...map.values()].sort((a,b) => (a.career?.nombre || '').localeCompare(b.career?.nombre || '') || a.nombre.localeCompare(b.nombre));
    }, [roleUsers, role]);
    const careers = useMemo(() => [...new Map(allStudentCourses.filter(c=>c.careerId).map(c => [c.careerId, c.career?.nombre ?? 'Carrera sin nombre'])).entries()], [allStudentCourses]);
    const visibleStudentCourses = allStudentCourses.filter(c => (!careerFilter || String(c.careerId)===careerFilter) && (!shiftFilter || c.shift===shiftFilter));

    // Filtrado en tiempo real de los usuarios del rol actual.
    const filteredUsers = useMemo(() => {
        const normalizedSearch = normalizeText(searchTerm);

        const searchWords = normalizedSearch ? normalizedSearch.split(/\s+/) : [];
        return roleUsers.filter((user) => {
            const course = studentCourse(user);
            if (role === 'student') {
                if (careerFilter && String(course?.careerId) !== careerFilter) return false;
                if (shiftFilter && course?.shift !== shiftFilter) return false;
                if (courseFilter && String(course?.id) !== courseFilter) return false;
            }
            const searchableText = getSearchableText(user);
            return searchWords.every((word) => searchableText.includes(word));
        });
    }, [roleUsers, searchTerm, role, careerFilter, shiftFilter, courseFilter]);

    const eligibleFilteredIds = filteredUsers.filter(u => u.id !== currentUser?.id && !u.isSuperAdmin).map(u => u.id);
    const allSelected = eligibleFilteredIds.length > 0 && eligibleFilteredIds.every(id => selectedIds.includes(id));
    const toggleAll = () => setSelectedIds(allSelected ? selectedIds.filter(id => !eligibleFilteredIds.includes(id)) : [...new Set([...selectedIds,...eligibleFilteredIds])]);
    const toggleOne = id => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x!==id) : [...prev,id]);
    const confirmBulk = () => {
        if (typedConfirmation !== 'ELIMINAR' || !selectedIds.length || selectedIds.length>100) return;
        setBulkError('');
        bulkDeleteMutation.mutate({ids:selectedIds,confirmation:typedConfirmation}, {
            onSuccess: () => { setBulkOpen(false);setTypedConfirmation('');setSelectedIds([]); },
            onError: err => setBulkError(err?.response?.data?.message || err.message || 'No se pudo eliminar la selección.'),
        });
    };

    const openCreate = () => {
        setEditingUser(null);
        setFormOpen(true);
    };

    const openEdit = (u) => {
        setEditingUser(u);
        setFormOpen(true);
    };

    const handleSubmit = (payload) => {
        const action = payload.id
            ? updateMutation
            : createMutation;

        action.mutate(payload, {
            onSuccess: () => setFormOpen(false)
        });
    };

    return (
        <div className="i12-light-page text-slate-900">
            {/* Encabezado */}
            <div className="flex justify-between items-center mb-6 gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    {canReviewSignups && <Link to="/dashboard/students/requests"
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">
                        Solicitudes de inscripción
                    </Link>}
                </div>

                {canManageRole && <button
                    onClick={openCreate}
                    className="bg-[#C61515] text-white hover:bg-red-700 px-4 py-2 rounded text-sm font-medium cursor-pointer"
                >
                    + Agregar
                </button>}
            </div>

            {/* Barra de búsqueda */}
            <div className="mb-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-md">
                        {/* Icono de lupa */}
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="19"
                            height="19"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                        >
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.35-4.35" />
                        </svg>

                        <input
                            type="search"
                            value={searchTerm}
                            onChange={(event) =>
                                setSearchTerm(event.target.value)
                            }
                            placeholder={role === 'student' ? 'Buscar alumno, DNI, email, carrera, turno o curso...' : 'Buscar por nombre, apellido, DNI, email...'}
                            aria-label={`Buscar usuarios en ${title}`}
                            autoComplete="off"
                            className="w-full rounded-lg border border-slate-300 bg-slate-50 py-3 pl-10 pr-10 text-sm text-slate-900 placeholder-slate-500 outline-none transition focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        />

                        {/* Botón para limpiar la búsqueda */}
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                aria-label="Limpiar búsqueda"
                                title="Limpiar búsqueda"
                                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 transition hover:text-white"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="17"
                                    height="17"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <path d="M18 6 6 18" />
                                    <path d="m6 6 12 12" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* Contador de resultados */}
                    {!isLoading && (
                        <div className="text-sm text-slate-600 whitespace-nowrap">
                            {searchTerm.trim() ? (
                                <>
                                    <span className="font-semibold text-red-700">
                                        {filteredUsers.length}
                                    </span>
                                    {' '}de{' '}
                                    <span className="font-semibold text-slate-800">
                                        {roleUsers.length}
                                    </span>
                                    {' '}usuarios
                                </>
                            ) : (
                                <>
                                    <span className="font-semibold text-slate-800">
                                        {roleUsers.length}
                                    </span>
                                    {' '}
                                    {roleUsers.length === 1
                                        ? 'usuario registrado'
                                        : 'usuarios registrados'}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {role === 'student' && (
              <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Filtrar y seleccionar alumnos">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <label className="text-xs font-semibold text-slate-700">Carrera
                    <select value={careerFilter} onChange={e=>{setCareerFilter(e.target.value);setCourseFilter('');}} className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900">
                      <option value="">Todas las carreras</option>
                      {careers.map(([id,nombre])=><option key={id} value={id}>{nombre}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-700">Turno
                    <select value={shiftFilter} onChange={e=>{setShiftFilter(e.target.value);setCourseFilter('');}} className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900">
                      <option value="">Todos los turnos</option>
                      <option value="MANANA">Mañana</option><option value="TARDE">Tarde</option><option value="NOCHE">Noche</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-700">Curso y ciclo lectivo
                    <select value={courseFilter} onChange={e=>setCourseFilter(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900">
                      <option value="">Todos los cursos</option>
                      {visibleStudentCourses.map(c=><option key={c.id} value={c.id}>{c.nombre} · {c.academicYear} · {c.shift || 'Sin turno'}</option>)}
                    </select>
                  </label>
                </div>
                {canDeleteUser && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                    <input type="checkbox" checked={allSelected} disabled={!eligibleFilteredIds.length} onChange={toggleAll} className="accent-[#C61515]" />
                    Seleccionar todos los alumnos filtrados ({eligibleFilteredIds.length})
                  </label>
                  <button type="button" disabled={!selectedIds.length || selectedIds.length>100} onClick={()=>{setBulkOpen(true);setTypedConfirmation('');setBulkError('');}} className="rounded-xl bg-[#C61515] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Eliminar seleccionados ({selectedIds.length})</button>
                  <p className="w-full text-xs text-slate-500">Eliminación irreversible, hasta 100 alumnos por operación. Seleccionar todos incluye únicamente los resultados filtrados.</p>
                </div>}
              </section>
            )}

            {/* Listado de usuarios */}
            {isLoading ? (
                <p className="text-slate-400">
                    Cargando...
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-sm border-collapse">
                        <thead>
                            <tr className="text-left text-slate-600 border-b border-slate-200">
                                {role === 'student' && canDeleteUser && <th className="px-2 py-3"><input aria-label="Seleccionar todos los alumnos filtrados" type="checkbox" checked={allSelected} disabled={!eligibleFilteredIds.length} onChange={toggleAll} className="accent-[#C61515]" /></th>}
                                <th className="py-2">Nombre</th>
                                <th>DNI</th>
                                <th>Email</th>
                                {role === 'student' && <><th>Carrera</th><th>Curso</th><th>Turno</th></>}
                                <th>Estado</th>
                                <th className="text-right">Acciones</th>
                            </tr>
                        </thead>

                        <tbody>
                            {filteredUsers.map((u) => (
                                <tr
                                    key={u.id}
                                    className="border-b border-slate-200 hover:bg-rose-50/40"
                                >
                                    {role === 'student' && canDeleteUser && <td className="px-2"><input aria-label={`Seleccionar a ${u.firstName} ${u.lastName}`} type="checkbox" checked={selectedIds.includes(u.id)} disabled={u.id === currentUser?.id || u.isSuperAdmin} onChange={()=>toggleOne(u.id)} className="accent-[#C61515]" /></td>}
                                    <td className="py-3">
                                        {u.firstName} {u.lastName}
                                    </td>

                                    <td>{u.dni}</td>

                                    <td>{u.email}</td>
                                    {role === 'student' && <>
                                      <td>{studentCourse(u)?.career?.nombre || '—'}</td>
                                      <td>{studentCourse(u) ? `${studentCourse(u).nombre} (${studentCourse(u).academicYear})` : 'Sin matrícula'}</td>
                                      <td>{({MANANA:'Mañana',TARDE:'Tarde',NOCHE:'Noche'})[studentCourse(u)?.shift] || '—'}</td>
                                    </>}
                                    <td>
                                        <span
                                            className={`px-2 py-1 rounded text-xs ${u.isActive
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : 'bg-slate-100 text-slate-700'
                                                }`}
                                        >
                                            {u.signupStatus === 'PENDING' ? 'Pendiente de aprobación'
                                                : u.signupStatus === 'REJECTED' ? 'Solicitud rechazada'
                                                : u.isActive ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>

                                    <td className="text-right space-x-2">
                                        {canManageRole && <button
                                            onClick={() => openEdit(u)}
                                            className="text-red-700 hover:underline text-xs cursor-pointer"
                                        >
                                            Editar
                                        </button>}

                                        {canManageRole && (u.signupStatus === 'PENDING' || u.signupStatus === 'REJECTED' ? (
                                            canReviewSignups ? <Link to="/dashboard/students/requests"
                                                className="text-emerald-700 hover:underline text-xs">Revisar</Link> : null
                                        ) : <button
                                            onClick={() => toggleMutation.mutate({ id: u.id, isActive: !u.isActive })}
                                            className="text-amber-700 hover:underline text-xs cursor-pointer"
                                        >{u.isActive ? 'Desactivar' : 'Activar'}</button>)}

                                        {(canDeleteUser && u.id !== currentUser?.id && (currentUser?.isSuperAdmin || currentUser?.roles?.includes('SUPER_ADMIN') || !u.isSuperAdmin)) && <button
                                            onClick={() =>
                                                setDeletingId(u.id)
                                            }
                                            className="text-red-600 hover:underline text-xs cursor-pointer"
                                        >
                                            Eliminar
                                        </button>}
                                    </td>
                                </tr>
                            ))}

                            {/* No hay usuarios registrados */}
                            {roleUsers.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={role === 'student' ? (canDeleteUser ? 9 : 8) : 5}
                                        className="py-8 text-center text-slate-500"
                                    >
                                        Sin registros.
                                    </td>
                                </tr>
                            )}

                            {/* No hay coincidencias */}
                            {roleUsers.length > 0 &&
                                filteredUsers.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={role === 'student' ? (canDeleteUser ? 9 : 8) : 5}
                                            className="py-10 text-center"
                                        >
                                            <div className="flex flex-col items-center gap-3">
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="32"
                                                    height="32"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="1.5"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    aria-hidden="true"
                                                    className="text-slate-500"
                                                >
                                                    <circle
                                                        cx="11"
                                                        cy="11"
                                                        r="8"
                                                    />
                                                    <path d="m21 21-4.35-4.35" />
                                                </svg>

                                                <p className="text-slate-400">
                                                    No se encontraron usuarios que coincidan con{' '}
                                                    <span className="font-medium text-slate-900">
                                                        "{searchTerm}"
                                                    </span>
                                                </p>

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setSearchTerm('')
                                                    }
                                                    className="cursor-pointer text-sm text-red-700 hover:text-red-800 hover:underline"
                                                >
                                                    Limpiar búsqueda
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal de creación y edición */}
            <UserFormModal
                open={formOpen}
                role={role}
                initialData={editingUser}
                onSubmit={handleSubmit}
                onClose={() => setFormOpen(false)}
                isSaving={
                    createMutation.isPending ||
                    updateMutation.isPending
                }
            />

            {deleteMutation.isError && <div role="alert" className="mb-3 rounded-xl border border-rose-500/50 bg-rose-500/10 p-3 text-sm text-rose-700">{deleteMutation.error?.response?.data?.message || deleteMutation.error?.message || 'No se pudo completar la operación.'}</div>}

            {/* Confirmación de eliminación */}
            <ConfirmDialog
                open={Boolean(deletingId)}
                title={`Eliminar definitivamente ${role === 'student' ? 'al alumno' : 'la cuenta'}`}
                message={'Esta acción es IRREVERSIBLE: eliminará físicamente la cuenta y sus datos privados. Si tiene registros institucionales que deben conservarse (avisos, asistencia registrada o invitaciones), el servidor bloqueará el borrado. ¿Confirmás?'}
                confirmLabel="Eliminar definitivamente"
                onCancel={() => setDeletingId(null)}
                onConfirm={() =>
                    deleteMutation.mutate(deletingId, {
                        onSuccess: () =>
                            setDeletingId(null)
                    })
                }
            />
            {bulkOpen && <div role="presentation" className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 p-4" onMouseDown={e=>{if(e.target===e.currentTarget && !bulkDeleteMutation.isPending) setBulkOpen(false);}}>
              <div role="dialog" aria-modal="true" aria-labelledby="bulk-delete-heading" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl">
                <h3 id="bulk-delete-heading" className="text-lg font-bold">Eliminar definitivamente {selectedIds.length} alumnos</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">Se borrarán sus cuentas, matrículas, asistencias personales, notificaciones y datos relacionados. <strong>Esta acción no se puede deshacer.</strong> No la uses como cierre normal del ciclo lectivo: primero exportá o conservá el historial necesario.</p>
                <label className="mt-4 block text-sm font-medium text-slate-800">Escribí ELIMINAR para confirmar
                  <input autoFocus value={typedConfirmation} onChange={e=>setTypedConfirmation(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none focus:border-red-500" placeholder="ELIMINAR" />
                </label>
                {bulkError && <p role="alert" className="mt-3 text-sm text-red-700">{bulkError}</p>}
                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" disabled={bulkDeleteMutation.isPending} onClick={()=>setBulkOpen(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm">Cancelar</button>
                  <button type="button" disabled={typedConfirmation !== 'ELIMINAR' || bulkDeleteMutation.isPending} onClick={confirmBulk} className="rounded-lg bg-[#C61515] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{bulkDeleteMutation.isPending ? 'Eliminando…' : 'Eliminar definitivamente'}</button>
                </div>
              </div>
            </div>}
        </div>
    );
}
