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

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-ink/52 p-0 backdrop-blur-sm sm:place-items-start sm:p-4 sm:pt-20 lg:place-items-end lg:p-4 lg:pt-20"
      role="dialog"
      aria-modal="true"
      aria-label="Trung tâm thông báo"
      onClick={onClose}
    >
      <div
        className="notification-panel max-h-[88svh] w-full overflow-hidden rounded-t-[1.35rem] bg-paper text-ink shadow-glass sm:ml-auto sm:max-w-md sm:rounded-[1.35rem]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-coffee/10 bg-white/58 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="section-kicker">Thông báo</p>
              <h2 className="font-display text-5xl leading-none">Trung tâm lớp 9/8</h2>
              <p className="mt-2 text-xs leading-5 text-ink/58">
                Tim, bình luận, Secret Message và bình chọn mới sẽ gom gọn ở đây.
              </p>
            </div>
            <button className="icon-button shrink-0" onClick={onClose} aria-label="Đóng thông báo">
              <X size={18} />
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-[1rem] bg-ink px-3 py-3 text-paper">
            <span className="inline-flex items-center gap-2 text-sm font-bold">
              <Bell size={17} />
              {unreadCount ? `${unreadCount} thông báo mới` : 'Không có thông báo mới'}
            </span>
            <button
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-paper px-3 text-xs font-black text-ink transition hover:bg-white"
              onClick={onMarkAllRead}
              disabled={!items.length}
            >
              <CheckCheck size={14} />
              Đã đọc
            </button>
          </div>
        </div>

        <div className="max-h-[58svh] overflow-y-auto p-3 sm:max-h-[62svh]">
          {items.length ? (
            <div className="grid gap-2">
              {items.map((item) => {
                const Icon = iconByKind[item.kind] || Sparkles;

                return (
                  <button
                    key={item.id}
                    className={`grid grid-cols-[2.65rem_minmax(0,1fr)] gap-3 rounded-[1rem] p-3 text-left transition hover:bg-white/70 ${
                      item.unread ? 'bg-white shadow-paper' : 'bg-white/45'
                    }`}
                    onClick={() => onOpenItem(item)}
                  >
                    <span className={`grid h-10 w-10 place-items-center rounded-full ${accentClass[item.accent]}`}>
                      <Icon size={17} fill={item.kind === 'like' || item.kind === 'reaction' ? 'currentColor' : 'none'} />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center justify-between gap-2">
                        <strong className="line-clamp-1 text-sm">{item.title}</strong>
                        {item.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-roseDust" aria-hidden="true" />}
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
            <div className="grid min-h-48 place-items-center rounded-[1rem] bg-white/48 p-6 text-center">
              <div>
                <Sparkles className="mx-auto text-coffee" size={28} />
                <h3 className="mt-3 font-display text-4xl leading-none">Yên tĩnh một chút</h3>
                <p className="mt-2 text-sm leading-6 text-ink/58">
                  Khi có tương tác mới, Memory98 sẽ để lại chấm đỏ cho bạn.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
