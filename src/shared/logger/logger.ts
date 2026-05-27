import pino, { type Logger } from 'pino';

import type { AppConfig } from '../../config/env.js';

export function createLogger(config: AppConfig): Logger {
  return pino({
    level: config.logLevel,
    base: {
      service: 'vpn-payment-manager-bot',
      environment: config.nodeEnv,
    },
    redact: {
      paths: ['botToken', 'BOT_TOKEN', 'config.botToken', 'token'],
      censor: '[REDACTED]',
    },
  });
}
