import type { PrismaClient } from '@prisma/client';

import type { AccessUser, BindUserResult } from './userAccess.types.js';

const ACCESS_USER_SELECT = {
  id: true,
  name: true,
  telegramUsername: true,
  telegramId: true,
  monthlyPrice: true,
  paymentDueDay: true,
  status: true,
  startedAt: true,
  paidUntil: true,
} as const;

export class UserAccessRepository {
  public constructor(private readonly database: PrismaClient) {}

  public async findUserByUsername(telegramUsername: string): Promise<AccessUser | null> {
    return this.database.user.findUnique({
      where: { telegramUsername },
      select: ACCESS_USER_SELECT,
    });
  }

  public async createInvite(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    createdByTelegramId: bigint,
  ): Promise<void> {
    await this.database.userInvite.create({
      data: { userId, tokenHash, expiresAt, createdByTelegramId },
    });
  }

  public async bindByInvite(
    tokenHash: string,
    telegramId: bigint,
    now: Date,
  ): Promise<BindUserResult> {
    return this.database.$transaction(async (transaction) => {
      const invite = await transaction.userInvite.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          expiresAt: true,
          usedAt: true,
          user: { select: ACCESS_USER_SELECT },
        },
      });

      if (invite === null) {
        return { status: 'invite_not_found' };
      }

      if (invite.usedAt !== null) {
        return { status: 'invite_used' };
      }

      if (invite.expiresAt.getTime() <= now.getTime()) {
        return { status: 'invite_expired' };
      }

      if (invite.user.telegramId !== null) {
        if (invite.user.telegramId === telegramId) {
          return { status: 'already_linked', user: invite.user };
        }

        return { status: 'user_linked_to_another_account' };
      }

      const assignedUser = await transaction.user.findUnique({
        where: { telegramId },
        select: { id: true },
      });

      if (assignedUser !== null && assignedUser.id !== invite.user.id) {
        return { status: 'telegram_account_already_linked' };
      }

      const user = await transaction.user.update({
        where: { id: invite.user.id },
        data: { telegramId },
        select: ACCESS_USER_SELECT,
      });
      await transaction.userInvite.update({
        where: { id: invite.id },
        data: { usedAt: now, usedByTelegramId: telegramId },
      });

      return { status: 'linked', user };
    });
  }

  public async findByTelegramId(telegramId: bigint): Promise<AccessUser | null> {
    return this.database.user.findUnique({
      where: { telegramId },
      select: ACCESS_USER_SELECT,
    });
  }
}
