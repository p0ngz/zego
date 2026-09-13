import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { isProduction } from './env.js';

/** An error we chose to raise, with a status and a body worth showing. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    override readonly message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFound: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, `No route for ${req.method} ${req.path}`));
};

/**
 * The single place a response is written for a failure. Unexpected errors
 * are logged in full and answered with a flat message — stack traces and
 * database strings never reach the client in production.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'That request did not match what this endpoint accepts',
      issues: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: err.message,
      ...(err.details === undefined ? {} : { details: err.details }),
    });
    return;
  }

  console.error('[zego] unhandled error:', err);
  res.status(500).json({
    error: 'Something went wrong on our side. Try again in a moment.',
    ...(isProduction ? {} : { detail: err instanceof Error ? err.message : String(err) }),
  });
};

/** Lets an async handler reject without taking the process down. */
export function wrap<T extends RequestHandler>(handler: T): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
