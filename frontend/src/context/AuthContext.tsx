'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, postJSON, getToken, setToken, clearToken } from '@/lib/api';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  hasProfile: boolean;
}

interface AuthResult {
  token: string;
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

  // Validate any stored token on mount.
  useEffect(() => {
    (async () => {
      if (!getToken()) { setReady(true); return; }
      try {
        const res = await api('/auth/me');
        if (res.ok) setUser(await res.json());
        else clearToken();
      } catch {
        clearToken();
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const handleResult = (r: AuthResult) => {
    setToken(r.token);
    setUser(r.user);
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
    clearToken();
    setUser(null);
  }, []);

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
