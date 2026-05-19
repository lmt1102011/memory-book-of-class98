import type { GuestbookEntry, MemoryItem } from '../types';

const svgDataUri = (svg: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const memoryScene = (
  id: number,
  colors: { bg: string; glow: string; accent: string; deep: string },
  motif: 'window' | 'desk' | 'lockers' | 'graduation' | 'photobooth' | 'notebook',
) => {
  const motifs = {
    window: `<rect x="54" y="50" width="210" height="162" rx="24" fill="${colors.glow}" opacity=".78"/><path d="M159 52v158M56 131h206" stroke="${colors.deep}" stroke-width="5" opacity=".28"/><circle cx="288" cy="78" r="24" fill="${colors.accent}" opacity=".68"/><path d="M30 260c72-36 140-36 205 0s123 37 175-4v74H30z" fill="${colors.deep}" opacity=".22"/>`,
    desk: `<rect x="70" y="152" width="278" height="34" rx="17" fill="${colors.deep}" opacity=".34"/><rect x="96" y="184" width="218" height="86" rx="20" fill="${colors.glow}" opacity=".8"/><path d="M125 122h142l18 32H104z" fill="${colors.accent}" opacity=".78"/><circle cx="313" cy="116" r="26" fill="${colors.deep}" opacity=".2"/>`,
    lockers: `<rect x="52" y="42" width="94" height="246" rx="18" fill="${colors.glow}" opacity=".78"/><rect x="160" y="42" width="94" height="246" rx="18" fill="#fffaf1" opacity=".72"/><rect x="268" y="42" width="94" height="246" rx="18" fill="${colors.accent}" opacity=".62"/><path d="M82 90h34M190 90h34M298 90h34M82 154h34M190 154h34M298 154h34" stroke="${colors.deep}" stroke-width="5" stroke-linecap="round" opacity=".32"/>`,
    graduation: `<path d="M209 62 61 123l148 61 148-61z" fill="${colors.deep}" opacity=".68"/><path d="M120 154v58c0 38 178 38 178 0v-58" fill="${colors.glow}" opacity=".82"/><path d="M326 136v82" stroke="${colors.deep}" stroke-width="8" stroke-linecap="round"/><circle cx="326" cy="226" r="13" fill="${colors.accent}"/>`,
    photobooth: `<rect x="76" y="34" width="260" height="280" rx="38" fill="#fffaf1" opacity=".9"/><rect x="102" y="62" width="208" height="98" rx="24" fill="${colors.glow}" opacity=".86"/><rect x="102" y="176" width="92" height="102" rx="22" fill="${colors.accent}" opacity=".68"/><rect x="218" y="176" width="92" height="102" rx="22" fill="${colors.deep}" opacity=".28"/><circle cx="207" cy="112" r="23" fill="${colors.deep}" opacity=".25"/>`,
    notebook: `<rect x="70" y="34" width="272" height="286" rx="24" fill="#fffaf1" opacity=".88"/><path d="M111 34v286" stroke="${colors.accent}" stroke-width="5" opacity=".6"/><path d="M136 90h158M136 137h158M136 184h158M136 231h112" stroke="${colors.deep}" stroke-width="5" stroke-linecap="round" opacity=".25"/><path d="M64 88h34M64 144h34M64 200h34M64 256h34" stroke="${colors.deep}" stroke-width="8" stroke-linecap="round" opacity=".18"/>`,
  };

  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="420" height="560" viewBox="0 0 420 560">
      <defs>
        <linearGradient id="g${id}" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${colors.bg}"/>
          <stop offset=".58" stop-color="${colors.glow}"/>
          <stop offset="1" stop-color="#fffaf1"/>
        </linearGradient>
        <filter id="paper${id}">
          <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0"/>
          <feComponentTransfer><feFuncA type="table" tableValues="0 .10"/></feComponentTransfer>
        </filter>
      </defs>
      <rect width="420" height="560" rx="34" fill="url(#g${id})"/>
      <rect width="420" height="560" rx="34" filter="url(#paper${id})"/>
      <g transform="translate(0 74)">${motifs[motif]}</g>
      <path d="M38 410c62-28 96-12 141 10 67 32 132 29 203-18" fill="none" stroke="${colors.deep}" stroke-width="9" stroke-linecap="round" opacity=".16"/>
      <circle cx="74" cy="76" r="17" fill="${colors.accent}" opacity=".5"/>
      <circle cx="350" cy="420" r="26" fill="${colors.accent}" opacity=".34"/>
    </svg>
  `);
};

export const SEED_MEMORIES: MemoryItem[] = [
  {
    id: 'memory-1',
    name: 'Minh Tri',
    className: '9/8',
    caption: 'The hallway was ordinary until it became the place we grew up.',
    hashtags: ['graduation', 'hallway', 'youth'],
    imageUrl: memoryScene(1, { bg: '#fff6ea', glow: '#f7b7c7', accent: '#a9cde8', deep: '#7a5639' }, 'lockers'),
    createdAt: '2026-05-18T10:24:00.000Z',
    reactions: 48,
    rotation: -2.2,
    tone: 'pink',
  },
  {
    id: 'memory-2',
    name: 'An Nhi',
    className: '9/8',
    caption: 'Last bell, first photo, too many things we forgot to say.',
    hashtags: ['lastbell', 'friends', 'school'],
    imageUrl: memoryScene(2, { bg: '#eef7ff', glow: '#a9cde8', accent: '#f7b7c7', deep: '#385b58' }, 'window'),
    createdAt: '2026-05-17T15:44:00.000Z',
    reactions: 64,
    rotation: 1.7,
    tone: 'blue',
  },
  {
    id: 'memory-3',
    name: 'Gia Han',
    className: '9/7',
    caption: 'We promised to remember the tiny jokes. Especially the tiny jokes.',
    hashtags: ['scrapbook', 'insidejokes', 'class98'],
    imageUrl: memoryScene(3, { bg: '#fbf3e7', glow: '#ffe0bf', accent: '#d88a9a', deep: '#7a5639' }, 'notebook'),
    createdAt: '2026-05-16T08:12:00.000Z',
    reactions: 37,
    rotation: -1.1,
    tone: 'cream',
  },
  {
    id: 'memory-4',
    name: 'Bao Long',
    className: '9/6',
    caption: 'Proof that a classroom can hold an entire universe.',
    hashtags: ['classroom', 'memories', 'film'],
    imageUrl: memoryScene(4, { bg: '#f8ead6', glow: '#f2d0a7', accent: '#a9cde8', deep: '#385b58' }, 'desk'),
    createdAt: '2026-05-15T14:08:00.000Z',
    reactions: 52,
    rotation: 2.4,
    tone: 'chalk',
  },
  {
    id: 'memory-5',
    name: 'Linh Chi',
    className: '9/8',
    caption: 'Four frames, one ridiculous pose, endless evidence.',
    hashtags: ['photobooth', 'besties', 'koreanbooth'],
    imageUrl: memoryScene(5, { bg: '#fffaf1', glow: '#f7b7c7', accent: '#a9cde8', deep: '#7a5639' }, 'photobooth'),
    createdAt: '2026-05-14T11:30:00.000Z',
    reactions: 89,
    rotation: -2.8,
    tone: 'pink',
  },
  {
    id: 'memory-6',
    name: 'Quang Huy',
    className: '9/5',
    caption: 'Graduation felt like an ending until everyone started smiling.',
    hashtags: ['graduation', 'ceremony', 'youth'],
    imageUrl: memoryScene(6, { bg: '#eef7ff', glow: '#fff6ea', accent: '#f7b7c7', deep: '#385b58' }, 'graduation'),
    createdAt: '2026-05-13T09:05:00.000Z',
    reactions: 75,
    rotation: 1.2,
    tone: 'blue',
  },
];

export const SEED_GUESTBOOK: GuestbookEntry[] = [
  {
    id: 'guest-1',
    name: 'Class 9/8',
    message: 'To the days that made us louder, softer, braver.',
    createdAt: '2026-05-18T18:00:00.000Z',
  },
  {
    id: 'guest-2',
    name: 'Memory Booth',
    message: 'Leave one sentence your future self will want to find again.',
    createdAt: '2026-05-18T18:05:00.000Z',
  },
];
