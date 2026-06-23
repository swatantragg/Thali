import { Router, Request, Response } from 'express';
import { timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { env, pushEnabled } from '../config/env';
import { saveSubscription, deleteSubscription } from '../services/push.service';
import { runMealReminders } from '../services/reminder.service';

const router = Router();

/** Constant-time check of a provided secret against CRON_SECRET. */
function validCronSecret(provided: string | undefined): boolean {
  if (!env.CRON_SECRET || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(env.CRON_SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}

const SubscriptionBody = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth:   z.string().min(1).max(256),
  }),
});

const UnsubscribeBody = z.object({
  endpoint: z.string().url().max(2048),
});

// GET /api/push/vapid-public-key — public; the browser needs it to subscribe.
router.get('/vapid-public-key', (_req: Request, res: Response) => {
  if (!pushEnabled) return res.status(404).json({ error: 'Push notifications are not enabled' });
  res.json({ key: env.VAPID_PUBLIC_KEY });
});

// POST /api/push/subscribe — register this device for reminders.
router.post('/subscribe', authenticate, async (req, res: Response) => {
  if (!pushEnabled) return res.status(404).json({ error: 'Push notifications are not enabled' });

  const parsed = SubscriptionBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid subscription' });

  try {
    await saveSubscription((req as AuthRequest).userId, parsed.data);
    res.status(201).json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// POST /api/push/unsubscribe — drop this device.
router.post('/unsubscribe', authenticate, async (req, res: Response) => {
  const parsed = UnsubscribeBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid endpoint' });

  try {
    await deleteSubscription(parsed.data.endpoint);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
});

// POST /api/push/run-reminders — external scheduler trigger.
// For hosts that sleep on idle (Render free), where the in-process cron can't
// be relied on. Authenticated by the shared CRON_SECRET, not a user JWT.
// Call from cron-job.org / a Render Cron Job / GitHub Actions at the desired
// time with header:  Authorization: Bearer <CRON_SECRET>
router.post('/run-reminders', async (req: Request, res: Response) => {
  if (!env.CRON_SECRET) return res.status(404).json({ error: 'Not enabled' });

  const auth = req.headers.authorization;
  const provided = auth?.startsWith('Bearer ')
    ? auth.slice(7)
    : (req.headers['x-cron-secret'] as string | undefined);
  if (!validCronSecret(provided)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const notified = await runMealReminders();
    res.json({ ok: true, notified });
  } catch {
    res.status(500).json({ error: 'Failed to run reminders' });
  }
});

export default router;
