import { useContext, useEffect, useMemo, useState } from 'react';
import { UsersRound, BellRing, CheckCircle2, Plus, Trash2, Search, X, Check } from 'lucide-react';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import { useInstitutions } from '../hooks/useInstitution';
const field='w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:border-[#C61515]';
const card='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
const errorMsg=e=>e.response?.data?.message||e.message||'No se pudo completar la operación.';
const shifts={ MANANA:'Mañana',TARDE:'Tarde',NOCHE:'Noche' };

export default function AdminNoticeSubscriptionsView() {
  const { user }=useContext(AuthContext);
  const isSuper=Boolean(user?.isSuperAdmin || user?.roles?.includes('SUPER_ADMIN'));
  const {data:institutions=[]}=useInstitutions(isSuper);
  const [institutionId,setInstitutionId]=useState(user?.institutionId?String(user.institutionId):'');
  const [search,setSearch]=useState('');
  const [students,setStudents]=useState([]);
  const [studentId,setStudentId]=useState('');
  const [pickedStudent,setPickedStudent]=useState(null);
  const [showSuggestions,setShowSuggestions]=useState(false);
  const [activeSuggestion,setActiveSuggestion]=useState(0);
  const [studentsLoading,setStudentsLoading]=useState(false);
  const [catalog,setCatalog]=useState(null);
  const [mine,setMine]=useState({ subscriptions: [], careers: [] });
  const [career,setCareer]=useState('');
  const [level,setLevel]=useState('');
  const [shift,setShift]=useState('');
  const [error,setError]=useState('');
  const [info,setInfo]=useState('');
  const [busy,setBusy]=useState(false);
  const normalizedInstitutions=Array.isArray(institutions)?institutions:institutions?.institutions||[];
  useEffect(()=>{
    if(!institutionId && isSuper && normalizedInstitutions.length) setInstitutionId(String(normalizedInstitutions[0].id));
  },[institutionId,isSuper,normalizedInstitutions.length]);
  useEffect(()=>{if(!institutionId)return;let live=true;
    api.get('/notice-subscriptions/admin/catalog',{params:{institutionId}}).then(({data})=>{if(live){setCatalog(data);setCareer(String(data.careers[0]?.id||''));setLevel('');setShift('');}})
      .catch(e=>{if(live)setError(errorMsg(e));});return()=>{live=false;};
  },[institutionId]);
  useEffect(()=>{if(!institutionId){setStudents([]);return;}let live=true;
    const timer=setTimeout(()=>{
      setStudentsLoading(true);
      api.get('/notice-subscriptions/admin/students',{params:{institutionId,search}})
        .then(({data})=>{if(live){setStudents(Array.isArray(data)?data:[]);setActiveSuggestion(0);}})
        .catch(e=>{if(live)setError(errorMsg(e));})
        .finally(()=>{if(live)setStudentsLoading(false);});
    },250);
    return()=>{live=false;clearTimeout(timer);};
  },[institutionId,search]);
  useEffect(()=>{if(!institutionId||!studentId){setMine({subscriptions:[],careers:[]});return;}let live=true;
    api.get(`/notice-subscriptions/admin/students/${studentId}`,{params:{institutionId}})
      .then(({data})=>{if(live)setMine(data);}).catch(e=>{if(live)setError(errorMsg(e));});
    return()=>{live=false;};
  },[studentId,institutionId]);
  const refreshMine=async()=>{if(!studentId)return;const {data}=await api.get(`/notice-subscriptions/admin/students/${studentId}`,{params:{institutionId}});setMine(data);};
  const run=async(action,done)=>{setBusy(true);setError('');setInfo('');try{const {data}=await action();setInfo(data.message||'Cambio realizado.');await refreshMine();done?.();}catch(e){setError(errorMsg(e));}finally{setBusy(false);}};
  const chooseStudent = row => {
    setPickedStudent(row);
    setStudentId(String(row.id));
    setSearch(`${row.lastName}, ${row.firstName}`);
    setShowSuggestions(false);
    setError('');
  };
  const clearStudent = () => {
    setStudentId('');
    setPickedStudent(null);
    setSearch('');
    setStudents([]);
    setShowSuggestions(true);
  };
  const handleSearchKey = event => {
    if(event.key==='Escape'){setShowSuggestions(false);return;}
    if(event.key==='ArrowDown'){event.preventDefault();setShowSuggestions(true);setActiveSuggestion(i=>Math.min(students.length-1,i+1));return;}
    if(event.key==='ArrowUp'){event.preventDefault();setActiveSuggestion(i=>Math.max(0,i-1));return;}
    if(event.key==='Enter' && showSuggestions && students.length){event.preventDefault();chooseStudent(students[activeSuggestion]||students[0]);}
  };
  const options=useMemo(()=>(catalog?.available||[]).filter(x=>String(x.careerId)===career &&(!level||String(x.level??'none')===level)&&(!shift||x.shift===shift)),[catalog,career,level,shift]);
  const enrolled=new Map((mine.subscriptions||[]).map(s=>[`${s.courseId}:${s.subjectId}`,s]));
  return <div className="mx-auto max-w-7xl space-y-5 pb-10 text-slate-900">
    <header className="flex items-center gap-3"><span className="rounded-xl bg-red-50 p-3 text-[#C61515]"><UsersRound size={26}/></span><div>
      <h1 className="text-2xl font-extrabold">Suscripciones de alumnos</h1><p className="text-sm text-slate-600">Administrá avisos de materias para alumnos que necesiten asistencia. No altera la matrícula oficial.</p>
    </div></header>
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Las suscripciones sirven exclusivamente para recibir notificaciones. No inscriben oficialmente para cursar materias ni reemplazan los portales académicos del instituto.</section>
    {error&&<p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
    {info&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{info}</p>}
    <div className={card}>
      <div className={`grid gap-3 ${isSuper ? 'lg:grid-cols-[minmax(240px,1fr)_minmax(0,2fr)]' : 'grid-cols-1'}`}>
        {isSuper && <label className="space-y-1 text-sm font-bold">Institución
          <select className={field} value={institutionId} onChange={e=>{setInstitutionId(e.target.value);clearStudent();setShowSuggestions(false);}}>
            <option value="">Elegí instituto</option>
            {normalizedInstitutions.map(i=><option key={i.id} value={i.id}>{i.nombre}</option>)}
          </select>
        </label>}
        <div className="relative min-w-0">
          <label className="mb-1 block text-sm font-bold" htmlFor="admin-student-search">Buscar y seleccionar alumno</label>
          <div className="relative">
            <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-3 top-3.5 text-slate-500"/>
            <input id="admin-student-search" type="search" className={`${field} pl-10 pr-10`}
              value={search} autoComplete="off" role="combobox" aria-autocomplete="list"
              aria-expanded={showSuggestions && !pickedStudent} aria-controls="student-search-suggestions"
              placeholder="Escribí nombre, apellido, DNI o correo..."
              disabled={!institutionId || busy}
              onFocus={()=>{if(!pickedStudent)setShowSuggestions(true);}}
              onBlur={()=>setShowSuggestions(false)}
              onKeyDown={handleSearchKey}
              onChange={e=>{setSearch(e.target.value);setStudentId('');setPickedStudent(null);setShowSuggestions(true);setActiveSuggestion(0);}}/>
            {search&&<button type="button" aria-label="Limpiar alumno" title="Limpiar búsqueda" onMouseDown={e=>e.preventDefault()} onClick={clearStudent} className="absolute right-3 top-3 text-slate-500 hover:text-red-700"><X size={18}/></button>}
          </div>
          {showSuggestions && !pickedStudent && institutionId &&
            <div id="student-search-suggestions" role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
              {studentsLoading?<p className="p-3 text-sm text-slate-500">Buscando alumnos…</p>
                :students.length===0?<p className="p-3 text-sm text-slate-500">Sin coincidencias. Probá con otro nombre, DNI o correo.</p>
                :students.map((row,i)=><button type="button" role="option" aria-selected={i===activeSuggestion} key={row.id}
                  onMouseDown={e=>e.preventDefault()} onMouseEnter={()=>setActiveSuggestion(i)} onClick={()=>chooseStudent(row)}
                  className={`block w-full rounded-lg px-3 py-2.5 text-left hover:bg-rose-50 ${i===activeSuggestion?'bg-rose-50':''}`}>
                    <span className="block text-sm font-semibold text-slate-900">{row.lastName}, {row.firstName}</span>
                    <span className="block text-xs text-slate-600">DNI {row.dni} · {row.email}</span>
                  </button>)}
              {!studentsLoading&&students.length===100&&<p className="border-t px-3 py-2 text-xs text-slate-500">Mostrando los primeros 100. Escribí más caracteres para acotar.</p>}
            </div>}
          {pickedStudent ? <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <span className="inline-flex items-center gap-2"><Check size={17}/> Alumno seleccionado: <strong>{pickedStudent.firstName} {pickedStudent.lastName}</strong> · DNI {pickedStudent.dni}</span>
            <button type="button" onClick={clearStudent} className="shrink-0 text-xs font-bold underline">Cambiar</button>
          </div> : <p className="mt-1.5 text-xs text-slate-500">Seleccioná una sugerencia para ver y administrar sus suscripciones. Usá ↑ ↓ y Enter desde el teclado.</p>}
        </div>
      </div>
    </div>
    {studentId&&<>
      <section className={card}>
        <h2 className="mb-3 text-lg font-bold">Agregar materia para notificaciones</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm font-bold">Carrera<select className={field} value={career} onChange={e=>{setCareer(e.target.value);setLevel('');setShift('');}}><option value="">Seleccioná carrera</option>{(catalog?.careers||[]).map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
          <label className="text-sm font-bold">Año de la carrera<select className={field} value={level} onChange={e=>setLevel(e.target.value)}><option value="">Todos</option>{[...new Set((catalog?.available||[]).filter(x=>String(x.careerId)===career).map(x=>String(x.level??'none')))].map(l=><option key={l} value={l}>{l==='none'?'Sin configurar':l+'.º año'}</option>)}</select></label>
          <label className="text-sm font-bold">Turno<select className={field} value={shift} onChange={e=>setShift(e.target.value)}><option value="">Todos</option>{Object.entries(shifts).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
        </div>
        <div className="mt-4 grid gap-2 lg:grid-cols-2">{options.map(row=>{
          const already=enrolled.get(`${row.courseId}:${row.subjectId}`);
          return <div key={`${row.courseId}:${row.subjectId}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div><p className="text-sm font-semibold">{row.subject}</p><p className="text-xs text-slate-500">{row.course} · {row.level?`${row.level}.º año`:'Sin nivel'} · {shifts[row.shift]||'Sin turno'}</p></div>
            {already?<span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 size={15}/> Activa</span>
              :<button disabled={busy} type="button" onClick={()=>run(()=>api.post(`/notice-subscriptions/admin/students/${studentId}`,{institutionId:Number(institutionId),courseId:row.courseId,subjectId:row.subjectId}))} className="inline-flex items-center gap-1 rounded-lg bg-[#C61515] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Plus size={15}/> Seguir</button>}
          </div>;
        })}</div>
        {!options.length&&<p className="mt-4 text-sm text-slate-600">No hay materias habilitadas para esos filtros.</p>}
      </section>
      <section className={card}><h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><BellRing size={20} className="text-[#C61515]"/> Suscripciones actuales ({mine.subscriptions.length})</h2>
        {!mine.subscriptions.length?<p className="text-sm text-slate-600">El alumno todavía no sigue materias.</p>:<div className="divide-y divide-slate-100">{mine.subscriptions.map(s=><div key={s.id} className="flex items-center justify-between gap-3 py-3">
          <div><p className="text-xs font-semibold text-red-700">{s.course.career?.nombre || 'Carrera sin configurar'} · {shifts[s.course.shift] || 'Turno sin definir'}</p><p className="font-semibold">{s.subject.nombre}</p><p className="text-xs text-slate-600">{s.course.nombre} · Ciclo {s.course.academicYear}</p></div>
          <button disabled={busy} type="button" onClick={()=>{if(window.confirm(`¿Quitar la suscripción de ${s.subject.nombre}?`))run(()=>api.delete(`/notice-subscriptions/admin/students/${studentId}/${s.id}`,{params:{institutionId}}));}} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50"><Trash2 size={14}/> Quitar</button>
        </div>)}</div>}
      </section>
    </>}
  </div>;
}
