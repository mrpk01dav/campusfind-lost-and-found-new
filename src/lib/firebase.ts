import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firestore with configured database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Firebase Cloud Storage
export const storage = getStorage(
  app,
  firebaseConfig.storageBucket ? `gs://${firebaseConfig.storageBucket}` : undefined,
);

export const isFirebaseConfigured = Boolean(firebaseConfig && firebaseConfig.projectId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function isTokenServiceDisabledError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('token-service-api-has-not-been-used') || msg.includes('securetoken.googleapis.com');
}

export const SECURE_TOKEN_ENABLE_URL =
  `https://console.developers.google.com/apis/api/securetoken.googleapis.com/overview?project=${firebaseConfig.messagingSenderId || firebaseConfig.projectId}`;

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const rawMsg = error instanceof Error ? error.message : String(error);
  const isPermission =
    rawMsg.includes('permission') ||
    rawMsg.includes('PERMISSION_DENIED') ||
    rawMsg.includes('Missing or insufficient permissions');

  const errInfo: FirestoreErrorInfo = {
    error: rawMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };

  if (isPermission) {
    console.error('Firestore Security Rule Violation: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  }

  if (isTokenServiceDisabledError(error)) {
    console.warn(
      `Firestore Auth Token Notice: Token Service API (securetoken.googleapis.com) is disabled or propagating in project ${firebaseConfig.messagingSenderId || firebaseConfig.projectId}. Enable at ${SECURE_TOKEN_ENABLE_URL}`,
    );
  } else {
    console.warn(`Firestore Operation Warning (${operationType} at ${path}):`, rawMsg);
  }

  throw new Error(JSON.stringify(errInfo));
}

// Diagnostic connection test to Firestore (called on-demand, not on eager boot)
export async function testConnection(): Promise<{ connected: boolean; tokenServiceDisabled: boolean; message: string }> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { connected: true, tokenServiceDisabled: false, message: 'Cloud Firestore connected directly.' };
  } catch (error) {
    if (isTokenServiceDisabledError(error)) {
      return {
        connected: false,
        tokenServiceDisabled: true,
        message: `Token Service API not yet enabled on project. Visit: ${SECURE_TOKEN_ENABLE_URL}`,
      };
    }
    const isOffline = error instanceof Error && error.message.includes('the client is offline');
    return {
      connected: false,
      tokenServiceDisabled: false,
      message: isOffline ? 'Operating in offline cache mode.' : (error instanceof Error ? error.message : String(error)),
    };
  }
}
