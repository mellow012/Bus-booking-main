import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function main() {
  const email = process.argv[2] || 'booknpaymw012@gmail.com';
  
  const user = await prisma.user.findUnique({ where: { email } });
  console.log('User:', user);
  
  if (user && user.companyId) {
    const company = await prisma.company.findUnique({ where: { id: user.companyId } });
    console.log('Company:', company);
  } else {
    console.log('No companyId attached to this user.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
