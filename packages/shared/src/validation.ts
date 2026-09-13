import { buildCatalog, type CatalogContext } from './catalog.js';
import {
  isRepeatBlock,
  resolveField,
  REVIEW_STEP,
  type FieldSpec,
  type Lang,
  type RepeatKey,
  type RepeatValues,
} from './types.js';

export interface StepErrors {
  /** Keyed by field key, for the questions asked once. */
  fields: Record<string, string>;
  /** Keyed by repeat section, then by `rowIndex:fieldKey`. */
  reps: Partial<Record<RepeatKey, { block: string | null; items: Record<string, string> }>>;
  count: number;
}

export function emptyStepErrors(): StepErrors {
  return { fields: {}, reps: {}, count: 0 };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function digits(value: string): number {
  return value.replace(/\D/g, '').length;
}

function requiredMessage(field: FieldSpec, lang: Lang): string {
  const th = lang === 'th';
  if (field.k === 'email') {
    return th ? 'กรุณากรอกอีเมลที่ติดต่อได้' : 'Please enter an email we can reach you at';
  }
  return th ? 'กรุณากรอกข้อมูลนี้' : 'Please fill this in';
}

/**
 * Checks one answer. Format rules only run once something has been typed,
 * so an empty optional field is never complained about.
 */
export function fieldError(field: FieldSpec, raw: string | undefined, lang: Lang): string | null {
  const th = lang === 'th';
  const value = (raw ?? '').trim();

  if (field.req && !value) return requiredMessage(field, lang);
  if (!value) return null;

  if (field.k === 'email' && !EMAIL_RE.test(value)) {
    return th ? 'อีเมลนี้ดูไม่ถูกต้อง' : 'That email address looks incomplete';
  }
  // `tel` also covers the phone on each reference row.
  if ((field.k === 'tel' || field.k === 'emgTel') && digits(value) < 9) {
    return th ? 'กรุณากรอกเบอร์โทรศัพท์ให้ครบ' : 'Please enter a valid phone number';
  }
  // Suffix match so the emergency contact's post code is checked too.
  if (/postcode$/i.test(field.k) && !/^\d{5}$/.test(value)) {
    return th ? 'รหัสไปรษณีย์มี 5 หลัก' : 'A post code is 5 digits';
  }
  if (field.k === 'idCard' && digits(value) !== 13) {
    return th ? 'เลขบัตรประชาชนมี 13 หลัก' : 'An ID card number has 13 digits';
  }
  return null;
}

function minimumRowsMessage(min: number, lang: Lang): string {
  if (lang === 'th') {
    return min === 1 ? 'กรุณาเพิ่มอย่างน้อย 1 รายการ' : `กรุณาเพิ่มอย่างน้อย ${min} รายการ`;
  }
  return min === 1 ? 'Please add at least one entry' : `Please add at least ${min} entries`;
}

/** Everything wrong on one step — skipping questions that aren't being asked. */
export function errorsForStep(
  ctx: CatalogContext,
  repeats: RepeatValues,
  step: number,
): StepErrors {
  const out = emptyStepErrors();

  for (const block of buildCatalog(ctx)) {
    if (block.step !== step) continue;

    if (isRepeatBlock(block)) {
      const rows = repeats[block.rep] ?? [];

      if (block.min && rows.length < block.min) {
        out.reps[block.rep] = { block: minimumRowsMessage(block.min, ctx.lang), items: {} };
        out.count++;
      }

      rows.forEach((row, index) => {
        for (const spec of block.fields) {
          // The spec as it applies to this row — which institutions to
          // suggest depends on the level answered beside it.
          const field = resolveField(spec, row);
          // A reference's address stays hidden until a post code is typed;
          // nothing hidden is asked for, so nothing hidden is checked.
          if (field.hidden) continue;

          const error = fieldError(field, row[field.k], ctx.lang);
          if (!error) continue;
          const bucket = (out.reps[block.rep] ??= { block: null, items: {} });
          bucket.items[`${index}:${field.k}`] = error;
          out.count++;
        }
      });
      continue;
    }

    for (const field of block.fields) {
      if (field.when && !field.when()) continue;
      const error = fieldError(field, ctx.values[field.k], ctx.lang);
      if (error) {
        out.fields[field.k] = error;
        out.count++;
      }
    }
  }

  return out;
}

export interface FullFormErrors {
  count: number;
  /** Which steps a person still has to go back to. */
  steps: Record<number, StepErrors>;
}

/**
 * Every question step at once. The server runs this before storing an
 * application so a submission that skipped the browser still has to be
 * complete.
 */
export function errorsForWholeForm(ctx: CatalogContext, repeats: RepeatValues): FullFormErrors {
  const steps: Record<number, StepErrors> = {};
  let count = 0;

  for (let step = 1; step < REVIEW_STEP; step++) {
    const errors = errorsForStep(ctx, repeats, step);
    if (errors.count > 0) {
      steps[step] = errors;
      count += errors.count;
    }
  }

  return { count, steps };
}
