import type { Context, Telegraf } from 'telegraf';

import type { UsersService } from '../../../modules/users/users.service.js';

export function registerRemindCommand(
  bot: Telegraf<Context>,
  usersService: UsersService,
  daysBefore: number,
): void {
  bot.command('remind', async (context) => {
    await context.reply(await usersService.getRemindersMessage(daysBefore));
  });
}
