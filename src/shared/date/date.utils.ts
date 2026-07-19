const DATE_FORMATTER_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
};

function getCalendarParts(
  date: Date,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

export function currentCalendarDate(timeZone: string): Date {
  const { year, month, day } = getCalendarParts(new Date(), timeZone);

  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', DATE_FORMATTER_OPTIONS).format(date);
}

export function parseDisplayDate(value: string): Date | null {
  const match = /^(?<day>\d{2})\.(?<month>\d{2})\.(?<year>\d{4})$/.exec(value.trim());

  if (match?.groups === undefined) {
    return null;
  }

  const day = Number(match.groups.day);
  const month = Number(match.groups.month);
  const year = Number(match.groups.year);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export function differenceInDays(date: Date, relativeTo: Date): number {
  const millisecondsInDay = 24 * 60 * 60 * 1000;

  return Math.round((date.getTime() - relativeTo.getTime()) / millisecondsInDay);
}

export function addCalendarDays(date: Date, amount: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + amount));
}

export function addCalendarMonths(date: Date, amount: number): Date {
  const targetMonthStart = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1),
  );
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetMonthStart.getUTCFullYear(), targetMonthStart.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const day = Math.min(date.getUTCDate(), lastDayOfTargetMonth);

  return new Date(Date.UTC(targetMonthStart.getUTCFullYear(), targetMonthStart.getUTCMonth(), day));
}

export function getLastDayOfUtcMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function dateInUtcMonth(year: number, monthIndex: number, day: number): Date {
  const clampedDay = Math.min(day, getLastDayOfUtcMonth(year, monthIndex));

  return new Date(Date.UTC(year, monthIndex, clampedDay));
}
