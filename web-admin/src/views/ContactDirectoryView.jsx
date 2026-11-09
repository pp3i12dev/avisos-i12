import { useContext,useEffect,useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, BookOpen, ContactRound, Mail, Phone, School, UserRound, ShieldCheck, ChevronLeft, ChevronRight, Copy, Check } from 'lucide-react';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
const TYPES=[{value:'ALL',label:'Todas las categorías'},{value:'DIRECTOR',label:'Directivos'},{value:'PRECEPTOR',label:'Preceptores'},
  {value:'TEACHER',label:'Docentes'},{value:'STUDENT',label:'Alumnos'}];
const SHIFTS=[{value:'',label:'Todos los turnos'},{value:'MANANA',label:'Mañana'},{value:'TARDE',label:'Tarde'},{value:'NOCHE',label:'Noche'}];
const labels={DIRECTOR:'Directivo',PRECEPTOR:'Preceptor',TEACHER:'Docente',STUDENT:'Alumno'};
const shifts={MANANA:'Mañana',TARDE:'Tarde',NOCHE:'Noche'};
const messageOf=e=>e.response?.data?.message||e.message||'No fue posible completar la consulta.';
export default function ContactDirectoryView(){
  const {user}=useContext(AuthContext);
  const superAdmin=user?.isSuperAdmin||user?.roles?.includes('SUPER_ADMIN');
  const studentOnly=user?.roles?.includes('STUDENT')&&!user?.roles?.some(r=>['SUPER_ADMIN','DIRECTOR','PRECEPTOR','TEACHER'].includes(r));
  const [institutionId,setInstitutionId]=useState(user?.institutionId?String(user.institutionId):'');
  const [options,setOptions]=useState({institutions:[],careers:[],subjects:[],roles:[]});
  const [query,setQuery]=useState({role:'ALL',careerId:'',shift:'',subjectId:'',search:''});
  const [searchDelayed,setSearchDelayed]=useState('');
  const [copyFeedback,setCopyFeedback]=useState(null);
  const [page,setPage]=useState(1),[results,setResults]=useState({results:[],hasMore:false}),
    [loading,setLoading]=useState(false),[error,setError]=useState('');
  useEffect(()=>{const t=setTimeout(()=>setSearchDelayed(query.search.trim()),280);return()=>clearTimeout(t)},[query.search]);
  useEffect(()=>{if(!copyFeedback)return;const t=setTimeout(()=>setCopyFeedback(null),1900);return()=>clearTimeout(t)},[copyFeedback]);
  const copyContact=async(id,kind,value)=>{
    const key=`${id}-${kind}`;
    try {
      if(!navigator.clipboard?.writeText)throw new Error('Clipboard API no disponible');
      await navigator.clipboard.writeText(value);
      setCopyFeedback({key,ok:true});
    }catch{
      setCopyFeedback({key,ok:false});
    }
  };
  useEffect(()=>{let live=true;api.get('/contact-directory/options',{params:{institutionId:institutionId||undefined}}).then(({data})=>{if(live)setOptions(data)}).catch(e=>{if(live)setError(messageOf(e))});return()=>{live=false};
  },[institutionId,superAdmin]);
  useEffect(()=>{setPage(1)},[institutionId,query.role,query.careerId,query.shift,query.subjectId,searchDelayed]);
  useEffect(()=>{if(superAdmin&&!institutionId){setResults({results:[],hasMore:false});return}
    let live=true;setLoading(true);setError('');api.get('/contact-directory',{params:{institutionId:institutionId||undefined,role:query.role,careerId:query.careerId||undefined,
      shift:query.shift||undefined,subjectId:query.subjectId||undefined,search:searchDelayed,page}})
      .then(({data})=>{if(live)setResults(data)}).catch(e=>{if(live)setError(messageOf(e))}).finally(()=>{if(live)setLoading(false)});
    return()=>{live=false};
  },[superAdmin,institutionId,query.role,query.careerId,query.shift,query.subjectId,searchDelayed,page]);
  const field='w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none focus:border-[#C61515] focus:ring-2 focus:ring-red-100';
  const update=(key,value)=>setQuery(p=>({...p,[key]:value}));
  const roles=studentOnly?TYPES.filter(t=>t.value!=='STUDENT'):TYPES;
  const visibleResults=results.results.filter(u=>u.email||u.phone);
  return <div className="mx-auto max-w-[1400px] space-y-5 pb-12 text-slate-900">
    <header className="flex items-center gap-3"><div className="rounded-xl bg-red-50 p-3 text-[#C61515]"><ContactRound size={28}/></div><div>
      <h1 className="text-2xl font-extrabold tracking-tight">Directorio de contactos</h1><p className="text-sm text-slate-500">Encontrá personal del instituto y los canales de contacto que cada persona decidió compartir.</p>
    </div></header>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><div className="flex items-start gap-2"><ShieldCheck size={19} className="shrink-0"/><p>Solo aparecen personas que compartieron al menos un dato de contacto con tu rol. No se exhiben DNI ni legajos.</p></div><Link className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold hover:bg-amber-100" to="/dashboard/profile">Configurar mis datos de contacto</Link></div>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      {superAdmin&&<label className="text-xs font-bold">Institución<select className={field+' mt-1'} value={institutionId} onChange={e=>{setInstitutionId(e.target.value);setQuery(q=>({...q,careerId:'',subjectId:''}))}}><option value="">Elegí institución</option>{options.institutions.map(i=><option key={i.id} value={i.id}>{i.nombre}</option>)}</select></label>}
      <label className="text-xs font-bold">Categoría<select className={field+' mt-1'} value={query.role} onChange={e=>update('role',e.target.value)}>{roles.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
      <label className="text-xs font-bold">Carrera<select className={field+' mt-1'} value={query.careerId} onChange={e=>{setQuery(q=>({...q,careerId:e.target.value,subjectId:''}))}}><option value="">Todas las carreras</option>{options.careers.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
      <label className="text-xs font-bold">Turno<select className={field+' mt-1'} value={query.shift} onChange={e=>setQuery(q=>({...q,shift:e.target.value,subjectId:''}))}>{SHIFTS.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
      <label className="text-xs font-bold">Materia<select className={field+' mt-1'} value={query.subjectId} onChange={e=>update('subjectId',e.target.value)}><option value="">Todas las materias</option>{options.subjects.filter(s=>(!query.careerId||s.careerIds.includes(Number(query.careerId)))&&(!query.shift||s.shifts.includes(query.shift))).map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label>
      <label className="text-xs font-bold md:col-span-2 xl:col-span-2">Buscar por nombre o materia<div className="relative mt-1"><Search size={17} className="absolute left-3 top-3.5 text-slate-500"/><input className={field+' pl-10'} value={query.search} onChange={e=>update('search',e.target.value)} placeholder="Ej. Ingeniería, Ferreyra..." maxLength={100}/></div></label>
    </div></section>
    {error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
    <span className="sr-only" role="status" aria-live="polite">{copyFeedback?(copyFeedback.ok?'Contacto copiado al portapapeles.':'No se pudo copiar. Revisá los permisos del navegador.'):''}</span>
    {superAdmin&&!institutionId?<p className="rounded-xl bg-white p-6 text-center text-slate-600">Seleccioná una institución para consultar los contactos.</p>:<>
      {loading&&<p className="text-sm text-slate-500">Buscando contactos...</p>}
      {!loading&&visibleResults.length===0?<div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">No hay contactos compartidos con tu rol que coincidan con los filtros.</div>:<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleResults.map(u=><article key={u.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3"><div className="rounded-xl bg-red-50 p-3 text-[#C61515]"><UserRound size={21}/></div><div className="min-w-0 flex-1"><h3 className="font-bold text-slate-900">{u.firstName} {u.lastName}</h3><p className="text-xs font-medium text-rose-700">{u.roles.map(r=>labels[r]||r).join(' · ')}</p>{(u.position||u.specialty)&&<p className="text-xs text-slate-500">{u.position||u.specialty}</p>}</div></div>
          {u.coverages?.length>0&&<div className="mt-4 space-y-1">{u.coverages.map((c,i)=><p key={i} className="text-xs text-slate-600">{c.career} · {shifts[c.shift]||c.shift}</p>)}</div>}
          {u.teaching?.length>0&&<div className="mt-4 space-y-1">{u.teaching.slice(0,10).map((c,i)=><p key={i} className="text-xs text-slate-600"><BookOpen size={13} className="mr-1 inline"/>{c.subject} · {c.career||'Sin carrera'} · {shifts[c.shift]||c.shift||'Sin turno'}</p>)}</div>}
          {u.careers?.length>0&&<p className="mt-3 text-xs text-slate-500"><School size={13} className="mr-1 inline"/>{u.careers.join(' · ')}</p>}
          <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
            {u.email&&<div className="flex min-w-0 items-center justify-between gap-2">
              <a className="flex min-w-0 flex-1 items-start gap-2 break-all text-sm text-[#C61515] hover:underline" href={`mailto:${u.email}`}><Mail size={16} className="mt-0.5 shrink-0"/><span className="min-w-0">{u.email}</span></a>
              <button type="button" onClick={()=>copyContact(u.id,'email',u.email)} title="Copiar correo" aria-label={`Copiar correo de ${u.firstName} ${u.lastName}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-[#C61515] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C61515]">
                {copyFeedback?.key===`${u.id}-email`&&copyFeedback.ok?<Check size={17}/>:<Copy size={17}/>}</button>
            </div>}
            {u.phone&&<div className="flex min-w-0 items-center justify-between gap-2">
              <a className="flex min-w-0 flex-1 items-start gap-2 break-all text-sm text-[#C61515] hover:underline" href={`tel:${u.phone.replace(/[^\d+]/g,'')}`}><Phone size={16} className="mt-0.5 shrink-0"/><span>{u.phone}</span></a>
              <button type="button" onClick={()=>copyContact(u.id,'phone',u.phone)} title="Copiar teléfono" aria-label={`Copiar teléfono de ${u.firstName} ${u.lastName}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-[#C61515] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C61515]">
                {copyFeedback?.key===`${u.id}-phone`&&copyFeedback.ok?<Check size={17}/>:<Copy size={17}/>}</button>
            </div>}
            {copyFeedback?.key?.startsWith(`${u.id}-`)&&<p className={`text-xs ${copyFeedback.ok?'text-green-700':'text-rose-700'}`}>
              {copyFeedback.ok?'Copiado al portapapeles':'No fue posible copiar. Revisá los permisos del navegador.'}
            </p>}
          </div>
        </article>)}
      </div>}
      {(page>1||results.hasMore)&&<div className="flex justify-center gap-3"><button type="button" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm disabled:opacity-40" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}><ChevronLeft className="mr-1 inline" size={15}/>Anterior</button><span className="py-2 text-sm">Página {page}</span><button type="button" disabled={!results.hasMore} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm disabled:opacity-40" onClick={()=>setPage(p=>p+1)}>Siguiente<ChevronRight className="ml-1 inline" size={15}/></button></div>}
    </>}
  </div>;
}
