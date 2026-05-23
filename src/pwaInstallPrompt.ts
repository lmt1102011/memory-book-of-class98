export type InstallPlatform = 'android' | 'ios' | 'desktop';

export type InstallOutcome = 'accepted' | 'dismissed' | 'manual' | 'installed' | 'unavailable';

type BeforeInstallPromptChoice = {
  outcome: 'accepted' | 'dismissed';
  platform: string;
};

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<BeforeInstallPromptChoice>;
  prompt: () => Promise<void>;
}

type PromptListener = (prompt: BeforeInstallPromptEvent | null) => void;
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let isCaptureStarted = false;
const promptListeners = new Set<PromptListener>();

const notifyPromptListeners = () => {
  promptListeners.forEach((listener) => listener(deferredPrompt));
};

export const isStandaloneMode = () => {
  if (typeof window === 'undefined') return false;

  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  const displayModes = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'];
  const isDisplayModeApp = displayModes.some((mode) => window.matchMedia(`(display-mode: ${mode})`).matches);

  return isDisplayModeApp || navigatorWithStandalone.standalone === true;
};

export const shouldSkipIntroOnInstalledLaunch = () => {
  if (typeof window === 'undefined') return false;

  return isStandaloneMode();
};

export const detectInstallPlatform = (): InstallPlatform => {
  if (typeof window === 'undefined') return 'desktop';

  const userAgent = window.navigator.userAgent.toLowerCase();
  const platform = window.navigator.platform.toLowerCase();
  const isTouchMac = platform.includes('mac') && window.navigator.maxTouchPoints > 1;

  if (/iphone|ipad|ipod/.test(userAgent) || isTouchMac) return 'ios';
  if (userAgent.includes('android')) return 'android';
  return 'desktop';
};

export const capturePwaInstallPrompt = () => {
  if (typeof window === 'undefined' || isCaptureStarted) return;
  isCaptureStarted = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notifyPromptListeners();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notifyPromptListeners();
  });
};

export const getDeferredPwaInstallPrompt = () => deferredPrompt;

export const waitForPwaInstallPrompt = (timeoutMs = 6500) => {
  if (deferredPrompt || typeof window === 'undefined') {
    return Promise.resolve(deferredPrompt);
  }

  return new Promise<BeforeInstallPromptEvent | null>((resolve) => {
    let isDone = false;
    let unsubscribe: (() => void) | undefined;

    const finish = (prompt: BeforeInstallPromptEvent | null) => {
      if (isDone) return;
      isDone = true;
      window.clearTimeout(timer);
      unsubscribe?.();
      resolve(prompt);
    };

    const timer = window.setTimeout(() => finish(deferredPrompt), timeoutMs);
    unsubscribe = subscribePwaInstallPrompt((prompt) => {
      if (prompt) finish(prompt);
    });
  });
};

export const clearDeferredPwaInstallPrompt = () => {
  deferredPrompt = null;
  notifyPromptListeners();
};

export const subscribePwaInstallPrompt = (listener: PromptListener) => {
  promptListeners.add(listener);
  listener(deferredPrompt);

  return () => {
    promptListeners.delete(listener);
  };
};
