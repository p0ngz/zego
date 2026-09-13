import { emptyRepeats, type SubmissionPayload } from '@zego/shared';

/**
 * A complete application, using a real Bangkok post code so the address
 * check against the seeded geography passes. Tests narrow it down to the
 * one thing they are about.
 */
export function validSubmission(overrides: Partial<SubmissionPayload> = {}): SubmissionPayload {
  return {
    lang: 'th',
    certified: true,
    consented: true,
    values: {
      // Step 1
      position1: 'fullstack',
      salary: '45,000',
      firstName: 'สาธิต',
      lastName: 'ใจดี',
      nickname: 'ต้น',
      dob: '1996-04-12',
      sex: 'male',
      nationality: 'thai',
      idCard: '1234567890123',
      marital: 'single',
      military: 'exempted',

      // Step 2 — Lat Krabang, post code 10520
      postcode: '10520',
      province: 'กรุงเทพมหานคร',
      district: 'เขตลาดกระบัง',
      subDistrict: 'ลาดกระบัง',
      addrNo: '99/1',
      tel: '0812345678',
      email: 'sathit@example.com',
      emgName: 'สมหญิง ใจดี',
      emgRelation: 'มารดา',
      emgTel: '0898765432',
      emgSameAddr: 'yes',

      // Step 3
      fatherName: 'สมชาย ใจดี',
      motherName: 'สมหญิง ใจดี',

      // Step 5
      overtime: 'yes',
      upCountry: 'yes',
      jobSource: 'JobsDB',
      disease: 'no',
      appliedBefore: 'no',
      ...overrides.values,
    },
    repeats: {
      ...emptyRepeats(),
      education: [
        {
          level: 'bach',
          institution: 'จุฬาลงกรณ์มหาวิทยาลัย',
          major: 'วิศวกรรมคอมพิวเตอร์',
          from: '2557',
          to: '2561',
        },
      ],
      languages: [{ language: 'ไทย', speaking: 'good', writing: 'good', reading: 'good' }],
      refs: [
        { name: 'อาจารย์ สมศักดิ์', occupation: 'อาจารย์', tel: '0811111111' },
        { name: 'คุณ วิไล', occupation: 'ผู้จัดการ', tel: '0822222222' },
      ],
      ...overrides.repeats,
    },
    ...(overrides.lang ? { lang: overrides.lang } : {}),
  };
}
