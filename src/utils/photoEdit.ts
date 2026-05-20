export interface PhotoEditSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  vignette: number;
}

export const defaultPhotoEditSettings: PhotoEditSettings = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  warmth: 0,
  vignette: 0,
};

const MAX_EDGE = 3200;
const MAX_PIXELS = 5_800_000;

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

const clampChannel = (value: number) => Math.max(0, Math.min(255, value));

const releaseCanvas = (canvas: HTMLCanvasElement) => {
  canvas.width = 1;
  canvas.height = 1;
};

const getTargetSize = (width: number, height: number) => {
  const edgeScale = Math.min(MAX_EDGE / Math.max(width, height), 1);
  const pixelScale = Math.min(Math.sqrt(MAX_PIXELS / (width * height)), 1);
  const scale = Math.min(edgeScale, pixelScale);

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

export const getPhotoEditCssFilter = (settings: PhotoEditSettings) =>
  `brightness(${settings.brightness}%) contrast(${settings.contrast}%) saturate(${settings.saturation}%)`;

export const hasPhotoEdits = (settings: PhotoEditSettings) =>
  settings.brightness !== defaultPhotoEditSettings.brightness ||
  settings.contrast !== defaultPhotoEditSettings.contrast ||
  settings.saturation !== defaultPhotoEditSettings.saturation ||
  settings.warmth !== defaultPhotoEditSettings.warmth ||
  settings.vignette !== defaultPhotoEditSettings.vignette;

export async function applyPhotoEditsToDataUrl(dataUrl: string, settings: PhotoEditSettings): Promise<string> {
  if (!hasPhotoEdits(settings)) return dataUrl;

  const image = await loadImage(dataUrl);
  const { width, height } = getTargetSize(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas is not supported in this browser.');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fffaf1';
  ctx.fillRect(0, 0, width, height);
  ctx.filter = getPhotoEditCssFilter(settings);
  ctx.drawImage(image, 0, 0, width, height);
  ctx.filter = 'none';

  if (settings.warmth !== 0 || settings.vignette > 0) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxDistance = Math.hypot(centerX, centerY);
    const warmth = settings.warmth;
    const vignette = settings.vignette / 100;

    for (let index = 0; index < data.length; index += 4) {
      const pixel = index / 4;
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      const distance = Math.hypot(x - centerX, y - centerY) / maxDistance;
      const edge = Math.max(0, (distance - 0.45) / 0.55);
      const edgeFade = edge * edge * (3 - 2 * edge);
      const vignetteAmount = 1 - edgeFade * vignette * 0.58;

      data[index] = clampChannel((data[index] + warmth * 1.2) * vignetteAmount);
      data[index + 1] = clampChannel((data[index + 1] + Math.abs(warmth) * 0.14) * vignetteAmount);
      data[index + 2] = clampChannel((data[index + 2] - warmth * 0.95) * vignetteAmount);
    }

    ctx.putImageData(imageData, 0, 0);
  }

  try {
    return canvas.toDataURL('image/jpeg', 0.96);
  } finally {
    releaseCanvas(canvas);
  }
}
