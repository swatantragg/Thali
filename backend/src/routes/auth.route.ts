import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { register, login, googleLogin, getMe, AuthError } from '../services/auth.service';

const router = Router();

const Credentials = z.object({
  email:    z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name:     z.string().trim().min(1).optional(),
});

function fail(res: Response, err: unknown) {
  if (err instanceof AuthError) return res.status(err.status).json({ error: err.message });
  console.error('[auth]', err);
  return res.status(500).json({ error: 'Authentication failed' });
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  const parsed = Credentials.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
  try {
    res.status(201).json(await register(parsed.data.email, parsed.data.password, parsed.data.name));
  } catch (err) {
    fail(res, err);
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const parsed = Credentials.pick({ email: true, password: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Email and password required' });
  try {
    res.json(await login(parsed.data.email, parsed.data.password));
  } catch (err) {
    fail(res, err);
  }
});

// POST /api/auth/google   { credential: <Google ID token> }
router.post('/google', async (req: Request, res: Response) => {
  const credential = req.body?.credential;
  if (typeof credential !== 'string' || !credential) {
    return res.status(400).json({ error: 'Missing Google credential' });
  }
  try {
    res.json(await googleLogin(credential));
  } catch (err) {
    fail(res, err);
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    res.json(await getMe((req as AuthRequest).userId));
  } catch (err) {
    fail(res, err);
  }
});

export default router;
