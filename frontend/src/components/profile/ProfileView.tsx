'use client';

import { useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Profile } from '@/types';
import { COLORS } from '@/lib/constants';
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

const inputCls  = 'w-24 text-right text-sm text-ink bg-surface-2 rounded-lg px-2 py-1.5 outline-none border border-line focus:border-primary transition-colors';
const selectCls = 'text-sm text-ink bg-surface-2 rounded-lg px-2 py-1.5 outline-none border border-line focus:border-primary transition-colors';

export default function ProfileView() {
  const { profile, setProfile, targets, latestWeight, addWeight } = useApp();
  const [logging, setLogging] = useState(false);
  const [logged, setLogged]   = useState(false);
  const upd = <K extends keyof Profile>(k: K, v: Profile[K]) =>
    setProfile({ ...profile, [k]: v });

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

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-ink">Your profile</h2>

      <Card className="px-4 py-1">
        <Field label="Sex">
          <Select value={profile.sex} onChange={e => upd('sex', e.target.value as Profile['sex'])} className={selectCls}>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </Select>
        </Field>
        <Field label="Age">
          <input type="text" inputMode="numeric" value={profile.age} min={10} max={120}
            onChange={e => { if (allowInteger(e.target.value)) upd('age', +e.target.value); }} className={inputCls} />
        </Field>
        <Field label="Height (cm)">
          <input type="text" inputMode="decimal" value={profile.heightCm} min={100} max={250}
            onChange={e => { if (allowDecimals(e.target.value, 2)) upd('heightCm', +e.target.value); }} className={inputCls} />
        </Field>
        <Field label="Weight (kg)">
          <input type="text" inputMode="decimal" value={profile.weightKg} min={30} max={300}
            onChange={e => { if (allowDecimals(e.target.value, 2)) upd('weightKg', +e.target.value); }} className={inputCls} />
        </Field>
        <Field label="Activity level">
          <Select value={profile.activityLevel} onChange={e => upd('activityLevel', +e.target.value)} className={selectCls}>
            <option value={1.2}>Sedentary</option>
            <option value={1.375}>Lightly active</option>
            <option value={1.55}>Moderately active</option>
            <option value={1.725}>Very active</option>
            <option value={1.9}>Extremely active</option>
          </Select>
        </Field>
        <Field label="Goal">
          <Select value={profile.goal} onChange={e => upd('goal', e.target.value as Profile['goal'])} className={selectCls}>
            <option value="cut">Cut (lose weight)</option>
            <option value="maintain">Maintain</option>
            <option value="bulk">Bulk (gain weight)</option>
          </Select>
        </Field>
      </Card>

      {/* Weight tracking */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-ink-muted">
          {latestWeight != null ? `Last logged: ${latestWeight} kg` : 'No weight logged yet'}
        </span>
        <button
          onClick={logWeight}
          disabled={logging}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-hover py-1.5 px-3 rounded-lg hover:bg-accent-soft disabled:opacity-50 transition-colors"
        >
          {logging ? <Loader2 size={13} className="animate-spin" /> : logged ? <Check size={13} /> : null}
          {logged ? 'Logged' : "Log today's weight"}
        </button>
      </div>

      <Card className="p-4">
        <div className="text-xs font-medium text-ink-muted mb-3">Daily targets</div>
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="text-4xl font-bold text-ink tabular-nums">{targets.cal}</div>
            <div className="text-xs text-ink-muted mt-0.5">kcal / day</div>
          </div>
          <div className="text-right text-xs text-ink-muted space-y-1">
            <div>BMR <span className="font-medium text-ink">{targets.bmr}</span></div>
            <div>TDEE <span className="font-medium text-ink">{targets.tdee}</span></div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            ['Protein', targets.protein, COLORS.protein],
            ['Carbs',   targets.carbs,   COLORS.carbs],
            ['Fat',     targets.fat,     COLORS.fat],
            ['Fibre',   targets.fibre,   COLORS.fibre],
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
