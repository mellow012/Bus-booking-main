const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function fixSchedules() {
  console.log('Fixing schedules...');
  
  // 1. Get all schedules
  const schedules = await prisma.schedule.findMany();
  console.log(`Found ${schedules.length} schedules.`);

  const now = new Date();
  
  for (let i = 0; i < schedules.length; i++) {
    const s = schedules[i];
    
    // Set departure to today + (i * some hours)
    const departure = new Date(now);
    departure.setDate(now.getDate() + (i % 3)); // Spread over next 3 days
    departure.setHours(6 + (i * 2), 0, 0, 0); // Morning and afternoon slots
    
    const arrival = new Date(departure);
    arrival.setHours(departure.getHours() + 4); // 4 hour trip
    
    await prisma.schedule.update({
      where: { id: s.id },
      data: {
        status: 'active',
        isActive: true,
        departureDateTime: departure,
        arrivalDateTime: arrival,
        availableSeats: 30,
        isArchived: false,
        isCompleted: false
      }
    });
    console.log(`Updated schedule ${s.id}: ${departure.toISOString()}`);
  }
  
  console.log('All schedules updated to active and future dates.');
}

fixSchedules()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
