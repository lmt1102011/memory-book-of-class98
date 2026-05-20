import { BadgeCheck, Camera, Heart, MessageCircle, Search, Send, Sparkles, Upload, UserRound, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import FirebaseNotice from '../components/FirebaseNotice';
import type { ClassmateProfile, MemoryComment, MemoryItem, UserProfile, YouthProfileDraft } from '../types';

interface PeoplePageProps {
  classmates: ClassmateProfile[];
  memories: MemoryItem[];
  commentsByMemory: Record<string, MemoryComment[]>;
  firebaseNotice: string;
  isLoading: boolean;
  profile: UserProfile | null;
  focusedNameKey: string;
  onJoin: () => void;
  onPhotobook: () => void;
  onUpdateProfile: (draft: YouthProfileDraft) => void | Promise<void>;
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
  commentsByMemory,
  firebaseNotice,
  isLoading,
  profile,
  focusedNameKey,
  onJoin,
  onPhotobook,
  onUpdateProfile,
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
  const [localError, setLocalError] = useState('');
  const [localSuccess, setLocalSuccess] = useState('');

  const sortedClassmates = useMemo(
    () => [...classmates].sort((left, right) => left.name.localeCompare(right.name, 'vi')),
    [classmates],
  );

  const selectedPerson = useMemo(() => {
    if (!sortedClassmates.length) return null;
    return (
      sortedClassmates.find((person) => person.nameKey === selectedNameKey) ||
      sortedClassmates.find((person) => person.nameKey === focusedNameKey || person.uid === focusedNameKey) ||
      sortedClassmates.find((person) => person.nameKey === profile?.nameKey) ||
      sortedClassmates[0]
    );
  }, [focusedNameKey, profile?.nameKey, selectedNameKey, sortedClassmates]);

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
    const keyword = query.trim().toLowerCase();
    if (!keyword) return sortedClassmates;
    return sortedClassmates.filter((person) =>
      [person.name, person.nickname || '', person.quote || '', ...(person.personalityTags || [])]
        .join(' ')
        .toLowerCase()
        .includes(keyword),
    );
  }, [query, sortedClassmates]);

  const selectedStats = selectedPerson ? statsByKey[getPersonKey(selectedPerson)] : undefined;
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
          <form className="rounded-[1.35rem] border border-white/65 bg-white/52 p-4 shadow-paper backdrop-blur-xl" onSubmit={handleSubmit}>
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
                <div className="mt-5 flex items-center gap-4">
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
                    <p className="mt-1 text-xs leading-5 text-ink/58">Bấm avatar để upload ảnh đại diện.</p>
                  </div>
                  <input ref={uploadRef} className="hidden" type="file" accept="image/*" onChange={handleAvatarChange} />
                </div>

                <label className="mt-4 block">
                  <span className="mb-2 block text-xs font-bold uppercase text-coffee/70">Biệt danh</span>
                  <input className="input-field" value={nickname} onChange={(event) => setNickname(event.target.value.slice(0, 36))} />
                </label>

                <label className="mt-3 block">
                  <span className="mb-2 block text-xs font-bold uppercase text-coffee/70">Câu nói riêng</span>
                  <input className="input-field" value={quote} onChange={(event) => setQuote(event.target.value.slice(0, 120))} />
                </label>

                <label className="mt-3 block">
                  <span className="mb-2 block text-xs font-bold uppercase text-coffee/70">3 tag tính cách</span>
                  <input
                    className="input-field"
                    value={tagText}
                    onChange={(event) => setTagText(event.target.value.slice(0, 80))}
                    placeholder="ấm áp, hài hước, đáng nhớ"
                  />
                </label>

                <label className="mt-3 block">
                  <span className="mb-2 block text-xs font-bold uppercase text-coffee/70">Lời gửi lớp 9/8</span>
                  <textarea
                    className="input-field min-h-28 resize-none"
                    value={classMessage}
                    onChange={(event) => setClassMessage(event.target.value.slice(0, 360))}
                  />
                </label>

                {(localError || localSuccess) && (
                  <p className={`mt-3 text-sm font-bold ${localError ? 'text-[#9d3b4b]' : 'text-chalk'}`}>
                    {localError || localSuccess}
                  </p>
                )}

                <button className="primary-button mt-5 w-full" disabled={isSaving}>
                  <Send size={17} />
                  {isSaving ? 'Đang lưu...' : 'Lưu hồ sơ'}
                </button>
              </>
            )}
          </form>

          <div className="rounded-[1.35rem] border border-white/65 bg-white/44 p-4 shadow-paper backdrop-blur-xl">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-coffee/55" size={17} />
              <input
                className="input-field pl-11"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm tên, biệt danh, tag"
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
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {filteredClassmates.map((person) => {
                  const stats = statsByKey[getPersonKey(person)] || { memories: [], hearts: 0, comments: 0 };
                  const active = selectedPerson?.nameKey === person.nameKey;
                  return (
                    <button
                      key={getPersonKey(person)}
                      type="button"
                      className={`min-w-0 rounded-[1rem] border p-4 text-left shadow-paper transition ${
                        active ? 'border-ink bg-ink text-paper' : 'border-white/65 bg-white/54 text-ink hover:bg-white/72'
                      }`}
                      onClick={() => setSelectedNameKey(person.nameKey)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar person={person} active={active} />
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-black">{person.name}</h3>
                          <p className={`truncate text-xs font-bold ${active ? 'text-paper/68' : 'text-coffee/70'}`}>
                            {person.nickname || 'Chưa có biệt danh'}
                          </p>
                        </div>
                      </div>
                      <p className={`mt-3 line-clamp-2 text-sm leading-6 ${active ? 'text-paper/72' : 'text-ink/66'}`}>
                        {person.quote || 'Một câu nói riêng đang chờ được viết.'}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {(person.personalityTags.length ? person.personalityTags : ['9/8']).map((tag) => (
                          <span
                            key={tag}
                            className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                              active ? 'bg-paper/14 text-paper/78' : 'bg-coffee/8 text-coffee'
                            }`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className={`mt-4 grid grid-cols-3 gap-2 text-center text-xs font-bold ${active ? 'text-paper/74' : 'text-coffee/70'}`}>
                        <span>{stats.memories.length} ảnh</span>
                        <span>{stats.hearts} tim</span>
                        <span>{stats.comments} bình luận</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <PersonDetail
                person={selectedPerson}
                stats={selectedStats}
                onPhotobook={onPhotobook}
                onClear={() => setSelectedNameKey('')}
              />
            </div>
          )}
        </main>
      </section>

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

function PersonDetail({
  person,
  stats,
  onPhotobook,
  onClear,
}: {
  person: ClassmateProfile | null;
  stats?: { memories: MemoryItem[]; hearts: number; comments: number };
  onPhotobook: () => void;
  onClear: () => void;
}) {
  if (!person) {
    return (
      <aside className="rounded-[1.35rem] border border-white/65 bg-white/48 p-5 text-center shadow-paper backdrop-blur-xl">
        <Sparkles className="mx-auto text-coffee" size={30} />
        <p className="mt-3 font-hand text-3xl font-bold text-coffee">Chọn một bạn để mở album riêng.</p>
      </aside>
    );
  }

  const personStats = stats || { memories: [], hearts: 0, comments: 0 };

  return (
    <aside className="sticky top-20 h-fit rounded-[1.35rem] border border-white/65 bg-white/52 p-4 shadow-paper backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar person={person} />
          <div className="min-w-0">
            <h2 className="break-words font-display text-4xl leading-none">{person.name}</h2>
            <p className="mt-1 text-sm font-bold text-coffee/70">{person.nickname || 'Bạn lớp 9/8'}</p>
          </div>
        </div>
        <button className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-coffee/10 text-coffee xl:hidden" onClick={onClear}>
          <X size={16} />
        </button>
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
        <Stat value={personStats.memories.length} label="ảnh" />
        <Stat value={personStats.hearts} label="tim" tone="bg-blush/30" />
        <Stat value={personStats.comments} label="bình luận" tone="bg-skySoft/30" />
      </div>

      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-black uppercase text-coffee/70">Album riêng</h3>
          <button className="secondary-button min-h-10 px-3 text-xs" onClick={onPhotobook}>
            <Camera size={15} />
            Đăng ảnh
          </button>
        </div>

        {personStats.memories.length ? (
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
        ) : (
          <div className="rounded-[0.9rem] bg-paper/72 p-4 text-center">
            <BadgeCheck className="mx-auto text-coffee/70" size={24} />
            <p className="mt-2 text-sm font-bold text-ink/68">Bạn này chưa đăng ảnh nào.</p>
          </div>
        )}
      </div>
    </aside>
  );
}
