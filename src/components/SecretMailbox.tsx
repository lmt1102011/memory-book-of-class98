import { FormEvent, useState } from 'react';
import { Lock, Send, Trash2 } from 'lucide-react';
import type { SecretDiaryEntry, UserProfile } from '../types';
import { formatMemoryDate } from '../utils/date';

interface SecretMailboxProps {
  diaries: SecretDiaryEntry[];
  profile: UserProfile | null;
  onAddDiary: (message: string) => void | Promise<void>;
  onDeleteDiary: (diary: SecretDiaryEntry) => void | Promise<void>;
}

export default function SecretMailbox({ diaries, profile, onAddDiary, onDeleteDiary }: SecretMailboxProps) {
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
      setError(caught instanceof Error ? caught.message : 'Khong the luu nhat ky luc nay.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 pb-14 pt-6 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
        <div>
          <p className="section-kicker">Nhat ky bi mat</p>
          <h2 className="font-display text-5xl leading-none sm:text-6xl">Nhung dieu chua kip noi</h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-ink/68">
            Mot goc rieng de gui lai nhung tiec nuoi, nhung cau xin loi, nhung loi cam on chua kip bay to o lua tuoi
            hoc tro. Tren website chinh, chi ban nhin thay nhat ky cua minh.
          </p>
        </div>

        <div className="rounded-[1.5rem] border border-white/60 bg-white/45 p-4 shadow-paper backdrop-blur-xl sm:p-5">
          <form className="grid gap-3" onSubmit={submitLetter}>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={profile ? 'Viet vao nhat ky bi mat cua ban...' : 'Dang nhap de viet nhat ky bi mat...'}
              className="input-field min-h-36 resize-none"
              maxLength={1200}
            />
            <button className="primary-button justify-center" disabled={isSending}>
              <Send size={18} />
              {isSending ? 'Dang luu...' : 'Luu nhat ky'}
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
                      Trang nhat ky #{diaries.length - index}
                    </h3>
                    <div className="flex items-center gap-2">
                      <time className="text-[11px] font-semibold uppercase text-ink/45">
                        {formatMemoryDate(diary.createdAt)}
                      </time>
                      {profile?.uid === diary.uid && (
                        <button
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-coffee/10 text-coffee transition hover:bg-coffee/18"
                          onClick={() => {
                            if (window.confirm('Xoa trang nhat ky bi mat nay?')) void onDeleteDiary(diary);
                          }}
                          aria-label="Xoa nhat ky"
                          title="Xoa nhat ky"
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
                ? 'Nhat ky cua ban dang trong. Khi co dieu gi chua kip noi, hay de lai o day.'
                : 'Dang nhap bang ten lop 9/8 de mo goc nhat ky rieng cua ban.'}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
