import { wouldCreateCycle } from './hierarchy';

describe('wouldCreateCycle', () => {
  const links = [
    { id: 'alice', supervisorId: null },
    { id: 'bob', supervisorId: 'alice' },
    { id: 'carol', supervisorId: 'bob' },
  ];

  it('allows a supervisor who is not below the member', () => {
    expect(wouldCreateCycle(links, 'carol', 'alice')).toBe(false);
  });

  it('rejects a supervisor who is a subordinate', () => {
    expect(wouldCreateCycle(links, 'alice', 'carol')).toBe(true);
    expect(wouldCreateCycle(links, 'alice', 'bob')).toBe(true);
  });

  it('rejects assigning a person as their own supervisor', () => {
    expect(wouldCreateCycle(links, 'bob', 'bob')).toBe(true);
  });
});
