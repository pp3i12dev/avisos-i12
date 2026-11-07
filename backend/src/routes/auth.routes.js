import { passwordResetLimit } from '../middlewares/passwordResetLimit.middleware.js';
import { publicRegistrationLimit } from '../middlewares/publicRegistrationLimit.middleware.js';
import { Router } from 'express';
import { registerStudent, registerTeacher, login, forgotPassword, confirmPasswordReset, verifyEmail, resendEmail } from '../controllers/auth.controller.js';

const router = Router();

router.post('/register-student', publicRegistrationLimit, registerStudent);
router.post('/register-staff', publicRegistrationLimit, registerTeacher);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', passwordResetLimit, resendEmail);

router.post('/login', login);
router.post('/forgot-password', passwordResetLimit, forgotPassword);
router.post('/reset-password', passwordResetLimit, confirmPasswordReset);

export default router;