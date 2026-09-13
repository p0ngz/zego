/** Everything on this form exists in Thai and English, side by side. */
export type Lang = 'th' | 'en';

/** A pickable option: the value we store, then its Thai and English labels. */
export type Option = readonly [value: string, th: string, en: string];

export type FieldType = 'text' | 'date' | 'select' | 'chips' | 'check' | 'area' | 'combo';

export interface FieldSpec {
  /** Key this answer is stored under. */
  k: string;
  th: string;
  en: string;
  /** Defaults to a plain text box. */
  type?: FieldType;
  /** Blocks the step until it is filled in. */
  req?: boolean;
  /** Marked "optional" next to the label, so the rest reads as expected. */
  opt?: boolean;
  ph?: string;
  hintTh?: string;
  hintEn?: string;
  /** Grid placement, e.g. '1/-1' to run the full width. */
  span?: string;
  /** Choices for select and chips. */
  opts?: readonly Option[];
  /** Suggestions for combo, which still accepts anything typed in. */
  list?: readonly string[];
  /** Filled in from the post code, so it is shown but not editable. */
  ro?: boolean;
  /** Caps what can be typed — a post code is five digits, not ten. */
  maxLength?: number;
  /** Digits only, and a numeric keypad on a phone. */
  numeric?: boolean;
  /** Only asked when this holds — military status only if male, and so on. */
  when?: () => boolean;
  /**
   * Overrides worked out from the row this field sits in.
   *
   * Fields inside a repeat section are built once but rendered per row,
   * so a field that depends on a neighbouring answer — which
   * institutions to suggest for the level chosen beside it — cannot know
   * its own list at build time. This is called with the row and merged
   * over the spec, both when rendering and when checking.
   */
  fromRow?: (row: RepeatRow) => Partial<FieldSpec>;
}

/** The spec as it applies to one row of a repeat section. */
export function resolveField(field: FieldSpec, row: RepeatRow): FieldSpec {
  return field.fromRow ? { ...field, ...field.fromRow(row) } : field;
}

/** The five sections a person adds rows to themselves. */
export const REPEAT_KEYS = ['siblings', 'education', 'work', 'languages', 'refs'] as const;

export type RepeatKey = (typeof REPEAT_KEYS)[number];

interface BlockBase {
  step: number;
  th: string;
  en: string;
  fields: FieldSpec[];
}

/** A section of questions asked once. */
export interface FieldsBlock extends BlockBase {
  rep?: undefined;
}

/** A section a person adds as many rows to as they have. */
export interface RepeatBlock extends BlockBase {
  rep: RepeatKey;
  /** Rows needed before the step will pass — references need two. */
  min?: number;
  opt?: boolean;
  addTh: string;
  addEn: string;
  itemTh: string;
  itemEn: string;
  emptyTh: string;
  emptyEn: string;
}

export type Block = FieldsBlock | RepeatBlock;

export function isRepeatBlock(block: Block): block is RepeatBlock {
  return block.rep !== undefined;
}

/** Every answer is held as a string, so an input is never handed undefined. */
export type FormValues = Record<string, string>;

export type RepeatRow = Record<string, string>;

export type RepeatValues = Record<RepeatKey, RepeatRow[]>;

export function emptyRepeats(): RepeatValues {
  return { siblings: [], education: [], work: [], languages: [], refs: [] };
}

/* ------------------------------------------------------------------ *
 * Reference data
 * Post codes, institutions and majors are lists the form looks things
 * up in rather than answers. They live on the server so the sample set
 * here can be swapped for the full Thailand Post table without
 * touching the app.
 * ------------------------------------------------------------------ */

export interface SubDistrict {
  th: string;
  en: string;
}

export interface District {
  th: string;
  en: string;
  /** Carried per district: eight post codes in Thailand cross a border. */
  provinceTh: string;
  provinceEn: string;
  subDistricts: SubDistrict[];
}

export interface PostcodeEntry {
  /**
   * The province, when the code only has one. Blank when it spans two —
   * 83000 covers Mueang Phuket and Ko Yao in Phang Nga, so filling a
   * province in before a district is chosen would guess, and guess wrong
   * for whoever lives on the other side of it.
   */
  provinceTh: string;
  provinceEn: string;
  /** False for the handful of codes that cross a provincial border. */
  singleProvince: boolean;
  districts: District[];
}

/** The province a filled-in address belongs to, or '' while still unknown. */
export function provinceFor(
  entry: PostcodeEntry | null,
  districtTh: string,
  lang: Lang,
): string {
  if (!entry) return '';
  const district = entry.districts.find((d) => d.th === districtTh);
  if (district) return lang === 'th' ? district.provinceTh : district.provinceEn;
  if (!entry.singleProvince) return '';
  return lang === 'th' ? entry.provinceTh : entry.provinceEn;
}

/** What sort of place it is, which is how the list follows the level. */
export type InstitutionKind =
  | 'SCHOOL'
  | 'UNIVERSITY'
  | 'RAJABHAT'
  | 'RAJAMANGALA'
  | 'PRIVATE'
  | 'VOCATIONAL'
  | 'OTHER';

export interface InstitutionEntry {
  name: string;
  kind: InstitutionKind;
}

/**
 * Which kinds of institution each level of education is earned at.
 *
 * Someone who finished at M.6 studied at a school, not a university, and
 * showing them Chulalongkorn is noise. Levels absent from this map — the
 * catch-all "others" — are shown everything.
 */
export const INSTITUTION_KINDS_BY_LEVEL: Record<string, InstitutionKind[]> = {
  high: ['SCHOOL'],
  voc: ['VOCATIONAL'],
  // A Wor.Sor. is also taught at the Rajamangala universities.
  dip: ['VOCATIONAL', 'RAJAMANGALA'],
  bach: ['UNIVERSITY', 'RAJABHAT', 'RAJAMANGALA', 'PRIVATE'],
  post: ['UNIVERSITY', 'RAJABHAT', 'RAJAMANGALA', 'PRIVATE'],
};

/**
 * Levels the list of majors actually applies to.
 *
 * Those majors are degree subjects. A school leaver studied a track, a
 * vocational student studied a trade, and neither is on that list — so
 * for them the field is a box to type in rather than a list to fail to
 * find themselves in.
 */
export const DEGREE_LEVELS = ['bach', 'post'] as const;

export function levelHasMajorList(level: string): boolean {
  const trimmed = level.trim();
  // Nothing chosen yet, or the catch-all "others": no reason to narrow.
  if (!trimmed || !(trimmed in INSTITUTION_KINDS_BY_LEVEL)) return true;
  return (DEGREE_LEVELS as readonly string[]).includes(trimmed);
}

export interface ReferenceData {
  postcodes: Record<string, PostcodeEntry>;
  institutions: InstitutionEntry[];
  majors: string[];
}

export const emptyReference: ReferenceData = {
  postcodes: {},
  institutions: [],
  majors: [],
};

/**
 * The institutions worth suggesting for a level of education.
 *
 * An unrecognised level, or none chosen yet, gets the whole list rather
 * than an empty one — the box should never go blank on someone for not
 * having answered the question above it.
 */
export function institutionsFor(reference: ReferenceData, level: string): string[] {
  const kinds = INSTITUTION_KINDS_BY_LEVEL[level.trim()];
  const entries = kinds
    ? reference.institutions.filter((entry) => kinds.includes(entry.kind))
    : reference.institutions;
  return entries.map((entry) => entry.name);
}

/**
 * How the last post code lookup went, for one address.
 *
 * A lookup is a request, so it can be in flight, come back empty, or not
 * come back at all. The field says which — a form that quietly does
 * nothing is indistinguishable from a broken one.
 */
export type LookupStatus = 'idle' | 'loading' | 'found' | 'notfound' | 'error';

/* ------------------------------------------------------------------ *
 * Steps
 * ------------------------------------------------------------------ */

export interface StepMeta {
  th: string;
  en: string;
  ledeTh: string;
  ledeEn: string;
}

export const STEPS: StepMeta[] = [
  {
    th: 'ข้อมูลผู้สมัคร',
    en: 'About you',
    ledeTh: 'ตำแหน่งที่สนใจ และข้อมูลส่วนตัวพื้นฐาน ช่องที่ระบุว่าไม่บังคับสามารถข้ามได้',
    ledeEn: 'The role you want, plus the basics about you. Anything marked optional can be skipped.',
  },
  {
    th: 'ที่อยู่ / ติดต่อ',
    en: 'Contact',
    ledeTh: 'ที่อยู่ปัจจุบัน ช่องทางติดต่อ และผู้ที่ติดต่อได้กรณีฉุกเฉิน',
    ledeEn: 'Where you live, how to reach you, and who to call in an emergency.',
  },
  {
    th: 'ครอบครัว',
    en: 'Family',
    ledeTh: 'ข้อมูลครอบครัว เพิ่มรายชื่อพี่น้องได้เท่าที่มี',
    ledeEn: 'Your family. Add as many siblings as you have — no blank rows.',
  },
  {
    th: 'การศึกษา / งาน',
    en: 'Education',
    ledeTh: 'เพิ่มเฉพาะการศึกษาและงานที่คุณมีจริง ไม่ต้องกรอกตารางว่าง',
    ledeEn: 'Add only the records you actually have. No empty tables to fill.',
  },
  {
    th: 'ความสามารถ',
    en: 'Skills',
    ledeTh: 'ภาษา ความสามารถพิเศษ ความพร้อมทำงาน และบุคคลอ้างอิง',
    ledeEn: 'Languages, special abilities, availability, and references.',
  },
  {
    th: 'ตรวจสอบ',
    en: 'Review',
    ledeTh: 'ตรวจสอบข้อมูลทั้งหมดอีกครั้ง แก้ไขได้ทุกส่วน ก่อนกดส่งใบสมัคร',
    ledeEn: 'Check everything over. You can jump back to any section before you submit.',
  },
];

/** The last step is the review, where nothing new is asked. */
export const REVIEW_STEP = STEPS.length;
