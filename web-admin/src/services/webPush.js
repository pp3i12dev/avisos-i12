import api from '../api/axios';

function bytesFromBase64Url(text) {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

export function pushSupport() {
  if (typeof window === 'undefined' || !window.isSecureContext) {
    return { ok: false, reason: 'Abrí Avisos I12 mediante HTTPS (o localhost en computadora).' };
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { ok: false, reason: 'Este navegador no admite Web Push.' };
  }
  const iphone = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (iphone && !installed) {
    return { ok: false, reason: 'En iPhone instalá la web en Inicio y abrí Avisos I12 desde su ícono para activar avisos.' };
  }
  if (Notification.permission === 'denied') {
    return { ok: false, reason: 'Bloqueaste las notificaciones. Cambiá el permiso desde los ajustes del navegador o dispositivo.' };
  }
  return { ok: true };
}

// Preparar antes de mostrar un botón activo. iOS necesita que la llamada a
// requestPermission / subscribe ocurra como respuesta al toque, sin esperas de red.
export async function prepareWebPush(userId) {
  const capability = pushSupport();
  if (!capability.ok) throw new Error(capability.reason);
  const [config, registration] = await Promise.all([
    api.get('/push/config').then(response => response.data),
    navigator.serviceWorker.register('/sw.js', { scope: '/' }),
  ]);
  if (!config?.enabled || !config?.publicKey) throw new Error('El backend no tiene Web Push habilitado con claves VAPID válidas.');
  await navigator.serviceWorker.ready;
  const activeWorker = registration.active || registration.waiting;
  if (!activeWorker || new URL(activeWorker.scriptURL).pathname !== '/sw.js') {
    throw new Error('No se pudo activar el service worker de Avisos I12. Revisá /sw.js y recargá la página.');
  }
  let existingSubscription = await registration.pushManager.getSubscription();
  // Si otro usuario inicia sesión en el mismo navegador, revocar la suscripción
  // anterior a nivel Push (no alterar la configuración institucional).
  const previousOwner = readPushOwner();
  if (existingSubscription && previousOwner && String(userId) !== previousOwner) {
    await existingSubscription.unsubscribe();
    existingSubscription = null;
    forgetPushOwner();
  }
  if (existingSubscription?.options?.applicationServerKey) {
    const expected = bytesFromBase64Url(config.publicKey);
    const current = new Uint8Array(existingSubscription.options.applicationServerKey);
    const matches = expected.length === current.length && expected.every((b, i) => b === current[i]);
    if (!matches) {
      // No reutilizar una suscripción anterior firmada con otra clave VAPID.
      try { await api.delete('/push/subscriptions', { data: { endpoint: existingSubscription.endpoint } }); }
      catch { /* El nuevo registro sustituirá la preferencia anterior. */ }
      await existingSubscription.unsubscribe();
      existingSubscription = null;
    }
  }
  return { registration, publicKey: config.publicKey, existingSubscription };
}

export async function activatePush(prepared, userId) {
  if (!prepared?.registration || !prepared?.publicKey) throw new Error('La aplicación todavía está preparando las notificaciones.');
  const capability = pushSupport();
  if (!capability.ok) throw new Error(capability.reason);
  // Primera operación del clic: no intercalar solicitudes HTTP antes del permiso.
  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('No se concedió el permiso. Podés intentarlo más adelante desde Mi perfil.');
  const sub = prepared.existingSubscription || await prepared.registration.pushManager.subscribe({
    userVisibleOnly: true, applicationServerKey: bytesFromBase64Url(prepared.publicKey),
  });
  try {
    await api.post('/push/subscriptions', { subscription: sub.toJSON() });
    rememberPushOwner(userId);
  } catch (error) {
    throw new Error(error.response?.data?.message || 'No se pudo asociar este navegador a tu cuenta.');
  }
  return sub;
}

export async function currentPushStatus(prepared) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !prepared) return false;
  const sub = prepared.existingSubscription || await prepared.registration.pushManager.getSubscription();
  if (!sub) return false;
  const { data } = await api.post('/push/status', { endpoint: sub.endpoint });
  return Boolean(data.active);
}

export async function deactivatePush(prepared) {
  if (!prepared) return;
  const sub = await prepared.registration.pushManager.getSubscription();
  if (!sub) return;
  await api.delete('/push/subscriptions', { data: { endpoint: sub.endpoint } });
  await sub.unsubscribe();
  forgetPushOwner();
}

export async function testWebPush(prepared) {
  const sub = await prepared?.registration?.pushManager.getSubscription();
  if (!sub) throw new Error('Activá primero las notificaciones en este dispositivo.');
  const { data } = await api.post('/push/test', { endpoint: sub.endpoint });
  return data;
}

// La identidad dueña de la suscripción actual evita filtrar avisos entre
// cuentas distintas que usan un mismo navegador. No almacena credenciales.
const pushOwnerKey = 'avisos-i12.push.device-owner';
function readPushOwner() {
  try { return localStorage.getItem(pushOwnerKey); }
  catch { return null; }
}
export function rememberPushOwner(userId) {
  if (userId === null || userId === undefined || userId === '') return;
  try { localStorage.setItem(pushOwnerKey, String(userId)); }
  catch { /* El estado real sigue en PostgreSQL y PushManager. */ }
}
export function forgetPushOwner() {
  try { localStorage.removeItem(pushOwnerKey); }
  catch { /* Sin almacenamiento local. */ }
}

// La preferencia solo identifica la cuenta que autorizó Push en ESTE navegador.
// No contiene tokens, endpoints ni credenciales; nunca se comparte entre usuarios.
const preferenceKey = userId => `avisos-i12.push.preferido.usuario.${String(userId)}`;
const oldPreferenceKey = userId => `eduquest.push.preferido.usuario.${String(userId)}`;
export function preferredPushEnabled(userId) {
  if (userId === null || userId === undefined || userId === '') return false;
  try { return localStorage.getItem(preferenceKey(userId)) === '1' || localStorage.getItem(oldPreferenceKey(userId)) === '1'; }
  catch { return false; }
}
export function rememberPushPreference(userId, enabled) {
  if (userId === null || userId === undefined || userId === '') return;
  try {
    if (enabled) localStorage.setItem(preferenceKey(userId), '1');
    else localStorage.removeItem(preferenceKey(userId));
    localStorage.removeItem(oldPreferenceKey(userId));
  } catch { /* Almacenamiento no disponible: la activación manual continúa funcionando. */ }
}

// En React hay dos controles Push (Perfil y encabezado). Compartir la misma
// promesa evita que intenten subscribir el mismo navegador simultáneamente.
const restoringByUser = new Map();
export function restorePreferredPush(prepared, userId) {
  if (!prepared || !preferredPushEnabled(userId) || Notification.permission !== 'granted') {
    return Promise.resolve(null);
  }
  const key = String(userId);
  if (restoringByUser.has(key)) return restoringByUser.get(key);
  const task = (async () => {
    const existing = await prepared.registration.pushManager.getSubscription();
    if (existing) {
      const { data } = await api.post('/push/status', { endpoint: existing.endpoint });
      if (data?.active) return existing;
    }
    // El permiso ya fue concedido por el usuario. No se vuelve a solicitar.
    // Reasociamos exclusivamente con el usuario actualmente autenticado.
    return activatePush({ ...prepared, existingSubscription: existing }, userId);
  })().finally(() => restoringByUser.delete(key));
  restoringByUser.set(key, task);
  return task;
}
