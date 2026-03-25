import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export type ActionType =
  | 'uppercase'
  | 'reverse'
  | 'timestamp'
  | 'keywords'
  | 'hash'
  | 'json_transform';

export interface PipelineAttributes {
  id: string;
  name: string;
  source_id: string;
  action_type: ActionType;
  created_at: Date;
}

export type PipelineCreationAttributes = Optional<
  PipelineAttributes,
  'id' | 'created_at'
>;

export class Pipeline extends Model<PipelineAttributes, PipelineCreationAttributes> {
  declare id: string;
  declare name: string;
  declare source_id: string;
  declare action_type: ActionType;
  declare readonly created_at: Date;
}

export function initPipeline(sequelize: Sequelize): typeof Pipeline {
  Pipeline.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: { type: DataTypes.STRING(255), allowNull: false },
      source_id: {
        type: DataTypes.STRING(128),
        allowNull: false,
        unique: true,
      },
      action_type: {
        type: DataTypes.ENUM(
          'uppercase',
          'reverse',
          'timestamp',
          'keywords',
          'hash',
          'json_transform'
        ),
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: 'pipelines',
      underscored: true,
      updatedAt: false,
      createdAt: 'created_at',
    }
  );
  return Pipeline;
}
