import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { listCourses, createCourse, updateCourse, deleteCourse, getCourseDeletionPreview, changeCourseActive, deleteCourseWithOptions } from '../controllers/course.controller.js';

const router = Router();
router.use(authenticate);

router.get('/', listCourses);
router.post('/', createCourse);
router.put('/:id', updateCourse);
router.patch('/:id/status', changeCourseActive);
router.get('/:id/deletion-preview', getCourseDeletionPreview);
router.delete('/:id', deleteCourseWithOptions);

export default router;