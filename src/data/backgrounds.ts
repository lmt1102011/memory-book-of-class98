import type { BackgroundOption, ExportQuality, LayoutType, PhotoCount } from '../types';

export const BACKGROUND_OPTIONS: BackgroundOption[] = [
  {
    id: 'pastel-dawn',
    label: 'Pastel Dawn',
    kind: 'pastel',
    swatch: 'linear-gradient(135deg, #fff6ea, #f7b7c7 52%, #a9cde8)',
    description: 'Nền studio hồng xanh nhẹ, mềm và trong.',
  },
  {
    id: 'classroom-light',
    label: 'Classroom',
    kind: 'classroom',
    swatch: 'linear-gradient(135deg, #f8ead6, #385b58)',
    description: 'Bảng lớp học ấm, có cảm giác nắng bên cửa sổ.',
  },
  {
    id: 'vintage-note',
    label: 'Vintage Note',
    kind: 'vintage',
    swatch: 'linear-gradient(135deg, #fffaf1, #d8bc98 62%, #7a5639)',
    description: 'Giấy scrapbook cũ với đường kẻ vở học trò.',
  },
  {
    id: 'custom-upload',
    label: 'Upload',
    kind: 'custom',
    swatch: 'linear-gradient(135deg, #ffffff, #f7b7c7, #7a5639)',
    description: 'Dùng ảnh nền riêng của bạn.',
  },
];

export const PHOTO_COUNT_OPTIONS: PhotoCount[] = [1, 2, 4, 6];

export const LAYOUT_OPTIONS: Array<{ id: LayoutType; label: string; description: string }> = [
  { id: 'vertical', label: 'Strip dọc', description: 'Ảnh xếp từ trên xuống như photobooth Hàn.' },
  { id: 'square', label: 'Lưới vuông', description: 'Ảnh nằm trong khung album gọn và cân.' },
  { id: 'horizontal', label: 'Strip ngang', description: 'Ảnh xếp ngang thành một dải rộng.' },
];

export const QUALITY_OPTIONS: Array<{ id: ExportQuality; label: string; description: string }> = [
  { id: '1080p', label: '1080p', description: 'Nhanh, đủ nét để chia sẻ' },
  { id: '2k', label: '2K', description: 'Đẹp để lưu kỷ niệm' },
  { id: '4k', label: '4K', description: 'Nét nhất để in ảnh' },
];
