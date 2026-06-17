import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { register, login, googleLogin, getMe, AuthError } from '../services/auth.service';
import { authLimiter } from '../middleware/rateLimit';

const router = Router();

// Strong password policy: ≥8 chars with upper, lower, digit and symbol, capped
// at 72 bytes (bcrypt's hard limit) to reject silently-truncated long inputs.
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a symbol');

const Credentials = z.object({
  email:    z.string().email().max(254),
  password,
  name:     z.string().trim().min(1).max(80).optional(),
});

// Login only needs presence checks — never reveal the policy on existing creds.
const LoginCredentials = z.object({
  email:    z.string().email().max(254),
  password: z.string().min(1).max(72),
});

function fail(res: Response, err: unknown) {
  if (err instanceof AuthError) return res.status(err.status).json({ error: err.message });
  console.error('[auth]', err);
  return res.status(500).json({ error: 'Authentication failed' });
}

// POST /api/auth/register
router.post('/register', authLimiter, async (req: Request, res: Response) => {
  const parsed = Credentials.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
  try {
    res.status(201).json(await register(parsed.data.email, parsed.data.password, parsed.data.name));
  } catch (err) {
    fail(res, err);
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  const parsed = LoginCredentials.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Email and password required' });
  try {
    res.json(await login(parsed.data.email, parsed.data.password));
  } catch (err) {
    fail(res, err);
  }
});

// POST /api/auth/google   { credential: <Google ID token> }
router.post('/google', authLimiter, async (req: Request, res: Response) => {
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
