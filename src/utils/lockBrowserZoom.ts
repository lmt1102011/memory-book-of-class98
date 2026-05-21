const zoomKeys = new Set(['+', '-', '=', '0']);

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
};

export const lockBrowserZoom = () => {
  let lastTouchEndAt = 0;
  let lastTouchEndX = 0;
  let lastTouchEndY = 0;

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

  const preventPinchZoom = (event: TouchEvent) => {
    if (event.touches.length < 2) return;
    event.preventDefault();
  };

  const preventDoubleTapZoom = (event: TouchEvent) => {
    if (event.changedTouches.length !== 1 || isEditableTarget(event.target)) return;

    const touch = event.changedTouches[0];
    const now = window.Date.now();
    const distance = Math.hypot(touch.clientX - lastTouchEndX, touch.clientY - lastTouchEndY);

    if (now - lastTouchEndAt < 320 && distance < 42) {
      event.preventDefault();
      lastTouchEndAt = 0;
      return;
    }

    lastTouchEndAt = now;
    lastTouchEndX = touch.clientX;
    lastTouchEndY = touch.clientY;
  };

  window.addEventListener('wheel', preventWheelZoom, { passive: false });
  window.addEventListener('keydown', preventKeyboardZoom);
  window.addEventListener('gesturestart', preventGestureZoom, { passive: false });
  window.addEventListener('gesturechange', preventGestureZoom, { passive: false });
  document.addEventListener('touchstart', preventPinchZoom, { passive: false });
  document.addEventListener('touchmove', preventPinchZoom, { passive: false });
  document.addEventListener('touchend', preventDoubleTapZoom, { passive: false });
};
