import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const companyId = 'a16fc39a-f041-4d85-a2ac-17af8a2c9d12'; // From your log
  
  console.log('Fetching with ANON KEY (like the frontend does)...');
  const { data, error } = await supabase.from('Company').select('*').eq('id', companyId).single();
  console.log('Result ANON:', { data, error });

  if (supabaseServiceKey) {
    console.log('\nFetching with SERVICE ROLE KEY (bypasses RLS)...');
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const adminRes = await adminSupabase.from('Company').select('*').eq('id', companyId).single();
    console.log('Result SERVICE:', { data: adminRes.data, error: adminRes.error });
  }
}

check();
