import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto';

// AES-256-GCM con clave separada, derivada de JWT_SECRET mediante HKDF.
// Nunca se envía JWT_SECRET a React ni se usa directamente para cifrar.
// Mantener JWT_SECRET estable: cambiarlo invalida las sesiones y la lectura de v2.
const keyFromJwt = (institutionId) => {
  const secret = process.env.JWT_SECRET;
  if (!secret || !secret.trim()) {
    const error = new Error('No está disponible la configuración de seguridad de la sesión.');
    error.status = 503;
    throw error;
  }
  return Buffer.from(hkdfSync(
    'sha256', Buffer.from(secret, 'utf8'),
    Buffer.from(`avisos-i12/institution/${institutionId}`, 'utf8'),
    Buffer.from('integration-settings/aes-256-gcm/v2', 'utf8'), 32,
  ));
};

// Compatibilidad para secretos v1 guardados por la Etapa 29. Esta clave SOLO
// es necesaria temporalmente si ya existen secretos v1 en Neon.
const legacyKey = () => {
  const legacy = process.env.APP_CONFIG_ENCRYPTION_KEY;
  if (!legacy || legacy.length < 32) {
    const error = new Error('Hay claves cifradas con el formato antiguo v1. Conservá temporalmente APP_CONFIG_ENCRYPTION_KEY para migrarlas; después podrás retirarla.');
    error.status = 503;
    throw error;
  }
  return createHash('sha256').update(legacy, 'utf8').digest();
};

export const encryptionReady = () => Boolean(process.env.JWT_SECRET?.trim());
export const isLegacyEncrypted = value => typeof value === 'string' && value.startsWith('v1.');

export function encryptSetting(value, institutionId, field) {
  if (!value) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFromJwt(institutionId), iv);
  cipher.setAAD(Buffer.from(`${institutionId}:${field}`, 'utf8'));
  const content = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return ['v2', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), content.toString('base64url')].join('.');
}

export function decryptSetting(payload, institutionId, field) {
  if (!payload) return null;
  const [version, iv, tag, data, unexpected] = String(payload).split('.');
  if (!['v1', 'v2'].includes(version) || !iv || !tag || !data || unexpected) {
    const error = new Error('Formato de secreto institucional inválido.');error.status = 503;throw error;
  }
  const key = version === 'v1' ? legacyKey() : keyFromJwt(institutionId);
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    decipher.setAAD(Buffer.from(`${institutionId}:${field}`, 'utf8'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    const error = new Error('No se pudo descifrar la configuración. Revisá que JWT_SECRET no haya cambiado y que la clave antigua siga disponible si el secreto es v1.');
    error.status = 503;
    throw error;
  }
}
