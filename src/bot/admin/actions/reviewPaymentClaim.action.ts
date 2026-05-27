import { Markup, type Context, type Telegraf } from 'telegraf';

import type { PaymentClaimsService } from '../../../modules/payment-claims/paymentClaims.service.js';
import type { PaymentsService } from '../../../modules/payments/payments.service.js';
import { formatDate } from '../../../shared/date/date.utils.js';
import { formatMoney } from '../../../shared/money/money.utils.js';
import { userStatusKeyboard } from '../../user/status.keyboard.js';

const CONFIRM_ACTION = /^claim_confirm:([0-9a-f-]{36})$/;
const REJECT_ACTION = /^claim_reject:([0-9a-f-]{36})$/;
const PANEL_KEYBOARD = Markup.inlineKeyboard([
  Markup.button.callback('⚙️ В панель администратора', 'admin_panel'),
]);

export function registerReviewPaymentClaimActions(
  bot: Telegraf<Context>,
  paymentClaimsService: PaymentClaimsService,
  paymentsService: PaymentsService,
): void {
  bot.action(CONFIRM_ACTION, async (context) => {
    const claimId = context.match[1];

    if (claimId === undefined) {
      return;
    }

    const result = await paymentsService.confirmPaymentClaim(claimId, context.from.id);
    await context.answerCbQuery('Оплата подтверждена');
    await context.editMessageText(
      `${paymentsService.formatConfirmedPayment(result)}\n\nПодтверждено администратором.`,
      PANEL_KEYBOARD,
    );

    if (result.user.telegramId !== null) {
      await context.telegram.sendMessage(
        result.user.telegramId.toString(),
        [
          'Ваш перевод подтверждён.',
          '',
          `Оплачено до: ${formatDate(result.payment.periodEnd)}`,
          'Спасибо!',
        ].join('\n'),
        userStatusKeyboard(),
      );
    }
  });

  bot.action(REJECT_ACTION, async (context) => {
    const claimId = context.match[1];

    if (claimId === undefined) {
      return;
    }

    const claim = await paymentClaimsService.rejectClaim(claimId, context.from.id);
    await context.answerCbQuery('Заявка отклонена');
    await context.editMessageText(
      [
        'Заявка об оплате отклонена.',
        '',
        `${claim.user.name} (${claim.user.telegramUsername ?? '-'})`,
        `Ожидаемая сумма: ${formatMoney(claim.amount)}`,
      ].join('\n'),
      PANEL_KEYBOARD,
    );

    if (claim.user.telegramId !== null) {
      await context.telegram.sendMessage(
        claim.user.telegramId.toString(),
        'Подтверждение оплаты отклонено. Если вы совершили перевод, напишите администратору.',
      );
    }
  });
}
