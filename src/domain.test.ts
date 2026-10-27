import { describe, it, expect } from 'vitest';
import {
  demoItems,
  findMatches,
  scoreMatch,
  searchItems,
  validItemInput,
  dedupeById,
  calculateUserRewards,
  canEditReport,
  canCancelReport,
  canWithdrawClaim,
  type Item,
} from './domain';

const lost: Item = {
  id: 'l',
  type: 'lost',
  title: 'Blue notebook',
  category: 'Books & Notes',
  description: 'Blue ruled notebook near study tables',
  color: 'Blue',
  location: 'Central Library',
  date: '2026-10-22',
  status: 'Open',
  owner: 'test',
  handover: false,
  createdAt: '2026-10-22T00:00:00Z',
};

const found: Item = {
  ...lost,
  id: 'f',
  type: 'found',
  title: 'Notebook found',
  description: 'Ruled blue notebook found by study tables',
  createdAt: '2026-10-22T01:00:00Z',
};

describe('CampusFind domain logic', () => {
  it('scores matching lost/found reports and explains overlapping attributes', () => {
    const result = scoreMatch(lost, found);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.reasons).toContain('Category');
    expect(result.reasons).toContain('Location');
  });

  it('does not match reports of the same type', () => {
    expect(scoreMatch(lost, { ...found, type: 'lost' }).score).toBe(0);
  });

  it('handles missing attributes without NaN', () => {
    const result = scoreMatch(
      { ...lost, color: '', location: '', date: '' },
      { ...found, color: '', location: '', date: '' },
    );
    expect(Number.isFinite(result.score)).toBe(true);
  });

  it('finds reciprocal candidates but excludes closed records', () => {
    expect(findMatches(lost, [lost, found]).some((m) => m.item.id === 'f')).toBe(true);
    expect(findMatches(lost, [lost, { ...found, status: 'Closed' }])).toHaveLength(0);
  });

  it('searches title, description, category, color and location', () => {
    expect(searchItems(demoItems, 'library', 'all', 'all', 'all').length).toBeGreaterThan(0);
    expect(searchItems(demoItems, 'silver', 'all', 'all', 'all').length).toBeGreaterThan(0);
  });

  it('filters by type/category/status', () => {
    expect(searchItems(demoItems, '', 'lost', 'all', 'all').every((i) => i.type === 'lost')).toBe(true);
    expect(searchItems(demoItems, '', 'all', 'Keys', 'all').every((i) => i.category === 'Keys')).toBe(true);
  });

  it('validates required fields and rejects future dates', () => {
    expect(Object.keys(validItemInput({})).length).toBeGreaterThan(0);
    expect(validItemInput({ ...lost, date: '2999-01-01' }).date).toBe('Date cannot be in the future.');
  });

  it('accepts a valid report draft', () => {
    expect(validItemInput(lost)).toEqual({});
  });

  it('deduplicates entities with identical IDs to prevent duplicate keys in lists', () => {
    const duplicateList = [lost, { ...lost }, found, { ...found }];
    const result = dedupeById(duplicateList);
    expect(result).toHaveLength(2);
    expect(result.map((x) => x.id)).toEqual(['l', 'f']);
  });

  it('calculates reward points and unlocks milestone badges accurately', () => {
    const { totalPoints, badges } = calculateUserRewards([
      {
        id: '1',
        userId: 'u1',
        action: 'item_returned',
        points: 50,
        targetId: 't1',
        description: 'Return',
        createdAt: '2026-10-22',
      },
      {
        id: '2',
        userId: 'u1',
        action: 'item_returned',
        points: 50,
        targetId: 't2',
        description: 'Return',
        createdAt: '2026-10-23',
      },
    ]);
    expect(totalPoints).toBe(100);
    const honestFinder = badges.find((b) => b.id === 'honest_finder');
    const campusGuardian = badges.find((b) => b.id === 'campus_guardian');
    const communityHero = badges.find((b) => b.id === 'community_hero');
    expect(honestFinder?.unlocked).toBe(true);
    expect(campusGuardian?.unlocked).toBe(true);
    expect(communityHero?.unlocked).toBe(false);
  });

  it('enforces report editing and cancellation safeguards', () => {
    const openItem: any = { id: 'item-1', ownerId: 'u1', status: 'Open' };
    const pendingItem: any = { id: 'item-2', ownerId: 'u1', status: 'Claim Pending' };
    const recoveredItem: any = { id: 'item-3', ownerId: 'u1', status: 'Recovered' };

    expect(canEditReport(openItem, 'u1')).toBe(true);
    expect(canEditReport(pendingItem, 'u1')).toBe(false);
    expect(canEditReport(recoveredItem, 'u1')).toBe(false);
    expect(canEditReport(openItem, 'other-user')).toBe(false);

    expect(canCancelReport(openItem, 'u1')).toBe(true);
    expect(canCancelReport(pendingItem, 'u1')).toBe(false);
    expect(canCancelReport(recoveredItem, 'u1')).toBe(false);
  });

  it('enforces claim withdrawal safeguards', () => {
    const pendingClaim: any = { id: 'c1', claimantId: 'u1', status: 'Pending' };
    const underReviewClaim: any = { id: 'c2', claimantId: 'u1', status: 'Under Review' };
    const approvedClaim: any = { id: 'c3', claimantId: 'u1', status: 'Approved' };
    const completedClaim: any = { id: 'c4', claimantId: 'u1', status: 'Completed' };

    expect(canWithdrawClaim(pendingClaim, 'u1')).toBe(true);
    expect(canWithdrawClaim(underReviewClaim, 'u1')).toBe(true);
    expect(canWithdrawClaim(approvedClaim, 'u1')).toBe(false);
    expect(canWithdrawClaim(completedClaim, 'u1')).toBe(false);
  });
});
