import type { Prisma, UserStatus } from '@prisma/client';

export interface CreateUserInput {
  name: string;
  telegramUsername: string;
  monthlyPrice: Prisma.Decimal;
  startedAt: Date;
  comment?: string;
}

export interface UserListItem {
  id: string;
  name: string;
  telegramUsername: string | null;
  monthlyPrice: Prisma.Decimal;
  status: UserStatus;
  startedAt: Date;
  paidUntil: Date | null;
}
