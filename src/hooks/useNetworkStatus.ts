import { useEffect, useRef, useState } from 'react';

const getOnlineStatus = () => (typeof navigator === 'undefined' ? true : navigator.onLine);

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(getOnlineStatus);
  const [justRestored, setJustRestored] = useState(false);
  const wasOfflineRef = useRef(!getOnlineStatus());
  const restoredTimerRef = useRef(0);

  useEffect(() => {
    const clearRestoredTimer = () => {
      if (!restoredTimerRef.current) return;
      window.clearTimeout(restoredTimerRef.current);
      restoredTimerRef.current = 0;
    };

    const handleOffline = () => {
      clearRestoredTimer();
      wasOfflineRef.current = true;
      setJustRestored(false);
      setIsOnline(false);
    };

    const handleOnline = () => {
      setIsOnline(true);

      if (!wasOfflineRef.current) return;

      wasOfflineRef.current = false;
      setJustRestored(true);
      clearRestoredTimer();
      restoredTimerRef.current = window.setTimeout(() => {
        restoredTimerRef.current = 0;
        setJustRestored(false);
      }, 3200);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.onLine) handleOnline();
    else handleOffline();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearRestoredTimer();
    };
  }, []);

  return { isOnline, justRestored };
};
