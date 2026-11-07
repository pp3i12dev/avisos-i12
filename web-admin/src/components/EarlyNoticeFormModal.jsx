import { shiftLabel } from '../utils/courseShift';
import { nowArgentina, hasClassTimePassed } from '../utils/institutionDate';
import { createPortal } from 'react-dom';
import { useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useEarlyNoticeCreationOptions } from '../hooks/useEarlyNotices';

const DAYS = ['DOMINGO','LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO'];
const MODALITY_LABELS = { PRESENCIAL: 'Presencial', VIRTUAL_SINCRONA: 'Virtual sincrónica', VIRTUAL_ASINCRONA: 'Virtual asincrónica' };
const DAY_LABELS = { LUNES:'Lunes', MARTES:'Martes', MIERCOLES:'Miércoles', JUEVES:'Jueves', VIERNES:'Viernes', SABADO:'Sábado' };
const TYPES = [
  ['ABSENCE','Ausencia'], ['LATE_ARRIVAL','Llegada tarde'],
  ['ATTENDANCE_CONFIRMED','Confirmación de asistencia'],
  ['VIRTUAL_SYNCHRONOUS','Clase virtual sincrónica'],
  ['VIRTUAL_ASYNCHRONOUS','Clase virtual asincrónica'],
];
const FIELD = 'w-full rounded-xl border border-[#C8CFD8] bg-[#F1F2F4] px-3 py-3 text-sm text-[#22252B] focus:outline-none focus:border-[#C61515]';
const format = value => `${value.slice(8,10)}/${value.slice(5,7)}/${value.slice(0,4)}`;
const dateAtUTC = value => new Date(`${value}T00:00:00.000Z`);
const iso = date => date.toISOString().slice(0,10);
const dateString = value => value ? String(value).slice(0,10) : '';
const name = a => `${a.teacher?.user?.firstName || ''} ${a.teacher?.user?.lastName || ''}`.trim();
const courseName = a => `${a.subject?.nombre || 'Materia'} · ${a.course?.nombre || 'Curso'}`;
const groupId = a => Number(a.teacherUserId ?? a.teacher?.user?.id);
const scheduleFor = (a, all) => (a.schedules?.length ? a.schedules : all.filter(s => Number(s.courseId) === Number(a.courseId) && Number(s.subjectId) === Number(a.subjectId)));
const normalizeSearch = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();

export default function EarlyNoticeFormModal(props) {
  const { open, initialData, token, onSubmit, onClose, isSaving, formError } = props;
  const { user } = useContext(AuthContext);
  const roles = (user?.roles || []).map(r => typeof r === 'string' ? r.toUpperCase() : String(r?.name || r?.role || '').toUpperCase());
  const isSuperAdmin = user?.isSuperAdmin === true || roles.includes('SUPER_ADMIN');
  const isAuthority = isSuperAdmin || roles.some(r => ['DIRECTOR','PRECEPTOR'].includes(r));
  const teacherOnly = roles.includes('TEACHER') && !isAuthority;
  const [teacherId,setTeacherId] = useState('');
  const [institutionId,setInstitutionId] = useState('');
  const [teacherSearch,setTeacherSearch] = useState('');
  const [showTeacherFilters,setShowTeacherFilters] = useState(false);
  const [careerFilter,setCareerFilter] = useState('');
  const [shiftFilter,setShiftFilter] = useState('');
  const [subjectFilter,setSubjectFilter] = useState('');
  const [type,setType] = useState('ABSENCE');
  const [duration,setDuration] = useState('single');
  const [start,setStart] = useState('');
  const [end,setEnd] = useState('');
  const [selected,setSelected] = useState([]);
  const [reason,setReason] = useState('');
  const [arrival,setArrival] = useState('');
  const [meetingUrl,setMeetingUrl] = useState('');
  const [instructions,setInstructions] = useState('');
  const [error,setError] = useState('');
  const [clock,setClock] = useState(nowArgentina());
  // Actualiza las advertencias mientras el formulario permanece abierto.
  useEffect(() => {
    if (!open) return undefined;
    setClock(nowArgentina());
    const id = setInterval(() => setClock(nowArgentina()), 10000);
    return () => clearInterval(id);
  }, [open]);
  const { data, isLoading, isError } = useEarlyNoticeCreationOptions(token, open);
  const options = data?.data ?? data?.options ?? data ?? {};
  const assignments = useMemo(() => (Array.isArray(options.assignments) ? options.assignments : []).filter(a => a.isActive !== false), [data]);
  const schedules = useMemo(() => Array.isArray(options.schedules) ? options.schedules : [], [data]);
  const institutions = useMemo(() => (Array.isArray(options.institutions) ? options.institutions : [])
    .map(item => ({ id: String(item.id), name: item.nombre || item.name || `Institución #${item.id}` }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es')), [data]);
  const teachers = useMemo(() => {
    if (Array.isArray(options.teachers)) {
      return options.teachers.map(t => ({
        id: Number(t.id ?? t.user?.id ?? t.userId),
        name: t.name || `${t.user?.firstName || ''} ${t.user?.lastName || ''}`.trim(),
        email: t.user?.email || '',
        institutionId: Number(t.user?.institutionId ?? t.institutionId),
      })).filter(t => Number.isInteger(t.id) && t.id > 0);
    }
    return [...new Map(assignments.map(a => [groupId(a), {
      id: groupId(a), name: name(a), institutionId: Number(a.institutionId ?? a.course?.institutionId),
    }])).values()].filter(t => t.id);
  }, [data, assignments]);
  useEffect(() => {
    if (!open) return;
    const editing = Boolean(initialData?.id);
    const firstDate = dateString(initialData?.periodStart || initialData?.classDate);
    const lastDate = dateString(initialData?.periodEnd || initialData?.classDate);
    setTeacherId(editing ? String(initialData.teacherUserId) : '');
    setInstitutionId(editing ? String(initialData?.institutionId ?? '') : '');
    setTeacherSearch('');
    setShowTeacherFilters(false);
    setCareerFilter(''); setShiftFilter(''); setSubjectFilter('');
    setType(editing ? initialData.type : 'ABSENCE');
    setDuration(editing && firstDate !== lastDate ? 'multiple' : 'single');
    setStart(editing ? firstDate : ''); setEnd(editing ? lastDate : '');
    setSelected(editing ? (initialData.classes || initialData.affectedClasses || []).map(c => `${c.teacherSubjectId}:${c.scheduleId}:${dateString(c.classDate)}`) : []);
    setReason(editing ? initialData.reason || '' : '');
    setArrival(editing ? initialData.estimatedArrivalTime || '' : '');
    setMeetingUrl(editing ? initialData.virtualMeetingUrl || '' : '');
    setInstructions(editing ? initialData.virtualInstructions || '' : '');
    setError('');
  }, [open, initialData?.id]);
  useEffect(() => {
    if (!open || initialData?.id || !teacherOnly || !user?.id) return;
    // El docente se selecciona automáticamente y nunca puede elegir a otro.
    if (teachers.some(t => t.id === Number(user.id))) {
      setTeacherId(String(user.id));
    }
  }, [open, initialData?.id, teachers, teacherOnly, user?.id]);
  useEffect(() => {
    // Si un aviso histórico no informa institución, obtenerla de su docente.
    if (!open || !initialData?.id || !isSuperAdmin || institutionId || !assignments.length) return;
    const firstAssignmentId = initialData.classes?.[0]?.teacherSubjectId ?? initialData.affectedClasses?.[0]?.teacherSubjectId;
    const assignment = assignments.find(a =>
      firstAssignmentId ? Number(a.id) === Number(firstAssignmentId)
        : String(groupId(a)) === String(initialData.teacherUserId)
    );
    if (assignment) setInstitutionId(String(assignment.institutionId ?? assignment.course?.institutionId));
  }, [open, initialData?.id, initialData?.teacherUserId, initialData?.classes, initialData?.affectedClasses, isSuperAdmin, institutionId, assignments]);
  const institutionScope = isSuperAdmin ? institutionId : String(user?.institutionId || '');
  const scopedAssignments = useMemo(() => assignments.filter(a =>
    !isSuperAdmin || (institutionScope && String(a.institutionId ?? a.course?.institutionId) === institutionScope)
  ), [assignments, isSuperAdmin, institutionScope]);
  const scopedTeachers = useMemo(() => teachers.filter(t =>
    !isSuperAdmin || (institutionScope && String(t.institutionId) === institutionScope)
  ).sort((a,b) => a.name.localeCompare(b.name, 'es')), [teachers, isSuperAdmin, institutionScope]);
  const selectedTeacher = teachers.find(t => String(t.id) === teacherId);
  const careerOptions = useMemo(() => [...new Map(scopedAssignments
    .filter(a => a.course?.career?.id != null)
    .map(a => [String(a.course.career.id), { id: String(a.course.career.id), name: a.course.career.nombre }])).values()]
    .sort((a,b) => a.name.localeCompare(b.name, 'es')), [scopedAssignments]);
  const careerAssignments = useMemo(() => scopedAssignments.filter(a =>
    !careerFilter || String(a.course?.career?.id) === careerFilter
  ), [scopedAssignments, careerFilter]);
  const availableShifts = useMemo(() => [...new Set(careerAssignments.flatMap(a =>
    [a.course?.shift, ...scheduleFor(a, schedules).map(s => s.shift)]
  ).filter(Boolean))].sort(), [careerAssignments, schedules]);
  const shiftAssignments = useMemo(() => careerAssignments.filter(a =>
    !shiftFilter || a.course?.shift === shiftFilter || scheduleFor(a, schedules).some(s => s.shift === shiftFilter)
  ), [careerAssignments, shiftFilter, schedules]);
  const subjectOptions = useMemo(() => [...new Map(shiftAssignments
    .filter(a => a.subject?.id != null)
    .map(a => [String(a.subject.id), { id: String(a.subject.id), name: a.subject.nombre }])).values()]
    .sort((a,b) => a.name.localeCompare(b.name, 'es')), [shiftAssignments]);
  const teacherAssignmentsFor = id => scopedAssignments.filter(a => String(groupId(a)) === String(id));
  const teacherSummary = t => {
    const items = teacherAssignmentsFor(t.id);
    const careers = [...new Set(items.map(a => a.course?.career?.nombre).filter(Boolean))];
    const subjects = [...new Set(items.map(a => a.subject?.nombre).filter(Boolean))];
    const shifts = [...new Set(items.flatMap(a => [a.course?.shift, ...scheduleFor(a, schedules).map(s=>s.shift)]).filter(Boolean))];
    return { careers, subjects, shifts, count: items.length };
  };
  const teacherMatchesSearch = t => {
    const terms = normalizeSearch(teacherSearch).split(/\s+/).filter(Boolean);
    if (!terms.length) return false;
    const summary = teacherSummary(t);
    const searchable = normalizeSearch([
      t.name, t.email, ...summary.careers, ...summary.subjects,
      ...summary.shifts, ...summary.shifts.map(shiftLabel),
      ...teacherAssignmentsFor(t.id).map(a => a.course?.nombre),
    ].join(' '));
    return terms.every(term => searchable.includes(term));
  };
  const suggestedTeachers = scopedTeachers.filter(t =>
    showTeacherFilters
      ? Boolean(careerFilter || shiftFilter || subjectFilter) && shiftAssignments.some(a =>
          String(groupId(a)) === String(t.id) && (!subjectFilter || String(a.subjectId) === subjectFilter)
        )
      : teacherMatchesSearch(t)
  );
  const teacherAssignments = useMemo(() => scopedAssignments.filter(a => String(groupId(a)) === teacherId), [scopedAssignments, teacherId]);
  const teacherHasAssignments = teacherAssignments.length > 0;
  const teacherHasSchedules = teacherAssignments.some(a => scheduleFor(a, schedules).length > 0);
  const effectiveEnd = duration === 'single' ? start : end;
  const startDateError = start && start < clock.slice(0, 10)
    ? 'La fecha de inicio no puede ser anterior a hoy.' : '';
  const endDateError = duration === 'multiple' && end
    ? end < clock.slice(0, 10)
      ? 'La fecha de finalización no puede ser anterior a hoy.'
      : end < start ? 'La fecha final debe ser igual o posterior a la inicial.'
      : start && Math.round((dateAtUTC(end) - dateAtUTC(start)) / 86400000) > 90
        ? 'El período no puede superar los 91 días.' : ''
    : '';
  const periodError = startDateError || endDateError;
  const classes = useMemo(() => {
    if (!start || !effectiveEnd || periodError || !teacherId) return [];
    const days = Math.round((dateAtUTC(effectiveEnd) - dateAtUTC(start))/86400000);
    const result = [];
    for (let i=0;i<=days;i++) {
      const date = new Date(dateAtUTC(start).getTime() + i*86400000);
      const classDate = iso(date);
      const day = DAYS[date.getUTCDay()];
      for (const a of teacherAssignments) {
        for (const s of scheduleFor(a,schedules)) {
          if (s.day !== day) continue;
          result.push({key:`${a.id}:${s.id}:${classDate}`,teacherSubjectId:Number(a.id),scheduleId:Number(s.id),classDate,subject:a.subject?.nombre,course:a.course?.nombre,courseShift:a.course?.shift,shift:s.shift,startTime:s.startTime,endTime:s.endTime,modality:s.modality || 'PRESENCIAL',expired:hasClassTimePassed(classDate,s.startTime,clock)});
        }
      }
    }
    return result.sort((a,b) => a.classDate.localeCompare(b.classDate) || a.startTime.localeCompare(b.startTime) || a.course.localeCompare(b.course));
  }, [start,effectiveEnd,periodError,teacherAssignments,schedules,teacherId,clock]);
  const selectedSet = useMemo(() => new Set(selected),[selected]);
  const chosen = classes.filter(c => selectedSet.has(c.key));
  const expiredSelected = chosen.some(c => c.expired);
  const arrivalError = type === 'LATE_ARRIVAL' && arrival && chosen.length
    ? chosen.some(c => arrival <= c.startTime || arrival >= c.endTime)
      ? 'La llegada debe ser posterior al inicio y anterior al fin de todas las clases seleccionadas.'
      : chosen.some(c => c.classDate === clock.slice(0,10) && arrival <= clock.slice(11,16))
        ? 'La hora estimada de llegada ya pasó.' : ''
    : '';
  const setFieldTeacher = value => {setTeacherId(value);setSelected([]);setError('');};
  const changeInstitution = value => {
    setInstitutionId(value); setTeacherId(''); setTeacherSearch('');
    setCareerFilter(''); setShiftFilter(''); setSubjectFilter('');
    setSelected([]); setError('');
  };
  const changePeriod = (setter,value) => {setter(value);setSelected([]);setError('');};
  const submit = e => {
    e.preventDefault();setError('');
    if (isSuperAdmin && !institutionId) return setError('Seleccioná primero una institución.');
    if (!teacherId) return setError('Seleccioná un docente.');
    if (!start || !effectiveEnd || periodError) return setError(periodError || 'Indicá el período.');
    if (!chosen.length) return setError('Seleccioná al menos una clase afectada.');
    if (expiredSelected) return setError('Quitá las clases cuyo horario de inicio ya pasó.');
    if (arrivalError) return setError(arrivalError);
    if (!reason.trim()) return setError('Indicá el motivo.');
    if (reason.trim().length > 2000) return setError('El motivo no puede superar los 2000 caracteres.');
    if (type === 'LATE_ARRIVAL') {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(arrival)) return setError('Ingresá una hora estimada válida.');
      if (chosen.some(c => arrival <= c.startTime || arrival >= c.endTime)) return setError('La hora estimada debe estar dentro de cada clase seleccionada.');
    }
    if (type === 'VIRTUAL_SYNCHRONOUS') {
      try {const url = new URL(meetingUrl); if (!['https:','http:'].includes(url.protocol)) throw new Error();}
      catch {return setError('Ingresá un enlace de videollamada válido.');}
    }
    if (type === 'VIRTUAL_ASYNCHRONOUS' && !instructions.trim()) return setError('Indicá las instrucciones o materiales.');
    onSubmit({type,periodStart:start,periodEnd:effectiveEnd,teacherUserId:Number(teacherId),reason:reason.trim(),
      estimatedArrivalTime:type === 'LATE_ARRIVAL' ? arrival : null,
      virtualMeetingUrl:type === 'VIRTUAL_SYNCHRONOUS' ? meetingUrl.trim() : null,
      virtualInstructions:type === 'VIRTUAL_ASYNCHRONOUS' ? instructions.trim() : null,
      classes:chosen.map(c=>({teacherSubjectId:c.teacherSubjectId,scheduleId:c.scheduleId,classDate:c.classDate}))});
  };
  if (!open) return null;
  return createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 sm:p-6" onMouseDown={e=>{if(e.target===e.currentTarget && !isSaving)onClose();}}>
    <div className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[#D8DDE3] bg-white text-[#22252B] shadow-2xl">
      <header className="flex items-start justify-between border-b border-[#D8DDE3] px-6 py-5">
        <div><h2 className="text-2xl font-bold">{initialData?.id ? `Editar aviso #${initialData.id}` : "Nuevo aviso temprano"}</h2><p className="mt-1 text-sm text-[#64748B]">Elegí un período y marcá exactamente las clases afectadas. Cada modificación se registra en el historial.</p></div>
        <button type="button" onClick={onClose} className="cursor-pointer rounded-lg px-3 py-1 text-2xl text-[#64748B] hover:bg-[#E5E7EB]" aria-label="Cerrar">×</button>
      </header>
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="space-y-6 overflow-y-auto p-6">
          {isLoading && <p className="text-[#A91818]">Cargando asignaciones y horarios…</p>}
          {isError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">No se pudieron cargar las opciones de avisos. Comprobá tu sesión y la conexión con la API.</p>}
          {!isLoading && !isError && teachers.length === 0 && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">No hay perfiles docentes activos en tu institución. Creá o activá un docente antes de generar avisos.</p>}
          {!isLoading && !isError && teacherId && !teacherHasAssignments && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">El docente está registrado, pero no tiene materias y cursos asignados de forma activa. Asignale una materia en Gestión académica → Asignación de docentes.</p>}
          {!isLoading && !isError && teacherId && teacherHasAssignments && !teacherHasSchedules && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">El docente tiene asignaciones, pero todavía no hay horarios registrados para esas materias y cursos. Completá los horarios para poder seleccionar clases.</p>}
          {isSuperAdmin && <div className="space-y-2">
            <label htmlFor="early-notice-institution" className="block text-sm font-semibold">1. Institución</label>
            <select id="early-notice-institution" value={institutionId} onChange={e=>changeInstitution(e.target.value)}
              disabled={Boolean(initialData?.id)} className={`${FIELD} cursor-pointer`} required>
              <option value="">Seleccionar institución</option>
              {institutions.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
            </select>
            {!institutionId && <p className="text-xs text-[#64748B]">Seleccioná la institución para buscar únicamente a sus docentes.</p>}
          </div>}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-semibold" htmlFor="early-notice-teacher-search">
                {isSuperAdmin ? '2. Docente responsable' : 'Docente responsable'}
              </label>
              {(teacherOnly || Boolean(initialData?.id)) ? (
                <div className="rounded-xl border border-[#C8CFD8] bg-[#F1F2F4] px-4 py-3 text-sm font-semibold" aria-label="Docente responsable">
                  {selectedTeacher?.name || (teacherOnly ? `${user?.firstName || ''} ${user?.lastName || ''}`.trim() : `Docente #${teacherId}`)}
                  <p className="mt-1 text-xs font-normal text-[#64748B]">{teacherOnly ? 'Tus clases se cargan automáticamente. No podés elegir otro docente.' : 'El docente responsable no puede cambiarse al editar el aviso.'}</p>
                </div>
              ) : isSuperAdmin && !institutionId ? (
                <p className="rounded-xl border border-[#D8DDE3] bg-[#F8FAFC] px-4 py-3 text-sm text-[#64748B]">Primero seleccioná una institución.</p>
              ) : teacherId ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-[#86B7A2] bg-[#EFFAF4] px-4 py-3">
                  <span className="text-sm"><strong className="block text-[#166534]">{selectedTeacher?.name || `Docente #${teacherId}`}</strong><span className="text-xs text-[#475569]">Docente seleccionado</span></span>
                  <button type="button" onClick={()=>{setFieldTeacher('');setTeacherSearch('');}} className="cursor-pointer rounded-lg border border-[#C8CFD8] bg-white px-3 py-2 text-xs font-semibold text-[#334155] hover:bg-[#E5E7EB]">Cambiar</button>
                </div>
              ) : (
                <div className="space-y-3">
                  <input id="early-notice-teacher-search" type="search" autoComplete="off" className={FIELD}
                    value={teacherSearch} onChange={e=>{setTeacherSearch(e.target.value);setShowTeacherFilters(false);}}
                    placeholder="Nombre, apellido, carrera, materia o turno..."
                    aria-label="Buscar docente por nombre, carrera, materia o turno" />
                  <button type="button" className="cursor-pointer text-left text-sm font-semibold text-[#B31212] hover:underline"
                    onClick={()=>{setShowTeacherFilters(v=>!v);setTeacherSearch('');setCareerFilter('');setShiftFilter('');setSubjectFilter('');}}>
                    {showTeacherFilters ? 'Ocultar filtros' : 'O buscar por carrera, turno y materia'}
                  </button>
                  {showTeacherFilters && <div className="grid gap-2 rounded-xl border border-[#D8DDE3] bg-[#F8FAFC] p-3 sm:grid-cols-3">
                    <label className="space-y-1 text-xs font-semibold">Carrera
                      <select className={FIELD} value={careerFilter} onChange={e=>{setCareerFilter(e.target.value);setShiftFilter('');setSubjectFilter('');}}>
                        <option value="">Todas las carreras</option>
                        {careerOptions.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1 text-xs font-semibold">Turno
                      <select className={FIELD} value={shiftFilter} onChange={e=>{setShiftFilter(e.target.value);setSubjectFilter('');}}>
                        <option value="">Todos los turnos</option>
                        {availableShifts.map(v=><option key={v} value={v}>{shiftLabel(v)}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1 text-xs font-semibold">Materia
                      <select className={FIELD} value={subjectFilter} onChange={e=>setSubjectFilter(e.target.value)}>
                        <option value="">Todas las materias</option>
                        {subjectOptions.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </label>
                  </div>}
                  {((showTeacherFilters && (careerFilter || shiftFilter || subjectFilter)) || (!showTeacherFilters && teacherSearch.trim())) && (
                    <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-[#D8DDE3] bg-white p-2" role="region" aria-label="Sugerencias de docentes">
                      {suggestedTeachers.length ? suggestedTeachers.slice(0, 12).map(t=>{
                        const detail = teacherSummary(t);
                        return <button key={t.id} type="button" onClick={()=>{setFieldTeacher(String(t.id));setTeacherSearch('');setShowTeacherFilters(false);}}
                          className="block w-full cursor-pointer rounded-lg px-3 py-2 text-left hover:bg-[#FCEAEA] focus:bg-[#FCEAEA] focus:outline-none focus:ring-2 focus:ring-[#C61515]">
                          <span className="block text-sm font-semibold text-[#22252B]">{t.name}</span>
                          <span className="block text-xs text-[#64748B]">{detail.count
                            ? `${detail.careers.join(' · ') || 'Sin carrera'} · ${detail.subjects.slice(0,3).join(', ')} · ${detail.shifts.map(shiftLabel).join('/')}`
                            : 'Sin materias asignadas todavía'}</span>
                        </button>;
                      }) : <p className="px-3 py-2 text-sm text-[#64748B]">No se encontraron docentes. Probá con otro nombre o cambiá los filtros.</p>}
                      {suggestedTeachers.length > 12 && <p className="px-3 py-2 text-xs text-[#64748B]">Se muestran 12 de {suggestedTeachers.length} docentes. Refiná la búsqueda.</p>}
                    </div>
                  )}
                  {!showTeacherFilters && !teacherSearch.trim() && <p className="text-xs text-[#64748B]">Escribí cualquier parte del nombre, carrera o materia para ver sugerencias.</p>}
                </div>
              )}
            </div>
            <label className="space-y-2 text-sm font-semibold">Tipo de aviso
              <select className={`${FIELD} cursor-pointer`} value={type} onChange={e=>setType(e.target.value)}>{TYPES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
            </label>
          </div>
          <section className="space-y-3 border-t border-[#D8DDE3] pt-5">
            <h3 className="text-lg font-bold">Período del aviso</h3>
            <div className="flex flex-wrap gap-5 text-sm"><label className="flex cursor-pointer items-center gap-2"><input type="radio" checked={duration==='single'} onChange={()=>{setDuration('single');setSelected([]);}}/> Un día</label><label className="flex cursor-pointer items-center gap-2"><input type="radio" checked={duration==='multiple'} onChange={()=>{setDuration('multiple');setSelected([]);}}/> Varios días</label></div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold">Fecha de inicio
                <input type="date" min={clock.slice(0,10)} aria-invalid={Boolean(startDateError)} className={`${FIELD} ${startDateError ? 'border-red-600 bg-red-50' : ''}`} value={start} onChange={e=>changePeriod(setStart,e.target.value)} required/>
                {startDateError && <span role="alert" className="block text-xs font-semibold text-red-700">{startDateError}</span>}
              </label>
              {duration==='multiple' && <label className="space-y-2 text-sm font-semibold">Fecha de finalización (inclusive)
                <input type="date" min={start || clock.slice(0,10)} aria-invalid={Boolean(endDateError)} className={`${FIELD} ${endDateError ? 'border-red-600 bg-red-50' : ''}`} value={end} onChange={e=>changePeriod(setEnd,e.target.value)} required/>
                {endDateError && <span role="alert" className="block text-xs font-semibold text-red-700">{endDateError}</span>}
              </label>}
            </div>
          </section>
          <section className="space-y-3 border-t border-[#D8DDE3] pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-bold">Clases afectadas</h3><p className="text-sm text-[#64748B]">Se muestran los horarios reales del docente, incluso de distintas materias y cursos. Ninguna clase se selecciona automáticamente.</p></div><span className="rounded-lg bg-[#FCEAEA] px-3 py-2 text-sm font-bold">{chosen.length} de {classes.length} seleccionadas</span></div>
            {classes.length>0 && <div className="flex gap-3"><button type="button" className="cursor-pointer text-sm text-[#B31212] hover:underline" onClick={()=>setSelected(classes.filter(c=>!c.expired).map(c=>c.key))}>Seleccionar todas</button><button type="button" className="cursor-pointer text-sm text-[#475569] hover:underline" onClick={()=>setSelected([])}>Quitar selección</button></div>}
            {expiredSelected && <p role="alert" className="text-sm font-semibold text-red-700">Quitá las clases que ya comenzaron antes de guardar el aviso.</p>}
            <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-[#D8DDE3] p-3">
              {classes.length===0 ? <p className="p-3 text-sm text-[#64748B]">{!teacherId || !start || !effectiveEnd ? 'Elegí docente y período para consultar sus clases.' : 'No hay clases programadas para las fechas seleccionadas. Revisá los días y horarios asignados.'}</p> : classes.map(c=><label key={c.key} className={`flex items-start gap-3 rounded-lg border p-3 ${c.expired ? 'border-red-300 bg-red-50' : 'cursor-pointer border-[#D8DDE3] bg-[#F1F2F4] hover:border-[#C61515]'}`}><input type="checkbox" className="mt-1 h-4 w-4 accent-[#C61515]" checked={selectedSet.has(c.key)} disabled={c.expired && !selectedSet.has(c.key)} onChange={e=>setSelected(old=>e.target.checked?[...old,c.key]:old.filter(k=>k!==c.key))}/><span><strong>{DAY_LABELS[DAYS[dateAtUTC(c.classDate).getUTCDay()]]} {format(c.classDate)} · {c.startTime}–{c.endTime}</strong><span className="block text-sm text-[#475569]">{c.subject} · {c.course} · Turno {shiftLabel(c.courseShift)} · Horario {shiftLabel(c.shift)} · <strong className="text-[#155E75]">{MODALITY_LABELS[c.modality] || c.modality}</strong></span>{c.expired && <span role="alert" className="mt-1 block text-xs font-semibold text-red-700">El horario de inicio ya pasó: no se puede seleccionar esta clase.</span>}</span></label>)}
            </div>
          </section>
          {type==='LATE_ARRIVAL' && <label className="block space-y-2 text-sm font-semibold">Hora estimada de llegada
            <input type="time" aria-invalid={Boolean(arrivalError)} className={`${FIELD} ${arrivalError ? 'border-red-600 bg-red-50' : ''}`} value={arrival} onChange={e=>setArrival(e.target.value)} required/>
            {arrivalError && <span role="alert" className="block text-xs font-semibold text-red-700">{arrivalError}</span>}
          </label>}
          {type==='VIRTUAL_SYNCHRONOUS' && <label className="block space-y-2 text-sm font-semibold">Enlace de videollamada<input type="url" className={FIELD} value={meetingUrl} onChange={e=>setMeetingUrl(e.target.value)} placeholder="https://meet.google.com/..." required/></label>}
          {type==='VIRTUAL_ASYNCHRONOUS' && <label className="block space-y-2 text-sm font-semibold">Materiales e instrucciones<textarea rows={4} className={FIELD} value={instructions} onChange={e=>setInstructions(e.target.value)} required/></label>}
          <label className="block space-y-2 text-sm font-semibold">Motivo del aviso<textarea rows={3} className={FIELD} value={reason} onChange={e=>setReason(e.target.value)} maxLength={2000} required placeholder="Descripción breve para los destinatarios. Evitá datos médicos sensibles."/></label>
          {(error || formError) && <p role="alert" className="rounded-lg border border-red-700 bg-[#FFF1F2] p-3 text-sm text-red-800">{error || formError}</p>}
        </div>
        <footer className="flex justify-end gap-3 border-t border-[#D8DDE3] bg-[#F8FAFC] p-4"><button type="button" onClick={onClose} disabled={isSaving} className="cursor-pointer rounded-xl border border-[#C8CFD8] px-5 py-3 hover:bg-[#E5E7EB]">Cancelar</button><button type="submit" disabled={isSaving || isLoading || !chosen.length || Boolean(periodError) || expiredSelected || Boolean(arrivalError)} className="cursor-pointer rounded-xl bg-[#C61515] !text-white px-5 py-3 font-bold hover:bg-[#B31212] !text-white disabled:cursor-not-allowed disabled:opacity-50">{isSaving?'Guardando…':`${initialData?.id ? 'Guardar cambios' : 'Crear aviso'} (${chosen.length} clases)`}</button></footer>
      </form>
    </div>
  </div>,document.body);
}
