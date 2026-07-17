import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function fixPermissions() {
  console.log('Granting permissions for Supabase roles...');
  try {
    await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;`);
    await prisma.$executeRawUnsafe(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;`);
    await prisma.$executeRawUnsafe(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;`);
    await prisma.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;`);
    await prisma.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;`);
    
    console.log('Successfully granted permissions!');
  } catch (err: any) {
    console.error('Error granting permissions:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixPermissions();
