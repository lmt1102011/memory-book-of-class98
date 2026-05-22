import { m } from 'framer-motion';
import { Lock, MessageCircle, Send, Sparkles, Trash2, X } from 'lucide-react';
import { FormEvent, memo, useEffect, useMemo, useState, type CSSProperties } from 'react';
import ActionModal from './ActionModal';
import { useMobilePerformanceMode } from '../hooks/useMobilePerformanceMode';
import type { GuestbookEntry, TimeCapsuleEntry, TimeCapsuleSettings, UserProfile } from '../types';
import { formatMemoryDate } from '../utils/date';

interface ClassMessageBoardProps {
  guestbook: GuestbookEntry[];
  timeCapsules: TimeCapsuleEntry[];
  timeCapsuleSettings: TimeCapsuleSettings;
  profile: UserProfile | null;
  onJoin: () => void;
  onAddGuestbook: (message: string) => void | Promise<void>;
  onDeleteGuestbook: (entry: GuestbookEntry) => void | Promise<void>;
  onAddAnonymousMessage: (message: string) => void | Promise<void>;
  onAddTimeCapsule: (message: string) => void | Promise<void>;
  onOpenFutureMessages: () => void;
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

const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const formatFutureUnlockDate = (date: Date) =>
  new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: VIETNAM_TIME_ZONE,
  }).format(date);

function ClassMessageBoard({
  guestbook,
  timeCapsules,
  timeCapsuleSettings,
  profile,
  onJoin,
  onAddGuestbook,
  onDeleteGuestbook,
  onAddAnonymousMessage,
  onAddTimeCapsule,
  onOpenFutureMessages,
}: ClassMessageBoardProps) {
  const [classMessage, setClassMessage] = useState('');
  const [anonymousMessage, setAnonymousMessage] = useState('');
  const [timeCapsuleMessage, setTimeCapsuleMessage] = useState('');
  const [isSendingClass, setIsSendingClass] = useState(false);
  const [isSendingAnonymous, setIsSendingAnonymous] = useState(false);
  const [isSendingCapsule, setIsSendingCapsule] = useState(false);
  const [selectedNote, setSelectedNote] = useState<BoardNote | null>(null);
  const [error, setError] = useState('');
  const [isWriterOpen, setIsWriterOpen] = useState(false);
  const [isCapsuleWriterOpen, setIsCapsuleWriterOpen] = useState(false);
  const mobilePerformanceMode = useMobilePerformanceMode();
  const unlockDate = useMemo(() => new Date(timeCapsuleSettings.unlockAt), [timeCapsuleSettings.unlockAt]);
  const isCapsuleUnlocked = Number.isFinite(unlockDate.getTime()) && Date.now() >= unlockDate.getTime();
  const unlockDateLabel = Number.isFinite(unlockDate.getTime())
    ? formatFutureUnlockDate(unlockDate)
    : 'Chưa đặt ngày mở';
  const futureCountdownLabel = useMemo(() => {
    if (!Number.isFinite(unlockDate.getTime())) return 'Manager chưa đặt ngày mở';
    const diff = unlockDate.getTime() - Date.now();
    if (diff <= 0) return 'Đã đến ngày mở thư';
    const days = Math.ceil(diff / 86_400_000);
    if (days >= 2) return `Còn ${days} ngày`;
    const hours = Math.max(1, Math.ceil(diff / 3_600_000));
    return `Còn ${hours} giờ`;
  }, [unlockDate]);
  const ownCapsuleCount = useMemo(
    () => (profile ? timeCapsules.filter((entry) => entry.uid === profile.uid).length : 0),
    [profile, timeCapsules],
  );

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
    if (!selectedNote) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedNote(null);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedNote]);

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
      setAnonymousMessage('');
      setIsWriterOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể gửi tin nhắn ẩn danh lúc này.');
    } finally {
      setIsSendingAnonymous(false);
    }
  };

  const submitTimeCapsule = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = timeCapsuleMessage.trim();
    if (!trimmed) return;
    if (!profile) {
      onJoin();
      return;
    }

    try {
      setIsSendingCapsule(true);
      setError('');
      await onAddTimeCapsule(trimmed);
      setTimeCapsuleMessage('');
      setIsCapsuleWriterOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể gửi thư vào hộp thời gian lúc này.');
    } finally {
      setIsSendingCapsule(false);
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
                    className={`board-note board-note-clickable rounded-sm p-4 shadow-[0_16px_24px_rgba(18,15,13,.2)] outline-none focus-visible:ring-2 focus-visible:ring-paper/80 ${notePalette[index % notePalette.length]}`}
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
                        <time className="text-[10px] font-bold uppercase text-ink/42">
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
                    <p className="mt-2 line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-ink/76">{note.message}</p>
                    <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-coffee/8 px-2 py-1 text-[10px] font-black uppercase text-coffee/60">
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

      <section className="mt-6 overflow-hidden rounded-[1.6rem] border border-white/70 bg-paper shadow-paper">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="relative overflow-hidden bg-[#2f2118] p-5 text-paper sm:p-7">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(247,183,199,0.2),transparent_34%),radial-gradient(circle_at_88%_76%,rgba(169,205,232,0.18),transparent_34%)]" />
            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full bg-paper px-3 py-1.5 text-[11px] font-black uppercase text-ink">
                <Sparkles size={13} />
                Gửi cho tương lai
              </span>
              <h3 className="mt-4 max-w-2xl font-display text-5xl leading-none sm:text-6xl">
                Một lá thư nhỏ gửi cho chính mình sau này
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-paper/72">
                Viết lại điều bạn muốn nhắn với bản thân trong tương lai. Trước ngày mở, phần này chỉ hiện số thư đã gửi để giữ bí mật; khi đến giờ, phong bì riêng của bạn sẽ tự hiện khi mở app.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1rem] bg-white/10 p-4">
                  <span className="text-[11px] font-black uppercase text-paper/48">Cả lớp đã gửi</span>
                  <strong className="mt-1 block font-display text-6xl leading-none">{timeCapsules.length}</strong>
                </div>
                <div className="rounded-[1rem] bg-white/10 p-4">
                  <span className="text-[11px] font-black uppercase text-paper/48">Của bạn</span>
                  <strong className="mt-1 block font-display text-6xl leading-none">{ownCapsuleCount}</strong>
                </div>
                <div className="rounded-[1rem] bg-paper/12 p-4">
                  <span className="text-[11px] font-black uppercase text-paper/48">Trạng thái</span>
                  <strong className="mt-2 block text-sm font-black leading-6 text-paper">
                    {isCapsuleUnlocked ? 'Đã đến ngày mở' : futureCountdownLabel}
                  </strong>
                </div>
              </div>

              <div className="mt-4 rounded-[1rem] border border-paper/12 bg-paper/10 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-paper/48">Mở theo giờ Việt Nam</p>
                <p className="mt-1 text-sm font-bold leading-6 text-paper/84">{unlockDateLabel}</p>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-paper px-5 py-3 text-sm font-black text-ink shadow-paper transition hover:-translate-y-0.5 sm:w-auto"
                  onClick={() => (profile ? setIsCapsuleWriterOpen(true) : onJoin())}
                >
                  <Send size={17} />
                  Gửi cho tương lai
                </button>
                {isCapsuleUnlocked && ownCapsuleCount > 0 && (
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white/12 px-5 py-3 text-sm font-black text-paper shadow-paper ring-1 ring-paper/18 transition hover:bg-white/18 sm:w-auto"
                    onClick={onOpenFutureMessages}
                  >
                    <Sparkles size={17} />
                    Mở lời nhắn của tôi
                  </button>
                )}
              </div>
            </div>
          </div>

          <aside className="relative overflow-hidden bg-[#fff5e7] p-5 sm:p-6">
            <div className="absolute right-5 top-5 grid h-12 w-12 place-items-center rounded-full bg-ink text-paper shadow-paper">
              {isCapsuleUnlocked ? <Sparkles size={22} /> : <Lock size={22} />}
            </div>
            <p className="section-kicker pr-16">Future Letter</p>
            <h3 className="pr-12 font-display text-5xl leading-none text-ink">
              {isCapsuleUnlocked ? 'Đã đến lúc mở thư' : 'Đang giữ bí mật'}
            </h3>
            <p className="mt-3 text-sm leading-7 text-ink/64">
              {isCapsuleUnlocked
                ? 'Khi bạn vào app, một phong bì sẽ hiện lên. Bấm mở để đọc lại những điều bạn từng gửi cho tương lai.'
                : 'Không hiện phong bì, không hiện nội dung trước ngày mở. Mọi thứ được cất lại để khoảnh khắc mở thư thật đáng nhớ.'}
            </p>

            <div className="mt-5 rounded-[1.2rem] border border-coffee/10 bg-white/70 p-5 text-center shadow-paper">
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-coffee/55">Tổng đã gửi</span>
              <strong className="mt-2 block font-display text-8xl leading-none text-ink">{timeCapsules.length}</strong>
              <span className="mt-1 block text-xs font-black uppercase text-coffee/60">lời nhắn tương lai</span>
            </div>

            <p className="mt-4 rounded-[1rem] bg-paper/72 px-4 py-3 text-xs font-bold leading-5 text-ink/58">
              Mỗi bạn chỉ thấy nội dung của chính mình trong popup mở thư. Manager vẫn có thể quản lý dữ liệu trong trang quản trị.
            </p>
          </aside>
        </div>
      </section>

      <ActionModal
        isOpen={Boolean(profile && isWriterOpen)}
        title="Viết thư"
        description="Chọn gửi có tên cho cả lớp hoặc gửi một mảnh thư ẩn danh. Gửi xong popup sẽ tự đóng."
        icon={<MessageCircle size={20} />}
        onClose={() => setIsWriterOpen(false)}
      >
        <div className="grid gap-4">
          <form className="grid gap-3" onSubmit={submitClassMessage}>
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase text-coffee/70">Tin nhắn cho lớp</span>
              <textarea
                className="input-field min-h-28 resize-none"
                value={classMessage}
                onChange={(event) => setClassMessage(event.target.value)}
                placeholder="Viết lời nhắn có tên của bạn..."
                maxLength={160}
              />
            </label>
            <button className="primary-button justify-center" disabled={isSendingClass || !classMessage.trim()}>
              <Send size={17} />
              {isSendingClass ? 'Đang gửi...' : 'Gửi có tên'}
            </button>
          </form>

          <form className="grid gap-3 rounded-[1rem] bg-ink/5 p-3" onSubmit={submitAnonymousMessage}>
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase text-coffee/70">Tin nhắn ẩn danh</span>
              <textarea
                className="input-field min-h-28 resize-none"
                value={anonymousMessage}
                onChange={(event) => setAnonymousMessage(event.target.value)}
                placeholder="Viết điều bạn muốn gửi ẩn danh..."
                maxLength={160}
              />
            </label>
            <button className="secondary-button justify-center" disabled={isSendingAnonymous || !anonymousMessage.trim()}>
              <MessageCircle size={17} />
              {isSendingAnonymous ? 'Đang gửi...' : 'Gửi ẩn danh'}
            </button>
          </form>
        </div>
      </ActionModal>

      <ActionModal
        isOpen={Boolean(profile && isCapsuleWriterOpen)}
        title="Gửi cho tương lai"
        description="Lá thư sẽ được cất lại trong mục Lời nhắn. Trước ngày mở, mọi người chỉ thấy số thư đã gửi."
        icon={<Sparkles size={20} />}
        onClose={() => setIsCapsuleWriterOpen(false)}
      >
        <form className="grid gap-3" onSubmit={submitTimeCapsule}>
          <div className="rounded-[1rem] bg-[#2f2118] p-4 text-paper">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-paper/48">Mở theo giờ Việt Nam</p>
            <p className="mt-1 text-sm font-bold leading-6 text-paper/82">{unlockDateLabel}</p>
          </div>
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase text-coffee/70">Lời nhắn gửi cho tương lai</span>
            <textarea
              className="input-field min-h-40 resize-none"
              value={timeCapsuleMessage}
              onChange={(event) => setTimeCapsuleMessage(event.target.value.slice(0, 900))}
              placeholder="Viết điều bạn muốn nhắn với bản thân trong tương lai..."
              maxLength={900}
            />
          </label>
          <p className="text-xs font-bold text-ink/48">{timeCapsuleMessage.length}/900 ký tự</p>
          <button className="primary-button justify-center" disabled={isSendingCapsule || !timeCapsuleMessage.trim()}>
            <Send size={17} />
            {isSendingCapsule ? 'Đang gửi...' : 'Gửi cho tương lai'}
          </button>
        </form>
      </ActionModal>

      {selectedNote && (
        <m.div
          className="app-safe-modal-overlay fixed inset-0 z-[95] grid place-items-center bg-ink/62 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Xem thư trên bảng lớp"
          onClick={() => setSelectedNote(null)}
          initial={mobilePerformanceMode ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={mobilePerformanceMode ? undefined : { opacity: 0 }}
          transition={{ duration: mobilePerformanceMode ? 0 : 0.16, ease: 'easeOut' }}
        >
          <m.div
            className="app-safe-modal-panel relative max-h-[92svh] w-full max-w-2xl overflow-auto rounded-[0.85rem] border border-white/70 bg-[#fffaf1] p-5 text-ink shadow-[0_24px_70px_rgba(18,15,13,.28)] sm:p-7"
            onClick={(event) => event.stopPropagation()}
            initial={mobilePerformanceMode ? false : { opacity: 0, y: 18, scale: 0.985, rotate: -0.35 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            transition={{ duration: mobilePerformanceMode ? 0 : 0.2, ease: 'easeOut' }}
          >
            <button
              className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-ink/88 text-paper shadow-paper transition hover:bg-ink"
              onClick={() => setSelectedNote(null)}
              aria-label="Đóng thư"
            >
              <X size={19} />
            </button>

            <div className="pr-12">
              <p className="section-kicker">{selectedNote.type === 'anonymous' ? 'Thư ẩn danh' : 'Thư gửi lớp'}</p>
              <h3 className="font-hand text-5xl font-bold leading-none text-coffee">
                {selectedNote.type === 'anonymous' ? 'Ẩn danh' : selectedNote.name}
              </h3>
              <time className="mt-2 block text-xs font-bold uppercase text-ink/45">
                {formatMemoryDate(selectedNote.createdAt)}
              </time>
            </div>

            <div className="relative mt-5 rounded-[0.65rem] bg-white/62 p-5 shadow-[inset_0_0_0_1px_rgba(122,86,57,0.08)]">
              <span className="absolute -top-2 left-8 h-5 w-24 rotate-[-3deg] rounded-sm bg-[#f4dfbf]/80 shadow-sm" />
              <p className="whitespace-pre-wrap break-words text-base leading-8 text-ink/78">
                {selectedNote.message}
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button className="primary-button justify-center" onClick={() => setSelectedNote(null)}>
                Đóng thư
              </button>
              {profile?.uid === selectedNote.entry.uid && (
                <button
                  className="secondary-button justify-center text-coffee"
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
          </m.div>
        </m.div>
      )}
    </section>
  );
}

export default memo(ClassMessageBoard);
