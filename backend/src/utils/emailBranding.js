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

// La cuenta del remitente se resuelve exclusivamente desde Neon por institución.
// Este helper genera solo el nombre visible; sendConfiguredMail() añade la
// dirección Gmail almacenada en institutionIntegrationSettings.smtpUser.
export const brandedFrom = category => ({
  name: `${SHORT_INSTITUTION_NAME}-${category}`,
});
