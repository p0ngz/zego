import type { FieldSpec, Lang } from '@zego/shared';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

interface FieldProps {
  field: FieldSpec;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  lang: Lang;
}

/** Label, the grey note beside it, the control, and the error under it. */
export function Field({ field, value, onChange, error, lang }: FieldProps): JSX.Element {
  const id = useId();
  const th = lang === 'th';
  const label = th ? field.th : field.en;

  const hint = field.hintTh !== undefined ? (th ? field.hintTh : (field.hintEn ?? '')) : '';
  const optional = th ? 'ไม่บังคับ' : 'Optional';
  const sub = field.opt ? (hint ? `${hint} · ${optional}` : optional) : hint;

  const style = field.span ? { gridColumn: field.span } : undefined;
  const errorId = error ? `${id}-error` : undefined;

  // The check draws its own label inside the control.
  if (field.type === 'check') {
    return (
      <div className="field field--check" style={style}>
        <button
          type="button"
          className="check"
          aria-pressed={value === 'yes'}
          onClick={() => onChange(value ? '' : 'yes')}
        >
          <span className="check-box" aria-hidden="true">
            {value ? '✓' : ''}
          </span>
          <span className="check-text">
            <span className="check-label">{label}</span>
            {sub ? <span className="check-sub">{sub}</span> : null}
          </span>
        </button>
        {error ? <span className="field-error">{error}</span> : null}
      </div>
    );
  }

  return (
    <div className="field" style={style}>
      {field.type === 'chips' ? (
        <span className="field-label" id={`${id}-label`}>
          {label}
          {sub ? <> <span className="field-sub">{sub}</span></> : null}
        </span>
      ) : (
        <label className="field-label" htmlFor={id}>
          {label}
          {sub ? <> <span className="field-sub">{sub}</span></> : null}
        </label>
      )}

      <Control
        id={id}
        field={field}
        value={value}
        onChange={onChange}
        invalid={!!error}
        errorId={errorId}
        lang={lang}
      />

      {error ? (
        <span className="field-error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

interface ControlProps {
  id: string;
  field: FieldSpec;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  errorId: string | undefined;
  lang: Lang;
}

function Control({ id, field, value, onChange, invalid, errorId, lang }: ControlProps): JSX.Element {
  const th = lang === 'th';
  const shared = {
    id,
    'aria-invalid': invalid || undefined,
    'aria-describedby': errorId,
  };

  switch (field.type) {
    case 'select':
      return (
        <select
          {...shared}
          className={`select${invalid ? ' is-invalid' : ''}${value ? '' : ' is-empty'}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{th ? '— เลือก —' : '— Select —'}</option>
          {field.opts?.map((option) => (
            <option key={option[0]} value={option[0]}>
              {th ? option[1] : option[2]}
            </option>
          ))}
        </select>
      );

    case 'area':
      return (
        <textarea
          {...shared}
          className={`textarea${invalid ? ' is-invalid' : ''}`}
          rows={3}
          value={value}
          placeholder={field.ph}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    case 'chips':
      return (
        <div className="chips" role="group" aria-labelledby={`${id}-label`}>
          {field.opts?.map((option) => {
            const selected = value === option[0];
            return (
              <button
                key={option[0]}
                type="button"
                className="chip"
                aria-pressed={selected}
                // Tapping the chosen chip again clears it.
                onClick={() => onChange(selected ? '' : option[0])}
              >
                {th ? option[1] : option[2]}
              </button>
            );
          })}
        </div>
      );

    case 'combo':
      return (
        <Combo
          {...shared}
          field={field}
          value={value}
          onChange={onChange}
          invalid={invalid}
          lang={lang}
        />
      );

    default:
      return (
        <input
          {...shared}
          className={`input${invalid ? ' is-invalid' : ''}`}
          type={field.type === 'date' ? 'date' : 'text'}
          value={value}
          placeholder={field.ph}
          readOnly={field.ro}
          maxLength={field.maxLength}
          inputMode={field.numeric ? 'numeric' : undefined}
          onChange={(event) => {
            const next = field.numeric
              ? // Paste and IME both get past maxLength, so strip here too.
                event.target.value.replace(/\D/g, '').slice(0, field.maxLength)
              : event.target.value;
            onChange(next);
          }}
        />
      );
  }
}

interface ComboProps {
  id: string;
  field: FieldSpec;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  lang: Lang;
  'aria-invalid'?: true | undefined;
  'aria-describedby'?: string | undefined;
}

/**
 * Enough to scroll through, not so many that the menu becomes the page.
 * The menu caps its own height and scrolls past this.
 */
const MAX_SUGGESTIONS = 60;

/**
 * A box that opens a list and still takes anything typed into it.
 *
 * Tapping it shows what we have — every major, every institution — so it
 * behaves like a dropdown for the common case. But these lists are
 * curated rather than complete, so typing over them is always allowed and
 * what was typed is what gets stored.
 */
function Combo({ id, field, value, onChange, invalid, lang, ...aria }: ComboProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapper = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const query = value.trim().toLowerCase();
    const list = field.list ?? [];
    // An exact match means they have already chosen; show the rest of the
    // list again rather than the one row they are looking at.
    const filtered =
      !query || list.some((item) => item.toLowerCase() === query)
        ? list
        : list.filter((item) => item.toLowerCase().includes(query));
    return filtered.slice(0, MAX_SUGGESTIONS);
  }, [field.list, value]);

  // Clicking anywhere else puts the list away.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const choose = (item: string) => {
    onChange(item);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open || matches.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current) => (current + 1) % matches.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => (current <= 0 ? matches.length - 1 : current - 1));
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      choose(matches[active]!);
    }
  };

  const listId = `${id}-list`;
  const showMenu = open && matches.length > 0;

  return (
    <div className="combo" ref={wrapper}>
      <input
        {...aria}
        id={id}
        className={`input input--combo${invalid ? ' is-invalid' : ''}`}
        type="text"
        role="combobox"
        aria-expanded={showMenu}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        placeholder={field.ph}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />

      {showMenu ? (
        <div className="combo-menu" id={listId} role="listbox">
          {matches.map((item, index) => (
            <button
              key={item}
              type="button"
              role="option"
              aria-selected={index === active}
              className={`combo-item${index === active ? ' is-active' : ''}`}
              onClick={() => choose(item)}
            >
              {item}
            </button>
          ))}
          <div className="combo-note">
            {lang === 'th' ? 'พิมพ์เองได้ถ้าไม่มีในรายการ' : 'Not listed? Just type it in'}
          </div>
        </div>
      ) : null}
    </div>
  );
}
