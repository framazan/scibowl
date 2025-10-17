import { useEffect, useState, useCallback } from 'react';
import { getFirebaseAuth } from '../firebase';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { clearUserRoundsCache } from './rounds.firestore';

export default function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    }, (e) => {
      setError(e);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }, []);

  const loginWithEmail = useCallback(async (email, password) => {
    const auth = getFirebaseAuth();
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signupWithEmail = useCallback(async (email, password) => {
    const auth = getFirebaseAuth();
    await createUserWithEmailAndPassword(auth, email, password);
  }, []);

  const logout = useCallback(async () => {
    const auth = getFirebaseAuth();
    const uid = auth.currentUser?.uid;
    await signOut(auth);
    if (uid) await clearUserRoundsCache(uid);
  }, []);

  return { user, loading, error, loginWithGoogle, loginWithEmail, signupWithEmail, logout };
}
