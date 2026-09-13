import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { env, isTest } from './env.js';
import { errorHandler, notFound } from './errors.js';
import { applicationsRouter } from './routes/applications.js';
import { referenceRouter } from './routes/reference.js';

export function createApp(): Express {
  const app = express();

  // Behind a proxy the rate limiter needs the real client IP.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());

  app.use(
    cors({
      origin(origin, callback) {
        // No Origin header: curl, a health probe, a same-origin request.
        if (!origin) return callback(null, true);
        if (env.CORS_ORIGINS.includes(origin)) return callback(null, true);
        callback(new Error(`Origin ${origin} is not allowed`));
      },
    }),
  );

  // An application with long free-text answers is a few tens of kilobytes.
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'zego-api', time: new Date().toISOString() });
  });

  app.use('/api/reference', referenceRouter);

  // The form is public, so submitting is the one thing worth throttling.
  if (!isTest) {
    app.use(
      '/api/applications',
      rateLimit({
        windowMs: 60 * 60 * 1000,
        limit: (req) => (req.method === 'POST' ? env.SUBMIT_RATE_LIMIT : 200),
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: {
          error: 'Too many applications from this address. Try again in an hour.',
        },
      }),
    );
  }

  app.use('/api/applications', applicationsRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
