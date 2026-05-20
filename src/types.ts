export type AppRoute = 'landing' | 'join' | 'home' | 'letters' | 'remember' | 'diary' | 'photobook' | 'people' | 'votes';

export type PhotoCount = 1 | 2 | 4 | 6;

export type LayoutType = 'vertical' | 'square' | 'horizontal';

export type ExportQuality = '1080p' | '2k' | '4k';

export type MemoryMediaType = 'image' | 'video';

export type MemoryVisibility = 'public' | 'private' | 'tagged';

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
  avatarDataUrl?: string;
  nickname?: string;
  quote?: string;
  classMessage?: string;
  personalityTags: string[];
  profileUpdatedAt?: string;
}

export interface MemoryItem {
  id: string;
  uid?: string;
  source?: 'seed' | 'firebase';
  storageCollection?: 'memories98' | 'privateMemories98';
  name: string;
  nameKey?: string;
  className: string;
  caption: string;
  hashtags: string[];
  mediaType: MemoryMediaType;
  imageUrl: string;
  videoChunked?: boolean;
  videoMimeType?: string;
  videoSize?: number;
  videoDuration?: number;
  visibility?: MemoryVisibility;
  visibleToUids?: string[];
  visibleToNameKeys?: string[];
  visibleToNames?: string[];
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
  mediaType?: MemoryMediaType;
  imageDataUrl: string;
  videoDataUrl?: string;
  videoMimeType?: string;
  videoSize?: number;
  videoDuration?: number;
  caption: string;
  hashtags: string[];
  visibility?: MemoryVisibility;
  visibleToUids?: string[];
  visibleToNameKeys?: string[];
  visibleToNames?: string[];
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
  reactionId?: RememberReactionId;
  reactionLabel?: string;
  reactedAt?: string;
  reactedBy?: string;
}

export type RememberReactionId = 'miss-you' | 'thank-you' | 'regret' | 'good-luck';

export interface RememberNoteDraft {
  toName: string;
  toNameKey: string;
  message: string;
  anonymous: boolean;
}

export type VoteCategoryTone = 'pink' | 'blue' | 'cream' | 'chalk';

export interface VoteCategory {
  id: string;
  uid: string;
  name: string;
  nameKey: string;
  title: string;
  description: string;
  tone: VoteCategoryTone;
  icon: string;
  createdAt: string;
  hidden?: boolean;
  hiddenAt?: string;
}

export interface VoteRecord {
  id: string;
  categoryId: string;
  voterUid: string;
  voterName: string;
  voterNameKey: string;
  targetUid: string;
  targetName: string;
  targetNameKey: string;
  createdAt: string;
  updatedAt?: string;
}

export interface YouthProfileDraft {
  avatarDataUrl?: string;
  nickname: string;
  quote: string;
  classMessage: string;
  personalityTags: string[];
}

export interface VoteCategoryDraft {
  title: string;
  description: string;
  tone: VoteCategoryTone;
  icon: string;
}
