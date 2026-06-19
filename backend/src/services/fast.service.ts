import { Meal } from '@prisma/client';
import { prisma } from '../db/client';

export interface FastEntry {
  date: string;   // YYYY-MM-DD
  meal: Meal;
}

function toEntry(row: { logDate: Date; meal: Meal }): FastEntry {
  return { date: row.logDate.toISOString().slice(0, 10), meal: row.meal };
}

/** All fasted meals for a user (used by the consistency / streak views). */
export async function getFasts(userId: string): Promise<FastEntry[]> {
  const rows = await prisma.fastLog.findMany({
    where:   { userId },
    orderBy: { logDate: 'asc' },
  });
  return rows.map(toEntry);
}

/** Mark a meal on a day as fasted (idempotent). */
export async function addFast(userId: string, date: string, meal: Meal): Promise<FastEntry> {
  const row = await prisma.fastLog.upsert({
    where:  { userId_logDate_meal: { userId, logDate: new Date(date), meal } },
    update: {},
    create: { userId, logDate: new Date(date), meal },
  });
  return toEntry(row);
}

/** Remove a fasted-meal mark (idempotent). */
export async function removeFast(userId: string, date: string, meal: Meal): Promise<void> {
  await prisma.fastLog.deleteMany({ where: { userId, logDate: new Date(date), meal } });
}
