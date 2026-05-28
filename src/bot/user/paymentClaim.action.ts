import { Markup, type Context, type Telegraf } from 'telegraf';

import type { PaymentClaimsService } from '../../modules/payment-claims/paymentClaims.service.js';
import type { UserAccessService } from '../../modules/user-access/userAccess.service.js';
import { userStatusKeyboard } from './status.keyboard.js';

export function paymentCardKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Я оплатил', 'user_claim_payment')],
    [Markup.button.callback('📋 Мой статус', 'user_status_card')],
  ]);
}

function statusCardKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([[Markup.button.callback('💳 Оплата', 'user_payment_card')]]);
}

function claimSentKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📋 Мой статус', 'user_status_card')],
    [Markup.button.callback('💳 Оплата', 'user_payment_card')],
  ]);
}

async function createClaimAndNotifyAdmins(
  context: Context,
  telegramId: number,
  paymentClaimsService: PaymentClaimsService,
  adminTelegramIds: ReadonlySet<number>,
): Promise<string> {
  const result = await paymentClaimsService.createClaim(telegramId);

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
    await context.reply(
      await userAccessService.getPaymentCardMessage(context.from.id),
      paymentCardKeyboard(),
    );
  });

  bot.action('user_payment_card', async (context) => {
    await context.answerCbQuery();
    await context.editMessageText(
      await userAccessService.getPaymentCardMessage(context.from.id),
      paymentCardKeyboard(),
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
    const message = await createClaimAndNotifyAdmins(
      context,
      context.from.id,
      paymentClaimsService,
      adminTelegramIds,
    );
    await context.answerCbQuery('Заявка отправлена');
    await context.editMessageText(message, claimSentKeyboard());
  });

  bot.hears(['✅ Я оплатил', 'Я оплатил'], async (context) => {
    await context.reply(
      await createClaimAndNotifyAdmins(
        context,
        context.from.id,
        paymentClaimsService,
        adminTelegramIds,
      ),
      userStatusKeyboard(),
    );
  });
}
