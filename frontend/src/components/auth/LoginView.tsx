'use client';

import { useState, useCallback } from 'react';
import { Loader2, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import ThemeToggle from '@/components/ui/ThemeToggle';
import GoogleButton from './GoogleButton';

type Mode = 'login' | 'signup';

const inputCls =
  'w-full pl-10 pr-3 py-2.5 rounded-xl border border-line bg-surface-2 text-sm text-ink outline-none focus:border-primary transition-colors';
const pwInputCls =
  'w-full pl-10 pr-10 py-2.5 rounded-xl border border-line bg-surface-2 text-sm text-ink outline-none focus:border-primary transition-colors';

/** Mirror of the backend policy so users get instant, specific feedback. */
function passwordPolicyError(pw: string): string | null {
  if (pw.length < 8)        return 'Password must be at least 8 characters';
  if (!/[a-z]/.test(pw))    return 'Password must contain a lowercase letter';
  if (!/[A-Z]/.test(pw))    return 'Password must contain an uppercase letter';
  if (!/[0-9]/.test(pw))    return 'Password must contain a number';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Password must contain a symbol';
  return null;
}

export default function LoginView() {
  const { login, register, googleLogin } = useAuth();
  const [mode, setMode]               = useState<Mode>('login');
  const [name, setName]               = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showPw, setShowPw]           = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy]               = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setConfirm('');
    setShowPw(false);
    setShowConfirm(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'signup') {
      const pwErr = passwordPolicyError(password);
      if (pwErr) { setError(pwErr); return; }
      if (password !== confirm) { setError('Passwords do not match'); return; }
    }

    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password, name || undefined);
    } catch (err) {
      // Backend returns 409 here if the email is already registered.
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = useCallback(
    async (credential: string) => {
      setBusy(true);
      setError(null);
      try {
        await googleLogin(credential);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Google sign-in failed');
        setBusy(false);
      }
    },
    [googleLogin]
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-app px-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center mb-7">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Thali" className="w-14 h-14 rounded-2xl" />
          <h1 className="mt-3 font-brand text-2xl font-bold text-ink tracking-wide">Thali</h1>
          <p className="text-xs text-ink-muted">calorie &amp; macro tracker</p>
        </div>

        <div className="bg-surface rounded-2xl border border-line shadow-sm p-6">
          {/* Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-surface-2 mb-5">
            {(['login', 'signup'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`py-2 text-sm font-semibold rounded-lg transition-colors ${
                  mode === m
                    ? 'bg-surface text-primary shadow-sm'
                    : 'text-ink-muted'
                }`}
              >
                {m === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === 'signup' && (
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  type="text" placeholder="Name (optional)" value={name}
                  onChange={e => setName(e.target.value)} className={inputCls}
                />
              </div>
            )}
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                type="email" placeholder="Email" value={email} required autoComplete="email"
                onChange={e => setEmail(e.target.value)} className={inputCls}
              />
            </div>

            {/* Password + eye */}
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                type={showPw ? 'text' : 'password'}
                placeholder={mode === 'signup' ? 'Password (min 8 chars)' : 'Password'}
                value={password} required minLength={8}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                onChange={e => setPassword(e.target.value)} className={pwInputCls}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-colors"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Confirm password (signup) + eye */}
            {mode === 'signup' && (
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Confirm password"
                  value={confirm} required minLength={8}
                  autoComplete="new-password"
                  onChange={e => setConfirm(e.target.value)} className={pwInputCls}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-colors"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            )}

            {error && <p className="text-xs text-danger">{error}</p>}

            <button
              type="submit" disabled={busy}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-fg hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              {mode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <span className="flex-1 h-px bg-line" />
            <span className="text-xs text-ink-muted">or</span>
            <span className="flex-1 h-px bg-line" />
          </div>

          <GoogleButton onCredential={onGoogle} onError={setError} />
        </div>
      </div>
    </div>
  );
}
