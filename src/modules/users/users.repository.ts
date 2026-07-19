import type { Prisma, PrismaClient, UserStatus } from '@prisma/client';

import type { CreateUserInput, UserListItem } from './users.types.js';

const USER_LIST_SELECT = {
  id: true,
  name: true,
  telegramUsername: true,
  monthlyPrice: true,
  paymentDueDay: true,
  status: true,
  startedAt: true,
  paidUntil: true,
} as const;

export class UsersRepository {
  public constructor(private readonly database: PrismaClient) {}

  public async create(input: CreateUserInput): Promise<UserListItem> {
    return this.database.user.create({
      data: input,
      select: USER_LIST_SELECT,
    });
  }

  public async findByTelegramUsername(telegramUsername: string): Promise<UserListItem | null> {
    return this.database.user.findUnique({
      where: { telegramUsername },
      select: USER_LIST_SELECT,
    });
  }

  public async findById(id: string): Promise<UserListItem | null> {
    return this.database.user.findUnique({
      where: { id },
      select: USER_LIST_SELECT,
    });
  }

  public async findAll(): Promise<UserListItem[]> {
    return this.database.user.findMany({
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      select: USER_LIST_SELECT,
    });
  }

  public async findActive(): Promise<UserListItem[]> {
    return this.database.user.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ paidUntil: 'asc' }, { name: 'asc' }],
      select: USER_LIST_SELECT,
    });
  }

  public async findUnlinked(): Promise<UserListItem[]> {
    return this.database.user.findMany({
      where: { telegramId: null },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      select: USER_LIST_SELECT,
    });
  }

  public async updatePrice(id: string, monthlyPrice: Prisma.Decimal): Promise<UserListItem> {
    return this.database.user.update({
      where: { id },
      data: { monthlyPrice },
      select: USER_LIST_SELECT,
    });
  }

  public async updateStatus(id: string, status: UserStatus): Promise<UserListItem> {
    return this.database.user.update({
      where: { id },
      data: { status },
      select: USER_LIST_SELECT,
    });
  }

  public async updatePaidUntil(id: string, paidUntil: Date | null): Promise<UserListItem> {
    return this.database.user.update({
      where: { id },
      data: { paidUntil },
      select: USER_LIST_SELECT,
    });
  }

  public async delete(id: string): Promise<UserListItem> {
    return this.database.user.delete({
      where: { id },
      select: USER_LIST_SELECT,
    });
  }
}
