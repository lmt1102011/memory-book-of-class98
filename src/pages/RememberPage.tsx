import { CheckCheck, Eye, Heart, Lock, Search, Send, Trash2, UserRound } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import ActionModal from '../components/ActionModal';
import { useConfirmDialog } from '../components/ConfirmDialogProvider';
import DraftStatus from '../components/DraftStatus';
import FirebaseNotice from '../components/FirebaseNotice';
import { useLocalDraft } from '../hooks/useLocalDraft';
import type { ClassmateProfile, RememberNote, RememberNoteDraft, RememberReactionId, UserProfile } from '../types';
import { formatMemoryDate } from '../utils/date';

interface RememberPageProps {
  classmates: ClassmateProfile[];
  notes: RememberNote[];
  sentNotes: RememberNote[];
  isLoading: boolean;
  isLoadingSent: boolean;
  firebaseNotice: string;
  profile: UserProfile | null;
  onJoin: () => void;
  onAddNote: (draft: RememberNoteDraft) => Promise<void> | void;
  onDeleteNote: (note: RememberNote) => Promise<void> | void;
  onMarkNotesViewed: (notes: RememberNote[]) => Promise<void> | void;
  onReactNote: (note: RememberNote, reactionId: RememberReactionId) => Promise<void> | void;
}

type MailboxTab = 'received' | 'sent';

const noteTone = ['bg-blush/35', 'bg-skySoft/35', 'bg-[#f4dfbf]/58', 'bg-white/62'];

const reactionOptions: Array<{ id: RememberReactionId; label: string; tone: string }> = [
  { id: 'miss-you', label: 'Nhớ cậu', tone: 'bg-blush/45 text-[#8b3544]' },
  { id: 'thank-you', label: 'Cảm ơn', tone: 'bg-skySoft/45 text-[#31536f]' },
  { id: 'regret', label: 'Tiếc nuối', tone: 'bg-[#f4dfbf]/75 text-coffee' },
  { id: 'good-luck', label: 'Chúc may mắn', tone: 'bg-chalk/20 text-chalk' },
];

const reactionLabelById = reactionOptions.reduce(
  (labels, option) => ({ ...labels, [option.id]: option.label }),
  {} as Record<RememberReactionId, string>,
);

const getReactionLabel = (note: RememberNote) => {
  if (note.reactionId) return note.reactionLabel || reactionLabelById[note.reactionId];
  if (note.heartedBy.length > 0) return 'Đã tim';
  return '';
};

export default function RememberPage({
  classmates,
  notes,
  sentNotes,
  isLoading,
  isLoadingSent,
  firebaseNotice,
  profile,
  onJoin,
  onAddNote,
  onDeleteNote,
  onMarkNotesViewed,
  onReactNote,
}: RememberPageProps) {
  const [activeTab, setActiveTab] = useState<MailboxTab>('received');
  const [query, setQuery] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [reactingId, setReactingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const markedViewedRef = useRef(new Set<string>());
  const confirmDialog = useConfirmDialog();
  const {
    value: selectedNameKey,
    setValue: setSelectedNameKey,
    clearDraft: clearRecipientDraft,
  } = useLocalDraft(profile ? `memory98-draft:remember-recipient:${profile.uid}` : '');
  const {
    value: message,
    setValue: setMessage,
    clearDraft: clearMessageDraft,
    hasDraft: hasMessageDraft,
    restored: restoredMessageDraft,
  } = useLocalDraft(profile ? `memory98-draft:remember-message:${profile.uid}` : '');

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
  const viewedSentCount = useMemo(() => sentNotes.filter((note) => note.viewedAt).length, [sentNotes]);
  const reactedSentCount = useMemo(() => sentNotes.filter((note) => getReactionLabel(note)).length, [sentNotes]);

  useEffect(() => {
    if (!profile || !notes.length) return;

    const unviewed = notes.filter((note) => !note.viewedAt && !markedViewedRef.current.has(note.id));
    if (!unviewed.length) return;

    unviewed.forEach((note) => markedViewedRef.current.add(note.id));
    void Promise.resolve(onMarkNotesViewed(unviewed)).catch(() => undefined);
  }, [notes, onMarkNotesViewed, profile]);

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
      clearMessageDraft();
      clearRecipientDraft();
      setQuery('');
      setActiveTab('sent');
      setIsComposerOpen(false);
      setSuccess(`Đã gửi Secret Message đến ${selectedClassmate.name}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể gửi Secret Message lúc này.');
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async (note: RememberNote, mode: MailboxTab) => {
    const confirmed = await confirmDialog({
      title: 'Xóa Secret Message?',
      description:
        mode === 'sent'
          ? `Tin đã gửi cho ${note.toName} sẽ bị xóa, người nhận cũng không còn thấy tin này.`
          : 'Tin này sẽ biến mất khỏi hộp thư Secret Message của bạn.',
      confirmLabel: 'Xóa tin',
      tone: 'danger',
    });
    if (!confirmed) return;

    try {
      await onDeleteNote(note);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể xóa Secret Message lúc này.');
    }
  };

  const handleReact = async (note: RememberNote, reactionId: RememberReactionId) => {
    if (!profile) {
      onJoin();
      return;
    }

    if (note.reactionId === reactionId) return;

    try {
      setReactingId(`${note.id}:${reactionId}`);
      await onReactNote(note, reactionId);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể phản hồi Secret Message lúc này.');
    } finally {
      setReactingId('');
    }
  };

  return (
    <div className="relative">
      <section className="mx-auto max-w-7xl px-4 pb-7 pt-9 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.82fr] lg:items-end">
          <div>
            <p className="section-kicker">Secret Message</p>
            <h1 className="max-w-4xl font-display text-5xl leading-[0.9] sm:text-8xl">
              Hộp thư của những điều chưa kịp nói.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-ink/66 sm:text-base">
              Gửi riêng một lời nhắn cho một người trong lớp 9/8. Người nhận có thể phản hồi bằng một cảm xúc, còn tin ẩn danh
              vẫn giữ kín người gửi.
            </p>
          </div>

          <div className="rounded-[1.35rem] border border-white/60 bg-white/48 p-4 shadow-paper backdrop-blur-xl">
            <div className="grid grid-cols-3 gap-2 text-center">
              <StatTile label="Gửi đến bạn" value={notes.length} />
              <StatTile label="Ẩn danh" value={anonymousCount} tone="bg-blush/30" />
              <StatTile label="Đã phản hồi" value={reactedSentCount} tone="bg-skySoft/30" />
            </div>
            <p className="mt-3 text-xs leading-5 text-ink/58">
              Người gửi thấy được trạng thái đã xem và cảm xúc phản hồi. Người nhận có thể đổi cảm xúc nếu bấm nhầm.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
        <div
          className="rounded-[1.35rem] border border-white/65 bg-white/52 p-4 shadow-paper backdrop-blur-xl sm:p-5"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-paper">
                <Heart size={20} fill="currentColor" />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-4xl leading-none sm:text-5xl">Viết Secret Message</h2>
                <p className="mt-1 text-xs leading-5 text-ink/58">Một mảnh lưu bút riêng, gửi đúng người, đúng cảm xúc.</p>
              </div>
            </div>
            {profile && (
              <span className="w-fit rounded-full bg-paper/78 px-3 py-2 text-xs font-bold text-coffee">
                Đang viết với tên {profile.name}
              </span>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              className="primary-button justify-center"
              onClick={() => (profile ? setIsComposerOpen(true) : onJoin())}
            >
              <Send size={17} />
              Viết thư cho ai đó
            </button>
            {profile && (
              <span className="rounded-full bg-paper/78 px-3 py-2 text-xs font-bold text-coffee">
                Thư mình nhận và thư mình gửi nằm ở bên dưới
              </span>
            )}
          </div>

          {(error || success) && (
            <p className={`mt-3 text-sm font-bold ${error ? 'text-[#9d3b4b]' : 'text-chalk'}`}>
              {error || success}
            </p>
          )}

          {!profile ? (
            <div className="mt-5 rounded-[0.9rem] bg-paper/78 p-4 text-center">
              <Lock className="mx-auto text-coffee" size={26} />
              <p className="mt-2 text-sm font-bold text-ink">Bạn cần vào lớp 9/8 trước khi gửi Secret Message.</p>
              <button className="primary-button mx-auto mt-4" type="button" onClick={onJoin}>
                Vào lớp 9/8
              </button>
            </div>
          ) : (
            <div className="mt-4 rounded-[0.9rem] bg-paper/72 p-4 text-sm leading-6 text-ink/64">
              Bấm “Viết thư cho ai đó” để chọn một bạn trong lớp và bắt đầu gửi Secret Message. Hộp thư nhận/gửi vẫn luôn ở bên dưới để bạn xem lại nhanh.
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        <div className="rounded-[1.35rem] border border-white/65 bg-white/44 p-4 shadow-paper backdrop-blur-xl sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-kicker">Hộp thư</p>
              <h2 className="font-display text-4xl leading-none sm:text-5xl">Secret Message của bạn</h2>
            </div>
            {profile && <span className="w-fit rounded-full bg-paper/78 px-3 py-2 text-xs font-bold text-coffee">{profile.name}</span>}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 rounded-[0.95rem] bg-paper/58 p-1.5">
            <MailboxTabButton active={activeTab === 'received'} count={notes.length} label="Thư mình nhận" onClick={() => setActiveTab('received')} />
            <MailboxTabButton active={activeTab === 'sent'} count={sentNotes.length} label="Thư mình gửi" onClick={() => setActiveTab('sent')} />
          </div>

          {activeTab === 'received' ? (
            <ReceivedMailbox
              isLoading={isLoading}
              notes={notes}
              profile={profile}
              reactingId={reactingId}
              onJoin={onJoin}
              onDelete={(note) => void handleDelete(note, 'received')}
              onReact={(note, reactionId) => void handleReact(note, reactionId)}
            />
          ) : (
            <SentMailbox
              isLoading={isLoadingSent}
              notes={sentNotes}
              profile={profile}
              viewedCount={viewedSentCount}
              reactedCount={reactedSentCount}
              onJoin={onJoin}
              onDelete={(note) => void handleDelete(note, 'sent')}
            />
          )}
        </div>
      </section>

      <ActionModal
        isOpen={Boolean(profile && isComposerOpen)}
        title="Viết Secret Message"
        description="Chọn một người nhận, viết lời nhắn và gửi đi. Gửi xong popup sẽ tự đóng."
        icon={<Heart size={20} fill="currentColor" />}
        onClose={() => setIsComposerOpen(false)}
      >
        <form className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]" onSubmit={handleSubmit}>
          <div className="min-w-0">
            <label className="block">
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

            <div className="mt-3 grid max-h-64 gap-2 overflow-auto pr-1">
              {filteredClassmates.map((classmate) => (
                <button
                  key={classmate.nameKey}
                  className={`flex min-h-12 items-center justify-between gap-3 rounded-[0.75rem] px-3 text-left text-sm font-bold transition ${
                    selectedNameKey === classmate.nameKey ? 'bg-ink text-paper shadow-paper' : 'bg-paper/72 text-ink hover:bg-paper'
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
          </div>

          <div className="min-w-0">
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase text-coffee/70">Điều chưa kịp nói</span>
              <textarea
                className="input-field min-h-40 resize-none leading-6"
                value={message}
                onChange={(event) => setMessage(event.target.value.slice(0, 420))}
                placeholder="Viết một điều thật lòng mà bạn muốn gửi lại cho người ấy..."
                maxLength={420}
              />
            </label>
            <DraftStatus hasDraft={hasMessageDraft} restored={restoredMessageDraft} />

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

            {error && <p className="mt-3 text-sm font-bold text-[#9d3b4b]">{error}</p>}

            <button className="primary-button mt-5 w-full justify-center" disabled={isSending || !selectedClassmate || !message.trim()}>
              <Send size={17} />
              {isSending ? 'Đang gửi...' : 'Gửi Secret Message'}
            </button>
          </div>
        </form>
      </ActionModal>

      <FirebaseNotice message={firebaseNotice} />
    </div>
  );
}

function StatTile({ label, value, tone = 'bg-paper/72' }: { label: string; value: number; tone?: string }) {
  return (
    <div className={`rounded-[0.75rem] px-3 py-4 ${tone}`}>
      <p className="font-display text-4xl leading-none">{value}</p>
      <p className="mt-1 text-[11px] font-bold uppercase text-coffee/62">{label}</p>
    </div>
  );
}

function MailboxTabButton({ active, count, label, onClick }: { active: boolean; count: number; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`min-h-12 rounded-[0.75rem] px-3 text-sm font-black transition ${
        active ? 'bg-ink text-paper shadow-paper' : 'text-ink/68 hover:bg-white/48'
      }`}
      onClick={onClick}
    >
      <span className="block truncate">{label}</span>
      <span className="mt-0.5 block text-[11px] opacity-70">{count} tin</span>
    </button>
  );
}

function ReceivedMailbox({
  isLoading,
  notes,
  profile,
  reactingId,
  onJoin,
  onDelete,
  onReact,
}: {
  isLoading: boolean;
  notes: RememberNote[];
  profile: UserProfile | null;
  reactingId: string;
  onJoin: () => void;
  onDelete: (note: RememberNote) => void;
  onReact: (note: RememberNote, reactionId: RememberReactionId) => void;
}) {
  if (isLoading) {
    return <MailboxLoading label="Đang mở thư mình nhận..." />;
  }

  if (!profile) {
    return <MailboxJoinPrompt text="Vào lớp để xem những Secret Message gửi cho bạn." onJoin={onJoin} />;
  }

  if (!notes.length) {
    return (
      <MailboxEmpty
        title="Chưa có Secret Message"
        text="Khi ai đó gửi cho bạn, tin sẽ nằm ở đây như một mảnh lưu bút riêng."
      />
    );
  }

  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {notes.map((note, index) => (
        <ReceivedNoteCard
          key={note.id}
          note={note}
          profile={profile}
          reactingId={reactingId}
          tone={noteTone[index % noteTone.length]}
          onDelete={onDelete}
          onReact={onReact}
        />
      ))}
    </div>
  );
}

function SentMailbox({
  isLoading,
  notes,
  profile,
  viewedCount,
  reactedCount,
  onJoin,
  onDelete,
}: {
  isLoading: boolean;
  notes: RememberNote[];
  profile: UserProfile | null;
  viewedCount: number;
  reactedCount: number;
  onJoin: () => void;
  onDelete: (note: RememberNote) => void;
}) {
  if (isLoading) {
    return <MailboxLoading label="Đang mở thư mình gửi..." />;
  }

  if (!profile) {
    return <MailboxJoinPrompt text="Vào lớp để xem lại những Secret Message bạn đã gửi." onJoin={onJoin} />;
  }

  if (!notes.length) {
    return (
      <MailboxEmpty
        title="Chưa gửi tin nào"
        text="Khi bạn gửi Secret Message cho ai đó, bạn có thể quay lại đây để xem trạng thái và xóa tin đã gửi."
      />
    );
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-coffee/70">
        <span className="rounded-full bg-paper/72 px-3 py-2">{notes.length} đã gửi</span>
        <span className="rounded-full bg-paper/72 px-3 py-2">{viewedCount} đã xem</span>
        <span className="rounded-full bg-paper/72 px-3 py-2">{reactedCount} đã phản hồi</span>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {notes.map((note, index) => (
          <SentNoteCard
            key={note.id}
            note={note}
            tone={noteTone[(index + 1) % noteTone.length]}
            onDelete={onDelete}
          />
        ))}
      </div>
    </>
  );
}

function ReceivedNoteCard({
  note,
  profile,
  reactingId,
  tone,
  onDelete,
  onReact,
}: {
  note: RememberNote;
  profile: UserProfile;
  reactingId: string;
  tone: string;
  onDelete: (note: RememberNote) => void;
  onReact: (note: RememberNote, reactionId: RememberReactionId) => void;
}) {
  return (
    <article className={`relative overflow-hidden rounded-[0.9rem] p-4 shadow-[0_14px_30px_rgba(84,57,35,0.12)] ${tone}`}>
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
          onClick={() => onDelete(note)}
          aria-label="Xóa Secret Message"
          title="Xóa Secret Message"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-ink/78">{note.message}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-white/50 px-2.5 py-1 text-[11px] font-bold text-coffee/70">
          <Eye size={13} />
          Đã mở
        </span>
        {note.reactedAt && (
          <span className="inline-flex rounded-full bg-white/50 px-2.5 py-1 text-[11px] font-bold text-coffee/70">
            {formatMemoryDate(note.reactedAt)}
          </span>
        )}
      </div>
      <ReactionPills note={note} profile={profile} reactingId={reactingId} onReact={onReact} />
    </article>
  );
}

function SentNoteCard({ note, tone, onDelete }: { note: RememberNote; tone: string; onDelete: (note: RememberNote) => void }) {
  const reactionLabel = getReactionLabel(note);

  return (
    <article className={`relative overflow-hidden rounded-[0.9rem] p-4 shadow-[0_14px_30px_rgba(84,57,35,0.12)] ${tone}`}>
      <div className="scrapbook-tape right-7 top-0 rotate-6" />
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-coffee/62">Gửi đến {note.toName}</p>
          <p className="mt-1 text-xs font-semibold text-ink/52">{formatMemoryDate(note.createdAt)}</p>
        </div>
        <button
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-coffee/10 text-coffee transition hover:bg-coffee/18"
          onClick={() => onDelete(note)}
          aria-label="Xóa tin đã gửi"
          title="Xóa tin đã gửi"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <StatusBadge>{note.anonymous ? 'Bạn đã gửi ẩn danh' : 'Bạn đã hiện tên'}</StatusBadge>
        <StatusBadge icon={<CheckCheck size={13} />}>{note.viewedAt ? 'Đã xem' : 'Đã gửi'}</StatusBadge>
        {reactionLabel && (
          <StatusBadge icon={<Heart size={13} fill="currentColor" />}>
            {note.reactionId ? `Người nhận đã thả: ${reactionLabel}` : 'Người nhận đã tim'}
          </StatusBadge>
        )}
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-ink/78">{note.message}</p>
    </article>
  );
}

function ReactionPills({
  note,
  profile,
  reactingId,
  onReact,
}: {
  note: RememberNote;
  profile: UserProfile;
  reactingId: string;
  onReact: (note: RememberNote, reactionId: RememberReactionId) => void;
}) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-[11px] font-black uppercase text-coffee/62">Phản hồi cảm xúc</p>
      <div className="grid grid-cols-2 gap-2">
        {reactionOptions.map((option) => {
          const active = note.reactionId === option.id;
          const busy = reactingId === `${note.id}:${option.id}`;

          return (
            <button
              key={option.id}
              type="button"
              className={`min-h-10 rounded-full px-3 text-xs font-black transition ${
                active ? `${option.tone} shadow-paper` : 'bg-white/58 text-coffee hover:bg-white/78'
              }`}
              disabled={busy || note.fromUid === profile.uid}
              onClick={() => onReact(note, option.id)}
            >
              {busy ? 'Đang lưu...' : option.label}
            </button>
          );
        })}
      </div>
      {!note.reactionId && note.heartedBy.length > 0 && (
        <p className="mt-2 text-xs font-bold text-coffee/64">Thư cũ này từng được thả tim.</p>
      )}
    </div>
  );
}

function StatusBadge({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/50 px-2.5 py-1 text-[11px] font-bold text-coffee/70">
      {icon}
      {children}
    </span>
  );
}

function MailboxLoading({ label }: { label: string }) {
  return (
    <div className="mt-5 grid min-h-64 place-items-center rounded-[1rem] bg-paper/58 p-6 text-center">
      <div>
        <div className="memory-loading-spinner mx-auto mb-4 h-10 w-10 rounded-full border-4 border-coffee/15 border-t-coffee" />
        <p className="font-hand text-3xl text-coffee">{label}</p>
      </div>
    </div>
  );
}

function MailboxJoinPrompt({ text, onJoin }: { text: string; onJoin: () => void }) {
  return (
    <div className="mt-5 rounded-[1rem] bg-paper/72 p-6 text-center">
      <Lock className="mx-auto text-coffee" size={28} />
      <p className="mx-auto mt-3 max-w-md font-hand text-3xl font-bold text-coffee">{text}</p>
      <button type="button" className="primary-button mx-auto mt-4" onClick={onJoin}>
        Vào lớp 9/8
      </button>
    </div>
  );
}

function MailboxEmpty({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-5 grid min-h-64 place-items-center rounded-[1rem] bg-paper/66 p-6 text-center">
      <div>
        <Heart className="mx-auto text-coffee/70" size={32} />
        <h3 className="mt-3 font-display text-5xl leading-none">{title}</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink/60">{text}</p>
      </div>
    </div>
  );
}
