import { Router, Response } from 'express';
import { z } from 'zod';
import { Meal } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getFasts, addFast, removeFast } from '../services/fast.service';

const router = Router();

const FastBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meal: z.nativeEnum(Meal),
});

// GET /api/fasts  — all fasted meals for the user
router.get('/', authenticate, async (req, res: Response) => {
  try {
    const fasts = await getFasts((req as AuthRequest).userId);
    res.json(fasts);
  } catch {
    res.status(500).json({ error: 'Failed to fetch fasts' });
  }
});

// POST /api/fasts  — mark a meal as fasted
router.post('/', authenticate, async (req, res: Response) => {
  const parsed = FastBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const fast = await addFast((req as AuthRequest).userId, parsed.data.date, parsed.data.meal);
    res.status(201).json(fast);
  } catch {
    res.status(500).json({ error: 'Failed to save fast' });
  }
});

// DELETE /api/fasts  — clear a fasted-meal mark
router.delete('/', authenticate, async (req, res: Response) => {
  const parsed = FastBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    await removeFast((req as AuthRequest).userId, parsed.data.date, parsed.data.meal);
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Failed to remove fast' });
  }
});

export default router;
