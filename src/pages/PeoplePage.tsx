import { BadgeCheck, Camera, Download, Heart, Images, MessageCircle, Search, Send, Trash2, Upload, UserRound, Video } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import ActionModal from '../components/ActionModal';
import FirebaseNotice from '../components/FirebaseNotice';
import type { ClassmateProfile, MemoryComment, MemoryItem, UserProfile, YouthProfileDraft } from '../types';
import { formatUploadTime } from '../utils/date';

interface PeoplePageProps {
  classmates: ClassmateProfile[];
  memories: MemoryItem[];
  ownMemories: MemoryItem[];
  commentsByMemory: Record<string, MemoryComment[]>;
  ownCommentsByMemory: Record<string, MemoryComment[]>;
  firebaseNotice: string;
  isLoading: boolean;
  isOwnMemoriesLoading: boolean;
  profile: UserProfile | null;
  focusedNameKey: string;
  onJoin: () => void;
  onPhotobook: () => void;
  onUpdateProfile: (draft: YouthProfileDraft) => void | Promise<void>;
  onDeleteMemory: (memory: MemoryItem) => void | Promise<void>;
  onDownloadMemory: (memory: MemoryItem) => void | Promise<void>;
}

const defaultTags = ['ấm áp', 'hài hước', 'đáng nhớ'];

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

const compressAvatar = async (file: File) => {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const size = 360;
    const scale = Math.max(size / image.width, size / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const x = (size - drawWidth) / 2;
    const y = (size - drawHeight) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas is not supported in this browser.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#fffaf1';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(image, x, y, drawWidth, drawHeight);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const getPersonKey = (person: ClassmateProfile) => person.nameKey || person.uid || person.name.toLowerCase();

const memoryBelongsTo = (memory: MemoryItem, person: ClassmateProfile) => {
  if (memory.nameKey && person.nameKey) return memory.nameKey === person.nameKey;
  if (memory.uid && person.uid) return memory.uid === person.uid;
  return memory.name.trim().toLowerCase() === person.name.trim().toLowerCase();
};

export default function PeoplePage({
  classmates,
  memories,
  ownMemories,
  commentsByMemory,
  ownCommentsByMemory,
  firebaseNotice,
  isLoading,
  isOwnMemoriesLoading,
  profile,
  focusedNameKey,
  onJoin,
  onPhotobook,
  onUpdateProfile,
  onDeleteMemory,
  onDownloadMemory,
}: PeoplePageProps) {
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [selectedNameKey, setSelectedNameKey] = useState('');
  const [avatarDataUrl, setAvatarDataUrl] = useState('');
  const [nickname, setNickname] = useState('');
  const [quote, setQuote] = useState('');
  const [classMessage, setClassMessage] = useState('');
  const [tagText, setTagText] = useState(defaultTags.join(', '));
  const [isSaving, setIsSaving] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [localError, setLocalError] = useState('');
  const [localSuccess, setLocalSuccess] = useState('');

  const sortedClassmates = useMemo(
    () => [...classmates].sort((left, right) => left.name.localeCompare(right.name, 'vi')),
    [classmates],
  );

  const selectedPerson = useMemo(() => {
    if (!selectedNameKey) return null;
    return sortedClassmates.find((person) => person.nameKey === selectedNameKey || person.uid === selectedNameKey) || null;
  }, [selectedNameKey, sortedClassmates]);

  const selfProfile = useMemo(
    () => sortedClassmates.find((person) => person.nameKey === profile?.nameKey) || null,
    [profile?.nameKey, sortedClassmates],
  );

  useEffect(() => {
    if (focusedNameKey) setSelectedNameKey(focusedNameKey);
  }, [focusedNameKey]);

  useEffect(() => {
    if (!selfProfile) return;
    setAvatarDataUrl(selfProfile.avatarDataUrl || '');
    setNickname(selfProfile.nickname || '');
    setQuote(selfProfile.quote || '');
    setClassMessage(selfProfile.classMessage || '');
    setTagText((selfProfile.personalityTags.length ? selfProfile.personalityTags : defaultTags).join(', '));
  }, [selfProfile]);

  const statsByKey = useMemo(() => {
    const stats: Record<string, { memories: MemoryItem[]; hearts: number; comments: number }> = {};

    sortedClassmates.forEach((person) => {
      const personMemories = memories.filter((memory) => memoryBelongsTo(memory, person));
      stats[getPersonKey(person)] = {
        memories: personMemories,
        hearts: personMemories.reduce((sum, memory) => sum + memory.reactions, 0),
        comments: personMemories.reduce((sum, memory) => sum + (commentsByMemory[memory.id]?.length || 0), 0),
      };
    });

    return stats;
  }, [commentsByMemory, memories, sortedClassmates]);

  const filteredClassmates = useMemo(() => {
    const classmatesWithoutSelf = sortedClassmates.filter((person) => person.nameKey !== profile?.nameKey);
    const keyword = query.trim().toLowerCase();
    if (!keyword) return classmatesWithoutSelf;
    return classmatesWithoutSelf.filter((person) =>
      [person.name, person.nickname || '']
        .join(' ')
        .toLowerCase()
        .includes(keyword),
    );
  }, [profile?.nameKey, query, sortedClassmates]);

  const selectedIsSelf = Boolean(profile && selectedPerson && selectedPerson.nameKey === profile.nameKey);
  const selectedOwnStats = useMemo(
    () => ({
      memories: ownMemories,
      hearts: ownMemories.reduce((sum, memory) => sum + memory.reactions, 0),
      comments: ownMemories.reduce((sum, memory) => sum + (ownCommentsByMemory[memory.id]?.length || 0), 0),
    }),
    [ownCommentsByMemory, ownMemories],
  );
  const selectedStats = selectedPerson
    ? selectedIsSelf
      ? selectedOwnStats
      : statsByKey[getPersonKey(selectedPerson)]
    : undefined;
  const totalMemories = memories.length;
  const totalHearts = memories.reduce((sum, memory) => sum + memory.reactions, 0);

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLocalError('');
      setAvatarDataUrl(await compressAvatar(file));
    } catch {
      setLocalError('Không thể nén ảnh đại diện này. Hãy thử ảnh JPG/PNG khác.');
    } finally {
      event.target.value = '';
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError('');
    setLocalSuccess('');

    if (!profile) {
      onJoin();
      return;
    }

    const draft: YouthProfileDraft = {
      avatarDataUrl,
      nickname: nickname.trim(),
      quote: quote.trim(),
      classMessage: classMessage.trim(),
      personalityTags: tagText
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 3),
    };

    try {
      setIsSaving(true);
      await onUpdateProfile(draft);
      setLocalSuccess('Đã lưu hồ sơ thanh xuân của bạn.');
      setIsEditorOpen(false);
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : 'Không thể lưu hồ sơ lúc này.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative">
      <section className="mx-auto max-w-7xl px-4 pb-7 pt-9 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.86fr] lg:items-end">
          <div>
            <p className="section-kicker">Hồ sơ lớp</p>
            <h1 className="max-w-4xl font-display text-5xl leading-[0.9] sm:text-8xl">
              Chân dung thanh xuân của lớp 9/8.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-ink/66 sm:text-base">
              Mỗi bạn có một góc nhỏ để lưu biệt danh, câu nói riêng, lời gửi lớp và album ảnh đã đăng.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-[1.35rem] border border-white/60 bg-white/48 p-4 text-center shadow-paper backdrop-blur-xl">
            <Stat value={sortedClassmates.length} label="hồ sơ" />
            <Stat value={totalMemories} label="ảnh lớp" tone="bg-blush/30" />
            <Stat value={totalHearts} label="tim" tone="bg-skySoft/30" />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-10 sm:px-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:px-8">
        <aside className="grid gap-5">
          <div className="rounded-[1.35rem] border border-white/65 bg-white/52 p-4 shadow-paper backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-ink text-paper">
                <UserRound size={20} />
              </span>
              <div>
                <h2 className="font-display text-4xl leading-none">Hồ sơ của bạn</h2>
                <p className="mt-1 text-xs text-ink/58">Đẹp vừa đủ, dễ nhớ, đúng chất lớp mình.</p>
              </div>
            </div>

            {!profile ? (
              <div className="mt-5 rounded-[0.9rem] bg-paper/72 p-4 text-center">
                <p className="text-sm font-bold text-ink">Vào lớp 9/8 để chỉnh hồ sơ thanh xuân của bạn.</p>
                <button type="button" className="primary-button mx-auto mt-4" onClick={onJoin}>
                  Vào lớp 9/8
                </button>
              </div>
            ) : (
              <>
                <div className="mt-5 rounded-[1rem] bg-paper/68 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                  <div className="flex items-center gap-3">
                    <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-white/72 text-coffee shadow-sm">
                      {avatarDataUrl ? <img src={avatarDataUrl} alt="" className="h-full w-full object-cover" /> : <UserRound size={20} />}
                    </span>
                    <div className="min-w-0">
                      <p className="break-words text-sm font-black">{profile.name}</p>
                      <p className="mt-1 truncate text-xs font-bold text-coffee/68">{nickname || 'Chưa có biệt danh'}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="secondary-button mt-4 w-full justify-center"
                    onClick={() => setIsEditorOpen(true)}
                  >
                    <UserRound size={16} />
                    Sửa hồ sơ
                  </button>
                  <button
                    type="button"
                    className="primary-button mt-3 w-full justify-center"
                    onClick={() => setSelectedNameKey(profile.nameKey)}
                  >
                    <Images size={16} />
                    Xem hồ sơ của tôi
                  </button>
                </div>

                {(localError || localSuccess) && (
                  <p className={`mt-3 text-sm font-bold ${localError ? 'text-[#9d3b4b]' : 'text-chalk'}`}>
                    {localError || localSuccess}
                  </p>
                )}
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
                placeholder="Tìm tên hoặc biệt danh"
              />
            </label>
          </div>
        </aside>

        <main className="min-w-0">
          {isLoading ? (
            <div className="grid min-h-80 place-items-center rounded-[1.5rem] bg-white/45 p-8 text-center shadow-paper">
              <div>
                <div className="memory-loading-spinner mx-auto mb-5 h-14 w-14 rounded-full border-4 border-coffee/15 border-t-coffee" />
                <h2 className="font-display text-5xl">Đang mở hồ sơ lớp...</h2>
              </div>
            </div>
          ) : (
            <div className="grid gap-5">
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {filteredClassmates.map((person) => (
                  <article
                    key={getPersonKey(person)}
                    className="min-w-0 rounded-[1rem] border border-white/65 bg-white/54 p-4 text-left text-ink shadow-paper transition hover:bg-white/72"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar person={person} />
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-black">{person.name}</h3>
                        <p className="truncate text-xs font-bold text-coffee/70">{person.nickname || 'Bạn lớp 9/8'}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="secondary-button mt-4 min-h-10 w-full justify-center text-xs"
                      onClick={() => setSelectedNameKey(person.nameKey)}
                    >
                      <UserRound size={15} />
                      Xem hồ sơ
                    </button>
                  </article>
                ))}
              </div>
            </div>
          )}
        </main>
      </section>

      <ActionModal
        isOpen={Boolean(selectedPerson)}
        title={selectedPerson ? `Hồ sơ ${selectedPerson.name}` : 'Hồ sơ lớp'}
        description="Thông tin cá nhân, lời gửi lớp và album ảnh riêng của bạn này."
        icon={<UserRound size={20} />}
        wide
        onClose={() => setSelectedNameKey('')}
      >
        <PersonDetail
          person={selectedPerson}
          stats={selectedStats}
          isSelf={selectedIsSelf}
          isOwnMemoriesLoading={isOwnMemoriesLoading}
          onPhotobook={onPhotobook}
          onDeleteMemory={onDeleteMemory}
          onDownloadMemory={onDownloadMemory}
        />
      </ActionModal>

      <ActionModal
        isOpen={Boolean(profile && isEditorOpen)}
        title="Sửa hồ sơ"
        description="Chỉnh lại ảnh đại diện, biệt danh, câu nói riêng và lời gửi lớp 9/8."
        icon={<UserRound size={20} />}
        onClose={() => setIsEditorOpen(false)}
      >
        {profile && (
          <form onSubmit={handleSubmit}>
            <ProfileFormSection
              title="1. Ảnh đại diện"
              description="Ảnh sẽ được nén nhẹ trước khi lưu để trang tải nhanh hơn."
              icon={<Upload size={16} />}
            >
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-paper shadow-paper ring-1 ring-coffee/15"
                  onClick={() => uploadRef.current?.click()}
                >
                  {avatarDataUrl ? (
                    <img src={avatarDataUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Upload size={24} className="text-coffee" />
                  )}
                </button>
                <div className="min-w-0">
                  <p className="break-words text-sm font-bold">{profile.name}</p>
                  <p className="mt-1 text-xs leading-5 text-ink/58">Bấm vào vòng ảnh để chọn chân dung của bạn.</p>
                </div>
                <input ref={uploadRef} className="hidden" type="file" accept="image/*" onChange={handleAvatarChange} />
              </div>
            </ProfileFormSection>

            <ProfileFormSection
              title="2. Thông tin nhận diện"
              description="Biệt danh và câu nói riêng sẽ hiện trên thẻ hồ sơ."
              icon={<UserRound size={16} />}
            >
              <div className="grid gap-3">
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase text-coffee/70">Biệt danh</span>
                  <input className="input-field" value={nickname} onChange={(event) => setNickname(event.target.value.slice(0, 36))} />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase text-coffee/70">Câu nói riêng</span>
                  <input className="input-field" value={quote} onChange={(event) => setQuote(event.target.value.slice(0, 120))} />
                </label>
              </div>
            </ProfileFormSection>

            <ProfileFormSection
              title="3. Tính cách"
              description="Tối đa 3 tag, ngăn cách bằng dấu phẩy."
              icon={<Heart size={16} />}
            >
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase text-coffee/70">3 tag tính cách</span>
                <input
                  className="input-field"
                  value={tagText}
                  onChange={(event) => setTagText(event.target.value.slice(0, 80))}
                  placeholder="ấm áp, hài hước, đáng nhớ"
                />
              </label>
            </ProfileFormSection>

            <ProfileFormSection
              title="4. Lời gửi lớp 9/8"
              description="Viết một đoạn ngắn để sau này đọc lại vẫn thấy thương."
              icon={<MessageCircle size={16} />}
            >
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase text-coffee/70">Lời gửi lớp 9/8</span>
                <textarea
                  className="input-field min-h-28 resize-none"
                  value={classMessage}
                  onChange={(event) => setClassMessage(event.target.value.slice(0, 360))}
                />
              </label>
            </ProfileFormSection>

            {localError && <p className="mt-3 text-sm font-bold text-[#9d3b4b]">{localError}</p>}

            <button className="primary-button mt-5 w-full justify-center" disabled={isSaving}>
              <Send size={17} />
              {isSaving ? 'Đang lưu...' : 'Lưu hồ sơ'}
            </button>
          </form>
        )}
      </ActionModal>

      <FirebaseNotice message={firebaseNotice} />
    </div>
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

function ProfileFormSection({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <fieldset className="mt-4 rounded-[1rem] border border-coffee/10 bg-paper/58 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/72 text-coffee shadow-sm">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-black text-ink">{title}</p>
          <p className="mt-1 text-xs leading-5 text-ink/58">{description}</p>
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </fieldset>
  );
}

function Avatar({ person, active = false }: { person: ClassmateProfile; active?: boolean }) {
  return (
    <span
      className={`grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full ${
        active ? 'bg-paper/18 text-paper' : 'bg-paper text-coffee'
      }`}
    >
      {person.avatarDataUrl ? (
        <img src={person.avatarDataUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
      ) : (
        <UserRound size={22} />
      )}
    </span>
  );
}

const safeFilePart = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'ky-uc';

const getMemoryDownloadName = (memory: MemoryItem) => `ky-uc-98-${safeFilePart(memory.id)}.jpg`;

function PersonDetail({
  person,
  stats,
  isSelf = false,
  isOwnMemoriesLoading = false,
  onPhotobook,
  onDeleteMemory,
  onDownloadMemory,
}: {
  person: ClassmateProfile | null;
  stats?: { memories: MemoryItem[]; hearts: number; comments: number };
  isSelf?: boolean;
  isOwnMemoriesLoading?: boolean;
  onPhotobook: () => void;
  onDeleteMemory: (memory: MemoryItem) => void | Promise<void>;
  onDownloadMemory: (memory: MemoryItem) => void | Promise<void>;
}) {
  if (!person) {
    return null;
  }

  const personStats = stats || { memories: [], hearts: 0, comments: 0 };

  return (
    <div className="rounded-[1rem] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(122,86,57,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar person={person} />
          <div className="min-w-0">
            <h2 className="break-words font-display text-4xl leading-none">{person.name}</h2>
            <p className="mt-1 text-sm font-bold text-coffee/70">{person.nickname || 'Bạn lớp 9/8'}</p>
          </div>
        </div>
      </div>

      <p className="mt-4 rounded-[0.9rem] bg-paper/72 px-3 py-3 text-sm leading-7 text-ink/72">
        {person.quote || 'Chưa có câu nói riêng, nhưng thanh xuân vẫn đang ở đây.'}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {(person.personalityTags.length ? person.personalityTags : ['9/8', 'memory']).map((tag) => (
          <span key={tag} className="rounded-full bg-blush/30 px-2.5 py-1 text-xs font-bold text-coffee">
            {tag}
          </span>
        ))}
      </div>

      <p className="mt-4 text-sm leading-7 text-ink/68">
        {person.classMessage || 'Một lời gửi lớp 9/8 đang chờ được viết.'}
      </p>

      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        <Stat value={personStats.memories.length} label={isSelf ? 'mục' : 'ảnh'} />
        <Stat value={personStats.hearts} label="tim" tone="bg-blush/30" />
        <Stat value={personStats.comments} label="bình luận" tone="bg-skySoft/30" />
      </div>

      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-black uppercase text-coffee/70">
              {isSelf ? 'Ảnh & video của tôi' : 'Album riêng'}
            </h3>
            {isSelf && (
              <p className="mt-1 text-xs leading-5 text-ink/55">
                Mục này thay cho tab Của tôi: xem nhanh, tải ảnh và xóa kỷ niệm đã đăng.
              </p>
            )}
          </div>
          {isSelf && (
            <button className="secondary-button min-h-10 px-3 text-xs" onClick={onPhotobook}>
              <Camera size={15} />
              Đăng ảnh/video
            </button>
          )}
        </div>

        {isSelf && isOwnMemoriesLoading ? (
          <div className="grid min-h-44 place-items-center rounded-[0.9rem] bg-paper/72 p-4 text-center">
            <div>
              <div className="memory-loading-spinner mx-auto mb-3 h-10 w-10 rounded-full border-4 border-coffee/15 border-t-coffee" />
              <p className="text-sm font-bold text-ink/68">Đang tải ảnh và video của bạn...</p>
            </div>
          </div>
        ) : personStats.memories.length ? (
          isSelf ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {personStats.memories.slice(0, 18).map((memory) => (
                <div key={`${memory.storageCollection || 'memories98'}-${memory.id}`} className="rounded-[0.9rem] bg-paper/72 p-2 shadow-paper">
                  <div className="relative aspect-square overflow-hidden rounded-[0.7rem] bg-ink/8">
                    <img
                      src={memory.imageUrl}
                      alt={`Kỷ niệm của ${person.name}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                    {memory.mediaType === 'video' && (
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-ink/76 px-2 py-1 text-[11px] font-black text-paper">
                        <Video size={12} />
                        Video
                      </span>
                    )}
                    {memory.visibility && memory.visibility !== 'public' && (
                      <span className="absolute bottom-2 left-2 rounded-full bg-paper/92 px-2 py-1 text-[10px] font-black text-coffee">
                        {memory.visibility === 'private' ? 'Riêng tư' : 'Chọn người xem'}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs font-bold leading-5 text-ink/72">
                    {memory.caption || 'Một kỷ niệm đã đăng'}
                  </p>
                  <p className="mt-1 text-[11px] font-bold uppercase text-coffee/58">{formatUploadTime(memory.createdAt)}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {memory.mediaType === 'video' ? (
                      <button className="secondary-button min-h-9 justify-center px-2 text-xs" disabled>
                        <Download size={14} />
                        Video
                      </button>
                    ) : (
                      <a
                        className="secondary-button min-h-9 justify-center px-2 text-xs"
                        href={memory.imageUrl}
                        download={getMemoryDownloadName(memory)}
                        onClick={() => void onDownloadMemory(memory)}
                      >
                        <Download size={14} />
                        Tải
                      </a>
                    )}
                    <button
                      className="secondary-button min-h-9 justify-center border-blush/60 bg-blush/25 px-2 text-xs text-coffee"
                      onClick={() => {
                        if (!window.confirm('Xóa kỷ niệm này khỏi Memory98?')) return;
                        void onDeleteMemory(memory);
                      }}
                    >
                      <Trash2 size={14} />
                      Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {personStats.memories.slice(0, 9).map((memory) => (
                <img
                  key={memory.id}
                  src={memory.imageUrl}
                  alt={`Ảnh của ${person.name}`}
                  className="aspect-square rounded-[0.65rem] object-cover shadow-sm"
                  loading="lazy"
                  decoding="async"
                />
              ))}
            </div>
          )
        ) : (
          <div className="rounded-[0.9rem] bg-paper/72 p-4 text-center">
            <BadgeCheck className="mx-auto text-coffee/70" size={24} />
            <p className="mt-2 text-sm font-bold text-ink/68">
              {isSelf ? 'Bạn chưa đăng ảnh hoặc video nào.' : 'Bạn này chưa đăng ảnh nào.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
