import type { Prisma } from '@prisma/client';

export interface PaymentClaimUser {
  id: string;
  name: string;
  telegramUsername: string | null;
  telegramId: bigint | null;
  monthlyPrice: Prisma.Decimal;
  paidUntil: Date | null;
}

export interface PendingPaymentClaim {
  id: string;
  amount: Prisma.Decimal;
  createdAt: Date;
  user: PaymentClaimUser;
}

export type CreatePaymentClaimResult =
  | { status: 'created'; claim: PendingPaymentClaim }
  | { status: 'existing'; claim: PendingPaymentClaim }
  | { status: 'user_not_linked' };
