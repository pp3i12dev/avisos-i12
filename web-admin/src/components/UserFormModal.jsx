import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useInstitutions, useMyInstitution } from '../hooks/useInstitution';
import { useUserRoles, useUpdateUserRoles } from '../hooks/useUsers';
import PreceptorCoveragePicker from './PreceptorCoveragePicker';

const baseEmpty = {
    dni: '',
    email: '',
    telefono: '',
    firstName: '',
    lastName: '',
    password: '',
    institutionId: '',
};

const ROLE_EXTRA_FIELDS = {
    student: { legajoStudent: '' },
    teacher: { legajoTeacher: '', specialty: '' },
    preceptor: { legajoPreceptor: '', coverages: [] },
    director: { position: '' },
};

const ROLE_REQUIRED_FIELDS = {
    student: ['legajoStudent'],
    teacher: ['legajoTeacher'],
    preceptor: ['legajoPreceptor'],
    director: [],
};

export default function UserFormModal({
    open,
    role,
    initialData,
    onSubmit,
    onClose,
    isSaving,
}) {
    const isEditing = Boolean(initialData?.id);
    const { user: currentUser } = useContext(AuthContext);
    const isSuperAdmin = currentUser?.isSuperAdmin === true || currentUser?.roles?.includes('SUPER_ADMIN');
    const { data: institutionData = [] } = useInstitutions(open && isSuperAdmin);
    const { data: myInstitution } = useMyInstitution(open && !isSuperAdmin);
    const institutions = Array.isArray(institutionData) ? institutionData : (institutionData?.institutions ?? []);

    const [showPassword, setShowPassword] = useState(false);
    const [confirmInstitutionTransfer, setConfirmInstitutionTransfer] = useState(false);

    /*
     * Roles actuales del usuario.
     * Solo se utilizan al editar un usuario.
     */
    const { data: userRoles } = useUserRoles(initialData?.id);
    const updateRolesMutation = useUpdateUserRoles();

    const [roleChecks, setRoleChecks] = useState({
        student: false,
        teacher: false,
        preceptor: false,
        director: false,
    });

    const [roleExtraData, setRoleExtraData] = useState({});

    const [form, setForm] = useState({
        ...baseEmpty,
        ...ROLE_EXTRA_FIELDS[role],
    });

    /*
     * Sincronizar los roles actuales cuando llegan desde backend.
     */
    useEffect(() => {
        if (!userRoles) return;

        setRoleChecks({
            student: Boolean(userRoles.profiles?.student),
            teacher: Boolean(userRoles.profiles?.teacher),
            preceptor: Boolean(userRoles.profiles?.preceptor),
            director: Boolean(userRoles.profiles?.director),
        });
    }, [userRoles]);

    /*
     * Inicializar / reinicializar el formulario.
     */
    useEffect(() => {
        if (!open) return;

        setShowPassword(false);
        setConfirmInstitutionTransfer(false);
        setRoleExtraData({});

        if (initialData) {
            setForm({
                dni: initialData.dni ?? '',
                email: initialData.email ?? '',
                telefono: initialData.telefono ?? '',
                firstName: initialData.firstName ?? '',
                lastName: initialData.lastName ?? '',
                password: '',
                institutionId: String(initialData.institutionId ?? currentUser?.institutionId ?? ''),
                ...(role === 'student' && {
                    legajoStudent:
                        initialData.profile?.legajoStudent ?? '',
                }),

                ...(role === 'teacher' && {
                    legajoTeacher:
                        initialData.profile?.legajoTeacher ?? '',
                    specialty:
                        initialData.profile?.specialty ?? '',
                }),

                ...(role === 'preceptor' && {
                    legajoPreceptor:
                        initialData.profile?.legajoPreceptor ?? '',
                    coverages: (initialData.profile?.coverages || []).map(c => ({ careerId: c.careerId, shift: c.shift, career: c.career })),
                }),

                ...(role === 'director' && {
                    position:
                        initialData.profile?.position ?? '',
                }),
            });
        } else {
            setForm({
                ...baseEmpty,
                ...ROLE_EXTRA_FIELDS[role],
                institutionId: String(currentUser?.institutionId ?? ''),
            });

            setRoleChecks({
                student: false,
                teacher: false,
                preceptor: false,
                director: false,
            });
        }
    }, [initialData, open, role, currentUser?.institutionId]);

    /*
     * Cambiar un rol del usuario.
     */
    const toggleRole = (roleKey) => {
        setRoleChecks((prev) => ({
            ...prev,
            [roleKey]: !prev[roleKey],
        }));
    };

    /*
     * Guardar cambios de roles.
     */
    const handleSaveRoles = () => {
        const payload = {};

        for (const roleKey of Object.keys(ROLE_EXTRA_FIELDS)) {
            const wasEnabled = Boolean(
                userRoles?.profiles?.[roleKey]
            );

            const isEnabled = Boolean(
                roleChecks[roleKey]
            );

            if (wasEnabled === isEnabled) continue;

            payload[roleKey] = {
                enabled: isEnabled,
                ...(roleExtraData[roleKey] || {}),
            };
        }

        if (Object.keys(payload).length === 0) return;

        updateRolesMutation.mutate({
            id: initialData.id,
            roles: payload,
        });
    };

    /*
     * Cambios de los campos principales.
     */
    const handleChange = (e) => {
        setForm((current) => ({
            ...current,
            [e.target.name]: e.target.value,
        }));
    };

    /*
     * Guardar usuario.
     */
    const handleSubmit = (e) => {
        e.preventDefault();

        const payload = { ...form };
        // La institución nunca se elige libremente salvo por el superadministrador.
        if (!isSuperAdmin) delete payload.institutionId;
        else {
            payload.institutionId = Number(payload.institutionId);
            if (isEditing && payload.institutionId !== Number(initialData?.institutionId)) {
                payload.confirmInstitutionTransfer = confirmInstitutionTransfer;
            }
        }

        /*
         * Al editar:
         * contraseña vacía = conservar contraseña actual.
         */
        if (isEditing && !payload.password) {
            delete payload.password;
        }

        onSubmit(
            isEditing
                ? {
                    id: initialData.id,
                    ...payload,
                }
                : payload
        );
    };

    if (!open) return null;

    return (
        <div className="i12-light-modal fixed inset-x-0 bottom-0 top-[116px] bg-black/50 flex items-start justify-center z-[120] overflow-y-auto px-3 py-6">

            <form
                onSubmit={handleSubmit}
                className="w-full max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl"
            >

                {/* ========================= */}
                {/* TÍTULO */}
                {/* ========================= */}

                <h3 className="text-lg font-semibold">
                    {isEditing ? 'Editar' : 'Nuevo'} {role}
                </h3>

                {/* Institución obligatoria para todos los usuarios: la autoridad local no puede cambiarla. */}
                {isSuperAdmin ? <label className="block space-y-1.5 text-sm text-slate-700">
                    <span className="font-semibold">Institución del usuario</span>
                    <select name="institutionId" required value={form.institutionId} onChange={e => setForm(old => ({ ...old, institutionId: e.target.value, courseId: '', coverages: [] }))}
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-900">
                        <option value="">Seleccionar institución</option>
                        {institutions.filter(i => i.isActive).map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                    </select>
                </label> : <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3 text-sm text-slate-300">
                    <span className="block text-xs uppercase tracking-wider text-slate-400">Institución asignada</span>
                    {myInstitution?.nombre ? `${myInstitution.nombre} (asignación automática)` : 'Se asigna automáticamente la institución de tu cuenta.'}
                </div>}

                {isSuperAdmin && isEditing && Number(form.institutionId) !== Number(initialData?.institutionId) && <div className="rounded-xl border-2 border-amber-400/70 bg-amber-500/10 p-3 text-sm text-amber-100">
                    <p className="font-bold">Traslado de institución</p>
                    <p className="mt-1">El usuario perderá sus matrículas y asignaciones docentes vigentes. Su historial académico se conservará y deberá asignarse nuevamente al curso o materia de destino.</p>
                    <label className="mt-3 flex cursor-pointer items-start gap-2">
                        <input type="checkbox" checked={confirmInstitutionTransfer} onChange={e => setConfirmInstitutionTransfer(e.target.checked)} className="mt-1 accent-amber-400" required />
                        <span>Confirmo el traslado a otra institución y la desvinculación de asignaciones vigentes.</span>
                    </label>
                </div>}

                {/* ========================= */}
                {/* NOMBRE Y APELLIDO */}
                {/* ========================= */}

                <div className="grid grid-cols-2 gap-4">

                    <input
                        name="firstName"
                        value={form.firstName}
                        onChange={handleChange}
                        placeholder="Nombre"
                        required
                        className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500"
                    />

                    <input
                        name="lastName"
                        value={form.lastName}
                        onChange={handleChange}
                        placeholder="Apellido"
                        required
                        className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500"
                    />

                </div>

                {/* ========================= */}
                {/* DNI */}
                {/* ========================= */}

                <input
                    name="dni"
                    value={form.dni}
                    onChange={handleChange}
                    placeholder="DNI"
                    required
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500"
                />

                {/* ========================= */}
                {/* TELEFONO OPCIONAL: todos los perfiles */}
                <label className="block space-y-1 text-sm font-medium text-slate-700">
                    <span>Teléfono móvil (opcional)</span>
                    <input
                        name="telefono"
                        type="tel"
                        value={form.telefono ?? ''}
                        onChange={handleChange}
                        placeholder="Ej. +54 9 221 456-7890"
                        autoComplete="tel"
                        maxLength={35}
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/15"
                    />
                </label>

                {/* EMAIL */}
                {/* ========================= */}

                <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="Email"
                    required
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500"
                />

                {/* ========================= */}
                {/* PASSWORD */}
                {/* ========================= */}

                <div className="relative">

                    <input
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={handleChange}
                        placeholder={
                            isEditing
                                ? 'Nueva contraseña (opcional)'
                                : 'Contraseña'
                        }
                        required={!isEditing}
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 pr-10 text-sm text-slate-900 placeholder:text-slate-500"
                    />

                    <button
                        type="button"
                        onClick={() =>
                            setShowPassword((prev) => !prev)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                        aria-label={
                            showPassword
                                ? 'Ocultar contraseña'
                                : 'Mostrar contraseña'
                        }
                    >
                        {showPassword ? '🙈' : '👁️'}
                    </button>

                </div>

                {/* ========================= */}
                {/* DATOS DEL ALUMNO */}
                {/* ========================= */}

                {role === 'student' && (
                    <div className="space-y-4">

                        <input
                            name="legajoStudent"
                            value={form.legajoStudent}
                            onChange={handleChange}
                            placeholder="Legajo"
                            required
                            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500"
                        />

                        {!isEditing && <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">El alumno podrá seguir los avisos de materias de varias carreras y turnos desde «Mis suscripciones». No se realiza una matrícula académica oficial.</p>}
                    </div>
                )}

                {/* ========================= */}
                {/* DATOS DEL DOCENTE */}
                {/* ========================= */}

                {role === 'teacher' && (
                    <>
                        <input
                            name="legajoTeacher"
                            value={form.legajoTeacher}
                            onChange={handleChange}
                            placeholder="Legajo"
                            required
                            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500"
                        />

                        <input
                            name="specialty"
                            value={form.specialty}
                            onChange={handleChange}
                            placeholder="Especialidad"
                            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500"
                        />
                    </>
                )}

                {/* ========================= */}
                {/* DATOS DEL PRECEPTOR */}
                {/* ========================= */}

                {role === 'preceptor' && (
                    <>
                        <input
                            name="legajoPreceptor"
                            value={form.legajoPreceptor}
                            onChange={handleChange}
                            placeholder="Legajo"
                            required
                            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500"
                        />

                        <PreceptorCoveragePicker
                            institutionId={isSuperAdmin ? form.institutionId : currentUser?.institutionId}
                            value={form.coverages || []}
                            onChange={coverages => setForm(current => ({ ...current, coverages }))}
                            disabled={isSaving}
                        />
                    </>
                )}

                {/* ========================= */}
                {/* DATOS DEL DIRECTOR */}
                {/* ========================= */}

                {role === 'director' && (
                    <input
                        name="position"
                        value={form.position}
                        onChange={handleChange}
                        placeholder="Cargo"
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500"
                    />
                )}

                {/* ========================= */}
                {/* ROLES */}
                {/* ========================= */}

                {isEditing && userRoles && (
                    <div className="border-t border-slate-800 pt-4 mt-2">

                        <p className="text-sm font-semibold text-slate-300 mb-2">
                            Roles asignados
                        </p>

                        {Object.entries(ROLE_EXTRA_FIELDS).map(
                            ([roleKey]) => {

                                const wasEnabled = Boolean(
                                    userRoles.profiles?.[roleKey]
                                );

                                const isChecked =
                                    roleChecks[roleKey] ??
                                    wasEnabled;

                                const isNewlyChecked =
                                    isChecked && !wasEnabled;

                                const isBeingRemoved =
                                    !isChecked && wasEnabled;

                                return (
                                    <div
                                        key={roleKey}
                                        className="mb-2"
                                    >

                                        <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">

                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() =>
                                                    toggleRole(roleKey)
                                                }
                                                className="accent-blue-600 cursor-pointer"
                                            />

                                            {roleKey}

                                            {isBeingRemoved && (
                                                <span className="text-red-400 text-xs">
                                                    (se va a quitar)
                                                </span>
                                            )}

                                        </label>

                                        {isNewlyChecked &&
                                            ROLE_REQUIRED_FIELDS[
                                                roleKey
                                            ]?.map((field) => (
                                                <input
                                                    key={field}
                                                    placeholder={field}
                                                    required
                                                    onChange={(e) =>
                                                        setRoleExtraData(
                                                            (prev) => ({
                                                                ...prev,
                                                                [roleKey]: {
                                                                    ...prev[
                                                                    roleKey
                                                                    ],
                                                                    [field]:
                                                                        e.target.value,
                                                                },
                                                            })
                                                        )
                                                    }
                                                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm"
                                                />
                                            ))}
                                    </div>
                                );
                            }
                        )}

                        <button
                            type="button"
                            onClick={handleSaveRoles}
                            disabled={
                                updateRolesMutation.isPending
                            }
                            className="mt-2 px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-xs disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                        >
                            {updateRolesMutation.isPending
                                ? 'Guardando roles...'
                                : 'Guardar cambios de roles'}
                        </button>

                    </div>
                )}

                {/* ========================= */}
                {/* BOTONES */}
                {/* ========================= */}

                <div className="flex justify-end gap-3 pt-2">

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        disabled={isSaving}
                        className="rounded-xl bg-[#C61515] px-4 py-2 font-semibold hover:bg-red-700 text-white disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                    >
                        {isSaving
                            ? 'Guardando...'
                            : 'Guardar'}
                    </button>

                </div>

            </form>

        </div>
    );
}