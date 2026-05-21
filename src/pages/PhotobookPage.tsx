import { m } from 'framer-motion';
import {
  ArrowLeft,
  Camera,
  CameraIcon,
  Check,
  Download,
  ImagePlus,
  Layers,
  Lock,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  Upload,
  UserRound,
  Users,
  Video,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties } from 'react';
import Webcam from 'react-webcam';
import {
  BACKGROUND_OPTIONS,
  LAYOUT_OPTIONS,
  PHOTOBOOK_MOOD_OPTIONS,
  PHOTO_COUNT_OPTIONS,
  QUALITY_OPTIONS,
} from '../data/backgrounds';
import { useMobilePerformanceMode } from '../hooks/useMobilePerformanceMode';
import type {
  BackgroundEdit,
  BackgroundOption,
  CapturedPhoto,
  ClassmateProfile,
  ExportQuality,
  GeneratedPhotobook,
  LayoutType,
  MemoryVisibility,
  PhotobookMoodId,
  PhotobookConfig,
  PhotoCount,
  PublishMemoryDraft,
  UserProfile,
} from '../types';
import { makeId } from '../utils/ids';
import {
  applyPhotoEditsToDataUrl,
  defaultPhotoEditSettings,
  getPhotoEditCssFilter,
  type PhotoEditSettings,
} from '../utils/photoEdit';
import { beautifyPhotoDataUrl } from '../utils/photoEnhance';
import { makeFeedThumbnailDataUrl, renderPhotobook } from '../utils/photobookCanvas';
import {
  formatVideoDuration,
  formatVideoSize,
  prepareShortVideo,
  type PreparedVideoDraft,
  type VideoPrepareProgress,
} from '../utils/videoPrepare';

interface PhotobookPageProps {
  profile: UserProfile | null;
  classmates: ClassmateProfile[];
  onJoinNeeded: () => void;
  onPublish: (draft: PublishMemoryDraft) => void | Promise<void>;
}

type BoothStage = 'setup' | 'camera' | 'final';
type CaptureSource = 'camera' | 'upload';
type PhotoPreviewMode = 'original' | 'enhanced';

type VideoDraft = PreparedVideoDraft;

const defaultBackgroundEdit: BackgroundEdit = {
  scale: 1,
  x: 0,
  y: 0,
  brightness: 100,
  blur: 0,
};

const defaultConfig: PhotobookConfig = {
  photoCount: 4,
  layout: 'vertical',
  quality: '1080p',
  backgroundId: 'pastel-dawn',
  moodId: 'classic-default',
};

const getVideoConstraints = (facingMode: 'user' | 'environment'): MediaTrackConstraints => ({
  width: { ideal: 2560, min: 1280 },
  height: { ideal: 1440, min: 720 },
  aspectRatio: { ideal: 16 / 9 },
  frameRate: { ideal: 30, max: 30 },
  facingMode,
});

const parseHashtags = (value: string) =>
  value
    .split(/[,\s]+/)
    .map((tag) => tag.replace(/^#/, '').trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 5);

const PHOTO_EDIT_CONTROLS: Array<{
  key: keyof PhotoEditSettings;
  label: string;
  min: number;
  max: number;
  step: number;
  suffix?: string;
}> = [
  { key: 'brightness', label: 'Sáng', min: 86, max: 118, step: 1, suffix: '%' },
  { key: 'contrast', label: 'Tương phản', min: 90, max: 116, step: 1, suffix: '%' },
  { key: 'saturation', label: 'Màu ảnh', min: 86, max: 126, step: 1, suffix: '%' },
  { key: 'warmth', label: 'Ấm màu', min: -24, max: 28, step: 1 },
  { key: 'vignette', label: 'Viền film', min: 0, max: 34, step: 1, suffix: '%' },
];

const loadImageFromSource = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

const compressUploadedBackground = async (file: File) => {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageFromSource(objectUrl);
    const maxEdge = 2160;
    const scale = Math.min(maxEdge / Math.max(image.width, image.height), 1);
    const width = Math.round(image.width * scale);
    const height = Math.round(image.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas is not supported in this browser.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#fffaf1';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.9);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const compressUploadedPhoto = async (file: File) => {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageFromSource(objectUrl);
    const maxEdge = 3200;
    const scale = Math.min(maxEdge / Math.max(image.width, image.height), 1);
    const width = Math.round(image.width * scale);
    const height = Math.round(image.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas is not supported in this browser.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#fffaf1';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.96);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const playShutterSound = () => {
  const AudioCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return;

  const context = new AudioCtor();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(880, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(180, context.currentTime + 0.09);
  gain.gain.setValueAtTime(0.045, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.1);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.11);
  window.setTimeout(() => void context.close(), 150);
};

interface OptionButtonProps<T extends string | number> {
  active: boolean;
  value: T;
  label: string;
  description?: string;
  preview?: React.ReactNode;
  onSelect: (value: T) => void;
}

function OptionButton<T extends string | number>({
  active,
  value,
  label,
  description,
  preview,
  onSelect,
}: OptionButtonProps<T>) {
  return (
    <button
      type="button"
      className={`option-card w-full min-w-0 text-left ${preview ? 'option-card-with-preview' : ''} ${
        active ? 'option-card-active' : ''
      }`}
      aria-pressed={active}
      onClick={() => onSelect(value)}
    >
      {preview}
      <span className="flex min-w-0 items-center justify-between gap-3">
        <span className="min-w-0 break-words font-bold">{label}</span>
        {active && <Check className="shrink-0" size={17} />}
      </span>
      {description && <span className="mt-1 block min-w-0 break-words text-xs leading-5 text-ink/56">{description}</span>}
    </button>
  );
}

export default function PhotobookPage({ profile, classmates, onJoinNeeded, onPublish }: PhotobookPageProps) {
  const webcamRef = useRef<Webcam>(null);
  const cameraStageRef = useRef<HTMLDivElement | null>(null);
  const photoUploadInputRef = useRef<HTMLInputElement | null>(null);
  const videoUploadInputRef = useRef<HTMLInputElement | null>(null);
  const countdownFrame = useRef<number | null>(null);
  const [stage, setStage] = useState<BoothStage>('setup');
  const [captureSource, setCaptureSource] = useState<CaptureSource>('camera');
  const [config, setConfig] = useState<PhotobookConfig>(defaultConfig);
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [pendingOriginalPhoto, setPendingOriginalPhoto] = useState<string | null>(null);
  const [pendingEnhancedPhoto, setPendingEnhancedPhoto] = useState<string | null>(null);
  const [photoPreviewMode, setPhotoPreviewMode] = useState<PhotoPreviewMode>('enhanced');
  const [photoEditSettings, setPhotoEditSettings] = useState<PhotoEditSettings>(defaultPhotoEditSettings);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('graduation youth photobooth');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isApplyingPhotoEdits, setIsApplyingPhotoEdits] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [generated, setGenerated] = useState<GeneratedPhotobook | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [memoryVisibility, setMemoryVisibility] = useState<MemoryVisibility>('public');
  const [selectedViewerKeys, setSelectedViewerKeys] = useState<string[]>([]);
  const [videoDraft, setVideoDraft] = useState<VideoDraft | null>(null);
  const [videoCaption, setVideoCaption] = useState('');
  const [videoHashtags, setVideoHashtags] = useState('graduation youth video');
  const [videoError, setVideoError] = useState('');
  const [isVideoPreparing, setIsVideoPreparing] = useState(false);
  const [isVideoPublishing, setIsVideoPublishing] = useState(false);
  const [videoPrepareProgress, setVideoPrepareProgress] = useState<VideoPrepareProgress | null>(null);
  const mobilePerformanceMode = useMobilePerformanceMode();

  const selectedBackground = useMemo<BackgroundOption>(
    () => BACKGROUND_OPTIONS.find((background) => background.id === config.backgroundId) || BACKGROUND_OPTIONS[0],
    [config.backgroundId],
  );
  const selectedMood = useMemo(
    () => PHOTOBOOK_MOOD_OPTIONS.find((mood) => mood.id === (config.moodId || 'classic-default')) || PHOTOBOOK_MOOD_OPTIONS[0],
    [config.moodId],
  );

  const isPhotoBusy = isEnhancing || isApplyingPhotoEdits;
  const selectableClassmates = useMemo(
    () => classmates.filter((person) => person.uid && person.nameKey && person.uid !== profile?.uid),
    [classmates, profile?.uid],
  );
  const selectedViewers = useMemo(
    () => selectableClassmates.filter((person) => selectedViewerKeys.includes(person.nameKey)),
    [selectableClassmates, selectedViewerKeys],
  );
  const privacyPayload = useMemo(
    () => ({
      visibility: memoryVisibility,
      visibleToUids: memoryVisibility === 'tagged' ? selectedViewers.map((person) => person.uid).filter(Boolean) : [],
      visibleToNameKeys: memoryVisibility === 'tagged' ? selectedViewers.map((person) => person.nameKey).filter(Boolean) : [],
      visibleToNames: memoryVisibility === 'tagged' ? selectedViewers.map((person) => person.name).filter(Boolean) : [],
    }),
    [memoryVisibility, selectedViewers],
  );
  const canPublishWithPrivacy = memoryVisibility !== 'tagged' || selectedViewers.length > 0;
  const currentIndex = capturedPhotos.length + (pendingPhoto ? 1 : 0);
  const canCapture = stage === 'camera' && captureSource === 'camera' && !pendingPhoto && countdown === null && !isPhotoBusy;
  const canUploadPhoto =
    stage === 'camera' && !pendingPhoto && countdown === null && !isPhotoBusy && capturedPhotos.length < config.photoCount;
  const videoConstraints = useMemo(() => getVideoConstraints(facingMode), [facingMode]);
  const photoEditPreviewStyle = useMemo<CSSProperties>(
    () => ({
      filter: getPhotoEditCssFilter(photoEditSettings),
      transform: 'translateZ(0)',
    }),
    [photoEditSettings],
  );
  const photoTemperatureStyle = useMemo<CSSProperties>(
    () => ({
      background: photoEditSettings.warmth >= 0 ? '#ffd29c' : '#9cc6ff',
      mixBlendMode: 'soft-light',
      opacity: Math.min(Math.abs(photoEditSettings.warmth) / 28, 1) * 0.34,
    }),
    [photoEditSettings.warmth],
  );
  const photoVignetteStyle = useMemo<CSSProperties>(
    () => ({ opacity: Math.min(photoEditSettings.vignette / 34, 1) * 0.72 }),
    [photoEditSettings.vignette],
  );

  function clearPendingPhoto() {
    setPendingPhoto(null);
    setPendingOriginalPhoto(null);
    setPendingEnhancedPhoto(null);
    setPhotoPreviewMode('enhanced');
    setPhotoEditSettings(defaultPhotoEditSettings);
  }

  const showPendingPhoto = (mode: PhotoPreviewMode) => {
    const source = mode === 'original' ? pendingOriginalPhoto : pendingEnhancedPhoto;
    if (!source) return;

    setPhotoPreviewMode(mode);
    setPendingPhoto(source);
  };

  const updateConfig = <K extends keyof PhotobookConfig>(key: K, value: PhotobookConfig[K]) => {
    setConfig((current) => ({ ...current, [key]: value }));
  };

  const updatePhotoEditSetting = <K extends keyof PhotoEditSettings>(key: K, value: PhotoEditSettings[K]) => {
    setPhotoEditSettings((current) => ({ ...current, [key]: value }));
  };

  const resetPhotoEdits = () => {
    setPhotoEditSettings(defaultPhotoEditSettings);
  };

  const updatePhotoCount = (value: PhotoCount) => {
    setConfig((current) => ({ ...current, photoCount: value }));
    setCapturedPhotos((current) => current.slice(0, value));
    clearPendingPhoto();
    setGenerated(null);
  };

  const updateBackgroundEdit = <K extends keyof BackgroundEdit>(key: K, value: BackgroundEdit[K]) => {
    setConfig((current) => ({
      ...current,
      customBackgroundEdit: {
        ...defaultBackgroundEdit,
        ...current.customBackgroundEdit,
        [key]: value,
      },
    }));
    setGenerated(null);
  };

  const resetSession = () => {
    setCapturedPhotos([]);
    clearPendingPhoto();
    setGenerated(null);
    setStage('setup');
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      setObjectUrl(null);
    }
  };

  const toggleSelectedViewer = (nameKey: string) => {
    setSelectedViewerKeys((current) => {
      if (current.includes(nameKey)) return current.filter((key) => key !== nameKey);
      return [...current, nameKey].slice(0, 12);
    });
  };

  const openCameraStage = async () => {
    setCaptureSource('camera');
    setStage('camera');
    window.setTimeout(() => {
      const element = cameraStageRef.current;
      if (element?.requestFullscreen) {
        void element.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
      }
    }, 80);
  };

  const openUploadStage = () => {
    setCaptureSource('upload');
    setStage('camera');
    window.setTimeout(() => photoUploadInputRef.current?.click(), 120);
  };

  const handleUploadVideo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      setVideoError('');
      setVideoDraft(null);
      setIsVideoPreparing(true);
      setVideoPrepareProgress({ label: 'Đang đọc video', percent: 8, detail: 'Chuẩn bị kiểm tra file.' });
      const prepared = await prepareShortVideo(file, {
        mobile: mobilePerformanceMode,
        onProgress: setVideoPrepareProgress,
      });
      setVideoDraft(prepared);
    } catch (caught) {
      setVideoError(caught instanceof Error ? caught.message : 'Không thể xử lý video này. Hãy thử MP4/WebM ngắn hơn hoặc nhẹ hơn.');
    } finally {
      setIsVideoPreparing(false);
      window.setTimeout(() => setVideoPrepareProgress(null), 900);
    }
  };

  const leaveCameraStage = () => {
    if (isPhotoBusy) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
    setStage('setup');
  };

  const flipCamera = () => {
    if (isPhotoBusy) return;
    setCameraError(null);
    clearPendingPhoto();
    setCountdown(null);
    setFacingMode((current) => (current === 'user' ? 'environment' : 'user'));
  };

  const returnToCameraSource = () => {
    if (isPhotoBusy || pendingPhoto) return;

    setCameraError(null);
    setCountdown(null);
    setCaptureSource('camera');
  };

  const togglePreviewMode = () => {
    if (!pendingOriginalPhoto || !pendingEnhancedPhoto) return;
    showPendingPhoto(photoPreviewMode === 'enhanced' ? 'original' : 'enhanced');
  };

  const captureNow = useCallback(async () => {
    setCountdown(null);
    const screenshot = webcamRef.current?.getScreenshot();
    if (!screenshot) {
      setCameraError('The camera could not capture a frame. Check browser permissions and try again.');
      return;
    }

    playShutterSound();
    setFlash(true);
    window.setTimeout(() => setFlash(false), 170);
    setIsEnhancing(true);

    try {
      const enhanced = await beautifyPhotoDataUrl(screenshot);
      setPendingOriginalPhoto(screenshot);
      setPendingEnhancedPhoto(enhanced);
      setPhotoPreviewMode('enhanced');
      setPhotoEditSettings(defaultPhotoEditSettings);
      setPendingPhoto(enhanced);
      setCameraError(null);
    } catch {
      setPendingOriginalPhoto(screenshot);
      setPendingEnhancedPhoto(null);
      setPhotoPreviewMode('original');
      setPhotoEditSettings(defaultPhotoEditSettings);
      setPendingPhoto(screenshot);
      setCameraError('Không thể làm đẹp ảnh tự động, app đã giữ ảnh gốc để bạn tiếp tục.');
    } finally {
      setIsEnhancing(false);
    }
  }, []);

  const startCountdown = () => {
    if (!canCapture) return;

    const duration = 10_000;
    const start = performance.now();
    setCountdown(10);

    const tick = (now: number) => {
      const remaining = Math.ceil((duration - (now - start)) / 1000);
      if (remaining <= 0) {
        setCountdown(0);
        countdownFrame.current = null;
        window.setTimeout(captureNow, 80);
        return;
      }

      setCountdown(remaining);
      countdownFrame.current = window.requestAnimationFrame(tick);
    };

    countdownFrame.current = window.requestAnimationFrame(tick);
  };

  const acceptPhoto = async () => {
    if (!pendingPhoto || isPhotoBusy) return;

    setIsApplyingPhotoEdits(true);
    let finalPhoto = pendingPhoto;

    try {
      finalPhoto = await applyPhotoEditsToDataUrl(pendingPhoto, photoEditSettings);
    } catch {
      setCameraError('Không thể lưu phần chỉnh sửa, app sẽ giữ bản ảnh đang xem để bạn tiếp tục.');
    } finally {
      setIsApplyingPhotoEdits(false);
    }

    const nextPhotos = [...capturedPhotos, { id: makeId('photo'), dataUrl: finalPhoto }];
    setCapturedPhotos(nextPhotos);
    clearPendingPhoto();

    if (nextPhotos.length >= config.photoCount) {
      setStage('final');
    }
  };

  const handleUploadBackground = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const compressed = await compressUploadedBackground(file);
    setConfig((current) => ({
      ...current,
      backgroundId: 'custom-upload',
      customBackground: compressed,
      customBackgroundEdit: defaultBackgroundEdit,
    }));
    event.target.value = '';
  };

  const handleUploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || isPhotoBusy || capturedPhotos.length >= config.photoCount) {
      event.target.value = '';
      return;
    }

    let uploaded = '';
    try {
      setCameraError(null);
      setCaptureSource('upload');
      setStage('camera');
      setIsEnhancing(true);
      uploaded = await compressUploadedPhoto(file);
      const enhanced = await beautifyPhotoDataUrl(uploaded);
      setPendingOriginalPhoto(uploaded);
      setPendingEnhancedPhoto(enhanced);
      setPhotoPreviewMode('enhanced');
      setPhotoEditSettings(defaultPhotoEditSettings);
      setPendingPhoto(enhanced);
      window.setTimeout(() => setFlash(true), 20);
      window.setTimeout(() => setFlash(false), 190);
    } catch {
      if (uploaded) {
        setPendingOriginalPhoto(uploaded);
        setPendingEnhancedPhoto(null);
        setPhotoPreviewMode('original');
        setPhotoEditSettings(defaultPhotoEditSettings);
        setPendingPhoto(uploaded);
        setCameraError('Không thể làm đẹp ảnh tự động, app đã giữ ảnh gốc để bạn tiếp tục.');
      } else {
        setCameraError('Không thể tải ảnh này. Hãy thử ảnh JPG/PNG khác.');
      }
    } finally {
      setIsEnhancing(false);
      event.target.value = '';
    }
  };

  const handlePublishVideo = async () => {
    if (!profile || !videoDraft) return;
    if (!canPublishWithPrivacy) {
      setVideoError('Hãy chọn ít nhất một bạn được xem video này.');
      return;
    }

    try {
      setIsVideoPublishing(true);
      setVideoError('');
      await onPublish({
        mediaType: 'video',
        imageDataUrl: videoDraft.thumbnailDataUrl,
        videoDataUrl: videoDraft.dataUrl,
        videoMimeType: videoDraft.mimeType,
        videoSize: videoDraft.size,
        videoDuration: videoDraft.duration,
        caption: videoCaption.trim() || 'Một video ngắn từ những ngày tụi mình còn chung lớp.',
        hashtags: parseHashtags(videoHashtags),
        ...privacyPayload,
      });
    } catch (caught) {
      setVideoError(caught instanceof Error ? caught.message : 'Không thể đăng video lúc này.');
    } finally {
      setIsVideoPublishing(false);
    }
  };

  const handleGenerate = async () => {
    if (!profile || capturedPhotos.length < config.photoCount) return;
    setIsGenerating(true);
    try {
      const result = await renderPhotobook({
        photos: capturedPhotos,
        config,
        background: selectedBackground,
        profile,
        caption: caption.trim() || undefined,
      });
      const nextObjectUrl = URL.createObjectURL(result.blob);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setObjectUrl(nextObjectUrl);
      setGenerated(result);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!profile || !generated || !objectUrl) return;
    if (!canPublishWithPrivacy) {
      setPublishError('Hãy chọn ít nhất một bạn được xem kỷ niệm này.');
      return;
    }

    try {
      setIsPublishing(true);
      setPublishError('');
      const thumbnail = await makeFeedThumbnailDataUrl(objectUrl, 1300);
      await onPublish({
        imageDataUrl: thumbnail,
        caption: caption.trim() || 'Một strip photobook mới từ những ngày tụi mình sẽ giữ mãi.',
        hashtags: parseHashtags(hashtags),
        ...privacyPayload,
      });
    } catch (caught) {
      setPublishError(caught instanceof Error ? caught.message : 'Không thể đăng photobook lúc này.');
    } finally {
      setIsPublishing(false);
    }
  };

  useEffect(() => {
    return () => {
      if (countdownFrame.current) window.cancelAnimationFrame(countdownFrame.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  useEffect(() => {
    document.body.classList.toggle('camera-open', stage === 'camera');
    return () => document.body.classList.remove('camera-open');
  }, [stage]);

  if (!profile) {
    return (
      <section className="grid min-h-[calc(100svh-4rem)] place-items-center px-4 py-12">
        <div className="max-w-xl rounded-[2rem] bg-white/55 p-6 text-center shadow-paper backdrop-blur-xl sm:p-8">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-ink text-paper">
            <Camera size={28} />
          </div>
          <h1 className="font-display text-6xl leading-none">Join first</h1>
          <p className="mt-3 text-sm leading-7 text-ink/66">
            The photobook prints your name and class on the final strip, so check in before opening the camera.
          </p>
          <button className="primary-button mx-auto mt-6" onClick={onJoinNeeded}>
            Join Memory Book
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="relative min-h-[calc(100svh-4rem)] overflow-hidden px-3 py-5 sm:px-6 sm:py-6 lg:px-8">
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(247,183,199,.26),transparent_34%),linear-gradient(245deg,rgba(169,205,232,.24),transparent_40%),linear-gradient(135deg,#fbf3e7,#fffaf1)]" />
      <div className="relative mx-auto max-w-7xl">
        <input
          ref={photoUploadInputRef}
          className="sr-only"
          type="file"
          accept="image/*"
          onChange={handleUploadPhoto}
        />
        <input
          ref={videoUploadInputRef}
          className="sr-only"
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/*"
          onChange={handleUploadVideo}
        />

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="section-kicker">Korean Photobooth</p>
            <h1 className="font-display text-4xl leading-none sm:text-7xl">Tạo strip kỷ niệm</h1>
          </div>
          <button className="secondary-button photobook-reset-button" onClick={resetSession}>
            <RefreshCw size={16} />
            Làm lại
          </button>
        </div>

        {stage === 'setup' && (
          <div className="grid gap-5 lg:grid-cols-[1fr_0.78fr]">
            <div className="photobook-setup-panel rounded-[1.35rem] border border-white/65 bg-white/52 p-3 shadow-paper backdrop-blur-xl sm:rounded-[2rem] sm:p-6">
              <div className="grid gap-5">
                <SetupGroup step="1" title="Chọn số ảnh">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {PHOTO_COUNT_OPTIONS.map((count) => (
                      <OptionButton<PhotoCount>
                        key={count}
                        active={config.photoCount === count}
                        value={count}
                        label={`${count}`}
                        description="ảnh"
                        onSelect={updatePhotoCount}
                      />
                    ))}
                  </div>
                </SetupGroup>

                <SetupGroup step="2" title="Chọn kiểu chụp">
                  <div className="layout-options-grid">
                    {LAYOUT_OPTIONS.map((layout) => (
                      <OptionButton<LayoutType>
                        key={layout.id}
                        active={config.layout === layout.id}
                        value={layout.id}
                        label={layout.label}
                        description={layout.description}
                        preview={<LayoutPreview layout={layout.id} count={config.photoCount} />}
                        onSelect={(value) => updateConfig('layout', value)}
                      />
                    ))}
                  </div>
                </SetupGroup>

                <SetupGroup step="3" title="Chọn chất lượng ảnh">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {QUALITY_OPTIONS.map((quality) => (
                      <OptionButton<ExportQuality>
                        key={quality.id}
                        active={config.quality === quality.id}
                        value={quality.id}
                        label={quality.label}
                        description={quality.description}
                        onSelect={(value) => updateConfig('quality', value)}
                      />
                    ))}
                  </div>
                </SetupGroup>

                <SetupGroup step="4" title="Chọn mood photobook">
                  <div className="photobook-mood-grid">
                    {PHOTOBOOK_MOOD_OPTIONS.map((mood) => (
                      <OptionButton<PhotobookMoodId>
                        key={mood.id}
                        active={(config.moodId || 'classic-default') === mood.id}
                        value={mood.id}
                        label={mood.label}
                        description={mood.description}
                        preview={<MoodPreview moodId={mood.id} swatch={mood.swatch} label={mood.shortLabel} />}
                        onSelect={(value) => updateConfig('moodId', value)}
                      />
                    ))}
                  </div>
                </SetupGroup>

                <SetupGroup step="5" title="Chọn nền">
                  <div className="grid gap-3 sm:grid-cols-4">
                    {BACKGROUND_OPTIONS.map((background) => (
                      <button
                        type="button"
                        key={background.id}
                        className={`option-card w-full min-w-0 text-left ${config.backgroundId === background.id ? 'option-card-active' : ''}`}
                        onClick={() => updateConfig('backgroundId', background.id)}
                      >
                        <span className="mb-3 block h-12 rounded-xl border border-white/60" style={{ background: background.swatch }} />
                        <span className="block min-w-0 break-words font-bold">{background.label}</span>
                        <span className="mt-1 block min-w-0 break-words text-xs leading-5 text-ink/56">{background.description}</span>
                      </button>
                    ))}
                  </div>
                  <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-bold text-paper shadow-paper transition hover:-translate-y-0.5">
                    <Upload size={17} />
                    Tải nền riêng
                    <input className="sr-only" type="file" accept="image/*" onChange={handleUploadBackground} />
                  </label>
                  {config.customBackground && (
                    <CustomBackgroundEditor
                      image={config.customBackground}
                      edit={{ ...defaultBackgroundEdit, ...config.customBackgroundEdit }}
                      onChange={updateBackgroundEdit}
                      onReset={() => {
                        setConfig((current) => ({ ...current, customBackgroundEdit: defaultBackgroundEdit }));
                        setGenerated(null);
                      }}
                    />
                  )}
                </SetupGroup>
              </div>
            </div>

            <aside className="rounded-[1.35rem] border border-white/65 bg-white/45 p-3 shadow-paper backdrop-blur-xl sm:rounded-[2rem] sm:p-6">
              <div className="camera-preview-card">
                <div className="grid h-full place-items-center rounded-[1.25rem] bg-[linear-gradient(135deg,#fffaf1,#f7b7c7_52%,#a9cde8)] p-6 text-center">
                  <Layers className="mx-auto mb-4 text-coffee" size={36} />
                  <h2 className="font-display text-4xl leading-none sm:text-5xl">Sẵn sàng cho {config.photoCount} tấm</h2>
                  <p className="mt-3 text-sm leading-6 text-ink/64">
                    {selectedMood.label} · {selectedBackground.description}. Xuất ảnh ở mức{' '}
                    {QUALITY_OPTIONS.find((q) => q.id === config.quality)?.label}.
                  </p>
                </div>
              </div>
              <button
                className="primary-button mt-5 min-h-14 w-full justify-center text-base"
                onClick={openCameraStage}
              >
                <Camera size={19} />
                Mở camera
              </button>
              <button
                className="secondary-button mt-3 min-h-14 w-full justify-center text-base"
                onClick={openUploadStage}
              >
                <Upload size={19} />
                Upload ảnh có sẵn
              </button>

              <div className="mt-4 rounded-[1rem] border border-coffee/10 bg-paper/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.74)]">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-paper">
                    <Video size={18} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-ink">Đăng video ngắn</h3>
                    <p className="mt-1 text-xs leading-5 text-ink/58">
                      Video tối đa 20 giây. App sẽ tự tạo ảnh bìa và nén video khi cần để feed vẫn tải mượt.
                    </p>
                  </div>
                </div>

                <button
                  className="secondary-button mt-3 min-h-11 w-full justify-center text-sm"
                  onClick={() => videoUploadInputRef.current?.click()}
                  disabled={isVideoPreparing || isVideoPublishing}
                >
                  <Video size={17} />
                  {isVideoPreparing ? 'Đang xử lý video...' : videoDraft ? 'Đổi video' : 'Chọn video'}
                </button>

                {isVideoPreparing && videoPrepareProgress && (
                  <div className="mt-3 rounded-xl bg-white/72 p-3 shadow-[inset_0_0_0_1px_rgba(122,86,57,0.08)]">
                    <div className="flex items-center justify-between gap-3 text-xs font-black uppercase text-coffee/70">
                      <span>{videoPrepareProgress.label}</span>
                      <span>{Math.round(videoPrepareProgress.percent)}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-coffee/10">
                      <div
                        className="h-full rounded-full bg-coffee transition-[width] duration-300 ease-out"
                        style={{ width: `${Math.max(8, Math.min(100, videoPrepareProgress.percent))}%` }}
                      />
                    </div>
                    {videoPrepareProgress.detail && (
                      <p className="mt-2 text-xs leading-5 text-ink/58">{videoPrepareProgress.detail}</p>
                    )}
                  </div>
                )}

                {videoDraft && (
                  <div className="mt-3 grid gap-3">
                    <div className="relative overflow-hidden rounded-[0.8rem] bg-ink">
                      <img
                        src={videoDraft.thumbnailDataUrl}
                        alt="Ảnh bìa video"
                        className="aspect-video w-full object-cover opacity-95"
                        loading="lazy"
                        decoding="async"
                      />
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-ink/78 px-2.5 py-1 text-[11px] font-black text-paper">
                        <Video size={12} />
                        {formatVideoDuration(videoDraft.duration)} · {formatVideoSize(videoDraft.size)}
                      </span>
                    </div>

                    <div className="grid gap-2 rounded-xl bg-white/70 p-3 text-xs leading-5 text-ink/62 shadow-[inset_0_0_0_1px_rgba(122,86,57,0.08)]">
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-ink">Dung lượng</strong>
                        <span>
                          {formatVideoSize(videoDraft.size)}
                          {videoDraft.compressed ? ` từ ${formatVideoSize(videoDraft.originalSize)}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-ink">Trạng thái</strong>
                        <span>{videoDraft.compressed ? 'Đã nén để tải mượt' : 'Đủ nhẹ, giữ chất lượng gốc'}</span>
                      </div>
                    </div>

                    <label className="block">
                      <span className="mb-1.5 block text-xs font-bold uppercase text-coffee/70">Caption video</span>
                      <textarea
                        className="input-field min-h-20 resize-none text-sm"
                        value={videoCaption}
                        onChange={(event) => setVideoCaption(event.target.value.slice(0, 180))}
                        placeholder="Một khoảnh khắc ngắn mà mình muốn giữ lại..."
                        maxLength={180}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-xs font-bold uppercase text-coffee/70">Hashtag</span>
                      <input
                        className="input-field text-sm"
                        value={videoHashtags}
                        onChange={(event) => setVideoHashtags(event.target.value)}
                        placeholder="graduation youth video"
                      />
                    </label>

                    <PrivacySelector
                      compact
                      visibility={memoryVisibility}
                      onVisibilityChange={setMemoryVisibility}
                      classmates={selectableClassmates}
                      selectedKeys={selectedViewerKeys}
                      selectedCount={selectedViewers.length}
                      onToggleViewer={toggleSelectedViewer}
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        className="secondary-button min-h-11 justify-center px-3 text-xs"
                        onClick={() => {
                          setVideoDraft(null);
                          setVideoError('');
                        }}
                        disabled={isVideoPublishing}
                      >
                        <RefreshCw size={15} />
                        Xóa video
                      </button>
                      <button
                        className="primary-button min-h-11 justify-center px-3 text-xs"
                        onClick={handlePublishVideo}
                        disabled={isVideoPublishing || isVideoPreparing || !canPublishWithPrivacy}
                      >
                        <Send size={15} />
                        {isVideoPublishing ? 'Đang đăng...' : 'Đăng video'}
                      </button>
                    </div>
                  </div>
                )}

                {videoError && (
                  <p className="mt-3 rounded-xl bg-blush/30 px-3 py-2 text-xs font-bold text-coffee">{videoError}</p>
                )}
              </div>
            </aside>
          </div>
        )}

        {stage === 'camera' && (
          <div ref={cameraStageRef} className={`camera-stage ${pendingPhoto ? 'camera-stage-review' : ''}`}>
            <div className="camera-shell">
              <div className="relative mx-auto w-full max-w-6xl">
                <div className="camera-topbar">
                  <button className="camera-action-button" onClick={leaveCameraStage} disabled={isPhotoBusy} aria-label="Back to setup">
                    <ArrowLeft size={19} />
                  </button>
                  <div className="camera-status-pill">
                    <span className="camera-status-label">
                      {pendingPhoto ? 'Duyệt ảnh' : captureSource === 'camera' ? 'Camera' : 'Upload'}
                    </span>
                    <span>{Math.min(currentIndex + (pendingPhoto ? 0 : 1), config.photoCount)} / {config.photoCount}</span>
                  </div>
                  {captureSource === 'upload' && !pendingPhoto ? (
                    <button
                      className="camera-action-button"
                      onClick={returnToCameraSource}
                      disabled={isPhotoBusy}
                      aria-label="Mở camera"
                    >
                      <CameraIcon size={18} />
                    </button>
                  ) : (
                    <span className="camera-action-spacer" aria-hidden="true" />
                  )}
                </div>

                <div className="camera-frame">
                  {pendingPhoto ? (
                    <>
                      <img
                        src={pendingPhoto}
                        alt="Captured preview"
                        className="h-full w-full object-cover"
                        style={photoEditPreviewStyle}
                      />
                      {photoEditSettings.warmth !== 0 && (
                        <div className="photo-edit-temperature" style={photoTemperatureStyle} />
                      )}
                      {photoEditSettings.vignette > 0 && (
                        <div className="photo-edit-vignette" style={photoVignetteStyle} />
                      )}
                    </>
                  ) : captureSource === 'upload' ? (
                    <div className="grid h-full place-items-center bg-[linear-gradient(135deg,#1a1512,#35291f)] p-6 text-center text-paper">
                      <div className="max-w-sm">
                        <Upload className="mx-auto mb-4 text-paper/80" size={42} />
                        <h2 className="font-display text-5xl leading-none">Upload photo</h2>
                        <p className="mt-3 text-sm leading-6 text-paper/68">
                          Chọn ảnh từ máy của bạn, sau đó bấm dấu tick để đưa vào photobook.
                        </p>
                        <button
                          className="camera-secondary-button mx-auto mt-5"
                          onClick={() => photoUploadInputRef.current?.click()}
                          disabled={!canUploadPhoto}
                        >
                          <Upload size={18} />
                          Chọn ảnh
                        </button>
                      </div>
                    </div>
                  ) : (
                    <Webcam
                      key={facingMode}
                      ref={webcamRef}
                      audio={false}
                      mirrored={facingMode === 'user'}
                      screenshotFormat="image/jpeg"
                      screenshotQuality={1}
                      forceScreenshotSourceSize
                      videoConstraints={videoConstraints}
                      onUserMediaError={() =>
                        setCameraError('Camera permission was blocked or no camera was found on this device.')
                      }
                      className="h-full w-full object-cover"
                    />
                  )}

                  {flash && <div className="absolute inset-0 animate-camera-flash bg-white" />}
                  {countdown !== null && (
                    <m.div
                      key={countdown}
                      initial={mobilePerformanceMode ? false : { scale: 0.82, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: mobilePerformanceMode ? 0 : 0.18, ease: 'easeOut' }}
                      className="absolute inset-0 grid place-items-center bg-ink/20 text-paper backdrop-blur-[1px]"
                    >
                      <span className="font-display text-8xl leading-none sm:text-[12rem] lg:text-[16rem]">{countdown}</span>
                    </m.div>
                  )}
                  {isPhotoBusy && (
                    <m.div
                      initial={mobilePerformanceMode ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: mobilePerformanceMode ? 0 : 0.16, ease: 'easeOut' }}
                      className="absolute inset-0 grid place-items-center bg-ink/48 text-center text-paper backdrop-blur-[2px]"
                    >
                      <div className="rounded-[1rem] bg-ink/58 px-5 py-4 shadow-paper">
                        <Sparkles className="mx-auto mb-2 text-blush" size={30} />
                        <p className="font-display text-4xl leading-none">
                          {isApplyingPhotoEdits ? 'Đang lưu chỉnh sửa...' : 'Đang làm đẹp ảnh...'}
                        </p>
                        <p className="mt-2 text-xs font-semibold text-paper/68">
                          {isApplyingPhotoEdits
                            ? 'Đang xuất ảnh sắc nét để đưa vào photobook.'
                            : 'Làm mịn nhẹ, giữ ảnh tự nhiên và sắc nét.'}
                        </p>
                      </div>
                    </m.div>
                  )}
                </div>

                <div className={`camera-controls-near ${pendingPhoto ? 'camera-controls-review' : ''}`}>
                  {pendingPhoto ? (
                    <>
                      <button className="camera-secondary-button camera-control-side" onClick={clearPendingPhoto} disabled={isPhotoBusy}>
                        <RefreshCw size={18} />
                        <span className="camera-button-label">Đổi ảnh</span>
                      </button>
                      <button
                        className="camera-shutter-button camera-accept-button"
                        onClick={acceptPhoto}
                        disabled={isPhotoBusy}
                        aria-label="Nhận ảnh này"
                      >
                        <Check size={28} />
                      </button>
                      <button
                        className="camera-secondary-button camera-control-side"
                        onClick={togglePreviewMode}
                        disabled={isPhotoBusy || !pendingOriginalPhoto || !pendingEnhancedPhoto}
                      >
                        <Sparkles size={18} />
                        <span className="camera-button-label">{photoPreviewMode === 'enhanced' ? 'Ảnh gốc' : 'Làm đẹp'}</span>
                      </button>
                    </>
                  ) : (
                    <>
                      {captureSource === 'camera' ? (
                        <>
                          <span className="camera-control-spacer" aria-hidden="true" />
                          <button className="camera-shutter-button" onClick={startCountdown} disabled={!canCapture} aria-label="Chụp ảnh">
                            <CameraIcon size={30} />
                          </button>
                          <button className="camera-secondary-button camera-control-side" onClick={flipCamera} disabled={isPhotoBusy}>
                            <RotateCcw size={18} />
                            <span className="camera-button-label">Xoay cam</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="camera-secondary-button camera-control-side"
                            onClick={returnToCameraSource}
                            disabled={isPhotoBusy}
                          >
                            <CameraIcon size={18} />
                            <span className="camera-button-label">Camera</span>
                          </button>
                          <button
                            className="camera-shutter-button"
                            onClick={() => photoUploadInputRef.current?.click()}
                            disabled={!canUploadPhoto}
                            aria-label="Chọn ảnh upload"
                          >
                            <Upload size={30} />
                          </button>
                          <span className="camera-control-spacer" aria-hidden="true" />
                        </>
                      )}
                    </>
                  )}
                </div>

                {cameraError && (
                  <p className="mt-3 rounded-2xl bg-blush/35 px-4 py-3 text-sm font-semibold text-coffee">
                    {cameraError}
                  </p>
                )}
              </div>
              {pendingPhoto && (
                <PhotoEditPanel
                  mode={photoPreviewMode}
                  canUseEnhanced={Boolean(pendingEnhancedPhoto)}
                  settings={photoEditSettings}
                  onModeChange={showPendingPhoto}
                  onSettingChange={updatePhotoEditSetting}
                  onReset={resetPhotoEdits}
                />
              )}
            </div>

            <aside className="camera-side-panel">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase text-coffee/65">Capture</p>
                  <h2 className="font-display text-4xl leading-none">
                    {Math.min(currentIndex + (pendingPhoto ? 0 : 1), config.photoCount)} / {config.photoCount}
                  </h2>
                </div>
                <Sparkles className="text-roseDust" />
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                {Array.from({ length: config.photoCount }).map((_, index) => (
                  <div
                    key={index}
                    className={`aspect-square rounded-xl border ${
                      index < capturedPhotos.length
                        ? 'border-chalk bg-chalk/20'
                        : index === capturedPhotos.length
                          ? 'border-blush bg-blush/25'
                          : 'border-coffee/15 bg-paper/70'
                    }`}
                  />
                ))}
              </div>

              <div className="mt-5 grid gap-3">
                {pendingPhoto ? (
                  <>
                    <button className="primary-button justify-center" onClick={acceptPhoto} disabled={isPhotoBusy}>
                      <Check size={17} />
                      Nhận ảnh
                    </button>
                    <button className="secondary-button justify-center" onClick={clearPendingPhoto} disabled={isPhotoBusy}>
                      <RefreshCw size={17} />
                      Đổi ảnh
                    </button>
                  </>
                ) : captureSource === 'camera' ? (
                  <button className="primary-button min-h-14 justify-center" onClick={startCountdown} disabled={!canCapture}>
                    <Camera size={19} />
                    Start 10s Countdown
                  </button>
                ) : (
                  <button
                    className="primary-button min-h-14 justify-center"
                    onClick={() => photoUploadInputRef.current?.click()}
                    disabled={!canUploadPhoto}
                  >
                    <Upload size={19} />
                    Upload Photo
                  </button>
                )}
                {captureSource === 'upload' && (
                  <button className="secondary-button justify-center" onClick={returnToCameraSource} disabled={isPhotoBusy}>
                    <Camera size={16} />
                    Dùng camera
                  </button>
                )}
                <button className="secondary-button justify-center" onClick={leaveCameraStage}>
                  <ArrowLeft size={16} />
                  Back to setup
                </button>
              </div>
            </aside>
          </div>
        )}

        {stage === 'final' && (
          <div className="grid gap-5 lg:grid-cols-[0.86fr_1.14fr]">
            <div className="rounded-[2rem] border border-white/65 bg-white/52 p-4 shadow-paper backdrop-blur-xl sm:p-6">
              <p className="section-kicker">Final Photobook</p>
              <h2 className="font-display text-5xl leading-none">Add the last note</h2>

              <label className="mt-5 block">
                <span className="mb-2 block text-sm font-bold">Caption</span>
                <textarea
                  className="input-field min-h-28 resize-none"
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  placeholder="One line your future self will want to remember..."
                  maxLength={180}
                />
              </label>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-bold">Hashtags</span>
                <input
                  className="input-field"
                  value={hashtags}
                  onChange={(event) => setHashtags(event.target.value)}
                  placeholder="graduation youth photobooth"
                />
              </label>

              <div className="mt-5">
                <PrivacySelector
                  visibility={memoryVisibility}
                  onVisibilityChange={setMemoryVisibility}
                  classmates={selectableClassmates}
                  selectedKeys={selectedViewerKeys}
                  selectedCount={selectedViewers.length}
                  onToggleViewer={toggleSelectedViewer}
                />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button className="primary-button justify-center" onClick={handleGenerate} disabled={isGenerating}>
                  <ImagePlus size={18} />
                  {isGenerating ? 'Generating...' : 'Generate Strip'}
                </button>
                <button className="secondary-button justify-center" onClick={() => setStage('camera')}>
                  <Camera size={18} />
                  Retake Set
                </button>
              </div>

              {generated && objectUrl && (
                <div className="mt-5 grid gap-3">
                  <a className="secondary-button justify-center" href={objectUrl} download="school-memory-photobook.jpg">
                    <Download size={18} />
                    Private Download
                  </a>
                  <button className="primary-button justify-center" onClick={handlePublish} disabled={isPublishing}>
                    <Send size={18} />
                    {isPublishing ? 'Đang đăng...' : 'Đăng ảnh lên feed lớp'}
                  </button>
                  {publishError && (
                    <p className="rounded-2xl bg-blush/30 px-4 py-3 text-sm font-semibold text-coffee">
                      {publishError}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-[2rem] border border-white/65 bg-ink p-3 shadow-paper">
              <div className="grid min-h-[34rem] place-items-center overflow-hidden rounded-[1.5rem] bg-paper p-3">
                {isGenerating && (
                  <div className="text-center">
                    <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-coffee/15 border-t-coffee" />
                    <p className="font-hand text-3xl font-bold text-coffee">Printing the strip...</p>
                  </div>
                )}

                {!isGenerating && generated && objectUrl && (
                  <img
                    src={objectUrl}
                    alt="Generated school memory photobook strip"
                    className="max-h-[76vh] w-auto max-w-full rounded-xl object-contain shadow-paper"
                  />
                )}

                {!isGenerating && !generated && (
                  <div className="max-w-md text-center">
                    <p className="font-hand text-4xl font-bold text-coffee">Your photos are ready.</p>
                    <p className="mt-2 text-sm leading-6 text-ink/64">
                      Generate the final printable strip, then download privately or publish a lightweight copy to the
                      public feed.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

interface SetupGroupProps {
  step: string;
  title: string;
  children: React.ReactNode;
}

interface PrivacySelectorProps {
  compact?: boolean;
  visibility: MemoryVisibility;
  onVisibilityChange: (visibility: MemoryVisibility) => void;
  classmates: ClassmateProfile[];
  selectedKeys: string[];
  selectedCount: number;
  onToggleViewer: (nameKey: string) => void;
}

interface PhotoEditPanelProps {
  mode: PhotoPreviewMode;
  canUseEnhanced: boolean;
  settings: PhotoEditSettings;
  onModeChange: (mode: PhotoPreviewMode) => void;
  onSettingChange: <K extends keyof PhotoEditSettings>(key: K, value: PhotoEditSettings[K]) => void;
  onReset: () => void;
}

function PrivacySelector({
  compact = false,
  visibility,
  onVisibilityChange,
  classmates,
  selectedKeys,
  selectedCount,
  onToggleViewer,
}: PrivacySelectorProps) {
  const options = [
    {
      id: 'public' as const,
      label: 'Công khai',
      description: 'Hiện trên feed lớp 9/8',
      icon: <Users size={15} />,
    },
    {
      id: 'private' as const,
      label: 'Chỉ mình tôi',
      description: 'Chỉ bạn thấy khi đăng nhập',
      icon: <Lock size={15} />,
    },
    {
      id: 'tagged' as const,
      label: 'Chọn bạn xem',
      description: selectedCount ? `${selectedCount} bạn được xem` : 'Riêng tư với vài bạn',
      icon: <UserRound size={15} />,
    },
  ];

  return (
    <div className={`memory-privacy-box ${compact ? 'memory-privacy-box-compact' : ''}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase text-coffee/70">Quyền xem kỷ niệm</p>
          <p className="mt-1 text-xs leading-5 text-ink/56">Bạn có thể đăng công khai hoặc giữ riêng cho mình.</p>
        </div>
        <Lock className="shrink-0 text-coffee/62" size={compact ? 16 : 18} />
      </div>

      <div className="memory-privacy-options">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`memory-privacy-option ${visibility === option.id ? 'memory-privacy-option-active' : ''}`}
            onClick={() => onVisibilityChange(option.id)}
            aria-pressed={visibility === option.id}
          >
            <span className="memory-privacy-icon">{option.icon}</span>
            <span className="min-w-0">
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </span>
          </button>
        ))}
      </div>

      {visibility === 'tagged' && (
        <div className="mt-3">
          {classmates.length ? (
            <div className="memory-viewer-list">
              {classmates.map((person) => {
                const active = selectedKeys.includes(person.nameKey);
                return (
                  <button
                    key={person.nameKey}
                    type="button"
                    className={`memory-viewer-chip ${active ? 'memory-viewer-chip-active' : ''}`}
                    onClick={() => onToggleViewer(person.nameKey)}
                    aria-pressed={active}
                  >
                    {person.avatarDataUrl ? (
                      <img src={person.avatarDataUrl} alt="" loading="lazy" decoding="async" />
                    ) : (
                      <UserRound size={13} />
                    )}
                    <span>{person.name}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl bg-blush/25 px-3 py-2 text-xs font-bold text-coffee">
              Chưa tải được danh sách lớp, hãy thử lại sau vài giây.
            </p>
          )}
          <p className="mt-2 text-[11px] font-semibold text-ink/52">Tối đa 12 bạn để quyền xem dễ kiểm soát.</p>
        </div>
      )}
    </div>
  );
}

function PhotoEditPanel({
  mode,
  canUseEnhanced,
  settings,
  onModeChange,
  onSettingChange,
  onReset,
}: PhotoEditPanelProps) {
  return (
    <div className="photo-edit-panel">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-paper/62">Chỉnh ảnh</p>
          <p className="text-xs font-semibold text-paper/78">
            {mode === 'enhanced' ? 'Đang dùng ảnh đã làm đẹp' : 'Đang dùng ảnh gốc'}
          </p>
        </div>
        <button type="button" className="photo-edit-reset" onClick={onReset}>
          Reset
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className={`photo-edit-choice ${mode === 'original' ? 'photo-edit-choice-active' : ''}`}
          onClick={() => onModeChange('original')}
        >
          <span>Không làm đẹp</span>
          <small>Ảnh gốc</small>
        </button>
        <button
          type="button"
          className={`photo-edit-choice ${mode === 'enhanced' ? 'photo-edit-choice-active' : ''}`}
          onClick={() => onModeChange('enhanced')}
          disabled={!canUseEnhanced}
        >
          <span>Làm đẹp</span>
          <small>Photobooth</small>
        </button>
      </div>

      <div className="mt-3 grid gap-2">
        {PHOTO_EDIT_CONTROLS.map((control) => (
          <label key={control.key} className="photo-edit-slider">
            <span>
              {control.label}
              <strong>
                {settings[control.key]}
                {control.suffix || ''}
              </strong>
            </span>
            <input
              type="range"
              min={control.min}
              max={control.max}
              step={control.step}
              value={settings[control.key]}
              onChange={(event) => onSettingChange(control.key, Number(event.target.value))}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function SetupGroup({ step, title, children }: SetupGroupProps) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-sm font-bold text-paper">{step}</span>
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function LayoutPreview({ layout, count }: { layout: LayoutType; count: PhotoCount }) {
  const columns = layout === 'vertical' ? 1 : layout === 'square' ? (count === 1 ? 1 : count === 4 ? 2 : Math.min(count, 3)) : count;

  return (
    <span className={`layout-preview layout-preview-${layout}`} aria-hidden="true">
      <span className="layout-preview-paper" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: count }).map((_, index) => (
          <span key={index} className="layout-frame">
            {index + 1}
          </span>
        ))}
        <span className="layout-preview-footer" />
      </span>
    </span>
  );
}

function MoodPreview({ moodId, swatch, label }: { moodId: PhotobookMoodId; swatch: string; label: string }) {
  return (
    <span className={`mood-preview mood-preview-${moodId}`} style={{ background: swatch }} aria-hidden="true">
      <span className="mood-preview-paper">
        <span className="mood-preview-photo mood-preview-photo-main" />
        <span className="mood-preview-photo mood-preview-photo-small" />
        <span className="mood-preview-note">{label}</span>
        <span className="mood-preview-sticker" />
      </span>
    </span>
  );
}

interface CustomBackgroundEditorProps {
  image: string;
  edit: BackgroundEdit;
  onChange: <K extends keyof BackgroundEdit>(key: K, value: BackgroundEdit[K]) => void;
  onReset: () => void;
}

function CustomBackgroundEditor({ image, edit, onChange, onReset }: CustomBackgroundEditorProps) {
  const controls: Array<{
    key: keyof BackgroundEdit;
    label: string;
    min: number;
    max: number;
    step: number;
    value: number;
    suffix?: string;
  }> = [
    { key: 'scale', label: 'Zoom', min: 1, max: 2, step: 0.01, value: edit.scale },
    { key: 'x', label: 'Trái / phải', min: -100, max: 100, step: 1, value: edit.x },
    { key: 'y', label: 'Lên / xuống', min: -100, max: 100, step: 1, value: edit.y },
    { key: 'brightness', label: 'Sáng', min: 70, max: 130, step: 1, value: edit.brightness, suffix: '%' },
    { key: 'blur', label: 'Mờ nền', min: 0, max: 8, step: 0.1, value: edit.blur, suffix: 'px' },
  ];

  return (
    <div className="mt-4 grid gap-4 rounded-[1.25rem] bg-paper/72 p-4 shadow-sm lg:grid-cols-[0.9fr_1.1fr]">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-ink">
        <img
          src={image}
          alt="Custom background preview"
          className="absolute left-1/2 top-1/2 h-full w-full object-cover"
          style={{
            filter: `brightness(${edit.brightness}%) blur(${edit.blur}px)`,
            transform: `translate(-50%, -50%) translate(${edit.x * 0.35}%, ${edit.y * 0.35}%) scale(${edit.scale})`,
          }}
        />
        <div className="absolute inset-3 rounded-lg border-2 border-dashed border-paper/80" />
        <div className="absolute bottom-3 left-3 right-3 rounded-full bg-ink/62 px-3 py-2 text-center text-xs font-bold text-paper">
          Preview background
        </div>
      </div>

      <div className="grid gap-3">
        {controls.map((control) => (
          <label key={control.key} className="grid gap-1">
            <span className="flex items-center justify-between gap-3 text-xs font-bold uppercase text-coffee/70">
              {control.label}
              <span>
                {control.value}
                {control.suffix || ''}
              </span>
            </span>
            <input
              type="range"
              min={control.min}
              max={control.max}
              step={control.step}
              value={control.value}
              onChange={(event) => onChange(control.key, Number(event.target.value))}
              className="w-full accent-coffee"
            />
          </label>
        ))}
        <button className="secondary-button justify-center" onClick={onReset}>
          <RefreshCw size={16} />
          Reset background
        </button>
      </div>
    </div>
  );
}
