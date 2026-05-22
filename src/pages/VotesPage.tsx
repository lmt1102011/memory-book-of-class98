import {
  BadgeCheck,
  BookOpen,
  Camera,
  Check,
  Heart,
  MessageCircle,
  Search,
  Send,
  Sparkles,
  Trash2,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import ActionModal from '../components/ActionModal';
import FirebaseNotice from '../components/FirebaseNotice';
import type { ClassmateProfile, UserProfile, VoteCategory, VoteCategoryDraft, VoteCategoryTone, VoteRecord } from '../types';
import { formatMemoryDate } from '../utils/date';

interface VotesPageProps {
  classmates: ClassmateProfile[];
  categories: VoteCategory[];
  votes: VoteRecord[];
  firebaseNotice: string;
  isLoading: boolean;
  profile: UserProfile | null;
  onJoin: () => void;
  onAddCategory: (draft: VoteCategoryDraft) => void | Promise<void>;
  onHideCategory: (category: VoteCategory) => void | Promise<void>;
  onVote: (category: VoteCategory, target: ClassmateProfile) => void | Promise<void>;
}

const toneOptions: Array<{ id: VoteCategoryTone; label: string; className: string }> = [
  { id: 'pink', label: 'Kẹo hồng', className: 'from-blush/45 to-paper' },
  { id: 'blue', label: 'Trời xanh', className: 'from-skySoft/45 to-paper' },
  { id: 'cream', label: 'Giấy cũ', className: 'from-[#f4dfbf]/70 to-paper' },
  { id: 'chalk', label: 'Bảng phấn', className: 'from-chalk/20 to-paper' },
];

const iconOptions: Array<{ id: string; label: string; Icon: LucideIcon }> = [
  { id: 'sparkles', label: 'Aura', Icon: Sparkles },
  { id: 'heart', label: 'Ấm lòng', Icon: Heart },
  { id: 'camera', label: 'Camera cơm', Icon: Camera },
  { id: 'book', label: 'Sổ rén', Icon: BookOpen },
  { id: 'badge', label: 'Cúp flex', Icon: BadgeCheck },
  { id: 'message', label: 'Mõm xịn', Icon: MessageCircle },
];

const defaultVoteIconId = iconOptions[0].id;

const funnyVotePresets: Array<{
  title: string;
  description: string;
  tone: VoteCategoryTone;
  icon: string;
}> = [
  {
    title: 'Thánh ngủ gật nhưng vẫn qua môn',
    description: 'Dành cho người lim dim nhưng não vẫn online đúng lúc.',
    tone: 'cream',
    icon: 'book',
  },
  {
    title: 'Cây hài cứu mood lớp',
    description: 'Chỉ cần xuất hiện là không khí lớp bớt căng ngay.',
    tone: 'pink',
    icon: 'sparkles',
  },
  {
    title: 'Camera chạy bằng cơm',
    description: 'Người chuyên bắt khoảnh khắc đẹp, lầy và rất đúng thời điểm.',
    tone: 'blue',
    icon: 'camera',
  },
  {
    title: 'Trùm xin vía điểm cao',
    description: 'Không biết học kiểu gì nhưng điểm lúc nào cũng làm người khác muốn xin vía.',
    tone: 'chalk',
    icon: 'badge',
  },
  {
    title: 'Thanh niên “tí làm” huyền thoại',
    description: 'Deadline dí tới nơi vẫn bình tĩnh như đang trong giờ ra chơi.',
    tone: 'cream',
    icon: 'message',
  },
  {
    title: 'Người được gọi tên định mệnh',
    description: 'Giáo viên vừa mở sổ là cả lớp đã đoán được tên ai sắp vang lên.',
    tone: 'pink',
    icon: 'heart',
  },
  {
    title: 'Chủ tịch hội mượn bút',
    description: 'Đi học nhẹ nhàng vì cả thế giới là hộp bút dự phòng.',
    tone: 'blue',
    icon: 'book',
  },
  {
    title: 'Pháp sư “em chưa hiểu”',
    description: 'Một câu hỏi cất lên là cứu cả lớp khỏi kiểm tra bài cũ thêm vài phút.',
    tone: 'cream',
    icon: 'message',
  },
  {
    title: 'Máy phát wifi năng lượng vui',
    description: 'Ngồi gần bạn này là tự nhiên mood lớp bắt sóng lại.',
    tone: 'pink',
    icon: 'sparkles',
  },
  {
    title: 'Trùm đi học đúng giờ trong truyền thuyết',
    description: 'Không phải lúc nào cũng xuất hiện, nhưng mỗi lần đúng giờ là cả lớp ghi nhận.',
    tone: 'chalk',
    icon: 'badge',
  },
  {
    title: 'Bậc thầy né camera',
    description: 'Ảnh lớp có đủ mọi người, riêng bạn này lúc nào cũng như nhân vật bí ẩn.',
    tone: 'blue',
    icon: 'camera',
  },
  {
    title: 'Người chuyên làm lớp trưởng thở dài',
    description: 'Không phá, chỉ là hơi sáng tạo quá mức quy định.',
    tone: 'cream',
    icon: 'heart',
  },
];

const getVoteIcon = (iconId: string) => iconOptions.find((option) => option.id === iconId)?.Icon || Sparkles;

const toneClass: Record<VoteCategoryTone, string> = {
  pink: 'from-blush/45 to-paper',
  blue: 'from-skySoft/45 to-paper',
  cream: 'from-[#f4dfbf]/70 to-paper',
  chalk: 'from-chalk/20 to-paper',
};

export default function VotesPage({
  classmates,
  categories,
  votes,
  firebaseNotice,
  isLoading,
  profile,
  onJoin,
  onAddCategory,
  onHideCategory,
  onVote,
}: VotesPageProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tone, setTone] = useState<VoteCategoryTone>('pink');
  const [icon, setIcon] = useState(defaultVoteIconId);
  const [query, setQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [busyVote, setBusyVote] = useState('');
  const [localError, setLocalError] = useState('');

  const sortedClassmates = useMemo(
    () => [...classmates].filter((person) => person.uid && person.nameKey).sort((left, right) => left.name.localeCompare(right.name, 'vi')),
    [classmates],
  );

  const filteredClassmates = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return sortedClassmates;
    return sortedClassmates.filter((person) =>
      [person.name, person.nickname || '', ...(person.personalityTags || [])].join(' ').toLowerCase().includes(keyword),
    );
  }, [query, sortedClassmates]);

  const votesByCategory = useMemo(() => {
    const grouped: Record<string, VoteRecord[]> = {};
    votes.forEach((vote) => {
      if (!grouped[vote.categoryId]) grouped[vote.categoryId] = [];
      grouped[vote.categoryId].push(vote);
    });
    return grouped;
  }, [votes]);

  const applyPreset = (preset: (typeof funnyVotePresets)[number]) => {
    setTitle(preset.title);
    setDescription(preset.description);
    setTone(preset.tone);
    setIcon(preset.icon);
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError('');

    if (!profile) {
      onJoin();
      return;
    }

    const draft: VoteCategoryDraft = {
      title: title.trim(),
      description: description.trim(),
      tone,
      icon,
    };

    if (!draft.title) {
      setLocalError('Hãy nhập tên hạng mục bình chọn.');
      return;
    }

    try {
      setIsCreating(true);
      await onAddCategory(draft);
      setTitle('');
      setDescription('');
      setTone('pink');
      setIcon(defaultVoteIconId);
      setIsCreatorOpen(false);
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : 'Không thể tạo hạng mục lúc này.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleHide = async (category: VoteCategory) => {
    if (!window.confirm(`Ẩn hạng mục "${category.title}" khỏi bảng bình chọn?`)) return;
    try {
      await onHideCategory(category);
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : 'Không thể ẩn hạng mục lúc này.');
    }
  };

  const handleVote = async (category: VoteCategory, target: ClassmateProfile) => {
    const busyKey = `${category.id}:${target.uid}`;
    try {
      setBusyVote(busyKey);
      await onVote(category, target);
      setLocalError('');
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : 'Không thể lưu bình chọn lúc này.');
    } finally {
      setBusyVote('');
    }
  };

  return (
    <div className="relative">
      <section className="mx-auto max-w-7xl px-4 pb-7 pt-9 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.86fr] lg:items-end">
          <div>
            <p className="section-kicker">Bình chọn 9/8</p>
            <h1 className="max-w-4xl font-display text-5xl leading-[0.9] sm:text-8xl">
              Bảng vinh danh hơi lầy của lớp mình.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-ink/66 sm:text-base">
              Tạo danh hiệu vui, vote cho một bạn, đổi vote nếu lỡ bấm nhầm. Mỗi hạng mục là một mảnh kỷ niệm vừa đáng yêu vừa hơi khó đỡ của lớp 9/8.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-[1.35rem] border border-white/60 bg-white/48 p-4 text-center shadow-paper backdrop-blur-xl">
            <Stat value={categories.length} label="hạng mục" />
            <Stat value={votes.length} label="lượt vote" tone="bg-blush/30" />
            <Stat value={classmates.length} label="hồ sơ" tone="bg-skySoft/30" />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-10 sm:px-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:px-8">
        <aside className="grid h-fit gap-5 lg:sticky lg:top-20">
          <div className="rounded-[1.35rem] border border-white/65 bg-white/52 p-4 shadow-paper backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-ink text-paper">
                <BadgeCheck size={20} />
              </span>
              <div>
                <h2 className="font-display text-4xl leading-none">Tạo hạng mục</h2>
                <p className="mt-1 text-xs text-ink/58">Ai trong lớp cũng có thể tạo bình chọn.</p>
              </div>
            </div>

            {!profile ? (
              <div className="mt-5 rounded-[0.9rem] bg-paper/72 p-4 text-center">
                <p className="text-sm font-bold text-ink">Vào lớp 9/8 để tạo hạng mục và vote.</p>
                <button type="button" className="primary-button mx-auto mt-4" onClick={onJoin}>
                  Vào lớp 9/8
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="primary-button mt-5 w-full justify-center"
                  onClick={() => setIsCreatorOpen(true)}
                >
                  <BadgeCheck size={17} />
                  Tạo hạng mục mới
                </button>

                <div className="mt-4 rounded-[0.9rem] bg-paper/72 p-4 text-sm leading-6 text-ink/64">
                  Bảng bình chọn nằm bên phải. Muốn thêm danh hiệu mới thì mở popup tạo hạng mục, chọn mẫu lầy hoặc tự viết tên riêng cho lớp.
                </div>
                {localError && <p className="mt-3 text-sm font-bold text-[#9d3b4b]">{localError}</p>}
              </>
            )}
          </div>

          <div className="rounded-[1.35rem] border border-white/65 bg-white/44 p-4 shadow-paper backdrop-blur-xl">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-coffee/55" size={17} />
              <input
                className="input-field pl-11"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm bạn để vote"
              />
            </label>
          </div>
        </aside>

        <main className="min-w-0">
          {isLoading ? (
            <div className="grid min-h-80 place-items-center rounded-[1.5rem] bg-white/45 p-8 text-center shadow-paper">
              <div>
                <div className="memory-loading-spinner mx-auto mb-5 h-14 w-14 rounded-full border-4 border-coffee/15 border-t-coffee" />
                <h2 className="font-display text-5xl">Đang mở bảng bình chọn...</h2>
              </div>
            </div>
          ) : categories.length ? (
            <div className="grid gap-5">
              {categories.map((category) => (
                <VoteCategoryCard
                  key={category.id}
                  category={category}
                  classmates={filteredClassmates}
                  votes={votesByCategory[category.id] || []}
                  profile={profile}
                  busyVote={busyVote}
                  onJoin={onJoin}
                  onHide={handleHide}
                  onVote={(target) => void handleVote(category, target)}
                />
              ))}
            </div>
          ) : (
            <div className="grid min-h-80 place-items-center rounded-[1.5rem] bg-white/45 p-8 text-center shadow-paper">
              <div>
                <Sparkles className="mx-auto text-coffee" size={34} />
                <h2 className="mt-3 font-display text-5xl">Chưa có hạng mục nào</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink/60">
                  Tạo hạng mục đầu tiên để lớp bắt đầu trao những danh hiệu vui mà nhìn lại vẫn bật cười.
                </p>
              </div>
            </div>
          )}
        </main>
      </section>

      <ActionModal
        isOpen={Boolean(profile && isCreatorOpen)}
        title="Tạo hạng mục"
        description="Tạo một danh hiệu vui để cả lớp cùng bình chọn."
        icon={<BadgeCheck size={20} />}
        onClose={() => setIsCreatorOpen(false)}
      >
        <form onSubmit={handleCreate}>
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase text-coffee/70">Tên hạng mục</span>
            <input
              className="input-field"
              value={title}
              onChange={(event) => setTitle(event.target.value.slice(0, 80))}
              placeholder="VD: Thánh ngủ gật nhưng vẫn qua môn"
            />
          </label>

          <div className="mt-3 rounded-[1rem] border border-coffee/10 bg-paper/78 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase text-coffee/70">Gợi ý lầy lội</p>
              <span className="text-[11px] font-bold text-ink/48">Bấm để điền nhanh</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {funnyVotePresets.map((preset) => (
                <button
                  key={preset.title}
                  type="button"
                  className="rounded-[0.85rem] bg-white/72 px-3 py-2 text-left text-xs font-black leading-5 text-ink shadow-sm transition hover:bg-white"
                  onClick={() => applyPreset(preset)}
                >
                  {preset.title}
                </button>
              ))}
            </div>
          </div>

          <label className="mt-3 block">
            <span className="mb-2 block text-xs font-bold uppercase text-coffee/70">Mô tả ngắn</span>
            <textarea
              className="input-field min-h-24 resize-none"
              value={description}
              onChange={(event) => setDescription(event.target.value.slice(0, 180))}
              placeholder="Một dòng giải thích cho danh hiệu này, vui thôi nhưng vẫn dễ thương..."
            />
          </label>

          <div className="mt-4">
            <p className="mb-2 text-xs font-bold uppercase text-coffee/70">Biểu tượng</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {iconOptions.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`grid min-h-14 place-items-center rounded-[0.85rem] px-2 py-2 text-center transition ${
                    icon === id ? 'bg-ink text-paper shadow-paper' : 'bg-paper/72 text-coffee hover:bg-white/72'
                  }`}
                  onClick={() => setIcon(id)}
                  title={label}
                >
                  <Icon size={18} />
                  <span className="mt-1 block text-[10px] font-black leading-tight">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-bold uppercase text-coffee/70">Tone màu</p>
            <div className="grid grid-cols-2 gap-2">
              {toneOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`rounded-[0.75rem] bg-gradient-to-br px-3 py-3 text-xs font-black ${option.className} ${
                    tone === option.id ? 'ring-2 ring-ink' : ''
                  }`}
                  onClick={() => setTone(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {localError && <p className="mt-3 text-sm font-bold text-[#9d3b4b]">{localError}</p>}

          <button className="primary-button mt-5 w-full justify-center" disabled={isCreating || !title.trim()}>
            <Send size={17} />
            {isCreating ? 'Đang tạo...' : 'Tạo bình chọn'}
          </button>
        </form>
      </ActionModal>

      <FirebaseNotice message={firebaseNotice} />
    </div>
  );
}

function VoteCategoryCard({
  category,
  classmates,
  votes,
  profile,
  busyVote,
  onJoin,
  onHide,
  onVote,
}: {
  category: VoteCategory;
  classmates: ClassmateProfile[];
  votes: VoteRecord[];
  profile: UserProfile | null;
  busyVote: string;
  onJoin: () => void;
  onHide: (category: VoteCategory) => void;
  onVote: (target: ClassmateProfile) => void;
}) {
  const voteCounts = useMemo(() => {
    const counts = new Map<string, { person: VoteRecord; count: number }>();
    votes.forEach((vote) => {
      const current = counts.get(vote.targetNameKey);
      counts.set(vote.targetNameKey, { person: vote, count: (current?.count || 0) + 1 });
    });
    return Array.from(counts.values()).sort((left, right) => right.count - left.count);
  }, [votes]);

  const myVote = profile ? votes.find((vote) => vote.voterUid === profile.uid) : undefined;
  const canHide = Boolean(profile && category.uid === profile.uid);
  const CategoryIcon = getVoteIcon(category.icon);

  return (
    <article className={`rounded-[1.35rem] border border-white/65 bg-gradient-to-br p-4 shadow-paper ${toneClass[category.tone]}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/62 text-coffee shadow-sm">
              <CategoryIcon size={24} />
            </span>
            <div className="min-w-0">
              <h2 className="break-words font-display text-4xl leading-none sm:text-5xl">{category.title}</h2>
              <p className="mt-1 text-xs font-bold uppercase text-coffee/70">
                Tạo bởi {category.name} · {formatMemoryDate(category.createdAt)}
              </p>
            </div>
          </div>
          {category.description && <p className="mt-3 max-w-2xl text-sm leading-7 text-ink/68">{category.description}</p>}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <span className="rounded-full bg-white/58 px-3 py-2 text-xs font-black text-coffee">{votes.length} lượt vote</span>
          {myVote && (
            <span className="rounded-full bg-ink px-3 py-2 text-xs font-black text-paper">Bạn chọn {myVote.targetName}</span>
          )}
          {canHide && (
            <button className="rounded-full bg-coffee/10 px-3 py-2 text-xs font-black text-coffee" onClick={() => onHide(category)}>
              <Trash2 size={13} className="mr-1 inline" />
              Ẩn
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="rounded-[1rem] bg-white/48 p-4">
          <h3 className="text-xs font-black uppercase text-coffee/70">Top 3 đang dẫn đầu</h3>
          <div className="mt-3 grid gap-2">
            {voteCounts.slice(0, 3).map((item, index) => (
              <div key={item.person.targetNameKey} className="flex items-center justify-between gap-3 rounded-[0.75rem] bg-paper/72 px-3 py-2">
                <span className="min-w-0 truncate text-sm font-black">
                  #{index + 1} {item.person.targetName}
                </span>
                <span className="shrink-0 rounded-full bg-blush/35 px-2 py-1 text-xs font-bold text-coffee">{item.count}</span>
              </div>
            ))}
            {!voteCounts.length && (
              <p className="rounded-[0.75rem] bg-paper/72 px-3 py-4 text-center text-sm font-bold text-ink/60">
                Chưa có ai vote.
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {classmates.map((person) => {
            const selected = myVote?.targetNameKey === person.nameKey;
            const busy = busyVote === `${category.id}:${person.uid}`;
            return (
              <button
                key={person.nameKey}
                type="button"
                className={`flex min-h-14 items-center justify-between gap-3 rounded-[0.85rem] px-3 text-left transition ${
                  selected ? 'bg-ink text-paper shadow-paper' : 'bg-white/54 text-ink hover:bg-white/72'
                }`}
                onClick={() => (profile ? onVote(person) : onJoin())}
                disabled={busy}
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full ${selected ? 'bg-paper/18' : 'bg-paper'}`}>
                    {person.avatarDataUrl ? (
                      <img src={person.avatarDataUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                    ) : (
                      <UserRound size={16} />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black">{person.name}</span>
                    <span className={`block truncate text-[11px] font-bold ${selected ? 'text-paper/64' : 'text-coffee/60'}`}>
                      {person.nickname || '9/8'}
                    </span>
                  </span>
                </span>
                {selected ? <Check size={17} /> : busy ? <Heart size={16} fill="currentColor" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </article>
  );
}

function Stat({ value, label, tone = 'bg-paper/72' }: { value: number; label: string; tone?: string }) {
  return (
    <div className={`rounded-[0.75rem] px-3 py-4 ${tone}`}>
      <p className="font-display text-4xl leading-none">{value}</p>
      <p className="mt-1 text-[11px] font-bold uppercase text-coffee/62">{label}</p>
    </div>
  );
}
