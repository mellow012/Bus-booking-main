const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const activeTemplates = await client.query(`
    SELECT t.id, t."routeId", r.origin, r.destination, c.name as company_name
    FROM "ScheduleTemplate" t
    JOIN "Route" r ON t."routeId" = r.id
    JOIN "Company" c ON t."companyId" = c.id
    WHERE t."isActive" = true
  `);
  
  console.log(`Found ${activeTemplates.rowCount} active blueprints.`);

  const now = new Date();
  
  for (const template of activeTemplates.rows) {
    const upcomingSchedules = await client.query(`
      SELECT count(*) as count
      FROM "Schedule"
      WHERE "routeId" = $1 AND "departureDateTime" > $2
    `, [template.routeId, now.toISOString()]);
    
    console.log(`Company: ${template.company_name} | Route: ${template.origin} -> ${template.destination} | Upcoming Schedules: ${upcomingSchedules.rows[0].count}`);
  }

  await client.end();
}

run().catch(console.error);
