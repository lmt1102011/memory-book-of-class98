import { FormEvent, useMemo, useState } from 'react';
import { Lock, Send, Sparkles } from 'lucide-react';
import ActionModal from '../components/ActionModal';
import DraftStatus from '../components/DraftStatus';
import FirebaseNotice from '../components/FirebaseNotice';
import { useLocalDraft } from '../hooks/useLocalDraft';
import type { TimeCapsuleEntry, TimeCapsuleSettings, UserProfile } from '../types';

interface FutureMessagesPageProps {
  timeCapsules: TimeCapsuleEntry[];
  timeCapsuleSettings: TimeCapsuleSettings;
  firebaseNotice: string;
  profile: UserProfile | null;
  onJoin: () => void;
  onAddTimeCapsule: (message: string) => void | Promise<void>;
  onOpenFutureMessages: () => void;
}

const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const formatFutureDate = (value: string) => {
  if (!value) return 'Manager chưa đặt giờ mở';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Manager chưa đặt giờ mở';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: VIETNAM_TIME_ZONE,
  }).format(date);
};

const getCountdownLabel = (unlockAt: string) => {
  if (!unlockAt) return 'Chưa có giờ mở';
  const unlockTime = new Date(unlockAt).getTime();
  if (!Number.isFinite(unlockTime)) return 'Chưa có giờ mở';
  const diff = unlockTime - Date.now();
  if (diff <= 0) return 'Đã đến ngày mở thư';
  const days = Math.ceil(diff / 86_400_000);
  if (days >= 2) return `Còn ${days} ngày`;
  const hours = Math.max(1, Math.ceil(diff / 3_600_000));
  return `Còn ${hours} giờ`;
};

export default function FutureMessagesPage({
  timeCapsules,
  timeCapsuleSettings,
  firebaseNotice,
  profile,
  onJoin,
  onAddTimeCapsule,
  onOpenFutureMessages,
}: FutureMessagesPageProps) {
  const [isWriterOpen, setIsWriterOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const {
    value: message,
    setValue: setMessage,
    clearDraft: clearMessageDraft,
    hasDraft: hasMessageDraft,
    restored: restoredMessageDraft,
  } = useLocalDraft(profile ? `memory98-draft:future-message:${profile.uid}` : '');

  const ownMessages = useMemo(
    () => (profile ? timeCapsules.filter((entry) => entry.uid === profile.uid) : []),
    [profile, timeCapsules],
  );
  const unlockTime = new Date(timeCapsuleSettings.unlockAt).getTime();
  const isUnlocked = Boolean(timeCapsuleSettings.unlockAt) && Number.isFinite(unlockTime) && Date.now() >= unlockTime;
  const unlockLabel = formatFutureDate(timeCapsuleSettings.unlockAt);
  const countdownLabel = getCountdownLabel(timeCapsuleSettings.unlockAt);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    if (!profile) {
      onJoin();
      return;
    }

    try {
      setIsSending(true);
      setError('');
      await onAddTimeCapsule(trimmed);
      clearMessageDraft();
      setIsWriterOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể gửi lời nhắn cho lớp trong tương lai lúc này.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="relative">
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[1.8rem] border border-white/70 bg-paper shadow-paper">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="relative overflow-hidden bg-[#2f2118] p-5 text-paper sm:p-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(247,183,199,0.2),transparent_34%),radial-gradient(circle_at_88%_76%,rgba(169,205,232,0.18),transparent_34%)]" />
              <div className="relative">
                <span className="inline-flex items-center gap-2 rounded-full bg-paper px-3 py-1.5 text-[11px] font-black uppercase text-ink">
                  <Sparkles size={13} />
                  Gửi cho lớp trong tương lai
                </span>
                <h1 className="mt-5 max-w-3xl font-display text-6xl leading-[0.86] sm:text-8xl">
                  Một lá thư nhỏ gửi cho lớp mình sau này
                </h1>
                <p className="mt-5 max-w-2xl text-sm leading-7 text-paper/72 sm:text-base">
                  Viết lại điều bạn muốn nhắn với lớp 9/8 trong tương lai. Trước giờ mở, nơi này chỉ hiện số lời nhắn đã gửi; đến giờ, phong bì lớp sẽ mở ra tất cả lời nhắn của mọi người.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1rem] bg-white/10 p-4">
                    <span className="text-[11px] font-black uppercase text-paper/48">Cả lớp đã gửi</span>
                    <strong className="mt-1 block font-display text-6xl leading-none">{timeCapsules.length}</strong>
                  </div>
                  <div className="rounded-[1rem] bg-white/10 p-4">
                    <span className="text-[11px] font-black uppercase text-paper/48">Của bạn</span>
                    <strong className="mt-1 block font-display text-6xl leading-none">{ownMessages.length}</strong>
                  </div>
                  <div className="rounded-[1rem] bg-paper/12 p-4">
                    <span className="text-[11px] font-black uppercase text-paper/48">Trạng thái</span>
                    <strong className="mt-2 block text-sm font-black leading-6 text-paper">{countdownLabel}</strong>
                  </div>
                </div>

                <div className="mt-5 rounded-[1rem] border border-paper/12 bg-paper/10 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-paper/48">Mở theo giờ Việt Nam</p>
                  <p className="mt-1 text-sm font-bold leading-6 text-paper/84">{unlockLabel}</p>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-paper px-5 py-3 text-sm font-black text-ink shadow-paper transition hover:-translate-y-0.5 sm:w-auto"
                    onClick={() => (profile ? setIsWriterOpen(true) : onJoin())}
                  >
                    <Send size={17} />
                    Gửi cho lớp trong tương lai
                  </button>
                  {isUnlocked && timeCapsules.length > 0 && (
                    <button
                      type="button"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white/12 px-5 py-3 text-sm font-black text-paper shadow-paper ring-1 ring-paper/18 transition hover:bg-white/18 sm:w-auto"
                      onClick={onOpenFutureMessages}
                    >
                      <Sparkles size={17} />
                      Mở phong bì lớp
                    </button>
                  )}
                </div>

                {error && <p className="mt-4 rounded-2xl bg-blush/20 px-4 py-3 text-sm font-bold text-paper">{error}</p>}
              </div>
            </div>

            <aside className="relative overflow-hidden bg-[#fff5e7] p-5 sm:p-6">
              <div className="absolute right-5 top-5 grid h-12 w-12 place-items-center rounded-full bg-ink text-paper shadow-paper">
                {isUnlocked ? <Sparkles size={22} /> : <Lock size={22} />}
              </div>
              <p className="section-kicker pr-16">Thư lớp tương lai</p>
              <h2 className="pr-12 font-display text-5xl leading-none text-ink">
                {isUnlocked ? 'Đã đến lúc mở thư' : 'Đang giữ bí mật'}
              </h2>
              <p className="mt-3 text-sm leading-7 text-ink/64">
                {isUnlocked
                  ? 'Khi bạn vào app, một phong bì sẽ hiện lên. Bấm mở để đọc tất cả lời nhắn mà lớp đã gửi cho lớp trong tương lai.'
                  : 'Không hiện phong bì, không hiện nội dung trước giờ mở. Mọi thứ được cất lại để khoảnh khắc mở thư thật đáng nhớ.'}
              </p>

              <div className="mt-5 rounded-[1.2rem] border border-coffee/10 bg-white/70 p-5 text-center shadow-paper">
                <span className="text-[11px] font-black uppercase tracking-[0.16em] text-coffee/55">Tổng đã gửi</span>
                <strong className="mt-2 block font-display text-8xl leading-none text-ink">{timeCapsules.length}</strong>
                <span className="mt-1 block text-xs font-black uppercase text-coffee/60">lời nhắn cho lớp sau này</span>
              </div>

              <p className="mt-4 rounded-[1rem] bg-paper/72 px-4 py-3 text-xs font-bold leading-5 text-ink/58">
                Trước giờ mở chỉ hiện số lượng. Sau giờ mở, phong bì sẽ mở toàn bộ lời nhắn của lớp.
              </p>
            </aside>
          </div>
        </div>
      </section>

      <ActionModal
        isOpen={Boolean(profile && isWriterOpen)}
        title="Gửi cho lớp trong tương lai"
        description="Trước giờ mở, mọi người chỉ thấy số lời nhắn đã gửi. Nội dung sẽ được cất lại để cả lớp cùng mở sau này."
        icon={<Sparkles size={20} />}
        onClose={() => setIsWriterOpen(false)}
      >
        <form className="grid gap-3" onSubmit={submit}>
          <div className="rounded-[1rem] bg-[#2f2118] p-4 text-paper">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-paper/48">Mở theo giờ Việt Nam</p>
            <p className="mt-1 text-sm font-bold leading-6 text-paper/82">{unlockLabel}</p>
          </div>
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase text-coffee/70">Lời nhắn gửi cho lớp trong tương lai</span>
            <textarea
              className="input-field min-h-40 resize-none"
              value={message}
              onChange={(event) => setMessage(event.target.value.slice(0, 900))}
              placeholder="Viết điều bạn muốn nhắn với lớp 9/8 trong tương lai..."
              maxLength={900}
            />
          </label>
          <DraftStatus hasDraft={hasMessageDraft} restored={restoredMessageDraft} />
          <p className="text-xs font-bold text-ink/48">{message.length}/900 ký tự</p>
          <button className="primary-button justify-center" disabled={isSending || !message.trim()}>
            <Send size={17} />
            {isSending ? 'Đang gửi...' : 'Gửi cho lớp trong tương lai'}
          </button>
        </form>
      </ActionModal>

      <FirebaseNotice message={firebaseNotice} />
    </div>
  );
}
