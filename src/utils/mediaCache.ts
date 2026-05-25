import type { MemoryItem } from '../types';

const loadedImages = new Set<string>();
const videoCache = new Map<string, string>();
const MAX_VIDEO_CACHE_ITEMS = 5;

const memoryCacheKey = (memory: MemoryItem) =>
  `${memory.storageCollection || 'memories98'}:${memory.id}:${memory.updatedAt || memory.createdAt}`;

export const isImageCached = (src: string) => Boolean(src && loadedImages.has(src));

export const markImageCached = (src: string) => {
  if (src) loadedImages.add(src);
};

export const preloadImage = (src: string) => {
  if (!src || loadedImages.has(src) || typeof window === 'undefined') return;

  const image = new Image();
  image.decoding = 'async';
  image.onload = () => markImageCached(src);
  image.src = src;
};

export const warmImageCache = (srcList: string[], limit = 8) => {
  const unique = Array.from(new Set(srcList.filter(Boolean))).slice(0, limit);
  const run = () => unique.forEach(preloadImage);

  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  };

  if (idleWindow.requestIdleCallback) {
    idleWindow.requestIdleCallback(run, { timeout: 1600 });
    return;
  }

  window.setTimeout(run, 400);
};

export const getCachedMemoryVideo = (memory: MemoryItem) => videoCache.get(memoryCacheKey(memory)) || '';

export const cacheMemoryVideo = (memory: MemoryItem, dataUrl: string) => {
  if (!dataUrl) return;

  const key = memoryCacheKey(memory);
  if (videoCache.has(key)) videoCache.delete(key);
  videoCache.set(key, dataUrl);

  while (videoCache.size > MAX_VIDEO_CACHE_ITEMS) {
    const oldestKey = videoCache.keys().next().value;
    if (!oldestKey) break;
    videoCache.delete(oldestKey);
  }
};
