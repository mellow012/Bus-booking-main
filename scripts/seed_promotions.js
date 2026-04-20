const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const promotions = [
    {
      code: 'WELCOME15',
      title: 'Welcome Discount',
      description: 'Get 15% off on your first bus booking with TibhukeBus. Start your journey with us today!',
      discountValue: 15,
      discountType: 'percentage',
      minPurchase: 0,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      isActive: true,
    },
    {
      code: 'EASTER2026',
      title: 'Easter Special',
      description: 'Celebrate Easter with a flat discount on all routes across Malawi. Limited time offer!',
      discountValue: 5000,
      discountType: 'fixed',
      minPurchase: 20000,
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days (Expiring soon)
      isActive: true,
    },
    {
      code: 'FREEDOM',
      title: 'Independence Day Deal',
      description: 'Celebrate Freedom with exclusive savings on long-distance routes. Go further for less!',
      discountValue: 10,
      discountType: 'percentage',
      minPurchase: 15000,
      startDate: new Date(),
      endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days
      isActive: true,
    }
  ];

  console.log('Seeding promotions...');

  for (const promo of promotions) {
    await prisma.promotion.upsert({
      where: { code: promo.code },
      update: promo,
      create: promo,
    });
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
