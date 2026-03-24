import { sequelize } from '../config/db';
import { DeliveryAttempt, initDeliveryAttempt } from './delivery_attempt';
import { initJob, Job } from './job';
import { initPipeline, Pipeline } from './pipeline';
import { initSubscriber, Subscriber } from './subscriber';

initPipeline(sequelize);
initSubscriber(sequelize);
initJob(sequelize);
initDeliveryAttempt(sequelize);

Pipeline.hasMany(Subscriber, {
  foreignKey: 'pipeline_id',
  as: 'subscribers',
  onDelete: 'CASCADE',
  hooks: true,
});
Subscriber.belongsTo(Pipeline, { foreignKey: 'pipeline_id', as: 'pipeline' });

Pipeline.hasMany(Job, {
  foreignKey: 'pipeline_id',
  as: 'jobs',
  onDelete: 'CASCADE',
  hooks: true,
});
Job.belongsTo(Pipeline, { foreignKey: 'pipeline_id', as: 'pipeline' });

Job.hasMany(DeliveryAttempt, {
  foreignKey: 'job_id',
  as: 'deliveryAttempts',
  onDelete: 'CASCADE',
  hooks: true,
});
DeliveryAttempt.belongsTo(Job, { foreignKey: 'job_id', as: 'job' });
DeliveryAttempt.belongsTo(Subscriber, { foreignKey: 'subscriber_id', as: 'subscriber' });

export { sequelize, Pipeline, Subscriber, Job, DeliveryAttempt };

/**
 * Sync schema (used on API/worker startup). Safe for first Docker run.
 * Idempotent column add aligns older volumes with migrations that add `subscribers.deleted_at`.
 */
export async function syncModels(): Promise<void> {
  await sequelize.sync();
  await sequelize.query(
    'ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;'
  );
}
