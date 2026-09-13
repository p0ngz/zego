import { randomInt } from 'node:crypto';
import {
  emptyReference,
  errorsForWholeForm,
  positionLabel,
  submissionSchema,
  type ApplicationSummary,
  type CatalogContext,
  type SubmissionReceipt,
} from '@zego/shared';
import { Router } from 'express';
import { z } from 'zod';
import { decryptSensitive, encryptSensitive, maskIdCard } from '../crypto.js';
import { HttpError, wrap } from '../errors.js';
import { prisma } from '../prisma.js';
import { limitSubmissions, requireAdmin } from '../guards.js';
import { addressMatchesPostcode } from '../reference.js';

export const applicationsRouter: Router = Router();

/** No I, O, 0 or 1 — these get read aloud over the phone. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function referenceCode(): string {
  let out = '';
  for (let i = 0; i < 6; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `ZG-${out}`;
}

/**
 * Accepts a completed application.
 *
 * The browser has already checked every step, but it is the only thing
 * that has. The same catalog runs again here, against the same rules, so
 * a request built by hand has to be as complete as one typed into the
 * form.
 */
applicationsRouter.post(
  '/',
  limitSubmissions,
  wrap(async (req, res) => {
    const payload = submissionSchema.parse(req.body);

    const ctx: CatalogContext = {
      lang: payload.lang,
      values: payload.values,
      // Validation never reads the suggestion lists, and the post code
      // table is checked separately below.
      reference: emptyReference,
    };

    const errors = errorsForWholeForm(ctx, payload.repeats);
    if (errors.count > 0) {
      throw new HttpError(422, 'This application is missing answers', {
        count: errors.count,
        steps: errors.steps,
      });
    }

    await assertAddressesAreReal(payload.values);

    const values = { ...payload.values };
    const idCard = values.idCard ?? '';
    if (idCard) values.idCard = encryptSensitive(idCard);

    // Six random characters collide eventually; retry rather than 500.
    const created = await createWithUniqueReference(async (reference) =>
      prisma.application.create({
        data: {
          reference,
          lang: payload.lang,
          firstName: values.firstName ?? '',
          lastName: values.lastName ?? '',
          email: values.email ?? '',
          tel: values.tel ?? '',
          position: positionLabel(ctx),
          values,
          repeats: payload.repeats,
        },
        select: {
          id: true,
          reference: true,
          submittedAt: true,
          firstName: true,
          lastName: true,
          email: true,
          position: true,
        },
      }),
    );

    const receipt: SubmissionReceipt = {
      ...created,
      submittedAt: created.submittedAt.toISOString(),
    };

    res.status(201).json(receipt);
  }),
);

const listQuery = z.object({
  take: z.coerce.number().int().min(1).max(100).default(25),
  skip: z.coerce.number().int().min(0).default(0),
});

/** Applications received, newest first. Answers stay out of the list. */
applicationsRouter.get(
  '/',
  requireAdmin,
  wrap(async (req, res) => {
    const { take, skip } = listQuery.parse(req.query);

    const [rows, total] = await Promise.all([
      prisma.application.findMany({
        orderBy: { submittedAt: 'desc' },
        take,
        skip,
        select: {
          id: true,
          reference: true,
          lang: true,
          submittedAt: true,
          firstName: true,
          lastName: true,
          email: true,
          tel: true,
          position: true,
        },
      }),
      prisma.application.count(),
    ]);

    const items: ApplicationSummary[] = rows.map((row) => ({
      ...row,
      lang: row.lang === 'en' ? 'en' : 'th',
      submittedAt: row.submittedAt.toISOString(),
    }));

    res.json({ items, total, take, skip });
  }),
);

/** One application by its reference code, with the ID number kept masked. */
applicationsRouter.get(
  '/:reference',
  requireAdmin,
  wrap(async (req, res) => {
    const reference = z.string().regex(/^ZG-[A-Z2-9]{6}$/).parse(req.params.reference);

    const row = await prisma.application.findUnique({ where: { reference } });
    if (!row) throw new HttpError(404, `No application ${reference}`);

    const values = { ...(row.values as Record<string, string>) };
    // Decrypt only to mask: a reader of this endpoint gets the last four
    // digits, never the whole number.
    if (values.idCard) {
      try {
        values.idCard = maskIdCard(decryptSensitive(values.idCard));
      } catch {
        values.idCard = '••••';
      }
    }

    res.json({
      id: row.id,
      reference: row.reference,
      lang: row.lang,
      status: row.status,
      submittedAt: row.submittedAt.toISOString(),
      values,
      repeats: row.repeats,
    });
  }),
);

/**
 * The applicant's address, and the emergency contact's when it differs,
 * have to name a district and sub-district that really sit under the post
 * code given.
 */
async function assertAddressesAreReal(values: Record<string, string>): Promise<void> {
  const checks: Array<{ prefix: string; label: string }> = [
    { prefix: '', label: 'present address' },
  ];
  if (!values.emgSameAddr) checks.push({ prefix: 'emg', label: 'emergency contact address' });

  for (const { prefix, label } of checks) {
    const key = (name: string) =>
      prefix ? prefix + name.charAt(0).toUpperCase() + name.slice(1) : name;

    const code = (values[key('postcode')] ?? '').trim();
    const district = (values[key('district')] ?? '').trim();
    const subDistrict = (values[key('subDistrict')] ?? '').trim();
    const province = (values[key('province')] ?? '').trim();

    const ok = await addressMatchesPostcode(code, district, subDistrict, province);
    if (!ok) {
      throw new HttpError(422, `The ${label} does not match Thai post code ${code || '(blank)'}`, {
        field: key('postcode'),
      });
    }
  }
}

/** Retries a few times when the random reference code is already taken. */
async function createWithUniqueReference<T>(create: (reference: string) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await create(referenceCode());
    } catch (error) {
      const isDuplicate =
        typeof error === 'object' &&
        error !== null &&
        (error as { code?: string }).code === 'P2002';
      if (!isDuplicate) throw error;
    }
  }
  throw new HttpError(503, 'Could not allocate a reference code. Try again.');
}
