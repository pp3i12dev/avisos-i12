import webpush from 'web-push';
import { getPrisma } from '../config/prisma.js';
import { encryptSetting, decryptSetting, encryptionReady, isLegacyEncrypted } from '../utils/configSecretCrypto.js';

const err = (message, status = 400) => { const e = new Error(message); e.status = status; throw e; };
const positiveId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const hasSuper = a => a?.isSuperAdmin || a?.roles?.includes('SUPER_ADMIN');
const hasDirector = a => a?.roles?.includes('DIRECTOR');
const actorLabel = a => hasSuper(a) ? 'SUPER_ADMIN' : 'DIRECTOR';
export function managedInstitution(actor, requested) {
  if (!actor?.id || (!hasSuper(actor) && !hasDirector(actor))) err('Solo dirección y superadministración pueden configurar integraciones.', 403);
  const id = hasSuper(actor) ? positiveId(requested || actor.institutionId) : positiveId(actor.institutionId);
  if (!id) err('Seleccioná una institución.', 400);
  if (!hasSuper(actor) && requested && Number(requested) !== id) err('No podés modificar otra institución.', 403);
  return id;
}
export const settingsRecord = institutionId => getPrisma().institutionIntegrationSettings.findUnique({ where: { institutionId: Number(institutionId) } });

async function audit(tx, id, actor, action, details) {
  const u = await tx.user.findUnique({ where: { id: actor.id }, select: { firstName: true, lastName: true } });
  const actorName = [u?.firstName, u?.lastName].filter(Boolean).join(' ') || `Usuario #${actor.id}`;
  await tx.institutionIntegrationAudit.create({ data: {
    institutionId: id, actorId: actor.id,
    actorName, actorRole: actorLabel(actor), action, details,
  } });
}
export async function getIntegrationSettings(actor, chosen) {
  const id = managedInstitution(actor, chosen);
  const db = getPrisma();
  const [item, history, institutions] = await Promise.all([
    settingsRecord(id),
    db.institutionIntegrationAudit.findMany({ where: { institutionId: id }, orderBy: { createdAt: 'desc' }, take: 35,
      select: { id: true, action: true, actorId: true, actorName: true, actorRole: true, createdAt: true, details: true } }),
    hasSuper(actor) ? db.institution.findMany({ where: { isActive: true }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } }) : Promise.resolve([]),
  ]);
  return { institutionId: id, institutions, history,
    encryptionReady: encryptionReady(),
    legacyKeyRequired: [item?.smtpSecret, item?.vapidPrivateKey].some(isLegacyEncrypted) && !(process.env.APP_CONFIG_ENCRYPTION_KEY?.length >= 32),
    smtp: { enabled: item?.smtpEnabled ?? false, user: item?.smtpUser || '', passwordConfigured: Boolean(item?.smtpSecret), provider: 'Gmail SMTP · smtp.gmail.com:587' },
    push: { enabled: item?.pushEnabled ?? false, publicKey: item?.vapidPublicKey || null, keyConfigured: Boolean(item?.vapidPrivateKey), subject: item?.vapidSubject || '' },
  };
}
// Las credenciales existentes sólo se devuelven en una ruta separada,
// autorizada como dirección/superadministración y marcada no-cache.
// Si una clave histórica no puede recuperarse, el campo queda vacío para
// que el directivo pueda reemplazarla sin necesitar una clave ajena.
export async function getIntegrationSecrets(actor, chosen) {
  const id = managedInstitution(actor, chosen);
  const item = await settingsRecord(id);
  const read = (payload, field) => {
    if (!payload) return { value: '', recoverable: true };
    try { return { value: decryptSetting(payload, id, field), recoverable: true }; }
    catch (error) {
      console.warn(`[Avisos I12] Credencial ${field} guardada en un formato que requiere reemplazo.`);
      return { value: '', recoverable: false };
    }
  };
  const smtp = read(item?.smtpSecret, 'smtp');
  const vapid = read(item?.vapidPrivateKey, 'vapid');
  return {
    institutionId: id,
    smtpPassword: smtp.value,
    vapidPrivateKey: vapid.value,
    smtpRecoverable: smtp.recoverable,
    vapidRecoverable: vapid.recoverable,
  };
}

export async function updateIntegrations(actor, body) {
  const id = managedInstitution(actor, body?.institutionId);
  const db = getPrisma();
  if (!await db.institution.findFirst({ where: { id, isActive: true }, select: { id: true } })) err('Institución inexistente.', 404);
  const old = await settingsRecord(id);
  // Re-cifrado transparente de claves de la Etapa 29 (v1) a la nueva v2.
  // NO se regeneran las claves VAPID ni se invalidan dispositivos.
  // Una vez guardado un cambio con la clave antigua disponible, se puede
  // retirar APP_CONFIG_ENCRYPTION_KEY sin perder la configuración.
  const upgradedSecrets = {};
  for (const [property, field] of [['smtpSecret','smtp'], ['vapidPrivateKey','vapid']]) {
    if (isLegacyEncrypted(old?.[property]) && process.env.APP_CONFIG_ENCRYPTION_KEY?.length >= 32) {
      upgradedSecrets[property] = encryptSetting(decryptSetting(old[property], id, field), id, field);
    }
  }
  const change = { ...upgradedSecrets, updatedById: actor.id };
  const kinds = [];
  if (body.smtp && typeof body.smtp === 'object') {
    const o = body.smtp;
    if (typeof o.enabled !== 'boolean') err('Indicá si el correo está habilitado.');
    const user = String(o.user || old?.smtpUser || '').trim().toLowerCase();
    if (o.enabled && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user)) err('Ingresá el correo Gmail del remitente.');
    if (o.enabled && !String(o.password || '').trim() && !old?.smtpSecret) err('Falta la contraseña de aplicación de Gmail.');
    if (o.enabled && isLegacyEncrypted(old?.smtpSecret) && !process.env.APP_CONFIG_ENCRYPTION_KEY?.length && !o.password) err('La contraseña SMTP antigua no puede descifrarse: ingresá nuevamente la contraseña de aplicación de Gmail.', 409);
    change.smtpEnabled = o.enabled; change.smtpUser = user || null;
    if (o.password) {
      const pwd = String(o.password).replace(/\s/g, '');
      if (pwd.length < 16 || pwd.length > 128) err('La contraseña de aplicación no es válida.');
      change.smtpSecret = encryptSetting(pwd, id, 'smtp');
    }
    kinds.push('SMTP_UPDATED');
  }
  if (body.gemini !== undefined) err('Avisos I12 no dispone de integración Gemini.', 400);
  if (body.push && typeof body.push === 'object') {
    const o = body.push;
    if (typeof o.enabled !== 'boolean') err('Indicá si Web Push está habilitado.');
    if (o.enabled && !old?.vapidPrivateKey) err('Generá primero las claves VAPID.');
    if (o.enabled && isLegacyEncrypted(old?.vapidPrivateKey) && !process.env.APP_CONFIG_ENCRYPTION_KEY?.length) err('Las claves VAPID anteriores no pueden descifrarse: recuperá temporalmente la clave antigua o regenerá VAPID desde el panel.', 409);
    change.pushEnabled = o.enabled;
    kinds.push(o.enabled ? 'PUSH_ENABLED' : 'PUSH_DISABLED');
  }
  if (!kinds.length) err('No se recibieron cambios de configuración.');
  await db.$transaction(async tx => {
    await tx.institutionIntegrationSettings.upsert({ where: { institutionId: id }, create: { institutionId: id, ...change }, update: change });
    for (const action of kinds) await audit(tx, id, actor, action, { keysChanged: action === 'SMTP_UPDATED' ? Boolean(body.smtp?.password) : undefined });
    if (Object.keys(upgradedSecrets).length) await audit(tx, id, actor, 'CRYPTO_MIGRATED', { fields: Object.keys(upgradedSecrets) });
  });
  return getIntegrationSettings(actor, id);
}
// El subject de VAPID identifica técnicamente al emisor ante el proveedor Push.
// NO es una cuenta SMTP ni se solicita al directivo. El SDK web-push requiere
// un URI de contacto; una dirección https también es válida (RFC 8292).
// Se conserva el subject anterior para no variar el identificador sin motivo.
export function chooseVapidSubject({ existing, envSubject, smtpUser, frontendUrl, actorEmail } = {}) {
  const validSubject = value => typeof value === 'string' && (
    /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value.trim()) ||
    /^https:\/\/[^\s/]+\.[^\s/]+(?:\/[^\s]*)?$/i.test(value.trim())
  );
  for (const value of [existing, envSubject]) {
    if (validSubject(value)) return value.trim();
  }
  if (typeof smtpUser === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(smtpUser.trim())) {
    return `mailto:${smtpUser.trim().toLowerCase()}`;
  }
  if (typeof frontendUrl === 'string') {
    try {
      const site = new URL(frontendUrl);
      if (site.protocol === 'https:' && site.hostname.includes('.')) return site.origin;
    } catch { /* Dirección no disponible todavía. */ }
  }
  if (typeof actorEmail === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(actorEmail.trim())) {
    return `mailto:${actorEmail.trim().toLowerCase()}`;
  }
  return null;
}

export const CONFIRM_VAPID_RESET = 'REGENERAR VAPID Y ANULAR TODAS LAS SUSCRIPCIONES';
export async function generateInstitutionVapid(actor, body) {
  const id = managedInstitution(actor, body?.institutionId);
  const old = await settingsRecord(id);
  if (old?.vapidPrivateKey && body?.confirmation !== CONFIRM_VAPID_RESET) {
    err(`Esta institución ya tiene claves. Para regenerarlas escribí: ${CONFIRM_VAPID_RESET}`, 409);
  }
  // Si la institución ya usaba VAPID del hosting, importar su pareja de claves
  // al primer guardado evita romper suscripciones vigentes por un recambio innecesario.
  const legacy = !old?.vapidPrivateKey && process.env.WEB_PUSH_ENABLED === 'true'
    && process.env.WEB_PUSH_PUBLIC_KEY && process.env.WEB_PUSH_PRIVATE_KEY;
  const keys = legacy
    ? { publicKey: process.env.WEB_PUSH_PUBLIC_KEY, privateKey: process.env.WEB_PUSH_PRIVATE_KEY }
    : webpush.generateVAPIDKeys();
  const subject = chooseVapidSubject({
    existing: old?.vapidSubject,
    envSubject: process.env.WEB_PUSH_SUBJECT,
    smtpUser: old?.smtpEnabled ? old?.smtpUser : null,
    frontendUrl: process.env.FRONTEND_URL,
    actorEmail: actor.email,
  });
  if (!subject) err('No se pudo establecer automáticamente el identificador técnico de Web Push. Contactá al soporte del sistema.', 503);
  const db = getPrisma();
  await db.$transaction(async tx => {
    await tx.institutionIntegrationSettings.upsert({
      where: { institutionId: id },
      create: { institutionId: id, pushEnabled: true, vapidPublicKey: keys.publicKey, vapidPrivateKey: encryptSetting(keys.privateKey, id, 'vapid'), vapidSubject: subject, updatedById: actor.id },
      update: { pushEnabled: true, vapidPublicKey: keys.publicKey, vapidPrivateKey: encryptSetting(keys.privateKey, id, 'vapid'), vapidSubject: subject, updatedById: actor.id },
    });
    if (old?.vapidPrivateKey) {
      await tx.webPushSubscription.updateMany({ where: { user: { institutionId: id }, disabledAt: null }, data: { disabledAt: new Date() } });
      await tx.webPushDelivery.updateMany({ where: { subscription: { user: { institutionId: id } }, status: { in: ['PENDING', 'PROCESSING'] } }, data: { status: 'CANCELLED', lastError: 'Claves VAPID regeneradas' } });
    }
    await audit(tx, id, actor, old?.vapidPrivateKey ? 'VAPID_REGENERATED' : legacy ? 'VAPID_IMPORTED' : 'VAPID_GENERATED', { subscriptionsInvalidated: Boolean(old?.vapidPrivateKey) });
  });
  return getIntegrationSettings(actor, id);
}
// Configuración en tiempo real; no se cachea en memoria para que un cambio administrativo
// surta efecto sin reiniciar Express. El SMTP profesional por .env sigue disponible.
export async function resolveInstitutionMail(institutionId) {
  const id = positiveId(institutionId);
  const row = id ? await settingsRecord(id) : null;
  if (row?.smtpEnabled && row.smtpUser && row.smtpSecret) return {
    provider: 'GMAIL', user: row.smtpUser, pass: decryptSetting(row.smtpSecret, id, 'smtp'),
  };
  // Si nunca se configuró SMTP en la ficha (fue creada por Web Push),
  // conservar la configuración heredada del hosting profesional.
  if (row && !row.smtpEnabled && (row.smtpUser || row.smtpSecret)) return { provider: 'DISABLED' };
  if (process.env.BREVO_API_KEY) return { provider: 'BREVO' };
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return { provider: 'SMTP' };
  return { provider: 'DISABLED' };
}
export async function resolveInstitutionPush(institutionId) {
  const id = positiveId(institutionId);
  const row = id ? await settingsRecord(id) : null;
  if (row?.pushEnabled && row.vapidPublicKey && row.vapidPrivateKey && row.vapidSubject) return {
    enabled: true, publicKey: row.vapidPublicKey,
    privateKey: decryptSetting(row.vapidPrivateKey, id, 'vapid'), subject: row.vapidSubject,
  };
  if (row && (row.vapidPrivateKey || row.vapidPublicKey)) return { enabled: false };
  if (process.env.WEB_PUSH_ENABLED === 'true' && process.env.WEB_PUSH_PUBLIC_KEY && process.env.WEB_PUSH_PRIVATE_KEY && process.env.WEB_PUSH_SUBJECT) return {
    enabled: true, publicKey: process.env.WEB_PUSH_PUBLIC_KEY,
    privateKey: process.env.WEB_PUSH_PRIVATE_KEY, subject: process.env.WEB_PUSH_SUBJECT,
  };
  return { enabled: false };
}
