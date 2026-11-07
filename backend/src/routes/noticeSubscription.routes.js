import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { catalogForStudent, myNoticeSubscriptions, subscribeToNotice, unsubscribeNotice, joinCareerForNotices,
  adminListStudents, adminCatalog, adminGetSubscriptions, adminSubscribe, adminUnsubscribe } from '../services/noticeSubscription.service.js';
const router = Router();
router.use(authenticate);
const run = async (res, fn, status = 200) => {
  try { return res.status(status).json(await fn()); }
  catch (error) { if (!error.status) console.error('[Avisos I12][Suscripciones]', error); return res.status(error.status || 500).json({ message: error.status ? error.message : 'Error interno' }); }
};
router.get('/admin/students', (req, res) => run(res, () => adminListStudents(req.user, req.query)));
router.get('/admin/catalog', (req, res) => run(res, () => adminCatalog(req.user, req.query.institutionId)));
router.get('/admin/students/:userId', (req, res) => run(res, () => adminGetSubscriptions(req.user, req.params.userId, req.query.institutionId)));
router.post('/admin/students/:userId', (req, res) => run(res, () => adminSubscribe(req.user, req.params.userId, req.body), 201));
router.delete('/admin/students/:userId/:id', (req, res) => run(res, () => adminUnsubscribe(req.user, req.params.userId, req.params.id, req.query.institutionId)));
router.get('/catalog', (req, res) => run(res, () => catalogForStudent(req.user)));
router.get('/mine', (req, res) => run(res, () => myNoticeSubscriptions(req.user)));
router.post('/', (req, res) => run(res, () => subscribeToNotice(req.user, req.body), 201));
router.post('/careers', (req, res) => run(res, () => joinCareerForNotices(req.user, req.body?.careerId), 201));
router.delete('/:id', (req, res) => run(res, () => unsubscribeNotice(req.user, req.params.id)));
export default router;
