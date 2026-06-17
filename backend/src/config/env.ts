import 'dotenv/config';
import { z } from 'zod';

const schema = z
  .object({
    PORT:                z.string().default('5000'),
    NODE_ENV:            z.enum(['development', 'production', 'test']).default('development'),
    DATABASE_URL:        z.string().min(1),
    JWT_SECRET:          z.string().optional(),
    // Default session lifetime → 30 days (auto-logout window).
    JWT_EXPIRES_IN:      z.string().default('30d'),
    DEV_USER_ID:         z.string().optional(),
    // Comma-separated allowlist of browser origins permitted by CORS.
    CLIENT_URL:          z.string().default('http://localhost:3000'),
    GOOGLE_CLIENT_ID:    z.string().optional(),   // required only for Google sign-in
    // USDA FoodData Central key (primary food source). Falls back to DEMO_KEY.
    FDC_API_KEY:         z.string().optional(),
    // Legacy / unused — food search now uses USDA + Open Food Facts
    NUTRITION_API_URL:   z.string().optional(),
    NUTRITION_API_KEY:   z.string().optional(),
  })
  // ── Production safety gates ──────────────────────────────────────────────
  .superRefine((val, ctx) => {
    if (val.NODE_ENV !== 'production') return;

    // A real, sufficiently long signing secret is mandatory in production.
    if (!val.JWT_SECRET || val.JWT_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be set and at least 32 characters in production',
      });
    }

    // The dev auth bypass must NEVER be enabled in production.
    if (val.DEV_USER_ID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DEV_USER_ID'],
        message: 'DEV_USER_ID must be empty in production (it bypasses authentication)',
      });
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Invalid environment variables:\n', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

/** Browser origins allowed by CORS (parsed from the comma-separated CLIENT_URL). */
export const allowedOrigins = env.CLIENT_URL.split(',')
  .map(o => o.trim())
  .filter(Boolean);
