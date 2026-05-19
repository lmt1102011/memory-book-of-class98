import { m } from 'framer-motion';
import { Camera, Music, Music2, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { LANDING_SLIDES } from '../data/memories';
import { useAmbientTone } from '../hooks/useAmbientTone';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { useRafScrollProgress } from '../hooks/useRafScrollProgress';

interface LandingPageProps {
  onJoin: () => void;
  onExplore: () => void;
}

const quotes = [
  'One day, these memories will become the most beautiful part of our youth.',
  'The classroom was small, but our stories were wide as the sky.',
  'We were only students, and somehow that was everything.',
];

export default function LandingPage({ onJoin, onExplore }: LandingPageProps) {
  const [active, setActive] = useState(0);
  const prefersReducedMotion = usePrefersReducedMotion();
  const scrollProgress = useRafScrollProgress();
  const { enabled, toggle } = useAmbientTone();
  const activeQuote = useMemo(() => quotes[active % quotes.length], [active]);

  useEffect(() => {
    if (prefersReducedMotion) return undefined;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % LANDING_SLIDES.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [prefersReducedMotion]);

  return (
    <div className="relative">
      <section className="relative min-h-[100svh] overflow-hidden">
        <div className="absolute inset-0">
          {LANDING_SLIDES.map((slide, index) => (
            <m.div
              key={slide.src}
              className="absolute inset-0 will-change-transform"
              style={{
                transform: `translate3d(0, ${scrollProgress * 24}px, 0) scale(1.04)`,
              }}
              initial={false}
              animate={{ opacity: active === index ? 1 : 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 1.2, ease: 'easeOut' }}
            >
              <img
                src={slide.src}
                alt={slide.alt}
                loading={index === 0 ? 'eager' : 'lazy'}
                decoding="async"
                fetchPriority={index === 0 ? 'high' : 'auto'}
                className="h-full w-full object-cover"
                style={{ objectPosition: slide.position }}
              />
            </m.div>
          ))}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(21,16,12,.18),rgba(21,16,12,.34)_58%,rgba(251,243,231,.94))]" />
          <div className="absolute inset-0 bg-grain opacity-40 [background-size:16px_16px]" />
        </div>

        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <m.div
            className="floating-polaroid left-[7%] top-[18%] hidden rotate-[-8deg] sm:block"
            animate={prefersReducedMotion ? undefined : { y: [0, -12, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="h-28 rounded bg-skySoft/70" />
          </m.div>
          <m.div
            className="floating-polaroid right-[8%] top-[24%] rotate-[7deg]"
            animate={prefersReducedMotion ? undefined : { y: [0, 14, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="h-32 rounded bg-blush/70" />
          </m.div>
          <m.div
            className="floating-polaroid bottom-[13%] left-[15%] hidden rotate-[5deg] md:block"
            animate={prefersReducedMotion ? undefined : { y: [0, 10, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="h-24 rounded bg-[#f4dfbf]" />
          </m.div>
        </div>

        <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          <header className="flex items-center justify-between gap-4">
            <button
              className="inline-flex items-center gap-2 rounded-full bg-white/35 px-3 py-2 text-sm font-bold text-ink shadow-glass backdrop-blur-xl transition hover:bg-white/55"
              onClick={toggle}
            >
              {enabled ? <Music2 size={17} /> : <Music size={17} />}
              {enabled ? 'Music On' : 'Music Off'}
            </button>
            <button className="secondary-button bg-white/40 backdrop-blur-xl" onClick={onExplore}>
              Explore Memories
            </button>
          </header>

          <div className="flex flex-1 items-center">
            <div className="max-w-4xl py-16 text-paper drop-shadow-[0_18px_38px_rgba(53,41,31,.32)]">
              <m.p
                className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-xs font-bold uppercase text-white backdrop-blur-md"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45 }}
              >
                <Sparkles size={15} />
                Graduation memory archive
              </m.p>

              <m.h1
                className="font-display text-7xl leading-[0.82] xs:text-8xl sm:text-9xl lg:text-[10rem] 3xl:text-[12rem]"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.05 }}
              >
                School Memory Photobook
              </m.h1>

              <m.p
                key={activeQuote}
                className="mt-7 max-w-2xl font-hand text-4xl leading-tight text-white sm:text-5xl"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55 }}
              >
                {activeQuote}
              </m.p>

              <m.div
                className="mt-8 flex flex-col gap-3 sm:flex-row"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.16 }}
              >
                <button className="primary-button min-h-14 px-7 text-base" onClick={onJoin}>
                  <Camera size={19} />
                  Join Memory Book
                </button>
                <button className="secondary-button min-h-14 px-7 text-base" onClick={onExplore}>
                  Explore Memories
                </button>
              </m.div>
            </div>
          </div>

          <div className="grid gap-3 rounded-[1.25rem] border border-white/35 bg-white/20 p-3 text-white shadow-glass backdrop-blur-xl sm:grid-cols-3">
            {['Korean photo booth', 'Scrapbook journal', 'Graduation keepsake'].map((item) => (
              <div key={item} className="rounded-2xl bg-white/18 px-4 py-3 text-sm font-semibold">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            ['Capture', 'Large webcam previews, countdown, flash, and retake controls.'],
            ['Create', 'Printable high-resolution strips with names, class, date, and notes.'],
            ['Remember', 'Share publicly to the feed or keep a private download.'],
          ].map(([title, text]) => (
            <div key={title} className="rounded-[1.25rem] bg-white/45 p-5 shadow-paper backdrop-blur-xl">
              <h2 className="font-display text-4xl">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-ink/68">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
