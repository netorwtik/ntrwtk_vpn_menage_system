import type { Context, Telegraf } from 'telegraf';

import type { PaymentsService } from '../../../modules/payments/payments.service.js';
import { AppError } from '../../../shared/errors/app-error.js';

const COMMAND_EXAMPLE = '/undo_payment @ivan';

export function registerUndoPaymentCommand(
  bot: Telegraf<Context>,
  paymentsService: PaymentsService,
): void {
  bot.command('undo_payment', async (context) => {
    const parts = context.payload.trim().split(/\s+/);

    if (parts.length !== 1) {
      throw new AppError(`Использование:\n${COMMAND_EXAMPLE}`, 'INVALID_UNDO_PAYMENT_COMMAND');
    }

    const [telegramUsername] = parts;

    if (telegramUsername === undefined) {
      throw new AppError(`Использование:\n${COMMAND_EXAMPLE}`, 'INVALID_UNDO_PAYMENT_COMMAND');
    }

    const result = await paymentsService.undoLastPayment(telegramUsername);

    await context.reply(paymentsService.formatUndoLastPayment(result));
  });
}
