import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
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
import { notificationService } from './notificationService';
import { rewardService } from './rewardService';

function docToClaim(d: QueryDocumentSnapshot<DocumentData> | { id: string; data: () => DocumentData }): Claim {
  const data = d.data();
  const createdAtIso = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString();
  const updatedAtIso = data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || undefined;
  const returnConfirmedAtIso = data.returnConfirmedAt?.toDate
    ? data.returnConfirmedAt.toDate().toISOString()
    : data.returnConfirmedAt || undefined;

  return {
    id: d.id,
    itemId: data.itemId,
    itemTitle: data.itemTitle || undefined,
    itemOwnerId: data.itemOwnerId || undefined,
    claimant: data.claimantName || data.claimant || 'Claimant',
    claimantId: data.claimantId,
    claimantName: data.claimantName || data.claimant,
    claimantEmail: data.claimantEmail || undefined,
    contactPhone: data.contactPhone || undefined,
    details: data.details || '',
    evidenceUrl: data.evidenceUrl || undefined,
    status: (data.status as ClaimStatus) || 'Pending',
    reviewerId: data.reviewerId || undefined,
    reviewerName: data.reviewerName || undefined,
    resolutionNote: data.resolutionNote || undefined,
    returnConfirmedAt: returnConfirmedAtIso,
    returnConfirmedBy: data.returnConfirmedBy || undefined,
    createdAt: createdAtIso,
    updatedAt: updatedAtIso,
  };
}

export const claimService = {
  /**
   * Fetches claims submitted BY the current user (My Claims)
   */
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
      console.error('Error fetching user claims from Firestore:', err);
      return { claims: [], error: err.message || 'Failed to fetch claims.' };
    }
  },

  /**
   * Fetches claims RECEIVED on items posted by the user (Claims Received)
   */
  async fetchClaimsReceived(itemOwnerId?: string): Promise<{ claims: Claim[]; error: string | null }> {
    try {
      if (!itemOwnerId) return { claims: [], error: null };
      const q = query(
        collection(db, 'claims'),
        where('itemOwnerId', '==', itemOwnerId),
        orderBy('createdAt', 'desc'),
      );
      const snap = await getDocs(q);
      const claims = snap.docs.map(docToClaim);
      return { claims, error: null };
    } catch (err: any) {
      console.error('Error fetching received claims from Firestore:', err);
      return { claims: [], error: err.message || 'Failed to fetch received claims.' };
    }
  },

  async createClaim(
    itemId: string,
    details: string,
    claimantId: string,
    claimantName: string,
    contactPhone?: string,
    itemOwnerId?: string,
    itemTitle?: string,
    claimantEmail?: string,
    evidenceUrl?: string,
  ): Promise<{ claim: Claim | null; error: string | null }> {
    try {
      // If itemOwnerId wasn't passed, attempt to fetch from target item document
      let ownerId = itemOwnerId;
      let title = itemTitle;
      if (!ownerId || !title) {
        try {
          const itemSnap = await getDoc(doc(db, 'items', itemId));
          if (itemSnap.exists()) {
            const itemData = itemSnap.data();
            ownerId = ownerId || itemData.ownerId;
            title = title || itemData.title;
          }
        } catch (e) {
          console.warn('Could not read parent item for claim enrichment:', e);
        }
      }

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

      if (ownerId) payload.itemOwnerId = ownerId;
      if (title) payload.itemTitle = title;
      if (claimantEmail) payload.claimantEmail = claimantEmail.trim();
      if (contactPhone?.trim()) payload.contactPhone = contactPhone.trim();
      if (evidenceUrl) payload.evidenceUrl = evidenceUrl;

      await setDoc(claimRef, payload);

      if (ownerId && ownerId !== claimantId) {
        notificationService.createNotification({
          recipientId: ownerId,
          senderId: claimantId,
          senderName: claimantName.trim(),
          type: 'claim_submitted',
          title: `New claim on "${title || 'your found item'}"`,
          message: `${claimantName.trim()} submitted an ownership claim with verification proof. Please review and respond.`,
          itemId,
          itemTitle: title || 'Item',
          claimId: claimRef.id,
        }).catch((err) => console.warn('Could not send claim_submitted notification:', err));
      }

      const created: Claim = {
        id: claimRef.id,
        itemId,
        itemTitle: title,
        itemOwnerId: ownerId,
        claimant: claimantName.trim(),
        claimantId,
        claimantName: claimantName.trim(),
        claimantEmail,
        contactPhone: payload.contactPhone,
        details: payload.details,
        evidenceUrl,
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

  async requestMoreInfo(
    claimId: string,
    reviewerId: string,
    reviewerName: string,
    note: string,
  ): Promise<{ error: string | null }> {
    try {
      const claimRef = doc(db, 'claims', claimId);
      const claimSnap = await getDoc(claimRef);
      const claimData = claimSnap.exists() ? claimSnap.data() : null;

      await updateDoc(claimRef, {
        status: 'Under Review',
        reviewerId,
        reviewerName,
        resolutionNote: note.trim(),
        updatedAt: serverTimestamp(),
      });

      if (claimData?.claimantId) {
        notificationService.createNotification({
          recipientId: claimData.claimantId,
          senderId: reviewerId,
          senderName: reviewerName,
          type: 'evidence_requested',
          title: `More info requested for "${claimData.itemTitle || 'Item'}"`,
          message: `${reviewerName} requested additional details: "${note.trim()}".`,
          itemId: claimData.itemId || '',
          itemTitle: claimData.itemTitle || 'Item',
          claimId,
        }).catch((err) => console.warn('Could not send evidence_requested notification:', err));
      }

      return { error: null };
    } catch (err: any) {
      console.error('Error requesting more info on claim:', err);
      handleFirestoreError(err, OperationType.UPDATE, `claims/${claimId}`);
    }
  },

  async approveClaim(
    claimId: string,
    itemId: string,
    reviewerId: string,
    reviewerName: string,
    resolutionNote?: string,
  ): Promise<{ error: string | null }> {
    try {
      const claimRef = doc(db, 'claims', claimId);
      const claimSnap = await getDoc(claimRef);
      const claimData = claimSnap.exists() ? claimSnap.data() : null;

      await updateDoc(claimRef, {
        status: 'Approved',
        reviewerId,
        reviewerName,
        resolutionNote: resolutionNote?.trim() || 'Claim verified and approved by finder.',
        updatedAt: serverTimestamp(),
      });

      // Update item status to 'Claim Pending'
      try {
        const itemRef = doc(db, 'items', itemId);
        await updateDoc(itemRef, {
          status: 'Claim Pending',
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn('Could not update item status to Claim Pending:', e);
      }

      if (claimData?.claimantId) {
        notificationService.createNotification({
          recipientId: claimData.claimantId,
          senderId: reviewerId,
          senderName: reviewerName,
          type: 'claim_approved',
          title: `Claim Approved for "${claimData.itemTitle || 'Item'}"!`,
          message: `${reviewerName} verified your ownership claim! You can now arrange safe handover on campus.`,
          itemId,
          itemTitle: claimData.itemTitle || 'Item',
          claimId,
        }).catch((err) => console.warn('Could not send claim_approved notification:', err));
      }

      return { error: null };
    } catch (err: any) {
      console.error('Error approving claim:', err);
      handleFirestoreError(err, OperationType.UPDATE, `claims/${claimId}`);
    }
  },

  async rejectClaim(
    claimId: string,
    reviewerId: string,
    reviewerName: string,
    reason: string,
  ): Promise<{ error: string | null }> {
    try {
      const claimRef = doc(db, 'claims', claimId);
      const claimSnap = await getDoc(claimRef);
      const claimData = claimSnap.exists() ? claimSnap.data() : null;

      await updateDoc(claimRef, {
        status: 'Rejected',
        reviewerId,
        reviewerName,
        resolutionNote: reason.trim(),
        updatedAt: serverTimestamp(),
      });

      if (claimData?.claimantId) {
        notificationService.createNotification({
          recipientId: claimData.claimantId,
          senderId: reviewerId,
          senderName: reviewerName,
          type: 'claim_rejected',
          title: `Claim update for "${claimData.itemTitle || 'Item'}"`,
          message: `${reviewerName} reviewed your claim: "${reason.trim()}".`,
          itemId: claimData.itemId || '',
          itemTitle: claimData.itemTitle || 'Item',
          claimId,
        }).catch((err) => console.warn('Could not send claim_rejected notification:', err));
      }

      return { error: null };
    } catch (err: any) {
      console.error('Error rejecting claim:', err);
      handleFirestoreError(err, OperationType.UPDATE, `claims/${claimId}`);
    }
  },

  async confirmReturn(
    claimId: string,
    itemId: string,
    confirmedByUserId: string,
  ): Promise<{ error: string | null }> {
    try {
      const claimRef = doc(db, 'claims', claimId);
      const claimSnap = await getDoc(claimRef);
      const claimData = claimSnap.exists() ? claimSnap.data() : null;

      await updateDoc(claimRef, {
        status: 'Completed',
        returnConfirmedAt: serverTimestamp(),
        returnConfirmedBy: confirmedByUserId,
        updatedAt: serverTimestamp(),
      });

      // Transition item to terminal 'Recovered' status
      const itemRef = doc(db, 'items', itemId);
      await updateDoc(itemRef, {
        status: 'Recovered',
        updatedAt: serverTimestamp(),
      });

      if (claimData?.claimantId) {
        notificationService.createNotification({
          recipientId: claimData.claimantId,
          senderId: confirmedByUserId,
          senderName: 'Campus Finder',
          type: 'handover_completed',
          title: `Item return confirmed for "${claimData.itemTitle || 'Item'}"!`,
          message: `The item handover has been completed. Glad CampusFind could help reunite you with your item!`,
          itemId,
          itemTitle: claimData.itemTitle || 'Item',
          claimId,
        }).catch((err) => console.warn('Could not send handover_completed notification:', err));
      }

      // Award verified return reward points (50 pts) to finder with duplicate prevention
      rewardService.awardRewardPoints({
        userId: confirmedByUserId,
        action: 'item_returned',
        targetId: claimId,
        targetTitle: claimData?.itemTitle || 'Campus Item',
        description: `Verified safe return of "${claimData?.itemTitle || 'item'}" to owner.`,
      }).catch((err) => console.warn('Could not award reward points:', err));

      return { error: null };
    } catch (err: any) {
      console.error('Error confirming item return:', err);
      handleFirestoreError(err, OperationType.UPDATE, `claims/${claimId}`);
    }
  },

  async withdrawClaim(claimId: string, userId: string): Promise<{ error: string | null }> {
    try {
      const claimRef = doc(db, 'claims', claimId);
      const snap = await getDoc(claimRef);
      if (!snap.exists()) return { error: null };
      if (snap.data().claimantId !== userId) {
        return { error: 'Unauthorized: You can only withdraw your own claims.' };
      }
      await deleteDoc(claimRef);
      return { error: null };
    } catch (err: any) {
      console.error('Error withdrawing claim:', err);
      handleFirestoreError(err, OperationType.DELETE, `claims/${claimId}`);
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

  subscribeToClaimsReceived(itemOwnerId: string, onChange: (claims: Claim[]) => void) {
    if (!itemOwnerId) return () => {};

    const q = query(
      collection(db, 'claims'),
      where('itemOwnerId', '==', itemOwnerId),
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
