// scripts/migrate.ts
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const dotenv = require('dotenv');
const path = require('path');

// Load both .env and .env.local
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Initialize Firebase Admin using credentials from .env.local
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

const sanitizePrivateKey = (key: string | undefined): string | undefined => {
  if (!key) return undefined;
  return key
    .replace(/\\\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r/g, '')
    .replace(/^["']/, '')
    .replace(/["',\s]+$/, '')
    .trim();
};

const privateKey = sanitizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

if (!projectId || !clientEmail || !privateKey) {
  console.error('Missing or malformed Firebase Admin credentials in .env.local');
  process.exit(1);
}

const app = getApps().length === 0 ? initializeApp({
  credential: cert({
    projectId,
    clientEmail,
    privateKey,
  })
}, 'migration') : getApps()[0];

const db = getFirestore(app);

async function migrate() {
  console.log('--- Starting Final Comprehensive Migration from Firestore to SQL ---');

  try {
    // 1. Migrate Companies (FIRST)
    console.log('1. Migrating Companies...');
    let companiesSnap = await db.collection('company').get();
    if (companiesSnap.size === 0) {
      console.log('No docs in "company", trying "companies"...');
      companiesSnap = await db.collection('companies').get();
    }
    
    console.log(`Found ${companiesSnap.size} companies.`);
    for (const doc of companiesSnap.docs) {
      const data = doc.data();
      await prisma.company.upsert({
        where: { id: doc.id },
        update: {},
        create: {
          id: doc.id,
          name: data.name,
          email: data.email,
          phone: data.phone,
          address: data.address,
          description: data.description,
          logo: data.logo,
          status: data.status || 'active',
          maxBuses: data.maxBuses || 6,
          maxRoutes: data.maxRoutes || 3,
          branches: data.branches,
          contactSettings: data.contactSettings,
          paymentSettings: data.paymentSettings,
          notificationSettings: data.notificationSettings,
          operatingHours: data.operatingHours,
          setupCompleted: data.setupCompleted ?? false,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        },
      });
    }
    console.log(`Migrated companies.`);

    // 2. Migrate Routes
    console.log('2. Migrating Routes...');
    const routesSnap = await db.collection('routes').get();
    for (const doc of routesSnap.docs) {
      const data = doc.data();
      if (!data.companyId) continue;
      
      const companyExists = await prisma.company.findUnique({ where: { id: data.companyId } });
      if (!companyExists) {
        console.warn(`Skipping Route ${doc.id} - missing company ${data.companyId}`);
        continue;
      }

      await prisma.route.upsert({
        where: { id: doc.id },
        update: {},
        create: {
          id: doc.id,
          companyId: data.companyId,
          name: data.name || `${data.origin} - ${data.destination}`,
          origin: data.origin,
          destination: data.destination,
          distance: data.distance || 0,
          duration: data.duration || 0,
          baseFare: data.baseFare || 0,
          stops: data.stops,
          isActive: data.isActive ?? true,
          status: data.status || 'active',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        },
      });
    }
    console.log(`Migrated routes.`);

    // 3. Migrate Buses
    console.log('3. Migrating Buses...');
    const busesSnap = await db.collection('buses').get();
    for (const doc of busesSnap.docs) {
      const data = doc.data();
      if (!data.companyId) continue;

      const companyExists = await prisma.company.findUnique({ where: { id: data.companyId } });
      if (!companyExists) {
        console.warn(`Skipping Bus ${doc.id} - missing company ${data.companyId}`);
        continue;
      }

      await prisma.bus.upsert({
        where: { id: doc.id },
        update: {},
        create: {
          id: doc.id,
          companyId: data.companyId,
          licensePlate: data.licensePlate,
          busType: data.busType,
          capacity: data.capacity || 0,
          amenities: data.amenities,
          status: data.status || 'active',
          yearOfManufacture: data.yearOfManufacture,
          isActive: data.isActive ?? true,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        },
      });
    }
    console.log(`Migrated buses.`);

    // 4. Migrate Users
    console.log('4. Migrating Users...');
    const usersSnap = await db.collection('users').get();
    for (const doc of usersSnap.docs) {
      const data = doc.data();
      const uid = data.uid || doc.id;

      // Handle optional company link
      let validCompanyId = undefined;
      if (data.companyId) {
        const companyExists = await prisma.company.findUnique({ where: { id: data.companyId } });
        if (companyExists) validCompanyId = data.companyId;
      }

      await prisma.user.upsert({
        where: { uid: uid },
        update: {},
        create: {
          id: doc.id,
          uid: uid,
          email: data.email || `${doc.id}@placeholder.com`,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          phone: data.phone,
          role: data.role || 'customer',
          nationalId: data.nationalId,
          sex: data.sex,
          currentAddress: data.currentAddress,
          isActive: data.isActive ?? true,
          emailVerified: data.emailVerified ?? false,
          setupCompleted: data.setupCompleted ?? false,
          passwordSet: data.passwordSet ?? false,
          fcmTokens: data.fcmTokens,
          companyId: validCompanyId,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        },
      });
    }
    console.log(`Migrated users.`);

    // 5. Migrate Operators
    console.log('5. Migrating Operators...');
    const operatorsSnap = await db.collection('operators').get();
    for (const doc of operatorsSnap.docs) {
      const data = doc.data();
      const uid = data.uid || doc.id;
      const email = data.email || `${doc.id}@operator.com`;

      // Check company exists
      const companyExists = data.companyId ? await prisma.company.findUnique({ where: { id: data.companyId } }) : null;
      const validCompanyId = companyExists ? data.companyId : null;

      const existingUser = await prisma.user.findFirst({
        where: { OR: [{ uid: uid }, { email: email }] }
      });

      if (existingUser) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            role: 'operator',
            companyId: validCompanyId,
            region: data.region,
            invitationSent: data.invitationSent ?? false,
            invitationSentAt: data.invitationSentAt?.toDate(),
            createdBy: data.createdBy,
            updatedAt: data.updatedAt?.toDate() || new Date(),
          }
        });
      } else {
        await prisma.user.create({
          data: {
            id: doc.id,
            uid: uid,
            email: email,
            firstName: data.name?.split(' ')[0] || '',
            lastName: data.name?.split(' ').slice(1).join(' ') || '',
            role: 'operator',
            companyId: validCompanyId,
            region: data.region,
            invitationSent: data.invitationSent ?? false,
            invitationSentAt: data.invitationSentAt?.toDate(),
            createdBy: data.createdBy,
            isActive: data.status === 'active',
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          },
        });
      }
    }
    console.log(`Migrated operators.`);

    // 6. Migrate Schedules
    console.log('6. Migrating Schedules...');
    const schedulesSnap = await db.collection('schedule').get();
    for (const doc of schedulesSnap.docs) {
      const data = doc.data();
      // Verify all FKs
      const companyExists = await prisma.company.findUnique({ where: { id: data.companyId } });
      const busExists = await prisma.bus.findUnique({ where: { id: data.busId } });
      const routeExists = await prisma.route.findUnique({ where: { id: data.routeId } });

      if (!companyExists || !busExists || !routeExists) {
        console.warn(`Skipping Schedule ${doc.id} - missing dependencies`);
        continue;
      }

      await prisma.schedule.upsert({
        where: { id: doc.id },
        update: {},
        create: {
          id: doc.id,
          companyId: data.companyId,
          busId: data.busId,
          routeId: data.routeId,
          departureDateTime: data.departureDateTime?.toDate() || new Date(),
          arrivalDateTime: data.arrivalDateTime?.toDate() || new Date(),
          availableSeats: data.availableSeats || 0,
          bookedSeats: data.bookedSeats,
          price: data.price || 0,
          status: data.status || 'active',
          tripStatus: data.tripStatus || 'scheduled',
          isActive: data.isActive ?? true,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        },
      });
    }
    console.log(`Migrated schedules.`);

    // 7. Migrate Bookings
    console.log('7. Migrating Bookings...');
    const bookingsSnap = await db.collection('bookings').get();
    for (const doc of bookingsSnap.docs) {
      const data = doc.data();
      // Verify FKs
      const userExists = await prisma.user.findFirst({ where: { id: data.userId } });
      const scheduleExists = await prisma.schedule.findUnique({ where: { id: data.scheduleId } });
      const companyExists = await prisma.company.findUnique({ where: { id: data.companyId } });

      if (!userExists || !scheduleExists || !companyExists) {
        console.warn(`Skipping Booking ${doc.id} - missing dependencies`);
        continue;
      }

      await prisma.booking.upsert({
        where: { id: doc.id },
        update: {},
        create: {
          id: doc.id,
          bookingReference: data.bookingReference || doc.id,
          userId: userExists.id,
          scheduleId: data.scheduleId,
          companyId: data.companyId,
          totalAmount: data.totalAmount || 0,
          currency: data.currency || 'MWK',
          bookingStatus: data.bookingStatus || 'pending',
          paymentStatus: data.paymentStatus || 'pending',
          passengerDetails: data.passengerDetails,
          seatNumbers: data.seatNumbers,
          paidAt: data.paidAt?.toDate(),
          bookingDate: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        },
      });
    }
    console.log(`Migrated bookings.`);

    // 8. Migrate Payments
    console.log('8. Migrating Payments...');
    const paymentsSnap = await db.collection('payments').get();
    for (const doc of paymentsSnap.docs) {
      const data = doc.data();
      let bookingId = data.bookingId || data.metadata?.bookingId;
      if (bookingId) {
        const bookingExists = await prisma.booking.findUnique({ where: { id: bookingId } });
        if (!bookingExists) bookingId = null;
      }

      await prisma.payment.upsert({
        where: { paymentId: data.paymentId || doc.id },
        update: {},
        create: {
          id: doc.id,
          paymentId: data.paymentId || doc.id,
          bookingId: bookingId,
          amount: data.amount || 0,
          currency: data.currency || 'MWK',
          customerEmail: data.customerEmail,
          customerPhone: data.customerPhone,
          checkoutUrl: data.checkoutUrl,
          status: data.status || 'initiated',
          paymentType: data.paymentType,
          provider: data.provider || 'paychangu',
          txRef: data.txRef || data.tx_ref,
          metadata: data.metadata,
          paychanguResponse: data.paychanguResponse,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        },
      });
    }
    console.log(`Migrated payments.`);

    // 9. Migrate Notiffications
    console.log('9. Migrating Notiffications...');
    const notifsSnap = await db.collection('notiffications').get();
    for (const doc of notifsSnap.docs) {
      const data = doc.data();
      const userExists = await prisma.user.findFirst({ where: { id: data.userId } });
      if (!userExists) continue;

      await prisma.notification.upsert({
        where: { id: doc.id },
        update: {},
        create: {
          id: doc.id,
          userId: userExists.id,
          title: data.title || '',
          message: data.message || '',
          type: data.type || 'info',
          priority: data.priority || 'medium',
          isRead: data.isRead ?? false,
          readAt: data.readAt?.toDate(),
          actionUrl: data.actionUrl,
          data: data.data,
          createdAt: data.createdAt?.toDate() || new Date(),
        },
      });
    }
    console.log(`Migrated notifications.`);

    // 10. Migrate Seat Reservations
    console.log('10. Migrating Seat Reservations...');
    const reservationsSnap = await db.collection('seatReservations').get();
    for (const doc of reservationsSnap.docs) {
      const data = doc.data();
      const userExists = await prisma.user.findFirst({ where: { id: data.customerId || data.userId } });
      const scheduleExists = await prisma.schedule.findUnique({ where: { id: data.scheduleId } });

      if (!userExists || !scheduleExists) continue;

      await prisma.seatReservation.upsert({
        where: { id: doc.id },
        update: {},
        create: {
          id: doc.id,
          scheduleId: data.scheduleId,
          userId: userExists.id,
          seatNumbers: data.seatNumbers || [],
          status: data.status || 'reserved',
          expiresAt: data.expiresAt?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
        },
      });
    }
    console.log(`Migrated seat reservations.`);

    // 11. Migrate ScheduleTemplates
    console.log('11. Migrating ScheduleTemplates...');
    const templatesSnap = await db.collection('scheduleTemplate').get();
    for (const doc of templatesSnap.docs) {
      const data = doc.data();
      const companyExists = await prisma.company.findUnique({ where: { id: data.companyId } });
      const routeExists = await prisma.route.findUnique({ where: { id: data.routeId } });
      const busExists = await prisma.bus.findUnique({ where: { id: data.busId } });

      if (!companyExists || !routeExists || !busExists) continue;

      await prisma.scheduleTemplate.upsert({
        where: { id: doc.id },
        update: {},
        create: {
          id: doc.id,
          companyId: data.companyId,
          routeId: data.routeId,
          busId: data.busId,
          departureTime: data.departureTime || '00:00',
          arrivalTime: data.arrivalTime || '00:00',
          daysOfWeek: data.daysOfWeek,
          price: data.price || 0,
          isActive: data.isActive ?? true,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        },
      });
    }
    console.log(`Migrated schedule templates.`);


    console.log('--- Final Migration Successfully Completed! ---');
  } catch (error) {
    console.error('Migration Failed:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

migrate();

export {};