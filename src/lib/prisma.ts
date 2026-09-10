// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
const configuredPoolMax = Number.parseInt(process.env.DATABASE_POOL_MAX ?? '4', 10);
const poolMax = Number.isInteger(configuredPoolMax)
  ? Math.min(Math.max(configuredPoolMax, 1), 4)
  : 2;
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
    // With Supabase's 60-connection budget and about 8 connections consumed by
    // platform services, a 2-4 connection footprint lets more serverless
    // instances coexist. PgBouncer transaction mode multiplexes these small
    // app-side pools over fewer backend connections.
    max: poolMax,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
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
