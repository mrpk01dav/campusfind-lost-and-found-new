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

function firebaseUserToProfile(u: FirebaseUser, role: UserRole = 'student'): UserProfile {
  return {
    id: u.uid,
    email: u.email || '',
    displayName: u.displayName || u.email?.split('@')[0] || 'Campus User',
    avatarUrl: u.photoURL || undefined,
    role,
    createdAt: u.metadata?.creationTime || new Date().toISOString(),
  };
}

export const authService = {
  async getSessionUser(): Promise<UserProfile | null> {
    const current = auth.currentUser;
    if (!current) return null;

    try {
      const userRef = doc(db, 'users', current.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        return {
          id: current.uid,
          email: current.email || data.email || '',
          displayName: data.displayName || current.displayName || current.email?.split('@')[0] || 'Campus User',
          avatarUrl: data.avatarUrl || current.photoURL || undefined,
          role: (data.role as UserRole) || 'student',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : current.metadata?.creationTime || new Date().toISOString(),
        };
      }
    } catch (err) {
      console.warn('Could not read user profile doc, falling back to auth token:', err);
    }

    return firebaseUserToProfile(current);
  },

  async signInWithGoogle(): Promise<{ user: UserProfile | null; error: string | null }> {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      const u = cred.user;

      // Sync user profile to Firestore
      const profile = firebaseUserToProfile(u);
      try {
        const userRef = doc(db, 'users', u.uid);
        const existingDoc = await getDoc(userRef);
        if (!existingDoc.exists()) {
          await setDoc(userRef, {
            id: u.uid,
            email: u.email || '',
            displayName: profile.displayName,
            avatarUrl: u.photoURL || null,
            role: 'student',
            createdAt: serverTimestamp(),
          });
        }
      } catch (e) {
        console.warn('Error saving user profile doc during Google sign in:', e);
      }

      return { user: profile, error: null };
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

      const profile: UserProfile = {
        id: u.uid,
        email: u.email || email,
        displayName: displayName.trim() || email.split('@')[0],
        role: 'student',
        createdAt: new Date().toISOString(),
      };

      try {
        const userRef = doc(db, 'users', u.uid);
        await setDoc(userRef, {
          id: u.uid,
          email: u.email || email,
          displayName: profile.displayName,
          role: 'student',
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${u.uid}`);
      }

      return { user: profile, error: null };
    } catch (err: any) {
      let msg = err.message || 'Registration failed.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists. Please sign in instead.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      }
      return { user: null, error: msg };
    }
  },

  async signIn(email: string, password: string): Promise<{ user: UserProfile | null; error: string | null }> {
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const u = cred.user;
      return { user: firebaseUserToProfile(u), error: null };
    } catch (err: any) {
      let msg = err.message || 'Failed to sign in.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        msg = 'Invalid email or password.';
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
        let role: UserRole = 'student';
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const snap = await getDoc(userRef);
          if (snap.exists() && snap.data().role) {
            role = snap.data().role as UserRole;
          }
        } catch {
          /* fallback to student */
        }
        callback(firebaseUserToProfile(firebaseUser, role));
      } else {
        callback(null);
      }
    });

    return unsubscribe;
  },
};
