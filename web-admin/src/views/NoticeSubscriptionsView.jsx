import { useEffect, useMemo, useState } from 'react';
import { BellRing, CheckCircle2, BookOpenCheck, CircleAlert, Search, LoaderCircle, Trash2, Plus } from 'lucide-react';
import api from '../api/axios';

const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
const field = 'w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-100';
const shifts = { MANANA: 'Mañana', TARDE: 'Tarde', NOCHE: 'Noche' };
const errMsg = err => err.response?.data?.message || err.message || 'No se pudo completar la operación.';
const levelName = value => value ? `${value}.º año` : 'Nivel sin configurar';

export default function NoticeSubscriptionsView() {
  const [catalog, setCatalog] = useState(null);
  const [mine, setMine] = useState({ subscriptions: [], careers: [] });
  const [careerId, setCareerId] = useState('');
  const [level, setLevel] = useState('');
  const [shift, setShift] = useState('');
  const [term, setTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const refresh = async () => {
    const [{ data: c }, { data: m }] = await Promise.all([api.get('/notice-subscriptions/catalog'), api.get('/notice-subscriptions/mine')]);
    setCatalog(c); setMine(m);
    setCareerId(prev => prev || (c.careers?.length ? String(c.careers[0].id) : ''));
  };
  useEffect(() => { let live = true;
    Promise.all([api.get('/notice-subscriptions/catalog'), api.get('/notice-subscriptions/mine')])
      .then(([{ data: c }, { data: m }]) => { if (!live) return; setCatalog(c); setMine(m); setCareerId(prev => prev || (c.careers?.[0] ? String(c.careers[0].id) : '')); })
      .catch(e => { if (live) setError(errMsg(e)); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);
  const available = useMemo(() => (catalog?.available || []).filter(x => String(x.careerId) === careerId), [catalog, careerId]);
  const levels = useMemo(() => [...new Set(available.map(x => x.level == null ? 'none' : String(x.level)))].sort((a,b)=>a.localeCompare(b, 'es', { numeric: true })), [available]);
  const availableForFilters = useMemo(() => available.filter(x => (!level || (x.level == null ? 'none' : String(x.level)) === level) && (!shift || x.shift === shift) && `${x.subject} ${x.course}`.toLowerCase().includes(term.trim().toLowerCase())), [available, level, shift, term]);
  const subscribed = new Map((mine.subscriptions || []).map(x => [`${x.courseId}:${x.subjectId}`, x]));
  const member = (mine.careers || []).some(x => String(x.id) === careerId);
  const run = async (key, fn) => { setBusyKey(key); setError(''); setMessage('');
    try { const { data } = await fn(); setMessage(data.message || 'Cambios guardados.'); await refresh(); }
    catch (e) { setError(errMsg(e)); } finally { setBusyKey(''); }
  };
  const subscribe = row => run(`${row.courseId}:${row.subjectId}`, () => api.post('/notice-subscriptions', { courseId: row.courseId, subjectId: row.subjectId }));
  const unsubscribe = row => { if (window.confirm(`¿Dejar de recibir avisos de ${row.subject.nombre}?`)) run(`del:${row.id}`, () => api.delete(`/notice-subscriptions/${row.id}`)); };
  const join = () => run('career', () => api.post('/notice-subscriptions/careers', { careerId: Number(careerId) }));
  return <div className="mx-auto max-w-7xl space-y-5 pb-8 text-slate-900">
    <header className="flex flex-wrap items-center gap-3">
      <span className="rounded-2xl bg-red-50 p-3 text-[#C61515]"><BellRing size={27}/></span>
      <div><h1 className="text-xl font-extrabold sm:text-2xl">Mis suscripciones a avisos</h1>
        <p className="text-sm text-slate-600">Elegí las materias sobre las que querés recibir notificaciones.</p></div>
    </header>
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <div className="flex items-start gap-3"><CircleAlert className="mt-0.5 shrink-0" size={21}/><div>
        <p className="font-extrabold">IMPORTANTE: esto NO es una inscripción académica.</p>
        <p className="mt-1 leading-6">Suscribirte aquí sirve únicamente para recibir avisos de ausencias, llegadas tarde, clases virtuales, eventos y suspensiones. Para cursar oficialmente una materia debés inscribirte por los canales oficiales del instituto.</p>
      </div></div>
    </section>
    {(error || message) && <div role="status" className={`rounded-xl border p-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>{error || message}</div>}
    {loading ? <div className={card}><LoaderCircle className="animate-spin text-[#C61515]"/> Cargando materias...</div> : catalog && <>
      <section className={card}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Buscá materias · Ciclo {catalog.academicYear}</h2>
          <span className="text-xs text-slate-500">Podés elegir materias de distintos años y turnos</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-sm font-semibold">1. Carrera
            <select className={field} value={careerId} onChange={e => { setCareerId(e.target.value); setLevel(''); setShift(''); }}>
              <option value="">Seleccioná una carrera</option>
              {catalog.careers.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-semibold">2. Año de la carrera
            <select className={field} value={level} onChange={e=>setLevel(e.target.value)} disabled={!careerId}>
              <option value="">Todos los años</option>{levels.map(l => <option key={l} value={l}>{l === 'none' ? 'Sin nivel configurado' : `${l}.º año`}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-semibold">3. Turno
            <select className={field} value={shift} onChange={e=>setShift(e.target.value)} disabled={!careerId}>
              <option value="">Todos los turnos</option>{Object.entries(shifts).map(([key,label])=><option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-semibold">4. Materia
            <div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400"/>
              <input className={`${field} pl-9`} value={term} onChange={e=>setTerm(e.target.value)} placeholder="Buscar materia..."/>
            </div>
          </label>
        </div>
        {careerId && <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          {member ? <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 size={17}/> Carrera vinculada a tus avisos</span>
            : <button type="button" disabled={Boolean(busyKey)} onClick={join} className="inline-flex items-center gap-2 text-sm font-semibold text-[#C61515] disabled:opacity-50"><Plus size={17}/> Seguir también los comunicados de esta carrera</button>}
          <p className="mt-1 text-xs text-slate-500">Vincular una carrera permite recibir sus comunicaciones generales; no es necesario para seguir sus materias.</p>
        </div>}
      </section>
      <section className={card}>
        <div className="mb-3 flex flex-wrap items-center justify-between"><h2 className="font-bold">Materias disponibles</h2><span className="text-sm text-slate-500">{availableForFilters.length} opciones</span></div>
        {!availableForFilters.length ? <p className="rounded-lg bg-slate-50 p-5 text-sm text-slate-600">No hay materias habilitadas con esos filtros. Una autoridad debe asignar docentes y configurar cursos del ciclo vigente.</p> : <div className="grid gap-3 lg:grid-cols-2">
          {availableForFilters.map(row=>{
            const active=subscribed.get(`${row.courseId}:${row.subjectId}`);
            return <div key={`${row.courseId}:${row.subjectId}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start gap-3"><BookOpenCheck size={21} className="mt-0.5 text-[#C61515]"/>
                <div><p className="text-xs font-semibold text-red-700">{catalog.careers.find(c=>c.id===row.careerId)?.nombre || 'Carrera'}</p><p className="font-semibold">{row.subject}</p><p className="mt-1 text-xs text-slate-600">{levelName(row.level)} · {shifts[row.shift] || 'Turno sin configurar'} · {row.course}</p></div>
              </div>
              {active ? <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"><CheckCircle2 size={16}/> Suscripto</span>
                : <button disabled={Boolean(busyKey)} onClick={()=>subscribe(row)} type="button" className="inline-flex items-center gap-2 rounded-lg bg-[#C61515] px-4 py-2 text-xs font-bold text-white hover:bg-red-800 disabled:opacity-50"><Plus size={15}/> Suscribirme</button>}
            </div>;
          })}
        </div>}
      </section>
      <section className={card}>
        <h2 className="mb-3 text-lg font-bold">Mis materias seguidas <span className="text-slate-400">({mine.subscriptions.length})</span></h2>
        {!mine.subscriptions.length ? <p className="text-sm text-slate-600">Todavía no seguís ninguna materia. Los comunicados dirigidos a toda la institución seguirán llegando a tu cuenta.</p>
          : <div className="divide-y divide-slate-100">{mine.subscriptions.map(s => <div key={s.id} className="flex items-center justify-between gap-3 py-3">
            <div><p className="text-xs font-semibold text-red-700">{s.course.career?.nombre || 'Carrera sin configurar'} · {shifts[s.course.shift] || 'Turno sin definir'}</p><p className="font-semibold">{s.subject.nombre}</p><p className="text-xs text-slate-500">{s.course.nombre} · {levelName(s.course.level)} · Ciclo {s.course.academicYear}</p></div>
            <button type="button" disabled={Boolean(busyKey)} onClick={()=>unsubscribe(s)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><Trash2 size={14}/> Dejar de seguir</button>
          </div>)}</div>}
        {!!mine.careers.length && <p className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-600">Carreras vinculadas para comunicaciones: {mine.careers.map(x=>x.nombre).join(' · ')}</p>}
      </section>
    </>}
  </div>;
}
