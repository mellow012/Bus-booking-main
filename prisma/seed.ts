import { config } from 'dotenv';
config();
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function generateFirebaseUid() {
  // Generate a mock Firebase-like UID for seeding purposes
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 28; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function main() {
  console.log('Starting Malawian Bus Operators Seeding...');

  const operatorsData = [
    { name: '3 Stars Bus', route: 'Blantyre to Harare', schedules: ['Wed', 'Sun'], boarding: 'Blantyre Lodge Terminal' },
    { name: 'AXA Coach', route: 'Lilongwe to Karonga via Blantyre & Mzuzu', schedules: ['Daily'], boarding: 'LLW City Centre, BT Chichiri, Mzuzu Terminal', times: ['07:00', '11:00', '16:30'] },
    { name: 'Beforward Coaches', route: 'Blantyre to Mzuzu via Lilongwe', schedules: ['Daily'], boarding: 'Main Bus Terminals' },
    { name: 'Borneo Coaches', route: 'Lilongwe to Blantyre', schedules: ['Daily'], boarding: 'Main Bus Terminals' },
    { name: 'Captain Falcon', route: 'Lilongwe to Dar es Salaam', schedules: ['Tue', 'Fri'], boarding: 'LLW Grand Business Park, Mzuzu Terminal' },
    { name: 'Captain Tours', route: 'Lilongwe to Tanzania', schedules: ['Daily'], boarding: 'LLW Main Terminal, Mzuzu Bus Station' },
    { name: 'Citiliner Plus', route: 'Lilongwe to Johannesburg', schedules: ['Wed'], boarding: 'LLW Thembalethu Square' },
    { name: 'City Tours & Travel', route: 'Regional Routes', schedules: ['Daily'], boarding: 'Main Bus Terminals' },
    { name: 'Falcon Bus', route: 'Lilongwe to Dar es Salaam', schedules: ['Sat'], boarding: 'LLW Grand Business Park, Mzuzu Terminal' },
    { name: 'Falls Coaches', route: 'Lilongwe Regional', schedules: ['Daily'], boarding: 'Lilongwe Main Terminal' },
    { name: 'Future Tours', route: 'Mzuzu to Chitipa via Karonga', schedules: ['Daily'], boarding: 'Mzuzu Main Depot' },
    { name: 'Horizon Coaches', route: 'Inter-district Routes', schedules: ['Daily'], boarding: 'Main Bus Terminals' },
    { name: 'Jobela Stars', route: 'Blantyre to Cape Town', schedules: ['Sat'], boarding: 'Blantyre Lodge' },
    { name: 'Kwezy Buses', route: 'Lilongwe to Nkhata Bay via BT & Mzuzu', schedules: ['Daily'], boarding: 'LLW Gateway Mall, BT Wenela, Mzuzu Bus Station', times: ['07:30', '09:30', '13:00'] },
    { name: 'Matours International', route: 'Lilongwe to Johannesburg via Blantyre', schedules: ['Tue', 'Sat'], boarding: 'LLW Thembalethu, BT Wenela', times: ['05:00'] },
    { name: 'Muchawi Coaches', route: 'Blantyre to Lilongwe', schedules: ['Daily'], boarding: 'BT Wenela, LLW Devil Street', times: ['07:00', '14:00'] },
    { name: 'Munorurama Coaches', route: 'Blantyre to Harare', schedules: ['Wed', 'Sun'], boarding: 'Blantyre Lodge' },
    { name: 'National Bus Co.', route: 'Rural Routes', schedules: ['Daily'], boarding: 'All Major Stations' },
    { name: 'Post Coach', route: 'Blantyre to Mzuzu via Lilongwe', schedules: ['Daily'], boarding: 'Major Post Offices', times: ['08:00'] },
    { name: 'Rimbi Tours', route: 'Blantyre to Harare', schedules: ['Wed', 'Sun'], boarding: 'Blantyre Lodge' },
    { name: 'Sangano Coaches', route: 'Blantyre to Johannesburg', schedules: ['Tue', 'Fri'], boarding: 'Blantyre Lodge' },
    { name: 'Sososo Coaches', route: 'Lilongwe to Karonga via BT & Mzuzu', schedules: ['Daily'], boarding: 'LLW Akulinji Inn, BT Petroda, Mzuzu Main Station', times: ['07:00', '11:00', '13:30'] },
    { name: 'Tam Tam Coaches', route: 'Blantyre to Lilongwe', schedules: ['Daily'], boarding: 'BT Wenela Depot', times: ['06:00', '09:00', '12:00', '15:00'] },
    { name: 'Transmo', route: 'Regional Routes', schedules: ['Daily'], boarding: 'Main Bus Terminals' },
    { name: 'Ulemu Bus Service', route: 'Lilongwe to Johannesburg via Blantyre', schedules: ['Wed', 'Sat'], boarding: 'LLW Kalikuti, BT Blantyre Lodge', times: ['05:00'] },
    { name: 'United Bus (UBZ)', route: 'Lilongwe to Lusaka', schedules: ['Daily'], boarding: 'LLW Grand Business Park', times: ['06:00'] },
    { name: 'Northern Express', route: 'Mzuzu to Chitipa via Karonga', schedules: ['Daily'], boarding: 'Mzuzu Main Terminal', times: ['06:00', '13:00'] },
    { name: 'Lakeshore Transport', route: 'Mzuzu to Chintheche via Nkhata Bay', schedules: ['Daily'], boarding: 'Mzuzu Bus Station' },
    { name: 'Rumphi Buses', route: 'Mzuzu to Nyika Plateau via Rumphi', schedules: ['Daily'], boarding: 'Mzuzu Bus Station' },
    { name: 'Ekwendeni Transport', route: 'Mzuzu to Mzimba via Ekwendeni', schedules: ['Daily'], boarding: 'Mzuzu Main Terminal' },
    { name: 'Karonga Express', route: 'Karonga to Lilongwe via Mzuzu', schedules: ['Tue', 'Thu', 'Sat'], boarding: 'Karonga Main Station, Mzuzu Terminal' },
    { name: 'Livingstonia Bus', route: 'Mzuzu to Livingstonia Mission', schedules: ['Mon', 'Wed', 'Fri'], boarding: 'Mzuzu Mission Road Terminal' },
  ];

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 7); // Seed for next 7 days

  const routeTemplates = {
    'Blantyre to Lilongwe': { origin: 'Blantyre', dest: 'Lilongwe', dist: 300, dur: 300, fare: 25000 },
    'Lilongwe to Blantyre': { origin: 'Lilongwe', dest: 'Blantyre', dist: 300, dur: 300, fare: 25000 },
    'Lilongwe to Mzuzu': { origin: 'Lilongwe', dest: 'Mzuzu', dist: 350, dur: 330, fare: 30000 },
    'Mzuzu to Lilongwe': { origin: 'Mzuzu', dest: 'Lilongwe', dist: 350, dur: 330, fare: 30000 },
    'Mzuzu to Karonga': { origin: 'Mzuzu', dest: 'Karonga', dist: 220, dur: 180, fare: 15000 },
    'Karonga to Mzuzu': { origin: 'Karonga', dest: 'Mzuzu', dist: 220, dur: 180, fare: 15000 },
    'Blantyre to Mzuzu': { origin: 'Blantyre', dest: 'Mzuzu', dist: 650, dur: 600, fare: 50000 },
    'Blantyre to Harare': { origin: 'Blantyre', dest: 'Harare', dist: 600, dur: 600, fare: 80000 },
    'Lilongwe to Johannesburg': { origin: 'Lilongwe', dest: 'Johannesburg', dist: 1700, dur: 1800, fare: 150000 },
    'Blantyre to Johannesburg': { origin: 'Blantyre', dest: 'Johannesburg', dist: 1600, dur: 1700, fare: 140000 },
    'Lilongwe to Dar es Salaam': { origin: 'Lilongwe', dest: 'Dar es Salaam', dist: 1500, dur: 2100, fare: 120000 },
    'Lilongwe to Tanzania': { origin: 'Lilongwe', dest: 'Tanzania', dist: 1600, dur: 2400, fare: 130000 },
    'Blantyre to Cape Town': { origin: 'Blantyre', dest: 'Cape Town', dist: 3500, dur: 3600, fare: 250000 },
    'Lilongwe to Lusaka': { origin: 'Lilongwe', dest: 'Lusaka', dist: 715, dur: 720, fare: 90000 },
    'Mzuzu to Chitipa': { origin: 'Mzuzu', dest: 'Chitipa', dist: 320, dur: 300, fare: 25000 },
    'Mzuzu to Nkhata Bay': { origin: 'Mzuzu', dest: 'Nkhata Bay', dist: 50, dur: 60, fare: 5000 },
    'Mzuzu to Chintheche': { origin: 'Mzuzu', dest: 'Chintheche', dist: 90, dur: 100, fare: 8000 },
    'Mzuzu to Rumphi': { origin: 'Mzuzu', dest: 'Rumphi', dist: 65, dur: 80, fare: 6000 },
    'Mzuzu to Nyika Plateau': { origin: 'Mzuzu', dest: 'Nyika Plateau', dist: 180, dur: 300, fare: 20000 },
    'Mzuzu to Mzimba': { origin: 'Mzuzu', dest: 'Mzimba', dist: 120, dur: 120, fare: 10000 },
    'Mzuzu to Livingstonia Mission': { origin: 'Mzuzu', dest: 'Livingstonia Mission', dist: 130, dur: 180, fare: 12000 },
    'Regional Routes': { origin: 'Lilongwe', dest: 'Blantyre', dist: 300, dur: 300, fare: 25000 },
    'Inter-district Routes': { origin: 'Lilongwe', dest: 'Salima', dist: 100, dur: 90, fare: 8000 },
    'Rural Routes': { origin: 'Mzuzu', dest: 'Mzimba', dist: 120, dur: 120, fare: 10000 },
    'Lilongwe Regional': { origin: 'Lilongwe', dest: 'Salima', dist: 100, dur: 90, fare: 8000 },
  };

  for (const op of operatorsData) {
    console.log(`Processing ${op.name}...`);
    
    // 1. Create/Update Company safely
    let company = await prisma.company.findFirst({
      where: { name: op.name }
    });

    if (!company) {
      company = await prisma.company.create({
        data: {
          name: op.name,
          email: `info@${op.name.toLowerCase().replace(/ /g, '')}.mw`,
          phone: `+265 ${Math.floor(880000000 + Math.random() * 100000000)}`,
          address: op.boarding,
          status: 'active',
          setupCompleted: true,
        }
      });
    }

    const companyId = company.id;

    // 2. Create Operators for the company (one main operator and one conductor)
    const mainOperatorEmail = `operator@${op.name.toLowerCase().replace(/ /g, '')}.mw`;
    const conductorEmail = `conductor@${op.name.toLowerCase().replace(/ /g, '')}.mw`;

    let mainOperator = await prisma.operator.findFirst({
      where: { email: mainOperatorEmail }
    });

    if (!mainOperator) {
      mainOperator = await prisma.operator.create({
        data: {
          uid: await generateFirebaseUid(),
          companyId,
          companyName: op.name,
          email: mainOperatorEmail,
          name: `${op.name} Operator`,
          role: 'operator',
          status: 'active',
          invitationSent: true,
          invitationSentAt: new Date(),
          signupCompletedAt: new Date(),
          createdBy: 'system',
        }
      });
    }

    let conductor = await prisma.operator.findFirst({
      where: { email: conductorEmail }
    });

    if (!conductor) {
      conductor = await prisma.operator.create({
        data: {
          uid: await generateFirebaseUid(),
          companyId,
          companyName: op.name,
          email: conductorEmail,
          name: `${op.name} Conductor`,
          role: 'conductor',
          status: 'active',
          invitationSent: true,
          invitationSentAt: new Date(),
          signupCompletedAt: new Date(),
          createdBy: 'system',
        }
      });
    }

    // 3. Create Route safely
    const rTemplate = routeTemplates[op.route as keyof typeof routeTemplates] || routeTemplates['Blantyre to Lilongwe'];
    let route = await prisma.route.findFirst({
      where: {
        companyId,
        origin: rTemplate.origin,
        destination: rTemplate.dest,
      }
    });

    if (!route) {
      route = await prisma.route.create({
        data: {
          companyId,
          name: `${rTemplate.origin} to ${rTemplate.dest}`,
          origin: rTemplate.origin,
          destination: rTemplate.dest,
          distance: rTemplate.dist,
          duration: rTemplate.dur,
          baseFare: rTemplate.fare,
          isActive: true,
        }
      });
    }

    // 4. Create Bus safely
    let bus = await prisma.bus.findFirst({
      where: { companyId }
    });

    if (!bus) {
      bus = await prisma.bus.create({
        data: {
          companyId,
          licensePlate: `MW ${Math.floor(1000 + Math.random() * 8999)} ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`,
          busType: 'Luxury Coach',
          capacity: 50,
          amenities: ['AC', 'WiFi', 'Charging Ports'],
          status: 'active',
        }
      });
    }

    // 5. Create Schedules
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const schedulesToCreate = op.schedules.includes('Daily') ? dayNames : op.schedules;
    const times = op.times || ['06:00', '08:00', '13:00'];

    let currentDate = new Date();
    currentDate.setHours(0,0,0,0);

    for (let d = 0; d < 7; d++) {
      const dayDate = new Date(currentDate);
      dayDate.setDate(dayDate.getDate() + d);
      const dayName = dayNames[dayDate.getDay()];

      if (schedulesToCreate.includes(dayName)) {
        for (const time of times) {
          const [hours, minutes] = time.split(':').map(Number);
          const depTime = new Date(dayDate);
          depTime.setHours(hours, minutes, 0, 0);

          const arrTime = new Date(depTime);
          arrTime.setMinutes(arrTime.getMinutes() + route.duration);

          // Check if schedule already exists
          const existingSchedule = await prisma.schedule.findFirst({
            where: {
              companyId,
              routeId: route.id,
              departureDateTime: depTime,
            }
          });

          if (!existingSchedule) {
            await prisma.schedule.create({
              data: {
                companyId,
                busId: bus.id,
                routeId: route.id,
                operatorId: mainOperator.id,
                departureDateTime: depTime,
                arrivalDateTime: arrTime,
                availableSeats: bus.capacity,
                price: route.baseFare,
                status: 'active',
                tripStatus: 'scheduled',
              }
            });
          }
        }
      }
    }
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
