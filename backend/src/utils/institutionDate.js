// Fecha CIVIL de la institución: no depende del huso del servidor Node/Neon.
// Para DateTime @db.Date usar la parte YYYY-MM-DD del ISO en UTC, no una
// conversión a zona horaria (que podría retroceder artificialmente un día).
export const INSTITUTION_TIME_ZONE = 'America/Argentina/Buenos_Aires';

export function institutionToday(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: INSTITUTION_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function institutionDateOf(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw Object.assign(new Error('Fecha inválida'), { status: 400 });
  }
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: INSTITUTION_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function requireCurrentOrFutureDate(value, label = 'La fecha', now = new Date()) {
  const input = value instanceof Date ? institutionDateOf(value) : value;
  if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    throw Object.assign(new Error(`${label} no tiene formato válido`), { status: 400 });
  }
  if (input < institutionToday(now)) {
    throw Object.assign(new Error(`${label} no puede ser anterior a hoy (hora de Argentina)`), { status: 400 });
  }
}


/**
 * Inicio de una clase programada: compare la fecha y HH:mm CIVILES de la institución,
 * independientemente de la zona del servidor (Node/Neon).
 * Para avisos nuevos o reeditados no admite clases que ya hayan comenzado.
 */
export function institutionNowDateTime(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: INSTITUTION_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function requireFutureClassStart(classDate, startTime, label = 'La clase', now = new Date()) {
  if (typeof classDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(classDate) ||
      typeof startTime !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime)) {
    throw Object.assign(new Error(`${label}: fecha u hora inválida`), { status: 400 });
  }
  if (`${classDate}T${startTime}` <= institutionNowDateTime(now)) {
    throw Object.assign(new Error(`${label}: el horario de inicio ya pasó (hora de Argentina). Elegí una clase futura.`), { status: 400 });
  }
}

/** Fecha/hora absoluta, con desplazamiento explícito Z o ±HH:mm. */
export function requireFutureInstant(value, label = 'El inicio', now = new Date()) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw Object.assign(new Error(`${label}: fecha y hora inválidas`), { status: 400 });
  }
  if (value.getTime() <= now.getTime()) {
    throw Object.assign(new Error(`${label}: la fecha y hora deben ser posteriores al momento actual (hora de Argentina).`), { status: 400 });
  }
}
