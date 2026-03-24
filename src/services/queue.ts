import PgBoss from 'pg-boss';
import { config } from '../config/env';
import { logger } from '../logger';

export type ProcessJobMessage = {
  jobId: string;
  pipelineId: string;
  payload: Record<string, unknown>;
};

let boss: PgBoss | null = null;

/**
 * Starts pg-boss against the same Postgres used by Sequelize (queue metadata lives in DB).
 */
export async function startBoss(): Promise<PgBoss> {
  if (boss) {
    return boss;
  }
  const instance = new PgBoss(config.databaseUrl);
  instance.on('error', (err) => {
    logger.error('pg-boss error', { err });
  });
  await instance.start();
  const existingQueue = await instance.getQueue(config.queueName);
  if (!existingQueue) {
    await instance.createQueue(config.queueName);
  }
  boss = instance;
  logger.info('pg-boss started', { queue: config.queueName });
  return boss;
}

export async function stopBoss(): Promise<void> {
  if (boss) {
    await boss.stop({ graceful: true, timeout: 10000 });
    boss = null;
    logger.info('pg-boss stopped');
  }
}

/**
 * Enqueue a job for the worker. API must call this instead of processing inline.
 */
export async function enqueueProcessJob(message: ProcessJobMessage): Promise<string | null> {
  const b = await startBoss();
  const id = await b.send(config.queueName, message, { retryLimit: 2, retryDelay: 5 });
  logger.info('Job enqueued', { bossJobId: id, dbJobId: message.jobId });
  return id;
}

export function getQueueName(): string {
  return config.queueName;
}
