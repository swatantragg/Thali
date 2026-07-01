import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../db/client';
import { parseCookies, COOKIE } from '../config/cookies';

export interface AuthRequest extends Request {
  userId: string;
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  // ── Development bypass ───────────────────────────────────────────────
  if (env.NODE_ENV === 'development' && env.DEV_USER_ID) {
    (req as AuthRequest).userId = env.DEV_USER_ID;
    next();
    return;
  }

  // ── JWT verification ─────────────────────────────────────────────────
  if (!env.JWT_SECRET) {
    res.status(500).json({ error: 'JWT_SECRET not configured. Set DEV_USER_ID for local development.' });
    return;
  }

  // Prefer the httpOnly session cookie; fall back to a Bearer header so
  // non-browser API clients still work.
  const cookies = parseCookies(req);
  const header = req.headers.authorization;
  const token =
    cookies[COOKIE.TOKEN] ??
    (header?.startsWith('Bearer ') ? header.slice(7) : undefined);

  if (!token) {
    res.status(401).json({ error: 'Missing authentication' });
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    const userId = payload.sub ?? payload.userId;
    if (!userId || typeof userId !== 'string') throw new Error('No user id in token');

    // Revocation check: the token's `tv` must match the user's current
    // tokenVersion. A bumped version (logout-everywhere / compromise) or a
    // deleted user invalidates the token immediately, despite its 30-day expiry.
    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: { tokenVersion: true },
    });
    if (!user) throw new Error('User no longer exists');
    const tv = typeof payload.tv === 'number' ? payload.tv : 0;
    if (tv !== user.tokenVersion) throw new Error('Token has been revoked');

    (req as AuthRequest).userId = userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
