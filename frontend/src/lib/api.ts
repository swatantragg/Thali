// Token-aware fetch wrapper. All calls go through Next rewrite /api/* → backend.
// See next.config.js — no hardcoded port in the browser bundle.

const TOKEN_KEY = 'thali_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
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
    const msg = typeof data?.error === 'string' ? data.error : 'Request failed';
    throw new Error(msg);
  }
  return data as T;
}
