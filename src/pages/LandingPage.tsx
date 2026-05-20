import { AnimatePresence, m } from 'framer-motion';
import { BookOpen, Camera, Music, Music2, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { LANDING_SLIDES } from '../data/memories';
import { useAmbientTone } from '../hooks/useAmbientTone';
import { useMobilePerformanceMode } from '../hooks/useMobilePerformanceMode';
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

const logoSrc = `${import.meta.env.BASE_URL}logo-web-class-98.svg`;

const tutorialImage = (index: number) => LANDING_SLIDES[index % LANDING_SLIDES.length].src.replace('w=1800', 'w=900');

const tutorialSteps = [
  {
    title: '1. Vào lớp 9/8',
    text: 'Bấm Join Memory Book, nhập họ tên của bạn. Nếu tên mới, hãy đặt mật khẩu; nếu tên đã có, nhập mật khẩu để tiếp tục.',
    image: tutorialImage(0),
    alt: 'Học sinh chụp ảnh kỷ niệm trong lớp học',
  },
  {
    title: '2. Đăng photobook',
    text: 'Vào Đăng ảnh, chọn số ảnh, kiểu chụp, chất lượng và nền. Bạn có thể chụp bằng camera hoặc upload ảnh có sẵn.',
    image: tutorialImage(1),
    alt: 'Bạn bè học sinh tạo dáng trong ngày tốt nghiệp',
  },
  {
    title: '3. Xem feed realtime',
    text: 'Trang Ký ức cập nhật theo thời gian thực. Bạn có thể thả tim một lần, bình luận và bấm vào ảnh để xem rõ hơn.',
    image: tutorialImage(2),
    alt: 'Học sinh tốt nghiệp tung mũ trước trường',
  },
  {
    title: '4. Gửi điều chưa kịp nói',
    text: 'Dùng Thư lớp để gửi lời nhắn cho lớp. Nhật ký là nơi riêng tư để viết những điều tiếc nuối chỉ mình bạn thấy.',
    image: tutorialImage(0),
    alt: 'Không khí lớp học và kỷ niệm tuổi học trò',
  },
];

export default function LandingPage({ onJoin, onExplore }: LandingPageProps) {
  const [active, setActive] = useState(0);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const mobilePerformanceMode = useMobilePerformanceMode();
  const prefersReducedMotion = usePrefersReducedMotion();
  const reduceHeavyMotion = prefersReducedMotion || mobilePerformanceMode;
  const scrollProgress = useRafScrollProgress();
  const { enabled, toggle } = useAmbientTone();
  const activeQuote = useMemo(() => quotes[active % quotes.length], [active]);
  const activeSlide = LANDING_SLIDES[active % LANDING_SLIDES.length];
  const activeSlideSrc = mobilePerformanceMode ? activeSlide.src.replace('w=1800', 'w=900') : activeSlide.src;

  useEffect(() => {
    if (reduceHeavyMotion) return undefined;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % LANDING_SLIDES.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [reduceHeavyMotion]);

  useEffect(() => {
    const nextSlide = LANDING_SLIDES[(active + 1) % LANDING_SLIDES.length];
    const image = new Image();
    image.decoding = 'async';
    image.src = mobilePerformanceMode ? nextSlide.src.replace('w=1800', 'w=900') : nextSlide.src;
  }, [active, mobilePerformanceMode]);

  useEffect(() => {
    if (!tutorialOpen) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTutorialOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [tutorialOpen]);

  return (
    <div className="relative">
      <section className="relative min-h-[100svh] overflow-hidden">
        <div className="absolute inset-0">
          <AnimatePresence initial={false} mode="sync">
            <m.div
              key={activeSlideSrc}
              className="absolute inset-0 will-change-transform"
              style={{
                transform: `translate3d(0, ${scrollProgress * 24}px, 0) scale(1.04)`,
              }}
                initial={reduceHeavyMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduceHeavyMotion ? undefined : { opacity: 0 }}
                transition={{ duration: reduceHeavyMotion ? 0 : 1.2, ease: 'easeOut' }}
            >
              <img
                src={activeSlideSrc}
                alt={activeSlide.alt}
                loading={active === 0 ? 'eager' : 'lazy'}
                decoding="async"
                fetchPriority={active === 0 ? 'high' : 'auto'}
                sizes="100vw"
                className="h-full w-full object-cover"
                style={{ objectPosition: activeSlide.position }}
              />
            </m.div>
          </AnimatePresence>
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(21,16,12,.18),rgba(21,16,12,.34)_58%,rgba(251,243,231,.94))]" />
          <div className="absolute inset-0 bg-grain opacity-40 [background-size:16px_16px]" />
        </div>

        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <m.div
            className="floating-polaroid left-[7%] top-[18%] hidden rotate-[-8deg] sm:block"
            animate={reduceHeavyMotion ? undefined : { y: [0, -12, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="h-28 rounded bg-skySoft/70" />
          </m.div>
          <m.div
            className="floating-polaroid right-[8%] top-[24%] rotate-[7deg]"
            animate={reduceHeavyMotion ? undefined : { y: [0, 14, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="h-32 rounded bg-blush/70" />
          </m.div>
          <m.div
            className="floating-polaroid bottom-[13%] left-[15%] hidden rotate-[5deg] md:block"
            animate={reduceHeavyMotion ? undefined : { y: [0, 10, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="h-24 rounded bg-[#f4dfbf]" />
          </m.div>
        </div>

        <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          <header className="flex items-center justify-between gap-4">
            <div className="hidden items-center gap-2 rounded-full bg-white/35 px-3 py-2 shadow-glass backdrop-blur-xl sm:inline-flex">
              <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-paper ring-1 ring-coffee/15">
                <img src={logoSrc} alt="" className="h-8 w-8 object-contain" loading="eager" decoding="async" />
              </span>
              <span className="pr-1 text-sm font-bold text-ink">Class 98</span>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-full bg-white/35 px-3 py-2 text-sm font-bold text-ink shadow-glass backdrop-blur-xl transition hover:bg-white/55"
              onClick={toggle}
            >
              {enabled ? <Music2 size={17} /> : <Music size={17} />}
              {enabled ? 'Music On' : 'Music Off'}
            </button>
            <div className="flex items-center gap-2">
              <button className="secondary-button intro-header-button bg-white/40 backdrop-blur-xl" onClick={() => setTutorialOpen(true)}>
                <BookOpen size={17} />
                Tutorial
              </button>
              <button className="secondary-button intro-header-button hidden bg-white/40 backdrop-blur-xl sm:inline-flex" onClick={onExplore}>
                Explore Memories
              </button>
            </div>
          </header>

          <div className="flex flex-1 items-center">
            <div className="max-w-4xl py-16 text-paper drop-shadow-[0_18px_38px_rgba(53,41,31,.32)]">
              <m.p
                className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-xs font-bold uppercase text-white backdrop-blur-md"
                initial={reduceHeavyMotion ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceHeavyMotion ? 0 : 0.45 }}
              >
                <Sparkles size={15} />
                Graduation memory archive
              </m.p>

              <m.h1
                className="font-display text-7xl leading-[0.82] xs:text-8xl sm:text-9xl lg:text-[10rem] 3xl:text-[12rem]"
                initial={reduceHeavyMotion ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceHeavyMotion ? 0 : 0.55, delay: reduceHeavyMotion ? 0 : 0.05 }}
              >
                School Memory Photobook
              </m.h1>

              <m.p
                key={activeQuote}
                className="mt-7 max-w-2xl font-hand text-4xl leading-tight text-white sm:text-5xl"
                initial={reduceHeavyMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceHeavyMotion ? 0 : 0.55 }}
              >
                {activeQuote}
              </m.p>

              <m.div
                className="mt-8 flex flex-col gap-3 sm:flex-row"
                initial={reduceHeavyMotion ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceHeavyMotion ? 0 : 0.5, delay: reduceHeavyMotion ? 0 : 0.16 }}
              >
                <button className="primary-button min-h-14 px-7 text-base" onClick={onJoin}>
                  <Camera size={19} />
                  Join Memory Book
                </button>
                <button className="secondary-button min-h-14 px-7 text-base" onClick={onExplore}>
                  Explore Memories
                </button>
                <button className="secondary-button min-h-14 px-7 text-base" onClick={() => setTutorialOpen(true)}>
                  <BookOpen size={19} />
                  Tutorial
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

      <AnimatePresence>
        {tutorialOpen && (
          <m.div
            className="fixed inset-0 z-50 grid place-items-center bg-ink/82 p-3 backdrop-blur-sm sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label="Hướng dẫn sử dụng Memory Book"
            initial={reduceHeavyMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceHeavyMotion ? undefined : { opacity: 0 }}
            transition={{ duration: reduceHeavyMotion ? 0 : 0.18 }}
            onClick={() => setTutorialOpen(false)}
          >
            <m.div
              className="relative max-h-[92svh] w-full max-w-6xl overflow-auto rounded-[1.25rem] bg-paper p-4 text-ink shadow-glass sm:p-6"
              initial={reduceHeavyMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceHeavyMotion ? undefined : { opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: reduceHeavyMotion ? 0 : 0.22, ease: 'easeOut' }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-ink text-paper shadow-paper"
                onClick={() => setTutorialOpen(false)}
                aria-label="Đóng tutorial"
              >
                <X size={19} />
              </button>

              <div className="pr-12">
                <p className="section-kicker">Tutorial</p>
                <h2 className="font-display text-5xl leading-none sm:text-7xl">Cách dùng Memory Book</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-ink/66">
                  Một vòng hướng dẫn nhanh để bạn biết cách vào lớp, tạo photobook, tương tác với ảnh và viết những điều còn giữ trong lòng.
                </p>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {tutorialSteps.map((step) => (
                  <article key={step.title} className="overflow-hidden rounded-[0.8rem] bg-white/58 shadow-paper">
                    <img
                      src={step.image}
                      alt={step.alt}
                      loading="lazy"
                      decoding="async"
                      sizes="(min-width: 768px) 42vw, 92vw"
                      className="h-44 w-full object-cover sm:h-52"
                    />
                    <div className="p-4">
                      <h3 className="font-display text-4xl leading-none">{step.title}</h3>
                      <p className="mt-2 text-sm leading-7 text-ink/68">{step.text}</p>
                    </div>
                  </article>
                ))}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  className="primary-button min-h-12 px-6"
                  onClick={() => {
                    setTutorialOpen(false);
                    onJoin();
                  }}
                >
                  <Camera size={18} />
                  Bắt đầu vào lớp
                </button>
                <button
                  className="secondary-button min-h-12 px-6"
                  onClick={() => {
                    setTutorialOpen(false);
                    onExplore();
                  }}
                >
                  Xem ký ức
                </button>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

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
