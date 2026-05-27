import type { Context, Telegraf } from 'telegraf';

export function registerStartCommand(bot: Telegraf<Context>): void {
  bot.start(async (context) => {
    await context.reply(
      [
        'Доступ администратора подтвержден.',
        '',
        'Это бот учета подтвержденных оплат VPN.',
        'Используйте /help для просмотра доступных команд.',
      ].join('\n'),
    );
  });
}
