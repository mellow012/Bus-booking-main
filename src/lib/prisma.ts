// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pool?: Pool;
};

const isNewPool = !globalForPrisma.pool;

const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

// Only attach once — re-runs on hot-reload reuse the same pool object,
// so attaching here every time stacks listeners and triggers the
// MaxListenersExceededWarning on BoundPool.
if (isNewPool) {
  pool.setMaxListeners(20); // headroom for adapter internals
  pool.on('error', (err) => {
    console.warn('[Prisma pg pool] Handled connection error:', err.message);
  });
}

const adapter = new PrismaPg(pool);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

globalForPrisma.prisma = prisma;
globalForPrisma.pool = pool;

export default prisma;
