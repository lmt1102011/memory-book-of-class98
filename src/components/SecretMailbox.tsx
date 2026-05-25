import { FormEvent, memo, useState } from 'react';
import { Lock, Send, Sparkles, Trash2 } from 'lucide-react';
import ActionModal from './ActionModal';
import { useConfirmDialog } from './ConfirmDialogProvider';
import DraftStatus from './DraftStatus';
import { useLocalDraft } from '../hooks/useLocalDraft';
import type { SecretDiaryEntry, UserProfile } from '../types';
import { formatMemoryDate } from '../utils/date';

interface SecretMailboxProps {
  diaries: SecretDiaryEntry[];
  profile: UserProfile | null;
  writingPromptsEnabled?: boolean;
  onJoin: () => void;
  onAddDiary: (message: string) => void | Promise<void>;
  onDeleteDiary: (diary: SecretDiaryEntry) => void | Promise<void>;
}

function SecretMailbox({ diaries, profile, writingPromptsEnabled = false, onJoin, onAddDiary, onDeleteDiary }: SecretMailboxProps) {
  const [isSending, setIsSending] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [error, setError] = useState('');
  const confirmDialog = useConfirmDialog();
  const {
    value: message,
    setValue: setMessage,
    clearDraft: clearMessageDraft,
    hasDraft: hasMessageDraft,
    restored: restoredMessageDraft,
  } = useLocalDraft(profile ? `memory98-draft:secret-diary:${profile.uid}` : '');

  const submitLetter = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;

    try {
      setIsSending(true);
      setError('');
      await onAddDiary(trimmed);
      clearMessageDraft();
      setIsComposerOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể lưu nhật ký lúc này.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 pb-14 pt-6 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
        <div>
          <p className="section-kicker">Nhật ký bí mật</p>
          <h2 className="font-display text-5xl leading-none sm:text-6xl">Những điều chưa kịp nói</h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-ink/68">
            Một góc riêng để gửi lại những tiếc nuối, những câu xin lỗi, những lời cảm ơn chưa kịp bày tỏ ở lứa tuổi
            học trò. Trên website chính, chỉ bạn nhìn thấy nhật ký của mình.
          </p>
          {writingPromptsEnabled && (
            <div className="mt-5 overflow-hidden rounded-[1.25rem] border border-blush/35 bg-[#fffaf1] p-4 shadow-paper">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-paper">
                  <Sparkles size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-coffee/58">Gợi nhắc hôm nay</p>
                  <h3 className="mt-1 text-base font-black leading-5 text-ink">Viết một trang thật riêng cho mình.</h3>
                  <p className="mt-1 text-xs font-semibold leading-5 text-ink/58">
                    Chỉ cần vài dòng cũng được. Để sau này đọc lại, mình biết ngày hôm đó mình đã cảm thấy thế nào.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="secondary-button mt-4 w-full justify-center"
                onClick={() => (profile ? setIsComposerOpen(true) : onJoin())}
              >
                <Send size={16} />
                Viết nhật ký
              </button>
            </div>
          )}
        </div>

        <div className="rounded-[1.5rem] border border-white/60 bg-white/45 p-4 shadow-paper backdrop-blur-xl sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-display text-4xl leading-none">Nhật ký của bạn</h3>
              <p className="mt-1 text-xs leading-5 text-ink/58">Các trang đã viết sẽ nằm ngay bên dưới.</p>
            </div>
            <button
              type="button"
              className="primary-button justify-center"
              onClick={() => (profile ? setIsComposerOpen(true) : onJoin())}
            >
              <Send size={18} />
              Tạo nhật ký
            </button>
          </div>

          {error && <p className="mt-3 rounded-2xl bg-blush/30 px-4 py-3 text-sm font-semibold text-coffee">{error}</p>}

          {diaries.length > 0 ? (
            <div className="mt-5 grid gap-3">
              {diaries.map((diary, index) => (
                <article key={diary.id} className="rounded-2xl bg-paper/80 p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 font-hand text-2xl font-bold text-coffee">
                      <Lock size={17} />
                      Trang nhật ký #{diaries.length - index}
                    </h3>
                    <div className="flex items-center gap-2">
                      <time className="text-[11px] font-semibold uppercase text-ink/45">
                        {formatMemoryDate(diary.createdAt)}
                      </time>
                      {profile?.uid === diary.uid && (
                        <button
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-coffee/10 text-coffee transition hover:bg-coffee/18"
                          onClick={() => {
                            void (async () => {
                              const confirmed = await confirmDialog({
                                title: 'Xóa nhật ký?',
                                description: 'Trang nhật ký bí mật này sẽ bị xóa khỏi góc riêng của bạn.',
                                confirmLabel: 'Xóa nhật ký',
                                tone: 'danger',
                              });
                              if (confirmed) void onDeleteDiary(diary);
                            })();
                          }}
                          aria-label="Xóa nhật ký"
                          title="Xóa nhật ký"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink/72">{diary.message}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl bg-paper/70 p-4 text-sm leading-6 text-ink/62">
              {profile
                ? 'Nhật ký của bạn đang trống. Khi có điều gì chưa kịp nói, hãy để lại ở đây.'
                : 'Đăng nhập bằng tên lớp 9/8 để mở góc nhật ký riêng của bạn.'}
            </div>
          )}
        </div>
      </div>

      <ActionModal
        isOpen={Boolean(profile && isComposerOpen)}
        title="Tạo nhật ký"
        description="Viết một trang nhật ký riêng của bạn. Lưu xong popup sẽ tự đóng."
        icon={<Lock size={20} />}
        onClose={() => setIsComposerOpen(false)}
      >
        <form className="grid gap-3" onSubmit={submitLetter}>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Viết vào nhật ký bí mật của bạn..."
            className="input-field min-h-40 resize-none"
            maxLength={1200}
          />
          <DraftStatus hasDraft={hasMessageDraft} restored={restoredMessageDraft} />
          {error && <p className="rounded-2xl bg-blush/30 px-4 py-3 text-sm font-semibold text-coffee">{error}</p>}
          <button className="primary-button justify-center" disabled={isSending || !message.trim()}>
            <Send size={18} />
            {isSending ? 'Đang lưu...' : 'Lưu nhật ký'}
          </button>
        </form>
      </ActionModal>
    </section>
  );
}

export default memo(SecretMailbox);
