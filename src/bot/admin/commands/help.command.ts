import type { Context, Telegraf } from 'telegraf';

const HELP_MESSAGE = [
  'VPN Payment Manager',
  '',
  'Доступные команды:',
  '/start - проверить административный доступ',
  '/admin - открыть панель администратора',
  '/help - показать эту справку',
  '/add_user @username Имя | тариф | комментарий - добавить пользователя',
  '/users - показать всех пользователей',
  '/set_price @username тариф - изменить тариф',
  '/set_paid_until @username DD.MM.YYYY|none - исправить дату оплаты',
  '/set_status @username active|paused|disabled - изменить статус',
  '/paid @username сумма способ | комментарий - подтвердить оплату',
  '/history @username - показать историю оплат',
  '/debtors - показать активных должников',
  '/remind - показать ближайшие оплаты и просрочки',
  '/invite @username - создать ссылку подключения пользователя',
  '',
  'Пример:',
  '/add_user @ivan Иван Петров | 300 | Оплата по СБП',
  '/set_price @ivan 400',
  '/set_paid_until @ivan 26.06.2026',
  '/set_status @ivan paused',
  '/paid @ivan 800 sbp | За два месяца',
  '/history @ivan',
  '/debtors',
  '/remind',
  '/invite @ivan',
  '',
  'Бот не принимает денежные переводы: оплаты подтверждаются администратором вручную.',
].join('\n');

export function registerHelpCommand(bot: Telegraf<Context>): void {
  bot.help(async (context) => {
    await context.reply(HELP_MESSAGE);
  });
}
