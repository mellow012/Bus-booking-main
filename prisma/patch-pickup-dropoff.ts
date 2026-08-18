import "dotenv/config";
import { prisma } from "../src/lib/prisma";

interface LocationMapping {
  operator: string;
  origin: string;
  destination: string;
  departureLocation: string;
  arrivalLocation: string;
  companyAddress: string;
  rawPoints: string;
}

const MAPPINGS: LocationMapping[] = [
  // 1. Kwezy Bus Company
  {
    operator: "Kwezy Bus Company",
    origin: "Blantyre",
    destination: "Lilongwe",
    departureLocation: "Wenela Bus Depot / City Centre Terminal",
    arrivalLocation: "Devil's Street Depot / Area 3",
    companyAddress: "Blantyre: Wenela Bus Depot / City Centre Terminal | Lilongwe: Devil's Street Depot / Area 3 | Mzuzu: Main Bus Depot",
    rawPoints: "Blantyre: Wenela Bus Depot / City Centre Terminal | Lilongwe: Devil's Street Depot / Area 3",
  },
  {
    operator: "Kwezy Bus Company",
    origin: "Lilongwe",
    destination: "Mzuzu",
    departureLocation: "Devil's Street Depot",
    arrivalLocation: "Main Bus Depot / City Centre",
    companyAddress: "Blantyre: Wenela Bus Depot / City Centre Terminal | Lilongwe: Devil's Street Depot / Area 3 | Mzuzu: Main Bus Depot",
    rawPoints: "Lilongwe: Devil's Street Depot | Mzuzu: Main Bus Depot / City Centre",
  },
  {
    operator: "Kwezy Bus Company",
    origin: "Blantyre",
    destination: "Mzuzu",
    departureLocation: "Wenela Bus Depot",
    arrivalLocation: "Main Bus Depot / City Centre",
    companyAddress: "Blantyre: Wenela Bus Depot / City Centre Terminal | Lilongwe: Devil's Street Depot / Area 3 | Mzuzu: Main Bus Depot",
    rawPoints: "Blantyre: Wenela Bus Depot | Mzuzu: Main Bus Depot / City Centre",
  },
  {
    operator: "Kwezy Bus Company",
    origin: "Blantyre",
    destination: "Mangochi",
    departureLocation: "Wenela Bus Depot",
    arrivalLocation: "Mangochi Boma Terminal",
    companyAddress: "Blantyre: Wenela Bus Depot / City Centre Terminal | Lilongwe: Devil's Street Depot / Area 3 | Mzuzu: Main Bus Depot",
    rawPoints: "Blantyre: Wenela Bus Depot | Mangochi: Mangochi Boma Terminal",
  },
  {
    operator: "Kwezy Bus Company",
    origin: "Lilongwe",
    destination: "Nkhata Bay",
    departureLocation: "Devil's Street Depot",
    arrivalLocation: "Nkhata Bay Boma Terminal",
    companyAddress: "Blantyre: Wenela Bus Depot / City Centre Terminal | Lilongwe: Devil's Street Depot / Area 3 | Mzuzu: Main Bus Depot",
    rawPoints: "Lilongwe: Devil's Street Depot | Nkhata Bay: Nkhata Bay Boma Terminal",
  },
  {
    operator: "Kwezy Bus Company",
    origin: "Lilongwe",
    destination: "Kasungu",
    departureLocation: "Devil's Street Depot",
    arrivalLocation: "Kasungu Bus Depot",
    companyAddress: "Blantyre: Wenela Bus Depot / City Centre Terminal | Lilongwe: Devil's Street Depot / Area 3 | Mzuzu: Main Bus Depot",
    rawPoints: "Lilongwe: Devil's Street Depot | Kasungu: Kasungu Bus Depot",
  },

  // 2. Muchawi Coaches
  {
    operator: "Muchawi Coaches",
    origin: "Blantyre",
    destination: "Lilongwe",
    departureLocation: "Wenela Terminal / Shoprite Depot",
    arrivalLocation: "Devil's Street Depot / Area 4",
    companyAddress: "Blantyre: Wenela Terminal / Shoprite Depot | Lilongwe: Devil's Street Depot / Area 4",
    rawPoints: "Blantyre: Wenela Terminal / Shoprite Depot | Lilongwe: Devil's Street Depot / Area 4",
  },

  // 3. Tam Tam Coaches
  {
    operator: "Tam Tam Coaches",
    origin: "Blantyre",
    destination: "Lilongwe",
    departureLocation: "Wenela Bus Terminal",
    arrivalLocation: "Devil's Street Bus Depot",
    companyAddress: "Blantyre: Wenela Bus Terminal | Lilongwe: Devil's Street Bus Depot",
    rawPoints: "Blantyre: Wenela Bus Terminal | Lilongwe: Devil's Street Bus Depot",
  },

  // 4. Sososo Coaches
  {
    operator: "Sososo Coaches",
    origin: "Blantyre",
    destination: "Lilongwe",
    departureLocation: "Wenela Terminal",
    arrivalLocation: "Area 4 / Devil's Street Depot",
    companyAddress: "Blantyre: Wenela Terminal | Lilongwe: Area 4 / Devil's Street Depot | Mzuzu: Main Bus Station | Karonga: Karonga Boma Depot",
    rawPoints: "Blantyre: Wenela Terminal | Lilongwe: Area 4 / Devil's Street Depot",
  },
  {
    operator: "Sososo Coaches",
    origin: "Lilongwe",
    destination: "Mzuzu",
    departureLocation: "Area 4 / Devil's Street Depot",
    arrivalLocation: "Main Bus Station",
    companyAddress: "Blantyre: Wenela Terminal | Lilongwe: Area 4 / Devil's Street Depot | Mzuzu: Main Bus Station | Karonga: Karonga Boma Depot",
    rawPoints: "Lilongwe: Area 4 / Devil's Street Depot | Mzuzu: Main Bus Station",
  },
  {
    operator: "Sososo Coaches",
    origin: "Mzuzu",
    destination: "Karonga",
    departureLocation: "Main Bus Station",
    arrivalLocation: "Karonga Boma Depot",
    companyAddress: "Blantyre: Wenela Terminal | Lilongwe: Area 4 / Devil's Street Depot | Mzuzu: Main Bus Station | Karonga: Karonga Boma Depot",
    rawPoints: "Mzuzu: Main Bus Station | Karonga: Karonga Boma Depot",
  },

  // 5. Matours Bus Company
  {
    operator: "Matours Bus Company",
    origin: "Blantyre",
    destination: "Lilongwe",
    departureLocation: "Wenela Bus Depot",
    arrivalLocation: "Devil's Street Depot",
    companyAddress: "Blantyre: Wenela Bus Depot | Lilongwe: Devil's Street Depot | Mzuzu: Main Depot | Salima: Salima Bus Terminal",
    rawPoints: "Blantyre: Wenela Bus Depot | Lilongwe: Devil's Street Depot",
  },
  {
    operator: "Matours Bus Company",
    origin: "Lilongwe",
    destination: "Mzuzu",
    departureLocation: "Devil's Street Depot",
    arrivalLocation: "Main Bus Depot",
    companyAddress: "Blantyre: Wenela Bus Depot | Lilongwe: Devil's Street Depot | Mzuzu: Main Depot | Salima: Salima Bus Terminal",
    rawPoints: "Lilongwe: Devil's Street Depot | Mzuzu: Main Depot",
  },
  {
    operator: "Matours Bus Company",
    origin: "Lilongwe",
    destination: "Salima",
    departureLocation: "Devil's Street Depot",
    arrivalLocation: "Salima Bus Terminal",
    companyAddress: "Blantyre: Wenela Bus Depot | Lilongwe: Devil's Street Depot | Mzuzu: Main Depot | Salima: Salima Bus Terminal",
    rawPoints: "Lilongwe: Devil's Street Depot | Salima: Salima Bus Terminal",
  },

  // 6. United Buses Zambia (UBZ 2020)
  {
    operator: "United Buses Zambia (UBZ 2020)",
    origin: "Lilongwe",
    destination: "Lusaka",
    departureLocation: "Grand Business Park",
    arrivalLocation: "Inter-City Bus Terminus",
    companyAddress: "Lilongwe: Grand Business Park | Lusaka: Inter-City Bus Terminus",
    rawPoints: "Lilongwe: Grand Business Park | Lusaka: Inter-City Bus Terminus",
  },

  // 7. Kobs
  {
    operator: "Kobs",
    origin: "Lilongwe",
    destination: "Lusaka",
    departureLocation: "Devil's Street Depot / City Centre",
    arrivalLocation: "Inter-City Bus Terminus",
    companyAddress: "Lilongwe: Devil's Street Depot / City Centre | Lusaka: Inter-City Bus Terminus",
    rawPoints: "Lilongwe: Devil's Street Depot / City Centre | Lusaka: Inter-City Bus Terminus",
  },

  // 8. 3 Star Coaches
  {
    operator: "3 Star Coaches",
    origin: "Blantyre",
    destination: "Harare",
    departureLocation: "Wenela Terminal",
    arrivalLocation: "Roadport Bus Station",
    companyAddress: "Blantyre: Wenela Terminal | Lilongwe: Devil's Street / Area 4 Depot | Harare: Roadport Bus Station",
    rawPoints: "Blantyre: Wenela Terminal | Harare: Roadport Bus Station",
  },
  {
    operator: "3 Star Coaches",
    origin: "Harare",
    destination: "Lilongwe",
    departureLocation: "Roadport Bus Station",
    arrivalLocation: "Devil's Street / Area 4 Depot",
    companyAddress: "Blantyre: Wenela Terminal | Lilongwe: Devil's Street / Area 4 Depot | Harare: Roadport Bus Station",
    rawPoints: "Harare: Roadport Bus Station | Lilongwe: Devil's Street / Area 4 Depot",
  },

  // 9. Trip Trans
  {
    operator: "Trip Trans",
    origin: "Blantyre",
    destination: "Harare",
    departureLocation: "Wenela Terminal",
    arrivalLocation: "Roadport Bus Station",
    companyAddress: "Blantyre: Wenela Terminal | Lilongwe: Devil's Street Depot | Harare: Roadport Bus Station",
    rawPoints: "Blantyre: Wenela Terminal | Lilongwe: Devil's Street Depot | Harare: Roadport Bus Station",
  },

  // 10. Ulendo Coaches
  {
    operator: "Ulendo Coaches",
    origin: "Blantyre",
    destination: "Johannesburg",
    departureLocation: "Wenela Bus Terminal",
    arrivalLocation: "Park Station",
    companyAddress: "Malawi: Wenela (Blantyre) / Lilongwe Area 4 / Mangochi Boma | JHB: Park Station",
    rawPoints: "Malawi: Wenela (Blantyre) / Lilongwe Area 4 / Mangochi Boma | JHB: Park Station",
  },

  // 11. Enkosi Coaches
  {
    operator: "Enkosi Coaches",
    origin: "Blantyre",
    destination: "Johannesburg",
    departureLocation: "Wenela Terminal",
    arrivalLocation: "Park Station",
    companyAddress: "Blantyre: Wenela Terminal | Johannesburg: Park Station",
    rawPoints: "Blantyre: Wenela Terminal | Johannesburg: Park Station",
  },

  // 12. Jobela Star
  {
    operator: "Jobela Star",
    origin: "Blantyre",
    destination: "Cape Town",
    departureLocation: "Wenela Terminal",
    arrivalLocation: "Bellville Terminal",
    companyAddress: "Blantyre: Wenela Terminal | Lilongwe: Devil's Street Depot | Cape Town: Bellville Terminal",
    rawPoints: "Blantyre: Wenela Terminal | Lilongwe: Devil's Street Depot | Cape Town: Bellville Terminal",
  },

  // 13. Sangano Logistics
  {
    operator: "Sangano Logistics",
    origin: "Blantyre",
    destination: "Johannesburg",
    departureLocation: "Wenela Terminal",
    arrivalLocation: "Park Station",
    companyAddress: "Blantyre: Wenela Terminal | Johannesburg: Park Station",
    rawPoints: "Blantyre: Wenela Terminal | Johannesburg: Park Station",
  },

  // 14. Munorurama Bus
  {
    operator: "Munorurama Bus",
    origin: "Lilongwe",
    destination: "Johannesburg",
    departureLocation: "Lilongwe Bus Terminal",
    arrivalLocation: "Park Station / Newtown Terminal",
    companyAddress: "Malawi: Wenela (Blantyre) / Lilongwe Terminal | Johannesburg: Park Station / Newtown Terminal",
    rawPoints: "Malawi: Wenela (Blantyre) / Lilongwe Terminal | Johannesburg: Park Station / Newtown Terminal",
  },

  // 15. Ulemu Coaches
  {
    operator: "Ulemu Coaches",
    origin: "Blantyre",
    destination: "Johannesburg",
    departureLocation: "Wenela Bus Terminal",
    arrivalLocation: "Park Station",
    companyAddress: "Malawi: Wenela (BT), Devil's Street (LL), Mzuzu Main, Salima & Mangochi Boma | JHB: Park Station | Durban: Station Depot",
    rawPoints: "Malawi: Wenela (BT), Devil's Street (LL), Mzuzu Main, Salima & Mangochi Boma | JHB: Park Station | Durban: Station Depot",
  },

  // 16. Falcon Executive
  {
    operator: "Falcon Executive",
    origin: "Lilongwe",
    destination: "Dar es Salaam",
    departureLocation: "Devil's Street Depot / City Centre",
    arrivalLocation: "Ubungo / Magufuli Bus Terminal",
    companyAddress: "Lilongwe: Devil's Street Depot / City Centre | Dar es Salaam: Ubungo / Magufuli Bus Terminal",
    rawPoints: "Lilongwe: Devil's Street Depot / City Centre | Dar es Salaam: Ubungo / Magufuli Bus Terminal",
  },
];

async function patchLocations() {
  console.log("🚀 Patching pick-up and drop-off points to companies and schedules...");

  // 1. Group by company to update Company address & contactSettings
  const companyMap = new Map<string, { address: string; points: string[] }>();
  for (const m of MAPPINGS) {
    if (!companyMap.has(m.operator)) {
      companyMap.set(m.operator, { address: m.companyAddress, points: [m.rawPoints] });
    } else {
      const existing = companyMap.get(m.operator)!;
      if (!existing.points.includes(m.rawPoints)) {
        existing.points.push(m.rawPoints);
      }
    }
  }

  for (const [name, info] of companyMap.entries()) {
    const company = await prisma.company.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });

    if (company) {
      await prisma.company.update({
        where: { id: company.id },
        data: {
          address: info.address,
          contactSettings: {
            ...(typeof company.contactSettings === 'object' && company.contactSettings !== null ? company.contactSettings : {}),
            pickupDropoffPoints: info.address,
          },
        },
      });
      console.log(`✅ Updated Company: ${company.name} -> Address: "${info.address}"`);
    } else {
      console.log(`⚠️ Company not found: ${name}`);
    }
  }

  // 2. Update Schedules per operator and route
  let totalSchedulesUpdated = 0;
  for (const m of MAPPINGS) {
    const company = await prisma.company.findFirst({
      where: { name: { equals: m.operator, mode: "insensitive" } },
      select: { id: true },
    });

    if (!company) continue;

    const routes = await prisma.route.findMany({
      where: {
        companyId: company.id,
        origin: { contains: m.origin, mode: "insensitive" },
        destination: { contains: m.destination, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (routes.length === 0) continue;
    const routeIds = routes.map((r) => r.id);

    const updateRes = await prisma.schedule.updateMany({
      where: {
        companyId: company.id,
        routeId: { in: routeIds },
      },
      data: {
        departureLocation: m.departureLocation,
        arrivalLocation: m.arrivalLocation,
      },
    });

    totalSchedulesUpdated += updateRes.count;
    console.log(`  📍 ${m.operator} [${m.origin} -> ${m.destination}]: Updated ${updateRes.count} schedules (Dep: "${m.departureLocation}", Arr: "${m.arrivalLocation}")`);
  }

  console.log(`\n🎉 Successfully patched pick-up & drop-off points for all operators (${totalSchedulesUpdated} schedules updated)!`);
}

patchLocations()
  .catch((e) => {
    console.error("❌ Error patching locations:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
