import { randomBytes, createHash } from 'node:crypto';
import { getPrisma } from '../config/prisma.js';
import { hashPassword } from '../utils/password.js';
import { sendAccountVerificationEmail } from '../utils/mailer.js';
import { safeNotifyStaffReviewers } from './staffSignup.service.js';
import { validatePreceptorCoverages, legacyShift } from './preceptorCoverage.service.js';

const invalid = (message, status = 400) => { const e = new Error(message); e.status = status; throw e; };
const idOf = (value, label) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) invalid(`${label} inválida.`);
  return n;
};
const plain = (value, max = 150) => typeof value === 'string' ? value.trim().slice(0, max + 1) : '';
const sha = token => createHash('sha256').update(token).digest('hex');
const EMAIL_TTL = 24 * 60 * 60 * 1000;

function validateIdentity(body) {
  const firstName = plain(body.firstName, 100);
  const lastName = plain(body.lastName, 100);
  const dni = plain(body.dni, 12);
  const email = plain(body.email, 200).toLowerCase();
  const telefono = plain(body.telefono, 35) || null;
  const password = body.password;
  if (!firstName || firstName.length > 100 || !lastName || lastName.length > 100) invalid('Nombre y apellido son obligatorios.');
  if (!/^\d{7,9}$/.test(dni)) invalid('Ingresá un DNI de 7 a 9 dígitos.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) invalid('Ingresá un email válido.');
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) invalid('La contraseña debe tener entre 8 y 128 caracteres.');
  if (telefono && !/^\+?[\d\s().-]+$/.test(telefono)) invalid('Teléfono inválido.');
  return { firstName, lastName, dni, email, telefono, passwordHash: null };
}

async function queueVerification(db, user) {
  const token = randomBytes(32).toString('base64url');
  await db.emailVerificationToken.create({ data: { userId: user.id, tokenHash: sha(token), expiresAt: new Date(Date.now() + EMAIL_TTL) } });
  try {
    await sendAccountVerificationEmail({ to: user.email, firstName: user.firstName, token });
    return true;
  } catch (error) {
    console.error('[Avisos I12][Registro] No fue posible enviar la verificación:', error.message);
    return false; // El usuario puede solicitar reenvío cuando SMTP se restablezca.
  }
}

export async function registerPublicAccount(data = {}, kind = 'STUDENT') {
  const identity = validateIdentity(data);
  const institutionId = idOf(data.institutionId, 'Institución');
  const db = getPrisma();
  const institution = await db.institution.findFirst({ where: { id: institutionId, isActive: true }, select: { id: true } });
  if (!institution) invalid('La institución no está disponible.', 404);
  const isStudent = kind === 'STUDENT';
  let staff = null;
  if (!isStudent) {
    if (!['DIRECTOR', 'PRECEPTOR', 'TEACHER'].includes(kind)) invalid('Tipo de usuario inválido.');
    const legajo = plain(data.legajo, 80);
    const specialty = plain(data.specialty, 200);
    const position = plain(data.position, 120);
    const shift = data.shift ? String(data.shift).toUpperCase() : null;
    if (['TEACHER', 'PRECEPTOR'].includes(kind) && !legajo) invalid('El legajo es obligatorio para docentes y preceptores.');
    if (shift && !['MANANA','TARDE','NOCHE'].includes(shift)) invalid('Turno inválido.');
    const coverages = kind === 'PRECEPTOR'
      ? await validatePreceptorCoverages(db, institutionId, data.coverages) : null;
    staff = { role: kind, legajo: legajo || null, specialty: specialty || null, position: position || null,
      shift: kind === 'PRECEPTOR' ? legacyShift(coverages) : shift,
      ...(kind === 'PRECEPTOR' ? { coverages } : {}) };  
  }
  // El alumno NO necesita elegir un curso ni solicitar aprobación institucional.
  // El personal NO recibe ningún perfil/rol hasta su aprobación.
  let user;
  try {
    user = await db.user.create({ data: {
      firstName: identity.firstName, lastName: identity.lastName,
      dni: identity.dni, email: identity.email, telefono: identity.telefono,
      passwordHash: await hashPassword(data.password), institutionId,
      isActive: false, signupStatus: 'PENDING',
      ...(isStudent
        ? { studentProfile: { create: { legajoStudent: `WEB-${randomBytes(10).toString('hex').toUpperCase()}` } } }
        : { staffSignup: { create: staff } }),
    }, select: { id: true, email: true, firstName: true } });
  } catch (error) {
    if (error.code === 'P2002') invalid('Ese DNI o correo ya está registrado. Iniciá sesión o recuperá tu contraseña.', 409);
    throw error;
  }
  const sent = await queueVerification(db, user);
  return { registered: true, verificationEmailSent: sent,
    message: sent
      ? (isStudent ? 'Revisá tu correo para activar tu cuenta. No necesitás aprobación administrativa.' : 'Verificá tu correo. Luego tu solicitud deberá ser aprobada por la institución.')
      : 'La cuenta fue creada, pero no pudimos enviar el correo. Solicitá un nuevo enlace de verificación desde el acceso.' };
}

export async function verifyRegistrationEmail(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{40,100}$/.test(token)) invalid('Enlace inválido.', 400);
  const db = getPrisma();
  const result = await db.$transaction(async tx => {
    const record = await tx.emailVerificationToken.findUnique({ where: { tokenHash: sha(token) },
      include: { user: { select: { id: true, studentProfile: { select: { id: true } }, staffSignup: { select: { status: true } }, emailVerifiedAt: true } } } });
    if (!record || record.usedAt || record.expiresAt <= new Date()) invalid('El enlace venció o ya fue utilizado.', 410);
    if (record.user.emailVerifiedAt) invalid('El correo ya fue verificado.', 409);
    const consumed = await tx.emailVerificationToken.updateMany({ where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
    if (consumed.count !== 1) invalid('El enlace fue utilizado.', 409);
    const isStudent = Boolean(record.user.studentProfile);
    await tx.user.update({ where: { id: record.userId }, data: {
      emailVerifiedAt: new Date(),
      ...(isStudent ? { isActive: true, signupStatus: 'APPROVED' } : {}),
    } });
    await tx.emailVerificationToken.deleteMany({ where: { userId: record.userId, id: { not: record.id } } });
    return { verified: true, activated: isStudent, userId: record.userId,
      message: isStudent ? 'Correo verificado. Ya podés ingresar y suscribirte a avisos.' : 'Correo verificado. Tu cuenta está pendiente de aprobación institucional.' };
  });
  if (!result.activated) await safeNotifyStaffReviewers(result.userId);
  const { userId, ...publicResult } = result;
  return publicResult;
}

// Respuesta genérica: no confirma si un correo está registrado.
export async function resendVerification(email) {
  const normalized = plain(email, 200).toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) invalid('Ingresá un correo válido.');
  const db = getPrisma();
  const user = await db.user.findUnique({ where: { email: normalized }, select: { id: true, email: true, firstName: true, emailVerifiedAt: true, deletedAt: true, isActive: true } });
  if (user && !user.emailVerifiedAt && !user.deletedAt && !user.isActive) {
    const recent = await db.emailVerificationToken.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
    if (!recent || Date.now() - recent.createdAt.getTime() >= 2 * 60 * 1000) {
      await db.emailVerificationToken.deleteMany({ where: { userId: user.id, usedAt: null } });
      await queueVerification(db, user);
    }
  }
  return { message: 'Si hay una cuenta pendiente de verificación con ese correo, enviaremos un enlace.' };
}
