import { useContext, useMemo, useState } from 'react';
import { GraduationCap, UsersRound } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { useAssignmentOptions } from '../hooks/useAssignments';
import CourseStudentsManager from '../components/CourseStudentsManager';
import { shiftLabel } from '../utils/courseShift';

export default function StudentCourseAssignmentsView() {
    const { user } = useContext(AuthContext);
    const isSuperAdmin = user?.isSuperAdmin === true || user?.roles?.includes('SUPER_ADMIN');
    const { data: options, isLoading, isError, error } = useAssignmentOptions();
    const courses = options?.courses ?? [];

    const [institutionId, setInstitutionId] = useState('');
    const [careerId, setCareerId] = useState('');
    const [courseId, setCourseId] = useState('');
    const [search, setSearch] = useState('');

    const institutions = useMemo(() => {
        const map = new Map();
        courses.forEach(course => {
            if (course.institutionId && course.institution) {
                map.set(String(course.institutionId), course.institution.nombre);
            }
        });
        return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'));
    }, [courses]);

    const careers = useMemo(() => {
        const map = new Map();
        courses.forEach(course => {
            if (isSuperAdmin && institutionId && String(course.institutionId) !== institutionId) return;
            if (course.careerId && course.career) map.set(String(course.careerId), course.career.nombre);
        });
        return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'));
    }, [courses, institutionId, isSuperAdmin]);

    const visibleCourses = useMemo(() => {
        const term = search.trim().toLocaleLowerCase('es');
        return courses.filter(course => {
            if (isSuperAdmin && institutionId && String(course.institutionId) !== institutionId) return false;
            if (careerId && String(course.careerId) !== careerId) return false;
            const haystack = [
                course.nombre, course.academicYear, shiftLabel(course.shift),
                course.career?.nombre, course.institution?.nombre,
            ].filter(value => value != null).join(' ').toLocaleLowerCase('es');
            return haystack.includes(term);
        }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es') || b.academicYear - a.academicYear);
    }, [courses, institutionId, careerId, search, isSuperAdmin]);

    const selectedCourse = courses.find(course => String(course.id) === courseId);
    const selectClass = 'min-h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#C61515] focus:ring-2 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-50';

    return (
        <div className="space-y-6 text-slate-900">
            <header className="flex flex-wrap items-start gap-3">
                <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-[#C61515]">
                    <GraduationCap size={23} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Alumnos por curso</h2>
                    <p className="mt-1 text-sm text-slate-600">
                        Seleccioná una carrera y un curso para consultar o actualizar su matrícula.
                    </p>
                </div>
            </header>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className={`grid gap-4 ${isSuperAdmin ? 'lg:grid-cols-3' : 'md:grid-cols-2'}`}>
                    {isSuperAdmin && (
                        <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
                            Institución
                            <select
                                className={selectClass}
                                value={institutionId}
                                onChange={event => {
                                    setInstitutionId(event.target.value);
                                    setCareerId('');
                                    setCourseId('');
                                }}
                            >
                                <option value="">Todas las instituciones</option>
                                {institutions.map(([id, label]) => (
                                    <option key={id} value={id}>{label}</option>
                                ))}
                            </select>
                        </label>
                    )}
                    <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
                        Carrera
                        <select
                            className={selectClass}
                            value={careerId}
                            onChange={event => { setCareerId(event.target.value); setCourseId(''); }}
                        >
                            <option value="">Todas las carreras</option>
                            {careers.map(([id, label]) => (
                                <option key={id} value={id}>{label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
                        Curso
                        <select
                            className={selectClass}
                            value={courseId}
                            onChange={event => setCourseId(event.target.value)}
                            disabled={isLoading}
                        >
                            <option value="">Seleccioná un curso ({visibleCourses.length} disponibles)</option>
                            {visibleCourses.map(course => (
                                <option key={course.id} value={course.id}>
                                    {course.nombre} · {course.academicYear} · {shiftLabel(course.shift)}
                                    {isSuperAdmin && !institutionId && course.institution?.nombre
                                        ? ` · ${course.institution.nombre}` : ''}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <div className="mt-4 max-w-xl">
                    <input
                        type="search"
                        aria-label="Buscar cursos disponibles"
                        value={search}
                        onChange={event => { setSearch(event.target.value); setCourseId(''); }}
                        placeholder="Buscar carrera, curso, turno, año o institución..."
                        className="min-h-11 w-full rounded-lg border border-slate-300 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-500 focus:border-[#C61515] focus:outline-none focus:ring-2 focus:ring-red-100"
                    />
                </div>
                {isError && (
                    <p role="alert" className="mt-3 text-sm text-red-700">
                        {error?.response?.data?.message || 'No se pudieron cargar los cursos.'}
                    </p>
                )}
            </section>

            {selectedCourse ? (
                <CourseStudentsManager key={selectedCourse.id} course={selectedCourse} />
            ) : (
                <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
                    <UsersRound size={28} className="mx-auto mb-3 text-[#C61515]" />
                    {isLoading
                        ? 'Cargando cursos...'
                        : 'Seleccioná el curso para ver sus alumnos y administrar las asignaciones.'}
                </div>
            )}
        </div>
    );
}
