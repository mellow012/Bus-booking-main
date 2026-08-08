const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('Schedule')
    .select('id, departureDateTime, arrivalDateTime, createdAt, updatedAt')
    .eq('id', 'fa4596c4-b760-4410-a11d-985092b9cf8b')
    .single();

  if (error) {
    console.error("Supabase error:", error);
    return;
  }

  console.log("Raw Supabase Schedule Row:");
  console.log(data);
}

main();
