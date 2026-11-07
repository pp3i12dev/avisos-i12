// yyyy-mm-dd de Buenos Aires, compatible con inputs type="date".
export function todayArgentina() {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}


/** Fecha y hora local de la institución en formato compatible con datetime-local. */
export function nowArgentina(now = new Date()) {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

/** La clase debe comenzar estrictamente después del minuto actual. */
export const hasClassTimePassed = (classDate, startTime, now = nowArgentina()) =>
  Boolean(classDate && startTime && `${classDate}T${startTime}` <= now);
