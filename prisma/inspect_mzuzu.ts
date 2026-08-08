const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('Schedule')
    .select('id, departureDateTime, route:routeId(origin, destination), createdAt')
    .order('createdAt', { ascending: false });

  if (error) {
    console.error("Supabase error:", error);
    return;
  }

  console.log("All schedules:");
  data.forEach(s => {
    console.log(`${s.id} | ${s.departureDateTime} | ${s.route.origin} -> ${s.route.destination} | created: ${s.createdAt}`);
  });
}

main();
