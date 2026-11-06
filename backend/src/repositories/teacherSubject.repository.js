
import { getPrisma } from '../config/prisma.js';

export const findTeacherProfileByUserId = (userId) => {
    const prisma = getPrisma();

    return prisma.teacherProfile.findUnique({
        where: { userId },
        select: { id: true },
    });
};

// Solo asignaciones docentes vigentes.
export const findTeacherSubjectsByTeacher = (teacherId) => {
    const prisma = getPrisma();

    return prisma.teacherSubject.findMany({
        where: {
            teacherId,
            isActive: true,
            subject: { deletedAt: null },
            teacher: { user: { isActive: true, deletedAt: null } },
        },
        include: {
            subject: true,
            course: { include: { career: { select: { id: true, nombre: true, institutionId: true } } } },
        },
        orderBy: {
            subject: { nombre: 'asc' },
        },
    });
};

// Listado operativo de asignaciones docentes.
// institutionId = null permite consultar todas las instituciones,
// exclusivamente cuando el servicio autoriza ese alcance.
export const findTeacherSubjectsByInstitution = (institutionId = null) => {
    const prisma = getPrisma();

    return prisma.teacherSubject.findMany({
        where: {
            isActive: true,
            subject: { deletedAt: null },
            teacher: { user: { isActive: true, deletedAt: null } },
            ...(institutionId != null
                ? {
                    subject: {
                        institutionId,
                    },
                }
                : {}),
        },
        include: {
            subject: true,
            course: { include: { career: { select: { id: true, nombre: true, institutionId: true } } } },
        },
        orderBy: {
            subject: { nombre: 'asc' },
        },
    });
};

// Permite consultar una asignación vigente o histórica.
// Los permisos de lectura y edición se controlan en el servicio.
export const findTeacherSubjectWithDetails = (teacherSubjectId) => {
    const prisma = getPrisma();

    return prisma.teacherSubject.findUnique({
        where: {
            id: teacherSubjectId,
        },
        include: {
            subject: true,
            course: { include: { career: { select: { id: true, nombre: true, institutionId: true } } } },
        },
    });
};

