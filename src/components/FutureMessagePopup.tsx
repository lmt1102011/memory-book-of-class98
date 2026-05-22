import { m } from 'framer-motion';
import { MessageCircle, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useMobilePerformanceMode } from '../hooks/useMobilePerformanceMode';
import type { TimeCapsuleEntry } from '../types';

interface FutureMessagePopupProps {
  isOpen: boolean;
  entries: TimeCapsuleEntry[];
  unlockAt: string;
  onClose: () => void;
}

const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const formatVietnamDate = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: VIETNAM_TIME_ZONE,
  }).format(new Date(value));

export default function FutureMessagePopup({ isOpen, entries, unlockAt, onClose }: FutureMessagePopupProps) {
  const [opened, setOpened] = useState(false);
  const mobilePerformanceMode = useMobilePerformanceMode();

  useEffect(() => {
    if (isOpen) setOpened(false);
  }, [isOpen]);

  if (!isOpen || !entries.length) return null;

  return (
    <m.div
      className="app-safe-modal-overlay fixed inset-0 z-[120] grid place-items-center overflow-hidden bg-ink/72 p-3 text-ink sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Gửi cho tương lai đã đến ngày mở"
      onClick={onClose}
      initial={mobilePerformanceMode ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={mobilePerformanceMode ? undefined : { opacity: 0 }}
      transition={{ duration: mobilePerformanceMode ? 0 : 0.18, ease: 'easeOut' }}
    >
      <m.div
        className="app-safe-modal-panel relative grid max-h-[92svh] w-full max-w-3xl overflow-hidden rounded-[1.35rem] border border-white/75 bg-[#fff7ea] shadow-[0_28px_90px_rgba(18,15,13,.34)]"
        onClick={(event) => event.stopPropagation()}
        initial={mobilePerformanceMode ? false : { opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={mobilePerformanceMode ? undefined : { opacity: 0, y: 12, scale: 0.99 }}
        transition={{ duration: mobilePerformanceMode ? 0 : 0.2, ease: 'easeOut' }}
      >
        <button
          className="absolute right-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-full bg-ink text-paper shadow-paper transition hover:bg-coffee"
          onClick={onClose}
          aria-label="Đóng gửi cho tương lai"
        >
          <X size={18} />
        </button>

        {!opened ? (
          <div className="relative min-h-[32rem] overflow-hidden p-5 text-center sm:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(247,183,199,0.34),transparent_34%),radial-gradient(circle_at_84%_76%,rgba(169,205,232,0.26),transparent_34%)]" />
            <div className="relative mx-auto flex min-h-[29rem] max-w-xl flex-col items-center justify-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-paper shadow-paper">
                <Sparkles size={14} />
                Gửi cho tương lai
              </span>

              <div className="relative mt-8 h-48 w-72 max-w-full">
                <div className="absolute inset-x-2 bottom-0 h-36 rounded-[0.75rem] bg-[#f4dfbf] shadow-[0_28px_60px_rgba(84,57,35,0.22)]" />
                <div className="absolute inset-x-2 bottom-0 h-36 rounded-[0.75rem] bg-[linear-gradient(145deg,#fff4dc_0%,#f4dfbf_56%,#d9ae7c_100%)]" />
                <div className="absolute inset-x-2 bottom-0 h-36 rounded-[0.75rem] border border-coffee/12" />
                <div className="absolute left-2 right-2 top-12 h-32 origin-bottom rotate-180 rounded-[0.75rem] bg-[linear-gradient(180deg,#f8e7c7,#d9ae7c)] [clip-path:polygon(0_0,50%_78%,100%_0,100%_100%,0_100%)]" />
                <div className="absolute left-10 right-10 top-2 h-36 rounded-[0.6rem] bg-white p-4 text-left shadow-paper">
                  <p className="font-hand text-3xl font-bold leading-none text-coffee">Dear future me,</p>
                  <div className="mt-4 space-y-2">
                    <span className="block h-2 rounded-full bg-coffee/12" />
                    <span className="block h-2 w-4/5 rounded-full bg-coffee/10" />
                    <span className="block h-2 w-2/3 rounded-full bg-coffee/8" />
                  </div>
                </div>
                <div className="absolute bottom-9 left-1/2 grid h-16 w-16 -translate-x-1/2 place-items-center rounded-full bg-ink text-paper shadow-paper">
                  <Sparkles size={24} />
                </div>
              </div>

              <h2 className="mt-7 font-display text-6xl leading-[0.86] text-ink sm:text-7xl">
                Đến lúc mở lời nhắn rồi
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-7 text-ink/66 sm:text-base">
                Bạn có {entries.length} lời nhắn từng gửi cho tương lai. Bấm mở phong bì để đọc lại những điều của chính mình.
              </p>
              <p className="mt-3 rounded-full bg-white/70 px-4 py-2 text-xs font-black uppercase text-coffee/62 shadow-paper">
                Mở lúc {formatVietnamDate(unlockAt)}
              </p>

              <button className="primary-button mt-6 w-full justify-center sm:w-auto" onClick={() => setOpened(true)}>
                <MessageCircle size={17} />
                Mở phong bì
              </button>
            </div>
          </div>
        ) : (
          <div className="grid max-h-[92svh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
            <div className="border-b border-coffee/10 bg-[#2f2118] px-5 py-5 pr-16 text-paper sm:px-7">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-paper/48">Gửi cho tương lai</p>
              <h2 className="mt-1 font-display text-5xl leading-none sm:text-6xl">Những lời nhắn của bạn</h2>
              <p className="mt-2 text-sm leading-6 text-paper/66">
                Chỉ bạn đang đăng nhập mới thấy phần này trong app.
              </p>
            </div>

            <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
              <div className="grid gap-4">
                {entries.map((entry, index) => (
                  <article
                    key={entry.id}
                    className="relative overflow-hidden rounded-[1rem] border border-coffee/10 bg-white p-4 shadow-paper sm:p-5"
                  >
                    <span className="absolute -top-2 left-8 h-5 w-24 rotate-[-3deg] rounded-sm bg-[#f4dfbf]/80 shadow-sm" />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-hand text-3xl font-bold leading-none text-coffee">
                          Lời nhắn #{entries.length - index}
                        </p>
                        <time className="mt-1 block text-[11px] font-black uppercase text-ink/42">
                          Đã gửi {formatVietnamDate(entry.createdAt)}
                        </time>
                      </div>
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink/8 text-coffee">
                        <Sparkles size={17} />
                      </span>
                    </div>
                    <p className="mt-4 whitespace-pre-wrap break-words text-base leading-8 text-ink/76">
                      {entry.message}
                    </p>
                  </article>
                ))}
              </div>
            </div>

            <div className="border-t border-coffee/10 bg-paper px-4 py-3 sm:px-6">
              <button className="primary-button w-full justify-center sm:w-auto" onClick={onClose}>
                Giữ lại trong tim
              </button>
            </div>
          </div>
        )}
      </m.div>
    </m.div>
  );
}
