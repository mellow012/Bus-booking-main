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
    {
      name: 'Kwezy Bus Company',
      boarding: 'LLW Gateway Mall, BT Wenela Depot',
      schedules: ['Daily'],
      times: ['07:30', '09:30', '13:00'],
      routes: [
        { origin: 'Lilongwe', dest: 'Blantyre', dist: 300, dur: 300, fare: 85000 },
        { origin: 'Lilongwe', dest: 'Mzuzu', dist: 350, dur: 330, fare: 95000 },
        { origin: 'Blantyre', dest: 'Mzuzu', dist: 650, dur: 600, fare: 150000 },
        { origin: 'Lilongwe', dest: 'Kasungu', dist: 120, dur: 120, fare: 65000 }
      ]
    },
    {
      name: 'Sososo Coaches',
      boarding: 'LLW Akulinji Inn, BT Petroda Station, Mzuzu Terminal',
      schedules: ['Daily'],
      times: ['07:00', '11:00', '13:30'],
      routes: [
        { origin: 'Lilongwe', dest: 'Blantyre', dist: 300, dur: 300, fare: 45000 }
      ]
    },
    {
      name: 'AXA Coach Service',
      boarding: 'LLW City Centre, BT Chichiri',
      schedules: ['Daily'],
      times: ['07:00', '11:00', '16:30'],
      routes: [
        { origin: 'Lilongwe', dest: 'Blantyre', dist: 300, dur: 300, fare: 45000 },
        { origin: 'Lilongwe', dest: 'Mzuzu', dist: 350, dur: 330, fare: 45000 },
        { origin: 'Blantyre', dest: 'Mzuzu', dist: 650, dur: 600, fare: 50000 }
      ]
    },
    {
      name: 'Muchawi Coaches',
      boarding: 'BT Wenela Depot, Lilongwe Main Terminal',
      schedules: ['Daily'],
      times: ['07:00', '14:00'],
      routes: [
        { origin: 'Blantyre', dest: 'Lilongwe', dist: 300, dur: 300, fare: 40000 }
      ]
    },
    {
      name: 'Tam Tam Coaches',
      boarding: 'BT Wenela Depot, Lilongwe Terminal',
      schedules: ['Daily'],
      times: ['06:00', '09:00', '12:00', '15:00'],
      routes: [
        { origin: 'Blantyre', dest: 'Lilongwe', dist: 300, dur: 300, fare: 35000 }
      ]
    },
    {
      name: 'Falls Coaches',
      boarding: 'Lilongwe Main Terminal, Salima Depot',
      schedules: ['Daily'],
      times: ['08:00', '10:00', '12:00', '14:00', '16:00'],
      routes: [
        { origin: 'Lilongwe', dest: 'Salima', dist: 100, dur: 90, fare: 8000 }
      ]
    },
    {
      name: 'Karonga Express',
      boarding: 'Mzuzu Terminal, Karonga Main Station, Chitipa',
      schedules: ['Daily'],
      times: ['06:00'],
      routes: [
        { origin: 'Mzuzu', dest: 'Karonga', dist: 220, dur: 180, fare: 25000 },
        { origin: 'Karonga', dest: 'Chitipa', dist: 100, dur: 90, fare: 5000 },
        { origin: 'Mzuzu', dest: 'Chitipa', dist: 320, dur: 270, fare: 30000 }
      ]
    },
    {
      name: 'Northern Express',
      boarding: 'Mzuzu Main Terminal, Mzimba Station',
      schedules: ['Daily'],
      times: ['08:00', '14:00'],
      routes: [
        { origin: 'Mzuzu', dest: 'Mzimba', dist: 120, dur: 120, fare: 10000 }
      ]
    },
    {
      name: 'Horizon Coaches',
      boarding: 'Lilongwe Main Terminal, Kasungu Depot',
      schedules: ['Daily'],
      times: ['07:00', '10:00', '13:00', '16:00'],
      routes: [
        { origin: 'Lilongwe', dest: 'Kasungu', dist: 120, dur: 120, fare: 12000 }
      ]
    },
    {
      name: 'Matours Bus Service',
      boarding: 'Blantyre Wenela Depot, Zomba Bus Terminal',
      schedules: ['Daily'],
      times: ['06:00', '12:00'],
      routes: [
        { origin: 'Blantyre', dest: 'Zomba', dist: 70, dur: 90, fare: 8000 }
      ]
    },
    {
      name: 'Transmo',
      boarding: 'Lilongwe Bus Terminal, Mzuzu Main Depot',
      schedules: ['Daily'],
      times: ['08:00', '14:00'],
      routes: [
        { origin: 'Lilongwe', dest: 'Mzuzu', dist: 350, dur: 330, fare: 30000 }
      ]
    },
    {
      name: 'Malawi Post Coaches',
      boarding: 'Lilongwe Post Office, Blantyre Post Office',
      schedules: ['Daily'],
      times: ['09:00'],
      routes: [
        { origin: 'Lilongwe', dest: 'Blantyre', dist: 300, dur: 300, fare: 35000 },
        { origin: 'Blantyre', dest: 'Mzuzu', dist: 650, dur: 600, fare: 65000 }
      ]
    },
    {
      name: 'Falcon Express',
      boarding: 'Lilongwe Bus Terminal, Mzuzu Main Depot',
      schedules: ['Daily'],
      times: ['08:30'],
      routes: [
        { origin: 'Lilongwe', dest: 'Mzuzu', dist: 350, dur: 330, fare: 28000 }
      ]
    },
    {
      name: 'Kwacha Coaches',
      boarding: 'Blantyre Wenela, Lilongwe Main Depot',
      schedules: ['Daily'],
      times: ['10:00'],
      routes: [
        { origin: 'Blantyre', dest: 'Lilongwe', dist: 300, dur: 300, fare: 32000 }
      ]
    },
    {
      name: 'Zomba Liners',
      boarding: 'Zomba Depot, Blantyre Wenela Depot',
      schedules: ['Daily'],
      times: ['07:00'],
      routes: [
        { origin: 'Zomba', dest: 'Blantyre', dist: 70, dur: 90, fare: 7500 }
      ]
    },
    {
      name: 'Shire Valley Transporters',
      boarding: 'Blantyre Wenela Depot, Chikhwawa Terminal',
      schedules: ['Daily'],
      times: ['08:00'],
      routes: [
        { origin: 'Blantyre', dest: 'Chikhwawa', dist: 50, dur: 60, fare: 6000 }
      ]
    },
    {
      name: 'Lake-Shore Liners',
      boarding: 'Lilongwe Depot, Salima Depot, Nkhotakota Station',
      schedules: ['Daily'],
      times: ['06:30'],
      routes: [
        { origin: 'Lilongwe', dest: 'Salima', dist: 100, dur: 90, fare: 9000 },
        { origin: 'Lilongwe', dest: 'Nkhotakota', dist: 200, dur: 180, fare: 18000 }
      ]
    },
    {
      name: 'Nkhotakota Express',
      boarding: 'Nkhotakota Station, Lilongwe Main Depot',
      schedules: ['Daily'],
      times: ['07:30'],
      routes: [
        { origin: 'Nkhotakota', dest: 'Lilongwe', dist: 200, dur: 180, fare: 17500 }
      ]
    },
    {
      name: 'Kasungu Central',
      boarding: 'Kasungu Depot, Lilongwe Depot',
      schedules: ['Daily'],
      times: ['08:30'],
      routes: [
        { origin: 'Kasungu', dest: 'Lilongwe', dist: 120, dur: 120, fare: 11000 }
      ]
    },
    {
      name: 'Dedza Commuters',
      boarding: 'Dedza Station, Lilongwe Depot',
      schedules: ['Daily'],
      times: ['09:30'],
      routes: [
        { origin: 'Dedza', dest: 'Lilongwe', dist: 85, dur: 90, fare: 8000 }
      ]
    },
    {
      name: 'Mchinji Shuttles',
      boarding: 'Mchinji Depot, Lilongwe Main Depot',
      schedules: ['Daily'],
      times: ['10:30'],
      routes: [
        { origin: 'Mchinji', dest: 'Lilongwe', dist: 110, dur: 100, fare: 9500 }
      ]
    },
    {
      name: 'Rumphi Star',
      boarding: 'Mzuzu Main Terminal, Rumphi Depot',
      schedules: ['Daily'],
      times: ['11:30'],
      routes: [
        { origin: 'Mzuzu', dest: 'Rumphi', dist: 70, dur: 80, fare: 7000 }
      ]
    },
    {
      name: 'Sangano Coaches',
      boarding: 'Blantyre Lodge',
      schedules: ['Tue', 'Fri'],
      times: ['06:00'],
      routes: [
        { origin: 'Blantyre', dest: 'Johannesburg', dist: 1600, dur: 1700, fare: 140000 }
      ]
    },
    {
      name: 'Ulemu Bus Service',
      boarding: 'LLW Kalikuti, BT Blantyre Lodge',
      schedules: ['Wed', 'Sat'],
      times: ['05:00'],
      routes: [
        { origin: 'Lilongwe', dest: 'Johannesburg', dist: 1700, dur: 1800, fare: 140000 },
        { origin: 'Blantyre', dest: 'Johannesburg', dist: 1600, dur: 1700, fare: 140000 }
      ]
    },
    {
      name: 'United Bus (UBZ)',
      boarding: 'LLW Grand Business Park',
      schedules: ['Daily'],
      times: ['06:00'],
      routes: [
        { origin: 'Lilongwe', dest: 'Lusaka', dist: 715, dur: 720, fare: 120000 }
      ]
    },
    {
      name: 'Jobela Star Links',
      boarding: 'Blantyre Lodge',
      schedules: ['Wed', 'Sun'],
      times: ['06:00'],
      routes: [
        { origin: 'Blantyre', dest: 'Johannesburg', dist: 1600, dur: 1700, fare: 140000 }
      ]
    },
    {
      name: 'Rimbi Tours',
      boarding: 'Blantyre Lodge',
      schedules: ['Wed', 'Sun'],
      times: ['06:00'],
      routes: [
        { origin: 'Blantyre', dest: 'Harare', dist: 600, dur: 600, fare: 135000 },
        { origin: 'Blantyre', dest: 'Johannesburg', dist: 1600, dur: 1700, fare: 135000 }
      ]
    },
    {
      name: 'Citiliner Plus',
      boarding: 'Blantyre Lodge',
      schedules: ['Thu'],
      times: ['06:00'],
      routes: [
        { origin: 'Blantyre', dest: 'Johannesburg', dist: 1600, dur: 1700, fare: 140000 },
        { origin: 'Blantyre', dest: 'Harare', dist: 600, dur: 600, fare: 110000 }
      ]
    },
    {
      name: 'Inter-Cape Linkages',
      boarding: 'Blantyre Lodge',
      schedules: ['Fri'],
      times: ['06:00'],
      routes: [
        { origin: 'Blantyre', dest: 'Johannesburg', dist: 1600, dur: 1700, fare: 140000 }
      ]
    },
    {
      name: 'Chikhwawa International',
      boarding: 'Blantyre Lodge',
      schedules: ['Sat'],
      times: ['06:00'],
      routes: [
        { origin: 'Blantyre', dest: 'Harare', dist: 600, dur: 600, fare: 110000 }
      ]
    },
    {
      name: 'Mukumba Travel',
      boarding: 'Blantyre Lodge',
      schedules: ['Mon'],
      times: ['06:00'],
      routes: [
        { origin: 'Blantyre', dest: 'Johannesburg', dist: 1600, dur: 1700, fare: 140000 }
      ]
    },
    {
      name: 'Falcon Cross-Border',
      boarding: 'Blantyre Lodge',
      schedules: ['Tue'],
      times: ['06:00'],
      routes: [
        { origin: 'Blantyre', dest: 'Harare', dist: 600, dur: 600, fare: 110000 }
      ]
    }
  ];

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 7);

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

    // 2. Create Operators for the company
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

    // 3 & 5. Create Routes and Schedules
    for (const routeInfo of op.routes) {
      let route = await prisma.route.findFirst({
        where: {
          companyId,
          origin: routeInfo.origin,
          destination: routeInfo.dest,
        }
      });

      if (!route) {
        route = await prisma.route.create({
          data: {
            companyId,
            name: `${routeInfo.origin} to ${routeInfo.dest}`,
            origin: routeInfo.origin,
            destination: routeInfo.dest,
            distance: routeInfo.dist,
            duration: routeInfo.dur,
            baseFare: routeInfo.fare,
            isActive: true,
          }
        });
      }
      
      // Update price if it was changed
      if (route.baseFare !== routeInfo.fare) {
        route = await prisma.route.update({
          where: { id: route.id },
          data: { baseFare: routeInfo.fare }
        });
      }

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
            } else if (existingSchedule.price !== route.baseFare) {
              // Update existing schedules with new pricing
              await prisma.schedule.update({
                where: { id: existingSchedule.id },
                data: { price: route.baseFare }
              });
            }
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
