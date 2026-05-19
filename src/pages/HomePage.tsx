import { useMemo, useState } from 'react';
import { Camera, Filter, Search, X } from 'lucide-react';
import ClassMessageBoard from '../components/ClassMessageBoard';
import MemoryCard from '../components/MemoryCard';
import SecretMailbox from '../components/SecretMailbox';
import { useDebounce } from '../hooks/useDebounce';
import type { GuestbookEntry, MemoryItem, SecretDiaryEntry, UserProfile } from '../types';

interface HomePageProps {
  memories: MemoryItem[];
  guestbook: GuestbookEntry[];
  secretDiaries: SecretDiaryEntry[];
  firebaseNotice: string;
  profile: UserProfile | null;
  onJoin: () => void;
  onPhotobook: () => void;
  onReact: (memory: MemoryItem) => void | Promise<void>;
  onDeleteMemory: (memory: MemoryItem) => void | Promise<void>;
  onAddGuestbook: (message: string) => void | Promise<void>;
  onDeleteGuestbook: (entry: GuestbookEntry) => void | Promise<void>;
  onAddAnonymousMessage: (message: string) => void | Promise<void>;
  onAddSecretDiary: (message: string) => void | Promise<void>;
  onDeleteSecretDiary: (diary: SecretDiaryEntry) => void | Promise<void>;
}

export default function HomePage({
  memories,
  guestbook,
  secretDiaries,
  firebaseNotice,
  profile,
  onJoin,
  onPhotobook,
  onReact,
  onDeleteMemory,
  onAddGuestbook,
  onDeleteGuestbook,
  onAddAnonymousMessage,
  onAddSecretDiary,
  onDeleteSecretDiary,
}: HomePageProps) {
  const [nameQuery, setNameQuery] = useState('');
  const [keywordQuery, setKeywordQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeHomeTab, setActiveHomeTab] = useState<'feed' | 'board'>('feed');

  const debouncedName = useDebounce(nameQuery);
  const debouncedKeyword = useDebounce(keywordQuery);

  const tags = useMemo(() => {
    const unique = new Set<string>();
    memories.forEach((memory) => memory.hashtags.forEach((tag) => unique.add(tag)));
    return Array.from(unique).slice(0, 12);
  }, [memories]);

  const filteredMemories = useMemo(() => {
    const name = debouncedName.trim().toLowerCase();
    const keyword = debouncedKeyword.trim().toLowerCase();

    return memories.filter((memory) => {
      const byName = !name || memory.name.toLowerCase().includes(name);
      const byKeyword =
        !keyword ||
        memory.caption.toLowerCase().includes(keyword) ||
        memory.hashtags.some((tag) => tag.toLowerCase().includes(keyword));
      const byTag = !activeTag || memory.hashtags.includes(activeTag);
      return byName && byKeyword && byTag;
    });
  }, [activeTag, memories, debouncedKeyword, debouncedName]);

  const clearFilters = () => {
    setNameQuery('');
    setKeywordQuery('');
    setActiveTag(null);
  };

  return (
    <div className="relative">
      <section className="mx-auto max-w-7xl px-4 pb-8 pt-9 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p className="section-kicker">Memory Feed</p>
            <h1 className="max-w-4xl font-display text-6xl leading-[0.86] sm:text-8xl">
              A scrapbook for the days we almost missed
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-ink/66 sm:text-base">
              Tim ban trong lop 9/8, tha tim cho ky uc yeu thich, viet thu tren bang lop va dang strip photobooth
              len Firebase de ca lop cung xem.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-[1.5rem] border border-white/60 bg-white/45 p-4 shadow-paper backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <span className="font-hand text-3xl font-bold text-coffee">
                {profile ? `Hi, ${profile.name}` : 'Guest student'}
              </span>
              <button className="primary-button" onClick={onPhotobook}>
                <Camera size={17} />
                Dang anh
              </button>
            </div>
            <p className="text-xs leading-5 text-ink/58">
              Bam Dang anh de chup photobook hoac upload anh co san roi dang len feed cua lop.
            </p>
            {!profile && (
              <button className="secondary-button justify-center" onClick={onJoin}>
                Join class 9/8
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-3 sm:px-6 lg:px-8">
        <div className="flex rounded-full bg-white/50 p-1 shadow-paper backdrop-blur-xl">
          <button
            className={`nav-pill flex-1 justify-center ${activeHomeTab === 'feed' ? 'nav-pill-active' : ''}`}
            onClick={() => setActiveHomeTab('feed')}
          >
            Anh ky uc
          </button>
          <button
            className={`nav-pill flex-1 justify-center ${activeHomeTab === 'board' ? 'nav-pill-active' : ''}`}
            onClick={() => setActiveHomeTab('board')}
          >
            Bang thu lop
          </button>
        </div>
      </section>

      {activeHomeTab === 'feed' ? (
        <>
          <section className="sticky top-16 z-30 border-y border-white/55 bg-cream/75 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="mx-auto grid max-w-7xl gap-3 lg:grid-cols-[1fr_1fr_auto]">
              <label className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-coffee/55" size={17} />
                <input
                  className="input-field pl-11"
                  value={nameQuery}
                  onChange={(event) => setNameQuery(event.target.value)}
                  placeholder="Search by name"
                />
              </label>
              <label className="relative">
                <Filter className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-coffee/55" size={17} />
                <input
                  className="input-field pl-11"
                  value={keywordQuery}
                  onChange={(event) => setKeywordQuery(event.target.value)}
                  placeholder="Tim caption hoac hashtag"
                />
              </label>
              <button className="secondary-button justify-center" onClick={clearFilters}>
                <X size={16} />
                Clear
              </button>
            </div>
            <div className="mx-auto mt-3 flex max-w-7xl gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                className={`tag-button ${activeTag === null ? 'tag-button-active' : ''}`}
                onClick={() => setActiveTag(null)}
              >
                All
              </button>
              {tags.map((tag) => (
                <button
                  key={tag}
                  className={`tag-button ${activeTag === tag ? 'tag-button-active' : ''}`}
                  onClick={() => setActiveTag(tag)}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {filteredMemories.length ? (
              <div className="masonry-feed">
                {filteredMemories.map((memory) => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    onReact={() => void onReact(memory)}
                    canDelete={profile?.uid === memory.uid}
                    onDelete={() => void onDeleteMemory(memory)}
                  />
                ))}
              </div>
            ) : (
              <div className="grid min-h-80 place-items-center rounded-[1.5rem] bg-white/45 p-8 text-center shadow-paper">
                <div>
                  <h2 className="font-display text-5xl">Chua co anh nao</h2>
                  <p className="mt-2 text-sm text-ink/60">
                    Khi ai do dang photobook len database, anh se hien o day.
                  </p>
                  <button className="primary-button mx-auto mt-5" onClick={onPhotobook}>
                    <Camera size={17} />
                    Dang anh dau tien
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      ) : (
        <ClassMessageBoard
          guestbook={guestbook}
          profile={profile}
          onJoin={onJoin}
          onAddGuestbook={onAddGuestbook}
          onDeleteGuestbook={onDeleteGuestbook}
          onAddAnonymousMessage={onAddAnonymousMessage}
        />
      )}

      {firebaseNotice && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="rounded-2xl bg-blush/30 px-4 py-3 text-sm font-semibold text-coffee">
            Firebase: {firebaseNotice}
          </p>
        </div>
      )}

      <SecretMailbox
        diaries={secretDiaries}
        onAddDiary={onAddSecretDiary}
        onDeleteDiary={onDeleteSecretDiary}
        profile={profile}
      />
    </div>
  );
}
