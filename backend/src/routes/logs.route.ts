import { Router, Response } from 'express';
import { z } from 'zod';
import { Meal } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
  addFoodLog,
  updateFoodLog,
  deleteFoodLog,
  getAllLogs,
  getLogsForDay,
  getDailyTotals,
} from '../services/foodLog.service';

const router = Router();

const AddLogBody = z.object({
  foodId:   z.number().int().positive(),
  meal:     z.nativeEnum(Meal),
  date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quantity: z.number().positive(),  // grams
});

// GET /api/logs?date=YYYY-MM-DD
// GET /api/logs                    (all, for initial load)
router.get('/', authenticate, async (req, res: Response) => {
  const userId = (req as AuthRequest).userId;
  try {
    if (req.query.date) {
      const logs = await getLogsForDay(userId, req.query.date as string);
      return res.json(logs);
    }
    const logs = await getAllLogs(userId);
    res.json(logs);
  } catch {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// GET /api/logs/totals?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/totals', authenticate, async (req, res: Response) => {
  const { from, to } = req.query as Record<string, string>;
  if (!from || !to) return res.status(400).json({ error: 'from and to are required' });

  try {
    const totals = await getDailyTotals((req as AuthRequest).userId, from, to);
    res.json(totals);
  } catch {
    res.status(500).json({ error: 'Failed to fetch totals' });
  }
});

// POST /api/logs
router.post('/', authenticate, async (req, res: Response) => {
  const parsed = AddLogBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { foodId, meal, date, quantity } = parsed.data;
  try {
    const entry = await addFoodLog(
      (req as AuthRequest).userId,
      BigInt(foodId),
      date,
      meal,
      quantity
    );
    res.status(201).json(entry);
  } catch (err: unknown) {
    // Don't echo internal/DB error text back to the client.
    console.error('[logs] add failed', err);
    res.status(500).json({ error: 'Failed to add log' });
  }
});

// PATCH /api/logs/:id  — edit a logged dish's quantity (recomputes macros)
const UpdateLogBody = z.object({ quantity: z.number().positive() });

router.patch('/:id', authenticate, async (req, res: Response) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid log id' });
  }
  const parsed = UpdateLogBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const entry = await updateFoodLog(
      BigInt(req.params.id),
      (req as AuthRequest).userId,
      parsed.data.quantity
    );
    res.json(entry);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Log not found') {
      return res.status(404).json({ error: 'Log not found' });
    }
    console.error('[logs] update failed', err);
    res.status(500).json({ error: 'Failed to update log' });
  }
});

// DELETE /api/logs/:id
router.delete('/:id', authenticate, async (req, res: Response) => {
  // Guard the path param before BigInt() throws on non-numeric input.
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid log id' });
  }
  const id = BigInt(req.params.id);
  try {
    await deleteFoodLog(id, (req as AuthRequest).userId);
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Failed to delete log' });
  }
});

export default router;
