const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('User')
    .select('id, email, role, companyId, isActive')
    .in('role', ['operator', 'company_admin']);

  if (error) {
    console.error("Supabase error:", error);
    return;
  }

  console.log("Operators & Company Admins in DB:");
  console.log(data);
}

main();
