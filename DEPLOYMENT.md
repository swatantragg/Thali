# Thali — Deploy + Security Guide

DB already hosted (Neon). This covers shipping the **frontend** and **backend**
and locking the app down.

---

## 1. Can frontend AND backend both live on Vercel?

- **Frontend (Next.js): yes — Vercel is the native target. Use it.**
- **Backend (Express + Prisma): technically yes, but not recommended as-is.**

Why not:
- Vercel runs **serverless functions**, not your `Dockerfile`. It will **not**
  build/run `backend/Dockerfile` — Docker is for self-/container hosting, not Vercel.
- The **rate limiter is in-memory**. Serverless = many short-lived isolated
  instances → counters aren't shared → flood protection becomes near-useless.
- Express expects a long-lived process; serverless cold-starts every idle period.

### Recommended split (best security + zero code change)
- **Frontend → Vercel** (native).
- **Backend → a container host that runs your Dockerfile**: Render, Railway,
  Fly.io, or any VPS with `docker compose`. In-memory rate limiting works,
  process stays warm, Prisma pooling is stable.

### If you insist on backend-on-Vercel
Do both of these or the protections degrade:
1. Wrap Express in `api/[...all].ts` serverless handler.
2. Replace the in-memory limiter store with **Upstash Redis**
   (`rate-limit-redis`) so limits are enforced across instances.
Then Docker is unused (Vercel ignores it).

---

## 2. Architecture (how the pieces talk)

```
Browser ──https──> Vercel (Next.js)  ──/api/* rewrite──>  Backend (HTTPS)  ──> Neon Postgres
```

The browser only ever talks to the **frontend origin**. `next.config.js`
rewrites `/api/*` to `API_URL` server-side. Benefits:
- No backend URL/port in the browser bundle.
- Browser sees same-origin → no CORS exposure to users.
- The bearer token never crosses to a third origin.

---

## 3. Deploy the BACKEND (Render example — Docker)

1. Push repo to GitHub.
2. Render → **New → Web Service → Docker**, root = `Thali/backend`.
3. Set env vars (Dashboard → Environment) — **do NOT commit these**:
   ```
   NODE_ENV=production
   JWT_SECRET=<NEW 64+ char secret>          # node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   JWT_EXPIRES_IN=30d
   DEV_USER_ID=                              # leave EMPTY (server refuses to boot otherwise)
   DATABASE_URL=<Neon pooled URL>
   DIRECT_URL=<Neon direct URL>
   GOOGLE_CLIENT_ID=<your google client id>
   FDC_API_KEY=<your USDA key>
   CLIENT_URL=https://<your-frontend>.vercel.app   # exact origin(s), comma-separated
   REDIS_URL=                                # optional; set only for >1 instance/serverless
   ```
4. **Run the DB migration** (adds the `token_version` column used for session
   revocation): from `backend/`, `npm run db:push` (or `prisma migrate deploy`
   in CI). Safe/additive — new column defaults to 0.
5. Health check path: `/health`.
6. Deploy → note the public URL, e.g. `https://thali-api.onrender.com`.

(Railway / Fly.io / VPS: same env vars; on a VPS just `docker compose up -d --build`
after pointing `CLIENT_URL` at the real frontend domain.)

---

## 4. Deploy the FRONTEND (Vercel)

1. Vercel → **New Project** → import repo, root = `Thali/frontend`.
2. Environment Variables:
   ```
   API_URL=https://thali-api.onrender.com          # server-side only, no NEXT_PUBLIC_
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=<same google client id>   # build-time, inlined
   ```
   `API_URL` powers the `/api` rewrite. `NEXT_PUBLIC_GOOGLE_CLIENT_ID` must be
   present **at build time**.
3. Deploy → get `https://<your-frontend>.vercel.app`.
4. Go back and set the backend's `CLIENT_URL` to this exact URL; redeploy backend.

---

## 5. Google OAuth wiring (or the button silently fails)

Google Cloud Console → APIs & Services → Credentials → your OAuth client:
- **Authorized JavaScript origins**: `https://<your-frontend>.vercel.app`
- Keep `GOOGLE_CLIENT_ID` identical on frontend + backend.

---

## 6. ROTATE the committed secrets (do this now — they leaked)

These were in `backend/.env` in plaintext → treat as compromised:
- **JWT_SECRET** — already rotated locally; set a fresh one in prod env vars.
- **Neon DB password** — rotate in Neon dashboard, update `DATABASE_URL`/`DIRECT_URL`.
- **Google client** — rotate secret in Cloud Console if a secret was used.
- **USDA `FDC_API_KEY`** + **API-Ninjas key** — regenerate.

Confirm `.env` is gitignored (it is) and never committed.

---

## 7. Security features now in the app

**Backend**
- **Session in an httpOnly + Secure + SameSite=Strict cookie** — the JWT is not
  readable by JS, so an XSS payload can't exfiltrate it. (Secure is prod-only so
  local http dev still works.)
- **CSRF double-submit** — a readable `thali_csrf` cookie must be echoed in the
  `X-CSRF-Token` header on cookie-authenticated mutations; SameSite=Strict is the
  first line, this is the backstop.
- **Session revocation** — each JWT embeds a `tv` (token version) matched against
  `users.token_version` on every request. `POST /auth/logout-all` bumps it to
  invalidate every issued token instantly (compromise / logout-everywhere).
- `helmet` security headers (HSTS in prod, noSniff, frameguard, no `x-powered-by`).
- Global flood limiter **300 req/min/IP**; per-IP auth limiter **10/15 min**; plus a
  per-EMAIL **account lockout (5 failed/15 min)** so IP-rotating stuffing can't grind
  one account. Set `REDIS_URL` to share all counters across instances/serverless.
- Strict CORS origin allowlist (`CLIENT_URL`), credentials on.
- JSON body capped at **32 kB** → 413 on oversized.
- Central error handler — generic messages, no stack traces / DB text leaked.
- `trust proxy = 1` so per-client IP limiting works behind the proxy/LB.
- Env gates: prod **refuses to boot** without a ≥32-char `JWT_SECRET` or if the
  `DEV_USER_ID` auth bypass is set; warns if `DATABASE_URL` lacks TLS.
- bcrypt cost 12; password policy (≥8, upper+lower+digit+symbol, ≤72 bytes).
- Parameterized Prisma / `$queryRaw` (no SQL injection); ownership-scoped
  mutations (no IDOR); path-param validation before `BigInt()`.
- Google ID tokens verified with audience check.

**Frontend / PWA**
- **Nonce-based Content-Security-Policy** per request (middleware) — `strict-dynamic`,
  `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`.
  Strongest practical XSS defence.
- Static backstop headers (HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy,
  Permissions-Policy).
- **No token in `localStorage`** — auth rides the httpOnly cookie; the client only
  reads a non-sensitive expiry cookie for the **30-day auto-logout** (checked on
  read, on a timer, and on tab refocus; matches backend `JWT_EXPIRES_IN=30d`).
- On logout/expiry: server clears the httpOnly cookie and **all service-worker
  caches** are wiped.
- Service worker **never caches `/api/`** (no personal data persisted on device),
  same-origin assets only.

**Supply chain / CI**
- `.github/dependabot.yml` — weekly dependency PRs (backend, frontend, actions).
- `.github/workflows/security.yml` — `npm audit` (high/critical) on push, PR, and weekly.

---

## 8. "Can a hacker bypass this?" — honest answer + your ongoing duties

No system is unbypassable, but the layers above remove the common bypasses
(token theft via XSS, brute force, IDOR, SQLi, CORS abuse, cache poisoning,
oversized-payload/flood DoS, the dev auth bypass). To keep it that way:

- [ ] Rotate every leaked secret (section 6) — biggest current risk.
- [ ] Force HTTPS only (Vercel + Render do this; HSTS is set).
- [x] Run `npm audit` and enable Dependabot — CI added (`.github/`). Still patch what it flags.
- [ ] If you scale the backend to >1 instance/serverless → set `REDIS_URL` so the
      rate-limit counters are shared (store swap is already wired).
- [ ] Enable the platform WAF / DDoS protection (Vercel + Cloudflare in front).
- [ ] Add email verification + password reset (secure, single-use, expiring tokens)
      before collecting real user data at scale.
- [x] Token moved from `localStorage` → httpOnly + Secure + SameSite=Strict cookie,
      with CSRF double-submit and server-side revocation (`tv` / logout-all).
- [ ] Keep an audit log of auth events (logins, failures, lockouts).
- [ ] Privacy: you're collecting health data — publish a privacy policy, add
      account deletion (cascade already in schema), and a data-export path.
