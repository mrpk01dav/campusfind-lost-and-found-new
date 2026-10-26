import {
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import type { UserProfile, UserRole } from '../domain';

function docDataToProfile(u: FirebaseUser, data?: Record<string, any>): UserProfile {
  return {
    id: u.uid,
    email: u.email || data?.email || '',
    displayName: data?.displayName || u.displayName || u.email?.split('@')[0] || 'Campus User',
    avatarUrl: data?.avatarUrl || u.photoURL || undefined,
    phoneNumber: data?.phoneNumber || undefined,
    department: data?.department || undefined,
    preferredContactMethod: data?.preferredContactMethod || 'email',
    notificationPreferences: {
      emailMatches: data?.notificationPreferences?.emailMatches ?? true,
      claimUpdates: data?.notificationPreferences?.claimUpdates ?? true,
      newClaimsReceived: data?.notificationPreferences?.newClaimsReceived ?? true,
    },
    role: (data?.role as UserRole) || 'student',
    createdAt: data?.createdAt?.toDate
      ? data.createdAt.toDate().toISOString()
      : u.metadata?.creationTime || new Date().toISOString(),
    updatedAt: data?.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : undefined,
  };
}

const OPERATION_NOT_ALLOWED_GUIDANCE =
  "Email/Password provider is not yet enabled in your Firebase project. To enable it, open the Firebase Console > Authentication > 'Sign-in method' tab > click 'Email/Password' and switch 'Enable' on. In the meantime, use 'Continue with Google' above to sign in immediately.";

export const authService = {
  async getSessionUser(): Promise<UserProfile | null> {
    const current = auth.currentUser;
    if (!current) return null;

    try {
      const userRef = doc(db, 'users', current.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        return docDataToProfile(current, snap.data());
      }
    } catch (err) {
      console.warn('Could not read user profile doc, falling back to auth token:', err);
    }

    return docDataToProfile(current);
  },

  async updateUserProfile(
    userId: string,
    updates: Partial<UserProfile>,
  ): Promise<{ user: UserProfile | null; error: string | null }> {
    const current = auth.currentUser;
    if (!current || current.uid !== userId) {
      return { user: null, error: 'Unauthorized: You can only edit your own profile.' };
    }

    try {
      const userRef = doc(db, 'users', userId);

      const firestorePayload: Record<string, any> = {
        updatedAt: serverTimestamp(),
      };

      if (updates.displayName !== undefined) {
        firestorePayload.displayName = updates.displayName.trim();
      }
      if (updates.avatarUrl !== undefined) {
        firestorePayload.avatarUrl = updates.avatarUrl || null;
      }
      if (updates.phoneNumber !== undefined) {
        firestorePayload.phoneNumber = updates.phoneNumber.trim() || null;
      }
      if (updates.department !== undefined) {
        firestorePayload.department = updates.department.trim() || null;
      }
      if (updates.preferredContactMethod !== undefined) {
        firestorePayload.preferredContactMethod = updates.preferredContactMethod;
      }
      if (updates.notificationPreferences !== undefined) {
        firestorePayload.notificationPreferences = updates.notificationPreferences;
      }

      await setDoc(userRef, firestorePayload, { merge: true });

      // Keep Auth token metadata in sync if displayName or avatar changed
      if (updates.displayName || updates.avatarUrl !== undefined) {
        await updateProfile(current, {
          displayName: updates.displayName?.trim() || current.displayName,
          photoURL: updates.avatarUrl || current.photoURL,
        }).catch((e) => console.warn('Could not update Firebase Auth user profile:', e));
      }

      // Re-read fresh document
      const snap = await getDoc(userRef);
      const updatedProfile = docDataToProfile(current, snap.data());
      return { user: updatedProfile, error: null };
    } catch (err: any) {
      console.error('Error updating user profile in Firestore:', err);
      return { user: null, error: err.message || 'Failed to update profile.' };
    }
  },

  async signInWithGoogle(): Promise<{ user: UserProfile | null; error: string | null }> {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      const u = cred.user;

      // Sync user profile to Firestore
      try {
        const userRef = doc(db, 'users', u.uid);
        const existingDoc = await getDoc(userRef);
        if (!existingDoc.exists()) {
          await setDoc(userRef, {
            id: u.uid,
            email: u.email || '',
            displayName: u.displayName || u.email?.split('@')[0] || 'Campus User',
            avatarUrl: u.photoURL || null,
            preferredContactMethod: 'email',
            notificationPreferences: {
              emailMatches: true,
              claimUpdates: true,
              newClaimsReceived: true,
            },
            role: 'student',
            createdAt: serverTimestamp(),
          });
        }
      } catch (e) {
        console.warn('Error saving user profile doc during Google sign in:', e);
      }

      return { user: await this.getSessionUser(), error: null };
    } catch (err: any) {
      return { user: null, error: err.message || 'Google sign in failed.' };
    }
  },

  async signUp(email: string, password: string, displayName: string): Promise<{ user: UserProfile | null; error: string | null }> {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const u = cred.user;

      if (displayName.trim()) {
        await updateProfile(u, { displayName: displayName.trim() });
      }

      try {
        const userRef = doc(db, 'users', u.uid);
        await setDoc(userRef, {
          id: u.uid,
          email: u.email || email,
          displayName: displayName.trim() || email.split('@')[0],
          preferredContactMethod: 'email',
          notificationPreferences: {
            emailMatches: true,
            claimUpdates: true,
            newClaimsReceived: true,
          },
          role: 'student',
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${u.uid}`);
      }

      const profile = await this.getSessionUser();
      return { user: profile, error: null };
    } catch (err: any) {
      let msg = err.message || 'Registration failed.';
      if (err.code === 'auth/operation-not-allowed') {
        msg = OPERATION_NOT_ALLOWED_GUIDANCE;
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists. Please sign in instead.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (err.code === 'auth/network-request-failed') {
        msg = 'Network connection failure. Please check your connection and try again.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many requests. Please wait a moment before trying again.';
      }
      return { user: null, error: msg };
    }
  },

  async signIn(email: string, password: string): Promise<{ user: UserProfile | null; error: string | null }> {
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const u = cred.user;
      return { user: docDataToProfile(u), error: null };
    } catch (err: any) {
      let msg = err.message || 'Failed to sign in.';
      if (err.code === 'auth/operation-not-allowed') {
        msg = OPERATION_NOT_ALLOWED_GUIDANCE;
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        msg = 'Invalid email or password.';
      } else if (err.code === 'auth/network-request-failed') {
        msg = 'Network connection failure. Please check your connection and try again.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Access temporarily disabled due to multiple failed login attempts. Try again later or reset your password.';
      }
      return { user: null, error: msg };
    }
  },

  async signOut(): Promise<{ error: string | null }> {
    try {
      await firebaseSignOut(auth);
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Sign out failed.' };
    }
  },

  async resetPassword(email: string): Promise<{ error: string | null }> {
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Password reset failed.' };
    }
  },

  onAuthStateChange(callback: (user: UserProfile | null) => void) {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            return callback(docDataToProfile(firebaseUser, snap.data()));
          }
        } catch {
          /* fallback below */
        }
        callback(docDataToProfile(firebaseUser));
      } else {
        callback(null);
      }
    });

    return unsubscribe;
  },
};
