import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import { env } from './env.js';
import { HttpError } from './errors.js';
import { prisma } from './prisma.js';

/* ------------------------------------------------------------------ *
 * Who is allowed to read applications back
 * ------------------------------------------------------------------ */

/** Compares without leaking, through timing, how much of it matched. */
function sameToken(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which is itself a leak;
  // hashing first makes both sides the same size whatever was sent.
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}

/**
 * Guards the endpoints that read applications back.
 *
 * With no token configured they are switched off rather than left open:
 * the list carries every applicant's name, phone number and address, and
 * an endpoint nobody remembered to protect is worse than one that is not
 * there. Submitting is unaffected — that is the public part.
 */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  const expected = env.ADMIN_TOKEN;
  if (!expected) {
    throw new HttpError(
      404,
      'Reading applications is switched off. Set ADMIN_TOKEN to turn it on.',
    );
  }

  const header = req.header('authorization') ?? '';
  const given = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';

  if (!given || !sameToken(given, expected)) {
    throw new HttpError(401, 'Send a valid bearer token to read applications');
  }
  next();
};

/* ------------------------------------------------------------------ *
 * How often one sender may submit
 * ------------------------------------------------------------------ */

const WINDOW_MS = 60 * 60 * 1000;

/**
 * Who a request came from, as a fingerprint rather than an address.
 *
 * The point is only to recognise the same sender twice, so the address
 * is hashed with a server-side key and the address itself is never
 * stored. Behind Vercel the real client is the first entry in
 * x-forwarded-for; Express's own `req.ip` reads it too, and this falls
 * back to that.
 */
function fingerprint(req: Request): string {
  const forwarded = (req.header('x-forwarded-for') ?? '').split(',')[0]?.trim();
  const address = forwarded || req.ip || 'unknown';
  // Salted with a key that never leaves the server, so the stored value
  // cannot be turned back into an address by trying every IPv4.
  const salt = env.APP_ENCRYPTION_KEY ?? 'zego-unsalted';
  return createHash('sha256').update(`${salt}:${address}`).digest('hex');
}

/**
 * Refuses a sender who has already submitted too often this hour.
 *
 * The count lives in the database because serverless gives every request
 * its own instance: a counter in memory would start again from zero
 * almost every time, which is the same as having none.
 */
export const limitSubmissions: RequestHandler = (req, _res, next) => {
  const since = new Date(Date.now() - WINDOW_MS);
  const who = fingerprint(req);

  void (async () => {
    try {
      // Housekeeping on the way past, so the table stays small without a
      // job of its own.
      await prisma.submissionAttempt.deleteMany({ where: { at: { lt: since } } });

      const recent = await prisma.submissionAttempt.count({
        where: { fingerprint: who, at: { gte: since } },
      });

      if (recent >= env.SUBMIT_RATE_LIMIT) {
        next(
          new HttpError(429, 'Too many applications from this connection. Try again in an hour.'),
        );
        return;
      }

      await prisma.submissionAttempt.create({ data: { fingerprint: who } });
      next();
    } catch (error) {
      // A counter that cannot be read is not a reason to turn away a real
      // applicant; the submission itself is still fully checked.
      console.error('[zego] rate limit check failed, letting the request through:', error);
      next();
    }
  })();
};

/* ------------------------------------------------------------------ *
 * Retention
 * ------------------------------------------------------------------ */

/**
 * Deletes applications past the retention period.
 *
 * Consent is given for considering one application, not for keeping it
 * indefinitely, so something has to do the forgetting. Vercel calls this
 * nightly with CRON_SECRET; without that secret set it is off, and with
 * it set nothing else can reach it.
 */
export const runPurge: RequestHandler = (req, res, next) => {
  const secret = env.CRON_SECRET;
  if (!secret) {
    next(new HttpError(404, 'The purge is switched off. Set CRON_SECRET to turn it on.'));
    return;
  }

  const header = req.header('authorization') ?? '';
  const given = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!given || !sameToken(given, secret)) {
    next(new HttpError(401, 'Not allowed'));
    return;
  }

  const cutoff = new Date(Date.now() - env.RETENTION_DAYS * 24 * 60 * 60 * 1000);

  void (async () => {
    try {
      const applications = await prisma.application.deleteMany({
        where: { submittedAt: { lt: cutoff } },
      });
      const attempts = await prisma.submissionAttempt.deleteMany({
        where: { at: { lt: new Date(Date.now() - WINDOW_MS) } },
      });

      console.log(
        `[zego] purge: removed ${applications.count} applications older than ` +
          `${env.RETENTION_DAYS} days, and ${attempts.count} stale rate-limit rows`,
      );
      res.json({
        ok: true,
        applicationsRemoved: applications.count,
        retentionDays: env.RETENTION_DAYS,
      });
    } catch (error) {
      next(error);
    }
  })();
};
