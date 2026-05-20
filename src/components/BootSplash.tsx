import { m } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

interface BootSplashProps {
  logoSrc: string;
  onComplete: () => void;
}

const getProgressLabel = (progress: number) => {
  if (progress < 34) return 'Đang mở logo lớp 9/8';
  if (progress < 72) return 'Đang chuẩn bị cuốn sổ ký ức';
  if (progress < 98) return 'Đang đưa bạn vào intro';
  return 'Sẵn sàng';
};

export default function BootSplash({ logoSrc, onComplete }: BootSplashProps) {
  const [progress, setProgress] = useState(0);
  const prefersReducedMotion = usePrefersReducedMotion();
  const completedRef = useRef(false);

  const progressLabel = useMemo(() => getProgressLabel(progress), [progress]);

  useEffect(() => {
    let animationFrame = 0;
    let finishTimer = 0;
    let completeTimer = 0;
    completedRef.current = false;
    const start = performance.now();
    const minDuration = prefersReducedMotion ? 1200 : 3600;
    const maxDuration = prefersReducedMotion ? 1800 : 5200;

    const waitForWindowLoad = new Promise<void>((resolve) => {
      if (document.readyState === 'complete') {
        resolve();
        return;
      }

      window.addEventListener('load', () => resolve(), { once: true });
    });

    const fontSet = 'fonts' in document ? (document as Document & { fonts: { ready: Promise<unknown> } }).fonts : null;
    const waitForFonts = fontSet?.ready.then(() => undefined).catch(() => undefined) ?? Promise.resolve();

    const waitForLogo = new Promise<void>((resolve) => {
      const image = new Image();
      image.onload = () => {
        void image.decode?.().then(() => resolve()).catch(() => resolve());
        if (!image.decode) resolve();
      };
      image.onerror = () => resolve();
      image.src = logoSrc;
    });

    const timeout = new Promise<void>((resolve) => {
      window.setTimeout(resolve, maxDuration);
    });

    const finish = () => {
      if (completedRef.current) return;

      const elapsed = performance.now() - start;
      const remaining = Math.max(0, minDuration - elapsed);

      finishTimer = window.setTimeout(() => {
        completedRef.current = true;
        setProgress(100);
        completeTimer = window.setTimeout(onComplete, prefersReducedMotion ? 320 : 980);
      }, remaining);
    };

    Promise.race([Promise.all([waitForWindowLoad, waitForFonts, waitForLogo]), timeout]).then(finish);

    const tick = (time: number) => {
      if (completedRef.current) return;

      const elapsed = time - start;
      const durationProgress = Math.min(elapsed / minDuration, 1);
      const smoothProgress = durationProgress * durationProgress * (3 - 2 * durationProgress);
      const loadingBoost = 1 - Math.exp(-elapsed / 1600);
      const nextProgress = Math.min(96, 6 + smoothProgress * 72 + loadingBoost * 18);

      setProgress((current) => Math.max(current, nextProgress));
      animationFrame = window.requestAnimationFrame(tick);
    };

    animationFrame = window.requestAnimationFrame(tick);

    return () => {
      completedRef.current = true;
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(finishTimer);
      window.clearTimeout(completeTimer);
    };
  }, [logoSrc, onComplete, prefersReducedMotion]);

  return (
    <m.div
      className="fixed inset-0 z-[90] grid min-h-[100svh] place-items-center overflow-hidden bg-cream px-5 py-8 text-ink"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: prefersReducedMotion ? 1 : 1.018 }}
      transition={{ duration: prefersReducedMotion ? 0.08 : 0.95, ease: 'easeInOut' }}
      aria-label="Đang tải Memory Book"
      role="status"
    >
      <div className="absolute inset-0 bg-paper opacity-90" aria-hidden="true" />
      <div
        className="absolute -left-20 top-10 h-56 w-56 rounded-full bg-blush/30 blur-3xl sm:h-72 sm:w-72"
        aria-hidden="true"
      />
      <div
        className="absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-skySoft/30 blur-3xl sm:h-80 sm:w-80"
        aria-hidden="true"
      />

      <m.div
        className="relative w-full max-w-xl text-center"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 14, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.68, ease: 'easeOut' }}
      >
        <div className="mx-auto grid h-[clamp(10.5rem,42vw,18rem)] w-[clamp(10.5rem,42vw,18rem)] place-items-center rounded-[2rem] border border-white/70 bg-white/68 p-5 shadow-glass backdrop-blur-xl">
          <m.img
            src={logoSrc}
            alt="Logo Class 98"
            className="h-full w-full object-contain"
            loading="eager"
            decoding="async"
            initial={prefersReducedMotion ? false : { scale: 0.92, opacity: 0 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1, y: [0, -5, 0] }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : {
                    opacity: { duration: 0.58 },
                    scale: { duration: 0.72, ease: 'easeOut' },
                    y: { duration: 3.4, repeat: Infinity, ease: 'easeInOut' },
                  }
            }
          />
        </div>

        <p className="mt-7 text-xs font-black uppercase tracking-[0.24em] text-coffee/70">Class 98 Memory Book</p>
        <h1 className="mt-2 font-display text-6xl leading-none text-ink sm:text-8xl">Memory98</h1>
        <p className="mx-auto mt-3 max-w-sm font-hand text-3xl leading-tight text-coffee sm:text-4xl">
          Mở lại một trang thanh xuân thật chậm.
        </p>

        <div className="mx-auto mt-7 w-full max-w-md">
          <div className="h-3 overflow-hidden rounded-full bg-coffee/12 p-1 shadow-[inset_0_1px_4px_rgba(53,41,31,0.12)]">
            <m.div
              className="boot-progress-fill h-full rounded-full bg-ink"
              style={{ width: `${progress}%` }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs font-bold text-coffee/72">
            <span>{progressLabel}</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>
      </m.div>
    </m.div>
  );
}
