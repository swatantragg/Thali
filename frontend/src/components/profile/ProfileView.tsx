'use client';

import { useState, useEffect } from 'react';
import { Loader2, Check, Pencil } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Profile } from '@/types';
import { COLORS } from '@/lib/constants';
import { computeTargets } from '@/lib/nutrition';
import { allowDecimals, allowInteger } from '@/lib/validate';
import Card from '@/components/ui/Card';
import Select from '@/components/ui/Select';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-line last:border-0">
      <span className="text-sm text-ink-muted">{label}</span>
      {children}
    </div>
  );
}

const ACTIVITY_LABELS: Record<string, string> = {
  '1.2': 'Sedentary',
  '1.375': 'Lightly active',
  '1.55': 'Moderately active',
  '1.725': 'Very active',
  '1.9': 'Extremely active',
};
const GOAL_LABELS: Record<Profile['goal'], string> = {
  cut: 'Cut (lose weight)',
  maintain: 'Maintain',
  bulk: 'Bulk (gain weight)',
};

const inputCls  = 'w-24 text-right text-sm text-ink bg-surface-2 rounded-lg px-2 py-1.5 outline-none border border-line focus:border-primary transition-colors';
const selectCls = 'text-sm text-ink bg-surface-2 rounded-lg px-2 py-1.5 outline-none border border-line focus:border-primary transition-colors';
const valueCls  = 'text-sm font-medium text-ink tabular-nums';

export default function ProfileView() {
  const { profile, setProfile, targets, latestWeight, addWeight } = useApp();
  const { user } = useAuth();
  const displayName = profile.name || user?.name || user?.email || '—';

  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState<Profile>(profile);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const [logging, setLogging] = useState(false);
  const [logged, setLogged]   = useState(false);

  // Keep the draft in sync with the saved profile while NOT editing
  // (covers initial load + weight auto-fill from the latest weigh-in).
  useEffect(() => {
    if (!editing) setDraft(profile);
  }, [profile, editing]);

  const upd = <K extends keyof Profile>(k: K, v: Profile[K]) =>
    setDraft(d => ({ ...d, [k]: v }));

  const startEdit = () => { setDraft(profile); setSaveErr(null); setEditing(true); };
  const cancel    = () => { setDraft(profile); setSaveErr(null); setEditing(false); };

  const save = async () => {
    setSaving(true);
    setSaveErr(null);
    try {
      await setProfile(draft);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const logWeight = async () => {
    if (!(profile.weightKg > 0)) return;
    setLogging(true);
    try {
      await addWeight(profile.weightKg);
      setLogged(true);
      setTimeout(() => setLogged(false), 2000);
    } finally {
      setLogging(false);
    }
  };

  // While editing, project the targets the draft would produce.
  const shownTargets = editing ? computeTargets(draft) : targets;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink">Your profile</h2>
        {!editing ? (
          <button
            onClick={startEdit}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-hover py-1.5 px-3 rounded-lg hover:bg-accent-soft transition-colors"
          >
            <Pencil size={13} /> Edit
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={cancel}
              disabled={saving}
              className="text-xs font-semibold text-ink-muted hover:text-ink py-1.5 px-3 rounded-lg hover:bg-surface-2 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs font-semibold text-primary-fg bg-primary hover:bg-primary-hover py-1.5 px-4 rounded-lg disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Save
            </button>
          </div>
        )}
      </div>

      {saveErr && <p className="text-xs text-danger px-1">{saveErr}</p>}
      {saved && !editing && (
        <p className="flex items-center gap-1 text-xs text-primary px-1"><Check size={13} /> Profile saved</p>
      )}

      {/* Identity */}
      <div className="flex items-center gap-3 px-1">
        <div className="w-11 h-11 rounded-full bg-accent-soft flex items-center justify-center text-primary font-semibold text-base shrink-0">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink truncate">{displayName}</div>
          {user?.email && <div className="text-xs text-ink-muted truncate">{user.email}</div>}
        </div>
      </div>

      <Card className="px-4 py-1">
        <Field label="Name">
          {editing ? (
            <input
              type="text" value={draft.name ?? ''} placeholder="Your name" maxLength={80}
              onChange={e => upd('name', e.target.value)}
              className="w-40 text-right text-sm text-ink bg-surface-2 rounded-lg px-2 py-1.5 outline-none border border-line focus:border-primary transition-colors"
            />
          ) : (
            <span className={valueCls}>{profile.name || '—'}</span>
          )}
        </Field>
        <Field label="Sex">
          {editing ? (
            <Select value={draft.sex} onChange={e => upd('sex', e.target.value as Profile['sex'])} className={selectCls}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </Select>
          ) : (
            <span className={valueCls}>{profile.sex === 'male' ? 'Male' : 'Female'}</span>
          )}
        </Field>
        <Field label="Age">
          {editing ? (
            <input type="text" inputMode="numeric" value={draft.age} min={10} max={120}
              onChange={e => { if (allowInteger(e.target.value)) upd('age', +e.target.value); }} className={inputCls} />
          ) : (
            <span className={valueCls}>{profile.age}</span>
          )}
        </Field>
        <Field label="Height (cm)">
          {editing ? (
            <input type="text" inputMode="decimal" value={draft.heightCm} min={100} max={250}
              onChange={e => { if (allowDecimals(e.target.value, 2)) upd('heightCm', +e.target.value); }} className={inputCls} />
          ) : (
            <span className={valueCls}>{profile.heightCm} cm</span>
          )}
        </Field>
        <Field label="Weight (kg)">
          {editing ? (
            <input type="text" inputMode="decimal" value={draft.weightKg} min={30} max={300}
              onChange={e => { if (allowDecimals(e.target.value, 2)) upd('weightKg', +e.target.value); }} className={inputCls} />
          ) : (
            <span className={valueCls}>{profile.weightKg} kg</span>
          )}
        </Field>
        <Field label="Activity level">
          {editing ? (
            <Select value={draft.activityLevel} onChange={e => upd('activityLevel', +e.target.value)} className={selectCls}>
              <option value={1.2}>Sedentary</option>
              <option value={1.375}>Lightly active</option>
              <option value={1.55}>Moderately active</option>
              <option value={1.725}>Very active</option>
              <option value={1.9}>Extremely active</option>
            </Select>
          ) : (
            <span className={valueCls}>{ACTIVITY_LABELS[String(profile.activityLevel)] ?? profile.activityLevel}</span>
          )}
        </Field>
        <Field label="Goal">
          {editing ? (
            <Select value={draft.goal} onChange={e => upd('goal', e.target.value as Profile['goal'])} className={selectCls}>
              <option value="cut">Cut (lose weight)</option>
              <option value="maintain">Maintain</option>
              <option value="bulk">Bulk (gain weight)</option>
            </Select>
          ) : (
            <span className={valueCls}>{GOAL_LABELS[profile.goal]}</span>
          )}
        </Field>
      </Card>

      {/* Weight tracking */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-ink-muted">
          {latestWeight != null ? `Last logged: ${latestWeight} kg` : 'No weight logged yet'}
        </span>
        <button
          onClick={logWeight}
          disabled={logging || editing}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-hover py-1.5 px-3 rounded-lg hover:bg-accent-soft disabled:opacity-50 transition-colors"
        >
          {logging ? <Loader2 size={13} className="animate-spin" /> : logged ? <Check size={13} /> : null}
          {logged ? 'Logged' : "Log today's weight"}
        </button>
      </div>

      <Card className="p-4">
        <div className="text-xs font-medium text-ink-muted mb-3">
          {editing ? 'Projected targets' : 'Daily targets'}
        </div>
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="text-4xl font-bold text-ink tabular-nums">{shownTargets.cal}</div>
            <div className="text-xs text-ink-muted mt-0.5">kcal / day</div>
          </div>
          <div className="text-right text-xs text-ink-muted space-y-1">
            <div>BMR <span className="font-medium text-ink">{shownTargets.bmr}</span></div>
            <div>TDEE <span className="font-medium text-ink">{shownTargets.tdee}</span></div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            ['Protein', shownTargets.protein, COLORS.protein],
            ['Carbs',   shownTargets.carbs,   COLORS.carbs],
            ['Fat',     shownTargets.fat,     COLORS.fat],
            ['Fibre',   shownTargets.fibre,   COLORS.fibre],
          ].map(([label, value, color]) => (
            <div key={label as string} className="bg-surface-2 rounded-xl py-3">
              <div className="text-xl font-bold tabular-nums" style={{ color: color as string }}>{value}g</div>
              <div className="text-xs text-ink-muted mt-0.5">{label as string}</div>
            </div>
          ))}
        </div>
      </Card>

      <p className="text-xs text-ink-muted px-1 pb-2">
        Targets computed via Mifflin-St Jeor equation adjusted for activity and goal.
      </p>
    </div>
  );
}
