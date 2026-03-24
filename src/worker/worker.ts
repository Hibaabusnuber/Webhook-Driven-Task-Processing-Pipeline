import { assertDatabaseConnection } from '../config/db';
import { logger } from '../logger';
import { Job } from '../models/job';
import { Pipeline } from '../models/pipeline';
import { Subscriber } from '../models/subscriber';
import { sequelize, syncModels } from '../models';
import { deliverWithRetries } from '../services/delivery';
import { processPayload } from '../services/processor';
import { getQueueName, ProcessJobMessage, startBoss } from '../services/queue';

/**
 * Applies the pipeline action and fans out deliveries. DB is the source of truth for payload/result.
 * Exported for integration tests (the runtime worker uses the same function via pg-boss).
 */
export async function processQueueJob(message: ProcessJobMessage): Promise<void> {
  const job = await Job.findByPk(message.jobId);
  if (!job) {
    logger.error('Queued job has no matching DB row; nothing to process', {
      jobId: message.jobId,
    });
    return;
  }

  if (job.status === 'success') {
    logger.info('Job already completed; acknowledging duplicate queue delivery', {
      jobId: job.id,
    });
    return;
  }

  if (message.pipelineId !== job.pipeline_id) {
    await job.update({
      status: 'failed',
      error_message: 'Queued pipeline_id does not match job record',
    });
    logger.error('Queue/database mismatch for job', {
      jobId: job.id,
      queuedPipelineId: message.pipelineId,
      jobPipelineId: job.pipeline_id,
    });
    return;
  }

  const pipeline = await Pipeline.findByPk(job.pipeline_id);
  if (!pipeline) {
    await job.update({
      status: 'failed',
      error_message: 'Pipeline no longer exists',
    });
    return;
  }

  await job.update({ status: 'processing', error_message: null });

  const payload = job.payload;

  try {
    const result = processPayload(pipeline.action_type, payload) as Record<string, unknown>;
    await job.update({ result, status: 'success' });

    // Paranoid default scope excludes soft-deleted subscribers (deleted_at NOT NULL).
    const subscribers = await Subscriber.findAll({
      where: { pipeline_id: pipeline.id },
    });

    const deliveryBody = {
      job_id: job.id,
      pipeline_id: pipeline.id,
      result,
      status: 'success' as const,
    };

    await Promise.all(
      subscribers.map((sub) =>
        deliverWithRetries(job.id, sub.id, sub.url, deliveryBody)
      )
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Processing failed', { jobId: job.id, err });
    await job.update({
      status: 'failed',
      error_message: msg,
    });
  }
}

export async function startWorkerProcess(): Promise<void> {
  await assertDatabaseConnection();
  await syncModels();
  const boss = await startBoss();
  const queue = getQueueName();

  await boss.work(queue, async (jobs) => {
    for (const qJob of jobs) {
      const data = qJob.data as ProcessJobMessage;
      try {
        await processQueueJob(data);
      } catch (err) {
        logger.error('Unhandled worker failure; pg-boss may retry', {
          err,
          jobId: data?.jobId,
        });
        throw err;
      }
    }
  });

  logger.info('Worker consuming queue', { queue });
}

if (require.main === module) {
  startWorkerProcess().catch((err) => {
    logger.error('Worker bootstrap failed', { err });
    void sequelize.close().finally(() => process.exit(1));
  });
}
