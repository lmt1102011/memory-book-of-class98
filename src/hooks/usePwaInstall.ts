import { useEffect, useMemo, useState } from 'react';
import {
  clearDeferredPwaInstallPrompt,
  detectInstallPlatform,
  getDeferredPwaInstallPrompt,
  isStandaloneMode,
  type BeforeInstallPromptEvent,
  type InstallOutcome,
  type InstallPlatform,
  subscribePwaInstallPrompt,
  waitForPwaInstallPrompt,
} from '../pwaInstallPrompt';

export type { InstallPlatform } from '../pwaInstallPrompt';

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => getDeferredPwaInstallPrompt());
  const [isInstalled, setIsInstalled] = useState(() => isStandaloneMode());
  const [platform, setPlatform] = useState<InstallPlatform>(() => detectInstallPlatform());

  useEffect(() => {
    const updateInstalledState = () => {
      setIsInstalled(isStandaloneMode());
      setPlatform(detectInstallPlatform());
    };

    const handleInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    updateInstalledState();
    const unsubscribePrompt = subscribePwaInstallPrompt(setDeferredPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener('resize', updateInstalledState);

    return () => {
      unsubscribePrompt();
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener('resize', updateInstalledState);
    };
  }, []);

  const canPrompt = Boolean(deferredPrompt) && !isInstalled;

  const install = useMemo(
    () => async (): Promise<InstallOutcome> => {
      if (isInstalled) return 'installed';
      const prompt = deferredPrompt ?? (await waitForPwaInstallPrompt());
      if (!prompt) return 'manual';

      try {
        const startedAt = performance.now();
        await prompt.prompt();
        const choice = await prompt.userChoice;
        const elapsed = performance.now() - startedAt;
        clearDeferredPwaInstallPrompt();

        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
        }

        if (choice.outcome === 'dismissed' && elapsed < 450) {
          return 'unavailable';
        }

        return choice.outcome;
      } catch {
        clearDeferredPwaInstallPrompt();
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
