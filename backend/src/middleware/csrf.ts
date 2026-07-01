import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { parseCookies, COOKIE } from '../config/cookies';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Constant-time string compare (guards the token check against timing probes). */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/**
 * Double-submit CSRF guard. Only cookie-authenticated sessions are at risk (a
 * browser auto-attaches cookies to forged cross-site requests), so we enforce
 * the check exactly when the request carries our session cookie. Bearer-token
 * clients and pre-login requests have no session cookie → nothing to forge.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();

  const cookies = parseCookies(req);
  if (!cookies[COOKIE.TOKEN]) return next();   // not a cookie session → not CSRF-eligible

  const cookieToken = cookies[COOKIE.CSRF];
  const headerToken = req.get('x-csrf-token');
  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    res.status(403).json({ error: 'Invalid or missing CSRF token' });
    return;
  }
  next();
}
