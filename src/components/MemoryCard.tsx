import { Heart, MessageCircle, Send, Trash2 } from 'lucide-react';
import { memo, useCallback, useMemo, useState, type FormEvent } from 'react';
import type { MemoryComment, MemoryItem, UserProfile } from '../types';
import { formatUploadTime } from '../utils/date';

interface MemoryCardProps {
  memory: MemoryItem;
  comments: MemoryComment[];
  profile: UserProfile | null;
  isReacting: boolean;
  onJoin: () => void;
  onReact: (memory: MemoryItem) => void | Promise<void>;
  onAddComment: (memory: MemoryItem, message: string) => void | Promise<void>;
  onDeleteComment: (comment: MemoryComment) => void | Promise<void>;
  canDelete?: boolean;
  onDelete?: (memory: MemoryItem) => void | Promise<void>;
}

const toneClass = {
  pink: 'from-blush/45 to-paper',
  blue: 'from-skySoft/45 to-paper',
  cream: 'from-[#f4dfbf]/65 to-paper',
  chalk: 'from-chalk/20 to-paper',
};

function MemoryCard({
  memory,
  comments,
  profile,
  isReacting,
  onJoin,
  onReact,
  onAddComment,
  onDeleteComment,
  canDelete = false,
  onDelete,
}: MemoryCardProps) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const hasLiked = Boolean(profile?.uid && memory.likedBy.includes(profile.uid));
  const visibleComments = useMemo(() => (commentsOpen ? comments : comments.slice(0, 2)), [comments, commentsOpen]);

  const handleReact = useCallback(() => {
    if (hasLiked || isReacting) return;
    void onReact(memory);
  }, [hasLiked, isReacting, memory, onReact]);

  const handleSubmitComment = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const message = draft.trim();
      if (!message) return;
      setDraft('');
      void onAddComment(memory, message);
    },
    [draft, memory, onAddComment],
  );

  const handleDelete = useCallback(() => {
    if (!window.confirm('Xóa ảnh photobook này khỏi feed lớp?')) return;
    void onDelete?.(memory);
  }, [memory, onDelete]);

  return (
    <article
      className="polaroid group mb-5 break-inside-avoid"
      style={{ transform: `translateZ(0) rotate(${memory.rotation}deg)` }}
    >
      <div className={`rounded-[0.35rem] bg-gradient-to-br p-2 ${toneClass[memory.tone]}`}>
        <div className="scrapbook-tape left-7 top-1 -rotate-6" />
        <div className="scrapbook-tape right-8 top-1 rotate-6 bg-blush/50" />
        <img
          src={memory.imageUrl}
          alt={`Ký ức học trò của ${memory.name}`}
          loading="lazy"
          decoding="async"
          className="aspect-[4/5] w-full rounded-[0.35rem] object-cover transition-transform duration-300 ease-out group-hover:scale-[1.025]"
        />
      </div>

      <div className="px-2 pb-2 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="break-words font-semibold text-ink">{memory.name}</h3>
            <p className="text-xs font-semibold uppercase text-coffee/65">Lớp {memory.className}</p>
          </div>
          <span className="shrink-0 rounded-full bg-skySoft/25 px-2 py-1 text-[11px] font-semibold text-chalk">
            {formatUploadTime(memory.createdAt)}
          </span>
        </div>

        <p className="mt-3 break-words text-sm leading-6 text-ink/78">{memory.caption}</p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {memory.hashtags.map((tag) => (
            <span key={tag} className="rounded-full bg-coffee/8 px-2 py-1 text-[11px] font-semibold text-coffee">
              #{tag}
            </span>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-coffee/10 pt-3">
          <button
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition ${
              hasLiked
                ? 'bg-blush/45 text-ink shadow-sm'
                : 'bg-blush/25 text-coffee hover:bg-blush/40 active:scale-[0.98]'
            }`}
            onClick={handleReact}
            disabled={hasLiked || isReacting}
            aria-label={hasLiked ? 'Bạn đã thả tim ảnh này' : 'Thả tim ảnh này'}
            title={hasLiked ? 'Bạn đã thả tim ảnh này rồi' : 'Thả tim'}
          >
            <Heart size={15} fill={hasLiked ? 'currentColor' : 'none'} />
            {memory.reactions}
          </button>

          <div className="inline-flex items-center gap-2">
            {canDelete && (
              <button
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-coffee/10 text-coffee transition hover:bg-coffee/18"
                onClick={handleDelete}
                aria-label="Xóa ảnh đã đăng"
                title="Xóa ảnh đã đăng"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-ink/5 px-3 text-xs font-bold text-ink/60 transition hover:bg-ink/10"
              onClick={() => setCommentsOpen((open) => !open)}
              aria-expanded={commentsOpen}
            >
              <MessageCircle size={14} />
              {comments.length} bình luận
            </button>
          </div>
        </div>

        {(commentsOpen || comments.length > 0) && (
          <div className="mt-3 rounded-[0.75rem] bg-white/46 p-3 shadow-[inset_0_0_0_1px_rgba(122,86,57,0.08)]">
            <div className="grid gap-2">
              {visibleComments.map((comment) => {
                const canDeleteComment = profile?.uid === comment.uid && !comment.pending;
                return (
                  <div key={comment.id} className="rounded-[0.65rem] bg-paper/78 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-coffee">
                          {comment.name}
                          {comment.pending ? ' · đang gửi' : ''}
                        </p>
                        <p className="mt-1 break-words text-xs leading-5 text-ink/72">{comment.message}</p>
                      </div>
                      {canDeleteComment && (
                        <button
                          className="shrink-0 rounded-full p-1 text-coffee/60 transition hover:bg-coffee/10 hover:text-coffee"
                          onClick={() => void onDeleteComment(comment)}
                          aria-label="Xóa bình luận"
                          title="Xóa bình luận"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {comments.length > 2 && (
              <button
                className="mt-2 text-xs font-bold text-coffee/70"
                onClick={() => setCommentsOpen((open) => !open)}
              >
                {commentsOpen ? 'Thu gọn bình luận' : `Xem thêm ${comments.length - 2} bình luận`}
              </button>
            )}

            {profile ? (
              <form className="mt-3 flex items-center gap-2" onSubmit={handleSubmitComment}>
                <input
                  className="input-field min-h-10 py-2 text-xs"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value.slice(0, 240))}
                  placeholder="Viết bình luận..."
                  maxLength={240}
                />
                <button
                  className="inline-grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-paper transition hover:-translate-y-0.5 disabled:hover:translate-y-0"
                  disabled={!draft.trim()}
                  aria-label="Gửi bình luận"
                >
                  <Send size={15} />
                </button>
              </form>
            ) : (
              <button className="secondary-button mt-3 min-h-10 justify-center text-xs" onClick={onJoin}>
                Vào lớp để bình luận
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export default memo(MemoryCard);
