import { isStandaloneMode } from '../pwaInstallPrompt';

const CHUNK_RELOAD_KEY = 'memory98-chunk-reload-at';
const CHUNK_RELOAD_COOLDOWN = 20_000;

const chunkErrorPatterns = [
  'failed to fetch dynamically imported module',
  'importing a module script failed',
  'error loading dynamically imported module',
  'failed to load module script',
  'loading chunk',
  'module script load',
  'asset missing',
  'asset 404',
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
  if (chunkErrorPatterns.some((pattern) => text.includes(pattern))) return true;

  return (
    text.includes('cannot read properties of undefined')
    && text.includes('default')
    && (text.includes('/assets/') || text.includes('motion-') || text.includes('react-') || text.includes('lazy') || text.includes('module'))
  );
};

export const showAppUpdateOverlay = (label = 'Đang cập nhật phiên bản mới nhất...') => {
  if (typeof document === 'undefined' || !isStandaloneMode()) return;

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
      <span>Nếu màn hình đứng quá lâu, bấm tải lại ngay.</span>
      <div class="memory98-update-bar"><i></i></div>
      <button type="button" data-update-reload>Tải lại ngay</button>
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
      width: min(340px, 100%);
      padding: 24px 20px 20px;
      border: 1px solid rgba(79, 52, 40, 0.12);
      border-radius: 24px;
      background: rgba(255, 252, 246, 0.96);
      box-shadow: 0 20px 54px rgba(79, 52, 40, 0.14);
      text-align: center;
    }

    #memory98-update-overlay img {
      width: 88px;
      height: 88px;
      object-fit: contain;
      border-radius: 26px;
      background: #fff7ee;
      box-shadow: 0 10px 24px rgba(79, 52, 40, 0.13);
    }

    #memory98-update-overlay p {
      margin: 16px 0 5px;
      font-size: 18px;
      font-weight: 800;
      line-height: 1.35;
    }

    #memory98-update-overlay span {
      display: block;
      color: rgba(79, 52, 40, 0.68);
      font-size: 13px;
      line-height: 1.55;
    }

    #memory98-update-overlay .memory98-update-bar {
      height: 7px;
      margin-top: 16px;
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
      animation: memory98-update-progress 1s ease-in-out infinite;
      transform: translate3d(-110%, 0, 0);
    }

    #memory98-update-overlay button {
      display: inline-flex;
      min-height: 2.65rem;
      align-items: center;
      justify-content: center;
      margin-top: 16px;
      border: 0;
      border-radius: 999px;
      background: #35291f;
      padding: 0 18px;
      color: #fffaf1;
      font: inherit;
      font-size: 13px;
      font-weight: 900;
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
  overlay.querySelector('[data-update-reload]')?.addEventListener('click', () => {
    const url = new URL(window.location.href);
    url.searchParams.set('manualRefresh', Date.now().toString(36));
    window.location.replace(url.toString());
  });
};

const clearRuntimeCaches = async () => {
  if (!('caches' in window)) return;

  const cacheNames = await caches.keys();
  await Promise.allSettled(cacheNames.filter((name) => name.startsWith('memory98-app-shell')).map((name) => caches.delete(name)));
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

  await Promise.race([
    Promise.allSettled([
      clearRuntimeCaches(),
      navigator.serviceWorker?.getRegistration().then((registration) => registration?.update()).catch(() => undefined),
    ]),
    new Promise((resolve) => window.setTimeout(resolve, 1_500)),
  ]);

  reloadWithFreshUrl();
};

export const recoverFromAppLoadError = (error: unknown) => {
  if (!isChunkLoadError(error)) return false;

  void recoverFromChunkError();
  return true;
};

const getAssetUrlFromTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return '';
  if (target instanceof HTMLScriptElement) return target.src || '';
  if (target instanceof HTMLLinkElement) return target.href || '';
  return '';
};

const isAssetLoadError = (target: EventTarget | null) => {
  const url = getAssetUrlFromTarget(target).toLowerCase();
  if (!url.includes('/assets/')) return false;
  return url.endsWith('.js') || url.endsWith('.css') || url.includes('.js?') || url.includes('.css?');
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
      if (!isChunkLoadError(event.error || event.message) && !isAssetLoadError(event.target)) return;

      event.preventDefault();
      void recoverFromChunkError();
    },
    true,
  );

  navigator.serviceWorker?.addEventListener('message', (event) => {
    if (event.data?.type !== 'MEMORY98_ASSET_MISSING') return;

    void recoverFromChunkError();
  });
};
