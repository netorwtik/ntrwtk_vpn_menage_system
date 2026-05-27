import { Markup, type Context, type Telegraf } from 'telegraf';

import type { PaymentClaimsService } from '../../../modules/payment-claims/paymentClaims.service.js';
import type { UsersService } from '../../../modules/users/users.service.js';
import { formatMoney } from '../../../shared/money/money.utils.js';

const PANEL_ACTION = 'admin_panel';
const CLAIMS_ACTION = 'admin_claims';
const DEBTORS_ACTION = 'admin_debtors';
const REMINDERS_ACTION = 'admin_reminders';
const USERS_ACTION = 'admin_users';
const CLAIM_ACTION = /^admin_claim:([0-9a-f-]{36})$/;

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
    '',
    `Пользователей: ${stats.usersCount}`,
    `Активных: ${stats.activeUsersCount}`,
    `Должников: ${stats.debtorsCount}`,
    `Скоро платить: ${stats.upcomingPaymentsCount}`,
    `Заявок на подтверждение: ${claims.length}`,
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
  daysBefore: number,
): void {
  bot.command('admin', async (context) => {
    await sendPanel(context, usersService, paymentClaimsService, daysBefore);
  });

  bot.action(PANEL_ACTION, async (context) => {
    await context.answerCbQuery();
    await editPanel(context, usersService, paymentClaimsService, daysBefore);
  });

  bot.action(CLAIMS_ACTION, async (context) => {
    const claims = await paymentClaimsService.listPending();
    await context.answerCbQuery();

    if (claims.length === 0) {
      await context.editMessageText('✅ Ожидающих заявок об оплате нет.', backKeyboard());
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
        `🧾 Заявки на оплату: ${claims.length}`,
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
    await context.answerCbQuery();
    await context.editMessageText(await usersService.getDebtorsMessage(), backKeyboard());
  });

  bot.action(REMINDERS_ACTION, async (context) => {
    await context.answerCbQuery();
    await context.editMessageText(
      await usersService.getRemindersMessage(daysBefore),
      backKeyboard(),
    );
  });

  bot.action(USERS_ACTION, async (context) => {
    const users = await usersService.listUsers();
    await context.answerCbQuery();
    await context.editMessageText(usersService.formatUsersList(users), backKeyboard());
  });
}
