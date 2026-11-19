import { canHaveSubordinates } from './roles';

describe('role rules', () => {
  it('allows subordinates only for roles whose formula uses them', () => {
    expect(canHaveSubordinates('employee')).toBe(false);
    expect(canHaveSubordinates('manager')).toBe(true);
    expect(canHaveSubordinates('sales')).toBe(true);
  });
});
