const zoomKeys = new Set(['+', '-', '=', '0']);

export const lockBrowserZoom = () => {
  const preventWheelZoom = (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
  };

  const preventKeyboardZoom = (event: KeyboardEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    if (!zoomKeys.has(event.key)) return;
    event.preventDefault();
  };

  const preventGestureZoom = (event: Event) => {
    event.preventDefault();
  };

  window.addEventListener('wheel', preventWheelZoom, { passive: false });
  window.addEventListener('keydown', preventKeyboardZoom);
  window.addEventListener('gesturestart', preventGestureZoom, { passive: false });
  window.addEventListener('gesturechange', preventGestureZoom, { passive: false });
};
