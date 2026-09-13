import { buildCatalog, errorsForStep, positionLabel, REVIEW_STEP, STEPS } from '@zego/shared';
import { useMemo } from 'react';
import { Blocks } from './components/Blocks.js';
import { Review } from './components/Review.js';
import { useApplicationForm, type ApplicationForm } from './useApplicationForm.js';

export default function App(): JSX.Element {
  const form = useApplicationForm();

  return (
    <div className="app">
      <Header form={form} />
      {form.receipt ? <Sent form={form} /> : <Editing form={form} />}
    </div>
  );
}

function Header({ form }: { form: ApplicationForm }): JSX.Element {
  const saveLabel = {
    idle: form.t('บันทึกอัตโนมัติ', 'Autosave on'),
    saving: form.t('กำลังบันทึก…', 'Saving…'),
    saved: form.t('บันทึกแล้วเมื่อครู่', 'Saved just now'),
  }[form.saveState];

  return (
    <header className="header">
      <div className="header-inner">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true" />
          <span className="brand-text">{form.t('ใบสมัครงาน', 'Careers · Job application')}</span>
        </div>

        <div className="header-right">
          <div className="save" aria-live="polite">
            <span className="save-dot" aria-hidden="true" />
            {saveLabel}
          </div>

          <div className="lang">
            <button
              type="button"
              className="lang-btn"
              aria-pressed={form.lang === 'th'}
              onClick={() => form.setLang('th')}
            >
              ไทย
            </button>
            <button
              type="button"
              className="lang-btn"
              aria-pressed={form.lang === 'en'}
              onClick={() => form.setLang('en')}
            >
              EN
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

function Editing({ form }: { form: ApplicationForm }): JSX.Element {
  const isReview = form.step === REVIEW_STEP;
  const meta = STEPS[form.step - 1]!;

  const blocks = useMemo(
    () => (isReview ? [] : buildCatalog(form.catalogContext).filter((b) => b.step === form.step)),
    [isReview, form.catalogContext, form.step],
  );

  // Counted only once the step has been checked, so the bar stays quiet
  // until someone tries to move on.
  const errorCount = form.showErrors
    ? errorsForStep(form.catalogContext, form.repeats, form.step).count
    : 0;

  return (
    <>
      <main className="main">
        <nav className="steps" aria-label={form.t('ขั้นตอน', 'Steps')}>
          <div className="step-counter">
            {form.t(`ขั้นที่ ${form.step} จาก ${REVIEW_STEP}`, `Step ${form.step} of ${REVIEW_STEP}`)}
          </div>
          <div className="step-bars">
            {STEPS.map((step, index) => {
              const number = index + 1;
              const state = number < form.step ? 'is-done' : number === form.step ? 'is-current' : '';
              const name = form.t(step.th, step.en);
              return (
                <button
                  type="button"
                  className="step-btn"
                  key={step.en}
                  title={name}
                  aria-current={number === form.step ? 'step' : undefined}
                  onClick={() => form.goToStep(number)}
                >
                  <span className={`step-bar ${state}`} />
                  <span className={`step-name ${state}`}>
                    {String(number).padStart(2, '0')} {name}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="step-head">
          <h1 className="step-title">
            {isReview
              ? form.t('ตรวจสอบและส่งใบสมัคร', 'Review and submit')
              : form.t(meta.th, meta.en)}
          </h1>
          <p className="step-lede">{form.t(meta.ledeTh, meta.ledeEn)}</p>
        </div>

        {isReview ? <Review form={form} /> : <Blocks blocks={blocks} form={form} />}
      </main>

      <div className="footbar">
        <div className="footbar-inner">
          <button
            type="button"
            className="btn-back"
            onClick={form.back}
            style={{ visibility: form.step > 1 ? 'visible' : 'hidden' }}
          >
            {form.t('← ย้อนกลับ', '← Back')}
          </button>

          <div className="foot-right">
            {errorCount > 0 ? (
              <span className="foot-hint is-error">
                {form.t(
                  `ยังมี ${errorCount} ช่องที่ต้องแก้`,
                  `${errorCount} ${errorCount === 1 ? 'field needs' : 'fields need'} attention`,
                )}
              </span>
            ) : null}

            <button
              type="button"
              className={`btn-next${form.submitting ? ' is-sending' : ''}`}
              onClick={form.next}
              // Nothing to send until both boxes on the review step are
              // ticked; the reason sits just above the button.
              disabled={form.submitting || (isReview && !(form.certified && form.consented))}
            >
              {form.submitting
                ? form.t('กำลังส่ง…', 'Sending…')
                : isReview
                  ? form.t('ส่งใบสมัคร', 'Submit application')
                  : form.t('ถัดไป →', 'Continue →')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Sent({ form }: { form: ApplicationForm }): JSX.Element {
  const receipt = form.receipt!;
  const name = receipt.firstName;
  const role = positionLabel(form.catalogContext);

  return (
    <main className="done">
      <div className="done-inner">
        <div className="done-mark" aria-hidden="true">
          ✓
        </div>
        <h1 className="done-title">{form.t('ส่งใบสมัครแล้ว', 'Application sent')}</h1>
        {/*
          The design promised a confirmation email here. Nothing sends one
          yet, and an applicant waiting for mail that never arrives calls
          the company instead. Until there is a mail service, this says
          what actually happened and gives them the code to quote.
        */}
        <p className="done-body">
          {form.t(
            `ขอบคุณ ${name} เราได้รับใบสมัครตำแหน่ง ${role} เรียบร้อยแล้ว ทีมงานจะติดต่อกลับที่ ${receipt.email} หรือเบอร์ที่คุณให้ไว้`,
            `Thanks ${name}. We have your application for ${role}. We will get back to you at ${receipt.email} or the number you gave us.`,
          )}
        </p>

        <div className="done-ref">
          {form.t('เลขที่ใบสมัคร', 'Reference')} {receipt.reference}
        </div>

        <button type="button" className="btn-ghost" onClick={form.restart}>
          {form.t('เริ่มใบสมัครใหม่', 'Start a new application')}
        </button>
      </div>
    </main>
  );
}
