import type { PaymentSource, Prisma, UserStatus } from '@prisma/client';

export interface PaymentUser {
  id: string;
  name: string;
  telegramUsername: string | null;
  telegramId: bigint | null;
  monthlyPrice: Prisma.Decimal;
  paymentDueDay: number | null;
  status: UserStatus;
  paidUntil: Date | null;
}

export interface CreateConfirmedPaymentData {
  amount: Prisma.Decimal;
  paymentMethod: string | null;
  source?: PaymentSource;
  paymentDate: Date;
  periodStart: Date;
  periodEnd: Date;
  paymentDueDay: number;
  confirmedByTelegramId: bigint;
  comment?: string;
}

export interface ConfirmedPaymentRecord {
  id: string;
  amount: Prisma.Decimal;
  paymentMethod: string | null;
  source: PaymentSource;
  paymentDate: Date;
  periodStart: Date;
  periodEnd: Date;
  comment: string | null;
}

export interface ConfirmedPaymentResult {
  user: PaymentUser;
  payment: ConfirmedPaymentRecord;
}

export interface PaymentHistoryResult {
  user: PaymentUser;
  payments: ConfirmedPaymentRecord[];
}

export interface UndoLastPaymentResult {
  user: PaymentUser;
  payment: ConfirmedPaymentRecord;
  previousPaidUntil: Date | null;
}
