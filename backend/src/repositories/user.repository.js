import { canActivatePendingStaff } from '../utils/pendingAccountPolicy.js';

import { getPrisma } from '../config/prisma.js';
import { coverageRelations } from '../services/preceptorCoverage.service.js';

const PROFILE_INCLUDE = {
  directorProfile: true,
  teacherProfile: true,
  preceptorProfile: true,
  studentProfile: true,
};

export const findUserByEmailOrDni = ({ email, dni }) => {
  const prisma = getPrisma();

  return prisma.user.findFirst({
    where: email ? { email } : { dni },
    include: PROFILE_INCLUDE,
  });
};

// SUPER_ADMIN: institutionId null permite listar usuarios
// de todas las instituciones.
// Otros roles: se filtran por la institución asignada.
export const listUsersByProfile = ({ institutionId, profileField }) => {
  const prisma = getPrisma();

  return prisma.user.findMany({
    where: {
      ...(institutionId != null ? { institutionId } : {}),
      [profileField]: { isNot: null },
      deletedAt: null,
    },
    include: {
      [profileField]: profileField === 'studentProfile'
        ? { include: {
            // Matrícula heredada: solo referencia, no decide destinatarios.
            courses: { include: { course: { include: { career: true } } } },
            careerMemberships: { include: { career: { select: { id: true, nombre: true } } } },
            noticeSubscriptions: { include: {
              course: { include: { career: true } },
              subject: { select: { id: true, nombre: true } },
            } },
          } }
        : profileField === 'preceptorProfile' ? { include: coverageRelations } : true,
    },
    orderBy: {
      lastName: 'asc',
    },
  });
};

export const createUserWithProfile = ({
  userData,
  profileField,
  profileData,
}) => {
  const prisma = getPrisma();

  return prisma.user.create({
    data: {
      ...userData,
      [profileField]: {
        create: profileData,
      },
    },
    include: {
      [profileField]: profileField === 'preceptorProfile' ? { include: coverageRelations } : true,
    },
  });
};

export const createStudentSelfSignup = ({ userData, courseId }) => {
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        ...userData,
        isActive: false,
        signupStatus: 'PENDING',
        studentProfile: {
          create: {
            legajoStudent: null,
          },
        },
      },
      include: {
        studentProfile: true,
      },
    });

    await tx.studentCourse.create({
      data: {
        studentId: user.studentProfile.id,
        courseId,
      },
    });

    return user;
  });
};

export const updateUserWithProfile = ({
  id,
  institutionId,
  userData,
  profileField,
  profileData,
}) => {
  const prisma = getPrisma();

  return prisma.user.update({
    where: {
      id,
      institutionId,
      deletedAt: null,
    },
    data: {
      ...userData,
      ...(profileData && Object.keys(profileData).length > 0
        ? {
          [profileField]: {
            update: profileData,
          },
        }
        : {}),
    },
    include: {
      [profileField]: profileField === 'preceptorProfile' ? { include: coverageRelations } : true,
    },
  });
};

export const setUserActive = ({
  id,
  institutionId,
  isActive,
}) => {
  const prisma = getPrisma();

  return prisma.user.update({
    where: {
      id,
      ...(institutionId != null ? { institutionId } : {}),
      deletedAt: null,
    },
    data: {
      isActive,
    },
  });
};

/**
 * Traslado interinstitucional controlado. El usuario cambia de institución,
 * pero sus datos historicos permanecen asociados a los registros originales.
 * Se eliminan matrículas vigentes y se desactivan asignaciones docentes.
 */
export const transferUserInstitution = async ({ id, previousInstitutionId, targetInstitutionId, userData, profileField, profileData }) => {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({ where: { id, institutionId: previousInstitutionId, deletedAt: null }, include: PROFILE_INCLUDE });
    if (!user) throw Object.assign(new Error('Usuario inexistente'), { status: 404 });
    const destination = await tx.institution.findFirst({ where: { id: targetInstitutionId, isActive: true }, select: { id: true } });
    if (!destination) throw Object.assign(new Error('La institución de destino no está disponible'), { status: 400 });
    if (user.studentProfile) {
      // Traslado de instituto: no puede conservar suscripciones ni pertenencias
      // a carreras de la institución anterior. Evita recepción cruzada de avisos.
      const studentId = user.studentProfile.id;
      await tx.studentNoticeSubscription.deleteMany({ where: { studentId } });
      await tx.studentCareer.deleteMany({ where: { studentId } });
      await tx.studentCourse.deleteMany({ where: { studentId } });
    }
    if (user.preceptorProfile && profileField !== 'preceptorProfile') {
      // Traslado de usuarios con múltiples perfiles: también liberar las coberturas del preceptor.
      await tx.preceptorCoverage.deleteMany({ where: { preceptorId: user.preceptorProfile.id } });
    }
    if (user.teacherProfile) {
      const active = await tx.teacherSubject.findMany({ where: { teacherId: user.teacherProfile.id, isActive: true }, select: { id: true } });
      const ids = active.map(row => row.id);
      await tx.teacherSubject.updateMany({ where: { id: { in: ids } }, data: { isActive: false } });
      if (ids.length) {
      }
    }
    // Invalidar sesiones y suscripciones Push del usuario: requiere nuevo inicio de sesión.
    await tx.refreshToken.deleteMany({ where: { userId: id } });
    await tx.webPushSubscription.deleteMany({ where: { userId: id } });
    await tx.userDevice.deleteMany({ where: { userId: id } });
    return tx.user.update({
      where: { id },
      data: {
        ...userData,
        institutionId: targetInstitutionId,
        ...(profileData && Object.keys(profileData).length ? { [profileField]: { update: profileData } } : {}),
      },
      include: { [profileField]: profileField === 'preceptorProfile' ? { include: coverageRelations } : true },
    });
  });
};

/**
 * Retiro operativo. No destruye GameAttempt, EarlyNotice ni registros de auditoría.
 * Se invalida acceso y se liberan las asignaciones vigentes.
 */
export const archiveUserWithRelations = async ({ id, institutionId }) => {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: { id, deletedAt: null, ...(institutionId != null ? { institutionId } : {}) },
      include: PROFILE_INCLUDE,
    });
    if (!user) throw Object.assign(new Error('Usuario no encontrado'), { status: 404 });
    if (user.isSuperAdmin) throw Object.assign(new Error('No se puede eliminar una cuenta superadministradora'), { status: 403 });
    if (user.teacherProfile) {
      const active = await tx.teacherSubject.findMany({ where: { teacherId: user.teacherProfile.id, isActive: true }, select: { id: true } });
      const ids = active.map(row => row.id);
      await tx.teacherSubject.updateMany({ where: { id: { in: ids } }, data: { isActive: false } });
      // Ya no deben publicarse actividades ni documentos ligados a la cuenta retirada.
    }
    if (user.studentProfile) await tx.studentCourse.deleteMany({ where: { studentId: user.studentProfile.id } });
    await tx.refreshToken.deleteMany({ where: { userId: id } });
    await tx.webPushSubscription.deleteMany({ where: { userId: id } });
    await tx.userDevice.deleteMany({ where: { userId: id } });
    return tx.user.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } });
  });
};

/**
 * Borra físicamente un ALUMNO y su información exclusiva, de manera atómica.
 * Nunca afecta alumnos de otra institución ni usuarios con otros perfiles.
 * Las relaciones de autoría institucional que no pertenecen al alumno son
 * protegidas por las FK: si existe una dependencia imprevista se revierte todo.
 */
export const deleteStudentPermanently = async ({ id, institutionId }) => {
  const db = getPrisma();
  return db.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: { id, deletedAt: null, ...(institutionId != null ? { institutionId } : {}) },
      select: {
        id: true, isSuperAdmin: true, studentProfile: { select: { id: true } },
        teacherProfile: { select: { id: true } },
        directorProfile: { select: { id: true } },
        preceptorProfile: { select: { id: true } },
      },
    });
    if (!user?.studentProfile) throw Object.assign(new Error('Alumno no encontrado en la institución.'), { status: 404 });
    if (user.isSuperAdmin || user.teacherProfile || user.directorProfile || user.preceptorProfile) {
      throw Object.assign(new Error('La cuenta posee otros roles; no se admite su eliminación como alumno.'), { status: 409 });
    }

    const studentId = user.studentProfile.id;
    await tx.attendance.deleteMany({ where: { studentId } });
    await tx.studentCourse.deleteMany({ where: { studentId } });
    // Borra avisos dirigidos al alumno, solicitudes y sus entregas/email/push (por CASCADE).
    await tx.notification.deleteMany({ where: { OR: [{ userId: id }, { signupUserId: id }] } });
    await tx.webPushSubscription.deleteMany({ where: { userId: id } });
    await tx.userDevice.deleteMany({ where: { userId: id } });
    await tx.refreshToken.deleteMany({ where: { userId: id } });
    await tx.passwordResetToken.deleteMany({ where: { userId: id } });
    await tx.studentProfile.delete({ where: { id: studentId } });
    // Las relaciones ajenas a un alumno normal quedan protegidas por restricciones SQL.
    await tx.user.delete({ where: { id } });
    return { deleted: true, id };
  });
};


/**
 * Eliminación definitiva solicitada expresamente por una autoridad.
 * ATENCIÓN: destruye también los avisos/comunicaciones firmados por la cuenta,
 * sus entregas y registros de asistencia propios; no se usa en bajas normales.
 * Todo se realiza en la misma transacción. Ante cualquier FK desconocida, rollback.
 * No afecta avisos de otros autores salvo que incluyan clases impartidas por el
 * docente eliminado; en ese caso se borra el aviso completo para evitar destinatarios
 * o clases inconsistentes (el formulario exige comunicar este efecto al operador).
 */
export async function deleteAccountTx(tx, id, institutionId = null, options = {}) {
  const user = await tx.user.findFirst({
    where: { id, deletedAt: null, ...(institutionId == null ? {} : { institutionId }) },
    include: PROFILE_INCLUDE,
  });
  if (!user) throw Object.assign(new Error('Usuario no encontrado en la institución.'), { status: 404 });
  if (options.callerId === id) throw Object.assign(new Error('No podés eliminar tu propia cuenta.'), { status: 403 });
  if (options.expectedProfileField && !user[options.expectedProfileField]) {
    throw Object.assign(new Error('La cuenta cambió de rol. Actualizá el listado.'), { status: 409 });
  }
  if (user.isSuperAdmin && options.actorCanDeleteSuperAdmin === false) {
    throw Object.assign(new Error('Un directivo no puede eliminar superadministradores.'), { status: 403 });
  }
  if (user.isSuperAdmin) {
    const activeAdmins = await tx.user.count({ where: { isSuperAdmin: true, isActive: true, deletedAt: null } });
    if (activeAdmins <= 1) {
      throw Object.assign(new Error('No se puede eliminar al último superadministrador activo.'), { status: 409 });
    }
  }

  // Se eliminan avisos con autor o profesor obligatorio. Una notificación
  // derivada desaparece por cascada, incluidos trabajos de email y Web Push.
  const affectedNoticeFilters = [{ teacherUserId: id }, { createdById: id }];
  if (user.teacherProfile) {
    affectedNoticeFilters.push(
      { teacherSubject: { teacherId: user.teacherProfile.id } },
      { affectedClasses: { some: { teacherSubject: { teacherId: user.teacherProfile.id } } } },
    );
  }
  const earlyNoticesRemoved = await tx.earlyNotice.deleteMany({ where: { OR: affectedNoticeFilters } });
  // Otras publicaciones siguen vigentes si el usuario solo las actualizó
  // o confirmó; esos campos son opcionales y se desasocian.
  await tx.earlyNotice.updateMany({ where: { updatedById: id }, data: { updatedById: null } });
  await tx.earlyNotice.updateMany({ where: { confirmedById: id }, data: { confirmedById: null } });
  await tx.earlyNoticeRevision.deleteMany({ where: { createdById: id } });

  const institutionEventsRemoved = await tx.institutionEvent.deleteMany({ where: { createdById: id } });
  await tx.institutionEvent.updateMany({ where: { updatedById: id }, data: { updatedById: null } });
  await tx.institutionEventRevision.deleteMany({ where: { createdById: id } });

  // Anular invitaciones que haya emitido la cuenta. Los tokens quedan inválidos.
  const invitationsRemoved = await tx.invitation.deleteMany({ where: { invitedById: id } });
  // Estos campos son referencias numéricas informativas, no FK Prisma.
  await tx.user.updateMany({ where: { signupReviewedById: id }, data: { signupReviewedById: null } });
  await tx.staffSignupRequest.updateMany({ where: { reviewedById: id }, data: { reviewedById: null } });

  if (user.teacherProfile) {
    await tx.teacherSubject.deleteMany({ where: { teacherId: user.teacherProfile.id } });
  }
  if (user.preceptorProfile) {
    await tx.attendance.deleteMany({ where: { preceptorId: user.preceptorProfile.id } });
    // PreceptorCoverage tiene onDelete: Cascade respecto de PreceptorProfile.
  }
  if (user.studentProfile) {
    await tx.attendance.deleteMany({ where: { studentId: user.studentProfile.id } });
    await tx.studentCourse.deleteMany({ where: { studentId: user.studentProfile.id } });
    // StudentCareer, StudentNoticeSubscription y EnrollmentMovement usan CASCADE.
  }

  await tx.notification.deleteMany({ where: { OR: [{ userId: id }, { signupUserId: id }] } });
  await tx.refreshToken.deleteMany({ where: { userId: id } });
  await tx.webPushSubscription.deleteMany({ where: { userId: id } });
  await tx.userDevice.deleteMany({ where: { userId: id } });
  await tx.passwordResetToken.deleteMany({ where: { userId: id } });

  // Los perfiles tienen FK onDelete Cascade al User; desuscripciones, carreras
  // y coberturas también se eliminan al borrar sus perfiles.
  await tx.user.delete({ where: { id } });
  return {
    id, deleted: true,
    removed: {
      earlyNotices: earlyNoticesRemoved.count,
      institutionEvents: institutionEventsRemoved.count,
      invitations: invitationsRemoved.count,
    },
  };
}

export const deleteUserPermanently = async ({ id, institutionId, callerId, actorCanDeleteSuperAdmin, expectedProfileField }) => {
  const prisma = getPrisma();
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1::integer AS lock_taken FROM pg_advisory_xact_lock(8701, 2207)`;
    return deleteAccountTx(tx, id, institutionId, { callerId, actorCanDeleteSuperAdmin, expectedProfileField });
  }, { maxWait: 10000, timeout: 20000 });
};

export const bulkDeleteStudentsPermanently = async ({ ids, institutionId }) => {
  const prisma = getPrisma();
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1::integer AS lock_taken FROM pg_advisory_xact_lock(8701, 2207)`;
    const users = await tx.user.findMany({
      where: { id: { in: ids }, deletedAt: null, ...(institutionId == null ? {} : { institutionId }) },
      include: PROFILE_INCLUDE,
    });
    if (users.length !== ids.length) throw Object.assign(new Error('Cambió el listado de alumnos. Actualizá antes de eliminar.'), { status: 409 });
    for (const user of users) {
      if (!user.studentProfile || user.isSuperAdmin || user.directorProfile || user.teacherProfile || user.preceptorProfile) {
        throw Object.assign(new Error('La selección incluye una cuenta que no es exclusivamente alumno.'), { status: 409 });
      }
    }
    for (const id of ids) await deleteAccountTx(tx, id, institutionId);
    return { deleted: ids.length };
  }, { maxWait: 15000, timeout: 120000 });
};

// Reemplaza la matrícula actual del alumno por el curso indicado
// (o la borra si courseId viene null/undefined).
// Nunca deja al alumno con más de un curso activo a la vez.
export const assignStudentCourse = async ({
  studentProfileId,
  courseId,
}) => {
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    // La edición del alumno puede TRANSFERIR la matrícula de curso, nunca duplicarla.
    await tx.$queryRaw`SELECT 1::integer AS lock_taken FROM pg_advisory_xact_lock(${studentProfileId}::integer, 817231::integer)`;
    const profile = await tx.studentProfile.findUnique({
      where: { id: studentProfileId },
      select: { user: { select: { institutionId: true } } },
    });
    if (!profile) throw Object.assign(new Error('Alumno inexistente'), { status: 404 });
    if (courseId != null) {
      const target = await tx.course.findUnique({ where: { id: courseId }, select: { institutionId: true, isActive: true } });
      if (!target || !target.isActive || target.institutionId !== profile.user.institutionId) {
        throw Object.assign(new Error('El curso no pertenece a la institución del alumno'), { status: 400 });
      }
    }
    await tx.studentCourse.deleteMany({ where: { studentId: studentProfileId } });
    if (courseId != null) {
      await tx.studentCourse.create({ data: { studentId: studentProfileId, courseId } });
    }
  });
};

const ALL_PROFILES_INCLUDE = {
  studentProfile: true,
  teacherProfile: true,
  preceptorProfile: true,
  directorProfile: true,
};

export const findUserWithAllProfiles = ({
  id,
  institutionId,
}) => {
  const prisma = getPrisma();

  return prisma.user.findFirst({
    where: {
      id,
      ...(institutionId != null ? { institutionId } : {}),
      deletedAt: null,
    },
    include: ALL_PROFILES_INCLUDE,
  });
};

export const addProfileToUser = ({
  id,
  profileField,
  profileData,
}) => {
  const prisma = getPrisma();

  return prisma.user.update({
    where: {
      id,
    },
    data: {
      [profileField]: {
        create: profileData,
      },
    },
  });
};

export const removeProfileFromUser = ({
  id,
  profileField,
}) => {
  const prisma = getPrisma();

  return prisma.user.update({
    where: {
      id,
    },
    data: {
      [profileField]: {
        delete: true,
      },
    },
  });
};

// ======================================================
// MI PERFIL - OPERACIONES DEL USUARIO AUTENTICADO
// ======================================================

/**
 * Obtiene los datos del usuario autenticado.
 *
 * La identidad se obtiene desde req.user.id
 * en el servicio/controlador, nunca desde
 * un ID proporcionado por el cliente.
 *
 * Incluye perfiles para poder mostrar
 * información correspondiente a todos sus roles.
 */
export const findOwnUserProfile = (userId) => {
  const prisma = getPrisma();

  return prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: ALL_PROFILES_INCLUDE,
  });
};

/**
 * Actualiza únicamente los campos personales
 * que el servicio haya autorizado previamente.
 *
 * No acepta modificaciones de roles,
 * institución, estado de cuenta o perfiles.
 */
export const updateOwnUserProfile = ({
  userId,
  data,
}) => {
  const prisma = getPrisma();

  return prisma.user.update({
    where: {
      id: userId,
    },
    data,
    include: ALL_PROFILES_INCLUDE,
  });
};

/**
 * Actualiza exclusivamente el hash de contraseña.
 *
 * La comprobación de la contraseña actual
 * corresponde al servicio.
 */
export const updateOwnPasswordHash = ({
  userId,
  passwordHash,
  previousPasswordHash,
}) => {
  const prisma = getPrisma();

  return prisma.user.updateMany({
    where: {
      id: userId,
      passwordHash: previousPasswordHash,
      isActive: true,
    },
    data: {
      passwordHash,
    },
  });
};

// La autorización para consultar registros por institución se realiza además
// en la capa de servicios. Esta consulta evita que el botón histórico active
// solicitudes públicas sin aprobación.
export const findUserByIdForInstitution = ({ id, institutionId }) => getPrisma().user.findFirst({
  where: { id, deletedAt: null, ...(institutionId != null ? { institutionId } : {}) },
  select: { id: true, signupStatus: true },
});

/**
 * Etapa 23: unificación institucional de una solicitud pública PENDING.
 * La cuenta original no conserva su contraseña ni enlaces de verificación.
 * Exige identidad EXACTA y autorización previa en users.service.
 */
export async function activatePendingStaffAccount({ userData, profileField, profileData, requestedRole, actorId }) {
  const db=getPrisma();
  return db.$transaction(async tx=>{
    const pending=await tx.user.findUnique({where:{email:userData.email.toLowerCase()},include:{
      staffSignup:true,studentProfile:true,teacherProfile:true,preceptorProfile:true,directorProfile:true,
    }});
    if (!canActivatePendingStaff(pending, userData, requestedRole)) {
      const error=new Error('Existe un usuario con esos datos, pero no es una solicitud pendiente del mismo cargo, DNI e institución. Revisalo antes de continuar.');
      error.status=409;throw error;
    }
    const claimed=await tx.user.updateMany({where:{id:pending.id,isActive:false,deletedAt:null,signupStatus:'PENDING'},
      data:{isActive:true,signupStatus:'APPROVED',signupReviewedAt:new Date(),signupReviewedById:actorId}});
    if(claimed.count!==1){const e=new Error('La solicitud fue procesada por otra autoridad.');e.status=409;throw e;}
    await tx.emailVerificationToken.deleteMany({where:{userId:pending.id}});
    await tx.passwordResetToken.deleteMany({where:{userId:pending.id}});
    await tx.refreshToken.deleteMany({where:{userId:pending.id}});
    await tx.staffSignupRequest.update({where:{userId:pending.id},data:{status:'APPROVED',reviewedAt:new Date(),reviewedById:actorId,rejectionReason:null}});
    return tx.user.update({where:{id:pending.id},data:{
      passwordHash:userData.passwordHash,firstName:userData.firstName,lastName:userData.lastName,
      telefono:userData.telefono ?? null,
      [profileField]:{create:profileData},
    },include:{[profileField]:profileField==='preceptorProfile'?{include:coverageRelations}:true}});
  });
}
