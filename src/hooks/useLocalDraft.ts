import { useCallback, useEffect, useRef, useState } from 'react';

const readDraft = (key: string, fallback: string) => {
  if (!key || typeof window === 'undefined') return { value: fallback, restored: false };

  try {
    const stored = window.localStorage.getItem(key);
    return stored === null ? { value: fallback, restored: false } : { value: stored, restored: stored.trim().length > 0 };
  } catch {
    return { value: fallback, restored: false };
  }
};

export function useLocalDraft(key: string, fallback = '') {
  const initial = readDraft(key, fallback);
  const [value, setValue] = useState(initial.value);
  const [restored, setRestored] = useState(initial.restored);
  const skipNextPersistRef = useRef(true);

  useEffect(() => {
    const next = readDraft(key, fallback);
    skipNextPersistRef.current = true;
    setValue(next.value);
    setRestored(next.restored);
  }, [fallback, key]);

  useEffect(() => {
    if (!key) return undefined;

    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return undefined;
    }

    const timer = window.setTimeout(() => {
      try {
        if (value.trim()) {
          window.localStorage.setItem(key, value);
          return;
        }

        window.localStorage.removeItem(key);
      } catch {
        // Local drafts are a convenience only; Firebase flows should not fail because storage is blocked.
      }
    }, 360);

    return () => window.clearTimeout(timer);
  }, [key, value]);

  const clearDraft = useCallback(() => {
    setValue('');
    setRestored(false);
    if (!key) return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore unavailable localStorage.
    }
  }, [key]);

  return {
    value,
    setValue,
    clearDraft,
    hasDraft: value.trim().length > 0,
    restored,
  };
}
