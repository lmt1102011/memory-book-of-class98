import {
  collection,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore';
import { firebaseApp } from '../firebase';
import type { MemoryComment, MemoryItem } from '../types';

const MEMORIES_COLLECTION = 'memories98';
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

const memoryFromDoc = (id: string, data: DocumentData): MemoryItem => ({
  id,
  uid: String(data.uid || ''),
  source: 'firebase',
  name: String(data.name || 'Bạn cùng lớp'),
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

export const subscribeMemoriesRealtime = (
  onNext: (memories: MemoryItem[]) => void,
  onError: (error: Error) => void,
) => {
  const memoriesQuery = query(collection(realtimeDb, MEMORIES_COLLECTION), orderBy('createdAt', 'desc'), limit(48));

  return onSnapshot(
    memoriesQuery,
    (snapshot) => {
      onNext(snapshot.docs.map((item) => memoryFromDoc(item.id, item.data())).filter((item) => item.imageUrl));
    },
    (error) => onError(friendlyRealtimeError(error)),
  );
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
