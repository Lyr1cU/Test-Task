const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateOnly(value: string): Date {
  const match = DATE_ONLY.exec(value);
  if (!match) {
    throw new Error('Date must be YYYY-MM-DD');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error('Invalid date');
  }

  return date;
}

export function formatDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Full years between two dates. A year counts only after its anniversary.
 * Returns null when `on` is before `joinedAt` (the person is not employed yet).
 */
export function completedYears(joinedAt: Date, on: Date): number | null {
  const start = Date.UTC(
    joinedAt.getUTCFullYear(),
    joinedAt.getUTCMonth(),
    joinedAt.getUTCDate(),
  );
  const end = Date.UTC(on.getUTCFullYear(), on.getUTCMonth(), on.getUTCDate());
  if (end < start) {
    return null;
  }

  let years = on.getUTCFullYear() - joinedAt.getUTCFullYear();
  const monthDiff = on.getUTCMonth() - joinedAt.getUTCMonth();
  const dayDiff = on.getUTCDate() - joinedAt.getUTCDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    years -= 1;
  }

  return years;
}
