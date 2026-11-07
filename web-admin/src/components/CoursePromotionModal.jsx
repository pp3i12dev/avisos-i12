import {useState,useEffect} from 'react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {courseAdminService} from '../services/courseAdmin.service';
import {shiftLabel} from '../utils/courseShift';

export default function CoursePromotionModal({open,onClose,courses,sourceCourse}) {
  const queryClient=useQueryClient();
  const [targetId,setTargetId]=useState('');
  const [preview,setPreview]=useState(null);
  const [confirmation,setConfirmation]=useState('');
  const [feedback,setFeedback]=useState('');
  const previewMutation=useMutation({mutationFn:({source,target})=>courseAdminService.previewPromotion(source,target),onSuccess:d=>{setPreview(d);setFeedback('');},onError:e=>{setPreview(null);setFeedback(e?.response?.data?.message||e.message);}});
  const promotionMutation=useMutation({mutationFn:courseAdminService.promote,onSuccess:data=>{setFeedback(`Se promovieron ${data.moved} alumnos. El historial quedó registrado.`);setPreview(null);queryClient.invalidateQueries({queryKey:['courses-admin']});queryClient.invalidateQueries({queryKey:['users']});},onError:e=>setFeedback(e?.response?.data?.message||e.message)});
  useEffect(()=>{setTargetId('');setPreview(null);setConfirmation('');setFeedback('');},[open,sourceCourse?.id]);
  if(!open||!sourceCourse)return null;
  const candidates=courses.filter(c=>c.id!==sourceCourse.id&&c.institutionId===sourceCourse.institutionId&&c.careerId!=null&&c.careerId===sourceCourse.careerId&&c.shift===sourceCourse.shift&&c.academicYear===sourceCourse.academicYear+1&&c.nombre.trim().toLocaleLowerCase('es')!==sourceCourse.nombre.trim().toLocaleLowerCase('es'));
  const canPromote=Boolean(preview?.students?.length>0&&preview.destinationCount===0&&preview.students.every(s=>s.active)&&preview.students.length<=200);
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4">
    <div role="dialog" aria-modal="true" aria-labelledby="promotion-heading" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 text-slate-900 shadow-2xl">
      <div className="flex items-center justify-between"><h2 id="promotion-heading" className="text-xl font-bold">Promoción anual de alumnos</h2><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-1.5">Cerrar</button></div>
      <p className="mt-2 text-sm text-slate-600">Origen: <strong>{sourceCourse.nombre} · {shiftLabel(sourceCourse.shift)} · {sourceCourse.academicYear}</strong></p>
      <div className="mt-4 rounded-xl border border-red-200 bg-rose-50 p-3 text-sm text-red-900">Para no mezclar cohortes, elegí un curso <strong>vacío</strong> del ciclo {sourceCourse.academicYear+1}, de la misma carrera y turno. Si no existe, crealo primero desde «Nuevo curso». El curso del año anterior no se modifica.</div>
      <label className="mt-4 block text-sm font-semibold">Curso de destino
        <select value={targetId} onChange={e=>{setTargetId(e.target.value);setPreview(null);setConfirmation('');}} className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5">
          <option value="">Seleccionar curso del ciclo siguiente</option>
          {candidates.map(c=><option key={c.id} value={c.id}>{c.nombre} · {shiftLabel(c.shift)} · {c.academicYear}</option>)}
        </select>
      </label>
      {!candidates.length&&<p className="mt-3 text-sm text-amber-800">No hay cursos de destino disponibles. Creá TERCERO {sourceCourse.academicYear+1} (mismo turno y carrera) y regresá a esta pantalla.</p>}
      <button disabled={!targetId||previewMutation.isPending} onClick={()=>previewMutation.mutate({source:sourceCourse.id,target:Number(targetId)})} className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40">{previewMutation.isPending?'Consultando…':'Previsualizar y verificar'}</button>
      {preview&&<div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <p>Alumnos de origen: <strong>{preview.students.length}</strong> · Ocupación del destino: <strong>{preview.destinationCount}</strong></p>
        <p className="mt-1 text-slate-600">La promoción no trasladará los horarios ni las asignaciones docentes antiguas. Se deberán configurar para el nuevo ciclo.</p>
        <div className="mt-3 max-h-44 overflow-y-auto"><ul className="list-inside list-disc space-y-1">{preview.students.map(s=><li key={s.studentProfileId}>{s.name}{!s.active?' (cuenta inactiva)':''}</li>)}</ul></div>
        {preview.destinationCount>0&&<p className="mt-3 font-semibold text-red-700">Destino ocupado: operación bloqueada para evitar mezclas entre grupos.</p>}
        {canPromote&&<><label className="mt-4 block font-semibold">Escribí PROMOVER para confirmar
          <input value={confirmation} onChange={e=>setConfirmation(e.target.value)} placeholder="PROMOVER" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2" />
        </label><button disabled={confirmation!=='PROMOVER'||promotionMutation.isPending} onClick={()=>promotionMutation.mutate({sourceCourseId:sourceCourse.id,targetCourseId:Number(targetId),expectedStudentIds:preview.students.map(s=>s.studentProfileId),confirmation})} className="mt-3 rounded-xl bg-[#C61515] px-4 py-2 font-semibold text-white disabled:opacity-40">{promotionMutation.isPending?'Promoviendo…':`Promover ${preview.students.length} alumnos`}</button></>}
      </div>}
      {feedback&&<p role="status" className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm">{feedback}</p>}
    </div>
  </div>;
}
