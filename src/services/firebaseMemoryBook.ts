import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import type { GuestbookEntry, MemoryItem, PublishMemoryDraft, UserProfile } from '../types';
import { makeId } from '../utils/ids';

export const CLASS_NAME = '9/8';

const STUDENTS_COLLECTION = 'students98';
const MEMORIES_COLLECTION = 'memories98';
const GUESTBOOK_COLLECTION = 'guestbook98';
const STORAGE_ROOT = 'photobooks98';
const AUTH_DOMAIN = 'memorybook-of-class98.firebaseapp.com';

export const cleanDisplayName = (name: string) => name.trim().replace(/\s+/g, ' ');

export const makeNameKey = (name: string) =>
  cleanDisplayName(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const makeStudentEmail = (nameKey: string) => `${nameKey}@${AUTH_DOMAIN}`;

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
  storagePath: data.storagePath ? String(data.storagePath) : undefined,
});

const guestbookFromDoc = (id: string, data: DocumentData): GuestbookEntry => ({
  id,
  uid: String(data.uid || ''),
  name: String(data.name || 'Classmate'),
  message: String(data.message || ''),
  createdAt: timestampToIso(data.createdAt),
});

export const checkStudentName = async (name: string) => {
  const nameKey = makeNameKey(name);
  if (!nameKey) throw new Error('Hãy nhập họ tên hợp lệ.');
  const snapshot = await getDoc(doc(db, STUDENTS_COLLECTION, nameKey));
  return { exists: snapshot.exists(), nameKey, profile: snapshot.exists() ? profileFromData(nameKey, snapshot.data()) : null };
};

export const registerStudent = async (name: string, password: string) => {
  const displayName = cleanDisplayName(name);
  const nameKey = makeNameKey(displayName);
  if (!nameKey) throw new Error('Hãy nhập họ tên hợp lệ.');
  if (password.length < 6) throw new Error('Mật khẩu cần ít nhất 6 ký tự.');

  const studentRef = doc(db, STUDENTS_COLLECTION, nameKey);
  const existing = await getDoc(studentRef);
  if (existing.exists()) throw new Error('Tên này đã có trong lớp 9/8. Hãy nhập mật khẩu để tiếp tục.');

  const credential = await createUserWithEmailAndPassword(auth, makeStudentEmail(nameKey), password);
  await updateProfile(credential.user, { displayName });

  const profile: UserProfile = {
    uid: credential.user.uid,
    name: displayName,
    nameKey,
    className: CLASS_NAME,
    joinedAt: new Date().toISOString(),
  };

  await setDoc(studentRef, {
    uid: credential.user.uid,
    name: displayName,
    nameKey,
    className: CLASS_NAME,
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  });

  return profile;
};

export const loginStudent = async (name: string, password: string) => {
  const nameKey = makeNameKey(name);
  if (!nameKey) throw new Error('Hãy nhập họ tên hợp lệ.');

  const credential = await signInWithEmailAndPassword(auth, makeStudentEmail(nameKey), password);
  const studentRef = doc(db, STUDENTS_COLLECTION, nameKey);
  const snapshot = await getDoc(studentRef);

  if (!snapshot.exists()) {
    const displayName = cleanDisplayName(name);
    await setDoc(studentRef, {
      uid: credential.user.uid,
      name: displayName,
      nameKey,
      className: CLASS_NAME,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    });
    return {
      uid: credential.user.uid,
      name: displayName,
      nameKey,
      className: CLASS_NAME,
      joinedAt: new Date().toISOString(),
    };
  }

  await updateDoc(studentRef, { lastLoginAt: serverTimestamp() });
  return profileFromData(nameKey, snapshot.data(), credential.user);
};

export const observeStudentSession = (onProfile: (profile: UserProfile | null) => void) =>
  onAuthStateChanged(auth, async (user) => {
    if (!user?.email) {
      onProfile(null);
      return;
    }

    const nameKey = user.email.split('@')[0];
    const snapshot = await getDoc(doc(db, STUDENTS_COLLECTION, nameKey));
    if (snapshot.exists()) {
      onProfile(profileFromData(nameKey, snapshot.data(), user));
      return;
    }

    onProfile({
      uid: user.uid,
      name: user.displayName || nameKey,
      nameKey,
      className: CLASS_NAME,
      joinedAt: new Date().toISOString(),
    });
  });

export const subscribeMemories = (
  onNext: (memories: MemoryItem[]) => void,
  onError: (error: Error) => void,
) => {
  const memoriesQuery = query(collection(db, MEMORIES_COLLECTION), orderBy('createdAt', 'desc'), limit(48));
  return onSnapshot(
    memoriesQuery,
    (snapshot) => onNext(snapshot.docs.map((item) => memoryFromDoc(item.id, item.data())).filter((item) => item.imageUrl)),
    onError,
  );
};

export const subscribeGuestbook = (
  onNext: (entries: GuestbookEntry[]) => void,
  onError: (error: Error) => void,
) => {
  const guestbookQuery = query(collection(db, GUESTBOOK_COLLECTION), orderBy('createdAt', 'desc'), limit(24));
  return onSnapshot(
    guestbookQuery,
    (snapshot) => onNext(snapshot.docs.map((item) => guestbookFromDoc(item.id, item.data()))),
    onError,
  );
};

export const publishMemoryToFirebase = async (profile: UserProfile, draft: PublishMemoryDraft) => {
  const id = makeId('memory');
  const storagePath = `${STORAGE_ROOT}/${profile.uid}/${id}.jpg`;
  const storageRef = ref(storage, storagePath);
  const upload = await uploadBytes(storageRef, draft.imageBlob, {
    contentType: 'image/jpeg',
    customMetadata: {
      studentName: profile.name,
      className: CLASS_NAME,
    },
  });
  const imageUrl = await getDownloadURL(upload.ref);

  await setDoc(doc(db, MEMORIES_COLLECTION, id), {
    uid: profile.uid,
    name: profile.name,
    nameKey: profile.nameKey,
    className: CLASS_NAME,
    caption: draft.caption,
    hashtags: draft.hashtags,
    imageUrl,
    storagePath,
    reactions: 0,
    rotation: Math.round((Math.random() * 5 - 2.5) * 10) / 10,
    tone: 'pink',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const reactToFirebaseMemory = async (memory: MemoryItem) => {
  if (memory.source !== 'firebase') return;
  await updateDoc(doc(db, MEMORIES_COLLECTION, memory.id), {
    reactions: increment(1),
    updatedAt: serverTimestamp(),
  });
};

export const addGuestbookEntry = async (profile: UserProfile, message: string) => {
  await addDoc(collection(db, GUESTBOOK_COLLECTION), {
    uid: profile.uid,
    name: profile.name,
    nameKey: profile.nameKey,
    className: CLASS_NAME,
    message,
    createdAt: serverTimestamp(),
  });
};

export const hasStudentMemory = async (profile: UserProfile) => {
  const studentMemories = query(
    collection(db, MEMORIES_COLLECTION),
    where('uid', '==', profile.uid),
    orderBy('createdAt', 'desc'),
    limit(1),
  );

  return new Promise<boolean>((resolve, reject) => {
    const unsubscribe = onSnapshot(
      studentMemories,
      (snapshot) => {
        unsubscribe();
        resolve(!snapshot.empty);
      },
      (error) => {
        unsubscribe();
        reject(error);
      },
    );
  });
};
