import { Bell, CheckCheck, Heart, MessageCircle, Sparkles, Trophy, X } from 'lucide-react';
import type { NotificationItem } from '../types';
import { formatUploadTime } from '../utils/date';

interface NotificationCenterProps {
  open: boolean;
  items: NotificationItem[];
  unreadCount: number;
  onClose: () => void;
  onMarkAllRead: () => void;
  onOpenItem: (item: NotificationItem) => void;
}

const iconByKind = {
  message: MessageCircle,
  reaction: Heart,
  comment: MessageCircle,
  commentReaction: Heart,
  like: Heart,
  vote: Trophy,
};

const accentClass = {
  pink: 'bg-blush/35 text-coffee',
  blue: 'bg-skySoft/35 text-chalk',
  cream: 'bg-[#f4dfbf]/55 text-coffee',
  chalk: 'bg-chalk/15 text-chalk',
};

export default function NotificationCenter({
  open,
  items,
  unreadCount,
  onClose,
  onMarkAllRead,
  onOpenItem,
}: NotificationCenterProps) {
  if (!open) return null;

  const latestItem = items[0];
  const listItems = latestItem ? items.filter((item) => item.id !== latestItem.id) : items;
  const messageCount = items.filter((item) => item.kind === 'message' || item.kind === 'reaction').length;
  const memoryCount = items.filter((item) => item.kind === 'comment' || item.kind === 'commentReaction' || item.kind === 'like').length;
  const voteCount = items.filter((item) => item.kind === 'vote').length;

  return (
    <div
      className="notification-overlay fixed inset-0 z-[95] grid place-items-end bg-ink/72 p-0 sm:place-items-start sm:p-4 sm:pt-[calc(4.8rem+env(safe-area-inset-top))] lg:place-items-end"
      role="dialog"
      aria-modal="true"
      aria-label="Trung tâm thông báo"
      onClick={onClose}
    >
      <div
        className="notification-panel w-full overflow-hidden rounded-t-[1.45rem] border border-white/70 bg-[#fffaf1] text-ink shadow-[0_28px_90px_rgba(18,15,13,0.34)] sm:ml-auto sm:max-h-[82svh] sm:max-w-[27rem] sm:rounded-[1.35rem]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-coffee/10 bg-[#fffaf1] p-4 sm:p-5">
          <span className="mx-auto mb-3 block h-1.5 w-12 rounded-full bg-coffee/18 sm:hidden" aria-hidden="true" />
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink text-paper shadow-paper">
                <Bell size={21} />
              </span>
              <div className="min-w-0">
                <p className="section-kicker">Thông báo</p>
                <h2 className="font-display text-5xl leading-none">Thông báo mới</h2>
                <p className="mt-2 text-xs leading-5 text-ink/58">
                  Chỉ hiện những thông báo bạn chưa xem. Bấm vào một thông báo để mở, xem rồi thông báo đó sẽ biến mất.
                </p>
              </div>
            </div>
            <button className="icon-button shrink-0 bg-white/80" onClick={onClose} aria-label="Đóng thông báo">
              <X size={18} />
            </button>
          </div>

          <div className="mt-4 rounded-[1.1rem] bg-ink p-3 text-paper shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex min-w-0 items-center gap-2 text-sm font-bold">
                <Bell size={17} />
                {unreadCount ? `${unreadCount} thông báo chưa xem` : 'Bạn đã xem hết thông báo'}
              </span>
              <button
                className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-paper px-3 text-xs font-black text-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-55"
                onClick={onMarkAllRead}
                disabled={!items.length || unreadCount === 0}
              >
                <CheckCheck size={14} />
                Đã xem hết
              </button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <NotificationMetric value={messageCount} label="tin nhắn" />
              <NotificationMetric value={memoryCount} label="kỷ niệm" />
              <NotificationMetric value={voteCount} label="vote" />
            </div>
          </div>
        </div>

        <div className="max-h-[calc(100svh-16rem)] overflow-y-auto p-3 sm:max-h-[calc(82svh-15rem)] sm:p-4">
          {latestItem && (
            <button
              className="mb-3 w-full rounded-[1.1rem] bg-gradient-to-br from-blush/45 via-white to-skySoft/35 p-4 text-left shadow-paper ring-1 ring-white/80 transition hover:-translate-y-0.5 hover:shadow-glass"
              onClick={() => onOpenItem(latestItem)}
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-[11px] font-black uppercase text-paper">
                <Bell size={17} />
                Mới nhất
              </span>
              <strong className="mt-3 block line-clamp-2 text-base leading-6 text-ink">{latestItem.title}</strong>
              <span className="mt-1 block line-clamp-2 text-sm leading-6 text-ink/64">{latestItem.body}</span>
              <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-black uppercase text-coffee">
                Mở ngay <Sparkles size={14} />
              </span>
            </button>
          )}

          {items.length ? (
            <div className="grid gap-2">
              {listItems.map((item) => {
                const Icon = iconByKind[item.kind] || Sparkles;

                return (
                  <button
                    key={item.id}
                    className="grid grid-cols-[2.65rem_minmax(0,1fr)] gap-3 rounded-[1rem] bg-white p-3 text-left shadow-paper ring-1 ring-blush/28 transition hover:bg-white/80"
                    onClick={() => onOpenItem(item)}
                  >
                    <span className={`grid h-10 w-10 place-items-center rounded-full ${accentClass[item.accent]}`}>
                      <Icon
                        size={17}
                        fill={item.kind === 'like' || item.kind === 'reaction' || item.kind === 'commentReaction' ? 'currentColor' : 'none'}
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center justify-between gap-2">
                        <strong className="line-clamp-1 text-sm">{item.title}</strong>
                        <span className="shrink-0 rounded-full bg-roseDust px-2 py-0.5 text-[10px] font-black uppercase text-white">
                          Chưa xem
                        </span>
                      </span>
                      <span className="mt-1 line-clamp-2 text-xs leading-5 text-ink/62">{item.body}</span>
                      <span className="mt-2 block text-[11px] font-bold uppercase text-coffee/60">
                        {formatUploadTime(item.createdAt)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid min-h-56 place-items-center rounded-[1.1rem] bg-white/58 p-6 text-center ring-1 ring-coffee/6">
              <div>
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-paper text-coffee shadow-paper">
                  <MessageCircle size={27} />
                </span>
                <h3 className="mt-3 font-display text-4xl leading-none">Đã xem hết</h3>
                <p className="mt-2 text-sm leading-6 text-ink/58">
                  Khi có Secret Message, tim, bình luận hoặc bình chọn mới, popup này sẽ hiện rõ để bạn mở xem.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NotificationMetric({ value, label }: { value: number; label: string }) {
  return (
    <span className="rounded-[0.8rem] bg-paper/10 px-2 py-2">
      <strong className="block text-lg leading-none">{value}</strong>
      <span className="mt-1 block text-[10px] font-black uppercase text-paper/58">{label}</span>
    </span>
  );
}
