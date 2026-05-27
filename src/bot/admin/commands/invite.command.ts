import type { Context, Telegraf } from 'telegraf';

import type { UserAccessService } from '../../../modules/user-access/userAccess.service.js';
import { AppError } from '../../../shared/errors/app-error.js';

const COMMAND_EXAMPLE = '/invite @ivan';

export function registerInviteCommand(
  bot: Telegraf<Context>,
  userAccessService: UserAccessService,
): void {
  bot.command('invite', async (context) => {
    const parts = context.payload.trim().split(/\s+/);

    if (parts.length !== 1 || parts[0] === '') {
      throw new AppError(`Использование:\n${COMMAND_EXAMPLE}`, 'INVALID_INVITE_COMMAND');
    }

    const telegramUsername = parts[0];

    if (telegramUsername === undefined) {
      throw new AppError(`Использование:\n${COMMAND_EXAMPLE}`, 'INVALID_INVITE_COMMAND');
    }

    await context.reply(
      await userAccessService.createInviteLink(
        telegramUsername,
        context.from.id,
        context.botInfo.username,
      ),
    );
  });
}
