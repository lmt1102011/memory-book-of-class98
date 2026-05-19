import type { BackgroundOption, ExportQuality, LayoutType, PhotoCount } from '../types';

export const BACKGROUND_OPTIONS: BackgroundOption[] = [
  {
    id: 'pastel-dawn',
    label: 'Pastel Dawn',
    kind: 'pastel',
    swatch: 'linear-gradient(135deg, #fff6ea, #f7b7c7 52%, #a9cde8)',
    description: 'Soft pink and blue studio paper',
  },
  {
    id: 'classroom-light',
    label: 'Classroom',
    kind: 'classroom',
    swatch: 'linear-gradient(135deg, #f8ead6, #385b58)',
    description: 'Warm classroom board and window light',
  },
  {
    id: 'vintage-note',
    label: 'Vintage Note',
    kind: 'vintage',
    swatch: 'linear-gradient(135deg, #fffaf1, #d8bc98 62%, #7a5639)',
    description: 'Scrapbook paper with notebook lines',
  },
  {
    id: 'custom-upload',
    label: 'Upload',
    kind: 'custom',
    swatch: 'linear-gradient(135deg, #ffffff, #f7b7c7, #7a5639)',
    description: 'Use your own background image',
  },
];

export const PHOTO_COUNT_OPTIONS: PhotoCount[] = [1, 2, 4, 6];

export const LAYOUT_OPTIONS: Array<{ id: LayoutType; label: string; description: string }> = [
  { id: 'vertical', label: 'Vertical Strip', description: 'Anh xep doc nhu strip photobooth' },
  { id: 'square', label: 'Square Collage', description: 'Anh nam trong khung luoi album' },
  { id: 'horizontal', label: 'Horizontal Strip', description: 'Anh xep ngang thanh mot dai rong' },
];

export const QUALITY_OPTIONS: Array<{ id: ExportQuality; label: string; description: string }> = [
  { id: '1080p', label: '1080p', description: 'Fast, sharp sharing' },
  { id: '2k', label: '2K', description: 'Printable keepsake' },
  { id: '4k', label: '4K', description: 'Highest detail export' },
];
