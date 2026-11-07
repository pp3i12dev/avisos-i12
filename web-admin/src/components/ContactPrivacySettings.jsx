import { useEffect, useState } from 'react';
import { ShieldCheck, Mail, Phone, Save, LockKeyhole, Info } from 'lucide-react';
import api from '../api/axios';
const ROLES=[{id:'SUPER_ADMIN',name:'Superadministración'},{id:'DIRECTOR',name:'Directivos'},
  {id:'PRECEPTOR',name:'Preceptores'},{id:'TEACHER',name:'Docentes'},{id:'STUDENT',name:'Alumnos'}];
const blank={contactEmail:'',emailVisibleTo:[],phoneVisibleTo:[],phone:''};
export default function ContactPrivacySettings(){
  const [form,setForm]=useState(blank),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),
    [error,setError]=useState(''),[success,setSuccess]=useState('');
  useEffect(()=>{let live=true;api.get('/contact-directory/preferences').then(({data})=>{if(live)setForm(data)}).catch(e=>{if(live)setError(e.response?.data?.message||'No se pudieron cargar las preferencias.')}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[]);
  const toggle=(field,role,checked)=>setForm(prev=>({...prev,[field]:checked?[...prev[field],role]:prev[field].filter(r=>r!==role)}));
  const submit=async e=>{e.preventDefault();setSaving(true);setError('');setSuccess('');try{const {data}=await api.put('/contact-directory/preferences',{
    contactEmail:form.contactEmail,emailVisibleTo:form.emailVisibleTo,phoneVisibleTo:form.phoneVisibleTo
  });setForm(data);setSuccess('Tus preferencias de privacidad se guardaron correctamente.')}catch(err){setError(err.response?.data?.message||'No se pudo guardar.')}finally{setSaving(false)}};
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm sm:p-7">
    <div className="mb-4 flex items-center gap-3"><div className="rounded-xl bg-red-50 p-3 text-[#C61515]"><ShieldCheck size={22}/></div><div><h2 className="text-lg font-bold">Privacidad y contacto</h2><p className="text-sm text-slate-500">Elegí qué datos pueden ver otros usuarios del instituto.</p></div></div>
    <div className="mb-5 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><LockKeyhole size={18} className="shrink-0"/><p>Tu correo y teléfono están <strong>ocultos por defecto</strong>. Compartirlos es voluntario y revocable. Los permisos de la aplicación no dependen de esta configuración.</p></div>
    {loading?<p className="text-sm text-slate-500">Cargando preferencias...</p>:<form onSubmit={submit} className="space-y-6">
      <div><label className="mb-2 block text-sm font-semibold">Correo alternativo de contacto (opcional)</label>
        <input type="email" value={form.contactEmail||''} maxLength={200} onChange={e=>setForm(f=>({...f,contactEmail:e.target.value}))} placeholder={form.email||'contacto@instituto.edu.ar'} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#C61515]"/>
        <p className="mt-1 text-xs text-slate-500">Si está vacío, se usará tu correo de acceso únicamente para los roles que autorices.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">{[
        {field:'emailVisibleTo',label:'Compartir mi correo',Icon:Mail,detail:'Correo alternativo o correo de acceso'},
        {field:'phoneVisibleTo',label:'Compartir mi teléfono móvil',Icon:Phone,detail:form.phone||'No tenés un teléfono cargado en Mi perfil'},
      ].map(({field,label,Icon,detail})=><fieldset key={field} className="space-y-3 rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-bold"><span className="inline-flex items-center gap-2"><Icon size={17} className="text-[#C61515]"/>{label}</span></legend>
        <p className="break-words text-xs text-slate-500">{detail}</p>
        {ROLES.map(role=><label key={role.id} className="flex cursor-pointer items-center gap-3 rounded-lg p-1 text-sm hover:bg-slate-50"><input type="checkbox" checked={form[field].includes(role.id)} onChange={e=>toggle(field,role.id,e.target.checked)} className="h-4 w-4 accent-[#C61515]"/><span>{role.name}</span></label>)}
      </fieldset>)}</div>
      <p className="flex items-start gap-2 text-xs text-slate-600"><Info size={16} className="shrink-0"/>Para cambiar el teléfono guardado, utilizá la sección Datos personales de este perfil. Ocultar un dato no impide que la plataforma lo utilice para gestionar tu cuenta.</p>
      {error&&<p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {success&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
      <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#C61515] px-5 py-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"><Save size={17}/>{saving?'Guardando...':'Guardar preferencias'}</button>
    </form>}
  </section>;
}
