import { Request, Response } from 'express';
import crypto from 'crypto';
import { env } from './env';

/**
 * Auth is carried in cookies (not localStorage) so a stolen-via-XSS token is no
 * longer possible: the session token is httpOnly (unreadable by JS). CSRF is
 * then defended with the double-submit pattern — a readable `csrf` cookie whose
 * value the client echoes back in the `X-CSRF-Token` header on mutations.
 */

export const COOKIE = {
  TOKEN: 'thali_token',   // httpOnly JWT — the actual session credential
  CSRF:  'thali_csrf',    // readable random — double-submit CSRF token
  EXP:   'thali_session_exp', // readable expiry (ms) — drives client auto-logout UX
} as const;

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30d — matches JWT_EXPIRES_IN

// Secure only over HTTPS: a Secure cookie is dropped on http://localhost, which
// would break local dev, so it's enabled in production only. SameSite=Strict
// stops the cookie from ever riding a cross-site request (primary CSRF defence).
const base = {
  sameSite: 'strict' as const,
  secure:   env.NODE_ENV === 'production',
  path:     '/',
};

export function setAuthCookies(res: Response, token: string): void {
  const csrf = crypto.randomBytes(32).toString('hex');
  res.cookie(COOKIE.TOKEN, token, { ...base, httpOnly: true,  maxAge: MAX_AGE_MS });
  res.cookie(COOKIE.CSRF,  csrf,  { ...base, httpOnly: false, maxAge: MAX_AGE_MS });
  res.cookie(COOKIE.EXP, String(Date.now() + MAX_AGE_MS), { ...base, httpOnly: false, maxAge: MAX_AGE_MS });
}

export function clearAuthCookies(res: Response): void {
  // Attributes must match those used when setting, or the browser keeps the cookie.
  res.clearCookie(COOKIE.TOKEN, { ...base, httpOnly: true });
  res.clearCookie(COOKIE.CSRF,  { ...base, httpOnly: false });
  res.clearCookie(COOKIE.EXP,   { ...base, httpOnly: false });
}

/** Parse the Cookie header into a map (no cookie-parser dependency needed). */
export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k) out[k] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}
