import { FormEvent, useState } from 'react';
import { Send } from 'lucide-react';
import type { SecretLetterPublic, UserProfile } from '../types';
import { formatMemoryDate } from '../utils/date';

interface SecretMailboxProps {
  letters: SecretLetterPublic[];
  profile: UserProfile | null;
  onAddLetter: (message: string) => void | Promise<void>;
}

export default function SecretMailbox({ letters, profile, onAddLetter }: SecretMailboxProps) {
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
      await onAddLetter(trimmed);
      setMessage('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Khong the gui thu luc nay.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 pb-14 pt-6 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
        <div>
          <p className="section-kicker">Secret Mailbox</p>
          <h2 className="font-display text-5xl leading-none sm:text-6xl">Thu an danh cua lop 9/8</h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-ink/68">
            Viet dieu ban muon noi. Tren website chinh, ten nguoi gui se duoc an di; file quan ly rieng se giu lai ten
            de ban co the kiem tra khi can.
          </p>
        </div>

        <div className="rounded-[1.5rem] border border-white/60 bg-white/45 p-4 shadow-paper backdrop-blur-xl sm:p-5">
          <form className="grid gap-3" onSubmit={submitLetter}>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={profile ? 'Viet mot la thu bi mat...' : 'Dang nhap de gui secret mailbox...'}
              className="input-field min-h-28 resize-none"
              maxLength={420}
            />
            <button className="primary-button justify-center" disabled={isSending}>
              <Send size={18} />
              {isSending ? 'Dang gui...' : 'Gui an danh'}
            </button>
          </form>
          {error && <p className="mt-3 rounded-2xl bg-blush/30 px-4 py-3 text-sm font-semibold text-coffee">{error}</p>}

          {letters.length > 0 && (
            <div className="mt-5 grid gap-3">
              {letters.slice(0, 8).map((letter, index) => (
                <article key={letter.id} className="rounded-2xl bg-paper/80 p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-hand text-2xl font-bold text-coffee">Anonymous #{letters.length - index}</h3>
                    <time className="text-[11px] font-semibold uppercase text-ink/45">
                      {formatMemoryDate(letter.createdAt)}
                    </time>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink/72">{letter.message}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
