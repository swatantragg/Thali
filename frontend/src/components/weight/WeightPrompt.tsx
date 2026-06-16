'use client';

import { useEffect, useMemo, useState } from 'react';
import { Scale, X, Loader2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { toISO } from '@/lib/dates';
import { allowDecimals } from '@/lib/validate';

/** Monday (week start) for a given date. */
function mondayOf(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const day = x.getDay();                 // 0 Sun … 6 Sat
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  return x;
}

/**
 * End-of-week weight check-in. Appears when no weight is logged for the current
 * week and it's the weekend (or the user has never logged a weight). Dismissed
 * per-week via localStorage.
 */
export default function WeightPrompt() {
  const { weights, latestWeight, profile, addWeight } = useApp();
  const [open, setOpen]   = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState<string | null>(null);

  const weekStartISO = useMemo(() => toISO(mondayOf(new Date())), []);
  const dismissKey = `thali_weight_prompt_${weekStartISO}`;

  useEffect(() => {
    const day = new Date().getDay();
    const isWeekend = day === 0 || day === 6;
    const hasThisWeek = weights.some(w => w.date >= weekStartISO);
    const dismissed = typeof window !== 'undefined' && localStorage.getItem(dismissKey) === '1';
    setOpen(!hasThisWeek && !dismissed && (isWeekend || weights.length === 0));
  }, [weights, weekStartISO, dismissKey]);

  // Prefill with the latest known weight
  useEffect(() => {
    if (open) setValue(String(latestWeight ?? profile.weightKg ?? ''));
  }, [open, latestWeight, profile.weightKg]);

  if (!open) return null;

  const later = () => {
    localStorage.setItem(dismissKey, '1');
    setOpen(false);
  };

  const save = async () => {
    const kg = Number(value);
    if (!(kg > 0)) { setErr('Enter a valid weight'); return; }
    setBusy(true); setErr(null);
    try {
      await addWeight(kg);
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save weight');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-xs bg-surface rounded-2xl border border-line shadow-xl p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-accent-soft flex items-center justify-center text-primary">
              <Scale size={18} />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-ink">Weekly weigh-in</h3>
              <p className="text-xs text-ink-muted">Log your weight to track progress</p>
            </div>
          </div>
          <button onClick={later} aria-label="Dismiss" className="p-1 text-ink-muted hover:text-ink">
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 flex items-center rounded-xl border border-line bg-surface-2 px-3 py-2.5">
          <input
            type="text" inputMode="decimal" autoFocus
            value={value}
            onChange={e => { if (allowDecimals(e.target.value, 2)) setValue(e.target.value); }}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder="e.g. 72.5"
            className="w-full bg-transparent text-sm text-ink outline-none"
          />
          <span className="text-xs text-ink-muted">kg</span>
        </div>

        {err && <p className="mt-2 text-xs text-danger">{err}</p>}

        <div className="mt-4 flex gap-2">
          <button
            onClick={later}
            className="flex-1 rounded-xl border border-line py-2 text-sm font-medium text-ink-muted hover:bg-surface-2 transition-colors"
          >
            Later
          </button>
          <button
            onClick={save} disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-2 text-sm font-semibold text-primary-fg hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
