import { Router } from 'express';
import { param, query } from 'express-validator';
import { Job } from '../models/job';
import { DeliveryAttempt } from '../models/delivery_attempt';
import { validate } from '../middleware/validate';

const router = Router();

router.get(
  '/',
  validate([query('pipeline_id').optional().isUUID()]),
  async (req, res, next) => {
    try {
      const { pipeline_id } = req.query as { pipeline_id?: string };
      const where = pipeline_id ? { pipeline_id } : {};
      const rows = await Job.findAll({
        where,
        order: [['created_at', 'DESC']],
        limit: 100,
      });
      res.json(rows);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id',
  validate([param('id').isUUID()]),
  async (req, res, next) => {
    try {
      const { id } = req.params as { id: string };
      const job = await Job.findByPk(id);
      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }
      const deliveryAttempts = await DeliveryAttempt.findAll({
        where: { job_id: job.id },
        order: [['created_at', 'ASC']],
      });
      res.json({
        ...job.toJSON(),
        deliveryAttempts,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
