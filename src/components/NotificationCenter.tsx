import { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCheck, Heart, MessageCircle, Sparkles, Trophy, X } from 'lucide-react';
import type { NotificationItem, NotificationKind } from '../types';
import { formatUploadTime } from '../utils/date';

interface NotificationCenterProps {
  open: boolean;
  items: NotificationItem[];
  unreadCount: number;
  onClose: () => void;
  onMarkAllRead: () => void;
  onOpenItem: (item: NotificationItem) => void;
}

type NotificationFilter = 'unread' | 'all' | 'messages' | 'memories' | 'class';

const iconByKind: Record<NotificationKind, typeof Bell> = {
  message: MessageCircle,
  reaction: Heart,
  comment: MessageCircle,
  commentReaction: Heart,
  like: Heart,
  vote: Trophy,
  badge: Trophy,
  managerReminder: Bell,
};

const accentClass = {
  pink: 'bg-blush/35 text-coffee ring-blush/35',
  blue: 'bg-skySoft/38 text-chalk ring-skySoft/45',
  cream: 'bg-[#f4dfbf]/60 text-coffee ring-[#dfbf91]/30',
  chalk: 'bg-chalk/15 text-chalk ring-chalk/20',
};

const filterLabels: Record<NotificationFilter, string> = {
  unread: 'Chưa xem',
  all: 'Tất cả',
  messages: 'Tin nhắn',
  memories: 'Kỷ niệm',
  class: 'Lớp',
};

const messageKinds = new Set<NotificationKind>(['message', 'reaction']);
const memoryKinds = new Set<NotificationKind>(['comment', 'commentReaction', 'like']);
const classKinds = new Set<NotificationKind>(['vote', 'badge', 'managerReminder']);

const countBy = (items: NotificationItem[], predicate: (item: NotificationItem) => boolean) =>
  items.reduce((total, item) => total + (predicate(item) ? 1 : 0), 0);

const matchesFilter = (item: NotificationItem, filter: NotificationFilter) => {
  if (filter === 'unread') return item.unread;
  if (filter === 'messages') return messageKinds.has(item.kind);
  if (filter === 'memories') return memoryKinds.has(item.kind);
  if (filter === 'class') return classKinds.has(item.kind);
  return true;
};

export default function NotificationCenter({
  open,
  items,
  unreadCount,
  onClose,
  onMarkAllRead,
  onOpenItem,
}: NotificationCenterProps) {
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('unread');

  useEffect(() => {
    if (!open) return;
    setActiveFilter(unreadCount > 0 ? 'unread' : 'all');
  }, [open, unreadCount]);

  const sortedItems = useMemo(
    () => [...items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [items],
  );
  const latestUnread = sortedItems.find((item) => item.unread);
  const filteredItems = useMemo(
    () => sortedItems.filter((item) => matchesFilter(item, activeFilter)),
    [activeFilter, sortedItems],
  );
  const showLatestHighlight = Boolean(latestUnread && (activeFilter === 'unread' || matchesFilter(latestUnread, activeFilter)));
  const displayItems =
    showLatestHighlight && latestUnread
      ? filteredItems.filter((item) => item.id !== latestUnread.id)
      : filteredItems;

  if (!open) return null;

  const counts = {
    unread: unreadCount,
    all: unreadCount,
    messages: countBy(sortedItems, (item) => item.unread && messageKinds.has(item.kind)),
    memories: countBy(sortedItems, (item) => item.unread && memoryKinds.has(item.kind)),
    class: countBy(sortedItems, (item) => item.unread && classKinds.has(item.kind)),
  };
  const unreadMessages = countBy(sortedItems, (item) => item.unread && messageKinds.has(item.kind));
  const unreadMemories = countBy(sortedItems, (item) => item.unread && memoryKinds.has(item.kind));
  const unreadClass = countBy(sortedItems, (item) => item.unread && classKinds.has(item.kind));

  return (
    <div
      className="notification-overlay fixed inset-0 z-[95] grid place-items-end bg-ink/72 p-0 sm:place-items-start sm:p-4 sm:pt-[calc(4.8rem+env(safe-area-inset-top))] lg:place-items-end"
      role="dialog"
      aria-modal="true"
      aria-label="Trung tâm thông báo"
      onClick={onClose}
    >
      <div
        className="notification-panel flex w-full flex-col overflow-hidden rounded-t-[1.45rem] border border-white/70 bg-[#fffaf1] text-ink shadow-[0_28px_90px_rgba(18,15,13,0.34)] sm:ml-auto sm:max-h-[82svh] sm:max-w-[30rem] sm:rounded-[1.35rem]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 border-b border-coffee/10 bg-[#fffaf1] p-4 sm:p-5">
          <span className="mx-auto mb-3 block h-1.5 w-12 rounded-full bg-coffee/18 sm:hidden" aria-hidden="true" />
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink text-paper shadow-paper">
                <Bell size={21} />
                {unreadCount > 0 && <span className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full bg-roseDust ring-2 ring-[#fffaf1]" />}
              </span>
              <div className="min-w-0">
                <p className="section-kicker">Chuông lớp 9/8</p>
                <h2 className="font-display text-4xl leading-none sm:text-5xl">Trung tâm thông báo</h2>
                <p className="mt-2 text-xs leading-5 text-ink/58">
                  Theo dõi Secret Message, tim, bình luận, cảm xúc, huy hiệu và bình chọn mới ngay trong chiếc chuông này.
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
                {unreadCount ? `${unreadCount} thông báo chưa xem` : 'Bạn đã xem hết thông báo mới'}
              </span>
              <button
                className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-paper px-3 text-xs font-black text-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-55"
                onClick={onMarkAllRead}
                disabled={unreadCount === 0}
              >
                <CheckCheck size={14} />
                Đã xem hết
              </button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <NotificationMetric value={unreadMessages} label="tin nhắn" />
              <NotificationMetric value={unreadMemories} label="kỷ niệm" />
              <NotificationMetric value={unreadClass} label="lớp" />
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(Object.keys(filterLabels) as NotificationFilter[]).map((filter) => {
              const isActive = activeFilter === filter;
              const count = counts[filter];

              return (
                <button
                  key={filter}
                  className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-black transition ${
                    isActive ? 'bg-ink text-paper shadow-paper' : 'bg-white/78 text-coffee ring-1 ring-coffee/10 hover:bg-white'
                  }`}
                  onClick={() => setActiveFilter(filter)}
                >
                  {filterLabels[filter]}
                  {count > 0 && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${isActive ? 'bg-paper text-ink' : 'bg-roseDust text-white'}`}>
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4">
          {showLatestHighlight && latestUnread && (
            <button
              className="mb-3 w-full rounded-[1.1rem] bg-gradient-to-br from-blush/45 via-white to-skySoft/35 p-4 text-left shadow-paper ring-1 ring-white/80 transition hover:-translate-y-0.5 hover:shadow-glass"
              onClick={() => onOpenItem(latestUnread)}
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-[11px] font-black uppercase text-paper">
                <Bell size={17} />
                Mới nhất
              </span>
              <strong className="mt-3 block line-clamp-2 text-base leading-6 text-ink">{latestUnread.title}</strong>
              <span className="mt-1 block line-clamp-2 text-sm leading-6 text-ink/64">{latestUnread.body}</span>
              <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-black uppercase text-coffee">
                Mở ngay <Sparkles size={14} />
              </span>
            </button>
          )}

          {displayItems.length ? (
            <div className="grid gap-2">
              {displayItems.map((item) => (
                <NotificationRow key={item.id} item={item} onOpenItem={onOpenItem} />
              ))}
            </div>
          ) : showLatestHighlight ? null : (
            <EmptyNotificationState filter={activeFilter} hasAnyItems={sortedItems.length > 0} />
          )}
        </div>
      </div>
    </div>
  );
}

function NotificationRow({ item, onOpenItem }: { item: NotificationItem; onOpenItem: (item: NotificationItem) => void }) {
  const Icon = iconByKind[item.kind] || Sparkles;

  return (
    <button
      className={`grid w-full grid-cols-[2.65rem_minmax(0,1fr)] gap-3 rounded-[1rem] p-3 text-left shadow-paper ring-1 transition hover:bg-white ${
        item.unread ? 'bg-white ring-blush/38' : 'bg-white/62 ring-coffee/7'
      }`}
      onClick={() => onOpenItem(item)}
    >
      <span className={`relative grid h-10 w-10 place-items-center rounded-full ring-1 ${accentClass[item.accent]}`}>
        <Icon
          size={17}
          fill={item.kind === 'like' || item.kind === 'reaction' || item.kind === 'commentReaction' || item.kind === 'badge' ? 'currentColor' : 'none'}
        />
        {item.unread && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-roseDust ring-2 ring-white" />}
      </span>
      <span className="min-w-0">
        <span className="flex items-start justify-between gap-2">
          <strong className="line-clamp-2 text-sm leading-5">{item.title}</strong>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
              item.unread ? 'bg-roseDust text-white' : 'bg-coffee/8 text-coffee/58'
            }`}
          >
            {item.unread ? 'Chưa xem' : 'Đã xem'}
          </span>
        </span>
        <span className="mt-1 line-clamp-2 text-xs leading-5 text-ink/62">{item.body}</span>
        <span className="mt-2 block text-[11px] font-bold uppercase text-coffee/60">{formatUploadTime(item.createdAt)}</span>
      </span>
    </button>
  );
}

function EmptyNotificationState({ filter, hasAnyItems }: { filter: NotificationFilter; hasAnyItems: boolean }) {
  const title = !hasAnyItems
    ? 'Chưa có thông báo'
    : filter === 'unread'
      ? 'Đã xem hết'
      : 'Không có mục nào';
  const body = !hasAnyItems
    ? 'Khi có Secret Message, tim, bình luận, huy hiệu hoặc bình chọn mới, chuông này sẽ báo cho bạn.'
    : filter === 'unread'
      ? 'Những thông báo đã xem vẫn nằm ở tab Tất cả để bạn mở lại khi cần.'
      : 'Thử chuyển sang tab khác để xem thêm hoạt động của lớp.';

  return (
    <div className="grid min-h-56 place-items-center rounded-[1.1rem] bg-white/58 p-6 text-center ring-1 ring-coffee/6">
      <div>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-paper text-coffee shadow-paper">
          <MessageCircle size={27} />
        </span>
        <h3 className="mt-3 font-display text-4xl leading-none">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-ink/58">{body}</p>
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
