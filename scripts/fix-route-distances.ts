import { config } from 'dotenv';
config();

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Default distances for common routes
const routeDistances: Record<string, number> = {
  'Blantyre to Lilongwe': 300,
  'Lilongwe to Blantyre': 300,
  'Lilongwe to Mzuzu': 350,
  'Mzuzu to Lilongwe': 350,
  'Mzuzu to Karonga': 220,
  'Karonga to Mzuzu': 220,
  'Blantyre to Mzuzu': 650,
  'Blantyre to Harare': 600,
  'Lilongwe to Johannesburg': 1700,
  'Blantyre to Johannesburg': 1600,
  'Lilongwe to Dar es Salaam': 1500,
  'Lilongwe to Tanzania': 1600,
  'Blantyre to Cape Town': 3500,
  'Lilongwe to Lusaka': 715,
  'Mzuzu to Chitipa': 320,
  'Mzuzu to Nkhata Bay': 50,
  'Mzuzu to Chintheche': 90,
  'Mzuzu to Rumphi': 65,
  'Mzuzu to Nyika Plateau': 180,
  'Mzuzu to Mzimba': 120,
  'Mzuzu to Livingstonia Mission': 130,
};

async function main() {
  try {
    console.log('Fixing route distances...');

    // Get all routes
    const routes = await prisma.route.findMany();
    console.log(`Found ${routes.length} routes`);

    let updated = 0;
    for (const route of routes) {
      // If distance is null or 0, try to populate it
      if (!route.distance) {
        const routeKey = `${route.origin} to ${route.destination}`;
        const distance = routeDistances[routeKey];

        if (distance) {
          await prisma.route.update({
            where: { id: route.id },
            data: { distance },
          });
          console.log(`✓ Updated ${routeKey}: ${distance} km`);
          updated++;
        } else {
          // Default to 100 km if no match found
          await prisma.route.update({
            where: { id: route.id },
            data: { distance: 100 },
          });
          console.log(`⚠ Set default 100 km for ${routeKey}`);
          updated++;
        }
      }
    }

    console.log(`\n✓ Updated ${updated} routes`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
