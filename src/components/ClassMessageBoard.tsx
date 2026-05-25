import { MessageCircle, Send, Trash2, X } from 'lucide-react';
import { FormEvent, memo, useEffect, useMemo, useState, type CSSProperties } from 'react';
import DraftStatus from './DraftStatus';
import { useLocalDraft } from '../hooks/useLocalDraft';
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

type BoardNote = {
  id: string;
  type: 'class' | 'anonymous';
  name: string;
  message: string;
  createdAt: string;
  entry: GuestbookEntry;
};

const notePalette = [
  'bg-[#fffaf1] text-ink',
  'bg-[#ffdce7] text-ink',
  'bg-[#dff2ff] text-ink',
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
  const [isSendingClass, setIsSendingClass] = useState(false);
  const [isSendingAnonymous, setIsSendingAnonymous] = useState(false);
  const [selectedNote, setSelectedNote] = useState<BoardNote | null>(null);
  const [error, setError] = useState('');
  const [isWriterOpen, setIsWriterOpen] = useState(false);
  const {
    value: classMessage,
    setValue: setClassMessage,
    clearDraft: clearClassMessageDraft,
    hasDraft: hasClassMessageDraft,
    restored: restoredClassMessageDraft,
  } = useLocalDraft(profile ? `memory98-draft:class-message:${profile.uid}` : '');
  const {
    value: anonymousMessage,
    setValue: setAnonymousMessage,
    clearDraft: clearAnonymousMessageDraft,
    hasDraft: hasAnonymousMessageDraft,
    restored: restoredAnonymousMessageDraft,
  } = useLocalDraft(profile ? `memory98-draft:anonymous-class-message:${profile.uid}` : '');

  const notes = useMemo<BoardNote[]>(() => {
    return guestbook
      .map(
        (entry) =>
          ({
            id: `${entry.anonymous ? 'anonymous' : 'class'}-${entry.id}`,
            type: entry.anonymous ? 'anonymous' : 'class',
            name: entry.anonymous ? 'Ẩn danh' : entry.name,
            message: entry.message,
            createdAt: entry.createdAt,
            entry,
          }) as BoardNote,
      )
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 18);
  }, [guestbook]);

  useEffect(() => {
    if (!selectedNote && !isWriterOpen) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedNote(null);
      if (event.key === 'Escape') setIsWriterOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isWriterOpen, selectedNote]);

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
      clearClassMessageDraft();
      setIsWriterOpen(false);
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
      clearAnonymousMessageDraft();
      setIsWriterOpen(false);
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
            Gửi một lời nhắn có tên cho cả lớp, hoặc để lại một điều ẩn danh như một mảnh giấy nhỏ dán
            trên bảng học.
          </p>

          <button
            type="button"
            className="primary-button mt-5 w-full justify-center"
            onClick={() => (profile ? setIsWriterOpen(true) : onJoin())}
          >
            <Send size={17} />
            Viết thư
          </button>

          <div className="mt-4 rounded-[1rem] bg-paper/72 p-4 text-sm leading-6 text-ink/64">
            Bấm “Viết thư” khi bạn muốn gửi lời nhắn cho lớp hoặc gửi một mảnh thư ẩn danh.
          </div>

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
                    className={`board-note board-note-clickable rounded-sm p-4 shadow-[0_16px_24px_rgba(18,15,13,.22)] outline-none ring-1 ring-black/5 focus-visible:ring-2 focus-visible:ring-paper/80 ${notePalette[index % notePalette.length]}`}
                    style={noteStyle}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedNote(note)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedNote(note);
                      }
                    }}
                  >
                    <span className="absolute -top-2 left-1/2 h-5 w-20 -translate-x-1/2 rotate-[-2deg] rounded-sm bg-[#f4dfbf]/80 shadow-sm" />
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-hand text-2xl font-bold text-coffee">
                          {note.type === 'anonymous' ? 'Ẩn danh' : note.name}
                        </p>
                        <time className="text-[10px] font-black uppercase text-ink/58">
                          {formatMemoryDate(note.createdAt)}
                        </time>
                      </div>
                      {profile?.uid === note.entry.uid && (
                        <button
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-coffee/10 text-coffee transition hover:bg-coffee/18"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (window.confirm('Xóa mảnh thư này?')) void onDeleteGuestbook(note.entry);
                          }}
                          aria-label="Xóa tin nhắn"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-5 whitespace-pre-wrap text-sm font-semibold leading-6 text-ink/88">{note.message}</p>
                    <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-coffee/10 px-2 py-1 text-[10px] font-black uppercase text-coffee/78">
                      <MessageCircle size={12} />
                      Xem thư
                    </span>
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

      {profile && isWriterOpen && (
        <div
          className="class-letter-writer-overlay app-safe-modal-overlay fixed inset-0 z-[98] grid place-items-center bg-[#120f0d] p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Viết thư"
          onClick={() => setIsWriterOpen(false)}
          style={{ opacity: 1, filter: 'none', backdropFilter: 'none' }}
        >
          <div
            className="class-letter-writer-panel app-safe-modal-panel relative max-h-[92svh] w-full max-w-2xl overflow-auto rounded-[1.25rem] border border-[#7a5639]/32 bg-[#fffaf1] p-4 text-[#241b15] shadow-[0_26px_80px_rgba(18,15,13,.42)] sm:p-6"
            onClick={(event) => event.stopPropagation()}
            style={{ opacity: 1, filter: 'none', backdropFilter: 'none' }}
          >
            <button
              type="button"
              className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-[#241b15] text-[#fffaf1] shadow-[0_10px_22px_rgba(18,15,13,.24)]"
              onClick={() => setIsWriterOpen(false)}
              aria-label="Đóng popup viết thư"
            >
              <X size={18} />
            </button>

            <div className="flex min-w-0 items-start gap-3 pr-12">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#241b15] text-[#fffaf1]">
                <MessageCircle size={20} />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-4xl leading-none text-[#241b15] sm:text-5xl">Viết thư</h2>
                <p className="mt-2 text-sm font-bold leading-6 text-[#5b3d28]">
                  Chọn gửi có tên cho cả lớp hoặc gửi một mảnh thư ẩn danh. Gửi xong popup sẽ tự đóng.
                </p>
              </div>
            </div>

            <div className="class-letter-writer-body mt-5 grid gap-4">
              <form className="grid gap-3" onSubmit={submitClassMessage}>
                <label className="grid gap-2">
                  <span className="class-letter-writer-label text-xs font-black uppercase text-[#5b3d28]">Tin nhắn cho lớp</span>
                  <textarea
                    className="class-letter-writer-field input-field min-h-28 resize-none"
                    value={classMessage}
                    onChange={(event) => setClassMessage(event.target.value)}
                    placeholder="Viết lời nhắn có tên của bạn..."
                    maxLength={160}
                  />
                </label>
                <DraftStatus hasDraft={hasClassMessageDraft} restored={restoredClassMessageDraft} />
                <button className="class-letter-writer-button primary-button justify-center" disabled={isSendingClass || !classMessage.trim()}>
                  <Send size={17} />
                  {isSendingClass ? 'Đang gửi...' : 'Gửi có tên'}
                </button>
              </form>

              <form className="class-letter-writer-anonymous grid gap-3 rounded-[1rem] bg-[#fff7ec] p-3" onSubmit={submitAnonymousMessage}>
                <label className="grid gap-2">
                  <span className="class-letter-writer-label text-xs font-black uppercase text-[#5b3d28]">Tin nhắn ẩn danh</span>
                  <textarea
                    className="class-letter-writer-field input-field min-h-28 resize-none"
                    value={anonymousMessage}
                    onChange={(event) => setAnonymousMessage(event.target.value)}
                    placeholder="Viết điều bạn muốn gửi ẩn danh..."
                    maxLength={160}
                  />
                </label>
                <DraftStatus hasDraft={hasAnonymousMessageDraft} restored={restoredAnonymousMessageDraft} />
                <button className="class-letter-writer-button secondary-button justify-center" disabled={isSendingAnonymous || !anonymousMessage.trim()}>
                  <MessageCircle size={17} />
                  {isSendingAnonymous ? 'Đang gửi...' : 'Gửi ẩn danh'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {selectedNote && (
        <div
          className="class-letter-modal-overlay app-safe-modal-overlay fixed inset-0 z-[95] grid place-items-center bg-[rgba(18,15,13,0.74)] p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Xem thư trên bảng lớp"
          onClick={() => setSelectedNote(null)}
        >
          <div
            className="class-letter-modal-panel app-safe-modal-panel relative max-h-[92svh] w-full max-w-2xl overflow-auto rounded-[1.05rem] border border-[#7a5639]/25 bg-[#fffaf1] p-5 text-[#241b15] shadow-[0_26px_80px_rgba(18,15,13,.34)] sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="class-letter-modal-x absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-[#241b15] text-[#fffaf1] shadow-[0_10px_22px_rgba(18,15,13,.24)] transition hover:bg-[#120f0d]"
              onClick={() => setSelectedNote(null)}
              aria-label="Đóng thư"
            >
              <X size={19} />
            </button>

            <div className="pr-12">
              <p className="class-letter-modal-kicker text-[11px] font-black uppercase tracking-[0.16em] text-[#7a5639]">
                {selectedNote.type === 'anonymous' ? 'Thư ẩn danh' : 'Thư gửi lớp'}
              </p>
              <h3 className="class-letter-modal-title mt-2 font-hand text-5xl font-bold leading-none text-[#5b3d28]">
                {selectedNote.type === 'anonymous' ? 'Ẩn danh' : selectedNote.name}
              </h3>
              <time className="class-letter-modal-time mt-2 block text-xs font-black uppercase text-[#4b3a2e]">
                {formatMemoryDate(selectedNote.createdAt)}
              </time>
            </div>

            <div className="class-letter-modal-paper relative mt-5 rounded-[0.8rem] border border-[#7a5639]/12 bg-[#fffdf8] p-5 shadow-[inset_0_0_0_1px_rgba(122,86,57,0.1)]">
              <span className="absolute -top-2 left-8 h-5 w-24 rotate-[-3deg] rounded-sm bg-[#e6c58e] shadow-sm" />
              <p className="class-letter-modal-message whitespace-pre-wrap break-words text-base font-bold leading-8 text-[#241b15]">
                {selectedNote.message}
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button className="class-letter-modal-button primary-button justify-center shadow-[0_12px_28px_rgba(122,86,57,0.2)]" onClick={() => setSelectedNote(null)}>
                Đóng thư
              </button>
              {profile?.uid === selectedNote.entry.uid && (
                <button
                  className="class-letter-modal-button secondary-button justify-center border-[#7a5639]/25 bg-[#fffdf8] text-[#5b3d28]"
                  onClick={() => {
                    if (!window.confirm('Xóa mảnh thư này?')) return;
                    void onDeleteGuestbook(selectedNote.entry);
                    setSelectedNote(null);
                  }}
                >
                  <Trash2 size={16} />
                  Xóa thư
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default memo(ClassMessageBoard);
