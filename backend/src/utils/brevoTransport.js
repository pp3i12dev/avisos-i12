/**
 * Adaptador HTTPS para correos transaccionales Brevo.
 * Mantiene la interfaz sendMail() utilizada por el mailer existente.
 * No guarda credenciales en el navegador ni registra tokens en logs.
 */
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

function recipientList(to) {
  const input = Array.isArray(to) ? to : typeof to === 'string' ? to.split(',') : [to];
  const unique = new Map();
  for (const item of input) {
    if (typeof item === 'string') {
      const email = item.trim();
      if (!EMAIL_RE.test(email)) throw new Error('Destinatario de correo inválido.');
      unique.set(email.toLowerCase(), { email });
    } else if (item && typeof item === 'object') {
      const email = String(item.address || item.email || '').trim();
      if (!EMAIL_RE.test(email)) throw new Error('Destinatario de correo inválido.');
      unique.set(email.toLowerCase(), { email, ...(item.name ? { name: String(item.name) } : {}) });
    } else throw new Error('Destinatario de correo inválido.');
  }
  if (!unique.size) throw new Error('Falta destinatario del correo.');
  return [...unique.values()];
}

function senderOf(from) {
  if (typeof from === 'string') {
    const match = from.match(/^(.+?)\s*<([^<>]+)>$/);
    const email = match ? match[2].trim() : from.trim();
    if (!EMAIL_RE.test(email)) throw new Error('Remitente de correo inválido.');
    return { email, ...(match ? { name: match[1].trim().replace(/^['"]|['"]$/g, '') } : {}) };
  }
  const email = String(from?.address || '').trim();
  if (!EMAIL_RE.test(email)) throw new Error('Remitente de correo inválido.');
  return { email, ...(from?.name ? { name: String(from.name) } : {}) };
}

export function createBrevoTransport({ apiKey, fetchImpl = fetch, timeoutMs = 12000 }) {
  if (!apiKey) throw new Error('Falta BREVO_API_KEY.');
  return {
    async sendMail({ from, to, subject, html, text }) {
      const body = {
        sender: senderOf(from),
        to: recipientList(to),
        subject: String(subject || '').trim(),
        ...(html ? { htmlContent: String(html) } : { textContent: String(text || '') }),
      };
      if (!body.subject) throw new Error('Asunto obligatorio.');
      const response = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        // No registrar la respuesta completa: podría contener datos personales.
        throw new Error(`Brevo rechazó el correo (HTTP ${response.status}).`);
      }
      const result = await response.json();
      return { messageId: result.messageId || null, accepted: body.to.map(x => x.email) };
    },
  };
}
