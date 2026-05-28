import { PaymentSource, type Prisma } from '@prisma/client';

import {
  addCalendarDays,
  addCalendarMonths,
  currentCalendarDate,
  formatDate,
} from '../../shared/date/date.utils.js';
import { AppError } from '../../shared/errors/app-error.js';
import { formatMoney, parsePositiveAmount } from '../../shared/money/money.utils.js';
import type { PaymentsRepository } from './payments.repository.js';
import type {
  ConfirmedPaymentResult,
  PaymentHistoryResult,
  PaymentUser,
} from './payments.types.js';

const USERNAME_PATTERN = /^@[A-Za-z0-9_]{5,32}$/;
const PAYMENT_METHOD_PATTERN = /^[\p{L}\p{N}_-]{2,32}$/u;
const HISTORY_LIMIT = 10;

export interface ConfirmPaymentRequest {
  telegramUsername: string;
  amount: string;
  paymentMethod: string;
  comment?: string;
  confirmedByTelegramId: number;
}

export class PaymentsService {
  public constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly timeZone: string,
  ) {}

  public async confirmPayment(request: ConfirmPaymentRequest): Promise<ConfirmedPaymentResult> {
    const telegramUsername = this.normalizeUsername(request.telegramUsername);
    const amount = parsePositiveAmount(request.amount);
    const paymentMethod = this.normalizePaymentMethod(request.paymentMethod);
    const paymentDate = currentCalendarDate(this.timeZone);
    const comment = request.comment?.trim();
    const result = await this.paymentsRepository.createConfirmedPayment(
      telegramUsername,
      (user) => {
        return this.buildPaymentData(user, amount, {
          paymentDate,
          paymentMethod,
          confirmedByTelegramId: BigInt(request.confirmedByTelegramId),
          source: PaymentSource.ADMIN_MANUAL,
          ...(comment === undefined || comment.length === 0 ? {} : { comment }),
        });
      },
    );

    if (result === null) {
      throw new AppError(`Пользователь ${telegramUsername} не найден.`, 'USER_NOT_FOUND');
    }

    return result;
  }

  public async confirmPaymentClaim(
    claimId: string,
    confirmedByTelegramId: number,
  ): Promise<ConfirmedPaymentResult> {
    const paymentDate = currentCalendarDate(this.timeZone);
    const result = await this.paymentsRepository.confirmPendingClaim(claimId, (user, amount) => {
      return this.buildPaymentData(user, amount, {
        paymentDate,
        paymentMethod: null,
        source: PaymentSource.CLAIM_CONFIRMED,
        confirmedByTelegramId: BigInt(confirmedByTelegramId),
        comment: 'Подтверждено по заявке пользователя',
      });
    });

    if (result === null) {
      throw new AppError('Заявка уже обработана или не найдена.', 'PAYMENT_CLAIM_NOT_PENDING');
    }

    return result;
  }

  private buildPaymentData(
    user: PaymentUser,
    amount: Prisma.Decimal,
    details: {
      paymentDate: Date;
      paymentMethod: string | null;
      source: PaymentSource;
      confirmedByTelegramId: bigint;
      comment?: string;
    },
  ) {
    const months = this.calculatePaidMonths(amount, user.monthlyPrice);
    const periodStart = this.calculatePeriodStart(user, details.paymentDate);
    const periodEnd = addCalendarDays(addCalendarMonths(periodStart, months), -1);

    return {
      amount,
      paymentMethod: details.paymentMethod,
      source: details.source,
      paymentDate: details.paymentDate,
      periodStart,
      periodEnd,
      confirmedByTelegramId: details.confirmedByTelegramId,
      ...(details.comment === undefined ? {} : { comment: details.comment }),
    };
  }

  public async getHistory(telegramUsernameValue: string): Promise<string> {
    const telegramUsername = this.normalizeUsername(telegramUsernameValue);
    const result = await this.paymentsRepository.findHistory(telegramUsername, HISTORY_LIMIT);

    if (result === null) {
      throw new AppError(`Пользователь ${telegramUsername} не найден.`, 'USER_NOT_FOUND');
    }

    return this.formatHistoryResult(result, telegramUsername);
  }

  public async getHistoryByUserId(userId: string): Promise<string> {
    const result = await this.paymentsRepository.findHistoryByUserId(userId, HISTORY_LIMIT);

    if (result === null) {
      throw new AppError('Пользователь не найден.', 'USER_NOT_FOUND');
    }

    return this.formatHistoryResult(result, result.user.telegramUsername ?? '-');
  }

  private formatHistoryResult(result: PaymentHistoryResult, usernameLabel: string): string {
    if (result.payments.length === 0) {
      return `Подтвержденных оплат для ${result.user.name} (${usernameLabel}) пока нет.`;
    }

    const payments = result.payments.map((payment, index) => {
      return [
        `${index + 1}. ${formatDate(payment.paymentDate)} - ${formatMoney(payment.amount)}`,
        `Способ: ${payment.paymentMethod ?? 'не указан'}`,
        `Период: ${formatDate(payment.periodStart)} - ${formatDate(payment.periodEnd)}`,
        ...(payment.comment === null ? [] : [`Комментарий: ${payment.comment}`]),
      ].join('\n');
    });

    return [
      `📜 История оплат`,
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      `👤 ${result.user.name} (${usernameLabel})`,
      `• Оплачено до: ${result.user.paidUntil === null ? '-' : formatDate(result.user.paidUntil)}`,
      '',
      ...payments,
    ].join('\n\n');
  }

  public formatConfirmedPayment(result: ConfirmedPaymentResult): string {
    const months = result.payment.amount.dividedBy(result.user.monthlyPrice).toNumber();

    return [
      '✅ Оплата подтверждена',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      `👤 ${result.user.name} (${result.user.telegramUsername ?? '-'})`,
      '',
      `• Сумма: ${formatMoney(result.payment.amount)}`,
      `• Способ: ${result.payment.paymentMethod ?? 'не указан'}`,
      `• Период: ${formatDate(result.payment.periodStart)} - ${formatDate(result.payment.periodEnd)} (${months} мес.)`,
      `• Оплачено до: ${formatDate(result.payment.periodEnd)}`,
    ].join('\n');
  }

  private normalizeUsername(value: string): string {
    const username = value.trim();

    if (!USERNAME_PATTERN.test(username)) {
      throw new AppError(
        'Username должен иметь формат @username и содержать от 5 до 32 символов.',
        'INVALID_TELEGRAM_USERNAME',
      );
    }

    return username.toLowerCase();
  }

  private normalizePaymentMethod(value: string): string {
    const paymentMethod = value.trim().toLowerCase();

    if (!PAYMENT_METHOD_PATTERN.test(paymentMethod)) {
      throw new AppError(
        'Способ оплаты должен содержать от 2 до 32 букв, цифр, "_" или "-".',
        'INVALID_PAYMENT_METHOD',
      );
    }

    return paymentMethod;
  }

  private calculatePaidMonths(amount: Prisma.Decimal, monthlyPrice: Prisma.Decimal): number {
    if (!amount.modulo(monthlyPrice).isZero()) {
      throw new AppError(
        `Сумма ${formatMoney(amount)} не соответствует целому числу месяцев при тарифе ${formatMoney(monthlyPrice)}.`,
        'INVALID_PAYMENT_AMOUNT',
      );
    }

    const months = amount.dividedBy(monthlyPrice).toNumber();

    if (!Number.isSafeInteger(months) || months < 1 || months > 120) {
      throw new AppError(
        'Одной оплатой можно подтвердить от 1 до 120 месяцев.',
        'INVALID_PAYMENT_PERIOD',
      );
    }

    return months;
  }

  private calculatePeriodStart(user: PaymentUser, paymentDate: Date): Date {
    if (user.paidUntil !== null && user.paidUntil.getTime() >= paymentDate.getTime()) {
      return addCalendarDays(user.paidUntil, 1);
    }

    return paymentDate;
  }
}
