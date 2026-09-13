import { Router } from 'express';
import { z } from 'zod';
import { HttpError, wrap } from '../errors.js';
import { getLists, getPostcode } from '../reference.js';

const langQuery = z.object({ lang: z.enum(['th', 'en']).default('th') });

export const referenceRouter: Router = Router();

/** The institution and major suggestions, in the language being used. */
referenceRouter.get(
  '/',
  wrap(async (req, res) => {
    const { lang } = langQuery.parse(req.query);
    const lists = await getLists(lang);

    // These change about once a year; let a browser hold them for an hour.
    res.set('Cache-Control', 'public, max-age=3600');
    res.json(lists);
  }),
);

/** One post code, with its districts and sub-districts in both languages. */
referenceRouter.get(
  '/postcodes/:code',
  wrap(async (req, res) => {
    const code = z.string().regex(/^\d{5}$/, 'A post code is 5 digits').parse(req.params.code);
    const entry = await getPostcode(code);

    if (!entry) throw new HttpError(404, `No Thai post code ${code}`);

    res.set('Cache-Control', 'public, max-age=86400');
    res.json(entry);
  }),
);
