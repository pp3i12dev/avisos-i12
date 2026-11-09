import { useContext, useEffect, useState } from 'react';
import {
    UserRound,
    ShieldCheck,
    Save,
    Eye,
    EyeOff,
    Mail,
    Phone,
    IdCard,
    BookOpen,
    LockKeyhole,
    CheckCircle2,
    AlertCircle,
    LoaderCircle,
} from 'lucide-react';

import { AuthContext } from '../context/AuthContext';
import WebPushSettings from '../components/WebPushSettings';
import ContactPrivacySettings from '../components/ContactPrivacySettings';

const API_BASE_URL = (
    import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
).replace(/\/$/, '');

const ROLE_LABELS = {
    SUPER_ADMIN: 'Superadministrador',
    DIRECTOR: 'Directivo',
    PRECEPTOR: 'Preceptor',
    TEACHER: 'Docente',
    STUDENT: 'Alumno',
};

function getErrorMessage(error) {
    return error instanceof Error
        ? error.message
        : 'Ocurrió un error inesperado';
}

async function requestProfile(path, token, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(
            data?.message ||
            `Error al procesar la solicitud (${response.status})`
        );
    }

    return data;
}

function FormField({
    label,
    value,
    onChange,
    type = 'text',
    disabled = false,
    icon: Icon,
    placeholder,
    autoComplete,
    maxLength,
    inputMode,
}) {
    return (
        <label className="block min-w-0">
            <span className="mb-2 block text-sm font-semibold text-slate-300">
                {label}
            </span>

            <div className="relative">
                {Icon && (
                    <Icon
                        size={18}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                )}

                <input
                    type={type}
                    value={value ?? ''}
                    onChange={onChange}
                    disabled={disabled}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    maxLength={maxLength}
                    inputMode={inputMode}
                    className={`w-full min-w-0 rounded-xl border px-4 py-3 text-sm outline-none transition-colors ${Icon ? 'pl-11' : ''
                        } ${disabled
                            ? 'cursor-not-allowed border-slate-700 bg-slate-800/60 text-slate-400'
                            : 'border-slate-600 bg-slate-900 text-white placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/15'
                        }`}
                />
            </div>
        </label>
    );
}

function PasswordField({
    label,
    value,
    onChange,
    visible,
    onToggle,
    autoComplete,
}) {
    return (
        <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-300">
                {label}
            </span>

            <div className="relative">
                <LockKeyhole
                    size={18}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                    type={visible ? 'text' : 'password'}
                    value={value}
                    onChange={onChange}
                    autoComplete={autoComplete}
                    required
                    className="w-full rounded-xl border border-slate-600 bg-slate-900 py-3 pl-11 pr-12 text-sm text-white outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-500/15"
                />

                <button
                    type="button"
                    onClick={onToggle}
                    aria-label={
                        visible
                            ? 'Ocultar contraseña'
                            : 'Mostrar contraseña'
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1 text-slate-400 transition-colors hover:text-white"
                >
                    {visible ? (
                        <EyeOff size={19} />
                    ) : (
                        <Eye size={19} />
                    )}
                </button>
            </div>
        </label>
    );
}

function Feedback({ message, type }) {
    if (!message) return null;

    const success = type === 'success';

    return (
        <div
            role={success ? 'status' : 'alert'}
            className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${success
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                }`}
        >
            {success ? (
                <CheckCircle2 size={19} className="shrink-0" />
            ) : (
                <AlertCircle size={19} className="shrink-0" />
            )}

            <span>{message}</span>
        </div>
    );
}

function ProfileInfo({ label, value }) {
    return (
        <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {label}
            </p>

            <p className="mt-2 break-words text-sm font-medium text-slate-100">
                {value || 'No informado'}
            </p>
        </div>
    );
}

export default function ProfileView() {
    const {
        user,
        token,
        updateUserContext,
    } = useContext(AuthContext);

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);

    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        email: '',
        telefono: '',
        legajoStudent: '',
        legajoTeacher: '',
        legajoPreceptor: '',
    });

    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    const [passwordVisibility, setPasswordVisibility] = useState({
        currentPassword: false,
        newPassword: false,
        confirmPassword: false,
    });

    const [profileFeedback, setProfileFeedback] = useState(null);
    const [passwordFeedback, setPasswordFeedback] = useState(null);
    const [loadError, setLoadError] = useState('');

    useEffect(() => {
        let cancelled = false;

        async function loadProfile() {
            setLoading(true);
            setLoadError('');

            try {
                const data = await requestProfile(
                    '/users/me',
                    token
                );

                if (cancelled) return;

                setProfile(data);

                setForm({
                    firstName: data.firstName || '',
                    lastName: data.lastName || '',
                    email: data.email || '',
                    telefono: data.telefono || '',
                    legajoStudent: data.profiles?.student?.legajoStudent || '',
                    legajoTeacher: data.profiles?.teacher?.legajoTeacher || '',
                    legajoPreceptor: data.profiles?.preceptor?.legajoPreceptor || '',
                });
            } catch (error) {
                if (!cancelled) {
                    setLoadError(getErrorMessage(error));
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        if (token) {
            loadProfile();
        } else {
            setLoading(false);
            setLoadError('No hay una sesión activa.');
        }

        return () => {
            cancelled = true;
        };
    }, [token]);

    const handleProfileChange = (field, value) => {
        setForm(current => ({
            ...current,
            [field]: value,
        }));

        setProfileFeedback(null);
    };

    const handleSaveProfile = async event => {
        event.preventDefault();

        setProfileFeedback(null);

        const telefono = form.telefono.trim();

        // Validación inicial de caracteres.
        // El backend realiza la validación definitiva.
        if (telefono && !/^\+?[\d\s().-]+$/.test(telefono)) {
            setProfileFeedback({
                type: 'error',
                message:
                    'El teléfono solo puede contener números, espacios, paréntesis, guiones y el prefijo +54.',
            });
            return;
        }

        if (telefono.length > 35) {
            setProfileFeedback({
                type: 'error',
                message: 'El teléfono es demasiado largo.',
            });
            return;
        }

        setSaving(true);

        try {
            const updated = await requestProfile(
                '/users/me',
                token,
                {
                    method: 'PATCH',
                    body: JSON.stringify({
                        firstName: form.firstName.trim(),
                        lastName: form.lastName.trim(),
                        email: form.email.trim(),
                        telefono,
                        ...(profile?.profiles?.student ? {legajoStudent: form.legajoStudent.trim()} : {}),
                        ...(profile?.profiles?.teacher ? {legajoTeacher: form.legajoTeacher.trim()} : {}),
                        ...(profile?.profiles?.preceptor ? {legajoPreceptor: form.legajoPreceptor.trim()} : {}),
                    }),
                }
            );

            setProfile(updated);

            setForm({
                firstName: updated.firstName || '',
                lastName: updated.lastName || '',
                email: updated.email || '',
                telefono: updated.telefono || '',
                legajoStudent: updated.profiles?.student?.legajoStudent || '',
                legajoTeacher: updated.profiles?.teacher?.legajoTeacher || '',
                legajoPreceptor: updated.profiles?.preceptor?.legajoPreceptor || '',
            });

            updateUserContext?.({
                firstName: updated.firstName,
                lastName: updated.lastName,
                email: updated.email,
                telefono: updated.telefono ?? null,
            });

            setProfileFeedback({
                type: 'success',
                message:
                    'Tus datos personales se actualizaron correctamente.',
            });
        } catch (error) {
            setProfileFeedback({
                type: 'error',
                message: getErrorMessage(error),
            });
        } finally {
            setSaving(false);
        }
    };

    const handlePasswordChange = (field, value) => {
        setPasswordForm(current => ({
            ...current,
            [field]: value,
        }));

        setPasswordFeedback(null);
    };

    const handleChangePassword = async event => {
        event.preventDefault();

        if (
            passwordForm.newPassword !==
            passwordForm.confirmPassword
        ) {
            setPasswordFeedback({
                type: 'error',
                message: 'Las contraseñas nuevas no coinciden.',
            });
            return;
        }

        if (passwordForm.newPassword.length < 8) {
            setPasswordFeedback({
                type: 'error',
                message:
                    'La contraseña debe tener al menos 8 caracteres.',
            });
            return;
        }

        setChangingPassword(true);
        setPasswordFeedback(null);

        try {
            const result = await requestProfile(
                '/users/me/password',
                token,
                {
                    method: 'PATCH',
                    body: JSON.stringify(passwordForm),
                }
            );

            setPasswordForm({
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
            });

            setPasswordVisibility({
                currentPassword: false,
                newPassword: false,
                confirmPassword: false,
            });

            setPasswordFeedback({
                type: 'success',
                message:
                    result?.message ||
                    'Contraseña actualizada correctamente.',
            });
        } catch (error) {
            setPasswordFeedback({
                type: 'error',
                message: getErrorMessage(error),
            });
        } finally {
            setChangingPassword(false);
        }
    };

    const togglePasswordVisibility = field => {
        setPasswordVisibility(current => ({
            ...current,
            [field]: !current[field],
        }));
    };

    if (loading) {
        return (
            <div className="flex min-h-80 items-center justify-center gap-3 text-slate-200">
                <LoaderCircle className="animate-spin" size={24} />
                Cargando tu perfil...
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="mx-auto max-w-3xl">
                <Feedback message={loadError} type="error" />
            </div>
        );
    }

    if (!profile) return null;

    const fullName = [
        profile.firstName,
        profile.lastName,
    ].filter(Boolean).join(' ');

    const initials = [
        profile.firstName?.[0],
        profile.lastName?.[0],
    ].filter(Boolean).join('').toUpperCase() || 'U';

    const roles = Array.isArray(profile.roles)
        ? profile.roles
        : [];

    const profiles = profile.profiles || {};

    return (
        <div className="mx-auto max-w-6xl space-y-6 pb-10">

            {/* ENCABEZADO DEL PERFIL: superficie blanca para respetar el tema claro.
                El nombre nunca se superpone a la banda roja y conserva alto contraste. */}
            <div className="overflow-hidden rounded-2xl border border-[#DCE1E7] bg-white shadow-xl shadow-slate-900/10">
                <div className="h-24 bg-gradient-to-r from-[#951010] via-[#C61515] to-[#672128] sm:h-28" />

                <div className="px-5 pb-6 sm:px-8">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
                        <div
                            className="-mt-8 flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-white bg-[#C61515] text-2xl font-bold shadow-lg sm:-mt-9"
                            style={{ color: '#FFFFFF' }}
                            aria-hidden="true"
                        >
                            {initials}
                        </div>

                        <div className="min-w-0 flex-1 pt-1 sm:pt-4">
                            <h1 className="break-words text-2xl font-bold leading-tight text-[#20242B] sm:text-[28px]">
                                {fullName || user?.firstName || 'Mi perfil'}
                            </h1>

                            <p className="mt-1 break-all text-sm text-[#64748B]">
                                {profile.email}
                            </p>
                        </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                        {roles.map(role => (
                            <span
                                key={role}
                                className="rounded-lg border border-[#F2C3C3] bg-[#FFF1F1] px-3 py-1 text-xs font-semibold text-[#9F1111]"
                            >
                                {ROLE_LABELS[role] || role}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">

                {/* DATOS PERSONALES */}
                <section className="rounded-2xl border border-slate-700 bg-slate-900/95 p-5 shadow-lg sm:p-7 lg:col-span-3">
                    <div className="mb-6 flex items-center gap-3">
                        <div className="rounded-xl bg-blue-500/10 p-3 text-blue-400">
                            <UserRound size={23} />
                        </div>

                        <div>
                            <h2 className="text-lg font-bold text-white">
                                Datos personales
                            </h2>

                            <p className="text-sm text-slate-400">
                                Actualizá tu información de contacto.
                            </p>
                        </div>
                    </div>

                    <form
                        onSubmit={handleSaveProfile}
                        className="space-y-5"
                    >
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                            <FormField
                                label="Nombre"
                                value={form.firstName}
                                onChange={event =>
                                    handleProfileChange(
                                        'firstName',
                                        event.target.value
                                    )
                                }
                                autoComplete="given-name"
                            />

                            <FormField
                                label="Apellido"
                                value={form.lastName}
                                onChange={event =>
                                    handleProfileChange(
                                        'lastName',
                                        event.target.value
                                    )
                                }
                                autoComplete="family-name"
                            />
                        </div>

                        <FormField
                            label="Correo electrónico"
                            type="email"
                            icon={Mail}
                            value={form.email}
                            onChange={event =>
                                handleProfileChange(
                                    'email',
                                    event.target.value
                                )
                            }
                            autoComplete="email"
                            placeholder="nombre@ejemplo.com"
                        />

                        {/* NUEVO CAMPO: TELÉFONO */}
                        <div>
                            <FormField
                                label="Teléfono (opcional)"
                                type="tel"
                                icon={Phone}
                                value={form.telefono}
                                onChange={event =>
                                    handleProfileChange(
                                        'telefono',
                                        event.target.value
                                    )
                                }
                                placeholder="+54 9 221 456-7890"
                                autoComplete="tel"
                                inputMode="tel"
                                maxLength={35}
                            />

                            <p className="mt-2 text-xs leading-relaxed text-slate-400">
                                Podés ingresar un teléfono fijo o celular
                                argentino, con o sin prefijo internacional.
                            </p>

                            <div className="mt-3 flex flex-wrap gap-2">
                                <span className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-1.5 text-xs text-slate-300">
                                    Fijo: 221 456-7890
                                </span>

                                <span className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-1.5 text-xs text-slate-300">
                                    Celular: 221 15-456-7890
                                </span>

                                <span className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-1.5 text-xs text-slate-300">
                                    Internacional: +54 9 221 456-7890
                                </span>
                            </div>
                        </div>

                        {/* El legajo es opcional, incluso para docentes y preceptores.
                            Se guarda junto a los demás datos personales. */}
                        {(profiles.student || profiles.teacher || profiles.preceptor) && (
                            <div className="grid gap-4 sm:grid-cols-2">
                                {profiles.student && <FormField label="Legajo de alumno (opcional)" value={form.legajoStudent}
                                    onChange={e=>handleProfileChange('legajoStudent',e.target.value)} maxLength={80} placeholder="Sin legajo informado" />}
                                {profiles.teacher && <FormField label="Legajo docente (opcional)" value={form.legajoTeacher}
                                    onChange={e=>handleProfileChange('legajoTeacher',e.target.value)} maxLength={80} placeholder="Sin legajo informado" />}
                                {profiles.preceptor && <FormField label="Legajo de preceptor (opcional)" value={form.legajoPreceptor}
                                    onChange={e=>handleProfileChange('legajoPreceptor',e.target.value)} maxLength={80} placeholder="Sin legajo informado" />}
                            </div>
                        )}

                        <FormField
                            label="DNI"
                            icon={IdCard}
                            value={profile.dni}
                            disabled
                        />

                        <p className="text-xs leading-relaxed text-slate-400">
                            El DNI y la institución no pueden modificarse desde esta pantalla. El legajo es opcional.
                        </p>

                        <Feedback
                            message={profileFeedback?.message}
                            type={profileFeedback?.type}
                        />

                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                        >
                            {saving ? (
                                <LoaderCircle
                                    size={18}
                                    className="animate-spin"
                                />
                            ) : (
                                <Save size={18} />
                            )}

                            {saving ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                    </form>
                </section>

                {/* INFORMACIÓN INSTITUCIONAL */}
                <section className="rounded-2xl border border-slate-700 bg-slate-900/95 p-5 shadow-lg sm:p-7 lg:col-span-2">
                    <div className="mb-6 flex items-center gap-3">
                        <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-400">
                            <BookOpen size={23} />
                        </div>

                        <div>
                            <h2 className="text-lg font-bold text-white">
                                Información institucional
                            </h2>

                            <p className="text-sm text-slate-400">
                                Datos asociados a tus roles.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {profiles.teacher && (
                            <>
                                <ProfileInfo
                                    label="Legajo docente"
                                    value={profiles.teacher.legajoTeacher}
                                />

                                <ProfileInfo
                                    label="Especialidad"
                                    value={profiles.teacher.specialty}
                                />
                            </>
                        )}

                        {profiles.student && (
                            <ProfileInfo
                                label="Legajo de alumno"
                                value={profiles.student.legajoStudent}
                            />
                        )}

                        {profiles.preceptor && (
                            <>
                                <ProfileInfo
                                    label="Legajo de preceptor"
                                    value={profiles.preceptor.legajoPreceptor}
                                />

                                <ProfileInfo
                                    label="Turno"
                                    value={profiles.preceptor.shift}
                                />
                            </>
                        )}

                        {profiles.director && (
                            <ProfileInfo
                                label="Cargo directivo"
                                value={profiles.director.position}
                            />
                        )}

                        <ProfileInfo
                            label="Institución"
                            value={
                                profile.institutionId != null
                                    ? `ID ${profile.institutionId}`
                                    : 'Sin institución asignada'
                            }
                        />

                        <ProfileInfo
                            label="Estado de la cuenta"
                            value={
                                profile.isActive
                                    ? 'Activa'
                                    : 'Inactiva'
                            }
                        />
                    </div>
                </section>
            </div>

            <WebPushSettings />
            {/* SEGURIDAD DE LA CUENTA */}
            <section className="rounded-2xl border border-slate-700 bg-slate-900/95 p-5 shadow-lg sm:p-7">
                <div className="mb-6 flex items-center gap-3">
                    <div className="rounded-xl bg-violet-500/10 p-3 text-violet-400">
                        <ShieldCheck size={24} />
                    </div>

                    <div>
                        <h2 className="text-lg font-bold text-white">
                            Seguridad de la cuenta
                        </h2>

                        <p className="text-sm text-slate-400">
                            Cambiá tu contraseña de acceso a Avisos I12.
                        </p>
                    </div>
                </div>

                <form
                    onSubmit={handleChangePassword}
                    className="max-w-2xl space-y-5"
                >
                    <PasswordField
                        label="Contraseña actual"
                        value={passwordForm.currentPassword}
                        onChange={event =>
                            handlePasswordChange(
                                'currentPassword',
                                event.target.value
                            )
                        }
                        visible={passwordVisibility.currentPassword}
                        onToggle={() =>
                            togglePasswordVisibility('currentPassword')
                        }
                        autoComplete="current-password"
                    />

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <PasswordField
                            label="Nueva contraseña"
                            value={passwordForm.newPassword}
                            onChange={event =>
                                handlePasswordChange(
                                    'newPassword',
                                    event.target.value
                                )
                            }
                            visible={passwordVisibility.newPassword}
                            onToggle={() =>
                                togglePasswordVisibility('newPassword')
                            }
                            autoComplete="new-password"
                        />

                        <PasswordField
                            label="Confirmar nueva contraseña"
                            value={passwordForm.confirmPassword}
                            onChange={event =>
                                handlePasswordChange(
                                    'confirmPassword',
                                    event.target.value
                                )
                            }
                            visible={passwordVisibility.confirmPassword}
                            onToggle={() =>
                                togglePasswordVisibility('confirmPassword')
                            }
                            autoComplete="new-password"
                        />
                    </div>

                    <p className="text-xs text-slate-400">
                        Utilizá una contraseña de al menos 8 caracteres.
                        Recomendamos combinar letras, números y símbolos.
                    </p>

                    <Feedback
                        message={passwordFeedback?.message}
                        type={passwordFeedback?.type}
                    />

                    <button
                        type="submit"
                        disabled={changingPassword}
                        className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                        {changingPassword ? (
                            <LoaderCircle
                                size={18}
                                className="animate-spin"
                            />
                        ) : (
                            <LockKeyhole size={18} />
                        )}

                        {changingPassword
                            ? 'Actualizando contraseña...'
                            : 'Cambiar contraseña'}
                    </button>
                </form>
            </section>
            <div className="lg:col-span-5"><ContactPrivacySettings /></div>
        </div>
    );
}
