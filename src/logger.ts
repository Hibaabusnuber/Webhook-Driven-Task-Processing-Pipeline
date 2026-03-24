import winston from 'winston';
import { config } from './config/env';

export const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'webhook-pipeline' },
  transports: [new winston.transports.Console()],
});
