/**
 * The API as a Vercel serverless function.
 *
 * The real thing is `_server.js`, which the build produces by bundling
 * apps/api into one file. That bundling is the point: @zego/shared is
 * consumed as TypeScript source, which Vite and tsx compile on the fly
 * but Node on Vercel cannot run — so it is compiled in here instead,
 * ahead of time, and nothing has to change about working locally.
 *
 * vercel.json rewrites every /api/* request to this file, so Express
 * still sees the paths it mounted its routes on.
 */
import { createApp } from './_server.js';

export default createApp();
