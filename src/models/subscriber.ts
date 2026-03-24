import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface SubscriberAttributes {
  id: string;
  pipeline_id: string;
  url: string;
  /** Present when the subscriber was soft-deleted (paranoid). */
  deletedAt?: Date | null;
}

export type SubscriberCreationAttributes = Optional<
  SubscriberAttributes,
  'id' | 'deletedAt'
>;

export class Subscriber extends Model<SubscriberAttributes, SubscriberCreationAttributes> {
  declare id: string;
  declare pipeline_id: string;
  declare url: string;
  declare deletedAt: Date | null;
}

export function initSubscriber(sequelize: Sequelize): typeof Subscriber {
  Subscriber.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      pipeline_id: { type: DataTypes.UUID, allowNull: false },
      url: { type: DataTypes.TEXT, allowNull: false },
    },
    {
      sequelize,
      tableName: 'subscribers',
      underscored: true,
      // Enable timestamp machinery for `deleted_at` only (no created_at / updated_at columns).
      timestamps: true,
      createdAt: false,
      updatedAt: false,
      /**
       * Soft delete (`deleted_at` column): keeps the row so `delivery_attempts.subscriber_id`
       * stays valid; list/delivery queries exclude rows with `deleted_at` set.
       */
      paranoid: true,
    }
  );
  return Subscriber;
}
