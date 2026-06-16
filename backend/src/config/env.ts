import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT:                z.string().default('5000'),
  NODE_ENV:            z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL:        z.string().min(1),
  JWT_SECRET:          z.string().optional(),
  JWT_EXPIRES_IN:      z.string().default('7d'),
  DEV_USER_ID:         z.string().optional(),
  CLIENT_URL:          z.string().default('http://localhost:3000'),
  GOOGLE_CLIENT_ID:    z.string().optional(),   // required only for Google sign-in
  // USDA FoodData Central key (primary food source). Falls back to DEMO_KEY.
  FDC_API_KEY:         z.string().optional(),
  // Legacy / unused — food search now uses USDA + Open Food Facts
  NUTRITION_API_URL:   z.string().optional(),
  NUTRITION_API_KEY:   z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Invalid environment variables:\n', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
