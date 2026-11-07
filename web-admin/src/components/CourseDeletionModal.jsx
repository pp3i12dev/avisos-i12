import { useEffect, useState } from 'react';
import { courseAdminService } from '../services/courseAdmin.service';

export default function CourseDeletionModal({ course, onClose, onDelete, saving = false, serverError = '' }) {
  const [impact, setImpact] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [deleteStudentAccounts, setDeleteStudentAccounts] = useState(false);
  const [studentConfirmation, setStudentConfirmation] = useState('');
  useEffect(() => {
    if (!course) return undefined;
    let cancelled = false;
    setLoading(true); setImpact(null); setConfirmation(''); setDeleteStudentAccounts(false); setStudentConfirmation(''); setError('');
    courseAdminService.deletionPreview(course.id)
      .then(data => { if(!cancelled) setImpact(data); })
      .catch(e => { if(!cancelled) setError(e?.response?.data?.message || e.message || 'No se pudo consultar el curso.'); })
      .finally(() => { if(!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [course?.id]);
  if (!course) return null;
  const ready = !!impact && confirmation === 'ELIMINAR CURSO' && (!deleteStudentAccounts || (impact.canDeleteStudentAccounts && studentConfirmation === 'ELIMINAR ALUMNOS'));
  return <div role="presentation" className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
    <div role="dialog" aria-modal="true" aria-labelledby="delete-course-title" className="max-h-[90dvh] w-full max-w-xl overflow-auto rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl">
      <h2 id="delete-course-title" className="text-xl font-bold text-red-700">Eliminar curso definitivamente</h2>
      <p className="mt-2 text-sm text-slate-700"><strong>{course.nombre} · {course.academicYear}</strong>. Esta operación es irreversible.</p>
      {loading && <p className="mt-4 text-sm">Consultando relaciones...</p>}
      {impact && <div className="mt-4 rounded-xl border border-red-200 bg-rose-50 p-4 text-sm text-red-900">
        <p className="font-semibold">Se eliminarán las asociaciones vinculadas al curso:</p>
        <p className="mt-2">Matrículas: {impact.counts.students} · Avisos: {impact.counts.earlyNotices} · Docentes/materias: {impact.counts.teacherAssignments} · Horarios: {impact.counts.schedules} · Invitaciones: {impact.counts.invitations}</p>
        <p className="mt-2 text-xs">Los eventos institucionales compartidos no se eliminan y los correos ya enviados no pueden retirarse.</p>
      </div>}
      {impact?.counts.students > 0 && <label className="mt-4 flex gap-3 rounded-xl border border-slate-200 p-3 text-sm">
        <input type="checkbox" checked={deleteStudentAccounts} disabled={!impact.canDeleteStudentAccounts} onChange={e=>setDeleteStudentAccounts(e.target.checked)} className="accent-red-600"/>
        <span><strong>Eliminar también las cuentas de los {impact.counts.students} alumnos matriculados</strong><span className="mt-1 block text-xs text-slate-600">Si no se marca, solo se quitan sus matrículas y las cuentas permanecen disponibles para otros cursos.</span></span>
      </label>}
      {impact && !impact.canDeleteStudentAccounts && <p className="mt-2 text-xs text-amber-800">Hay alumnos con otros roles; sus cuentas no pueden borrarse automáticamente junto al curso.</p>}
      <label className="mt-4 block text-sm font-semibold">Escribí ELIMINAR CURSO para confirmar
        <input value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="off" className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-900" />
      </label>
      {deleteStudentAccounts && <label className="mt-3 block text-sm font-semibold text-red-700">Escribí ELIMINAR ALUMNOS para confirmar el borrado de sus cuentas
        <input value={studentConfirmation} onChange={e=>setStudentConfirmation(e.target.value)} autoComplete="off" className="mt-1 w-full rounded-xl border border-red-300 bg-rose-50 px-3 py-2.5 text-slate-900" />
      </label>}
      {(error||serverError)&&<p role="alert" className="mt-3 text-sm text-red-700">{error||serverError}</p>}
      <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancelar</button>
      <button type="button" disabled={!ready||saving} onClick={()=>onDelete({id:course.id,deleteStudentAccounts,confirmation,studentConfirmation})} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{saving?'Eliminando...':'Eliminar definitivamente'}</button></div>
    </div>
  </div>;
}
