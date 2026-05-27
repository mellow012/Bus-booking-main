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
  FLW_SECRET_KEY:                     z.string().min(1).optional(),
  FLW_PUBLIC_KEY:                     z.string().min(1).optional(),
  FLW_ENCRYPTION_KEY:                 z.string().min(1).optional(),

  // ─── Encryption ────────────────────────────────────────────────────────────
  MASTER_ENCRYPTION_KEY: z.string().length(64, 'MASTER_ENCRYPTION_KEY must be a 64-character hex string'),

  // ─── Email ─────────────────────────────────────────────────────────────────
  EMAIL_HOST: z.string().min(1, 'EMAIL_HOST is required').optional(),
  EMAIL_PORT: z.string().regex(/^\d+$/, 'EMAIL_PORT must be numeric').optional(),
  EMAIL_USER: z.string().min(1, 'EMAIL_USER is required').optional(),
  EMAIL_PASS: z.string().min(1, 'EMAIL_PASS is required').optional(),
  EMAIL_FROM: z.string().min(1, 'EMAIL_FROM is required').optional(),
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required').optional(),
  RESEND_FROM: z.string().min(1, 'RESEND_FROM is required').optional(),

  // ─── App ───────────────────────────────────────────────────────────────────
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NODE_ENV:            z.enum(['development', 'production', 'test']).optional(),
}).refine(
  (env) =>
    Boolean(env.RESEND_API_KEY?.trim()) ||
    (Boolean(env.EMAIL_HOST?.trim()) && Boolean(env.EMAIL_USER?.trim()) && Boolean(env.EMAIL_PASS?.trim())),
  {
    message: 'Either RESEND_API_KEY or all of EMAIL_HOST, EMAIL_USER, and EMAIL_PASS must be set',
    path: ['RESEND_API_KEY'],
  }
);

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
