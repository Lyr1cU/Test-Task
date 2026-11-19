export type StaffKind = 'employee' | 'manager' | 'sales';

export type SubordinateDepth = 'none' | 'direct' | 'all';

export interface RoleRule {
  perYearBps: number;
  capBps: number;
  subordinateBps: number;
  depth: SubordinateDepth;
}

/**
 * Tenure rates are basis points of base salary (1% = 100 bps).
 * Subordinate rates are basis points of an already calculated salary.
 */
export const ROLE_RULES: Record<StaffKind, RoleRule> = {
  employee: { perYearBps: 300, capBps: 3000, subordinateBps: 0, depth: 'none' },
  manager: {
    perYearBps: 500,
    capBps: 4000,
    subordinateBps: 50,
    depth: 'direct',
  },
  sales: { perYearBps: 100, capBps: 3500, subordinateBps: 30, depth: 'all' },
};

export function isStaffKind(type: string): type is StaffKind {
  return Object.prototype.hasOwnProperty.call(ROLE_RULES, type);
}

export function roleRule(type: string): RoleRule {
  if (!isStaffKind(type)) {
    throw new Error(`Unknown staff type ${type}`);
  }
  return ROLE_RULES[type];
}

export function canHaveSubordinates(type: StaffKind): boolean {
  return ROLE_RULES[type].depth !== 'none';
}
