import type { Context, Telegraf } from 'telegraf';

import type { UsersService } from '../../../modules/users/users.service.js';
import { AppError } from '../../../shared/errors/app-error.js';

const COMMAND_EXAMPLE = '/set_status @ivan paused';

export function registerSetStatusCommand(bot: Telegraf<Context>, usersService: UsersService): void {
  bot.command('set_status', async (context) => {
    const parts = context.payload.trim().split(/\s+/);

    if (parts.length !== 2) {
      throw new AppError(`Использование:\n${COMMAND_EXAMPLE}`, 'INVALID_SET_STATUS_COMMAND');
    }

    const [telegramUsername, status] = parts;

    if (telegramUsername === undefined || status === undefined) {
      throw new AppError(`Использование:\n${COMMAND_EXAMPLE}`, 'INVALID_SET_STATUS_COMMAND');
    }

    const user = await usersService.setStatus({ telegramUsername, status });

    await context.reply(usersService.formatUpdatedStatus(user));
  });
}
