import type { Context, Telegraf } from 'telegraf';

import type { AddUserRequest, UsersService } from '../../../modules/users/users.service.js';
import { AppError } from '../../../shared/errors/app-error.js';

const COMMAND_EXAMPLE = '/add_user @ivan Иван Петров | 300 | Комментарий';

function parseAddUserPayload(payload: string): AddUserRequest {
  const [identityPart, pricePart, commentPart, ...extraParts] = payload
    .split('|')
    .map((part) => part.trim());

  if (
    identityPart === undefined ||
    pricePart === undefined ||
    extraParts.length > 0 ||
    identityPart.length === 0 ||
    pricePart.length === 0
  ) {
    throw new AppError(`Использование:\n${COMMAND_EXAMPLE}`, 'INVALID_ADD_USER_COMMAND');
  }

  const identityMatch = /^(\S+)\s+(.+)$/.exec(identityPart);

  if (identityMatch === null) {
    throw new AppError(`Использование:\n${COMMAND_EXAMPLE}`, 'INVALID_ADD_USER_COMMAND');
  }

  const [, telegramUsername, name] = identityMatch;

  if (telegramUsername === undefined || name === undefined) {
    throw new AppError(`Использование:\n${COMMAND_EXAMPLE}`, 'INVALID_ADD_USER_COMMAND');
  }

  return {
    telegramUsername,
    name,
    monthlyPrice: pricePart,
    ...(commentPart === undefined ? {} : { comment: commentPart }),
  };
}

export function registerAddUserCommand(bot: Telegraf<Context>, usersService: UsersService): void {
  bot.command('add_user', async (context) => {
    const request = parseAddUserPayload(context.payload);
    const user = await usersService.addUser(request);

    await context.reply(usersService.formatCreatedUser(user));
  });
}
