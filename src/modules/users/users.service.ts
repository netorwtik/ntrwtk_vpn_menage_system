import { UserStatus } from '@prisma/client';

import {
  addCalendarDays,
  addCalendarMonths,
  currentCalendarDate,
  differenceInDays,
  formatDate,
  parseDisplayDate,
} from '../../shared/date/date.utils.js';
import { AppError } from '../../shared/errors/app-error.js';
import { formatMoney, parsePositiveAmount } from '../../shared/money/money.utils.js';
import type { UserListItem } from './users.types.js';
import type { UsersRepository } from './users.repository.js';

const USERNAME_PATTERN = /^@[A-Za-z0-9_]{5,32}$/;
const STATUS_LABELS: Record<UserStatus, string> = {
  [UserStatus.ACTIVE]: 'активен',
  [UserStatus.PAUSED]: 'приостановлен',
  [UserStatus.DISABLED]: 'отключен',
};

export interface AddUserRequest {
  name: string;
  telegramUsername: string;
  monthlyPrice: string;
  comment?: string;
}

export interface SetPriceRequest {
  telegramUsername: string;
  monthlyPrice: string;
}

export interface SetStatusRequest {
  telegramUsername: string;
  status: string;
}

export interface SetPaidUntilRequest {
  telegramUsername: string;
  paidUntil: string;
}

export interface AdminDashboardStats {
  usersCount: number;
  activeUsersCount: number;
  debtorsCount: number;
  upcomingPaymentsCount: number;
}

export class UsersService {
  public constructor(
    private readonly usersRepository: UsersRepository,
    private readonly timeZone: string,
  ) {}

  public async addUser(request: AddUserRequest): Promise<UserListItem> {
    const telegramUsername = this.normalizeUsername(request.telegramUsername);
    const name = request.name.trim();

    if (name.length === 0 || name.length > 120) {
      throw new AppError('Имя должно содержать от 1 до 120 символов.', 'INVALID_USER_NAME');
    }

    const existing = await this.usersRepository.findByTelegramUsername(telegramUsername);

    if (existing !== null) {
      throw new AppError(`Пользователь ${telegramUsername} уже существует.`, 'USER_ALREADY_EXISTS');
    }

    const comment = request.comment?.trim();

    return this.usersRepository.create({
      name,
      telegramUsername,
      monthlyPrice: parsePositiveAmount(request.monthlyPrice, 'Тариф'),
      startedAt: currentCalendarDate(this.timeZone),
      ...(comment === undefined || comment.length === 0 ? {} : { comment }),
    });
  }

  public async listUsers(): Promise<UserListItem[]> {
    return this.usersRepository.findAll();
  }

  public async getUserCard(userId: string): Promise<string> {
    const user = await this.requireById(userId);
    const today = currentCalendarDate(this.timeZone);

    return [
      `👤 ${user.name}`,
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      '📌 Профиль',
      `• Username: ${user.telegramUsername ?? '-'}`,
      `• Статус: ${STATUS_LABELS[user.status]}`,
      `• Тариф: ${formatMoney(user.monthlyPrice)} / месяц`,
      '',
      '💳 Оплата',
      `• Оплачено до: ${this.formatPaidUntil(user.paidUntil, today)}`,
      `• Дата старта: ${formatDate(user.startedAt)}`,
    ].join('\n');
  }

  public async getAdminDashboardStats(daysBefore: number): Promise<AdminDashboardStats> {
    const today = currentCalendarDate(this.timeZone);
    const users = await this.usersRepository.findAll();
    const activeUsers = users.filter((user) => user.status === UserStatus.ACTIVE);
    const dueDays = activeUsers.map((user) => this.getDaysUntilDue(user, today));

    return {
      usersCount: users.length,
      activeUsersCount: activeUsers.length,
      debtorsCount: dueDays.filter((days) => days < 0).length,
      upcomingPaymentsCount: dueDays.filter((days) => days >= 0 && days <= daysBefore).length,
    };
  }

  public async setPrice(request: SetPriceRequest): Promise<UserListItem> {
    const user = await this.requireByUsername(request.telegramUsername);
    const monthlyPrice = parsePositiveAmount(request.monthlyPrice, 'Тариф');

    return this.usersRepository.updatePrice(user.id, monthlyPrice);
  }

  public async setStatus(request: SetStatusRequest): Promise<UserListItem> {
    const user = await this.requireByUsername(request.telegramUsername);
    const status = this.parseStatus(request.status);

    return this.usersRepository.updateStatus(user.id, status);
  }

  public async setPaidUntil(request: SetPaidUntilRequest): Promise<UserListItem> {
    const user = await this.requireByUsername(request.telegramUsername);
    const paidUntil = this.parsePaidUntil(request.paidUntil);

    return this.usersRepository.updatePaidUntil(user.id, paidUntil);
  }

  public async setPaidUntilByUserId(userId: string, paidUntilValue: string): Promise<UserListItem> {
    const user = await this.requireById(userId);
    const paidUntil = this.parsePaidUntil(paidUntilValue);

    return this.usersRepository.updatePaidUntil(user.id, paidUntil);
  }

  public async adjustPaidUntilByUserId(userId: string, adjustment: string): Promise<UserListItem> {
    const user = await this.requireById(userId);

    if (adjustment === 'none') {
      return this.usersRepository.updatePaidUntil(user.id, null);
    }

    const baseDate = user.paidUntil ?? currentCalendarDate(this.timeZone);

    switch (adjustment) {
      case 'p1m':
      case 'plus_1_month':
        return this.usersRepository.updatePaidUntil(user.id, addCalendarMonths(baseDate, 1));
      case 'm1m':
      case 'minus_1_month':
        return this.usersRepository.updatePaidUntil(user.id, addCalendarMonths(baseDate, -1));
      case 'p7d':
      case 'plus_7_days':
        return this.usersRepository.updatePaidUntil(user.id, addCalendarDays(baseDate, 7));
      case 'm7d':
      case 'minus_7_days':
        return this.usersRepository.updatePaidUntil(user.id, addCalendarDays(baseDate, -7));
      default:
        throw new AppError(
          'Неизвестная корректировка даты оплаты.',
          'INVALID_PAID_UNTIL_ADJUSTMENT',
        );
    }
  }

  public async getDebtorsMessage(): Promise<string> {
    const today = currentCalendarDate(this.timeZone);
    const users = await this.usersRepository.findActive();
    const debtors = users.filter((user) => this.getDaysUntilDue(user, today) < 0);

    if (debtors.length === 0) {
      return ['✅ Должники', '━━━━━━━━━━━━━━━━━━━━', '', 'Просроченных оплат нет.'].join('\n');
    }

    const rows = debtors.map((user, index) => {
      const overdueDays = Math.abs(this.getDaysUntilDue(user, today));

      return [
        `${index + 1}. ${user.name} (${user.telegramUsername ?? '-'})`,
        `   • Просрочка: ${overdueDays} дн.`,
        `   • К оплате: ${formatMoney(user.monthlyPrice)}`,
      ].join('\n');
    });

    return ['⚠️ Должники', '━━━━━━━━━━━━━━━━━━━━', '', ...rows].join('\n\n');
  }

  public async getRemindersMessage(daysBefore: number): Promise<string> {
    const today = currentCalendarDate(this.timeZone);
    const users = await this.usersRepository.findActive();
    const reminders = users.filter((user) => {
      const daysUntilDue = this.getDaysUntilDue(user, today);

      return daysUntilDue < 0 || daysUntilDue <= daysBefore;
    });

    if (reminders.length === 0) {
      return [
        '✅ Ближайшие оплаты',
        '━━━━━━━━━━━━━━━━━━━━',
        '',
        `Нет активных пользователей с оплатой в ближайшие ${daysBefore} дн. или просрочкой.`,
      ].join('\n');
    }

    const rows = reminders.map((user, index) => {
      const daysUntilDue = this.getDaysUntilDue(user, today);

      return [
        `${index + 1}. ${user.name} (${user.telegramUsername ?? '-'})`,
        `   • ${this.formatReminderState(user, daysUntilDue)}`,
        `   • К оплате: ${formatMoney(user.monthlyPrice)}`,
      ].join('\n');
    });

    return [
      '⏰ Ближайшие оплаты',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      `Порог: ${daysBefore} дн.`,
      '',
      ...rows,
    ].join('\n\n');
  }

  public formatCreatedUser(user: UserListItem): string {
    return [
      'Пользователь добавлен.',
      '',
      `${user.name} (${user.telegramUsername ?? '-'})`,
      `Тариф: ${formatMoney(user.monthlyPrice)} / месяц`,
      `Статус: ${STATUS_LABELS[user.status]}`,
      'Оплачено до: оплата не зафиксирована',
    ].join('\n');
  }

  public formatUsersList(users: UserListItem[]): string {
    if (users.length === 0) {
      return [
        '👥 Пользователи',
        '━━━━━━━━━━━━━━━━━━━━',
        '',
        'Пользователей пока нет. Добавьте первого командой /add_user.',
      ].join('\n');
    }

    const today = currentCalendarDate(this.timeZone);
    const rows = users.map((user, index) => {
      return [
        `${index + 1}. ${user.name} (${user.telegramUsername ?? '-'})`,
        `   • Тариф: ${formatMoney(user.monthlyPrice)} / месяц`,
        `   • Статус: ${STATUS_LABELS[user.status]}`,
        `   • Оплачено до: ${this.formatPaidUntil(user.paidUntil, today)}`,
      ].join('\n');
    });

    return [
      '👥 Пользователи',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      `Всего: ${users.length}`,
      '',
      ...rows,
    ].join('\n\n');
  }

  public formatUpdatedPrice(user: UserListItem): string {
    return [
      'Тариф обновлен.',
      '',
      `${user.name} (${user.telegramUsername ?? '-'})`,
      `Новый тариф: ${formatMoney(user.monthlyPrice)} / месяц`,
    ].join('\n');
  }

  public formatUpdatedStatus(user: UserListItem): string {
    return [
      'Статус обновлен.',
      '',
      `${user.name} (${user.telegramUsername ?? '-'})`,
      `Новый статус: ${STATUS_LABELS[user.status]}`,
    ].join('\n');
  }

  public formatUpdatedPaidUntil(user: UserListItem): string {
    return [
      '✅ Дата оплаты обновлена',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      `👤 ${user.name} (${user.telegramUsername ?? '-'})`,
      `• Оплачено до: ${user.paidUntil === null ? 'оплата не зафиксирована' : formatDate(user.paidUntil)}`,
    ].join('\n');
  }

  private normalizeUsername(value: string): string {
    const username = value.trim();

    if (!USERNAME_PATTERN.test(username)) {
      throw new AppError(
        'Username должен иметь формат @username и содержать от 5 до 32 символов.',
        'INVALID_TELEGRAM_USERNAME',
      );
    }

    return username.toLowerCase();
  }

  private async requireByUsername(telegramUsername: string): Promise<UserListItem> {
    const normalizedUsername = this.normalizeUsername(telegramUsername);
    const user = await this.usersRepository.findByTelegramUsername(normalizedUsername);

    if (user === null) {
      throw new AppError(`Пользователь ${normalizedUsername} не найден.`, 'USER_NOT_FOUND');
    }

    return user;
  }

  private async requireById(userId: string): Promise<UserListItem> {
    const user = await this.usersRepository.findById(userId);

    if (user === null) {
      throw new AppError('Пользователь не найден.', 'USER_NOT_FOUND');
    }

    return user;
  }

  private parseStatus(value: string): UserStatus {
    switch (value.trim().toLowerCase()) {
      case 'active':
        return UserStatus.ACTIVE;
      case 'paused':
        return UserStatus.PAUSED;
      case 'disabled':
        return UserStatus.DISABLED;
      default:
        throw new AppError(
          'Статус должен быть одним из значений: active, paused, disabled.',
          'INVALID_USER_STATUS',
        );
    }
  }

  private parsePaidUntil(value: string): Date | null {
    if (value.trim().toLowerCase() === 'none') {
      return null;
    }

    const date = parseDisplayDate(value);

    if (date === null) {
      throw new AppError(
        'Дата должна быть в формате DD.MM.YYYY или none, чтобы сбросить оплату.',
        'INVALID_PAID_UNTIL',
      );
    }

    return date;
  }

  private formatPaidUntil(paidUntil: Date | null, today: Date): string {
    if (paidUntil === null) {
      return 'оплата не зафиксирована';
    }

    const days = differenceInDays(paidUntil, today);

    if (days < 0) {
      return `${formatDate(paidUntil)} (просрочка ${Math.abs(days)} дн.)`;
    }

    if (days === 0) {
      return `${formatDate(paidUntil)} (заканчивается сегодня)`;
    }

    return `${formatDate(paidUntil)} (осталось ${days} дн.)`;
  }

  private getDaysUntilDue(user: UserListItem, today: Date): number {
    return differenceInDays(user.paidUntil ?? user.startedAt, today);
  }

  private formatReminderState(user: UserListItem, daysUntilDue: number): string {
    if (user.paidUntil === null) {
      if (daysUntilDue < 0) {
        return `Первая оплата просрочена на ${Math.abs(daysUntilDue)} дн.`;
      }

      return 'Ожидается первая оплата';
    }

    if (daysUntilDue < 0) {
      return `Просрочка: ${Math.abs(daysUntilDue)} дн.`;
    }

    if (daysUntilDue === 0) {
      return 'Оплата заканчивается сегодня';
    }

    return `До окончания оплаты: ${daysUntilDue} дн.`;
  }
}
