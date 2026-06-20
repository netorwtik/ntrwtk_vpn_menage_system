import assert from 'node:assert/strict';
import test from 'node:test';

import { Prisma, UserStatus } from '@prisma/client';

import type { UserAccessRepository } from '../src/modules/user-access/userAccess.repository.js';
import { UserAccessService } from '../src/modules/user-access/userAccess.service.js';
import type { UsersRepository } from '../src/modules/users/users.repository.js';
import { UsersService } from '../src/modules/users/users.service.js';
import type { UserListItem } from '../src/modules/users/users.types.js';
import { AppError } from '../src/shared/errors/app-error.js';

test('администратор не может активировать приглашение, и оно не расходуется', async () => {
  let bindCalls = 0;
  const repository = {
    bindByInvite: async () => {
      bindCalls += 1;
      return { status: 'invite_not_found' as const };
    },
  } as unknown as UserAccessRepository;
  const service = new UserAccessService(repository, 'Europe/Moscow', 24, {}, new Set([123456]));

  await assert.rejects(
    service.bindUser('a'.repeat(32), 123456),
    (error: unknown) => error instanceof AppError && error.code === 'ADMIN_CANNOT_BIND_INVITE',
  );
  assert.equal(bindCalls, 0);
});

test('удаление пользователя передаётся репозиторию после проверки существования', async () => {
  const user: UserListItem = {
    id: 'b6a25e54-ec9f-4c20-bc30-f16212a8936b',
    name: 'Тестовый пользователь',
    telegramUsername: '@test_user',
    monthlyPrice: new Prisma.Decimal(300),
    status: UserStatus.ACTIVE,
    startedAt: new Date('2026-06-01T00:00:00.000Z'),
    paidUntil: null,
  };
  const deletedIds: string[] = [];
  const repository = {
    findById: async (id: string) => (id === user.id ? user : null),
    delete: async (id: string) => {
      deletedIds.push(id);
      return user;
    },
  } as unknown as UsersRepository;
  const service = new UsersService(repository, 'Europe/Moscow');

  const deletedUser = await service.deleteUser(user.id);

  assert.equal(deletedUser, user);
  assert.deepEqual(deletedIds, [user.id]);
});

test('несуществующий пользователь не передаётся на удаление', async () => {
  let deleteCalls = 0;
  const repository = {
    findById: async () => null,
    delete: async () => {
      deleteCalls += 1;
      throw new Error('delete не должен вызываться');
    },
  } as unknown as UsersRepository;
  const service = new UsersService(repository, 'Europe/Moscow');

  await assert.rejects(
    service.deleteUser('b6a25e54-ec9f-4c20-bc30-f16212a8936b'),
    (error: unknown) => error instanceof AppError && error.code === 'USER_NOT_FOUND',
  );
  assert.equal(deleteCalls, 0);
});
