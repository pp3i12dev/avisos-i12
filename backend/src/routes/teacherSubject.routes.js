import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { listMine, getDetail } from '../controllers/teacherSubject.controller.js';
const router = Router();
router.use(authenticate);
router.get('/', listMine);
router.get('/:id', getDetail);
export default router;
