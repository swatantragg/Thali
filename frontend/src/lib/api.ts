// Cookie-based fetch wrapper. The session token lives in an httpOnly cookie set
// by the backend (unreadable by JS → not stealable via XSS). This module only
// reads the non-httpOnly CSRF + expiry cookies. All calls go through the Next
// rewrite /api/* → backend, so cookies are same-origin.

const CSRF_COOKIE = 'thali_csrf';
const EXP_COOKIE  = 'thali_session_exp';

// Auto-logout window. Matches the backend JWT_EXPIRES_IN (30d) and the cookie
// Max-Age, so the client drops the session as the server stops honouring it.
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Read a non-httpOnly cookie by name (returns null on the server / if absent). */
function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const escaped = name.replace(/([.*+?^${}()|[\]\\])/g, '\\$1');
  const match = document.cookie.match(new RegExp('(?:^|; )' + escaped + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

/** True once a session exists but has passed its stored expiry. */
export function isSessionExpired(): boolean {
  const exp = Number(readCookie(EXP_COOKIE));
  if (!exp) return false;               // no expiry cookie → no known session
  return Date.now() > exp;
}

/** ms until the session expires (0 if none / already expired). */
export function sessionTimeLeftMs(): number {
  const exp = Number(readCookie(EXP_COOKIE));
  return exp ? Math.max(0, exp - Date.now()) : 0;
}

/** Whether a session cookie is present at all (cheap logged-in hint on load). */
export function hasSession(): boolean {
  return readCookie(EXP_COOKIE) !== null;
}

/**
 * Wipe every client trace of the user: service-worker caches + the readable
 * cookies. The httpOnly session cookie can only be cleared by the server
 * (POST /auth/logout), which AuthContext calls on explicit logout.
 */
export async function clearAllClientData(): Promise<void> {
  if (typeof document !== 'undefined') {
    for (const name of [CSRF_COOKIE, EXP_COOKIE]) {
      document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Strict`;
    }
  }
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    } catch {
      /* best-effort */
    }
  }
}

/** fetch() against /api with cookies attached + CSRF header on mutations. */
export function api(path: string, opts: RequestInit = {}): Promise<Response> {
  const headers = new Headers(opts.headers);
  const method = (opts.method ?? 'GET').toUpperCase();
  if (!SAFE_METHODS.has(method)) {
    const csrf = readCookie(CSRF_COOKIE);
    if (csrf) headers.set('X-CSRF-Token', csrf);
  }
  return fetch(`/api${path}`, { ...opts, headers, credentials: 'include' });
}

/** POST JSON helper. Throws Error(message) on non-2xx. */
export async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await api(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(extractError(data?.error));
  }
  return data as T;
}

/**
 * Turn a backend error payload into a human message. Handles both a plain
 * string and zod's shape ({ fieldErrors, formErrors } or a bare field map),
 * so e.g. password-policy failures show the actual reasons.
 */
function extractError(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    const source = (obj.fieldErrors as Record<string, unknown>) ?? obj;
    const parts = Object.values(source)
      .flat()
      .filter((v): v is string => typeof v === 'string');
    if (parts.length) return parts.join('. ');
  }
  return 'Request failed';
}
