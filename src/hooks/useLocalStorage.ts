import { Dispatch, SetStateAction, useCallback, useEffect, useState } from 'react';

type StoredValue<T> = T | (() => T);

const resolveInitial = <T,>(value: StoredValue<T>) => (value instanceof Function ? value() : value);

export const useLocalStorage = <T,>(
  key: string,
  initialValue: StoredValue<T>,
): [T, Dispatch<SetStateAction<T>>] => {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : resolveInitial(initialValue);
    } catch {
      return resolveInitial(initialValue);
    }
  });

  const setStoredValue = useCallback<Dispatch<SetStateAction<T>>>(
    (nextValue) => {
      setValue((previous) => {
        const resolved = nextValue instanceof Function ? nextValue(previous) : nextValue;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // Storage can be unavailable or full in private browsing. The app still works in memory.
        }
        return resolved;
      });
    },
    [key],
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Non-fatal; keep the in-memory state.
    }
  }, [key, value]);

  return [value, setStoredValue];
};
