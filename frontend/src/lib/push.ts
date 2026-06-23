// Client helpers for Web Push (nightly meal reminders).
// All network calls go through the token-aware `api()` wrapper.

import { api } from './api';

/** Push + notifications + service worker all available in this browser? */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Current Notification permission ('default' | 'granted' | 'denied'). */
export function pushPermission(): NotificationPermission {
  return isPushSupported() ? Notification.permission : 'denied';
}

// VAPID public key is base64url; the Push API wants the raw bytes. Allocate
// from an explicit ArrayBuffer so the result is a BufferSource the DOM types
// accept (not a possibly-SharedArrayBuffer-backed view).
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** The active push subscription for this device, if any. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/** True if reminders are currently enabled on this device. */
export async function isPushEnabled(): Promise<boolean> {
  return (await currentSubscription()) !== null;
}

/**
 * Enable reminders: request permission, subscribe via the SW, and register the
 * subscription with the backend. Throws Error(message) on any failure so the
 * caller can surface it.
 */
export async function enablePush(): Promise<void> {
  if (!isPushSupported()) throw new Error('Notifications aren’t supported on this device');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notifications are blocked — enable them in your browser settings'
        : 'Notification permission was dismissed',
    );
  }

  // Fetch the server's VAPID public key.
  const keyRes = await api('/push/vapid-public-key');
  if (!keyRes.ok) throw new Error('Push notifications aren’t enabled on the server');
  const { key } = await keyRes.json();
  if (!key) throw new Error('Server did not return a push key');

  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    }));

  const res = await api('/push/subscribe', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(sub),
  });
  if (!res.ok) {
    await sub.unsubscribe().catch(() => {});
    throw new Error('Failed to register for reminders');
  }
}

/** Disable reminders on this device (unsubscribe + tell the backend). */
export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await api('/push/unsubscribe', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

/** Fire a server-sent test notification to confirm the setup works. */
export async function sendTestPush(): Promise<void> {
  const res = await api('/push/test', { method: 'POST' });
  if (!res.ok) throw new Error('Could not send a test notification');
}
