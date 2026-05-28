import { createBot, startBot } from './bot/bot.js';
import { loadConfig } from './config/env.js';
import { disconnectDatabase, prisma } from './db/prisma.js';
import { createLogger } from './shared/logger/logger.js';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);
  const { bot, remindersScheduler } = createBot(config, logger);
  let launched = false;
  let stopping = false;

  const shutdown = async (reason: string): Promise<void> => {
    if (stopping) {
      return;
    }

    stopping = true;
    logger.info({ reason }, 'Остановка приложения');
    remindersScheduler?.stop();

    if (launched) {
      try {
        bot.stop(reason);
      } catch (error) {
        logger.debug({ err: error }, 'Polling еще не был запущен при остановке');
      }
    }

    await disconnectDatabase();
    logger.info('Соединение с базой данных закрыто');
  };

  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  try {
    await prisma.$connect();
    logger.info('Подключение к PostgreSQL установлено');

    launched = true;
    await startBot(bot, logger, config.adminTelegramIds, () => remindersScheduler?.start());
  } catch (error) {
    logger.fatal({ err: error }, 'Не удалось запустить приложение');
    await shutdown('startup_error');
    process.exitCode = 1;
  }
}

void bootstrap().catch((error: unknown) => {
  console.error('Не удалось инициализировать приложение:', error);
  process.exitCode = 1;
});
