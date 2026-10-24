import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type { AbuseReport } from '../domain';

function docToReport(d: QueryDocumentSnapshot<DocumentData> | { id: string; data: () => DocumentData }): AbuseReport {
  const data = d.data();
  const createdAtIso = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString();

  return {
    id: d.id,
    itemId: data.itemId,
    reporterId: data.reporterId,
    reporterName: data.reporterName || undefined,
    reason: data.reason || 'Flagged report',
    details: data.details || undefined,
    status: data.status || 'pending',
    createdAt: createdAtIso,
  };
}

export const reportService = {
  async submitReport(
    itemId: string,
    reason: string,
    reporterId: string,
    details?: string,
  ): Promise<{ error: string | null }> {
    try {
      const reportRef = doc(collection(db, 'reports'));
      const payload: Record<string, any> = {
        itemId,
        reporterId,
        reason: reason.trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
      };

      if (details?.trim()) {
        payload.details = details.trim();
      }

      await setDoc(reportRef, payload);
      return { error: null };
    } catch (err: any) {
      console.error('Error submitting report to Firestore:', err);
      handleFirestoreError(err, OperationType.CREATE, 'reports');
    }
  },

  async fetchReports(userId?: string): Promise<{ reports: AbuseReport[]; error: string | null }> {
    try {
      if (!userId) return { reports: [], error: null };
      const q = query(
        collection(db, 'reports'),
        where('reporterId', '==', userId),
        orderBy('createdAt', 'desc'),
      );
      const snap = await getDocs(q);
      const reports = snap.docs.map(docToReport);
      return { reports, error: null };
    } catch (err: any) {
      console.error('Error fetching reports from Firestore:', err);
      return { reports: [], error: err.message || 'Failed to fetch reports.' };
    }
  },
};
