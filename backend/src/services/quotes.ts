// Motivational one-liners for the nightly meal-reminder push.
// A fresh one is picked at random each time a notification is sent, so the
// nudge stays encouraging rather than nagging.

export const MOTIVATION_QUOTES = [
  'Small bites, big wins. Log your day before you rest. 🌙',
  "Discipline is choosing what you want most over what you want now.",
  'A day tracked is a day you stay in control. You’ve got this! 💪',
  'Progress, not perfection. Close out today’s meals.',
  'Your future self will thank you for showing up tonight.',
  'Consistency beats intensity. One log at a time.',
  'Every meal logged is a promise kept to yourself.',
  'Tiny habits today, big transformation tomorrow.',
  'You don’t have to be extreme, just consistent.',
  'Fuel your goals — finish logging what you ate today.',
  'Champions are made in the boring, repeated details. Log it. 🏆',
  'The body achieves what the mind tracks. Wrap up your day.',
  'One honest log keeps your goals on course.',
  'Be the kind of person who finishes what they start. Log dinner.',
  'Showing up daily is the whole secret. Don’t break the chain. 🔗',
  'Health is a habit, not an event. Keep the streak alive.',
  'You’re closer than you think. Log today and keep moving.',
  'What gets measured gets managed. Take 30 seconds now.',
  'Strong choices compound. Add today’s meals to the story.',
  'Rest well — but log first. Tomorrow-you is watching. 😉',
] as const;

/** A random motivational quote. */
export function randomQuote(): string {
  return MOTIVATION_QUOTES[Math.floor(Math.random() * MOTIVATION_QUOTES.length)];
}
