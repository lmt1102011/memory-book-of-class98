export const registerPwa = () => {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;

  const register = () => {
    const baseUrl = new URL(import.meta.env.BASE_URL || './', window.location.href);
    const swUrl = new URL('sw.js', baseUrl).toString();

    navigator.serviceWorker
      .register(swUrl, { scope: baseUrl.pathname })
      .then((registration) => {
        void registration.update().catch(() => undefined);
      })
      .catch(() => {
        // The app must keep working even when the browser refuses service workers.
      });
  };

  register();
};
