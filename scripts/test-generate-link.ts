import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email: 'test@example.com',
  });
  console.log('Error:', error);
  console.log('Data:', JSON.stringify(data, null, 2));
}

test();
