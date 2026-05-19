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
  arrayUnion,
  collection,
  deleteDoc,
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
import type {
  ClassmateProfile,
  GuestbookEntry,
  MemoryComment,
  MemoryItem,
  PublishMemoryDraft,
  RememberNote,
  RememberNoteDraft,
  SecretDiaryEntry,
  UserProfile,
} from '../types';
import { makeId } from '../utils/ids';

export const CLASS_NAME = '9/8';

const STUDENTS_COLLECTION = 'students98';
const MEMORIES_COLLECTION = 'memories98';
const MEMORY_COMMENTS_COLLECTION = 'memoryComments98';
const GUESTBOOK_COLLECTION = 'guestbook98';
const SECRET_MAILBOX_PRIVATE_COLLECTION = 'secretMailboxPrivate98';
const REMEMBER_NOTES_COLLECTION = 'rememberNotes98';
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
    text.includes('permission-denied') ||
    text.includes('insufficient permissions')
  ) {
    return new Error(
      'Firebase đang chặn quyền thao tác này. Hãy deploy Firestore Rules mới nhất, rồi reload lại trang.',
    );
  }

  if (
    text.includes('offline') ||
    text.includes('unavailable') ||
    text.includes('network') ||
    text.includes('timeout') ||
    text.includes('timed out') ||
    text.includes('target id already')
  ) {
    return new Error(
      'Kết nối Firebase chưa ổn định. Hãy đợi vài giây rồi thử lại; nếu vẫn lỗi, kiểm tra Firestore đã bật và domain GitHub Pages đã nằm trong Authorized domains.',
    );
  }

  return error instanceof Error ? error : new Error('Không thể kết nối Firebase lúc này.');
};

export const forceFirebaseOnline = async () => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Thiết bị đang mất internet, nên Firebase không thể online.');
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
  likedBy: Array.isArray(data.likedBy) ? data.likedBy.map(String).slice(0, 500) : [],
  rotation: Number(data.rotation || 0),
  tone: data.tone || 'pink',
});

const memoryCommentFromDoc = (id: string, data: DocumentData): MemoryComment => ({
  id,
  memoryId: String(data.memoryId || ''),
  uid: String(data.uid || ''),
  name: String(data.name || 'Bạn cùng lớp'),
  nameKey: String(data.nameKey || ''),
  message: String(data.message || ''),
  createdAt: timestampToIso(data.createdAt),
});

const guestbookFromDoc = (id: string, data: DocumentData): GuestbookEntry => {
  const anonymous = Boolean(
    data.anonymous || data.kind === 'anonymous-board' || data.name === 'An danh' || data.name === 'Ẩn danh',
  );

  return {
    id,
    uid: String(data.uid || ''),
    name: anonymous ? 'Ẩn danh' : String(data.name || 'Classmate'),
    message: String(data.message || ''),
    createdAt: timestampToIso(data.createdAt),
    anonymous,
  };
};

const secretDiaryFromDoc = (id: string, data: DocumentData): SecretDiaryEntry => ({
  id,
  uid: String(data.uid || ''),
  name: String(data.name || ''),
  nameKey: String(data.nameKey || ''),
  message: String(data.message || ''),
  createdAt: timestampToIso(data.createdAt),
});

const classmateFromDoc = (id: string, data: DocumentData): ClassmateProfile => ({
  uid: String(data.uid || ''),
  name: String(data.name || id),
  nameKey: String(data.nameKey || id),
  className: String(data.className || CLASS_NAME),
});

const rememberNoteFromDoc = (id: string, data: DocumentData): RememberNote => ({
  id,
  fromUid: String(data.fromUid || ''),
  fromName: String(data.fromName || 'Bạn cùng lớp'),
  fromNameKey: String(data.fromNameKey || ''),
  toName: String(data.toName || ''),
  toNameKey: String(data.toNameKey || ''),
  message: String(data.message || ''),
  anonymous: Boolean(data.anonymous),
  createdAt: timestampToIso(data.createdAt),
});

export const checkStudentName = async (name: string) => {
  const nameKey = makeNameKey(name);
  if (!nameKey) throw new Error('Hãy nhập họ tên hợp lệ.');
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
  if (!nameKey) throw new Error('Hãy nhập họ tên hợp lệ.');
  if (password.length < 6) throw new Error('Mật khẩu cần ít nhất 6 ký tự.');

  const studentRef = doc(db, STUDENTS_COLLECTION, nameKey);
  const existing = await withFirebaseRetry(() => getDoc(studentRef));
  if (existing.exists()) {
    if (existing.data().disabled) throw new Error('Tài khoản này đang bị khóa trong lớp 9/8.');
    throw new Error('Tên này đã có trong lớp 9/8. Hãy nhập mật khẩu để tiếp tục.');
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
  if (!nameKey) throw new Error('Hãy nhập họ tên hợp lệ.');

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
    throw new Error('Tài khoản này đang bị khóa trong lớp 9/8.');
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

export const subscribeMemoryComments = (
  onNext: (comments: MemoryComment[]) => void,
  onError: (error: Error) => void,
) => {
  const commentsQuery = query(collection(db, MEMORY_COMMENTS_COLLECTION), orderBy('createdAt', 'desc'), limit(240));
  const load = async () => {
    try {
      const snapshot = await withFirebaseRetry(() => getDocs(commentsQuery));
      onNext(snapshot.docs.map((item) => memoryCommentFromDoc(item.id, item.data())).filter((item) => item.memoryId));
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

export const subscribeSecretDiaries = (
  profile: UserProfile,
  onNext: (diaries: SecretDiaryEntry[]) => void,
  onError: (error: Error) => void,
) => {
  const diariesQuery = query(
    collection(db, SECRET_MAILBOX_PRIVATE_COLLECTION),
    where('uid', '==', profile.uid),
    limit(40),
  );
  const load = async () => {
    try {
      const snapshot = await withFirebaseRetry(() => getDocs(diariesQuery));
      onNext(
        snapshot.docs
          .map((item) => secretDiaryFromDoc(item.id, item.data()))
          .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
      );
    } catch (error) {
      onError(friendlyFirebaseError(error));
    }
  };
  void load();
  const interval = createVisiblePolling(load);
  return () => window.clearInterval(interval);
};

export const subscribeClassmates = (
  onNext: (classmates: ClassmateProfile[]) => void,
  onError: (error: Error) => void,
) => {
  const classmatesQuery = query(collection(db, STUDENTS_COLLECTION), orderBy('name'), limit(80));
  const load = async () => {
    try {
      const snapshot = await withFirebaseRetry(() => getDocs(classmatesQuery));
      onNext(
        snapshot.docs
          .filter((item) => !item.data().disabled)
          .map((item) => classmateFromDoc(item.id, item.data()))
          .filter((item) => item.nameKey && item.className === CLASS_NAME),
      );
    } catch (error) {
      onError(friendlyFirebaseError(error));
    }
  };
  void load();
  const interval = createVisiblePolling(load);
  return () => window.clearInterval(interval);
};

export const subscribeRememberNotes = (
  profile: UserProfile,
  onNext: (notes: RememberNote[]) => void,
  onError: (error: Error) => void,
) => {
  const notesQuery = query(
    collection(db, REMEMBER_NOTES_COLLECTION),
    where('toNameKey', '==', profile.nameKey),
    limit(80),
  );
  const load = async () => {
    try {
      const snapshot = await withFirebaseRetry(() => getDocs(notesQuery));
      onNext(
        snapshot.docs
          .map((item) => rememberNoteFromDoc(item.id, item.data()))
          .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
      );
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
    likedBy: [],
    rotation: Math.round((Math.random() * 5 - 2.5) * 10) / 10,
    tone: 'pink',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
};

export const reactToFirebaseMemory = async (profile: UserProfile, memory: MemoryItem) => {
  if (memory.source !== 'firebase') return;
  if (memory.likedBy.includes(profile.uid)) {
    throw new Error('Bạn đã thả tim ảnh này rồi.');
  }

  await withFirebaseRetry(() => updateDoc(doc(db, MEMORIES_COLLECTION, memory.id), {
    reactions: increment(1),
    likedBy: arrayUnion(profile.uid),
    updatedAt: serverTimestamp(),
  }));
};

export const addMemoryComment = async (profile: UserProfile, memory: MemoryItem, message: string) => {
  if (memory.source !== 'firebase') {
    throw new Error('Chỉ ảnh đã đăng lên Firebase mới có thể bình luận.');
  }

  const safeMessage = message.trim().slice(0, 240);
  if (!safeMessage) throw new Error('Hãy nhập bình luận trước khi gửi.');

  const createdAt = new Date().toISOString();
  const docRef = await withFirebaseRetry(() => addDoc(collection(db, MEMORY_COMMENTS_COLLECTION), {
    memoryId: memory.id,
    memoryUid: memory.uid || '',
    uid: profile.uid,
    name: profile.name,
    nameKey: profile.nameKey,
    className: CLASS_NAME,
    message: safeMessage,
    createdAt: serverTimestamp(),
  }));

  return {
    id: docRef.id,
    memoryId: memory.id,
    uid: profile.uid,
    name: profile.name,
    nameKey: profile.nameKey,
    message: safeMessage,
    createdAt,
  };
};

export const deleteMemoryComment = async (profile: UserProfile, comment: MemoryComment) => {
  if (comment.uid !== profile.uid) {
    throw new Error('Bạn chỉ có thể xóa bình luận của chính mình.');
  }

  await withFirebaseRetry(() => deleteDoc(doc(db, MEMORY_COMMENTS_COLLECTION, comment.id)));
};

export const deleteFirebaseMemory = async (profile: UserProfile, memory: MemoryItem) => {
  if (memory.source !== 'firebase' || memory.uid !== profile.uid) {
    throw new Error('Bạn chỉ có thể xóa ảnh do chính mình đăng.');
  }

  await withFirebaseRetry(() => deleteDoc(doc(db, MEMORIES_COLLECTION, memory.id)));
};

export const addGuestbookEntry = async (profile: UserProfile, message: string) => {
  const createdAt = new Date().toISOString();
  const docRef = await withFirebaseRetry(() => addDoc(collection(db, GUESTBOOK_COLLECTION), {
    uid: profile.uid,
    name: profile.name,
    nameKey: profile.nameKey,
    className: CLASS_NAME,
    message,
    createdAt: serverTimestamp(),
  }));

  return {
    id: docRef.id,
    uid: profile.uid,
    name: profile.name,
    message,
    createdAt,
  };
};

export const addAnonymousMessage = async (profile: UserProfile, message: string) => {
  const createdAt = new Date().toISOString();
  const safeMessage = message.trim().slice(0, 160);
  const docRef = await withFirebaseRetry(() => addDoc(collection(db, GUESTBOOK_COLLECTION), {
    uid: profile.uid,
    name: 'Ẩn danh',
    nameKey: profile.nameKey,
    className: CLASS_NAME,
    message: safeMessage,
    createdAt: serverTimestamp(),
  }));

  return {
    id: docRef.id,
    uid: profile.uid,
    name: 'Ẩn danh',
    message: safeMessage,
    createdAt,
    anonymous: true,
  };
};

export const deleteGuestbookEntry = async (profile: UserProfile, entry: GuestbookEntry) => {
  if (entry.uid !== profile.uid) {
    throw new Error('Bạn chỉ có thể xóa tin nhắn của chính mình.');
  }

  await withFirebaseRetry(() => deleteDoc(doc(db, GUESTBOOK_COLLECTION, entry.id)));
};

export const addSecretDiary = async (profile: UserProfile, message: string) => {
  const id = makeId('diary');
  const createdAt = new Date().toISOString();

  await withFirebaseRetry(() => setDoc(doc(db, SECRET_MAILBOX_PRIVATE_COLLECTION, id), {
    uid: profile.uid,
    name: profile.name,
    nameKey: profile.nameKey,
    className: CLASS_NAME,
    message,
    createdAt: serverTimestamp(),
    kind: 'secret-diary',
  }));

  return {
    id,
    uid: profile.uid,
    name: profile.name,
    nameKey: profile.nameKey,
    message,
    createdAt,
  };
};

export const deleteSecretDiary = async (profile: UserProfile, diary: SecretDiaryEntry) => {
  if (diary.uid !== profile.uid) {
    throw new Error('Bạn chỉ có thể xóa nhật ký của chính mình.');
  }

  await withFirebaseRetry(() => deleteDoc(doc(db, SECRET_MAILBOX_PRIVATE_COLLECTION, diary.id)));
};

export const addRememberNote = async (profile: UserProfile, draft: RememberNoteDraft) => {
  const safeMessage = draft.message.trim().slice(0, 420);
  const toName = cleanDisplayName(draft.toName);
  const toNameKey = makeNameKey(draft.toNameKey || draft.toName);

  if (!toName || !toNameKey) throw new Error('Hãy chọn đúng một bạn trong lớp để gửi.');
  if (!safeMessage) throw new Error('Hãy viết điều bạn muốn giữ lại cho bạn ấy.');
  if (toNameKey === profile.nameKey) throw new Error('Hãy gửi cho một bạn khác trong lớp nha.');

  const id = makeId('remember');
  const createdAt = new Date().toISOString();

  await withFirebaseRetry(() => setDoc(doc(db, REMEMBER_NOTES_COLLECTION, id), {
    fromUid: profile.uid,
    fromName: profile.name,
    fromNameKey: profile.nameKey,
    toName,
    toNameKey,
    className: CLASS_NAME,
    message: safeMessage,
    anonymous: Boolean(draft.anonymous),
    kind: 'remember-note',
    createdAt: serverTimestamp(),
  }));

  return {
    id,
    fromUid: profile.uid,
    fromName: profile.name,
    fromNameKey: profile.nameKey,
    toName,
    toNameKey,
    message: safeMessage,
    anonymous: Boolean(draft.anonymous),
    createdAt,
  };
};

export const deleteRememberNote = async (profile: UserProfile, note: RememberNote) => {
  if (note.toNameKey !== profile.nameKey && note.fromUid !== profile.uid) {
    throw new Error('Bạn chỉ có thể xóa lời nhắn liên quan đến mình.');
  }

  await withFirebaseRetry(() => deleteDoc(doc(db, REMEMBER_NOTES_COLLECTION, note.id)));
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

