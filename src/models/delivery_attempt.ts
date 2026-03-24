import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export type DeliveryAttemptStatus = 'success' | 'failed';

export interface DeliveryAttemptAttributes {
  id: string;
  job_id: string;
  subscriber_id: string;
  status: DeliveryAttemptStatus;
  response_code: number | null;
  attempt_count: number;
  error_detail: string | null;
  created_at: Date;
}

export type DeliveryAttemptCreationAttributes = Optional<
  DeliveryAttemptAttributes,
  'id' | 'created_at' | 'error_detail'
>;

export class DeliveryAttempt extends Model<
  DeliveryAttemptAttributes,
  DeliveryAttemptCreationAttributes
> {
  declare id: string;
  declare job_id: string;
  declare subscriber_id: string;
  declare status: DeliveryAttemptStatus;
  declare response_code: number | null;
  declare attempt_count: number;
  declare error_detail: string | null;
  declare readonly created_at: Date;
}

export function initDeliveryAttempt(sequelize: Sequelize): typeof DeliveryAttempt {
  DeliveryAttempt.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      job_id: { type: DataTypes.UUID, allowNull: false },
      subscriber_id: { type: DataTypes.UUID, allowNull: false },
      status: {
        type: DataTypes.ENUM('success', 'failed'),
        allowNull: false,
      },
      response_code: { type: DataTypes.INTEGER, allowNull: true },
      attempt_count: { type: DataTypes.INTEGER, allowNull: false },
      error_detail: { type: DataTypes.TEXT, allowNull: true },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: 'delivery_attempts',
      underscored: true,
      updatedAt: false,
      createdAt: 'created_at',
    }
  );
  return DeliveryAttempt;
}
