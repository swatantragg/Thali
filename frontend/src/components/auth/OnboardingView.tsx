'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Profile } from '@/types';
import { computeTargets } from '@/lib/nutrition';
import { allowDecimals, allowInteger } from '@/lib/validate';
import ThemeToggle from '@/components/ui/ThemeToggle';
import Select from '@/components/ui/Select';

const inputCls =
  'w-28 text-right text-sm text-ink bg-surface-2 rounded-lg px-2 py-1.5 outline-none border border-line focus:border-primary transition-colors';
const selectCls =
  'text-sm text-ink bg-surface-2 rounded-lg px-2 py-1.5 outline-none border border-line focus:border-primary transition-colors';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-line last:border-0">
      <span className="text-sm text-ink-muted">{label}</span>
      {children}
    </div>
  );
}

export default function OnboardingView() {
  const { setProfile } = useApp();
  const { user, logout } = useAuth();

  const [form, setForm] = useState<Profile>({
    name:          user?.name ?? '',
    sex:           'male',
    age:           28,
    heightCm:      175,
    weightKg:      72,
    activityLevel: 1.55,
    goal:          'maintain',
  });
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upd = <K extends keyof Profile>(k: K, v: Profile[K]) => setForm(f => ({ ...f, [k]: v }));
  const t = computeTargets(form);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await setProfile({ ...form, name: form.name?.trim() || undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your details');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-app px-4 py-8 flex flex-col items-center">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-ink">
            Welcome{user?.name ? `, ${user.name}` : ''} 👋
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Tell us a bit about yourself so we can set your daily targets.
          </p>
        </div>

        <form onSubmit={submit}>
          <div className="bg-surface rounded-2xl border border-line shadow-sm px-4 py-1">
            <Field label="Name">
              <input
                type="text" value={form.name ?? ''} placeholder="Your name"
                onChange={e => upd('name', e.target.value)} className={inputCls}
              />
            </Field>
            <Field label="Sex">
              <Select value={form.sex} onChange={e => upd('sex', e.target.value as Profile['sex'])} className={selectCls}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </Select>
            </Field>
            <Field label="Age">
              <input type="text" inputMode="numeric" value={form.age} min={10} max={120}
                onChange={e => { if (allowInteger(e.target.value)) upd('age', +e.target.value); }} className={inputCls} required />
            </Field>
            <Field label="Height (cm)">
              <input type="text" inputMode="decimal" value={form.heightCm} min={100} max={250}
                onChange={e => { if (allowDecimals(e.target.value, 2)) upd('heightCm', +e.target.value); }} className={inputCls} required />
            </Field>
            <Field label="Weight (kg)">
              <input type="text" inputMode="decimal" value={form.weightKg} min={30} max={300}
                onChange={e => { if (allowDecimals(e.target.value, 2)) upd('weightKg', +e.target.value); }} className={inputCls} required />
            </Field>
            <Field label="Activity level">
              <Select value={form.activityLevel} onChange={e => upd('activityLevel', +e.target.value)} className={selectCls}>
                <option value={1.2}>Sedentary</option>
                <option value={1.375}>Lightly active</option>
                <option value={1.55}>Moderately active</option>
                <option value={1.725}>Very active</option>
                <option value={1.9}>Extremely active</option>
              </Select>
            </Field>
            <Field label="Goal">
              <Select value={form.goal} onChange={e => upd('goal', e.target.value as Profile['goal'])} className={selectCls}>
                <option value="cut">Cut (lose weight)</option>
                <option value="maintain">Maintain</option>
                <option value="bulk">Bulk (gain weight)</option>
              </Select>
            </Field>
          </div>

          {/* Live target preview */}
          <div className="mt-4 bg-surface rounded-2xl border border-line shadow-sm p-4 text-center">
            <div className="text-xs text-ink-muted mb-1">Your daily target</div>
            <div className="text-3xl font-bold text-ink tabular-nums">{t.cal}</div>
            <div className="text-xs text-ink-muted">kcal · {t.protein}p · {t.carbs}c · {t.fat}f</div>
          </div>

          {error && <p className="text-xs text-danger mt-3 text-center">{error}</p>}

          <button
            type="submit" disabled={busy}
            className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-fg hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            Continue to Thali
          </button>

          <button
            type="button" onClick={logout}
            className="mt-2 w-full py-2 text-xs text-ink-muted hover:text-ink transition-colors"
          >
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}
