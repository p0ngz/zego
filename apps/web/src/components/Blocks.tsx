import { isRepeatBlock, resolveField, type Block, type Lang, type RepeatBlock } from '@zego/shared';
import type { ApplicationForm } from '../useApplicationForm.js';
import { Field } from './Field.js';

interface BlocksProps {
  blocks: Block[];
  form: ApplicationForm;
}

export function Blocks({ blocks, form }: BlocksProps): JSX.Element {
  return (
    <>
      {blocks.map((block) => (
        <section className="block" key={`${block.step}-${block.th}`}>
          <div className="block-head">
            <h2 className="block-title">{form.t(block.th, block.en)}</h2>
          </div>

          {isRepeatBlock(block) ? (
            <Repeat block={block} form={form} />
          ) : (
            <div className="field-grid">
              {block.fields
                .filter((field) => !field.when || field.when())
                .map((field) => (
                  <Field
                    key={field.k}
                    field={field}
                    lang={form.lang}
                    value={form.values[field.k] ?? ''}
                    error={form.errors.fields[field.k]}
                    onChange={(value) => form.setField(field.k, value)}
                  />
                ))}
            </div>
          )}
        </section>
      ))}
    </>
  );
}

interface RepeatProps {
  block: RepeatBlock;
  form: ApplicationForm;
}

/**
 * A section a person fills in as many times as they need: one card per
 * row, added and removed by hand. The paper form printed four blank
 * lines whether you had one sibling or six.
 */
function Repeat({ block, form }: RepeatProps): JSX.Element {
  const rows = form.repeats[block.rep];
  const blockErrors = form.errors.reps[block.rep];
  const lang: Lang = form.lang;

  return (
    <div className="repeat">
      {rows.map((row, index) => (
        // Rows have no id of their own; position is what identifies them,
        // and removing one re-renders the rest anyway.
        <div className="repeat-card" key={index}>
          <div className="repeat-head">
            <span className="repeat-title">
              {form.t(block.itemTh, block.itemEn)} {index + 1}
            </span>
            <button
              type="button"
              className="repeat-remove"
              onClick={() => form.removeRepeatRow(block.rep, index)}
            >
              {form.t('ลบ', 'Remove')}
            </button>
          </div>

          <div className="repeat-grid">
            {block.fields.map((field) => {
              // A field that follows a neighbour in the same row — the
              // institution on the level — resolves against that row here.
              const spec = resolveField(field, row);
              if (spec.hidden) return null;
              return (
                <Field
                  key={field.k}
                  field={spec}
                  lang={lang}
                  value={row[field.k] ?? ''}
                  error={blockErrors?.items[`${index}:${field.k}`]}
                  onChange={(value) => form.setRepeatField(block.rep, index, field.k, value)}
                />
              );
            })}
          </div>
        </div>
      ))}

      {rows.length === 0 ? (
        <p className="repeat-empty">{form.t(block.emptyTh, block.emptyEn)}</p>
      ) : null}

      <button type="button" className="repeat-add" onClick={() => form.addRepeatRow(block.rep)}>
        {form.t(block.addTh, block.addEn)}
      </button>

      {blockErrors?.block ? (
        <span className="field-error" role="alert">
          {blockErrors.block}
        </span>
      ) : null}
    </div>
  );
}
