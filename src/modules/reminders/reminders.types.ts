import type { Prisma } from '@prisma/client';

export interface OverdueReminderUser {
  id: string;
  name: string;
  telegramUsername: string | null;
  telegramId: bigint;
  monthlyPrice: Prisma.Decimal;
  paymentDueDay: number | null;
  startedAt: Date;
  paidUntil: Date | null;
}

export interface ManualReminderUser {
  id: string;
  name: string;
  telegramUsername: string | null;
  telegramId: bigint | null;
  monthlyPrice: Prisma.Decimal;
  paymentDueDay: number | null;
  startedAt: Date;
  paidUntil: Date | null;
}

export interface ReminderDeliveryInput {
  userId: string;
  reminderDate: Date;
  telegramMessageId: number;
}
