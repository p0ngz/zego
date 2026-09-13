import {
  buildCatalog,
  isRepeatBlock,
  presentAddressText,
  REVIEW_STEP,
  STEPS,
  type FieldSpec,
  type Lang,
} from '@zego/shared';
import type { ApplicationForm } from '../useApplicationForm.js';

interface ReviewProps {
  form: ApplicationForm;
}

/** Turns a stored answer back into the words the applicant chose. */
function display(field: FieldSpec, raw: string | undefined, lang: Lang, form: ApplicationForm): string {
  const value = raw ?? '';
  if (!value) return '—';

  if (field.type === 'check') {
    return field.k === 'emgSameAddr'
      ? presentAddressText(form.catalogContext)
      : form.t('ใช่', 'Yes');
  }

  if (field.type === 'chips' || field.type === 'select') {
    const hit = field.opts?.find((option) => option[0] === value);
    return hit ? (lang === 'th' ? hit[1] : hit[2]) : value;
  }

  return value;
}

/**
 * Everything answered, grouped by the step it was asked on, with a way
 * back into each one. Read before sending — this is the last chance to
 * catch a typo in a phone number.
 */
export function Review({ form }: ReviewProps): JSX.Element {
  const catalog = buildCatalog(form.catalogContext);
  const lang = form.lang;

  const groups = STEPS.slice(0, REVIEW_STEP - 1).map((meta, index) => {
    const stepNumber = index + 1;
    const rows: { label: string; value: string }[] = [];

    for (const block of catalog) {
      if (block.step !== stepNumber) continue;

      if (isRepeatBlock(block)) {
        const entries = form.repeats[block.rep];
        if (entries.length === 0) {
          rows.push({ label: form.t(block.th, block.en), value: '—' });
          continue;
        }
        entries.forEach((row, rowIndex) => {
          const parts = block.fields
            .filter((field) => field.type !== 'heading')
            .map((field) => display(field, row[field.k], lang, form))
            .filter((part) => part !== '—');
          rows.push({
            label: `${form.t(block.th, block.en)} ${rowIndex + 1}`,
            value: parts.join(' · ') || '—',
          });
        });
        continue;
      }

      for (const field of block.fields) {
        if (field.when && !field.when()) continue;
        if (field.type === 'heading') continue;
        rows.push({
          label: form.t(field.th, field.en),
          value: display(field, form.values[field.k], lang, form),
        });
      }
    }

    return {
      step: stepNumber,
      title: `${String(stepNumber).padStart(2, '0')} · ${form.t(meta.th, meta.en)}`,
      rows,
    };
  });

  return (
    <div className="review">
      {groups.map((group) => (
        <section className="card" key={group.step}>
          <div className="review-head">
            <h2 className="review-title">{group.title}</h2>
            <button
              type="button"
              className="review-edit"
              onClick={() => form.goToStep(group.step)}
            >
              {form.t('แก้ไข', 'Edit')}
            </button>
          </div>
          <div className="review-rows">
            {group.rows.map((row, index) => (
              <div className="review-row" key={`${row.label}-${index}`}>
                <span className="review-label">{row.label}</span>
                <span className="review-value">{row.value}</span>
              </div>
            ))}
          </div>
        </section>
      ))}

      <Certification form={form} />
    </div>
  );
}

function Certification({ form }: ReviewProps): JSX.Element {
  const error =
    form.showErrors && !form.certified
      ? form.t('กรุณายอมรับข้อความรับรองก่อนส่ง', 'Please accept the statement before submitting')
      : null;

  return (
    <section className="card">
      <h2 className="review-title">{form.t('การรับรองข้อมูล', 'Certification')}</h2>
      <p className="cert-body">
        {form.t(
          'ข้าพเจ้าขอรับรองว่าข้อความทั้งหมดในใบสมัครนี้เป็นความจริง หากตรวจพบภายหลังว่าเป็นความเท็จ บริษัทมีสิทธิเลิกจ้างได้โดยไม่ต้องจ่ายค่าชดเชยหรือค่าบอกกล่าวล่วงหน้าใดๆ',
          'I certify all statements given in this application form are true. If any is found to be untrue after engagement, the company has the right to terminate my employment without any compensation or severance pay whatsoever.',
        )}
      </p>

      <button type="button" className="check" aria-pressed={form.certified} onClick={form.toggleCertified}>
        <span className="check-box" aria-hidden="true" style={{ marginTop: 1 }}>
          {form.certified ? '✓' : ''}
        </span>
        <span className="cert-agree">
          {form.t(
            'ข้าพเจ้าอ่านและยอมรับข้อความข้างต้น',
            'I have read and accept the statement above',
          )}
        </span>
      </button>

      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : null}

      {form.submitError ? (
        <span className="submit-error" role="alert">
          {form.submitError}
        </span>
      ) : null}
    </section>
  );
}
