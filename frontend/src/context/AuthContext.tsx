'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  api,
  postJSON,
  hasSession,
  clearAllClientData,
  isSessionExpired,
  sessionTimeLeftMs,
} from '@/lib/api';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  hasProfile: boolean;
}

// The token now lives in an httpOnly cookie the server sets; the body only
// carries the user.
interface AuthResult {
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean;                                  // initial token check finished
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  googleLogin: (credential: string) => Promise<void>;
  logout: () => void;
  markProfileComplete: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // End the session locally: wipe token + all cached data, drop the user.
  const endSession = useCallback(() => {
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    void clearAllClientData();
    setUser(null);
  }, []);

  // Schedule an automatic logout exactly when the 30-day window elapses, so an
  // open tab is signed out without waiting for the next request.
  const scheduleAutoLogout = useCallback(() => {
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    const left = sessionTimeLeftMs();
    if (left <= 0) return;
    // setTimeout caps at ~24.8 days; clamp and re-arm on the next check if needed.
    const delay = Math.min(left, 2_000_000_000);
    expiryTimer.current = setTimeout(() => {
      if (isSessionExpired()) endSession();
      else scheduleAutoLogout();
    }, delay);
  }, [endSession]);

  // Validate the session cookie on mount by asking the server who we are.
  useEffect(() => {
    (async () => {
      // No session cookie, or it's past its stored expiry → skip the round-trip.
      if (!hasSession() || isSessionExpired()) { setReady(true); return; }
      try {
        const res = await api('/auth/me');
        if (res.ok) {
          setUser(await res.json());
          scheduleAutoLogout();
        } else {
          endSession();
        }
      } catch {
        endSession();
      } finally {
        setReady(true);
      }
    })();
    return () => { if (expiryTimer.current) clearTimeout(expiryTimer.current); };
  }, [endSession, scheduleAutoLogout]);

  // Re-check expiry whenever the tab regains focus (covers long-backgrounded PWAs).
  useEffect(() => {
    const onVisible = () => {
      if (user && isSessionExpired()) endSession();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [user, endSession]);

  // The server has already set the session cookies on the response by now.
  const handleResult = (r: AuthResult) => {
    setUser(r.user);
    scheduleAutoLogout();
  };

  const login = useCallback(async (email: string, password: string) => {
    handleResult(await postJSON<AuthResult>('/auth/login', { email, password }));
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    handleResult(await postJSON<AuthResult>('/auth/register', { email, password, name }));
  }, []);

  const googleLogin = useCallback(async (credential: string) => {
    handleResult(await postJSON<AuthResult>('/auth/google', { credential }));
  }, []);

  const logout = useCallback(() => {
    // Clear the httpOnly session cookie on the server (best-effort), then wipe
    // local state + caches.
    void api('/auth/logout', { method: 'POST' }).catch(() => {});
    endSession();
  }, [endSession]);

  const markProfileComplete = useCallback(() => {
    setUser(u => (u ? { ...u, hasProfile: true } : u));
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, ready, login, register, googleLogin, logout, markProfileComplete }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
