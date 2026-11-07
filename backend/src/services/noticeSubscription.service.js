import { getPrisma } from '../config/prisma.js';
const fail = (message, status = 400) => { const e = new Error(message); e.status = status; throw e; };
const intId = (value, name) => { const n = Number(value); if (!Number.isSafeInteger(n) || n <= 0) fail(`${name} inválido.`); return n; };

const currentAcademicYear = () => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric' }).format(new Date()));

async function studentFor(user, db = getPrisma()) {
  if (!user?.id || !user.roles?.includes('STUDENT')) fail('Esta función es para cuentas de alumnos.', 403);
  const record = await db.user.findFirst({ where: { id: user.id, isActive: true, deletedAt: null },
    select: { institutionId: true, studentProfile: { select: { id: true } } } });
  if (!record?.studentProfile?.id || !record.institutionId) fail('Perfil de alumno no disponible.', 403);
  return { studentId: record.studentProfile.id, institutionId: record.institutionId };
}

// Los filtros son de la institución del JWT, nunca de institutionId enviado por el alumno.
export async function catalogForStudent(user) {
  const db = getPrisma();
  const { institutionId } = await studentFor(user, db);
  return catalogForInstitution(institutionId, db);
}
async function catalogForInstitution(institutionId, db = getPrisma()) {
  const year = currentAcademicYear();
  const [careers, assignments] = await Promise.all([
    db.career.findMany({ where: { institutionId }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } }),
    db.teacherSubject.findMany({ where: {
      isActive: true,
      teacher: { user: { isActive: true, deletedAt: null, institutionId } },
      subject: { institutionId, isActive: true, deletedAt: null },
      course: { institutionId, isActive: true, academicYear: year, careerId: { not: null } },
    }, select: {
      courseId: true, subjectId: true,
      subject: { select: { id: true, nombre: true } },
      course: { select: { id: true, nombre: true, academicYear: true, shift: true, level: true, careerId: true } },
    }, orderBy: [{ courseId: 'asc' }, { subjectId: 'asc' }] }),
  ]);
  // Múltiples profesores para la misma materia y comisión no generan filas duplicadas.
  const available = [...new Map(assignments.map(a => [ `${a.courseId}:${a.subjectId}`, {
    courseId: a.courseId, subjectId: a.subjectId, subject: a.subject.nombre,
    course: a.course.nombre, careerId: a.course.careerId,
    level: a.course.level, academicYear: a.course.academicYear, shift: a.course.shift,
  }])).values()];
  return { academicYear: year, careers, available };
}

export async function myNoticeSubscriptions(user) {
  const db = getPrisma();
  const { studentId } = await studentFor(user, db);
  return subscriptionsForProfile(studentId, db);
}
async function subscriptionsForProfile(studentId, db = getPrisma()) {
  const [careers, subscriptions] = await Promise.all([
    db.studentCareer.findMany({ where: { studentId }, select: { career: { select: { id: true, nombre: true } } } }),
    db.studentNoticeSubscription.findMany({ where: { studentId }, select: {
      id: true, courseId: true, subjectId: true, createdAt: true,
      course: { select: { nombre: true, academicYear: true, shift: true, level: true, careerId: true, career: { select: { id: true, nombre: true } } } },
      subject: { select: { nombre: true } },
    }, orderBy: { createdAt: 'desc' } }),
  ]);
  return { careers: careers.map(c => c.career), subscriptions };
}

export async function subscribeToNotice(user, body) {
  const db = getPrisma();
  const { studentId, institutionId } = await studentFor(user, db);
  return subscribeForProfile(studentId, institutionId, body, db);
}
async function subscribeForProfile(studentId, institutionId, body, db = getPrisma()) {
  const courseId = intId(body?.courseId, 'Curso');
  const subjectId = intId(body?.subjectId, 'Materia');
  return db.$transaction(async tx => {
    const assignment = await tx.teacherSubject.findFirst({ where: {
      courseId, subjectId, isActive: true,
      teacher: { user: { isActive: true, deletedAt: null, institutionId } },
      course: { institutionId, isActive: true, academicYear: currentAcademicYear(), careerId: { not: null } },
      subject: { institutionId, isActive: true, deletedAt: null },
    }, select: { course: { select: { careerId: true } } } });
    if (!assignment?.course.careerId) fail('La materia no está habilitada para recibir suscripciones.', 409);
    const careerId = assignment.course.careerId;
    await tx.studentCareer.upsert({ where: { studentId_careerId: { studentId, careerId } }, update: {}, create: { studentId, careerId } });
    const subscription = await tx.studentNoticeSubscription.upsert({
      where: { studentId_courseId_subjectId: { studentId, courseId, subjectId } },
      update: {}, create: { studentId, courseId, subjectId },
      select: { id: true, courseId: true, subjectId: true },
    });
    return { ...subscription, message: 'Suscripción a avisos activada. No constituye una inscripción oficial para cursar.' };
  });
}

export async function unsubscribeNotice(user, rawId) {
  const db = getPrisma();
  const { studentId } = await studentFor(user, db);
  const id = intId(rawId, 'Suscripción');
  const removed = await db.studentNoticeSubscription.deleteMany({ where: { id, studentId } });
  if (removed.count !== 1) fail('No existe esa suscripción en tu cuenta.', 404);
  return { removed: true, message: 'Dejaste de recibir nuevos avisos de esa materia.' };
}

export async function joinCareerForNotices(user, rawCareerId) {
  const db = getPrisma();
  const { studentId, institutionId } = await studentFor(user, db);
  const careerId = intId(rawCareerId, 'Carrera');
  const exists = await db.career.findFirst({ where: { id: careerId, institutionId }, select: { id: true } });
  if (!exists) fail('Carrera fuera de tu institución.', 403);
  await db.studentCareer.upsert({ where: { studentId_careerId: { studentId, careerId } }, update: {}, create: { studentId, careerId } });
  return { careerId, message: 'Carrera agregada para recibir comunicaciones. No es una matrícula académica.' };
}


// Gestión administrativa opcional: dirección/preceptoría pueden asistir a un alumno
// sin convertir la suscripción en inscripción oficial. Permisos revalidados en Express.
const isSuper = user => user?.isSuperAdmin || user?.roles?.includes('SUPER_ADMIN');
function adminInstitution(user, supplied) {
  if (!user?.id || !(isSuper(user) || user.roles?.includes('DIRECTOR') || user.roles?.includes('PRECEPTOR'))) fail('No estás autorizado.',403);
  if (isSuper(user)) return intId(supplied || user.institutionId, 'Institución');
  const own = intId(user.institutionId, 'Institución');
  if (supplied && Number(supplied) !== own) fail('No tenés acceso a esa institución.',403);
  return own;
}
async function adminStudent(user, userId, institutionId) {
  const subjectUserId = intId(userId,'Alumno');
  const db = getPrisma();
  const found = await db.user.findFirst({ where: { id: subjectUserId, institutionId, isActive: true, deletedAt: null,
      studentProfile: { isNot: null } }, select: { studentProfile: { select: { id:true } } } });
  if (!found?.studentProfile) fail('Alumno no encontrado o inactivo en esta institución.',404);
  return found.studentProfile.id;
}
export async function adminListStudents(user, query = {}) {
  const institutionId = adminInstitution(user, query.institutionId);
  const search = String(query.search || '').trim().slice(0, 100);
  const words = search.split(/\s+/).filter(Boolean).slice(0, 8);
  const matches = words.map(word => ({ OR: [
    { firstName: { contains: word, mode: 'insensitive' } },
    { lastName: { contains: word, mode: 'insensitive' } },
    { email: { contains: word, mode: 'insensitive' } },
    { dni: { contains: word } },
  ] }));
  return getPrisma().user.findMany({ where: {
    institutionId, isActive: true, deletedAt: null,
    studentProfile: { isNot: null }, ...(matches.length ? { AND: matches } : {}),
  }, select: { id: true, firstName: true, lastName: true, email: true, dni: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }], take: 100 });
}
export async function adminCatalog(user, suppliedInstitutionId) {
  return catalogForInstitution(adminInstitution(user, suppliedInstitutionId));
}
export async function adminGetSubscriptions(user, userId, suppliedInstitutionId) {
  const institutionId = adminInstitution(user, suppliedInstitutionId);
  const studentId = await adminStudent(user, userId, institutionId);
  return subscriptionsForProfile(studentId);
}
export async function adminSubscribe(user, userId, body) {
  const institutionId = adminInstitution(user, body?.institutionId);
  const studentId = await adminStudent(user, userId, institutionId);
  return subscribeForProfile(studentId, institutionId, body);
}
export async function adminUnsubscribe(user, userId, id, institution) {
  const institutionId = adminInstitution(user, institution);
  const studentId = await adminStudent(user, userId, institutionId);
  const removed = await getPrisma().studentNoticeSubscription.deleteMany({ where: { id: intId(id,'Suscripción'), studentId } });
  if (!removed.count) fail('Suscripción inexistente para ese alumno.',404);
  return { removed: true, message: 'El alumno dejó de seguir avisos de esa materia.' };
}
