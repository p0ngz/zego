import { PrismaClient } from '@prisma/client';
import { isProduction, isTest } from './env.js';

/**
 * One client for the process. `tsx watch` re-imports modules on every save,
 * so in development the instance is parked on globalThis to stop each
 * reload opening another connection pool.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction || isTest ? ['warn', 'error'] : ['warn', 'error'],
  });

if (!isProduction) globalForPrisma.prisma = prisma;
