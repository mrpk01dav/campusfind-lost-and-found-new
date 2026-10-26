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
import type { AppNotification, NotificationType } from '../domain';

function docToNotification(d: QueryDocumentSnapshot<DocumentData> | { id: string; data: () => DocumentData }): AppNotification {
  const data = d.data();
  const createdAtIso = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString();

  return {
    id: d.id,
    recipientId: data.recipientId || '',
    senderId: data.senderId || '',
    senderName: data.senderName || 'Campus Member',
    type: (data.type as NotificationType) || 'match_alert',
    title: data.title || '',
    message: data.message || '',
    itemId: data.itemId || '',
    itemTitle: data.itemTitle || '',
    foundItemId: data.foundItemId || undefined,
    claimId: data.claimId || undefined,
    read: Boolean(data.read),
    createdAt: createdAtIso,
  };
}

export const notificationService = {
  /**
   * Fetches all notifications directed to a specific user
   */
  async fetchNotifications(userId: string): Promise<{ notifications: AppNotification[]; error: string | null }> {
    try {
      if (!userId) return { notifications: [], error: null };
      const q = query(
        collection(db, 'notifications'),
        where('recipientId', '==', userId),
        orderBy('createdAt', 'desc'),
      );
      const snap = await getDocs(q);
      const notifications = snap.docs.map(docToNotification);
      return { notifications, error: null };
    } catch (err: any) {
      console.warn('Error fetching notifications:', err);
      return { notifications: [], error: err.message || 'Failed to load notifications.' };
    }
  },

  /**
   * Realtime subscription for a user's incoming notifications
   */
  subscribeToNotifications(userId: string, onChange: (notifications: AppNotification[]) => void) {
    if (!userId) return () => {};

    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', userId),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifications = snapshot.docs.map(docToNotification);
        onChange(notifications);
      },
      (error) => {
        console.warn('Notification snapshot subscription warning:', error.message);
      },
    );

    return unsubscribe;
  },

  /**
   * Creates an in-app notification record
   */
  async createNotification(
    draft: {
      recipientId: string;
      senderId: string;
      senderName: string;
      type: NotificationType;
      title: string;
      message: string;
      itemId: string;
      itemTitle: string;
      foundItemId?: string;
      claimId?: string;
    },
  ): Promise<{ error: string | null }> {
    // Avoid sending notification to self
    if (draft.recipientId === draft.senderId) {
      return { error: null };
    }

    try {
      const notifRef = doc(collection(db, 'notifications'));
      const payload: Record<string, any> = {
        recipientId: draft.recipientId,
        senderId: draft.senderId,
        senderName: draft.senderName.trim(),
        type: draft.type,
        title: draft.title.trim(),
        message: draft.message.trim(),
        itemId: draft.itemId,
        read: false,
        createdAt: serverTimestamp(),
      };

      if (draft.itemTitle?.trim()) {
        payload.itemTitle = draft.itemTitle.trim();
      }
      if (draft.foundItemId) {
        payload.foundItemId = draft.foundItemId;
      }
      if (draft.claimId) {
        payload.claimId = draft.claimId;
      }

      await setDoc(notifRef, payload);
      return { error: null };
    } catch (err: any) {
      console.error('Error creating notification:', err);
      handleFirestoreError(err, OperationType.CREATE, 'notifications');
    }
  },

  /**
   * Marks a single notification as read
   */
  async markAsRead(notificationId: string): Promise<{ error: string | null }> {
    try {
      const notifRef = doc(db, 'notifications', notificationId);
      await updateDoc(notifRef, { read: true });
      return { error: null };
    } catch (err: any) {
      console.error('Error marking notification as read:', err);
      handleFirestoreError(err, OperationType.UPDATE, `notifications/${notificationId}`);
    }
  },

  /**
   * Marks all unread notifications for a user as read
   */
  async markAllAsRead(notifications: AppNotification[]): Promise<void> {
    const unread = notifications.filter((n) => !n.read);
    for (const n of unread) {
      try {
        const notifRef = doc(db, 'notifications', n.id);
        await updateDoc(notifRef, { read: true });
      } catch {
        /* ignore individual failures */
      }
    }
  },

  /**
   * Bidirectional notification: Finder notifies person who reported a matching lost item
   */
  async notifyMatchFound(params: {
    loserId: string;
    finderId: string;
    finderName: string;
    lostItemId: string;
    lostItemTitle: string;
    foundItemId: string;
    foundItemTitle: string;
    foundLocation?: string;
    customNote?: string;
  }): Promise<{ error: string | null }> {
    const noteText = params.customNote?.trim() ? ` Message from finder: "${params.customNote.trim()}"` : '';
    const locText = params.foundLocation ? ` near ${params.foundLocation}` : '';

    return this.createNotification({
      recipientId: params.loserId,
      senderId: params.finderId,
      senderName: params.finderName,
      type: 'match_alert',
      title: `Possible match found for your "${params.lostItemTitle}"!`,
      message: `${params.finderName} posted a matching found item${locText}.${noteText} View the found report to verify details and submit an ownership claim.`,
      itemId: params.lostItemId,
      itemTitle: params.lostItemTitle,
      foundItemId: params.foundItemId,
    });
  },
};
