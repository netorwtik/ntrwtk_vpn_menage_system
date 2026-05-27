import type { Context, Telegraf } from 'telegraf';

import type { UserAccessService } from '../../modules/user-access/userAccess.service.js';
import { userStatusKeyboard } from './status.keyboard.js';

async function sendStatus(context: Context, userAccessService: UserAccessService): Promise<void> {
  const telegramId = context.from?.id;

  if (telegramId === undefined) {
    return;
  }

  await context.reply(await userAccessService.getStatusMessage(telegramId), userStatusKeyboard());
}

export function registerUserStatusCommand(
  bot: Telegraf<Context>,
  userAccessService: UserAccessService,
): void {
  bot.command('status', async (context) => {
    await sendStatus(context, userAccessService);
  });

  bot.hears(['📋 Мой статус', 'Мой статус'], async (context) => {
    await sendStatus(context, userAccessService);
  });
}
