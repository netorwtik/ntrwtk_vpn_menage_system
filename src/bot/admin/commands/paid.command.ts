import type { Context, Telegraf } from 'telegraf';

import type {
  ConfirmPaymentRequest,
  PaymentsService,
} from '../../../modules/payments/payments.service.js';
import { AppError } from '../../../shared/errors/app-error.js';

const COMMAND_EXAMPLE = '/paid @ivan 300 sbp | Перевод на карту';

function parsePaidPayload(payload: string, confirmedByTelegramId: number): ConfirmPaymentRequest {
  const [paymentPart, commentPart, ...extraParts] = payload.split('|').map((part) => part.trim());

  if (paymentPart === undefined || extraParts.length > 0) {
    throw new AppError(`Использование:\n${COMMAND_EXAMPLE}`, 'INVALID_PAID_COMMAND');
  }

  const parts = paymentPart.split(/\s+/);

  if (parts.length !== 3) {
    throw new AppError(`Использование:\n${COMMAND_EXAMPLE}`, 'INVALID_PAID_COMMAND');
  }

  const [telegramUsername, amount, paymentMethod] = parts;

  if (telegramUsername === undefined || amount === undefined || paymentMethod === undefined) {
    throw new AppError(`Использование:\n${COMMAND_EXAMPLE}`, 'INVALID_PAID_COMMAND');
  }

  return {
    telegramUsername,
    amount,
    paymentMethod,
    confirmedByTelegramId,
    ...(commentPart === undefined ? {} : { comment: commentPart }),
  };
}

export function registerPaidCommand(
  bot: Telegraf<Context>,
  paymentsService: PaymentsService,
): void {
  bot.command('paid', async (context) => {
    const confirmedByTelegramId = context.from.id;
    const request = parsePaidPayload(context.payload, confirmedByTelegramId);
    const payment = await paymentsService.confirmPayment(request);

    await context.reply(paymentsService.formatConfirmedPayment(payment));
  });
}
