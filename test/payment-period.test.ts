import assert from 'node:assert/strict';
import test from 'node:test';

import { PaymentSource, Prisma, UserStatus } from '@prisma/client';

import { PaymentsService } from '../src/modules/payments/payments.service.js';
import type { PaymentUser } from '../src/modules/payments/payments.types.js';
import type { PaymentsRepository } from '../src/modules/payments/payments.repository.js';

function createUser(overrides: Partial<PaymentUser> = {}): PaymentUser {
  return {
    id: 'b6a25e54-ec9f-4c20-bc30-f16212a8936b',
    name: 'Тестовый пользователь',
    telegramUsername: '@test_user',
    telegramId: 123456n,
    monthlyPrice: new Prisma.Decimal(300),
    paymentDueDay: null,
    status: UserStatus.ACTIVE,
    paidUntil: null,
    ...overrides,
  };
}

function buildPaymentData(service: PaymentsService, user: PaymentUser, paymentDate: Date) {
  return (
    service as unknown as {
      buildPaymentData: (
        user: PaymentUser,
        amount: Prisma.Decimal,
        details: {
          paymentDate: Date;
          paymentMethod: string | null;
          source: PaymentSource;
          confirmedByTelegramId: bigint;
          comment?: string;
        },
      ) => { periodStart: Date; periodEnd: Date };
    }
  ).buildPaymentData(user, new Prisma.Decimal(300), {
    paymentDate,
    paymentMethod: 'sbp',
    source: PaymentSource.ADMIN_MANUAL,
    confirmedByTelegramId: 1n,
  });
}

test('первая оплата фиксирует расчетный день по дате платежа', () => {
  const service = new PaymentsService({} as PaymentsRepository, 'Europe/Moscow');
  const payment = buildPaymentData(
    service,
    createUser(),
    new Date('2026-07-19T00:00:00.000Z'),
  );

  assert.equal(payment.paymentDueDay, 19);
  assert.equal(payment.periodStart.toISOString(), '2026-07-20T00:00:00.000Z');
  assert.equal(payment.periodEnd.toISOString(), '2026-08-19T00:00:00.000Z');
});

test('просроченная оплата продлевает доступ до дня первой оплаты', () => {
  const service = new PaymentsService({} as PaymentsRepository, 'Europe/Moscow');
  const payment = buildPaymentData(
    service,
    createUser({ paymentDueDay: 19, paidUntil: new Date('2026-08-19T00:00:00.000Z') }),
    new Date('2026-08-21T00:00:00.000Z'),
  );

  assert.equal(payment.paymentDueDay, 19);
  assert.equal(payment.periodStart.toISOString(), '2026-08-20T00:00:00.000Z');
  assert.equal(payment.periodEnd.toISOString(), '2026-09-19T00:00:00.000Z');
});

test('старый сдвинутый paidUntil выравнивается на день первой оплаты', () => {
  const service = new PaymentsService({} as PaymentsRepository, 'Europe/Moscow');
  const payment = buildPaymentData(
    service,
    createUser({ paymentDueDay: 24, paidUntil: new Date('2026-06-29T00:00:00.000Z') }),
    new Date('2026-07-10T00:00:00.000Z'),
  );

  assert.equal(payment.periodStart.toISOString(), '2026-06-25T00:00:00.000Z');
  assert.equal(payment.periodEnd.toISOString(), '2026-07-24T00:00:00.000Z');
});

test('день оплаты 31 восстанавливается после короткого месяца', () => {
  const service = new PaymentsService({} as PaymentsRepository, 'Europe/Moscow');
  const payment = buildPaymentData(
    service,
    createUser({ paymentDueDay: 31 }),
    new Date('2026-03-05T00:00:00.000Z'),
  );

  assert.equal(payment.periodStart.toISOString(), '2026-03-01T00:00:00.000Z');
  assert.equal(payment.periodEnd.toISOString(), '2026-03-31T00:00:00.000Z');
});
