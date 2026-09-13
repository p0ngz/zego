import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { INSTITUTIONS } from './data/institutions.js';
import { MAJORS } from './data/majors.js';

/**
 * Loads the reference tables.
 *
 * Geography comes from thailand-geography-data/thailand-geography-json,
 * a flat row per sub-district. Run `npm run db:geo` to refresh the file.
 * Everything here is idempotent, so reseeding an existing database only
 * adds what is missing.
 */

const prisma = new PrismaClient();

const here = dirname(fileURLToPath(import.meta.url));
const GEOGRAPHY_FILE = resolve(here, '../data/geography.json');

interface GeographyRow {
  provinceCode: number;
  provinceNameEn: string;
  provinceNameTh: string;
  districtCode: number;
  districtNameEn: string;
  districtNameTh: string;
  subdistrictCode: number;
  subdistrictNameEn: string;
  subdistrictNameTh: string;
  postalCode: number;
}

const BANGKOK_PROVINCE_CODE = 10;

/**
 * Bangkok has khet and khwaeng where the rest of the country has amphur
 * and tambon. The source data drops both prefixes; the form shows them,
 * because that is how the address is written on paper.
 */
function districtName(row: GeographyRow): string {
  return row.provinceCode === BANGKOK_PROVINCE_CODE
    ? `เขต${row.districtNameTh}`
    : row.districtNameTh;
}

async function seedGeography(): Promise<void> {
  const raw = await readFile(GEOGRAPHY_FILE, 'utf8').catch(() => null);
  if (!raw) {
    throw new Error(
      `Geography data missing at ${GEOGRAPHY_FILE}\n` +
        'Fetch it with: npm run db:geo --workspace=@zego/api',
    );
  }

  const rows = JSON.parse(raw) as GeographyRow[];
  console.log(`  geography: ${rows.length} sub-districts in source file`);

  const provinces = new Map<number, { code: number; nameTh: string; nameEn: string }>();
  const districts = new Map<
    number,
    { code: number; nameTh: string; nameEn: string; provinceCode: number }
  >();
  const subdistricts = new Map<
    number,
    { code: number; nameTh: string; nameEn: string; postalCode: string; districtCode: number }
  >();

  for (const row of rows) {
    provinces.set(row.provinceCode, {
      code: row.provinceCode,
      nameTh: row.provinceNameTh,
      nameEn: row.provinceNameEn,
    });
    districts.set(row.districtCode, {
      code: row.districtCode,
      nameTh: districtName(row),
      nameEn: row.districtNameEn,
      provinceCode: row.provinceCode,
    });
    // A handful of sub-district codes repeat in the source; last wins.
    subdistricts.set(row.subdistrictCode, {
      code: row.subdistrictCode,
      nameTh: row.subdistrictNameTh,
      nameEn: row.subdistrictNameEn,
      postalCode: String(row.postalCode).padStart(5, '0'),
      districtCode: row.districtCode,
    });
  }

  // Parents first: sub-districts carry a foreign key up the chain.
  await prisma.province.createMany({ data: [...provinces.values()], skipDuplicates: true });
  await prisma.district.createMany({ data: [...districts.values()], skipDuplicates: true });

  const all = [...subdistricts.values()];
  const CHUNK = 1000;
  for (let i = 0; i < all.length; i += CHUNK) {
    await prisma.subdistrict.createMany({ data: all.slice(i, i + CHUNK), skipDuplicates: true });
  }

  console.log(
    `  geography: ${provinces.size} provinces, ${districts.size} districts, ${subdistricts.size} sub-districts`,
  );
}

async function seedInstitutions(): Promise<void> {
  await prisma.institution.createMany({ data: INSTITUTIONS, skipDuplicates: true });
  console.log(`  institutions: ${INSTITUTIONS.length}`);
}

async function seedMajors(): Promise<void> {
  await prisma.major.createMany({ data: MAJORS, skipDuplicates: true });
  console.log(`  majors: ${MAJORS.length}`);
}

async function main(): Promise<void> {
  console.log('Seeding reference data');
  await seedGeography();
  await seedInstitutions();
  await seedMajors();

  const [provinces, subdistricts, institutions, majors, postcodes] = await Promise.all([
    prisma.province.count(),
    prisma.subdistrict.count(),
    prisma.institution.count(),
    prisma.major.count(),
    prisma.subdistrict.findMany({ distinct: ['postalCode'], select: { postalCode: true } }),
  ]);

  console.log(
    `Done — ${provinces} provinces, ${subdistricts} sub-districts across ` +
      `${postcodes.length} post codes, ${institutions} institutions, ${majors} majors.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
