import { findTeacherProfileByUserId, findTeacherSubjectsByTeacher, findTeacherSubjectsByInstitution, findTeacherSubjectWithDetails } from '../repositories/teacherSubject.repository.js';
const error = (status, message) => Object.assign(new Error(message), {status});
const admin = u => u?.isSuperAdmin === true || u?.roles?.includes('SUPER_ADMIN');
const manager = u => (u?.roles || []).some(r => ['DIRECTOR','PRECEPTOR'].includes(r));
export async function getTeacherSubjects(user) {
  if (admin(user)) return findTeacherSubjectsByInstitution();
  if (manager(user)) {
    if (!user.institutionId) throw error(403, 'Institución no asignada');
    return findTeacherSubjectsByInstitution(user.institutionId);
  }
  if (!(user?.roles || []).includes('TEACHER')) throw error(403, 'Sin permisos para consultar asignaciones');
  const teacher = await findTeacherProfileByUserId(user.id);
  if (!teacher) throw error(403, 'El usuario no es docente');
  return findTeacherSubjectsByTeacher(teacher.id);
}
export async function getTeacherSubjectDetail(user, id) {
  const record = await findTeacherSubjectWithDetails(id);
  if (!record) throw error(404, 'Asignación docente inexistente');
  if (admin(user)) return record;
  if (manager(user) && user.institutionId === record.subject.institutionId) return record;
  if ((user?.roles || []).includes('TEACHER')) {
    const teacher = await findTeacherProfileByUserId(user.id);
    if (teacher?.id === record.teacherId) return record;
  }
  throw error(403, 'No tenés permiso para consultar esta asignación');
}
