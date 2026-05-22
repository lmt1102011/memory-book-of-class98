import type { MemoryItem } from '../types';

interface ClassPhotoPosterOptions {
  memories: MemoryItem[];
}

type PosterPhoto = Pick<MemoryItem, 'id' | 'imageUrl'>;

const POSTER_WIDTH = 1800;
const OUTER_PAD = 56;
const GAP = 18;

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const safeFilePart = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'poster';

const roundedRect = (
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
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    if (!src.startsWith('data:')) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

const drawCoverImage = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
};

const photoColumnCount = (count: number) => {
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  if (count <= 9) return 3;
  if (count <= 20) return 4;
  if (count <= 42) return 6;
  return 8;
};

export const createClassPhotoPosterBlob = async ({ memories }: ClassPhotoPosterOptions) => {
  const photos: PosterPhoto[] = memories
    .filter((memory) => memory.mediaType === 'image' && memory.imageUrl)
    .map((memory) => ({ id: memory.id, imageUrl: memory.imageUrl }));

  if (!photos.length) throw new Error('Chưa có ảnh nào để tạo poster.');

  const columns = photoColumnCount(photos.length);
  const contentWidth = POSTER_WIDTH - OUTER_PAD * 2;
  const tileWidth = (contentWidth - GAP * (columns - 1)) / columns;
  const tileHeight = Math.round(tileWidth * 1.18);
  const rows = Math.ceil(photos.length / columns);
  const posterHeight = OUTER_PAD * 2 + rows * tileHeight + Math.max(0, rows - 1) * GAP;

  const canvas = document.createElement('canvas');
  canvas.width = POSTER_WIDTH;
  canvas.height = posterHeight;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ Canvas để tạo poster.');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fffaf1';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < photos.length; index += 1) {
    const photo = photos[index];
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = OUTER_PAD + col * (tileWidth + GAP);
    const y = OUTER_PAD + row * (tileHeight + GAP);

    ctx.save();
    roundedRect(ctx, x, y, tileWidth, tileHeight, 18);
    ctx.clip();
    ctx.fillStyle = '#ead9c6';
    ctx.fillRect(x, y, tileWidth, tileHeight);

    try {
      const image = await loadImage(photo.imageUrl);
      drawCoverImage(ctx, image, x, y, tileWidth, tileHeight);
    } catch {
      ctx.fillStyle = '#d8c4aa';
      ctx.fillRect(x, y, tileWidth, tileHeight);
    }

    ctx.restore();

    ctx.strokeStyle = 'rgba(255,250,241,0.92)';
    ctx.lineWidth = 7;
    roundedRect(ctx, x + 3.5, y + 3.5, tileWidth - 7, tileHeight - 7, 16);
    ctx.stroke();

    if (index % 6 === 5) await nextFrame();
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Không thể tạo poster ảnh.'))),
      'image/jpeg',
      0.95,
    );
  });
};

export const downloadClassPhotoPoster = async (options: ClassPhotoPosterOptions) => {
  const blob = await createClassPhotoPosterBlob(options);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `poster-anh-lop-9-8-${safeFilePart(new Date().toISOString().slice(0, 10))}.jpg`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
