import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore/lite';
import { auth, db } from '../firebase';
import type { GuestbookEntry, MemoryItem, PublishMemoryDraft, SecretLetterPublic, UserProfile } from '../types';
import { makeId } from '../utils/ids';

export const CLASS_NAME = '9/8';

const STUDENTS_COLLECTION = 'students98';
const MEMORIES_COLLECTION = 'memories98';
const GUESTBOOK_COLLECTION = 'guestbook98';
const SECRET_MAILBOX_PUBLIC_COLLECTION = 'secretMailbox98';
const SECRET_MAILBOX_PRIVATE_COLLECTION = 'secretMailboxPrivate98';
const AUTH_DOMAIN = 'memorybook-of-class98.firebaseapp.com';
const FIREBASE_RETRY_DELAYS = [0, 450, 1000, 1800];
const FIREBASE_TIMEOUT_MS = 12_000;
const FIREBASE_POLL_MS = 20_000;

export const cleanDisplayName = (name: string) => name.trim().replace(/\s+/g, ' ');

export const makeNameKey = (name: string) =>
  cleanDisplayName(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const makeStudentEmail = (nameKey: string) => `${nameKey}@${AUTH_DOMAIN}`;

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const isOfflineLikeError = (error: unknown) => {
  const maybeError = error as { code?: string; message?: string };
  const text = `${maybeError.code || ''} ${maybeError.message || ''}`.toLowerCase();
  return (
    text.includes('offline') ||
    text.includes('unavailable') ||
    text.includes('network') ||
    text.includes('timeout') ||
    text.includes('timed out') ||
    text.includes('target id already')
  );
};

const friendlyFirebaseError = (error: unknown) => {
  const maybeError = error as { code?: string; message?: string };
  const text = `${maybeError.code || ''} ${maybeError.message || ''}`.toLowerCase();

  if (
    text.includes('offline') ||
    text.includes('unavailable') ||
    text.includes('network') ||
    text.includes('timeout') ||
    text.includes('timed out') ||
    text.includes('target id already')
  ) {
    return new Error(
      'Ket noi Firebase chua on dinh. Hay doi vai giay roi thu lai; neu van loi, kiem tra Firestore da bat va domain GitHub Pages da nam trong Authorized domains.',
    );
  }

  return error instanceof Error ? error : new Error('Khong the ket noi Firebase luc nay.');
};

export const forceFirebaseOnline = async () => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Thiet bi dang mat internet, nen Firebase khong the online.');
  }
};

const withTimeout = async <T,>(promise: Promise<T>, label: string) =>
  Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} timeout`)), FIREBASE_TIMEOUT_MS);
    }),
  ]);

export const keepFirebaseOnline = () => () => undefined;

const withFirebaseRetry = async <T,>(operation: () => Promise<T>) => {
  let lastError: unknown;

  for (const delay of FIREBASE_RETRY_DELAYS) {
    if (delay) await sleep(delay);

    try {
      await forceFirebaseOnline();
      return await withTimeout(operation(), 'Firestore');
    } catch (error) {
      lastError = error;
      if (!isOfflineLikeError(error)) throw friendlyFirebaseError(error);
    }
  }

  throw friendlyFirebaseError(lastError);
};

const createVisiblePolling = (load: () => Promise<void>) =>
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void load();
  }, FIREBASE_POLL_MS);

const timestampToIso = (value: unknown) => {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
};

const profileFromData = (id: string, data: DocumentData, user?: User | null): UserProfile => ({
  uid: String(data.uid || user?.uid || ''),
  name: String(data.name || user?.displayName || id),
  nameKey: String(data.nameKey || id),
  className: CLASS_NAME,
  joinedAt: timestampToIso(data.createdAt),
});

const memoryFromDoc = (id: string, data: DocumentData): MemoryItem => ({
  id,
  uid: String(data.uid || ''),
  source: 'firebase',
  name: String(data.name || 'Classmate'),
  className: String(data.className || CLASS_NAME),
  caption: String(data.caption || ''),
  hashtags: Array.isArray(data.hashtags) ? data.hashtags.map(String).slice(0, 6) : [],
  imageUrl: String(data.imageUrl || ''),
  createdAt: timestampToIso(data.createdAt),
  reactions: Number(data.reactions || 0),
  rotation: Number(data.rotation || 0),
  tone: data.tone || 'pink',
});

const guestbookFromDoc = (id: string, data: DocumentData): GuestbookEntry => ({
  id,
  uid: String(data.uid || ''),
  name: String(data.name || 'Classmate'),
  message: String(data.message || ''),
  createdAt: timestampToIso(data.createdAt),
});

const secretLetterFromDoc = (id: string, data: DocumentData): SecretLetterPublic => ({
  id,
  message: String(data.message || ''),
  createdAt: timestampToIso(data.createdAt),
});

export const checkStudentName = async (name: string) => {
  const nameKey = makeNameKey(name);
  if (!nameKey) throw new Error('Hay nhap ho ten hop le.');
  const snapshot = await withFirebaseRetry(() => getDoc(doc(db, STUDENTS_COLLECTION, nameKey)));
  return {
    exists: snapshot.exists(),
    nameKey,
    profile: snapshot.exists() ? profileFromData(nameKey, snapshot.data()) : null,
  };
};

export const registerStudent = async (name: string, password: string) => {
  const displayName = cleanDisplayName(name);
  const nameKey = makeNameKey(displayName);
  if (!nameKey) throw new Error('Hay nhap ho ten hop le.');
  if (password.length < 6) throw new Error('Mat khau can it nhat 6 ky tu.');

  const studentRef = doc(db, STUDENTS_COLLECTION, nameKey);
  const existing = await withFirebaseRetry(() => getDoc(studentRef));
  if (existing.exists()) {
    if (existing.data().disabled) throw new Error('Tai khoan nay dang bi khoa trong lop 9/8.');
    throw new Error('Ten nay da co trong lop 9/8. Hay nhap mat khau de tiep tuc.');
  }

  const credential = await withTimeout(
    createUserWithEmailAndPassword(auth, makeStudentEmail(nameKey), password),
    'Auth register',
  );
  await withTimeout(updateProfile(credential.user, { displayName }), 'Auth profile');

  const profile: UserProfile = {
    uid: credential.user.uid,
    name: displayName,
    nameKey,
    className: CLASS_NAME,
    joinedAt: new Date().toISOString(),
  };

  await withFirebaseRetry(() => setDoc(studentRef, {
    uid: credential.user.uid,
    name: displayName,
    nameKey,
    className: CLASS_NAME,
    disabled: false,
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  }));

  return profile;
};

export const loginStudent = async (name: string, password: string) => {
  const nameKey = makeNameKey(name);
  if (!nameKey) throw new Error('Hay nhap ho ten hop le.');

  const credential = await withTimeout(
    signInWithEmailAndPassword(auth, makeStudentEmail(nameKey), password),
    'Auth login',
  );
  const studentRef = doc(db, STUDENTS_COLLECTION, nameKey);
  const snapshot = await withFirebaseRetry(() => getDoc(studentRef));

  if (!snapshot.exists()) {
    const displayName = cleanDisplayName(name);
    await withFirebaseRetry(() => setDoc(studentRef, {
      uid: credential.user.uid,
      name: displayName,
      nameKey,
      className: CLASS_NAME,
      disabled: false,
      repairedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    }));
    return {
      uid: credential.user.uid,
      name: displayName,
      nameKey,
      className: CLASS_NAME,
      joinedAt: new Date().toISOString(),
    };
  }

  if (snapshot.data().disabled) {
    await signOut(auth);
    throw new Error('Tai khoan nay dang bi khoa trong lop 9/8.');
  }

  await withFirebaseRetry(() => updateDoc(studentRef, { lastLoginAt: serverTimestamp() }));
  return profileFromData(nameKey, snapshot.data(), credential.user);
};

export const observeStudentSession = (onProfile: (profile: UserProfile | null) => void) =>
  onAuthStateChanged(auth, async (user) => {
    if (!user?.email) {
      onProfile(null);
      return;
    }

    const nameKey = user.email.split('@')[0];
    let snapshot;
    try {
      snapshot = await withFirebaseRetry(() => getDoc(doc(db, STUDENTS_COLLECTION, nameKey)));
    } catch {
      onProfile(null);
      return;
    }
    if (snapshot.exists() && !snapshot.data().disabled) {
      onProfile(profileFromData(nameKey, snapshot.data(), user));
      return;
    }

    if (snapshot.exists() && snapshot.data().disabled) {
      await signOut(auth);
    }
    onProfile(null);
  });

export const subscribeMemories = (
  onNext: (memories: MemoryItem[]) => void,
  onError: (error: Error) => void,
) => {
  const memoriesQuery = query(collection(db, MEMORIES_COLLECTION), orderBy('createdAt', 'desc'), limit(48));
  const load = async () => {
    try {
      const snapshot = await withFirebaseRetry(() => getDocs(memoriesQuery));
      onNext(snapshot.docs.map((item) => memoryFromDoc(item.id, item.data())).filter((item) => item.imageUrl));
    } catch (error) {
      onError(friendlyFirebaseError(error));
    }
  };
  void load();
  const interval = createVisiblePolling(load);
  return () => window.clearInterval(interval);
};

export const subscribeGuestbook = (
  onNext: (entries: GuestbookEntry[]) => void,
  onError: (error: Error) => void,
) => {
  const guestbookQuery = query(collection(db, GUESTBOOK_COLLECTION), orderBy('createdAt', 'desc'), limit(24));
  const load = async () => {
    try {
      const snapshot = await withFirebaseRetry(() => getDocs(guestbookQuery));
      onNext(snapshot.docs.map((item) => guestbookFromDoc(item.id, item.data())));
    } catch (error) {
      onError(friendlyFirebaseError(error));
    }
  };
  void load();
  const interval = createVisiblePolling(load);
  return () => window.clearInterval(interval);
};

export const subscribeSecretLetters = (
  onNext: (letters: SecretLetterPublic[]) => void,
  onError: (error: Error) => void,
) => {
  const lettersQuery = query(collection(db, SECRET_MAILBOX_PUBLIC_COLLECTION), orderBy('createdAt', 'desc'), limit(40));
  const load = async () => {
    try {
      const snapshot = await withFirebaseRetry(() => getDocs(lettersQuery));
      onNext(snapshot.docs.map((item) => secretLetterFromDoc(item.id, item.data())));
    } catch (error) {
      onError(friendlyFirebaseError(error));
    }
  };
  void load();
  const interval = createVisiblePolling(load);
  return () => window.clearInterval(interval);
};

export const publishMemoryToFirebase = async (profile: UserProfile, draft: PublishMemoryDraft) => {
  const id = makeId('memory');

  await withFirebaseRetry(() => setDoc(doc(db, MEMORIES_COLLECTION, id), {
    uid: profile.uid,
    name: profile.name,
    nameKey: profile.nameKey,
    className: CLASS_NAME,
    caption: draft.caption,
    hashtags: draft.hashtags,
    imageUrl: draft.imageDataUrl,
    reactions: 0,
    rotation: Math.round((Math.random() * 5 - 2.5) * 10) / 10,
    tone: 'pink',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
};

export const reactToFirebaseMemory = async (memory: MemoryItem) => {
  if (memory.source !== 'firebase') return;
  await withFirebaseRetry(() => updateDoc(doc(db, MEMORIES_COLLECTION, memory.id), {
    reactions: increment(1),
    updatedAt: serverTimestamp(),
  }));
};

export const addGuestbookEntry = async (profile: UserProfile, message: string) => {
  await withFirebaseRetry(() => addDoc(collection(db, GUESTBOOK_COLLECTION), {
    uid: profile.uid,
    name: profile.name,
    nameKey: profile.nameKey,
    className: CLASS_NAME,
    message,
    createdAt: serverTimestamp(),
  }));
};

export const addSecretLetter = async (profile: UserProfile, message: string) => {
  const id = makeId('letter');
  await withFirebaseRetry(() => Promise.all([
    setDoc(doc(db, SECRET_MAILBOX_PUBLIC_COLLECTION, id), {
      message,
      className: CLASS_NAME,
      createdAt: serverTimestamp(),
    }),
    setDoc(doc(db, SECRET_MAILBOX_PRIVATE_COLLECTION, id), {
      uid: profile.uid,
      name: profile.name,
      nameKey: profile.nameKey,
      className: CLASS_NAME,
      message,
      createdAt: serverTimestamp(),
    }),
  ]));
};

export const hasStudentMemory = async (profile: UserProfile) => {
  const studentMemories = query(
    collection(db, MEMORIES_COLLECTION),
    where('uid', '==', profile.uid),
    orderBy('createdAt', 'desc'),
    limit(1),
  );

  const snapshot = await withFirebaseRetry(() => getDocs(studentMemories));
  return !snapshot.empty;
};

