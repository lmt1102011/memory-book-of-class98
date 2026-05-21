import { useEffect, useMemo, useState } from 'react';

export type InstallPlatform = 'android' | 'ios' | 'desktop';

type InstallOutcome = 'accepted' | 'dismissed' | 'manual' | 'installed' | 'unavailable';

type BeforeInstallPromptChoice = {
  outcome: 'accepted' | 'dismissed';
  platform: string;
};

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<BeforeInstallPromptChoice>;
  prompt: () => Promise<void>;
}

const isStandaloneMode = () => {
  if (typeof window === 'undefined') return false;

  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
};

const detectInstallPlatform = (): InstallPlatform => {
  if (typeof window === 'undefined') return 'desktop';

  const userAgent = window.navigator.userAgent.toLowerCase();
  const platform = window.navigator.platform.toLowerCase();
  const isTouchMac = platform.includes('mac') && window.navigator.maxTouchPoints > 1;

  if (/iphone|ipad|ipod/.test(userAgent) || isTouchMac) return 'ios';
  if (userAgent.includes('android')) return 'android';
  return 'desktop';
};

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(() => isStandaloneMode());
  const [platform, setPlatform] = useState<InstallPlatform>(() => detectInstallPlatform());

  useEffect(() => {
    const updateInstalledState = () => {
      setIsInstalled(isStandaloneMode());
      setPlatform(detectInstallPlatform());
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    updateInstalledState();
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener('resize', updateInstalledState);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener('resize', updateInstalledState);
    };
  }, []);

  const canPrompt = Boolean(deferredPrompt) && !isInstalled;

  const install = useMemo(
    () => async (): Promise<InstallOutcome> => {
      if (isInstalled) return 'installed';
      if (!deferredPrompt) return 'manual';

      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        setDeferredPrompt(null);

        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
        }

        return choice.outcome;
      } catch {
        setDeferredPrompt(null);
        return 'unavailable';
      }
    },
    [deferredPrompt, isInstalled],
  );

  return {
    canPrompt,
    install,
    isInstalled,
    platform,
  };
}
