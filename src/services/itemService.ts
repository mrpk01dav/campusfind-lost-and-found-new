import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { demoItems, type Item, type ItemType, type ItemStatus } from '../domain';

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
      const q = query(collection(db, 'items'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const items = snap.docs.map(docToItem);
      return { items, error: null };
    } catch (err: any) {
      console.error('Error fetching items from Firestore:', err);
      return { items: [], error: err.message || 'Failed to fetch items from cloud.' };
    }
  },

  /**
   * Encodes and optimizes image for cross-device cloud persistence
   */
  async uploadItemImage(file: File): Promise<{ url: string | null; error: string | null }> {
    return new Promise((resolve) => {
      if (file.size > 5 * 1024 * 1024) {
        return resolve({ url: null, error: 'Image exceeds 5MB limit. Please choose a smaller file.' });
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Scale down image to ensure it fits comfortably within Firestore document limit (<500KB)
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve({ url: e.target?.result as string, error: null });
          }

          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          resolve({ url: dataUrl, error: null });
        };
        img.onerror = () => {
          resolve({ url: null, error: 'Failed to process selected image.' });
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        resolve({ url: null, error: 'Failed to read image file.' });
      };
      reader.readAsDataURL(file);
    });
  },

  async createItem(
    draft: Partial<Item>,
    imageFile: File | null,
    userId: string,
    userName: string,
  ): Promise<{ item: Item | null; error: string | null }> {
    try {
      let finalImageUrl = draft.imageUrl || draft.image || null;

      if (imageFile) {
        const uploadResult = await this.uploadItemImage(imageFile);
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
    const q = query(collection(db, 'items'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map(docToItem);
        onChange(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'items');
      },
    );

    return unsubscribe;
  },
};
