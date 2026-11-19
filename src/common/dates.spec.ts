import { completedYears, formatDateOnly, parseDateOnly } from './dates';

describe('dates', () => {
  it('parses a calendar date as UTC midnight', () => {
    const date = parseDateOnly('2020-02-29');
    expect(date.toISOString()).toBe('2020-02-29T00:00:00.000Z');
    expect(formatDateOnly(date)).toBe('2020-02-29');
  });

  it('rejects a day that does not exist', () => {
    expect(() => parseDateOnly('2021-02-29')).toThrow('Invalid date');
    expect(() => parseDateOnly('2020-13-01')).toThrow('Invalid date');
  });

  it('counts a year only on or after the anniversary', () => {
    const joined = parseDateOnly('2020-01-15');
    expect(completedYears(joined, parseDateOnly('2021-01-14'))).toBe(0);
    expect(completedYears(joined, parseDateOnly('2021-01-15'))).toBe(1);
  });

  it('returns null before the join date', () => {
    const joined = parseDateOnly('2020-01-15');
    expect(completedYears(joined, parseDateOnly('2020-01-14'))).toBeNull();
    expect(completedYears(joined, parseDateOnly('2020-01-15'))).toBe(0);
  });

  it('completes a Feb 29 hire on March 1 in a non-leap year', () => {
    const joined = parseDateOnly('2020-02-29');
    expect(completedYears(joined, parseDateOnly('2021-02-28'))).toBe(0);
    expect(completedYears(joined, parseDateOnly('2021-03-01'))).toBe(1);
  });
});
