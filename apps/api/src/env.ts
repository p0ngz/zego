import { z } from 'zod';

/**
 * Configuration is read once, at boot. A missing or malformed value stops
 * the process here with a readable list rather than surfacing as a null
 * halfway through a request.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3003),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required — see .env.example'),
  /** Unpooled, for migrations. The same value as DATABASE_URL locally. */
  DIRECT_DATABASE_URL: z.string().min(1, 'DIRECT_DATABASE_URL is required — see .env.example'),

  /** Browser origins allowed to call this API, comma separated. */
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3002')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  /**
   * 32 bytes, base64, used to encrypt the national ID number at rest.
   * Generate one with: openssl rand -base64 32
   */
  APP_ENCRYPTION_KEY: z.string().optional(),

  /** Applications accepted per IP per hour. */
  SUBMIT_RATE_LIMIT: z.coerce.number().int().min(1).default(10),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const lines = parsed.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`);
  console.error(`Invalid environment:\n${lines.join('\n')}`);
  process.exit(1);
}

export const env = parsed.data;

/**
 * Running for real, by either name.
 *
 * NODE_ENV deliberately is not set on Vercel: npm reads it during the
 * build and skips every devDependency, which takes TypeScript, Vite and
 * the Prisma CLI with it. Vercel says which environment this is in its
 * own variable instead, so that is what gets asked.
 */
export const isProduction = env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

if (isProduction && !env.APP_ENCRYPTION_KEY) {
  console.error(
    'APP_ENCRYPTION_KEY is required in production: national ID numbers are ' +
      'encrypted at rest. Generate one with `openssl rand -base64 32`.',
  );
  process.exit(1);
}
