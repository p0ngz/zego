import type { Option } from './types.js';

export const POSITIONS: readonly Option[] = [
  ['fullstack', 'Fullstack Developer', 'Fullstack Developer'],
  ['frontend', 'Frontend Developer', 'Frontend Developer'],
  ['backend', 'Backend Developer', 'Backend Developer'],
  ['itsupport', 'IT Support', 'IT Support'],
  ['ba', 'Business / System Analyst', 'Business / System Analyst'],
  ['other', 'อื่นๆ', 'Other'],
];

export const SEXES: readonly Option[] = [
  ['male', 'ชาย', 'Male'],
  ['female', 'หญิง', 'Female'],
];

export const NATIONALITIES: readonly Option[] = [
  ['thai', 'ไทย', 'Thai'],
  ['lao', 'ลาว', 'Lao'],
  ['myanmar', 'พม่า', 'Myanmar'],
  ['cambodian', 'กัมพูชา', 'Cambodian'],
  ['vietnamese', 'เวียดนาม', 'Vietnamese'],
  ['chinese', 'จีน', 'Chinese'],
  ['other', 'อื่นๆ', 'Other'],
];

export const RACES: readonly Option[] = [
  ['thai', 'ไทย', 'Thai'],
  ['chinese', 'จีน', 'Chinese'],
  ['lao', 'ลาว', 'Lao'],
  ['myanmar', 'พม่า', 'Myanmar'],
  ['khmer', 'เขมร', 'Khmer'],
  ['other', 'อื่นๆ', 'Other'],
];

export const RELIGIONS: readonly Option[] = [
  ['buddhism', 'พุทธ', 'Buddhism'],
  ['islam', 'อิสลาม', 'Islam'],
  ['christianity', 'คริสต์', 'Christianity'],
  ['hinduism', 'ฮินดู', 'Hinduism'],
  ['sikhism', 'ซิกข์', 'Sikhism'],
  ['none', 'ไม่นับถือศาสนา', 'No religion'],
  ['other', 'อื่นๆ', 'Other'],
];

export const MARITAL_STATUSES: readonly Option[] = [
  ['single', 'โสด', 'Single'],
  ['married', 'แต่งงาน', 'Married'],
  ['widowed', 'หม้าย', 'Widowed'],
  ['separated', 'แยกกัน', 'Separated'],
];

export const MILITARY_STATUSES: readonly Option[] = [
  ['exempted', 'ได้รับการยกเว้น', 'Exempted'],
  ['served', 'ปลดเป็นทหารกองหนุน', 'Served'],
  ['notyet', 'ยังไม่ได้รับการเกณฑ์', 'Not yet served'],
];

export const LIVING_ARRANGEMENTS: readonly Option[] = [
  ['parent', 'อาศัยกับครอบครัว', 'Living with parent'],
  ['own', 'บ้านตัวเอง', 'Own home'],
  ['hired', 'บ้านเช่า', 'Hired house'],
  ['hostel', 'หอพัก', 'Hiredflat / Hostel'],
];

export const EDUCATION_LEVELS: readonly Option[] = [
  ['high', 'มัธยมศึกษาตอนปลาย', 'High school'],
  ['voc', 'ปวช.', 'Vocational'],
  ['dip', 'ปวส. / ปวท.', 'Diploma'],
  ['bach', 'ปริญญาตรี', 'Bachelor degree'],
  ['post', 'สูงกว่าปริญญาตรี', 'Post-Graduate'],
  ['other', 'อื่นๆ', 'Others'],
];

/** Can you / can't you — used for overtime, typing, driving and the rest. */
export const YES_NO: readonly Option[] = [
  ['no', 'ไม่ได้', 'No'],
  ['yes', 'ได้', 'Yes'],
];

/** Have you ever — kept apart from YES_NO because the Thai wording differs. */
export const EVER: readonly Option[] = [
  ['yes', 'เคย', 'Yes'],
  ['no', 'ไม่เคย', 'No'],
];

export const SKILL_LEVELS: readonly Option[] = [
  ['good', 'ดี', 'Good'],
  ['fair', 'ปานกลาง', 'Fair'],
  ['poor', 'พอใช้', 'Poor'],
];

export function optionLabel(opts: readonly Option[] | undefined, value: string, th: boolean): string {
  const hit = opts?.find((o) => o[0] === value);
  if (!hit) return value;
  return th ? hit[1] : hit[2];
}
