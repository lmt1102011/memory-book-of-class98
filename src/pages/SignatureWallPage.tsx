import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { BookOpen, RotateCcw, Sparkles, Trash2, UserRound, X } from 'lucide-react';
import { useConfirmDialog } from '../components/ConfirmDialogProvider';
import FirebaseNotice from '../components/FirebaseNotice';
import type { ClassSignature, UserProfile } from '../types';
import { formatUploadTime } from '../utils/date';

interface SignatureWallPageProps {
  signatures: ClassSignature[];
  firebaseNotice: string;
  profile: UserProfile | null;
  openEditorSignal?: number;
  onJoin: () => void;
  onSaveSignature: (imageDataUrl: string) => void | Promise<void>;
  onDeleteSignature: () => void | Promise<void>;
}

const signatureWallRotation = (index: number) => {
  const rotations = [-1.8, 1.2, -0.7, 1.7, -1.1, 0.8, -1.4, 1.4];
  return rotations[index % rotations.length];
};

const SIGNATURE_MIN_STROKE_WIDTH = 2.28;
const SIGNATURE_MAX_STROKE_WIDTH = 2.62;
const SIGNATURE_EXPORT_WIDTH = 1200;
const SIGNATURE_EXPORT_HEIGHT = 420;

interface SignaturePoint {
  x: number;
  y: number;
  time: number;
  pressure: number;
}

type SignatureStroke = SignaturePoint[];

interface SignatureCanvasSize {
  width: number;
  height: number;
}

interface SignatureBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface RenderSignatureOptions {
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  alpha?: number;
  blur?: number;
  color?: string;
  widthMultiplier?: number;
  smoothingPasses?: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const distanceBetween = (first: SignaturePoint, second: SignaturePoint) => {
  const deltaX = second.x - first.x;
  const deltaY = second.y - first.y;
  return Math.hypot(deltaX, deltaY);
};

const interpolatePoint = (first: SignaturePoint, second: SignaturePoint, amount: number): SignaturePoint => ({
  x: first.x + (second.x - first.x) * amount,
  y: first.y + (second.y - first.y) * amount,
  time: first.time + (second.time - first.time) * amount,
  pressure: first.pressure + (second.pressure - first.pressure) * amount,
});

const waitForPaint = () =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.setTimeout(resolve, 0));
  });

const smoothSignatureStroke = (stroke: SignatureStroke, passes = 1): SignatureStroke => {
  if (stroke.length < 3) return stroke;

  let points = stroke;
  for (let pass = 0; pass < passes; pass += 1) {
    const next: SignatureStroke = [points[0]];
    for (let index = 0; index < points.length - 1; index += 1) {
      const current = points[index];
      const following = points[index + 1];
      next.push(interpolatePoint(current, following, 0.26));
      next.push(interpolatePoint(current, following, 0.74));
    }
    next.push(points[points.length - 1]);
    points = next;
  }

  return points;
};

const getSegmentWidth = (from: SignaturePoint, to: SignaturePoint) => {
  const pressure = clamp((from.pressure + to.pressure) / 2 || 0.52, 0.36, 0.78);
  const pressureNudge = (pressure - 0.52) * 0.22;
  const baseWidth = (SIGNATURE_MIN_STROKE_WIDTH + SIGNATURE_MAX_STROKE_WIDTH) / 2;

  return clamp(baseWidth + pressureNudge, SIGNATURE_MIN_STROKE_WIDTH, SIGNATURE_MAX_STROKE_WIDTH);
};

const renderSignatureStrokes = (
  context: CanvasRenderingContext2D,
  strokes: SignatureStroke[],
  options: RenderSignatureOptions = {},
) => {
  const {
    scale = 1,
    offsetX = 0,
    offsetY = 0,
    alpha = 1,
    blur = 0,
    color = '#2f241c',
    widthMultiplier = 1,
    smoothingPasses = 1,
  } = options;

  context.save();
  context.globalAlpha = alpha;
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.miterLimit = 2;
  context.filter = blur > 0 ? `blur(${blur}px)` : 'none';

  const transformX = (value: number) => value * scale + offsetX;
  const transformY = (value: number) => value * scale + offsetY;

  strokes.forEach((stroke) => {
    if (!stroke.length) return;

    const points = smoothSignatureStroke(stroke, smoothingPasses);
    if (points.length === 1) {
      const point = points[0];
      const dotRadius = Math.max(1.2, SIGNATURE_MAX_STROKE_WIDTH * scale * widthMultiplier * 0.42);
      context.beginPath();
      context.arc(transformX(point.x), transformY(point.y), dotRadius, 0, Math.PI * 2);
      context.fill();
      return;
    }

    let previous = points[0];
    let previousMid = previous;

    for (let index = 1; index < points.length; index += 1) {
      const current = points[index];
      const mid = interpolatePoint(previous, current, 0.5);
      const lineWidth = Math.max(0.9, getSegmentWidth(previous, current) * scale * widthMultiplier);

      context.beginPath();
      context.moveTo(transformX(previousMid.x), transformY(previousMid.y));
      context.quadraticCurveTo(transformX(previous.x), transformY(previous.y), transformX(mid.x), transformY(mid.y));
      context.lineWidth = lineWidth;
      context.stroke();

      previousMid = mid;
      previous = current;
    }

    const beforeLast = points[Math.max(0, points.length - 2)];
    context.beginPath();
    context.moveTo(transformX(previousMid.x), transformY(previousMid.y));
    context.lineTo(transformX(previous.x), transformY(previous.y));
    context.lineWidth = Math.max(0.9, getSegmentWidth(beforeLast, previous) * scale * widthMultiplier);
    context.stroke();
  });

  context.restore();
};

const getSignatureBounds = (strokes: SignatureStroke[]): SignatureBounds | null => {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  strokes.forEach((stroke) => {
    stroke.forEach((point) => {
      if (point.x < minX) minX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.x > maxX) maxX = point.x;
      if (point.y > maxY) maxY = point.y;
    });
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;

  return { minX, minY, maxX, maxY };
};

const exportPolishedSignature = (strokes: SignatureStroke[], canvasSize: SignatureCanvasSize) => {
  const bounds = getSignatureBounds(strokes);
  if (!bounds) return '';

  const signatureWidth = Math.max(1, bounds.maxX - bounds.minX);
  const signatureHeight = Math.max(1, bounds.maxY - bounds.minY);
  if (signatureWidth < 8 && signatureHeight < 8) return '';

  const padding = clamp(Math.max(signatureWidth, signatureHeight) * 0.075, 14, 44);
  const sourceX = Math.max(0, bounds.minX - padding);
  const sourceY = Math.max(0, bounds.minY - padding);
  const sourceWidth = Math.min(canvasSize.width - sourceX, signatureWidth + padding * 2);
  const sourceHeight = Math.min(canvasSize.height - sourceY, signatureHeight + padding * 2);
  const output = document.createElement('canvas');
  output.width = SIGNATURE_EXPORT_WIDTH;
  output.height = SIGNATURE_EXPORT_HEIGHT;

  const outputContext = output.getContext('2d');
  if (!outputContext) return '';

  outputContext.clearRect(0, 0, output.width, output.height);
  outputContext.imageSmoothingEnabled = true;
  outputContext.imageSmoothingQuality = 'high';

  const fitScale = Math.min((output.width * 1.08) / sourceWidth, output.height / sourceHeight);
  const drawWidth = sourceWidth * fitScale;
  const drawHeight = sourceHeight * fitScale;
  const offsetX = (output.width - drawWidth) / 2 - sourceX * fitScale;
  const offsetY = (output.height - drawHeight) / 2 - sourceY * fitScale;

  renderSignatureStrokes(outputContext, strokes, {
    scale: fitScale,
    offsetX,
    offsetY,
    alpha: 0.1,
    blur: 0.7,
    color: '#1f1712',
    widthMultiplier: 1.18,
    smoothingPasses: 2,
  });

  renderSignatureStrokes(outputContext, strokes, {
    scale: fitScale,
    offsetX,
    offsetY,
    alpha: 1,
    color: '#241913',
    widthMultiplier: 1.04,
    smoothingPasses: 2,
  });

  renderSignatureStrokes(outputContext, strokes, {
    scale: fitScale,
    offsetX,
    offsetY,
    alpha: 0.06,
    color: '#7a5639',
    widthMultiplier: 0.22,
    smoothingPasses: 2,
  });

  return output.toDataURL('image/webp', 0.96);
};

export default function SignatureWallPage({
  signatures,
  firebaseNotice,
  profile,
  openEditorSignal = 0,
  onJoin,
  onSaveSignature,
  onDeleteSignature,
}: SignatureWallPageProps) {
  const lastOpenEditorSignalRef = useRef(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedSignature, setSelectedSignature] = useState<ClassSignature | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saveError, setSaveError] = useState('');
  const confirmDialog = useConfirmDialog();

  const ownSignature = useMemo(
    () => (profile ? signatures.find((signature) => signature.nameKey === profile.nameKey || signature.uid === profile.uid) : undefined),
    [profile, signatures],
  );
  const visibleSignatures = signatures.slice(0, 120);

  useEffect(() => {
    if (!profile) return;
    if (openEditorSignal === lastOpenEditorSignalRef.current) return;
    lastOpenEditorSignalRef.current = openEditorSignal;
    setEditorOpen(true);
  }, [openEditorSignal, profile]);

  useEffect(() => {
    if (!selectedSignature) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedSignature(null);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedSignature]);

  const handleSave = useCallback(
    async (imageDataUrl: string) => {
      setIsSaving(true);
      setSaveError('');
      try {
        await onSaveSignature(imageDataUrl);
        setEditorOpen(false);
      } catch (caught) {
        setSaveError(caught instanceof Error ? caught.message : 'Không thể lưu chữ ký lúc này.');
        throw caught;
      } finally {
        setIsSaving(false);
      }
    },
    [onSaveSignature],
  );

  const handleDelete = useCallback(async () => {
    if (!ownSignature) return;
    const confirmed = await confirmDialog({
      title: 'Xóa chữ ký?',
      description: 'Chữ ký của bạn sẽ biến mất khỏi bảng chữ ký lớp 9/8.',
      confirmLabel: 'Xóa chữ ký',
      tone: 'danger',
    });
    if (!confirmed) return;

    setIsDeleting(true);
    setSaveError('');
    try {
      await onDeleteSignature();
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : 'Không thể xóa chữ ký lúc này.');
    } finally {
      setIsDeleting(false);
    }
  }, [confirmDialog, onDeleteSignature, ownSignature]);

  if (!profile) {
    return (
      <div className="relative">
        <section className="mx-auto max-w-7xl px-4 py-9 sm:px-6 lg:px-8">
          <div className="rounded-[1.5rem] border border-white/65 bg-white/58 p-6 text-center shadow-paper">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-ink text-paper shadow-paper">
              <BookOpen size={28} />
            </div>
            <h1 className="mt-5 font-display text-6xl leading-none">Cần vào lớp trước</h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-ink/62">
              Tường chữ ký chỉ dành cho tài khoản lớp 9/8, để mỗi người để lại một nét ký riêng.
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

  return (
    <div className="relative">
      <section className="mx-auto max-w-7xl px-4 pb-7 pt-9 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end">
          <div className="min-w-0">
            <p className="section-kicker">Lời nhắn / Tường chữ ký</p>
            <h1 className="max-w-4xl font-display text-6xl leading-[0.86] sm:text-8xl">
              Bức tường chữ ký của lớp 9/8
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-ink/66 sm:text-base">
              Một nơi giống mặt sau áo đồng phục cuối cấp: mỗi người để lại một chữ ký tay, nhỏ thôi nhưng rất riêng.
            </p>
          </div>

          <div className="rounded-[1.45rem] border border-white/65 bg-white/58 p-4 shadow-paper">
            <div className="grid gap-2">
              <button className="primary-button min-h-12 w-full justify-center" onClick={() => setEditorOpen(true)} disabled={isDeleting}>
                <BookOpen size={18} />
                {ownSignature ? 'Ký lại cho đẹp hơn' : 'Ký cho lớp ngay'}
              </button>
              {ownSignature && (
                <button className="secondary-button min-h-11 w-full justify-center text-coffee" onClick={() => void handleDelete()} disabled={isDeleting || isSaving}>
                  <Trash2 size={16} />
                  {isDeleting ? 'Đang xóa chữ ký...' : 'Xóa chữ ký của tôi'}
                </button>
              )}
            </div>
            <p className="mt-3 text-xs font-bold leading-5 text-coffee/62">
              {ownSignature
                ? `Bạn đã ký ${formatUploadTime(ownSignature.updatedAt || ownSignature.createdAt)}.`
                : 'Bạn chưa có chữ ký trên tường lớp.'}
            </p>
            {saveError && <p className="mt-3 rounded-[0.9rem] bg-blush/24 px-3 py-2 text-xs font-bold leading-5 text-coffee">{saveError}</p>}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[1.6rem] border-[10px] border-[#7a5639] bg-[#2f4b3f] p-4 shadow-paper sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-paper">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-paper/62">Class 9/8 signature board</p>
              <h2 className="font-display text-5xl leading-none">Bảng chữ ký</h2>
            </div>
            <span className="rounded-full bg-paper px-3 py-1.5 text-xs font-black text-ink">
              {visibleSignatures.length} chữ ký
            </span>
          </div>

          {visibleSignatures.length ? (
            <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {visibleSignatures.map((signature, index) => (
                <button
                  type="button"
                  key={signature.id}
                  className="relative min-h-[10.85rem] rounded-[0.85rem] bg-[#fffaf1] p-2 text-left shadow-[0_12px_24px_rgba(18,15,13,0.2)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_28px_rgba(18,15,13,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper sm:min-h-[11.3rem]"
                  style={{ transform: `rotate(${signatureWallRotation(index)}deg)` }}
                  onClick={() => setSelectedSignature(signature)}
                  aria-label={`Xem chữ ký của ${signature.name}`}
                >
                  <span className="absolute left-1/2 top-1 h-4 w-14 -translate-x-1/2 rotate-1 rounded-sm bg-[#f7d6a4]/82 shadow-sm" />
                  <div className="grid h-[8.35rem] place-items-center overflow-hidden rounded-[0.65rem] bg-white/86 p-0.5 shadow-[inset_0_0_0_1px_rgba(122,86,57,0.08)] sm:h-[8.75rem]">
                    <img
                      src={signature.imageDataUrl}
                      alt={`Chữ ký của ${signature.name}`}
                      className="block h-full w-[150%] max-w-none scale-[1.44] object-contain"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <p className="mt-1 truncate text-center text-[11px] font-black text-coffee">{signature.name}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid min-h-[22rem] place-items-center rounded-[1rem] border border-dashed border-paper/35 p-6 text-center text-paper">
              <div>
                <Sparkles className="mx-auto text-paper/72" size={36} />
                <p className="mt-3 font-hand text-4xl leading-tight">Bảng chữ ký còn trống.</p>
                <p className="mt-2 text-sm font-bold text-paper/62">Bạn có thể là chữ ký đầu tiên của lớp 9/8.</p>
                <button className="primary-button mx-auto mt-5 justify-center" onClick={() => setEditorOpen(true)}>
                  <BookOpen size={17} />
                  Ký đầu tiên
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {editorOpen && (
        <SignatureEditorModal
          isSaving={isSaving}
          error={saveError}
          ownSignature={ownSignature}
          onClose={() => {
            setEditorOpen(false);
            setSaveError('');
          }}
          onSave={handleSave}
        />
      )}

      {selectedSignature && (
        <SignaturePreviewModal
          signature={selectedSignature}
          onClose={() => setSelectedSignature(null)}
        />
      )}

      <FirebaseNotice message={firebaseNotice} />
    </div>
  );
}

function SignaturePreviewModal({ signature, onClose }: { signature: ClassSignature; onClose: () => void }) {
  return (
    <div
      className="app-safe-modal-overlay fixed inset-0 z-[98] grid place-items-center bg-[rgba(18,15,13,0.82)] p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Xem chữ ký của ${signature.name}`}
      onClick={onClose}
    >
      <div
        className="app-safe-modal-panel relative w-full max-w-3xl overflow-hidden rounded-[1.25rem] border border-[#7a5639]/24 bg-[#fffaf1] p-4 text-ink shadow-[0_26px_80px_rgba(18,15,13,0.38)] sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="icon-button absolute right-3 top-3 bg-ink text-paper" onClick={onClose} aria-label="Đóng chữ ký">
          <X size={18} />
        </button>

        <div className="pr-12">
          <p className="section-kicker">Chữ ký lớp 9/8</p>
          <h2 className="font-display text-5xl leading-none sm:text-6xl">{signature.name}</h2>
          <p className="mt-2 text-xs font-black uppercase text-coffee/70">
            {formatUploadTime(signature.updatedAt || signature.createdAt)}
          </p>
        </div>

        <div className="mt-5 grid min-h-[16rem] place-items-center rounded-[1rem] border border-coffee/12 bg-white p-5 shadow-[inset_0_0_0_1px_rgba(122,86,57,0.1)] sm:min-h-[22rem]">
          <img
            src={signature.imageDataUrl}
            alt={`Chữ ký của ${signature.name}`}
            className="max-h-[52svh] w-full object-contain"
            decoding="async"
          />
        </div>
      </div>
    </div>
  );
}

function SignatureEditorModal({
  isSaving,
  error,
  ownSignature,
  onClose,
  onSave,
}: {
  isSaving: boolean;
  error: string;
  ownSignature?: ClassSignature;
  onClose: () => void;
  onSave: (imageDataUrl: string) => Promise<void> | void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasInkRef = useRef(false);
  const strokesRef = useRef<SignatureStroke[]>([]);
  const activeStrokeRef = useRef<SignatureStroke | null>(null);
  const canvasSizeRef = useRef<SignatureCanvasSize>({ width: 0, height: 0 });
  const redrawFrameRef = useRef<number | null>(null);
  const liveMidPointRef = useRef<SignaturePoint | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [localError, setLocalError] = useState('');

  const markHasInk = useCallback(() => {
    if (hasInkRef.current) return;
    hasInkRef.current = true;
    setHasInk(true);
  }, []);

  const configureCanvas = useCallback((clear = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const cssWidth = Math.max(320, Math.round(rect.width || 920));
    const cssHeight = Math.max(220, Math.round(rect.height || 480));
    const pixelRatio = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2.5);
    const width = Math.max(320, Math.round(cssWidth * pixelRatio));
    const height = Math.max(220, Math.round(cssHeight * pixelRatio));

    const previousSize = canvasSizeRef.current;
    if (
      !drawingRef.current &&
      previousSize.width > 0 &&
      previousSize.height > 0 &&
      strokesRef.current.length > 0 &&
      (Math.abs(previousSize.width - cssWidth) > 1 || Math.abs(previousSize.height - cssHeight) > 1)
    ) {
      const scaleX = cssWidth / previousSize.width;
      const scaleY = cssHeight / previousSize.height;
      strokesRef.current = strokesRef.current.map((stroke) =>
        stroke.map((point) => ({ ...point, x: point.x * scaleX, y: point.y * scaleY })),
      );
    }

    canvasSizeRef.current = { width: cssWidth, height: cssHeight };
    let sizeChanged = false;
    if (canvas.width !== width) {
      canvas.width = width;
      sizeChanged = true;
    }
    if (canvas.height !== height) {
      canvas.height = height;
      sizeChanged = true;
    }
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    if (clear || sizeChanged) context.clearRect(0, 0, cssWidth, cssHeight);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.miterLimit = 2;

    return { canvas, context };
  }, []);

  const redrawCanvas = useCallback(() => {
    const prepared = configureCanvas(true);
    if (!prepared) return;

    renderSignatureStrokes(prepared.context, strokesRef.current, {
      alpha: 0.14,
      blur: 0.7,
      color: '#1f1712',
      widthMultiplier: 1.34,
      smoothingPasses: 1,
    });
    renderSignatureStrokes(prepared.context, strokesRef.current, {
      alpha: 0.98,
      color: '#2f241c',
      widthMultiplier: 1,
      smoothingPasses: 1,
    });
  }, [configureCanvas]);

  const requestRedraw = useCallback(() => {
    if (redrawFrameRef.current !== null) return;
    redrawFrameRef.current = window.requestAnimationFrame(() => {
      redrawFrameRef.current = null;
      redrawCanvas();
    });
  }, [redrawCanvas]);

  const drawLiveDot = useCallback((context: CanvasRenderingContext2D, point: SignaturePoint) => {
    const radius = Math.max(1.45, SIGNATURE_MAX_STROKE_WIDTH * 0.42);
    context.save();
    context.fillStyle = '#2f241c';
    context.globalAlpha = 0.96;
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }, []);

  const drawLiveSegment = useCallback((context: CanvasRenderingContext2D, from: SignaturePoint, to: SignaturePoint) => {
    const previousMid = liveMidPointRef.current || from;
    const nextMid = interpolatePoint(from, to, 0.5);
    const width = Math.max(1.15, getSegmentWidth(from, to));

    context.save();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#1f1712';
    context.globalAlpha = 0.12;
    context.lineWidth = width * 1.42;
    context.beginPath();
    context.moveTo(previousMid.x, previousMid.y);
    context.quadraticCurveTo(from.x, from.y, nextMid.x, nextMid.y);
    context.stroke();
    context.restore();

    context.save();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#2f241c';
    context.globalAlpha = 0.96;
    context.lineWidth = width;
    context.beginPath();
    context.moveTo(previousMid.x, previousMid.y);
    context.quadraticCurveTo(from.x, from.y, nextMid.x, nextMid.y);
    context.stroke();
    context.restore();

    liveMidPointRef.current = nextMid;
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      redrawCanvas();
      hasInkRef.current = false;
      setHasInk(false);
    });

    const handleResize = () => {
      if (drawingRef.current) return;
      requestRedraw();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.cancelAnimationFrame(frame);
      if (redrawFrameRef.current !== null) window.cancelAnimationFrame(redrawFrameRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [redrawCanvas, requestRedraw]);

  const pointFromClient = useCallback((clientX: number, clientY: number, pressure = 0.52): SignaturePoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, time: performance.now(), pressure: 0.52 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp(clientX - rect.left, 0, rect.width),
      y: clamp(clientY - rect.top, 0, rect.height),
      time: performance.now(),
      pressure: clamp(pressure > 0 ? pressure : 0.52, 0.25, 0.95),
    };
  }, []);

  const appendPointToActiveStroke = useCallback((point: SignaturePoint) => {
    const stroke = activeStrokeRef.current;
    if (!stroke) return null;

    const last = stroke[stroke.length - 1];
    if (last && distanceBetween(last, point) < 0.85 && point.time - last.time < 18) return null;

    stroke.push(point);
    markHasInk();
    return last ? { from: last, to: point } : null;
  }, [markHasInk]);

  const pointFromEvent = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    return pointFromClient(event.clientX, event.clientY, event.pressure || 0.52);
  }, [pointFromClient]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const prepared = configureCanvas(false);
      if (!prepared) return;
      canvas.setPointerCapture(event.pointerId);
      const point = pointFromEvent(event);
      drawingRef.current = true;
      const stroke: SignatureStroke = [point];
      activeStrokeRef.current = stroke;
      liveMidPointRef.current = point;
      strokesRef.current.push(stroke);
      markHasInk();
      setLocalError('');
      drawLiveDot(prepared.context, point);
    },
    [configureCanvas, drawLiveDot, markHasInk, pointFromEvent],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      event.preventDefault();
      const prepared = configureCanvas(false);
      if (!prepared) return;
      const nativeEvent = event.nativeEvent as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] };
      const events = nativeEvent.getCoalescedEvents?.() ?? [nativeEvent];
      events.forEach((item) => {
        const segment = appendPointToActiveStroke(pointFromClient(item.clientX, item.clientY, item.pressure || event.pressure || 0.52));
        if (segment) drawLiveSegment(prepared.context, segment.from, segment.to);
      });
    },
    [appendPointToActiveStroke, configureCanvas, drawLiveSegment, pointFromClient],
  );

  const stopDrawing = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (drawingRef.current) {
        const prepared = configureCanvas(false);
        const stroke = activeStrokeRef.current;
        const finalPoint = pointFromEvent(event);
        const segment = appendPointToActiveStroke(finalPoint);
        if (prepared && segment) {
          drawLiveSegment(prepared.context, segment.from, segment.to);
        } else if (prepared && stroke && stroke.length === 1) {
          drawLiveDot(prepared.context, stroke[0]);
        } else if (stroke && stroke.length === 1) {
          requestRedraw();
        }
      }
      drawingRef.current = false;
      activeStrokeRef.current = null;
      liveMidPointRef.current = null;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture can already be released by the browser.
      }
    },
    [appendPointToActiveStroke, configureCanvas, drawLiveDot, drawLiveSegment, pointFromEvent, requestRedraw],
  );

  const clearCanvas = useCallback(() => {
    if (isSaving || isExporting) return;
    strokesRef.current = [];
    activeStrokeRef.current = null;
    liveMidPointRef.current = null;
    redrawCanvas();
    hasInkRef.current = false;
    setHasInk(false);
    setLocalError('');
  }, [isExporting, isSaving, redrawCanvas]);

  const handleSave = useCallback(async () => {
    if (isSaving || isExporting) return;
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) {
      setLocalError('Hãy vẽ chữ ký lên bảng trước khi lưu nha.');
      return;
    }

    setIsExporting(true);
    setLocalError('');

    try {
      await waitForPaint();
      const rect = canvas.getBoundingClientRect();
      const canvasSize = canvasSizeRef.current.width > 0
        ? canvasSizeRef.current
        : { width: Math.max(320, rect.width || 920), height: Math.max(220, rect.height || 480) };
      const signatureImage = exportPolishedSignature(strokesRef.current, canvasSize);
      if (!signatureImage) {
        setLocalError('Chữ ký hơi mờ, hãy ký rõ hơn một chút nha.');
        return;
      }
      await waitForPaint();
      await onSave(signatureImage);
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : 'Không thể lưu chữ ký lúc này.');
    } finally {
      setIsExporting(false);
    }
  }, [hasInk, isExporting, isSaving, onSave]);

  return (
    <div
      className="fixed inset-0 z-[98] grid place-items-center bg-[rgba(18,15,13,0.78)] p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Ký tên lên tường chữ ký"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-[1.25rem] border border-white/75 bg-[#fffaf1] p-3 text-ink shadow-[0_26px_80px_rgba(18,15,13,0.34)] sm:p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            <p className="section-kicker">Ký tay</p>
            <h2 className="font-display text-5xl leading-none">{ownSignature ? 'Ký lại chữ ký' : 'Ký cho lớp'}</h2>
          </div>
          <button className="icon-button shrink-0 bg-white/82" onClick={onClose} aria-label="Đóng khung ký">
            <X size={18} />
          </button>
        </div>

        <div className="rounded-[1rem] border border-coffee/10 bg-[#fff7ec] p-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.62)]">
          <canvas
            ref={canvasRef}
            className="h-[min(58svh,30rem)] w-full touch-none rounded-[0.8rem] bg-[linear-gradient(0deg,rgba(122,86,57,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(122,86,57,0.055)_1px,transparent_1px)] bg-[length:22px_22px] shadow-inner sm:h-[30rem]"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDrawing}
            onPointerCancel={stopDrawing}
            onLostPointerCapture={stopDrawing}
            aria-label="Khung vẽ chữ ký"
          />
        </div>

        {(localError || error) && (
          <p className="mt-3 rounded-[0.9rem] bg-blush/24 px-3 py-2 text-xs font-bold leading-5 text-coffee">
            {localError || error}
          </p>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
          <button className="primary-button min-h-12 justify-center" onClick={() => void handleSave()} disabled={isSaving || isExporting || !hasInk}>
            <BookOpen size={17} />
            {isExporting ? 'Đang làm nét...' : isSaving ? 'Đang lưu...' : ownSignature ? 'Lưu chữ ký mới' : 'Dán lên tường'}
          </button>
          <button className="secondary-button min-h-12 justify-center" onClick={clearCanvas} disabled={isSaving || isExporting}>
            <RotateCcw size={16} />
            Xóa nét
          </button>
        </div>
      </div>
    </div>
  );
}
