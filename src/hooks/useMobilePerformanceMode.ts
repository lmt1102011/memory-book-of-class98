import { useEffect, useState } from 'react';

const isMobilePerformanceViewport = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(max-width: 767px), (pointer: coarse) and (max-width: 900px)').matches;

export const useMobilePerformanceMode = () => {
  const [enabled, setEnabled] = useState(() => isMobilePerformanceViewport());

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px), (pointer: coarse) and (max-width: 900px)');
    const update = () => setEnabled(media.matches);

    update();
    media.addEventListener('change', update);

    return () => media.removeEventListener('change', update);
  }, []);

  return enabled;
};
