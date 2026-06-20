import { Markup, type Context, type Telegraf } from 'telegraf';

import type { PaymentClaimsService } from '../../../modules/payment-claims/paymentClaims.service.js';
import type { PaymentsService } from '../../../modules/payments/payments.service.js';
import type { RemindersService } from '../../../modules/reminders/reminders.service.js';
import type { UserAccessService } from '../../../modules/user-access/userAccess.service.js';
import type { UsersService } from '../../../modules/users/users.service.js';
import { formatMoney } from '../../../shared/money/money.utils.js';

const PANEL_ACTION = 'admin_panel';
const CLAIMS_ACTION = 'admin_claims';
const DEBTORS_ACTION = 'admin_debtors';
const REMINDERS_ACTION = 'admin_reminders';
const MANUAL_REMINDERS_ACTION = 'admin_manual_reminders';
const USERS_ACTION = 'admin_users';
const ADD_USER_ACTION = 'admin_add_user';
const CLAIM_ACTION = /^admin_claim:([0-9a-f-]{36})$/;
const MANUAL_REMINDER_USER_ACTION = /^admin_notify_user:([0-9a-f-]{36})$/;
const USER_CARD_ACTION = /^u:([0-9a-f-]{36})$/;
const USER_HISTORY_ACTION = /^uh:([0-9a-f-]{36})$/;
const USER_INVITE_ACTION = /^ui:([0-9a-f-]{36})$/;
const USER_NOTIFY_ACTION = /^un:([0-9a-f-]{36})$/;
const USER_PAID_UNTIL_ACTION = /^up:([0-9a-f-]{36})$/;
const USER_PAID_UNTIL_ADJUST_ACTION = /^upa:([0-9a-f-]{36}):(p1m|m1m|p7d|m7d|none)$/;
const USER_PAID_UNTIL_INPUT_ACTION = /^upd:([0-9a-f-]{36})$/;
const USER_DELETE_CONFIRM_ACTION = /^udq:([0-9a-f-]{36})$/;
const USER_DELETE_ACTION = /^udc:([0-9a-f-]{36})$/;

const paidUntilInputState = new Map<number, { userId: string }>();
type AddUserStep = 'name' | 'username' | 'price' | 'comment';
const addUserState = new Map<
  number,
  {
    step: AddUserStep;
    draft: {
      name?: string;
      telegramUsername?: string;
      monthlyPrice?: string;
    };
  }
>();

function clearAdminInputState(adminId: number): void {
  paidUntilInputState.delete(adminId);
  addUserState.delete(adminId);
}

function panelKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🧾 Заявки на оплату', CLAIMS_ACTION)],
    [
      Markup.button.callback('⚠️ Должники', DEBTORS_ACTION),
      Markup.button.callback('⏰ Скоро платить', REMINDERS_ACTION),
    ],
    [Markup.button.callback('👥 Пользователи', USERS_ACTION)],
  ]);
}

function backKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад в панель', PANEL_ACTION)]]);
}

function userCardKeyboard(userId: string): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('📜 История', `uh:${userId}`),
      Markup.button.callback('💳 Оплата', `up:${userId}`),
    ],
    [
      Markup.button.callback('🔗 Invite', `ui:${userId}`),
      Markup.button.callback('🔔', `un:${userId}`),
    ],
    [Markup.button.callback('🗑 Удалить пользователя', `udq:${userId}`)],
    [Markup.button.callback('⬅️ Назад к пользователям', USERS_ACTION)],
  ]);
}

function paidUntilKeyboard(userId: string): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('-1 месяц', `upa:${userId}:m1m`),
      Markup.button.callback('+1 месяц', `upa:${userId}:p1m`),
    ],
    [
      Markup.button.callback('-7 дней', `upa:${userId}:m7d`),
      Markup.button.callback('+7 дней', `upa:${userId}:p7d`),
    ],
    [
      Markup.button.callback('📅 Ввести дату', `upd:${userId}`),
      Markup.button.callback('🧹 Сбросить', `upa:${userId}:none`),
    ],
    [Markup.button.callback('⬅️ Назад к карточке', `u:${userId}`)],
  ]);
}

async function getPanelMessage(
  usersService: UsersService,
  paymentClaimsService: PaymentClaimsService,
  daysBefore: number,
): Promise<string> {
  const [stats, claims] = await Promise.all([
    usersService.getAdminDashboardStats(daysBefore),
    paymentClaimsService.listPending(),
  ]);

  return [
    '⚙️ Панель администратора',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '📊 Сводка',
    `• Пользователей: ${stats.usersCount}`,
    `• Активных: ${stats.activeUsersCount}`,
    `• Должников: ${stats.debtorsCount}`,
    `• Скоро платить: ${stats.upcomingPaymentsCount}`,
    `• Заявок на подтверждение: ${claims.length}`,
    '',
    'Выберите раздел ниже.',
  ].join('\n');
}

async function sendPanel(
  context: Context,
  usersService: UsersService,
  paymentClaimsService: PaymentClaimsService,
  daysBefore: number,
): Promise<void> {
  await context.reply(
    await getPanelMessage(usersService, paymentClaimsService, daysBefore),
    panelKeyboard(),
  );
}

async function editPanel(
  context: Context,
  usersService: UsersService,
  paymentClaimsService: PaymentClaimsService,
  daysBefore: number,
): Promise<void> {
  await context.editMessageText(
    await getPanelMessage(usersService, paymentClaimsService, daysBefore),
    panelKeyboard(),
  );
}

export function registerAdminPanelCommand(
  bot: Telegraf<Context>,
  usersService: UsersService,
  paymentClaimsService: PaymentClaimsService,
  paymentsService: PaymentsService,
  userAccessService: UserAccessService,
  remindersService: RemindersService,
  daysBefore: number,
): void {
  bot.on('text', async (context, next) => {
    const state = paidUntilInputState.get(context.from.id);

    if (state !== undefined) {
      const text = context.message.text.trim();

      if (text.startsWith('/')) {
        paidUntilInputState.delete(context.from.id);
        await next();
        return;
      }

      const user = await usersService.setPaidUntilByUserId(state.userId, text);
      paidUntilInputState.delete(context.from.id);
      await context.reply(
        usersService.formatUpdatedPaidUntil(user),
        userCardKeyboard(state.userId),
      );
      return;
    }

    const addState = addUserState.get(context.from.id);

    if (addState === undefined) {
      await next();
      return;
    }

    const text = context.message.text.trim();

    if (text.startsWith('/')) {
      addUserState.delete(context.from.id);
      await next();
      return;
    }

    switch (addState.step) {
      case 'name':
        addUserState.set(context.from.id, {
          step: 'username',
          draft: { ...addState.draft, name: text },
        });
        await context.reply('Введите Telegram username пользователя. Пример: @ivan');
        return;
      case 'username':
        addUserState.set(context.from.id, {
          step: 'price',
          draft: { ...addState.draft, telegramUsername: text },
        });
        await context.reply('Введите месячный тариф в рублях. Пример: 300');
        return;
      case 'price':
        addUserState.set(context.from.id, {
          step: 'comment',
          draft: { ...addState.draft, monthlyPrice: text },
        });
        await context.reply('Введите комментарий или отправьте "-" чтобы пропустить.');
        return;
      case 'comment': {
        if (
          addState.draft.name === undefined ||
          addState.draft.telegramUsername === undefined ||
          addState.draft.monthlyPrice === undefined
        ) {
          addUserState.delete(context.from.id);
          await context.reply('Черновик пользователя неполный. Начните добавление заново.');
          return;
        }

        const user = await usersService.addUser({
          name: addState.draft.name,
          telegramUsername: addState.draft.telegramUsername,
          monthlyPrice: addState.draft.monthlyPrice,
          ...(text === '-' ? {} : { comment: text }),
        });
        addUserState.delete(context.from.id);
        await context.reply(usersService.formatCreatedUser(user), userCardKeyboard(user.id));
        return;
      }
    }
  });

  bot.command('admin', async (context) => {
    clearAdminInputState(context.from.id);
    await sendPanel(context, usersService, paymentClaimsService, daysBefore);
  });

  bot.action(PANEL_ACTION, async (context) => {
    clearAdminInputState(context.from.id);
    await context.answerCbQuery();
    await editPanel(context, usersService, paymentClaimsService, daysBefore);
  });

  bot.action(CLAIMS_ACTION, async (context) => {
    clearAdminInputState(context.from.id);
    const claims = await paymentClaimsService.listPending();
    await context.answerCbQuery();

    if (claims.length === 0) {
      await context.editMessageText(
        ['✅ Заявки на оплату', '━━━━━━━━━━━━━━━━━━━━', '', 'Ожидающих заявок нет.'].join('\n'),
        backKeyboard(),
      );
      return;
    }

    const buttons = claims
      .slice(0, 20)
      .map((claim) => [
        Markup.button.callback(
          `${claim.user.name}: ${formatMoney(claim.amount)}`,
          `admin_claim:${claim.id}`,
        ),
      ]);

    buttons.push([Markup.button.callback('⬅️ Назад в панель', PANEL_ACTION)]);

    await context.editMessageText(
      [
        `🧾 Заявки на оплату`,
        '━━━━━━━━━━━━━━━━━━━━',
        '',
        `Всего ожидает: ${claims.length}`,
        '',
        'Выберите заявку для проверки.',
        ...(claims.length > 20 ? ['', 'Показаны первые 20 заявок.'] : []),
      ].join('\n'),
      Markup.inlineKeyboard(buttons),
    );
  });

  bot.action(CLAIM_ACTION, async (context) => {
    const claimId = context.match[1];

    if (claimId === undefined) {
      return;
    }

    const claim = await paymentClaimsService.getPendingById(claimId);
    await context.answerCbQuery();
    await context.editMessageText(
      paymentClaimsService.formatPendingClaim(claim),
      Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Подтвердить оплату', `claim_confirm:${claim.id}`),
          Markup.button.callback('❌ Отклонить', `claim_reject:${claim.id}`),
        ],
        [Markup.button.callback('⬅️ Назад к заявкам', CLAIMS_ACTION)],
      ]),
    );
  });

  bot.action(DEBTORS_ACTION, async (context) => {
    clearAdminInputState(context.from.id);
    await context.answerCbQuery();
    await context.editMessageText(await usersService.getDebtorsMessage(), backKeyboard());
  });

  bot.action(REMINDERS_ACTION, async (context) => {
    clearAdminInputState(context.from.id);
    await context.answerCbQuery();
    await context.editMessageText(
      await usersService.getRemindersMessage(daysBefore),
      backKeyboard(),
    );
  });

  bot.action(USERS_ACTION, async (context) => {
    clearAdminInputState(context.from.id);
    const users = await usersService.listUsers();
    await context.answerCbQuery();

    if (users.length === 0) {
      await context.editMessageText(usersService.formatUsersList(users), backKeyboard());
      return;
    }

    const userButtons = users
      .slice(0, 40)
      .map((user) => [
        Markup.button.callback(
          `${user.name} ${user.telegramUsername ?? ''}`.trim(),
          `u:${user.id}`,
        ),
      ]);

    await context.editMessageText(
      usersService.formatUsersList(users),
      Markup.inlineKeyboard([
        ...userButtons,
        [Markup.button.callback('➕ Добавить', ADD_USER_ACTION)],
        [Markup.button.callback('🔔', MANUAL_REMINDERS_ACTION)],
        [Markup.button.callback('⬅️ Назад в панель', PANEL_ACTION)],
      ]),
    );
  });

  bot.action(MANUAL_REMINDERS_ACTION, async (context) => {
    clearAdminInputState(context.from.id);
    const users = await remindersService.listManualReminderUsers();
    await context.answerCbQuery();

    if (users.length === 0) {
      await context.editMessageText('Пользователей пока нет.', backKeyboard());
      return;
    }

    const buttons = users
      .slice(0, 40)
      .map((user) => [
        Markup.button.callback(
          remindersService.formatManualReminderButton(user),
          `admin_notify_user:${user.id}`,
        ),
      ]);

    buttons.push([Markup.button.callback('⬅️ Назад к пользователям', USERS_ACTION)]);

    await context.editMessageText(
      [
        '🔔 Кому отправить уведомление?',
        '━━━━━━━━━━━━━━━━━━━━',
        '',
        'Ручное уведомление отправляется сразу и не зависит от дневного лимита автоматических напоминаний.',
        ...(users.length > 40 ? ['', 'Показаны первые 40 пользователей.'] : []),
      ].join('\n'),
      Markup.inlineKeyboard(buttons),
    );
  });

  bot.action(MANUAL_REMINDER_USER_ACTION, async (context) => {
    const userId = context.match[1];

    if (userId === undefined) {
      return;
    }

    await context.answerCbQuery('Отправляю уведомление');
    const result = await remindersService.sendManualReminder(context.telegram, userId);

    switch (result.status) {
      case 'sent':
        await context.editMessageText(
          [
            '🔔 Уведомление отправлено',
            '━━━━━━━━━━━━━━━━━━━━',
            '',
            `${result.user.name} (${result.user.telegramUsername ?? '-'})`,
          ].join('\n'),
          Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Назад к списку', MANUAL_REMINDERS_ACTION)],
            [Markup.button.callback('⬅️ Назад в панель', PANEL_ACTION)],
          ]),
        );
        return;
      case 'not_linked':
        await context.editMessageText(
          [
            'Уведомление не отправлено.',
            '━━━━━━━━━━━━━━━━━━━━',
            '',
            `${result.user.name} (${result.user.telegramUsername ?? '-'}) ещё не привязан к Telegram-аккаунту.`,
          ].join('\n'),
          Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Назад к списку', MANUAL_REMINDERS_ACTION)],
            [Markup.button.callback('⬅️ Назад в панель', PANEL_ACTION)],
          ]),
        );
        return;
      case 'not_found':
        await context.editMessageText(
          'Пользователь не найден.',
          Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Назад к списку', MANUAL_REMINDERS_ACTION)],
            [Markup.button.callback('⬅️ Назад в панель', PANEL_ACTION)],
          ]),
        );
        return;
    }
  });

  bot.action(ADD_USER_ACTION, async (context) => {
    clearAdminInputState(context.from.id);
    addUserState.set(context.from.id, { step: 'name', draft: {} });
    await context.answerCbQuery();
    await context.editMessageText(
      [
        '➕ Добавление пользователя',
        '━━━━━━━━━━━━━━━━━━━━',
        '',
        'Введите имя пользователя.',
        '',
        'Пример: Иван Петров',
      ].join('\n'),
      Markup.inlineKeyboard([[Markup.button.callback('⬅️ Отмена', USERS_ACTION)]]),
    );
  });

  bot.action(USER_CARD_ACTION, async (context) => {
    clearAdminInputState(context.from.id);
    const userId = context.match[1];

    if (userId === undefined) {
      return;
    }

    await context.answerCbQuery();
    await context.editMessageText(await usersService.getUserCard(userId), userCardKeyboard(userId));
  });

  bot.action(USER_HISTORY_ACTION, async (context) => {
    const userId = context.match[1];

    if (userId === undefined) {
      return;
    }

    await context.answerCbQuery();
    await context.editMessageText(
      await paymentsService.getHistoryByUserId(userId),
      Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад к карточке', `u:${userId}`)]]),
    );
  });

  bot.action(USER_INVITE_ACTION, async (context) => {
    const userId = context.match[1];

    if (userId === undefined) {
      return;
    }

    const users = await usersService.listUsers();
    const user = users.find((item) => item.id === userId);

    if (user?.telegramUsername === null || user?.telegramUsername === undefined) {
      await context.answerCbQuery('У пользователя нет username');
      return;
    }

    await context.answerCbQuery();
    await context.editMessageText(
      await userAccessService.createInviteLink(
        user.telegramUsername,
        context.from.id,
        context.botInfo.username,
      ),
      Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад к карточке', `u:${userId}`)]]),
    );
  });

  bot.action(USER_DELETE_CONFIRM_ACTION, async (context) => {
    const userId = context.match[1];

    if (userId === undefined) {
      return;
    }

    await context.answerCbQuery();
    await context.editMessageText(
      [
        '⚠️ Полное удаление пользователя',
        '━━━━━━━━━━━━━━━━━━━━',
        '',
        await usersService.getUserCard(userId),
        '',
        'Будут безвозвратно удалены оплаты, заявки, приглашения и история напоминаний.',
        'Подтвердите удаление.',
      ].join('\n'),
      Markup.inlineKeyboard([
        [Markup.button.callback('🗑 Да, удалить полностью', `udc:${userId}`)],
        [Markup.button.callback('⬅️ Отмена', `u:${userId}`)],
      ]),
    );
  });

  bot.action(USER_DELETE_ACTION, async (context) => {
    const userId = context.match[1];

    if (userId === undefined) {
      return;
    }

    const user = await usersService.deleteUser(userId);
    await context.answerCbQuery('Пользователь удалён');
    await context.editMessageText(
      usersService.formatDeletedUser(user),
      Markup.inlineKeyboard([[Markup.button.callback('⬅️ К пользователям', USERS_ACTION)]]),
    );
  });

  bot.action(USER_NOTIFY_ACTION, async (context) => {
    const userId = context.match[1];

    if (userId === undefined) {
      return;
    }

    await context.answerCbQuery('Отправляю уведомление');
    const result = await remindersService.sendManualReminder(context.telegram, userId);

    if (result.status === 'sent') {
      await context.editMessageText(
        [
          '🔔 Уведомление отправлено',
          '━━━━━━━━━━━━━━━━━━━━',
          '',
          `${result.user.name} (${result.user.telegramUsername ?? '-'})`,
        ].join('\n'),
        userCardKeyboard(userId),
      );
      return;
    }

    if (result.status === 'not_linked') {
      await context.editMessageText(
        [
          'Уведомление не отправлено.',
          '━━━━━━━━━━━━━━━━━━━━',
          '',
          `${result.user.name} (${result.user.telegramUsername ?? '-'}) ещё не привязан к Telegram-аккаунту.`,
        ].join('\n'),
        userCardKeyboard(userId),
      );
      return;
    }

    await context.editMessageText('Пользователь не найден.', backKeyboard());
  });

  bot.action(USER_PAID_UNTIL_ACTION, async (context) => {
    const userId = context.match[1];

    if (userId === undefined) {
      return;
    }

    await context.answerCbQuery();
    await context.editMessageText(
      [
        '💳 Исправление оплаты',
        '━━━━━━━━━━━━━━━━━━━━',
        '',
        await usersService.getUserCard(userId),
        '',
        'Выберите быстрое действие или введите точную дату.',
      ].join('\n'),
      paidUntilKeyboard(userId),
    );
  });

  bot.action(USER_PAID_UNTIL_ADJUST_ACTION, async (context) => {
    const userId = context.match[1];
    const adjustment = context.match[2];

    if (userId === undefined || adjustment === undefined) {
      return;
    }

    const user = await usersService.adjustPaidUntilByUserId(userId, adjustment);
    await context.answerCbQuery('Дата обновлена');
    await context.editMessageText(
      usersService.formatUpdatedPaidUntil(user),
      userCardKeyboard(userId),
    );
  });

  bot.action(USER_PAID_UNTIL_INPUT_ACTION, async (context) => {
    const userId = context.match[1];

    if (userId === undefined) {
      return;
    }

    clearAdminInputState(context.from.id);
    paidUntilInputState.set(context.from.id, { userId });
    await context.answerCbQuery();
    await context.editMessageText(
      [
        '📅 Введите дату оплаты',
        '━━━━━━━━━━━━━━━━━━━━',
        '',
        'Отправьте дату одним сообщением в формате DD.MM.YYYY.',
        '',
        'Пример: 26.06.2026',
        'Для сброса отправьте: none',
      ].join('\n'),
      Markup.inlineKeyboard([[Markup.button.callback('⬅️ Отмена', `u:${userId}`)]]),
    );
  });
}
