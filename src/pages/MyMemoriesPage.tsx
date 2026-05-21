import { Camera, Download, Heart, Image, Lock, MessageCircle, Trash2, UserRound, Video, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import FirebaseNotice from '../components/FirebaseNotice';
import MemoryCard from '../components/MemoryCard';
import type { MemoryComment, MemoryItem, UserProfile } from '../types';
import { formatUploadTime } from '../utils/date';

const EMPTY_COMMENTS: MemoryComment[] = [];

type FilterId = 'all' | 'image' | 'video' | 'private';

interface MyMemoriesPageProps {
  memories: MemoryItem[];
  commentsByMemory: Record<string, MemoryComment[]>;
  firebaseNotice: string;
  isLoading: boolean;
  profile: UserProfile | null;
  pendingReactionIds: string[];
  onJoin: () => void;
  onPhotobook: () => void;
  onOpenProfile: (nameKey: string) => void;
  onReact: (memory: MemoryItem) => void | Promise<void>;
  onAddComment: (memory: MemoryItem, message: string) => void | Promise<void>;
  onDeleteComment: (comment: MemoryComment) => void | Promise<void>;
  onDeleteMemory: (memory: MemoryItem) => void | Promise<void>;
  onDownloadMemory: (memory: MemoryItem) => void | Promise<void>;
}

const safeFilePart = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'ky-uc';

const getMemoryDownloadName = (memory: MemoryItem) => {
  const extension =
    memory.mediaType === 'video'
      ? memory.videoMimeType?.includes('webm')
        ? 'webm'
        : memory.videoMimeType?.includes('quicktime')
          ? 'mov'
          : 'mp4'
      : 'jpg';
  return `ky-uc-cua-toi-${safeFilePart(memory.id)}.${extension}`;
};

export default function MyMemoriesPage({
  memories,
  commentsByMemory,
  firebaseNotice,
  isLoading,
  profile,
  pendingReactionIds,
  onJoin,
  onPhotobook,
  onOpenProfile,
  onReact,
  onAddComment,
  onDeleteComment,
  onDeleteMemory,
  onDownloadMemory,
}: MyMemoriesPageProps) {
  const [filter, setFilter] = useState<FilterId>('all');
  const [selectedMemory, setSelectedMemory] = useState<MemoryItem | null>(null);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState('');
  const [selectedVideoLoading, setSelectedVideoLoading] = useState(false);
  const [selectedVideoError, setSelectedVideoError] = useState('');

  useEffect(() => {
    let alive = true;
    setSelectedVideoUrl('');
    setSelectedVideoError('');
    setSelectedVideoLoading(Boolean(selectedMemory?.mediaType === 'video'));

    if (selectedMemory?.mediaType === 'video') {
      void import('../services/firebaseMemoryBook')
        .then((service) => service.loadMemoryVideoDataUrl(selectedMemory))
        .then((url) => {
          if (!alive) return;
          setSelectedVideoUrl(url);
          setSelectedVideoLoading(false);
        })
        .catch(() => {
          if (!alive) return;
          setSelectedVideoError('Không thể tải video này lúc này.');
          setSelectedVideoLoading(false);
        });
    }

    return () => {
      alive = false;
    };
  }, [selectedMemory]);

  const stats = useMemo(() => {
    const videos = memories.filter((item) => item.mediaType === 'video').length;
    const privateCount = memories.filter((item) => item.visibility && item.visibility !== 'public').length;
    const comments = memories.reduce((total, item) => total + (commentsByMemory[item.id]?.length || 0), 0);
    const likes = memories.reduce((total, item) => total + item.reactions, 0);
    return { total: memories.length, videos, privateCount, comments, likes };
  }, [commentsByMemory, memories]);

  const filteredMemories = useMemo(() => {
    if (filter === 'image') return memories.filter((item) => item.mediaType !== 'video');
    if (filter === 'video') return memories.filter((item) => item.mediaType === 'video');
    if (filter === 'private') return memories.filter((item) => item.visibility && item.visibility !== 'public');
    return memories;
  }, [filter, memories]);

  if (!profile) {
    return (
      <div className="relative">
        <section className="mx-auto max-w-7xl px-4 py-9 sm:px-6 lg:px-8">
          <div className="rounded-[1.5rem] border border-white/65 bg-white/55 p-6 text-center shadow-paper backdrop-blur-xl">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-ink text-paper shadow-paper">
              <Lock size={28} />
            </div>
            <h1 className="mt-5 font-display text-6xl leading-none">Cần vào lớp trước</h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-ink/62">
              Mục này chỉ hiện ảnh và video bạn đã đăng, nên Memory98 cần biết bạn là ai.
            </p>
            <button className="primary-button mx-auto mt-6 justify-center" onClick={onJoin}>
              <UserRound size={17} />
              Đăng nhập / tạo tài khoản
            </button>
          </div>
        </section>
        <FirebaseNotice message={firebaseNotice} />
      </div>
    );
  }

  const filterOptions: Array<{ id: FilterId; label: string; icon: typeof Image; count: number }> = [
    { id: 'all', label: 'Tất cả', icon: Image, count: stats.total },
    { id: 'image', label: 'Ảnh', icon: Camera, count: stats.total - stats.videos },
    { id: 'video', label: 'Video', icon: Video, count: stats.videos },
    { id: 'private', label: 'Riêng tư', icon: Lock, count: stats.privateCount },
  ];
  const statCards: Array<{ label: string; value: number; icon: LucideIcon }> = [
    { label: 'Đã đăng', value: stats.total, icon: Image },
    { label: 'Tổng tim', value: stats.likes, icon: Heart },
    { label: 'Bình luận', value: stats.comments, icon: MessageCircle },
    { label: 'Riêng tư', value: stats.privateCount, icon: Lock },
  ];

  const selectedDownloadHref =
    selectedMemory?.mediaType === 'video' ? selectedVideoUrl : selectedMemory?.imageUrl || '';

  return (
    <div className="relative">
      <section className="mx-auto max-w-7xl px-4 pb-8 pt-9 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-[1fr_24rem] lg:items-end">
          <div>
            <p className="section-kicker">Ảnh & video của tôi</p>
            <h1 className="max-w-4xl font-display text-6xl leading-[0.86] sm:text-8xl">
              Góc quản lý những điều mình đã gửi lại
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-ink/66 sm:text-base">
              Xem lại toàn bộ ảnh/video bạn đã đăng, kiểm tra tim và bình luận, tải về hoặc xóa nhanh khi cần.
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-white/60 bg-white/48 p-4 shadow-paper backdrop-blur-xl">
            <button className="primary-button min-h-12 w-full justify-center" onClick={onPhotobook}>
              <Camera size={18} />
              Đăng ảnh/video mới
            </button>
            <p className="mt-3 text-xs leading-5 text-ink/58">
              Trang này chỉ lấy dữ liệu thuộc tài khoản {profile.name}, kể cả kỷ niệm riêng tư.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-[1.15rem] bg-white/58 p-4 shadow-paper">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-black uppercase text-coffee/62">{label}</span>
                <Icon className="text-coffee" size={18} />
              </div>
              <p className="mt-3 font-display text-5xl leading-none">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="sticky top-16 z-30 border-y border-white/55 bg-cream/80 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {filterOptions.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              className={`tag-button ${filter === id ? 'tag-button-active' : ''}`}
              onClick={() => setFilter(id)}
            >
              <Icon size={14} />
              {label} · {count}
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="grid min-h-80 place-items-center rounded-[1.5rem] bg-white/45 p-8 text-center shadow-paper">
            <div>
              <div className="memory-loading-spinner mx-auto mb-5 h-14 w-14 rounded-full border-4 border-coffee/15 border-t-coffee" />
              <h2 className="font-display text-5xl">Đang tải kỷ niệm của bạn...</h2>
            </div>
          </div>
        ) : filteredMemories.length ? (
          <div className="masonry-feed">
            {filteredMemories.map((memory) => (
              <MemoryCard
                key={`${memory.storageCollection || 'memories98'}-${memory.id}`}
                memory={memory}
                comments={memory.visibility === 'public' ? commentsByMemory[memory.id] || EMPTY_COMMENTS : EMPTY_COMMENTS}
                profile={profile}
                isReacting={pendingReactionIds.includes(memory.id)}
                onJoin={onJoin}
                onOpenImage={setSelectedMemory}
                onOpenProfile={onOpenProfile}
                onReact={onReact}
                onAddComment={onAddComment}
                onDeleteComment={onDeleteComment}
                canDelete
                onDelete={onDeleteMemory}
              />
            ))}
          </div>
        ) : (
          <div className="grid min-h-80 place-items-center rounded-[1.5rem] bg-white/45 p-8 text-center shadow-paper">
            <div>
              <h2 className="font-display text-5xl">Chưa có mục nào</h2>
              <p className="mt-2 text-sm text-ink/60">
                {filter === 'all' ? 'Khi bạn đăng ảnh hoặc video, chúng sẽ nằm ở đây để quản lý.' : 'Thử đổi bộ lọc khác nha.'}
              </p>
              <button className="primary-button mx-auto mt-5" onClick={onPhotobook}>
                <Camera size={17} />
                Đăng kỷ niệm đầu tiên
              </button>
            </div>
          </div>
        )}
      </section>

      {selectedMemory && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/88 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Xem kỷ niệm của tôi"
          onClick={() => setSelectedMemory(null)}
        >
          <div
            className="grid max-h-[92svh] w-full max-w-5xl overflow-hidden rounded-[1.25rem] bg-paper shadow-glass lg:grid-cols-[minmax(0,1fr)_20rem]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="grid min-h-[22rem] place-items-center bg-ink p-3">
              {selectedMemory.mediaType === 'video' ? (
                selectedVideoUrl ? (
                  <video
                    className="max-h-[76svh] w-auto max-w-full rounded-xl object-contain shadow-paper"
                    src={selectedVideoUrl}
                    poster={selectedMemory.imageUrl}
                    controls
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <div className="text-center text-paper">
                    <div className="memory-loading-spinner mx-auto mb-4 h-11 w-11 rounded-full border-4 border-paper/20 border-t-paper" />
                    <p className="text-sm font-bold">{selectedVideoLoading ? 'Đang tải video...' : selectedVideoError}</p>
                  </div>
                )
              ) : (
                <img
                  src={selectedMemory.imageUrl}
                  alt={`Kỷ niệm của ${selectedMemory.name}`}
                  className="max-h-[76svh] w-auto max-w-full rounded-xl object-contain shadow-paper"
                  decoding="async"
                />
              )}
            </div>

            <aside className="min-w-0 overflow-y-auto p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="section-kicker">{selectedMemory.mediaType === 'video' ? 'Video của tôi' : 'Ảnh của tôi'}</p>
                  <h2 className="break-words font-display text-5xl leading-none">{selectedMemory.name}</h2>
                </div>
                <button className="icon-button shrink-0" onClick={() => setSelectedMemory(null)} aria-label="Đóng">
                  <X size={18} />
                </button>
              </div>

              <p className="mt-3 rounded-full bg-coffee/10 px-3 py-2 text-xs font-bold text-coffee">
                {formatUploadTime(selectedMemory.createdAt)}
              </p>
              <p className="mt-4 break-words text-sm leading-7 text-ink/72">{selectedMemory.caption}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedMemory.hashtags.map((tag) => (
                  <span key={tag} className="rounded-full bg-coffee/10 px-2 py-1 text-xs font-bold text-coffee">
                    #{tag}
                  </span>
                ))}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <span className="rounded-[1rem] bg-white/70 p-3 text-center shadow-paper">
                  <Heart className="mx-auto text-roseDust" size={17} fill="currentColor" />
                  <strong className="mt-1 block text-sm">{selectedMemory.reactions} tim</strong>
                </span>
                <span className="rounded-[1rem] bg-white/70 p-3 text-center shadow-paper">
                  <MessageCircle className="mx-auto text-coffee" size={17} />
                  <strong className="mt-1 block text-sm">{commentsByMemory[selectedMemory.id]?.length || 0} bình luận</strong>
                </span>
              </div>

              {selectedDownloadHref ? (
                <a
                  className="primary-button mt-5 w-full"
                  href={selectedDownloadHref}
                  download={getMemoryDownloadName(selectedMemory)}
                  onClick={() => void onDownloadMemory(selectedMemory)}
                >
                  <Download size={17} />
                  Tải về máy
                </a>
              ) : (
                <button className="primary-button mt-5 w-full" disabled>
                  <Download size={17} />
                  Đang chuẩn bị tải...
                </button>
              )}
              <button
                className="secondary-button mt-3 w-full border-blush/60 bg-blush/25 text-coffee"
                onClick={() => {
                  if (!window.confirm('Xóa kỷ niệm này khỏi Memory98?')) return;
                  void onDeleteMemory(selectedMemory);
                  setSelectedMemory(null);
                }}
              >
                <Trash2 size={17} />
                Xóa kỷ niệm này
              </button>
            </aside>
          </div>
        </div>
      )}

      <FirebaseNotice message={firebaseNotice} />
    </div>
  );
}
