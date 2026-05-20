import type {
  BackgroundEdit,
  BackgroundOption,
  CapturedPhoto,
  ExportQuality,
  GeneratedPhotobook,
  LayoutType,
  PhotobookMoodId,
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

const singlePhotoHeightRatio: Record<LayoutType, number> = {
  vertical: 1.42,
  square: 1,
  horizontal: 0.62,
};

const defaultBackgroundEdit: BackgroundEdit = {
  scale: 1,
  x: 0,
  y: 0,
  brightness: 100,
  blur: 0,
};

interface MoodTheme {
  id: PhotobookMoodId;
  title: string;
  signature: string;
  paper: string;
  ink: string;
  mutedInk: string;
  accent: string;
  accentSoft: string;
  tape: string;
  overlay: string;
  photoBorder: string;
  captionPrefix: string;
}

const moodThemes: Record<PhotobookMoodId, MoodTheme> = {
  'clear-youth': {
    id: 'clear-youth',
    title: 'OUR CLEAR YOUTH',
    signature: 'soft school memory',
    paper: '#fffdf8',
    ink: '#35291f',
    mutedInk: 'rgba(122, 86, 57, .78)',
    accent: '#f7b7c7',
    accentSoft: 'rgba(247, 183, 199, .5)',
    tape: 'rgba(255, 246, 219, .78)',
    overlay: 'rgba(255, 250, 241, .22)',
    photoBorder: '#fffdf8',
    captionPrefix: 'Dear youth,',
  },
  'farewell-day': {
    id: 'farewell-day',
    title: 'FAREWELL DAY',
    signature: 'until we meet again',
    paper: '#fff7e9',
    ink: '#4a3020',
    mutedInk: 'rgba(122, 86, 57, .84)',
    accent: '#d88a9a',
    accentSoft: 'rgba(216, 138, 154, .42)',
    tape: 'rgba(244, 223, 191, .86)',
    overlay: 'rgba(255, 231, 190, .24)',
    photoBorder: '#fff8ed',
    captionPrefix: 'The day we remember,',
  },
  'best-friends': {
    id: 'best-friends',
    title: 'BEST FRIENDS CLUB',
    signature: 'class 9/8 forever',
    paper: '#fffdf7',
    ink: '#2f342b',
    mutedInk: 'rgba(56, 91, 88, .82)',
    accent: '#385b58',
    accentSoft: 'rgba(247, 183, 199, .5)',
    tape: 'rgba(169, 205, 232, .62)',
    overlay: 'rgba(247, 183, 199, .18)',
    photoBorder: '#fffdf7',
    captionPrefix: 'With my people,',
  },
  'korean-booth': {
    id: 'korean-booth',
    title: 'K-STUDENT PHOTOBOOTH',
    signature: 'one perfect strip',
    paper: '#f9fcff',
    ink: '#25313d',
    mutedInk: 'rgba(59, 75, 92, .78)',
    accent: '#a9cde8',
    accentSoft: 'rgba(169, 205, 232, .48)',
    tape: 'rgba(255, 250, 241, .78)',
    overlay: 'rgba(247, 251, 255, .28)',
    photoBorder: '#fbfdff',
    captionPrefix: 'Photobooth note,',
  },
  'vintage-final': {
    id: 'vintage-final',
    title: 'VINTAGE FINAL YEAR',
    signature: 'scrapbook journal',
    paper: '#fff8e7',
    ink: '#4d3523',
    mutedInk: 'rgba(122, 86, 57, .86)',
    accent: '#7a5639',
    accentSoft: 'rgba(211, 178, 138, .5)',
    tape: 'rgba(238, 216, 175, .9)',
    overlay: 'rgba(244, 223, 191, .26)',
    photoBorder: '#fff6e4',
    captionPrefix: 'Written in memory,',
  },
};

const getMoodTheme = (moodId?: PhotobookMoodId) => moodThemes[moodId || 'clear-youth'] || moodThemes['clear-youth'];

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

const drawEditedCoverImage = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  edit?: BackgroundEdit,
) => {
  const settings = { ...defaultBackgroundEdit, ...edit };
  const coverScale = Math.max(width / image.width, height / image.height) * settings.scale;
  const drawWidth = image.width * coverScale;
  const drawHeight = image.height * coverScale;
  const maxShiftX = Math.max(0, (drawWidth - width) / 2);
  const maxShiftY = Math.max(0, (drawHeight - height) / 2);
  const x = (width - drawWidth) / 2 + (settings.x / 100) * maxShiftX;
  const y = (height - drawHeight) / 2 + (settings.y / 100) * maxShiftY;

  ctx.save();
  ctx.filter = `brightness(${settings.brightness}%) blur(${settings.blur}px)`;
  ctx.drawImage(image, x, y, drawWidth, drawHeight);
  ctx.restore();
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
  theme: MoodTheme,
  customBackground?: string,
  customBackgroundEdit?: BackgroundEdit,
) => {
  if (background.kind === 'custom' && customBackground) {
    const image = await loadImage(customBackground);
    drawEditedCoverImage(ctx, image, width, height, customBackgroundEdit);
    ctx.fillStyle = theme.overlay;
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

  ctx.fillStyle = theme.overlay;
  ctx.fillRect(0, 0, width, height);
  drawPaperNoise(ctx, width, height);
};

const drawMoodBackdrop = (ctx: CanvasRenderingContext2D, width: number, height: number, theme: MoodTheme) => {
  const base = width;
  ctx.save();

  if (theme.id === 'clear-youth') {
    ctx.fillStyle = 'rgba(255, 255, 255, .24)';
    for (let i = 0; i < 7; i += 1) {
      ctx.beginPath();
      ctx.arc((width * (0.12 + i * 0.13)) % width, height * (i % 2 ? 0.2 : 0.78), base * (0.038 + (i % 3) * 0.01), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255, 250, 241, .62)';
    ctx.lineWidth = Math.max(2, base * 0.004);
    ctx.beginPath();
    ctx.moveTo(width * 0.08, height * 0.18);
    ctx.bezierCurveTo(width * 0.28, height * 0.08, width * 0.54, height * 0.27, width * 0.92, height * 0.13);
    ctx.stroke();
  }

  if (theme.id === 'farewell-day') {
    const sunset = ctx.createLinearGradient(0, height * 0.12, width, height);
    sunset.addColorStop(0, 'rgba(255, 231, 185, .1)');
    sunset.addColorStop(0.54, 'rgba(216, 138, 154, .18)');
    sunset.addColorStop(1, 'rgba(122, 86, 57, .26)');
    ctx.fillStyle = sunset;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(255, 250, 241, .28)';
    ctx.beginPath();
    ctx.arc(width * 0.82, height * 0.18, base * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(122, 86, 57, .16)';
    ctx.setLineDash([base * 0.012, base * 0.012]);
    ctx.lineWidth = Math.max(1, base * 0.003);
    ctx.beginPath();
    ctx.moveTo(width * 0.07, height * 0.18);
    ctx.lineTo(width * 0.93, height * 0.18);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (theme.id === 'best-friends') {
    const stickers = ['BFF', '9/8', 'YES', 'LOL', 'TEAM'];
    stickers.forEach((text, index) => {
      const x = width * (0.12 + ((index * 19) % 72) / 100);
      const y = height * (0.12 + ((index * 31) % 74) / 100);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(index % 2 ? 0.16 : -0.13);
      ctx.fillStyle = index % 2 ? 'rgba(56, 91, 88, .84)' : 'rgba(247, 183, 199, .86)';
      roundRect(ctx, -base * 0.052, -base * 0.025, base * 0.104, base * 0.05, base * 0.018);
      ctx.fill();
      ctx.fillStyle = '#fffaf1';
      ctx.font = `${Math.round(base * 0.028)}px "Saira Condensed", "Be Vietnam Pro", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, 0);
      ctx.restore();
    });
  }

  if (theme.id === 'korean-booth') {
    ctx.fillStyle = 'rgba(255, 255, 255, .42)';
    roundRect(ctx, width * 0.045, height * 0.035, width * 0.91, height * 0.93, base * 0.028);
    ctx.fill();
    ctx.strokeStyle = 'rgba(169, 205, 232, .48)';
    ctx.lineWidth = Math.max(1, base * 0.0025);
    for (let x = width * 0.1; x < width * 0.92; x += base * 0.065) {
      ctx.beginPath();
      ctx.moveTo(x, height * 0.07);
      ctx.lineTo(x, height * 0.93);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(37, 49, 61, .72)';
    for (let i = 0; i < 12; i += 1) {
      ctx.fillRect(width * 0.78 + i * base * 0.008, height * 0.91, base * 0.0035, base * (0.018 + (i % 3) * 0.012));
    }
  }

  if (theme.id === 'vintage-final') {
    ctx.fillStyle = 'rgba(122, 86, 57, .055)';
    for (let i = 0; i < 9; i += 1) {
      ctx.beginPath();
      ctx.arc(width * (0.08 + ((i * 17) % 84) / 100), height * (0.1 + ((i * 29) % 76) / 100), base * (0.03 + (i % 4) * 0.014), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(77, 53, 35, .18)';
    const holeSize = base * 0.023;
    for (let y = height * 0.08; y < height * 0.93; y += holeSize * 2.2) {
      roundRect(ctx, width * 0.035, y, holeSize, holeSize * 0.72, holeSize * 0.16);
      ctx.fill();
      roundRect(ctx, width * 0.942, y, holeSize, holeSize * 0.72, holeSize * 0.16);
      ctx.fill();
    }
  }

  ctx.restore();
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
    const columns = count === 1 ? 1 : count === 2 ? 2 : count === 4 ? 2 : 3;
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
  theme: MoodTheme,
) => {
  const border = frame.width * 0.032;
  const radius = theme.id === 'korean-booth' ? border * 0.55 : theme.id === 'vintage-final' ? border * 0.25 : border;
  ctx.save();
  ctx.shadowColor = theme.id === 'korean-booth' ? 'rgba(37, 49, 61, .16)' : 'rgba(54, 34, 22, .2)';
  ctx.shadowBlur = theme.id === 'korean-booth' ? frame.width * 0.024 : frame.width * 0.045;
  ctx.shadowOffsetY = theme.id === 'korean-booth' ? frame.width * 0.012 : frame.width * 0.02;
  ctx.fillStyle = theme.photoBorder;
  roundRect(ctx, frame.x - border, frame.y - border, frame.width + border * 2, frame.height + border * 2, radius * 1.3);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, frame.x, frame.y, frame.width, frame.height, radius);
  ctx.clip();
  drawCoverImage(ctx, image, frame.x, frame.y, frame.width, frame.height);
  ctx.restore();

  ctx.strokeStyle = theme.id === 'korean-booth' ? 'rgba(37, 49, 61, .26)' : theme.accentSoft;
  ctx.lineWidth = Math.max(2, frame.width * (theme.id === 'korean-booth' ? 0.0035 : 0.006));
  roundRect(ctx, frame.x, frame.y, frame.width, frame.height, radius);
  ctx.stroke();

  if (theme.id === 'korean-booth') {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, .88)';
    roundRect(ctx, frame.x + frame.width * 0.04, frame.y + frame.height * 0.035, frame.width * 0.18, frame.width * 0.066, frame.width * 0.018);
    ctx.fill();
    ctx.fillStyle = theme.ink;
    ctx.font = `${Math.round(frame.width * 0.038)}px "Saira Condensed", "Be Vietnam Pro", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(index + 1).padStart(2, '0'), frame.x + frame.width * 0.13, frame.y + frame.height * 0.035 + frame.width * 0.033);
    ctx.restore();
    return;
  }

  if (theme.id === 'farewell-day') {
    drawStickerTape(ctx, frame.x + frame.width * 0.5, frame.y - border * 0.75, frame.width * 0.34, index % 2 ? 0.08 : -0.08, theme.tape);
    drawStickerTape(ctx, frame.x + frame.width * 0.5, frame.y + frame.height + border * 0.72, frame.width * 0.22, index % 2 ? -0.12 : 0.12, 'rgba(216, 138, 154, .34)');
    return;
  }

  if (theme.id === 'best-friends') {
    drawStickerTape(ctx, frame.x + frame.width * 0.2, frame.y - border * 0.7, frame.width * 0.24, -0.2, theme.tape);
    ctx.save();
    ctx.fillStyle = index % 2 ? '#385b58' : '#f7b7c7';
    ctx.beginPath();
    ctx.arc(frame.x + frame.width * 0.88, frame.y + frame.height * 0.12, frame.width * 0.052, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fffaf1';
    ctx.font = `${Math.round(frame.width * 0.038)}px "Saira Condensed", "Be Vietnam Pro", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(index % 2 ? 'BFF' : '98', frame.x + frame.width * 0.88, frame.y + frame.height * 0.12);
    ctx.restore();
    return;
  }

  if (theme.id === 'vintage-final') {
    ctx.save();
    ctx.strokeStyle = 'rgba(122, 86, 57, .24)';
    ctx.lineWidth = Math.max(1, frame.width * 0.004);
    ctx.strokeRect(frame.x - border * 0.42, frame.y - border * 0.42, frame.width + border * 0.84, frame.height + border * 0.84);
    ctx.restore();
    drawStickerTape(ctx, frame.x + frame.width * 0.82, frame.y - border * 0.58, frame.width * 0.24, 0.14, theme.tape);
    return;
  }

  drawStickerTape(ctx, frame.x + frame.width * 0.18, frame.y - border * 0.75, frame.width * 0.28, -0.18, theme.tape);
  drawStickerTape(ctx, frame.x + frame.width * 0.82, frame.y - border * 0.6, frame.width * 0.2, 0.16, theme.accentSoft);
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
  ctx.font = `${Math.round(base * 0.058)}px "Saira Condensed", "Be Vietnam Pro", Impact, sans-serif`;
  const titleX = layout === 'horizontal' ? width * 0.07 : width / 2;
  ctx.fillText('SCHOOL MEMORY PHOTOBOOK', titleX, layout === 'horizontal' ? height * 0.82 : height * 0.06);

  ctx.font = `${Math.round(base * 0.04)}px "Mali", "Be Vietnam Pro", cursive`;
  ctx.fillStyle = 'rgba(122, 86, 57, .88)';
  const subtitle = `${profile.name} · Class ${profile.className} · ${new Date().toLocaleDateString()}`;
  ctx.fillText(subtitle, titleX, layout === 'horizontal' ? height * 0.9 : height * 0.096);

  ctx.font = `${Math.round(base * 0.032)}px "Mali", "Be Vietnam Pro", cursive`;
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

const drawMoodDecorations = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  layout: LayoutType,
  profile: UserProfile,
  theme: MoodTheme,
  caption = 'One day, these memories will become the most beautiful part of our youth.',
) => {
  const base = width;
  ctx.save();
  ctx.fillStyle = theme.ink;
  ctx.textAlign = layout === 'horizontal' ? 'left' : 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(base * 0.058)}px "Saira Condensed", "Be Vietnam Pro", Impact, sans-serif`;
  const titleX = layout === 'horizontal' ? width * 0.07 : width / 2;
  ctx.fillText(theme.title, titleX, layout === 'horizontal' ? height * 0.82 : height * 0.06);

  ctx.font = `${Math.round(base * 0.04)}px "Mali", "Be Vietnam Pro", cursive`;
  ctx.fillStyle = theme.mutedInk;
  const subtitle = `${profile.name} · Class ${profile.className} · ${new Date().toLocaleDateString('vi-VN')}`;
  ctx.fillText(subtitle, titleX, layout === 'horizontal' ? height * 0.9 : height * 0.096);

  ctx.font = `${Math.round(base * 0.032)}px "Mali", "Be Vietnam Pro", cursive`;
  ctx.fillStyle = theme.mutedInk;
  const maxTextWidth = width * (layout === 'horizontal' ? 0.38 : 0.74);
  const words = `${theme.captionPrefix} ${caption}`.split(' ');
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

  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = Math.max(3, base * 0.006);
  ctx.beginPath();
  ctx.moveTo(width * 0.82, height * 0.05);
  ctx.bezierCurveTo(width * 0.9, height * 0.02, width * 0.96, height * 0.09, width * 0.9, height * 0.13);
  ctx.bezierCurveTo(width * 0.84, height * 0.09, width * 0.78, height * 0.02, width * 0.82, height * 0.05);
  ctx.stroke();

  ctx.fillStyle = theme.accentSoft;
  ctx.beginPath();
  ctx.arc(width * 0.09, height * 0.07, base * 0.018, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(width * 0.92, height * 0.93, base * 0.025, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = `${Math.round(base * 0.038)}px "Mali", "Be Vietnam Pro", cursive`;
  ctx.fillStyle = theme.accent;
  ctx.textAlign = 'center';
  ctx.fillText(theme.signature, width * 0.5, layout === 'horizontal' ? height * 0.16 : height * 0.975);

  if (theme.id === 'best-friends') {
    ctx.fillStyle = theme.accent;
    ['BFF', '9/8', 'TEAM'].forEach((text, index) => {
      ctx.save();
      ctx.translate(width * (0.15 + index * 0.34), height * (index % 2 ? 0.14 : 0.88));
      ctx.rotate(index % 2 ? 0.12 : -0.1);
      roundRect(ctx, -base * 0.05, -base * 0.026, base * 0.1, base * 0.052, base * 0.018);
      ctx.fill();
      ctx.fillStyle = theme.paper;
      ctx.font = `${Math.round(base * 0.032)}px "Saira Condensed", "Be Vietnam Pro", sans-serif`;
      ctx.fillText(text, 0, base * 0.002);
      ctx.restore();
      ctx.fillStyle = theme.accent;
    });
  }

  if (theme.id === 'korean-booth') {
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = Math.max(2, base * 0.004);
    for (let i = 0; i < 4; i += 1) {
      ctx.strokeRect(width * (0.06 + i * 0.025), height * 0.925, base * 0.012, base * 0.012);
    }
  }

  if (theme.id === 'farewell-day') {
    ctx.save();
    ctx.translate(width * 0.12, height * 0.91);
    ctx.rotate(-0.06);
    ctx.fillStyle = 'rgba(255, 250, 241, .7)';
    roundRect(ctx, 0, 0, base * 0.24, base * 0.105, base * 0.018);
    ctx.fill();
    ctx.fillStyle = theme.ink;
    ctx.font = `${Math.round(base * 0.032)}px "Saira Condensed", "Be Vietnam Pro", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('LAST DAY', base * 0.12, base * 0.045);
    ctx.font = `${Math.round(base * 0.026)}px "Mali", "Be Vietnam Pro", cursive`;
    ctx.fillText('we were here', base * 0.12, base * 0.078);
    ctx.restore();
  }

  if (theme.id === 'vintage-final' || theme.id === 'farewell-day') {
    ctx.strokeStyle = 'rgba(122, 86, 57, .18)';
    ctx.lineWidth = Math.max(1, base * 0.002);
    for (let y = height * 0.16; y < height * 0.88; y += base * 0.07) {
      ctx.beginPath();
      ctx.moveTo(width * 0.08, y);
      ctx.lineTo(width * 0.92, y);
      ctx.stroke();
    }
  }

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
  const heightRatio = config.photoCount === 1 ? singlePhotoHeightRatio[config.layout] : layoutHeightRatio[config.layout];
  const height = Math.round(width * heightRatio);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas is not supported in this browser.');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const theme = getMoodTheme(config.moodId);
  await drawBackground(ctx, width, height, background, theme, config.customBackground, config.customBackgroundEdit);
  drawMoodBackdrop(ctx, width, height, theme);

  const loadedPhotos = await Promise.all(photos.map((photo) => loadImage(photo.dataUrl)));
  const frames = getFrames(config.layout, loadedPhotos.length, width, height);

  loadedPhotos.forEach((image, index) => drawPhotoFrame(ctx, image, frames[index], index, theme));
  drawMoodDecorations(ctx, width, height, config.layout, profile, theme, caption);

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
