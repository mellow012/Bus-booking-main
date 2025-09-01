import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { Company, Bus, Route, Schedule } from '@/types';

export const seedDatabase = async () => {
  try {
    console.log('Starting database seeding...');

    // Sample companies (Malawi-specific)
    const companies: Omit<Company, 'id'>[] = [
      {
        name: 'Shire Bus Services',
        email: 'info@shirebus.mw',
        phone: '+265-1-123-456',
        address: 'P.O. Box 123, Blantyre, Malawi',
        description: 'Reliable intercity bus service with a focus on southern Malawi.',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'AXA Coaches Malawi',
        email: 'contact@axacoaches.mw',
        phone: '+265-1-789-012',
        address: 'P.O. Box 456, Lilongwe, Malawi',
        description: 'Comfortable and affordable travel across Malawi.',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'National Bus Company',
        email: 'support@nationalbus.mw',
        phone: '+265-1-345-678',
        address: 'P.O. Box 789, Mzuzu, Malawi',
        description: 'Serving northern and central Malawi with a modern fleet.',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Lake Express',
        email: 'hello@lakeexpress.mw',
        phone: '+265-1-901-234',
        address: 'P.O. Box 321, Mangochi, Malawi',
        description: 'Connecting lakeshore and central regions efficiently.',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const companyIds: string[] = [];
    for (const company of companies) {
      const docRef = await addDoc(collection(db, 'companies'), company);
      companyIds.push(docRef.id);
      console.log(`Added company: ${company.name}`);
    }

    // Sample buses (Malawi-specific)
    const buses: Omit<Bus, 'id'>[] = [];
    const busTypes: Bus['busType'][] = ['Minibus', 'Standard', 'Luxury'];
    const amenitiesList = [
      ['AC', 'Reclining Seats'],
      ['WiFi'],
      ['Charging Ports', 'AC'],
      [],
    ];

    companyIds.forEach((companyId, companyIndex) => {
      for (let i = 0; i < 3; i++) {
        buses.push({
          companyId,
          busNumber: `${companies[companyIndex].name.replace(' ', '').toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
          busType: busTypes[Math.floor(Math.random() * busTypes.length)],
          totalSeats: [22, 30, 40][Math.floor(Math.random() * 3)], // Minibus: 22, Standard: 30, Luxury: 40
          amenities: amenitiesList[Math.floor(Math.random() * amenitiesList.length)],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    });

    const busIds: string[] = [];
    for (const bus of buses) {
      const docRef = await addDoc(collection(db, 'buses'), bus);
      busIds.push(docRef.id);
      console.log(`Added bus: ${bus.busNumber}`);
    }

    // Sample routes (Malawi-specific)
    const cities = [
      'Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba', 'Mangochi',
      'Karonga', 'Salima', 'Nsanje', 'Mchinji', 'Dedza',
    ];

    const routes: Omit<Route, 'id'>[] = [];
    const routeIds: string[] = [];

    // Create routes for each company
    for (let companyIndex = 0; companyIndex < companyIds.length; companyIndex++) {
      const companyId = companyIds[companyIndex];
      
      // Create 5 routes per company
      for (let i = 0; i < 5; i++) {
        const origin = cities[Math.floor(Math.random() * cities.length)];
        let destination = cities[Math.floor(Math.random() * cities.length)];
        while (destination === origin) {
          destination = cities[Math.floor(Math.random() * cities.length)];
        }

        // Realistic distances and durations for Malawi
        const distance = Math.floor(Math.random() * 400) + 50; // 50-450 miles, reflecting Malawi’s geography
        const duration = Math.floor(distance / 50 * 60) + Math.floor(Math.random() * 30); // ~50 mph avg speed, plus some variance

        const route: Omit<Route, 'id'> = {
          companyId,
          origin,
          destination,
          distance,
          duration,
          stops: [], // Simplified for demo
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const docRef = await addDoc(collection(db, 'routes'), route);
        routes.push(route);
        routeIds.push(docRef.id);
        console.log(`Added route: ${origin} → ${destination}`);
      }
    }

    // Sample schedules
    const schedules: Omit<Schedule, 'id'>[] = [];
    const today = new Date();
    
    // Create schedules for the next 30 days
    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      const scheduleDate = new Date(today);
      scheduleDate.setDate(today.getDate() + dayOffset);
      const dateString = scheduleDate.toISOString().split('T')[0];

      // Create multiple schedules per day for each route
      for (let routeIndex = 0; routeIndex < routeIds.length; routeIndex++) {
        const route = routes[routeIndex];
        const routeId = routeIds[routeIndex];
        
        // Find buses for this company
        const companyBuses = buses.filter(bus => bus.companyId === route.companyId);
        
        // Create 2-3 schedules per route per day
        const schedulesPerDay = Math.floor(Math.random() * 2) + 2;
        
        for (let scheduleIndex = 0; scheduleIndex < schedulesPerDay; scheduleIndex++) {
          const bus = companyBuses[Math.floor(Math.random() * companyBuses.length)];
          const busId = busIds[buses.indexOf(bus)];
          
          // Generate departure times (common in Malawi: early morning, midday, evening)
          const baseHour = [6, 12, 16][scheduleIndex]; // 6 AM, 12 PM, 4 PM
          const departureTime = `${String(baseHour).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`;
          
          // Calculate arrival time
          const departureMinutes = baseHour * 60 + parseInt(departureTime.split(':')[1]);
          const arrivalMinutes = departureMinutes + route.duration;
          const arrivalHour = Math.floor(arrivalMinutes / 60) % 24;
          const arrivalMin = arrivalMinutes % 60;
          const arrivalTime = `${String(arrivalHour).padStart(2, '0')}:${String(arrivalMin).padStart(2, '0')}`;

          const schedule: Omit<Schedule, 'id'> = {
            companyId: route.companyId,
            busId,
            routeId,
            departureTime,
            arrivalTime,
            date: dateString,
            price: Math.floor(Math.random() * 10) + 5, // $5-$15, reflecting Malawi’s economy (~MWK 8,500-25,000)
            availableSeats: bus.totalSeats,
            bookedSeats: [],
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          await addDoc(collection(db, 'schedules'), schedule);
          schedules.push(schedule);
        }
      }
    }

    console.log(`Database seeding completed successfully!`);
    console.log(`- ${companies.length} companies`);
    console.log(`- ${buses.length} buses`);
    console.log(`- ${routes.length} routes`);
    console.log(`- ${schedules.length} schedules`);

  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
};