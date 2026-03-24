import { NextFunction, Request, Response } from 'express';
import { logger } from '../logger';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found' });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error('Unhandled error', { err });
  const message = err instanceof Error ? err.message : 'Internal server error';
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error', message });
  }
}
