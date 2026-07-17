import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    throw new Error('Missing SUPABASE_URL environment variable');
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }
  return createClient(
    url,
    key,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
