import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { BookOpen, RotateCcw, Sparkles, Trash2, UserRound, X } from 'lucide-react';
import FirebaseNotice from '../components/FirebaseNotice';
import type { ClassSignature, UserProfile } from '../types';
import { formatUploadTime } from '../utils/date';

interface SignatureWallPageProps {
  signatures: ClassSignature[];
  firebaseNotice: string;
  profile: UserProfile | null;
  onJoin: () => void;
  onSaveSignature: (imageDataUrl: string) => void | Promise<void>;
  onDeleteSignature: () => void | Promise<void>;
}

const signatureWallRotation = (index: number) => {
  const rotations = [-1.8, 1.2, -0.7, 1.7, -1.1, 0.8, -1.4, 1.4];
  return rotations[index % rotations.length];
};

const SIGNATURE_STROKE_WIDTH = 4.4;

const exportTightSignature = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return '';

  const { width, height } = canvas;
  const pixels = context.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = pixels[(y * width + x) * 4 + 3];
      if (alpha <= 8) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (minX > maxX || minY > maxY) return '';

  const padding = Math.max(30, Math.round(Math.max(maxX - minX, maxY - minY) * 0.16));
  const sourceX = Math.max(0, minX - padding);
  const sourceY = Math.max(0, minY - padding);
  const sourceWidth = Math.min(width - sourceX, maxX - minX + 1 + padding * 2);
  const sourceHeight = Math.min(height - sourceY, maxY - minY + 1 + padding * 2);
  const output = document.createElement('canvas');
  output.width = 1200;
  output.height = 420;
  const outputContext = output.getContext('2d');
  if (!outputContext) return '';

  outputContext.clearRect(0, 0, output.width, output.height);
  outputContext.imageSmoothingEnabled = true;
  outputContext.imageSmoothingQuality = 'high';

  const fitScale = Math.min((output.width * 0.9) / sourceWidth, (output.height * 0.72) / sourceHeight);
  const drawWidth = Math.max(1, Math.round(sourceWidth * fitScale));
  const drawHeight = Math.max(1, Math.round(sourceHeight * fitScale));
  const drawX = Math.round((output.width - drawWidth) / 2);
  const drawY = Math.round((output.height - drawHeight) / 2);

  outputContext.save();
  outputContext.globalAlpha = 0.2;
  outputContext.filter = 'blur(0.55px)';
  outputContext.drawImage(canvas, sourceX, sourceY, sourceWidth, sourceHeight, drawX, drawY, drawWidth, drawHeight);
  outputContext.restore();

  outputContext.save();
  outputContext.globalAlpha = 0.98;
  outputContext.filter = 'contrast(108%)';
  outputContext.drawImage(canvas, sourceX, sourceY, sourceWidth, sourceHeight, drawX, drawY, drawWidth, drawHeight);
  outputContext.restore();

  return output.toDataURL('image/webp', 0.93);
};

export default function SignatureWallPage({
  signatures,
  firebaseNotice,
  profile,
  onJoin,
  onSaveSignature,
  onDeleteSignature,
}: SignatureWallPageProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedSignature, setSelectedSignature] = useState<ClassSignature | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saveError, setSaveError] = useState('');

  const ownSignature = useMemo(
    () => (profile ? signatures.find((signature) => signature.nameKey === profile.nameKey || signature.uid === profile.uid) : undefined),
    [profile, signatures],
  );
  const visibleSignatures = signatures.slice(0, 120);

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
    if (!window.confirm('Xóa chữ ký của bạn khỏi bảng lớp?')) return;

    setIsDeleting(true);
    setSaveError('');
    try {
      await onDeleteSignature();
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : 'Không thể xóa chữ ký lúc này.');
    } finally {
      setIsDeleting(false);
    }
  }, [onDeleteSignature, ownSignature]);

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
                  className="relative min-h-[7.5rem] rounded-[0.85rem] bg-[#fffaf1] p-2 text-left shadow-[0_12px_24px_rgba(18,15,13,0.2)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_28px_rgba(18,15,13,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper"
                  style={{ transform: `rotate(${signatureWallRotation(index)}deg)` }}
                  onClick={() => setSelectedSignature(signature)}
                  aria-label={`Xem chữ ký của ${signature.name}`}
                >
                  <span className="absolute left-1/2 top-1 h-4 w-14 -translate-x-1/2 rotate-1 rounded-sm bg-[#f7d6a4]/82 shadow-sm" />
                  <div className="grid h-[4.9rem] place-items-center overflow-hidden rounded-[0.65rem] bg-white/82 p-1.5">
                    <img
                      src={signature.imageDataUrl}
                      alt={`Chữ ký của ${signature.name}`}
                      className="block h-full w-full object-contain"
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
  const lastPointRef = useRef({ x: 0, y: 0 });
  const [hasInk, setHasInk] = useState(false);
  const [localError, setLocalError] = useState('');

  const markHasInk = useCallback(() => {
    if (hasInkRef.current) return;
    hasInkRef.current = true;
    setHasInk(true);
  }, []);

  const prepareCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const pixelRatio = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2.5);
    const width = Math.max(320, Math.round((rect.width || 920) * pixelRatio));
    const height = Math.max(220, Math.round((rect.height || 480) * pixelRatio));
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#35291f';
    context.fillStyle = '#35291f';
    context.lineWidth = SIGNATURE_STROKE_WIDTH;
    context.miterLimit = 2;
    context.shadowColor = 'rgba(53,41,31,0.1)';
    context.shadowBlur = 0.25;
    context.shadowOffsetY = 0.25;
    return { canvas, context };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      prepareCanvas();
      hasInkRef.current = false;
      setHasInk(false);
    });

    const handleResize = () => {
      if (drawingRef.current) return;
      prepareCanvas();
      hasInkRef.current = false;
      setHasInk(false);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleResize);
    };
  }, [prepareCanvas]);

  const pointFromClient = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  const drawToPoint = useCallback((point: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const last = lastPointRef.current;
    const controlX = (last.x + point.x) / 2;
    const controlY = (last.y + point.y) / 2;
    context.beginPath();
    context.moveTo(last.x, last.y);
    context.quadraticCurveTo(controlX, controlY, point.x, point.y);
    context.stroke();
    lastPointRef.current = point;
    markHasInk();
  }, [markHasInk]);

  const pointFromEvent = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    return pointFromClient(event.clientX, event.clientY);
  }, [pointFromClient]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context) return;
      canvas.setPointerCapture(event.pointerId);
      const point = pointFromEvent(event);
      drawingRef.current = true;
      lastPointRef.current = point;
      context.beginPath();
      context.arc(point.x, point.y, context.lineWidth / 2, 0, Math.PI * 2);
      context.fill();
      markHasInk();
      setLocalError('');
    },
    [markHasInk, pointFromEvent],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      event.preventDefault();
      const nativeEvent = event.nativeEvent as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] };
      const events = nativeEvent.getCoalescedEvents?.() ?? [nativeEvent];
      events.forEach((item) => drawToPoint(pointFromClient(item.clientX, item.clientY)));
    },
    [drawToPoint, pointFromClient],
  );

  const stopDrawing = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (drawingRef.current) {
        drawToPoint(pointFromEvent(event));
      }
      drawingRef.current = false;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture can already be released by the browser.
      }
    },
    [drawToPoint, pointFromEvent],
  );

  const clearCanvas = useCallback(() => {
    prepareCanvas();
    hasInkRef.current = false;
    setHasInk(false);
    setLocalError('');
  }, [prepareCanvas]);

  const handleSave = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) {
      setLocalError('Hãy vẽ chữ ký lên bảng trước khi lưu nha.');
      return;
    }

    try {
      const signatureImage = exportTightSignature(canvas);
      if (!signatureImage) {
        setLocalError('Chữ ký hơi mờ, hãy ký rõ hơn một chút nha.');
        return;
      }
      await onSave(signatureImage);
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : 'Không thể lưu chữ ký lúc này.');
    }
  }, [hasInk, onSave]);

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
          <button className="primary-button min-h-12 justify-center" onClick={() => void handleSave()} disabled={isSaving || !hasInk}>
            <BookOpen size={17} />
            {isSaving ? 'Đang lưu...' : ownSignature ? 'Lưu chữ ký mới' : 'Dán lên tường'}
          </button>
          <button className="secondary-button min-h-12 justify-center" onClick={clearCanvas} disabled={isSaving}>
            <RotateCcw size={16} />
            Xóa nét
          </button>
        </div>
      </div>
    </div>
  );
}
