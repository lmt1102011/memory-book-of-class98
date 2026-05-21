export interface PreparedVideoDraft {
  dataUrl: string;
  thumbnailDataUrl: string;
  name: string;
  mimeType: string;
  size: number;
  originalSize: number;
  duration: number;
  compressed: boolean;
}

export interface VideoPrepareProgress {
  label: string;
  percent: number;
  detail?: string;
}

interface PrepareShortVideoOptions {
  maxInputBytes?: number;
  maxOutputBytes?: number;
  maxDurationSeconds?: number;
  mobile?: boolean;
  onProgress?: (progress: VideoPrepareProgress) => void;
}

const DEFAULT_MAX_INPUT_BYTES = 28 * 1024 * 1024;
const DEFAULT_MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_DURATION_SECONDS = 20;

export const formatVideoSize = (bytes: number) => {
  if (!bytes) return '0MB';
  return `${(bytes / (1024 * 1024)).toFixed(bytes > 1024 * 1024 ? 1 : 2)}MB`;
};

export const formatVideoDuration = (seconds: number) => `${Math.max(1, Math.round(seconds || 0))}s`;

const readBlobAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const waitForVideoMetadata = (src: string) =>
  new Promise<HTMLVideoElement>((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => resolve(video);
    video.onerror = () => reject(new Error('Không thể đọc thông tin video này.'));
    video.src = src;
  });

const waitForVideoCanPlay = (video: HTMLVideoElement) =>
  new Promise<void>((resolve, reject) => {
    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      resolve();
      return;
    }

    video.oncanplay = () => resolve();
    video.onerror = () => reject(new Error('Không thể phát video để xử lý.'));
  });

const makeVideoThumbnail = async (video: HTMLVideoElement) => {
  const seekTo = Math.min(Math.max(video.duration * 0.12, 0.1), 1.2);

  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    video.onseeked = finish;
    video.currentTime = Number.isFinite(seekTo) ? seekTo : 0.1;
    window.setTimeout(finish, 900);
  });

  const maxWidth = 920;
  const aspect = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;
  const width = Math.min(maxWidth, video.videoWidth || maxWidth);
  const height = Math.round(width / aspect);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas không hỗ trợ trên trình duyệt này.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#35291f';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.84);
};

const pickRecorderMimeType = () => {
  if (!('MediaRecorder' in window)) return '';
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || '';
};

const compressVideoWithCanvas = async (
  src: string,
  sourceVideo: HTMLVideoElement,
  options: Required<Pick<PrepareShortVideoOptions, 'maxOutputBytes' | 'mobile'>> & {
    onProgress?: (progress: VideoPrepareProgress) => void;
  },
) => {
  const mimeType = pickRecorderMimeType();
  if (!mimeType) throw new Error('Trình duyệt này chưa hỗ trợ nén video trực tiếp. Hãy chọn video MP4/WebM dưới 8MB.');

  const video = document.createElement('video');
  video.src = src;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  await waitForVideoCanPlay(video);

  const aspect = sourceVideo.videoWidth && sourceVideo.videoHeight ? sourceVideo.videoWidth / sourceVideo.videoHeight : 16 / 9;
  const maxWidth = options.mobile ? 540 : 720;
  const width = Math.min(maxWidth, sourceVideo.videoWidth || maxWidth);
  const height = Math.round(width / aspect);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, width);
  canvas.height = Math.max(2, height);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas không hỗ trợ trên trình duyệt này.');

  const stream = canvas.captureStream(options.mobile ? 20 : 24);
  const bitrate = options.mobile ? 850_000 : 1_150_000;
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: bitrate,
  });
  const chunks: BlobPart[] = [];

  const recorded = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => reject(new Error('Không thể nén video này.'));
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType.split(';')[0] || 'video/webm' }));
  });

  let frame = 0;
  let rafId = 0;
  const draw = () => {
    ctx.fillStyle = '#35291f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : sourceVideo.duration || 1;
    const percent = Math.min(92, 28 + (video.currentTime / duration) * 58);
    if (frame % 8 === 0) {
      options.onProgress?.({
        label: 'Đang nén video',
        percent,
        detail: 'Giảm độ phân giải và dung lượng để feed tải mượt hơn.',
      });
    }
    frame += 1;
    if (!video.ended && !video.paused) rafId = window.requestAnimationFrame(draw);
  };

  recorder.start(700);
  video.currentTime = 0;
  await video.play();
  draw();

  await new Promise<void>((resolve) => {
    video.onended = () => resolve();
    window.setTimeout(resolve, Math.ceil((sourceVideo.duration || 20) * 1000) + 1600);
  });

  if (rafId) window.cancelAnimationFrame(rafId);
  if (recorder.state !== 'inactive') recorder.stop();
  stream.getTracks().forEach((track) => track.stop());
  const blob = await recorded;

  if (blob.size > options.maxOutputBytes) {
    throw new Error(
      `Video sau khi nén vẫn còn ${formatVideoSize(blob.size)}. Hãy cắt ngắn hơn hoặc chọn video nhẹ hơn ${formatVideoSize(
        options.maxOutputBytes,
      )}.`,
    );
  }

  return blob;
};

export const prepareShortVideo = async (file: File, options: PrepareShortVideoOptions = {}): Promise<PreparedVideoDraft> => {
  const maxInputBytes = options.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES;
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  const maxDurationSeconds = options.maxDurationSeconds ?? DEFAULT_MAX_DURATION_SECONDS;
  const onProgress = options.onProgress;

  if (!file.type.startsWith('video/')) throw new Error('Hãy chọn một file video hợp lệ.');
  if (file.size > maxInputBytes) {
    throw new Error(`Video gốc tối đa ${formatVideoSize(maxInputBytes)}. Hãy cắt ngắn video rồi thử lại.`);
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    onProgress?.({ label: 'Đang đọc video', percent: 10, detail: 'Kiểm tra thời lượng và định dạng.' });
    const video = await waitForVideoMetadata(objectUrl);
    const duration = Number.isFinite(video.duration) ? video.duration : 0;

    if (duration > maxDurationSeconds) {
      throw new Error(`Video tối đa ${maxDurationSeconds} giây để tải nhanh và không làm nặng database.`);
    }

    onProgress?.({ label: 'Đang tạo ảnh bìa', percent: 22, detail: 'Feed sẽ dùng ảnh bìa nhẹ trước khi mở video.' });
    const thumbnailDataUrl = await makeVideoThumbnail(video);

    let outputBlob: Blob = file;
    let compressed = false;
    if (file.size > maxOutputBytes * 0.72) {
      outputBlob = await compressVideoWithCanvas(objectUrl, video, {
        maxOutputBytes,
        mobile: Boolean(options.mobile),
        onProgress,
      });
      compressed = true;
    }

    if (outputBlob.size > maxOutputBytes) {
      throw new Error(`Video tối đa ${formatVideoSize(maxOutputBytes)} sau khi xử lý.`);
    }

    onProgress?.({ label: 'Đang hoàn tất', percent: 96, detail: 'Chuẩn bị preview và dữ liệu đăng lên feed.' });
    const dataUrl = await readBlobAsDataUrl(outputBlob);
    onProgress?.({ label: 'Sẵn sàng đăng', percent: 100, detail: compressed ? 'Video đã được nén nhẹ.' : 'Video đã đủ nhẹ.' });

    return {
      dataUrl,
      thumbnailDataUrl,
      name: file.name,
      mimeType: outputBlob.type || file.type || 'video/mp4',
      size: outputBlob.size,
      originalSize: file.size,
      duration,
      compressed,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};
