import { randomUUID } from 'node:crypto';
import { getPrisma } from '../config/prisma.js';
import { hashPassword } from '../utils/password.js';
import { sendInvitationEmail } from '../utils/mailer.js';
import { canAnyRole, INVITATION_TARGET_PERMISSION } from '../config/permissions.js';
import * as invitationRepository from '../repositories/invitation.repository.js';
import * as academicRepository from '../repositories/academic.repository.js';
import { validatePreceptorCoverages, legacyShift } from './preceptorCoverage.service.js';

class ServiceError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

const INVITATION_TTL_HOURS = 72;

function isOnlyTeacher(roles) {
    return roles.length === 1 && roles[0] === 'TEACHER';
}

export const listInvitationsService = async (requester) => {
    if (!canAnyRole(requester.roles, 'invitation:list')) {
        throw new ServiceError('No tenés permisos para esta acción', 403);
    }
    if (requester.isSuperAdmin) return invitationRepository.listAllInvitations();
    return isOnlyTeacher(requester.roles)
        ? invitationRepository.findInvitationsByInviter(requester.id)
        : invitationRepository.findInvitationsByInstitution(requester.institutionId);
};

export const createInvitationService = async ({ email, role, courseId, institutionId: selectedInstitutionId }, requester) => {
    if (!email || !role) throw new ServiceError('Faltan campos obligatorios', 400);

    const permissionKey = INVITATION_TARGET_PERMISSION[role];
    if (!permissionKey) throw new ServiceError('Rol de invitación inválido', 400);
    if (!canAnyRole(requester.roles, permissionKey)) {
        throw new ServiceError('No tenés permisos para esta acción', 403);
    }

    const superAdmin = requester.isSuperAdmin === true || requester.roles?.includes('SUPER_ADMIN');
    const institutionId = superAdmin ? Number(selectedInstitutionId) : Number(requester.institutionId);
    if (!Number.isSafeInteger(institutionId) || institutionId <= 0) throw new ServiceError('Seleccioná una institución válida.', 400);
    if (!superAdmin && selectedInstitutionId && Number(selectedInstitutionId) !== institutionId) throw new ServiceError('No podés invitar a otra institución.', 403);
    const exists = await getPrisma().institution.findFirst({ where: { id: institutionId, isActive: true }, select: { id: true } });
    if (!exists) throw new ServiceError('Institución no disponible.', 404);
    let resolvedCourseId = null;
    if (role === 'STUDENT' && isOnlyTeacher(requester.roles)) {
        // El alumno se registra para seguir avisos, no para matricularse en un curso.
        // Si el docente sugiere un curso de referencia, validamos que lo dicte;
        // de lo contrario, la invitación vale para toda su institución.
        if (courseId != null && String(courseId).trim() !== '') {
            const teacherProfile = await academicRepository.findTeacherProfileByUserId(requester.id);
            if (!teacherProfile) throw new ServiceError('Perfil docente no encontrado', 403);
            const assignment = await academicRepository.findTeacherAssignment(teacherProfile.id, Number(courseId));
            if (!assignment) throw new ServiceError('Ese curso no está asignado a tu perfil docente', 403);
            resolvedCourseId = Number(courseId);
        }
    }

    const invitation = await invitationRepository.createInvitation({
        email,
        role,
        invitedById: requester.id,
        institutionId,
        courseId: resolvedCourseId,
        expiresAt: new Date(Date.now() + INVITATION_TTL_HOURS * 60 * 60 * 1000),
    });

    try {
        await sendInvitationEmail({
            to: invitation.email,
            token: invitation.token,
            role: invitation.role,
            expiresAt: invitation.expiresAt,
        });
    } catch (error) {
        console.error('Error enviando email de invitación:', error);
        // No dejamos una invitación "Pendiente" que nunca llegó
        await invitationRepository.deleteInvitation(invitation.id);
        throw new ServiceError('No se pudo enviar el correo de invitación', 502);
    }

    if (process.env.NODE_ENV !== 'production') {
        console.info(`[Avisos I12] Invitación institucional registrada y enviada por email a ${email}.`);
    }

    // El token no se devuelve al cliente: solo viaja por email
    const { token, ...safeInvitation } = invitation;
    return safeInvitation;
};

// Se aplica el mismo alcance a borrado simple y masivo, incluso si se manipula la API.
function canManageInvitation(invitation, requester) {
    if (requester.isSuperAdmin) return true;
    if (isOnlyTeacher(requester.roles)) return Number(invitation.invitedById) === Number(requester.id);
    return Number(invitation.institutionId) === Number(requester.institutionId);
}
function canRemove(requester) {
    if (!requester.isSuperAdmin && !canAnyRole(requester.roles, 'invitation:cancel'))
        throw new ServiceError('No tenés permisos para eliminar invitaciones.', 403);
}
const validId = value => {
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n <= 0) throw new ServiceError('Identificador inválido.', 400);
    return n;
};
export const cancelInvitationService = async (id, requester) => {
    canRemove(requester);
    const invitation = await invitationRepository.findInvitationById(validId(id));
    if (!invitation) throw new ServiceError('Invitación no encontrada.', 404);
    if (!canManageInvitation(invitation, requester)) throw new ServiceError('No podés eliminar invitaciones de otra institución.', 403);
    // Borrar pendientes equivale a revocar el token. Las utilizadas no afectan al usuario creado.
    await invitationRepository.deleteInvitation(invitation.id);
};
export const cleanupInvitationsService = async (body, requester) => {
    canRemove(requester);
    const ids = Array.isArray(body?.ids) ? body.ids.map(validId) : [];
    if (!ids.length || ids.length > 100 || new Set(ids).size !== ids.length)
        throw new ServiceError('Seleccioná entre 1 y 100 invitaciones distintas.', 400);
    const items = await Promise.all(ids.map(id => invitationRepository.findInvitationById(id)));
    const now = Date.now();
    if (items.some(item => !item || !canManageInvitation(item, requester)))
        throw new ServiceError('El lote contiene invitaciones inexistentes o fuera de tu institución.', 403);
    if (items.some(item => !item.isUsed && new Date(item.expiresAt).getTime() > now))
        throw new ServiceError('Las invitaciones pendientes deben cancelarse individualmente antes de la limpieza masiva.', 409);
    const result = await invitationRepository.cleanupInvitations(ids);
    return { deleted: result.count };
};

const positiveId = (value) => {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? number : null;
};
const requiredText = (value) => typeof value === 'string' ? value.trim() : '';

/** Cuentas invitadas: habilitación inmediata; nunca se crea una solicitud PENDING. */
export const acceptInvitationService = async (token, body = {}) => {
    body = body || {};
    const invitation = await invitationRepository.findInvitationByToken(token);
    if (!invitation) throw new ServiceError('Invitación no encontrada.', 404);
    if (invitation.isUsed) throw new ServiceError('Esta invitación ya fue utilizada.', 409);
    if (new Date(invitation.expiresAt) <= new Date()) throw new ServiceError('Esta invitación expiró.', 410);

    const { dni, password, firstName, lastName, legajo, specialty, shift, position, telefono } = body;
    const name = requiredText(firstName), surname = requiredText(lastName);
    const document = requiredText(dni);
    if (!name || !surname || !/^\d{7,9}$/.test(document) || typeof password !== 'string' || password.length < 8) {
        throw new ServiceError('Completá nombre, apellido, DNI de 7 a 9 dígitos y contraseña de al menos 8 caracteres.', 400);
    }
    const phone = requiredText(telefono);
    if (phone && (phone.length > 35 || !/^\+?[\d\s().-]+$/.test(phone))) {
        throw new ServiceError('Ingresá un teléfono válido o dejá el campo vacío.', 400);
    }
    if (!invitation.email) throw new ServiceError('La invitación no tiene un correo asociado.', 400);

    const institution = await getPrisma().institution.findFirst({
        where: { id: invitation.institutionId, isActive: true }, select: { id: true },
    });
    if (!institution) throw new ServiceError('La institución de esta invitación ya no está disponible.', 409);

    const role = invitation.role;
    const staffLegajo = requiredText(legajo);
    if (['TEACHER', 'PRECEPTOR'].includes(role) && !staffLegajo) {
        throw new ServiceError('El legajo es obligatorio para docentes y preceptores.', 400);
    }
    if (shift && !['MANANA', 'TARDE', 'NOCHE'].includes(shift)) {
        throw new ServiceError('El turno seleccionado no es válido.', 400);
    }

    let preselectedCareerId = null;
    if (role === 'STUDENT' && invitation.courseId) {
        const course = await getPrisma().course.findFirst({
            where: { id: invitation.courseId, institutionId: invitation.institutionId, isActive: true },
            select: { careerId: true },
        });
        if (!course) throw new ServiceError('El curso sugerido en la invitación ya no está disponible.', 409);
        preselectedCareerId = course.careerId;
    }

    const preceptorCoverages = role === 'PRECEPTOR'
        ? await validatePreceptorCoverages(getPrisma(), invitation.institutionId, body.coverages) : [];
    const profileByRole = {
        TEACHER: { teacherProfile: { create: { legajoTeacher: staffLegajo, specialty: requiredText(specialty) || null } } },
        PRECEPTOR: { preceptorProfile: { create: { legajoPreceptor: staffLegajo, shift: legacyShift(preceptorCoverages),
            ...(preceptorCoverages.length ? { coverages: { create: preceptorCoverages } } : {}) } } },
        DIRECTOR: { directorProfile: { create: { position: requiredText(position) || null } } },
        STUDENT: { studentProfile: { create: {
            legajoStudent: staffLegajo || `INV-${randomUUID().slice(0, 12).toUpperCase()}`,
            ...(preselectedCareerId ? { careerMemberships: { create: { careerId: preselectedCareerId } } } : {}),
        } } },
    };
    if (!profileByRole[role]) throw new ServiceError('Rol de invitación inválido.', 400);

    try {
        const user = await invitationRepository.createUserFromInvitation({
            invitationId: invitation.id,
            userCreateData: {
                dni: document,
                email: invitation.email.trim().toLowerCase(),
                telefono: phone || null,
                passwordHash: await hashPassword(password),
                firstName: name,
                lastName: surname,
                institutionId: invitation.institutionId, // FIJA: no se acepta del navegador
                isActive: true,
                emailVerifiedAt: new Date(), // La invitación llegó a este correo y fue aceptada.
                signupStatus: null, // Sin filtro de aprobación, por ser una invitación.
                ...profileByRole[role],
            },
        });
        return { message: 'Cuenta creada y habilitada. Ya podés iniciar sesión.', userId: user.id };
    } catch (error) {
        if (error.code === 'P2002') throw new ServiceError('El correo, DNI o legajo ya está en uso.', 409);
        throw error;
    }
};

export const getInvitationByTokenService = async (token) => {
    const invitation = await invitationRepository.findInvitationByToken(token);
    if (!invitation) throw new ServiceError('Invitación no encontrada.', 404);
    if (invitation.isUsed) throw new ServiceError('Esta invitación ya fue utilizada.', 409);
    if (new Date(invitation.expiresAt) <= new Date()) throw new ServiceError('Esta invitación expiró.', 410);
    const institution = await getPrisma().institution.findUnique({
        where: { id: invitation.institutionId }, select: { id: true, nombre: true, isActive: true },
    });
    if (!institution?.isActive) throw new ServiceError('La institución ya no está disponible.', 409);
    const course = invitation.courseId
        ? await getPrisma().course.findFirst({
            where: { id: invitation.courseId, institutionId: invitation.institutionId, isActive: true },
            select: { id: true, nombre: true, careerId: true, academicYear: true, shift: true },
        })
        : null;
    if (invitation.courseId && !course) throw new ServiceError('El curso asignado en la invitación ya no existe.', 409);
    return {
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        institution: { id: institution.id, nombre: institution.nombre },
        course,
    };
};
