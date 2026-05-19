import { FormEvent, memo, useState } from 'react';
import { Lock, Send, Trash2 } from 'lucide-react';
import type { SecretDiaryEntry, UserProfile } from '../types';
import { formatMemoryDate } from '../utils/date';

interface SecretMailboxProps {
  diaries: SecretDiaryEntry[];
  profile: UserProfile | null;
  onAddDiary: (message: string) => void | Promise<void>;
  onDeleteDiary: (diary: SecretDiaryEntry) => void | Promise<void>;
}

function SecretMailbox({ diaries, profile, onAddDiary, onDeleteDiary }: SecretMailboxProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const submitLetter = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;

    try {
      setIsSending(true);
      setError('');
      await onAddDiary(trimmed);
      setMessage('');
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
        </div>

        <div className="rounded-[1.5rem] border border-white/60 bg-white/45 p-4 shadow-paper backdrop-blur-xl sm:p-5">
          <form className="grid gap-3" onSubmit={submitLetter}>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={profile ? 'Viết vào nhật ký bí mật của bạn...' : 'Đăng nhập để viết nhật ký bí mật...'}
              className="input-field min-h-36 resize-none"
              maxLength={1200}
            />
            <button className="primary-button justify-center" disabled={isSending}>
              <Send size={18} />
              {isSending ? 'Đang lưu...' : 'Lưu nhật ký'}
            </button>
          </form>
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
                            if (window.confirm('Xóa trang nhật ký bí mật này?')) void onDeleteDiary(diary);
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
    </section>
  );
}

export default memo(SecretMailbox);
