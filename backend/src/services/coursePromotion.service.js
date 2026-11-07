import { getPrisma } from '../config/prisma.js';

const fail = (message, status=400) => Object.assign(new Error(message), { status });
const admin = actor => actor?.isSuperAdmin === true || actor?.roles?.includes('SUPER_ADMIN') || actor?.roles?.includes('DIRECTOR');
const pos = (value, label) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw fail(`${label} inválido.`);
  return id;
};
async function inspect(tx, sourceId, targetId, actor) {
  if (!admin(actor)) throw fail('Solo dirección y superadministración pueden promover grupos.',403);
  if (sourceId === targetId) throw fail('Elegí cursos diferentes.');
  const [source,target] = await Promise.all([
    tx.course.findUnique({where:{id:sourceId},include:{career:true}}),
    tx.course.findUnique({where:{id:targetId},include:{career:true}}),
  ]);
  if (!source || !target) throw fail('Curso de origen o destino inexistente.',404);
  if (!actor.isSuperAdmin && !actor.roles?.includes('SUPER_ADMIN') && source.institutionId !== Number(actor.institutionId)) throw fail('No podés operar otra institución.',403);
  if (source.institutionId !== target.institutionId) throw fail('Los cursos deben pertenecer a la misma institución.',409);
  if (source.careerId == null || source.careerId !== target.careerId) throw fail('Ambos cursos deben pertenecer a la misma carrera.',409);
  if (!source.shift || !target.shift || source.shift !== target.shift) throw fail('Los cursos deben pertenecer al mismo turno.',409);
  if (target.academicYear !== source.academicYear+1) throw fail('El destino debe corresponder al ciclo lectivo siguiente.',409);
  if (source.nombre.trim().toLowerCase() === target.nombre.trim().toLowerCase()) throw fail('Seleccioná el curso del nivel siguiente, no el mismo nivel.',409);
  const [enrollments,occupied] = await Promise.all([
    tx.studentCourse.findMany({where:{courseId:sourceId},include:{student:{include:{user:{select:{firstName:true,lastName:true,isActive:true,deletedAt:true}}}}},orderBy:{id:'asc'}}),
    tx.studentCourse.count({where:{courseId:targetId}}),
  ]);
  return {
    source:{id:source.id,name:source.nombre,year:source.academicYear,shift:source.shift,career:source.career?.nombre},
    target:{id:target.id,name:target.nombre,year:target.academicYear,shift:target.shift,career:target.career?.nombre},
    students:enrollments.map(x=>({id:x.student.userId,studentProfileId:x.studentId,name:`${x.student.user.lastName}, ${x.student.user.firstName}`,active:x.student.user.isActive && !x.student.user.deletedAt})),
    destinationCount:occupied,
  };
}
export async function previewCoursePromotion(query, actor) {
  const src=pos(query.sourceCourseId,'Origen'); const dst=pos(query.targetCourseId,'Destino');
  return inspect(getPrisma(),src,dst,actor);
}
export async function executeCoursePromotion(body,actor) {
  const src=pos(body.sourceCourseId,'Origen'); const dst=pos(body.targetCourseId,'Destino');
  const ids=body.expectedStudentIds;
  if (!Array.isArray(ids) || !ids.length || ids.length>200 || ids.some(x=>!Number.isSafeInteger(Number(x)))) throw fail('Confirmá un grupo de 1 a 200 alumnos.',400);
  if (body.confirmation !== 'PROMOVER') throw fail('Falta la confirmación de promoción.',400);
  return getPrisma().$transaction(async tx => {
    // Bloquea la promoción de dos sesiones simultáneas.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(8701, 2210)`;
    const report=await inspect(tx,src,dst,actor);
    if (report.destinationCount) throw fail('El curso destino ya tiene alumnos. Creá uno vacío para el ciclo siguiente o regularizá sus inscripciones antes.',409);
    if (report.students.some(s=>!s.active)) throw fail('El origen contiene cuentas inactivas; regularizalas antes de promover.',409);
    const current=report.students.map(x=>x.studentProfileId).sort((a,b)=>a-b);
    const expected=ids.map(Number).sort((a,b)=>a-b);
    if (new Set(expected).size!==expected.length || current.length!==expected.length || current.some((id,i)=>id!==expected[i])) throw fail('La nómina cambió. Volvé a previsualizar la promoción.',409);
    for (const profileId of current) {
      const changed=await tx.studentCourse.updateMany({where:{studentId:profileId,courseId:src},data:{courseId:dst}});
      if (changed.count!==1) throw fail('Cambió una matrícula durante la operación; se canceló todo.',409);
      await tx.enrollmentMovement.create({data:{
        studentId:profileId,sourceCourseId:src,targetCourseId:dst,
        sourceLabel:report.source.name,targetLabel:report.target.name,
        sourceYear:report.source.year,targetYear:report.target.year,performedById:Number(actor.id),
      }});
    }
    return {moved:current.length,from:report.source,to:report.target};
  }, {maxWait:15000,timeout:120000,isolationLevel:'Serializable'});
}
