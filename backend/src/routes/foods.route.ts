import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { searchFoods, createCustomFood } from '../services/nutrition.service';

const router = Router();

// GET /api/foods/search?q=chicken
router.get('/search', authenticate, async (req, res: Response) => {
  const q = (req.query.q as string)?.trim();
  if (!q || q.length < 2) return res.status(400).json({ error: 'q must be at least 2 characters' });

  try {
    const foods = await searchFoods(q);
    res.json(foods);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Food search failed';
    res.status(502).json({ error: msg });
  }
});

// POST /api/foods  — create a custom "Others" dish (all macro fields required, per 100g)
const CustomFoodBody = z.object({
  name:            z.string().trim().min(1).max(120),
  caloriesPer100g: z.number().nonnegative(),
  protein:         z.number().nonnegative(),
  carbs:           z.number().nonnegative(),
  fat:             z.number().nonnegative(),
  fibre:           z.number().nonnegative(),
});

router.post('/', authenticate, async (req, res: Response) => {
  const parsed = CustomFoodBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const food = await createCustomFood(parsed.data);
    res.status(201).json(food);
  } catch (err: unknown) {
    console.error('[foods] custom create failed', err);
    res.status(500).json({ error: 'Failed to save custom food' });
  }
});

export default router;
