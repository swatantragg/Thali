import { LogEntry, Profile, Targets, DaySummary } from '@/types';

const round1 = (n: number) => Math.round(n * 10) / 10;

// The five canonical activity multipliers (must match the <option> values
// rendered in the profile/onboarding selects).
export const ACTIVITY_LEVELS = [1.2, 1.375, 1.55, 1.725, 1.9] as const;

// Snap a stored/raw multiplier to the nearest canonical value. Protects the
// <select> from falling back to its first option ("Sedentary") when an
// imprecise value (e.g. a legacy 1.38 / 1.73 row) matches no <option>.
export function snapActivityLevel(v: number): number {
  if (!Number.isFinite(v)) return 1.55;
  return ACTIVITY_LEVELS.reduce((best, lvl) =>
    Math.abs(lvl - v) < Math.abs(best - v) ? lvl : best
  );
}

export function sumDay(logs: LogEntry[], iso: string): DaySummary {
  const t = { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 };
  for (const l of logs) {
    if (l.date === iso) {
      t.calories += l.calories;
      t.protein  += l.protein;
      t.carbs    += l.carbs;
      t.fat      += l.fat;
      t.fibre    += l.fibre;
    }
  }
  return {
    calories: Math.round(t.calories),
    protein:  round1(t.protein),
    carbs:    round1(t.carbs),
    fat:      round1(t.fat),
    fibre:    round1(t.fibre),
  };
}

export function computeTargets(p: Profile): Targets {
  const bmr =
    p.sex === 'male'
      ? 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + 5
      : 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age - 161;
  const tdee    = bmr * p.activityLevel;
  const adj     = p.goal === 'cut' ? -450 : p.goal === 'bulk' ? 350 : 0;
  const cal     = Math.round((tdee + adj) / 10) * 10;
  const protein = Math.round(p.weightKg * 1.8);
  const fat     = Math.round((cal * 0.27) / 9);
  const carbs   = Math.max(0, Math.round((cal - protein * 4 - fat * 9) / 4));
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), cal, protein, carbs, fat, fibre: 30 };
}
