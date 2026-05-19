import type {
  BackgroundOption,
  CapturedPhoto,
  ExportQuality,
  GeneratedPhotobook,
  LayoutType,
  PhotobookConfig,
  UserProfile,
} from '../types';

interface RenderPhotobookArgs {
  photos: CapturedPhoto[];
  config: PhotobookConfig;
  background: BackgroundOption;
  profile: UserProfile;
  caption?: string;
}

const qualityWidth: Record<ExportQuality, number> = {
  '1080p': 1080,
  '2k': 1440,
  '4k': 2160,
};

const layoutHeightRatio: Record<LayoutType, number> = {
  vertical: 3.58,
  square: 1,
  horizontal: 0.48,
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, quality = 0.94) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Could not export canvas image.'));
      },
      'image/jpeg',
      quality,
    );
  });

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
};

const drawCoverImage = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const imageRatio = image.width / image.height;
  const targetRatio = width / height;
  let sourceWidth = image.width;
  let sourceHeight = image.height;
  let sourceX = 0;
  let sourceY = 0;

  if (imageRatio > targetRatio) {
    sourceWidth = image.height * targetRatio;
    sourceX = (image.width - sourceWidth) / 2;
  } else {
    sourceHeight = image.width / targetRatio;
    sourceY = (image.height - sourceHeight) / 2;
  }

  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
};

const drawStickerTape = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  angle: number,
  color = 'rgba(255, 246, 219, 0.74)',
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(122, 86, 57, 0.16)';
  ctx.lineWidth = width * 0.012;
  roundRect(ctx, -width / 2, -width * 0.09, width, width * 0.18, width * 0.025);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
};

const drawPaperNoise = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  const dots = Math.round((width * height) / 58_000);
  ctx.save();
  for (let i = 0; i < dots; i += 1) {
    const alpha = 0.035 + ((i * 13) % 19) / 900;
    ctx.fillStyle = i % 2 ? `rgba(122,86,57,${alpha})` : `rgba(255,255,255,${alpha * 2})`;
    ctx.fillRect((i * 97) % width, (i * 193) % height, 1 + (i % 2), 1 + (i % 3));
  }
  ctx.restore();
};

const drawBackground = async (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  background: BackgroundOption,
  customBackground?: string,
) => {
  if (background.kind === 'custom' && customBackground) {
    const image = await loadImage(customBackground);
    drawCoverImage(ctx, image, 0, 0, width, height);
    ctx.fillStyle = 'rgba(255, 250, 241, 0.18)';
    ctx.fillRect(0, 0, width, height);
    return;
  }

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  if (background.kind === 'classroom') {
    gradient.addColorStop(0, '#fbf3e7');
    gradient.addColorStop(0.56, '#dcbf97');
    gradient.addColorStop(1, '#385b58');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(56, 91, 88, 0.88)';
    roundRect(ctx, width * 0.12, height * 0.09, width * 0.76, height * 0.26, width * 0.035);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ctx.fillRect(width * 0.18, height * 0.16, width * 0.46, height * 0.018);
    ctx.fillRect(width * 0.18, height * 0.22, width * 0.56, height * 0.018);
  } else if (background.kind === 'vintage') {
    gradient.addColorStop(0, '#fffaf1');
    gradient.addColorStop(0.55, '#f4dfbf');
    gradient.addColorStop(1, '#d3b28a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(122, 86, 57, .12)';
    ctx.lineWidth = Math.max(2, width * 0.002);
    const gap = height * 0.045;
    for (let y = height * 0.12; y < height * 0.92; y += gap) {
      ctx.beginPath();
      ctx.moveTo(width * 0.08, y);
      ctx.lineTo(width * 0.92, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(216, 138, 154, .28)';
    ctx.beginPath();
    ctx.moveTo(width * 0.18, height * 0.08);
    ctx.lineTo(width * 0.18, height * 0.92);
    ctx.stroke();
  } else {
    gradient.addColorStop(0, '#fff6ea');
    gradient.addColorStop(0.48, '#f7b7c7');
    gradient.addColorStop(1, '#a9cde8');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    ctx.beginPath();
    ctx.arc(width * 0.82, height * 0.16, width * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(122,86,57,.08)';
    ctx.beginPath();
    ctx.arc(width * 0.16, height * 0.86, width * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }

  drawPaperNoise(ctx, width, height);
};

const getFrames = (layout: LayoutType, count: number, width: number, height: number) => {
  const margin = width * 0.08;
  const gutter = width * 0.035;

  if (layout === 'horizontal') {
    const footer = height * 0.18;
    const frameHeight = height - margin * 2 - footer;
    const frameWidth = (width - margin * 2 - gutter * (count - 1)) / count;
    return Array.from({ length: count }, (_, index) => ({
      x: margin + index * (frameWidth + gutter),
      y: margin,
      width: frameWidth,
      height: frameHeight,
    }));
  }

  if (layout === 'square') {
    const columns = count === 2 ? 2 : count === 4 ? 2 : 3;
    const rows = Math.ceil(count / columns);
    const titleSpace = height * 0.16;
    const footer = height * 0.13;
    const availableHeight = height - titleSpace - footer - margin * 1.2;
    const frameWidth = (width - margin * 2 - gutter * (columns - 1)) / columns;
    const frameHeight = (availableHeight - gutter * (rows - 1)) / rows;
    return Array.from({ length: count }, (_, index) => ({
      x: margin + (index % columns) * (frameWidth + gutter),
      y: titleSpace + Math.floor(index / columns) * (frameHeight + gutter),
      width: frameWidth,
      height: frameHeight,
    }));
  }

  const titleSpace = height * 0.12;
  const footer = height * 0.13;
  const frameWidth = width - margin * 2;
  const frameHeight = (height - titleSpace - footer - gutter * (count - 1)) / count;
  return Array.from({ length: count }, (_, index) => ({
    x: margin,
    y: titleSpace + index * (frameHeight + gutter),
    width: frameWidth,
    height: frameHeight,
  }));
};

const drawPhotoFrame = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  frame: { x: number; y: number; width: number; height: number },
  index: number,
) => {
  const border = frame.width * 0.032;
  ctx.save();
  ctx.shadowColor = 'rgba(54, 34, 22, .2)';
  ctx.shadowBlur = frame.width * 0.045;
  ctx.shadowOffsetY = frame.width * 0.02;
  ctx.fillStyle = '#fffdf7';
  roundRect(ctx, frame.x - border, frame.y - border, frame.width + border * 2, frame.height + border * 2, border * 1.3);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, frame.x, frame.y, frame.width, frame.height, border);
  ctx.clip();
  drawCoverImage(ctx, image, frame.x, frame.y, frame.width, frame.height);
  ctx.restore();

  ctx.strokeStyle = 'rgba(122, 86, 57, .16)';
  ctx.lineWidth = Math.max(2, frame.width * 0.006);
  roundRect(ctx, frame.x, frame.y, frame.width, frame.height, border);
  ctx.stroke();

  if (index % 2 === 0) {
    drawStickerTape(ctx, frame.x + frame.width * 0.18, frame.y - border * 0.75, frame.width * 0.28, -0.18);
  } else {
    drawStickerTape(ctx, frame.x + frame.width * 0.82, frame.y - border * 0.6, frame.width * 0.26, 0.16, 'rgba(247, 183, 199, .55)');
  }
};

const drawDecorations = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  layout: LayoutType,
  profile: UserProfile,
  caption = 'One day, these memories will become the most beautiful part of our youth.',
) => {
  const base = width;
  ctx.save();
  ctx.fillStyle = 'rgba(53, 41, 31, .86)';
  ctx.textAlign = layout === 'horizontal' ? 'left' : 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(base * 0.058)}px "Bebas Neue", Impact, sans-serif`;
  const titleX = layout === 'horizontal' ? width * 0.07 : width / 2;
  ctx.fillText('SCHOOL MEMORY PHOTOBOOK', titleX, layout === 'horizontal' ? height * 0.82 : height * 0.06);

  ctx.font = `${Math.round(base * 0.04)}px "Caveat", cursive`;
  ctx.fillStyle = 'rgba(122, 86, 57, .88)';
  const subtitle = `${profile.name} · Class ${profile.className} · ${new Date().toLocaleDateString()}`;
  ctx.fillText(subtitle, titleX, layout === 'horizontal' ? height * 0.9 : height * 0.096);

  ctx.font = `${Math.round(base * 0.032)}px "Caveat", cursive`;
  ctx.fillStyle = 'rgba(53, 41, 31, .72)';
  const maxTextWidth = width * (layout === 'horizontal' ? 0.38 : 0.74);
  const words = caption.split(' ');
  let line = '';
  const lines: string[] = [];
  words.forEach((word) => {
    const next = `${line} ${word}`.trim();
    if (ctx.measureText(next).width > maxTextWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);

  const captionY = layout === 'horizontal' ? height * 0.8 : height * 0.94;
  lines.slice(0, 2).forEach((text, index) => {
    ctx.fillText(text, layout === 'horizontal' ? width * 0.52 : width / 2, captionY + index * base * 0.036);
  });

  ctx.strokeStyle = 'rgba(216, 138, 154, .9)';
  ctx.lineWidth = Math.max(3, base * 0.006);
  ctx.beginPath();
  ctx.moveTo(width * 0.82, height * 0.05);
  ctx.bezierCurveTo(width * 0.9, height * 0.02, width * 0.96, height * 0.09, width * 0.9, height * 0.13);
  ctx.bezierCurveTo(width * 0.84, height * 0.09, width * 0.78, height * 0.02, width * 0.82, height * 0.05);
  ctx.stroke();

  ctx.fillStyle = 'rgba(169, 205, 232, .78)';
  ctx.beginPath();
  ctx.arc(width * 0.09, height * 0.07, base * 0.018, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(width * 0.92, height * 0.93, base * 0.025, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

export const renderPhotobook = async ({
  photos,
  config,
  background,
  profile,
  caption,
}: RenderPhotobookArgs): Promise<GeneratedPhotobook> => {
  const width = qualityWidth[config.quality];
  const height = Math.round(width * layoutHeightRatio[config.layout]);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas is not supported in this browser.');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  await drawBackground(ctx, width, height, background, config.customBackground);

  const loadedPhotos = await Promise.all(photos.map((photo) => loadImage(photo.dataUrl)));
  const frames = getFrames(config.layout, loadedPhotos.length, width, height);

  loadedPhotos.forEach((image, index) => drawPhotoFrame(ctx, image, frames[index], index));
  drawDecorations(ctx, width, height, config.layout, profile, caption);

  const blob = await canvasToBlob(canvas, config.quality === '4k' ? 0.97 : 0.94);
  canvas.width = 1;
  canvas.height = 1;

  return { blob, width, height };
};

export const makeFeedThumbnail = async (imageUrl: string, maxWidth = 900) => {
  const image = await loadImage(imageUrl);
  const scale = Math.min(maxWidth / image.width, 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return imageUrl;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fffaf1';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
};

const dataUrlSizeBytes = (dataUrl: string) => Math.ceil((dataUrl.length * 3) / 4);

export const makeFeedThumbnailDataUrl = async (imageUrl: string, maxWidth = 1300) => {
  const image = await loadImage(imageUrl);
  const maxBytes = 850_000;
  let widthLimit = maxWidth;
  let quality = 0.88;

  for (let attempt = 0; attempt < 7; attempt += 1) {
    const scale = Math.min(widthLimit / image.width, 1);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas is not supported in this browser.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#fffaf1';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    canvas.width = 1;
    canvas.height = 1;

    if (dataUrlSizeBytes(dataUrl) <= maxBytes || attempt === 6) return dataUrl;
    widthLimit = Math.round(widthLimit * 0.82);
    quality = Math.max(0.68, quality - 0.05);
  }

  throw new Error('Could not compress photobook image for Firestore.');
};
