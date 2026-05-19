import { FormEvent, memo, useMemo, useState, type CSSProperties } from 'react';
import { MessageCircle, Send, Trash2 } from 'lucide-react';
import type { GuestbookEntry, UserProfile } from '../types';
import { formatMemoryDate } from '../utils/date';

interface ClassMessageBoardProps {
  guestbook: GuestbookEntry[];
  profile: UserProfile | null;
  onJoin: () => void;
  onAddGuestbook: (message: string) => void | Promise<void>;
  onDeleteGuestbook: (entry: GuestbookEntry) => void | Promise<void>;
  onAddAnonymousMessage: (message: string) => void | Promise<void>;
}

type BoardNote =
  {
    id: string;
    type: 'class' | 'anonymous';
    name: string;
    message: string;
    createdAt: string;
    entry: GuestbookEntry;
  };

const notePalette = [
  'bg-paper text-ink',
  'bg-blush/90 text-ink',
  'bg-skySoft/90 text-ink',
  'bg-[#f4dfbf] text-ink',
  'bg-white text-ink',
];

const boardPositions = [
  { left: 6, top: 9, rotate: -5, width: 18 },
  { left: 30, top: 7, rotate: 3, width: 20 },
  { left: 59, top: 10, rotate: -2, width: 18 },
  { left: 12, top: 34, rotate: 4, width: 21 },
  { left: 42, top: 33, rotate: -4, width: 18 },
  { left: 68, top: 36, rotate: 5, width: 20 },
  { left: 7, top: 62, rotate: 2, width: 19 },
  { left: 33, top: 64, rotate: -3, width: 21 },
  { left: 61, top: 65, rotate: 3, width: 19 },
  { left: 21, top: 18, rotate: -2, width: 17 },
  { left: 49, top: 20, rotate: 5, width: 18 },
  { left: 77, top: 16, rotate: -4, width: 16 },
  { left: 5, top: 48, rotate: -3, width: 17 },
  { left: 28, top: 49, rotate: 2, width: 18 },
  { left: 53, top: 52, rotate: -5, width: 17 },
  { left: 76, top: 54, rotate: 4, width: 16 },
  { left: 18, top: 78, rotate: -4, width: 17 },
  { left: 48, top: 80, rotate: 2, width: 18 },
];

function ClassMessageBoard({
  guestbook,
  profile,
  onJoin,
  onAddGuestbook,
  onDeleteGuestbook,
  onAddAnonymousMessage,
}: ClassMessageBoardProps) {
  const [classMessage, setClassMessage] = useState('');
  const [anonymousMessage, setAnonymousMessage] = useState('');
  const [isSendingClass, setIsSendingClass] = useState(false);
  const [isSendingAnonymous, setIsSendingAnonymous] = useState(false);
  const [error, setError] = useState('');

  const notes = useMemo<BoardNote[]>(() => {
    return guestbook
      .map((entry) => ({
        id: `${entry.anonymous ? 'anonymous' : 'class'}-${entry.id}`,
        type: entry.anonymous ? 'anonymous' : 'class',
        name: entry.anonymous ? 'Ẩn danh' : entry.name,
        message: entry.message,
        createdAt: entry.createdAt,
        entry,
      }) as BoardNote)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 18);
  }, [guestbook]);

  const submitClassMessage = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = classMessage.trim();
    if (!trimmed) return;
    if (!profile) {
      onJoin();
      return;
    }

    try {
      setIsSendingClass(true);
      setError('');
      await onAddGuestbook(trimmed);
      setClassMessage('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể gửi tin nhắn cho lớp lúc này.');
    } finally {
      setIsSendingClass(false);
    }
  };

  const submitAnonymousMessage = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = anonymousMessage.trim();
    if (!trimmed) return;
    if (!profile) {
      onJoin();
      return;
    }

    try {
      setIsSendingAnonymous(true);
      setError('');
      await onAddAnonymousMessage(trimmed);
      setAnonymousMessage('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể gửi tin nhắn ẩn danh lúc này.');
    } finally {
      setIsSendingAnonymous(false);
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr]">
        <aside className="rounded-[1.5rem] border border-white/60 bg-white/50 p-4 shadow-paper backdrop-blur-xl sm:p-5">
          <p className="section-kicker">Bảng thư lớp</p>
          <h2 className="font-display text-5xl leading-none">Những mảnh thư trên bảng 9/8</h2>
          <p className="mt-3 text-sm leading-7 text-ink/66">
            Gửi một lời nhắn có tên cho cả lớp, hoặc để lại một điều ẩn danh như một mảnh giấy nhỏ dán trên bảng học.
          </p>

          <form className="mt-5 grid gap-3" onSubmit={submitClassMessage}>
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase text-coffee/70">Tin nhắn cho lớp</span>
              <textarea
                className="input-field min-h-24 resize-none"
                value={classMessage}
                onChange={(event) => setClassMessage(event.target.value)}
                placeholder={profile ? 'Viết lời nhắn có tên của bạn...' : 'Đăng nhập để gửi tin nhắn cho lớp...'}
                maxLength={160}
              />
            </label>
            <button className="primary-button justify-center" disabled={isSendingClass}>
              <Send size={17} />
              {isSendingClass ? 'Đang gửi...' : 'Gửi có tên'}
            </button>
          </form>

          <form className="mt-4 grid gap-3 rounded-[1rem] bg-ink/5 p-3" onSubmit={submitAnonymousMessage}>
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase text-coffee/70">Tin nhắn ẩn danh</span>
              <textarea
                className="input-field min-h-24 resize-none"
                value={anonymousMessage}
                onChange={(event) => setAnonymousMessage(event.target.value)}
                placeholder={profile ? 'Viết điều bạn muốn gửi ẩn danh...' : 'Đăng nhập để gửi ẩn danh...'}
                maxLength={160}
              />
            </label>
            <button className="secondary-button justify-center" disabled={isSendingAnonymous}>
              <MessageCircle size={17} />
              {isSendingAnonymous ? 'Đang gửi...' : 'Gửi ẩn danh'}
            </button>
          </form>

          {error && <p className="mt-3 rounded-2xl bg-blush/30 px-4 py-3 text-sm font-semibold text-coffee">{error}</p>}
        </aside>

        <div className="relative min-h-[46rem] overflow-hidden rounded-[1.6rem] border-[10px] border-[#7a5639] bg-[#2f5950] p-4 shadow-paper sm:p-6">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,.04)_1px,transparent_1px)] bg-[length:42px_42px]" />
          <div className="absolute inset-x-8 bottom-5 h-3 rounded-full bg-white/20" />
          <div className="relative mb-5 flex flex-wrap items-center justify-between gap-3 text-paper">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-paper/68">Class 9/8 board</p>
              <h3 className="font-display text-5xl leading-none">Letters Wall</h3>
            </div>
            <span className="rounded-full bg-paper/12 px-4 py-2 text-xs font-bold text-paper/80">
              {notes.length} mảnh thư
            </span>
          </div>

          {notes.length ? (
            <div className="relative min-h-[38rem]">
              {notes.map((note, index) => {
                const position = boardPositions[index % boardPositions.length];
                const noteStyle = {
                  '--note-left': `${position.left}%`,
                  '--note-top': `${position.top}%`,
                  '--note-width': `${position.width}rem`,
                  '--note-rotate': `${position.rotate + (index % 3) - 1}deg`,
                } as CSSProperties;

                return (
                  <article
                    key={note.id}
                    className={`board-note rounded-sm p-4 shadow-[0_18px_28px_rgba(18,15,13,.22)] ${notePalette[index % notePalette.length]}`}
                    style={noteStyle}
                  >
                    <span className="absolute -top-2 left-1/2 h-5 w-20 -translate-x-1/2 rotate-[-2deg] rounded-sm bg-[#f4dfbf]/80 shadow-sm" />
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-hand text-2xl font-bold text-coffee">
                          {note.type === 'anonymous' ? 'Ẩn danh' : note.name}
                        </p>
                        <time className="text-[10px] font-bold uppercase text-ink/42">
                          {formatMemoryDate(note.createdAt)}
                        </time>
                      </div>
                      {profile?.uid === note.entry.uid && (
                        <button
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-coffee/10 text-coffee"
                          onClick={() => {
                            if (window.confirm('Xóa mảnh thư này?')) void onDeleteGuestbook(note.entry);
                          }}
                          aria-label="Xóa tin nhắn"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink/76">{note.message}</p>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="relative grid min-h-[34rem] place-items-center text-center text-paper/72">
              <div>
                <p className="font-hand text-4xl font-bold">Bảng lớp còn trống.</p>
                <p className="mt-2 text-sm">Hãy gửi mảnh thư đầu tiên cho lớp 9/8.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default memo(ClassMessageBoard);
