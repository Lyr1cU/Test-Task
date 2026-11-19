import { toCents, MAX_SALARY_CENTS } from './money';

describe('toCents', () => {
  it('converts a currency amount into cents', () => {
    expect(toCents(10)).toBe(1000);
    expect(toCents(10.1)).toBe(1010);
    expect(toCents(10.12)).toBe(1012);
  });

  it('rejects more than two decimal places instead of rounding them', () => {
    expect(() => toCents(10.129)).toThrow(/2 decimal places/);
  });

  it('rejects amounts that do not fit into a 32-bit integer', () => {
    expect(toCents(21474836.47)).toBe(MAX_SALARY_CENTS);
    expect(() => toCents(21474836.48)).toThrow(/must not exceed/);
    expect(() => toCents(30_000_000)).toThrow(/must not exceed/);
  });

  it('rejects values that are not a real non-negative amount', () => {
    expect(() => toCents(-1)).toThrow(/non-negative/);
    expect(() => toCents(Number.NaN)).toThrow(/non-negative/);
  });
});
