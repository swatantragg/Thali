import rateLimit, { Options, Store } from 'express-rate-limit';

/**
 * Rate limiting strategy
 * ──────────────────────
 * Three layers:
 *
 *  • apiLimiter     — generous, app-wide. Stops a flood (bombardment / scraping /
 *                     retry storms) before it can exhaust the process.
 *  • authLimiter    — strict, per-IP, on credential endpoints. Blunts brute-force.
 *  • accountLimiter — strict, per-EMAIL, on login. Stops credential-stuffing that
 *                     rotates source IPs from hammering a single account.
 *
 * IP-keyed layers use req.ip; `app.set('trust proxy', 1)` in index.ts makes that
 * the real client behind the proxy / load balancer.
 *
 * Store: in-memory by default (fine for ONE long-lived process). Set REDIS_URL to
 * share counters across instances / serverless — otherwise per-instance counters
 * let a spread-out attacker multiply the effective limit.
 */

// Lazily build a Redis-backed store when REDIS_URL is configured. Kept as an
// untyped dynamic require so the optional `rate-limit-redis` / `ioredis`
// packages aren't a hard build-time dependency for single-instance deploys.
function buildStore(): Store | undefined {
  if (!process.env.REDIS_URL) return undefined;
  try {
    /* eslint-disable @typescript-eslint/no-var-requires */
    const { RedisStore } = require('rate-limit-redis');
    const IORedis = require('ioredis');
    /* eslint-enable @typescript-eslint/no-var-requires */
    const client = new IORedis(process.env.REDIS_URL);
    return new RedisStore({ sendCommand: (...args: string[]) => client.call(...args) });
  } catch (err) {
    console.warn(
      '[rateLimit] REDIS_URL set but a Redis store could not be initialised — ' +
      'falling back to in-memory:', (err as Error).message
    );
    return undefined;
  }
}

const store = buildStore();
const withStore = (opts: Partial<Options>): Partial<Options> =>
  (store ? { ...opts, store } : opts);

// ── App-wide flood guard ────────────────────────────────────────────────────
// 300 requests / minute / IP.
export const apiLimiter = rateLimit(withStore({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests — slow down and try again shortly.' },
}));

// ── Credential-endpoint guard (per IP) ──────────────────────────────────────
// 10 attempts / 15 min / IP. Failed *and* successful attempts both count.
export const authLimiter = rateLimit(withStore({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
}));

// ── Per-account lockout (per email) ─────────────────────────────────────────
// 5 FAILED sign-ins / 15 min for a given email, regardless of source IP. Only
// failures count (skipSuccessfulRequests), so legit logins are never penalised.
export const accountLimiter = rateLimit(withStore({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req): string => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return `acct:${email || req.ip}`;
  },
  // Custom (non-IP) key → disable the library's IP-format validation.
  validate: false,
  message: { error: 'Too many failed attempts for this account. Please try again later.' },
}));
