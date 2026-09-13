import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { decryptSensitive } from '../src/crypto.js';
import { prisma } from '../src/prisma.js';
import { emptyReference, institutionsFor } from '@zego/shared';
import { validSubmission } from './fixtures.js';

/**
 * These run against the seeded development database — the post code
 * check needs the real geography table, and stubbing it would only test
 * the stub. Every application created here is removed afterwards.
 */

let app: Express;
const created: string[] = [];

beforeAll(() => {
  app = createApp();
});

afterAll(async () => {
  if (created.length > 0) {
    await prisma.application.deleteMany({ where: { reference: { in: created } } });
  }
  await prisma.$disconnect();
});

async function post(body: object) {
  const response = await request(app).post('/api/applications').send(body);
  const reference = (response.body as { reference?: string }).reference;
  if (reference) created.push(reference);
  return response;
}

describe('POST /api/applications', () => {
  it('stores a complete application and returns a reference code', async () => {
    const response = await post(validSubmission());

    expect(response.status).toBe(201);
    expect(response.body.reference).toMatch(/^ZG-[A-Z2-9]{6}$/);
    expect(response.body.email).toBe('sathit@example.com');
    expect(response.body.position).toBe('Fullstack Developer');
  });

  it('refuses an application that skipped a required answer', async () => {
    // The browser blocks this on step 1; the server must not rely on that.
    const payload = validSubmission();
    delete payload.values.firstName;

    const response = await post(payload);

    expect(response.status).toBe(422);
    expect(response.body.error).toMatch(/missing answers/i);
    expect(response.body.details.steps['1'].fields.firstName).toBeTruthy();
  });

  it('refuses an application without the certification', async () => {
    const response = await post({ ...validSubmission(), certified: false });
    expect(response.status).toBe(400);
  });

  it('refuses a district that does not belong to the post code', async () => {
    const payload = validSubmission();
    // A real district, but not one under 10520.
    payload.values.district = 'เขตบางกะปิ';

    const response = await post(payload);

    expect(response.status).toBe(422);
    expect(response.body.error).toMatch(/10520/);
    expect(response.body.details.field).toBe('postcode');
  });

  it('checks the emergency address too when it is a different one', async () => {
    const payload = validSubmission();
    payload.values.emgSameAddr = '';
    payload.values.emgPostcode = '10520';
    payload.values.emgProvince = 'กรุงเทพมหานคร';
    payload.values.emgDistrict = 'เขตลาดกระบัง';
    payload.values.emgSubDistrict = 'หัวหมาก'; // belongs to 10240, not 10520
    payload.values.emgAddrNo = '1';

    const response = await post(payload);

    expect(response.status).toBe(422);
    expect(response.body.error).toMatch(/emergency contact address/i);
  });

  it('accepts a border-crossing post code with the province its district is in', async () => {
    const payload = validSubmission();
    payload.values.postcode = '83000';
    payload.values.province = 'ภูเก็ต';
    payload.values.district = 'เมืองภูเก็ต';
    payload.values.subDistrict = 'ตลาดใหญ่';

    const response = await post(payload);
    expect(response.status).toBe(201);
  });

  it('refuses the other province of a border-crossing post code', async () => {
    const payload = validSubmission();
    payload.values.postcode = '83000';
    // Ko Yao's province, but Mueang Phuket's district.
    payload.values.province = 'พังงา';
    payload.values.district = 'เมืองภูเก็ต';
    payload.values.subDistrict = 'ตลาดใหญ่';

    const response = await post(payload);
    expect(response.status).toBe(422);
    expect(response.body.details.field).toBe('postcode');
  });

  it('validates an ID card number as 13 digits', async () => {
    const payload = validSubmission();
    payload.values.idCard = '123';

    const response = await post(payload);

    expect(response.status).toBe(422);
    expect(response.body.details.steps['1'].fields.idCard).toBeTruthy();
  });

  it('keeps the ID number out of the database in readable form', async () => {
    const response = await post(validSubmission());
    expect(response.status).toBe(201);

    const row = await prisma.application.findUniqueOrThrow({
      where: { reference: response.body.reference },
    });
    const stored = (row.values as Record<string, string>).idCard!;

    // With a key configured the value is an envelope; either way the raw
    // number must round-trip back out.
    expect(decryptSensitive(stored)).toBe('1234567890123');
  });

  it('masks the ID number when an application is read back', async () => {
    const created = await post(validSubmission());
    const response = await request(app).get(`/api/applications/${created.body.reference}`);

    expect(response.status).toBe(200);
    expect(response.body.values.idCard).toMatch(/0123$/);
    expect(response.body.values.idCard).not.toBe('1234567890123');
  });

  it('rejects a body that is not an application at all', async () => {
    const response = await post({ hello: 'world' });
    expect(response.status).toBe(400);
    expect(response.body.issues).toBeInstanceOf(Array);
  });
});

describe('GET /api/reference', () => {
  it('returns the institution and major lists', async () => {
    const response = await request(app).get('/api/reference?lang=th');

    expect(response.status).toBe(200);
    const names = response.body.institutions.map((i: { name: string }) => i.name);
    expect(names).toContain('จุฬาลงกรณ์มหาวิทยาลัย');
    expect(response.body.majors[0]).toBe('วิศวกรรมคอมพิวเตอร์');
  });

  it('answers in English when asked', async () => {
    const response = await request(app).get('/api/reference?lang=en');
    const names = response.body.institutions.map((i: { name: string }) => i.name);
    expect(names).toContain('Chulalongkorn University');
  });

  /*
   * The education step shows a list that follows the level beside it, so
   * each institution has to say what sort of place it is.
   */
  it('says what kind of institution each one is', async () => {
    const response = await request(app).get('/api/reference?lang=th');
    const kinds = new Set(
      response.body.institutions.map((i: { kind: string }) => i.kind),
    );

    expect(kinds).toContain('SCHOOL');
    expect(kinds).toContain('VOCATIONAL');
    expect(kinds).toContain('UNIVERSITY');
  });

  it('offers schools for a school leaver and universities for a graduate', async () => {
    const response = await request(app).get('/api/reference?lang=th');
    const reference = { ...emptyReference, institutions: response.body.institutions };

    const forSchool = institutionsFor(reference, 'high');
    const forDegree = institutionsFor(reference, 'bach');
    const forDiploma = institutionsFor(reference, 'dip');

    expect(forSchool).toContain('โรงเรียนเตรียมอุดมศึกษา');
    expect(forSchool).not.toContain('จุฬาลงกรณ์มหาวิทยาลัย');

    expect(forDegree).toContain('จุฬาลงกรณ์มหาวิทยาลัย');
    expect(forDegree).not.toContain('โรงเรียนเตรียมอุดมศึกษา');

    expect(forDiploma).toContain('วิทยาลัยเทคนิคกรุงเทพ');

    // No level chosen yet: everything, rather than nothing.
    expect(institutionsFor(reference, '')).toHaveLength(response.body.institutions.length);
  });
});

describe('GET /api/reference/postcodes/:code', () => {
  it('returns every district and sub-district under a post code', async () => {
    const response = await request(app).get('/api/reference/postcodes/10520');

    expect(response.status).toBe(200);
    expect(response.body.provinceTh).toBe('กรุงเทพมหานคร');
    expect(response.body.districts[0].th).toBe('เขตลาดกระบัง');
    expect(response.body.districts[0].subDistricts).toHaveLength(6);
  });

  it('groups a post code that spans more than one district', async () => {
    // 10600 covers both Thon Buri and Khlong San.
    const response = await request(app).get('/api/reference/postcodes/10600');
    expect(response.body.districts.length).toBeGreaterThan(1);
  });

  /*
   * Eight Thai post codes cross a provincial border. 83000 is one: most
   * of it is Mueang Phuket, but Ko Yao — islands served by the Phuket
   * post office — is in Phang Nga. Naming one province for the code sends
   * half its applicants out with the wrong one.
   */
  it('carries a province per district, and names none for the code itself', async () => {
    const response = await request(app).get('/api/reference/postcodes/83000');

    expect(response.status).toBe(200);
    expect(response.body.singleProvince).toBe(false);
    expect(response.body.provinceTh).toBe('');

    const provinces = response.body.districts.map((d: { provinceEn: string }) => d.provinceEn);
    expect(provinces).toContain('Phuket');
    expect(provinces).toContain('Phangnga');
  });

  it('names the province directly when a code only has one', async () => {
    const response = await request(app).get('/api/reference/postcodes/50200');
    expect(response.body.singleProvince).toBe(true);
    expect(response.body.provinceEn).toBe('Chiang Mai');
    expect(response.body.districts[0].provinceEn).toBe('Chiang Mai');
  });

  it('is a 404 for a code that is not in use', async () => {
    const response = await request(app).get('/api/reference/postcodes/99999');
    expect(response.status).toBe(404);
  });

  it('rejects something that is not a post code', async () => {
    const response = await request(app).get('/api/reference/postcodes/abcde');
    expect(response.status).toBe(400);
  });
});

describe('GET /api/health', () => {
  it('reports the service is up', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });
});
