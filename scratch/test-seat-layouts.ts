import { generateSeatGrid, SEAT_LAYOUT_PRESETS, SeatLayoutKey } from '../src/lib/seatLayout';

function testPreset(presetKey: SeatLayoutKey, capacity: number) {
  console.log(`\n--- Testing Preset: "${presetKey}" with Capacity: ${capacity} ---`);
  
  const result = generateSeatGrid({
    capacity,
    seatLayoutKey: presetKey,
  });

  const allSeats = result.grid.flat().filter((s): s is string => s !== null);
  const totalSeats = allSeats.length;

  console.log(`Preset: ${result.preset.name} | Seats per row: ${result.seatsPerRow} | Aisle position: ${result.aislePosition}`);
  console.log(`Total Rows: ${result.totalRows} | Seats Generated: ${totalSeats}`);
  console.log(`First row: [${result.grid[0]?.filter(Boolean).join(', ')}]`);
  console.log(`Last row: [${result.grid[result.grid.length - 1]?.filter(Boolean).join(', ')}]`);

  // Assertions
  if (totalSeats !== capacity) {
    console.error(`❌ Seat count mismatch! Expected ${capacity}, got ${totalSeats}`);
    return false;
  }

  // Check seat labels validity
  const validLetters = new Set(result.preset.seatLabels);
  for (const seat of allSeats) {
    const letter = seat.slice(-1);
    if (!validLetters.has(letter)) {
      console.error(`❌ Invalid seat label found: ${seat}`);
      return false;
    }
  }

  console.log(`✅ Preset "${presetKey}" passed! Total seats: ${totalSeats} == ${capacity}, all labels valid.`);
  return true;
}

async function runLayoutTests() {
  console.log('--- Starting Section 6 Vehicle Seat Layouts Verifications ---');

  const tests = [
    { key: 'minibus' as SeatLayoutKey, capacity: 15 },
    { key: 'coaster' as SeatLayoutKey, capacity: 23 },
    { key: 'coach' as SeatLayoutKey, capacity: 47 },
    { key: 'luxury' as SeatLayoutKey, capacity: 19 },
  ];

  let allPassed = true;
  for (const t of tests) {
    const passed = testPreset(t.key, t.capacity);
    if (!passed) allPassed = false;
  }

  if (allPassed) {
    console.log('\n✅ ALL 4 PRESETS PASSED UNEVEN CAPACITY OVERFLOW TESTS SUCCESSFULLY!');
  } else {
    console.error('\n❌ Seat layout preset verification failed.');
  }
}

runLayoutTests().catch(console.error);
