import type { Telegraf, Context } from 'telegraf';
import type { Logger } from 'pino';

import type { RemindersService } from './reminders.service.js';

export class RemindersScheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  public constructor(
    private readonly bot: Telegraf<Context>,
    private readonly remindersService: RemindersService,
    private readonly logger: Logger,
    private readonly sendHour: number,
    private readonly checkIntervalMinutes: number,
  ) {}

  public start(): void {
    if (this.timer !== null) {
      return;
    }

    this.logger.info(
      {
        sendHour: this.sendHour,
        checkIntervalMinutes: this.checkIntervalMinutes,
      },
      'Планировщик напоминаний запущен',
    );
    this.timer = setInterval(() => void this.runDueCheck(), this.checkIntervalMinutes * 60 * 1000);
    void this.runDueCheck();
  }

  public stop(): void {
    if (this.timer === null) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
    this.logger.info('Планировщик напоминаний остановлен');
  }

  public async runDueCheck(): Promise<void> {
    if (this.running || !this.isSendWindowOpen()) {
      return;
    }

    this.running = true;

    try {
      const result = await this.remindersService.sendDailyOverdueReminders(this.bot.telegram);

      if (result.candidates > 0 || result.failed > 0) {
        this.logger.info(result, 'Проверка ежедневных напоминаний завершена');
      }
    } finally {
      this.running = false;
    }
  }

  private isSendWindowOpen(): boolean {
    return new Date().getHours() >= this.sendHour;
  }
}
