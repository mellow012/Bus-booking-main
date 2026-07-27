import { createTestSchedule, cleanupTestSchedule } from './helpers/seat-concurrency-helpers';

async function run() {
  const sch = await createTestSchedule(2);
  const dateStr = sch.departureDateTime.toISOString().split('T')[0];
  console.log('Created sch:', sch.id, 'Date:', dateStr);

  const res = await fetch(`http://localhost:3000/api/schedules?from=Lilongwe&to=Blantyre&date=${dateStr}&limit=99`);
  const json = await res.json();
  console.log('Found schedule in API response?:', json.data?.find((s: any) => s.id === sch.id) ? 'YES' : 'NO');

  await cleanupTestSchedule(sch.id);
}

run().catch(console.error);
