import { Markup } from 'telegraf';

export function userStatusKeyboard(): ReturnType<typeof Markup.keyboard> {
  return Markup.keyboard([['📋 Мой статус', '💳 Оплата']])
    .resize()
    .persistent();
}
