require('dotenv').config();
import { materializeSchedules } from './src/lib/actions/schedule.actions';
import { prisma } from './src/lib/prisma';

async function run() {
  const companyId = '231f3927-809e-4420-aff9-c7648d6ad64e';
  const routeId = '46476ae8-baf3-4dc1-b42c-0aefe716daaf';
  
  console.log("Calling materializeSchedules...");
  const res = await materializeSchedules(companyId, routeId, 30);
  console.log("Result:", res);
  
  await prisma.$disconnect();
}

run().catch(console.error);
