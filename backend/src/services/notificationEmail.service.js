import { notificationEmailRepository as repo } from '../repositories/notificationEmail.repository.js';
import { sendEarlyNoticeEmail, sendInstitutionCommunicationEmail } from '../utils/mailer.js';
import { resolveInstitutionMail } from './integrationSettings.service.js';

const INTERVAL_MS = 15_000;
let timer = null;
let processing = false;

export const processPendingNotificationEmails = async () => {
  if (processing) return;
  processing = true;
  try {
    const pending = await repo.listPending(60);
    for (let offset = 0; offset < pending.length; offset += 4) {
      await Promise.all(pending.slice(offset, offset + 4).map(async ({ id }) => {
      let delivery;
      try {
        delivery = await repo.claim(id);
        if (!delivery) return;
        const notification = delivery.notification;
        if (!notification) {
          await repo.cancel(id, 'Notificación inexistente');
          return;
        }
        // Si dirección todavía no habilitó correo, conservar trabajos pendientes;
        // al guardar SMTP desde Configuración se enviarán sin agotar reintentos.
        const institutionId = notification.institutionEvent?.institutionId
          || notification.earlyNotice?.institutionId;
        const mail = await resolveInstitutionMail(institutionId);
        if (mail.provider === 'DISABLED') {
          await repo.releaseUnconfigured(id);
          return;
        }
        let info;
        if (notification.institutionEventId != null) {
          const event = notification.institutionEvent;
          if (!event || event.deletedAt) {
            await repo.cancel(id, 'Comunicación institucional inexistente o eliminada');
            return;
          }
          // Las cancelaciones deben enviarse aunque isActive sea false.
          if (notification.type !== 'EVENT_CANCELLED' && !event.isActive) {
            await repo.cancel(id, 'Comunicación cancelada antes del envío');
            return;
          }
          info = await sendInstitutionCommunicationEmail({
            to: delivery.recipient,
            title: notification.title,
            message: notification.message,
            notificationType: notification.type,
            event,
            revision: notification.revision,
          });
        } else if (notification.earlyNoticeId != null) {
          if (!notification.earlyNotice?.isActive) {
            await repo.cancel(id, 'Aviso temprano desactivado o inexistente');
            return;
          }
          info = await sendEarlyNoticeEmail({
            to: delivery.recipient,
            title: notification.title,
            message: notification.message,
            notificationType: notification.type,
            notice: notification.earlyNotice,
          });
        } else {
          await repo.cancel(id, 'Notificación sin origen');
          return;
        }
        // SMTP aceptado no significa necesariamente entregado al buzón.
        await repo.markSent(id, info.messageId);
        console.info(`[Avisos I12][EMAIL] Envío aceptado: entrega ${id}`);
      } catch (error) {
        console.error(`[Avisos I12][EMAIL] Error en entrega ${id}:`, error);
        if (delivery) {
          try {
            await repo.markFailure(id, error.message || String(error), delivery.attempts);
          } catch (dbError) {
            console.error(`[Avisos I12][EMAIL] No se pudo registrar fallo ${id}:`, dbError);
          }
        }
      }
      }));
    }
  } catch (error) {
    console.error('[Avisos I12][EMAIL] Error consultando entregas:', error);
  } finally {
    processing = false;
  }
};

export const startNotificationEmailProcessor = () => {
  // La configuración puede activarse por institución desde el panel, sin reiniciar Express.
  // Mantener el procesador disponible; si un destino carece de SMTP, el trabajo se conserva.
  if (timer) return;
  console.info('[Avisos I12][EMAIL] Procesador iniciado (cada 15 segundos)');
  void processPendingNotificationEmails();
  timer = setInterval(() => void processPendingNotificationEmails(), INTERVAL_MS);
  timer.unref?.();
};

export const stopNotificationEmailProcessor = () => {
  if (timer) clearInterval(timer);
  timer = null;
};
