const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.ltypsfmlloiouzwhbwcj:Quantumbyteslab%4099@aws-1-eu-central-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connect_timeout=600',
  ssl: { rejectUnauthorized: false }
});
client.connect()
  .then(() => client.query('SELECT id, "travelDate", "createdAt" FROM "ChatterSchedule" ORDER BY "createdAt" DESC LIMIT 5;'))
  .then(res => {
    console.log('Recent Chatter Schedules:');
    res.rows.forEach(r => console.log('- ID:', r.id, '| travelDate:', r.travelDate, '| createdAt:', r.createdAt));
  })
  .catch(console.error)
  .finally(() => client.end());
