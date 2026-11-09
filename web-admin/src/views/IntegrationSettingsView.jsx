import { useContext, useEffect, useState } from 'react';
import { Settings2, Mail, BellRing, FlaskConical, Save, History, Eye, EyeOff, AlertTriangle, RefreshCw } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import api from '../api/axios';
import WebPushSettings from '../components/WebPushSettings';

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#C61515]';
const cardClass = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6';
const actions = {SMTP_UPDATED:'Correo SMTP actualizado',PUSH_ENABLED:'Web Push habilitado',PUSH_DISABLED:'Web Push deshabilitado',VAPID_GENERATED:'Claves VAPID generadas',VAPID_IMPORTED:'Claves VAPID heredadas del servidor',VAPID_REGENERATED:'Claves VAPID regeneradas',CRYPTO_MIGRATED:'Credenciales anteriores recifradas'};
const resetPhrase = 'REGENERAR VAPID Y ANULAR TODAS LAS SUSCRIPCIONES';
const getMessage = e => {
  const status = e?.response?.status;
  if (status === 401) return 'La sesión venció. Volvé a iniciar sesión.';
  if (status === 403) return 'Tu cuenta no tiene permisos para gestionar esta institución.';
  if (status >= 500) return 'No se pudo completar la operación. Verificá que el servidor esté disponible.';
  const detail = e?.response?.data?.message;
  if (/jwt|secret|cifrad|clave maestra|hosting|env|descifrar/i.test(detail || '')) {
    return 'No se pudo usar la configuración anterior. Podés reemplazar la credencial desde este panel.';
  }
  return detail || 'No se pudo guardar la configuración.';
};

export default function IntegrationSettingsView() {
  const { user } = useContext(AuthContext);
  const roles = user?.roles || [];
  const isSuper = user?.isSuperAdmin || roles.includes('SUPER_ADMIN');
  const authorized = isSuper || roles.includes('DIRECTOR');
  const [institutionId, setInstitutionId] = useState(user?.institutionId ? String(user.institutionId) : '');
  const [institutions, setInstitutions] = useState([]);
  const [state, setState] = useState(null);
  const [draft, setDraft] = useState({ smtp: { enabled:false, user:'', password:'' }, push:{enabled:false} });
  const [originalPassword, setOriginalPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [secretWarning, setSecretWarning] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPrivate, setShowPrivate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (!authorized) return;
    let live = true;
    api.get('/institutions').then(({ data }) => {
      if (!live) return;
      const all = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      setInstitutions(all.filter(x => x.isActive !== false));
    }).catch(() => {});
    return () => { live = false; };
  }, [authorized]);

  // El GET de secretos está separado y protegido por JWT + autorización del backend.
  // No se almacenan en localStorage ni se incluyen en URLs ni registros de auditoría.
  const load = async (id, withSpinner = true) => {
    if (withSpinner) setLoading(true);
    try {
      const params = id ? { institutionId:id } : {};
      const [{ data }, secretResult] = await Promise.all([
        api.get('/integrations', { params }),
        api.get('/integrations/secrets', { params, headers:{'Cache-Control':'no-store'} }).catch(() => null),
      ]);
      const secret = secretResult?.data;
      const password = secret?.smtpPassword || '';
      setState(data);
      setDraft({ smtp:{ enabled:data.smtp.enabled, user:data.smtp.user, password }, push:{ enabled:data.push.enabled } });
      setOriginalPassword(password);
      setPrivateKey(secret?.vapidPrivateKey || '');
      const warnings = [];
      if (!secretResult) warnings.push('No se pudieron recuperar las claves guardadas. Podés volver a ingresarlas.');
      if (secret && !secret.smtpRecoverable) warnings.push('La contraseña de correo anterior no puede mostrarse. Ingresá una nueva para reemplazarla.');
      if (secret && !secret.vapidRecoverable) warnings.push('Las claves Push anteriores no pueden recuperarse. Podés regenerarlas desde aquí.');
      setSecretWarning(warnings.join(' '));
      if (data.institutions?.length) setInstitutions(data.institutions);
    } catch (e) { setError(getMessage(e)); }
    finally { if (withSpinner) setLoading(false); }
  };
  useEffect(() => {
    if (!authorized) return;
    if (isSuper && !institutionId) { setLoading(false); setState(null); return; }
    let live = true;
    setLoading(true); setError(''); setMessage('');
    const params = institutionId ? { institutionId } : {};
    Promise.all([
      api.get('/integrations', { params }),
      api.get('/integrations/secrets', { params, headers:{'Cache-Control':'no-store'} }).catch(() => null),
    ]).then(([{data}, secretResult]) => {
      if (!live) return;
      const secret = secretResult?.data;
      const password = secret?.smtpPassword || '';
      setState(data);
      setDraft({ smtp:{ enabled:data.smtp.enabled, user:data.smtp.user, password }, push:{enabled:data.push.enabled} });
      setOriginalPassword(password);
      setPrivateKey(secret?.vapidPrivateKey || '');
      setSecretWarning(secretResult ? [!secret?.smtpRecoverable ? 'La contraseña anterior no se puede recuperar. Podés reemplazarla.':'', !secret?.vapidRecoverable ? 'La clave Push anterior no se puede recuperar. Podés regenerarla.':''].filter(Boolean).join(' ') : 'No se pudieron leer las claves anteriores. Podés volver a guardarlas.');
      if (data.institutions?.length) setInstitutions(data.institutions);
    }).catch(e => { if (live) setError(getMessage(e)); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [authorized, isSuper, institutionId]);

  const setField = (section, field, value) => setDraft(old => ({ ...old, [section]:{...old[section],[field]:value} }));
  const act = async operation => {
    setBusy(true); setError(''); setMessage('');
    try {
      await operation();
      await load(institutionId, false);
      setMessage('Configuración guardada. Seguirá activa aunque cierres sesión.');
    } catch (e) { setError(getMessage(e)); }
    finally { setBusy(false); }
  };
  const saveSmtp = () => act(() => api.put('/integrations', {
    institutionId,
    smtp: { enabled:draft.smtp.enabled, user:draft.smtp.user,
      // Evitar volver a escribir innecesariamente un secreto sin cambios.
      password: draft.smtp.password !== originalPassword ? draft.smtp.password : '' },
  }));
  const savePush = () => act(() => api.put('/integrations', { institutionId, push:draft.push }));
  const generate = () => {
    if (state?.push?.keyConfigured && !resetOpen) { setResetOpen(true); return; }
    return act(async () => {
      await api.post('/integrations/push/generate', { institutionId, confirmation:resetOpen ? typed : undefined });
      setResetOpen(false); setTyped('');
    });
  };

  if (!authorized) return <p className="p-8 text-rose-700">Solo dirección y superadministración pueden acceder a Configuración.</p>;
  return <div className="mx-auto w-full max-w-6xl space-y-6 pb-10 text-slate-900">
    <header className="flex items-center gap-3"><span className="rounded-xl bg-rose-50 p-3 text-[#C61515]"><Settings2 size={30}/></span><div><h1 className="text-2xl font-bold">Configuración institucional</h1><p className="text-sm text-slate-600">Correo institucional y notificaciones Web Push. Las opciones están disponibles para tu rol.</p></div></header>
    {isSuper && <section className={cardClass}><label htmlFor="integration-institution" className="text-sm font-semibold">Institución</label><select id="integration-institution" className={`${inputClass} mt-2`} value={institutionId} onChange={e=>setInstitutionId(e.target.value)}><option value="">Seleccioná una institución</option>{institutions.map(i=><option key={i.id} value={i.id}>{i.nombre}</option>)}</select></section>}
    {error && <p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
    {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
    {secretWarning && <p className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle size={18} className="shrink-0"/>{secretWarning}</p>}
    {loading ? <p>Cargando configuración...</p> : state && <>
      <section className={cardClass}>
        <h2 className="mb-3 flex items-center gap-2 text-xl font-bold"><Mail className="text-[#C61515]"/>Correo Google (SMTP)</h2>
        <p className="mb-4 text-sm text-slate-600">Servidor: smtp.gmail.com · Puerto 587. Usá tu contraseña de aplicación de Google.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold">Correo remitente<input className={`${inputClass} mt-1`} type="email" value={draft.smtp.user} onChange={e=>setField('smtp','user',e.target.value)} autoComplete="off" placeholder="correo@gmail.com" /></label>
          <label className="text-sm font-semibold">Contraseña de aplicación
            <div className="relative mt-1"><input className={`${inputClass} pr-12`} type={showPassword?'text':'password'} autoComplete="off" value={draft.smtp.password} onChange={e=>setField('smtp','password',e.target.value)} placeholder="Ingresá tu contraseña de aplicación" />
              <button type="button" onClick={()=>setShowPassword(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label={showPassword?'Ocultar contraseña':'Mostrar contraseña'}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button>
            </div>
          </label>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="accent-[#C61515]" checked={draft.smtp.enabled} onChange={e=>setField('smtp','enabled',e.target.checked)}/>Activar correo SMTP institucional</label>
        <div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} onClick={saveSmtp} className="rounded-xl bg-[#C61515] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save size={16} className="mr-2 inline"/>Guardar SMTP</button><button disabled={busy || !state.smtp.enabled} onClick={()=>act(()=>api.post('/integrations/mail/test',{institutionId}))} className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm disabled:opacity-50"><FlaskConical size={16} className="mr-2 inline"/>Probar correo</button></div>
      </section>
      <section className={cardClass}>
        <h2 className="mb-3 flex items-center gap-2 text-xl font-bold"><BellRing className="text-[#C61515]"/>Notificaciones Web Push</h2>
        <p className="mb-4 text-sm text-slate-600">Las claves y su activación se conservan en la base de datos, incluso si cerrás sesión. Push no requiere configurar ningún correo adicional.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold">Clave pública<input className={`${inputClass} mt-1 font-mono text-xs`} readOnly value={state.push.publicKey||''} placeholder="Aún no generada" /></label>
          <label className="text-sm font-semibold">Clave privada
            <div className="relative mt-1"><input className={`${inputClass} pr-12 font-mono text-xs`} type={showPrivate?'text':'password'} readOnly autoComplete="off" value={privateKey} placeholder="Aún no generada" />
              <button type="button" onClick={()=>setShowPrivate(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label={showPrivate?'Ocultar clave privada':'Mostrar clave privada'}>{showPrivate?<EyeOff size={18}/>:<Eye size={18}/>}</button>
            </div>
          </label>
        </div>
        {state.push.keyConfigured && <label className="mt-4 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={draft.push.enabled} onChange={e=>setField('push','enabled',e.target.checked)} className="accent-[#C61515]"/>Activar Web Push para esta institución</label>}
        <div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} onClick={generate} className="rounded-xl border border-rose-400 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-800 disabled:opacity-50">{state.push.keyConfigured?'Regenerar claves VAPID':'Generar y activar VAPID'}</button>{state.push.keyConfigured && <button disabled={busy} onClick={savePush} className="rounded-xl bg-[#C61515] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">Guardar activación Push</button>}</div>
        <div className="mt-5"><WebPushSettings/></div>
      </section>
      <section className={cardClass}><h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><History className="text-[#C61515]"/>Historial de configuración</h2><div className="space-y-2">{!state.history.length && <p className="text-sm text-slate-500">Todavía no hay cambios registrados.</p>}{state.history.map(row=><div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"><div><p className="font-semibold">{actions[row.action]||row.action}</p><p className="text-xs text-slate-600">{row.actorName} · {row.actorRole} · ID {row.actorId}</p></div><time className="text-xs text-slate-600">{new Date(row.createdAt).toLocaleString('es-AR',{dateStyle:'short',timeStyle:'medium',timeZone:'America/Argentina/Buenos_Aires'})}</time></div>)}</div></section>
    </>}
    {resetOpen && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 p-4"><div role="dialog" aria-modal="true" aria-labelledby="vapid-reset-title" className="w-full max-w-xl space-y-4 rounded-2xl bg-white p-6 shadow-2xl"><h2 id="vapid-reset-title" className="text-xl font-bold text-rose-800">Regenerar VAPID</h2><p className="text-sm text-slate-700">Esta acción invalidará todas las suscripciones Push actuales. Los usuarios deberán volver a activarlas. Para confirmar, escribí:</p><p className="text-sm font-bold text-rose-800">{resetPhrase}</p><input className={inputClass} value={typed} onChange={e=>setTyped(e.target.value)}/><div className="flex justify-end gap-2"><button onClick={()=>{setResetOpen(false);setTyped('');}} className="rounded-lg border px-4 py-2">Cancelar</button><button onClick={generate} disabled={typed!==resetPhrase||busy} className="rounded-lg bg-[#C61515] px-4 py-2 text-white disabled:opacity-40">Confirmar regeneración</button></div></div></div>}
  </div>;
}
