export const registerPwa = () => {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;

  const register = () => {
    const baseUrl = new URL(import.meta.env.BASE_URL || './', window.location.href);
    const swUrl = new URL('sw.js', baseUrl).toString();

    navigator.serviceWorker.register(swUrl, { scope: baseUrl.pathname }).catch(() => {
      // The app must keep working even when the browser refuses service workers.
    });
  };

  if (document.readyState === 'complete') {
    register();
    return;
  }

  window.addEventListener('load', register, { once: true });
};
