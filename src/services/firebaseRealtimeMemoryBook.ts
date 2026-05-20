import {
  collection,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { firebaseApp } from '../firebase';
import type { MemoryComment, MemoryItem, UserProfile } from '../types';

const MEMORIES_COLLECTION = 'memories98';
const PRIVATE_MEMORIES_COLLECTION = 'privateMemories98';
const MEMORY_COMMENTS_COLLECTION = 'memoryComments98';
const CLASS_NAME = '9/8';

const realtimeDb = getFirestore(firebaseApp);

const timestampToIso = (value: unknown) => {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
};

const friendlyRealtimeError = (error: unknown) => {
  const maybeError = error as { code?: string; message?: string };
  const text = `${maybeError.code || ''} ${maybeError.message || ''}`.toLowerCase();

  if (text.includes('permission-denied') || text.includes('insufficient permissions')) {
    return new Error('Firebase đang chặn quyền đọc dữ liệu realtime. Hãy deploy Firestore Rules mới nhất rồi reload lại trang.');
  }

  if (text.includes('offline') || text.includes('unavailable') || text.includes('network')) {
    return new Error('Kết nối Firebase realtime chưa ổn định. Dữ liệu sẽ tự cập nhật lại khi mạng ổn hơn.');
  }

  return error instanceof Error ? error : new Error('Không thể mở dữ liệu realtime lúc này.');
};

const memoryFromDoc = (
  id: string,
  data: DocumentData,
  storageCollection: 'memories98' | 'privateMemories98' = MEMORIES_COLLECTION,
): MemoryItem => ({
  id,
  uid: String(data.uid || ''),
  source: 'firebase',
  storageCollection,
  nameKey: String(data.nameKey || ''),
  name: String(data.name || 'Bạn cùng lớp'),
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

export const subscribeMemoriesRealtime = (
  profile: UserProfile | null,
  onNext: (memories: MemoryItem[]) => void,
  onError: (error: Error) => void,
) => {
  const memoriesQuery = query(collection(realtimeDb, MEMORIES_COLLECTION), orderBy('createdAt', 'desc'), limit(48));
  const byKey = new Map<string, MemoryItem>();
  const emit = () => {
    const items = Array.from(byKey.values())
      .filter((item) => item.imageUrl)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 96);
    onNext(items);
  };

  const unsubscribes: Array<() => void> = [];

  unsubscribes.push(onSnapshot(
    memoriesQuery,
    (snapshot) => {
      Array.from(byKey.keys())
        .filter((key) => key.startsWith(`${MEMORIES_COLLECTION}:`))
        .forEach((key) => byKey.delete(key));
      snapshot.docs.forEach((item) => {
        byKey.set(`${MEMORIES_COLLECTION}:${item.id}`, memoryFromDoc(item.id, item.data(), MEMORIES_COLLECTION));
      });
      emit();
    },
    (error) => onError(friendlyRealtimeError(error)),
  ));

  if (profile) {
    const ownPrivateQuery = query(collection(realtimeDb, PRIVATE_MEMORIES_COLLECTION), where('uid', '==', profile.uid), limit(48));
    const taggedPrivateQuery = query(
      collection(realtimeDb, PRIVATE_MEMORIES_COLLECTION),
      where('visibleToUids', 'array-contains', profile.uid),
      limit(48),
    );

    const handlePrivateSnapshot = (snapshot: { docs: Array<{ id: string; data: () => DocumentData }> }, bucket: string) => {
      Array.from(byKey.keys())
        .filter((key) => key.startsWith(`${PRIVATE_MEMORIES_COLLECTION}:${bucket}:`))
        .forEach((key) => byKey.delete(key));
      snapshot.docs.forEach((item) => {
        byKey.set(
          `${PRIVATE_MEMORIES_COLLECTION}:${bucket}:${item.id}`,
          memoryFromDoc(item.id, item.data(), PRIVATE_MEMORIES_COLLECTION),
        );
      });
      emit();
    };

    unsubscribes.push(
      onSnapshot(ownPrivateQuery, (snapshot) => handlePrivateSnapshot(snapshot, 'own'), (error) => onError(friendlyRealtimeError(error))),
    );
    unsubscribes.push(
      onSnapshot(
        taggedPrivateQuery,
        (snapshot) => handlePrivateSnapshot(snapshot, 'tagged'),
        (error) => onError(friendlyRealtimeError(error)),
      ),
    );
  }

  return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
};

export const subscribeMemoryCommentsRealtime = (
  onNext: (comments: MemoryComment[]) => void,
  onError: (error: Error) => void,
) => {
  const commentsQuery = query(
    collection(realtimeDb, MEMORY_COMMENTS_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(240),
  );

  return onSnapshot(
    commentsQuery,
    (snapshot) => {
      onNext(snapshot.docs.map((item) => memoryCommentFromDoc(item.id, item.data())).filter((item) => item.memoryId));
    },
    (error) => onError(friendlyRealtimeError(error)),
  );
};
