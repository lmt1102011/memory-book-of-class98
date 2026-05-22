const CHUNK_RELOAD_KEY = 'memory98-chunk-reload-at';
const CHUNK_RELOAD_COOLDOWN = 20_000;

const chunkErrorPatterns = [
  'failed to fetch dynamically imported module',
  'importing a module script failed',
  'error loading dynamically imported module',
  'failed to load module script',
  'loading chunk',
  'module script load',
];

const getErrorText = (error: unknown) => {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return `${error.name} ${error.message} ${error.stack ?? ''}`;

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const isChunkLoadError = (error: unknown) => {
  const text = getErrorText(error).toLowerCase();
  return chunkErrorPatterns.some((pattern) => text.includes(pattern));
};

export const showAppUpdateOverlay = (label = 'Đang cập nhật phiên bản mới nhất...') => {
  if (typeof document === 'undefined') return;

  const existing = document.getElementById('memory98-update-overlay');
  if (existing) {
    const labelNode = existing.querySelector('[data-update-label]');
    if (labelNode) labelNode.textContent = label;
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'memory98-update-overlay';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.innerHTML = `
    <div class="memory98-update-card">
      <img src="./logo-web-class-98.png" alt="Memory98" />
      <p data-update-label>${label}</p>
      <span>Memory98 sẽ mở lại ngay sau khi lấy xong bản mới.</span>
      <div class="memory98-update-bar"><i></i></div>
    </div>
  `;

  const style = document.createElement('style');
  style.id = 'memory98-update-style';
  style.textContent = `
    #memory98-update-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: grid;
      place-items: center;
      padding: 24px;
      background: #fbf3e7;
      color: #4f3428;
      font-family: Poppins, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    #memory98-update-overlay .memory98-update-card {
      width: min(360px, 100%);
      padding: 26px 22px 22px;
      border: 1px solid rgba(79, 52, 40, 0.12);
      border-radius: 24px;
      background: rgba(255, 252, 246, 0.96);
      box-shadow: 0 24px 70px rgba(79, 52, 40, 0.16);
      text-align: center;
    }

    #memory98-update-overlay img {
      width: 92px;
      height: 92px;
      object-fit: contain;
      border-radius: 26px;
      background: #fff7ee;
      box-shadow: 0 12px 28px rgba(79, 52, 40, 0.14);
    }

    #memory98-update-overlay p {
      margin: 18px 0 6px;
      font-size: 18px;
      font-weight: 800;
      line-height: 1.35;
    }

    #memory98-update-overlay span {
      display: block;
      color: rgba(79, 52, 40, 0.68);
      font-size: 13px;
      line-height: 1.6;
    }

    #memory98-update-overlay .memory98-update-bar {
      height: 8px;
      margin-top: 18px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(79, 52, 40, 0.12);
    }

    #memory98-update-overlay .memory98-update-bar i {
      display: block;
      width: 48%;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #f4a7b9, #8bbde8, #d7a979);
      animation: memory98-update-progress 1.15s ease-in-out infinite;
      transform: translate3d(-110%, 0, 0);
    }

    @keyframes memory98-update-progress {
      to {
        transform: translate3d(230%, 0, 0);
      }
    }
  `;

  if (!document.getElementById('memory98-update-style')) {
    document.head.appendChild(style);
  }

  document.body.appendChild(overlay);
};

const clearRuntimeCaches = async () => {
  if (!('caches' in window) || !navigator.onLine) return;

  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter((name) => name.startsWith('memory98-app-shell'))
      .map((name) => caches.delete(name)),
  );
};

const reloadWithFreshUrl = () => {
  const url = new URL(window.location.href);
  url.searchParams.set('fresh', Date.now().toString(36));
  window.location.replace(url.toString());
};

const recoverFromChunkError = async () => {
  const lastReload = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
  const now = Date.now();
  if (now - lastReload < CHUNK_RELOAD_COOLDOWN) return;

  window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
  showAppUpdateOverlay('Đang lấy lại phiên bản mới nhất...');

  try {
    await Promise.all([
      clearRuntimeCaches(),
      navigator.serviceWorker?.getRegistration().then((registration) => registration?.update()).catch(() => undefined),
    ]);
  } catch {
    // If cache cleanup is blocked, a fresh navigation is still the best recovery path.
  }

  window.setTimeout(reloadWithFreshUrl, 650);
};

export const installUpdateRecovery = () => {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    void recoverFromChunkError();
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (!isChunkLoadError(event.reason)) return;

    event.preventDefault();
    void recoverFromChunkError();
  });

  window.addEventListener(
    'error',
    (event) => {
      if (!isChunkLoadError(event.error || event.message)) return;

      event.preventDefault();
      void recoverFromChunkError();
    },
    true,
  );
};
