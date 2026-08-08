const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const res = await client.query(`
    SELECT id, "departureDateTime", "arrivalDateTime", "busId", "routeId"
    FROM "Schedule"
    WHERE "busId" = '39e3113e-64c8-4142-aaab-08e031262bd3'
  `);
  console.log('Schedules for bus 39e3113e-64c8-4142-aaab-08e031262bd3:', res.rows.length);

  // let's manually run the generation logic using Prisma
  await client.end();
}

run().catch(console.error);
