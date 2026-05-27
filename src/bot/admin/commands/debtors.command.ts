import type { Context, Telegraf } from 'telegraf';

import type { UsersService } from '../../../modules/users/users.service.js';

export function registerDebtorsCommand(bot: Telegraf<Context>, usersService: UsersService): void {
  bot.command('debtors', async (context) => {
    await context.reply(await usersService.getDebtorsMessage());
  });
}
