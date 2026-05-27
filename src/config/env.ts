import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const logLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
const optionalText = z.preprocess(
  (value) => (typeof value === 'string' && value.trim().length === 0 ? undefined : value),
  z.string().trim().min(1).optional(),
);

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  BOT_TOKEN: z
    .string()
    .trim()
    .regex(/^\d+:[A-Za-z0-9_-]+$/, 'BOT_TOKEN должен содержать действительный токен Telegram'),
  ADMIN_TELEGRAM_IDS: z.string().trim().min(1, 'Укажите хотя бы один Telegram ID администратора'),
  DATABASE_URL: z.url({ protocol: /^postgres(?:ql)?$/ }),
  TZ: z.string().trim().min(1).default('Europe/Moscow'),
  LOG_LEVEL: z.enum(logLevels).default('info'),
  REMIND_DAYS_BEFORE: z.coerce.number().int().nonnegative().default(3),
  INVITE_EXPIRES_HOURS: z.coerce.number().int().positive().max(720).default(168),
  SUPPORT_USERNAME: optionalText,
  PAYMENT_RECIPIENT: optionalText,
  PAYMENT_DETAILS: optionalText,
});

export interface PaymentInfoConfig {
  supportUsername?: string;
  recipient?: string;
  details?: string;
}

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  botToken: string;
  adminTelegramIds: ReadonlySet<number>;
  databaseUrl: string;
  timeZone: string;
  logLevel: (typeof logLevels)[number];
  remindDaysBefore: number;
  inviteExpiresHours: number;
  paymentInfo: PaymentInfoConfig;
}

function parseAdminIds(value: string): ReadonlySet<number> {
  const values = value.split(',').map((id) => id.trim());
  const ids = values.map((id) => Number(id));

  if (
    ids.length === 0 ||
    ids.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
    values.some((id) => id.length === 0)
  ) {
    throw new Error('ADMIN_TELEGRAM_IDS должен содержать числовые Telegram ID через запятую');
  }

  return new Set(ids);
}

function assertTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat('ru-RU', { timeZone }).format();
  } catch {
    throw new Error(`Некорректный часовой пояс TZ: ${timeZone}`);
  }
}

export function loadConfig(): AppConfig {
  const result = environmentSchema.safeParse(process.env);

  if (!result.success) {
    const messages = result.error.issues.map((issue) => issue.message).join('; ');
    throw new Error(`Ошибка конфигурации окружения: ${messages}`);
  }

  const env = result.data;
  const adminTelegramIds = parseAdminIds(env.ADMIN_TELEGRAM_IDS);
  assertTimeZone(env.TZ);
  process.env.TZ = env.TZ;

  return {
    nodeEnv: env.NODE_ENV,
    botToken: env.BOT_TOKEN,
    adminTelegramIds,
    databaseUrl: env.DATABASE_URL,
    timeZone: env.TZ,
    logLevel: env.LOG_LEVEL,
    remindDaysBefore: env.REMIND_DAYS_BEFORE,
    inviteExpiresHours: env.INVITE_EXPIRES_HOURS,
    paymentInfo: {
      ...(env.SUPPORT_USERNAME === undefined ? {} : { supportUsername: env.SUPPORT_USERNAME }),
      ...(env.PAYMENT_RECIPIENT === undefined ? {} : { recipient: env.PAYMENT_RECIPIENT }),
      ...(env.PAYMENT_DETAILS === undefined ? {} : { details: env.PAYMENT_DETAILS }),
    },
  };
}
