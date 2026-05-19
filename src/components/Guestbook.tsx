import { Send, Trash2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import type { GuestbookEntry, UserProfile } from '../types';
import { formatMemoryDate } from '../utils/date';

interface GuestbookProps {
  entries: GuestbookEntry[];
  onAddEntry: (message: string) => void | Promise<void>;
  onDeleteEntry: (entry: GuestbookEntry) => void | Promise<void>;
  profile: UserProfile | null;
}

export default function Guestbook({ entries, onAddEntry, onDeleteEntry, profile }: GuestbookProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;

    try {
      setIsSending(true);
      setError('');
      await onAddEntry(trimmed);
      setMessage('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể gửi guestbook lúc này.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
        <div>
          <p className="section-kicker">Guestbook</p>
          <h2 className="font-display text-5xl leading-none sm:text-6xl">Write it before it fades</h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-ink/68">
            Small messages live well here: a line from the last day, a joke only your class knows, or a promise to
            meet again after graduation.
          </p>
        </div>

        <div className="rounded-[1.5rem] border border-white/60 bg-white/45 p-4 shadow-paper backdrop-blur-xl sm:p-5">
          <form className="flex gap-3" onSubmit={handleSubmit}>
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={profile ? 'Viết một lời nhắn cho lớp 9/8...' : 'Đăng nhập để viết guestbook...'}
              className="input-field min-w-0 flex-1"
              maxLength={150}
            />
            <button className="icon-button bg-ink text-paper" aria-label="Send guestbook entry" disabled={isSending}>
              <Send size={18} />
            </button>
          </form>
          {error && <p className="mt-3 rounded-2xl bg-blush/30 px-4 py-3 text-sm font-semibold text-coffee">{error}</p>}

          <div className="mt-5 grid gap-3">
            {entries.map((entry) => (
              <article key={entry.id} className="rounded-2xl bg-paper/80 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-hand text-2xl font-bold text-coffee">{entry.name}</h3>
                  <div className="flex items-center gap-2">
                    <time className="text-[11px] font-semibold uppercase text-ink/45">
                      {formatMemoryDate(entry.createdAt)}
                    </time>
                    {profile?.uid === entry.uid && (
                      <button
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-coffee/10 text-coffee transition hover:bg-coffee/18"
                        onClick={() => {
                          if (window.confirm('Xoa tin nhan nay khoi guestbook cua lop?')) void onDeleteEntry(entry);
                        }}
                        aria-label="Xoa tin nhan"
                        title="Xoa tin nhan"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-sm leading-6 text-ink/72">{entry.message}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
