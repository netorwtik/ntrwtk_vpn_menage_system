import type { PrismaClient } from '@prisma/client';

import type {
  CreatePaymentClaimResult,
  PaymentClaimMonths,
  PendingPaymentClaim,
} from './paymentClaims.types.js';

const CLAIM_SELECT = {
  id: true,
  amount: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      name: true,
      telegramUsername: true,
      telegramId: true,
      monthlyPrice: true,
      paidUntil: true,
    },
  },
} as const;

export class PaymentClaimsRepository {
  public constructor(private readonly database: PrismaClient) {}

  public async findPending(): Promise<PendingPaymentClaim[]> {
    return this.database.paymentClaim.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: CLAIM_SELECT,
    });
  }

  public async findPendingById(claimId: string): Promise<PendingPaymentClaim | null> {
    return this.database.paymentClaim.findFirst({
      where: { id: claimId, status: 'PENDING' },
      select: CLAIM_SELECT,
    });
  }

  public async createForTelegramId(
    telegramId: bigint,
    months: PaymentClaimMonths,
  ): Promise<CreatePaymentClaimResult> {
    return this.database.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({
        where: { telegramId },
        select: {
          id: true,
          monthlyPrice: true,
        },
      });

      if (user === null) {
        return { status: 'user_not_linked' };
      }

      const existing = await transaction.paymentClaim.findFirst({
        where: { userId: user.id, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        select: CLAIM_SELECT,
      });

      if (existing !== null) {
        return { status: 'existing', claim: existing };
      }

      const claim = await transaction.paymentClaim.create({
        data: { userId: user.id, amount: user.monthlyPrice.mul(months) },
        select: CLAIM_SELECT,
      });

      return { status: 'created', claim };
    });
  }

  public async rejectPending(
    claimId: string,
    reviewedBy: bigint,
  ): Promise<PendingPaymentClaim | null> {
    return this.database.$transaction(async (transaction) => {
      const claim = await transaction.paymentClaim.findUnique({
        where: { id: claimId },
        select: { status: true, ...CLAIM_SELECT },
      });

      if (claim === null || claim.status !== 'PENDING') {
        return null;
      }

      await transaction.paymentClaim.update({
        where: { id: claimId },
        data: { status: 'REJECTED', reviewedAt: new Date(), reviewedBy },
      });

      return {
        id: claim.id,
        amount: claim.amount,
        createdAt: claim.createdAt,
        user: claim.user,
      };
    });
  }
}
