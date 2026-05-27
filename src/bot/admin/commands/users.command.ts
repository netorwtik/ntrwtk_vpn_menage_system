import type { Context, Telegraf } from 'telegraf';

import type { UsersService } from '../../../modules/users/users.service.js';

export function registerUsersCommand(bot: Telegraf<Context>, usersService: UsersService): void {
  bot.command('users', async (context) => {
    const users = await usersService.listUsers();

    await context.reply(usersService.formatUsersList(users));
  });
}
