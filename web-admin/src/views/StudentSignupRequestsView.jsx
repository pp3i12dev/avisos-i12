import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Building2, Check, CheckCheck, ChevronRight, GraduationCap,
  Search, ShieldCheck, Trash2, X, XCircle,
} from 'lucide-react';
import { usersService } from '../services/users.service';
import { shiftLabel } from '../utils/courseShift';

const TABS = [
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'APPROVED', label: 'Aprobadas' },
  { value: 'REJECTED', label: 'Rechazadas' },
];
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const displayDate = value => value ? new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires',
}).format(new Date(value)) : '—';
const surface = 'rounded-2xl border border-[#dce1e8] bg-white shadow-[0_8px_28px_rgba(31,41,55,.045)]';
const mutedButton = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500';
const actionRed = 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#C61515] px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#ad1212] disabled:cursor-not-allowed disabled:opacity-45';
const actionGreen = 'inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-45';

export default function StudentSignupRequestsView() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('PENDING');
  const [institutionId, setInstitutionId] = useState('');
  const [careerKey, setCareerKey] = useState('');
  const [courseId, setCourseId] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [action, setAction] = useState(null); // { type: 'APPROVED' | 'REJECTED' | 'ARCHIVE', ids }
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState('');

  const groupsQuery = useQuery({
    queryKey: ['student-signup-course-groups', tab],
    queryFn: () => usersService.signupCourseGroups(tab),
    refetchInterval: tab === 'PENDING' ? 45000 : false,
  });
  const groups = useMemo(() => Array.isArray(groupsQuery.data) ? groupsQuery.data : [], [groupsQuery.data]);
  const institutions = useMemo(() => [...new Map(groups.map(c => [String(c.institutionId), c.institution])).entries()]
    .map(([id, institution]) => ({ id, nombre: institution?.nombre || `Institución ${id}` }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')), [groups]);
  const effectiveInstitution = institutionId || (institutions.length === 1 ? institutions[0].id : '');
  const institutionCourses = groups.filter(c => String(c.institutionId) === effectiveInstitution);
  const careers = useMemo(() => [...new Map(institutionCourses.map(c => [String(c.career?.id ?? 'none'), c.career?.nombre || 'Sin carrera asignada'])).entries()]
    .map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')), [institutionCourses]);
  const effectiveCareer = careerKey || (careers.length === 1 ? careers[0].id : '');
  const visibleCourses = institutionCourses.filter(c => String(c.career?.id ?? 'none') === effectiveCareer);
  const activeCourse = visibleCourses.find(c => String(c.id) === courseId);

  const rowsQuery = useQuery({
    queryKey: ['student-signup-requests', tab, courseId],
    queryFn: () => usersService.signupRequests(tab, Number(courseId)),
    enabled: Boolean(activeCourse),
    refetchInterval: activeCourse && tab === 'PENDING' ? 45000 : false,
  });
  const records = useMemo(() => Array.isArray(rowsQuery.data) ? rowsQuery.data : [], [rowsQuery.data]);
  const rows = useMemo(() => records.filter(u => normalize(
    `${u.firstName} ${u.lastName} ${u.dni} ${u.email} ${u.telefono || ''}`,
  ).includes(normalize(search.trim()))), [records, search]);
  const allowed = rows.slice(0, 100);
  const selectedVisible = allowed.filter(u => selected.includes(u.id)).map(u => u.id);
  const allVisible = allowed.length > 0 && allowed.every(u => selected.includes(u.id));

  useEffect(() => { setInstitutionId(''); setCareerKey(''); setCourseId(''); setSelected([]); setSearch(''); setNotice(''); setAction(null); }, [tab]);
  useEffect(() => { setSelected([]); setSearch(''); setAction(null); }, [courseId]);
  useEffect(() => {
    if (!action) return undefined;
    const onKey = e => { if (e.key === 'Escape' && !decision.isPending) setAction(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['student-signup-requests'] });
    qc.invalidateQueries({ queryKey: ['student-signup-course-groups'] });
    qc.invalidateQueries({ queryKey: ['users', 'student'] });
    qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
  };
  const decision = useMutation({
    mutationFn: async ({ type, ids, reason: why }) => {
      if (type === 'APPROVED') return usersService.approveSignups(ids);
      if (type === 'REJECTED') return usersService.rejectSignups(ids, why);
      return usersService.archiveSignup(ids[0]);
    },
    onSuccess: (data, variables) => {
      const messages = {
        APPROVED: 'aprobadas', REJECTED: 'rechazadas', ARCHIVE: 'retirada de la bandeja',
      };
      setNotice(`${variables.ids.length} solicitud(es) ${messages[variables.type]}.`);
      setAction(null); setSelected([]); setReason('');
      invalidate();
    },
  });
  const begin = (type, ids) => {
    if (!activeCourse || !ids.length || ids.length > 100 || (type === 'ARCHIVE' && ids.length !== 1)) return;
    decision.reset(); setReason(''); setNotice(''); setAction({ type, ids });
  };
  const submit = () => {
    if (!action || decision.isPending) return;
    if (action.type === 'REJECTED' && (reason.trim().length < 5 || reason.trim().length > 500)) return;
    decision.mutate({ ...action, reason: reason.trim() });
  };

  return <section className="mx-auto w-full max-w-[1500px] space-y-5 pb-14 text-slate-900">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <Link to="/dashboard/students" className="inline-flex items-center gap-2 text-sm font-semibold text-[#C61515] hover:underline"><ArrowLeft size={17}/> Volver a Alumnos</Link>
      <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"><ShieldCheck size={16} className="text-[#C61515]"/> Dirección y preceptoría</span>
    </header>

    <div className={`${surface} p-4 sm:p-6`}>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Estado de solicitudes">
        {TABS.map(t => <button key={t.value} type="button" role="tab" aria-selected={tab === t.value}
          onClick={() => setTab(t.value)} className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === t.value ? 'bg-[#C61515] text-white shadow-sm' : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'}`}>{t.label}</button>)}
      </div>
      {groupsQuery.isLoading ? <p className="py-7 text-slate-500">Cargando instituciones y cursos…</p>
        : groupsQuery.error ? <p role="alert" className="mt-4 text-red-700">No se pudieron cargar los cursos: {groupsQuery.error.response?.data?.message || groupsQuery.error.message}</p>
        : groups.length === 0 ? <p className="py-7 text-slate-500">Todavía no hay cursos registrados.</p>
        : <div className="mt-5 space-y-5">
          <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500" aria-label="Ubicación de solicitudes">
            <button type="button" className="text-[#B71919] hover:underline" onClick={() => { setInstitutionId(''); setCareerKey(''); setCourseId(''); }}>Instituciones</button>
            {effectiveInstitution && <><ChevronRight size={15}/><button type="button" className="text-[#B71919] hover:underline" onClick={() => { setCareerKey(''); setCourseId(''); }}>{institutions.find(i => i.id === effectiveInstitution)?.nombre}</button></>}
            {effectiveCareer && <><ChevronRight size={15}/><button type="button" className="text-[#B71919] hover:underline" onClick={() => setCourseId('')}>{careers.find(c => c.id === effectiveCareer)?.nombre}</button></>}
            {activeCourse && <><ChevronRight size={15}/><span className="font-semibold text-slate-800">{activeCourse.nombre} · {shiftLabel(activeCourse.shift)}</span></>}
          </nav>
          {institutions.length > 1 && <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><Building2 size={18} className="text-[#C61515]"/> Elegí la institución</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{institutions.map(i => <button key={i.id} type="button" onClick={() => { setInstitutionId(i.id); setCareerKey(''); setCourseId(''); }}
              className={`rounded-xl border p-4 text-left transition ${effectiveInstitution === i.id ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}>
              <span className="font-semibold text-slate-900">{i.nombre}</span><span className="mt-1 block text-xs text-slate-600">{groups.filter(c => String(c.institutionId) === i.id).reduce((n, c) => n + c.requestCount, 0)} solicitudes</span></button>)}</div>
          </div>}
          {effectiveInstitution && <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><GraduationCap size={18} className="text-[#C61515]"/> Carrera o nivel</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{careers.map(c => <button key={c.id} type="button" onClick={() => { setCareerKey(c.id); setCourseId(''); }}
              className={`rounded-xl border p-4 text-left transition ${effectiveCareer === c.id ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}>
              <span className="font-semibold text-slate-900">{c.nombre}</span><span className="mt-1 block text-xs text-slate-600">{institutionCourses.filter(x => String(x.career?.id ?? 'none') === c.id).length} curso(s)</span></button>)}</div>
          </div>}
          {effectiveCareer && <div>
            <h2 className="mb-3 text-sm font-bold">Curso</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visibleCourses.map(c => <button key={c.id} type="button" onClick={() => setCourseId(String(c.id))}
              className={`rounded-xl border p-4 text-left transition ${courseId === String(c.id) ? 'border-red-500 bg-red-50 ring-1 ring-red-200' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}>
              <span className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-900">{c.nombre} · {shiftLabel(c.shift)}</span><span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">{c.requestCount}</span></span>
              <span className="mt-2 block text-xs text-slate-600">Ciclo lectivo {c.academicYear} · {c.enrolledCount} matriculados en total</span>
            </button>)}</div>
          </div>}
        </div>}
    </div>

    {activeCourse && <div className={`${surface} overflow-hidden`}>
      <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-6">
        <div><h2 className="text-lg font-bold text-slate-900">Solicitudes · {activeCourse.nombre} · {shiftLabel(activeCourse.shift)}</h2>
          <p className="mt-1 text-sm text-slate-600">{activeCourse.institution?.nombre} · {rows.length} alumno(s) en la vista</p></div>
        <button type="button" onClick={() => setCourseId('')} className={mutedButton}><ArrowLeft size={16}/> Cambiar curso</button>
      </div>
      <div className="px-4 pb-4 sm:px-6">
        <label className="relative block max-w-xl"><Search size={18} className="pointer-events-none absolute left-3 top-3 text-slate-400"/>
          <span className="sr-only">Buscar alumno</span><input value={search} onChange={e => { setSearch(e.target.value); setSelected([]); }}
            placeholder="Buscar nombre, DNI, correo o teléfono" className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-red-400 focus:ring-2 focus:ring-red-100"/></label>
      </div>
      {tab === 'PENDING' && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" disabled={!allowed.length} checked={allVisible}
          onChange={e => setSelected(e.target.checked ? allowed.map(u => u.id) : [])} className="h-4 w-4 accent-[#C61515]"/> Seleccionar visibles {rows.length > 100 ? '(primeros 100)' : ''}</label>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!selectedVisible.length || decision.isPending} onClick={() => begin('APPROVED', selectedVisible)} className={actionGreen}><CheckCheck size={16}/> Aprobar ({selectedVisible.length})</button>
          <button type="button" disabled={!selectedVisible.length || decision.isPending} onClick={() => begin('REJECTED', selectedVisible)} className={actionRed}><XCircle size={16}/> Rechazar ({selectedVisible.length})</button>
        </div>
      </div>}
      {notice && <p role="status" className="mx-4 mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800 sm:mx-6">{notice}</p>}
      {rowsQuery.error && <p role="alert" className="mx-4 my-4 text-sm text-red-700 sm:mx-6">{rowsQuery.error.response?.data?.message || rowsQuery.error.message}</p>}
      {rowsQuery.isLoading ? <p className="p-6 text-slate-500">Cargando alumnos…</p> : rows.length === 0 ? <p className="p-6 text-slate-500">No hay solicitudes para este curso y estado.</p> :
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[940px] border-collapse text-left text-sm">
            <thead className="bg-[#F3F5F7] text-xs uppercase tracking-wide text-slate-600"><tr>
              {tab === 'PENDING' && <th scope="col" className="w-12 px-4 py-4"><span className="sr-only">Seleccionar</span></th>}
              <th scope="col" className="px-4 py-4">Nombre y apellido</th><th scope="col" className="px-4 py-4">DNI</th><th scope="col" className="px-4 py-4">Correo electrónico</th>
              <th scope="col" className="px-4 py-4">Teléfono</th><th scope="col" className="px-4 py-4">Registrado</th><th scope="col" className="px-4 py-4">Estado</th><th scope="col" className="px-4 py-4 text-right">Acciones</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">{rows.map(u => <tr key={u.id} className={`transition hover:bg-slate-50 ${selected.includes(u.id) ? 'bg-red-50/40' : 'bg-white'}`}>
              {tab === 'PENDING' && <td className="px-4 py-4"><input type="checkbox" aria-label={`Seleccionar ${u.firstName} ${u.lastName}`}
                disabled={!allowed.some(r => r.id === u.id)} checked={selected.includes(u.id)} onChange={e => setSelected(old => e.target.checked ? [...old, u.id] : old.filter(id => id !== u.id))} className="h-4 w-4 accent-[#C61515]"/></td>}
              <td className="px-4 py-4 font-semibold text-slate-900">{[u.firstName,u.lastName].filter(Boolean).join(' ') || 'Sin nombre'}</td>
              <td className="whitespace-nowrap px-4 py-4 text-slate-700">{u.dni || '—'}</td>
              <td className="px-4 py-4 text-slate-700"><span className="break-all">{u.email}</span></td>
              <td className="px-4 py-4 text-slate-700">{u.telefono || '—'}</td>
              <td className="whitespace-nowrap px-4 py-4 text-slate-600">{displayDate(u.createdAt)}</td>
              <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tab === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : tab === 'REJECTED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                {tab === 'PENDING' ? 'Pendiente' : tab === 'APPROVED' ? 'Aprobada' : 'Rechazada'}</span></td>
              <td className="px-4 py-4"><div className="flex items-center justify-end gap-2">
                {tab === 'PENDING' ? <>
                  <button type="button" onClick={() => begin('APPROVED', [u.id])} className={actionGreen} title="Aprobar solicitud"><Check size={15}/> Aprobar</button>
                  <button type="button" onClick={() => begin('REJECTED', [u.id])} className={actionRed} title="Rechazar solicitud"><X size={15}/> Rechazar</button>
                  <button type="button" onClick={() => begin('ARCHIVE', [u.id])} className="inline-flex items-center justify-center gap-1 rounded-xl border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50" title="Retirar solicitud de la bandeja"><Trash2 size={15}/> Eliminar</button>
                </> : <span className="max-w-[200px] text-xs text-slate-500">{u.signupReviewReason || (u.signupReviewedAt ? `Revisada ${displayDate(u.signupReviewedAt)}` : 'Sin acciones pendientes')}</span>}
              </div></td>
            </tr>)}</tbody>
          </table>
        </div>}
      <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500 sm:px-6">{rows.length} solicitud(es) mostradas. Deslizá la tabla horizontalmente en pantallas pequeñas.</div>
    </div>}

    {action && <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !decision.isPending) setAction(null); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="signup-dialog-title" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-3"><h2 id="signup-dialog-title" className="text-xl font-bold">
          {action.type === 'APPROVED' ? 'Confirmar aprobación' : action.type === 'REJECTED' ? 'Confirmar rechazo' : '¿Eliminar esta solicitud?'}</h2>
          <button type="button" onClick={() => setAction(null)} disabled={decision.isPending} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label="Cerrar"><X size={19}/></button></div>
        <p className="mt-3 text-sm leading-6 text-slate-600">{action.type === 'ARCHIVE'
          ? 'La solicitud se retirará de la bandeja y la cuenta quedará desactivada. Se conservará un registro administrativo; esta acción no equivale a borrar físicamente los datos.'
          : `${action.ids.length} solicitud(es) del curso ${activeCourse?.nombre} serán ${action.type === 'APPROVED' ? 'aprobadas' : 'rechazadas'}.`}</p>
        {action.type === 'REJECTED' && <label className="mt-4 block text-sm font-semibold text-slate-800">Motivo del rechazo (obligatorio)
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} maxLength={500} placeholder="Explicá el motivo para el alumno"
            className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-slate-900 outline-none placeholder:text-slate-500 focus:border-red-400"/></label>}
        {decision.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{decision.error.response?.data?.message || decision.error.message}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-2"><button type="button" disabled={decision.isPending} onClick={() => { setAction(null); decision.reset(); }} className={mutedButton}>Cancelar</button>
          <button type="button" onClick={submit} disabled={decision.isPending || (action.type === 'REJECTED' && reason.trim().length < 5)} className={action.type === 'APPROVED' ? actionGreen : actionRed}>
            {decision.isPending ? 'Procesando…' : action.type === 'APPROVED' ? 'Sí, aprobar' : action.type === 'REJECTED' ? 'Sí, rechazar' : 'Sí, eliminar solicitud'}</button></div>
      </div>
    </div>}
  </section>;
}
