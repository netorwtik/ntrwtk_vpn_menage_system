import type { Telegram } from 'telegraf';
import type { Logger } from 'pino';

import type { PaymentInfoConfig } from '../../config/env.js';
import { currentCalendarDate, differenceInDays, formatDate } from '../../shared/date/date.utils.js';
import { formatMoney } from '../../shared/money/money.utils.js';
import { paymentCardKeyboard } from '../../bot/user/paymentClaim.action.js';
import type { RemindersRepository } from './reminders.repository.js';
import type { ManualReminderUser, OverdueReminderUser } from './reminders.types.js';

export class RemindersService {
  public constructor(
    private readonly repository: RemindersRepository,
    private readonly timeZone: string,
    private readonly paymentInfo: PaymentInfoConfig,
    private readonly logger: Logger,
  ) {}

  public async sendDailyOverdueReminders(telegram: Telegram): Promise<{
    candidates: number;
    sent: number;
    failed: number;
  }> {
    const today = currentCalendarDate(this.timeZone);
    const users = await this.repository.findUsersForOverdueReminder(today);
    let sent = 0;
    let failed = 0;

    for (const user of users) {
      try {
        const message = await telegram.sendMessage(
          user.telegramId.toString(),
          this.formatOverdueReminder(user, today),
          paymentCardKeyboard(),
        );
        const recorded = await this.repository.recordOverdueDelivery({
          userId: user.id,
          reminderDate: today,
          telegramMessageId: message.message_id,
        });

        if (recorded) {
          sent += 1;
        }
      } catch (error) {
        failed += 1;
        this.logger.warn(
          {
            err: error,
            userId: user.id,
            telegramId: user.telegramId.toString(),
          },
          'Не удалось отправить напоминание о просроченной оплате',
        );
      }
    }

    return { candidates: users.length, sent, failed };
  }

  public async listManualReminderUsers(): Promise<ManualReminderUser[]> {
    return this.repository.findManualReminderUsers();
  }

  public async sendManualReminder(
    telegram: Telegram,
    userId: string,
  ): Promise<
    | { status: 'sent'; user: ManualReminderUser }
    | { status: 'not_found' }
    | { status: 'not_linked'; user: ManualReminderUser }
  > {
    const user = await this.repository.findManualReminderUserById(userId);

    if (user === null) {
      return { status: 'not_found' };
    }

    if (user.telegramId === null) {
      return { status: 'not_linked', user };
    }

    await telegram.sendMessage(
      user.telegramId.toString(),
      this.formatManualReminder(user),
      paymentCardKeyboard(),
    );

    return { status: 'sent', user };
  }

  public formatManualReminderButton(user: ManualReminderUser): string {
    return `${user.name} 🔔`;
  }

  private formatOverdueReminder(user: OverdueReminderUser, today: Date): string {
    const dueDate = user.paidUntil ?? user.startedAt;
    const overdueDays = Math.abs(differenceInDays(dueDate, today));
    return [
      '⚠️ Напоминание об оплате VPN',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      '📌 Состояние оплаты',
      `• Ваш доступ просрочен на ${overdueDays} дн.`,
      `• Оплачено до: ${user.paidUntil === null ? 'оплата не зафиксирована' : formatDate(user.paidUntil)}`,
      `• К оплате: ${formatMoney(user.monthlyPrice)}`,
      '',
      '🏦 Реквизиты',
      ...this.formatPaymentInstructions(),
      '',
      '✅ После перевода нажмите «Я оплатил».',
      'Уведомления прекратятся только после подтверждения администратором.',
    ].join('\n');
  }

  private formatManualReminder(user: ManualReminderUser): string {
    return [
      '🔔 Напоминание об оплате VPN',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      '📌 Состояние оплаты',
      `• К оплате: ${formatMoney(user.monthlyPrice)}`,
      `• Оплачено до: ${user.paidUntil === null ? 'оплата не зафиксирована' : formatDate(user.paidUntil)}`,
      '',
      '🏦 Реквизиты',
      ...this.formatPaymentInstructions(),
      '',
      '✅ После перевода нажмите «Я оплатил».',
      'Доступ будет продлён после проверки администратором.',
    ].join('\n');
  }

  private formatPaymentInstructions(): string[] {
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

    if (paymentInstructions.length === 0) {
      return ['• Для получения реквизитов напишите администратору.'];
    }

    return paymentInstructions;
  }
}
