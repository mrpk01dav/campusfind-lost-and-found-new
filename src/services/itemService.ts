import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { demoItems, type Item, type ItemType, type ItemStatus } from '../domain';
import { storageService } from './storageService';

function docToItem(d: QueryDocumentSnapshot<DocumentData> | { id: string; data: () => DocumentData }): Item {
  const data = d.data();
  const createdAtIso = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString();
  const updatedAtIso = data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || undefined;

  return {
    id: d.id,
    type: data.type as ItemType,
    title: data.title || '',
    category: data.category || 'Other',
    description: data.description || '',
    color: data.color || '',
    location: data.location || '',
    date: typeof data.date === 'string' ? data.date.slice(0, 10) : String(data.date || ''),
    time: data.time || undefined,
    image: data.imageUrl || data.image || undefined,
    imageUrl: data.imageUrl || data.image || undefined,
    handover: Boolean(data.handover),
    status: (data.status as ItemStatus) || 'Open',
    owner: data.ownerName || data.owner || 'Campus Member',
    ownerId: data.ownerId,
    ownerName: data.ownerName || data.owner,
    isDemo: Boolean(data.isDemo || data.demo),
    demo: Boolean(data.isDemo || data.demo),
    moderationStatus: data.moderationStatus || 'approved',
    createdAt: createdAtIso,
    updatedAt: updatedAtIso,
  };
}

export const itemService = {
  async fetchItems(): Promise<{ items: Item[]; error: string | null }> {
    try {
      const q = query(collection(db, 'items'), orderBy('createdAt', 'desc'), limit(50));
      const snap = await getDocs(q);
      const items = snap.docs.map(docToItem);
      return { items, error: null };
    } catch (err: any) {
      console.error('Error fetching items from Firestore:', err);
      return { items: [], error: err.message || 'Failed to fetch items from cloud.' };
    }
  },

  /**
   * Uploads image using Firebase Cloud Storage with optimized data URI fallback
   */
  async uploadItemImage(
    file: File,
    userId?: string,
    onProgress?: (pct: number) => void,
  ): Promise<{ url: string | null; error: string | null }> {
    return storageService.uploadItemPhoto(file, userId || 'campus-user', onProgress);
  },

  async createItem(
    draft: Partial<Item>,
    imageFile: File | null,
    userId: string,
    userName: string,
    onProgress?: (pct: number) => void,
  ): Promise<{ item: Item | null; error: string | null }> {
    try {
      let finalImageUrl = draft.imageUrl || draft.image || null;

      if (imageFile) {
        const uploadResult = await this.uploadItemImage(imageFile, userId, onProgress);
        if (uploadResult.error) {
          return { item: null, error: uploadResult.error };
        }
        finalImageUrl = uploadResult.url;
      }

      const itemRef = doc(collection(db, 'items'));
      const payload: Record<string, any> = {
        type: draft.type,
        title: draft.title?.trim() || '',
        category: draft.category || 'Other',
        description: draft.description?.trim() || '',
        color: draft.color?.trim() || '',
        location: draft.location?.trim() || '',
        date: draft.date || '',
        handover: Boolean(draft.handover),
        status: draft.status || 'Open',
        ownerId: userId,
        ownerName: userName,
        owner: userName,
        isDemo: Boolean(draft.isDemo || draft.demo),
        moderationStatus: draft.moderationStatus || 'approved',
        createdAt: serverTimestamp(),
      };

      if (draft.time?.trim()) {
        payload.time = draft.time.trim();
      }

      if (finalImageUrl) {
        payload.imageUrl = finalImageUrl;
      }

      await setDoc(itemRef, payload);

      const created: Item = {
        id: itemRef.id,
        type: draft.type as ItemType,
        title: payload.title,
        category: payload.category,
        description: payload.description,
        color: payload.color,
        location: payload.location,
        date: payload.date,
        time: payload.time,
        imageUrl: payload.imageUrl,
        image: payload.imageUrl,
        handover: payload.handover,
        status: payload.status,
        owner: userName,
        ownerId: userId,
        ownerName: userName,
        isDemo: payload.isDemo,
        moderationStatus: payload.moderationStatus,
        createdAt: new Date().toISOString(),
      };

      return { item: created, error: null };
    } catch (err: any) {
      console.error('Error creating item in Firestore:', err);
      handleFirestoreError(err, OperationType.CREATE, 'items');
    }
  },

  async updateItem(
    itemId: string,
    updates: Partial<Item>,
  ): Promise<{ error: string | null }> {
    try {
      const itemRef = doc(db, 'items', itemId);
      const payload: Record<string, any> = {
        updatedAt: serverTimestamp(),
      };

      if (updates.title !== undefined) payload.title = updates.title.trim();
      if (updates.category !== undefined) payload.category = updates.category;
      if (updates.description !== undefined) payload.description = updates.description.trim();
      if (updates.color !== undefined) payload.color = updates.color.trim();
      if (updates.location !== undefined) payload.location = updates.location.trim();
      if (updates.date !== undefined) payload.date = updates.date;
      if (updates.time !== undefined) payload.time = updates.time.trim();
      if (updates.imageUrl !== undefined) payload.imageUrl = updates.imageUrl;
      if (updates.handover !== undefined) payload.handover = Boolean(updates.handover);
      if (updates.status !== undefined) payload.status = updates.status;

      await updateDoc(itemRef, payload);
      return { error: null };
    } catch (err: any) {
      console.error('Error updating item:', err);
      handleFirestoreError(err, OperationType.UPDATE, `items/${itemId}`);
    }
  },

  async updateItemStatus(itemId: string, status: Item['status']): Promise<{ error: string | null }> {
    try {
      const itemRef = doc(db, 'items', itemId);
      await updateDoc(itemRef, {
        status,
        updatedAt: serverTimestamp(),
      });
      return { error: null };
    } catch (err: any) {
      console.error('Error updating item status:', err);
      handleFirestoreError(err, OperationType.UPDATE, `items/${itemId}`);
    }
  },

  async updateItemDetails(
    itemId: string,
    updates: Partial<Item>,
    userId: string,
  ): Promise<{ error: string | null }> {
    try {
      const itemRef = doc(db, 'items', itemId);
      const snap = await getDoc(itemRef);
      if (!snap.exists()) {
        return { error: 'Report not found.' };
      }
      const data = snap.data();
      if (data.ownerId !== userId) {
        return { error: 'Unauthorized: You can only edit your own reports.' };
      }
      if (['Claim Pending', 'Recovered', 'Closed'].includes(data.status)) {
        return {
          error: `Cannot edit report while status is "${data.status}". Items with active claims or completed resolutions are locked for audit safety.`,
        };
      }
      return this.updateItem(itemId, updates);
    } catch (err: any) {
      console.error('Error updating item details:', err);
      return { error: err.message || 'Failed to update report.' };
    }
  },

  async cancelReport(itemId: string, userId: string): Promise<{ error: string | null }> {
    try {
      const itemRef = doc(db, 'items', itemId);
      const snap = await getDoc(itemRef);
      if (!snap.exists()) return { error: null };
      const data = snap.data();
      if (data.ownerId !== userId) {
        return { error: 'Unauthorized: You can only cancel your own reports.' };
      }
      if (['Claim Pending', 'Recovered'].includes(data.status)) {
        return {
          error: `Cannot cancel report while status is "${data.status}". Items with pending or completed claims cannot be deleted.`,
        };
      }
      return this.deleteItem(itemId);
    } catch (err: any) {
      console.error('Error canceling report:', err);
      return { error: err.message || 'Failed to cancel report.' };
    }
  },

  async deleteItem(itemId: string): Promise<{ error: string | null }> {
    try {
      const itemRef = doc(db, 'items', itemId);
      await deleteDoc(itemRef);
      return { error: null };
    } catch (err: any) {
      console.error('Error deleting item:', err);
      handleFirestoreError(err, OperationType.DELETE, `items/${itemId}`);
    }
  },

  async seedDevData(userId: string, userName: string): Promise<{ inserted: number; error: string | null }> {
    if (import.meta.env.PROD) {
      return { inserted: 0, error: 'Dev seeding is disabled in production.' };
    }
    try {
      const existingSnap = await getDocs(collection(db, 'items'));
      const existingTitles = new Set(existingSnap.docs.map((d) => d.data().title));

      const itemsToInsert = demoItems.filter((d) => !existingTitles.has(d.title));

      if (itemsToInsert.length === 0) {
        return { inserted: 0, error: null };
      }

      for (const d of itemsToInsert) {
        const itemRef = doc(collection(db, 'items'));
        await setDoc(itemRef, {
          type: d.type,
          title: d.title.startsWith('[DEMO') ? d.title : `[DEMO / TEST DATA] ${d.title}`,
          category: d.category,
          description: d.description,
          color: d.color || '',
          location: d.location,
          date: d.date,
          handover: Boolean(d.handover),
          status: 'Open',
          ownerId: userId,
          ownerName: userName,
          owner: userName,
          isDemo: true,
          moderationStatus: 'approved',
          createdAt: serverTimestamp(),
        });
      }

      return { inserted: itemsToInsert.length, error: null };
    } catch (err: any) {
      console.error('Error seeding test records in Firestore:', err);
      return { inserted: 0, error: err.message || 'Failed to seed sample records.' };
    }
  },

  async cleanupDevData(): Promise<{ deleted: boolean; error: string | null }> {
    if (import.meta.env.PROD) {
      return { deleted: false, error: 'Dev cleanup is disabled in production.' };
    }
    try {
      const snap = await getDocs(collection(db, 'items'));
      const demoDocs = snap.docs.filter((d) => d.data().isDemo === true);

      for (const d of demoDocs) {
        await deleteDoc(d.ref);
      }

      return { deleted: true, error: null };
    } catch (err: any) {
      console.error('Error cleaning up demo data:', err);
      return { deleted: false, error: err.message || 'Failed to clean up test records.' };
    }
  },

  /**
   * Realtime Firestore onSnapshot Subscription:
   * Synchronizes instantly across all connected phones and browser tabs!
   */
  subscribeToItems(onChange: (items: Item[]) => void) {
    const q = query(collection(db, 'items'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map(docToItem);
        onChange(items);
      },
      (error) => {
        const rawMsg = error instanceof Error ? error.message : String(error);
        if (
          rawMsg.includes('permission') ||
          rawMsg.includes('PERMISSION_DENIED') ||
          rawMsg.includes('Missing or insufficient permissions')
        ) {
          handleFirestoreError(error, OperationType.GET, 'items');
        } else {
          console.warn('Realtime items sync notice:', rawMsg);
        }
      },
    );

    return unsubscribe;
  },
};
