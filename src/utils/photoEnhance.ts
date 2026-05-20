const MAX_EDGE = 3200;
const MAX_PIXELS = 5_800_000;
const SOFT_BLEND = 0.48;
const GLOW_BLEND = 0.08;
const SHARPEN_EDGE_AMOUNT = 0.31;
const SHARPEN_TEXTURE_AMOUNT = 0.11;
const DETAIL_THRESHOLD = 8;
const TONE_LIFT = 0.038;

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

const waitForPaint = () =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });

const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas is not supported in this browser.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { canvas, ctx };
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

const clampChannel = (value: number) => Math.max(0, Math.min(255, value));

const releaseCanvas = (canvas: HTMLCanvasElement) => {
  canvas.width = 1;
  canvas.height = 1;
};

const applyNaturalDetail = (
  outputCtx: CanvasRenderingContext2D,
  softCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
) => {
  const output = outputCtx.getImageData(0, 0, width, height);
  const soft = softCtx.getImageData(0, 0, width, height);
  const outputData = output.data;
  const softData = soft.data;

  for (let index = 0; index < outputData.length; index += 4) {
    const redDiff = outputData[index] - softData[index];
    const greenDiff = outputData[index + 1] - softData[index + 1];
    const blueDiff = outputData[index + 2] - softData[index + 2];
    const detail = Math.abs(redDiff * 0.299 + greenDiff * 0.587 + blueDiff * 0.114);
    const amount = detail > DETAIL_THRESHOLD ? SHARPEN_EDGE_AMOUNT : SHARPEN_TEXTURE_AMOUNT;

    const red = outputData[index] + redDiff * amount;
    const green = outputData[index + 1] + greenDiff * amount;
    const blue = outputData[index + 2] + blueDiff * amount;
    const luminance = (red * 0.299 + green * 0.587 + blue * 0.114) / 255;
    const lift = 1 + (1 - luminance) * TONE_LIFT;

    outputData[index] = clampChannel(red * lift + 3.8);
    outputData[index + 1] = clampChannel(green * (lift + 0.002) + 2.4);
    outputData[index + 2] = clampChannel(blue * (lift + 0.008) + 4.2);
  }

  outputCtx.putImageData(output, 0, 0);
};

export async function beautifyPhotoDataUrl(dataUrl: string): Promise<string> {
  const image = await loadImage(dataUrl);
  const { width, height } = getTargetSize(image.naturalWidth || image.width, image.naturalHeight || image.height);

  await waitForPaint();

  const base = createCanvas(width, height);
  const soft = createCanvas(width, height);
  const glow = createCanvas(width, height);
  const output = createCanvas(width, height);

  try {
    base.ctx.fillStyle = '#fffaf1';
    base.ctx.fillRect(0, 0, width, height);
    base.ctx.drawImage(image, 0, 0, width, height);

    soft.ctx.fillStyle = '#fffaf1';
    soft.ctx.fillRect(0, 0, width, height);
    soft.ctx.filter = 'blur(2.2px) brightness(107%) contrast(102.8%) saturate(105%)';
    soft.ctx.drawImage(base.canvas, 0, 0);
    soft.ctx.filter = 'none';

    glow.ctx.fillStyle = '#fffaf1';
    glow.ctx.fillRect(0, 0, width, height);
    glow.ctx.filter = 'blur(6px) brightness(116%) contrast(101%) saturate(108%)';
    glow.ctx.drawImage(base.canvas, 0, 0);
    glow.ctx.filter = 'none';

    output.ctx.fillStyle = '#fffaf1';
    output.ctx.fillRect(0, 0, width, height);
    output.ctx.filter = 'brightness(105%) contrast(103%) saturate(104%)';
    output.ctx.drawImage(base.canvas, 0, 0);
    output.ctx.filter = 'none';
    output.ctx.globalAlpha = SOFT_BLEND;
    output.ctx.drawImage(soft.canvas, 0, 0);
    output.ctx.globalAlpha = 1;
    output.ctx.globalCompositeOperation = 'screen';
    output.ctx.globalAlpha = GLOW_BLEND;
    output.ctx.drawImage(glow.canvas, 0, 0);
    output.ctx.globalCompositeOperation = 'source-over';
    output.ctx.globalAlpha = 1;
    releaseCanvas(base.canvas);
    releaseCanvas(glow.canvas);

    applyNaturalDetail(output.ctx, soft.ctx, width, height);
    return output.canvas.toDataURL('image/jpeg', 0.96);
  } finally {
    releaseCanvas(base.canvas);
    releaseCanvas(soft.canvas);
    releaseCanvas(glow.canvas);
    releaseCanvas(output.canvas);
  }
}
