import { APP_VERSION } from '../appVersion';
import { isStandaloneMode } from '../pwaInstallPrompt';
import { showAppUpdateOverlay } from './appUpdateRecovery';

const VERSION_CHECK_INTERVAL = 90_000;
const INITIAL_VERSION_CHECK_DELAY = 1_800;
const VERSION_RELOAD_KEY = 'memory98-version-reload-for';

type RemoteVersion = {
  version?: string;
};

const getVersionUrl = () => {
  const baseUrl = new URL(import.meta.env.BASE_URL || './', window.location.href);
  const versionUrl = new URL('app-version.json', baseUrl);
  versionUrl.searchParams.set('t', Date.now().toString(36));
  return versionUrl.toString();
};

const fetchRemoteVersion = async () => {
  const response = await fetch(getVersionUrl(), {
    cache: 'no-store',
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  });

  if (!response.ok) return null;

  const data = (await response.json()) as RemoteVersion;
  return typeof data.version === 'string' && data.version.trim() ? data.version.trim() : null;
};

const clearAppCaches = async () => {
  if (!('caches' in window)) return;

  const names = await caches.keys();
  await Promise.all(names.filter((name) => name.startsWith('memory98-app-shell')).map((name) => caches.delete(name)));
};

const refreshServiceWorkers = async () => {
  if (!('serviceWorker' in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.update().catch(() => undefined)));
};

const reloadFresh = (version: string) => {
  const url = new URL(window.location.href);
  url.searchParams.set('appVersion', version);
  window.location.replace(url.toString());
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
        return;
      }

      if (window.sessionStorage.getItem(VERSION_RELOAD_KEY) === remoteVersion) return;

      window.sessionStorage.setItem(VERSION_RELOAD_KEY, remoteVersion);
      showAppUpdateOverlay('Đang tải bản mới nhất...');
      await Promise.all([clearAppCaches(), refreshServiceWorkers()]);
      window.setTimeout(() => reloadFresh(remoteVersion), 700);
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
