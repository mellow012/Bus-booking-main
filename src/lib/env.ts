/**
 * Centralized environment variable validation
 * All critical secrets are validated at startup so runtime errors surface early.
 */

import { z } from 'zod';

const envSchema = z.object({
  // ─── Database ──────────────────────────────────────────────────────────────
  DATABASE_URL:  z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL:    z.string().min(1, 'DIRECT_URL is required').optional(),

  // ─── Supabase ──────────────────────────────────────────────────────────────
  NEXT_PUBLIC_SUPABASE_URL:      z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY:     z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  SUPABASE_JWT_SECRET:           z.string().min(1).optional(),

  // ─── Upstash / Redis ───────────────────────────────────────────────────────
  UPSTASH_REDIS_REST_URL:   z.string().url('UPSTASH_REDIS_REST_URL must be a URL'),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1, 'UPSTASH_REDIS_REST_TOKEN is required'),

  // ─── Payments ──────────────────────────────────────────────────────────────
  PAYCHANGU_SECRET_KEY:               z.string().min(1, 'PAYCHANGU_SECRET_KEY is required'),
  NEXT_PUBLIC_PAYCHANGU_PUBLIC_KEY:   z.string().min(1, 'NEXT_PUBLIC_PAYCHANGU_PUBLIC_KEY is required'),

  // ─── Encryption ────────────────────────────────────────────────────────────
  MASTER_ENCRYPTION_KEY: z.string().length(64, 'MASTER_ENCRYPTION_KEY must be a 64-character hex string'),
  SUPABASE_HOOK_SECRET: z.string().min(1, 'SUPABASE_HOOK_SECRET is required'),
  // ─── Email ─────────────────────────────────────────────────────────────────
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required for uniform email services'),
  RESEND_FROM: z.string().min(1, 'RESEND_FROM is required (e.g., no-reply@yourdomain.com)'),

  // ─── App ───────────────────────────────────────────────────────────────────
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NODE_ENV:            z.enum(['development', 'production', 'test']).optional(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  const missing = _env.error.issues.map(i => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`\n❌ Invalid or missing environment variables:\n${missing}\n`);
  // In production, fail hard. In development, warn but continue.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Invalid environment variables. Check server logs.');
  }
}

export const env = (_env.success ? _env.data : process.env) as z.infer<typeof envSchema>;
