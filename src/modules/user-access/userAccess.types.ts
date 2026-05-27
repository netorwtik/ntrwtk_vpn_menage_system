import type { Prisma, UserStatus } from '@prisma/client';

export interface AccessUser {
  id: string;
  name: string;
  telegramUsername: string | null;
  telegramId: bigint | null;
  monthlyPrice: Prisma.Decimal;
  status: UserStatus;
  startedAt: Date;
  paidUntil: Date | null;
}

export type BindUserResult =
  | { status: 'linked'; user: AccessUser }
  | { status: 'already_linked'; user: AccessUser }
  | { status: 'invite_not_found' }
  | { status: 'invite_used' }
  | { status: 'invite_expired' }
  | { status: 'user_linked_to_another_account' }
  | { status: 'telegram_account_already_linked' };
