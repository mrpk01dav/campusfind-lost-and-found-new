import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type { Claim, ClaimStatus } from '../domain';

function docToClaim(d: QueryDocumentSnapshot<DocumentData> | { id: string; data: () => DocumentData }): Claim {
  const data = d.data();
  const createdAtIso = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString();
  const updatedAtIso = data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || undefined;

  return {
    id: d.id,
    itemId: data.itemId,
    claimant: data.claimantName || data.claimant || 'Claimant',
    claimantId: data.claimantId,
    claimantName: data.claimantName || data.claimant,
    contactPhone: data.contactPhone || undefined,
    details: data.details || '',
    status: (data.status as ClaimStatus) || 'Pending',
    reviewerId: data.reviewerId || undefined,
    resolutionNote: data.resolutionNote || undefined,
    createdAt: createdAtIso,
    updatedAt: updatedAtIso,
  };
}

export const claimService = {
  async fetchClaims(userId?: string): Promise<{ claims: Claim[]; error: string | null }> {
    try {
      if (!userId) return { claims: [], error: null };
      const q = query(
        collection(db, 'claims'),
        where('claimantId', '==', userId),
        orderBy('createdAt', 'desc'),
      );
      const snap = await getDocs(q);
      const claims = snap.docs.map(docToClaim);
      return { claims, error: null };
    } catch (err: any) {
      console.error('Error fetching claims from Firestore:', err);
      return { claims: [], error: err.message || 'Failed to fetch claims.' };
    }
  },

  async createClaim(
    itemId: string,
    details: string,
    claimantId: string,
    claimantName: string,
    contactPhone?: string,
  ): Promise<{ claim: Claim | null; error: string | null }> {
    try {
      const claimRef = doc(collection(db, 'claims'));
      const payload: Record<string, any> = {
        itemId,
        claimantId,
        claimantName: claimantName.trim(),
        claimant: claimantName.trim(),
        details: details.trim(),
        status: 'Pending',
        createdAt: serverTimestamp(),
      };

      if (contactPhone?.trim()) {
        payload.contactPhone = contactPhone.trim();
      }

      await setDoc(claimRef, payload);

      const created: Claim = {
        id: claimRef.id,
        itemId,
        claimant: claimantName.trim(),
        claimantId,
        claimantName: claimantName.trim(),
        contactPhone: payload.contactPhone,
        details: payload.details,
        status: 'Pending',
        createdAt: new Date().toISOString(),
      };

      return { claim: created, error: null };
    } catch (err: any) {
      console.error('Error creating claim in Firestore:', err);
      handleFirestoreError(err, OperationType.CREATE, 'claims');
    }
  },

  async updateClaimStatus(
    claimId: string,
    status: ClaimStatus,
    resolutionNote?: string,
  ): Promise<{ error: string | null }> {
    try {
      const claimRef = doc(db, 'claims', claimId);
      const updateData: Record<string, any> = {
        status,
        updatedAt: serverTimestamp(),
      };
      if (resolutionNote !== undefined) {
        updateData.resolutionNote = resolutionNote.trim();
      }

      await updateDoc(claimRef, updateData);
      return { error: null };
    } catch (err: any) {
      console.error('Error updating claim status:', err);
      handleFirestoreError(err, OperationType.UPDATE, `claims/${claimId}`);
    }
  },

  subscribeToClaims(userId: string, onChange: (claims: Claim[]) => void) {
    if (!userId) return () => {};

    const q = query(
      collection(db, 'claims'),
      where('claimantId', '==', userId),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const claims = snapshot.docs.map(docToClaim);
        onChange(claims);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'claims');
      },
    );

    return unsubscribe;
  },
};
