import { LogEntry, FastEntry } from '@/types';
import { toISO, addDays, parseISO } from '@/lib/dates';

// Meals that must be covered (logged or fasted) for a day to count as consistent.
// Snack is intentionally optional.
export const REQUIRED_MEALS = ['Breakfast', 'Lunch', 'Dinner'] as const;

export interface DayStatus {
  iso: string;
  day: number;            // day-of-month
  covered: Set<string>;   // meals with a food log OR a fast on this day
  complete: boolean;      // all REQUIRED_MEALS covered
  future: boolean;        // date is after today (not yet actionable)
}

/** Map of YYYY-MM-DD → set of meals covered by a log or a fast. */
export function buildCoverage(logs: LogEntry[], fasts: FastEntry[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const add = (iso: string, meal: string) => {
    const s = map.get(iso) ?? new Set<string>();
    s.add(meal);
    map.set(iso, s);
  };
  for (const l of logs)  add(l.date, l.meal);
  for (const f of fasts) add(f.date, f.meal);
  return map;
}

export function isComplete(covered: Set<string> | undefined): boolean {
  return !!covered && REQUIRED_MEALS.every(m => covered.has(m));
}

/** Days of the month containing `ref`, with consistency status for each. */
export function monthGrid(
  coverage: Map<string, Set<string>>,
  ref: Date = new Date()
): DayStatus[] {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const todayISO = toISO(new Date());
  const count = new Date(y, m + 1, 0).getDate();
  return Array.from({ length: count }, (_, i) => {
    const iso = toISO(new Date(y, m, i + 1));
    const covered = coverage.get(iso) ?? new Set<string>();
    return { iso, day: i + 1, covered, complete: isComplete(covered), future: iso > todayISO };
  });
}

/** Consecutive complete days ending today (yesterday counts as the anchor until today is finished). */
export function currentStreak(coverage: Map<string, Set<string>>, today: Date = new Date()): number {
  let cursor = new Date(today);
  if (!isComplete(coverage.get(toISO(cursor)))) cursor = addDays(cursor, -1);
  let streak = 0;
  while (isComplete(coverage.get(toISO(cursor)))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Longest run of complete days from the first record up to today. */
export function bestStreak(coverage: Map<string, Set<string>>): number {
  const isos = [...coverage.keys()].filter(iso => isComplete(coverage.get(iso))).sort();
  if (isos.length === 0) return 0;
  let best = 1, run = 1;
  for (let i = 1; i < isos.length; i++) {
    const prev = toISO(addDays(parseISO(isos[i]), -1));
    run = isos[i - 1] === prev ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

/** Flame tier for a streak: 0 = none, then escalates every 7 days (capped). */
export function flameTier(streak: number): number {
  if (streak < 1) return 0;
  return Math.min(1 + Math.floor(streak / 7), 4);
}
