import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from 'dotenv';
config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function debugQuery() {
  try {
    const total = await prisma.schedule.count();
    console.log('1. Total schedules in DB:', total);

    const active = await prisma.schedule.count({
      where: { status: 'active' }
    });
    console.log('2. Active status schedules:', active);

    const activeSeats = await prisma.schedule.count({
      where: {
        status: 'active',
        availableSeats: { gt: 0 }
      }
    });
    console.log('3. Active & seats > 0:', activeSeats);

    const activeSeatsCompany = await prisma.schedule.count({
      where: {
        status: 'active',
        availableSeats: { gt: 0 },
        company: { status: 'active' }
      }
    });
    console.log('4. Active, seats > 0, active company:', activeSeatsCompany);

    const activeSeatsCompanyRoute = await prisma.schedule.count({
      where: {
        status: 'active',
        availableSeats: { gt: 0 },
        company: { status: 'active' },
        route: { isActive: true }
      }
    });
    console.log('5. Active, seats > 0, active company, active route:', activeSeatsCompanyRoute);

    const gracePeriod = new Date(Date.now() - 30 * 60 * 1000);
    const withArrival = await prisma.schedule.count({
      where: {
        status: 'active',
        availableSeats: { gt: 0 },
        company: { status: 'active' },
        route: { isActive: true },
        arrivalDateTime: { gt: gracePeriod }
      }
    });
    console.log('6. With arrivalDateTime > gracePeriod:', withArrival);

    // Let's print one schedule with its relations to inspect dates
    const sample = await prisma.schedule.findFirst({
      include: { route: true, company: true }
    });
    console.log('\nSample Schedule Details:');
    if (sample) {
      console.log('ID:', sample.id);
      console.log('Departure:', sample.departureDateTime);
      console.log('Arrival:', sample.arrivalDateTime);
      console.log('Status:', sample.status);
      console.log('isActive:', sample.isActive);
      console.log('availableSeats:', sample.availableSeats);
      console.log('company status:', sample.company?.status);
      console.log('route isActive:', sample.route?.isActive);
      console.log('Current System Time (UTC):', new Date().toISOString());
    } else {
      console.log('No sample schedule found!');
    }
  } catch (err) {
    console.error('Error debugging query:', err);
  } finally {
    await prisma.$disconnect();
  }
}

debugQuery();
