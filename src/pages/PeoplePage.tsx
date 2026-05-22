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
  listResetKey: number;
  onJoin: () => void;
  onPhotobook: () => void;
  onUpdateProfile: (draft: YouthProfileDraft) => void | Promise<void>;
  onDeleteMemory: (memory: MemoryItem) => void | Promise<void>;
  onDownloadMemory: (memory: MemoryItem) => void | Promise<void>;
  onClearFocusedProfile: () => void;
}

type PersonStats = {
  memories: MemoryItem[];
  hearts: number;
  comments: number;
  videos: number;
};

type YouthBadge = {
  id: string;
  label: string;
  description: string;
  icon: 'images' | 'heart' | 'message' | 'video' | 'profile' | 'album';
  className: string;
};

type YouthBadgeGoal = {
  id: string;
  label: string;
  description: string;
  current: number;
  target: number;
  unit: string;
  done: boolean;
};

const defaultTags = ['ấm áp', 'hài hước', 'đáng nhớ'];

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

const waitForFrame = () =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });

const runWhenPageIsCalm = (callback: () => void) => {
  window.requestAnimationFrame(() => {
    window.setTimeout(callback, 80);
  });
};

const canvasToDataUrl = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<string>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Không thể xử lý ảnh đại diện này.'));
          return;
        }

        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Không thể đọc ảnh đại diện này.'));
        reader.readAsDataURL(blob);
      },
      type,
      quality,
    );
  });

const compressAvatar = async (file: File) => {
  await waitForFrame();
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    await waitForFrame();
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
    return await canvasToDataUrl(canvas, 'image/jpeg', 0.78);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const getPersonKey = (person: ClassmateProfile) => person.nameKey || person.uid || person.name.toLowerCase();

const normalizeProfileName = (value: string) => value.trim().toLowerCase();

const emptyPersonStats: PersonStats = {
  memories: [],
  hearts: 0,
  comments: 0,
  videos: 0,
};

const getYouthBadges = (
  person: ClassmateProfile,
  stats: PersonStats,
  classMax: { memories: number; hearts: number; comments: number },
) => {
  const badges: YouthBadge[] = [];
  const hasCompleteProfile = Boolean(
    person.avatarDataUrl &&
      person.nickname?.trim() &&
      person.quote?.trim() &&
      person.classMessage?.trim() &&
      person.personalityTags.length >= 3,
  );

  if (stats.memories.length > 0 && stats.memories.length === classMax.memories) {
    badges.push({
      id: 'memory-keeper',
      label: 'Người giữ ký ức',
      description: `${stats.memories.length} ảnh/video đã góp vào album lớp.`,
      icon: 'images',
      className: 'border-skySoft/45 bg-skySoft/22 text-chalk',
    });
  }

  if (stats.hearts > 0 && stats.hearts === classMax.hearts) {
    badges.push({
      id: 'most-loved',
      label: 'Được yêu thương nhất',
      description: `${stats.hearts} lượt tim từ những kỷ niệm đã đăng.`,
      icon: 'heart',
      className: 'border-blush/55 bg-blush/28 text-coffee',
    });
  }

  if (stats.comments > 0 && stats.comments === classMax.comments) {
    badges.push({
      id: 'story-spark',
      label: 'Gợi nhiều lời nhắn',
      description: `${stats.comments} bình luận quanh album của bạn này.`,
      icon: 'message',
      className: 'border-coffee/18 bg-[#f4dfbf]/55 text-coffee',
    });
  }

  if (stats.videos > 0) {
    badges.push({
      id: 'video-moment',
      label: 'Có video thanh xuân',
      description: `${stats.videos} video ngắn lưu lại khoảnh khắc lớp 9/8.`,
      icon: 'video',
      className: 'border-ink/10 bg-ink/10 text-ink',
    });
  }

  if (stats.memories.length >= 3) {
    badges.push({
      id: 'album-builder',
      label: 'Album có hồn',
      description: 'Album riêng đã đủ đầy để xem lại như một trang scrapbook nhỏ.',
      icon: 'album',
      className: 'border-white/70 bg-paper/80 text-coffee',
    });
  }

  if (hasCompleteProfile) {
    badges.push({
      id: 'profile-polished',
      label: 'Hồ sơ chỉn chu',
      description: 'Đã có ảnh đại diện, biệt danh, câu nói riêng và lời gửi lớp.',
      icon: 'profile',
      className: 'border-chalk/20 bg-chalk/10 text-chalk',
    });
  }

  return badges.slice(0, 5);
};

const getProfileProgress = (person: ClassmateProfile) =>
  [
    Boolean(person.avatarDataUrl),
    Boolean(person.nickname?.trim()),
    Boolean(person.quote?.trim()),
    Boolean(person.classMessage?.trim()),
    person.personalityTags.length >= 3,
  ].filter(Boolean).length;

const getYouthBadgeGoals = (
  person: ClassmateProfile,
  stats: PersonStats,
  classMax: { memories: number; hearts: number; comments: number },
) => {
  const profileProgress = getProfileProgress(person);
  const goals: YouthBadgeGoal[] = [
    {
      id: 'first-memory',
      label: 'Kỷ niệm đầu tiên',
      description: 'Đăng ít nhất một ảnh hoặc video để album riêng bắt đầu có dấu ấn.',
      current: Math.min(stats.memories.length, 1),
      target: 1,
      unit: 'mục',
      done: stats.memories.length >= 1,
    },
    {
      id: 'album-builder',
      label: 'Album có hồn',
      description: 'Đăng đủ 3 kỷ niệm để hồ sơ nhìn như một trang scrapbook nhỏ.',
      current: Math.min(stats.memories.length, 3),
      target: 3,
      unit: 'mục',
      done: stats.memories.length >= 3,
    },
    {
      id: 'profile-polished',
      label: 'Hồ sơ chỉn chu',
      description: 'Hoàn thiện ảnh đại diện, biệt danh, câu nói riêng, lời gửi lớp và 3 tag.',
      current: profileProgress,
      target: 5,
      unit: 'phần',
      done: profileProgress >= 5,
    },
    {
      id: 'video-moment',
      label: 'Có video thanh xuân',
      description: 'Đăng một video ngắn để album có thêm chuyển động và âm sắc đời học trò.',
      current: Math.min(stats.videos, 1),
      target: 1,
      unit: 'video',
      done: stats.videos >= 1,
    },
  ];

  if (classMax.hearts > 0) {
    goals.push({
      id: 'most-loved',
      label: 'Được yêu thương nhất',
      description: 'Cần thêm tim để chạm mốc kỷ niệm được yêu thích nhất lớp.',
      current: Math.min(stats.hearts, classMax.hearts),
      target: classMax.hearts,
      unit: 'tim',
      done: stats.hearts >= classMax.hearts,
    });
  }

  if (classMax.comments > 0) {
    goals.push({
      id: 'story-spark',
      label: 'Gợi nhiều lời nhắn',
      description: 'Cần thêm bình luận quanh album để mở huy hiệu tương tác.',
      current: Math.min(stats.comments, classMax.comments),
      target: classMax.comments,
      unit: 'bình luận',
      done: stats.comments >= classMax.comments,
    });
  }

  return goals.sort((left, right) => Number(left.done) - Number(right.done)).slice(0, 5);
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
  listResetKey,
  onJoin,
  onPhotobook,
  onUpdateProfile,
  onDeleteMemory,
  onDownloadMemory,
  onClearFocusedProfile,
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
  const [isAvatarProcessing, setIsAvatarProcessing] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isProfileDraftDirty, setIsProfileDraftDirty] = useState(false);
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

  const hydrateProfileDraft = (source: ClassmateProfile | null) => {
    setAvatarDataUrl(source?.avatarDataUrl || '');
    setNickname(source?.nickname || '');
    setQuote(source?.quote || '');
    setClassMessage(source?.classMessage || '');
    setTagText(((source?.personalityTags.length ? source.personalityTags : defaultTags) || defaultTags).join(', '));
  };

  useEffect(() => {
    setSelectedNameKey('');
  }, [listResetKey]);

  useEffect(() => {
    if (focusedNameKey) setSelectedNameKey(focusedNameKey);
  }, [focusedNameKey]);

  useEffect(() => {
    if (!selfProfile) return;
    if (isEditorOpen && isProfileDraftDirty) return;
    hydrateProfileDraft(selfProfile);
  }, [isEditorOpen, isProfileDraftDirty, selfProfile]);

  const statsByKey = useMemo(() => {
    const stats: Record<string, PersonStats> = {};
    const peopleByNameKey = new Map<string, ClassmateProfile>();
    const peopleByUid = new Map<string, ClassmateProfile>();
    const peopleByName = new Map<string, ClassmateProfile>();

    sortedClassmates.forEach((person) => {
      const key = getPersonKey(person);
      stats[key] = {
        memories: [],
        hearts: 0,
        comments: 0,
        videos: 0,
      };
      if (person.nameKey) peopleByNameKey.set(person.nameKey, person);
      if (person.uid) peopleByUid.set(person.uid, person);
      peopleByName.set(normalizeProfileName(person.name), person);
    });

    memories.forEach((memory) => {
      const person =
        (memory.nameKey ? peopleByNameKey.get(memory.nameKey) : undefined) ||
        (memory.uid ? peopleByUid.get(memory.uid) : undefined) ||
        peopleByName.get(normalizeProfileName(memory.name));

      if (!person) return;

      const key = getPersonKey(person);
      const personStats = stats[key];
      if (!personStats) return;

      personStats.memories.push(memory);
      personStats.hearts += memory.reactions;
      personStats.comments += commentsByMemory[memory.id]?.length || 0;
      if (memory.mediaType === 'video') personStats.videos += 1;
    });

    return stats;
  }, [commentsByMemory, memories, sortedClassmates]);

  const totalHearts = useMemo(() => memories.reduce((sum, memory) => sum + memory.reactions, 0), [memories]);

  const selectedOwnStats = useMemo(
    () => ({
      memories: ownMemories,
      hearts: ownMemories.reduce((sum, memory) => sum + memory.reactions, 0),
      comments: ownMemories.reduce((sum, memory) => sum + (ownCommentsByMemory[memory.id]?.length || 0), 0),
      videos: ownMemories.filter((memory) => memory.mediaType === 'video').length,
    }),
    [ownCommentsByMemory, ownMemories],
  );

  const badgeClassMax = useMemo(() => {
    const stats = Object.values(statsByKey);
    return {
      memories: Math.max(0, ...stats.map((item) => item.memories.length)),
      hearts: Math.max(0, ...stats.map((item) => item.hearts)),
      comments: Math.max(0, ...stats.map((item) => item.comments)),
    };
  }, [statsByKey]);

  const badgesByKey = useMemo(() => {
    const badges: Record<string, YouthBadge[]> = {};
    sortedClassmates.forEach((person) => {
      const key = getPersonKey(person);
      badges[key] = getYouthBadges(person, statsByKey[key] || emptyPersonStats, badgeClassMax);
    });
    return badges;
  }, [badgeClassMax, sortedClassmates, statsByKey]);

  const badgeGoalsByKey = useMemo(() => {
    const goals: Record<string, YouthBadgeGoal[]> = {};
    sortedClassmates.forEach((person) => {
      const key = getPersonKey(person);
      goals[key] = getYouthBadgeGoals(person, statsByKey[key] || emptyPersonStats, badgeClassMax);
    });
    return goals;
  }, [badgeClassMax, sortedClassmates, statsByKey]);

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
  const selectedStats = selectedPerson
    ? selectedIsSelf
      ? selectedOwnStats
      : statsByKey[getPersonKey(selectedPerson)]
    : undefined;
  const selectedBadges = selectedPerson ? badgesByKey[getPersonKey(selectedPerson)] || [] : [];
  const selectedBadgeGoals = selectedPerson ? badgeGoalsByKey[getPersonKey(selectedPerson)] || [] : [];
  const selfBadges = selfProfile ? badgesByKey[getPersonKey(selfProfile)] || [] : [];
  const totalMemories = memories.length;

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsAvatarProcessing(true);
      setLocalError('');
      setLocalSuccess('');
      const nextAvatar = await compressAvatar(file);
      setAvatarDataUrl(nextAvatar);
      setIsProfileDraftDirty(true);
      setLocalSuccess('Đã chọn ảnh đại diện mới. Bấm Lưu hồ sơ để cập nhật.');
    } catch {
      setLocalError('Không thể nén ảnh đại diện này. Hãy thử ảnh JPG/PNG khác.');
    } finally {
      setIsAvatarProcessing(false);
      event.target.value = '';
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError('');
    setLocalSuccess('');
    if (isAvatarProcessing) {
      setLocalError('Đợi ảnh đại diện xử lý xong rồi hãy lưu nha.');
      return;
    }

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
      setIsProfileDraftDirty(false);
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

          <div className="rounded-[1.35rem] border border-white/60 bg-white/48 p-4 shadow-paper backdrop-blur-xl">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat value={sortedClassmates.length} label="hồ sơ" />
              <Stat value={totalMemories} label="ảnh lớp" tone="bg-blush/30" />
              <Stat value={totalHearts} label="tim" tone="bg-skySoft/30" />
            </div>
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
                  {selfBadges.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {selfBadges.slice(0, 2).map((badge) => (
                        <YouthBadgePill key={badge.id} badge={badge} compact />
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    className="secondary-button mt-4 w-full justify-center"
                    onClick={() => {
                      hydrateProfileDraft(selfProfile);
                      setIsProfileDraftDirty(false);
                      setLocalError('');
                      setLocalSuccess('');
                      setIsEditorOpen(true);
                    }}
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
                {filteredClassmates.map((person) => {
                  const personBadges = badgesByKey[getPersonKey(person)] || [];

                  return (
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
                      {personBadges.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {personBadges.slice(0, 2).map((badge) => (
                            <YouthBadgePill key={badge.id} badge={badge} compact />
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        className="secondary-button mt-4 min-h-10 w-full justify-center text-xs"
                        onClick={() => setSelectedNameKey(person.nameKey)}
                      >
                        <UserRound size={15} />
                        Xem hồ sơ
                      </button>
                    </article>
                  );
                })}
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
        onClose={() => {
          setSelectedNameKey('');
          onClearFocusedProfile();
        }}
      >
        <PersonDetail
          person={selectedPerson}
          stats={selectedStats}
          isSelf={selectedIsSelf}
          badges={selectedBadges}
          badgeGoals={selectedBadgeGoals}
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
        onClose={() => {
          setIsEditorOpen(false);
          setIsProfileDraftDirty(false);
          setLocalError('');
          setLocalSuccess('');
        }}
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
                  className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-paper shadow-paper ring-1 ring-coffee/15 disabled:cursor-wait disabled:opacity-70"
                  onClick={() => uploadRef.current?.click()}
                  disabled={isAvatarProcessing}
                >
                  {avatarDataUrl ? (
                    <img src={avatarDataUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Upload size={24} className="text-coffee" />
                  )}
                  {isAvatarProcessing && (
                    <span className="absolute inset-0 grid place-items-center bg-ink/62 text-[10px] font-black uppercase text-paper">
                      Đang xử lý
                    </span>
                  )}
                </button>
                <div className="min-w-0">
                  <p className="break-words text-sm font-bold">{profile.name}</p>
                  <p className="mt-1 text-xs leading-5 text-ink/58">
                    {isAvatarProcessing
                      ? 'Đang nén ảnh để lưu mượt hơn...'
                      : avatarDataUrl
                        ? 'Ảnh đã sẵn sàng. Bấm Lưu hồ sơ để cập nhật.'
                        : 'Bấm vào vòng ảnh để chọn chân dung của bạn.'}
                  </p>
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
                  <input
                    className="input-field"
                    value={nickname}
                    onChange={(event) => {
                      setIsProfileDraftDirty(true);
                      setNickname(event.target.value.slice(0, 36));
                    }}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase text-coffee/70">Câu nói riêng</span>
                  <input
                    className="input-field"
                    value={quote}
                    onChange={(event) => {
                      setIsProfileDraftDirty(true);
                      setQuote(event.target.value.slice(0, 120));
                    }}
                  />
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
                  onChange={(event) => {
                    setIsProfileDraftDirty(true);
                    setTagText(event.target.value.slice(0, 80));
                  }}
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
                  onChange={(event) => {
                    setIsProfileDraftDirty(true);
                    setClassMessage(event.target.value.slice(0, 360));
                  }}
                />
              </label>
            </ProfileFormSection>

            {localError && <p className="mt-3 text-sm font-bold text-[#9d3b4b]">{localError}</p>}
            {localSuccess && <p className="mt-3 text-sm font-bold text-chalk">{localSuccess}</p>}

            <button className="primary-button mt-5 w-full justify-center" disabled={isSaving || isAvatarProcessing}>
              <Send size={17} />
              {isAvatarProcessing ? 'Đang xử lý ảnh...' : isSaving ? 'Đang lưu...' : 'Lưu hồ sơ'}
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

function YouthBadgePill({ badge, compact = false }: { badge: YouthBadge; compact?: boolean }) {
  const Icon =
    badge.icon === 'heart'
      ? Heart
      : badge.icon === 'message'
        ? MessageCircle
        : badge.icon === 'video'
          ? Video
          : badge.icon === 'profile'
            ? UserRound
            : badge.icon === 'album'
              ? BadgeCheck
              : Images;

  if (compact) {
    return (
      <span className={`inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-black ${badge.className}`}>
        <Icon size={12} className="shrink-0" />
        <span className="truncate">{badge.label}</span>
      </span>
    );
  }

  return (
    <div className={`flex min-w-0 items-start gap-2 rounded-[0.85rem] border px-3 py-2.5 ${badge.className}`}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/58">
        <Icon size={15} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-black uppercase leading-4">{badge.label}</p>
        <p className="mt-1 text-xs leading-5 opacity-75">{badge.description}</p>
      </div>
    </div>
  );
}

function BadgeProgressList({ goals }: { goals: YouthBadgeGoal[] }) {
  if (!goals.length) return null;

  return (
    <div className="mt-4 rounded-[1rem] border border-white/70 bg-white/50 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.74)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase text-coffee/68">Tiến trình mở huy hiệu</p>
        <span className="rounded-full bg-coffee/10 px-2 py-1 text-[10px] font-black uppercase text-coffee/68">
          Tự cập nhật
        </span>
      </div>
      <div className="mt-3 grid gap-2">
      {goals.map((goal) => {
        const percent = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;

        return (
          <div key={goal.id} className="rounded-[0.85rem] bg-paper/72 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-black text-ink">{goal.label}</p>
                <p className="mt-1 text-xs leading-5 text-ink/58">{goal.done ? 'Đã mở huy hiệu này.' : goal.description}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-black ${
                  goal.done ? 'bg-chalk/14 text-chalk' : 'bg-white text-coffee shadow-sm'
                }`}
              >
                {goal.done ? 'Đã mở' : `${goal.current}/${goal.target} ${goal.unit}`}
              </span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-coffee/10">
              <span
                className={`block h-full rounded-full transition-[width] duration-300 ${
                  goal.done ? 'bg-chalk' : 'bg-gradient-to-r from-blush via-[#e9bc9b] to-skySoft'
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      })}
      </div>
    </div>
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
  badges,
  badgeGoals,
  isSelf = false,
  isOwnMemoriesLoading = false,
  onPhotobook,
  onDeleteMemory,
  onDownloadMemory,
}: {
  person: ClassmateProfile | null;
  stats?: PersonStats;
  badges: YouthBadge[];
  badgeGoals: YouthBadgeGoal[];
  isSelf?: boolean;
  isOwnMemoriesLoading?: boolean;
  onPhotobook: () => void;
  onDeleteMemory: (memory: MemoryItem) => void | Promise<void>;
  onDownloadMemory: (memory: MemoryItem) => void | Promise<void>;
}) {
  const [showBadgeGoals, setShowBadgeGoals] = useState(false);
  const [canRenderAlbum, setCanRenderAlbum] = useState(isSelf);

  const personKey = person ? getPersonKey(person) : '';

  useEffect(() => {
    setShowBadgeGoals(false);

    if (!person) {
      setCanRenderAlbum(false);
      return undefined;
    }

    if (isSelf) {
      setCanRenderAlbum(true);
      return undefined;
    }

    let cancelled = false;
    setCanRenderAlbum(false);
    runWhenPageIsCalm(() => {
      if (!cancelled) setCanRenderAlbum(true);
    });

    return () => {
      cancelled = true;
    };
  }, [isSelf, personKey]);

  if (!person) {
    return null;
  }

  const personStats = stats || emptyPersonStats;

  return (
    <div className="rounded-[1.15rem] bg-white p-3 shadow-[inset_0_0_0_1px_rgba(122,86,57,0.08)] sm:p-4">
      <section className="profile-modal-section overflow-hidden rounded-[1rem] border border-white/75 bg-gradient-to-br from-paper via-white to-blush/18 shadow-[0_14px_36px_rgba(84,57,35,0.10)]">
        <div className="grid gap-0 md:grid-cols-[17rem_minmax(0,1fr)]">
          <div className="relative bg-[#fff3df] p-4 text-center">
            <span className="scrapbook-tape left-8 top-2 z-[2] -rotate-6" />
            <div className="mx-auto w-full max-w-[13rem] rotate-[-1.5deg] rounded-[0.55rem] bg-white p-3 pb-7 shadow-paper">
              <div className="aspect-[4/5] overflow-hidden rounded-[0.35rem] bg-paper text-coffee">
                {person.avatarDataUrl ? (
                  <img src={person.avatarDataUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                ) : (
                  <div className="grid h-full place-items-center">
                    <UserRound size={42} />
                  </div>
                )}
              </div>
              <p className="mt-3 truncate font-hand text-2xl font-bold text-coffee">{person.nickname || 'Bạn lớp 9/8'}</p>
            </div>
          </div>

          <div className="min-w-0 p-4 sm:p-5">
            <p className="section-kicker">{isSelf ? 'Hồ sơ của tôi' : 'Hồ sơ lớp 9/8'}</p>
            <h2 className="break-words font-display text-5xl leading-none text-ink sm:text-6xl">{person.name}</h2>
            <p className="mt-2 text-sm font-bold text-coffee/70">Lớp {person.className || '9/8'}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {(person.personalityTags.length ? person.personalityTags : ['9/8', 'memory']).map((tag) => (
                <span key={tag} className="rounded-full bg-blush/30 px-2.5 py-1 text-xs font-bold text-coffee">
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-4 grid gap-3">
              <div className="rounded-[1rem] bg-paper/72 px-4 py-4">
                <p className="text-[11px] font-black uppercase text-coffee/62">Câu nói riêng</p>
                <p className="mt-2 text-sm leading-7 text-ink/72">
                  {person.quote || 'Chưa có câu nói riêng, nhưng thanh xuân vẫn đang ở đây.'}
                </p>
              </div>
              <div className="rounded-[1rem] border border-coffee/8 bg-white/58 px-4 py-4">
                <p className="text-[11px] font-black uppercase text-coffee/62">Lời gửi lớp 9/8</p>
                <p className="mt-2 text-sm leading-7 text-ink/68">
                  {person.classMessage || 'Một lời gửi lớp 9/8 đang chờ được viết.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="profile-modal-section mt-5 overflow-hidden rounded-[1.15rem] border border-white/70 bg-gradient-to-br from-paper via-white to-skySoft/20 p-3 shadow-[0_14px_36px_rgba(84,57,35,0.10)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-black uppercase text-coffee/72">Huy hiệu thanh xuân</h3>
            <p className="mt-1 text-xs leading-5 text-ink/55">
              Huy hiệu tự cập nhật theo ảnh/video, tim, bình luận và mức độ hoàn thiện hồ sơ.
            </p>
          </div>
          <BadgeCheck className="shrink-0 text-coffee/62" size={20} />
        </div>

        {badges.length ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {badges.map((badge) => (
              <YouthBadgePill key={badge.id} badge={badge} />
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-[0.85rem] bg-white/58 px-3 py-3 text-sm font-bold text-ink/62">
            Chưa có huy hiệu nào. Khi bạn này hoàn thiện hồ sơ hoặc đăng thêm kỷ niệm, huy hiệu sẽ xuất hiện ở đây.
          </p>
        )}

        {isSelf && badgeGoals.length > 0 && (
          <>
            <button
              type="button"
              className="secondary-button mt-4 w-full justify-center"
              onClick={() => setShowBadgeGoals((open) => !open)}
            >
              <BadgeCheck size={16} />
              {showBadgeGoals ? 'Ẩn tiến trình mở huy hiệu' : 'Xem tiến trình mở huy hiệu'}
            </button>
            {showBadgeGoals && <BadgeProgressList goals={badgeGoals} />}
          </>
        )}
      </div>

      <div className="profile-modal-section mt-5 grid grid-cols-3 gap-2 text-center">
        <Stat value={personStats.memories.length} label={isSelf ? 'mục' : 'ảnh'} />
        <Stat value={personStats.hearts} label="tim" tone="bg-blush/30" />
        <Stat value={personStats.comments} label="bình luận" tone="bg-skySoft/30" />
      </div>

      <div className="profile-modal-section mt-5">
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

        {!canRenderAlbum ? (
          <div className="grid min-h-36 place-items-center rounded-[0.9rem] bg-paper/72 p-4 text-center">
            <div>
              <div className="memory-loading-spinner mx-auto mb-3 h-9 w-9 rounded-full border-4 border-coffee/15 border-t-coffee" />
              <p className="text-sm font-bold text-ink/62">Đang mở album nhẹ nhàng hơn...</p>
            </div>
          </div>
        ) : isSelf && isOwnMemoriesLoading ? (
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
