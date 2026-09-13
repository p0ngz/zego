import {
  buildCatalog,
  emptyRepeats,
  emptyStepErrors,
  errorsForStep,
  errorsForWholeForm,
  positionLabel,
  provinceFor,
  REVIEW_STEP,
  type CatalogContext,
  type FormValues,
  type Lang,
  type LookupStatus,
  type PostcodeEntry,
  type ReferenceData,
  type RepeatKey,
  type RepeatValues,
  type StepErrors,
  type SubmissionReceipt,
} from '@zego/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, fetchLists, fetchPostcode, submitApplication, type ReferenceLists } from './api.js';

const STORAGE_KEY = 'zego.application.v1';

/**
 * Answers kept out of the browser's own storage.
 *
 * These are the categories Thailand's PDPA treats as sensitive personal
 * data. The draft exists so nobody loses half an hour of typing, and it
 * sits unencrypted on whatever machine was used — which may be a shared
 * one. Re-picking three dropdowns and retyping an ID number is a small
 * price for not leaving them behind.
 *
 * They are still sent when the application is submitted, over HTTPS, and
 * the ID number is encrypted before it reaches the database.
 */
const NOT_SAVED_LOCALLY = new Set([
  'idCard',
  'race',
  'raceOther',
  'religion',
  'religionOther',
  'disease',
  'diseaseDetail',
]);

function draftable(values: FormValues): FormValues {
  const out: FormValues = {};
  for (const [key, value] of Object.entries(values)) {
    if (!NOT_SAVED_LOCALLY.has(key)) out[key] = value;
  }
  return out;
}

interface SavedState {
  values: FormValues;
  repeats: RepeatValues;
  step: number;
  lang: Lang;
}

function loadSaved(): SavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedState>;
    return {
      values: parsed.values ?? {},
      repeats: { ...emptyRepeats(), ...(parsed.repeats ?? {}) },
      step: parsed.step ?? 1,
      lang: parsed.lang === 'en' ? 'en' : 'th',
    };
  } catch {
    // Private browsing, cleared storage, a half-written value — start fresh.
    return null;
  }
}

export type SaveState = 'idle' | 'saving' | 'saved';

export interface ApplicationForm {
  lang: Lang;
  setLang: (lang: Lang) => void;
  step: number;
  goToStep: (step: number) => void;
  back: () => void;
  next: () => void;

  values: FormValues;
  repeats: RepeatValues;
  setField: (key: string, value: string) => void;
  setRepeatField: (key: RepeatKey, index: number, field: string, value: string) => void;
  addRepeatRow: (key: RepeatKey) => void;
  removeRepeatRow: (key: RepeatKey, index: number) => void;

  catalogContext: CatalogContext;
  errors: StepErrors;
  showErrors: boolean;

  certified: boolean;
  toggleCertified: () => void;

  saveState: SaveState;
  submitting: boolean;
  submitError: string | null;
  receipt: SubmissionReceipt | null;
  restart: () => void;

  t: (th: string, en: string) => string;
}

const blankState: SavedState = { values: {}, repeats: emptyRepeats(), step: 1, lang: 'th' };

export function useApplicationForm(): ApplicationForm {
  // Read storage once, on the first render, not on every re-render.
  const [restored] = useState<{ state: SavedState; resumed: boolean }>(() => {
    const found = loadSaved();
    return { state: found ?? blankState, resumed: found !== null };
  });

  const [lang, setLangState] = useState<Lang>(restored.state.lang);
  const [step, setStep] = useState(restored.state.step);
  const [values, setValues] = useState<FormValues>(restored.state.values);
  const [repeats, setRepeats] = useState<RepeatValues>(restored.state.repeats);

  const [certified, setCertified] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>(restored.resumed ? 'saved' : 'idle');

  const [lists, setLists] = useState<ReferenceLists>({
    institutions: [],
    majors: [],
  });
  const [postcodes, setPostcodes] = useState<Record<string, PostcodeEntry>>({});
  /** Keyed by address prefix: '' for the applicant, 'emg' for the contact. */
  const [lookups, setLookups] = useState<Record<string, LookupStatus>>({});

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);

  const t = useCallback(
    (th: string, en: string) => (lang === 'th' ? th : en),
    [lang],
  );

  /* -------------------------------------------------------------- *
   * Saving
   * Answers are kept in the browser as they are typed, so closing the
   * tab halfway through an application does not lose it.
   * -------------------------------------------------------------- */

  const saveTimer = useRef<number | undefined>(undefined);
  /**
   * The last thing written, so an effect that re-runs without anything
   * having changed does not re-save. Comparing content rather than
   * counting renders also survives StrictMode's double mount, which
   * otherwise reports "saved just now" on a form nobody has touched.
   */
  const lastWritten = useRef<string | null>(null);

  useEffect(() => {
    const snapshot = JSON.stringify({ values: draftable(values), repeats, step, lang });
    if (lastWritten.current === null) {
      // First pass: record what was loaded without claiming a save.
      lastWritten.current = snapshot;
      return;
    }
    if (snapshot === lastWritten.current) return;
    lastWritten.current = snapshot;

    try {
      localStorage.setItem(STORAGE_KEY, snapshot);
    } catch {
      // Storage full or blocked: the form still works, it just won't resume.
      return;
    }

    setSaveState('saving');
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => setSaveState('saved'), 550);

    return () => window.clearTimeout(saveTimer.current);
  }, [values, repeats, step, lang]);

  /* -------------------------------------------------------------- *
   * Reference lists
   * -------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;
    fetchLists(lang)
      .then((next) => {
        if (!cancelled) setLists(next);
      })
      .catch(() => {
        // The combo boxes accept free text, so losing the suggestions is
        // survivable — the form stays usable offline.
      });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  /**
   * Warms the post code cache for an application picked up again later.
   *
   * Codes are fetched as they are typed, so a restored draft starts with
   * an empty cache: the province and district would be right but would
   * come back as plain text boxes instead of a locked field and a list.
   * This re-fetches what the draft already refers to, and touches no
   * answers — they were restored from storage a moment ago.
   */
  useEffect(() => {
    let cancelled = false;

    for (const key of ['postcode', 'emgPostcode']) {
      const code = (restored.state.values[key] ?? '').trim();
      if (!/^\d{5}$/.test(code)) continue;

      const prefix = key === 'postcode' ? '' : 'emg';
      void fetchPostcode(code)
        .then((entry) => {
          if (cancelled) return;
          if (!entry) {
            setLookups((prev) => ({ ...prev, [prefix]: 'notfound' }));
            return;
          }
          setLookups((prev) => ({ ...prev, [prefix]: 'found' }));
          setPostcodes((prev) => (prev[code] ? prev : { ...prev, [code]: entry }));
        })
        .catch(() => {
          if (!cancelled) setLookups((prev) => ({ ...prev, [prefix]: 'error' }));
        });
    }

    return () => {
      cancelled = true;
    };
  }, [restored]);

  const reference: ReferenceData = useMemo(
    () => ({ postcodes, ...lists }),
    [postcodes, lists],
  );

  const catalogContext: CatalogContext = useMemo(
    () => ({ lang, values, reference, lookups }),
    [lang, values, reference, lookups],
  );

  /* -------------------------------------------------------------- *
   * Answers
   * -------------------------------------------------------------- */

  /**
   * Looks a post code up, then fills the province and drops a district
   * that does not belong to the new code. The lookup is a request now
   * rather than a table in the bundle, so this lands a moment after the
   * fifth digit is typed.
   */
  const applyPostcode = useCallback(
    async (prefix: string, code: string) => {
      setLookups((prev) => ({ ...prev, [prefix]: 'loading' }));

      let entry: PostcodeEntry | null;
      try {
        entry = await fetchPostcode(code);
      } catch {
        // Offline, or the API is not answering. Say so: the province and
        // district stay editable, but only the note explains why.
        setLookups((prev) => ({ ...prev, [prefix]: 'error' }));
        return;
      }

      if (!entry) {
        setLookups((prev) => ({ ...prev, [prefix]: 'notfound' }));
        return;
      }

      setLookups((prev) => ({ ...prev, [prefix]: 'found' }));
      setPostcodes((prev) => (prev[code] ? prev : { ...prev, [code]: entry }));

      const key = (name: string) =>
        prefix ? prefix + name.charAt(0).toUpperCase() + name.slice(1) : name;

      setValues((prev) => {
        // The applicant may have moved on to another code already.
        if ((prev[key('postcode')] ?? '').trim() !== code) return prev;

        const next = { ...prev };
        const district = next[key('district')] ?? '';

        if (district && !entry.districts.some((d) => d.th === district)) {
          next[key('district')] = '';
          next[key('subDistrict')] = '';
        }

        // Blank for a code that crosses a border, until a district says which.
        next[key('province')] = provinceFor(entry, next[key('district')] ?? '', lang);
        return next;
      });
    },
    [lang],
  );

  const setField = useCallback(
    (key: string, value: string) => {
      setValues((prev) => {
        const next = { ...prev, [key]: value };

        // Choosing a different district invalidates the sub-district, and
        // on a border-crossing code it is what settles the province.
        if (/district$/i.test(key) && !/subDistrict$/.test(key)) {
          const prefix = key === 'district' ? '' : key.slice(0, -'District'.length);
          const derived = (name: string) =>
            prefix ? prefix + name.charAt(0).toUpperCase() + name.slice(1) : name;

          next[derived('subDistrict')] = '';

          const entry = postcodes[(next[derived('postcode')] ?? '').trim()] ?? null;
          if (entry && !entry.singleProvince) {
            next[derived('province')] = provinceFor(entry, value, lang);
          }
        }

        /*
         * Editing the post code drops everything it filled in.
         *
         * Province, district and sub-district are all derived from it. Left
         * alone they sit there looking answered while pointing at the old
         * code — which is how an application goes out naming the wrong
         * province. The lookup puts them back a moment later.
         */
        if (/postcode$/i.test(key) && (prev[key] ?? '') !== value) {
          const prefix = key === 'postcode' ? '' : key.slice(0, -'Postcode'.length);
          const derived = (name: string) =>
            prefix ? prefix + name.charAt(0).toUpperCase() + name.slice(1) : name;
          next[derived('province')] = '';
          next[derived('district')] = '';
          next[derived('subDistrict')] = '';
        }

        return next;
      });

      if (/postcode$/i.test(key)) {
        const prefix = key === 'postcode' ? '' : key.slice(0, -'Postcode'.length);
        const code = value.trim();
        if (/^\d{5}$/.test(code)) {
          void applyPostcode(prefix, code);
        } else {
          // Half a code is not a failed lookup; drop whatever the last one said.
          setLookups((prev) => (prev[prefix] ? { ...prev, [prefix]: 'idle' } : prev));
        }
      }
    },
    [applyPostcode, postcodes, lang],
  );

  const setRepeatField = useCallback(
    (key: RepeatKey, index: number, field: string, value: string) => {
      setRepeats((prev) => {
        const rows = prev[key].slice();
        rows[index] = { ...rows[index], [field]: value };
        return { ...prev, [key]: rows };
      });
    },
    [],
  );

  const addRepeatRow = useCallback((key: RepeatKey) => {
    setRepeats((prev) => ({ ...prev, [key]: [...prev[key], {}] }));
  }, []);

  const removeRepeatRow = useCallback((key: RepeatKey, index: number) => {
    setRepeats((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }));
  }, []);

  /* -------------------------------------------------------------- *
   * Moving through the steps
   * -------------------------------------------------------------- */

  const errors = useMemo(
    () => (showErrors ? errorsForStep(catalogContext, repeats, step) : emptyStepErrors()),
    [showErrors, catalogContext, repeats, step],
  );

  const goToStep = useCallback((target: number) => {
    setStep(target);
    setShowErrors(false);
    window.scrollTo({ top: 0 });
  }, []);

  const back = useCallback(() => {
    setStep((current) => {
      if (current <= 1) return current;
      setShowErrors(false);
      window.scrollTo({ top: 0 });
      return current - 1;
    });
  }, []);

  const send = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitApplication({ lang, values, repeats, certified: true });
      setReceipt(result);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Nothing to clean up if storage was never available.
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) {
        setSubmitError(
          t(
            'ส่งไม่สำเร็จ ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่ ข้อมูลที่กรอกไว้ยังอยู่ครบ',
            'Could not send. Check your connection and try again — your answers are still here.',
          ),
        );
      } else if (error instanceof ApiError && error.status === 429) {
        setSubmitError(
          t(
            'ส่งใบสมัครบ่อยเกินไป กรุณารออีกสักครู่แล้วลองใหม่',
            'Too many applications from this connection. Wait a moment and try again.',
          ),
        );
      } else {
        setSubmitError(
          t(
            'ส่งไม่สำเร็จ กรุณาลองใหม่อีกครั้ง ข้อมูลที่กรอกไว้ยังอยู่ครบ',
            'Could not send. Try again — your answers are still here.',
          ),
        );
      }
    } finally {
      setSubmitting(false);
    }
  }, [lang, values, repeats, t]);

  const next = useCallback(() => {
    if (step === REVIEW_STEP) {
      if (!certified) {
        setShowErrors(true);
        return;
      }

      /*
       * Check every step, not just this one.
       *
       * The review step asks nothing, so nothing here would catch a gap
       * left earlier — and there is one real way to arrive with a gap:
       * picking up a draft, which deliberately does not carry the
       * sensitive answers. Without this the server's refusal arrives as
       * "could not send", and the button never starts working.
       */
      const outstanding = errorsForWholeForm(catalogContext, repeats);
      if (outstanding.count > 0) {
        const firstIncomplete = Math.min(...Object.keys(outstanding.steps).map(Number));
        goToStep(firstIncomplete);
        // goToStep clears this; setting it after is what survives.
        setShowErrors(true);
        return;
      }

      void send();
      return;
    }

    const found = errorsForStep(catalogContext, repeats, step);
    if (found.count > 0) {
      setShowErrors(true);
      return;
    }
    goToStep(step + 1);
  }, [step, certified, send, catalogContext, repeats, goToStep]);

  const setLang = useCallback((next: Lang) => setLangState(next), []);

  const toggleCertified = useCallback(() => setCertified((on) => !on), []);

  const restart = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Already gone.
    }
    setValues({});
    setRepeats(emptyRepeats());
    setStep(1);
    setCertified(false);
    setShowErrors(false);
    setReceipt(null);
    setSubmitError(null);
    setSaveState('idle');
    window.scrollTo({ top: 0 });
  }, []);

  return {
    lang,
    setLang,
    step,
    goToStep,
    back,
    next,
    values,
    repeats,
    setField,
    setRepeatField,
    addRepeatRow,
    removeRepeatRow,
    catalogContext,
    errors,
    showErrors,
    certified,
    toggleCertified,
    saveState,
    submitting,
    submitError,
    receipt,
    restart,
    t,
  };
}

/** Re-exported so the review screen and the sent screen agree on wording. */
export { buildCatalog, positionLabel };
