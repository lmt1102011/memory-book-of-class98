import { m } from 'framer-motion';
import { BadgeCheck, Camera, UserRound } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import type { UserProfile } from '../types';

interface JoinPageProps {
  profile: UserProfile | null;
  onJoin: (profile: UserProfile) => void;
  onSkip: () => void;
}

export default function JoinPage({ profile, onJoin, onSkip }: JoinPageProps) {
  const [name, setName] = useState(profile?.name || '');
  const [className, setClassName] = useState(profile?.className || '');
  const [joined, setJoined] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !className.trim()) return;

    setJoined(true);
    window.setTimeout(() => {
      onJoin({
        name: name.trim(),
        className: className.trim(),
        joinedAt: new Date().toISOString(),
      });
    }, 900);
  };

  useEffect(() => {
    document.title = 'Join Memory Book';
  }, []);

  return (
    <section className="relative min-h-[calc(100svh-4rem)] overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(247,183,199,.28),transparent_36%),linear-gradient(245deg,rgba(169,205,232,.24),transparent_42%),linear-gradient(135deg,#fbf3e7,#fffaf1)]" />
      <div className="relative mx-auto grid min-h-[calc(100svh-9rem)] max-w-6xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="section-kicker">Photobooth Check-In</p>
          <h1 className="font-display text-6xl leading-none sm:text-8xl">Step into the memory book</h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-ink/68">
            Add your name and class so the photobook can print your details like a real graduation keepsake.
          </p>
        </div>

        <m.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-[2rem] border border-white/65 bg-white/55 p-4 shadow-paper backdrop-blur-xl sm:p-6"
        >
          <div className="absolute -top-4 left-8 h-8 w-32 rotate-[-3deg] rounded bg-[#f4dfbf]/80 shadow-sm" />
          <div className="rounded-[1.4rem] bg-ink p-3 shadow-glass">
            <div className="rounded-[1rem] bg-[linear-gradient(135deg,#fffaf1,#f7b7c7_58%,#a9cde8)] p-5 sm:p-7">
              {joined ? (
                <m.div
                  initial={{ scale: 0.96, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="grid min-h-[25rem] place-items-center text-center"
                >
                  <div>
                    <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-ink text-paper shadow-glow">
                      <BadgeCheck size={34} />
                    </div>
                    <h2 className="font-hand text-5xl font-bold text-ink">
                      Welcome to the Memory Book of our youth.
                    </h2>
                  </div>
                </m.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase text-coffee/70">Student Pass</p>
                      <h2 className="font-display text-5xl leading-none">Memory Booth</h2>
                    </div>
                    <div className="grid h-14 w-14 place-items-center rounded-full bg-white/70 text-coffee shadow-sm">
                      <Camera size={24} />
                    </div>
                  </div>

                  <label className="block">
                    <span className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
                      <UserRound size={16} />
                      Name
                    </span>
                    <input
                      className="input-field"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Minh Tri"
                      autoComplete="name"
                      maxLength={40}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-ink">Class</span>
                    <input
                      className="input-field"
                      value={className}
                      onChange={(event) => setClassName(event.target.value)}
                      placeholder="9/8"
                      maxLength={12}
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button className="primary-button min-h-13 justify-center" type="submit">
                      Join Memory Book
                    </button>
                    <button className="secondary-button min-h-13 justify-center" type="button" onClick={onSkip}>
                      Explore First
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </m.div>
      </div>
    </section>
  );
}
