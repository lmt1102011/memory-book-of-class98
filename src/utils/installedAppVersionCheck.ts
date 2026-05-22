import { APP_VERSION } from '../appVersion';
import { isStandaloneMode } from '../pwaInstallPrompt';
import { showAppUpdateOverlay } from './appUpdateRecovery';

const VERSION_CHECK_INTERVAL = 90_000;
const INITIAL_VERSION_CHECK_DELAY = 1_800;
const VERSION_RELOAD_KEY = 'memory98-version-reload-for';
const VERSION_RELOAD_AT_KEY = 'memory98-version-reload-at';
const VERSION_RELOAD_COOLDOWN = 12_000;

type RemoteVersion = {
  version?: string;
};

const getVersionUrl = () => {
  const baseUrl = new URL(import.meta.env.BASE_URL || './', window.location.href);
  const versionUrl = new URL('app-version.json', baseUrl);
  versionUrl.searchParams.set('t', Date.now().toString(36));
  return versionUrl.toString();
};

const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, fallback: T) =>
  new Promise<T>((resolve) => {
    const timer = window.setTimeout(() => resolve(fallback), timeoutMs);

    promise
      .then((value) => resolve(value))
      .catch(() => resolve(fallback))
      .finally(() => window.clearTimeout(timer));
  });

const fetchRemoteVersion = async () => {
  const response = await withTimeout(
    fetch(getVersionUrl(), {
      cache: 'no-store',
      headers: {
        'cache-control': 'no-cache',
        pragma: 'no-cache',
      },
    }),
    3_500,
    null as Response | null,
  );

  if (!response?.ok) return null;

  const data = (await response.json().catch(() => null)) as RemoteVersion | null;
  return typeof data?.version === 'string' && data.version.trim() ? data.version.trim() : null;
};

const clearAppCaches = async () => {
  if (!('caches' in window)) return;

  const names = await caches.keys();
  await Promise.allSettled(names.filter((name) => name.startsWith('memory98-app-shell')).map((name) => caches.delete(name)));
};

const refreshServiceWorkers = async () => {
  if (!('serviceWorker' in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(registrations.map((registration) => registration.update()));
};

const reloadFresh = (version: string) => {
  const url = new URL(window.location.href);
  url.searchParams.set('appVersion', version);
  url.searchParams.set('refreshAt', Date.now().toString(36));
  window.location.replace(url.toString());
};

const shouldThrottleReload = (version: string) => {
  const lastVersion = window.sessionStorage.getItem(VERSION_RELOAD_KEY);
  const lastReloadAt = Number(window.sessionStorage.getItem(VERSION_RELOAD_AT_KEY) || 0);
  return lastVersion === version && Date.now() - lastReloadAt < VERSION_RELOAD_COOLDOWN;
};

const markReloadAttempt = (version: string) => {
  window.sessionStorage.setItem(VERSION_RELOAD_KEY, version);
  window.sessionStorage.setItem(VERSION_RELOAD_AT_KEY, String(Date.now()));
};

export const installInstalledAppVersionCheck = () => {
  if (import.meta.env.DEV || !isStandaloneMode()) return;

  let lastCheckAt = 0;
  let isChecking = false;

  const checkVersion = async (force = false) => {
    const now = Date.now();
    if (isChecking || (!force && now - lastCheckAt < VERSION_CHECK_INTERVAL)) return;

    isChecking = true;
    lastCheckAt = now;

    try {
      const remoteVersion = await fetchRemoteVersion();
      if (!remoteVersion || remoteVersion === APP_VERSION) {
        window.sessionStorage.removeItem(VERSION_RELOAD_KEY);
        window.sessionStorage.removeItem(VERSION_RELOAD_AT_KEY);
        return;
      }

      if (shouldThrottleReload(remoteVersion)) return;

      markReloadAttempt(remoteVersion);
      showAppUpdateOverlay('Đang mở bản mới nhất...');

      window.setTimeout(() => reloadFresh(remoteVersion), 650);
      void Promise.race([
        Promise.allSettled([clearAppCaches(), refreshServiceWorkers()]),
        new Promise((resolve) => {
          window.setTimeout(resolve, 2_000);
        }),
      ]);
    } catch {
      // Version checks must never block opening the app.
    } finally {
      isChecking = false;
    }
  };

  window.setTimeout(() => void checkVersion(true), INITIAL_VERSION_CHECK_DELAY);
  window.addEventListener('focus', () => void checkVersion());
  window.addEventListener('online', () => void checkVersion(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkVersion();
  });
};
