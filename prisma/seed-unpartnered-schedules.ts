import "dotenv/config";
import { prisma } from "../src/lib/prisma";

interface ScheduleEntry {
  operator: string;
  route: string;
  category: string;
  timetable: string;
  priceNote: string;
  adultSingleMWK: number;
  returnFareMWK?: number;
  contact: string;
  origin: string;
  destination: string;
  distanceKm: number;
  durationMins: number;
  depTimeStr: string; // e.g. "06:00" or "07:00"
  departureLocation: string;
  arrivalLocation: string;
  companyAddress: string;
}

const SEED_DATA: ScheduleEntry[] = [
  // 1. Kwezy Bus Company
  {
    operator: "Kwezy Bus Company",
    route: "Blantyre ↔ Lilongwe",
    category: "Domestic Intercity",
    timetable: "Daily scheduled departures",
    priceNote: "MWK 85,000 (Adult Single) / MWK 160,000 (Return)",
    adultSingleMWK: 85000,
    returnFareMWK: 160000,
    contact: "Blantyre: 0886 780 355 | Lilongwe: 0886 780 356",
    origin: "Blantyre",
    destination: "Lilongwe",
    distanceKm: 312,
    durationMins: 270,
    depTimeStr: "07:30",
    departureLocation: "Wenela Bus Depot / City Centre Terminal",
    arrivalLocation: "Devil's Street Depot / Area 3",
    companyAddress: "Blantyre: Wenela Bus Depot / City Centre Terminal | Lilongwe: Devil's Street Depot / Area 3 | Mzuzu: Main Bus Depot",
  },
  {
    operator: "Kwezy Bus Company",
    route: "Lilongwe ↔ Mzuzu",
    category: "Domestic Intercity",
    timetable: "Daily scheduled departures",
    priceNote: "MWK 95,000 (Adult Single) / MWK 180,000 (Return)",
    adultSingleMWK: 95000,
    returnFareMWK: 180000,
    contact: "Lilongwe: 0886 780 356",
    origin: "Lilongwe",
    destination: "Mzuzu",
    distanceKm: 360,
    durationMins: 300,
    depTimeStr: "08:00",
    departureLocation: "Devil's Street Depot",
    arrivalLocation: "Main Bus Depot / City Centre",
    companyAddress: "Blantyre: Wenela Bus Depot / City Centre Terminal | Lilongwe: Devil's Street Depot / Area 3 | Mzuzu: Main Bus Depot",
  },
  {
    operator: "Kwezy Bus Company",
    route: "Blantyre ↔ Mzuzu",
    category: "Domestic Intercity",
    timetable: "Daily scheduled departures",
    priceNote: "MWK 150,000 (Adult Single) / MWK 290,000 (Return)",
    adultSingleMWK: 150000,
    returnFareMWK: 290000,
    contact: "Blantyre: 0886 780 355",
    origin: "Blantyre",
    destination: "Mzuzu",
    distanceKm: 672,
    durationMins: 570,
    depTimeStr: "06:00",
    departureLocation: "Wenela Bus Depot",
    arrivalLocation: "Main Bus Depot / City Centre",
    companyAddress: "Blantyre: Wenela Bus Depot / City Centre Terminal | Lilongwe: Devil's Street Depot / Area 3 | Mzuzu: Main Bus Depot",
  },
  {
    operator: "Kwezy Bus Company",
    route: "Blantyre ↔ Mangochi",
    category: "Domestic Intercity",
    timetable: "Daily scheduled departures",
    priceNote: "MWK 80,000 (Adult Single) / MWK 150,000 (Return)",
    adultSingleMWK: 80000,
    returnFareMWK: 150000,
    contact: "Blantyre: 0886 780 355 | Mangochi: 0886 240 840",
    origin: "Blantyre",
    destination: "Mangochi",
    distanceKm: 195,
    durationMins: 180,
    depTimeStr: "08:30",
    departureLocation: "Wenela Bus Depot",
    arrivalLocation: "Mangochi Boma Terminal",
    companyAddress: "Blantyre: Wenela Bus Depot / City Centre Terminal | Lilongwe: Devil's Street Depot / Area 3 | Mzuzu: Main Bus Depot",
  },
  {
    operator: "Kwezy Bus Company",
    route: "Lilongwe ↔ Nkhata Bay",
    category: "Domestic Intercity",
    timetable: "Daily scheduled departures",
    priceNote: "MWK 110,000 (Adult Single) / MWK 210,000 (Return)",
    adultSingleMWK: 110000,
    returnFareMWK: 210000,
    contact: "Lilongwe: 0886 780 356 | Nkhata Bay: 0882 946 650",
    origin: "Lilongwe",
    destination: "Nkhata Bay",
    distanceKm: 395,
    durationMins: 330,
    depTimeStr: "07:00",
    departureLocation: "Devil's Street Depot",
    arrivalLocation: "Nkhata Bay Boma Terminal",
    companyAddress: "Blantyre: Wenela Bus Depot / City Centre Terminal | Lilongwe: Devil's Street Depot / Area 3 | Mzuzu: Main Bus Depot",
  },
  {
    operator: "Kwezy Bus Company",
    route: "Lilongwe ↔ Kasungu",
    category: "Domestic Intercity",
    timetable: "Daily scheduled departures",
    priceNote: "MWK 65,000 (Adult Single) / MWK 120,000 (Return)",
    adultSingleMWK: 65000,
    returnFareMWK: 120000,
    contact: "Lilongwe: 0886 780 356",
    origin: "Lilongwe",
    destination: "Kasungu",
    distanceKm: 130,
    durationMins: 120,
    depTimeStr: "09:00",
    departureLocation: "Devil's Street Depot",
    arrivalLocation: "Kasungu Bus Depot",
    companyAddress: "Blantyre: Wenela Bus Depot / City Centre Terminal | Lilongwe: Devil's Street Depot / Area 3 | Mzuzu: Main Bus Depot",
  },

  // 2. Muchawi Coaches
  {
    operator: "Muchawi Coaches",
    route: "Blantyre ↔ Lilongwe",
    category: "Executive Intercity",
    timetable: "Twice daily (07:00 AM & 02:00 PM)",
    priceNote: "~MWK 80,000 - MWK 90,000",
    adultSingleMWK: 85000,
    contact: "0995 084 854 | 0884 377 777 | 0884 521 320",
    origin: "Blantyre",
    destination: "Lilongwe",
    distanceKm: 312,
    durationMins: 270,
    depTimeStr: "07:00",
    departureLocation: "Wenela Terminal / Shoprite Depot",
    arrivalLocation: "Devil's Street Depot / Area 4",
    companyAddress: "Blantyre: Wenela Terminal / Shoprite Depot | Lilongwe: Devil's Street Depot / Area 4",
  },

  // 3. Tam Tam Coaches
  {
    operator: "Tam Tam Coaches",
    route: "Blantyre ↔ Lilongwe",
    category: "Semi-Luxury Intercity",
    timetable: "4 times daily both ways",
    priceNote: "~MWK 80,000 - MWK 90,000",
    adultSingleMWK: 85000,
    contact: "+265 887 525 256 | +265 899 441 729",
    origin: "Blantyre",
    destination: "Lilongwe",
    distanceKm: 312,
    durationMins: 270,
    depTimeStr: "06:30",
    departureLocation: "Wenela Bus Terminal",
    arrivalLocation: "Devil's Street Bus Depot",
    companyAddress: "Blantyre: Wenela Bus Terminal | Lilongwe: Devil's Street Bus Depot",
  },

  // 4. Sososo Coaches
  {
    operator: "Sososo Coaches",
    route: "Blantyre ↔ Lilongwe",
    category: "Domestic Intercity",
    timetable: "Daily scheduled departures",
    priceNote: "~MWK 80,000 - MWK 100,000",
    adultSingleMWK: 85000,
    contact: "0994 193 745 | 0996 294 156 | 0888 337 172 | 0883 860 043",
    origin: "Blantyre",
    destination: "Lilongwe",
    distanceKm: 312,
    durationMins: 270,
    depTimeStr: "07:00",
    departureLocation: "Wenela Terminal",
    arrivalLocation: "Area 4 / Devil's Street Depot",
    companyAddress: "Blantyre: Wenela Terminal | Lilongwe: Area 4 / Devil's Street Depot | Mzuzu: Main Bus Station | Karonga: Karonga Boma Depot",
  },
  {
    operator: "Sososo Coaches",
    route: "Lilongwe ↔ Mzuzu",
    category: "Domestic Intercity",
    timetable: "Daily scheduled departures",
    priceNote: "~MWK 90,000 - MWK 100,000",
    adultSingleMWK: 90000,
    contact: "0994 193 745 | 0996 294 156",
    origin: "Lilongwe",
    destination: "Mzuzu",
    distanceKm: 360,
    durationMins: 300,
    depTimeStr: "08:00",
    departureLocation: "Area 4 / Devil's Street Depot",
    arrivalLocation: "Main Bus Station",
    companyAddress: "Blantyre: Wenela Terminal | Lilongwe: Area 4 / Devil's Street Depot | Mzuzu: Main Bus Station | Karonga: Karonga Boma Depot",
  },
  {
    operator: "Sososo Coaches",
    route: "Mzuzu ↔ Karonga",
    category: "Domestic Intercity",
    timetable: "Daily scheduled departures",
    priceNote: "~MWK 80,000",
    adultSingleMWK: 80000,
    contact: "0888 337 172 | 0883 860 043",
    origin: "Mzuzu",
    destination: "Karonga",
    distanceKm: 225,
    durationMins: 210,
    depTimeStr: "09:00",
    departureLocation: "Main Bus Station",
    arrivalLocation: "Karonga Boma Depot",
    companyAddress: "Blantyre: Wenela Terminal | Lilongwe: Area 4 / Devil's Street Depot | Mzuzu: Main Bus Station | Karonga: Karonga Boma Depot",
  },

  // 5. Matours Bus Company
  {
    operator: "Matours Bus Company",
    route: "Blantyre ↔ Lilongwe",
    category: "Domestic Intercity",
    timetable: "Daily scheduled departures",
    priceNote: "Standard local fares apply",
    adultSingleMWK: 80000,
    contact: "+265 999 665 009 | +265 992 615 512",
    origin: "Blantyre",
    destination: "Lilongwe",
    distanceKm: 312,
    durationMins: 270,
    depTimeStr: "06:00",
    departureLocation: "Wenela Bus Depot",
    arrivalLocation: "Devil's Street Depot",
    companyAddress: "Blantyre: Wenela Bus Depot | Lilongwe: Devil's Street Depot | Mzuzu: Main Depot | Salima: Salima Bus Terminal",
  },
  {
    operator: "Matours Bus Company",
    route: "Lilongwe ↔ Mzuzu",
    category: "Domestic Intercity",
    timetable: "Daily scheduled departures",
    priceNote: "Standard local fares apply",
    adultSingleMWK: 90000,
    contact: "+265 999 665 009 | +265 992 615 512",
    origin: "Lilongwe",
    destination: "Mzuzu",
    distanceKm: 360,
    durationMins: 300,
    depTimeStr: "07:00",
    departureLocation: "Devil's Street Depot",
    arrivalLocation: "Main Bus Depot",
    companyAddress: "Blantyre: Wenela Bus Depot | Lilongwe: Devil's Street Depot | Mzuzu: Main Depot | Salima: Salima Bus Terminal",
  },
  {
    operator: "Matours Bus Company",
    route: "Lilongwe ↔ Salima",
    category: "Domestic Intercity",
    timetable: "Daily scheduled departures",
    priceNote: "Standard local fares apply",
    adultSingleMWK: 45000,
    contact: "+265 999 665 009 | +265 992 615 512",
    origin: "Lilongwe",
    destination: "Salima",
    distanceKm: 110,
    durationMins: 90,
    depTimeStr: "09:00",
    departureLocation: "Devil's Street Depot",
    arrivalLocation: "Salima Bus Terminal",
    companyAddress: "Blantyre: Wenela Bus Depot | Lilongwe: Devil's Street Depot | Mzuzu: Main Depot | Salima: Salima Bus Terminal",
  },

  // 6. United Buses Zambia (UBZ 2020)
  {
    operator: "United Buses Zambia (UBZ 2020)",
    route: "Lilongwe ↔ Lusaka (Zambia)",
    category: "Cross-Border (Zambia)",
    timetable: "3 times weekly (06:00 AM departure)",
    priceNote: "~MWK 110,000 - MWK 140,000 ($60 - $80 USD)",
    adultSingleMWK: 125000,
    contact: "+265 987 986 044 | +260 765 022 223",
    origin: "Lilongwe",
    destination: "Lusaka",
    distanceKm: 680,
    durationMins: 600,
    depTimeStr: "06:00",
    departureLocation: "Grand Business Park",
    arrivalLocation: "Inter-City Bus Terminus",
    companyAddress: "Lilongwe: Grand Business Park | Lusaka: Inter-City Bus Terminus",
  },

  // 7. Kobs
  {
    operator: "Kobs",
    route: "Lilongwe ↔ Lusaka (Zambia)",
    category: "Cross-Border (Zambia)",
    timetable: "Scheduled regional departures",
    priceNote: "~MWK 110,000 - MWK 140,000",
    adultSingleMWK: 125000,
    contact: "+260 974 845 081",
    origin: "Lilongwe",
    destination: "Lusaka",
    distanceKm: 680,
    durationMins: 600,
    depTimeStr: "06:30",
    departureLocation: "Devil's Street Depot / City Centre",
    arrivalLocation: "Inter-City Bus Terminus",
    companyAddress: "Lilongwe: Devil's Street Depot / City Centre | Lusaka: Inter-City Bus Terminus",
  },

  // 8. 3 Star Coaches
  {
    operator: "3 Star Coaches",
    route: "Blantyre → Harare (Zimbabwe)",
    category: "Cross-Border (Zimbabwe)",
    timetable: "Wednesdays & Sundays",
    priceNote: "~$50 - $70 USD equivalent (MWK 100,000)",
    adultSingleMWK: 100000,
    contact: "+265 985 797 417 | +263 773 470 749",
    origin: "Blantyre",
    destination: "Harare",
    distanceKm: 600,
    durationMins: 540,
    depTimeStr: "06:00",
    departureLocation: "Wenela Terminal",
    arrivalLocation: "Roadport Bus Station",
    companyAddress: "Blantyre: Wenela Terminal | Lilongwe: Devil's Street / Area 4 Depot | Harare: Roadport Bus Station",
  },
  {
    operator: "3 Star Coaches",
    route: "Harare → Lilongwe (Zimbabwe)",
    category: "Cross-Border (Zimbabwe)",
    timetable: "Mondays & Thursdays",
    priceNote: "~$50 - $70 USD equivalent (MWK 115,000)",
    adultSingleMWK: 115000,
    contact: "+265 985 797 417 | +263 773 470 749",
    origin: "Harare",
    destination: "Lilongwe",
    distanceKm: 720,
    durationMins: 630,
    depTimeStr: "06:00",
    departureLocation: "Roadport Bus Station",
    arrivalLocation: "Devil's Street / Area 4 Depot",
    companyAddress: "Blantyre: Wenela Terminal | Lilongwe: Devil's Street / Area 4 Depot | Harare: Roadport Bus Station",
  },

  // 9. Trip Trans
  {
    operator: "Trip Trans",
    route: "Blantyre (Wenela) ↔ Harare (Roadport)",
    category: "Cross-Border (Zimbabwe)",
    timetable: "Monday to Saturday departures",
    priceNote: "~$50 - $70 USD equivalent",
    adultSingleMWK: 105000,
    contact: "+265 999 34 74 13",
    origin: "Blantyre",
    destination: "Harare",
    distanceKm: 600,
    durationMins: 540,
    depTimeStr: "06:00",
    departureLocation: "Wenela Terminal",
    arrivalLocation: "Roadport Bus Station",
    companyAddress: "Blantyre: Wenela Terminal | Lilongwe: Devil's Street Depot | Harare: Roadport Bus Station",
  },

  // 10. Ulendo Coaches
  {
    operator: "Ulendo Coaches",
    route: "Blantyre ↔ Johannesburg",
    category: "Cross-Border (South Africa)",
    timetable: "Twice weekly",
    priceNote: "~R1,500 - R2,200 (MWK 200,000)",
    adultSingleMWK: 200000,
    contact: "+265 999 31 62 10",
    origin: "Blantyre",
    destination: "Johannesburg",
    distanceKm: 1750,
    durationMins: 1440,
    depTimeStr: "06:00",
    departureLocation: "Wenela Bus Terminal",
    arrivalLocation: "Park Station",
    companyAddress: "Malawi: Wenela (Blantyre) / Lilongwe Area 4 / Mangochi Boma | JHB: Park Station",
  },

  // 11. Enkosi Coaches
  {
    operator: "Enkosi Coaches",
    route: "Blantyre ↔ Johannesburg",
    category: "Cross-Border (South Africa)",
    timetable: "Wednesdays & Saturdays",
    priceNote: "~R1,500 - R2,200 (MWK 200,000)",
    adultSingleMWK: 200000,
    contact: "+265 885 00 10 05",
    origin: "Blantyre",
    destination: "Johannesburg",
    distanceKm: 1750,
    durationMins: 1440,
    depTimeStr: "06:30",
    departureLocation: "Wenela Terminal",
    arrivalLocation: "Park Station",
    companyAddress: "Blantyre: Wenela Terminal | Johannesburg: Park Station",
  },

  // 12. Jobela Star
  {
    operator: "Jobela Star",
    route: "Blantyre ↔ Cape Town",
    category: "Cross-Border (South Africa)",
    timetable: "Saturdays (Departs Malawi to Cape Town)",
    priceNote: "~R1,800 - R2,500 (MWK 240,000)",
    adultSingleMWK: 240000,
    contact: "+27 21 361 1695 | +27 87 7111 122",
    origin: "Blantyre",
    destination: "Cape Town",
    distanceKm: 2900,
    durationMins: 2160,
    depTimeStr: "06:00",
    departureLocation: "Wenela Terminal",
    arrivalLocation: "Bellville Terminal",
    companyAddress: "Blantyre: Wenela Terminal | Lilongwe: Devil's Street Depot | Cape Town: Bellville Terminal",
  },

  // 13. Sangano Logistics
  {
    operator: "Sangano Logistics",
    route: "Blantyre ↔ Johannesburg",
    category: "Cross-Border (South Africa)",
    timetable: "Twice weekly",
    priceNote: "~R1,500 - R2,200 (MWK 200,000)",
    adultSingleMWK: 200000,
    contact: "+265 988 479 669",
    origin: "Blantyre",
    destination: "Johannesburg",
    distanceKm: 1750,
    durationMins: 1440,
    depTimeStr: "07:00",
    departureLocation: "Wenela Terminal",
    arrivalLocation: "Park Station",
    companyAddress: "Blantyre: Wenela Terminal | Johannesburg: Park Station",
  },

  // 14. Munorurama Bus
  {
    operator: "Munorurama Bus",
    route: "Lilongwe ↔ Johannesburg",
    category: "Cross-Border (South Africa)",
    timetable: "Long-distance scheduled route",
    priceNote: "~R1,500 - R2,200 (MWK 210,000)",
    adultSingleMWK: 210000,
    contact: "+27 11 403 0859",
    origin: "Lilongwe",
    destination: "Johannesburg",
    distanceKm: 1850,
    durationMins: 1560,
    depTimeStr: "06:00",
    departureLocation: "Lilongwe Bus Terminal",
    arrivalLocation: "Park Station / Newtown Terminal",
    companyAddress: "Malawi: Wenela (Blantyre) / Lilongwe Terminal | Johannesburg: Park Station / Newtown Terminal",
  },

  // 15. Ulemu Coaches
  {
    operator: "Ulemu Coaches",
    route: "Blantyre ↔ Johannesburg",
    category: "Hybrid Local & Regional",
    timetable: "Scheduled departures",
    priceNote: "Local / International standard rates",
    adultSingleMWK: 200000,
    contact: "Blantyre: 0982 848 428 | Lilongwe: 0982 848 429 | RSA: +27 73 145 1003",
    origin: "Blantyre",
    destination: "Johannesburg",
    distanceKm: 1750,
    durationMins: 1440,
    depTimeStr: "06:00",
    departureLocation: "Wenela Bus Terminal",
    arrivalLocation: "Park Station",
    companyAddress: "Malawi: Wenela (BT), Devil's Street (LL), Mzuzu Main, Salima & Mangochi Boma | JHB: Park Station | Durban: Station Depot",
  },

  // 16. Falcon Executive
  {
    operator: "Falcon Executive",
    route: "Lilongwe ↔ Dar es Salaam (Tanzania)",
    category: "Cross-Border (Tanzania)",
    timetable: "Once weekly",
    priceNote: "Regional standard rates (~MWK 180,000)",
    adultSingleMWK: 180000,
    contact: "0994 232 328 | 0999 523 700 | 0999 184 458",
    origin: "Lilongwe",
    destination: "Dar es Salaam",
    distanceKm: 1550,
    durationMins: 1320,
    depTimeStr: "06:00",
    departureLocation: "Devil's Street Depot / City Centre",
    arrivalLocation: "Ubungo / Magufuli Bus Terminal",
    companyAddress: "Lilongwe: Devil's Street Depot / City Centre | Dar es Salaam: Ubungo / Magufuli Bus Terminal",
  },
];

export async function seedUnpartneredSchedules() {
  console.log("🚀 Seeding Unpartnered Bus Operators and Schedules...");

  // Unique list of companies
  const companyMap = new Map<string, { category: string; contact: string; address: string }>();
  for (const entry of SEED_DATA) {
    if (!companyMap.has(entry.operator)) {
      companyMap.set(entry.operator, { category: entry.category, contact: entry.contact, address: entry.companyAddress });
    }
  }

  const createdCompanies = new Map<string, string>(); // Name -> ID

  for (const [name, info] of companyMap.entries()) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const email = `unclaimed.${slug}@internal.local`;

    let company = await prisma.company.findFirst({
      where: {
        OR: [
          { email },
          { name: { equals: name, mode: "insensitive" } },
        ],
      },
    });

    if (company) {
      company = await prisma.company.update({
        where: { id: company.id },
        data: {
          phone: info.contact,
          category: info.category,
          address: info.address,
          isPartner: false,
          bookingEnabled: false,
          status: "active", // visible on platform; isPartner/bookingEnabled gate booking
        },
      });
    } else {
      company = await prisma.company.create({
        data: {
          name,
          email,
          phone: info.contact,
          address: info.address,
          description: `${info.category} bus services in Malawi & Regional routes.`,
          isPartner: false,
          bookingEnabled: false,
          category: info.category,
          status: "active", // visible on platform; isPartner/bookingEnabled gate booking
          setupCompleted: false,
        },
      });
    }

    createdCompanies.set(name, company.id);
    console.log(`✅ Upserted Company: ${name} (ID: ${company.id})`);
  }

  // Create Schedules for the next 30 days
  const today = new Date();
  const DAYS_AHEAD = 30;

  let totalSchedulesCreated = 0;

  for (const entry of SEED_DATA) {
    const companyId = createdCompanies.get(entry.operator)!;

    // 1. Create or Find Bus for this Operator
    const busPlate = `${entry.operator.substring(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    
    // Check if bus exists for company
    let bus = await prisma.bus.findFirst({
      where: { companyId, busType: entry.category.includes("Luxury") || entry.category.includes("Executive") ? "Executive Coach" : "Standard Coach" },
    });

    if (!bus) {
      bus = await prisma.bus.create({
        data: {
          companyId,
          licensePlate: "Unassigned",
          busType: "Standard",
          capacity: 0,
          amenities: [],
          status: "active",
        },
      });
    }

    // 2. Create or Find Route
    let route = await prisma.route.findFirst({
      where: {
        companyId,
        origin: entry.origin,
        destination: entry.destination,
      },
    });

    if (!route) {
      route = await prisma.route.create({
        data: {
          companyId,
          name: `${entry.origin} to ${entry.destination}`,
          origin: entry.origin,
          destination: entry.destination,
          distance: entry.distanceKm,
          duration: entry.durationMins,
          baseFare: entry.adultSingleMWK,
          status: "active",
          isActive: true,
        },
      });
    }

    // 3. Create Daily Schedules for next 30 days
    const [depHours, depMins] = entry.depTimeStr.split(":").map(Number);

    const schedulesToCreate = [];
    for (let d = 0; d < DAYS_AHEAD; d++) {
      const depDate = new Date(today);
      depDate.setDate(today.getDate() + d);
      depDate.setHours(depHours, depMins, 0, 0);

      const arrDate = new Date(depDate);
      arrDate.setMinutes(arrDate.getMinutes() + entry.durationMins);

      schedulesToCreate.push({
        companyId,
        routeId: route.id,
        busId: bus.id,
        departureDateTime: depDate,
        arrivalDateTime: arrDate,
        price: entry.adultSingleMWK,
        baseFare: entry.adultSingleMWK,
        availableSeats: bus.capacity,
        status: "active",
        tripStatus: "scheduled",
        departureLocation: entry.departureLocation,
        arrivalLocation: entry.arrivalLocation,
        tripNotes: `Timetable: ${entry.timetable}. Contact: ${entry.contact}`,
      });
    }

    // Insert batch for this entry
    const res = await prisma.schedule.createMany({
      data: schedulesToCreate,
      skipDuplicates: true,
    });
    totalSchedulesCreated += res.count;
    console.log(`  🕒 Seeded schedules for ${entry.operator} (${entry.origin} -> ${entry.destination}): +${res.count} trips`);
  }

  console.log(`🎉 Seeding Complete! Created ${totalSchedulesCreated} schedules across ${companyMap.size} operators.`);
}

if (require.main === module) {
  seedUnpartneredSchedules()
    .catch((e) => {
      console.error("❌ Error seeding:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
