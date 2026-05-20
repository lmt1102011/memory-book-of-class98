import { useEffect, useMemo, useState } from 'react';
import { Camera, Download, Filter, Heart, Search, UserRound, X } from 'lucide-react';
import FirebaseNotice from '../components/FirebaseNotice';
import MemoryCard from '../components/MemoryCard';
import { useDebounce } from '../hooks/useDebounce';
import type { MemoryComment, MemoryItem, UserProfile } from '../types';

const EMPTY_COMMENTS: MemoryComment[] = [];

const safeFilePart = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'ky-uc';

const getMemoryDownloadName = (memory: MemoryItem) =>
  `ky-uc-lop-9-8-${safeFilePart(memory.name)}-${safeFilePart(memory.id).slice(0, 24)}.jpg`;

interface HomePageProps {
  memories: MemoryItem[];
  commentsByMemory: Record<string, MemoryComment[]>;
  firebaseNotice: string;
  isLoadingMemories: boolean;
  profile: UserProfile | null;
  pendingReactionIds: string[];
  onJoin: () => void;
  onPhotobook: () => void;
  onOpenProfile: (nameKey: string) => void;
  onReact: (memory: MemoryItem) => void | Promise<void>;
  onAddComment: (memory: MemoryItem, message: string) => void | Promise<void>;
  onDeleteComment: (comment: MemoryComment) => void | Promise<void>;
  onDeleteMemory: (memory: MemoryItem) => void | Promise<void>;
}

export default function HomePage({
  memories,
  commentsByMemory,
  firebaseNotice,
  isLoadingMemories,
  profile,
  pendingReactionIds,
  onJoin,
  onPhotobook,
  onOpenProfile,
  onReact,
  onAddComment,
  onDeleteComment,
  onDeleteMemory,
}: HomePageProps) {
  const [nameQuery, setNameQuery] = useState('');
  const [keywordQuery, setKeywordQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activePersonKey, setActivePersonKey] = useState<string | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<MemoryItem | null>(null);
  const [selectedImageLoaded, setSelectedImageLoaded] = useState(false);
  const [selectedImageFailed, setSelectedImageFailed] = useState(false);

  const debouncedName = useDebounce(nameQuery);
  const debouncedKeyword = useDebounce(keywordQuery);

  useEffect(() => {
    if (!selectedMemory) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedMemory(null);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedMemory]);

  useEffect(() => {
    setSelectedImageLoaded(false);
    setSelectedImageFailed(false);
  }, [selectedMemory?.imageUrl]);

  const tags = useMemo(() => {
    const unique = new Set<string>();
    memories.forEach((memory) => memory.hashtags.forEach((tag) => unique.add(tag)));
    return Array.from(unique).slice(0, 12);
  }, [memories]);

  const people = useMemo(() => {
    const unique = new Map<string, { name: string; nameKey: string; count: number }>();
    memories.forEach((memory) => {
      const nameKey = memory.nameKey || memory.uid || memory.name.toLowerCase();
      if (!nameKey) return;
      const current = unique.get(nameKey);
      unique.set(nameKey, {
        name: current?.name || memory.name,
        nameKey,
        count: (current?.count || 0) + 1,
      });
    });
    return Array.from(unique.values()).sort((left, right) => right.count - left.count).slice(0, 16);
  }, [memories]);

  const filteredMemories = useMemo(() => {
    const name = debouncedName.trim().toLowerCase();
    const keyword = debouncedKeyword.trim().toLowerCase();

    return memories.filter((memory) => {
      const byName = !name || memory.name.toLowerCase().includes(name);
      const byKeyword =
        !keyword ||
        memory.caption.toLowerCase().includes(keyword) ||
        memory.hashtags.some((tag) => tag.toLowerCase().includes(keyword));
      const byTag = !activeTag || memory.hashtags.includes(activeTag);
      const byPerson = !activePersonKey || memory.nameKey === activePersonKey || memory.uid === activePersonKey;
      return byName && byKeyword && byTag && byPerson;
    });
  }, [activePersonKey, activeTag, memories, debouncedKeyword, debouncedName]);

  const hasActiveFilter = Boolean(nameQuery.trim() || keywordQuery.trim() || activeTag || activePersonKey);

  const clearFilters = () => {
    setNameQuery('');
    setKeywordQuery('');
    setActiveTag(null);
    setActivePersonKey(null);
  };

  return (
    <div className="relative">
      <section className="mx-auto max-w-7xl px-4 pb-8 pt-9 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p className="section-kicker">Memory Feed</p>
            <h1 className="max-w-4xl font-display text-6xl leading-[0.86] sm:text-8xl">
              Scrapbook của những ngày mình sắp nhớ mãi
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-ink/66 sm:text-base">
              Dữ liệu trên feed cập nhật theo thời gian thực. Tìm bạn trong lớp 9/8, thả tim một lần cho ký ức yêu
              thích, bấm vào ảnh để xem rõ hơn, tải ảnh về máy và để lại vài dòng bình luận.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-[1.5rem] border border-white/60 bg-white/45 p-4 shadow-paper backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-stretch">
              <span className="min-w-0 break-words font-hand text-3xl font-bold text-coffee">
                {profile ? `Chào ${profile.name}` : 'Bạn lớp 9/8'}
              </span>
              <button className="primary-button" onClick={onPhotobook}>
                <Camera size={17} />
                Đăng ảnh
              </button>
            </div>
            <p className="text-xs leading-5 text-ink/58">
              Bấm Đăng ảnh để chụp photobook hoặc upload ảnh có sẵn rồi đăng lên feed của lớp.
            </p>
            {!profile && (
              <button className="secondary-button justify-center" onClick={onJoin}>
                Vào lớp 9/8
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="sticky top-16 z-30 border-y border-white/55 bg-cream/75 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-3 lg:grid-cols-[1fr_1fr_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-coffee/55" size={17} />
            <input
              className="input-field pl-11"
              value={nameQuery}
              onChange={(event) => setNameQuery(event.target.value)}
              placeholder="Tìm theo tên"
            />
          </label>
          <label className="relative">
            <Filter className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-coffee/55" size={17} />
            <input
              className="input-field pl-11"
              value={keywordQuery}
              onChange={(event) => setKeywordQuery(event.target.value)}
              placeholder="Tìm caption hoặc hashtag"
            />
          </label>
          <button className="secondary-button justify-center" onClick={clearFilters}>
            <X size={16} />
            Xóa lọc
          </button>
        </div>
        <div className="mx-auto mt-3 flex max-w-7xl gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button className={`tag-button ${activePersonKey === null ? 'tag-button-active' : ''}`} onClick={() => setActivePersonKey(null)}>
            Album lớp
          </button>
          {people.map((person) => (
            <button
              key={person.nameKey}
              className={`tag-button ${activePersonKey === person.nameKey ? 'tag-button-active' : ''}`}
              onClick={() => setActivePersonKey(person.nameKey)}
            >
              {person.name} · {person.count}
            </button>
          ))}
        </div>
        <div className="mx-auto mt-2 flex max-w-7xl gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            className={`tag-button ${activeTag === null ? 'tag-button-active' : ''}`}
            onClick={() => setActiveTag(null)}
          >
            Tất cả
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              className={`tag-button ${activeTag === tag ? 'tag-button-active' : ''}`}
              onClick={() => setActiveTag(tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {isLoadingMemories ? (
          <div className="grid min-h-80 place-items-center rounded-[1.5rem] bg-white/45 p-8 text-center shadow-paper">
            <div>
              <div className="memory-loading-spinner mx-auto mb-5 h-14 w-14 rounded-full border-4 border-coffee/15 border-t-coffee" />
              <h2 className="font-display text-5xl">Đang tải ảnh...</h2>
              <p className="mt-2 text-sm text-ink/60">
                Ký ức đang được lấy từ database, đợi một chút nha.
              </p>
            </div>
          </div>
        ) : filteredMemories.length ? (
          <div className="masonry-feed">
            {filteredMemories.map((memory) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                comments={commentsByMemory[memory.id] || EMPTY_COMMENTS}
                profile={profile}
                isReacting={pendingReactionIds.includes(memory.id)}
                onJoin={onJoin}
                onOpenImage={setSelectedMemory}
                onOpenProfile={onOpenProfile}
                onReact={onReact}
                onAddComment={onAddComment}
                onDeleteComment={onDeleteComment}
                canDelete={profile?.uid === memory.uid}
                onDelete={onDeleteMemory}
              />
            ))}
          </div>
        ) : (
          <div className="grid min-h-80 place-items-center rounded-[1.5rem] bg-white/45 p-8 text-center shadow-paper">
            <div>
              <h2 className="font-display text-5xl">{hasActiveFilter ? 'Không tìm thấy ảnh' : 'Chưa có ảnh nào'}</h2>
              <p className="mt-2 text-sm text-ink/60">
                {hasActiveFilter
                  ? 'Thử xóa bộ lọc hoặc tìm bằng tên, caption, hashtag khác.'
                  : 'Khi ai đó đăng photobook lên database, ảnh sẽ hiện ở đây ngay lập tức.'}
              </p>
              {hasActiveFilter ? (
                <button className="secondary-button mx-auto mt-5" onClick={clearFilters}>
                  <X size={16} />
                  Xóa lọc
                </button>
              ) : (
                <button className="primary-button mx-auto mt-5" onClick={onPhotobook}>
                  <Camera size={17} />
                  Đăng ảnh đầu tiên
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {selectedMemory && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/92 p-0 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Xem ảnh của ${selectedMemory.name}`}
          onClick={() => setSelectedMemory(null)}
        >
          <div
            className="relative flex h-[100svh] w-full flex-col overflow-hidden bg-ink shadow-glass sm:grid sm:max-h-[92svh] sm:max-w-6xl sm:grid-cols-[minmax(0,1fr)_20rem] sm:gap-4 sm:rounded-[1rem] sm:bg-paper sm:p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="absolute right-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-full bg-ink/78 text-paper shadow-paper"
              onClick={() => setSelectedMemory(null)}
              aria-label="Đóng ảnh"
            >
              <X size={19} />
            </button>

            <a
              className="absolute left-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-full bg-paper/92 text-ink shadow-paper sm:hidden"
              href={selectedMemory.imageUrl}
              download={getMemoryDownloadName(selectedMemory)}
              aria-label="Tải ảnh"
            >
              <Download size={18} />
            </a>

            <div className="relative grid min-h-0 flex-1 place-items-center overflow-hidden bg-ink sm:rounded-[0.75rem]">
              {!selectedImageLoaded && !selectedImageFailed && (
                <span className="memory-image-placeholder absolute inset-0 z-0" aria-hidden="true" />
              )}
              {selectedImageFailed && (
                <span className="absolute inset-0 z-[2] grid place-items-center px-4 text-center text-sm font-bold text-paper/82">
                  Không thể tải ảnh này
                </span>
              )}
              <img
                src={selectedMemory.imageUrl}
                alt={`Ảnh kỷ niệm của ${selectedMemory.name}`}
                className="relative z-[1] max-h-[calc(100svh-13rem)] w-auto max-w-full object-contain sm:max-h-[86svh]"
                decoding="async"
                onLoad={() => setSelectedImageLoaded(true)}
                onError={() => setSelectedImageFailed(true)}
              />
            </div>

            <aside className="max-h-[42svh] min-w-0 shrink-0 overflow-auto rounded-t-[1.15rem] bg-paper px-4 pb-4 pt-4 sm:max-h-none sm:rounded-none sm:bg-transparent sm:px-1 sm:pb-1 sm:pt-0 sm:pr-2">
              <p className="section-kicker">Xem ảnh rõ hơn</p>
              <h2 className="break-words font-display text-5xl leading-none text-ink">{selectedMemory.name}</h2>
              <p className="mt-1 text-xs font-bold uppercase text-coffee/70">Lớp {selectedMemory.className}</p>
              <p className="mt-4 break-words text-sm leading-7 text-ink/72">{selectedMemory.caption}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedMemory.hashtags.map((tag) => (
                  <span key={tag} className="rounded-full bg-coffee/10 px-2 py-1 text-xs font-bold text-coffee">
                    #{tag}
                  </span>
                ))}
              </div>
              <a
                className="primary-button mt-4 w-full sm:mt-5"
                href={selectedMemory.imageUrl}
                download={getMemoryDownloadName(selectedMemory)}
              >
                <Download size={17} />
                Tải ảnh
              </a>
              {(selectedMemory.nameKey || selectedMemory.uid) && (
                <button
                  className="secondary-button mt-3 w-full"
                  onClick={() => onOpenProfile(selectedMemory.nameKey || selectedMemory.uid || '')}
                >
                  <UserRound size={17} />
                  Xem hồ sơ và album
                </button>
              )}
              <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-blush/35 px-3 py-2 text-xs font-bold text-coffee">
                <Heart size={14} fill="currentColor" />
                {selectedMemory.reactions} tim
              </p>
            </aside>
          </div>
        </div>
      )}

      <FirebaseNotice message={firebaseNotice} />
    </div>
  );
}
