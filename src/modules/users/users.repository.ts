import type { Prisma, PrismaClient, UserStatus } from '@prisma/client';

import type { CreateUserInput, UserListItem } from './users.types.js';

export class UsersRepository {
  public constructor(private readonly database: PrismaClient) {}

  public async create(input: CreateUserInput): Promise<UserListItem> {
    return this.database.user.create({
      data: input,
      select: {
        id: true,
        name: true,
        telegramUsername: true,
        monthlyPrice: true,
        status: true,
        startedAt: true,
        paidUntil: true,
      },
    });
  }

  public async findByTelegramUsername(telegramUsername: string): Promise<UserListItem | null> {
    return this.database.user.findUnique({
      where: { telegramUsername },
      select: {
        id: true,
        name: true,
        telegramUsername: true,
        monthlyPrice: true,
        status: true,
        startedAt: true,
        paidUntil: true,
      },
    });
  }

  public async findById(id: string): Promise<UserListItem | null> {
    return this.database.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        telegramUsername: true,
        monthlyPrice: true,
        status: true,
        startedAt: true,
        paidUntil: true,
      },
    });
  }

  public async findAll(): Promise<UserListItem[]> {
    return this.database.user.findMany({
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        telegramUsername: true,
        monthlyPrice: true,
        status: true,
        startedAt: true,
        paidUntil: true,
      },
    });
  }

  public async findActive(): Promise<UserListItem[]> {
    return this.database.user.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ paidUntil: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        telegramUsername: true,
        monthlyPrice: true,
        status: true,
        startedAt: true,
        paidUntil: true,
      },
    });
  }

  public async updatePrice(id: string, monthlyPrice: Prisma.Decimal): Promise<UserListItem> {
    return this.database.user.update({
      where: { id },
      data: { monthlyPrice },
      select: {
        id: true,
        name: true,
        telegramUsername: true,
        monthlyPrice: true,
        status: true,
        startedAt: true,
        paidUntil: true,
      },
    });
  }

  public async updateStatus(id: string, status: UserStatus): Promise<UserListItem> {
    return this.database.user.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        name: true,
        telegramUsername: true,
        monthlyPrice: true,
        status: true,
        startedAt: true,
        paidUntil: true,
      },
    });
  }

  public async updatePaidUntil(id: string, paidUntil: Date | null): Promise<UserListItem> {
    return this.database.user.update({
      where: { id },
      data: { paidUntil },
      select: {
        id: true,
        name: true,
        telegramUsername: true,
        monthlyPrice: true,
        status: true,
        startedAt: true,
        paidUntil: true,
      },
    });
  }

  public async delete(id: string): Promise<UserListItem> {
    return this.database.user.delete({
      where: { id },
      select: {
        id: true,
        name: true,
        telegramUsername: true,
        monthlyPrice: true,
        status: true,
        startedAt: true,
        paidUntil: true,
      },
    });
  }
}
