/**
 * The API as a Vercel serverless function.
 *
 * Vercel gives every file under this directory a URL and runs it per
 * request, where `npm run dev:api` runs one long-lived process. The app
 * itself is the same object either way — `createApp()` returns an Express
 * handler, which is what a Node function on Vercel is expected to export.
 *
 * `vercel.json` rewrites every /api/* request here, so Express still sees
 * the path it mounted its routes on.
 */
import { createApp } from '../apps/api/src/app.js';

export default createApp();
