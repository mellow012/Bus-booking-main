// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pool?: Pool;
  adapter?: PrismaPg;
};

const isNewPool = !globalForPrisma.pool;

const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 50,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 30000,
    keepAlive: true,
  });

if (isNewPool) {
  pool.setMaxListeners(30);
  pool.on('error', (err) => {
    console.warn('[Prisma pg pool] Handled connection error:', err.message);
  });
}

const adapter = globalForPrisma.adapter ?? new PrismaPg(pool);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pool = pool;
  globalForPrisma.adapter = adapter;
}

export default prisma;
