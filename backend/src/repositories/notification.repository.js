import { getPrisma } from '../config/prisma.js';
import { queueRecipientBatch } from '../utils/batchNotificationQueue.js';

const prisma = getPrisma();

export const notificationRepository = {
    findNoticeClasses(earlyNoticeId) {
        return prisma.earlyNoticeClass.findMany({
            where: { earlyNoticeId },
            include: { teacherSubject: { include: {
                course: { select: { id: true, nombre: true } },
                subject: { select: { id: true, nombre: true } },
            } } },
            orderBy: [{ classDate: 'asc' }, { startTime: 'asc' }],
        });
    },
    findTeacher(userId) {
        return prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, telefono: true, isActive: true },
        });
    },
    findStudentsByOfferings(offerings) {
        const keys = [...new Map(offerings.map(x => [`${x.courseId}:${x.subjectId}`, { courseId: x.courseId, subjectId: x.subjectId }])).values()];
        if (!keys.length) return Promise.resolve([]);
        return prisma.studentNoticeSubscription.findMany({
            where: { OR: keys, student: { user: { isActive: true, deletedAt: null } } },
            select: { student: { select: { user: { select: { id: true, email: true, telefono: true, isActive: true } } } } },
        });
    },
    findStudentsByCourse(courseId) {
        return prisma.studentCourse.findMany({
            where: { courseId, student: { user: { isActive: true } } },
            select: { student: { select: { user: {
                select: { id: true, email: true, telefono: true, isActive: true },
            } } } },
        });
    },
    async publish(notice, type, title, message, users, revision = 1) {
        if (!Number.isSafeInteger(revision) || revision < 1) throw new Error('Revisión inválida');
        const recipients = [...new Map(users.filter(u => u?.isActive !== false).map(u => [u.id, u])).values()];
        return prisma.$transaction(tx => queueRecipientBatch(tx, {
            origin: 'earlyNoticeId', originId: notice.id, type, title, message, revision,
            userIds: recipients.map(u=>u.id),
        }), { timeout: 20000, maxWait: 10000 });
    },
    listForUser(userId, { skip, take }) {
        return prisma.notification.findMany({
            where: { userId }, orderBy: { createdAt: 'desc' }, skip, take,
            select: { id: true, type: true, title: true, message: true,
                isRead: true, readAt: true, createdAt: true, earlyNoticeId: true, institutionEventId: true, revision: true },
        });
    },
    countUnread(userId) {
        return prisma.notification.count({ where: { userId, isRead: false } });
    },
    markRead(userId, id) {
        return prisma.notification.updateMany({
            where: { id, userId }, data: { isRead: true, readAt: new Date() },
        });
    },
};
