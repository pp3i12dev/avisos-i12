/** Asignación informativa del preceptor: carrera + turno. No autoriza acciones. */
const SHIFTS = new Set(['MANANA', 'TARDE', 'NOCHE']);
function fail(message, status = 400) { const e = new Error(message); e.status = status; throw e; }

export async function validatePreceptorCoverages(db, institutionId, rawCoverages) {
  if (rawCoverages === undefined || rawCoverages === null) return [];
  if (!Array.isArray(rawCoverages) || rawCoverages.length > 60) fail('Enviá hasta 60 combinaciones de carrera y turno.');
  const institution = Number(institutionId);
  if (!Number.isSafeInteger(institution) || institution <= 0) fail('Institución inválida.');
  const normalized = rawCoverages.map(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) fail('Combinación de carrera y turno inválida.');
    const careerId = Number(row.careerId);
    const shift = typeof row.shift === 'string' ? row.shift.trim().toUpperCase() : '';
    if (!Number.isSafeInteger(careerId) || careerId <= 0 || !SHIFTS.has(shift)) fail('Seleccioná una carrera y un turno válidos.');
    return { careerId, shift };
  });
  const keys = normalized.map(c => `${c.careerId}:${c.shift}`);
  if (keys.length !== new Set(keys).size) fail('La misma carrera y turno fue seleccionada más de una vez.');
  const ids = [...new Set(normalized.map(c => c.careerId))];
  if (ids.length) {
    const matched = await db.career.count({ where: { id: { in: ids }, institutionId: institution } });
    if (matched !== ids.length) fail('Una o más carreras no pertenecen a la institución seleccionada.', 403);
  }
  return normalized;
}

export function legacyShift(coverages) {
  const shifts = [...new Set((coverages || []).map(c => c.shift))];
  return shifts.length === 1 ? shifts[0] : null;
}

export const coverageRelations = {
  coverages: { include: { career: { select: { id: true, nombre: true, institutionId: true } } },
    orderBy: [{ career: { nombre: 'asc' } }, { shift: 'asc' }] },
};
