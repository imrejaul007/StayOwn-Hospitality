import winston from 'winston';
import { config } from '../config/index.js';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;

  if (Object.keys(metadata).length > 0 && metadata.stack) {
    msg += `\n${metadata.stack}`;
  } else if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }

  return msg;
});

const jsonFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  json()
);

const consoleFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  colorize({ all: true }),
  errors({ stack: true }),
  logFormat
);

export const logger = winston.createLogger({
  level: config.logging.level,
  defaultMeta: { service: 'channel-bridge' },
  format: config.logging.format === 'json' ? jsonFormat : consoleFormat,
  transports: [
    new winston.transports.Console()
  ],
  exceptionHandlers: [
    new winston.transports.Console()
  ],
  rejectionHandlers: [
    new winston.transports.Console()
  ]
});

// Create child logger for specific modules
export const createModuleLogger = (module: string) => {
  return logger.child({ module });
};

export default logger;
