import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import { CheckCircle2, LoaderCircle, MailCheck, AlertCircle } from 'lucide-react';
import api from '../api/axios';

export default function EmailVerificationView() {
  const [params] = useSearchParams();
  const location = useLocation();
  const token = params.get('token');
  const ran = useRef(false);
  const [status, setStatus] = useState(token ? 'loading' : 'resend');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(location.state?.email || '');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    api.post('/auth/verify-email', { token }).then(({ data }) => { setStatus('success'); setMessage(data.message); })
      .catch(e => { setStatus('error'); setMessage(e.response?.data?.message || 'No fue posible verificar el correo.'); });
  }, [token]);
  const resend = async e => { e.preventDefault(); setBusy(true); setMessage('');
    try { const { data } = await api.post('/auth/resend-verification', { email }); setMessage(data.message); }
    catch (err) { setMessage(err.response?.data?.message || 'No se pudo enviar el correo.'); }
    finally { setBusy(false); }
  };
  return <main className="flex min-h-screen items-center justify-center bg-[#F5F6F8] p-4 text-slate-900">
    <div className="w-full max-w-lg space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
      <div className="h-1 rounded bg-[#C61515]"/>
      {status === 'loading' ? <LoaderCircle size={34} className="animate-spin text-[#C61515]"/> : status === 'success' ? <CheckCircle2 size={34} className="text-emerald-600"/> : status === 'error' ? <AlertCircle size={34} className="text-rose-600"/> : <MailCheck size={34} className="text-[#C61515]"/>}
      <h1 className="text-2xl font-bold">{status === 'loading' ? 'Verificando correo...' : status === 'success' ? 'Correo verificado' : status === 'error' ? 'No pudimos verificar el enlace' : 'Reenviar verificación'}</h1>
      {message && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700" role="status">{message}</p>}
      {status !== 'success' && status !== 'loading' && <form onSubmit={resend} className="space-y-3">
        <label className="block text-sm font-semibold">Correo usado al registrarte
          <input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900" placeholder="correo@ejemplo.com"/>
        </label>
        <button disabled={busy} className="w-full rounded-xl bg-[#C61515] px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Enviando...' : 'Solicitar enlace nuevo'}</button>
      </form>}
      <Link to="/login" className="inline-flex rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-[#C61515]">Volver al inicio de sesión</Link>
    </div>
  </main>;
}
