import { getPrisma } from '../config/prisma.js';
import { deleteAccountTx } from '../repositories/user.repository.js';

class CourseLifecycleError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const hasAdminRole = user => user?.isSuperAdmin === true || user?.roles?.includes('SUPER_ADMIN');
function permitted(user) {
  if (!hasAdminRole(user) && !user?.roles?.includes('DIRECTOR')) {
    throw new CourseLifecycleError('Solo dirección o superadministración pueden desactivar o eliminar cursos.', 403);
  }
}
function numberId(input) {
  const id = Number(input);
  if (!Number.isSafeInteger(id) || id <= 0) throw new CourseLifecycleError('ID de curso inválido.');
  return id;
}
function whereFor(courseId, user) {
  if (!hasAdminRole(user) && !user?.institutionId) throw new CourseLifecycleError('No hay institución asignada.', 403);
  return { id: courseId, ...(hasAdminRole(user) ? {} : { institutionId: Number(user.institutionId) }) };
}
async function loadCourse(tx, id, requester) {
  const course = await tx.course.findFirst({ where: whereFor(numberId(id), requester), include: { career: true } });
  if (!course) throw new CourseLifecycleError('Curso inexistente o fuera de tu institución.', 404);
  return course;
}
async function getImpact(tx, courseId) {
  const [students, assignments, schedules, notices, invitations, eventLinks] = await Promise.all([
    tx.studentCourse.findMany({ where: { courseId }, include: { student: { include: { user: { select: { id: true, firstName: true, lastName: true, isSuperAdmin: true, directorProfile: true, teacherProfile: true, preceptorProfile: true } } } } } }),
    tx.teacherSubject.count({ where: { courseId } }),
    tx.subjectSchedule.count({ where: { courseId } }),
    tx.earlyNotice.count({ where: { courseId } }),
    tx.invitation.count({ where: { courseId } }),
    tx.institutionEventCourse.count({ where: { courseId } }),
  ]);
  return { students, assignments, schedules, notices, invitations, eventLinks };
}
export async function previewCourseDeletion(id, requester) {
  permitted(requester);
  const prisma = getPrisma();
  const course = await loadCourse(prisma, id, requester);
  const impact = await getImpact(prisma, course.id);
  const eligible = impact.students.every(s => {
    const u = s.student?.user;
    return u && !u.isSuperAdmin && !u.directorProfile && !u.teacherProfile && !u.preceptorProfile;
  });
  return {
    course: { id: course.id, nombre: course.nombre, academicYear: course.academicYear, institutionId: course.institutionId, isActive: course.isActive },
    counts: { students: impact.students.length, teacherAssignments: impact.assignments, schedules: impact.schedules, earlyNotices: impact.notices, invitations: impact.invitations, institutionalCommunicationLinks: impact.eventLinks },
    canDeleteStudentAccounts: eligible,
    warning: 'Borrar el curso elimina relaciones, avisos tempranos y matrículas. Los correos ya enviados no se pueden recuperar ni retirar. Los eventos institucionales compartidos se conservan.',
  };
}
export async function setCourseActive(id, active, requester) {
  permitted(requester);
  if (typeof active !== 'boolean') throw new CourseLifecycleError('Indicá un estado válido.', 400);
  const prisma = getPrisma();
  const course = await loadCourse(prisma, id, requester);
  return prisma.course.update({ where: { id: course.id }, data: { isActive: active }, include: { career: true } });
}
export async function deleteCoursePermanently(id, body, requester) {
  permitted(requester);
  if (body?.confirmation !== 'ELIMINAR CURSO') throw new CourseLifecycleError('Para eliminar escribí ELIMINAR CURSO.');
  const deleteStudents = body?.deleteStudentAccounts === true;
  if (deleteStudents && body?.studentConfirmation !== 'ELIMINAR ALUMNOS') {
    throw new CourseLifecycleError('Para borrar también las cuentas de alumnos escribí ELIMINAR ALUMNOS.');
  }
  const prisma = getPrisma();
  try {
    return await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(8701, 2207)`;
      const course = await loadCourse(tx, id, requester);
      const impact = await getImpact(tx, course.id);
      if (deleteStudents) {
        for (const row of impact.students) {
          const u = row.student?.user;
          if (!u || u.isSuperAdmin || u.directorProfile || u.teacherProfile || u.preceptorProfile) {
            throw new CourseLifecycleError('Hay alumnos con otros perfiles o privilegios; no pueden eliminarse en lote.', 409);
          }
        }
      }
      // Eliminar antes los avisos del curso: sus notificaciones, revisiones y
      // clases afectadas se eliminan por cascada conforme al esquema actual.
      await tx.earlyNotice.deleteMany({ where: { courseId: course.id } });
      // Desvincular eventos institucionales. No borrar eventos compartidos con
      // otras carreras o cursos ni sus notificaciones.
      await tx.institutionEventCourse.deleteMany({ where: { courseId: course.id } });
      // Invalidar invitaciones asociadas al curso eliminado.
      await tx.invitation.deleteMany({ where: { courseId: course.id } });
      await tx.teacherSubject.deleteMany({ where: { courseId: course.id } });
      await tx.subjectSchedule.deleteMany({ where: { courseId: course.id } });
      await tx.studentCourse.deleteMany({ where: { courseId: course.id } });
      // Snapshot opcional de la etapa de promoción anual.
      if (typeof tx.enrollmentMovement?.deleteMany === 'function') {
        await tx.enrollmentMovement.deleteMany({ where: { OR: [{ sourceCourseId: course.id }, { targetCourseId: course.id }] } });
      }
      if (deleteStudents) {
        for (const row of impact.students) {
          await deleteAccountTx(tx, row.student.user.id, course.institutionId, { expectedProfileField: 'studentProfile', callerId: Number(requester.id), actorCanDeleteSuperAdmin: hasAdminRole(requester) });
        }
      }
      await tx.course.delete({ where: { id: course.id } });
      return { deleted: true, id: course.id, removedStudents: deleteStudents ? impact.students.length : 0 };
    }, { maxWait: 15000, timeout: 120000 });
  } catch(error) {
    if (error.code === 'P2003') throw new CourseLifecycleError('El curso tiene relaciones no contempladas. No se borró nada. Reportá el error para revisar las claves foráneas.', 409);
    throw error;
  }
}
