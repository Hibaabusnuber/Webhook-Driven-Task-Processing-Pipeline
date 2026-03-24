import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  databaseUrl: required('DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/pipeline'),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  queueName: process.env.QUEUE_NAME ?? 'webhook-jobs',
};
