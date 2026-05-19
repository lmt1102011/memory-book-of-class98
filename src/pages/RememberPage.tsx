import { Heart, Lock, Search, Send, Trash2, UserRound } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import FirebaseNotice from '../components/FirebaseNotice';
import type { ClassmateProfile, RememberNote, RememberNoteDraft, UserProfile } from '../types';
import { formatMemoryDate } from '../utils/date';

interface RememberPageProps {
  classmates: ClassmateProfile[];
  notes: RememberNote[];
  isLoading: boolean;
  firebaseNotice: string;
  profile: UserProfile | null;
  onJoin: () => void;
  onAddNote: (draft: RememberNoteDraft) => Promise<void> | void;
  onDeleteNote: (note: RememberNote) => Promise<void> | void;
}

const noteTone = ['bg-blush/35', 'bg-skySoft/35', 'bg-[#f4dfbf]/58', 'bg-white/62'];

export default function RememberPage({
  classmates,
  notes,
  isLoading,
  firebaseNotice,
  profile,
  onJoin,
  onAddNote,
  onDeleteNote,
}: RememberPageProps) {
  const [query, setQuery] = useState('');
  const [selectedNameKey, setSelectedNameKey] = useState('');
  const [message, setMessage] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const eligibleClassmates = useMemo(
    () => classmates.filter((classmate) => classmate.nameKey && classmate.nameKey !== profile?.nameKey),
    [classmates, profile?.nameKey],
  );

  const filteredClassmates = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return eligibleClassmates;
    return eligibleClassmates.filter((classmate) => classmate.name.toLowerCase().includes(keyword));
  }, [eligibleClassmates, query]);

  const selectedClassmate = useMemo(
    () => eligibleClassmates.find((classmate) => classmate.nameKey === selectedNameKey) || null,
    [eligibleClassmates, selectedNameKey],
  );

  const anonymousCount = useMemo(() => notes.filter((note) => note.anonymous).length, [notes]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!profile) {
      onJoin();
      return;
    }

    if (!selectedClassmate) {
      setError('Hãy chọn một bạn trong lớp trước khi gửi.');
      return;
    }

    const safeMessage = message.trim();
    if (!safeMessage) {
      setError('Hãy viết một điều thật lòng, dù chỉ một câu thôi.');
      return;
    }

    try {
      setIsSending(true);
      await onAddNote({
        toName: selectedClassmate.name,
        toNameKey: selectedClassmate.nameKey,
        message: safeMessage,
        anonymous,
      });
      setMessage('');
      setSelectedNameKey('');
      setSuccess(`Đã gửi một mẩu ký ức đến ${selectedClassmate.name}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể gửi lời nhắn lúc này.');
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async (note: RememberNote) => {
    if (!window.confirm('Xóa lời nhắn này khỏi hộp của bạn?')) return;

    try {
      await onDeleteNote(note);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể xóa lời nhắn lúc này.');
    }
  };

  return (
    <div className="relative">
      <section className="mx-auto max-w-7xl px-4 pb-7 pt-9 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.82fr] lg:items-end">
          <div>
            <p className="section-kicker">Điều tớ nhớ về cậu</p>
            <h1 className="max-w-4xl font-display text-6xl leading-[0.86] sm:text-8xl">
              Có những điều nhỏ thôi, nhưng người ta nhớ mãi.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-ink/66 sm:text-base">
              Chọn một bạn trong lớp 9/8 và gửi lại một mẩu ký ức về bạn ấy. Người nhận sẽ thấy trong hộp riêng của
              mình; bạn có thể ký tên hoặc để ẩn danh.
            </p>
          </div>

          <div className="rounded-[1.35rem] border border-white/60 bg-white/48 p-4 shadow-paper backdrop-blur-xl">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-[0.75rem] bg-paper/72 px-3 py-4">
                <p className="font-display text-4xl leading-none">{notes.length}</p>
                <p className="mt-1 text-[11px] font-bold uppercase text-coffee/62">Gửi đến bạn</p>
              </div>
              <div className="rounded-[0.75rem] bg-blush/30 px-3 py-4">
                <p className="font-display text-4xl leading-none">{anonymousCount}</p>
                <p className="mt-1 text-[11px] font-bold uppercase text-coffee/62">Ẩn danh</p>
              </div>
              <div className="rounded-[0.75rem] bg-skySoft/30 px-3 py-4">
                <p className="font-display text-4xl leading-none">{eligibleClassmates.length}</p>
                <p className="mt-1 text-[11px] font-bold uppercase text-coffee/62">Bạn cùng lớp</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-ink/58">
              Đây không phải bảng công khai. Mỗi người chỉ nhìn thấy những lời nhắn gửi đến tên mình.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-10 sm:px-6 lg:grid-cols-[0.88fr_1.12fr] lg:px-8">
        <form className="rounded-[1.35rem] border border-white/65 bg-white/52 p-4 shadow-paper backdrop-blur-xl sm:p-5" onSubmit={handleSubmit}>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-paper">
              <Heart size={20} fill="currentColor" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-5xl leading-none">Gửi một điều nhỏ</h2>
              <p className="mt-1 text-xs leading-5 text-ink/58">
                Viết như đang dán một tờ giấy nhỏ vào cuối cuốn lưu bút.
              </p>
            </div>
          </div>

          {!profile ? (
            <div className="mt-5 rounded-[0.9rem] bg-paper/78 p-4 text-center">
              <Lock className="mx-auto text-coffee" size={26} />
              <p className="mt-2 text-sm font-bold text-ink">Bạn cần vào lớp 9/8 trước khi gửi lời nhắn.</p>
              <button className="primary-button mx-auto mt-4" type="button" onClick={onJoin}>
                Vào lớp 9/8
              </button>
            </div>
          ) : (
            <>
              <label className="mt-5 block">
                <span className="mb-2 block text-xs font-bold uppercase text-coffee/70">Tìm người nhận</span>
                <span className="relative block">
                  <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-coffee/55" size={17} />
                  <input
                    className="input-field pl-11"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Gõ tên một bạn trong lớp"
                  />
                </span>
              </label>

              <div className="mt-3 grid max-h-52 gap-2 overflow-auto pr-1">
                {filteredClassmates.map((classmate) => (
                  <button
                    key={classmate.nameKey}
                    className={`flex min-h-12 items-center justify-between gap-3 rounded-[0.75rem] px-3 text-left text-sm font-bold transition ${
                      selectedNameKey === classmate.nameKey
                        ? 'bg-ink text-paper shadow-paper'
                        : 'bg-paper/72 text-ink hover:bg-paper'
                    }`}
                    type="button"
                    onClick={() => setSelectedNameKey(classmate.nameKey)}
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <UserRound size={16} />
                      <span className="truncate">{classmate.name}</span>
                    </span>
                    <span className="shrink-0 text-[11px] opacity-70">9/8</span>
                  </button>
                ))}
                {!filteredClassmates.length && (
                  <p className="rounded-[0.75rem] bg-paper/72 px-3 py-4 text-center text-xs font-bold text-coffee/70">
                    Chưa tìm thấy bạn nào phù hợp.
                  </p>
                )}
              </div>

              <label className="mt-4 block">
                <span className="mb-2 block text-xs font-bold uppercase text-coffee/70">Điều bạn nhớ về bạn ấy</span>
                <textarea
                  className="input-field min-h-36 resize-none leading-6"
                  value={message}
                  onChange={(event) => setMessage(event.target.value.slice(0, 420))}
                  placeholder="Ví dụ: Tớ nhớ lần cậu quay xuống cười trong giờ kiểm tra, tự nhiên ngày đó bớt căng thẳng hẳn..."
                  maxLength={420}
                />
              </label>

              <div className="mt-3 flex items-center justify-between gap-3 rounded-[0.85rem] bg-paper/68 px-3 py-3">
                <label className="flex min-w-0 items-center gap-3 text-sm font-bold text-ink">
                  <input
                    className="h-5 w-5 accent-coffee"
                    type="checkbox"
                    checked={anonymous}
                    onChange={(event) => setAnonymous(event.target.checked)}
                  />
                  <span>{anonymous ? 'Gửi ẩn danh' : 'Hiện tên của bạn'}</span>
                </label>
                <span className="shrink-0 text-xs font-bold text-coffee/62">{message.length}/420</span>
              </div>

              {(error || success) && (
                <p className={`mt-3 text-sm font-bold ${error ? 'text-[#9d3b4b]' : 'text-chalk'}`}>
                  {error || success}
                </p>
              )}

              <button
                className="primary-button mt-5 w-full"
                disabled={isSending || !selectedClassmate || !message.trim()}
              >
                <Send size={17} />
                {isSending ? 'Đang gửi...' : 'Gửi ký ức'}
              </button>
            </>
          )}
        </form>

        <section className="min-w-0 rounded-[1.35rem] border border-white/65 bg-white/42 p-4 shadow-paper backdrop-blur-xl sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="section-kicker">Hộp của bạn</p>
              <h2 className="font-display text-5xl leading-none">Những điều người ta nhớ</h2>
            </div>
            {profile && <span className="rounded-full bg-paper/78 px-3 py-2 text-xs font-bold text-coffee">{profile.name}</span>}
          </div>

          {isLoading ? (
            <div className="grid min-h-72 place-items-center text-center">
              <div>
                <div className="memory-loading-spinner mx-auto mb-4 h-12 w-12 rounded-full border-4 border-coffee/15 border-t-coffee" />
                <p className="font-hand text-3xl text-coffee">Đang mở hộp ký ức...</p>
              </div>
            </div>
          ) : !profile ? (
            <div className="mt-5 rounded-[1rem] bg-paper/72 p-6 text-center">
              <p className="font-hand text-3xl font-bold text-coffee">Vào lớp để xem những lời nhắn dành cho bạn.</p>
            </div>
          ) : notes.length ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {notes.map((note, index) => (
                <article
                  key={note.id}
                  className={`relative overflow-hidden rounded-[0.9rem] p-4 shadow-[0_14px_30px_rgba(84,57,35,0.12)] ${
                    noteTone[index % noteTone.length]
                  }`}
                >
                  <div className="scrapbook-tape left-7 top-0 -rotate-6" />
                  <div className="mt-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase text-coffee/62">
                        {note.anonymous ? 'Từ một người trong lớp' : `Từ ${note.fromName}`}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-ink/52">{formatMemoryDate(note.createdAt)}</p>
                    </div>
                    <button
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-coffee/10 text-coffee transition hover:bg-coffee/18"
                      onClick={() => void handleDelete(note)}
                      aria-label="Xóa lời nhắn"
                      title="Xóa lời nhắn"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-ink/78">{note.message}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 grid min-h-72 place-items-center rounded-[1rem] bg-paper/66 p-6 text-center">
              <div>
                <Heart className="mx-auto text-coffee/70" size={32} />
                <h3 className="mt-3 font-display text-5xl leading-none">Chưa có lời nhắn nào</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink/60">
                  Khi ai đó gửi một điều họ nhớ về bạn, nó sẽ nằm ở đây như một mảnh lưu bút riêng.
                </p>
              </div>
            </div>
          )}
        </section>
      </section>

      <FirebaseNotice message={firebaseNotice} />
    </div>
  );
}
