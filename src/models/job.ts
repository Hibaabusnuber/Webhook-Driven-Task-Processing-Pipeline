import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export type JobStatus = 'pending' | 'processing' | 'success' | 'failed';

export interface JobAttributes {
  id: string;
  pipeline_id: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  status: JobStatus;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

export type JobCreationAttributes = Optional<
  JobAttributes,
  'id' | 'result' | 'error_message' | 'created_at' | 'updated_at' | 'status'
>;

export class Job extends Model<JobAttributes, JobCreationAttributes> {
  declare id: string;
  declare pipeline_id: string;
  declare payload: Record<string, unknown>;
  declare result: Record<string, unknown> | null;
  declare status: JobStatus;
  declare error_message: string | null;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

export function initJob(sequelize: Sequelize): typeof Job {
  Job.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      pipeline_id: { type: DataTypes.UUID, allowNull: false },
      payload: { type: DataTypes.JSONB, allowNull: false },
      result: { type: DataTypes.JSONB, allowNull: true },
      status: {
        type: DataTypes.ENUM('pending', 'processing', 'success', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      error_message: { type: DataTypes.TEXT, allowNull: true },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: 'jobs',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );
  return Job;
}
