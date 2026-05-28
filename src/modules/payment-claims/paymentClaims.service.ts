import { formatDate } from '../../shared/date/date.utils.js';
import { AppError } from '../../shared/errors/app-error.js';
import { formatMoney } from '../../shared/money/money.utils.js';
import type { PaymentClaimsRepository } from './paymentClaims.repository.js';
import type { PendingPaymentClaim } from './paymentClaims.types.js';

export class PaymentClaimsService {
  public constructor(private readonly repository: PaymentClaimsRepository) {}

  public async listPending(): Promise<PendingPaymentClaim[]> {
    return this.repository.findPending();
  }

  public async getPendingById(claimId: string): Promise<PendingPaymentClaim> {
    const claim = await this.repository.findPendingById(claimId);

    if (claim === null) {
      throw new AppError('Заявка уже обработана или не найдена.', 'PAYMENT_CLAIM_NOT_PENDING');
    }

    return claim;
  }

  public formatPendingClaim(claim: PendingPaymentClaim): string {
    return [
      '🧾 Заявка об оплате',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      '👤 Пользователь',
      `• ${claim.user.name} (${claim.user.telegramUsername ?? '-'})`,
      '',
      '💳 Оплата',
      `• Сумма: ${formatMoney(claim.amount)}`,
      `• Тариф: ${formatMoney(claim.user.monthlyPrice)} / месяц`,
      `• Оплачено до: ${claim.user.paidUntil === null ? 'оплата не зафиксирована' : formatDate(claim.user.paidUntil)}`,
      `• Заявка создана: ${formatDate(claim.createdAt)}`,
    ].join('\n');
  }

  public async createClaim(telegramId: number): Promise<{
    userMessage: string;
    adminNotification: string | null;
    claim: PendingPaymentClaim | null;
  }> {
    const result = await this.repository.createForTelegramId(BigInt(telegramId));

    if (result.status === 'user_not_linked') {
      throw new AppError(
        'Ваш аккаунт ещё не привязан к VPN-профилю. Получите персональную ссылку у администратора.',
        'USER_NOT_LINKED',
      );
    }

    if (result.status === 'existing') {
      return {
        userMessage:
          'Ваша заявка об оплате уже отправлена администратору. Доступ будет продлён после проверки перевода.',
        adminNotification: null,
        claim: null,
      };
    }

    return {
      userMessage:
        'Заявка об оплате отправлена администратору. Доступ будет продлён только после подтверждения перевода.',
      adminNotification: [
        '🧾 Пользователь сообщил об оплате.',
        '━━━━━━━━━━━━━━━━━━━━',
        '',
        `• ${result.claim.user.name} (${result.claim.user.telegramUsername ?? '-'})`,
        `• Ожидаемая сумма: ${formatMoney(result.claim.amount)}`,
        `• Дата заявки: ${formatDate(result.claim.createdAt)}`,
      ].join('\n'),
      claim: result.claim,
    };
  }

  public async rejectClaim(claimId: string, reviewedBy: number): Promise<PendingPaymentClaim> {
    const claim = await this.repository.rejectPending(claimId, BigInt(reviewedBy));

    if (claim === null) {
      throw new AppError('Заявка уже обработана или не найдена.', 'PAYMENT_CLAIM_NOT_PENDING');
    }

    return claim;
  }
}
