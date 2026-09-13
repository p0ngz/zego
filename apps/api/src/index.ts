import { createApp } from './app.js';
import { env } from './env.js';
import { prisma } from './prisma.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`[zego] api listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

/**
 * Stop taking new connections, let the ones in flight finish, then close
 * the database pool. A submission halfway through writing is not dropped.
 */
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[zego] ${signal} received, shutting down`);

  const forced = setTimeout(() => {
    console.error('[zego] shutdown took too long, exiting anyway');
    process.exit(1);
  }, 10_000);
  forced.unref();

  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();

  clearTimeout(forced);
  process.exit(0);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}

process.on('unhandledRejection', (reason) => {
  console.error('[zego] unhandled rejection:', reason);
});
