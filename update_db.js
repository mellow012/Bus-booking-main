const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.ltypsfmlloiouzwhbwcj:Quantumbyteslab%4099@aws-1-eu-central-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connect_timeout=600',
  ssl: { rejectUnauthorized: false }
});
client.connect()
  .then(() => client.query("UPDATE \"ChatterSchedule\" SET \"travelDate\" = '2026-08-17T20:00:00.000Z' WHERE id = '0f75b783-4d98-4401-83a9-e6f04bb05271' RETURNING id, \"travelDate\";"))
  .then(res => {
    console.log('Update result:', res.rows);
  })
  .catch(console.error)
  .finally(() => client.end());
