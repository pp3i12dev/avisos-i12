import { Router } from 'express';

import authRoutes from './auth.routes.js';
import usersRoutes from './users.routes.js';
import institutionsRoutes from './institutions.routes.js';
import careerRoutes from './career.routes.js';
import courseRoutes from './course.routes.js';
import subjectRoutes from './subject.routes.js';
import teacherSubjectRoutes from './teacherSubject.routes.js';
import assignmentsRoutes from './assignment.routes.js';
import dashboardRoutes from './dashboard.routes.js';

// Notificaciones
import notificationRoutes from './notification.routes.js';
import webPushRoutes from './webPush.routes.js';
import noticeSubscriptionRoutes from './noticeSubscription.routes.js';
import staffSignupRoutes from './staffSignup.routes.js';
import contactDirectoryRoutes from './contactDirectory.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);

router.use('/institutions', institutionsRoutes);

router.use('/careers', careerRoutes);
router.use('/courses', courseRoutes);
router.use('/subjects', subjectRoutes);
router.use('/teacher-subjects', teacherSubjectRoutes);

router.use('/assignments', assignmentsRoutes);
router.use('/dashboard', dashboardRoutes);

// Notificaciones
router.use('/notifications', notificationRoutes);
router.use('/push', webPushRoutes);
router.use('/notice-subscriptions', noticeSubscriptionRoutes);
router.use('/staff-requests', staffSignupRoutes);
router.use('/contact-directory', contactDirectoryRoutes);

export default router;
