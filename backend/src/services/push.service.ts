import webpush, { PushSubscription as WebPushSub } from 'web-push';
import { prisma } from '../db/client';
import { env, pushEnabled } from '../config/env';

// Configure the VAPID identity once at module load (only if keys are present).
if (pushEnabled) {
  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.VAPID_PUBLIC_KEY!,
    env.VAPID_PRIVATE_KEY!,
  );
}

// ─── Shape the browser sends from pushManager.subscribe() ──────────────────

export interface BrowserSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

// ─── Persistence ───────────────────────────────────────────────────────────

/** Store (or refresh) a device subscription for a user. Keyed by endpoint. */
export async function saveSubscription(userId: string, sub: BrowserSubscription) {
  return prisma.pushSubscription.upsert({
    where:  { endpoint: sub.endpoint },
    create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    // Re-point an existing endpoint at this user (covers shared-device handoff).
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
}

/** Remove a single subscription by its endpoint. */
export async function deleteSubscription(endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

// ─── Sending ─────────────────────────────────────────────────────────────

function toWebPush(row: { endpoint: string; p256dh: string; auth: string }): WebPushSub {
  return { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
}

/**
 * Send a payload to every device a user has registered. Subscriptions the push
 * service reports as gone (404/410) are pruned so they aren't retried forever.
 * Returns the number of notifications successfully delivered.
 */
export async function sendToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!pushEnabled) return 0;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return 0;

  const body = JSON.stringify(payload);
  const dead: string[] = [];
  let sent = 0;

  await Promise.all(
    subs.map(async sub => {
      try {
        await webpush.sendNotification(toWebPush(sub), body);
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(sub.endpoint);
        else console.error('[push] send failed', status, (err as Error).message);
      }
    }),
  );

  if (dead.length) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: dead } } });
  }
  return sent;
}
