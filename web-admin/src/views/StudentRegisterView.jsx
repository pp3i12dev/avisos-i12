import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ShieldCheck, UserPlus, LoaderCircle } from 'lucide-react';
import api from '../api/axios';
import logo from '../assets/images/i12-logo.png';
import PreceptorCoveragePicker from '../components/PreceptorCoveragePicker';

const common = 'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-[#C61515] focus:ring-2 focus:ring-rose-100';
const initial = { role: 'STUDENT', institutionId: '', firstName: '', lastName: '', dni: '', email: '', telefono: '', password: '', repeatPassword: '', legajo: '', specialty: '', shift: '', position: '', coverages: [] };
const TYPES = [{ value: 'STUDENT', label: 'Alumno' }, { value: 'TEACHER', label: 'Docente' }, { value: 'PRECEPTOR', label: 'Preceptor' }, { value: 'DIRECTOR', label: 'Directivo' }];
function Field({ title, required = true, type = 'text', ...props }) {
  return <label className="block space-y-1.5 text-sm font-semibold text-slate-700">{title}
    <input {...props} type={type} required={required} className={common} />
  </label>;
}

export default function StudentRegisterView() {
  const [v, setV] = useState(initial);
  const [institutions, setInstitutions] = useState([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [registered, setRegistered] = useState(null);
  const update = e => { setV(prev => ({ ...prev, [e.target.name]: e.target.value, ...(e.target.name === 'institutionId' ? { coverages: [] } : {}) })); setError(''); };
  useEffect(() => { let active = true;
    api.get('/public/institutions').then(({ data }) => { if (active) setInstitutions(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setError('No pudimos cargar las instituciones disponibles.'); });
    return () => { active = false; };
  }, []);
  const submit = async e => {
    e.preventDefault(); setError('');
    if (!v.institutionId) return setError('Seleccioná una institución.');
    if (v.password !== v.repeatPassword) return setError('Las contraseñas no coinciden.');
    setWorking(true);
    try {
      const { repeatPassword, ...payload } = v;
      const endpoint = v.role === 'STUDENT' ? '/auth/register-student' : '/auth/register-staff';
      const { data } = await api.post(endpoint, { ...payload, institutionId: Number(v.institutionId) });
      setRegistered(data);
    } catch (err) { setError(err.response?.data?.message || 'No se pudo crear la cuenta. Revisá tus datos.'); }
    finally { setWorking(false); }
  };
  return <main className="min-h-screen bg-[#F5F6F8] px-4 py-9 text-slate-900">
    <div className="mx-auto max-w-3xl">
      <Link to="/login" className="mb-5 inline-flex items-center gap-2 font-semibold text-[#C61515]"><ArrowLeft size={18}/> Volver al inicio de sesión</Link>
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <div className="h-1.5 bg-[#C61515]"/>
        <div className="p-6 sm:p-9">
          <header className="mb-7 flex items-center gap-4 border-b border-slate-100 pb-6">
            <img src={logo} alt="ISFT Nº12" className="h-16 w-16 rounded-full object-contain"/>
            <div><p className="text-xs font-bold uppercase tracking-widest text-[#C61515]">Avisos I12</p><h1 className="text-2xl font-extrabold">Crear cuenta</h1>
              <p className="text-sm text-slate-600">Acceso a comunicaciones del instituto, sin inscripción académica oficial.</p></div>
          </header>
          {registered ? <div role="status" className={`space-y-4 rounded-xl border p-6 ${registered.verificationEmailSent ? 'border-emerald-200 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`} >
            <CheckCircle2 className={registered.verificationEmailSent ? 'text-emerald-700' : 'text-amber-700'} size={34}/><h2 className="text-xl font-bold text-slate-900">{registered.verificationEmailSent ? 'Cuenta creada · Revisá tu correo' : 'Cuenta creada · Falta enviar el correo'}</h2>
            <p className="text-sm leading-6 text-emerald-900">{registered.message}</p>
            <p className="text-sm text-slate-700">{v.role === 'STUDENT' ? 'Una vez verificado el correo, podrás usar la plataforma sin esperar aprobación.' : 'El personal registrado por cuenta propia requiere autorización institucional. Mediante invitación, el acceso es inmediato.'}</p>
            <Link to="/login" className="inline-flex rounded-xl bg-[#C61515] px-5 py-3 font-bold text-white">Ir al login</Link>
            {!registered.verificationEmailSent && <Link to="/verificar-correo" state={{email:v.email}} className="ml-3 inline-flex text-sm font-semibold text-red-700 underline">Solicitar nuevo enlace cuando el correo institucional esté habilitado</Link>}
          </div> : <form onSubmit={submit} className="space-y-6">
            <div className="space-y-2"><label className="text-sm font-bold text-slate-800">¿Qué función desempeñás?</label>
              <select className={common} name="role" value={v.role} onChange={update}>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select></div>
            <div className="space-y-2"><label className="text-sm font-bold text-slate-800">Institución</label>
              <select name="institutionId" value={v.institutionId} onChange={update} className={common} required><option value="">Seleccioná tu institución</option>
                {institutions.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
              </select></div>
            {v.role !== 'STUDENT' && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <ShieldCheck className="mb-1 inline-block" size={18}/> El personal que se registra por su cuenta no obtiene permisos inmediatamente. Dirección o preceptoría deberán verificar y aprobar su función. Para directivos, la aprobación corresponde a dirección o superadministración.
            </div>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field title="Nombre" name="firstName" value={v.firstName} onChange={update} maxLength={100} autoComplete="given-name"/>
              <Field title="Apellido" name="lastName" value={v.lastName} onChange={update} maxLength={100} autoComplete="family-name"/>
              <Field title="DNI" name="dni" value={v.dni} onChange={update} inputMode="numeric" pattern="[0-9]{7,9}" maxLength={9}/>
              <Field title="Teléfono móvil (opcional)" name="telefono" value={v.telefono} onChange={update} type="tel" required={false} maxLength={35}/>
            </div>
            {v.role !== 'STUDENT' && <div className="grid gap-4 sm:grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              {v.role !== 'DIRECTOR' && <Field title="Legajo (opcional)" name="legajo" value={v.legajo} onChange={update} maxLength={80} required={false}/>}
              {v.role === 'TEACHER' && <Field title="Especialidad (opcional)" name="specialty" value={v.specialty} onChange={update} required={false} maxLength={200}/>}
              {v.role === 'DIRECTOR' && <Field title="Cargo (opcional)" name="position" value={v.position} onChange={update} required={false} maxLength={120}/>}

            </div>}
            {v.role === 'PRECEPTOR' && <PreceptorCoveragePicker institutionId={v.institutionId} value={v.coverages} onChange={coverages => setV(prev => ({ ...prev, coverages }))} disabled={working} />}
            <Field title="Correo electrónico" name="email" type="email" value={v.email} onChange={update} maxLength={200} autoComplete="email"/>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field title="Contraseña" name="password" type="password" value={v.password} onChange={update} minLength={8} maxLength={128} autoComplete="new-password"/>
              <Field title="Repetir contraseña" name="repeatPassword" type="password" value={v.repeatPassword} onChange={update} minLength={8} autoComplete="new-password"/>
            </div>
            <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-slate-700">{v.role === 'STUDENT'
              ? 'Después de verificar tu correo, podrás suscribirte libremente a avisos de distintas materias, carreras y años. No estarás inscripto oficialmente para cursarlas.'
              : 'Si recibiste una invitación, usá el enlace de ese correo: la cuenta institucional invitada no requiere otra aprobación.'}</p>
            {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
            <button disabled={working} type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C61515] px-5 py-3.5 font-bold text-white hover:bg-red-800 disabled:opacity-50">
              {working ? <LoaderCircle size={18} className="animate-spin"/> : <UserPlus size={18}/>} Crear cuenta
            </button>
          </form>}
        </div>
      </div>
    </div>
  </main>;
}
