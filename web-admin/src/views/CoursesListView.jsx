import { Link } from 'react-router-dom';
import { useContext, useMemo, useState } from 'react';
import {
    Plus,
    Pencil,
    Trash2,
    Power,
    Users,
    BookOpen,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';

import { AuthContext } from '../context/AuthContext';

import {
    useCoursesAdmin,
    useCreateCourse,
    useUpdateCourse,
    useDeleteCourse,
    useSetCourseStatus,
} from '../hooks/useCourseAdmin';

import { useInstitutions } from '../hooks/useInstitution';

import CourseFormModal from '../components/CourseFormModal';
import CourseDeletionModal from '../components/CourseDeletionModal';
import { SHIFTS, shiftLabel } from '../utils/courseShift';

function getErrorMessage(error) {
    return (
        error?.response?.data?.message ||
        error?.message ||
        'Ocurrió un error al realizar la operación.'
    );
}

export default function CoursesListView() {
    const { user } = useContext(AuthContext);

    const isSuperAdmin = user?.isSuperAdmin === true || user?.roles?.includes('SUPER_ADMIN');
    const canManageCourseLifecycle = isSuperAdmin || user?.roles?.includes('DIRECTOR');

    const {
        data: courses = [],
        isLoading,
        error,
    } = useCoursesAdmin();

    const { data: institutions = [] } = useInstitutions();

    const createMutation = useCreateCourse();
    const updateMutation = useUpdateCourse();
    const deleteMutation = useDeleteCourse();
    const statusMutation = useSetCourseStatus();

    const [search, setSearch] = useState('');
    const [selectedInstitution, setSelectedInstitution] = useState('');
    const [selectedCareer, setSelectedCareer] = useState('');
    const [selectedCourseFilter, setSelectedCourseFilter] = useState('');
    const [selectedShift, setSelectedShift] = useState('');
    const [statusFilter, setStatusFilter] = useState('ACTIVE');

    const [formOpen, setFormOpen] = useState(false);
    const [editingCourse, setEditingCourse] = useState(null);
    const [deletingCourse, setDeletingCourse] = useState(null);

    const [selectedCourseId, setSelectedCourseId] = useState(null);

    const [formError, setFormError] = useState('');
    const [actionError, setActionError] = useState('');

    const institutionMap = useMemo(
        () => new Map(institutions.map((item) => [item.id, item.nombre])),
        [institutions]
    );

    // Cada selector restringe el siguiente: institución → carrera → curso.
    // Un director solo recibe cursos autorizados de su institución desde la API.
    const careerChoices = useMemo(() => {
        const map = new Map();
        courses.forEach((course) => {
            if (isSuperAdmin && selectedInstitution &&
                String(course.institutionId) !== selectedInstitution) return;
            if (course.careerId && course.career) {
                map.set(String(course.careerId), course.career.nombre);
            }
        });
        return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'));
    }, [courses, isSuperAdmin, selectedInstitution]);

    const courseChoices = useMemo(() => courses.filter((course) => {
        if (isSuperAdmin && selectedInstitution &&
            String(course.institutionId) !== selectedInstitution) return false;
        if (selectedCareer && String(course.careerId) !== selectedCareer) return false;
        if (selectedShift && course.shift !== selectedShift) return false;
        return true;
    }).sort((a, b) =>
        (a.nombre || '').localeCompare(b.nombre || '', 'es') ||
        b.academicYear - a.academicYear
    ), [courses, isSuperAdmin, selectedInstitution, selectedCareer, selectedShift]);

    const filteredCourses = useMemo(() => {
        const term = search.trim().toLocaleLowerCase('es');
        return courseChoices.filter((course) => {
            if (selectedCourseFilter && String(course.id) !== selectedCourseFilter) return false;
            if (statusFilter === 'ACTIVE' && course.isActive === false) return false;
            if (statusFilter === 'INACTIVE' && course.isActive !== false) return false;
            const searchable = [
                course.nombre, course.academicYear, shiftLabel(course.shift),
                course.career?.nombre, course.career?.level,
                course.institution?.nombre, institutionMap.get(course.institutionId),
                course.id,
            ].filter(value => value != null).join(' ').toLocaleLowerCase('es');
            return searchable.includes(term);
        });
    }, [courseChoices, search, selectedCourseFilter, institutionMap, statusFilter]);

    const handleInstitutionFilter = (value) => {
        setSelectedInstitution(value);
        setSelectedCareer('');
        setSelectedCourseFilter('');
        setSelectedCourseId(null);
    };
    const handleCareerFilter = (value) => {
        setSelectedCareer(value);
        setSelectedCourseFilter('');
        setSelectedCourseId(null);
    };
    const handleShiftFilter = (value) => {
        setSelectedShift(value);
        setSelectedCourseFilter('');
        setSelectedCourseId(null);
    };

    const selectedCourse = courses.find(
        (course) => course.id === selectedCourseId
    );

    const openCreate = () => {
        setEditingCourse(null);
        setFormError('');
        setFormOpen(true);
    };

    const openEdit = (course) => {
        setEditingCourse(course);
        setFormError('');
        setFormOpen(true);
    };

    const closeForm = () => {
        setFormOpen(false);
        setEditingCourse(null);
        setFormError('');
    };

    const handleSubmit = (payload) => {
        setFormError('');

        const mutation = payload.id
            ? updateMutation
            : createMutation;

        mutation.mutate(payload, {
            onSuccess: closeForm,
            onError: (mutationError) => {
                setFormError(getErrorMessage(mutationError));
            },
        });
    };

    const handleDelete = (payload) => {
        setActionError('');
        deleteMutation.mutate(payload, {
            onSuccess: () => {
                if (selectedCourseId === payload.id) setSelectedCourseId(null);
                setDeletingCourse(null);
            },
            onError: error => setActionError(getErrorMessage(error)),
        });
    };
    const toggleStatus = course => {
        setActionError('');
        statusMutation.mutate({ id: course.id, isActive: course.isActive === false }, {
            onSuccess: () => { if (selectedCourseId === course.id) setSelectedCourseId(null); },
            onError: error => setActionError(getErrorMessage(error)),
        });
    };

    const toggleStudents = (courseId) => {
        setSelectedCourseId((current) =>
            current === courseId ? null : courseId
        );
    };

    const buttonClass =
        'inline-flex cursor-pointer items-center justify-center gap-2 ' +
        'rounded-lg px-3 py-2 text-sm font-medium transition-colors';

    return (
        <div className="space-y-6 text-slate-900">
            <div className="flex flex-wrap items-center justify-end gap-4">
                <button
                    type="button"
                    onClick={openCreate}
                    className={`${buttonClass} bg-[#C61515] text-white hover:bg-red-700`}
                >
                    <Plus size={18} />
                    Nuevo curso
                </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {isSuperAdmin && (
                        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                            Institución
                            <select
                                aria-label="Filtrar por institución"
                                value={selectedInstitution}
                                onChange={e => handleInstitutionFilter(e.target.value)}
                                className="min-h-11 rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-normal text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                            >
                                <option value="">Todas las instituciones</option>
                                {institutions.map(inst => (
                                    <option key={inst.id} value={inst.id}>{inst.nombre}</option>
                                ))}
                            </select>
                        </label>
                    )}
                    <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                        Carrera
                        <select
                            aria-label="Filtrar por carrera"
                            value={selectedCareer}
                            onChange={e => handleCareerFilter(e.target.value)}
                            className="min-h-11 rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-normal text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                        >
                            <option value="">Todas las carreras</option>
                            {careerChoices.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                        Turno
                        <select
                            aria-label="Filtrar cursos por turno"
                            value={selectedShift}
                            onChange={e => handleShiftFilter(e.target.value)}
                            className="min-h-11 rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-normal text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                        >
                            <option value="">Todos los turnos</option>
                            {SHIFTS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                        Curso / año lectivo
                        <select
                            aria-label="Filtrar por curso"
                            value={selectedCourseFilter}
                            onChange={e => { setSelectedCourseFilter(e.target.value); setSelectedCourseId(null); }}
                            className="min-h-11 rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-normal text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                        >
                            <option value="">Todos los cursos</option>
                            {courseChoices.map(course => (
                                <option key={course.id} value={course.id}>
                                    {course.nombre} · {course.academicYear} · {shiftLabel(course.shift)}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">Estado
                        <select value={statusFilter} onChange={e => {setStatusFilter(e.target.value);setSelectedCourseId(null);}} className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900">
                            <option value="ACTIVE">Activos</option><option value="INACTIVE">Desactivados</option><option value="ALL">Todos</option>
                        </select>
                    </label>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <input
                        type="search"
                        aria-label="Buscar cursos"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por carrera, curso, turno o año..."
                        className="min-h-11 w-full max-w-xl rounded-lg border border-slate-300 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                    />
                    <span className="text-xs text-slate-500">
                        {filteredCourses.length} curso(s) encontrados
                    </span>
                </div>
            </div>

            {actionError && (
                <p role="alert" className="text-sm text-red-700">
                    {actionError}
                </p>
            )}

            {error && (
                <p role="alert" className="text-sm text-red-700">
                    {getErrorMessage(error)}
                </p>
            )}

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                Las suscripciones a avisos no constituyen una matrícula académica. Para gestionar quién recibe los avisos de cada materia, abrí <Link className="font-bold underline" to="/dashboard/notice-subscriptions/admin">Suscripciones de alumnos</Link>. Las asignaciones antiguas de alumnos a cursos se conservan solo como datos de transición.
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 text-slate-600">
                        <tr>
                            <th className="px-4 py-3">Curso</th>
                            <th className="px-4 py-3">Carrera / Nivel</th>
                            <th className="px-4 py-3">Turno</th>
                            <th className="px-4 py-3">Año lectivo</th>

                            {isSuperAdmin && (
                                <th className="px-4 py-3">Institución</th>
                            )}

                            <th className="px-4 py-3 text-right">Acciones</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-200">
                        {isLoading ? (
                            <tr>
                                <td
                                    colSpan={isSuperAdmin ? 6 : 5}
                                    className="px-4 py-8 text-center text-slate-400"
                                >
                                    Cargando cursos...
                                </td>
                            </tr>
                        ) : filteredCourses.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={isSuperAdmin ? 6 : 5}
                                    className="px-4 py-8 text-center text-slate-400"
                                >
                                    No se encontraron cursos.
                                </td>
                            </tr>
                        ) : (
                            filteredCourses.map((course) => {
                                const isSelected =
                                    selectedCourseId === course.id;

                                return (
                                    <tr
                                        key={course.id}
                                        className={
                                            isSelected
                                                ? 'bg-rose-50'
                                                : 'hover:bg-slate-50'
                                        }
                                    >
                                        <td className="px-4 py-3 font-medium">
                                            {course.nombre}
                                            {course.isActive === false && <span className="ml-2 rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-700">Inactivo</span>}
                                        </td>

                                        <td className="px-4 py-3">
                                            {course.career?.nombre || (
                                                <span className="text-amber-700">
                                                    Sin carrera asignada
                                                </span>
                                            )}
                                        </td>

                                        <td className="px-4 py-3"><span className="rounded-full bg-rose-50 px-3 py-1 text-red-700">{shiftLabel(course.shift)}</span></td>
                                        <td className="px-4 py-3">
                                            {course.academicYear}
                                        </td>

                                        {isSuperAdmin && (
                                            <td className="px-4 py-3">
                                                {course.institution?.nombre ||
                                                    institutionMap.get(course.institutionId) ||
                                                    'Sin información'}
                                            </td>
                                        )}

                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap justify-end gap-2">
                                                <Link
                                                    to="/dashboard/notice-subscriptions/admin"
                                                    title="Gestionar suscripciones a avisos de las materias (no matrícula oficial)"
                                                    className={`${buttonClass} border border-red-200 text-red-700 hover:bg-red-50`}
                                                >
                                                    <Users size={16} />
                                                    Suscripciones
                                                </Link>

                                                <button
                                                    type="button"
                                                    onClick={() => openEdit(course)}
                                                    title="Editar curso"
                                                    aria-label={`Editar ${course.nombre}`}
                                                    className={`${buttonClass} border border-slate-300 text-slate-700 hover:bg-slate-100`}
                                                >
                                                    <Pencil size={16} />
                                                </button>

                                                {canManageCourseLifecycle && <button type="button" onClick={() => toggleStatus(course)}
                                                    disabled={statusMutation.isPending}
                                                    title={course.isActive === false ? 'Reactivar curso' : 'Desactivar curso'}
                                                    className={`${buttonClass} border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-50`}>
                                                    <Power size={16} /> {course.isActive === false ? 'Reactivar' : 'Desactivar'}
                                                </button>}
                                                {canManageCourseLifecycle && <button
                                                    type="button"
                                                    onClick={() => setDeletingCourse(course)}
                                                    title="Eliminar curso"
                                                    aria-label={`Eliminar ${course.nombre}`}
                                                    className={`${buttonClass} border border-red-200 text-red-700 hover:bg-red-50`}
                                                >
                                                    <Trash2 size={16} />
                                                </button>}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <CourseFormModal
                open={formOpen}
                initialData={editingCourse}
                onSubmit={handleSubmit}
                onClose={closeForm}
                isSaving={
                    createMutation.isPending || updateMutation.isPending
                }
                isSuperAdmin={isSuperAdmin}
                institutionId={
                    isSuperAdmin
                        ? selectedInstitution || editingCourse?.institutionId || null
                        : user?.institutionId ?? null
                }
                formError={formError}
            />

            <CourseDeletionModal course={deletingCourse} onClose={() => setDeletingCourse(null)}
                onDelete={handleDelete} saving={deleteMutation.isPending} serverError={actionError} />
        </div>
    );
}
