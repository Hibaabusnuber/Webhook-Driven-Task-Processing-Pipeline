import { Router } from 'express';
import { body, param } from 'express-validator';
import { Pipeline } from '../models/pipeline';
import { validate } from '../middleware/validate';
import { logger } from '../logger';

const router = Router();

const actionValues = [
  'uppercase',
  'reverse',
  'timestamp',
  'keywords',
  'hash',
  'json_transform',
] as const;

router.post(
  '/',
  validate([
    body('name').isString().trim().isLength({ min: 1, max: 255 }),
    body('source_id').isString().trim().isLength({ min: 1, max: 128 }),
    body('action_type').isIn([...actionValues]),
  ]),
  async (req, res, next) => {
    try {
      const { name, source_id, action_type } = req.body as {
        name: string;
        source_id: string;
        action_type: (typeof actionValues)[number];
      };
      const existing = await Pipeline.findOne({ where: { source_id } });
      if (existing) {
        res.status(409).json({ error: 'source_id already in use' });
        return;
      }
      const pipeline = await Pipeline.create({ name, source_id, action_type });
      res.status(201).json(pipeline);
    } catch (err) {
      logger.error('create pipeline failed', { err });
      next(err);
    }
  }
);

router.get('/', async (_req, res, next) => {
  try {
    const rows = await Pipeline.findAll({ order: [['created_at', 'DESC']] });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get(
  '/:id',
  validate([param('id').isUUID()]),
  async (req, res, next) => {
    try {
      const { id } = req.params as { id: string };
      const row = await Pipeline.findByPk(id);
      if (!row) {
        res.status(404).json({ error: 'Pipeline not found' });
        return;
      }
      res.json(row);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/:id',
  validate([
    param('id').isUUID(),
    body('name').optional().isString().trim().isLength({ min: 1, max: 255 }),
    body('action_type').optional().isIn([...actionValues]),
  ]),
  async (req, res, next) => {
    try {
      const { id } = req.params as { id: string };
      const row = await Pipeline.findByPk(id);
      if (!row) {
        res.status(404).json({ error: 'Pipeline not found' });
        return;
      }
      const { name, action_type } = req.body as { name?: string; action_type?: string };
      if (name !== undefined) row.name = name;
      if (action_type !== undefined)
        row.action_type = action_type as (typeof actionValues)[number];
      await row.save();
      res.json(row);
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:id',
  validate([param('id').isUUID()]),
  async (req, res, next) => {
    try {
      const { id } = req.params as { id: string };
      const row = await Pipeline.findByPk(id);
      if (!row) {
        res.status(404).json({ error: 'Pipeline not found' });
        return;
      }
      await row.destroy();
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
