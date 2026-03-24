import express from 'express';
import http from 'http';
import pipelinesRouter from './api/pipelines';
import subscribersRouter from './api/subscribers';
import webhooksRouter from './api/webhooks';
import jobsRouter from './api/jobs';
import { errorHandler, notFoundHandler } from './middleware/errors';
import { assertDatabaseConnection } from './config/db';
import { config } from './config/env';
import { Job } from './models/job';
import { sequelize, syncModels } from './models';
import { startBoss, stopBoss } from './services/queue';
import { logger } from './logger';

export function createApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'api' });
  });

  /** Simple operational counters for dashboards. */
  app.get('/metrics', async (_req, res, next) => {
    try {
      const [pending, processing, success, failed] = await Promise.all([
        Job.count({ where: { status: 'pending' } }),
        Job.count({ where: { status: 'processing' } }),
        Job.count({ where: { status: 'success' } }),
        Job.count({ where: { status: 'failed' } }),
      ]);
      res.json({
        jobs: { pending, processing, success, failed },
      });
    } catch (err) {
      next(err);
    }
  });

  app.use('/pipelines', pipelinesRouter);
  app.use('/pipelines', subscribersRouter);
  app.use('/webhooks', webhooksRouter);
  app.use('/jobs', jobsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

async function bootstrap(): Promise<void> {
  await assertDatabaseConnection();
  await syncModels();
  await startBoss();

  const app = createApp();
  const server = http.createServer(app);
  server.listen(config.port, () => {
    logger.info('API listening', { port: config.port });
  });

  const shutdown = async (signal: string) => {
    logger.info('Shutdown signal', { signal });
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await stopBoss();
    await sequelize.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

if (require.main === module) {
  bootstrap().catch((err) => {
    logger.error('API failed to start', { err });
    process.exit(1);
  });
}
