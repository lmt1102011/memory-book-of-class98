import { LazyMotion, domAnimation, m, AnimatePresence } from 'framer-motion';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Camera, Home, Lock, Menu, MessageCircle, Sparkles, X } from 'lucide-react';
import LoadingScreen from './components/LoadingScreen';
import LandingPage from './pages/LandingPage';
import type {
  AppRoute,
  GuestbookEntry,
  MemoryItem,
  PublishMemoryDraft,
  SecretDiaryEntry,
  UserProfile,
} from './types';

const JoinPage = lazy(() => import('./pages/JoinPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const LettersPage = lazy(() => import('./pages/LettersPage'));
const DiaryPage = lazy(() => import('./pages/DiaryPage'));
const PhotobookPage = lazy(() => import('./pages/PhotobookPage'));

const routeFromHash = (): AppRoute => {
  const route = window.location.hash.replace('#/', '') as AppRoute;
  return ['landing', 'join', 'home', 'letters', 'diary', 'photobook'].includes(route) ? route : 'landing';
};

const navItems: Array<{ route: AppRoute; label: string; icon: typeof Home }> = [
  { route: 'landing', label: 'Intro', icon: Sparkles },
  { route: 'home', label: 'Ky uc', icon: Home },
  { route: 'letters', label: 'Thu lop', icon: MessageCircle },
  { route: 'diary', label: 'Nhat ky', icon: Lock },
  { route: 'photobook', label: 'Dang anh', icon: Camera },
];

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => routeFromHash());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [remoteMemories, setRemoteMemories] = useState<MemoryItem[]>([]);
  const [remoteGuestbook, setRemoteGuestbook] = useState<GuestbookEntry[]>([]);
  const [secretDiaries, setSecretDiaries] = useState<SecretDiaryEntry[]>([]);
  const [firebaseNotice, setFirebaseNotice] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onPopState = () => setRoute(routeFromHash());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let stopKeepOnline: (() => void) | undefined;
    let isActive = true;

    void import('./services/firebaseMemoryBook').then((service) => {
      if (!isActive) return;
      stopKeepOnline = service.keepFirebaseOnline();
      unsubscribe = service.observeStudentSession(setProfile);
    });

    return () => {
      isActive = false;
      unsubscribe?.();
      stopKeepOnline?.();
    };
  }, []);

  useEffect(() => {
    if (route === 'landing' || route === 'join') return undefined;

    let unsubscribeMemories: (() => void) | undefined;
    let unsubscribeGuestbook: (() => void) | undefined;
    let unsubscribeLetters: (() => void) | undefined;
    let isActive = true;

    void import('./services/firebaseMemoryBook').then((service) => {
      if (!isActive) return;

      if (route === 'home') {
        unsubscribeMemories = service.subscribeMemories(
          (items) => {
            setRemoteMemories(items);
            setFirebaseNotice('');
          },
          (error) => setFirebaseNotice(error.message),
        );
      }

      if (route === 'letters') {
        unsubscribeGuestbook = service.subscribeGuestbook(
          (items) => {
            setRemoteGuestbook(items);
            setFirebaseNotice('');
          },
          (error) => setFirebaseNotice(error.message),
        );
      }

      if (route === 'diary' && profile) {
        unsubscribeLetters = service.subscribeSecretDiaries(
          profile,
          (items) => {
            setSecretDiaries(items);
            setFirebaseNotice('');
          },
          (error) => setFirebaseNotice(error.message),
        );
      }

      if (route === 'diary' && !profile) {
        setSecretDiaries([]);
      }
    });

    return () => {
      isActive = false;
      unsubscribeMemories?.();
      unsubscribeGuestbook?.();
      unsubscribeLetters?.();
    };
  }, [profile, route]);

  const navigate = useCallback((nextRoute: AppRoute) => {
    setRoute(nextRoute);
    setFirebaseNotice('');
    setMenuOpen(false);
    window.history.pushState(null, '', `#/${nextRoute}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleJoin = useCallback(
    (nextProfile: UserProfile) => {
      setProfile(nextProfile);
      navigate('home');
    },
    [navigate, setProfile],
  );

  const allMemories = useMemo(() => remoteMemories, [remoteMemories]);
  const allGuestbook = useMemo(() => remoteGuestbook, [remoteGuestbook]);

  const publishMemory = useCallback(
    async (draft: PublishMemoryDraft) => {
      if (!profile) {
        navigate('join');
        return;
      }
      const service = await import('./services/firebaseMemoryBook');
      await service.publishMemoryToFirebase(profile, draft);
      navigate('home');
    },
    [navigate, profile],
  );

  const handleReact = useCallback(
    async (memory: MemoryItem) => {
      if (!profile) {
        navigate('join');
        return;
      }
      try {
        const service = await import('./services/firebaseMemoryBook');
        await service.reactToFirebaseMemory(memory);
      } catch (caught) {
        setFirebaseNotice(caught instanceof Error ? caught.message : 'Khong the tha tim luc nay.');
      }
    },
    [navigate, profile],
  );

  const handleMemoryDelete = useCallback(
    async (memory: MemoryItem) => {
      if (!profile) {
        navigate('join');
        return;
      }
      try {
        const service = await import('./services/firebaseMemoryBook');
        await service.deleteFirebaseMemory(profile, memory);
        setRemoteMemories((items) => items.filter((item) => item.id !== memory.id));
        setFirebaseNotice('');
      } catch (caught) {
        setFirebaseNotice(caught instanceof Error ? caught.message : 'Khong the xoa anh luc nay.');
      }
    },
    [navigate, profile],
  );

  const handleGuestbookAdd = useCallback(
    async (message: string) => {
      if (!profile) {
        navigate('join');
        return;
      }
      const service = await import('./services/firebaseMemoryBook');
      const entry = await service.addGuestbookEntry(profile, message);
      setRemoteGuestbook((items) => [entry, ...items]);
    },
    [navigate, profile],
  );

  const handleAnonymousMessageAdd = useCallback(
    async (message: string) => {
      if (!profile) {
        navigate('join');
        return;
      }
      const service = await import('./services/firebaseMemoryBook');
      const entry = await service.addAnonymousMessage(profile, message);
      setRemoteGuestbook((items) => [entry, ...items]);
    },
    [navigate, profile],
  );

  const handleGuestbookDelete = useCallback(
    async (entry: GuestbookEntry) => {
      if (!profile) {
        navigate('join');
        return;
      }
      try {
        const service = await import('./services/firebaseMemoryBook');
        await service.deleteGuestbookEntry(profile, entry);
        setRemoteGuestbook((items) => items.filter((item) => item.id !== entry.id));
        setFirebaseNotice('');
      } catch (caught) {
        setFirebaseNotice(caught instanceof Error ? caught.message : 'Khong the xoa tin nhan luc nay.');
      }
    },
    [navigate, profile],
  );

  const handleSecretDiaryAdd = useCallback(
    async (message: string) => {
      if (!profile) {
        navigate('join');
        return;
      }
      const service = await import('./services/firebaseMemoryBook');
      const diary = await service.addSecretDiary(profile, message);
      setSecretDiaries((items) => [diary, ...items]);
    },
    [navigate, profile],
  );

  const handleSecretDiaryDelete = useCallback(
    async (diary: SecretDiaryEntry) => {
      if (!profile) {
        navigate('join');
        return;
      }
      try {
        const service = await import('./services/firebaseMemoryBook');
        await service.deleteSecretDiary(profile, diary);
        setSecretDiaries((items) => items.filter((item) => item.id !== diary.id));
        setFirebaseNotice('');
      } catch (caught) {
        setFirebaseNotice(caught instanceof Error ? caught.message : 'Khong the xoa nhat ky luc nay.');
      }
    },
    [navigate, profile],
  );

  const renderRoute = () => {
    if (route === 'landing') {
      return <LandingPage onJoin={() => navigate(profile ? 'home' : 'join')} onExplore={() => navigate('home')} />;
    }

    if (route === 'join') {
      return (
        <Suspense fallback={<LoadingScreen label="Opening class check-in" />}>
          <JoinPage profile={profile} onJoin={handleJoin} onSkip={() => navigate('home')} />
        </Suspense>
      );
    }

    if (route === 'photobook') {
      return (
        <Suspense fallback={<LoadingScreen label="Opening the photo booth" />}>
          <PhotobookPage profile={profile} onJoinNeeded={() => navigate('join')} onPublish={publishMemory} />
        </Suspense>
      );
    }

    if (route === 'letters') {
      return (
        <Suspense fallback={<LoadingScreen label="Opening the class board" />}>
          <LettersPage
            guestbook={allGuestbook}
            firebaseNotice={firebaseNotice}
            profile={profile}
            onJoin={() => navigate('join')}
            onAddGuestbook={handleGuestbookAdd}
            onDeleteGuestbook={handleGuestbookDelete}
            onAddAnonymousMessage={handleAnonymousMessageAdd}
          />
        </Suspense>
      );
    }

    if (route === 'diary') {
      return (
        <Suspense fallback={<LoadingScreen label="Opening the private diary" />}>
          <DiaryPage
            diaries={secretDiaries}
            firebaseNotice={firebaseNotice}
            profile={profile}
            onJoin={() => navigate('join')}
            onAddDiary={handleSecretDiaryAdd}
            onDeleteDiary={handleSecretDiaryDelete}
          />
        </Suspense>
      );
    }

    return (
      <Suspense fallback={<LoadingScreen label="Arranging the scrapbook" />}>
        <HomePage
          memories={allMemories}
          firebaseNotice={firebaseNotice}
          profile={profile}
          onJoin={() => navigate('join')}
          onPhotobook={() => navigate('photobook')}
          onReact={handleReact}
          onDeleteMemory={handleMemoryDelete}
        />
      </Suspense>
    );
  };

  return (
    <LazyMotion features={domAnimation}>
      <div className="min-h-screen overflow-x-hidden bg-cream text-ink">
        <div className="fixed inset-0 pointer-events-none bg-paper opacity-80" aria-hidden="true" />
        <div className="film-grain" aria-hidden="true" />

        {route !== 'landing' && (
          <header className="fixed left-0 right-0 top-0 z-40 border-b border-white/40 bg-cream/72 backdrop-blur-xl">
            <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
              <button
                className="flex items-center gap-2 rounded-full px-2 py-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coffee"
                onClick={() => navigate('landing')}
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-paper shadow-paper">
                  <BookOpen size={20} />
                </span>
                <span>
                  <span className="block font-display text-2xl leading-none">Memory Book</span>
                  <span className="block text-[11px] font-semibold uppercase text-coffee/70">
                    {profile ? `${profile.name} - ${profile.className}` : 'School Youth Archive'}
                  </span>
                </span>
              </button>

              <div className="hidden items-center gap-2 lg:flex">
                {navItems.map(({ route: itemRoute, label, icon: Icon }) => (
                  <button
                    key={itemRoute}
                    className={`nav-pill ${route === itemRoute ? 'nav-pill-active' : ''}`}
                    onClick={() => navigate(itemRoute)}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button className="primary-button hidden sm:inline-flex" onClick={() => navigate('photobook')}>
                  <Camera size={17} />
                  Dang anh
                </button>
                <button
                  className="icon-button lg:hidden"
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-label="Open menu"
                >
                  {menuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>
            </nav>

            <AnimatePresence>
              {menuOpen && (
                <m.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.16 }}
                  className="border-t border-white/50 bg-cream/95 px-4 py-3 shadow-paper lg:hidden"
                >
                  <div className="grid gap-2">
                    {navItems.map(({ route: itemRoute, label, icon: Icon }) => (
                      <button
                        key={itemRoute}
                        className={`nav-pill justify-start ${route === itemRoute ? 'nav-pill-active' : ''}`}
                        onClick={() => navigate(itemRoute)}
                      >
                        <Icon size={16} />
                        {label}
                      </button>
                    ))}
                  </div>
                </m.div>
              )}
            </AnimatePresence>
          </header>
        )}

        <main className={route === 'landing' ? '' : 'pt-16'}>
          <AnimatePresence mode="wait">
            <m.div
              key={route}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            >
              {renderRoute()}
            </m.div>
          </AnimatePresence>
        </main>
      </div>
    </LazyMotion>
  );
}
