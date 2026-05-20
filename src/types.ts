export type AppRoute = 'landing' | 'join' | 'home' | 'letters' | 'remember' | 'diary' | 'photobook';

export type PhotoCount = 1 | 2 | 4 | 6;

export type LayoutType = 'vertical' | 'square' | 'horizontal';

export type ExportQuality = '1080p' | '2k' | '4k';

export type PhotobookMoodId =
  | 'classic-default'
  | 'clear-youth'
  | 'farewell-day'
  | 'best-friends'
  | 'korean-booth'
  | 'vintage-final';

export type BackgroundKind = 'pastel' | 'classroom' | 'vintage' | 'custom';

export interface UserProfile {
  uid: string;
  name: string;
  nameKey: string;
  className: string;
  joinedAt: string;
}

export interface ClassmateProfile {
  uid: string;
  name: string;
  nameKey: string;
  className: string;
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
  likedBy: string[];
  rotation: number;
  tone: 'pink' | 'blue' | 'cream' | 'chalk';
}

export interface MemoryComment {
  id: string;
  memoryId: string;
  uid?: string;
  name: string;
  nameKey?: string;
  message: string;
  createdAt: string;
  pending?: boolean;
}

export interface GuestbookEntry {
  id: string;
  uid?: string;
  name: string;
  message: string;
  createdAt: string;
  anonymous?: boolean;
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

export interface PhotobookMoodOption {
  id: PhotobookMoodId;
  label: string;
  shortLabel: string;
  description: string;
  swatch: string;
}

export interface BackgroundEdit {
  scale: number;
  x: number;
  y: number;
  brightness: number;
  blur: number;
}

export interface PhotobookConfig {
  photoCount: PhotoCount;
  layout: LayoutType;
  quality: ExportQuality;
  backgroundId: string;
  moodId?: PhotobookMoodId;
  customBackground?: string;
  customBackgroundEdit?: BackgroundEdit;
}

export interface GeneratedPhotobook {
  blob: Blob;
  dataUrl?: string;
  width: number;
  height: number;
}

export interface PublishMemoryDraft {
  imageDataUrl: string;
  caption: string;
  hashtags: string[];
}

export interface SecretDiaryEntry {
  id: string;
  uid?: string;
  name?: string;
  nameKey?: string;
  message: string;
  createdAt: string;
}

export interface RememberNote {
  id: string;
  fromUid?: string;
  fromName: string;
  fromNameKey?: string;
  toName: string;
  toNameKey: string;
  message: string;
  anonymous: boolean;
  createdAt: string;
  viewedAt?: string;
  heartedBy: string[];
}

export interface RememberNoteDraft {
  toName: string;
  toNameKey: string;
  message: string;
  anonymous: boolean;
}
