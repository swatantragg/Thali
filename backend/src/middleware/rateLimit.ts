import rateLimit from 'express-rate-limit';

/**
 * Rate limiting strategy
 * ──────────────────────
 * Two layers, both in-memory (single backend instance):
 *
 *  • apiLimiter  — generous, app-wide. Normal use never trips it; it only
 *                  stops a flood (request bombardment / scraping / accidental
 *                  retry storms) before it can exhaust the process.
 *  • authLimiter — strict, on credential endpoints only. Blunts brute-force
 *                  and credential-stuffing against /auth/login etc.
 *
 * Keying is by client IP. The default keyGenerator reads req.ip (IPv6-safe);
 * `app.set('trust proxy', 1)` in index.ts makes req.ip the real client behind
 * the Next.js rewrite proxy / platform load balancer.
 *
 * NOTE: in-memory counters assume ONE long-lived backend process. If you scale
 * to multiple instances or serverless, swap the `store` for a shared one
 * (e.g. rate-limit-redis) so limits are enforced globally.
 */

// ── App-wide flood guard ────────────────────────────────────────────────────
// 300 requests / minute / IP. A real user browsing + logging meals stays far
// below this; a bombardment is throttled with 429 instead of crashing the API.
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests — slow down and try again shortly.' },
});

// ── Credential-endpoint guard ───────────────────────────────────────────────
// 10 attempts / 15 min / IP. Failed *and* successful attempts both count, so a
// stolen-list stuffing run is quickly shut out.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});
