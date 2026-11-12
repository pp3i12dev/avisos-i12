import { Router } from 'express';
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js';
import { getIntegrationSettings, getIntegrationSecrets, updateIntegrations, generateInstitutionVapid, managedInstitution, resolveInstitutionMail } from '../services/integrationSettings.service.js';
import { sendConfiguredMail } from '../utils/mailer.js';

const router = Router();
router.use(authenticate, requirePermission('integrations:manage'));
const run = (res, job) => Promise.resolve().then(job).then(result => res.json(result)).catch(error => {
  if (!error.status) console.error('[Avisos I12][Integraciones]', error.message);
  return res.status(error.status || 500).json({ message: error.status ? error.message : 'No se pudo completar la configuración.' });
});
router.get('/', (req,res) => run(res, () => getIntegrationSettings(req.user, req.query.institutionId)));
router.get('/secrets', (req,res) => {
  res.set('Cache-Control','private, no-store, no-cache, max-age=0');
  res.set('Vary','Authorization');
  return run(res, () => getIntegrationSecrets(req.user, req.query.institutionId));
});
router.put('/', (req,res) => run(res, () => updateIntegrations(req.user, req.body || {})));
router.post('/push/generate', (req,res) => run(res, () => generateInstitutionVapid(req.user, req.body || {})));
router.post('/mail/test', (req,res) => run(res, async () => {
  const institutionId = managedInstitution(req.user, req.body?.institutionId);
  const config = await resolveInstitutionMail(institutionId);
  if (config.provider === 'DISABLED') { const e = new Error('Activá SMTP de Google antes de enviar la prueba.'); e.status = 409; throw e; }
  try {
    await sendConfiguredMail({
      to: req.user.email, from: { name: 'Avisos I12' },
      subject: 'Avisos I12 · Prueba de correo institucional',
      text: 'Si recibiste este mensaje, el canal de correo de Avisos I12 está operativo para tu institución.',
    }, institutionId);
  } catch (error) {
    console.error('[Avisos I12][SMTP] Prueba fallida:', error.code || error.message);
    const message = ['EAUTH', '535', '534'].some(value=>String(error.code || error.responseCode || '').includes(value))
      ? 'Google rechazó las credenciales. Usá una contraseña de aplicación válida.'
      : ['ETIMEDOUT', 'ESOCKET', 'ECONNECTION'].includes(error.code)
        ? 'El servidor no puede conectar con Google SMTP. Verificá la red y que el hosting permita el puerto 587.'
        : 'El proveedor de correo rechazó la prueba. Revisá las credenciales y el registro del backend.';
    const response = new Error(message); response.status = 502; throw response;
  }
  return { ok: true, message: 'El proveedor aceptó el envío de prueba. Revisá tu bandeja de entrada.' };
}));
export default router;
