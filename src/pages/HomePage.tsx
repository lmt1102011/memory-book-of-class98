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
  memoryRecapEnabled: boolean;
  profile: UserProfile | null;
  pendingReactionIds: string[];
  onJoin: () => void;
  onOpenProfile: (nameKey: string) => void;
  onReact: (memory: MemoryItem) => void | Promise<void>;
  onAddComment: (memory: MemoryItem, message: string) => void | Promise<void>;
  onDeleteComment: (comment: MemoryComment) => void | Promise<void>;
  onDeleteMemory: (memory: MemoryItem) => void | Promise<void>;
  onDownloadMemory: (memory: MemoryItem) => void | Promise<void>;
}

export default function HomePage({
  memories,
  commentsByMemory,
  firebaseNotice,
  isLoadingMemories,
  memoryRecapEnabled,
  profile,
  pendingReactionIds,
  onJoin,
  onOpenProfile,
  onReact,
  onAddComment,
  onDeleteComment,
  onDeleteMemory,
  onDownloadMemory,
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
  const [isRecapDownloading, setIsRecapDownloading] = useState(false);
  const [recapPosterError, setRecapPosterError] = useState('');

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

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;
    document.documentElement.classList.add('memory-viewer-open');
    document.body.classList.add('memory-viewer-open');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'contain';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.documentElement.classList.remove('memory-viewer-open');
      document.body.classList.remove('memory-viewer-open');
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
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

  const memoryRecap = useMemo(() => {
    const imageMemories = memories.filter((memory) => memory.mediaType === 'image' && memory.imageUrl);

    return {
      totalMemories: memories.length,
      imageCount: imageMemories.length,
      coverMemory: imageMemories[0] || memories[0],
    };
  }, [memories]);

  const handleDownloadRecap = useCallback(async () => {
    setIsRecapDownloading(true);
    setRecapPosterError('');

    try {
      if (!profile) {
        onJoin();
        return;
      }

      const service = await import('../services/firebaseMemoryBook');
      const posterData = await service.loadClassPosterData(profile);
      const { downloadClassMemoryPoster } = await import('../utils/classMemoryPoster');
      await downloadClassMemoryPoster(posterData);
    } catch (caught) {
      setRecapPosterError(caught instanceof Error ? caught.message : 'Không thể tạo poster recap lúc này.');
    } finally {
      setIsRecapDownloading(false);
    }
  }, [onJoin, profile]);

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
            <span className="min-w-0 break-words font-hand text-3xl font-bold text-coffee">
              {profile ? `Chào ${profile.name}` : 'Bạn lớp 9/8'}
            </span>
            <p className="text-xs leading-5 text-ink/58">
              Đây là góc xem lại ảnh, video và những bình luận đang được lớp cập nhật theo thời gian thực.
            </p>
            {!profile && (
              <button className="secondary-button justify-center" onClick={onJoin}>
                Vào lớp 9/8
              </button>
            )}
          </div>
        </div>
      </section>

      {memoryRecapEnabled && (
        <section className="mx-auto max-w-7xl px-4 pb-7 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[1.7rem] border border-white/75 bg-paper shadow-[0_24px_70px_rgba(84,57,35,0.16)]">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-blush via-[#f4dfbf] to-skySoft" aria-hidden="true" />
            <div className="grid lg:grid-cols-[minmax(0,1fr)_23rem]">
              <div className="relative min-w-0 p-5 sm:p-7 lg:p-8">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-ink px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.08em] text-paper">
                    Recap được manager mở
                  </span>
                  <span className="rounded-full bg-skySoft/30 px-3 py-1.5 text-[11px] font-black uppercase text-chalk">
                    Lớp 9/8
                  </span>
                </div>

                <h2 className="mt-5 max-w-2xl font-display text-6xl leading-[0.86] text-ink sm:text-7xl">
                  Recap thanh xuân 9/8
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/66 sm:text-base">
                  Recap chỉ hiện số kỷ niệm ở đây. Khi tải poster, web sẽ ghép đầy đủ ảnh và lời chúc thư lớp thành một scrapbook rõ ràng.
                </p>

                <div className="mt-6 max-w-sm rounded-[1.25rem] border border-coffee/10 bg-white/70 p-5 text-center shadow-paper">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-coffee/58">Tổng kỷ niệm</span>
                  <strong className="mt-2 block font-display text-8xl leading-none text-ink">{memoryRecap.totalMemories}</strong>
                  <span className="mt-1 block text-sm font-black uppercase text-coffee/66">kỷ niệm</span>
                </div>

                <button
                  type="button"
                  className="primary-button mt-5 w-full justify-center sm:w-auto"
                  onClick={() => void handleDownloadRecap()}
                  disabled={isRecapDownloading}
                >
                  <Download size={17} />
                  {isRecapDownloading ? 'Đang tạo poster...' : 'Tải poster ảnh + lời chúc'}
                </button>
                {recapPosterError && (
                  <p className="mt-3 max-w-lg rounded-2xl bg-blush/30 px-4 py-3 text-sm font-bold leading-6 text-coffee">
                    {recapPosterError}
                  </p>
                )}
              </div>

              <aside className="relative border-t border-coffee/10 bg-[#f7e7ca]/45 p-5 sm:p-7 lg:border-l lg:border-t-0">
                <div className="mx-auto max-w-[18rem]">
                  <div className="relative">
                    <span className="scrapbook-tape left-8 top-0 z-[3] -rotate-6" />
                    <figure className="relative rotate-[1.6deg] rounded-[0.55rem] bg-white p-3 pb-8 shadow-paper">
                      <div className="aspect-[4/5] overflow-hidden rounded-[0.35rem] bg-coffee/10">
                        {memoryRecap.coverMemory?.imageUrl ? (
                          <img
                            src={memoryRecap.coverMemory.imageUrl}
                            alt={`Kỷ niệm nổi bật của ${memoryRecap.coverMemory.name}`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div className="grid h-full place-items-center px-4 text-center text-sm font-black text-coffee/58">
                            Chờ kỷ niệm đầu tiên
                          </div>
                        )}
                      </div>
                      <figcaption className="mt-3 line-clamp-2 text-center font-hand text-2xl font-bold leading-6 text-coffee">
                        {memoryRecap.coverMemory?.caption || 'Memory98 recap'}
                      </figcaption>
                    </figure>
                  </div>

                  <p className="mt-5 rounded-[1rem] bg-paper/72 px-4 py-3 text-center text-xs font-bold leading-5 text-ink/62">
                    Poster mới dán ảnh và lời chúc xen kẽ theo bố cục masonry, lệch nhẹ như scrapbook nhưng vẫn đọc rõ từng lời chúc.
                  </p>
                </div>
              </aside>
            </div>
          </div>
        </section>
      )}

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
                  : 'Khi có ảnh hoặc video mới trên database, kỷ niệm sẽ hiện ở đây ngay lập tức.'}
              </p>
              {hasActiveFilter && (
                <button className="secondary-button mx-auto mt-5" onClick={clearFilters}>
                  <X size={16} />
                  Xóa lọc
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {selectedMemory && (
        <div
          className="memory-modal-overlay fixed inset-0 z-[95] grid place-items-center overflow-hidden bg-ink/92 p-0 backdrop-blur-sm sm:p-6"
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

            <aside className="max-h-[42svh] min-w-0 shrink-0 overflow-x-hidden overflow-y-auto rounded-t-[1.15rem] bg-paper px-4 pb-4 pt-4 sm:max-h-none sm:rounded-none sm:bg-transparent sm:px-1 sm:pb-1 sm:pt-0 sm:pr-2">
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
                  onClick={() => void onDownloadMemory(selectedMemory)}
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
          className="memory-zoom-overlay fixed inset-0 z-[100] overflow-hidden bg-ink"
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
