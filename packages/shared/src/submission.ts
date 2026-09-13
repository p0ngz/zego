import { z } from 'zod';
import { REPEAT_KEYS } from './types.js';

/** Long enough for a job description, short enough to keep a row sane. */
const answer = z.string().max(4000);

const row = z.record(z.string(), answer);

const repeats = z.object(
  Object.fromEntries(REPEAT_KEYS.map((key) => [key, z.array(row).max(40)])) as Record<
    (typeof REPEAT_KEYS)[number],
    z.ZodArray<typeof row>
  >,
);

export const submissionSchema = z.object({
  lang: z.enum(['th', 'en']),
  values: z.record(z.string(), answer),
  repeats,
  /** The certification on the last step — an application cannot arrive without it. */
  certified: z.literal(true),
  /**
   * Consent to processing personal data, which PDPA section 26 wants
   * asked separately from the certification above. One says the answers
   * are true; this one says they may be kept and read.
   */
  consented: z.literal(true),
});

export type SubmissionPayload = z.infer<typeof submissionSchema>;

/** What the server hands back once an application is stored. */
export interface SubmissionReceipt {
  id: string;
  reference: string;
  submittedAt: string;
  firstName: string;
  lastName: string;
  email: string;
  position: string;
}

/** One row in the list of applications received. */
export interface ApplicationSummary extends SubmissionReceipt {
  lang: 'th' | 'en';
  tel: string;
}
