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

  it('verifies strict email verification against email spoofing attacks', () => {
    expect(rules).toContain('request.auth.token.email_verified == true');
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
});
