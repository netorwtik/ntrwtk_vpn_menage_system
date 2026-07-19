import { Prisma, ReminderKind, type PrismaClient } from '@prisma/client';

import type {
  ManualReminderUser,
  OverdueReminderUser,
  ReminderDeliveryInput,
} from './reminders.types.js';

const OVERDUE_USER_SELECT = {
  id: true,
  name: true,
  telegramUsername: true,
  telegramId: true,
  monthlyPrice: true,
  paymentDueDay: true,
  startedAt: true,
  paidUntil: true,
} as const;

export class RemindersRepository {
  public constructor(private readonly database: PrismaClient) {}

  public async findManualReminderUsers(): Promise<ManualReminderUser[]> {
    return this.database.user.findMany({
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      select: OVERDUE_USER_SELECT,
    });
  }

  public async findManualReminderUserById(userId: string): Promise<ManualReminderUser | null> {
    return this.database.user.findUnique({
      where: { id: userId },
      select: OVERDUE_USER_SELECT,
    });
  }

  public async findUsersForOverdueReminder(remindUntil: Date, reminderDate: Date): Promise<OverdueReminderUser[]> {
    const users = await this.database.user.findMany({
      where: {
        status: 'ACTIVE',
        telegramId: { not: null },
        OR: [
          { paidUntil: { lte: remindUntil } },
          { paidUntil: null, startedAt: { lte: remindUntil } },
        ],
        reminderDeliveries: {
          none: {
            kind: ReminderKind.PAYMENT_OVERDUE,
            reminderDate,
          },
        },
      },
      orderBy: [{ paidUntil: 'asc' }, { startedAt: 'asc' }, { name: 'asc' }],
      select: OVERDUE_USER_SELECT,
    });

    return users.flatMap((user) => {
      if (user.telegramId === null) {
        return [];
      }

      return [{ ...user, telegramId: user.telegramId }];
    });
  }

  public async recordOverdueDelivery(input: ReminderDeliveryInput): Promise<boolean> {
    try {
      await this.database.reminderDelivery.create({
        data: {
          userId: input.userId,
          kind: ReminderKind.PAYMENT_OVERDUE,
          reminderDate: input.reminderDate,
          telegramMessageId: input.telegramMessageId,
        },
      });

      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }

      throw error;
    }
  }
}
