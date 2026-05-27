import type { PrismaClient } from '@prisma/client';

import type {
  ConfirmedPaymentResult,
  CreateConfirmedPaymentData,
  PaymentHistoryResult,
  PaymentUser,
} from './payments.types.js';

const USER_SELECT = {
  id: true,
  name: true,
  telegramUsername: true,
  telegramId: true,
  monthlyPrice: true,
  status: true,
  paidUntil: true,
} as const;

const PAYMENT_SELECT = {
  id: true,
  amount: true,
  paymentMethod: true,
  source: true,
  paymentDate: true,
  periodStart: true,
  periodEnd: true,
  comment: true,
} as const;

export class PaymentsRepository {
  public constructor(private readonly database: PrismaClient) {}

  public async createConfirmedPayment(
    telegramUsername: string,
    buildPaymentData: (user: PaymentUser) => CreateConfirmedPaymentData,
  ): Promise<ConfirmedPaymentResult | null> {
    return this.database.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({
        where: { telegramUsername },
        select: USER_SELECT,
      });

      if (user === null) {
        return null;
      }

      const paymentData = buildPaymentData(user);
      const payment = await transaction.payment.create({
        data: {
          userId: user.id,
          ...paymentData,
        },
        select: PAYMENT_SELECT,
      });
      const updatedUser = await transaction.user.update({
        where: { id: user.id },
        data: { paidUntil: paymentData.periodEnd },
        select: USER_SELECT,
      });

      return { user: updatedUser, payment };
    });
  }

  public async findHistory(
    telegramUsername: string,
    limit: number,
  ): Promise<PaymentHistoryResult | null> {
    const user = await this.database.user.findUnique({
      where: { telegramUsername },
      select: {
        ...USER_SELECT,
        payments: {
          orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
          take: limit,
          select: PAYMENT_SELECT,
        },
      },
    });

    if (user === null) {
      return null;
    }

    const { payments, ...paymentUser } = user;

    return { user: paymentUser, payments };
  }

  public async confirmPendingClaim(
    claimId: string,
    buildPaymentData: (
      user: PaymentUser,
      amount: PaymentUser['monthlyPrice'],
    ) => CreateConfirmedPaymentData,
  ): Promise<ConfirmedPaymentResult | null> {
    return this.database.$transaction(async (transaction) => {
      const claim = await transaction.paymentClaim.findUnique({
        where: { id: claimId },
        select: {
          id: true,
          amount: true,
          status: true,
          user: { select: USER_SELECT },
        },
      });

      if (claim === null || claim.status !== 'PENDING') {
        return null;
      }

      const paymentData = buildPaymentData(claim.user, claim.amount);
      const payment = await transaction.payment.create({
        data: { userId: claim.user.id, ...paymentData },
        select: PAYMENT_SELECT,
      });
      const user = await transaction.user.update({
        where: { id: claim.user.id },
        data: { paidUntil: paymentData.periodEnd },
        select: USER_SELECT,
      });
      await transaction.paymentClaim.update({
        where: { id: claim.id },
        data: {
          status: 'CONFIRMED',
          paymentId: payment.id,
          reviewedAt: new Date(),
          reviewedBy: paymentData.confirmedByTelegramId,
        },
      });

      return { user, payment };
    });
  }
}
