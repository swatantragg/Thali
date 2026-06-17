import './config/env';              // validate env vars first
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env, allowedOrigins } from './config/env';
import { prisma } from './db/client';
import apiRouter from './routes/index';
import { apiLimiter } from './middleware/rateLimit';

const app = express();

// Behind the Next.js rewrite proxy / platform load balancer there is exactly
// one hop. This lets req.ip resolve to the real client (for rate limiting)
// without trusting an arbitrary X-Forwarded-For chain.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// ── Security headers ─────────────────────────────────────────────────────────
// This is a JSON API (no HTML/scripts of its own), so helmet's script CSP is
// irrelevant here — the browser-facing CSP lives in the frontend middleware.
// We keep HSTS, noSniff, frameguard, referrer policy, etc., and allow the
// frontend (different origin in some deploys) to read responses.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: env.NODE_ENV === 'production'
      ? { maxAge: 15552000, includeSubDomains: true, preload: true }
      : false,
  })
);

// ── CORS (strict origin allowlist) ───────────────────────────────────────────
app.use(
  cors({
    origin(origin, cb) {
      // Same-origin / server-to-server (no Origin header) is always allowed.
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })
);

// ── Body parsing (capped to blunt oversized-payload abuse) ────────────────────
app.use(express.json({ limit: '32kb' }));

// ── App-wide rate limit (flood guard) ────────────────────────────────────────
app.use(apiLimiter);

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api', apiRouter);

// ── Health ──────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── 404 ─────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ── Central error handler (never leak stack traces / internals) ──────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof Error && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  // body-parser limit errors (e.g. PayloadTooLargeError) carry a status code.
  const status = (err as { status?: number; statusCode?: number })?.status
    ?? (err as { statusCode?: number })?.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return res.status(status).json({ error: status === 413 ? 'Payload too large' : 'Bad request' });
  }
  console.error('[error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Boot ─────────────────────────────────────────────────────────────────────
const PORT = Number(env.PORT);

async function start() {
  try {
    await prisma.$connect();
    console.log('✅  Database connected');
    app.listen(PORT, () => console.log(`🚀  API listening on http://localhost:${PORT}`));
  } catch (err) {
    console.error('❌  Failed to start:', err);
    process.exit(1);
  }
}

start();
