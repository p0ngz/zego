import type { InstitutionEntry, InstitutionKind, Lang, PostcodeEntry } from '@zego/shared';
import { prisma } from './prisma.js';

/**
 * The lists behind the form's combo boxes and its post code lookup.
 *
 * Institutions and majors change perhaps once a year, so they are read
 * once and held in memory. Post codes are looked up one at a time: all
 * 956 of them carry roughly 7,400 sub-districts, far too much to hand a
 * phone up front.
 */

interface Lists {
  institutions: InstitutionEntry[];
  majors: string[];
}

const listCache = new Map<Lang, Lists>();
const postcodeCache = new Map<string, PostcodeEntry | null>();

export async function getLists(lang: Lang): Promise<Lists> {
  const cached = listCache.get(lang);
  if (cached) return cached;

  const [institutions, majors] = await Promise.all([
    prisma.institution.findMany({
      // Seeded order: schools, then vocational colleges, then universities.
      orderBy: { id: 'asc' },
      select: { nameTh: true, nameEn: true, kind: true },
    }),
    // Seeded order, not alphabetical: computing majors sit at the top
    // because that is what these roles are.
    prisma.major.findMany({
      orderBy: { id: 'asc' },
      select: { nameTh: true, nameEn: true },
    }),
  ]);

  const pick = (row: { nameTh: string; nameEn: string }) => (lang === 'th' ? row.nameTh : row.nameEn);

  const lists: Lists = {
    // The kind travels with the name: the form uses it to show schools
    // for a school-leaver and universities for a graduate.
    institutions: institutions.map((row) => ({
      name: pick(row),
      kind: row.kind as InstitutionKind,
    })),
    majors: majors.map(pick),
  };

  listCache.set(lang, lists);
  return lists;
}

/**
 * One post code, with every district and sub-district that uses it, in
 * both languages so switching language costs nothing.
 */
export async function getPostcode(code: string): Promise<PostcodeEntry | null> {
  if (!/^\d{5}$/.test(code)) return null;

  const cached = postcodeCache.get(code);
  if (cached !== undefined) return cached;

  const rows = await prisma.subdistrict.findMany({
    where: { postalCode: code },
    orderBy: { code: 'asc' },
    select: {
      nameTh: true,
      nameEn: true,
      district: {
        select: {
          code: true,
          nameTh: true,
          nameEn: true,
          province: { select: { nameTh: true, nameEn: true } },
        },
      },
    },
  });

  if (rows.length === 0) {
    postcodeCache.set(code, null);
    return null;
  }

  // A post code can span several districts, so group rather than assume one.
  const byDistrict = new Map<number, PostcodeEntry['districts'][number]>();
  for (const row of rows) {
    let district = byDistrict.get(row.district.code);
    if (!district) {
      district = {
        th: row.district.nameTh,
        en: row.district.nameEn,
        provinceTh: row.district.province.nameTh,
        provinceEn: row.district.province.nameEn,
        subDistricts: [],
      };
      byDistrict.set(row.district.code, district);
    }
    district.subDistricts.push({ th: row.nameTh, en: row.nameEn });
  }

  const districts = [...byDistrict.values()];
  // Eight codes cross a provincial border. Say so rather than picking one.
  const provinces = new Set(districts.map((d) => d.provinceTh));
  const singleProvince = provinces.size === 1;
  const first = districts[0]!;

  const entry: PostcodeEntry = {
    provinceTh: singleProvince ? first.provinceTh : '',
    provinceEn: singleProvince ? first.provinceEn : '',
    singleProvince,
    districts,
  };

  postcodeCache.set(code, entry);
  return entry;
}

/**
 * Confirms the district and sub-district actually belong to the post code
 * given. The browser fills these from the same table, so a mismatch means
 * the payload was assembled elsewhere.
 */
export async function addressMatchesPostcode(
  code: string,
  districtTh: string,
  subDistrictTh: string,
  provinceTh?: string,
): Promise<boolean> {
  const entry = await getPostcode(code);
  if (!entry) return false;

  const district = entry.districts.find((d) => d.th === districtTh);
  if (!district) return false;

  if (!district.subDistricts.some((s) => s.th === subDistrictTh)) return false;

  // For a code that crosses a border, the district decides the province,
  // so a mismatch here means the two disagree.
  if (provinceTh && provinceTh !== district.provinceTh) return false;

  return true;
}

/** Called by the seed script so a reseed is visible without a restart. */
export function clearReferenceCache(): void {
  listCache.clear();
  postcodeCache.clear();
}
