import cron from 'node-cron';
import { env, pushEnabled } from '../config/env';
import { runMealReminders } from '../services/reminder.service';

/**
 * Start in-process scheduled jobs. Safe to call once at boot; a no-op unless
 * Web Push is configured. Runs inside the long-lived API container, so no
 * external cron/worker is needed.
 */
export function startScheduler(): void {
  if (!pushEnabled) {
    console.log('🔕  Push not configured (VAPID keys missing) — meal reminders disabled');
    return;
  }
  if (!cron.validate(env.REMINDER_CRON)) {
    console.error(`❌  Invalid REMINDER_CRON "${env.REMINDER_CRON}" — meal reminders disabled`);
    return;
  }

  cron.schedule(
    env.REMINDER_CRON,
    () => {
      runMealReminders().catch(err => console.error('[reminder] run failed', err));
    },
    { timezone: env.REMINDER_TZ },
  );

  console.log(`⏰  Meal reminders scheduled (${env.REMINDER_CRON} ${env.REMINDER_TZ})`);
}
