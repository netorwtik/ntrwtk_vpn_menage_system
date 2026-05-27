import type { Context, Telegraf } from 'telegraf';

import type { PaymentsService } from '../../../modules/payments/payments.service.js';
import { AppError } from '../../../shared/errors/app-error.js';

const COMMAND_EXAMPLE = '/history @ivan';

export function registerHistoryCommand(
  bot: Telegraf<Context>,
  paymentsService: PaymentsService,
): void {
  bot.command('history', async (context) => {
    const parts = context.payload.trim().split(/\s+/);

    if (parts.length !== 1 || parts[0] === '') {
      throw new AppError(`Использование:\n${COMMAND_EXAMPLE}`, 'INVALID_HISTORY_COMMAND');
    }

    const telegramUsername = parts[0];

    if (telegramUsername === undefined) {
      throw new AppError(`Использование:\n${COMMAND_EXAMPLE}`, 'INVALID_HISTORY_COMMAND');
    }

    await context.reply(await paymentsService.getHistory(telegramUsername));
  });
}
