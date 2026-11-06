
import { useContext, useEffect, useState } from 'react';
import { Link, useLocation, useOutletContext } from 'react-router-dom';

import {
    ArrowRight,
    ArrowUpRight,
    BookOpen,
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
    ChevronLeft,
    LayoutDashboard,
    CalendarDays,
    Megaphone,
    ShieldCheck,
    LoaderCircle,
} from 'lucide-react';

import { AuthContext } from '../context/AuthContext';
import { useDashboardSummary } from '../hooks/useDashboard';
import { hasAny } from '../config/permissions';


const SECTIONS = {
    notices: {
        label: 'Avisos Tempranos',
        eyebrow: 'Comunicación institucional',
        description:
            'Consultá ausencias, llegadas tarde y avisos de docentes.',
        color: 'text-amber-700',
        iconBackground: 'bg-amber-500/10',
        iconBorder: 'border-amber-500/20',
        hoverBorder: 'hover:border-amber-500/40',
        gradient: 'from-amber-500/10 via-transparent to-transparent',
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


    communications: {
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
        label: 'Gestión de usuarios',
        eyebrow: 'Administración de personas',
        description:
            'Administrá usuarios, roles e inscripciones dentro de la institución.',
        color: 'text-[#C61515]',
        iconBackground: 'bg-blue-500/10',
        iconBorder: 'border-blue-500/20',
        hoverBorder: 'hover:border-blue-500/40',
        gradient: 'from-blue-500/10 via-transparent to-transparent',
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
                key: 'studentSignupRequests',
                label: 'Solicitudes de inscripción',
                description: 'Aprobá o rechazá altas de alumnos, individualmente o en bloque.',
                color: 'text-emerald-700',
                iconBackground: 'bg-emerald-500/10',
                Icon: UsersRound,
                path: '/dashboard/students/requests',
                action: 'selfSignup:approve',
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
        label: 'Gestión académica',
        eyebrow: 'Estructura educativa',
        description:
            'Configurá instituciones, carreras, cursos, materias y sus asignaciones.',
        color: 'text-[#B31212]',
        iconBackground: 'bg-rose-50',
        iconBorder: 'border-rose-100',
        hoverBorder: 'hover:border-cyan-500/40',
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

function ModuleCard({
    section,
    onClick,
    count,
}) {
    const Icon = section.Icon;

    const content = (
        <>
            <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${section.gradient} opacity-70 transition-opacity duration-300 group-hover:opacity-100`}
            />

            <div className="relative flex w-full items-start justify-between gap-3">
                <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${section.iconBorder} ${section.iconBackground} ${section.color}`}
                >
                    <Icon size={27} strokeWidth={1.8} />
                </div>

                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-600 transition-all group-hover:border-slate-300 group-hover:bg-slate-200 group-hover:text-slate-950">
                    <ArrowUpRight size={18} />
                </div>
            </div>

            <div className="relative mt-auto pt-7">
                <p
                    className={`mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] ${section.color}`}
                >
                    {section.eyebrow}
                </p>

                <h3 className="text-xl font-bold tracking-tight text-slate-900">
                    {section.label}
                </h3>

                <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-600">
                    {section.description}
                </p>

                <div className="mt-6 flex items-center justify-between border-t border-slate-200/60 pt-4">
                    <span className="text-xs font-semibold text-slate-700 transition-colors group-hover:text-slate-950">
                        {section.directPath
                            ? 'Abrir módulo'
                            : 'Explorar módulo'}
                    </span>

                    <span className="flex items-center gap-2 text-xs text-slate-600">
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

    const className = `group relative flex min-h-[245px] w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-[#D8DDE3] bg-[#EEF0F2] p-6 text-left shadow-sm shadow-slate-900/5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-[#E7EAEE] hover:shadow-lg hover:shadow-slate-900/10 ${section.hoverBorder}`;

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
            className="group relative flex min-h-[215px] cursor-pointer flex-col overflow-hidden rounded-2xl border border-[#D8DDE3] bg-[#EEF0F2] p-5 shadow-md shadow-slate-900/5 transition-all duration-200 hover:-translate-y-1 hover:border-blue-500/40 hover:bg-[#E7EAEE] hover:shadow-lg hover:shadow-slate-900/10 sm:p-6"
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
                            <p className="text-3xl font-bold tracking-tight text-slate-900">
                                {typeof value === 'number'
                                    ? value.toLocaleString('es-AR')
                                    : value}
                            </p>
                        )}
                    </div>
                ) : (
                    <span className="text-xs font-semibold text-slate-700">
                        Consultar avisos
                    </span>
                )}

                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-700 transition-colors group-hover:border-blue-500/30 group-hover:bg-blue-500/10 group-hover:text-rose-600">
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
    const { updateDashboardHeader } = useOutletContext() ?? {};
    const [activeSection, setActiveSection] = useState(() => {
        if (location.state?.section) return location.state.section;
        return sessionStorage.getItem('avisosi12.dashboard.section') || null;
    });
    useEffect(() => {
        if (activeSection) sessionStorage.setItem('avisosi12.dashboard.section', activeSection);
        else sessionStorage.removeItem('avisosi12.dashboard.section');
    }, [activeSection]);

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

    const isTeacher =
        roles.includes('TEACHER') ||
        Boolean(user?.teacherProfile);


    const getVisibleItems = (section) => {
        const isAdministrativeSection =
            section === SECTIONS.users ||
            section === SECTIONS.academic;

        if (isAdministrativeSection && !isAdministrator) {
            return [];
        }

        return section.items.filter((item) => {
            if (item.publicToAuthenticated) {
                return Boolean(user);
            }

            if (isSuperAdmin) {
                return true;
            }

            return hasAny(roles, item.action);
        });
    };

    const visibleSections = Object.entries(SECTIONS)
        .filter(([, section]) =>
            getVisibleItems(section).length > 0
        );

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

    // PANTALLA PRINCIPAL
    if (!canShowCurrentSection) {
        return (
            <div className="mx-auto w-full max-w-7xl space-y-7 pb-8">

                <div className="flex justify-end">
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600">
                        <LayoutDashboard size={14}/>
                        {visibleSections.length + (isTeacher ? 1 : 0)} módulos disponibles
                    </span>
                </div>

                {/* TARJETAS PRINCIPALES */}
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">

                    {isTeacher && (
                        <Link
                            to="/dashboard/my-subjects"
                            className="group relative flex min-h-[245px] flex-col overflow-hidden rounded-2xl border border-emerald-500/25 bg-[#EEF0F2] p-6 shadow-sm shadow-slate-900/5 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/50 hover:bg-[#E7EAEE] hover:shadow-lg"
                        >
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent" />

                            <div className="relative flex items-start justify-between">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-700">
                                    <BookOpen size={27} />
                                </div>

                                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-600 transition-colors group-hover:text-slate-950">
                                    <ArrowUpRight size={18} />
                                </div>
                            </div>

                            <div className="relative mt-auto pt-7">
                                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                                    Espacio docente
                                </p>

                                <h3 className="text-xl font-bold text-slate-900">
                                    Mis cursos
                                </h3>

                                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                                    Elegí primero el curso y luego la materia para consultar sus cursos, materias y horarios.
                                </p>

                                <div className="mt-6 flex items-center justify-between border-t border-slate-200/60 pt-4">
                                    <span className="text-xs font-semibold text-slate-700">
                                        Ingresar a mis cursos
                                    </span>

                                    <ArrowRight
                                        size={17}
                                        className="text-emerald-700 transition-transform group-hover:translate-x-1"
                                    />
                                </div>
                            </div>
                        </Link>
                    )}

                    {visibleSections.map(([key, section]) => (
                        <ModuleCard
                            key={key}
                            section={section}
                            count={getVisibleItems(section).length}
                            onClick={() => setActiveSection(key)}
                        />
                    ))}
                </div>
            </div>
        );
    }

    // SUBMÓDULOS ADMINISTRATIVOS
    const section = currentSection;
    const visibleItems = currentVisibleItems;

    return (
        <div className="mx-auto w-full max-w-7xl space-y-7 pb-8">

            <button
                type="button"
                onClick={() => setActiveSection(null)}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 border-rose-700 bg-rose-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-rose-900/15 transition hover:scale-[1.03] hover:bg-rose-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
                <ChevronLeft size={21} strokeWidth={3} />
                Volver a los módulos
            </button>

            <div className="flex justify-end">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600">
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
