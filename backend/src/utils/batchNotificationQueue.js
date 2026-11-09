/**
 * Persistencia masiva y deduplicada de notificaciones. No envía SMTP/Web Push
 * dentro de una transacción: solo encola trabajos duraderos para sus procesadores.
 * Evita cientos de roundtrips para cursos numerosos.
 */
const slices = (list, size = 200) => Array.from({length: Math.ceil(list.length / size)}, (_,i)=>list.slice(i*size,(i+1)*size));

export async function queueRecipientBatch(tx, {
  origin, originId, type, title, message, revision, userIds,
}) {
  if (!['earlyNoticeId','institutionEventId'].includes(origin)) throw new Error('Origen de notificación inválido');
  if (!Number.isSafeInteger(originId) || !Number.isSafeInteger(revision) || revision < 1) throw new Error('Identificadores inválidos');
  const uniqueIds = [...new Set(userIds.map(Number).filter(x => Number.isSafeInteger(x) && x > 0))];
  if (!uniqueIds.length) return 0;
  // Revalidar existencia/estado del usuario dentro de la transacción.
  const users = await tx.user.findMany({ where: { id: { in: uniqueIds }, isActive: true, deletedAt: null },
    select: { id: true, email: true } });
  if (!users.length) return 0;
  for (const chunk of slices(users)) {
    await tx.notification.createMany({ data: chunk.map(u=>({ userId: u.id, [origin]: originId, type, title, message, revision })), skipDuplicates: true });
  }
  const notifications = [];
  for (const chunk of slices(users)) {
    notifications.push(...await tx.notification.findMany({
      where: { [origin]: originId, type, revision, userId: { in: chunk.map(u => u.id) } },
      select: { id: true, userId: true },
    }));
  }
  const emailById = new Map(users.map(u => [u.id, u.email]));
  for (const chunk of slices(notifications)) {
    const emails = chunk.filter(n=>emailById.get(n.userId)).map(n=>({
      notificationId: n.id, channel: 'EMAIL', recipient: emailById.get(n.userId),
    }));
    if (emails.length) await tx.notificationDelivery.createMany({ data: emails, skipDuplicates: true });
  }
  // Encolar independientemente de WEB_PUSH_ENABLED del .env: la habilitación
  // se administra por institución desde Configuración y se verifica al entregar.
  // De este modo, habilitar Push desde React no requiere reiniciar el backend.
  const subscriptions = await tx.webPushSubscription.findMany({
    where: { userId: { in: users.map(u => u.id) }, disabledAt: null }, select: { id: true, userId: true },
  });
  const byUser = new Map();
  for (const device of subscriptions) {
    if (!byUser.has(device.userId)) byUser.set(device.userId, []);
    byUser.get(device.userId).push(device.id);
  }
  for (const chunk of slices(notifications)) {
    const deliveries = chunk.flatMap(n => (byUser.get(n.userId) || []).map(subscriptionId => ({ subscriptionId, notificationId: n.id })));
    for (const subchunk of slices(deliveries)) if (subchunk.length) {
      await tx.webPushDelivery.createMany({ data: subchunk, skipDuplicates: true });
    }
  }
  return users.length;
}
