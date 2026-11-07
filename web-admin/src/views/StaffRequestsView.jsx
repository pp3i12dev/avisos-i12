import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, CheckCircle2, XCircle, LoaderCircle, RefreshCw } from 'lucide-react';
import api from '../api/axios';
const roleName = { DIRECTOR: 'Directivo', PRECEPTOR: 'Preceptor', TEACHER: 'Docente' };
const statusName = { PENDING: 'Pendientes', APPROVED: 'Aprobadas', REJECTED: 'Rechazadas' };
const errorOf = e => e.response?.data?.message || e.message || 'No se pudo completar la operación.';

export default function StaffRequestsView() {
  const [status,setStatus] = useState('PENDING');
  const [rows,setRows] = useState([]);
  const [loading,setLoading] = useState(true);
  const [working,setWorking] = useState(null);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  const load = useCallback(async () => {
    setLoading(true);setError('');
    try { const { data } = await api.get('/staff-requests', { params: { status } }); setRows(Array.isArray(data) ? data : []); }
    catch(e){ setError(errorOf(e)); }
    finally { setLoading(false); }
  },[status]);
  useEffect(()=>{ let alive = true;
    setLoading(true);setError('');
    api.get('/staff-requests', { params: { status } }).then(({data})=>{ if(alive)setRows(Array.isArray(data)?data:[]); })
      .catch(e=>{if(alive)setError(errorOf(e));}).finally(()=>{if(alive)setLoading(false);});
    return ()=>{alive=false;};
  },[status]);
  const decide = async (item, decision) => {
    const label = roleName[item.role] || item.role;
    if (decision === 'APPROVED' && !window.confirm(`¿Confirmás que ${item.user.firstName} ${item.user.lastName} trabaja en la institución como ${label}?\n\nAl aprobar, podrá administrar datos según los permisos de ese rol.`))return;
    let reason;
    if(decision === 'REJECTED') { reason=window.prompt('Motivo del rechazo (al menos 5 caracteres):'); if(reason == null)return; if(reason.trim().length<5)return setError('El motivo debe tener al menos cinco caracteres.'); }
    setWorking(item.id);setError('');setMessage('');
    try { await api.post(`/staff-requests/${item.id}/${decision === 'APPROVED' ? 'approve' : 'reject'}`, reason ? {reason:reason.trim()} : {});
      setMessage(`Solicitud ${decision === 'APPROVED' ? 'aprobada' : 'rechazada'} correctamente.`);
      setRows(current=>current.filter(x=>x.id!==item.id));
    } catch(e){setError(errorOf(e));}finally{setWorking(null);}
  };
  return <main className="mx-auto max-w-7xl space-y-5 pb-10 text-slate-900">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-red-50 p-3 text-[#C61515]"><ShieldCheck size={27}/></span>
        <div><h1 className="text-2xl font-extrabold">Solicitudes de personal</h1><p className="text-sm text-slate-600">Aprobá únicamente personas cuyo cargo hayas verificado en el instituto.</p></div></div>
      <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100"><RefreshCw size={16}/> Actualizar</button>
    </header>
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      Los alumnos no necesitan aprobación institucional. Las cuentas de personal invitadas por una autoridad válida también se activan inmediatamente. Aquí solo se revisan solicitudes de personal registradas por cuenta propia.
    </section>
    <div className="flex flex-wrap gap-2">{Object.entries(statusName).map(([key,label])=> <button key={key} type="button" onClick={()=>setStatus(key)} className={`rounded-xl px-4 py-2 text-sm font-bold ${status===key?'bg-[#C61515] text-white':'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>{label}</button>)}</div>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-100 text-slate-700"><tr>
        <th className="px-4 py-3">Solicitante</th><th className="px-4 py-3">Institución</th><th className="px-4 py-3">Cargo solicitado</th>
        <th className="px-4 py-3">DNI / Legajo</th><th className="px-4 py-3">Correo</th><th className="px-4 py-3 text-right">Acciones</th>
      </tr></thead><tbody className="divide-y divide-slate-100">
      {loading ? <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-500"><LoaderCircle size={20} className="mx-auto animate-spin"/> Cargando solicitudes...</td></tr>
        : !rows.length ? <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-600">No hay solicitudes {statusName[status].toLowerCase()}.</td></tr>
        : rows.map(x=><tr key={x.id} className="hover:bg-slate-50">
          <td className="px-4 py-3"><p className="font-bold">{x.user.firstName} {x.user.lastName}</p><p className="text-xs text-slate-500">{new Date(x.createdAt).toLocaleDateString('es-AR')}</p></td>
          <td className="px-4 py-3">{x.user.institution?.nombre || x.user.institutionId}</td>
          <td className="px-4 py-3"><p className="font-semibold">{roleName[x.role]||x.role}</p><p className="text-xs text-slate-500">{x.position||x.specialty||x.shift||''}</p>
            {x.role === 'PRECEPTOR' && <div className="mt-1 space-y-1 text-xs text-slate-600">{Array.isArray(x.coverages) && x.coverages.length
              ? x.coverages.map((c,i)=><div key={`${c.careerId}-${c.shift}-${i}`}>{c.careerName || `Carrera ${c.careerId}`} · {({MANANA:'Mañana',TARDE:'Tarde',NOCHE:'Noche'})[c.shift]||c.shift}</div>)
              : <span>Sin cobertura declarada</span>}</div>}
          </td>
          <td className="px-4 py-3">{x.user.dni}<p className="text-xs text-slate-500">{x.legajo||'Sin legajo'}</p></td>
          <td className="px-4 py-3"><p className="text-slate-700">{x.user.email}</p><p className={`text-xs ${x.user.emailVerifiedAt?'text-emerald-700':'text-amber-700'}`}>{x.user.emailVerifiedAt?'Correo verificado':'Correo sin verificar'}</p></td>
          <td className="px-4 py-3 text-right">{status==='PENDING' && <div className="flex justify-end gap-2">
            <button type="button" disabled={Boolean(working)||!x.user.emailVerifiedAt} onClick={()=>decide(x,'APPROVED')} title={!x.user.emailVerifiedAt?'Esperá la verificación del correo':''} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-40"><CheckCircle2 size={15}/> Aprobar</button>
            <button type="button" disabled={Boolean(working)} onClick={()=>decide(x,'REJECTED')} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><XCircle size={15}/> Rechazar</button>
          </div>}{status!=='PENDING'&&<span className="text-xs text-slate-500">{statusName[status].slice(0,-1)}</span>}</td>
        </tr>)}
      </tbody></table>
    </div>
  </main>;
}
