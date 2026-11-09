import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ShieldCheck, Mail, Phone, Save, LockKeyhole, Info } from 'lucide-react';
import api from '../api/axios';
const ROLES=[{id:'SUPER_ADMIN',name:'Superadministración'},{id:'DIRECTOR',name:'Directivos'},
  {id:'PRECEPTOR',name:'Preceptores'},{id:'TEACHER',name:'Docentes'},{id:'STUDENT',name:'Alumnos'}];
const blank={contactEmail:'',contactPhone:'',emailVisibleTo:[],phoneVisibleTo:[],phone:''};
export default function ContactPrivacySettings(){
  const {user}=useContext(AuthContext);
  const isStudentOnly=user?.roles?.includes('STUDENT')&&!user?.roles?.some(r=>['TEACHER','PRECEPTOR','DIRECTOR','SUPER_ADMIN'].includes(r));
  const [form,setForm]=useState(blank),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),
    [error,setError]=useState(''),[success,setSuccess]=useState('');
  useEffect(()=>{let live=true;api.get('/contact-directory/preferences').then(({data})=>{if(live)setForm(data)}).catch(e=>{if(live)setError(e.response?.data?.message||'No se pudieron cargar las preferencias.')}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[]);
  const toggle=(field,role,checked)=>setForm(prev=>({...prev,[field]:checked?[...prev[field],role]:prev[field].filter(r=>r!==role)}));
  const submit=async e=>{e.preventDefault();setSaving(true);setError('');setSuccess('');try{const {data}=await api.put('/contact-directory/preferences',{
    contactEmail:form.contactEmail,contactPhone:form.contactPhone,emailVisibleTo:form.emailVisibleTo,phoneVisibleTo:form.phoneVisibleTo
  });setForm(data);setSuccess('Tus preferencias de privacidad se guardaron correctamente.')}catch(err){setError(err.response?.data?.message||'No se pudo guardar.')}finally{setSaving(false)}};
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm sm:p-7">
    <div className="mb-4 flex items-center gap-3"><div className="rounded-xl bg-red-50 p-3 text-[#C61515]"><ShieldCheck size={22}/></div><div><h2 className="text-lg font-bold">Privacidad y contacto</h2><p className="text-sm text-slate-500">Elegí qué datos pueden ver otros usuarios del instituto.</p></div></div>
    <div className="mb-5 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><LockKeyhole size={18} className="shrink-0"/><p>Tu correo y teléfono están <strong>ocultos por defecto</strong>. Compartirlos es voluntario y revocable. Los permisos de la aplicación no dependen de esta configuración.</p></div>
    {loading?<p className="text-sm text-slate-500">Cargando preferencias...</p>:<form onSubmit={submit} className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-2">
        {[
          {valueKey:'contactEmail', visibleKey:'emailVisibleTo', label:'Correo electrónico que quiero compartir',
           placeholder:form.email||'contacto@instituto.edu.ar', Icon:Mail, type:'email', maxLength:200,
           help:'Por defecto se utiliza tu correo registrado; podés utilizar uno diferente sin cambiar tu acceso.'},
          {valueKey:'contactPhone', visibleKey:'phoneVisibleTo', label:'Teléfono móvil que quiero compartir',
           placeholder:'Ej.: +54 9 221 ...', Icon:Phone, type:'tel', maxLength:35,
           help:'Por defecto se utiliza el teléfono registrado. Podés compartir otro o dejarlo vacío.'},
        ].map(({valueKey,visibleKey,label,placeholder,Icon,type,maxLength,help}) => (
          <fieldset key={valueKey} className="min-w-0 space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
            <legend className="px-2 text-sm font-bold text-slate-900">
              <span className="inline-flex items-center gap-2"><Icon size={17} className="text-[#C61515]" />{label}</span>
            </legend>
            <input type={type} value={form[valueKey]||''} maxLength={maxLength}
              onChange={e=>setForm(f=>({...f,[valueKey]:e.target.value}))} placeholder={placeholder}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#C61515]"/>
            <p className="text-xs leading-5 text-slate-600">{help}</p>
            <div className="border-t border-slate-200 pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-700">¿Quién puede ver este dato?</p>
              <div className="space-y-2">
                {ROLES.filter(role=>!(isStudentOnly&&role.id==='STUDENT')).map(role=>(
                  <label key={role.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-slate-800 hover:bg-white">
                    <input type="checkbox" checked={(form[visibleKey]||[]).includes(role.id)}
                      onChange={e=>toggle(visibleKey,role.id,e.target.checked)} className="h-4 w-4 accent-[#C61515]"/>
                    <span>{role.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </fieldset>
        ))}
      </div>
      <p className="flex items-start gap-2 text-xs text-slate-600"><Info size={16} className="shrink-0"/>Para cambiar el teléfono guardado, utilizá la sección Datos personales de este perfil. Ocultar un dato no impide que la plataforma lo utilice para gestionar tu cuenta. Los alumnos nunca pueden consultar fichas de otros alumnos.</p>
      {error&&<p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {success&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
      <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#C61515] px-5 py-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"><Save size={17}/>{saving?'Guardando...':'Guardar preferencias'}</button>
    </form>}
  </section>;
}
