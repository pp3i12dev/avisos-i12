import { getPrisma } from '../config/prisma.js';
import { enqueueWebPushForNotification } from './webPush.service.js';
import { sendStaffSignupDecisionEmail } from '../utils/mailer.js';
import { validatePreceptorCoverages, legacyShift } from './preceptorCoverage.service.js';

const fail = (message, status = 400) => { const e = new Error(message); e.status = status; throw e; };
const asId = value => { const n = Number(value); if (!Number.isSafeInteger(n) || n <= 0) fail('Identificador inválido.'); return n; };
const isSuper = user => user.isSuperAdmin === true || user.roles?.includes('SUPER_ADMIN');
const isDirector = user => isSuper(user) || user.roles?.includes('DIRECTOR');
const isPreceptor = user => isDirector(user) || user.roles?.includes('PRECEPTOR');
const allowedRole = (user, role) => isDirector(user) || (role === 'TEACHER' && isPreceptor(user));
function assertStaffReviewer(user) {
  if (!user?.id || !isPreceptor(user)) fail('No estás autorizado para gestionar solicitudes de personal.', 403);
}

export async function listStaffRequests(actor, status = 'PENDING') {
  assertStaffReviewer(actor);
  const choice = String(status).toUpperCase();
  if (!['PENDING','APPROVED','REJECTED'].includes(choice)) fail('Estado inválido.');
  const db = getPrisma();
  const requests = await db.staffSignupRequest.findMany({
    where: { status: choice, ...(isSuper(actor) ? {} : { user: { institutionId: Number(actor.institutionId), deletedAt: null } }),
      ...(!isDirector(actor) ? { role: 'TEACHER' } : {}) },
    select: { id: true, role: true, status: true, legajo: true, specialty: true, position: true, shift: true, coverages: true,
      createdAt: true, reviewedAt: true, rejectionReason: true,
      user: { select: { id: true, firstName: true, lastName: true, email: true, dni: true, institutionId: true, emailVerifiedAt: true,
        institution: { select: { nombre: true } } } } },
    orderBy: { createdAt: 'desc' }, take: 500,
  });
  const careerIds = [...new Set(requests.flatMap(r => Array.isArray(r.coverages)
    ? r.coverages.map(c => Number(c?.careerId)).filter(Number.isSafeInteger) : []))];
  const careers = careerIds.length ? await db.career.findMany({ where: { id: { in: careerIds } },
    select: { id: true, nombre: true, institutionId: true } }) : [];
  const names = new Map(careers.map(c => [c.id, c]));
  return requests.map(r => ({ ...r, coverages: (Array.isArray(r.coverages) ? r.coverages : []).map(c => ({
    careerId: Number(c.careerId), shift: c.shift,
    careerName: names.get(Number(c.careerId))?.institutionId === r.user.institutionId
      ? names.get(Number(c.careerId)).nombre : 'Carrera no disponible',
  })) }));
}

export async function reviewStaffRequest(actor, rawId, decision, rawReason) {
  assertStaffReviewer(actor);
  const id = asId(rawId);
  if (!['APPROVED', 'REJECTED'].includes(decision)) fail('Decisión inválida.');
  const reason = decision === 'REJECTED' ? String(rawReason || '').trim() : null;
  if (decision === 'REJECTED' && (reason.length < 5 || reason.length > 500)) fail('Ingresá un motivo de entre 5 y 500 caracteres.');
  const db = getPrisma();
  const target = await db.$transaction(async tx => {
    const request = await tx.staffSignupRequest.findUnique({ where: { id }, include: { user: {
      select: { id: true, email: true, firstName: true, institutionId: true, isActive: true, deletedAt: true,
        emailVerifiedAt: true, directorProfile: { select: { id: true } }, preceptorProfile: { select: { id: true } }, teacherProfile: { select: { id: true } }, studentProfile: { select: { id: true } } },
    } } });
    if (!request || !['DIRECTOR', 'PRECEPTOR', 'TEACHER'].includes(request.role) || request.status !== 'PENDING' || request.user.deletedAt || request.user.isActive) fail('Solicitud inexistente o ya procesada.', 409);
    if (!allowedRole(actor, request.role)) fail('No tenés permisos para aprobar esta función.', 403);
    if (!isSuper(actor) && request.user.institutionId !== Number(actor.institutionId)) fail('Solicitud de otra institución.', 403);
    if (actor.id === request.userId) fail('No podés aprobar tu propia solicitud.', 403);
    if (decision === 'APPROVED' && !request.user.emailVerifiedAt) fail('El solicitante todavía no verificó su correo electrónico.', 409);
    if (request.user.directorProfile || request.user.preceptorProfile || request.user.teacherProfile || request.user.studentProfile) fail('El usuario ya tiene un perfil activo o incompatible.', 409);
    // Update condicional: evita doble aprobación con dos administradores simultáneos.
    const updated = await tx.staffSignupRequest.updateMany({ where: { id, status: 'PENDING' }, data: {
      status: decision, reviewedAt: new Date(), reviewedById: actor.id, rejectionReason: reason,
    } });
    if (updated.count !== 1) fail('La solicitud ya fue procesada.', 409);
    const validatedCoverages = decision === 'APPROVED' && request.role === 'PRECEPTOR'
      ? await validatePreceptorCoverages(tx, request.user.institutionId, request.coverages) : [];
    if (decision === 'APPROVED') {
      const field = request.role === 'DIRECTOR' ? 'directorProfile' : request.role === 'PRECEPTOR' ? 'preceptorProfile' : 'teacherProfile';
      const profileData = request.role === 'DIRECTOR'
        ? { position: request.position || null }
        : request.role === 'PRECEPTOR'
          ? { legajoPreceptor: request.legajo, shift: request.coverages == null ? (request.shift || null) : legacyShift(validatedCoverages),
              ...(validatedCoverages.length ? { coverages: { create: validatedCoverages } } : {}) }
          : { legajoTeacher: request.legajo, specialty: request.specialty || null };
      await tx.user.update({ where: { id: request.userId }, data: {
        [field]: { create: profileData }, isActive: true, signupStatus: 'APPROVED', signupReviewedAt: new Date(), signupReviewedById: actor.id,
      } });
    } else {
      await tx.user.update({ where: { id: request.userId }, data: {
        isActive: false, signupStatus: 'REJECTED', signupReviewedAt: new Date(), signupReviewedById: actor.id, signupReviewReason: reason,
      } });
    }
    return { id, role: request.role, firstName: request.user.firstName, email: request.user.email };
  });
  // El fallo de SMTP no revierte aprobaciones ya comprometidas.
  void sendStaffSignupDecisionEmail({ to: target.email, firstName: target.firstName, role: target.role, status: decision, reason })
    .catch(e => console.error('[Avisos I12][Personal] Error de correo de decisión:', e.message));
  return { processed: true, status: decision, id };
}

// Notifica al personal con autoridad de aprobar, únicamente después de verificar el email.
export async function safeNotifyStaffReviewers(userId) {
  try {
    const db = getPrisma();
    const request = await db.staffSignupRequest.findUnique({ where: { userId }, select: { role: true, user: { select: { institutionId: true } } } });
    if (!request) return;
    const eligible = await db.user.findMany({ where: { isActive: true, deletedAt: null,
      OR: [
        { isSuperAdmin: true },
        { institutionId: request.user.institutionId, directorProfile: { isNot: null } },
        ...(request.role === 'TEACHER' ? [{ institutionId: request.user.institutionId, preceptorProfile: { isNot: null } }] : []),
      ], }, select: { id: true } });
    await db.$transaction(async tx => {
      for (const approver of eligible) {
        const n = await tx.notification.upsert({ where: { userId_signupUserId_type_revision: {
          userId: approver.id, signupUserId: userId, type: 'STAFF_REGISTRATION_REQUEST', revision: 1,
        } }, create: { userId: approver.id, signupUserId: userId, type: 'STAFF_REGISTRATION_REQUEST',
          title: 'Solicitud de personal pendiente', message: 'Una persona verificó su correo y solicita autorización para utilizar Avisos I12 como personal institucional.', revision: 1 }, update: {} });
        await enqueueWebPushForNotification(tx, approver.id, n.id);
      }
    });
  } catch (error) { console.error('[Avisos I12][Personal] Error al notificar solicitud:', error); }
}
