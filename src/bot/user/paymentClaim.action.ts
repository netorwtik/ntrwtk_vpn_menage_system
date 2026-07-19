import { Markup, type Context, type Telegraf } from 'telegraf';

import type { PaymentClaimsService } from '../../modules/payment-claims/paymentClaims.service.js';
import type { PaymentClaimMonths } from '../../modules/payment-claims/paymentClaims.types.js';
import type { UserAccessService } from '../../modules/user-access/userAccess.service.js';
import { userStatusKeyboard } from './status.keyboard.js';

const CLAIM_MONTHS_ACTION = /^user_claim_payment:(1|2|3|6|12)$/;

export function paymentCardKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Я оплатил', 'user_claim_payment')],
    [Markup.button.callback('📋 Мой статус', 'user_status_card')],
  ]);
}

function statusCardKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([[Markup.button.callback('💳 Оплата', 'user_payment_card')]]);
}

function paymentNotRequiredKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([[Markup.button.callback('📋 Мой статус', 'user_status_card')]]);
}

function claimSentKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📋 Мой статус', 'user_status_card')],
    [Markup.button.callback('💳 Оплата', 'user_payment_card')],
  ]);
}

function claimMonthsKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('1 мес.', 'user_claim_payment:1'),
      Markup.button.callback('2 мес.', 'user_claim_payment:2'),
      Markup.button.callback('3 мес.', 'user_claim_payment:3'),
    ],
    [
      Markup.button.callback('6 мес.', 'user_claim_payment:6'),
      Markup.button.callback('12 мес.', 'user_claim_payment:12'),
    ],
    [Markup.button.callback('📋 Мой статус', 'user_status_card')],
  ]);
}

function paymentPeriodMessage(): string {
  return [
    'Выберите период, за который вы оплатили VPN.',
    '',
    'Заявка будет отправлена администратору после выбора периода.',
  ].join('\n');
}

async function createClaimAndNotifyAdmins(
  context: Context,
  telegramId: number,
  months: PaymentClaimMonths,
  paymentClaimsService: PaymentClaimsService,
  userAccessService: UserAccessService,
  adminTelegramIds: ReadonlySet<number>,
): Promise<string> {
  const paymentCard = await userAccessService.getPaymentCard(telegramId);

  if (!paymentCard.paymentRequired) {
    return paymentCard.message;
  }

  const result = await paymentClaimsService.createClaim(telegramId, months);

  if (result.adminNotification !== null && result.claim !== null) {
    const notification = result.adminNotification;
    const reviewKeyboard = Markup.inlineKeyboard([
      Markup.button.callback('✅ Подтвердить', `claim_confirm:${result.claim.id}`),
      Markup.button.callback('❌ Отклонить', `claim_reject:${result.claim.id}`),
    ]);

    await Promise.all(
      [...adminTelegramIds].map((adminTelegramId) =>
        context.telegram.sendMessage(adminTelegramId, notification, reviewKeyboard),
      ),
    );
  }

  return result.userMessage;
}

export function registerPaymentClaimAction(
  bot: Telegraf<Context>,
  paymentClaimsService: PaymentClaimsService,
  userAccessService: UserAccessService,
  adminTelegramIds: ReadonlySet<number>,
): void {
  bot.hears(['💳 Оплата', 'Оплата'], async (context) => {
    const paymentCard = await userAccessService.getPaymentCard(context.from.id);

    await context.reply(
      paymentCard.message,
      paymentCard.paymentRequired ? paymentCardKeyboard() : paymentNotRequiredKeyboard(),
    );
  });

  bot.action('user_payment_card', async (context) => {
    const paymentCard = await userAccessService.getPaymentCard(context.from.id);

    await context.answerCbQuery();
    await context.editMessageText(
      paymentCard.message,
      paymentCard.paymentRequired ? paymentCardKeyboard() : paymentNotRequiredKeyboard(),
    );
  });

  bot.action('user_status_card', async (context) => {
    await context.answerCbQuery();
    await context.editMessageText(
      await userAccessService.getStatusMessage(context.from.id),
      statusCardKeyboard(),
    );
  });

  bot.action('user_claim_payment', async (context) => {
    const paymentCard = await userAccessService.getPaymentCard(context.from.id);

    await context.answerCbQuery();
    await context.editMessageText(
      paymentCard.paymentRequired ? paymentPeriodMessage() : paymentCard.message,
      paymentCard.paymentRequired ? claimMonthsKeyboard() : paymentNotRequiredKeyboard(),
    );
  });

  bot.action(CLAIM_MONTHS_ACTION, async (context) => {
    const months = Number(context.match[1]) as PaymentClaimMonths;
    const message = await createClaimAndNotifyAdmins(
      context,
      context.from.id,
      months,
      paymentClaimsService,
      userAccessService,
      adminTelegramIds,
    );
    const paymentCard = await userAccessService.getPaymentCard(context.from.id);

    await context.answerCbQuery(
      paymentCard.paymentRequired ? 'Заявка отправлена' : 'Платить пока не нужно',
    );
    await context.editMessageText(
      message,
      paymentCard.paymentRequired ? claimSentKeyboard() : paymentNotRequiredKeyboard(),
    );
  });

  bot.hears(['✅ Я оплатил', 'Я оплатил'], async (context) => {
    const paymentCard = await userAccessService.getPaymentCard(context.from.id);

    await context.reply(
      paymentCard.paymentRequired ? paymentPeriodMessage() : paymentCard.message,
      paymentCard.paymentRequired ? claimMonthsKeyboard() : userStatusKeyboard(),
    );
  });
}
