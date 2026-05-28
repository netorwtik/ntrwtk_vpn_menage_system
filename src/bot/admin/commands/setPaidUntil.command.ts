import type { Context, Telegraf } from 'telegraf';

import type { UsersService } from '../../../modules/users/users.service.js';
import { AppError } from '../../../shared/errors/app-error.js';

const COMMAND_EXAMPLE = '/set_paid_until @ivan 26.06.2026';

export function registerSetPaidUntilCommand(
  bot: Telegraf<Context>,
  usersService: UsersService,
): void {
  bot.command('set_paid_until', async (context) => {
    const parts = context.payload.trim().split(/\s+/);

    if (parts.length !== 2) {
      throw new AppError(`Использование:\n${COMMAND_EXAMPLE}`, 'INVALID_SET_PAID_UNTIL_COMMAND');
    }

    const [telegramUsername, paidUntil] = parts;

    if (telegramUsername === undefined || paidUntil === undefined) {
      throw new AppError(`Использование:\n${COMMAND_EXAMPLE}`, 'INVALID_SET_PAID_UNTIL_COMMAND');
    }

    const user = await usersService.setPaidUntil({ telegramUsername, paidUntil });

    await context.reply(usersService.formatUpdatedPaidUntil(user));
  });
}
