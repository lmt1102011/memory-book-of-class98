import { useEffect, useState } from 'react';

export const useRafScrollProgress = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const shouldSkipMotion = window.matchMedia('(max-width: 767px), (prefers-reduced-motion: reduce)');
    if (shouldSkipMotion.matches) {
      setProgress(0);
      return undefined;
    }

    let frame = 0;

    const update = () => {
      frame = 0;
      const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      setProgress(Math.min(window.scrollY / max, 1));
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    update();

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return progress;
};
