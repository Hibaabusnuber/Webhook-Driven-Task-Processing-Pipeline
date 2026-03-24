import { Router } from 'express';
import { param } from 'express-validator';
import { Pipeline } from '../models/pipeline';
import { Job } from '../models/job';
import { validate } from '../middleware/validate';
import { enqueueProcessJob } from '../services/queue';
import { logger } from '../logger';

const router = Router();

router.post(
  '/:source_id',
  validate([param('source_id').isString().trim().isLength({ min: 1, max: 128 })]),
  async (req, res, next) => {
    try {
      const { source_id } = req.params;
      const pipeline = await Pipeline.findOne({ where: { source_id } });
      if (!pipeline) {
        res.status(404).json({ error: 'Unknown webhook source_id or pipeline missing' });
        return;
      }

      const payload =
        req.body && typeof req.body === 'object' && !Array.isArray(req.body)
          ? (req.body as Record<string, unknown>)
          : { data: req.body as unknown };

      const job = await Job.create({
        pipeline_id: pipeline.id,
        payload,
        status: 'pending',
      });

      await enqueueProcessJob({
        jobId: job.id,
        pipelineId: pipeline.id,
        payload,
      });

      logger.info('Webhook accepted; job persisted and queued', {
        source_id,
        jobId: job.id,
      });

      res.status(202).json({
        message: 'Job accepted',
        job_id: job.id,
        status: job.status,
      });
    } catch (err) {
      logger.error('Webhook ingestion failed', { err });
      next(err);
    }
  }
);

export default router;
