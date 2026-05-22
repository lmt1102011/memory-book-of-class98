import type { GuestbookEntry, MemoryItem } from '../types';

interface ClassMemoryPosterOptions {
  memories: MemoryItem[];
  guestbook: GuestbookEntry[];
}

type PosterCard =
  | {
      id: string;
      kind: 'photo';
      imageUrl: string;
    }
  | {
      id: string;
      kind: 'wish';
      name: string;
      message: string;
      anonymous?: boolean;
    };

const POSTER_WIDTH = 1800;
const POSTER_HEIGHT = 2400;
const OUTER_PAD = 76;
const HEADER_HEIGHT = 310;
const FOOTER_HEIGHT = 82;
const GAP = 34;
const CARD_RADIUS = 24;

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const safeFilePart = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'poster';

const hashNumber = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const shuffleCards = (cards: PosterCard[]) =>
  [...cards].sort((left, right) => hashNumber(left.id) - hashNumber(right.id));

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

const fillRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string | CanvasGradient,
) => {
  roundedRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = fillStyle;
  ctx.fill();
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

const wrapLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    const testLine = current ? `${current} ${word}` : word;
    if (ctx.measureText(testLine).width <= maxWidth || !current) {
      current = testLine;
      return;
    }

    lines.push(current);
    current = word;
  });

  if (current) lines.push(current);
  return lines.length ? lines : [''];
};

const drawTape = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  seed: number,
) => {
  ctx.save();
  ctx.translate(x + width / 2, y + 12);
  ctx.rotate(((seed % 9) - 4) * 0.012);
  fillRoundedRect(ctx, -width / 2, -12, width, 24, 6, 'rgba(244,223,191,0.82)');
  ctx.restore();
};

const drawHeader = (
  ctx: CanvasRenderingContext2D,
  photoCount: number,
  wishCount: number,
  contentWidth: number,
  page: number,
  totalPages: number,
) => {
  const gradient = ctx.createLinearGradient(OUTER_PAD, 58, POSTER_WIDTH - OUTER_PAD, HEADER_HEIGHT - 30);
  gradient.addColorStop(0, 'rgba(247,213,223,0.9)');
  gradient.addColorStop(0.55, 'rgba(255,250,241,0.96)');
  gradient.addColorStop(1, 'rgba(216,237,248,0.9)');
  fillRoundedRect(ctx, OUTER_PAD, 58, contentWidth, 214, 40, gradient);

  ctx.fillStyle = '#35291f';
  ctx.font = '900 96px Bebas Neue, Poppins, Arial, sans-serif';
  ctx.fillText('MEMORY98', OUTER_PAD + 48, 152);
  ctx.font = '800 34px Poppins, Arial, sans-serif';
  ctx.fillStyle = '#7a5639';
  ctx.fillText('Poster ảnh và lời chúc lớp 9/8', OUTER_PAD + 52, 204);

  const chips = [
    `${photoCount} ảnh`,
    `${wishCount} lời chúc`,
    `Trang ${page}/${totalPages}`,
  ];
  chips.forEach((chip, index) => {
    const x = POSTER_WIDTH - OUTER_PAD - 620 + index * 198;
    fillRoundedRect(ctx, x, 118, 176, 54, 27, index === 1 ? '#f7d5df' : '#fffaf1');
    ctx.fillStyle = '#35291f';
    ctx.font = '900 22px Poppins, Arial, sans-serif';
    ctx.fillText(chip, x + 24, 153);
  });
};

const drawPageBackground = (ctx: CanvasRenderingContext2D) => {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fbf3e7';
  ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);

  const bg = ctx.createLinearGradient(0, 0, POSTER_WIDTH, POSTER_HEIGHT);
  bg.addColorStop(0, '#fffaf1');
  bg.addColorStop(0.48, '#f7e7ca');
  bg.addColorStop(1, '#d8edf8');
  ctx.globalAlpha = 0.64;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(122,86,57,0.035)';
  for (let y = 36; y < POSTER_HEIGHT; y += 56) ctx.fillRect(0, y, POSTER_WIDTH, 2);
  ctx.fillStyle = 'rgba(255,250,241,0.28)';
  for (let x = 28; x < POSTER_WIDTH; x += 56) ctx.fillRect(x, 0, 2, POSTER_HEIGHT);
};

const drawFooter = (ctx: CanvasRenderingContext2D, page: number, totalPages: number) => {
  ctx.fillStyle = '#7a5639';
  ctx.font = '800 22px Poppins, Arial, sans-serif';
  ctx.fillText('Memory98 - School Memory Photobook', OUTER_PAD, POSTER_HEIGHT - 48);
  ctx.textAlign = 'right';
  ctx.fillText(`Trang ${page}/${totalPages}`, POSTER_WIDTH - OUTER_PAD, POSTER_HEIGHT - 48);
  ctx.textAlign = 'left';
};

const drawPhotoCard = async (
  ctx: CanvasRenderingContext2D,
  card: Extract<PosterCard, { kind: 'photo' }>,
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number,
) => {
  const rotation = ((seed % 11) - 5) * 0.0045;
  const pad = 16;

  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(rotation);
  ctx.shadowColor = 'rgba(53,41,31,0.16)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 10;
  fillRoundedRect(ctx, -width / 2, -height / 2, width, height, CARD_RADIUS, '#fffaf1');
  ctx.shadowColor = 'transparent';
  drawTape(ctx, -48, -height / 2 - 13, 96, seed);

  const imageX = -width / 2 + pad;
  const imageY = -height / 2 + pad;
  const imageWidth = width - pad * 2;
  const imageHeight = height - pad * 2;

  fillRoundedRect(ctx, imageX, imageY, imageWidth, imageHeight, 18, '#ead9c6');
  try {
    const image = await loadImage(card.imageUrl);
    ctx.save();
    roundedRect(ctx, imageX, imageY, imageWidth, imageHeight, 18);
    ctx.clip();
    drawCoverImage(ctx, image, imageX, imageY, imageWidth, imageHeight);
    ctx.restore();
  } catch {
    ctx.fillStyle = '#7a5639';
    ctx.font = '900 22px Poppins, Arial, sans-serif';
    ctx.fillText('Ảnh lỗi tải', imageX + 24, imageY + imageHeight / 2);
  }
  ctx.restore();
};

const drawWishCard = (
  ctx: CanvasRenderingContext2D,
  card: Extract<PosterCard, { kind: 'wish' }>,
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number,
) => {
  const palette = ['#fffaf1', '#f7d5df', '#d8edf8', '#f4dfbf', '#ffffff'];
  const rotation = ((seed % 13) - 6) * 0.004;
  const paper = palette[seed % palette.length];
  const innerPad = 28;

  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(rotation);
  ctx.shadowColor = 'rgba(53,41,31,0.13)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 8;
  fillRoundedRect(ctx, -width / 2, -height / 2, width, height, 22, paper);
  ctx.shadowColor = 'transparent';
  drawTape(ctx, -54, -height / 2 - 12, 108, seed);

  ctx.fillStyle = '#7a5639';
  ctx.font = '900 18px Poppins, Arial, sans-serif';
  ctx.fillText(card.anonymous ? 'Ẩn danh' : card.name, -width / 2 + innerPad, -height / 2 + 48);

  ctx.fillStyle = '#35291f';
  ctx.font = '700 23px Poppins, Arial, sans-serif';
  const lines = wrapLines(ctx, card.message, width - innerPad * 2);
  lines.forEach((line, index) => {
    ctx.fillText(line, -width / 2 + innerPad, -height / 2 + 92 + index * 34);
  });

  ctx.restore();
};

const measureWishHeight = (
  ctx: CanvasRenderingContext2D,
  card: Extract<PosterCard, { kind: 'wish' }>,
  width: number,
) => {
  ctx.font = '700 23px Poppins, Arial, sans-serif';
  const lines = wrapLines(ctx, card.message, width - 56);
  return Math.max(178, 120 + lines.length * 34);
};

export const createClassMemoryPosterBlobs = async ({ memories, guestbook }: ClassMemoryPosterOptions) => {
  const photos: PosterCard[] = memories
    .filter((memory) => memory.mediaType === 'image' && memory.imageUrl)
    .map((memory) => ({
      id: `photo-${memory.storageCollection || 'memory'}-${memory.id}`,
      kind: 'photo',
      imageUrl: memory.imageUrl,
    }));
  const wishes: PosterCard[] = guestbook
    .filter((entry) => entry.message.trim())
    .map((entry) => ({
      id: `wish-${entry.id}`,
      kind: 'wish',
      name: entry.name || 'Bạn lớp 9/8',
      message: entry.message.trim(),
      anonymous: Boolean(entry.anonymous),
    }));

  if (!photos.length && !wishes.length) throw new Error('Chưa có ảnh hoặc lời chúc nào để tạo poster.');

  await document.fonts?.ready?.catch(() => undefined);

  const contentWidth = POSTER_WIDTH - OUTER_PAD * 2;
  const columns = photos.length + wishes.length > 42 ? 5 : 4;
  const columnWidth = (contentWidth - GAP * (columns - 1)) / columns;
  const pageBottom = POSTER_HEIGHT - OUTER_PAD - FOOTER_HEIGHT;
  type PlacedCard = { card: PosterCard; x: number; y: number; width: number; height: number; seed: number };
  type PosterPage = { columnHeights: number[]; cards: PlacedCard[] };
  const createPage = (): PosterPage => ({
    columnHeights: Array.from({ length: columns }, () => HEADER_HEIGHT),
    cards: [],
  });
  const pages: PosterPage[] = [createPage()];

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  if (!measureCtx) throw new Error('Trình duyệt không hỗ trợ Canvas để tạo poster.');

  shuffleCards([...photos, ...wishes]).forEach((card) => {
    const seed = hashNumber(card.id);
    const height =
      card.kind === 'photo'
        ? Math.round(columnWidth * (seed % 3 === 0 ? 1.18 : seed % 3 === 1 ? 0.96 : 1.34))
        : measureWishHeight(measureCtx, card, columnWidth);
    let page = pages[pages.length - 1];
    let column = page.columnHeights.indexOf(Math.min(...page.columnHeights));
    if (page.columnHeights[column] + height > pageBottom && page.cards.length) {
      page = createPage();
      pages.push(page);
      column = page.columnHeights.indexOf(Math.min(...page.columnHeights));
    }

    const x = OUTER_PAD + column * (columnWidth + GAP);
    const y = page.columnHeights[column] + ((seed % 5) - 2) * 5;

    page.cards.push({ card, x, y, width: columnWidth, height, seed });
    page.columnHeights[column] += height + GAP;
  });

  const blobs: Blob[] = [];
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = POSTER_WIDTH;
    canvas.height = POSTER_HEIGHT;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Trình duyệt không hỗ trợ Canvas để tạo poster.');

    drawPageBackground(ctx);
    drawHeader(ctx, photos.length, wishes.length, contentWidth, pageIndex + 1, pages.length);

    for (let index = 0; index < pages[pageIndex].cards.length; index += 1) {
      const item = pages[pageIndex].cards[index];
      if (item.card.kind === 'photo') {
        await drawPhotoCard(ctx, item.card, item.x, item.y, item.width, item.height, item.seed);
      } else {
        drawWishCard(ctx, item.card, item.x, item.y, item.width, item.height, item.seed);
      }

      if (index % 6 === 5) await nextFrame();
    }

    drawFooter(ctx, pageIndex + 1, pages.length);
    blobs.push(
      await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Không thể tạo poster recap.'))),
          'image/jpeg',
          0.95,
        );
      }),
    );
  }

  return blobs;
};

export const downloadClassMemoryPoster = async (options: ClassMemoryPosterOptions) => {
  const blobs = await createClassMemoryPosterBlobs(options);
  const datePart = safeFilePart(new Date().toISOString().slice(0, 10));

  for (let index = 0; index < blobs.length; index += 1) {
    const url = URL.createObjectURL(blobs[index]);
    const link = document.createElement('a');
    link.href = url;
    link.download = `poster-anh-loi-chuc-lop-9-8-trang-${String(index + 1).padStart(2, '0')}-${datePart}.jpg`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    await nextFrame();
  }
};
