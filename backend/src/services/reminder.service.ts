import { Meal } from '@prisma/client';
import { prisma } from '../db/client';
import { env } from '../config/env';
import { sendToUser } from './push.service';
import { randomQuote } from './quotes';

// The three "main" meals a user is reminded about. Snack is excluded — it's
// optional and shouldn't trigger a reminder. A meal counts as *covered* if it
// has a food log OR a fast log (a deliberate skip), matching the app's existing
// consistency/streak semantics.
const REQUIRED_MEALS: Meal[] = [Meal.Breakfast, Meal.Lunch, Meal.Dinner];

/** Today's calendar date (YYYY-MM-DD) in the reminder timezone. */
export function todayInReminderTz(now = new Date()): string {
  // en-CA formats as YYYY-MM-DD; timeZone shifts to the configured locale day.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: env.REMINDER_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

/**
 * Send the nightly reminder to every subscribed user who hasn't covered all
 * three main meals today. Each gets ONE notification carrying a fresh
 * motivational quote. Returns how many users were notified.
 */
export async function runMealReminders(now = new Date()): Promise<number> {
  const dateStr = todayInReminderTz(now);
  const day = new Date(dateStr);   // logDate is stored at 00:00 UTC of the date

  // Users who could be notified at all (have ≥1 push subscription).
  const subscribed = await prisma.pushSubscription.findMany({
    distinct: ['userId'],
    select:   { userId: true },
  });
  if (subscribed.length === 0) return 0;
  const userIds = subscribed.map(s => s.userId);

  // Meals already covered today, per user, from both sources.
  const [foodMeals, fastMeals] = await Promise.all([
    prisma.foodLog.findMany({
      where:    { userId: { in: userIds }, logDate: day, meal: { in: REQUIRED_MEALS } },
      distinct: ['userId', 'meal'],
      select:   { userId: true, meal: true },
    }),
    prisma.fastLog.findMany({
      where:    { userId: { in: userIds }, logDate: day, meal: { in: REQUIRED_MEALS } },
      distinct: ['userId', 'meal'],
      select:   { userId: true, meal: true },
    }),
  ]);

  // userId → set of covered required meals.
  const covered = new Map<string, Set<Meal>>();
  for (const { userId, meal } of [...foodMeals, ...fastMeals]) {
    (covered.get(userId) ?? covered.set(userId, new Set()).get(userId)!).add(meal);
  }

  // Notify anyone missing at least one required meal.
  let notified = 0;
  await Promise.all(
    userIds.map(async userId => {
      const done = covered.get(userId)?.size ?? 0;
      if (done >= REQUIRED_MEALS.length) return;   // all three covered → skip

      const sent = await sendToUser(userId, {
        title: 'Did you eat well today? 🍽️',
        body:  randomQuote(),
        url:   '/',
        tag:   'thali-meal-reminder',           // collapses any earlier reminder
      });
      if (sent > 0) notified++;
    }),
  );

  console.log(`[reminder] ${dateStr} — notified ${notified}/${userIds.length} subscribed user(s)`);
  return notified;
}
