import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import { Camera, Download, Filter, Heart, Lock, RotateCcw, Search, UserRound, Video, X } from 'lucide-react';
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

const getMemoryDownloadName = (memory: MemoryItem) => {
  const extension =
    memory.mediaType === 'video'
      ? memory.videoMimeType?.includes('webm')
        ? 'webm'
        : memory.videoMimeType?.includes('quicktime')
          ? 'mov'
          : 'mp4'
      : 'jpg';
  return `ky-uc-lop-9-8-${safeFilePart(memory.name)}-${safeFilePart(memory.id).slice(0, 24)}.${extension}`;
};

const formatVideoDuration = (seconds: number) => `${Math.max(1, Math.round(seconds || 0))}s`;

const clampZoom = (value: number) => Math.min(4, Math.max(1, value));

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
  const mediaStageRef = useRef<HTMLDivElement | null>(null);
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>());
  const panGestureRef = useRef({ startX: 0, startY: 0, panX: 0, panY: 0, lastTapAt: 0 });
  const pinchGestureRef = useRef({ distance: 0, zoom: 1 });
  const [nameQuery, setNameQuery] = useState('');
  const [keywordQuery, setKeywordQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activePersonKey, setActivePersonKey] = useState<string | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<MemoryItem | null>(null);
  const [selectedImageLoaded, setSelectedImageLoaded] = useState(false);
  const [selectedImageFailed, setSelectedImageFailed] = useState(false);
  const [isImageZoomOpen, setIsImageZoomOpen] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  const [imagePan, setImagePan] = useState({ x: 0, y: 0 });
  const [selectedVideoUrl, setSelectedVideoUrl] = useState('');
  const [selectedVideoLoading, setSelectedVideoLoading] = useState(false);
  const [selectedVideoError, setSelectedVideoError] = useState('');

  const debouncedName = useDebounce(nameQuery);
  const debouncedKeyword = useDebounce(keywordQuery);

  const clampImagePan = useCallback((x: number, y: number, zoom: number) => {
    if (zoom <= 1) return { x: 0, y: 0 };
    const rect = mediaStageRef.current?.getBoundingClientRect();
    const width = rect?.width || window.innerWidth || 360;
    const height = rect?.height || window.innerHeight || 640;
    const limitX = Math.max(0, (width * (zoom - 1)) / 2);
    const limitY = Math.max(0, (height * (zoom - 1)) / 2);
    return {
      x: Math.min(limitX, Math.max(-limitX, x)),
      y: Math.min(limitY, Math.max(-limitY, y)),
    };
  }, []);

  const resetImageZoom = useCallback(() => {
    setImageZoom(1);
    setImagePan({ x: 0, y: 0 });
  }, []);

  const closeSelectedMemory = useCallback(() => {
    setSelectedMemory(null);
    setIsImageZoomOpen(false);
    resetImageZoom();
  }, [resetImageZoom]);

  const openImageZoomViewer = useCallback(() => {
    if (selectedMemory?.mediaType === 'video') return;
    activePointersRef.current.clear();
    resetImageZoom();
    setIsImageZoomOpen(true);
  }, [resetImageZoom, selectedMemory?.mediaType]);

  const closeImageZoomViewer = useCallback(() => {
    activePointersRef.current.clear();
    setIsImageZoomOpen(false);
    resetImageZoom();
  }, [resetImageZoom]);

  useEffect(() => {
    if (!selectedMemory) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (isImageZoomOpen) {
        closeImageZoomViewer();
        return;
      }
      closeSelectedMemory();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [closeImageZoomViewer, closeSelectedMemory, isImageZoomOpen, selectedMemory]);

  useEffect(() => {
    let alive = true;
    setSelectedImageLoaded(false);
    setSelectedImageFailed(false);
    setIsImageZoomOpen(false);
    resetImageZoom();
    activePointersRef.current.clear();
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
  }, [resetImageZoom, selectedMemory]);

  const getPointerDistance = () => {
    const points = Array.from(activePointersRef.current.values());
    if (points.length < 2) return 0;
    const [first, second] = points;
    return Math.hypot(second.x - first.x, second.y - first.y);
  };

  const handleImagePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isImageZoomOpen || selectedMemory?.mediaType === 'video') return;
      event.currentTarget.setPointerCapture(event.pointerId);
      activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

      const now = performance.now();
      if (activePointersRef.current.size === 1) {
        if (now - panGestureRef.current.lastTapAt < 280) {
          const nextZoom = imageZoom > 1 ? 1 : 2.35;
          setImageZoom(nextZoom);
          setImagePan((pan) => clampImagePan(pan.x, pan.y, nextZoom));
          panGestureRef.current.lastTapAt = 0;
        } else {
          panGestureRef.current.lastTapAt = now;
        }

        panGestureRef.current = {
          ...panGestureRef.current,
          startX: event.clientX,
          startY: event.clientY,
          panX: imagePan.x,
          panY: imagePan.y,
        };
      }

      if (activePointersRef.current.size === 2) {
        pinchGestureRef.current = {
          distance: getPointerDistance(),
          zoom: imageZoom,
        };
      }
    },
    [clampImagePan, imagePan.x, imagePan.y, imageZoom, isImageZoomOpen, selectedMemory?.mediaType],
  );

  const handleImagePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isImageZoomOpen) return;
      if (!activePointersRef.current.has(event.pointerId)) return;
      activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (activePointersRef.current.size >= 2) {
        event.preventDefault();
        const distance = getPointerDistance();
        if (!pinchGestureRef.current.distance || !distance) return;
        const nextZoom = clampZoom((pinchGestureRef.current.zoom * distance) / pinchGestureRef.current.distance);
        setImageZoom(nextZoom);
        setImagePan((pan) => clampImagePan(pan.x, pan.y, nextZoom));
        return;
      }

      if (imageZoom <= 1) return;
      event.preventDefault();
      const nextX = panGestureRef.current.panX + event.clientX - panGestureRef.current.startX;
      const nextY = panGestureRef.current.panY + event.clientY - panGestureRef.current.startY;
      setImagePan(clampImagePan(nextX, nextY, imageZoom));
    },
    [clampImagePan, imageZoom, isImageZoomOpen],
  );

  const handleImagePointerEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(event.pointerId);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Some browsers release capture automatically after a pinch.
    }
  }, []);

  const handleImageWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.22 : 0.22;
      setImageZoom((current) => {
        const next = clampZoom(current + delta);
        setImagePan((pan) => clampImagePan(pan.x, pan.y, next));
        return next;
      });
    },
    [clampImagePan],
  );

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

  const selectedDownloadHref =
    selectedMemory?.mediaType === 'video' ? selectedVideoUrl : selectedMemory?.imageUrl || '';
  const selectedMediaLabel = selectedMemory?.mediaType === 'video' ? 'video' : 'ảnh';
  const selectedPrivacyLabel =
    selectedMemory?.visibility === 'private'
      ? 'Chỉ mình tôi'
      : selectedMemory?.visibility === 'tagged'
        ? 'Riêng tư'
        : '';

  if (!profile) {
    return (
      <div className="relative">
        <section className="mx-auto max-w-7xl px-4 pb-8 pt-9 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="section-kicker">Memory Feed</p>
              <h1 className="max-w-4xl font-display text-6xl leading-[0.86] sm:text-8xl">
                Ký ức lớp 9/8 chỉ mở cho người trong lớp.
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-ink/66 sm:text-base">
                Đăng nhập bằng tên của bạn hoặc tạo tài khoản mới để xem ảnh, video, bình luận và album thanh xuân của lớp.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-white/65 bg-white/55 p-5 text-center shadow-paper backdrop-blur-xl sm:p-7">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-ink text-paper shadow-paper">
                <Lock size={28} />
              </div>
              <h2 className="mt-5 font-display text-5xl leading-none">Cần vào lớp trước</h2>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-ink/62">
                Feed sẽ không tải dữ liệu Firebase khi bạn chưa có tài khoản, nên người ngoài không xem được kỷ niệm.
              </p>
              <button className="primary-button mx-auto mt-6 justify-center" onClick={onJoin}>
                <UserRound size={17} />
                Đăng nhập / tạo tài khoản
              </button>
              <button className="secondary-button mx-auto mt-3 justify-center" onClick={onPhotobook}>
                <Camera size={17} />
                Đăng kỷ niệm sau khi vào lớp
              </button>
            </div>
          </div>
        </section>

        <FirebaseNotice message={firebaseNotice} />
      </div>
    );
  }

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
              thích, bấm vào ảnh hoặc video để xem rõ hơn, tải về máy và để lại vài dòng bình luận.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-[1.5rem] border border-white/60 bg-white/45 p-4 shadow-paper backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-stretch">
              <span className="min-w-0 break-words font-hand text-3xl font-bold text-coffee">
                {profile ? `Chào ${profile.name}` : 'Bạn lớp 9/8'}
              </span>
              <button className="primary-button" onClick={onPhotobook}>
                <Camera size={17} />
                Đăng ảnh/video
              </button>
            </div>
            <p className="text-xs leading-5 text-ink/58">
              Bấm Đăng ảnh/video để chụp photobook, upload ảnh có sẵn hoặc đăng một video ngắn lên feed của lớp.
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
              <h2 className="font-display text-5xl">Đang tải kỷ niệm...</h2>
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
                comments={memory.visibility === 'public' ? commentsByMemory[memory.id] || EMPTY_COMMENTS : EMPTY_COMMENTS}
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
              <h2 className="font-display text-5xl">{hasActiveFilter ? 'Không tìm thấy kỷ niệm' : 'Chưa có kỷ niệm nào'}</h2>
              <p className="mt-2 text-sm text-ink/60">
                {hasActiveFilter
                  ? 'Thử xóa bộ lọc hoặc tìm bằng tên, caption, hashtag khác.'
                  : 'Khi ai đó đăng photobook hoặc video lên database, kỷ niệm sẽ hiện ở đây ngay lập tức.'}
              </p>
              {hasActiveFilter ? (
                <button className="secondary-button mx-auto mt-5" onClick={clearFilters}>
                  <X size={16} />
                  Xóa lọc
                </button>
              ) : (
                <button className="primary-button mx-auto mt-5" onClick={onPhotobook}>
                  <Camera size={17} />
                  Đăng kỷ niệm đầu tiên
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
          aria-label={`Xem ${selectedMediaLabel} của ${selectedMemory.name}`}
          onClick={closeSelectedMemory}
        >
          <div
            className="memory-viewer-panel relative flex h-[100svh] w-full flex-col overflow-hidden bg-ink shadow-glass sm:grid sm:max-h-[92svh] sm:max-w-6xl sm:grid-cols-[minmax(0,1fr)_20rem] sm:gap-4 sm:rounded-[1rem] sm:bg-paper sm:p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="memory-viewer-topbar">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-paper/58 sm:text-coffee/62">
                  {selectedMemory.mediaType === 'video' ? 'Video ngắn' : 'Ảnh kỷ niệm'}
                </p>
                <strong className="block truncate text-sm text-paper sm:text-ink">{selectedMemory.name}</strong>
              </div>
              <div className="memory-viewer-actions">
                {selectedDownloadHref && (
                  <a
                    className="memory-viewer-action"
                    href={selectedDownloadHref}
                    download={getMemoryDownloadName(selectedMemory)}
                    aria-label={`Tải ${selectedMediaLabel}`}
                  >
                    <Download size={17} />
                  </a>
                )}
                <button
                  className="memory-viewer-action memory-viewer-close"
                  onClick={closeSelectedMemory}
                  aria-label={`Đóng ${selectedMediaLabel}`}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="memory-media-stage relative grid min-h-0 flex-1 place-items-center overflow-hidden bg-ink sm:rounded-[0.75rem]">
              {selectedMemory.mediaType !== 'video' && !selectedImageLoaded && !selectedImageFailed && (
                <span className="memory-image-placeholder absolute inset-0 z-0" aria-hidden="true" />
              )}
              {selectedMemory.mediaType !== 'video' && selectedImageFailed && (
                <span className="absolute inset-0 z-[2] grid place-items-center px-4 text-center text-sm font-bold text-paper/82">
                  Không thể tải ảnh này
                </span>
              )}
              {selectedMemory.mediaType === 'video' ? (
                <>
                  <img
                    src={selectedMemory.imageUrl}
                    alt={`Ảnh bìa video của ${selectedMemory.name}`}
                    className="absolute inset-0 h-full w-full object-contain opacity-40 blur-sm"
                    decoding="async"
                  />
                  {selectedVideoLoading && (
                    <div className="relative z-[2] grid place-items-center rounded-[1rem] bg-ink/68 px-5 py-4 text-center text-paper shadow-paper">
                      <div className="memory-loading-spinner mx-auto mb-3 h-10 w-10 rounded-full border-4 border-paper/20 border-t-paper" />
                      <p className="text-sm font-bold">Đang tải video...</p>
                    </div>
                  )}
                  {selectedVideoError && (
                    <span className="relative z-[2] grid max-w-sm place-items-center rounded-[1rem] bg-paper px-4 py-3 text-center text-sm font-bold text-coffee">
                      {selectedVideoError}
                    </span>
                  )}
                  {selectedVideoUrl && (
                    <video
                      className="relative z-[3] max-h-[calc(100svh-13rem)] w-auto max-w-full rounded-[0.75rem] object-contain shadow-paper sm:max-h-[86svh]"
                      src={selectedVideoUrl}
                      poster={selectedMemory.imageUrl}
                      controls
                      playsInline
                      preload="metadata"
                    />
                  )}
                </>
              ) : (
                <button
                  type="button"
                  className="memory-open-zoom-button relative z-[1] grid h-full w-full place-items-center"
                  onClick={openImageZoomViewer}
                  aria-label="Mở ảnh để phóng to"
                >
                  <img
                    src={selectedMemory.imageUrl}
                    alt={`Ảnh kỷ niệm của ${selectedMemory.name}`}
                    className="max-h-[calc(100svh-13rem)] w-auto max-w-full object-contain sm:max-h-[86svh]"
                    decoding="async"
                    draggable={false}
                    onLoad={() => setSelectedImageLoaded(true)}
                    onError={() => setSelectedImageFailed(true)}
                  />
                </button>
              )}
            </div>

            <aside className="max-h-[42svh] min-w-0 shrink-0 overflow-auto rounded-t-[1.15rem] bg-paper px-4 pb-4 pt-4 sm:max-h-none sm:rounded-none sm:bg-transparent sm:px-1 sm:pb-1 sm:pt-0 sm:pr-2">
              <p className="section-kicker">{selectedMemory.mediaType === 'video' ? 'Xem video rõ hơn' : 'Xem ảnh rõ hơn'}</p>
              <h2 className="break-words font-display text-5xl leading-none text-ink">{selectedMemory.name}</h2>
              <p className="mt-1 text-xs font-bold uppercase text-coffee/70">Lớp {selectedMemory.className}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-skySoft/30 px-3 py-1.5 text-xs font-black text-chalk">
                  {selectedMemory.mediaType === 'video' ? <Video size={13} /> : <Camera size={13} />}
                  {selectedMemory.mediaType === 'video'
                    ? `Video ngắn${selectedMemory.videoDuration ? ` · ${formatVideoDuration(selectedMemory.videoDuration)}` : ''}`
                    : 'Ảnh photobook'}
                </span>
                {selectedPrivacyLabel && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blush/35 px-3 py-1.5 text-xs font-black text-coffee">
                    <Lock size={13} />
                    {selectedPrivacyLabel}
                  </span>
                )}
              </div>
              <p className="mt-4 break-words text-sm leading-7 text-ink/72">{selectedMemory.caption}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedMemory.hashtags.map((tag) => (
                  <span key={tag} className="rounded-full bg-coffee/10 px-2 py-1 text-xs font-bold text-coffee">
                    #{tag}
                  </span>
                ))}
              </div>
              {selectedDownloadHref ? (
                <a
                  className="primary-button mt-4 w-full sm:mt-5"
                  href={selectedDownloadHref}
                  download={getMemoryDownloadName(selectedMemory)}
                >
                  <Download size={17} />
                  Tải {selectedMediaLabel}
                </a>
              ) : (
                <button className="primary-button mt-4 w-full sm:mt-5" disabled>
                  <Download size={17} />
                  Đang chuẩn bị tải...
                </button>
              )}
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

      {selectedMemory && selectedMemory.mediaType !== 'video' && isImageZoomOpen && (
        <div
          className="memory-zoom-overlay fixed inset-0 z-[60] bg-ink"
          role="dialog"
          aria-modal="true"
          aria-label={`Phóng to ảnh của ${selectedMemory.name}`}
          onClick={closeImageZoomViewer}
        >
          <div className="memory-viewer-topbar memory-zoom-topbar" onClick={(event) => event.stopPropagation()}>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-paper/58">Zoom ảnh</p>
              <strong className="block truncate text-sm text-paper">{selectedMemory.name}</strong>
            </div>
            <div className="memory-viewer-actions">
              <button className="memory-viewer-action memory-viewer-zoom-reset" onClick={resetImageZoom} aria-label="Đưa ảnh về kích thước ban đầu">
                <RotateCcw size={15} />
                <span>{Math.round(imageZoom * 100)}%</span>
              </button>
              {selectedDownloadHref && (
                <a
                  className="memory-viewer-action"
                  href={selectedDownloadHref}
                  download={getMemoryDownloadName(selectedMemory)}
                  aria-label="Tải ảnh"
                >
                  <Download size={17} />
                </a>
              )}
              <button className="memory-viewer-action memory-viewer-close" onClick={closeImageZoomViewer} aria-label="Đóng zoom ảnh">
                <X size={18} />
              </button>
            </div>
          </div>

          <div
            ref={mediaStageRef}
            className={`memory-zoom-stage memory-media-stage-image ${imageZoom > 1 ? 'memory-media-stage-zoomed' : ''}`}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={handleImagePointerDown}
            onPointerMove={handleImagePointerMove}
            onPointerUp={handleImagePointerEnd}
            onPointerCancel={handleImagePointerEnd}
            onLostPointerCapture={handleImagePointerEnd}
            onWheel={handleImageWheel}
          >
            <img
              src={selectedMemory.imageUrl}
              alt={`Ảnh kỷ niệm của ${selectedMemory.name}`}
              className="zoomable-memory-image max-h-[92svh] w-auto max-w-full object-contain"
              decoding="async"
              draggable={false}
              style={{
                transform: `translate3d(${imagePan.x}px, ${imagePan.y}px, 0) scale(${imageZoom})`,
              }}
            />
          </div>
        </div>
      )}

      <FirebaseNotice message={firebaseNotice} />
    </div>
  );
}
