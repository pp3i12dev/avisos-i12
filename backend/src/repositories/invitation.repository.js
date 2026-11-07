import { getPrisma } from '../config/prisma.js';

export const findInvitationsByInviter = (invitedById) => {
    const prisma = getPrisma();
    return prisma.invitation.findMany({
        where: { invitedById },
        include: { course: true },
        omit: { token: true },
        orderBy: { createdAt: 'desc' },
    });
};

export const findInvitationsByInstitution = (institutionId) => {
    const prisma = getPrisma();
    return prisma.invitation.findMany({
        where: { institutionId },
        include: { course: true },
        omit: { token: true },
        orderBy: { createdAt: 'desc' },
    });
};


export const listAllInvitations = () => getPrisma().invitation.findMany({
    include: { course: true }, omit: { token: true }, orderBy: { createdAt: 'desc' },
});
// El borrado masivo es atómico: todo el lote debe pasar las validaciones.
export const cleanupInvitations = ids => getPrisma().invitation.deleteMany({ where: { id: { in: ids } } });

export const createInvitation = (data) => {
    const prisma = getPrisma();
    return prisma.invitation.create({ data, include: { course: true } });
};

export const findInvitationById = (id) => {
    const prisma = getPrisma();
    return prisma.invitation.findUnique({ where: { id } });
};

export const findInvitationByToken = (token) => {
    const prisma = getPrisma();
    return prisma.invitation.findUnique({ where: { token } });
};

export const deleteInvitation = (id) => {
    const prisma = getPrisma();
    return prisma.invitation.delete({ where: { id } });
};

export const findUserById = (id) => {
    const prisma = getPrisma();
    return prisma.user.findUnique({ where: { id } });
};

export const createUserFromInvitation = ({ invitationId, userCreateData }) => {
    const prisma = getPrisma();
    return prisma.$transaction(async (tx) => {
        // El token se consume atómicamente para evitar dos registros simultáneos.
        const claim = await tx.invitation.updateMany({
            where: { id: invitationId, isUsed: false, expiresAt: { gt: new Date() } },
            data: { isUsed: true },
        });
        if (claim.count !== 1) {
            throw Object.assign(new Error('La invitación ya se utilizó o venció.'), { status: 409 });
        }
        return tx.user.create({ data: userCreateData });
    });
};