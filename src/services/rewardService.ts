import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  type RewardTransaction,
  type RewardActionType,
  REWARD_POINTS,
  calculateUserRewards,
} from '../domain';

function docToReward(d: QueryDocumentSnapshot<DocumentData> | { id: string; data: () => DocumentData }): RewardTransaction {
  const data = d.data();
  const createdAtIso = data.createdAt?.toDate
    ? data.createdAt.toDate().toISOString()
    : data.createdAt || new Date().toISOString();

  return {
    id: d.id,
    userId: data.userId,
    action: data.action as RewardActionType,
    points: typeof data.points === 'number' ? data.points : 0,
    targetId: data.targetId,
    targetTitle: data.targetTitle || undefined,
    description: data.description || '',
    createdAt: createdAtIso,
  };
}

export const rewardService = {
  /**
   * Fetches reward transactions ledger for a user
   */
  async fetchRewards(userId: string): Promise<{ rewards: RewardTransaction[]; error: string | null }> {
    try {
      if (!userId) return { rewards: [], error: null };
      const q = query(
        collection(db, 'rewards'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
      );
      const snap = await getDocs(q);
      const rewards = snap.docs.map(docToReward);
      return { rewards, error: null };
    } catch (err: any) {
      console.error('Error fetching rewards from Firestore:', err);
      return { rewards: [], error: err.message || 'Failed to load rewards history.' };
    }
  },

  /**
   * Awards reward points with idempotency and duplicate prevention via targetId check
   */
  async awardRewardPoints(params: {
    userId: string;
    action: RewardActionType;
    targetId: string;
    targetTitle?: string;
    description: string;
  }): Promise<{ reward: RewardTransaction | null; alreadyAwarded: boolean; error: string | null }> {
    try {
      const { userId, action, targetId, targetTitle, description } = params;
      if (!userId || !targetId) {
        return { reward: null, alreadyAwarded: false, error: 'Missing userId or targetId.' };
      }

      // Check for existing reward transaction with the same targetId to prevent duplicate points
      const duplicateQuery = query(
        collection(db, 'rewards'),
        where('userId', '==', userId),
        where('targetId', '==', targetId),
      );
      const duplicateSnap = await getDocs(duplicateQuery);
      if (!duplicateSnap.empty) {
        console.info(`Reward already awarded for target ${targetId}. Skipping duplicate points.`);
        return { reward: docToReward(duplicateSnap.docs[0]), alreadyAwarded: true, error: null };
      }

      const points = REWARD_POINTS[action] || 25;
      const rewardRef = doc(collection(db, 'rewards'));

      const payload: Record<string, any> = {
        userId,
        action,
        points,
        targetId,
        description: description.slice(0, 300),
        createdAt: serverTimestamp(),
      };

      if (targetTitle) {
        payload.targetTitle = targetTitle.slice(0, 120);
      }

      await setDoc(rewardRef, payload);

      const created: RewardTransaction = {
        id: rewardRef.id,
        userId,
        action,
        points,
        targetId,
        targetTitle,
        description,
        createdAt: new Date().toISOString(),
      };

      return { reward: created, alreadyAwarded: false, error: null };
    } catch (err: any) {
      console.error('Error awarding reward points:', err);
      handleFirestoreError(err, OperationType.CREATE, 'rewards');
    }
  },

  /**
   * Realtime Firestore subscription for user reward transactions
   */
  subscribeToRewards(userId: string, onChange: (rewards: RewardTransaction[]) => void) {
    if (!userId) return () => {};

    const q = query(
      collection(db, 'rewards'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rewards = snapshot.docs.map(docToReward);
        onChange(rewards);
      },
      (error) => {
        console.warn('Realtime rewards subscription notice:', error);
      },
    );

    return unsubscribe;
  },

  calculateUserRewards,
};
