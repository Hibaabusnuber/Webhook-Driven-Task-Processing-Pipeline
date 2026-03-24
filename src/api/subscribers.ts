import { Router } from 'express';
import { body, param } from 'express-validator';
import { Pipeline } from '../models/pipeline';
import { Subscriber } from '../models/subscriber';
import { validate } from '../middleware/validate';

const router = Router({ mergeParams: false });

router.post(
  '/:id/subscribers',
  validate([
    param('id').isUUID(),
    body('url').isURL({ require_tld: false }),
  ]),
  async (req, res, next) => {
    try {
      const { id: pipelineId } = req.params as { id: string };
      const pipeline = await Pipeline.findByPk(pipelineId);
      if (!pipeline) {
        res.status(404).json({ error: 'Pipeline not found' });
        return;
      }
      const { url } = req.body as { url: string };
      const sub = await Subscriber.create({ pipeline_id: pipeline.id, url });
      res.status(201).json(sub);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id/subscribers',
  validate([param('id').isUUID()]),
  async (req, res, next) => {
    try {
      const { id: pipelineId } = req.params as { id: string };
      const pipeline = await Pipeline.findByPk(pipelineId);
      if (!pipeline) {
        res.status(404).json({ error: 'Pipeline not found' });
        return;
      }
      // Default paranoid scope: only active subscribers (deleted_at IS NULL).
      const rows = await Subscriber.findAll({
        where: { pipeline_id: pipeline.id },
        order: [['id', 'ASC']],
      });
      res.json(rows);
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:id/subscribers/:subId',
  validate([param('id').isUUID(), param('subId').isUUID()]),
  async (req, res, next) => {
    try {
      const { id: pipelineId } = req.params as { id: string };
      const pipeline = await Pipeline.findByPk(pipelineId);
      if (!pipeline) {
        res.status(404).json({ error: 'Pipeline not found' });
        return;
      }
      const { subId } = req.params as { id: string; subId: string };
      // Active subscriber only; already soft-deleted rows are treated as 404.
      const sub = await Subscriber.findOne({
        where: { id: subId, pipeline_id: pipeline.id },
      });
      if (!sub) {
        res.status(404).json({ error: 'Subscriber not found' });
        return;
      }
      // Soft delete: set deleted_at instead of removing the row (preserves delivery_attempts FK).
      await sub.destroy();
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
