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

async function main() {
  console.log('Starting enhanced database seeding (Target: May 10th)...');

  const companiesData = [
    {
      name: 'Zikomo Express',
      email: 'admin@zikomoexpress.mw',
      phone: '+265 999 123 456',
      address: 'Wenela Bus Depot, Blantyre',
      description: 'Reliable and comfortable travel across Malawi.',
    },
    {
      name: 'Nyasa Star Lines',
      email: 'hello@nyasastar.mw',
      phone: '+265 888 987 654',
      address: 'Area 3, Lilongwe',
      description: 'Your premier choice for intercity transit.',
    },
    {
      name: 'Malawi Swift Transit',
      email: 'info@malawiswift.mw',
      phone: '+265 991 234 567',
      address: 'Mzuzu Bus Terminal, Mzuzu',
      description: 'Fast, safe, and affordable.',
    },
    {
      name: 'Soche Coaches',
      email: 'travel@soche.mw',
      phone: '+265 995 555 111',
      address: 'Limbe Depot, Blantyre',
      description: 'Luxury travel with respect and dignity.',
    },
    {
      name: 'Kamba Inter-City',
      email: 'bookings@kamba.mw',
      phone: '+265 882 222 333',
      address: 'Devil Street, Lilongwe',
      description: 'The heartbeat of Malawi road travel.',
    },
    {
      name: 'Tithandizane Bus Services',
      email: 'help@tithandizane.mw',
      phone: '+265 993 333 444',
      address: 'M1 Road, Kasungu',
      description: 'Community focused travel solutions.',
    }
  ];

  const targetDate = new Date('2026-05-10T23:59:59Z');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const compData of companiesData) {
    // 1. Find or Create Company
    let company = await prisma.company.findFirst({
      where: { name: compData.name }
    });

    if (company) {
      company = await prisma.company.update({
        where: { id: company.id },
        data: { ...compData }
      });
    } else {
      company = await prisma.company.create({
        data: { 
          ...compData,
          status: 'active',
          planType: 'premium',
          setupCompleted: true,
        }
      });
    }
    
    const companyId = company.id;
    console.log(`Company: ${company.name}`);

    // 2. Clean up existing schedules for this company to avoid duplicates
    await prisma.schedule.deleteMany({ where: { companyId } });
    console.log(`  Cleared existing schedules for ${company.name}`);

    // 3. Upsert Operator
    await prisma.user.upsert({
      where: { email: compData.email },
      update: { role: 'operator', companyId, isActive: true },
      create: {
        uid: uuidv4(),
        email: compData.email,
        firstName: compData.name.split(' ')[0],
        lastName: 'Admin',
        role: 'operator',
        companyId: companyId,
        isActive: true,
        setupCompleted: true,
        passwordSet: true,
      }
    });

    // 4. Upsert Conductor
    const conductorEmail = `conductor@${compData.name.toLowerCase().replace(/ /g, '').replace(/-/g, '')}.mw`;
    const conductor = await prisma.user.upsert({
      where: { email: conductorEmail },
      update: { role: 'conductor', companyId, isActive: true },
      create: {
        uid: uuidv4(),
        email: conductorEmail,
        firstName: 'John',
        lastName: 'Banda',
        role: 'conductor',
        companyId: companyId,
        isActive: true,
        setupCompleted: true,
        passwordSet: true,
      }
    });

    // 5. Create Routes (Delete old ones first for clean seed)
    await prisma.route.deleteMany({ where: { companyId } });
    
    const routesData = [
      { 
        origin: 'Blantyre', 
        destination: 'Lilongwe', 
        distance: 350, 
        duration: 300, 
        baseFare: 25000,
        stops: [
          { id: uuidv4(), name: 'Zalewa', distanceFromOrigin: 60, order: 1 },
          { id: uuidv4(), name: 'Balaka', distanceFromOrigin: 120, order: 2 },
          { id: uuidv4(), name: 'Ntcheu', distanceFromOrigin: 180, order: 3 },
          { id: uuidv4(), name: 'Dedza', distanceFromOrigin: 260, order: 4 },
        ]
      },
      { 
        origin: 'Lilongwe', 
        destination: 'Mzuzu', 
        distance: 360, 
        duration: 360, 
        baseFare: 30000,
        stops: [
          { id: uuidv4(), name: 'Kasungu', distanceFromOrigin: 130, order: 1 },
          { id: uuidv4(), name: 'Mzimba', distanceFromOrigin: 250, order: 2 },
        ]
      },
      { 
        origin: 'Blantyre', 
        destination: 'Mangochi', 
        distance: 190, 
        duration: 180, 
        baseFare: 12000,
        stops: [
          { id: uuidv4(), name: 'Zomba', distanceFromOrigin: 70, order: 1 },
          { id: uuidv4(), name: 'Liwonde', distanceFromOrigin: 120, order: 2 },
        ]
      },
      {
        origin: 'Lilongwe',
        destination: 'Nkhata Bay',
        distance: 320,
        duration: 300,
        baseFare: 22000,
        stops: [
          { id: uuidv4(), name: 'Salima', distanceFromOrigin: 100, order: 1 },
          { id: uuidv4(), name: 'Nkhotakota', distanceFromOrigin: 200, order: 2 },
          { id: uuidv4(), name: 'Chintheche', distanceFromOrigin: 280, order: 3 },
        ]
      },
      {
        origin: 'Mzuzu',
        destination: 'Karonga',
        distance: 220,
        duration: 180,
        baseFare: 15000,
        stops: [
          { id: uuidv4(), name: 'Ekwendeni', distanceFromOrigin: 20, order: 1 },
          { id: uuidv4(), name: 'Rumphi', distanceFromOrigin: 65, order: 2 },
          { id: uuidv4(), name: 'Chilumba', distanceFromOrigin: 150, order: 3 },
        ]
      }
    ];

    const createdRoutes = [];
    for (const r of routesData) {
      const route = await prisma.route.create({
        data: {
          companyId: companyId,
          name: `${r.origin} to ${r.destination}`,
          origin: r.origin,
          destination: r.destination,
          distance: r.distance,
          duration: r.duration,
          baseFare: r.baseFare,
          isActive: true,
          status: 'active',
          stops: r.stops as any,
        }
      });
      createdRoutes.push(route);
    }

    // 6. Create Buses (Delete old ones first for clean seed)
    await prisma.bus.deleteMany({ where: { companyId } });
    
    const busTypes = [
      { type: 'Luxury Coach', capacity: 50, amenities: ['AC', 'WiFi', 'Charging Ports', 'Reclining Seats', 'Toilet'] },
      { type: 'Semi-Luxury', capacity: 60, amenities: ['AC', 'Reclining Seats', 'Entertainment'] },
      { type: 'Economy', capacity: 65, amenities: ['Entertainment'] },
      { type: 'Minibus', capacity: 26, amenities: ['Music'] },
    ];

    const createdBuses = [];
    for (let i = 0; i < 4; i++) {
      const busType = busTypes[i];
      const bus = await prisma.bus.create({
        data: {
          companyId: companyId,
          licensePlate: `MW ${Math.floor(1000 + Math.random() * 8999)} ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`,
          busType: busType.type,
          capacity: busType.capacity,
          amenities: busType.amenities,
          status: 'active',
          isActive: true,
          conductorIds: [conductor.id],
        }
      });
      createdBuses.push(bus);
    }

    // 7. Create Schedules until May 10th
    for (let i = 0; i < createdRoutes.length; i++) {
      const route = createdRoutes[i];
      const bus = createdBuses[i % createdBuses.length];
      
      let currentDate = new Date(today);
      while (currentDate <= targetDate) {
        // Add a morning trip
        const morningTrip = new Date(currentDate);
        morningTrip.setHours(7 + (i % 3), 0, 0, 0); 
        
        const arrDateMorning = new Date(morningTrip);
        arrDateMorning.setMinutes(arrDateMorning.getMinutes() + route.duration);

        await prisma.schedule.create({
          data: {
            companyId: companyId,
            busId: bus.id,
            routeId: route.id,
            departureDateTime: morningTrip,
            arrivalDateTime: arrDateMorning,
            departureLocation: `${route.origin} Bus Terminal`,
            arrivalLocation: `${route.destination} Main Depot`,
            availableSeats: bus.capacity,
            price: route.baseFare,
            status: 'active',
            tripStatus: 'scheduled',
            isActive: true,
          }
        });

        // Add an afternoon trip every other day
        if (currentDate.getDate() % 2 === 0) {
          const afternoonTrip = new Date(currentDate);
          afternoonTrip.setHours(14 + (i % 2), 30, 0, 0);
          
          const arrDateAfternoon = new Date(afternoonTrip);
          arrDateAfternoon.setMinutes(arrDateAfternoon.getMinutes() + route.duration);

          await prisma.schedule.create({
            data: {
              companyId: companyId,
              busId: bus.id,
              routeId: route.id,
              departureDateTime: afternoonTrip,
              arrivalDateTime: arrDateAfternoon,
              departureLocation: `${route.origin} Bus Terminal`,
              arrivalLocation: `${route.destination} Main Depot`,
              availableSeats: bus.capacity,
              price: route.baseFare,
              status: 'active',
              tripStatus: 'scheduled',
              isActive: true,
            }
          });
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
    console.log(`  Seeded routes and schedules through May 10th for ${company.name}`);
  }

  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
