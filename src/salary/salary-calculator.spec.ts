import { parseDateOnly } from '../common/dates';
import {
  calculateSalaries,
  HierarchyCycleError,
  payrollTotalCents,
  type SalaryNode,
} from './salary-calculator';

const BASE = 1_000_000;

function member(
  id: string,
  type: SalaryNode['type'],
  supervisorId: string | null,
  joinedAt = '2020-01-01',
): SalaryNode {
  return {
    id,
    type,
    supervisorId,
    joinedAt: parseDateOnly(joinedAt),
    baseSalaryCents: BASE,
  };
}

describe('calculateSalaries', () => {
  const onHire = parseDateOnly('2020-01-01');

  it('pays the base salary on the join date', () => {
    const result = calculateSalaries(
      [member('e', 'employee', null)],
      onHire,
    ).get('e');

    expect(result).toMatchObject({
      employed: true,
      years: 0,
      tenureBonusCents: 0,
      subordinateBonusCents: 0,
      totalCents: BASE,
    });
  });

  it('adds 3% per year for an employee and stops at 30%', () => {
    const nodes = [member('e', 'employee', null)];

    expect(
      calculateSalaries(nodes, parseDateOnly('2021-01-01')).get('e')
        ?.totalCents,
    ).toBe(1_030_000);

    expect(
      calculateSalaries(nodes, parseDateOnly('2030-01-01')).get('e'),
    ).toMatchObject({
      years: 10,
      tenureBonusCents: 300_000,
      totalCents: 1_300_000,
    });

    expect(
      calculateSalaries(nodes, parseDateOnly('2031-01-01')).get('e'),
    ).toMatchObject({
      years: 11,
      tenureBonusCents: 300_000,
      totalCents: 1_300_000,
    });
  });

  it('caps a manager tenure bonus at 40% and still adds direct reports', () => {
    const nodes = [
      member('m', 'manager', null, '2010-01-01'),
      member('e', 'employee', 'm'),
    ];
    const result = calculateSalaries(nodes, onHire).get('m');

    expect(result).toMatchObject({
      years: 10,
      tenureBonusCents: 400_000,
      subordinateBonusCents: 5_000,
      totalCents: 1_405_000,
    });
  });

  it('pays a manager 0.5% of direct reports only', () => {
    const nodes = [
      member('m', 'manager', null),
      member('s', 'sales', 'm'),
      member('e', 'employee', 's'),
    ];
    const salaries = calculateSalaries(nodes, onHire);

    expect(salaries.get('e')?.totalCents).toBe(BASE);
    expect(salaries.get('s')?.totalCents).toBe(1_003_000);
    expect(salaries.get('m')).toMatchObject({
      subordinateBonusCents: 5_015,
      totalCents: 1_005_015,
    });
  });

  it('pays sales 0.3% of every level, including nested bonuses', () => {
    const nodes = [
      member('s', 'sales', null),
      member('m', 'manager', 's'),
      member('e1', 'employee', 'm'),
      member('e2', 'employee', 'm'),
      member('e3', 'employee', 's'),
    ];
    const salaries = calculateSalaries(nodes, onHire);

    expect(salaries.get('m')?.totalCents).toBe(1_010_000);
    expect(salaries.get('s')).toMatchObject({
      subordinateBonusCents: 12_030,
      totalCents: 1_012_030,
    });
  });

  it('caps a sales tenure bonus at 35%', () => {
    const result = calculateSalaries(
      [member('s', 'sales', null, '1980-01-01')],
      onHire,
    ).get('s');

    expect(result).toMatchObject({
      years: 40,
      tenureBonusCents: 350_000,
      totalCents: 1_350_000,
    });
  });

  it('excludes people who have not joined yet from the company total', () => {
    const nodes = [
      member('e', 'employee', null, '2020-01-01'),
      member('later', 'employee', null, '2021-01-01'),
    ];
    const salaries = calculateSalaries(nodes, parseDateOnly('2020-06-01'));

    expect(salaries.get('later')).toMatchObject({
      employed: false,
      totalCents: 0,
    });
    expect(payrollTotalCents(salaries.values())).toBe(BASE);
  });

  it('uses calculated subordinate salaries after their own tenure', () => {
    const nodes = [
      member('s', 'sales', null, '2020-01-01'),
      member('m', 'manager', 's', '2020-01-01'),
      member('c', 'employee', 'm', '2020-01-01'),
      member('d', 'employee', 's', '2020-01-01'),
      member('eve', 'employee', 'm', '2026-01-01'),
    ];
    const on = parseDateOnly('2024-06-01');
    const salaries = calculateSalaries(nodes, on);

    expect(salaries.get('c')?.totalCents).toBe(1_120_000);
    expect(salaries.get('d')?.totalCents).toBe(1_120_000);
    expect(salaries.get('eve')?.totalCents).toBe(0);
    expect(salaries.get('m')).toMatchObject({
      years: 4,
      tenureBonusCents: 200_000,
      subordinateBonusCents: 5_600,
      totalCents: 1_205_600,
    });
    expect(salaries.get('s')).toMatchObject({
      years: 4,
      tenureBonusCents: 40_000,
      subordinateBonusCents: 10_337,
      totalCents: 1_050_337,
    });
    expect(payrollTotalCents(salaries.values())).toBe(4_495_937);
  });

  it('calculates a tall manager chain without overflowing the stack', () => {
    const depth = 5000;
    const nodes = Array.from({ length: depth }, (_, index) =>
      member(`m${index}`, 'manager', index === 0 ? null : `m${index - 1}`),
    );
    const salaries = calculateSalaries(nodes, onHire);
    const leaf = `m${depth - 1}`;

    expect(salaries.get(leaf)).toMatchObject({
      subordinateBonusCents: 0,
      totalCents: BASE,
    });
    expect(salaries.get('m0')?.totalCents).toBeGreaterThan(BASE);
  });

  it('refuses to calculate a hierarchy that contains a cycle', () => {
    expect(() =>
      calculateSalaries(
        [member('a', 'manager', 'b'), member('b', 'sales', 'a')],
        onHire,
      ),
    ).toThrow(HierarchyCycleError);
  });
});
