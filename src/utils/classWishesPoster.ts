import type { GuestbookEntry, MemoryItem } from '../types';

type PosterPhoto = Pick<MemoryItem, 'id' | 'imageUrl' | 'name' | 'caption' | 'mediaType'>;

interface ClassWishesPosterOptions {
  memories: MemoryItem[];
  guestbook: GuestbookEntry[];
}

const POSTER_WIDTH = 1800;
const OUTER_PAD = 92;
const CARD_RADIUS = 42;
const GAP = 24;

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

const strokeRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  strokeStyle: string,
  lineWidth = 2,
) => {
  roundedRect(ctx, x, y, width, height, radius);
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
};

const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) => {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    if (lines.length >= maxLines) return;
    const testLine = current ? `${current} ${word}` : word;
    if (ctx.measureText(testLine).width <= maxWidth || !current) {
      current = testLine;
      return;
    }

    lines.push(current);
    current = word;
  });

  if (current && lines.length < maxLines) lines.push(current);

  lines.slice(0, maxLines).forEach((line, index) => {
    const isLastVisibleLine = index === maxLines - 1 && lines.length >= maxLines && words.join(' ').length > line.length;
    ctx.fillText(isLastVisibleLine ? `${line.replace(/[.,;:!?-]*$/, '')}...` : line, x, y + index * lineHeight);
  });

  return lines.length;
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

const drawPaperTape = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, rotate = -0.05) => {
  ctx.save();
  ctx.translate(x + width / 2, y + 12);
  ctx.rotate(rotate);
  fillRoundedRect(ctx, -width / 2, -12, width, 24, 6, 'rgba(244,223,191,0.82)');
  ctx.restore();
};

const drawChip = (ctx: CanvasRenderingContext2D, label: string, x: number, y: number, width: number, color: string) => {
  fillRoundedRect(ctx, x, y, width, 54, 27, color);
  ctx.fillStyle = '#35291f';
  ctx.font = '900 25px Poppins, Arial, sans-serif';
  ctx.fillText(label, x + 26, y + 36);
};

const drawPhotoCard = async (
  ctx: CanvasRenderingContext2D,
  photo: PosterPhoto,
  x: number,
  y: number,
  width: number,
  height: number,
  index: number,
) => {
  const rotation = ((index % 7) - 3) * 0.012;
  const framePad = Math.max(10, width * 0.055);
  const captionHeight = Math.max(34, height * 0.16);
  const imageX = -width / 2 + framePad;
  const imageY = -height / 2 + framePad;
  const imageWidth = width - framePad * 2;
  const imageHeight = height - framePad * 2 - captionHeight;

  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(rotation);
  ctx.shadowColor = 'rgba(53,41,31,0.18)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 9;
  fillRoundedRect(ctx, -width / 2, -height / 2, width, height, 12, '#fffaf1');
  ctx.shadowColor = 'transparent';
  fillRoundedRect(ctx, imageX, imageY, imageWidth, imageHeight, 8, '#e9d9c5');

  try {
    const image = await loadImage(photo.imageUrl);
    ctx.save();
    roundedRect(ctx, imageX, imageY, imageWidth, imageHeight, 8);
    ctx.clip();
    drawCoverImage(ctx, image, imageX, imageY, imageWidth, imageHeight);
    ctx.restore();
  } catch {
    ctx.fillStyle = '#7a5639';
    ctx.font = '900 22px Poppins, Arial, sans-serif';
    ctx.fillText('Ảnh lỗi tải', imageX + 18, imageY + imageHeight / 2);
  }

  if (photo.mediaType === 'video') {
    fillRoundedRect(ctx, imageX + 10, imageY + 10, 94, 34, 17, 'rgba(53,41,31,0.78)');
    ctx.fillStyle = '#fffaf1';
    ctx.font = '900 17px Poppins, Arial, sans-serif';
    ctx.fillText('VIDEO', imageX + 24, imageY + 33);
  }

  ctx.fillStyle = '#35291f';
  ctx.font = '900 20px Poppins, Arial, sans-serif';
  wrapText(ctx, photo.name || 'Lớp 9/8', -width / 2 + framePad, height / 2 - captionHeight + 28, imageWidth, 23, 1);
  ctx.fillStyle = '#7a5639';
  ctx.font = '700 15px Poppins, Arial, sans-serif';
  wrapText(ctx, photo.caption || 'Một kỷ niệm nhỏ', -width / 2 + framePad, height / 2 - captionHeight + 52, imageWidth, 18, 1);
  ctx.restore();
};

const drawWishCard = (
  ctx: CanvasRenderingContext2D,
  entry: GuestbookEntry,
  x: number,
  y: number,
  width: number,
  height: number,
  index: number,
) => {
  const colors = ['#fffaf1', '#f7d5df', '#d8edf8', '#f4dfbf'];
  const rotate = ((index % 5) - 2) * 0.01;

  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(rotate);
  ctx.shadowColor = 'rgba(53,41,31,0.13)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 8;
  fillRoundedRect(ctx, -width / 2, -height / 2, width, height, 16, colors[index % colors.length]);
  ctx.shadowColor = 'transparent';
  drawPaperTape(ctx, -width / 2 + width * 0.34, -height / 2 - 9, width * 0.32, index % 2 ? 0.04 : -0.05);

  ctx.fillStyle = '#7a5639';
  ctx.font = '900 18px Poppins, Arial, sans-serif';
  ctx.fillText(entry.anonymous ? 'Ẩn danh' : entry.name, -width / 2 + 26, -height / 2 + 42);
  ctx.fillStyle = '#35291f';
  ctx.font = '700 24px Caveat, Poppins, Arial, sans-serif';
  wrapText(ctx, entry.message || 'Chúc lớp mình luôn nhớ về nhau.', -width / 2 + 26, -height / 2 + 88, width - 52, 32, 4);
  ctx.restore();
};

export const createClassWishesPosterBlob = async ({ memories, guestbook }: ClassWishesPosterOptions) => {
  const photos = memories.filter((memory) => memory.imageUrl) as PosterPhoto[];
  const wishes = guestbook.filter((entry) => entry.message.trim());
  const photoCols = photos.length <= 6 ? 3 : photos.length <= 18 ? 4 : photos.length <= 42 ? 6 : 8;
  const contentWidth = POSTER_WIDTH - OUTER_PAD * 2;
  const photoWidth = (contentWidth - GAP * (photoCols - 1)) / photoCols;
  const photoHeight = Math.round(photoWidth * 1.22);
  const photoRows = Math.max(1, Math.ceil(Math.max(photos.length, 1) / photoCols));
  const photoSectionHeight = 150 + photoRows * photoHeight + Math.max(0, photoRows - 1) * GAP + 64;

  const wishCols = wishes.length <= 4 ? 2 : 3;
  const wishWidth = (contentWidth - GAP * (wishCols - 1)) / wishCols;
  const wishHeight = 188;
  const wishRows = Math.max(1, Math.ceil(Math.max(wishes.length, 1) / wishCols));
  const wishSectionHeight = 144 + wishRows * wishHeight + Math.max(0, wishRows - 1) * GAP + 74;
  const headerHeight = 370;
  const footerHeight = 154;
  const height = headerHeight + photoSectionHeight + wishSectionHeight + footerHeight;

  await document.fonts?.ready?.catch(() => undefined);

  const canvas = document.createElement('canvas');
  canvas.width = POSTER_WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ Canvas để tạo poster.');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fbf3e7';
  ctx.fillRect(0, 0, POSTER_WIDTH, height);

  const bg = ctx.createLinearGradient(0, 0, POSTER_WIDTH, height);
  bg.addColorStop(0, '#fffaf1');
  bg.addColorStop(0.26, '#f9d8df');
  bg.addColorStop(0.58, '#f4dfbf');
  bg.addColorStop(1, '#d8edf8');
  ctx.globalAlpha = 0.76;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, POSTER_WIDTH, height);
  ctx.globalAlpha = 1;

  for (let x = -80; x < POSTER_WIDTH; x += 96) {
    ctx.fillStyle = 'rgba(255,250,241,0.2)';
    ctx.fillRect(x, 0, 2, height);
  }
  for (let y = 52; y < height; y += 96) {
    ctx.fillStyle = 'rgba(53,41,31,0.035)';
    ctx.fillRect(0, y, POSTER_WIDTH, 2);
  }

  fillRoundedRect(ctx, OUTER_PAD, 76, contentWidth, 238, CARD_RADIUS, 'rgba(255,250,241,0.78)');
  strokeRoundedRect(ctx, OUTER_PAD, 76, contentWidth, 238, CARD_RADIUS, 'rgba(122,86,57,0.12)', 3);
  drawChip(ctx, 'LỚP 9/8', OUTER_PAD + 44, 124, 174, '#f7d5df');
  drawChip(ctx, `${photos.length} ảnh`, OUTER_PAD + 238, 124, 174, '#d8edf8');
  drawChip(ctx, `${wishes.length} lời chúc`, OUTER_PAD + 432, 124, 228, '#f4dfbf');

  ctx.fillStyle = '#35291f';
  ctx.font = '900 108px Bebas Neue, Poppins, Arial, sans-serif';
  ctx.fillText('POSTER LỜI CHÚC 98', OUTER_PAD + 44, 235);
  ctx.fillStyle = '#7a5639';
  ctx.font = '800 31px Poppins, Arial, sans-serif';
  ctx.fillText('Tất cả ảnh trong ký ức lớp và những mảnh thư đã gửi lên bảng lớp', OUTER_PAD + 48, 282);

  let yCursor = headerHeight;
  fillRoundedRect(ctx, OUTER_PAD, yCursor, contentWidth, photoSectionHeight - 34, 34, 'rgba(255,250,241,0.62)');
  ctx.fillStyle = '#35291f';
  ctx.font = '900 54px Bebas Neue, Poppins, Arial, sans-serif';
  ctx.fillText('Album ảnh của lớp', OUTER_PAD + 40, yCursor + 84);
  ctx.fillStyle = '#7a5639';
  ctx.font = '700 24px Poppins, Arial, sans-serif';
  ctx.fillText('Không bỏ sót ảnh nào đang có trong feed hiện tại.', OUTER_PAD + 42, yCursor + 122);

  if (!photos.length) {
    fillRoundedRect(ctx, OUTER_PAD + 40, yCursor + 160, contentWidth - 80, 220, 24, 'rgba(255,250,241,0.72)');
    ctx.fillStyle = '#7a5639';
    ctx.font = '900 34px Poppins, Arial, sans-serif';
    ctx.fillText('Chưa có ảnh nào để đưa vào poster.', OUTER_PAD + 78, yCursor + 284);
  } else {
    for (let index = 0; index < photos.length; index += 1) {
      const col = index % photoCols;
      const row = Math.floor(index / photoCols);
      const x = OUTER_PAD + 40 + col * (photoWidth + GAP);
      const y = yCursor + 154 + row * (photoHeight + GAP);
      await drawPhotoCard(ctx, photos[index], x, y, photoWidth, photoHeight, index);
      if (index % 8 === 7) await nextFrame();
    }
  }

  yCursor += photoSectionHeight;
  fillRoundedRect(ctx, OUTER_PAD, yCursor, contentWidth, wishSectionHeight - 34, 34, 'rgba(47,89,80,0.94)');
  ctx.fillStyle = 'rgba(255,250,241,0.08)';
  for (let x = OUTER_PAD; x < OUTER_PAD + contentWidth; x += 58) ctx.fillRect(x, yCursor, 2, wishSectionHeight - 34);
  for (let y = yCursor; y < yCursor + wishSectionHeight - 34; y += 58) ctx.fillRect(OUTER_PAD, y, contentWidth, 2);

  ctx.fillStyle = '#fffaf1';
  ctx.font = '900 54px Bebas Neue, Poppins, Arial, sans-serif';
  ctx.fillText('Những lời chúc trên bảng thư', OUTER_PAD + 40, yCursor + 84);
  ctx.fillStyle = 'rgba(255,250,241,0.72)';
  ctx.font = '700 24px Poppins, Arial, sans-serif';
  ctx.fillText('Từng mảnh giấy nhỏ, giữ lại một chút thanh xuân của lớp 9/8.', OUTER_PAD + 42, yCursor + 122);

  if (!wishes.length) {
    fillRoundedRect(ctx, OUTER_PAD + 40, yCursor + 160, contentWidth - 80, 220, 24, 'rgba(255,250,241,0.14)');
    ctx.fillStyle = '#fffaf1';
    ctx.font = '900 34px Poppins, Arial, sans-serif';
    ctx.fillText('Chưa có lời chúc nào trên bảng thư.', OUTER_PAD + 78, yCursor + 284);
  } else {
    for (let index = 0; index < wishes.length; index += 1) {
      const col = index % wishCols;
      const row = Math.floor(index / wishCols);
      const x = OUTER_PAD + 40 + col * (wishWidth + GAP);
      const y = yCursor + 154 + row * (wishHeight + GAP);
      drawWishCard(ctx, wishes[index], x, y, wishWidth, wishHeight, index);
    }
  }

  yCursor += wishSectionHeight;
  ctx.fillStyle = '#35291f';
  ctx.font = '900 34px Poppins, Arial, sans-serif';
  ctx.fillText('Memory98 - School Memory Photobook', OUTER_PAD + 4, yCursor + 46);
  ctx.fillStyle = '#7a5639';
  ctx.font = '700 23px Poppins, Arial, sans-serif';
  ctx.fillText(`Xuất poster lúc ${new Date().toLocaleString('vi-VN')}`, OUTER_PAD + 4, yCursor + 88);
  ctx.textAlign = 'right';
  ctx.fillText('memory-book-of-class98', POSTER_WIDTH - OUTER_PAD, yCursor + 88);
  ctx.textAlign = 'left';

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Không thể tạo poster lời chúc.'))),
      'image/jpeg',
      0.95,
    );
  });
};

export const downloadClassWishesPoster = async (options: ClassWishesPosterOptions) => {
  const blob = await createClassWishesPosterBlob(options);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `poster-loi-chuc-lop-9-8-${safeFilePart(new Date().toISOString().slice(0, 10))}.jpg`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
