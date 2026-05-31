import { config } from 'dotenv';
config();

async function test() {
  try {
    const startOfWeek = new Date();
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    endOfWeek.setHours(23, 59, 59, 999);

    const queryParams = new URLSearchParams({
      startDate: startOfWeek.toISOString(),
      endDate: endOfWeek.toISOString(),
      sortBy: 'departureDateTime',
    });

    const res = await fetch(`http://localhost:3001/api/schedules?${queryParams}`);
    console.log('API Status:', res.status);
    const json = await res.json();
    console.log('Success:', json.success);
    console.log('Count:', json.data?.length);
    if (json.data && json.data.length > 0) {
      console.log('Sample Schedule:', JSON.stringify(json.data[0], null, 2));
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

test();
