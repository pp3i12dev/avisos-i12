import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, LoaderCircle, MailCheck, ShieldCheck, UserPlus } from 'lucide-react';
import api from '../api/axios';
import logo from '../assets/images/i12-logo.png';
import PreceptorCoveragePicker from '../components/PreceptorCoveragePicker';

const ROLE_LABELS = {
  DIRECTOR: 'Directivo/a',
  PRECEPTOR: 'Preceptor/a',
  TEACHER: 'Docente',
  STUDENT: 'Alumno/a',
};
const empty = {
  firstName: '', lastName: '', dni: '', telefono: '', password: '', repeatPassword: '',
  legajo: '', specialty: '', shift: '', position: '', careerId: '', courseId: '', coverages: [],
};
const fieldStyle = 'mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-[#C61515] focus:ring-2 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100';

function Input({ label, name, value, onChange, type = 'text', required = true, ...rest }) {
  return <label className="block text-sm font-medium text-slate-700">
    {label}{required && <span className="ml-1 text-red-600">*</span>}
    <input className={fieldStyle} type={type} name={name} value={value} onChange={onChange} required={required} {...rest} />
  </label>;
}
function MessageScreen({ title, children, success = false }) {
  return <div className="min-h-screen bg-[#F7F7F8] px-4 py-10 flex items-center justify-center">
    <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-xl text-center">
      {success ? <CheckCircle2 className="mx-auto text-emerald-600" size={40} /> : <MailCheck className="mx-auto text-[#C61515]" size={40} />}
      <h1 className="mt-4 text-2xl font-bold text-slate-900">{title}</h1>
      <div className="mt-3 text-sm leading-6 text-slate-600">{children}</div>
      <Link to="/login" className="mt-6 inline-flex rounded-xl bg-[#C61515] px-5 py-3 font-semibold text-white hover:bg-red-800">Ir al inicio de sesión</Link>
    </div>
  </div>;
}

export default function AcceptInvitationView() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState(null);
  const [values, setValues] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get(`/invitations/${encodeURIComponent(token)}`)
      .then(({ data }) => {
        if (!alive) return;
        setInvitation(data);
      })
      .catch(e => { if (alive) setLoadError(e.response?.data?.message || 'No se pudo validar el enlace.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token]);

  const field = e => {
    const { name, value } = e.target;
    setError('');
    setValues(v => ({ ...v, [name]: value, ...(name === 'careerId' ? { courseId: '' } : {}) }));
  };
  const submit = async e => {
    e.preventDefault();
    setError('');
    if (values.password !== values.repeatPassword) return setError('Las contraseñas no coinciden.');
    if (values.password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    setSaving(true);
    try {
      const { repeatPassword, ...data } = values;
      await api.post(`/invitations/${encodeURIComponent(token)}/accept`, data);
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'No se pudo completar el registro.');
    } finally { setSaving(false); }
  };

  if (loading) return <MessageScreen title="Verificando invitación..."><LoaderCircle size={24} className="mx-auto animate-spin" /></MessageScreen>;
  if (loadError && !invitation) return <MessageScreen title="Invitación no disponible">{loadError}</MessageScreen>;
  if (done) return <MessageScreen title="¡Cuenta habilitada!" success>
    Completaste tu registro mediante una invitación institucional. Tu cuenta ya está activa y podés iniciar sesión sin esperar aprobación.
  </MessageScreen>;

  const student = invitation.role === 'STUDENT';
  return <main className="min-h-screen bg-[#F7F7F8] px-4 py-8 sm:py-12 text-slate-900">
    <div className="mx-auto w-full max-w-3xl">
      <button type="button" onClick={() => navigate('/login')} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#C61515] hover:underline"><ArrowLeft size={18} /> Volver al inicio de sesión</button>
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-200 bg-gradient-to-r from-white to-red-50 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-4">
            <img src={logo} alt="Logotipo del ISFT Nº12" className="h-16 w-16 rounded-full object-contain" />
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-widest text-[#C61515]">ISFT Nº12 · Invitación institucional</div>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">Completá tu registro</h1>
              <p className="mt-1 text-sm text-slate-600">{invitation.institution?.nombre || 'Instituto Superior de Formación Técnica Nº12'}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 font-semibold text-red-700">{ROLE_LABELS[invitation.role] || invitation.role}</span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600">{invitation.email}</span>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-7 p-6 sm:p-8">
          <section className="space-y-4">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><UserPlus size={20} className="text-[#C61515]" /> Datos personales</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Nombre" name="firstName" value={values.firstName} onChange={field} autoComplete="given-name" maxLength={100} />
              <Input label="Apellido" name="lastName" value={values.lastName} onChange={field} autoComplete="family-name" maxLength={100} />
              <Input label="DNI" name="dni" value={values.dni} onChange={field} inputMode="numeric" pattern="[0-9]{7,9}" maxLength={9} />
              <Input label="Teléfono móvil (opcional)" name="telefono" type="tel" value={values.telefono} onChange={field} autoComplete="tel" maxLength={35} required={false} />
              <Input label="Contraseña" name="password" type="password" value={values.password} onChange={field} autoComplete="new-password" minLength={8} />
              <Input label="Repetí la contraseña" name="repeatPassword" type="password" value={values.repeatPassword} onChange={field} autoComplete="new-password" minLength={8} />
            </div>
          </section>
          <section className="space-y-4 border-t border-slate-200 pt-6">
            <h2 className="text-base font-bold text-slate-900">Datos del perfil: {ROLE_LABELS[invitation.role] || invitation.role}</h2>
            <label className="block text-sm font-medium text-slate-700">Institución asignada
              <input className={fieldStyle} value={invitation.institution?.nombre || ''} disabled readOnly />
            </label>
            {invitation.role === 'DIRECTOR' && <Input label="Cargo (opcional)" name="position" value={values.position} onChange={field} required={false} placeholder="Ej.: Directora" maxLength={100} />}
            {invitation.role === 'PRECEPTOR' && <div className="space-y-4">
              <Input label="Legajo de preceptor (opcional)" name="legajo" value={values.legajo} onChange={field} maxLength={60} required={false} />
              <PreceptorCoveragePicker institutionId={invitation.institution?.id} value={values.coverages} onChange={coverages => setValues(prev => ({ ...prev, coverages }))} disabled={saving} />
            </div>}
            {invitation.role === 'TEACHER' && <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Legajo de docente (opcional)" name="legajo" value={values.legajo} onChange={field} maxLength={60} required={false} />
              <Input label="Especialidad (opcional)" name="specialty" value={values.specialty} onChange={field} required={false} maxLength={150} />
            </div>}
            {student && <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <Input label="Legajo de alumno (opcional)" name="legajo" value={values.legajo} onChange={field} required={false} placeholder="Podés completarlo más adelante en Mi perfil" />
              <p className="text-sm leading-6 text-slate-700">Al activar la cuenta podrás seguir avisos de materias de una o varias carreras, años y turnos. <strong>Suscribirte no te inscribe oficialmente a cursar.</strong></p>
              {invitation.course && <p className="text-xs text-slate-600">Curso de referencia indicado por quien te invitó: {invitation.course.nombre}. No limita tus futuras suscripciones.</p>}
            </div>}
          </section>
          <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-slate-700">
            <ShieldCheck size={19} className="shrink-0 text-[#C61515]" />
            <p>Esta invitación habilita tu cuenta inmediatamente al completar el registro. No necesitás esperar aprobación administrativa.</p>
          </div>
          {(error || loadError) && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error || loadError}</p>}
          <button disabled={saving} type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C61515] px-5 py-3.5 font-semibold text-white transition hover:bg-red-800 disabled:opacity-50">
            {saving && <LoaderCircle className="animate-spin" size={18} />} Activar mi cuenta
          </button>
        </form>
      </div>
    </div>
  </main>;
}
