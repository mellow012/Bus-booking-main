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

async function main() {
  console.log('Seeding Operator Credentials...');

  // Based on your previous schema data
  const operatorsToSeed = [
    {
      uid: '4F9bopnI3cObNVg4uKFdZSug0Gr1',
      companyId: 'Hm8mEWHsFNavNJbCspPt',
      companyName: 'Quantum Tours',
      email: 'trevortaulo03@gmail.com',
      name: 'Trevor Taulo',
      role: 'operator',
      region: 'Mzuzu',
      status: 'active',
      invitationSent: true,
      invitationSentAt: new Date('2026-01-22T02:49:04Z'),
      signupCompletedAt: new Date('2026-01-22T02:49:04Z'),
      createdBy: 'vR3Qw01TawWN1Quk5Nm6uLerOXP2',
    },
    {
      uid: 'qU4lXYMsxnQ6CeFSvzn9BtNoDTo1',
      companyId: 'Hm8mEWHsFNavNJbCspPt',
      companyName: 'Quantum Tours',
      email: 'booknpaymw012@gmail.com',
      name: 'patrick',
      role: 'conductor',
      status: 'active',
      invitationSent: true,
      invitationSentAt: new Date('2026-02-11T03:02:14Z'),
      signupCompletedAt: new Date('2026-02-11T03:02:58Z'),
      createdBy: 'vR3Qw01TawWN1Quk5Nm6uLerOXP2',
    },
  ];

  for (const opData of operatorsToSeed) {
    console.log(`Creating operator: ${opData.name} (${opData.email})`);

    // Check if company exists, if not create it
    let company = await prisma.company.findUnique({
      where: { id: opData.companyId },
    });

    if (!company) {
      console.log(`Company not found, creating: ${opData.companyName}`);
      company = await prisma.company.create({
        data: {
          id: opData.companyId,
          name: opData.companyName,
          email: `info@${opData.companyName.toLowerCase().replace(/\s+/g, '')}.mw`,
          status: 'active',
          setupCompleted: true,
        },
      });
    }

    // Create or update operator
    const existingOperator = await prisma.operator.findUnique({
      where: { uid: opData.uid },
    });

    if (existingOperator) {
      console.log(`Operator already exists: ${opData.email}`);
      continue;
    }

    await prisma.operator.create({
      data: {
        uid: opData.uid,
        companyId: opData.companyId,
        companyName: opData.companyName,
        email: opData.email,
        name: opData.name,
        role: opData.role,
        status: opData.status,
        region: opData.region,
        invitationSent: opData.invitationSent,
        invitationSentAt: opData.invitationSentAt,
        signupCompletedAt: opData.signupCompletedAt,
        createdBy: opData.createdBy,
      },
    });

    console.log(`✓ Created operator: ${opData.name}`);
  }

  console.log('Operator seeding completed!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
