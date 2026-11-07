import { useEffect, useState } from 'react';
import api from '../api/axios';

const SHIFT_OPTIONS = [
  { value: 'MANANA', label: 'Mañana' },
  { value: 'TARDE', label: 'Tarde' },
  { value: 'NOCHE', label: 'Noche' },
];
const field = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#C61515] focus:ring-2 focus:ring-red-100';
const nameOf = value => SHIFT_OPTIONS.find(x => x.value === value)?.label || value;

/** Una fila por combinación carrera + turno. Nunca asigna permisos ni matrículas. */
export default function PreceptorCoveragePicker({ institutionId, value = [], onChange, disabled = false }) {
  const [careers, setCareers] = useState([]);
  const [careerId, setCareerId] = useState('');
  const [shift, setShift] = useState('NOCHE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const id = Number(institutionId);
    setCareerId(''); setCareers([]); setError('');
    if (!Number.isSafeInteger(id) || id <= 0) return;
    let alive = true;
    setLoading(true);
    api.get(`/public/institutions/${id}/careers`)
      .then(({ data }) => { if (alive) setCareers(Array.isArray(data) ? data : (data?.careers || [])); })
      .catch(() => { if (alive) setError('No se pudieron obtener las carreras de esta institución.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [institutionId]);

  const add = () => {
    const id = Number(careerId);
    if (!careers.some(c => c.id === id)) return;
    if (value.some(x => Number(x.careerId) === id && x.shift === shift)) return;
    onChange([...value, { careerId: id, shift }]);
  };
  const getName = id => careers.find(c => c.id === Number(id))?.nombre || value.find(c => c.careerId === Number(id))?.career?.nombre || `Carrera ${id}`;

  return <fieldset disabled={disabled} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-900">
    <legend className="px-1 text-sm font-bold text-slate-800">Carreras y turnos a cargo</legend>
    <p className="text-xs leading-relaxed text-slate-600">Elegí cada combinación de carrera y turno que atiende este preceptor. Incluye todos los años de esa carrera en ese turno. Es información administrativa: no modifica permisos ni inscripciones oficiales.</p>
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(135px,0.55fr)_auto] sm:items-end">
      <label className="text-xs font-semibold text-slate-700">Carrera
        <select className={`mt-1 ${field}`} value={careerId} onChange={e => setCareerId(e.target.value)} disabled={!institutionId || loading} aria-label="Carrera del preceptor">
          <option value="">{loading ? 'Cargando carreras...' : 'Seleccionar carrera'}</option>
          {careers.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-700">Turno
        <select className={`mt-1 ${field}`} value={shift} onChange={e => setShift(e.target.value)} aria-label="Turno del preceptor">
          {SHIFT_OPTIONS.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
        </select>
      </label>
      <button type="button" disabled={!careerId || !institutionId || loading} onClick={add} className="rounded-xl bg-[#C61515] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Agregar</button>
    </div>
    {error && <p role="alert" className="text-xs font-semibold text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-2" aria-label="Coberturas seleccionadas">
      {!value.length && <span className="text-xs text-slate-500">Todavía no se asignaron carreras ni turnos.</span>}
      {value.map(row => <span key={`${row.careerId}-${row.shift}`} className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs text-slate-800">
        <span>{getName(row.careerId)} · {nameOf(row.shift)}</span>
        <button type="button" onClick={() => onChange(value.filter(x => !(Number(x.careerId)===Number(row.careerId) && x.shift===row.shift)))} aria-label={`Quitar ${getName(row.careerId)} ${nameOf(row.shift)}`} className="font-bold text-red-700 hover:text-red-900">×</button>
      </span>)}
    </div>
  </fieldset>;
}
