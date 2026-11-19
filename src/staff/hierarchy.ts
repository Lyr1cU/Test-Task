export interface HierarchyLink {
  id: string;
  supervisorId: string | null;
}

/**
 * True when pointing `memberId` at `newSupervisorId` would loop
 * (including assigning someone as their own supervisor).
 */
export function wouldCreateCycle(
  links: HierarchyLink[],
  memberId: string,
  newSupervisorId: string,
): boolean {
  if (memberId === newSupervisorId) {
    return true;
  }

  const parentOf = new Map(links.map((link) => [link.id, link.supervisorId]));
  parentOf.set(memberId, newSupervisorId);

  const seen = new Set<string>();
  let current: string | null = newSupervisorId;
  while (current) {
    if (current === memberId || seen.has(current)) {
      return true;
    }
    seen.add(current);
    current = parentOf.get(current) ?? null;
  }

  return false;
}
