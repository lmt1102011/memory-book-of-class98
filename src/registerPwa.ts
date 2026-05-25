import { showAppUpdateOverlay } from './utils/appUpdateRecovery';
import { isStandaloneMode } from './pwaInstallPrompt';

const SW_VERSION = '20260525-signature-brush-polish-1';
const UPDATE_CHECK_INTERVAL = 60_000;
const UPDATE_RELOAD_DELAY = 850;
const INITIAL_UPDATE_CHECK_DELAY = 1_500;

export const registerPwa = () => {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;

  const register = () => {
    const baseUrl = new URL(import.meta.env.BASE_URL || './', window.location.href);
    const swUrl = new URL(`sw.js?v=${SW_VERSION}`, baseUrl).toString();
    const shouldAutoUpdate = isStandaloneMode();
    let shouldReloadForUpdate = false;
    let hasReloadedForUpdate = false;
    let lastUpdateCheck = 0;

    const activateWaitingWorker = (registration: ServiceWorkerRegistration) => {
      if (!registration.waiting || !navigator.serviceWorker.controller) return;

      shouldReloadForUpdate = true;
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    };

    const watchInstallingWorker = (registration: ServiceWorkerRegistration) => {
      const worker = registration.installing;
      if (!worker) return;

      worker.addEventListener('statechange', () => {
        if (worker.state !== 'installed' || !navigator.serviceWorker.controller) return;

        shouldReloadForUpdate = true;
        worker.postMessage({ type: 'SKIP_WAITING' });
      });
    };

    const checkForUpdate = (registration: ServiceWorkerRegistration, force = false) => {
      const now = Date.now();
      if (!force && now - lastUpdateCheck < UPDATE_CHECK_INTERVAL) return;

      lastUpdateCheck = now;
      void registration.update().then(() => activateWaitingWorker(registration)).catch(() => undefined);
    };

    navigator.serviceWorker
      .register(swUrl, { scope: baseUrl.pathname, updateViaCache: 'none' })
      .then((registration) => {
        if (!shouldAutoUpdate) {
          void registration.update().catch(() => undefined);
          return;
        }

        activateWaitingWorker(registration);
        watchInstallingWorker(registration);
        window.setTimeout(() => checkForUpdate(registration, true), INITIAL_UPDATE_CHECK_DELAY);

        registration.addEventListener('updatefound', () => {
          watchInstallingWorker(registration);
        });

        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!shouldReloadForUpdate || hasReloadedForUpdate) return;

          hasReloadedForUpdate = true;
          showAppUpdateOverlay();
          window.setTimeout(() => window.location.reload(), UPDATE_RELOAD_DELAY);
        });

        window.addEventListener('focus', () => checkForUpdate(registration));
        window.addEventListener('online', () => checkForUpdate(registration, true));
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkForUpdate(registration);
        });
      })
      .catch(() => {
        // The app must keep working even when the browser refuses service workers.
      });
  };

  register();
};
