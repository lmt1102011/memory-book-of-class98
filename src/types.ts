export type AppRoute = 'landing' | 'join' | 'home' | 'photobook';

export type PhotoCount = 2 | 4 | 6;

export type LayoutType = 'vertical' | 'square' | 'horizontal';

export type ExportQuality = '1080p' | '2k' | '4k';

export type BackgroundKind = 'pastel' | 'classroom' | 'vintage' | 'custom';

export interface UserProfile {
  uid: string;
  name: string;
  nameKey: string;
  className: string;
  joinedAt: string;
}

export interface MemoryItem {
  id: string;
  uid?: string;
  source?: 'seed' | 'firebase';
  name: string;
  className: string;
  caption: string;
  hashtags: string[];
  imageUrl: string;
  createdAt: string;
  reactions: number;
  rotation: number;
  tone: 'pink' | 'blue' | 'cream' | 'chalk';
  storagePath?: string;
}

export interface GuestbookEntry {
  id: string;
  uid?: string;
  name: string;
  message: string;
  createdAt: string;
}

export interface CapturedPhoto {
  id: string;
  dataUrl: string;
}

export interface BackgroundOption {
  id: string;
  label: string;
  kind: BackgroundKind;
  swatch: string;
  description: string;
}

export interface PhotobookConfig {
  photoCount: PhotoCount;
  layout: LayoutType;
  quality: ExportQuality;
  backgroundId: string;
  customBackground?: string;
}

export interface GeneratedPhotobook {
  blob: Blob;
  dataUrl?: string;
  width: number;
  height: number;
}

export interface PublishMemoryDraft {
  imageBlob: Blob;
  caption: string;
  hashtags: string[];
}

export interface SecretLetterPublic {
  id: string;
  message: string;
  createdAt: string;
}
