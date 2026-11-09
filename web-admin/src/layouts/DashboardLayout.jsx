import { useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useUnreadNotifications } from '../hooks/useNotifications';

import {
    Link,
    NavLink,
    Outlet,
    useLocation,
    useNavigate,
} from 'react-router-dom';

import {
    ClipboardList,
    Megaphone,
    LogOut,
    UserRound,
    ArrowLeft,
    LayoutDashboard,
    Menu,
    X,
    ChevronRight,
    ChevronDown,
    GraduationCap,
    ShieldCheck,
    PanelLeftClose,
    PanelLeftOpen,
    Settings2,
    ContactRound,
    UsersRound,
    BookOpenCheck,
} from 'lucide-react';

import { AuthContext } from '../context/AuthContext';
import { hasAny } from '../config/permissions';
import WebPushSettings from '../components/WebPushSettings';
import InstallPwaButton from '../components/InstallPwaButton';
import BackgroundLayout from './BackgroundLayout';
import logo from '../assets/images/i12-logo.png';

function getRoles(user) {
    if (!Array.isArray(user?.roles)) return [];

    return user.roles
        .map((role) => {
            if (typeof role === 'string') {
                return role.toUpperCase();
            }

            return String(
                role?.name || role?.role || ''
            ).toUpperCase();
        })
        .filter(Boolean);
}

const ROLE_LABELS = {
    SUPER_ADMIN: 'Superadministrador',
    DIRECTOR: 'Directivo',
    PRECEPTOR: 'Preceptor',
    TEACHER: 'Docente',
    STUDENT: 'Alumno',
};

// La sidebar no despliega submenús: Gestión académica y Gestión de usuarios
// abren las tarjetas de siempre dentro de /dashboard (DashboardView).
// Los permisos se verifican aquí para mostrar la opción, y en las rutas/backend
// para autorizar de verdad las acciones.
const PRIMARY_NAVIGATION = [
    { to: '/dashboard/early-notices', label: 'Avisos Tempranos', Icon: ClipboardList },
    { to: '/dashboard/institution-communications', label: 'Avisos Institucionales', Icon: Megaphone },
    {
        to: '/dashboard', label: 'Gestión académica', Icon: GraduationCap,
        dashboardSection: 'academic',
        actions: ['institution:manage', 'career:manage', 'course:manage', 'subject:manage', 'teacher:assignSubject', 'schedule:manage'],
    },
    {
        to: '/dashboard', label: 'Gestión de usuarios', Icon: UsersRound,
        dashboardSection: 'users',
        actions: ['director:manage', 'preceptor:manage', 'teacher:manage', 'student:view', 'student:enroll', 'staffSignup:review', 'invitation:manage'],
    },
    { to: '/dashboard/notice-subscriptions', label: 'Mis suscripciones a avisos', Icon: BookOpenCheck, studentOnly: true },
    { to: '/dashboard/contact-directory', label: 'Directorio de contactos', Icon: ContactRound },
];

// Siempre primero: acceso directo al panel de tarjetas.
const HOME_NAVIGATION = [
    { to: '/dashboard', label: 'Panel principal', Icon: LayoutDashboard, end: true },
];

// Siempre al final, debajo del segundo separador.
const PROFILE_NAVIGATION = [
    { to: '/dashboard/profile', label: 'Mi perfil', Icon: UserRound },
];

function isLocationActive(pathname, item) {
    return item.end
        ? pathname === item.to || pathname === `${item.to}/`
        : pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function getInitials(user) {
    const first = user?.firstName?.trim()?.charAt(0) || '';
    const last = user?.lastName?.trim()?.charAt(0) || '';

    return `${first}${last}`.toUpperCase() || 'U';
}

function SidebarLink({
    to,
    label,
    Icon,
    end = false,
    collapsed = false,
    onNavigate,
    unreadCount = 0,
    dashboardSection = null,
}) {
    const location = useLocation();
    const isDashboardRoot = location.pathname === '/dashboard' || location.pathname === '/dashboard/';
    const isSelected = routeActive => {
        if (dashboardSection) return isDashboardRoot && location.state?.section === dashboardSection;
        if (to === '/dashboard') return isDashboardRoot && !location.state?.section;
        return routeActive;
    };

    return (
        <NavLink
            to={to}
            state={dashboardSection ? { section: dashboardSection } : (to === '/dashboard' ? { home: true } : undefined)}
            end={end}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
                `group relative flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm font-medium transition-all duration-200 ${isSelected(isActive)
                    ? 'border-[#EFADAD] bg-[#FCEAEA] text-[#9F1111] shadow-sm shadow-black/10'
                    : 'border-transparent text-[#F3F4F6] hover:border-white/20 hover:bg-white/10 hover:text-white'
                } ${collapsed ? 'justify-center' : ''}`
            }
        >
            {({ isActive: routeActive }) => {
                const isActive = isSelected(routeActive);
                return (
                    <>
                        {isActive && (
                            <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-[#C61515]" />
                        )}
                        <Icon
                            size={19}
                            strokeWidth={isActive ? 2.3 : 1.9}
                            className={`shrink-0 ${isActive ? 'text-[#B31212]' : 'text-[#ECEDEF] group-hover:text-white'}`}
                        />
                        {collapsed && unreadCount > 0 && (
                            <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#C61515] px-1 text-[10px] font-bold text-white">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                        {!collapsed && (
                            <>
                                <span className="min-w-0 flex-1 truncate">{label}</span>
                                {unreadCount > 0 && (
                                    <span aria-label={`${unreadCount} notificaciones sin leer`} className="inline-flex min-w-6 items-center justify-center rounded-full bg-[#C61515] px-1.5 py-0.5 text-xs font-bold text-white">
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                                {isActive && <ChevronRight size={15} className="text-[#C61515]" />}
                            </>
                        )}
                    </>
                );
            }}
        </NavLink>
    );
}

function UserAvatar({ user, size = 'normal', inMenu = false }) {
    return (
        <div
            className={`flex shrink-0 items-center justify-center rounded-xl border font-bold ${inMenu
                    ? 'border-rose-200 bg-rose-50 text-[#B31212]'
                    : 'border-white/25 bg-white/15 text-white'
                } ${size === 'large'
                    ? 'h-12 w-12 text-base'
                    : 'h-10 w-10 text-sm'
                }`}
        >
            {getInitials(user)}
        </div>
    );
}

export default function DashboardLayout() {
    const { user, token, logoutContext } = useContext(AuthContext);
    const location = useLocation();
    const navigate = useNavigate();
    const unreadCount = useUnreadNotifications(Boolean(user));

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const [dashboardHeader, setDashboardHeader] = useState(null);
    const updateDashboardHeader = useCallback(value => setDashboardHeader(value), []);

    const isRoot =
        location.pathname === '/dashboard' ||
        location.pathname === '/dashboard/';

    const roles = getRoles(user);

    const displayRoles = [...roles];

    if (
        user?.isSuperAdmin &&
        !displayRoles.includes('SUPER_ADMIN')
    ) {
        displayRoles.unshift('SUPER_ADMIN');
    }

    const fullName =
        [user?.firstName, user?.lastName]
            .filter(Boolean)
            .join(' ') || 'Usuario';

    // Las secciones administrativas existen en DashboardView solo para gestores.
    // No se renderizan subopciones en la sidebar: las tarjetas las filtran por rol.
    const isAdministrator = displayRoles.some(role => ['SUPER_ADMIN', 'DIRECTOR', 'PRECEPTOR'].includes(role));
    const canShowLink = item => {
        if (item.studentOnly) return roles.includes('STUDENT');
        if (item.dashboardSection) {
            return isAdministrator && item.actions.some(action => hasAny(displayRoles, action));
        }
        return !item.action || hasAny(displayRoles, item.action);
    };
    const visibleNavigation = PRIMARY_NAVIGATION.filter(canShowLink);
    const noticeNavigation = visibleNavigation.filter(item =>
        item.to === '/dashboard/early-notices' || item.to === '/dashboard/institution-communications');
    const managementNavigation = visibleNavigation.filter(item =>
        item.to !== '/dashboard/early-notices' && item.to !== '/dashboard/institution-communications'
        && item.to !== '/dashboard/contact-directory');
    const directoryNavigation = visibleNavigation.filter(item => item.to === '/dashboard/contact-directory');

    const currentPage = [...HOME_NAVIGATION, ...visibleNavigation, ...PROFILE_NAVIGATION, { to: '/dashboard/settings', label: 'Configuración' }]
        .filter(item => !item.dashboardSection)
        .sort((a, b) => b.to.length - a.to.length)
        .find(item => isLocationActive(location.pathname, item))?.label ||
        (isRoot ? 'Panel principal' : 'Avisos I12');

    const renderSidebarItems = (items, { collapsed = false, onNavigate } = {}) =>
        items.map(item => (
            <SidebarLink
                key={item.dashboardSection || item.to}
                {...item}
                unreadCount={item.to === '/dashboard/early-notices' ? unreadCount : 0}
                collapsed={collapsed}
                onNavigate={onNavigate}
            />
        ));

    const todayLabel = new Intl.DateTimeFormat('es-AR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).format(new Date());
    const routeNames = {
        directors: 'Directivos', preceptors: 'Preceptores', teachers: 'Docentes',
        students: 'Alumnos', invitations: 'Invitaciones', careers: 'Carreras',
        courses: 'Cursos', subjects: 'Materias', institution: 'Institución',
        'subject-schedules': 'Horarios de materias',
        'early-notices': 'Avisos tempranos',
        'institution-communications': 'Comunicaciones institucionales',
        profile: 'Mi perfil',
        'contact-directory': 'Directorio de contactos',
        'notice-subscriptions': 'Suscripciones a avisos',
        'staff-requests': 'Solicitudes de personal',
    };
    const routePart = location.pathname.split('/')[2];
    const assignmentRouteTitles = {
        students: 'Suscripciones de alumnos', teachers: 'Asignación de docentes', schedules: 'Horarios y turnos',
    };
    const headerTitle = isRoot
        ? (dashboardHeader?.title || `¡Hola, ${user?.firstName || 'Usuario'}!`)
        : (location.pathname.startsWith('/dashboard/students/requests')
            ? 'Solicitudes de personal'
            : routePart === 'assignments'
                ? (assignmentRouteTitles[location.pathname.split('/')[3]] || 'Asignaciones')
                : routeNames[routePart] || currentPage);
    const headerEyebrow = isRoot
        ? (dashboardHeader?.eyebrow || todayLabel)
        : (['students', 'teachers', 'preceptors', 'directors', 'invitations'].includes(routePart)
            ? 'Gestión de usuarios'
            : ['careers', 'courses', 'subjects', 'subject-schedules', 'institution', 'assignments'].includes(routePart)
                ? 'Gestión académica' : 'Avisos I12');

    // Respeta el historial del usuario. Si llegó por enlace directo, utiliza un destino seguro.
    const previousView = () => {
        if (location.pathname.startsWith('/dashboard/students/requests')) navigate('/dashboard/students');
        else if (location.pathname.startsWith('/dashboard/assignments/')) navigate('/dashboard', { state: { section: 'academic' } });
        else if (location.pathname.startsWith('/dashboard/my-subjects/')) navigate('/dashboard/my-subjects');
        else if (/^\/dashboard\/(students|teachers|preceptors|directors|invitations|careers|courses|subjects)(\/.*)?$/.test(location.pathname)) {
            navigate('/dashboard', { state: { section: /students|teachers|preceptors|directors|invitations/.test(location.pathname) ? 'users' : 'academic' } });
        } else {
            const idx = window.history.state?.idx;
            if (typeof idx === 'number' && idx > 0) navigate(-1);
            else navigate('/dashboard');
        }
    };

    const closeMobileMenu = () => {
        setMobileMenuOpen(false);
    };

    const handleLogout = () => {
        setMobileMenuOpen(false);
        setProfileMenuOpen(false);
        // Cerrar sesión NO desactiva las notificaciones elegidas para este dispositivo.
        // Si inicia otra cuenta en este navegador, WebPushSettings desuscribe a la anterior.
        // No persistir submenús de la cuenta anterior en un nuevo inicio de sesión.
        sessionStorage.removeItem('avisosi12.dashboard.section');
        logoutContext();
    };

    const sidebarWidth = sidebarCollapsed
        ? 'lg:w-[88px]'
        : 'lg:w-[260px]';

    return (
        <BackgroundLayout>
            <div className="relative min-h-screen text-slate-900">

                {/* CAPA OSCURA GENERAL */}
                <div className="pointer-events-none fixed inset-0 z-0 bg-transparent" />

                {/* HEADER SUPERIOR */}
                <header className="sticky top-0 z-40 h-[88px] lg:h-[116px] border-b border-[#AC1111] bg-[#C61515] shadow-lg shadow-[#8F0E0E]/15 backdrop-blur-xl">
                    <div className="flex h-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">

                        {/* IZQUIERDA */}
                        <div className="flex min-w-0 items-center gap-3">

                            {/* MENÚ MÓVIL */}
                            <button
                                type="button"
                                onClick={() => setMobileMenuOpen(true)}
                                aria-label="Abrir menú de navegación"
                                className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-white/25 bg-white/10 text-white transition-colors hover:bg-white/20 lg:hidden"
                            >
                                <Menu size={21} />
                            </button>

                            {/* LOGO */}
                            <Link
                                to="/dashboard"
                                state={{ home: true }}
                                onClick={closeMobileMenu}
                                className="hidden shrink-0 cursor-pointer items-center gap-3 sm:flex"
                                aria-label="Ir al panel principal"
                            >
                                <img
                                    src={logo}
                                    alt="Avisos I12"
                                    className="h-11 w-auto max-w-[110px] object-contain sm:h-12"
                                />
                            </Link>

                            <div className="hidden h-8 w-px bg-white/40 sm:block" />

                            <div className="min-w-0">
                                <p className="max-w-[200px] truncate text-[9px] font-semibold uppercase tracking-[0.09em] text-white/85 sm:max-w-[400px] sm:text-[10px] sm:tracking-[0.14em]">
                                    {headerEyebrow}
                                </p>
                                <h1 className="mt-1 max-w-[165px] truncate text-sm font-bold text-white sm:max-w-[420px] sm:text-lg" title={headerTitle}>
                                    {headerTitle}
                                </h1>
                                {isRoot && (
                                    <p className="mt-1.5 hidden max-w-[700px] text-[11px] leading-relaxed text-white/90 xl:block">
                                        <span className="font-semibold text-white">Instituto Superior de Formación Técnica Nº12.</span>{' '}
                                        Accedé a los avisos, las comunicaciones y las herramientas disponibles para tu perfil.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* DERECHA */}
                        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                            <InstallPwaButton compact />
                            <WebPushSettings compact />
                            <div className="hidden items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs text-white xl:flex">
                                <ShieldCheck size={14} />
                                Conexión segura
                            </div>

                            {/* PERFIL DESPLEGABLE */}
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setProfileMenuOpen((prev) => !prev)
                                    }
                                    aria-expanded={profileMenuOpen}
                                    aria-label="Opciones de usuario"
                                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-transparent px-2 py-1.5 transition-colors hover:border-white/25 hover:bg-white/10"
                                >
                                    <UserAvatar user={user} />

                                    <div className="hidden min-w-0 text-left md:block">
                                        <p className="max-w-[170px] truncate text-sm font-semibold text-white">
                                            {fullName}
                                        </p>

                                        <p className="max-w-[170px] truncate text-xs text-white/80">
                                            {displayRoles.length
                                                ? ROLE_LABELS[displayRoles[0]] ||
                                                displayRoles[0]
                                                : 'Usuario'}
                                        </p>
                                    </div>

                                    <ChevronDown
                                        size={16}
                                        className={`hidden text-white/80 transition-transform md:block ${profileMenuOpen
                                                ? 'rotate-180'
                                                : ''
                                            }`}
                                    />
                                </button>

                                {profileMenuOpen && createPortal(
                                    <>
                                        <button
                                            type="button"
                                            aria-label="Cerrar menú de usuario"
                                            onClick={() =>
                                                setProfileMenuOpen(false)
                                            }
                                            className="fixed inset-0 z-[80] cursor-default"
                                        />

                                        <div className="fixed right-3 top-[96px] z-[90] w-[min(320px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 sm:right-6 lg:top-[124px]" style={{ backgroundColor: '#FFFFFF', color: '#20242B' }}>

                                            <div className="border-b border-slate-200 p-4">
                                                <div className="flex items-center gap-3">
                                                    <UserAvatar
                                                        user={user}
                                                        size="large"
                                                        inMenu
                                                    />

                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-bold !text-[#20242B]">
                                                            {fullName}
                                                        </p>

                                                        <p className="mt-1 truncate text-xs !text-[#64748B]">
                                                            {user?.email || 'Cuenta Avisos I12'}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="mt-4 flex flex-wrap gap-1.5">
                                                    {displayRoles.map((role) => (
                                                        <span
                                                            key={role}
                                                            className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-medium text-rose-700"
                                                        >
                                                            {ROLE_LABELS[role] || role}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="p-2">
                                                <Link
                                                    to="/dashboard/profile"
                                                    onClick={() =>
                                                        setProfileMenuOpen(false)
                                                    }
                                                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950"
                                                >
                                                    <UserRound size={18} />
                                                    Mi perfil
                                                </Link>

                                                <div className="my-2 border-t border-slate-200" />
                                                <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Comunicación</p>
                                                <Link to="/dashboard/early-notices" onClick={()=>setProfileMenuOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"><ClipboardList size={18}/>Avisos tempranos</Link>
                                                <Link to="/dashboard/institution-communications" onClick={()=>setProfileMenuOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"><Megaphone size={18}/>Avisos institucionales</Link>
                                                {hasAny(displayRoles,'integrations:manage')&&<Link to="/dashboard/settings" onClick={()=>setProfileMenuOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"><Settings2 size={18}/>Configuración</Link>}
                                                <button
                                                    type="button"
                                                    onClick={handleLogout}
                                                    className="flex w-full cursor-pointer items-center gap-3 rounded-lg bg-[#C61515] px-3 py-3 text-left text-sm font-semibold text-white transition-colors hover:bg-[#A81010]"
                                                >
                                                    <LogOut size={18} />
                                                    Cerrar sesión
                                                </button>
                                            </div>
                                        </div>
                                    </>, document.body
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                {/* CUERPO PRINCIPAL */}
                <div className="relative z-10 flex min-h-[calc(100vh-88px)] lg:min-h-[calc(100vh-116px)]">

                    {/* SIDEBAR ESCRITORIO */}
                    <aside
                        className={`sticky top-[116px] hidden h-[calc(100vh-116px)] shrink-0 flex-col border-r border-[#4A5059] bg-[#5A606A] transition-[width] duration-300 lg:flex ${sidebarWidth}`}
                    >
                        <div className="flex min-h-0 flex-1 flex-col p-3">

                            {/* ENCABEZADO SIDEBAR */}
                            <div
                                className={`mb-5 flex items-center ${sidebarCollapsed
                                        ? 'justify-center'
                                        : 'justify-between px-2'
                                    }`}
                            >
                                {!sidebarCollapsed && (
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#E3E5E8]">
                                        Navegación
                                    </span>
                                )}

                                <button
                                    type="button"
                                    onClick={() =>
                                        setSidebarCollapsed((prev) => !prev)
                                    }
                                    title={
                                        sidebarCollapsed
                                            ? 'Expandir menú'
                                            : 'Contraer menú'
                                    }
                                    aria-label={
                                        sidebarCollapsed
                                            ? 'Expandir menú'
                                            : 'Contraer menú'
                                    }
                                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-white/85 transition-colors hover:bg-white/10 hover:text-white"
                                >
                                    {sidebarCollapsed ? (
                                        <PanelLeftOpen size={19} />
                                    ) : (
                                        <PanelLeftClose size={19} />
                                    )}
                                </button>
                            </div>

                            {/* Módulos principales en orden por importancia. Scroll independiente del cierre de sesión. */}
                            <nav
                                aria-label="Navegación principal"
                                className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pb-4 pr-1"
                            >
                                {renderSidebarItems(HOME_NAVIGATION, { collapsed: sidebarCollapsed })}
                                <div role="separator" className="my-3 border-t border-white/25" />
                                {renderSidebarItems(noticeNavigation, { collapsed: sidebarCollapsed })}
                                <div role="separator" className="my-3 border-t border-white/25" />
                                {renderSidebarItems(managementNavigation, { collapsed: sidebarCollapsed })}
                                {directoryNavigation.length > 0 && <div role="separator" className="my-3 border-t border-white/25" />}
                                {renderSidebarItems(directoryNavigation, { collapsed: sidebarCollapsed })}
                                <div role="separator" className="my-3 border-t border-white/25" />
                                {renderSidebarItems(PROFILE_NAVIGATION, { collapsed: sidebarCollapsed })}
                            </nav>

                            <div className="shrink-0 pt-3">

                                {hasAny(displayRoles,'integrations:manage') && (
                                    <div className="mb-3">
                                        {renderSidebarItems([{to:'/dashboard/settings',label:'Configuración',Icon:Settings2}],{collapsed:sidebarCollapsed})}
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    title={
                                        sidebarCollapsed
                                            ? 'Cerrar sesión'
                                            : undefined
                                    }
                                    className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border border-[#9F1111] bg-[#C61515] px-3 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:border-[#840C0C] hover:bg-[#A81010] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${sidebarCollapsed
                                            ? 'justify-center'
                                            : ''
                                        }`}
                                >
                                    <LogOut size={19} />

                                    {!sidebarCollapsed && (
                                        <span>Cerrar sesión</span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </aside>

                    {/* CONTENIDO */}
                    <div className="min-w-0 flex-1">

                        {/* BARRA DE UBICACIÓN */}
                        {!isRoot && (
                            <div className="border-b border-slate-200/40 bg-white/80 px-4 py-3 backdrop-blur-sm sm:px-6 lg:px-8">
                                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                                    <button type="button" onClick={previousView}
                                        className="mr-3 inline-flex items-center gap-2 rounded-xl border-2 border-red-200 bg-rose-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-red-500/15 transition hover:bg-[#C61515] hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                                        aria-label="Volver a la vista anterior">
                                        <ArrowLeft size={20} strokeWidth={3} /> Volver atrás
                                    </button>
                                    <Link
                                        to="/dashboard"
                                        state={{ home: true }}
                                        className="inline-flex cursor-pointer items-center gap-2 text-slate-600 transition-colors hover:text-rose-700"
                                    >
                                        <LayoutDashboard size={15} />
                                        Panel principal
                                    </Link>

                                    <ChevronRight
                                        size={14}
                                        className="text-slate-600"
                                    />

                                    <span className="font-medium text-slate-800">
                                        {currentPage}
                                    </span>
                                </div>
                            </div>
                        )}

                        <main className="i12-workspace mx-auto w-full max-w-[1700px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                            <Outlet context={{ updateDashboardHeader }} />
                        </main>
                    </div>
                </div>

                {/* OVERLAY MÓVIL */}
                {mobileMenuOpen && (
                    <div className="fixed inset-0 z-50 lg:hidden">

                        <button
                            type="button"
                            onClick={closeMobileMenu}
                            aria-label="Cerrar navegación"
                            className="absolute inset-0 cursor-pointer bg-black/70 backdrop-blur-sm"
                        />

                        <aside className="absolute inset-y-0 left-0 flex w-[min(320px,88vw)] flex-col border-r border-[#4A5059] bg-[#5A606A] shadow-2xl">

                            <div className="flex items-center justify-between border-b border-white/15 px-5 py-5">
                                <img
                                    src={logo}
                                    alt="Avisos I12"
                                    className="h-12 w-auto object-contain"
                                />

                                <button
                                    type="button"
                                    onClick={closeMobileMenu}
                                    aria-label="Cerrar menú"
                                    className="cursor-pointer rounded-lg p-2 text-white hover:bg-white/10"
                                >
                                    <X size={21} />
                                </button>
                            </div>

                            <div className="border-b border-white/15 p-5">
                                <div className="flex items-center gap-3">
                                    <UserAvatar user={user} />

                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-white">
                                            {fullName}
                                        </p>

                                        <p className="truncate text-xs text-white/80">
                                            {user?.email || 'Usuario Avisos I12'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto p-4">
                                <p className="mb-4 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#E3E5E8]">
                                    Navegación
                                </p>

                                <nav aria-label="Navegación móvil" className="space-y-1.5">
                                    {renderSidebarItems(HOME_NAVIGATION, { onNavigate: closeMobileMenu })}
                                    <div role="separator" className="my-3 border-t border-white/25" />
                                    {renderSidebarItems(noticeNavigation, { onNavigate: closeMobileMenu })}
                                    <div role="separator" className="my-3 border-t border-white/25" />
                                    {renderSidebarItems(managementNavigation, { onNavigate: closeMobileMenu })}
                                {directoryNavigation.length > 0 && <div role="separator" className="my-3 border-t border-white/25" />}
                                {renderSidebarItems(directoryNavigation, { onNavigate: closeMobileMenu })}
                                    <div role="separator" className="my-3 border-t border-white/25" />
                                    {renderSidebarItems(PROFILE_NAVIGATION, { onNavigate: closeMobileMenu })}
                                </nav>
                            </div>

                            <div className="border-t border-white/15 p-4">
                                {hasAny(displayRoles,'integrations:manage') && <div className="mb-3">{renderSidebarItems([{to:'/dashboard/settings',label:'Configuración',Icon:Settings2}], {onNavigate:closeMobileMenu})}</div>}
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-[#9F1111] bg-[#C61515] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#A81010]"
                                >
                                    <LogOut size={18} />
                                    Cerrar sesión
                                </button>
                            </div>
                        </aside>
                    </div>
                )}
            </div>
        </BackgroundLayout>
    );
}
