import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { listStaffRequests, reviewStaffRequest } from '../services/staffSignup.service.js';
const router = Router();
router.use(authenticate);
const run = async (res, fn) => { try { return res.json(await fn()); } catch (e) {
  if (!e.status) console.error('[Avisos I12][Solicitudes personal]', e);
  return res.status(e.status || 500).json({ message: e.status ? e.message : 'Error interno' });
} };
router.get('/', (req, res) => run(res, () => listStaffRequests(req.user, req.query.status)));
router.post('/:id/approve', (req, res) => run(res, () => reviewStaffRequest(req.user, req.params.id, 'APPROVED')));
router.post('/:id/reject', (req, res) => run(res, () => reviewStaffRequest(req.user, req.params.id, 'REJECTED', req.body?.reason)));
export default router;
