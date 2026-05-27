import { type Context, Telegraf } from 'telegraf';
import type { Logger } from 'pino';

import type { AppConfig } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { PaymentClaimsRepository } from '../modules/payment-claims/paymentClaims.repository.js';
import { PaymentClaimsService } from '../modules/payment-claims/paymentClaims.service.js';
import { PaymentsRepository } from '../modules/payments/payments.repository.js';
import { PaymentsService } from '../modules/payments/payments.service.js';
import { UserAccessRepository } from '../modules/user-access/userAccess.repository.js';
import { UserAccessService } from '../modules/user-access/userAccess.service.js';
import { UsersRepository } from '../modules/users/users.repository.js';
import { UsersService } from '../modules/users/users.service.js';
import { AppError } from '../shared/errors/app-error.js';
import { registerAddUserCommand } from './admin/commands/addUser.command.js';
import { registerReviewPaymentClaimActions } from './admin/actions/reviewPaymentClaim.action.js';
import { registerAdminPanelCommand } from './admin/commands/adminPanel.command.js';
import { registerDebtorsCommand } from './admin/commands/debtors.command.js';
import { registerHelpCommand } from './admin/commands/help.command.js';
import { registerHistoryCommand } from './admin/commands/history.command.js';
import { registerInviteCommand } from './admin/commands/invite.command.js';
import { registerPaidCommand } from './admin/commands/paid.command.js';
import { registerRemindCommand } from './admin/commands/remind.command.js';
import { registerSetPriceCommand } from './admin/commands/setPrice.command.js';
import { registerSetStatusCommand } from './admin/commands/setStatus.command.js';
import { registerUsersCommand } from './admin/commands/users.command.js';
import { adminOnly } from './admin/middlewares/adminOnly.middleware.js';
import { registerUserStartCommand } from './user/start.command.js';
import { registerUserStatusCommand } from './user/status.command.js';
import { registerPaymentClaimAction } from './user/paymentClaim.action.js';

export function createBot(config: AppConfig, logger: Logger): Telegraf<Context> {
  const bot = new Telegraf<Context>(config.botToken);
  const usersService = new UsersService(new UsersRepository(prisma), config.timeZone);
  const paymentsService = new PaymentsService(new PaymentsRepository(prisma), config.timeZone);
  const paymentClaimsService = new PaymentClaimsService(new PaymentClaimsRepository(prisma));
  const userAccessService = new UserAccessService(
    new UserAccessRepository(prisma),
    config.timeZone,
    config.inviteExpiresHours,
    config.paymentInfo,
  );

  registerUserStartCommand(bot, userAccessService, config.adminTelegramIds);
  registerUserStatusCommand(bot, userAccessService);
  registerPaymentClaimAction(bot, paymentClaimsService, userAccessService, config.adminTelegramIds);
  bot.use(adminOnly(config.adminTelegramIds, logger));
  registerAdminPanelCommand(bot, usersService, paymentClaimsService, config.remindDaysBefore);
  registerHelpCommand(bot);
  registerAddUserCommand(bot, usersService);
  registerUsersCommand(bot, usersService);
  registerSetPriceCommand(bot, usersService);
  registerSetStatusCommand(bot, usersService);
  registerPaidCommand(bot, paymentsService);
  registerHistoryCommand(bot, paymentsService);
  registerDebtorsCommand(bot, usersService);
  registerRemindCommand(bot, usersService, config.remindDaysBefore);
  registerInviteCommand(bot, userAccessService);
  registerReviewPaymentClaimActions(bot, paymentClaimsService, paymentsService);

  bot.catch(async (error, context) => {
    if (error instanceof AppError) {
      logger.info(
        {
          errorCode: error.code,
          updateId: context.update.update_id,
          telegramId: context.from?.id,
        },
        'Команда отклонена из-за некорректных данных',
      );
      await context.reply(error.message);
      return;
    }

    logger.error(
      {
        err: error,
        updateId: context.update.update_id,
        telegramId: context.from?.id,
      },
      'Ошибка обработки Telegram update',
    );
    await context.reply('Не удалось выполнить команду. Попробуйте ещё раз.');
  });

  return bot;
}

export async function startBot(
  bot: Telegraf<Context>,
  logger: Logger,
  adminTelegramIds: ReadonlySet<number>,
): Promise<void> {
  const botInfo = await bot.telegram.getMe();
  bot.botInfo = botInfo;

  const adminCommands = [
    { command: 'start', description: 'Проверить доступ к боту' },
    { command: 'admin', description: 'Открыть панель администратора' },
    { command: 'help', description: 'Показать справку' },
    { command: 'add_user', description: 'Добавить пользователя VPN' },
    { command: 'users', description: 'Показать пользователей' },
    { command: 'set_price', description: 'Изменить тариф пользователя' },
    { command: 'set_status', description: 'Изменить статус пользователя' },
    { command: 'paid', description: 'Подтвердить полученную оплату' },
    { command: 'history', description: 'Показать историю оплат' },
    { command: 'debtors', description: 'Показать просроченные оплаты' },
    { command: 'remind', description: 'Показать ближайшие оплаты' },
    { command: 'invite', description: 'Выдать ссылку пользователю' },
    { command: 'status', description: 'Мой статус VPN' },
  ];

  await bot.telegram.setMyCommands([{ command: 'status', description: 'Мой статус VPN' }]);
  await Promise.all(
    [...adminTelegramIds].map((adminTelegramId) =>
      bot.telegram.setMyCommands(adminCommands, {
        scope: { type: 'chat', chat_id: adminTelegramId },
      }),
    ),
  );

  await bot.launch(
    {
      allowedUpdates: ['message', 'callback_query'],
    },
    () => {
      logger.info({ botUsername: botInfo.username }, 'Telegram-бот запущен в режиме polling');
    },
  );
}
