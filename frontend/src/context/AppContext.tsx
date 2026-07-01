'use client';

import { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import { LogEntry, Profile, Targets, TabId, WeightEntry, FastEntry, CustomFoodInput, FoodResult } from '@/types';
import { computeTargets, snapActivityLevel } from '@/lib/nutrition';
import { toISO } from '@/lib/dates';
import { api } from '@/lib/api';
import { useAuth } from './AuthContext';

interface AppContextValue {
  logs: LogEntry[];
  profile: Profile;
  targets: Targets;
  weights: WeightEntry[];
  fasts: FastEntry[];
  latestWeight: number | null;
  tab: TabId;
  selectedDate: string;
  loading: boolean;
  error: string | null;
  setProfile: (p: Profile) => Promise<void>;
  setTab: (t: TabId) => void;
  setSelectedDate: (d: string) => void;
  addLog: (meal: string, foodId: number, qty: number) => Promise<void>;
  updateLog: (id: string, qty: number) => Promise<void>;
  deleteLog: (id: string) => Promise<void>;
  addWeight: (weightKg: number, date?: string) => Promise<void>;
  addFast: (date: string, meal: string) => Promise<void>;
  removeFast: (date: string, meal: string) => Promise<void>;
  addCustomFood: (input: CustomFoodInput) => Promise<FoodResult>;
  refreshLogs: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const DEFAULT_PROFILE: Profile = {
  sex: 'male',
  age: 28,
  heightCm: 175,
  weightKg: 72,
  activityLevel: 1.55,
  goal: 'maintain',
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user, markProfileComplete } = useAuth();
  const [logs, setLogs]         = useState<LogEntry[]>([]);
  const [profile, setProfileState] = useState<Profile>(DEFAULT_PROFILE);
  const [weights, setWeights]   = useState<WeightEntry[]>([]);
  const [fasts, setFasts]       = useState<FastEntry[]>([]);
  const [tab, setTab]           = useState<TabId>('today');
  const [selectedDate, setSelectedDate] = useState(toISO(new Date()));
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // ── Fetch all logs ────────────────────────────────────────────────────
  const refreshLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api('/logs');
      if (res.ok) {
        const data: LogEntry[] = await res.json();
        setLogs(data.map(l => ({ ...l, id: String(l.id) })));
      } else {
        setError(`Failed to load logs (${res.status})`);
      }
    } catch {
      setError('Backend unreachable — check that the server is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch weight logs ───────────────────────────────────────────────────
  const refreshWeights = useCallback(async () => {
    try {
      const res = await api('/weight');
      if (res.ok) {
        const data: WeightEntry[] = await res.json();
        setWeights(data.map(w => ({ ...w, weightKg: Number(w.weightKg) })));
      }
    } catch {
      // ignore — weights are optional
    }
  }, []);

  // ── Fetch fast (skipped-meal) logs ──────────────────────────────────────
  const refreshFasts = useCallback(async () => {
    try {
      const res = await api('/fasts');
      if (res.ok) setFasts(await res.json());
    } catch {
      // ignore — fasts are optional
    }
  }, []);

  // ── Load on auth change ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setLogs([]);
      setWeights([]);
      setFasts([]);
      setProfileState(DEFAULT_PROFILE);
      return;
    }
    (async () => {
      try {
        const res = await api('/profile');
        if (res.ok) {
          const data = await res.json();
          setProfileState({
            sex:           data.sex,
            age:           data.age,
            heightCm:      Number(data.heightCm),
            weightKg:      Number(data.weightKg),
            activityLevel: snapActivityLevel(Number(data.activityLevel)),
            goal:          data.goal,
            name:          data.name ?? undefined,
          });
        }
      } catch {
        // backend not yet available — defaults stay
      }
    })();
    refreshLogs();
    refreshWeights();
    refreshFasts();
  }, [user, refreshLogs, refreshWeights, refreshFasts]);

  const targets = useMemo(() => computeTargets(profile), [profile]);

  // Latest logged weight (weights are stored ascending by date)
  const latestWeight = useMemo(
    () => (weights.length ? weights[weights.length - 1].weightKg : null),
    [weights]
  );

  // Auto-fill the profile's weight from the most recent weigh-in (local only).
  useEffect(() => {
    if (latestWeight != null) {
      setProfileState(p => (p.weightKg === latestWeight ? p : { ...p, weightKg: latestWeight }));
    }
  }, [latestWeight]);

  // ── Weight (low-level persist) ──────────────────────────────────────────
  // POST a weigh-in for a date (backend upserts one row per user per day) and
  // merge it into local state. Shared by the auto-log-on-profile-save path and
  // the explicit "log weight" actions.
  const persistWeight = useCallback(async (weightKg: number, date?: string) => {
    const logDate = date ?? toISO(new Date());
    const res = await api('/weight', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ date: logDate, weightKg }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to save weight');
    }
    const saved: WeightEntry = await res.json();
    setWeights(prev => {
      const next = prev.filter(w => w.date !== saved.date);
      next.push({ ...saved, weightKg: Number(saved.weightKg) });
      next.sort((a, b) => a.date.localeCompare(b.date));
      return next;
    });
  }, []);

  // ── Profile ───────────────────────────────────────────────────────────
  const setProfile = useCallback(async (p: Profile) => {
    setProfileState(p);
    const res = await api('/profile', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(p),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to save profile');
    }
    markProfileComplete();
    // Auto weight-log: saving a profile whose weight differs from the last
    // weigh-in records today's weight automatically (idempotent upsert). Failure
    // here is non-fatal — the profile itself is already saved.
    if (p.weightKg > 0 && p.weightKg !== latestWeight) {
      try { await persistWeight(p.weightKg); } catch { /* ignore */ }
    }
  }, [markProfileComplete, latestWeight, persistWeight]);

  // ── Add log ───────────────────────────────────────────────────────────
  const addLog = useCallback(
    async (meal: string, foodId: number, qty: number) => {
      try {
        const res = await api('/logs', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ foodId, meal, date: selectedDate, quantity: qty }),
        });
        if (res.ok) {
          const saved = await res.json();
          setLogs(prev => [...prev, { ...saved, id: String(saved.id) }]);
        } else {
          setError(`Could not add entry (${res.status})`);
        }
      } catch {
        setError('Add failed — is the backend running?');
      }
    },
    [selectedDate]
  );

  // ── Update log (edit quantity → backend recomputes macros) ──────────────
  const updateLog = useCallback(async (id: string, qty: number) => {
    try {
      const res = await api(`/logs/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ quantity: qty }),
      });
      if (res.ok) {
        const saved = await res.json();
        setLogs(prev => prev.map(l => (l.id === id ? { ...saved, id: String(saved.id) } : l)));
      } else {
        setError(`Could not update entry (${res.status})`);
      }
    } catch {
      setError('Update failed — is the backend running?');
    }
  }, []);

  // ── Delete log ────────────────────────────────────────────────────────
  const deleteLog = useCallback(async (id: string) => {
    setLogs(prev => prev.filter(l => l.id !== id));   // optimistic
    try {
      await api(`/logs/${id}`, { method: 'DELETE' });
    } catch {
      refreshLogs();
    }
  }, [refreshLogs]);

  // ── Add / update weight ─────────────────────────────────────────────────
  // Persists a weight log AND syncs profile.weightKg (so targets recompute and
  // the profile auto-fills the latest weight). Syncs the profile directly
  // rather than via setProfile to avoid re-logging the same weigh-in.
  const addWeight = useCallback(async (weightKg: number, date?: string) => {
    await persistWeight(weightKg, date);
    const next = { ...profile, weightKg };
    setProfileState(next);
    const res = await api('/profile', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(next),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to save profile');
    }
  }, [profile, persistWeight]);

  // ── Fasting (mark/clear a skipped meal) ─────────────────────────────────
  const addFast = useCallback(async (date: string, meal: string) => {
    setFasts(prev => (prev.some(f => f.date === date && f.meal === meal) ? prev : [...prev, { date, meal }]));
    try {
      const res = await api('/fasts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ date, meal }),
      });
      if (!res.ok) refreshFasts();
    } catch {
      refreshFasts();
    }
  }, [refreshFasts]);

  const removeFast = useCallback(async (date: string, meal: string) => {
    setFasts(prev => prev.filter(f => !(f.date === date && f.meal === meal)));
    try {
      const res = await api('/fasts', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ date, meal }),
      });
      if (!res.ok) refreshFasts();
    } catch {
      refreshFasts();
    }
  }, [refreshFasts]);

  // ── Custom "Others" food → persisted, then reusable in search ───────────
  const addCustomFood = useCallback(async (input: CustomFoodInput): Promise<FoodResult> => {
    const res = await api('/foods', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(input),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to save food');
    }
    return res.json();
  }, []);

  return (
    <AppContext.Provider
      value={{
        logs, profile, targets, weights, fasts, latestWeight, tab, selectedDate, loading, error,
        setProfile, setTab, setSelectedDate, addLog, updateLog, deleteLog, addWeight,
        addFast, removeFast, addCustomFood, refreshLogs,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
