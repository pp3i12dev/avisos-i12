// Identidad visible de los correos institucionales de Avisos I12.
// Nunca cambia la cuenta SMTP: sólo el nombre visible del remitente y el asunto.
export const SHORT_INSTITUTION_NAME = 'ISFTNº12';
export const FULL_INSTITUTION_NAME = 'Instituto Superior de Formación Técnica Nº12';

const EARLY_NOTICE_CATEGORIES = Object.freeze({
  ABSENCE: 'AUSENCIA DOCENTE',
  LATE_ARRIVAL: 'LLEGADA TARDE DOCENTE',
  ATTENDANCE_CONFIRMED: 'CONFIRMACIÓN DE ASISTENCIA',
  VIRTUAL_SYNCHRONOUS: 'DICTADO CLASE VIRTUAL SÍNCRONA',
  VIRTUAL_ASYNCHRONOUS: 'DICTADO CLASE VIRTUAL ASÍNCRONA',
});

export const earlyNoticeCategory = (type) =>
  EARLY_NOTICE_CATEGORIES[type] || 'AVISO TEMPRANO';

export const institutionCategory = (kind) =>
  kind === 'SUSPENSION' ? 'SUSPENSIÓN DE ACTIVIDADES' : 'EVENTO INSTITUCIONAL';

export const brandedPrefix = (category) => `[${SHORT_INSTITUTION_NAME}-${category}]`;

// MAIL_FROM puede ser una dirección suelta o un nombre con dirección entre < >.
// El objeto from de Nodemailer sustituye el nombre "Mi institución" sin alterar la dirección.
export const brandedFrom = (category, configured = process.env.MAIL_FROM || process.env.SMTP_USER) => {
  const raw = String(configured || '').trim();
  const match = raw.match(/<([^<>]+)>/);
  const address = (match ? match[1] : raw).trim();
  if (!address || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)) {
    throw new Error('MAIL_FROM debe contener una dirección de correo válida.');
  }
  return { name: `${SHORT_INSTITUTION_NAME}-${category}`, address };
};
