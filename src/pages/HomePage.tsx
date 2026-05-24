import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import {
  BookOpen,
  Camera,
  Download,
  Filter,
  Heart,
  Lock,
  RotateCcw,
  Search,
  Sparkles,
  Upload,
  UserRound,
  Video,
  X,
} from 'lucide-react';
import FirebaseNotice from '../components/FirebaseNotice';
import MemoryCard from '../components/MemoryCard';
import { useDebounce } from '../hooks/useDebounce';
import type {
  CinematicSlideshowSettings,
  CommentReactionId,
  MemoryComment,
  MemoryItem,
  UserProfile,
} from '../types';

const EMPTY_COMMENTS: MemoryComment[] = [];
type MemoryGuideStep = 'idle' | 'feed' | 'viewer' | 'done';

type SmartMemoryFilter = 'all' | 'mine' | 'photos' | 'videos' | 'popular' | 'commented';

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

const slideshowMoodConfig: Record<
  CinematicSlideshowSettings['mood'],
  {
    label: string;
    eyebrow: string;
    title: string;
    description: string;
    shellClass: string;
    glowClass: string;
    chipClass: string;
    previewClass: string;
    modalClass: string;
    modalFooterClass: string;
    progressClass: string;
  }
> = {
  cinematic: {
    label: 'Điện ảnh',
    eyebrow: 'Rạp phim thanh xuân',
    title: 'Rạp phim thanh xuân của lớp 9/8',
    description: 'Ảnh chạy chậm, nền tối, rõ mặt và có cảm giác như một đoạn phim cuối cấp.',
    shellClass: 'bg-ink text-paper shadow-[0_28px_80px_rgba(53,41,31,0.22)]',
    glowClass:
      'bg-[radial-gradient(circle_at_18%_18%,rgba(247,183,199,0.24),transparent_32%),radial-gradient(circle_at_82%_22%,rgba(169,205,232,0.24),transparent_34%)]',
    chipClass: 'bg-paper text-ink',
    previewClass: 'bg-white/8 border-white/10',
    modalClass: 'border-white/12 bg-[#14100d]',
    modalFooterClass: 'border-white/10 bg-[#1e1712]',
    progressClass: 'from-blush via-paper to-skySoft',
  },
  scrapbook: {
    label: 'Lưu bút',
    eyebrow: 'Scrapbook mềm',
    title: 'Slideshow như trang lưu bút đang mở',
    description: 'Nền giấy ấm, ảnh như polaroid, hợp xem lại những khoảnh khắc nhẹ nhàng và có chút tiếc nuối.',
    shellClass: 'bg-paper text-ink shadow-[0_28px_80px_rgba(122,86,57,0.18)]',
    glowClass:
      'bg-[radial-gradient(circle_at_12%_18%,rgba(247,183,199,0.28),transparent_34%),radial-gradient(circle_at_86%_80%,rgba(244,223,191,0.48),transparent_38%)]',
    chipClass: 'bg-ink text-paper',
    previewClass: 'bg-[#f7e7ca]/58 border-coffee/10',
    modalClass: 'border-[#f4dfbf]/30 bg-[#2f2118]',
    modalFooterClass: 'border-[#f4dfbf]/18 bg-[#3b2a1f]',
    progressClass: 'from-coffee via-blush to-skySoft',
  },
  photobooth: {
    label: 'Photobooth',
    eyebrow: 'Korean photobooth',
    title: 'Slideshow kiểu photobooth Hàn Quốc',
    description: 'Sáng, vui, nổi bật như đang lướt những tấm strip nhỏ sau giờ chụp ảnh cùng lớp.',
    shellClass: 'bg-[#ffeef5] text-ink shadow-[0_28px_80px_rgba(157,59,75,0.18)]',
    glowClass:
      'bg-[linear-gradient(135deg,rgba(255,255,255,0.62),transparent_30%),radial-gradient(circle_at_78%_18%,rgba(169,205,232,0.38),transparent_36%)]',
    chipClass: 'bg-[#35291f] text-paper',
    previewClass: 'bg-white/62 border-white/80',
    modalClass: 'border-pink-100/30 bg-[#251722]',
    modalFooterClass: 'border-pink-100/18 bg-[#341f30]',
    progressClass: 'from-blush via-skySoft to-[#f4dfbf]',
  },
};

interface HomePageProps {
  memories: MemoryItem[];
  commentsByMemory: Record<string, MemoryComment[]>;
  firebaseNotice: string;
  isLoadingMemories: boolean;
  memoryRecapEnabled: boolean;
  futureMessagesEnabled: boolean;
  writingPromptsEnabled: boolean;
  cinematicSlideshowSettings: CinematicSlideshowSettings;
  profile: UserProfile | null;
  onlineNameKeys: Set<string>;
  menuHintCompleted: boolean;
  memoryGuideStorageKey: string;
  pendingReactionIds: string[];
  pendingCommentReactionIds: string[];
  onJoin: () => void;
  onPhotobook: () => void;
  onOpenFuture: () => void;
  onOpenRemember: () => void;
  onOpenDiary: () => void;
  onOpenProfile: (nameKey: string) => void;
  onReact: (memory: MemoryItem) => void | Promise<void>;
  onReactComment: (comment: MemoryComment, reactionId: CommentReactionId) => void | Promise<void>;
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
  futureMessagesEnabled,
  writingPromptsEnabled,
  cinematicSlideshowSettings,
  profile,
  onlineNameKeys,
  menuHintCompleted,
  memoryGuideStorageKey,
  pendingReactionIds,
  pendingCommentReactionIds,
  onJoin,
  onPhotobook,
  onOpenFuture,
  onOpenRemember,
  onOpenDiary,
  onOpenProfile,
  onReact,
  onReactComment,
  onAddComment,
  onDeleteComment,
  onDeleteMemory,
  onDownloadMemory,
}: HomePageProps) {
  const mediaStageRef = useRef<HTMLDivElement | null>(null);
  const zoomImageRef = useRef<HTMLImageElement | null>(null);
  const zoomFrameRef = useRef<number | null>(null);
  const zoomStateSyncTimerRef = useRef<number | null>(null);
  const zoomInteractionTimerRef = useRef<number | null>(null);
  const zoomStateRef = useRef({ zoom: 1, x: 0, y: 0 });
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>());
  const panGestureRef = useRef({ startX: 0, startY: 0, panX: 0, panY: 0, lastTapAt: 0 });
  const pinchGestureRef = useRef({ distance: 0, zoom: 1 });
  const [nameQuery, setNameQuery] = useState('');
  const [keywordQuery, setKeywordQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activePersonKey, setActivePersonKey] = useState<string | null>(null);
  const [activeSmartFilter, setActiveSmartFilter] = useState<SmartMemoryFilter>('all');
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
  const [isSlideshowOpen, setIsSlideshowOpen] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [memoryGuideStep, setMemoryGuideStep] = useState<MemoryGuideStep>('idle');

  const debouncedName = useDebounce(nameQuery);
  const debouncedKeyword = useDebounce(keywordQuery);

  useEffect(() => {
    if (!profile || !memoryGuideStorageKey) {
      setMemoryGuideStep('idle');
      return;
    }

    setMemoryGuideStep(window.localStorage.getItem(memoryGuideStorageKey) === 'done' ? 'done' : 'feed');
  }, [memoryGuideStorageKey, profile?.uid]);

  const syncZoomState = useCallback((immediate = false) => {
    const publish = () => {
      zoomStateSyncTimerRef.current = null;
      const current = zoomStateRef.current;
      setImageZoom(current.zoom);
      setImagePan({ x: current.x, y: current.y });
    };

    if (immediate) {
      if (zoomStateSyncTimerRef.current !== null) {
        window.clearTimeout(zoomStateSyncTimerRef.current);
        zoomStateSyncTimerRef.current = null;
      }
      publish();
      return;
    }

    if (zoomStateSyncTimerRef.current !== null) return;
    zoomStateSyncTimerRef.current = window.setTimeout(publish, 72);
  }, []);

  const scheduleZoomTransform = useCallback((nextState: { zoom: number; x: number; y: number }, syncState = false) => {
    zoomStateRef.current = nextState;

    if (zoomFrameRef.current === null) {
      zoomFrameRef.current = window.requestAnimationFrame(() => {
        zoomFrameRef.current = null;
        const current = zoomStateRef.current;
        if (zoomImageRef.current) {
          zoomImageRef.current.style.transform = `translate3d(${current.x}px, ${current.y}px, 0) scale(${current.zoom})`;
        }
      });
    }

    syncZoomState(syncState);
  }, [syncZoomState]);

  const setZoomInteractionMode = useCallback((active: boolean) => {
    if (zoomInteractionTimerRef.current !== null) {
      window.clearTimeout(zoomInteractionTimerRef.current);
      zoomInteractionTimerRef.current = null;
    }

    const image = zoomImageRef.current;
    if (!image) return;

    if (active) {
      image.style.transition = 'none';
      return;
    }

    zoomInteractionTimerRef.current = window.setTimeout(() => {
      zoomInteractionTimerRef.current = null;
      if (zoomImageRef.current) zoomImageRef.current.style.transition = '';
    }, 80);
  }, []);

  const clampImagePan = useCallback((x: number, y: number, zoom: number) => {
    if (zoom <= 1) return { x: 0, y: 0 };
    const rect = mediaStageRef.current?.getBoundingClientRect();
    const image = zoomImageRef.current;
    const width = rect?.width || window.innerWidth || 360;
    const height = rect?.height || window.innerHeight || 640;
    const imageWidth = image?.clientWidth || width;
    const imageHeight = image?.clientHeight || height;
    const limitX = Math.max(0, (imageWidth * zoom - width) / 2);
    const limitY = Math.max(0, (imageHeight * zoom - height) / 2);
    return {
      x: Math.min(limitX, Math.max(-limitX, x)),
      y: Math.min(limitY, Math.max(-limitY, y)),
    };
  }, []);

  const zoomAroundPoint = useCallback(
    (nextZoom: number, clientX: number, clientY: number) => {
      const current = zoomStateRef.current;
      const rect = mediaStageRef.current?.getBoundingClientRect();
      const stageWidth = rect?.width || window.innerWidth || 360;
      const stageHeight = rect?.height || window.innerHeight || 640;
      const focusX = clientX - (rect?.left || 0) - stageWidth / 2;
      const focusY = clientY - (rect?.top || 0) - stageHeight / 2;
      const ratio = nextZoom / Math.max(0.001, current.zoom);
      const nextPan = clampImagePan(current.x * ratio + focusX * (1 - ratio), current.y * ratio + focusY * (1 - ratio), nextZoom);
      return { zoom: nextZoom, x: nextPan.x, y: nextPan.y };
    },
    [clampImagePan],
  );

  const resetImageZoom = useCallback(() => {
    setZoomInteractionMode(false);
    scheduleZoomTransform({ zoom: 1, x: 0, y: 0 }, true);
  }, [scheduleZoomTransform, setZoomInteractionMode]);

  const markMemoryGuideDone = useCallback(() => {
    if (memoryGuideStorageKey) window.localStorage.setItem(memoryGuideStorageKey, 'done');
    setMemoryGuideStep('done');
  }, [memoryGuideStorageKey]);

  const closeSelectedMemory = useCallback(() => {
    if (memoryGuideStep === 'viewer') markMemoryGuideDone();
    setSelectedMemory(null);
    setIsImageZoomOpen(false);
    resetImageZoom();
  }, [markMemoryGuideDone, memoryGuideStep, resetImageZoom]);

  const openImageZoomViewer = useCallback(() => {
    if (selectedMemory?.mediaType === 'video') return;
    if (memoryGuideStep === 'viewer') markMemoryGuideDone();
    activePointersRef.current.clear();
    resetImageZoom();
    setIsImageZoomOpen(true);
  }, [markMemoryGuideDone, memoryGuideStep, resetImageZoom, selectedMemory?.mediaType]);

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

  const getPointerCenter = () => {
    const points = Array.from(activePointersRef.current.values());
    if (!points.length) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const sum = points.reduce(
      (total, point) => ({
        x: total.x + point.x,
        y: total.y + point.y,
      }),
      { x: 0, y: 0 },
    );
    return { x: sum.x / points.length, y: sum.y / points.length };
  };

  const handleImagePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isImageZoomOpen || selectedMemory?.mediaType === 'video') return;
      event.currentTarget.setPointerCapture(event.pointerId);
      activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      setZoomInteractionMode(true);

      const now = performance.now();
      if (activePointersRef.current.size === 1) {
        const current = zoomStateRef.current;
        if (now - panGestureRef.current.lastTapAt < 280) {
          const nextZoom = current.zoom > 1 ? 1 : 2.35;
          const nextState = nextZoom === 1 ? { zoom: 1, x: 0, y: 0 } : zoomAroundPoint(nextZoom, event.clientX, event.clientY);
          scheduleZoomTransform(nextState, true);
          panGestureRef.current.lastTapAt = 0;
        } else {
          panGestureRef.current.lastTapAt = now;
        }

        panGestureRef.current = {
          ...panGestureRef.current,
          startX: event.clientX,
          startY: event.clientY,
          panX: zoomStateRef.current.x,
          panY: zoomStateRef.current.y,
        };
      }

      if (activePointersRef.current.size === 2) {
        pinchGestureRef.current = {
          distance: getPointerDistance(),
          zoom: zoomStateRef.current.zoom,
        };
      }
    },
    [isImageZoomOpen, scheduleZoomTransform, selectedMemory?.mediaType, setZoomInteractionMode, zoomAroundPoint],
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
        const center = getPointerCenter();
        scheduleZoomTransform(zoomAroundPoint(nextZoom, center.x, center.y));
        return;
      }

      const current = zoomStateRef.current;
      if (current.zoom <= 1) return;
      event.preventDefault();
      const nextX = panGestureRef.current.panX + event.clientX - panGestureRef.current.startX;
      const nextY = panGestureRef.current.panY + event.clientY - panGestureRef.current.startY;
      const nextPan = clampImagePan(nextX, nextY, current.zoom);
      scheduleZoomTransform({ zoom: current.zoom, x: nextPan.x, y: nextPan.y });
    },
    [clampImagePan, isImageZoomOpen, scheduleZoomTransform, zoomAroundPoint],
  );

  const handleImagePointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      activePointersRef.current.delete(event.pointerId);
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Some browsers release capture automatically after a pinch.
      }

      if (activePointersRef.current.size === 1) {
        const [remaining] = Array.from(activePointersRef.current.values());
        panGestureRef.current = {
          ...panGestureRef.current,
          startX: remaining.x,
          startY: remaining.y,
          panX: zoomStateRef.current.x,
          panY: zoomStateRef.current.y,
        };
      }

      if (activePointersRef.current.size < 2) {
        pinchGestureRef.current = { distance: 0, zoom: zoomStateRef.current.zoom };
      }

      if (activePointersRef.current.size === 0) {
        setZoomInteractionMode(false);
        syncZoomState(true);
      }
    },
    [setZoomInteractionMode, syncZoomState],
  );

  const handleImageWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      setZoomInteractionMode(true);
      const current = zoomStateRef.current;
      const factor = Math.exp(-event.deltaY * 0.0014);
      const nextZoom = clampZoom(current.zoom * factor);
      scheduleZoomTransform(zoomAroundPoint(nextZoom, event.clientX, event.clientY));
      setZoomInteractionMode(false);
    },
    [scheduleZoomTransform, setZoomInteractionMode, zoomAroundPoint],
  );

  useEffect(
    () => () => {
      if (zoomFrameRef.current !== null) window.cancelAnimationFrame(zoomFrameRef.current);
      if (zoomStateSyncTimerRef.current !== null) window.clearTimeout(zoomStateSyncTimerRef.current);
      if (zoomInteractionTimerRef.current !== null) window.clearTimeout(zoomInteractionTimerRef.current);
    },
    [],
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

  const smartFilters = useMemo(
    () => [
      { id: 'all' as const, label: 'Tất cả', count: memories.length },
      {
        id: 'mine' as const,
        label: 'Của tôi',
        count: profile ? memories.filter((memory) => memory.uid === profile.uid || memory.nameKey === profile.nameKey).length : 0,
      },
      { id: 'photos' as const, label: 'Ảnh', count: memories.filter((memory) => memory.mediaType !== 'video').length },
      { id: 'videos' as const, label: 'Video', count: memories.filter((memory) => memory.mediaType === 'video').length },
      { id: 'popular' as const, label: 'Nhiều tim', count: memories.filter((memory) => (memory.reactions || 0) > 0).length },
      {
        id: 'commented' as const,
        label: 'Có bình luận',
        count: memories.filter((memory) => (commentsByMemory[memory.id]?.length || 0) > 0).length,
      },
    ],
    [commentsByMemory, memories, profile],
  );

  const slideshowMemories = useMemo(
    () => memories.filter((memory) => memory.mediaType === 'image' && memory.imageUrl).slice(0, 36),
    [memories],
  );
  const slideshowMood = slideshowMoodConfig[cinematicSlideshowSettings.mood] || slideshowMoodConfig.cinematic;

  const activeSlide = slideshowMemories[slideIndex % Math.max(1, slideshowMemories.length)];

  const nextSlide = useCallback(() => {
    setSlideIndex((index) => (slideshowMemories.length ? (index + 1) % slideshowMemories.length : 0));
  }, [slideshowMemories.length]);

  const previousSlide = useCallback(() => {
    setSlideIndex((index) => (slideshowMemories.length ? (index - 1 + slideshowMemories.length) % slideshowMemories.length : 0));
  }, [slideshowMemories.length]);

  useEffect(() => {
    if (!cinematicSlideshowSettings.enabled) {
      setIsSlideshowOpen(false);
      return;
    }

    if (!slideshowMemories.length) {
      setIsSlideshowOpen(false);
      setSlideIndex(0);
      return;
    }

    setSlideIndex((index) => Math.min(index, slideshowMemories.length - 1));
  }, [cinematicSlideshowSettings.enabled, slideshowMemories.length]);

  useEffect(() => {
    if (!isSlideshowOpen || slideshowMemories.length <= 1) return undefined;

    const timer = window.setInterval(nextSlide, 4200);
    return () => window.clearInterval(timer);
  }, [isSlideshowOpen, nextSlide, slideshowMemories.length]);

  useEffect(() => {
    if (!isSlideshowOpen) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSlideshowOpen(false);
      if (event.key === 'ArrowRight') nextSlide();
      if (event.key === 'ArrowLeft') previousSlide();
    };

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isSlideshowOpen, nextSlide, previousSlide]);

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

    const filtered = memories.filter((memory) => {
      const byName = !name || memory.name.toLowerCase().includes(name);
      const byKeyword =
        !keyword ||
        memory.caption.toLowerCase().includes(keyword) ||
        memory.hashtags.some((tag) => tag.toLowerCase().includes(keyword));
      const byTag = !activeTag || memory.hashtags.includes(activeTag);
      const byPerson = !activePersonKey || memory.nameKey === activePersonKey || memory.uid === activePersonKey;
      const bySmartFilter =
        activeSmartFilter === 'all' ||
        (activeSmartFilter === 'mine' && Boolean(profile && (memory.uid === profile.uid || memory.nameKey === profile.nameKey))) ||
        (activeSmartFilter === 'photos' && memory.mediaType !== 'video') ||
        (activeSmartFilter === 'videos' && memory.mediaType === 'video') ||
        (activeSmartFilter === 'popular' && (memory.reactions || 0) > 0) ||
        (activeSmartFilter === 'commented' && (commentsByMemory[memory.id]?.length || 0) > 0);

      return byName && byKeyword && byTag && byPerson && bySmartFilter;
    });

    if (activeSmartFilter === 'popular') {
      return filtered.sort((left, right) => (right.reactions || 0) - (left.reactions || 0));
    }

    if (activeSmartFilter === 'commented') {
      return filtered.sort((left, right) => (commentsByMemory[right.id]?.length || 0) - (commentsByMemory[left.id]?.length || 0));
    }

    return filtered;
  }, [activePersonKey, activeSmartFilter, activeTag, commentsByMemory, memories, profile, debouncedKeyword, debouncedName]);

  const hasActiveFilter = Boolean(nameQuery.trim() || keywordQuery.trim() || activeTag || activePersonKey || activeSmartFilter !== 'all');
  const canShowMemoryTapGuide = Boolean(
    profile &&
      menuHintCompleted &&
      memoryGuideStep === 'feed' &&
      !isLoadingMemories &&
      filteredMemories.length &&
      !selectedMemory,
  );
  const showZoomTapGuide = Boolean(
    selectedMemory &&
      selectedMemory.mediaType !== 'video' &&
      menuHintCompleted &&
      memoryGuideStep === 'viewer' &&
      !isImageZoomOpen,
  );

  const clearFilters = () => {
    setNameQuery('');
    setKeywordQuery('');
    setActiveTag(null);
    setActivePersonKey(null);
    setActiveSmartFilter('all');
  };

  const openMemoryPreview = useCallback(
    (memory: MemoryItem) => {
      setSelectedMemory(memory);
      if (menuHintCompleted && memoryGuideStep === 'feed' && memory.mediaType !== 'video') {
        setMemoryGuideStep('viewer');
      }
    },
    [memoryGuideStep, menuHintCompleted],
  );

  const openFirstGuidedMemory = useCallback(() => {
    const firstPhoto = filteredMemories.find((memory) => memory.mediaType !== 'video') || filteredMemories[0];
    if (!firstPhoto) return;
    setSelectedMemory(firstPhoto);
    setMemoryGuideStep(firstPhoto.mediaType === 'video' ? 'done' : 'viewer');
    if (firstPhoto.mediaType === 'video') markMemoryGuideDone();
  }, [filteredMemories, markMemoryGuideDone]);

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
            {profile ? (
              <button className="primary-button justify-center" onClick={onPhotobook}>
                <Upload size={17} />
                Đăng ảnh/video
              </button>
            ) : (
              <button className="secondary-button justify-center" onClick={onJoin}>
                Vào lớp 9/8
              </button>
            )}
          </div>
        </div>
      </section>

      {writingPromptsEnabled && (
        <section className="mx-auto max-w-7xl px-4 pb-7 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[1.45rem] border border-white/70 bg-[#fffaf1] p-4 shadow-paper sm:p-5 lg:p-6">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blush via-[#f4dfbf] to-skySoft" aria-hidden="true" />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.08em] text-paper">
                  <Sparkles size={14} />
                  Gợi nhắc cuối năm
                </span>
                <h2 className="mt-3 font-display text-4xl leading-none text-ink sm:text-5xl">
                  Có điều gì hôm nay mình chưa kịp viết lại không?
                </h2>
                <p className="mt-3 text-sm font-semibold leading-6 text-ink/62">
                  Một vài dòng nhỏ thôi cũng đủ giữ lại cảm giác của tuổi học trò. Chọn đúng nơi cần viết, web sẽ đưa bạn tới đó.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  className="group flex min-h-[5.4rem] items-start gap-3 rounded-[1.05rem] bg-paper/80 p-3 text-left shadow-sm ring-1 ring-coffee/8 transition hover:-translate-y-0.5 hover:bg-white"
                  onClick={onOpenRemember}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blush/45 text-coffee">
                    <Heart size={17} />
                  </span>
                  <span className="min-w-0">
                    <strong className="block text-sm font-black leading-5">Secret Message</strong>
                    <span className="mt-1 block text-xs font-semibold leading-5 text-ink/58">Gửi điều chưa kịp nói cho một bạn.</span>
                  </span>
                </button>

                <button
                  type="button"
                  className="group flex min-h-[5.4rem] items-start gap-3 rounded-[1.05rem] bg-paper/80 p-3 text-left shadow-sm ring-1 ring-coffee/8 transition hover:-translate-y-0.5 hover:bg-white"
                  onClick={onOpenDiary}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-paper">
                    <BookOpen size={17} />
                  </span>
                  <span className="min-w-0">
                    <strong className="block text-sm font-black leading-5">Nhật ký riêng</strong>
                    <span className="mt-1 block text-xs font-semibold leading-5 text-ink/58">Viết một trang chỉ mình bạn đọc.</span>
                  </span>
                </button>

                {futureMessagesEnabled && (
                  <button
                    type="button"
                    className="group flex min-h-[5.4rem] items-start gap-3 rounded-[1.05rem] bg-paper/80 p-3 text-left shadow-sm ring-1 ring-coffee/8 transition hover:-translate-y-0.5 hover:bg-white"
                    onClick={onOpenFuture}
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-skySoft/45 text-chalk">
                      <Sparkles size={17} />
                    </span>
                    <span className="min-w-0">
                      <strong className="block text-sm font-black leading-5">Gửi cho tương lai</strong>
                      <span className="mt-1 block text-xs font-semibold leading-5 text-ink/58">Gửi một lời cho lớp 9/8 sau này.</span>
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

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

      {cinematicSlideshowSettings.enabled && (
        <section className="mx-auto max-w-7xl px-4 pb-7 sm:px-6 lg:px-8">
          <div className={`relative overflow-hidden rounded-[1.7rem] border border-white/75 ${slideshowMood.shellClass}`}>
            <div className={`absolute inset-0 ${slideshowMood.glowClass}`} />
            <div className="relative grid gap-0 lg:grid-cols-[minmax(0,1fr)_24rem]">
              <div className="min-w-0 p-5 sm:p-7 lg:p-8">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.08em] ${slideshowMood.chipClass}`}>
                    Slideshow được manager bật
                  </span>
                  <span className="rounded-full bg-white/18 px-3 py-1.5 text-[11px] font-black uppercase">
                    {slideshowMood.label}
                  </span>
                  <span className="rounded-full bg-white/12 px-3 py-1.5 text-[11px] font-black uppercase opacity-80">
                    {isLoadingMemories ? 'Đang tải ảnh' : `${slideshowMemories.length} ảnh`}
                  </span>
                </div>

                <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] opacity-60">{slideshowMood.eyebrow}</p>
                <h2 className="mt-2 max-w-2xl font-display text-6xl leading-[0.86] sm:text-7xl">
                  {slideshowMood.title}
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 opacity-70 sm:text-base">
                  {slideshowMood.description}
                </p>

                <button
                  type="button"
                  className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black shadow-paper transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${slideshowMood.chipClass}`}
                  onClick={() => {
                    if (!slideshowMemories.length) return;
                    setSlideIndex(0);
                    setIsSlideshowOpen(true);
                  }}
                  disabled={!slideshowMemories.length}
                >
                  <Camera size={17} />
                  {slideshowMemories.length ? 'Mở slideshow' : isLoadingMemories ? 'Đang chuẩn bị ảnh' : 'Chưa có ảnh để chiếu'}
                </button>
              </div>

              <aside className={`relative min-h-[17rem] overflow-hidden border-t p-5 sm:p-7 lg:border-l lg:border-t-0 ${slideshowMood.previewClass}`}>
                <div className="relative mx-auto grid max-w-[20rem] grid-cols-3 gap-2">
                  {slideshowMemories.length ? (
                    slideshowMemories.slice(0, 6).map((memory, index) => (
                      <div
                        key={memory.id}
                        className={`overflow-hidden rounded-[0.7rem] bg-paper/12 shadow-paper ${
                          index === 0 ? 'col-span-2 row-span-2 aspect-[4/5]' : 'aspect-square'
                        }`}
                      >
                        <img
                          src={memory.imageUrl}
                          alt={`Ảnh slideshow của ${memory.name}`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    ))
                  ) : (
                    <div className="col-span-3 grid aspect-[16/10] place-items-center rounded-[1rem] border border-white/20 bg-white/10 px-5 text-center shadow-paper">
                      <div>
                        <div className="memory-loading-spinner mx-auto mb-4 h-10 w-10 rounded-full border-4 border-paper/20 border-t-paper" />
                        <p className="text-sm font-black">
                          {isLoadingMemories ? 'Đang tải ảnh từ database...' : 'Slideshow đã bật, nhưng chưa có ảnh nào để chiếu.'}
                        </p>
                        <p className="mt-2 text-xs font-bold leading-5 opacity-60">
                          Ảnh sẽ tự hiện ở đây khi feed Ký ức tải xong hoặc khi lớp đăng ảnh mới.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <p className="mx-auto mt-4 max-w-[20rem] rounded-[1rem] bg-white/12 px-4 py-3 text-center text-xs font-bold leading-5 opacity-70">
                  Manager chọn mood, học sinh chỉ cần mở slideshow và xem ảnh tự chạy.
                </p>
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
          {smartFilters.map((filter) => (
            <button
              key={filter.id}
              className={`tag-button ${activeSmartFilter === filter.id ? 'tag-button-active' : ''}`}
              onClick={() => setActiveSmartFilter(filter.id)}
            >
              {filter.label} · {filter.count}
            </button>
          ))}
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
                isOwnerOnline={Boolean(memory.nameKey && onlineNameKeys.has(memory.nameKey))}
                pendingCommentReactionIds={pendingCommentReactionIds}
                onJoin={onJoin}
                onOpenImage={openMemoryPreview}
                onOpenProfile={onOpenProfile}
                onReact={onReact}
                onReactComment={onReactComment}
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
              {hasActiveFilter ? (
                <button className="secondary-button mx-auto mt-5" onClick={clearFilters}>
                  <X size={16} />
                  Xóa lọc
                </button>
              ) : profile ? (
                <button className="primary-button mx-auto mt-5" onClick={onPhotobook}>
                  <Upload size={17} />
                  Đăng kỷ niệm đầu tiên
                </button>
              ) : null}
            </div>
          </div>
        )}
      </section>

      {canShowMemoryTapGuide && (
        <div
          className="fixed inset-0 z-[92] grid place-items-center bg-ink/42 px-4 py-6 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Hướng dẫn xem ảnh"
        >
          <div className="w-full max-w-[27rem] rounded-[1.6rem] border border-white/75 bg-[#fffaf1] p-5 text-ink shadow-[0_24px_70px_rgba(18,15,13,0.32)] sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink text-paper shadow-sm">
                <Camera size={22} />
              </span>
              <div className="min-w-0">
                <p className="section-kicker mb-1">Mẹo xem ký ức</p>
                <h2 className="font-display text-5xl leading-none">Bấm vào ảnh để xem rõ hơn</h2>
              </div>
            </div>
            <div className="mt-4 grid gap-2 rounded-[1rem] bg-paper/74 p-3 text-sm font-bold leading-6 text-coffee">
              <p>1. Chạm vào một ảnh bất kỳ trong feed để mở popup xem rõ.</p>
              <p>2. Khi popup ảnh hiện lên, chạm vào ảnh thêm một lần nữa để zoom bằng tay.</p>
              <p className="text-xs text-ink/58">Hướng dẫn này chỉ hiện sau khi gợi ý dấu 3 gạch đã tắt và ảnh đã tải xong.</p>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button className="primary-button min-h-12 justify-center" onClick={openFirstGuidedMemory}>
                <Camera size={17} />
                Mở thử một ảnh
              </button>
              <button className="secondary-button min-h-12 justify-center" onClick={markMemoryGuideDone}>
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {isSlideshowOpen && activeSlide && (
        <div
          className="fixed inset-0 z-[96] grid place-items-center overflow-hidden bg-ink/96 p-3 text-paper sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Slideshow thanh xuân 9/8"
          onClick={() => setIsSlideshowOpen(false)}
        >
          <div
            className={`relative grid h-[calc(100svh-1.5rem)] w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[1.1rem] border shadow-[0_28px_90px_rgba(0,0,0,0.34)] sm:h-[min(88svh,760px)] sm:rounded-[1.4rem] ${slideshowMood.modalClass}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-paper/48">
                  {slideshowMood.label} · Slideshow 9/8
                </p>
                <strong className="block truncate text-sm text-paper">{activeSlide.name}</strong>
              </div>
              <button
                type="button"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-paper transition hover:bg-white/18"
                onClick={() => setIsSlideshowOpen(false)}
                aria-label="Đóng slideshow"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative grid min-h-0 place-items-center overflow-hidden bg-black">
              <img
                key={activeSlide.id}
                src={activeSlide.imageUrl}
                alt={`Ảnh slideshow của ${activeSlide.name}`}
                className="h-full max-h-full w-full object-contain"
                decoding="async"
                draggable={false}
              />

              {slideshowMemories.length > 1 && (
                <>
                  <button
                    type="button"
                    className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-paper/88 text-2xl font-black leading-none text-ink shadow-paper transition hover:bg-paper sm:left-4"
                    onClick={previousSlide}
                    aria-label="Ảnh trước"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-paper/88 text-2xl font-black leading-none text-ink shadow-paper transition hover:bg-paper sm:right-4"
                    onClick={nextSlide}
                    aria-label="Ảnh tiếp theo"
                  >
                    ›
                  </button>
                </>
              )}
            </div>

            <div className={`border-t px-4 py-3 sm:px-5 ${slideshowMood.modalFooterClass}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-bold leading-6 text-paper/82">
                    {activeSlide.caption || 'Một lát cắt nhỏ của thanh xuân lớp mình.'}
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase text-paper/42">
                    {slideIndex + 1}/{slideshowMemories.length} · Lớp {activeSlide.className}
                  </p>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/12 sm:w-44">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${slideshowMood.progressClass}`}
                    style={{ width: `${((slideIndex + 1) / slideshowMemories.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
              {showZoomTapGuide && (
                <div
                  className="absolute bottom-3 left-3 right-3 z-[4] rounded-[1.1rem] border border-white/18 bg-[#fffaf1] p-3 text-ink shadow-[0_18px_46px_rgba(18,15,13,0.28)] sm:left-auto sm:max-w-sm"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-paper">
                      <Search size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-black">Chạm ảnh thêm lần nữa để zoom</p>
                      <p className="mt-1 text-xs font-bold leading-5 text-coffee/72">
                        Trên điện thoại có thể kéo hai ngón tay. Trên máy tính có thể dùng con lăn chuột.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button className="primary-button min-h-10 justify-center px-3 text-xs" onClick={openImageZoomViewer}>
                      Zoom thử
                    </button>
                    <button className="secondary-button min-h-10 justify-center px-3 text-xs" onClick={markMemoryGuideDone}>
                      Đã hiểu
                    </button>
                  </div>
                </div>
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
              ref={zoomImageRef}
              src={selectedMemory.imageUrl}
              alt={`Ảnh kỷ niệm của ${selectedMemory.name}`}
              className="zoomable-memory-image max-h-[92svh] w-auto max-w-full object-contain"
              decoding="async"
              loading="eager"
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
