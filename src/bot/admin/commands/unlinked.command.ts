import type { Context, Telegraf } from 'telegraf';

import type { UsersService } from '../../../modules/users/users.service.js';

export function registerUnlinkedCommand(bot: Telegraf<Context>, usersService: UsersService): void {
  bot.command('unlinked', async (context) => {
    await context.reply(await usersService.getUnlinkedUsersMessage());
  });
}
