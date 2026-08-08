const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const companyId = '231f3927-809e-4420-aff9-c7648d6ad64e';
  const userId = '2a52b725-0918-4e30-9cd6-e54f2afe85db'; // trevortaulo03@gmail.com

  // Fetch Company Name
  const { data: company, error: compErr } = await supabase
    .from('Company')
    .select('name')
    .eq('id', companyId)
    .single();

  if (compErr) {
    console.error("Company fetch error:", compErr);
    return;
  }
  const companyName = company.name;
  console.log("Company Name:", companyName);

  // 1. Update User table
  const { data: userUpdate, error: userError } = await supabase
    .from('User')
    .update({ role: 'operator', companyId })
    .eq('id', userId)
    .select();

  if (userError) {
    console.error("User update error:", userError);
    return;
  }
  console.log("Updated User:", userUpdate);

  // 2. Find a Region for the company
  const { data: regions, error: regError } = await supabase
    .from('Region')
    .select('id, name')
    .eq('companyId', companyId);

  if (regError) {
    console.error("Region fetch error:", regError);
    return;
  }
  const regionId = regions?.[0]?.id || null;

  // 3. Upsert Operator row
  const now = new Date().toISOString();
  const { data: operator, error: opError } = await supabase
    .from('Operator')
    .upsert({
      id: userId,
      uid: userId,
      companyId,
      companyName,
      email: 'trevortaulo03@gmail.com',
      name: 'Trevor Taulo',
      role: 'operator',
      regionId,
      status: 'active',
      createdAt: now,
      updatedAt: now
    })
    .select();

  if (opError) {
    console.error("Operator upsert error:", opError);
    return;
  }
  console.log("Upserted Operator:", operator);

  // 4. Link all routes of the company to the operator in _OperatorRoutes
  const { data: routes, error: routesError } = await supabase
    .from('Route')
    .select('id')
    .eq('companyId', companyId);

  if (routesError) {
    console.error("Routes fetch error:", routesError);
    return;
  }

  for (const r of routes || []) {
    const { error: linkError } = await supabase
      .from('_OperatorRoutes')
      .upsert({
        A: userId, // Operator.id
        B: r.id    // Route.id
      });
    if (linkError) {
      console.error(`Failed to link route ${r.id}:`, linkError);
    } else {
      console.log(`Linked route ${r.id} to operator.`);
    }
  }
}

main();
