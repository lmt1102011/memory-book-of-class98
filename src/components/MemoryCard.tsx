import { Heart, MessageCircle } from 'lucide-react';
import { memo } from 'react';
import type { MemoryItem } from '../types';
import { formatUploadTime } from '../utils/date';

interface MemoryCardProps {
  memory: MemoryItem;
  onReact: () => void;
}

const toneClass = {
  pink: 'from-blush/45 to-paper',
  blue: 'from-skySoft/45 to-paper',
  cream: 'from-[#f4dfbf]/65 to-paper',
  chalk: 'from-chalk/20 to-paper',
};

function MemoryCard({ memory, onReact }: MemoryCardProps) {
  return (
    <article
      className="polaroid group mb-5 break-inside-avoid"
      style={{ transform: `rotate(${memory.rotation}deg)` }}
    >
      <div className={`rounded-[0.35rem] bg-gradient-to-br p-2 ${toneClass[memory.tone]}`}>
        <div className="scrapbook-tape left-7 top-1 -rotate-6" />
        <div className="scrapbook-tape right-8 top-1 rotate-6 bg-blush/50" />
        <img
          src={memory.imageUrl}
          alt={`${memory.name}'s school memory`}
          loading="lazy"
          decoding="async"
          className="aspect-[4/5] w-full rounded-[0.35rem] object-cover transition-transform duration-300 ease-out group-hover:scale-[1.025]"
        />
      </div>

      <div className="px-2 pb-2 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-ink">{memory.name}</h3>
            <p className="text-xs font-semibold uppercase text-coffee/65">Class {memory.className}</p>
          </div>
          <span className="rounded-full bg-skySoft/25 px-2 py-1 text-[11px] font-semibold text-chalk">
            {formatUploadTime(memory.createdAt)}
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-ink/78">{memory.caption}</p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {memory.hashtags.map((tag) => (
            <span key={tag} className="rounded-full bg-coffee/8 px-2 py-1 text-[11px] font-semibold text-coffee">
              #{tag}
            </span>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-coffee/10 pt-3">
          <button
            className="inline-flex items-center gap-1.5 rounded-full bg-blush/25 px-3 py-2 text-xs font-bold text-coffee transition hover:bg-blush/40"
            onClick={onReact}
          >
            <Heart size={15} fill="currentColor" />
            {memory.reactions}
          </button>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink/50">
            <MessageCircle size={14} />
            Memory
          </span>
        </div>
      </div>
    </article>
  );
}

export default memo(MemoryCard);
