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
  runTransaction,
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
  CinematicSlideshowSettings,
  CommentReactionId,
  GuestbookEntry,
  MemoryComment,
  MemoryItem,
  MemoryRecapSettings,
  NotificationActivity,
  PublishMemoryDraft,
  RememberNote,
  RememberNoteDraft,
  RememberReactionId,
  SecretDiaryEntry,
  TimeCapsuleEntry,
  TimeCapsuleSettings,
  UserProfile,
  VoteCategory,
  VoteCategoryDraft,
  VoteRecord,
  YouthProfileDraft,
} from '../types';
import { makeId } from '../utils/ids';

export const CLASS_NAME = '9/8';

const STUDENTS_COLLECTION = 'students98';
const NICKNAME_CLAIMS_COLLECTION = 'nicknameClaims98';
const MEMORIES_COLLECTION = 'memories98';
const PRIVATE_MEMORIES_COLLECTION = 'privateMemories98';
const MEMORY_VIDEO_CHUNKS_COLLECTION = 'memoryVideoChunks98';
const MEMORY_COMMENTS_COLLECTION = 'memoryComments98';
const MEMORY_DOWNLOAD_LOGS_COLLECTION = 'memoryDownloadLogs98';
const GUESTBOOK_COLLECTION = 'guestbook98';
const TIME_CAPSULE_COLLECTION = 'timeCapsules98';
const SECRET_MAILBOX_PRIVATE_COLLECTION = 'secretMailboxPrivate98';
const REMEMBER_NOTES_COLLECTION = 'rememberNotes98';
const VOTE_CATEGORIES_COLLECTION = 'voteCategories98';
const VOTES_SUBCOLLECTION = 'votes';
const SITE_SETTINGS_COLLECTION = 'siteSettings98';
const MEMORY_RECAP_SETTING_ID = 'memoryRecap';
const CINEMATIC_SLIDESHOW_SETTING_ID = 'cinematicSlideshow';
const TIME_CAPSULE_SETTING_ID = 'timeCapsule';
const AUTH_DOMAIN = 'memorybook-of-class98.firebaseapp.com';
const FIREBASE_RETRY_DELAYS = [0, 450, 1000, 1800];
const FIREBASE_TIMEOUT_MS = 12_000;
const FIREBASE_POLL_MS = 20_000;
const SITE_SETTINGS_POLL_MS = 4_000;
const REMEMBER_REACTION_LABELS: Record<RememberReactionId, string> = {
  'miss-you': 'Nhớ cậu',
  'thank-you': 'Cảm ơn',
  regret: 'Tiếc nuối',
  'good-luck': 'Chúc may mắn',
};
const REMEMBER_REACTION_IDS = Object.keys(REMEMBER_REACTION_LABELS) as RememberReactionId[];
const COMMENT_REACTION_FIELDS: Record<CommentReactionId, string> = {
  haha: 'reactionHahaBy',
  love: 'reactionLoveBy',
  miss: 'reactionMissBy',
  wow: 'reactionWowBy',
};
const COMMENT_REACTION_IDS = Object.keys(COMMENT_REACTION_FIELDS) as CommentReactionId[];

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

const firebaseErrorText = (error: unknown) => {
  const maybeError = error as {
    code?: string;
    message?: string;
    name?: string;
    stack?: string;
    customData?: unknown;
  };
  const parts = [
    maybeError?.code,
    maybeError?.name,
    maybeError?.message,
    maybeError?.stack,
    typeof error === 'string' ? error : '',
  ];

  try {
    parts.push(JSON.stringify(maybeError?.customData || error));
  } catch {
    // Firebase errors can contain cyclic internals; readable fields above are enough.
  }

  return parts.filter(Boolean).join(' ').toLowerCase();
};

const isOfflineLikeError = (error: unknown) => {
  const text = firebaseErrorText(error);
  return (
    text.includes('offline') ||
    text.includes('unavailable') ||
    text.includes('network') ||
    text.includes('timeout') ||
    text.includes('timed out') ||
    text.includes('target id already') ||
    text.includes('failed to fetch') ||
    text.includes('http error has no status') ||
    text.includes('name_not_resolved') ||
    text.includes('err_name_not_resolved') ||
    text.includes('request failed with error: undefined') ||
    text.includes('code":"unknown') ||
    text.includes('code: unknown') ||
    text === 'unknown firebaseerror'
  );
};

const friendlyFirebaseError = (error: unknown) => {
  const text = firebaseErrorText(error);

  if (
    text.includes('permission-denied') ||
    text.includes('insufficient permissions') ||
    text.includes('403') ||
    text.includes('forbidden')
  ) {
    return new Error(
      'Firebase đang chặn quyền thao tác này. Hãy deploy Firestore Rules mới nhất, rồi reload lại trang.',
    );
  }

  if (
    text.includes('failed to fetch') ||
    text.includes('http error has no status') ||
    text.includes('name_not_resolved') ||
    text.includes('err_name_not_resolved') ||
    text.includes('request failed with error: undefined') ||
    text.includes('code":"unknown') ||
    text.includes('code: unknown') ||
    text === 'unknown firebaseerror'
  ) {
    return new Error(
      'Không kết nối được Firebase. Thiết bị hoặc DNS đang không vào được firestore.googleapis.com; hãy đổi mạng, tắt VPN/adblock DNS nếu có, đổi DNS sang 8.8.8.8 hoặc 1.1.1.1 rồi reload lại trang.',
    );
  }

  if (
    text.includes('offline') ||
    text.includes('unavailable') ||
    text.includes('network') ||
    text.includes('timeout') ||
    text.includes('timed out') ||
    text.includes('target id already') ||
    text.includes('failed to fetch') ||
    text.includes('http error has no status') ||
    text.includes('name_not_resolved') ||
    text.includes('err_name_not_resolved') ||
    text.includes('request failed with error: undefined') ||
    text.includes('code":"unknown') ||
    text.includes('code: unknown') ||
    text === 'unknown firebaseerror'
  ) {
    return new Error(
      'Kết nối Firebase chưa ổn định. Hãy đợi vài giây rồi thử lại; nếu vẫn lỗi, kiểm tra Firestore đã bật và domain GitHub Pages đã nằm trong Authorized domains.',
    );
  }

  if (error instanceof Error && error.message && !error.message.includes('undefined')) return error;
  return new Error('Không thể kết nối Firebase lúc này. Hãy reload lại trang và thử lại sau vài giây.');
};

const isAuthEmailAlreadyInUse = (error: unknown) => firebaseErrorText(error).includes('auth/email-already-in-use');

const isInvalidAuthCredential = (error: unknown) => {
  const text = firebaseErrorText(error);
  return text.includes('auth/invalid-credential') || text.includes('auth/wrong-password');
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

const createVisiblePolling = (load: () => Promise<void>, intervalMs = FIREBASE_POLL_MS) =>
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void load();
  }, intervalMs);

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
  disabled: Boolean(data.disabled),
  deleted: Boolean(data.deleted),
});

const memoryCollectionForItem = (memory: MemoryItem) =>
  memory.storageCollection === PRIVATE_MEMORIES_COLLECTION ? PRIVATE_MEMORIES_COLLECTION : MEMORIES_COLLECTION;

const memoryFromDoc = (
  id: string,
  data: DocumentData,
  storageCollection: 'memories98' | 'privateMemories98' = MEMORIES_COLLECTION,
): MemoryItem => ({
  id,
  uid: String(data.uid || ''),
  source: 'firebase',
  storageCollection,
  name: String(data.name || 'Classmate'),
  nameKey: String(data.nameKey || ''),
  className: String(data.className || CLASS_NAME),
  caption: String(data.caption || ''),
  hashtags: Array.isArray(data.hashtags) ? data.hashtags.map(String).slice(0, 6) : [],
  mediaType: data.mediaType === 'video' ? 'video' : 'image',
  imageUrl: String(data.imageUrl || ''),
  videoChunked: Boolean(data.videoChunked),
  videoMimeType: data.videoMimeType ? String(data.videoMimeType) : undefined,
  videoSize: Number(data.videoSize || 0),
  videoDuration: Number(data.videoDuration || 0),
  visibility: data.visibility === 'private' || data.visibility === 'tagged' ? data.visibility : 'public',
  visibleToUids: Array.isArray(data.visibleToUids) ? data.visibleToUids.map(String).slice(0, 80) : [],
  visibleToNameKeys: Array.isArray(data.visibleToNameKeys) ? data.visibleToNameKeys.map(String).slice(0, 80) : [],
  visibleToNames: Array.isArray(data.visibleToNames) ? data.visibleToNames.map(String).slice(0, 80) : [],
  createdAt: timestampToIso(data.createdAt),
  updatedAt: data.updatedAt ? timestampToIso(data.updatedAt) : undefined,
  reactions: Number(data.reactions || 0),
  likedBy: Array.isArray(data.likedBy) ? data.likedBy.map(String).slice(0, 500) : [],
  rotation: Number(data.rotation || 0),
  tone: data.tone || 'pink',
});

const memoryCommentFromDoc = (id: string, data: DocumentData): MemoryComment => ({
  id,
  memoryId: String(data.memoryId || ''),
  memoryUid: data.memoryUid ? String(data.memoryUid) : undefined,
  uid: String(data.uid || ''),
  name: String(data.name || 'Bạn cùng lớp'),
  nameKey: String(data.nameKey || ''),
  message: String(data.message || ''),
  createdAt: timestampToIso(data.createdAt),
  updatedAt: data.updatedAt ? timestampToIso(data.updatedAt) : undefined,
  ...commentReactionsFromData(data),
});

const commentReactionUsers = (data: DocumentData, reactionId: CommentReactionId) => {
  const value = data[COMMENT_REACTION_FIELDS[reactionId]];
  return Array.isArray(value) ? value.map(String).slice(0, 500) : [];
};

const commentReactionsFromData = (data: DocumentData) => {
  const reactionCounts = COMMENT_REACTION_IDS.reduce(
    (acc, reactionId) => {
      acc[reactionId] = commentReactionUsers(data, reactionId).length;
      return acc;
    },
    { haha: 0, love: 0, miss: 0, wow: 0 } as Record<CommentReactionId, number>,
  );
  const reactionByUid: Record<string, CommentReactionId> = {};
  COMMENT_REACTION_IDS.forEach((reactionId) => {
    commentReactionUsers(data, reactionId).forEach((uid) => {
      if (!reactionByUid[uid]) reactionByUid[uid] = reactionId;
    });
  });
  return { reactionCounts, reactionByUid };
};

const guestbookFromDoc = (id: string, data: DocumentData): GuestbookEntry => {
  const anonymous = Boolean(
    data.anonymous || data.kind === 'anonymous-board' || data.name === 'An danh' || data.name === 'Ẩn danh',
  );

  return {
    id,
    uid: String(data.uid || ''),
    nameKey: String(data.nameKey || ''),
    name: anonymous ? 'Ẩn danh' : String(data.name || 'Classmate'),
    message: String(data.message || ''),
    createdAt: timestampToIso(data.createdAt),
    anonymous,
  };
};

const timeCapsuleFromDoc = (id: string, data: DocumentData): TimeCapsuleEntry => ({
  id,
  uid: String(data.uid || ''),
  name: String(data.name || 'Bạn lớp 9/8'),
  nameKey: String(data.nameKey || ''),
  className: String(data.className || CLASS_NAME),
  message: String(data.message || ''),
  createdAt: timestampToIso(data.createdAt),
});

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
  avatarDataUrl: data.avatarDataUrl ? String(data.avatarDataUrl) : undefined,
  nickname: data.nickname ? String(data.nickname) : undefined,
  nicknameKey: data.nicknameKey ? String(data.nicknameKey) : undefined,
  quote: data.quote ? String(data.quote) : undefined,
  classMessage: data.classMessage ? String(data.classMessage) : undefined,
  personalityTags: Array.isArray(data.personalityTags) ? data.personalityTags.map(String).slice(0, 3) : [],
  profileUpdatedAt: data.profileUpdatedAt ? timestampToIso(data.profileUpdatedAt) : undefined,
});

const parseRememberReactionId = (value: unknown): RememberReactionId | undefined => {
  const reactionId = String(value || '') as RememberReactionId;
  return REMEMBER_REACTION_IDS.includes(reactionId) ? reactionId : undefined;
};

const rememberNoteFromDoc = (id: string, data: DocumentData): RememberNote => {
  const reactionId = parseRememberReactionId(data.reactionId);

  return {
  id,
  fromUid: String(data.fromUid || ''),
  fromName: String(data.fromName || 'Bạn cùng lớp'),
  fromNameKey: String(data.fromNameKey || ''),
  toName: String(data.toName || ''),
  toNameKey: String(data.toNameKey || ''),
  message: String(data.message || ''),
  anonymous: Boolean(data.anonymous),
  createdAt: timestampToIso(data.createdAt),
  viewedAt: data.viewedAt ? timestampToIso(data.viewedAt) : undefined,
  heartedBy: Array.isArray(data.heartedBy) ? data.heartedBy.map(String).slice(0, 120) : [],
    reactionId,
    reactionLabel: reactionId ? String(data.reactionLabel || REMEMBER_REACTION_LABELS[reactionId]) : undefined,
    reactedAt: data.reactedAt ? timestampToIso(data.reactedAt) : undefined,
    reactedBy: data.reactedBy ? String(data.reactedBy) : undefined,
  };
};

const voteCategoryFromDoc = (id: string, data: DocumentData): VoteCategory => ({
  id,
  uid: String(data.uid || ''),
  name: String(data.name || 'Classmate'),
  nameKey: String(data.nameKey || ''),
  title: String(data.title || ''),
  description: String(data.description || ''),
  tone: data.tone === 'blue' || data.tone === 'cream' || data.tone === 'chalk' ? data.tone : 'pink',
  icon: String(data.icon || 'sparkles').slice(0, 24),
  createdAt: timestampToIso(data.createdAt),
  hidden: Boolean(data.hidden),
  hiddenAt: data.hiddenAt ? timestampToIso(data.hiddenAt) : undefined,
});

const voteRecordFromDoc = (categoryId: string, id: string, data: DocumentData): VoteRecord => ({
  id,
  categoryId,
  voterUid: String(data.voterUid || id),
  voterName: String(data.voterName || 'Classmate'),
  voterNameKey: String(data.voterNameKey || ''),
  targetUid: String(data.targetUid || ''),
  targetName: String(data.targetName || ''),
  targetNameKey: String(data.targetNameKey || ''),
  createdAt: timestampToIso(data.createdAt),
  updatedAt: data.updatedAt ? timestampToIso(data.updatedAt) : undefined,
});

const memoryRecapSettingsFromData = (data?: DocumentData): MemoryRecapSettings => ({
  enabled: Boolean(data?.enabled),
  updatedAt: data?.updatedAt ? timestampToIso(data.updatedAt) : undefined,
});

const SLIDESHOW_MOODS = ['cinematic', 'scrapbook', 'photobooth'] as const;

const cinematicSlideshowSettingsFromData = (data?: DocumentData): CinematicSlideshowSettings => ({
  enabled: Boolean(data?.enabled),
  mood: SLIDESHOW_MOODS.includes(String(data?.mood) as CinematicSlideshowSettings['mood'])
    ? (String(data?.mood) as CinematicSlideshowSettings['mood'])
    : 'cinematic',
  updatedAt: data?.updatedAt ? timestampToIso(data.updatedAt) : undefined,
});

const timeCapsuleSettingsFromData = (data?: DocumentData): TimeCapsuleSettings => ({
  unlockAt: typeof data?.unlockAt === 'string' ? data.unlockAt : '',
  updatedAt: data?.updatedAt ? timestampToIso(data.updatedAt) : undefined,
});

export const checkStudentName = async (name: string) => {
  const nameKey = makeNameKey(name);
  if (!nameKey) throw new Error('Hãy nhập họ tên hợp lệ.');
  const snapshot = await withFirebaseRetry(() => getDoc(doc(db, STUDENTS_COLLECTION, nameKey)));
  if (snapshot.exists() && snapshot.data().disabled) {
    throw new Error('Tài khoản này đang bị khóa khỏi lớp 9/8.');
  }
  return {
    exists: snapshot.exists() && !snapshot.data().deleted,
    nameKey,
    profile: snapshot.exists() && !snapshot.data().deleted ? profileFromData(nameKey, snapshot.data()) : null,
  };
};

const writeRestoredStudentProfile = async (
  user: User,
  displayName: string,
  nameKey: string,
  options: { includeCreatedAt: boolean },
) => {
  await withTimeout(user.getIdToken(true), 'Auth token refresh');

  const studentRef = doc(db, STUDENTS_COLLECTION, nameKey);
  await withFirebaseRetry(() =>
    setDoc(
      studentRef,
      {
        uid: user.uid,
        name: displayName,
        nameKey,
        className: CLASS_NAME,
        disabled: false,
        deleted: false,
        repairedAt: serverTimestamp(),
        ...(options.includeCreatedAt ? { createdAt: serverTimestamp() } : {}),
        lastLoginAt: serverTimestamp(),
      },
      { merge: true },
    ),
  );

  return {
    uid: user.uid,
    name: displayName,
    nameKey,
    className: CLASS_NAME,
    joinedAt: new Date().toISOString(),
    disabled: false,
    deleted: false,
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
    if (existing.data().disabled) {
      throw new Error('Tài khoản này đang bị khóa khỏi lớp 9/8.');
    }

    if (existing.data().deleted) {
      try {
        return await loginStudent(name, password);
      } catch (loginError) {
        if (isInvalidAuthCredential(loginError)) {
          throw new Error('Tên này từng được tạo trước đó. Hãy nhập mật khẩu cũ để khôi phục tài khoản.');
        }
        throw loginError;
      }
    }

    throw new Error('Tên này đã có trong lớp 9/8. Hãy nhập mật khẩu để tiếp tục.');
  }

  let credential;
  try {
    credential = await withTimeout(
      createUserWithEmailAndPassword(auth, makeStudentEmail(nameKey), password),
      'Auth register',
    );
  } catch (error) {
    if (!isAuthEmailAlreadyInUse(error)) throw error;

    try {
      return await loginStudent(name, password);
    } catch (loginError) {
      if (isInvalidAuthCredential(loginError)) {
        throw new Error('Tên này từng được tạo trước đó. Hãy nhập mật khẩu cũ để khôi phục tài khoản.');
      }
      throw loginError;
    }
  }

  await withTimeout(updateProfile(credential.user, { displayName }), 'Auth profile');
  await withTimeout(credential.user.getIdToken(true), 'Auth token refresh');

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
    deleted: false,
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
    return writeRestoredStudentProfile(credential.user, displayName, nameKey, { includeCreatedAt: true });
  }

  if (snapshot.data().disabled) {
    await signOut(auth);
    throw new Error('Tài khoản này đang bị khóa khỏi lớp 9/8.');
  }

  if (snapshot.data().deleted) {
    if (snapshot.data().uid && snapshot.data().uid !== credential.user.uid) {
      await signOut(auth);
      throw new Error('Tên này đang thuộc về một tài khoản khác.');
    }

    const displayName = cleanDisplayName(name);
    return writeRestoredStudentProfile(credential.user, displayName, nameKey, { includeCreatedAt: false });
  }

  await withTimeout(credential.user.getIdToken(true), 'Auth token refresh');
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
    if (snapshot.exists()) {
      onProfile(profileFromData(nameKey, snapshot.data(), user));
      return;
    }

    await signOut(auth);
    onProfile(null);
  });

export const logoutStudent = async () => {
  await signOut(auth);
};

export const subscribeMemories = (
  profile: UserProfile | null,
  onNext: (memories: MemoryItem[]) => void,
  onError: (error: Error) => void,
) => {
  const memoriesQuery = query(collection(db, MEMORIES_COLLECTION), orderBy('createdAt', 'desc'), limit(48));
  const load = async () => {
    try {
      const snapshot = await withFirebaseRetry(() => getDocs(memoriesQuery));
      let memories = snapshot.docs
        .map((item) => memoryFromDoc(item.id, item.data(), MEMORIES_COLLECTION))
        .filter((item) => item.imageUrl);

      if (profile) {
        const ownPrivateQuery = query(collection(db, PRIVATE_MEMORIES_COLLECTION), where('uid', '==', profile.uid), limit(48));
        const taggedPrivateQuery = query(
          collection(db, PRIVATE_MEMORIES_COLLECTION),
          where('visibleToUids', 'array-contains', profile.uid),
          limit(48),
        );
        const [ownSnapshot, taggedSnapshot] = await Promise.all([
          withFirebaseRetry(() => getDocs(ownPrivateQuery)),
          withFirebaseRetry(() => getDocs(taggedPrivateQuery)),
        ]);
        const privateItems = [...ownSnapshot.docs, ...taggedSnapshot.docs]
          .map((item) => memoryFromDoc(item.id, item.data(), PRIVATE_MEMORIES_COLLECTION))
          .filter((item) => item.imageUrl);
        const byId = new Map<string, MemoryItem>();
        [...privateItems, ...memories].forEach((item) => byId.set(`${item.storageCollection}:${item.id}`, item));
        memories = Array.from(byId.values());
      }

      memories.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
      onNext(memories.slice(0, 96));
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
  const guestbookQuery = query(collection(db, GUESTBOOK_COLLECTION), orderBy('createdAt', 'desc'), limit(80));
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

export const subscribeTimeCapsules = (
  onNext: (entries: TimeCapsuleEntry[]) => void,
  onError: (error: Error) => void,
) => {
  const capsulesQuery = query(collection(db, TIME_CAPSULE_COLLECTION), orderBy('createdAt', 'desc'), limit(120));
  const load = async () => {
    try {
      const snapshot = await withFirebaseRetry(() => getDocs(capsulesQuery));
      onNext(snapshot.docs.map((item) => timeCapsuleFromDoc(item.id, item.data())));
    } catch (error) {
      onError(friendlyFirebaseError(error));
    }
  };
  void load();
  const interval = createVisiblePolling(load);
  return () => window.clearInterval(interval);
};

export const loadClassPosterData = async (profile: UserProfile) => {
  const publicMemoriesQuery = query(collection(db, MEMORIES_COLLECTION), orderBy('createdAt', 'desc'));
  const ownPrivateMemoriesQuery = query(collection(db, PRIVATE_MEMORIES_COLLECTION), where('uid', '==', profile.uid));
  const taggedPrivateMemoriesQuery = query(
    collection(db, PRIVATE_MEMORIES_COLLECTION),
    where('visibleToUids', 'array-contains', profile.uid),
  );
  const guestbookQuery = query(collection(db, GUESTBOOK_COLLECTION), orderBy('createdAt', 'desc'));

  const [publicSnapshot, ownPrivateSnapshot, taggedPrivateSnapshot, guestbookSnapshot] = await Promise.all([
    withFirebaseRetry(() => getDocs(publicMemoriesQuery)),
    withFirebaseRetry(() => getDocs(ownPrivateMemoriesQuery)),
    withFirebaseRetry(() => getDocs(taggedPrivateMemoriesQuery)),
    withFirebaseRetry(() => getDocs(guestbookQuery)),
  ]);

  const memoriesByKey = new Map<string, MemoryItem>();
  publicSnapshot.docs.forEach((item) => {
    const memory = memoryFromDoc(item.id, item.data(), MEMORIES_COLLECTION);
    if (memory.imageUrl) memoriesByKey.set(`${MEMORIES_COLLECTION}:${item.id}`, memory);
  });
  [...ownPrivateSnapshot.docs, ...taggedPrivateSnapshot.docs].forEach((item) => {
    const memory = memoryFromDoc(item.id, item.data(), PRIVATE_MEMORIES_COLLECTION);
    if (memory.imageUrl) memoriesByKey.set(`${PRIVATE_MEMORIES_COLLECTION}:${item.id}`, memory);
  });

  return {
    memories: Array.from(memoriesByKey.values()).sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    ),
    guestbook: guestbookSnapshot.docs
      .map((item) => guestbookFromDoc(item.id, item.data()))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
  };
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
          .filter((item) => !item.data().disabled && !item.data().deleted)
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

export const subscribeMemoryRecapSettings = (
  onNext: (settings: MemoryRecapSettings) => void,
  onError: (error: Error) => void,
) => {
  const settingRef = doc(db, SITE_SETTINGS_COLLECTION, MEMORY_RECAP_SETTING_ID);
  const load = async () => {
    try {
      const snapshot = await withFirebaseRetry(() => getDoc(settingRef));
      onNext(memoryRecapSettingsFromData(snapshot.exists() ? snapshot.data() : undefined));
    } catch (error) {
      onError(friendlyFirebaseError(error));
    }
  };
  void load();
  const interval = createVisiblePolling(load, SITE_SETTINGS_POLL_MS);
  return () => window.clearInterval(interval);
};

export const subscribeCinematicSlideshowSettings = (
  onNext: (settings: CinematicSlideshowSettings) => void,
  onError: (error: Error) => void,
) => {
  const settingRef = doc(db, SITE_SETTINGS_COLLECTION, CINEMATIC_SLIDESHOW_SETTING_ID);
  const load = async () => {
    try {
      const snapshot = await withFirebaseRetry(() => getDoc(settingRef));
      onNext(cinematicSlideshowSettingsFromData(snapshot.exists() ? snapshot.data() : undefined));
    } catch (error) {
      onError(friendlyFirebaseError(error));
    }
  };
  void load();
  const interval = createVisiblePolling(load, SITE_SETTINGS_POLL_MS);
  return () => window.clearInterval(interval);
};

export const subscribeTimeCapsuleSettings = (
  onNext: (settings: TimeCapsuleSettings) => void,
  onError: (error: Error) => void,
) => {
  const settingRef = doc(db, SITE_SETTINGS_COLLECTION, TIME_CAPSULE_SETTING_ID);
  const load = async () => {
    try {
      const snapshot = await withFirebaseRetry(() => getDoc(settingRef));
      onNext(timeCapsuleSettingsFromData(snapshot.exists() ? snapshot.data() : undefined));
    } catch (error) {
      onError(friendlyFirebaseError(error));
    }
  };
  void load();
  const interval = createVisiblePolling(load, SITE_SETTINGS_POLL_MS);
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

export const subscribeSentRememberNotes = (
  profile: UserProfile,
  onNext: (notes: RememberNote[]) => void,
  onError: (error: Error) => void,
) => {
  const notesQuery = query(
    collection(db, REMEMBER_NOTES_COLLECTION),
    where('fromUid', '==', profile.uid),
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

export const subscribeNotificationActivity = (
  profile: UserProfile,
  onNext: (activity: NotificationActivity) => void,
  onError: (error: Error) => void,
) => {
  const ownPublicMemoriesQuery = query(collection(db, MEMORIES_COLLECTION), where('uid', '==', profile.uid), limit(80));
  const ownPrivateMemoriesQuery = query(collection(db, PRIVATE_MEMORIES_COLLECTION), where('uid', '==', profile.uid), limit(80));
  const recentCommentsQuery = query(collection(db, MEMORY_COMMENTS_COLLECTION), orderBy('createdAt', 'desc'), limit(160));
  const ownCommentsQuery = query(collection(db, MEMORY_COMMENTS_COLLECTION), where('uid', '==', profile.uid), limit(120));
  const receivedNotesQuery = query(collection(db, REMEMBER_NOTES_COLLECTION), where('toNameKey', '==', profile.nameKey), limit(80));
  const sentNotesQuery = query(collection(db, REMEMBER_NOTES_COLLECTION), where('fromUid', '==', profile.uid), limit(80));
  const voteCategoriesQuery = query(collection(db, VOTE_CATEGORIES_COLLECTION), where('hidden', '==', false), limit(40));

  const sortNewestFirst = <T extends { createdAt: string }>(items: T[]) =>
    items.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  const load = async () => {
    try {
      const [
        ownPublicSnapshot,
        ownPrivateSnapshot,
        commentsSnapshot,
        ownCommentsSnapshot,
        receivedNotesSnapshot,
        sentNotesSnapshot,
        voteCategoriesSnapshot,
      ] = await Promise.all([
        withFirebaseRetry(() => getDocs(ownPublicMemoriesQuery)),
        withFirebaseRetry(() => getDocs(ownPrivateMemoriesQuery)),
        withFirebaseRetry(() => getDocs(recentCommentsQuery)),
        withFirebaseRetry(() => getDocs(ownCommentsQuery)),
        withFirebaseRetry(() => getDocs(receivedNotesQuery)),
        withFirebaseRetry(() => getDocs(sentNotesQuery)),
        withFirebaseRetry(() => getDocs(voteCategoriesQuery)),
      ]);

      const ownMemories = sortNewestFirst([
        ...ownPublicSnapshot.docs.map((item) => memoryFromDoc(item.id, item.data(), MEMORIES_COLLECTION)),
        ...ownPrivateSnapshot.docs.map((item) => memoryFromDoc(item.id, item.data(), PRIVATE_MEMORIES_COLLECTION)),
      ]).filter((item) => item.imageUrl);
      const ownMemoryIds = new Set(ownMemories.map((item) => item.id));
      const commentsById = new Map<string, MemoryComment>();
      [...commentsSnapshot.docs, ...ownCommentsSnapshot.docs].forEach((item) => {
        commentsById.set(item.id, memoryCommentFromDoc(item.id, item.data()));
      });

      onNext({
        ownMemories,
        ownMemoryComments: sortNewestFirst(
          Array.from(commentsById.values())
            .filter(
              (comment) =>
                comment.uid === profile.uid || comment.memoryUid === profile.uid || ownMemoryIds.has(comment.memoryId),
            ),
        ),
        receivedNotes: sortNewestFirst(receivedNotesSnapshot.docs.map((item) => rememberNoteFromDoc(item.id, item.data()))),
        sentNotes: sortNewestFirst(sentNotesSnapshot.docs.map((item) => rememberNoteFromDoc(item.id, item.data()))),
        voteCategories: sortNewestFirst(
          voteCategoriesSnapshot.docs
            .map((item) => voteCategoryFromDoc(item.id, item.data()))
            .filter((item) => item.title && !item.hidden),
        ),
      });
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
  const visibility = draft.visibility === 'private' || draft.visibility === 'tagged' ? draft.visibility : 'public';
  const collectionName = visibility === 'public' ? MEMORIES_COLLECTION : PRIVATE_MEMORIES_COLLECTION;
  const visibleToUids = visibility === 'tagged' ? (draft.visibleToUids || []).filter(Boolean).slice(0, 30) : [];
  const visibleToNameKeys = visibility === 'tagged' ? (draft.visibleToNameKeys || []).filter(Boolean).slice(0, 30) : [];
  const visibleToNames = visibility === 'tagged' ? (draft.visibleToNames || []).filter(Boolean).slice(0, 30) : [];
  const mediaType = draft.mediaType === 'video' ? 'video' : 'image';

  if (visibility === 'tagged' && !visibleToUids.length) {
    throw new Error('Hãy chọn ít nhất một bạn được xem kỷ niệm này.');
  }

  await withFirebaseRetry(() => setDoc(doc(db, collectionName, id), {
    uid: profile.uid,
    name: profile.name,
    nameKey: profile.nameKey,
    className: CLASS_NAME,
    caption: draft.caption,
    hashtags: draft.hashtags,
    mediaType,
    imageUrl: draft.imageDataUrl,
    videoChunked: mediaType === 'video',
    videoMimeType: mediaType === 'video' ? draft.videoMimeType || 'video/mp4' : '',
    videoSize: mediaType === 'video' ? Number(draft.videoSize || 0) : 0,
    videoDuration: mediaType === 'video' ? Number(draft.videoDuration || 0) : 0,
    visibility,
    visibleToUids,
    visibleToNameKeys,
    visibleToNames,
    reactions: 0,
    likedBy: [],
    rotation: Math.round((Math.random() * 5 - 2.5) * 10) / 10,
    tone: 'pink',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));

  if (mediaType === 'video' && draft.videoDataUrl) {
    const [prefixPart, base64Part = ''] = draft.videoDataUrl.split(',');
    const prefix = `${prefixPart},`;
    const chunkSize = 650_000;
    const chunks = base64Part.match(new RegExp(`.{1,${chunkSize}}`, 'g')) || [];

    await Promise.all(
      chunks.map((chunk, index) =>
        withFirebaseRetry(() =>
          setDoc(doc(db, MEMORY_VIDEO_CHUNKS_COLLECTION, id, 'chunks', String(index).padStart(4, '0')), {
            memoryId: id,
            memoryCollection: collectionName,
            uid: profile.uid,
            visibility,
            visibleToUids,
            index,
            total: chunks.length,
            prefix: index === 0 ? prefix : '',
            data: chunk,
            createdAt: serverTimestamp(),
          }),
        ),
      ),
    );
  }
};

export const loadMemoryVideoDataUrl = async (memory: MemoryItem) => {
  if (memory.mediaType !== 'video' || !memory.videoChunked) {
    throw new Error('Kỷ niệm này không có video để tải.');
  }

  const chunksQuery = query(collection(db, MEMORY_VIDEO_CHUNKS_COLLECTION, memory.id, 'chunks'), orderBy('index'));
  const snapshot = await withFirebaseRetry(() => getDocs(chunksQuery));
  const chunks = snapshot.docs
    .map((item) => item.data())
    .sort((left, right) => Number(left.index || 0) - Number(right.index || 0));
  const prefix = String(chunks[0]?.prefix || `data:${memory.videoMimeType || 'video/mp4'};base64,`);
  const body = chunks.map((item) => String(item.data || '')).join('');
  if (!body) throw new Error('Không thể tải video này lúc này.');
  return `${prefix}${body}`;
};

export const reactToFirebaseMemory = async (profile: UserProfile, memory: MemoryItem) => {
  if (memory.source !== 'firebase') return;
  if (memory.likedBy.includes(profile.uid)) {
    throw new Error('Bạn đã thả tim ảnh này rồi.');
  }

  await withFirebaseRetry(() => updateDoc(doc(db, memoryCollectionForItem(memory), memory.id), {
    reactions: increment(1),
    likedBy: arrayUnion(profile.uid),
    updatedAt: serverTimestamp(),
  }));
};

export const addMemoryComment = async (profile: UserProfile, memory: MemoryItem, message: string) => {
  if (memory.source !== 'firebase') {
    throw new Error('Chỉ ảnh đã đăng lên Firebase mới có thể bình luận.');
  }

  if (memory.visibility && memory.visibility !== 'public') {
    throw new Error('Bình luận chỉ bật cho kỷ niệm công khai.');
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
    reactionHahaBy: [],
    reactionLoveBy: [],
    reactionMissBy: [],
    reactionWowBy: [],
  }));

  return {
    id: docRef.id,
    memoryId: memory.id,
    memoryUid: memory.uid || '',
    uid: profile.uid,
    name: profile.name,
    nameKey: profile.nameKey,
    message: safeMessage,
    createdAt,
    reactionCounts: { haha: 0, love: 0, miss: 0, wow: 0 },
    reactionByUid: {},
  };
};

export const reactToMemoryComment = async (
  profile: UserProfile,
  comment: MemoryComment,
  reactionId: CommentReactionId,
) => {
  const reactionField = COMMENT_REACTION_FIELDS[reactionId];
  if (!reactionField) throw new Error('Cảm xúc bình luận này chưa hợp lệ.');
  if (comment.pending) throw new Error('Đợi bình luận gửi xong rồi hãy reaction nha.');
  if (comment.reactionByUid?.[profile.uid]) {
    throw new Error('Bạn đã reaction bình luận này rồi.');
  }

  await withFirebaseRetry(() =>
    updateDoc(doc(db, MEMORY_COMMENTS_COLLECTION, comment.id), {
      [reactionField]: arrayUnion(profile.uid),
      updatedAt: serverTimestamp(),
    }),
  );
};

export const logMemoryDownload = async (profile: UserProfile, memory: MemoryItem) => {
  if (memory.source !== 'firebase') return;

  await withFirebaseRetry(() => addDoc(collection(db, MEMORY_DOWNLOAD_LOGS_COLLECTION), {
    uid: profile.uid,
    name: profile.name,
    nameKey: profile.nameKey,
    className: CLASS_NAME,
    memoryId: memory.id,
    memoryCollection: memoryCollectionForItem(memory),
    memoryMediaType: memory.mediaType || 'image',
    memoryOwnerUid: memory.uid || '',
    memoryOwnerName: memory.name || '',
    memoryOwnerNameKey: memory.nameKey || '',
    memoryCaption: String(memory.caption || '').slice(0, 220),
    memoryVisibility: memory.visibility || 'public',
    downloadedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }));
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

  await withFirebaseRetry(() => deleteDoc(doc(db, memoryCollectionForItem(memory), memory.id)));

  if (memory.mediaType === 'video') {
    const chunksSnapshot = await withFirebaseRetry(() =>
      getDocs(collection(db, MEMORY_VIDEO_CHUNKS_COLLECTION, memory.id, 'chunks')),
    );
    await Promise.all(
      chunksSnapshot.docs.map((chunk) =>
        withFirebaseRetry(() => deleteDoc(doc(db, MEMORY_VIDEO_CHUNKS_COLLECTION, memory.id, 'chunks', chunk.id))),
      ),
    );
  }
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
    nameKey: profile.nameKey,
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
    nameKey: profile.nameKey,
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

export const addTimeCapsuleEntry = async (profile: UserProfile, message: string) => {
  const createdAt = new Date().toISOString();
  const safeMessage = message.trim().slice(0, 900);
  const docRef = await withFirebaseRetry(() => addDoc(collection(db, TIME_CAPSULE_COLLECTION), {
    uid: profile.uid,
    name: profile.name,
    nameKey: profile.nameKey,
    className: CLASS_NAME,
    message: safeMessage,
    createdAt: serverTimestamp(),
  }));

  return {
    id: docRef.id,
    uid: profile.uid,
    name: profile.name,
    nameKey: profile.nameKey,
    className: CLASS_NAME,
    message: safeMessage,
    createdAt,
  };
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
    heartedBy: [],
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
    heartedBy: [],
    createdAt,
  };
};

export const markRememberNotesViewed = async (profile: UserProfile, notes: RememberNote[]) => {
  const viewableNotes = notes.filter((note) => note.toNameKey === profile.nameKey && !note.viewedAt);
  if (!viewableNotes.length) return;

  await Promise.all(
    viewableNotes.map((note) =>
      withFirebaseRetry(() =>
        updateDoc(doc(db, REMEMBER_NOTES_COLLECTION, note.id), {
          viewedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      ),
    ),
  );
};

export const heartRememberNote = async (profile: UserProfile, note: RememberNote) => {
  if (note.toNameKey !== profile.nameKey) {
    throw new Error('Chá»‰ ngÆ°á»i nháº­n má»›i cÃ³ thá»ƒ tháº£ tim Secret Message nÃ y.');
  }

  if (note.heartedBy.includes(profile.uid)) {
    throw new Error('Báº¡n Ä‘Ã£ tháº£ tim Secret Message nÃ y rá»“i.');
  }

  await withFirebaseRetry(() =>
    updateDoc(doc(db, REMEMBER_NOTES_COLLECTION, note.id), {
      heartedBy: arrayUnion(profile.uid),
      updatedAt: serverTimestamp(),
    }),
  );
};

export const reactRememberNote = async (profile: UserProfile, note: RememberNote, reactionId: RememberReactionId) => {
  if (note.toNameKey !== profile.nameKey) {
    throw new Error('Chỉ người nhận mới có thể phản hồi Secret Message này.');
  }

  if (note.fromUid === profile.uid) {
    throw new Error('Bạn không thể tự phản hồi Secret Message của chính mình.');
  }

  const reactionLabel = REMEMBER_REACTION_LABELS[reactionId];
  if (!reactionLabel) {
    throw new Error('Cảm xúc này chưa hợp lệ.');
  }

  await withFirebaseRetry(() =>
    updateDoc(doc(db, REMEMBER_NOTES_COLLECTION, note.id), {
      reactionId,
      reactionLabel,
      reactedAt: serverTimestamp(),
      reactedBy: profile.uid,
      updatedAt: serverTimestamp(),
    }),
  );
};

export const deleteRememberNote = async (profile: UserProfile, note: RememberNote) => {
  if (note.toNameKey !== profile.nameKey && note.fromUid !== profile.uid) {
    throw new Error('Bạn chỉ có thể xóa lời nhắn liên quan đến mình.');
  }

  await withFirebaseRetry(() => deleteDoc(doc(db, REMEMBER_NOTES_COLLECTION, note.id)));
};

const normalizeTags = (tags: string[]) =>
  tags
    .map((tag) => cleanDisplayName(tag).slice(0, 22))
    .filter(Boolean)
    .slice(0, 3);

export const updateStudentYouthProfile = async (profile: UserProfile, draft: YouthProfileDraft) => {
  const nickname = cleanDisplayName(draft.nickname).slice(0, 36);
  const nicknameKey = nickname ? makeNameKey(nickname) : '';
  const studentRef = doc(db, STUDENTS_COLLECTION, profile.nameKey);

  if (nicknameKey) {
    const studentsSnapshot = await withFirebaseRetry(() => getDocs(collection(db, STUDENTS_COLLECTION)));
    const nicknameOwner = studentsSnapshot.docs.find((student) => {
      const data = student.data();
      if (data.deleted) return false;
      const ownerUid = String(data.uid || '');
      if (ownerUid === profile.uid) return false;
      const existingNickname = cleanDisplayName(String(data.nickname || ''));
      return Boolean(existingNickname && makeNameKey(existingNickname) === nicknameKey);
    });

    if (nicknameOwner) {
      throw new Error('Biệt danh này đã có người sở hữu rồi. Hãy chọn biệt danh khác nha.');
    }
  }

  await withFirebaseRetry(() =>
    runTransaction(db, async (transaction) => {
      const studentSnapshot = await transaction.get(studentRef);
      if (!studentSnapshot.exists()) throw new Error('Không tìm thấy hồ sơ của bạn để cập nhật.');

      const studentData = studentSnapshot.data();
      if (studentData.uid !== profile.uid) throw new Error('Bạn chỉ có thể sửa hồ sơ của chính mình.');
      if (studentData.disabled || studentData.deleted) throw new Error('Tài khoản này đang bị khóa khỏi lớp 9/8.');

      const oldNickname = cleanDisplayName(String(studentData.nickname || ''));
      const oldNicknameKey = String(studentData.nicknameKey || (oldNickname ? makeNameKey(oldNickname) : ''));
      const newClaimRef = nicknameKey ? doc(db, NICKNAME_CLAIMS_COLLECTION, nicknameKey) : null;
      const oldClaimRef =
        oldNicknameKey && oldNicknameKey !== nicknameKey ? doc(db, NICKNAME_CLAIMS_COLLECTION, oldNicknameKey) : null;

      const [newClaimSnapshot, oldClaimSnapshot] = await Promise.all([
        newClaimRef ? transaction.get(newClaimRef) : Promise.resolve(null),
        oldClaimRef ? transaction.get(oldClaimRef) : Promise.resolve(null),
      ]);

      if (newClaimSnapshot?.exists()) {
        const ownerUid = String(newClaimSnapshot.data().uid || '');
        if (ownerUid && ownerUid !== profile.uid) {
          throw new Error('Biệt danh này đã có người sở hữu rồi. Hãy chọn biệt danh khác nha.');
        }
      }

      if (newClaimRef) {
        transaction.set(newClaimRef, {
          uid: profile.uid,
          name: profile.name,
          nameKey: profile.nameKey,
          nickname,
          nicknameKey,
          className: profile.className || CLASS_NAME,
          updatedAt: serverTimestamp(),
        });
      }

      if (oldClaimRef && oldClaimSnapshot?.exists() && String(oldClaimSnapshot.data().uid || '') === profile.uid) {
        transaction.delete(oldClaimRef);
      }

      transaction.update(studentRef, {
        avatarDataUrl: draft.avatarDataUrl || '',
        nickname,
        nicknameKey,
        quote: cleanDisplayName(draft.quote).slice(0, 120),
        classMessage: draft.classMessage.trim().slice(0, 360),
        personalityTags: normalizeTags(draft.personalityTags),
        profileUpdatedAt: serverTimestamp(),
      });
    }),
  );
};

export const subscribeVoteBoard = (
  onNext: (board: { categories: VoteCategory[]; votes: VoteRecord[] }) => void,
  onError: (error: Error) => void,
) => {
  const categoriesQuery = query(collection(db, VOTE_CATEGORIES_COLLECTION), where('hidden', '==', false), limit(40));
  const load = async () => {
    try {
      const categorySnapshot = await withFirebaseRetry(() => getDocs(categoriesQuery));
      const categories = categorySnapshot.docs
        .map((item) => voteCategoryFromDoc(item.id, item.data()))
        .filter((item) => item.title && !item.hidden)
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

      const votesByCategory = await Promise.all(
        categories.map(async (category) => {
          const votesSnapshot = await withFirebaseRetry(() =>
            getDocs(collection(db, VOTE_CATEGORIES_COLLECTION, category.id, VOTES_SUBCOLLECTION)),
          );
          return votesSnapshot.docs.map((item) => voteRecordFromDoc(category.id, item.id, item.data()));
        }),
      );

      onNext({ categories, votes: votesByCategory.flat() });
    } catch (error) {
      onError(friendlyFirebaseError(error));
    }
  };
  void load();
  const interval = createVisiblePolling(load);
  return () => window.clearInterval(interval);
};

export const addVoteCategory = async (profile: UserProfile, draft: VoteCategoryDraft) => {
  const title = cleanDisplayName(draft.title).slice(0, 80);
  const description = cleanDisplayName(draft.description).slice(0, 180);
  const id = makeId('vote');
  const createdAt = new Date().toISOString();

  if (!title) throw new Error('Hãy nhập tên hạng mục bình chọn.');

  await withFirebaseRetry(() =>
    setDoc(doc(db, VOTE_CATEGORIES_COLLECTION, id), {
      uid: profile.uid,
      name: profile.name,
      nameKey: profile.nameKey,
      className: CLASS_NAME,
      title,
      description,
      tone: draft.tone,
      icon: draft.icon.slice(0, 24),
      hidden: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );

  return {
    id,
    uid: profile.uid,
    name: profile.name,
    nameKey: profile.nameKey,
    title,
    description,
    tone: draft.tone,
    icon: draft.icon.slice(0, 24),
    hidden: false,
    createdAt,
  };
};

export const hideVoteCategory = async (profile: UserProfile, category: VoteCategory) => {
  if (category.uid !== profile.uid) {
    throw new Error('Chỉ người tạo hạng mục mới có thể ẩn hạng mục này.');
  }

  await withFirebaseRetry(() =>
    updateDoc(doc(db, VOTE_CATEGORIES_COLLECTION, category.id), {
      hidden: true,
      hiddenAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
};

export const castVote = async (profile: UserProfile, category: VoteCategory, target: ClassmateProfile) => {
  if (!target.uid || !target.nameKey) throw new Error('Bạn cần chọn đúng một bạn trong lớp để vote.');

  const now = new Date().toISOString();
  await withFirebaseRetry(() =>
    setDoc(doc(db, VOTE_CATEGORIES_COLLECTION, category.id, VOTES_SUBCOLLECTION, profile.uid), {
      categoryId: category.id,
      voterUid: profile.uid,
      voterName: profile.name,
      voterNameKey: profile.nameKey,
      targetUid: target.uid,
      targetName: target.name,
      targetNameKey: target.nameKey,
      className: CLASS_NAME,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );

  return {
    id: profile.uid,
    categoryId: category.id,
    voterUid: profile.uid,
    voterName: profile.name,
    voterNameKey: profile.nameKey,
    targetUid: target.uid,
    targetName: target.name,
    targetNameKey: target.nameKey,
    createdAt: now,
    updatedAt: now,
  };
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

