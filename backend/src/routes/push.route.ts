import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { env, pushEnabled } from '../config/env';
import { saveSubscription, deleteSubscription, sendToUser } from '../services/push.service';
import { randomQuote } from '../services/quotes';

const router = Router();

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

// POST /api/push/test — send a one-off notification to the caller's devices,
// so they can confirm notifications work without waiting for 10:30 PM.
router.post('/test', authenticate, async (req, res: Response) => {
  if (!pushEnabled) return res.status(404).json({ error: 'Push notifications are not enabled' });

  try {
    const sent = await sendToUser((req as AuthRequest).userId, {
      title: 'Thali reminder test ✅',
      body:  randomQuote(),
      url:   '/',
      tag:   'thali-test',
    });
    res.json({ ok: true, sent });
  } catch {
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

export default router;
