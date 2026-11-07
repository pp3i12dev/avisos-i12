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
        const existing=await tx.user.findUnique({where:{email:userCreateData.email},include:{
            staffSignup:true,studentProfile:true,directorProfile:true,teacherProfile:true,preceptorProfile:true,
        }});
        if (!existing) return tx.user.create({ data: userCreateData });
        const targetRole=userCreateData.directorProfile?'DIRECTOR':userCreateData.preceptorProfile?'PRECEPTOR':
            userCreateData.teacherProfile?'TEACHER':userCreateData.studentProfile?'STUDENT':null;
        const eligible= !existing.isActive && !existing.deletedAt && !existing.isSuperAdmin &&
            existing.dni===userCreateData.dni && existing.institutionId===userCreateData.institutionId &&
            existing.signupStatus==='PENDING' && !existing.directorProfile && !existing.preceptorProfile &&
            !existing.teacherProfile &&
            (targetRole==='STUDENT' ? Boolean(existing.studentProfile) && !existing.staffSignup
                : !existing.studentProfile && existing.staffSignup?.status==='PENDING' && existing.staffSignup.role===targetRole);
        if (!eligible) {
            const e=new Error('La invitación coincide con una cuenta que no puede unificarse. Verificá DNI, institución y rol con una autoridad.');
            e.status=409;throw e;
        }
        const claimed=await tx.user.updateMany({where:{id:existing.id,isActive:false,deletedAt:null,signupStatus:'PENDING'},
            data:{isActive:true,signupStatus:'APPROVED',emailVerifiedAt:new Date(),signupReviewedAt:new Date(),
              signupReviewReason:'Cuenta activada por invitación institucional verificada.'}});
        if (claimed.count!==1) {const e=new Error('La cuenta ya fue activada.');e.status=409;throw e;}
        await tx.emailVerificationToken.deleteMany({where:{userId:existing.id}});
        await tx.passwordResetToken.deleteMany({where:{userId:existing.id}});
        await tx.refreshToken.deleteMany({where:{userId:existing.id}});
        if(existing.staffSignup) await tx.staffSignupRequest.update({where:{userId:existing.id},
            data:{status:'APPROVED',reviewedAt:new Date(),rejectionReason:null}});
        const {studentProfile,teacherProfile,preceptorProfile,directorProfile,...data}=userCreateData;
        const creation=targetRole==='STUDENT' ? {} :
          (targetRole==='TEACHER'?{teacherProfile}:targetRole==='PRECEPTOR'?{preceptorProfile}:{directorProfile});
        return tx.user.update({where:{id:existing.id},data:{...data,...creation}});

    });
};