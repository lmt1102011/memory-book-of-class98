import { m } from 'framer-motion';
import {
  ArrowLeft,
  Camera,
  CameraIcon,
  Check,
  Download,
  ImagePlus,
  Layers,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  Upload,
} from 'lucide-react';
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import {
  BACKGROUND_OPTIONS,
  LAYOUT_OPTIONS,
  PHOTO_COUNT_OPTIONS,
  QUALITY_OPTIONS,
} from '../data/backgrounds';
import type {
  BackgroundEdit,
  BackgroundOption,
  CapturedPhoto,
  ExportQuality,
  GeneratedPhotobook,
  LayoutType,
  PhotobookConfig,
  PhotoCount,
  PublishMemoryDraft,
  UserProfile,
} from '../types';
import { makeId } from '../utils/ids';
import { makeFeedThumbnailDataUrl, renderPhotobook } from '../utils/photobookCanvas';

interface PhotobookPageProps {
  profile: UserProfile | null;
  onJoinNeeded: () => void;
  onPublish: (draft: PublishMemoryDraft) => void | Promise<void>;
}

type BoothStage = 'setup' | 'camera' | 'final';
type CaptureSource = 'camera' | 'upload';

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
    <button className={`option-card ${active ? 'option-card-active' : ''}`} onClick={() => onSelect(value)}>
      {preview}
      <span className="flex items-center justify-between gap-3">
        <span className="font-bold">{label}</span>
        {active && <Check size={17} />}
      </span>
      {description && <span className="mt-1 block text-xs leading-5 text-ink/56">{description}</span>}
    </button>
  );
}

export default function PhotobookPage({ profile, onJoinNeeded, onPublish }: PhotobookPageProps) {
  const webcamRef = useRef<Webcam>(null);
  const cameraStageRef = useRef<HTMLDivElement | null>(null);
  const photoUploadInputRef = useRef<HTMLInputElement | null>(null);
  const countdownFrame = useRef<number | null>(null);
  const [stage, setStage] = useState<BoothStage>('setup');
  const [captureSource, setCaptureSource] = useState<CaptureSource>('camera');
  const [config, setConfig] = useState<PhotobookConfig>(defaultConfig);
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('graduation youth photobooth');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [generated, setGenerated] = useState<GeneratedPhotobook | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  const selectedBackground = useMemo<BackgroundOption>(
    () => BACKGROUND_OPTIONS.find((background) => background.id === config.backgroundId) || BACKGROUND_OPTIONS[0],
    [config.backgroundId],
  );

  const currentIndex = capturedPhotos.length + (pendingPhoto ? 1 : 0);
  const canCapture = stage === 'camera' && captureSource === 'camera' && !pendingPhoto && countdown === null;
  const canUploadPhoto = stage === 'camera' && !pendingPhoto && countdown === null && capturedPhotos.length < config.photoCount;
  const videoConstraints = useMemo(() => getVideoConstraints(facingMode), [facingMode]);

  const updateConfig = <K extends keyof PhotobookConfig>(key: K, value: PhotobookConfig[K]) => {
    setConfig((current) => ({ ...current, [key]: value }));
  };

  const updatePhotoCount = (value: PhotoCount) => {
    setConfig((current) => ({ ...current, photoCount: value }));
    setCapturedPhotos((current) => current.slice(0, value));
    setPendingPhoto(null);
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
    setPendingPhoto(null);
    setGenerated(null);
    setStage('setup');
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      setObjectUrl(null);
    }
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

  const leaveCameraStage = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
    setStage('setup');
  };

  const flipCamera = () => {
    setCameraError(null);
    setPendingPhoto(null);
    setCountdown(null);
    setFacingMode((current) => (current === 'user' ? 'environment' : 'user'));
  };

  const captureNow = useCallback(() => {
    setCountdown(null);
    const screenshot = webcamRef.current?.getScreenshot();
    if (!screenshot) {
      setCameraError('The camera could not capture a frame. Check browser permissions and try again.');
      return;
    }

    playShutterSound();
    setFlash(true);
    window.setTimeout(() => setFlash(false), 170);
    setPendingPhoto(screenshot);
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

  const acceptPhoto = () => {
    if (!pendingPhoto) return;
    const nextPhotos = [...capturedPhotos, { id: makeId('photo'), dataUrl: pendingPhoto }];
    setCapturedPhotos(nextPhotos);
    setPendingPhoto(null);

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
    if (!file || capturedPhotos.length >= config.photoCount) return;

    try {
      setCameraError(null);
      setCaptureSource('upload');
      setStage('camera');
      const uploaded = await compressUploadedPhoto(file);
      setPendingPhoto(uploaded);
      window.setTimeout(() => setFlash(true), 20);
      window.setTimeout(() => setFlash(false), 190);
    } catch {
      setCameraError('Khong the tai anh nay. Hay thu anh JPG/PNG khac.');
    } finally {
      event.target.value = '';
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
    try {
      setIsPublishing(true);
      setPublishError('');
      const thumbnail = await makeFeedThumbnailDataUrl(objectUrl, 1300);
      await onPublish({
        imageDataUrl: thumbnail,
        caption: caption.trim() || 'Một strip photobook mới từ những ngày tụi mình sẽ giữ mãi.',
        hashtags: parseHashtags(hashtags),
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
    <section className="relative min-h-[calc(100svh-4rem)] overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(247,183,199,.26),transparent_34%),linear-gradient(245deg,rgba(169,205,232,.24),transparent_40%),linear-gradient(135deg,#fbf3e7,#fffaf1)]" />
      <div className="relative mx-auto max-w-7xl">
        <input
          ref={photoUploadInputRef}
          className="sr-only"
          type="file"
          accept="image/*"
          onChange={handleUploadPhoto}
        />

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="section-kicker">Korean Photobooth</p>
            <h1 className="font-display text-5xl leading-none sm:text-7xl">Make the final strip</h1>
          </div>
          <button className="secondary-button" onClick={resetSession}>
            <RefreshCw size={16} />
            Reset
          </button>
        </div>

        {stage === 'setup' && (
          <div className="grid gap-5 lg:grid-cols-[1fr_0.78fr]">
            <div className="rounded-[2rem] border border-white/65 bg-white/52 p-4 shadow-paper backdrop-blur-xl sm:p-6">
              <div className="grid gap-5">
                <SetupGroup step="1" title="Choose number of photos">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {PHOTO_COUNT_OPTIONS.map((count) => (
                      <OptionButton<PhotoCount>
                        key={count}
                        active={config.photoCount === count}
                        value={count}
                        label={`${count}`}
                        description={count === 1 ? 'photo' : 'photos'}
                        onSelect={updatePhotoCount}
                      />
                    ))}
                  </div>
                </SetupGroup>

                <SetupGroup step="2" title="Choose layout">
                  <div className="grid gap-3 sm:grid-cols-3">
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

                <SetupGroup step="3" title="Choose export quality">
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

                <SetupGroup step="4" title="Background customization">
                  <div className="grid gap-3 sm:grid-cols-4">
                    {BACKGROUND_OPTIONS.map((background) => (
                      <button
                        key={background.id}
                        className={`option-card text-left ${config.backgroundId === background.id ? 'option-card-active' : ''}`}
                        onClick={() => updateConfig('backgroundId', background.id)}
                      >
                        <span className="mb-3 block h-12 rounded-xl border border-white/60" style={{ background: background.swatch }} />
                        <span className="block font-bold">{background.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-ink/56">{background.description}</span>
                      </button>
                    ))}
                  </div>
                  <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-bold text-paper shadow-paper transition hover:-translate-y-0.5">
                    <Upload size={17} />
                    Upload custom background
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

            <aside className="rounded-[2rem] border border-white/65 bg-white/45 p-4 shadow-paper backdrop-blur-xl sm:p-6">
              <div className="camera-preview-card">
                <div className="grid h-full place-items-center rounded-[1.25rem] bg-[linear-gradient(135deg,#fffaf1,#f7b7c7_52%,#a9cde8)] p-6 text-center">
                  <Layers className="mx-auto mb-4 text-coffee" size={36} />
                  <h2 className="font-display text-5xl leading-none">Ready for {config.photoCount} frames</h2>
                  <p className="mt-3 text-sm leading-6 text-ink/64">
                    {selectedBackground.description}. Exporting at {QUALITY_OPTIONS.find((q) => q.id === config.quality)?.label}.
                  </p>
                </div>
              </div>
              <button
                className="primary-button mt-5 min-h-14 w-full justify-center text-base"
                onClick={openCameraStage}
              >
                <Camera size={19} />
                Open Camera
              </button>
              <button
                className="secondary-button mt-3 min-h-14 w-full justify-center text-base"
                onClick={openUploadStage}
              >
                <Upload size={19} />
                Upload Photo Instead
              </button>
            </aside>
          </div>
        )}

        {stage === 'camera' && (
          <div ref={cameraStageRef} className="camera-stage">
            <div className="camera-shell">
              <div className="relative mx-auto w-full max-w-6xl">
                <div className="camera-topbar">
                  <button className="camera-action-button" onClick={leaveCameraStage} aria-label="Back to setup">
                    <ArrowLeft size={19} />
                  </button>
                  <div className="rounded-full bg-ink/55 px-4 py-2 text-center text-sm font-bold text-paper backdrop-blur-md">
                    {Math.min(currentIndex + (pendingPhoto ? 0 : 1), config.photoCount)} / {config.photoCount}
                  </div>
                  <button className="camera-action-button" onClick={flipCamera} aria-label="Rotate camera">
                    <RotateCcw size={19} />
                  </button>
                </div>

                <div className="camera-frame">
                  {pendingPhoto ? (
                    <img src={pendingPhoto} alt="Captured preview" className="h-full w-full object-cover" />
                  ) : captureSource === 'upload' ? (
                    <div className="grid h-full place-items-center bg-[linear-gradient(135deg,#1a1512,#35291f)] p-6 text-center text-paper">
                      <div className="max-w-sm">
                        <Upload className="mx-auto mb-4 text-paper/80" size={42} />
                        <h2 className="font-display text-5xl leading-none">Upload photo</h2>
                        <p className="mt-3 text-sm leading-6 text-paper/68">
                          Chon anh tu may cua ban, sau do bam dau tick de dua vao photobook.
                        </p>
                        <button
                          className="camera-secondary-button mx-auto mt-5"
                          onClick={() => photoUploadInputRef.current?.click()}
                          disabled={!canUploadPhoto}
                        >
                          <Upload size={18} />
                          Chon anh
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
                      initial={{ scale: 0.82, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="absolute inset-0 grid place-items-center bg-ink/20 text-paper backdrop-blur-[1px]"
                    >
                      <span className="font-display text-8xl leading-none sm:text-[12rem] lg:text-[16rem]">{countdown}</span>
                    </m.div>
                  )}
                </div>

                <div className="camera-controls-near">
                  {pendingPhoto ? (
                    <>
                      <button className="camera-secondary-button" onClick={() => setPendingPhoto(null)}>
                        <RefreshCw size={18} />
                        Doi anh
                      </button>
                      <button className="camera-shutter-button" onClick={acceptPhoto}>
                        <Check size={28} />
                      </button>
                    </>
                  ) : (
                    <>
                      {captureSource === 'camera' ? (
                        <>
                          <button className="camera-secondary-button" onClick={flipCamera}>
                            <RotateCcw size={18} />
                            Xoay cam
                          </button>
                          <button
                            className="camera-secondary-button"
                            onClick={() => {
                              setCaptureSource('upload');
                              photoUploadInputRef.current?.click();
                            }}
                            disabled={!canUploadPhoto}
                          >
                            <Upload size={18} />
                            Up anh
                          </button>
                          <button className="camera-shutter-button" onClick={startCountdown} disabled={!canCapture}>
                            <CameraIcon size={30} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="camera-secondary-button"
                            onClick={() => photoUploadInputRef.current?.click()}
                            disabled={!canUploadPhoto}
                          >
                            <Upload size={18} />
                            Chon anh
                          </button>
                          <button className="camera-shutter-button" onClick={() => setCaptureSource('camera')}>
                            <CameraIcon size={30} />
                          </button>
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
                    <button className="primary-button justify-center" onClick={acceptPhoto}>
                      <Check size={17} />
                      Next Photo
                    </button>
                    <button className="secondary-button justify-center" onClick={() => setPendingPhoto(null)}>
                      <RefreshCw size={17} />
                      Doi anh
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
                <button
                  className="secondary-button justify-center"
                  onClick={() => setCaptureSource(captureSource === 'camera' ? 'upload' : 'camera')}
                >
                  {captureSource === 'camera' ? <Upload size={16} /> : <Camera size={16} />}
                  {captureSource === 'camera' ? 'Dung anh co san' : 'Dung camera'}
                </button>
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
                    {isPublishing ? 'Đang đăng...' : 'Share Publicly'}
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
    { key: 'x', label: 'Trai / phai', min: -100, max: 100, step: 1, value: edit.x },
    { key: 'y', label: 'Len / xuong', min: -100, max: 100, step: 1, value: edit.y },
    { key: 'brightness', label: 'Sang', min: 70, max: 130, step: 1, value: edit.brightness, suffix: '%' },
    { key: 'blur', label: 'Mo nen', min: 0, max: 8, step: 0.1, value: edit.blur, suffix: 'px' },
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
