import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Firestore Security Rules Hardening Audit', () => {
  const rulesPath = path.resolve(__dirname, '../firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');

  it('enforces default-deny global safety net', () => {
    expect(rules).toContain('match /{document=**}');
    expect(rules).toContain('allow read, write: if false;');
  });

  it('validates document ID path hardening against ID poisoning and Denial of Wallet', () => {
    expect(rules).toContain('function isValidId(id)');
    expect(rules).toContain("id.matches('^[a-zA-Z0-9_\\\\-]+$')");
    expect(rules).toContain('id.size() <= 128');
  });

  it('verifies trusted admin check using admins collection and custom claims without hardcoded emails', () => {
    expect(rules).toContain('request.auth.token.admin == true');
    expect(rules).toContain('exists(/databases/$(database)/documents/admins/$(request.auth.uid))');
    expect(rules).toContain('match /admins/{adminId}');
  });

  it('enforces temporal integrity using serverTimestamp request.time', () => {
    expect(rules).toContain('incoming().createdAt == request.time');
    expect(rules).toContain('incoming().updatedAt == request.time');
  });

  it('protects private claims with Attribute-Based Access Control and relational ownership check', () => {
    expect(rules).toContain('resource.data.claimantId == request.auth.uid');
    expect(rules).toContain('exists(/databases/$(database)/documents/items/$(incoming().itemId))');
  });

  it('enforces partial update white-listing with affectedKeys().hasOnly()', () => {
    expect(rules).toContain("affectedKeys().hasOnly(['status', 'updatedAt'])");
  });

  it('prevents self-assigned admin roles in user profiles', () => {
    expect(rules).toContain("incoming().role in ['student', 'staff']");
    expect(rules).toContain('incoming().role == existing().role');
  });

  it('secures notifications collection and restricts access to recipient', () => {
    expect(rules).toContain('match /notifications/{notificationId}');
    expect(rules).toContain('resource.data.recipientId == request.auth.uid');
    expect(rules).toContain('function isValidNotification(data)');
  });

  it('secures rewards collection points ledger and restricts creation to self', () => {
    expect(rules).toContain('match /rewards/{rewardId}');
    expect(rules).toContain('resource.data.userId == request.auth.uid');
    expect(rules).toContain('incoming().userId == request.auth.uid');
    expect(rules).toContain('function isValidReward(data)');
    expect(rules).toContain("data.action in ['item_returned', 'found_item_verified', 'match_assisted']");
  });

  it('enforces secure self-only user profile editing with rewardsOptIn', () => {
    expect(rules).toContain('match /users/{userId}');
    expect(rules).toContain('request.auth.uid == userId');
    expect(rules).toContain('rewardsOptIn');
  });

  it('guarantees claims are always created Pending and prevents self-claims and claiming closed items', () => {
    expect(rules).toContain("incoming().status == 'Pending'");
    expect(rules).toContain('incoming().itemOwnerId == get(/databases/$(database)/documents/items/$(incoming().itemId)).data.ownerId');
    expect(rules).toContain("get(/databases/$(database)/documents/items/$(incoming().itemId)).data.status in ['Open', 'Possible Match']");
    expect(rules).toContain('incoming().claimantId != get(/databases/$(database)/documents/items/$(incoming().itemId)).data.ownerId');
  });

  it('blocks claimants from self-approving claims or altering status', () => {
    expect(rules).toContain('incoming().status == existing().status');
    expect(rules).toContain("existing().status in ['Pending', 'Under Review']");
  });

  it('enforces legitimate item relationship on notification creation', () => {
    expect(rules).toContain('incoming().senderId != incoming().recipientId');
    expect(rules).toContain('incoming().recipientId == get(/databases/$(database)/documents/items/$(incoming().itemId)).data.ownerId');
  });
});
