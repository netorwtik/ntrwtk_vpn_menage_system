import { Markup, type Context, type Telegraf } from 'telegraf';

import type { UserAccessService } from '../../modules/user-access/userAccess.service.js';
import { userStatusKeyboard } from './status.keyboard.js';

export function registerUserStartCommand(
  bot: Telegraf<Context>,
  userAccessService: UserAccessService,
  adminTelegramIds: ReadonlySet<number>,
): void {
  bot.start(async (context) => {
    const token = context.payload.trim();

    if (token.length > 0) {
      const message = await userAccessService.bindUser(token, context.from.id);
      await context.reply(message, userStatusKeyboard());
      return;
    }

    if (adminTelegramIds.has(context.from.id)) {
      await context.reply(
        [
          'Доступ администратора подтвержден.',
          '',
          'Это бот учета подтвержденных оплат VPN.',
          'Откройте панель управления или используйте /help для просмотра команд.',
        ].join('\n'),
        Markup.inlineKeyboard([Markup.button.callback('⚙️ Открыть панель', 'admin_panel')]),
      );
      return;
    }

    await context.reply(
      'Для подключения к VPN-профилю нужна персональная ссылка от администратора.',
    );
  });
}
