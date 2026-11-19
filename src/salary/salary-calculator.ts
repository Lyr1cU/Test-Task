import { completedYears } from '../common/dates';
import { roleRule, type StaffKind } from './roles';

export type { StaffKind } from './roles';

export interface SalaryNode {
  id: string;
  type: StaffKind;
  joinedAt: Date;
  baseSalaryCents: number;
  supervisorId: string | null;
}

export interface SalaryBreakdown {
  id: string;
  employed: boolean;
  years: number;
  baseSalaryCents: number;
  tenureBonusCents: number;
  subordinateBonusCents: number;
  totalCents: number;
}

export class HierarchyCycleError extends Error {
  constructor() {
    super('Cycle detected in staff hierarchy');
    this.name = 'HierarchyCycleError';
  }
}

function bpsOf(cents: number, bps: number): number {
  return Math.round((cents * bps) / 10_000);
}

export function calculateSalaries(
  nodes: SalaryNode[],
  on: Date,
): Map<string, SalaryBreakdown> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const children = new Map<string, string[]>();

  for (const node of nodes) {
    if (!node.supervisorId || !byId.has(node.supervisorId)) {
      continue;
    }
    const list = children.get(node.supervisorId) ?? [];
    list.push(node.id);
    children.set(node.supervisorId, list);
  }

  const memo = new Map<string, SalaryBreakdown>();
  for (const id of evaluationOrder(nodes, children)) {
    memo.set(id, salaryOf(byId.get(id) as SalaryNode, on, children, memo));
  }
  return memo;
}

/**
 * Post-order on an explicit stack, so a tall chain does not overflow the call stack.
 * A node is evaluated only after every descendant already has a salary.
 */
function evaluationOrder(
  nodes: SalaryNode[],
  children: Map<string, string[]>,
): string[] {
  const state = new Map<string, 'visiting' | 'done'>();
  const order: string[] = [];
  const stack: { id: string; nextChild: number }[] = [];

  for (const node of nodes) {
    if (state.has(node.id)) {
      continue;
    }
    state.set(node.id, 'visiting');
    stack.push({ id: node.id, nextChild: 0 });

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const kids = children.get(frame.id) ?? [];
      if (frame.nextChild < kids.length) {
        const childId = kids[frame.nextChild];
        frame.nextChild += 1;
        const childState = state.get(childId);
        if (childState === 'visiting') {
          throw new HierarchyCycleError();
        }
        if (childState === 'done') {
          continue;
        }
        state.set(childId, 'visiting');
        stack.push({ id: childId, nextChild: 0 });
        continue;
      }
      state.set(frame.id, 'done');
      order.push(frame.id);
      stack.pop();
    }
  }

  return order;
}

function salaryOf(
  node: SalaryNode,
  on: Date,
  children: Map<string, string[]>,
  memo: Map<string, SalaryBreakdown>,
): SalaryBreakdown {
  const years = completedYears(node.joinedAt, on);
  if (years === null) {
    return {
      id: node.id,
      employed: false,
      years: 0,
      baseSalaryCents: node.baseSalaryCents,
      tenureBonusCents: 0,
      subordinateBonusCents: 0,
      totalCents: 0,
    };
  }

  const rule = roleRule(node.type);
  const tenureBonusCents = bpsOf(
    node.baseSalaryCents,
    Math.min(years * rule.perYearBps, rule.capBps),
  );
  const subordinateBonusCents =
    rule.depth === 'none'
      ? 0
      : bpsOf(
          subordinateSum(node.id, rule.depth, children, memo),
          rule.subordinateBps,
        );

  return {
    id: node.id,
    employed: true,
    years,
    baseSalaryCents: node.baseSalaryCents,
    tenureBonusCents,
    subordinateBonusCents,
    totalCents: node.baseSalaryCents + tenureBonusCents + subordinateBonusCents,
  };
}

function subordinateSum(
  id: string,
  depth: 'direct' | 'all',
  children: Map<string, string[]>,
  memo: Map<string, SalaryBreakdown>,
): number {
  const pending = [...(children.get(id) ?? [])];
  if (depth === 'direct') {
    return pending.reduce((sum, childId) => sum + totalOf(memo, childId), 0);
  }

  let sum = 0;
  const seen = new Set<string>();
  while (pending.length > 0) {
    const childId = pending.pop();
    if (childId === undefined || seen.has(childId)) {
      continue;
    }
    seen.add(childId);
    sum += totalOf(memo, childId);
    pending.push(...(children.get(childId) ?? []));
  }
  return sum;
}

function totalOf(memo: Map<string, SalaryBreakdown>, id: string): number {
  const line = memo.get(id);
  if (!line) {
    throw new Error(`Missing salary for ${id}`);
  }
  return line.totalCents;
}

export function payrollTotalCents(
  breakdowns: Iterable<SalaryBreakdown>,
): number {
  let total = 0;
  for (const line of breakdowns) {
    if (line.employed) {
      total += line.totalCents;
    }
  }
  return total;
}
