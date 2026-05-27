import { Prisma } from '@prisma/client';

import { AppError } from '../errors/app-error.js';

const MAX_AMOUNT = new Prisma.Decimal('99999999.99');
const MONEY_PATTERN = /^\d+(?:[.,]\d{1,2})?$/;

export function parsePositiveAmount(value: string, fieldName = 'Сумма'): Prisma.Decimal {
  if (!MONEY_PATTERN.test(value.trim())) {
    throw new AppError(`${fieldName} должна быть положительным числом в рублях.`, 'INVALID_AMOUNT');
  }

  const amount = new Prisma.Decimal(value.trim().replace(',', '.'));

  if (amount.lessThanOrEqualTo(0) || amount.greaterThan(MAX_AMOUNT)) {
    throw new AppError(
      `${fieldName} должна быть больше 0 и не превышать 99 999 999,99 ₽.`,
      'INVALID_AMOUNT',
    );
  }

  return amount;
}

export function formatMoney(amount: Prisma.Decimal): string {
  return `${new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: amount.isInteger() ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount.toNumber())} ₽`;
}
