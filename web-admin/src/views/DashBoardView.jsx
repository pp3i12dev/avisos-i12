
import { useContext, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom';

import {
    ArrowRight,
    ArrowUpRight,
    ClipboardList,
    GraduationCap,
    Users,
    Building2,
    School,
    Layers3,
    LibraryBig,
    UserCog,
    UserRoundCheck,
    Presentation,
    UsersRound,
    Mail,
    CalendarDays,
    Megaphone,
    ContactRound,
    ShieldCheck,
    Settings2,
    LoaderCircle,
} from 'lucide-react';

import { AuthContext } from '../context/AuthContext';
import { useDashboardSummary } from '../hooks/useDashboard';
import { hasAny } from '../config/permissions';


const SECTIONS = {
    settings: {
        glassTone: 'teal',
        label: 'Configuración', eyebrow: 'Administración institucional',
        description: 'Configurá el correo SMTP y las notificaciones Web Push.',
        color: 'text-[#C61515]', iconBackground: 'bg-red-50',
        iconBorder: 'border-red-100', hoverBorder: 'hover:border-[#C61515]/30',
        gradient: 'from-red-500/5 via-transparent to-transparent', Icon: Settings2,
        directPath: '/dashboard/settings',
        items: [{ key: 'integrationSettings', label: 'Configuración institucional',
            description: 'Correo institucional, VAPID y auditoría de cambios.',
            path: '/dashboard/settings', action: 'integrations:manage',
            color: 'text-red-700', iconBackground: 'bg-red-50', Icon: Settings2, hideCount: true }],
    },

    notices: {
        glassTone: 'amber',
        label: 'Avisos Tempranos',
        eyebrow: 'Comunicación institucional',
        description:
            'Consultá ausencias, llegadas tarde y avisos de docentes.',
        color: 'text-[#C61515]',
        iconBackground: 'bg-red-50',
        iconBorder: 'border-red-100',
        hoverBorder: 'hover:border-[#C61515]/30',
        gradient: 'from-red-500/5 via-transparent to-transparent',
        Icon: ClipboardList,
        directPath: '/dashboard/early-notices',
        items: [
            {
                key: 'earlyNotices',
                label: 'Ver Avisos Tempranos',
                description:
                    'Consultá los avisos registrados y su estado.',
                color: 'text-amber-700',
                iconBackground: 'bg-amber-500/10',
                Icon: CalendarDays,
                path: '/dashboard/early-notices',
                publicToAuthenticated: true,
                hideCount: true,
            },
        ],
    },


    subscriptions: {
        label: 'Suscripciones a materias',
        eyebrow: 'Avisos para alumnos',
        description: 'Elegí materias y carreras para recibir avisos, sin inscripción académica oficial.',
        color: 'text-[#C61515]',
        iconBackground: 'bg-red-50',
        iconBorder: 'border-red-100',
        hoverBorder: 'hover:border-[#C61515]/30',
        gradient: 'from-red-500/5 via-transparent to-transparent',
        Icon: GraduationCap,
        directPath: '/dashboard/notice-subscriptions',
        items: [{ key: 'noticeSubscriptions', label: 'Mis suscripciones a avisos',
          description: 'Seguí materias de diferentes años, turnos y carreras.',
          color: 'text-red-700', iconBackground: 'bg-red-50', Icon: GraduationCap,
          path: '/dashboard/notice-subscriptions', studentOnly: true, hideCount: true }],
    },

    contacts: {
        glassTone: 'teal',
        label: 'Directorio de contactos',
        eyebrow: 'Comunicación y personas',
        description: 'Encontrá docentes, preceptores y autoridades y sus medios de contacto compartidos.',
        color: 'text-[#C61515]', iconBackground: 'bg-red-50', iconBorder: 'border-red-100',
        hoverBorder: 'hover:border-[#C61515]/30',gradient:'from-red-500/5 via-transparent to-transparent',
        Icon: ContactRound,directPath:'/dashboard/contact-directory',
        items: [{key:'contactDirectory',label:'Directorio de contactos',
          description:'Buscá por carrera, turno, materia y función.',
          Icon:ContactRound,color:'text-red-700',iconBackground:'bg-red-50',
          path:'/dashboard/contact-directory',publicToAuthenticated:true,hideCount:true}],
    },
    communications: {
        glassTone: 'cyan',
        label: 'Avisos Institucionales',
        eyebrow: 'Comunicación institucional',
        description: 'Consultá eventos, suspensiones de actividades y comunicados de tu institución.',
        color: 'text-[#C61515]',
        iconBackground: 'bg-red-500/10',
        iconBorder: 'border-red-500/20',
        hoverBorder: 'hover:border-red-500/40',
        gradient: 'from-red-500/5 via-transparent to-transparent',
        Icon: Megaphone,
        directPath: '/dashboard/institution-communications',
        items: [{
            key: 'institutionCommunications',
            label: 'Ver Avisos Institucionales',
            description: 'Eventos y suspensiones de actividades.',
            color: 'text-[#C61515]',
            iconBackground: 'bg-red-500/10',
            Icon: Megaphone,
            path: '/dashboard/institution-communications',
            publicToAuthenticated: true,
            hideCount: true,
        }],
    },

    users: {
        glassTone: 'blue',
        label: 'Gestión de usuarios',
        eyebrow: 'Administración de personas',
        description:
            'Administrá usuarios, roles e inscripciones dentro de la institución.',
        color: 'text-[#C61515]',
        iconBackground: 'bg-red-50',
        iconBorder: 'border-red-100',
        hoverBorder: 'hover:border-[#C61515]/30',
        gradient: 'from-red-500/5 via-transparent to-transparent',
        Icon: Users,
        items: [
            {
                key: 'directors',
                label: 'Directivos',
                description: 'Gestión del equipo directivo.',
                color: 'text-amber-700',
                iconBackground: 'bg-amber-500/10',
                Icon: UserCog,
                path: '/dashboard/directors',
                action: 'director:manage',
            },
            {
                key: 'preceptors',
                label: 'Preceptores',
                description: 'Administración de preceptores.',
                color: 'text-purple-700',
                iconBackground: 'bg-purple-500/10',
                Icon: UserRoundCheck,
                path: '/dashboard/preceptors',
                action: 'preceptor:manage',
            },
            {
                key: 'teachers',
                label: 'Docentes',
                description: 'Administración del plantel docente.',
                color: 'text-emerald-700',
                iconBackground: 'bg-emerald-500/10',
                Icon: Presentation,
                path: '/dashboard/teachers',
                action: 'teacher:manage',
            },
            {
                key: 'students',
                label: 'Alumnos',
                description: 'Consulta y gestión de estudiantes.',
                color: 'text-[#C61515]',
                iconBackground: 'bg-blue-500/10',
                Icon: UsersRound,
                path: '/dashboard/students',
                action: 'student:view',
            },
            {
                key: 'adminSubscriptions',
                label: 'Suscripciones de alumnos',
                description: 'Asistí a alumnos para seguir avisos de cualquier materia.',
                color: 'text-red-700',
                iconBackground: 'bg-red-500/10',
                Icon: UsersRound,
                path: '/dashboard/notice-subscriptions/admin',
                action: 'student:enroll',
                hideCount: true,
            },
            {
                key: 'staffSignupRequests',
                label: 'Solicitudes de personal',
                description: 'Verificá y aprobá cuentas de docentes, preceptores y directivos.',
                color: 'text-emerald-700',
                iconBackground: 'bg-emerald-500/10',
                Icon: UsersRound,
                path: '/dashboard/staff-requests',
                action: 'staffSignup:review',
                hideCount: true,
            },
            {
                key: 'invitations',
                label: 'Invitaciones Activas',
                description: 'Administrá las invitaciones de acceso.',
                color: 'text-pink-700',
                iconBackground: 'bg-pink-500/10',
                Icon: Mail,
                path: '/dashboard/invitations',
                action: 'invitation:manage',
            },
        ],
    },

    academic: {
        glassTone: 'cyan',
        label: 'Gestión académica',
        eyebrow: 'Estructura educativa',
        description:
            'Configurá instituciones, carreras, cursos, materias y sus asignaciones.',
        color: 'text-[#B31212]',
        iconBackground: 'bg-rose-50',
        iconBorder: 'border-rose-100',
        hoverBorder: 'hover:border-[#C61515]/30',
        gradient: 'from-rose-500/5 via-transparent to-transparent',
        Icon: GraduationCap,
        items: [
            {
                key: 'institutions',
                label: 'Institución',
                description: 'Datos y configuración institucional.',
                color: 'text-orange-700',
                iconBackground: 'bg-orange-500/10',
                Icon: Building2,
                path: '/dashboard/institution',
                action: 'institution:manage',
            },
            {
                key: 'careers',
                label: 'Carreras / Niveles',
                description: 'Organización de carreras y niveles.',
                color: 'text-[#B31212]',
                iconBackground: 'bg-rose-50',
                Icon: School,
                path: '/dashboard/careers',
                action: 'career:manage',
            },
            {
                key: 'courses',
                label: 'Cursos',
                description: 'Gestión de cursos y divisiones.',
                color: 'text-teal-700',
                iconBackground: 'bg-teal-500/10',
                Icon: Layers3,
                path: '/dashboard/courses',
                action: 'course:manage',
            },
            {
                key: 'subjects',
                label: 'Materias',
                description: 'Materias y organización curricular.',
                color: 'text-lime-700',
                iconBackground: 'bg-lime-500/10',
                Icon: LibraryBig,
                path: '/dashboard/subjects',
                action: 'subject:manage',
            },
        ],
    },
};

function getRoles(user) {
    if (!Array.isArray(user?.roles)) {
        return [];
    }

    return user.roles
        .map((role) => {
            if (typeof role === 'string') {
                return role.trim().toUpperCase();
            }

            return String(
                role?.name || role?.role || ''
            ).trim().toUpperCase();
        })
        .filter(Boolean);
}

const GLASS_TONES = {
    amber: { label: 'text-amber-400', icon: 'border-amber-400/20 bg-amber-400/10 text-amber-400' },
    cyan: { label: 'text-sky-400', icon: 'border-sky-400/20 bg-sky-400/10 text-sky-400' },
    teal: { label: 'text-teal-300', icon: 'border-teal-400/20 bg-teal-400/10 text-teal-300' },
    blue: { label: 'text-blue-300', icon: 'border-blue-400/20 bg-blue-400/10 text-blue-300' },
};

function ModuleCard({
    section,
    onClick,
    count,
}) {
    const Icon = section.Icon;
    const tone = GLASS_TONES[section.glassTone || 'cyan'];

    const content = (
        <>
            <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${section.gradient} opacity-70 transition-opacity duration-300 group-hover:opacity-100`}
            />

            <div className="relative flex w-full items-start justify-between gap-3">
                <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl border ${tone.icon}`}
                >
                    <Icon size={22} strokeWidth={1.8} />
                </div>

                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-300 transition-all group-hover:border-sky-300/50 group-hover:bg-white/15 group-hover:text-white">
                    <ArrowUpRight size={18} />
                </div>
            </div>

            <div className="relative mt-auto pt-3">
                <p
                    className={`mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${tone.label}`}
                >
                    {section.eyebrow}
                </p>

                <h3 className="text-base font-bold leading-tight tracking-tight text-white sm:text-[19px]">
                    {section.label}
                </h3>

                <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-slate-300">{section.description}</p>

                <div className="mt-3 flex items-center justify-between border-t border-white/15 pt-3">
                    <span className="text-[12px] font-semibold text-slate-200 transition-colors group-hover:text-white">
                        {section.directPath
                            ? 'Abrir módulo'
                            : 'Explorar módulo'}
                    </span>

                    <span className="flex items-center gap-2 text-xs text-slate-400">
                        {!section.directPath && (
                            <>
                                {count}{' '}
                                {count === 1 ? 'opción' : 'opciones'}
                            </>
                        )}

                        <ArrowRight
                            size={15}
                            className="transition-transform group-hover:translate-x-1"
                        />
                    </span>
                </div>
            </div>
        </>
    );

    const className = `i12-glass-card i12-module-square group relative flex min-h-[252px] w-full xl:h-[276px] cursor-pointer flex-col overflow-hidden rounded-2xl border border-[#4C6174] bg-[#15283c]/90 p-5 sm:p-6 text-left shadow-[0_12px_30px_rgba(11,26,43,0.17)] transition-all duration-200 hover:-translate-y-1 hover:border-[#C61515]/30 hover:shadow-[0_15px_32px_rgba(15,23,42,0.10)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C61515] ${section.hoverBorder}`;

    // Avisos Tempranos navega directamente a su vista.
    if (section.directPath) {
        return (
            <Link
                to={section.directPath}
                className={className}
            >
                {content}
            </Link>
        );
    }

    // Los módulos administrativos conservan sus submenús.
    return (
        <button
            type="button"
            onClick={onClick}
            className={className}
        >
            {content}
        </button>
    );
}

function AccessCard({
    item,
    summary,
    isLoading,
    isError,
}) {
    const Icon = item.Icon;

    const value = isLoading
        ? null
        : isError
            ? '—'
            : summary?.[item.key] ?? 0;

    return (
        <Link
            to={item.path}
            state={{ section: /students|teachers|preceptors|directors|invitations/.test(item.path) ? 'users' : 'academic' }}
            className="i12-glass-card i12-admin-glass-card group relative flex min-h-[215px] cursor-pointer flex-col overflow-hidden rounded-2xl border border-white/15 bg-white/10 p-5 shadow-sm shadow-slate-900/5 transition-all duration-200 hover:-translate-y-1 hover:border-white/25 hover:shadow-lg hover:shadow-slate-900/15 sm:p-6"
        >
            <div className="flex items-start justify-between gap-3">
                <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${item.iconBackground} ${item.color}`}
                >
                    <Icon size={24} strokeWidth={1.9} />
                </div>

                <ArrowUpRight
                    size={20}
                    className="text-slate-600 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-slate-950"
                />
            </div>

            <div className="mt-5">
                <h3 className="text-base font-bold text-slate-900 sm:text-lg">
                    {item.label}
                </h3>

                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                    {item.description}
                </p>
            </div>

            <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                {!item.hideCount ? (
                    <div>
                        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-slate-600">
                            Registros
                        </p>

                        {isLoading ? (
                            <LoaderCircle
                                size={23}
                                className="animate-spin text-rose-600"
                            />
                        ) : (
                            <p className="i12-admin-count text-3xl font-bold tracking-tight text-slate-900">
                                {typeof value === 'number'
                                    ? value.toLocaleString('es-AR')
                                    : value}
                            </p>
                        )}
                    </div>
                ) : (
                    <span className="i12-admin-muted text-xs font-semibold text-slate-700">
                        Consultar avisos
                    </span>
                )}

                <span className="i12-admin-arrow flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-700 transition-colors group-hover:border-white/25 group-hover:bg-white/12 group-hover:text-white">
                    <ArrowRight size={17} />
                </span>
            </div>
        </Link>
    );
}

export default function DashboardView() {
    const auth = useContext(AuthContext);
    const { user } = auth;

    const location = useLocation();
    const navigate = useNavigate();
    const { updateDashboardHeader } = useOutletContext() ?? {};
    // Cada entrada nueva a /dashboard empieza en el panel de cuatro tarjetas.
    // Solo se usa location.state.section para volver desde una vista interna.
    // Nunca se recupera el submenú desde sessionStorage después del login.
    const [activeSection, setActiveSection] = useState(() =>
        location.state?.home ? null : (location.state?.section || null)
    );
    useEffect(() => {
        setActiveSection(location.state?.home ? null : (location.state?.section || null));
    }, [location.key, location.state]);

    useEffect(() => {
        if (updateDashboardHeader) {
            const section = SECTIONS[activeSection];
            updateDashboardHeader(section
                ? { title: section.label, eyebrow: section.eyebrow }
                : null);
        }
    }, [activeSection, updateDashboardHeader]);

    const {
        data: summary,
        isLoading,
        isError,
    } = useDashboardSummary();

    const roles = getRoles(user);

    const isSuperAdmin =
        user?.isSuperAdmin === true ||
        roles.includes('SUPER_ADMIN');

    const isDirector = roles.includes('DIRECTOR');
    const isPreceptor = roles.includes('PRECEPTOR');

    const isAdministrator =
        isSuperAdmin ||
        isDirector ||
        isPreceptor;

    const getVisibleItems = (section) => {
        const isAdministrativeSection =
            section === SECTIONS.users ||
            section === SECTIONS.academic;

        if (isAdministrativeSection && !isAdministrator) {
            return [];
        }

        return section.items.filter((item) => {
            if (item.studentOnly) return roles.includes('STUDENT');
            if (item.publicToAuthenticated) {
                return Boolean(user);
            }

            if (isSuperAdmin) {
                return true;
            }

            return hasAny(roles, item.action);
        });
    };

    // Orden coherente con la sidebar; los módulos no autorizados se omiten.
    const order = ['notices', 'communications', 'contacts', 'settings', 'users', 'academic', 'subscriptions'];
    const visibleSections = order.map(key => [key, SECTIONS[key]])
        .filter(([, section]) => getVisibleItems(section).length > 0);

    const currentSection =
        activeSection && SECTIONS[activeSection]
            ? SECTIONS[activeSection]
            : null;

    const currentVisibleItems = currentSection
        ? getVisibleItems(currentSection)
        : [];

    const canShowCurrentSection =
        currentSection &&
        currentVisibleItems.length > 0;

    // Los estudiantes ven las dos tarjetas de comunicaciones en el panel principal.
    // Ya no se los redirige automáticamente a Avisos Tempranos.

    // PANTALLA PRINCIPAL: el encabezado y el sidebar siguen en DashboardLayout.
    // Los accesos rápidos reutilizan rutas existentes, sin inventar endpoints.
    if (!canShowCurrentSection) {
        return (
            <div className="mx-auto w-full max-w-[1180px] space-y-5 pb-8">
                <section aria-labelledby="i12-modulos-titulo">
                    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h2 id="i12-modulos-titulo" className="text-xl font-bold tracking-tight text-[#20242B]">Módulos principales</h2>
                            <p className="mt-1 text-xs text-slate-500">Elegí el área en la que querés trabajar.</p>
                        </div>
                    </div>
                    {/* Tarjetas glass cuadradas: 3 columnas en escritorio, 2 en tablet, 1 en celular. */}
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                        {visibleSections.map(([key, section]) => (
                            <ModuleCard
                                key={key}
                                section={section}
                                count={getVisibleItems(section).length}
                                onClick={() => navigate('/dashboard', { state: { section: key } })}
                            />
                        ))}
                    </div>
                </section>


            </div>
        );
    }

    // SUBMÓDULOS ADMINISTRATIVOS
    const section = currentSection;
    const visibleItems = currentVisibleItems;

    return (
        <div className="mx-auto w-full max-w-7xl space-y-7 pb-8">

            <div className="flex justify-end">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-400">
                    {visibleItems.length} {visibleItems.length === 1 ? 'opción disponible' : 'opciones disponibles'}
                </span>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {visibleItems.map((item) => (
                    <AccessCard
                        key={item.key}
                        item={item}
                        summary={summary}
                        isLoading={isLoading}
                        isError={isError}
                    />
                ))}
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <ShieldCheck
                    size={19}
                    className="shrink-0 text-rose-600"
                />

                <p className="text-xs leading-relaxed text-slate-600">
                    Las opciones disponibles dependen de los permisos
                    asignados a tu usuario dentro de Avisos I12.
                </p>
            </div>
        </div>
    );
}
