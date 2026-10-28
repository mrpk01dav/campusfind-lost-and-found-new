import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import fs from 'node:fs';
import path from 'node:path';

const isEmulatorRunning = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

describe.skipIf(!isEmulatorRunning)('Firestore Emulator Security Rules Integration Tests', () => {
  let testEnv: RulesTestEnvironment;
  const rules = fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8');

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-test-project',
      firestore: {
        rules,
        host: process.env.FIRESTORE_EMULATOR_HOST?.split(':')[0] || 'localhost',
        port: Number(process.env.FIRESTORE_EMULATOR_HOST?.split(':')[1] || 8080),
      },
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
    }
  });

  it('allows public to read active items', async () => {
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    const itemRef = unauthDb.collection('items').doc('test-item-1');
    await assertSucceeds(itemRef.get());
  });

  it('prevents unauthenticated user from creating an item', async () => {
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    const itemRef = unauthDb.collection('items').doc('test-item-1');
    await assertFails(
      itemRef.set({
        type: 'lost',
        title: 'Lost Backpack',
        category: 'Bags',
        description: 'Black backpack',
        location: 'Library',
        date: '2026-10-25',
        status: 'Open',
        ownerId: 'some-user',
        createdAt: new Date(),
      }),
    );
  });

  it('prevents claimant from creating a pre-approved claim', async () => {
    const authDb = testEnv.authenticatedContext('claimant-1').firestore();
    const claimRef = authDb.collection('claims').doc('claim-1');
    await assertFails(
      claimRef.set({
        itemId: 'item-1',
        itemOwnerId: 'owner-1',
        claimantId: 'claimant-1',
        details: 'Secret identification details',
        status: 'Approved', // Violation: claims must always be created Pending
        createdAt: new Date(),
      }),
    );
  });

  it('blocks claimant from self-approving their own claim', async () => {
    // Setup initial pending claim using admin context
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('claims').doc('claim-1').set({
        itemId: 'item-1',
        itemOwnerId: 'owner-1',
        claimantId: 'claimant-1',
        details: 'Initial details for claim',
        status: 'Pending',
        createdAt: new Date(),
      });
    });

    const claimantDb = testEnv.authenticatedContext('claimant-1').firestore();
    const claimRef = claimantDb.collection('claims').doc('claim-1');

    // Claimant tries to update status to Approved
    await assertFails(
      claimRef.update({
        status: 'Approved',
        updatedAt: new Date(),
      }),
    );
  });

  it('prevents stranger from editing another users claim', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('claims').doc('claim-1').set({
        itemId: 'item-1',
        itemOwnerId: 'owner-1',
        claimantId: 'claimant-1',
        details: 'Secret proof of ownership',
        status: 'Pending',
        createdAt: new Date(),
      });
    });

    const strangerDb = testEnv.authenticatedContext('stranger-user').firestore();
    const claimRef = strangerDb.collection('claims').doc('claim-1');
    await assertFails(
      claimRef.update({
        details: 'Tampered details',
        updatedAt: new Date(),
      }),
    );
  });

  it('prevents non-owner from changing item status', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('items').doc('item-1').set({
        type: 'found',
        title: 'Found Keys',
        category: 'Keys',
        description: 'Ring of keys',
        location: 'Student Union',
        date: '2026-10-25',
        status: 'Open',
        ownerId: 'owner-1',
        createdAt: new Date(),
      });
    });

    const strangerDb = testEnv.authenticatedContext('stranger-user').firestore();
    const itemRef = strangerDb.collection('items').doc('item-1');
    await assertFails(
      itemRef.update({
        status: 'Closed',
        updatedAt: new Date(),
      }),
    );
  });

  it('prevents user from making themselves an administrator', async () => {
    const userDb = testEnv.authenticatedContext('user-1').firestore();
    const userRef = userDb.collection('users').doc('user-1');
    await assertFails(
      userRef.set({
        id: 'user-1',
        email: 'user@campus.edu',
        displayName: 'User',
        role: 'admin', // Violation: only student or staff allowed on self-create
        createdAt: new Date(),
      }),
    );
  });
});
