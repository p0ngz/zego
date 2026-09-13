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
      <Consent form={form} />

      {/*
        Says why the submit button is not available.

        The button is disabled until both boxes are ticked, and a disabled
        button that does not explain itself is just a dead end. This sits
        directly above it and is readable at every width, which the hint
        in the action bar is not on a phone.
      */}
      {form.certified && form.consented ? null : (
        <p className="submit-gate">
          {form.t(
            'ติ๊กยอมรับทั้งสองข้อด้านบน จึงจะส่งใบสมัครได้',
            'Tick both boxes above to submit your application',
          )}
        </p>
      )}
    </div>
  );
}

/**
 * Consent to the data being kept, asked on its own.
 *
 * The certification above says the answers are true. That is not consent
 * to hold them — PDPA section 26 wants that asked separately and in
 * plain terms, and this form collects four of the categories it calls
 * sensitive.
 */
function Consent({ form }: ReviewProps): JSX.Element {
  const error =
    form.showErrors && !form.consented
      ? form.t(
          'กรุณายินยอมให้เก็บข้อมูลก่อนส่งใบสมัคร',
          'Please agree to us keeping your details before submitting',
        )
      : null;

  return (
    <section className="card">
      <h2 className="review-title">
        {form.t('ความยินยอมให้เก็บข้อมูลส่วนบุคคล', 'Consent to keep your details')}
      </h2>
      <p className="cert-body">
        {form.t(
          'ใบสมัครนี้มีข้อมูลอ่อนไหวตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล มาตรา 26 ได้แก่ เลขบัตรประชาชน ศาสนา เชื้อชาติ และประวัติการเจ็บป่วย บริษัทจะใช้ข้อมูลเหล่านี้เพื่อพิจารณารับเข้าทำงานเท่านั้น จะไม่เปิดเผยแก่บุคคลภายนอกโดยไม่ได้รับอนุญาต และจะลบใบสมัครโดยอัตโนมัติเมื่อพ้นระยะเวลาที่บริษัทกำหนด',
          'This application includes data that Thailand’s PDPA section 26 treats as sensitive: your national ID number, religion, race and health history. They will be used only to consider you for this role, will not be passed to anyone outside the company without your permission, and the application is deleted automatically once the retention period is up.',
        )}
      </p>

      <button
        type="button"
        className="check"
        aria-pressed={form.consented}
        onClick={form.toggleConsented}
      >
        <span className="check-box" aria-hidden="true" style={{ marginTop: 1 }}>
          {form.consented ? '✓' : ''}
        </span>
        <span className="cert-agree">
          {form.t(
            'ข้าพเจ้ายินยอมให้บริษัทเก็บและใช้ข้อมูลข้างต้นตามวัตถุประสงค์ที่ระบุ',
            'I agree to the company keeping and using the details above for that purpose',
          )}
        </span>
      </button>

      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </section>
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
