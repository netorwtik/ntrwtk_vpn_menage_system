import { createHash, randomBytes } from 'node:crypto';

import { UserStatus } from '@prisma/client';

import {
  addCalendarDays,
  currentCalendarDate,
  differenceInDays,
  formatDate,
} from '../../shared/date/date.utils.js';
import { AppError } from '../../shared/errors/app-error.js';
import { formatMoney } from '../../shared/money/money.utils.js';
import type { PaymentInfoConfig } from '../../config/env.js';
import type { UserAccessRepository } from './userAccess.repository.js';
import type { AccessUser } from './userAccess.types.js';

const USERNAME_PATTERN = /^@[A-Za-z0-9_]{5,32}$/;
const STATUS_LABELS: Record<UserStatus, string> = {
  [UserStatus.ACTIVE]: 'активен',
  [UserStatus.PAUSED]: 'приостановлен',
  [UserStatus.DISABLED]: 'отключен',
};

export class UserAccessService {
  public constructor(
    private readonly repository: UserAccessRepository,
    private readonly timeZone: string,
    private readonly inviteExpiresHours: number,
    private readonly paymentInfo: PaymentInfoConfig,
  ) {}

  public async createInviteLink(
    telegramUsernameValue: string,
    createdByTelegramId: number,
    botUsername: string,
  ): Promise<string> {
    const telegramUsername = this.normalizeUsername(telegramUsernameValue);
    const user = await this.repository.findUserByUsername(telegramUsername);

    if (user === null) {
      throw new AppError(`Пользователь ${telegramUsername} не найден.`, 'USER_NOT_FOUND');
    }

    if (user.telegramId !== null) {
      throw new AppError(
        `Пользователь ${telegramUsername} уже привязан к Telegram-аккаунту.`,
        'USER_ALREADY_LINKED',
      );
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.inviteExpiresHours * 60 * 60 * 1000);
    await this.repository.createInvite(
      user.id,
      this.hashToken(token),
      expiresAt,
      BigInt(createdByTelegramId),
    );

    return [
      `Ссылка для подключения пользователя ${user.name} (${telegramUsername}):`,
      '',
      `https://t.me/${botUsername}?start=${token}`,
      '',
      `Ссылка одноразовая и действует ${this.inviteExpiresHours} ч.`,
    ].join('\n');
  }

  public async bindUser(token: string, telegramId: number): Promise<string> {
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) {
      throw new AppError('Ссылка приглашения недействительна.', 'INVALID_INVITE_TOKEN');
    }

    const result = await this.repository.bindByInvite(
      this.hashToken(token),
      BigInt(telegramId),
      new Date(),
    );

    switch (result.status) {
      case 'linked':
        return [
          `Здравствуйте, ${result.user.name}!`,
          '',
          'Ваш Telegram-аккаунт привязан к VPN-профилю.',
          'Нажмите «Мой статус», чтобы проверить доступ, или «Оплата» для перевода.',
        ].join('\n');
      case 'already_linked':
        return 'Ваш Telegram-аккаунт уже привязан к этому VPN-профилю.';
      case 'invite_expired':
        throw new AppError(
          'Срок действия приглашения истёк. Запросите новую ссылку.',
          'INVITE_EXPIRED',
        );
      case 'invite_used':
        throw new AppError('Эта ссылка приглашения уже использована.', 'INVITE_USED');
      case 'user_linked_to_another_account':
        throw new AppError(
          'VPN-профиль уже привязан к другому Telegram-аккаунту.',
          'USER_ALREADY_LINKED',
        );
      case 'telegram_account_already_linked':
        throw new AppError(
          'Ваш Telegram-аккаунт уже связан с другим VPN-профилем.',
          'TELEGRAM_ALREADY_LINKED',
        );
      case 'invite_not_found':
        throw new AppError('Ссылка приглашения недействительна.', 'INVITE_NOT_FOUND');
    }
  }

  public async getStatusMessage(telegramId: number): Promise<string> {
    const user = await this.repository.findByTelegramId(BigInt(telegramId));

    if (user === null) {
      return 'Ваш аккаунт ещё не привязан к VPN-профилю. Получите персональную ссылку у администратора.';
    }

    return this.formatStatus(user);
  }

  public async getPaymentCardMessage(telegramId: number): Promise<string> {
    const user = await this.repository.findByTelegramId(BigInt(telegramId));

    if (user === null) {
      throw new AppError(
        'Ваш аккаунт ещё не привязан к VPN-профилю. Получите персональную ссылку у администратора.',
        'USER_NOT_LINKED',
      );
    }

    const paymentInstructions = [
      ...(this.paymentInfo.recipient === undefined
        ? []
        : [`• Получатель: ${this.paymentInfo.recipient}`]),
      ...(this.paymentInfo.details === undefined
        ? []
        : [`• Реквизиты: ${this.paymentInfo.details}`]),
      ...(this.paymentInfo.supportUsername === undefined
        ? []
        : [`• Для связи: ${this.paymentInfo.supportUsername}`]),
    ];

    return [
      '💳 Оплата VPN',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      '📌 Ваш тариф',
      `• К оплате: ${formatMoney(user.monthlyPrice)}`,
      `• Оплачено до: ${user.paidUntil === null ? 'оплата не зафиксирована' : formatDate(user.paidUntil)}`,
      '',
      '🏦 Как оплатить',
      'Переведите деньги удобным способом вне бота.',
      ...(paymentInstructions.length === 0
        ? ['• Для получения реквизитов напишите администратору.']
        : paymentInstructions),
      '',
      '✅ После перевода нажмите «Я оплатил».',
      'Доступ будет продлён после проверки.',
    ].join('\n');
  }

  private formatStatus(user: AccessUser): string {
    const today = currentCalendarDate(this.timeZone);

    if (user.status !== UserStatus.ACTIVE) {
      return [
        `📋 Ваш VPN-профиль: ${STATUS_LABELS[user.status]}.`,
        '━━━━━━━━━━━━━━━━━━━━',
        '',
        `• Тариф: ${formatMoney(user.monthlyPrice)} / месяц`,
        `• Оплачено до: ${user.paidUntil === null ? 'оплата не зафиксирована' : formatDate(user.paidUntil)}`,
      ].join('\n');
    }

    if (user.paidUntil === null) {
      return [
        '⚠️ Ваш VPN-доступ требует оплаты.',
        '━━━━━━━━━━━━━━━━━━━━',
        '',
        'Оплата ещё не подтверждена.',
        `• К оплате: ${formatMoney(user.monthlyPrice)}`,
      ].join('\n');
    }

    const daysLeft = differenceInDays(user.paidUntil, today);

    if (daysLeft < 0) {
      return [
        '⚠️ Ваш VPN-доступ требует оплаты.',
        '━━━━━━━━━━━━━━━━━━━━',
        '',
        `• Оплачено до: ${formatDate(user.paidUntil)}`,
        `• Просрочка: ${Math.abs(daysLeft)} дн.`,
        `• К оплате: ${formatMoney(user.monthlyPrice)}`,
      ].join('\n');
    }

    return [
      '✅ Ваш VPN-доступ активен.',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      `• Оплачено до: ${formatDate(user.paidUntil)}`,
      `• Осталось дней: ${daysLeft}`,
      `• Следующая оплата: ${formatDate(addCalendarDays(user.paidUntil, 1))}`,
      `• Тариф: ${formatMoney(user.monthlyPrice)} / месяц`,
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

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
