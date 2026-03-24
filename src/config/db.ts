import { Sequelize } from 'sequelize';
import { config } from './env';

/**
 * Shared Sequelize instance. Models attach here; API and worker both use this connection.
 */
export const sequelize = new Sequelize(config.databaseUrl, {
  dialect: 'postgres',
  logging: config.nodeEnv === 'development' ? console.log : false,
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
});

export async function assertDatabaseConnection(): Promise<void> {
  await sequelize.authenticate();
}
