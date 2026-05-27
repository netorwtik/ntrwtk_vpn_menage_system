import type { Context, Telegraf } from 'telegraf';

import type { UsersService } from '../../../modules/users/users.service.js';
import { AppError } from '../../../shared/errors/app-error.js';

const COMMAND_EXAMPLE = '/set_price @ivan 400';

export function registerSetPriceCommand(bot: Telegraf<Context>, usersService: UsersService): void {
  bot.command('set_price', async (context) => {
    const parts = context.payload.trim().split(/\s+/);

    if (parts.length !== 2) {
      throw new AppError(`Использование:\n${COMMAND_EXAMPLE}`, 'INVALID_SET_PRICE_COMMAND');
    }

    const [telegramUsername, monthlyPrice] = parts;

    if (telegramUsername === undefined || monthlyPrice === undefined) {
      throw new AppError(`Использование:\n${COMMAND_EXAMPLE}`, 'INVALID_SET_PRICE_COMMAND');
    }

    const user = await usersService.setPrice({ telegramUsername, monthlyPrice });

    await context.reply(usersService.formatUpdatedPrice(user));
  });
}
