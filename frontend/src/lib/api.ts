// Token-aware fetch wrapper. All calls go through Next rewrite /api/* → backend.
// See next.config.js — no hardcoded port in the browser bundle.

const TOKEN_KEY = 'thali_token';
const EXPIRES_KEY = 'thali_token_exp';

// Auto-logout window. Must match the backend JWT_EXPIRES_IN (30d) so the client
// drops the session at the same time the server stops honouring the token.
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  // Enforce the 30-day absolute expiry on every read.
  if (isSessionExpired()) {
    clearToken();
    return null;
  }
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(EXPIRES_KEY, String(Date.now() + SESSION_MAX_AGE_MS));
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(EXPIRES_KEY);
}

/** True once the stored session has passed its 30-day expiry. */
export function isSessionExpired(): boolean {
  if (typeof window === 'undefined') return false;
  if (!window.localStorage.getItem(TOKEN_KEY)) return false;
  const exp = Number(window.localStorage.getItem(EXPIRES_KEY));
  // Treat a missing/garbage expiry as expired → fail closed.
  return !exp || Date.now() > exp;
}

/** ms until the session expires (0 if already expired / no session). */
export function sessionTimeLeftMs(): number {
  if (typeof window === 'undefined') return 0;
  if (!window.localStorage.getItem(TOKEN_KEY)) return 0;
  const exp = Number(window.localStorage.getItem(EXPIRES_KEY));
  return exp ? Math.max(0, exp - Date.now()) : 0;
}

/**
 * Wipe every trace of the user from this device: token, expiry, and any cached
 * API/page responses held by the service worker. Called on logout and on
 * session expiry so a shared/stolen device can't replay cached personal data.
 */
export async function clearAllClientData(): Promise<void> {
  clearToken();
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    } catch {
      /* best-effort */
    }
  }
}

/** fetch() against /api with the bearer token auto-attached. */
export function api(path: string, opts: RequestInit = {}): Promise<Response> {
  const headers = new Headers(opts.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`/api${path}`, { ...opts, headers });
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
