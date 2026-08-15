const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.ltypsfmlloiouzwhbwcj:Quantumbyteslab%4099@aws-1-eu-central-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connect_timeout=600',
  ssl: { rejectUnauthorized: false }
});
client.connect()
  .then(() => client.query('SELECT id, "travelDate" FROM "ChatterSchedule";'))
  .then(res => {
    let invalidCount = 0;
    res.rows.forEach(r => {
      const d = new Date(r.travelDate);
      try { d.toISOString(); } catch(e) { console.log('INVALID:', r.id, r.travelDate); invalidCount++; }
    });
    console.log('Total invalid:', invalidCount);
  })
  .catch(console.error)
  .finally(() => client.end());
