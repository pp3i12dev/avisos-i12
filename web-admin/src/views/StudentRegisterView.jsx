import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, ChevronLeft, LoaderCircle, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import api from '../api/axios';
import logo from '../assets/images/i12-logo.png';
import { courseLabel } from '../utils/courseShift';

const initial = { institutionId: '', careerId: '', courseId: '', firstName: '', lastName: '', dni: '', email: '', telefono: '', password: '', repeatPassword: '' };
const fieldClass = 'mt-2 block w-full min-w-0 rounded-xl border border-slate-300 bg-[#F5F6F8] px-3.5 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-[#C61515] focus:ring-2 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60';
const labelClass = 'block min-w-0 text-sm font-semibold text-slate-700';
function Field({ name, label, type = 'text', value, onChange, required = true, autoComplete, ...props }) {
  return <label className={labelClass}>{label}
    <input className={fieldClass} name={name} type={type} value={value} onChange={onChange}
      required={required} autoComplete={autoComplete} {...props}/>
  </label>;
}
export default function StudentRegisterView() {
  const [values, setValues] = useState(initial);
  const [institutions, setInstitutions] = useState([]);
  const [careers, setCareers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [success, setSuccess] = useState(false);
  const field = event => { setValues(v => ({ ...v, [event.target.name]: event.target.value })); setError(''); };
  useEffect(() => {
    let active = true;
    api.get('/public/institutions').then(({ data }) => { if (active) setInstitutions(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setLoadError('No se pudo obtener la lista de instituciones.'); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    setCareers([]); setCourses([]);
    setValues(v => ({ ...v, careerId: '', courseId: '' }));
    if (!values.institutionId) return undefined;
    let active = true;
    api.get(`/public/institutions/${values.institutionId}/careers`)
      .then(({ data }) => { if (active) setCareers(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setLoadError('No se pudieron consultar las carreras.'); });
    return () => { active = false; };
  }, [values.institutionId]);
  useEffect(() => {
    setCourses([]); setValues(v => ({ ...v, courseId: '' }));
    if (!values.institutionId || !values.careerId) return undefined;
    let active = true;
    api.get(`/public/institutions/${values.institutionId}/courses`, { params: { careerId: values.careerId } })
      .then(({ data }) => { if (active) setCourses(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setLoadError('No se pudieron cargar los cursos.'); });
    return () => { active = false; };
  }, [values.institutionId, values.careerId]);

  async function onSubmit(event) {
    event.preventDefault(); setError('');
    if (!values.institutionId || !values.careerId || !values.courseId) return setError('Seleccioná institución, carrera y curso.');
    if (values.password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (values.password !== values.repeatPassword) return setError('Las contraseñas no coinciden.');
    setWorking(true);
    try {
      const { repeatPassword, ...payload } = values;
      await api.post('/auth/register-student', {
        ...payload,
        institutionId: Number(values.institutionId), courseId: Number(values.courseId),
        careerId: values.careerId === 'none' ? null : Number(values.careerId),
      });
      setSuccess(true);
    } catch (e) { setError(e.response?.data?.message || 'No pudimos completar el registro. Revisá tus datos.'); }
    finally { setWorking(false); }
  }

  return <main className="min-h-[100dvh] bg-[#F5F6F8] px-4 py-8 text-slate-900 sm:py-12">
    <div className="mx-auto w-full max-w-3xl">
      <Link to="/login" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#C61515] hover:underline"><ChevronLeft size={18}/> Volver al inicio de sesión</Link>
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_rgba(25,35,50,.08)]">
        <div className="h-1.5 bg-[#C61515]"/>
        <div className="p-5 sm:p-9">
          <div className="flex flex-col items-center gap-4 border-b border-slate-100 pb-6 text-center sm:flex-row sm:text-left">
            <img src={logo} alt="Logotipo del Instituto Superior de Formación Técnica Nº12" className="h-16 w-16 shrink-0 rounded-full object-contain"/>
            <div><p className="mb-1 text-xs font-bold uppercase tracking-[.16em] text-[#C61515]">Avisos I12 · Inscripción</p>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Registro de alumnos</h1>
              <p className="mt-1 text-sm leading-6 text-slate-600">Completá tus datos académicos y personales para solicitar una cuenta. Tu inscripción será revisada por dirección o preceptoría.</p>
            </div>
          </div>
          {success ? <div role="status" className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
            <CheckCircle2 size={34} className="mb-3 text-emerald-700"/>
            <h2 className="text-xl font-bold">¡Solicitud registrada correctamente!</h2>
            <p className="mt-2 text-sm leading-7">Tu cuenta está <strong>pendiente de aprobación institucional</strong>. Cuando dirección o preceptoría la apruebe, podrás iniciar sesión en Avisos I12.</p>
            <p className="mt-2 text-sm leading-7">Después de ingresar, podrás activar voluntariamente las notificaciones de tu dispositivo. No es necesario instalar Unity ni ninguna otra aplicación.</p>
            <Link to="/login" className="mt-5 inline-flex rounded-xl bg-[#C61515] px-5 py-3 font-semibold text-white hover:bg-[#a91010]">Volver a iniciar sesión</Link>
          </div> : <form className="mt-7 space-y-7" onSubmit={onSubmit}>
            <fieldset className="space-y-4"><legend className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900"><GraduationCap size={20} className="text-[#C61515]"/> 1. Datos académicos</legend>
              <label className={labelClass}>Institución
                <select name="institutionId" className={fieldClass} value={values.institutionId} onChange={field} required>
                  <option value="">Seleccioná la institución</option>{institutions.map(i => <option value={i.id} key={i.id}>{i.nombre}</option>)}
                </select></label>
              <label className={labelClass}>Nivel educativo o carrera
                <select name="careerId" className={fieldClass} value={values.careerId} onChange={field} disabled={!values.institutionId} required>
                  <option value="">Seleccioná una carrera</option>{careers.map(c => <option value={c.id} key={c.id}>{c.nombre}</option>)}
                  <option value="none">Cursos generales (sin carrera asignada)</option>
                </select></label>
              <label className={labelClass}>Curso
                <select name="courseId" className={fieldClass} value={values.courseId} onChange={field} disabled={!values.careerId} required>
                  <option value="">Seleccioná tu curso</option>{courses.map(c => <option value={c.id} key={c.id}>{courseLabel(c)}</option>)}
                </select></label>
              <p className="text-xs text-slate-600">El turno se obtiene del curso seleccionado; no necesitás indicarlo por separado.</p>
            </fieldset>
            <fieldset className="space-y-4 border-t border-slate-100 pt-6"><legend className="mb-4 text-lg font-bold text-slate-900">2. Datos personales</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field name="firstName" label="Nombre" value={values.firstName} onChange={field} autoComplete="given-name" maxLength={100}/>
                <Field name="lastName" label="Apellido" value={values.lastName} onChange={field} autoComplete="family-name" maxLength={100}/>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field name="dni" label="DNI" value={values.dni} onChange={field} inputMode="numeric" maxLength={12}/>
                <Field name="telefono" label="Teléfono (opcional)" type="tel" required={false} value={values.telefono} onChange={field} autoComplete="tel" maxLength={30}/>
              </div>
              <Field name="email" label="Correo electrónico" type="email" value={values.email} onChange={field} autoComplete="email" maxLength={200}/>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field name="password" label="Contraseña" type="password" value={values.password} onChange={field} autoComplete="new-password" minLength={8}/>
                <Field name="repeatPassword" label="Repetí la contraseña" type="password" value={values.repeatPassword} onChange={field} autoComplete="new-password" minLength={8}/>
              </div>
            </fieldset>
            <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-[#FFF5F5] p-4 text-sm text-slate-700">
              <ShieldCheck className="mt-0.5 shrink-0 text-[#C61515]" size={20}/>
              <div><p className="font-bold text-slate-900">Sobre la aprobación y las notificaciones</p>
                <p className="mt-1 leading-6">Solo las inscripciones públicas de alumnos requieren aprobación. Los docentes, directivos y preceptores acceden mediante cuentas creadas o invitadas por personal autorizado.</p>
                <p className="mt-2 leading-6">Podrás activar las notificaciones después de iniciar sesión. Si sos menor de edad, completá el registro con la asistencia de una persona adulta responsable.</p>
              </div>
            </div>
            {(error || loadError) && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertTriangle size={18} className="shrink-0"/>{error || loadError}</div>}
            <button type="submit" disabled={working} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C61515] px-4 py-3.5 font-bold text-white transition hover:bg-[#AA1111] disabled:cursor-not-allowed disabled:opacity-50">{working && <LoaderCircle size={18} className="animate-spin"/>} Solicitar inscripción</button>
          </form>}
        </div>
      </div>
      <p className="mt-5 text-center text-xs text-slate-500">Instituto Superior de Formación Técnica Nº12 · Sistema de avisos institucionales</p>
    </div>
  </main>;
}
