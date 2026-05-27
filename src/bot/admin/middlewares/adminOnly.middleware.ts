import type { Context, MiddlewareFn } from 'telegraf';
import type { Logger } from 'pino';

function isCommandMessage(context: Context): boolean {
  return (
    context.message !== undefined &&
    'text' in context.message &&
    context.message.text.startsWith('/')
  );
}

export function adminOnly(
  adminTelegramIds: ReadonlySet<number>,
  logger: Logger,
): MiddlewareFn<Context> {
  return async (context, next) => {
    const telegramId = context.from?.id;

    if (telegramId !== undefined && adminTelegramIds.has(telegramId)) {
      return next();
    }

    if (isCommandMessage(context)) {
      logger.warn({ telegramId, updateId: context.update.update_id }, 'Отклонена команда без прав');
      await context.reply('Недостаточно прав для выполнения команды.');
    }

    return undefined;
  };
}
