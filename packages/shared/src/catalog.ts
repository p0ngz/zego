import {
  EDUCATION_LEVELS,
  EVER,
  LIVING_ARRANGEMENTS,
  MARITAL_STATUSES,
  MILITARY_STATUSES,
  NATIONALITIES,
  POSITIONS,
  RACES,
  RELIGIONS,
  SEXES,
  SKILL_LEVELS,
  YES_NO,
} from './options.js';
import { institutionsFor, levelHasMajorList } from './types.js';
import type {
  Block,
  FieldSpec,
  FormValues,
  Lang,
  LookupStatus,
  Option,
  PostcodeEntry,
  ReferenceData,
  RepeatRow,
} from './types.js';

export interface CatalogContext {
  lang: Lang;
  values: FormValues;
  /** Post codes already looked up, plus the institution and major lists. */
  reference: ReferenceData;
  /**
   * How each post code lookup went, keyed by the code itself.
   *
   * Keying on the code rather than on which box it was typed into means
   * every address — the applicant's, the emergency contact's, a
   * reference's — reads the same answer for the same code, and a second
   * address reusing one costs nothing.
   */
  lookups?: Record<string, LookupStatus>;
}

/** Prefix a field key so one address layout can serve two addresses. */
export function prefixKey(prefix: string, name: string): string {
  return prefix ? prefix + name.charAt(0).toUpperCase() + name.slice(1) : name;
}

export function postcodeEntry(ctx: CatalogContext, prefix: string): PostcodeEntry | null {
  const code = (ctx.values[prefixKey(prefix, 'postcode')] ?? '').trim();
  return ctx.reference.postcodes[code] ?? null;
}

/** Districts for the entered post code, as options keyed by their Thai name. */
function districtOptions(ctx: CatalogContext, prefix: string): Option[] | null {
  const entry = postcodeEntry(ctx, prefix);
  if (!entry) return null;
  return entry.districts.map((d) => [d.th, d.th, d.en] as const);
}

/** Sub-districts of the chosen district, so the two selects stay in step. */
function subDistrictOptions(ctx: CatalogContext, prefix: string): Option[] | null {
  const entry = postcodeEntry(ctx, prefix);
  if (!entry) return null;
  const chosen = ctx.values[prefixKey(prefix, 'district')] ?? '';
  const district = entry.districts.find((d) => d.th === chosen);
  if (!district) return null;
  return district.subDistricts.map((s) => [s.th, s.th, s.en] as const);
}

/** Age in whole years, or null when the date of birth is missing or absurd. */
export function ageFromDob(dob: string | undefined): number | null {
  if (!dob) return null;
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const months = now.getMonth() - born.getMonth();
  if (months < 0 || (months === 0 && now.getDate() < born.getDate())) age--;
  return age < 0 || age > 120 ? null : age;
}

function ageHint(ctx: CatalogContext): string {
  const age = ageFromDob(ctx.values.dob);
  if (age === null) return '';
  return ctx.lang === 'th' ? `อายุ ${age} ปี` : `${age} yrs old`;
}

/** The address the applicant already gave, written out as one line. */
export function presentAddressText(ctx: CatalogContext): string {
  const t = (th: string, en: string) => (ctx.lang === 'th' ? th : en);
  const v = ctx.values;
  const parts = [
    v.addrNo && t('เลขที่ ', 'No. ') + v.addrNo,
    v.moo && t('หมู่ ', 'Moo ') + v.moo,
    v.road,
    v.subDistrict,
    v.district,
    v.province,
    v.postcode,
  ];
  return (
    parts.filter(Boolean).join(' ') ||
    t('ยังไม่ได้กรอกที่อยู่ปัจจุบัน', 'Present address not filled in yet')
  );
}

/**
 * What the note beside the post code says.
 *
 * This is the only place the lookup reports back, so it has to cover the
 * unhappy paths too. A code that is not a Thai post code, or a lookup
 * that never returned, leaves the province and district as plain boxes —
 * and the note is what tells someone that is now their job rather than a
 * form that has stopped working.
 */
function postcodeHint(
  ctx: CatalogContext,
  code: string,
  entry: PostcodeEntry | null,
): { th: string; en: string } {
  switch (ctx.lookups?.[code]) {
    case 'loading':
      return { th: 'กำลังค้นหา…', en: 'Looking it up…' };
    case 'notfound':
      return {
        th: 'ไม่พบรหัสนี้ กรอกจังหวัดและอำเภอเองได้',
        en: 'No such post code — fill in the province and district yourself',
      };
    case 'error':
      return {
        th: 'ค้นหาไม่ได้ตอนนี้ กรอกจังหวัดและอำเภอเองได้',
        en: 'Could not look it up — fill in the province and district yourself',
      };
    default:
      if (!entry) {
        return {
          th: 'กรอกก่อน เพื่อเลือกเขต/แขวงได้',
          en: 'Enter this first to pick your district',
        };
      }
      // Eight codes span two provinces; the district is what decides.
      if (!entry.singleProvince) {
        return {
          th: 'รหัสนี้มี 2 จังหวัด เลือกอำเภอก่อน',
          en: 'This code covers two provinces — pick your district first',
        };
      }
      return { th: 'เติมจังหวัดให้แล้ว', en: 'Province filled in for you' };
  }
}

/**
 * One address layout, reused for the applicant and for the emergency
 * contact. `when` gates the whole set — the emergency address disappears
 * when it is the same as the applicant's.
 */
function addressFields(ctx: CatalogContext, prefix: string, when?: () => boolean): FieldSpec[] {
  const K = (name: string) => prefixKey(prefix, name);
  const filled = !!postcodeEntry(ctx, prefix);
  const districts = districtOptions(ctx, prefix);
  const subDistricts = subDistrictOptions(ctx, prefix);
  const gate = (f: FieldSpec): FieldSpec => (when ? { ...f, when } : f);
  const code = (ctx.values[K('postcode')] ?? '').trim();
  const hint = postcodeHint(ctx, code, postcodeEntry(ctx, prefix));

  return [
    gate({
      k: K('postcode'),
      th: 'รหัสไปรษณีย์',
      en: 'Post code',
      req: true,
      ph: '10520',
      numeric: true,
      maxLength: 5,
      hintTh: hint.th,
      hintEn: hint.en,
    }),
    gate({ k: K('province'), th: 'จังหวัด', en: 'Province', req: true, ro: filled }),
    gate(
      districts
        ? {
            k: K('district'),
            th: 'อำเภอ / เขต',
            en: 'District (Amphur)',
            type: 'select',
            req: true,
            opts: districts,
          }
        : { k: K('district'), th: 'อำเภอ / เขต', en: 'District (Amphur)', req: true },
    ),
    gate(
      subDistricts
        ? {
            k: K('subDistrict'),
            th: 'ตำบล / แขวง',
            en: 'Sub-district',
            type: 'select',
            req: true,
            opts: subDistricts,
          }
        : { k: K('subDistrict'), th: 'ตำบล / แขวง', en: 'Sub-district', req: true },
    ),
    gate({ k: K('addrNo'), th: 'บ้านเลขที่', en: 'Address no.', req: true }),
    gate({ k: K('moo'), th: 'หมู่ที่', en: 'Moo', opt: true }),
    gate({ k: K('road'), th: 'ถนน', en: 'Road', opt: true }),
  ];
}

/**
 * The same address layout, for a row of a repeat section.
 *
 * A reference's address is not required, so all of it stays out of the
 * way until someone types a post code — one box on screen instead of
 * seven. The rest appear the moment there is something in it, and fill
 * themselves in the same way the applicant's address does.
 *
 * Everything reads from the row rather than from the form's own answers,
 * which is what `fromRow` is for: the fields are built once and rendered
 * against whichever row they land in.
 */
function rowAddressFields(ctx: CatalogContext): FieldSpec[] {
  const t = (th: string, en: string) => (ctx.lang === 'th' ? th : en);

  const codeOf = (row: RepeatRow) => (row.postcode ?? '').trim();
  const entryOf = (row: RepeatRow) => ctx.reference.postcodes[codeOf(row)] ?? null;
  /** Nothing below the post code is worth showing before there is one. */
  const started = (row: RepeatRow) => codeOf(row) !== '';

  return [
    {
      k: 'postcode',
      th: 'รหัสไปรษณีย์',
      en: 'Post code',
      opt: true,
      numeric: true,
      maxLength: 5,
      ph: '10520',
      fromRow: (row) => {
        const hint = postcodeHint(ctx, codeOf(row), entryOf(row));
        return { hintTh: hint.th, hintEn: hint.en };
      },
    },
    {
      k: 'province',
      th: 'จังหวัด',
      en: 'Province',
      fromRow: (row) => ({ hidden: !started(row), ro: !!entryOf(row) }),
    },
    {
      k: 'district',
      th: 'อำเภอ / เขต',
      en: 'District (Amphur)',
      fromRow: (row) => {
        if (!started(row)) return { hidden: true };
        const entry = entryOf(row);
        if (!entry) return {};
        return {
          type: 'select',
          opts: entry.districts.map((d) => [d.th, d.th, d.en] as const),
        };
      },
    },
    {
      k: 'subDistrict',
      th: 'ตำบล / แขวง',
      en: 'Sub-district',
      fromRow: (row) => {
        if (!started(row)) return { hidden: true };
        const district = entryOf(row)?.districts.find((d) => d.th === (row.district ?? ''));
        if (!district) return {};
        return {
          type: 'select',
          opts: district.subDistricts.map((s) => [s.th, s.th, s.en] as const),
        };
      },
    },
    {
      k: 'addrNo',
      th: 'บ้านเลขที่',
      en: 'Address no.',
      fromRow: (row) => ({ hidden: !started(row) }),
    },
    {
      k: 'moo',
      th: 'หมู่ที่',
      en: 'Moo',
      fromRow: (row) => ({ hidden: !started(row) }),
    },
    {
      k: 'road',
      th: 'ถนน',
      en: 'Road',
      ph: t('ชื่อถนน', 'Street name'),
      fromRow: (row) => ({ hidden: !started(row) }),
    },
  ];
}

/**
 * The whole form, mirroring the paper application but regrouped so each
 * step asks for one kind of thing. Rebuilt on every render: fields that
 * depend on an answer — the military question, the district options —
 * read the current values through `ctx`.
 */
export function buildCatalog(ctx: CatalogContext): Block[] {
  const t = (th: string, en: string) => (ctx.lang === 'th' ? th : en);
  const v = ctx.values;

  return [
    /* ---------------- Step 1 · About you ---------------- */
    {
      step: 1,
      th: 'ตำแหน่งที่สมัคร',
      en: 'Position applied for',
      fields: [
        {
          k: 'position1',
          th: 'ตำแหน่งที่สมัคร 1',
          en: 'Position applied for',
          type: 'select',
          req: true,
          opts: POSITIONS,
        },
        {
          k: 'position1Other',
          th: 'ระบุตำแหน่ง',
          en: 'Please specify position',
          req: true,
          when: () => v.position1 === 'other',
        },
        {
          k: 'position2',
          th: 'ตำแหน่งที่สมัคร 2',
          en: 'Second choice',
          type: 'select',
          opt: true,
          opts: POSITIONS,
        },
        {
          k: 'position2Other',
          th: 'ระบุตำแหน่ง',
          en: 'Please specify position',
          req: true,
          when: () => v.position2 === 'other',
        },
        {
          k: 'salary',
          th: 'เงินเดือนที่ต้องการ',
          en: 'Expected salary',
          hintTh: 'บาท / เดือน',
          hintEn: 'Baht / month',
          req: true,
          ph: '25,000',
        },
      ],
    },
    {
      step: 1,
      th: 'ชื่อ-นามสกุล',
      en: 'Your name',
      fields: [
        { k: 'firstName', th: 'ชื่อ', en: 'Name', req: true },
        { k: 'lastName', th: 'นามสกุล', en: 'Surname', req: true },
        { k: 'nickname', th: 'ชื่อเล่น', en: 'Nick name', opt: true },
        {
          k: 'dob',
          th: 'วัน เดือน ปีเกิด',
          en: 'Date of birth',
          type: 'date',
          req: true,
          hintTh: ageHint(ctx),
          hintEn: ageHint(ctx),
        },
        { k: 'sex', th: 'เพศ', en: 'Sex', type: 'chips', req: true, span: '1/-1', opts: SEXES },
      ],
    },
    {
      step: 1,
      th: 'ข้อมูลส่วนตัว',
      en: 'Personal information',
      fields: [
        {
          k: 'nationality',
          th: 'สัญชาติ',
          en: 'Nationality',
          type: 'select',
          req: true,
          opts: NATIONALITIES,
        },
        {
          k: 'nationalityOther',
          th: 'ระบุสัญชาติ',
          en: 'Please specify nationality',
          req: true,
          when: () => v.nationality === 'other',
        },
        { k: 'race', th: 'เชื้อชาติ', en: 'Race', type: 'select', opts: RACES },
        {
          k: 'raceOther',
          th: 'ระบุเชื้อชาติ',
          en: 'Please specify race',
          req: true,
          when: () => v.race === 'other',
        },
        { k: 'religion', th: 'ศาสนา', en: 'Religion', type: 'select', opts: RELIGIONS },
        {
          k: 'religionOther',
          th: 'ระบุศาสนา',
          en: 'Please specify religion',
          req: true,
          when: () => v.religion === 'other',
        },
        {
          k: 'idCard',
          th: 'เลขที่บัตรประชาชน',
          en: 'Identity card no.',
          req: true,
          ph: t('13 หลัก', '13 digits'),
        },
        { k: 'idExpiry', th: 'บัตรหมดอายุ', en: 'Expiration date', type: 'date' },
        { k: 'height', th: 'ส่วนสูง', en: 'Height', hintTh: 'ซม.', hintEn: 'cm' },
        { k: 'weight', th: 'น้ำหนัก', en: 'Weight', hintTh: 'กก.', hintEn: 'kgs' },
        {
          k: 'marital',
          th: 'สถานภาพ',
          en: 'Marital status',
          type: 'chips',
          span: '1/-1',
          req: true,
          opts: MARITAL_STATUSES,
        },
        {
          k: 'military',
          th: 'ภาวะทางทหาร',
          en: 'Military status',
          type: 'chips',
          span: '1/-1',
          when: () => v.sex === 'male',
          opts: MILITARY_STATUSES,
        },
      ],
    },

    /* ---------------- Step 2 · Contact ---------------- */
    {
      step: 2,
      th: 'ที่อยู่ปัจจุบัน',
      en: 'Present address',
      fields: [
        ...addressFields(ctx, ''),
        {
          k: 'living',
          th: 'ลักษณะที่พัก',
          en: 'Living arrangement',
          type: 'chips',
          span: '1/-1',
          opts: LIVING_ARRANGEMENTS,
        },
      ],
    },
    {
      step: 2,
      th: 'ช่องทางติดต่อ',
      en: 'Contact details',
      fields: [
        { k: 'tel', th: 'โทรศัพท์', en: 'Tel.', req: true, ph: '09X XXX XXXX' },
        { k: 'email', th: 'อีเมล', en: 'E-mail', req: true, ph: 'name@email.com' },
        { k: 'lineId', th: 'ไอดีไลน์', en: 'Line ID', opt: true },
        { k: 'facebook', th: 'เฟสบุ๊ค', en: 'Facebook', opt: true },
        { k: 'ig', th: 'ไอจี', en: 'IG / Instagram', opt: true },
      ],
    },
    {
      step: 2,
      th: 'ผู้ติดต่อกรณีฉุกเฉิน',
      en: 'Person to be notified in case of emergency',
      fields: [
        { k: 'emgName', th: 'ชื่อ-นามสกุล', en: 'Name-surname', req: true },
        {
          k: 'emgRelation',
          th: 'เกี่ยวข้องกับผู้สมัคร',
          en: 'Related to the applicant as',
          req: true,
        },
        { k: 'emgTel', th: 'โทร', en: 'Tel.', req: true },
        {
          k: 'emgSameAddr',
          th: 'ใช้ที่อยู่เดียวกับที่อยู่ปัจจุบัน',
          en: 'Same as my present address',
          type: 'check',
          span: '1/-1',
          hintTh: v.emgSameAddr ? presentAddressText(ctx) : '',
          hintEn: v.emgSameAddr ? presentAddressText(ctx) : '',
        },
        ...addressFields(ctx, 'emg', () => !v.emgSameAddr),
      ],
    },

    /* ---------------- Step 3 · Family ---------------- */
    {
      step: 3,
      th: 'บิดา-มารดา',
      en: 'Parents',
      fields: [
        { k: 'fatherName', th: 'บิดา ชื่อ-สกุล', en: "Father's name-surname", req: true },
        { k: 'fatherAge', th: 'อายุ (ปี)', en: 'Age (Yrs.)' },
        { k: 'fatherOcc', th: 'อาชีพ', en: 'Occupation' },
        { k: 'motherName', th: 'มารดา ชื่อ-สกุล', en: "Mother's name-surname", req: true },
        { k: 'motherAge', th: 'อายุ (ปี)', en: 'Age (Yrs.)' },
        { k: 'motherOcc', th: 'อาชีพ', en: 'Occupation' },
      ],
    },
    {
      step: 3,
      th: 'คู่สมรสและบุตร',
      en: 'Spouse and children',
      fields: [
        {
          k: 'spouseName',
          th: 'ชื่อภรรยา / สามี',
          en: 'Name of wife / Husband',
          opt: true,
          when: () =>
            v.marital === 'married' || v.marital === 'widowed' || v.marital === 'separated',
        },
        {
          k: 'spouseWorkplace',
          th: 'สถานที่ทำงาน',
          en: 'Working place',
          opt: true,
          when: () => !!v.spouseName,
        },
        {
          k: 'spousePosition',
          th: 'ตำแหน่ง',
          en: 'Position',
          opt: true,
          when: () => !!v.spouseName,
        },
        { k: 'childrenMale', th: 'บุตรชาย (คน)', en: 'Children · Male', opt: true },
        { k: 'childrenFemale', th: 'บุตรหญิง (คน)', en: 'Children · Female', opt: true },
      ],
    },
    {
      step: 3,
      th: 'พี่น้อง',
      en: 'Members in the family',
      fields: [
        { k: 'membersMale', th: 'พี่น้องชาย (คน)', en: 'Male' },
        { k: 'membersFemale', th: 'พี่น้องหญิง (คน)', en: 'Female' },
        { k: 'childOrder', th: 'เป็นบุตรคนที่', en: "You're the child of the family no." },
      ],
    },
    {
      step: 3,
      rep: 'siblings',
      th: 'รายชื่อพี่น้อง',
      en: 'Brothers and sisters',
      opt: true,
      addTh: '+ เพิ่มพี่น้อง',
      addEn: '+ Add a sibling',
      itemTh: 'พี่น้องคนที่',
      itemEn: 'Sibling',
      emptyTh: 'ยังไม่มีรายชื่อ เพิ่มได้เท่าที่ต้องการ',
      emptyEn: 'Nothing here yet. Add as many as you need.',
      fields: [
        { k: 'name', th: 'ชื่อ-สกุล', en: 'Name', req: true },
        { k: 'age', th: 'อายุ (ปี)', en: 'Age' },
        { k: 'occupation', th: 'อาชีพ', en: 'Occupation' },
      ],
    },

    /* ---------------- Step 4 · Education and work ---------------- */
    {
      step: 4,
      rep: 'education',
      th: 'การศึกษา',
      en: 'Education',
      min: 1,
      addTh: '+ เพิ่มการศึกษา',
      addEn: '+ Add education',
      itemTh: 'การศึกษาที่',
      itemEn: 'Education',
      emptyTh: 'เพิ่มเฉพาะระดับที่คุณจบหรือกำลังศึกษา',
      emptyEn: 'Add only the levels you completed or are studying.',
      fields: [
        {
          k: 'level',
          th: 'ระดับการศึกษา',
          en: 'Educational level',
          type: 'chips',
          span: '1/-1',
          req: true,
          opts: EDUCATION_LEVELS,
        },
        {
          k: 'institution',
          th: 'สถาบันการศึกษา',
          en: 'Institution',
          type: 'combo',
          req: true,
          span: '1/-1',
          list: institutionsFor(ctx.reference, ''),
          ph: t('เลือกหรือพิมพ์ชื่อสถาบัน', 'Pick or type where you studied'),
          /*
           * Follows the level chosen above it: schools for M.6, technical
           * colleges for a Wor.Chor. or Wor.Sor., universities for a
           * degree. The list is curated rather than complete — Thailand
           * has some thirty thousand schools — so typing is still how
           * anyone not on it answers.
           */
          fromRow: (row) => {
            const level = (row.level ?? '').trim();
            const narrowed = institutionsFor(ctx.reference, level);
            if (!level || narrowed.length === ctx.reference.institutions.length) return {};

            return {
              list: narrowed,
              hintTh: `${narrowed.length} แห่งสำหรับระดับนี้ · พิมพ์เองได้ถ้าไม่มี`,
              hintEn: `${narrowed.length} for this level — or type your own`,
            };
          },
        },
        {
          k: 'major',
          th: 'สาขาวิชา',
          en: 'Major',
          type: 'combo',
          req: true,
          span: '1/-1',
          list: ctx.reference.majors,
          ph: t('เลือกหรือพิมพ์สาขาวิชา', 'Pick or type your major'),
          /*
           * Below a degree, this is a plain box.
           *
           * The list is of degree subjects. Offering it to someone who
           * finished at M.6 or took a vocational certificate means
           * scrolling a hundred things none of which is what they
           * studied, so they are better off just writing it.
           */
          fromRow: (row) => {
            const level = (row.level ?? '').trim();
            if (levelHasMajorList(level)) return {};

            return {
              type: 'text',
              list: undefined,
              ph:
                level === 'high'
                  ? t('เช่น วิทย์-คณิต, ศิลป์-ภาษา', 'e.g. Science–Maths')
                  : t('เช่น ช่างยนต์, การบัญชี', 'e.g. Automotive, Accounting'),
            };
          },
        },
        { k: 'from', th: 'ตั้งแต่ปี', en: 'From', req: true, ph: '2559' },
        { k: 'to', th: 'ถึงปี', en: 'To', req: true, ph: '2564' },
      ],
    },
    {
      step: 4,
      rep: 'work',
      th: 'ประวัติการทำงาน',
      en: 'Working experience in chronological order',
      opt: true,
      addTh: '+ เพิ่มประสบการณ์ทำงาน',
      addEn: '+ Add work experience',
      itemTh: 'ที่ทำงานที่',
      itemEn: 'Experience',
      emptyTh: 'ถ้าเป็นนักศึกษาจบใหม่ ข้ามส่วนนี้ได้เลย',
      emptyEn: "If you're a new graduate, you can skip this.",
      fields: [
        { k: 'company', th: 'สถานที่ทำงาน', en: 'Company', req: true },
        { k: 'position', th: 'ตำแหน่งงาน', en: 'Position', req: true },
        { k: 'from', th: 'เริ่ม (ปี)', en: 'From', req: true },
        { k: 'to', th: 'ถึง (ปี)', en: 'To', req: true, ph: t('ปัจจุบัน', 'Present') },
        { k: 'salary', th: 'ค่าจ้าง', en: 'Salary' },
        { k: 'jobDesc', th: 'ลักษณะงาน', en: 'Job description', type: 'area', span: '1/-1' },
        {
          k: 'reason',
          th: 'เหตุที่ออก',
          en: 'Reasons of resignation',
          type: 'area',
          span: '1/-1',
        },
      ],
    },

    /* ---------------- Step 5 · Skills ---------------- */
    {
      step: 5,
      rep: 'languages',
      th: 'ความสามารถทางภาษา',
      en: 'Language ability',
      min: 1,
      addTh: '+ เพิ่มภาษา',
      addEn: '+ Add a language',
      itemTh: 'ภาษาที่',
      itemEn: 'Language',
      emptyTh: 'เช่น ไทย, อังกฤษ, ญี่ปุ่น',
      emptyEn: 'e.g. Thai, English, Japanese',
      fields: [
        {
          k: 'language',
          th: 'ภาษา',
          en: 'Language',
          req: true,
          span: '1/-1',
          ph: t('ไทย', 'Thai'),
        },
        {
          k: 'speaking',
          th: 'พูด',
          en: 'Speaking',
          type: 'chips',
          span: '1/-1',
          req: true,
          opts: SKILL_LEVELS,
        },
        {
          k: 'writing',
          th: 'เขียน',
          en: 'Writing',
          type: 'chips',
          span: '1/-1',
          req: true,
          opts: SKILL_LEVELS,
        },
        {
          k: 'reading',
          th: 'อ่าน',
          en: 'Reading',
          type: 'chips',
          span: '1/-1',
          req: true,
          opts: SKILL_LEVELS,
        },
      ],
    },
    {
      step: 5,
      th: 'ความสามารถพิเศษ',
      en: 'Special ability',
      fields: [
        { k: 'typing', th: 'พิมพ์ดีด', en: 'Typing', type: 'chips', span: '1/-1', opts: YES_NO },
        {
          k: 'typingThai',
          th: 'ไทย (คำ/นาที)',
          en: 'Thai words/minute',
          when: () => v.typing === 'yes',
        },
        {
          k: 'typingEng',
          th: 'อังกฤษ (คำ/นาที)',
          en: 'English words/minute',
          when: () => v.typing === 'yes',
        },
        {
          k: 'computer',
          th: 'คอมพิวเตอร์',
          en: 'Computer',
          type: 'chips',
          span: '1/-1',
          opts: YES_NO,
        },
        {
          k: 'computerDetail',
          th: 'ระบุโปรแกรม / ภาษา',
          en: 'Please mention',
          span: '1/-1',
          when: () => v.computer === 'yes',
        },
        { k: 'driving', th: 'ขับรถยนต์', en: 'Driving', type: 'chips', span: '1/-1', opts: YES_NO },
        {
          k: 'drivingLicense',
          th: 'ใบขับขี่เลขที่',
          en: 'Driving license no.',
          when: () => v.driving === 'yes',
        },
        {
          k: 'officeMachine',
          th: 'เครื่องใช้สำนักงานที่ใช้ได้',
          en: 'Office machine',
          opt: true,
        },
        { k: 'hobbies', th: 'งานอดิเรก', en: 'Hobbies', opt: true },
        { k: 'sport', th: 'กีฬาที่ชอบ', en: 'Favourite sport', opt: true },
        { k: 'specialKnowledge', th: 'ความรู้พิเศษ', en: 'Special knowledge', opt: true },
        { k: 'otherAbility', th: 'อื่นๆ', en: 'Others', opt: true },
      ],
    },
    {
      step: 5,
      th: 'ความพร้อมในการทำงาน',
      en: 'Availability',
      fields: [
        {
          k: 'overtime',
          th: 'ทำงานล่วงเวลาได้หรือไม่',
          en: 'I can work overtime',
          type: 'chips',
          span: '1/-1',
          req: true,
          opts: YES_NO,
        },
        {
          k: 'upCountry',
          th: 'ไปปฏิบัติงานต่างจังหวัดได้หรือไม่',
          en: 'I can work up country',
          type: 'chips',
          span: '1/-1',
          req: true,
          opts: YES_NO,
        },
        {
          k: 'availabilityOther',
          th: 'อื่นๆ ระบุ',
          en: 'Others (please mention)',
          opt: true,
          span: '1/-1',
        },
      ],
    },
    {
      step: 5,
      th: 'ข้อมูลเพิ่มเติม',
      en: 'Additional information',
      fields: [
        {
          k: 'jobSource',
          th: 'ทราบข่าวการรับสมัครจาก',
          en: 'Sources of job information',
          req: true,
          span: '1/-1',
          ph: 'JOB BKK',
        },
        {
          k: 'disease',
          th: 'เคยป่วยหนักหรือเป็นโรคติดต่อร้ายแรงหรือไม่',
          en: 'Have you ever been seriously ill or contracted a contagious disease?',
          type: 'chips',
          span: '1/-1',
          req: true,
          opts: EVER,
        },
        {
          k: 'diseaseDetail',
          th: 'ระบุชื่อโรคและรายละเอียด',
          en: 'If yes, explain fully',
          type: 'area',
          span: '1/-1',
          when: () => v.disease === 'yes',
        },
        {
          k: 'appliedBefore',
          th: 'เคยสมัครงานกับบริษัทนี้มาก่อนหรือไม่',
          en: 'Have you ever applied for employment with us before?',
          type: 'chips',
          span: '1/-1',
          req: true,
          opts: EVER,
        },
        {
          k: 'appliedWhen',
          th: 'เมื่อไร',
          en: 'If yes, when?',
          when: () => v.appliedBefore === 'yes',
          span: '1/-1',
        },
        {
          k: 'relatives',
          th: 'ชื่อญาติ / เพื่อน ที่ทำงานอยู่ในบริษัทนี้',
          en: 'Relatives / friends working with us known to you',
          opt: true,
          span: '1/-1',
        },
      ],
    },
    {
      step: 5,
      rep: 'refs',
      th: 'บุคคลอ้างอิง',
      en: 'References',
      min: 2,
      addTh: '+ เพิ่มบุคคลอ้างอิง',
      addEn: '+ Add a reference',
      itemTh: 'บุคคลอ้างอิงที่',
      itemEn: 'Reference',
      emptyTh: 'ต้องมี 2 คน ที่ไม่ใช่ญาติหรือนายจ้างเดิม',
      emptyEn: 'Two people needed, other than relatives or former employers.',
      fields: [
        { k: 'name', th: 'ชื่อ-สกุล', en: 'Name', req: true },
        { k: 'occupation', th: 'อาชีพ', en: 'Occupation', req: true },
        { k: 'tel', th: 'โทรศัพท์', en: 'Telephone', req: true },
        ...rowAddressFields(ctx),
      ],
    },
    {
      step: 5,
      th: 'อื่นๆ ที่อยากให้เราทราบ',
      en: 'Anything else',
      fields: [
        {
          k: 'furtherInfo',
          th: 'ข้อมูลเพิ่มเติมเกี่ยวกับตัวคุณ',
          en: 'Please provide any further information about yourself which will allow our company to know you better',
          type: 'area',
          span: '1/-1',
          opt: true,
        },
      ],
    },
  ];
}

/** The label shown for the role applied for, including a typed-in "other". */
export function positionLabel(ctx: CatalogContext): string {
  const value = ctx.values.position1;
  if (value === 'other') return ctx.values.position1Other || '-';
  const hit = POSITIONS.find((p) => p[0] === value);
  if (!hit) return '-';
  return ctx.lang === 'th' ? hit[1] : hit[2];
}
