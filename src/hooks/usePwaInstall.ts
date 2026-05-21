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
      if (!deferredPrompt) return 'manual';

      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        clearDeferredPwaInstallPrompt();

        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
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
