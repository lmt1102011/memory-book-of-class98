import { LazyMotion, domAnimation, m, AnimatePresence } from 'framer-motion';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Camera, Home, Menu, Sparkles, X } from 'lucide-react';
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
const PhotobookPage = lazy(() => import('./pages/PhotobookPage'));

const routeFromHash = (): AppRoute => {
  const route = window.location.hash.replace('#/', '') as AppRoute;
  return ['landing', 'join', 'home', 'photobook'].includes(route) ? route : 'landing';
};

const navItems: Array<{ route: AppRoute; label: string; icon: typeof Home }> = [
  { route: 'landing', label: 'Intro', icon: Sparkles },
  { route: 'home', label: 'Memories', icon: Home },
  { route: 'photobook', label: 'Photobook', icon: Camera },
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
    if (route === 'landing') return undefined;

    let unsubscribeMemories: (() => void) | undefined;
    let unsubscribeGuestbook: (() => void) | undefined;
    let unsubscribeLetters: (() => void) | undefined;
    let isActive = true;

    void import('./services/firebaseMemoryBook').then((service) => {
      if (!isActive) return;
      unsubscribeMemories = service.subscribeMemories(
        (items) => {
          setRemoteMemories(items);
          setFirebaseNotice('');
        },
        (error) => setFirebaseNotice(error.message),
      );
      unsubscribeGuestbook = service.subscribeGuestbook(
        (items) => {
          setRemoteGuestbook(items);
          setFirebaseNotice('');
        },
        (error) => setFirebaseNotice(error.message),
      );
      if (profile) {
        unsubscribeLetters = service.subscribeSecretDiaries(
          profile,
          (items) => {
            setSecretDiaries(items);
            setFirebaseNotice('');
          },
          (error) => setFirebaseNotice(error.message),
        );
      } else {
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
      const service = await import('./services/firebaseMemoryBook');
      await service.reactToFirebaseMemory(memory);
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
      await service.addGuestbookEntry(profile, message);
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

    return (
      <Suspense fallback={<LoadingScreen label="Arranging the scrapbook" />}>
        <HomePage
          memories={allMemories}
          guestbook={allGuestbook}
          secretDiaries={secretDiaries}
          firebaseNotice={firebaseNotice}
          profile={profile}
          onJoin={() => navigate('join')}
          onPhotobook={() => navigate('photobook')}
          onReact={handleReact}
          onAddGuestbook={handleGuestbookAdd}
          onAddSecretDiary={handleSecretDiaryAdd}
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

              <div className="hidden items-center gap-2 md:flex">
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
                  Photobook
                </button>
                <button
                  className="icon-button md:hidden"
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
                  className="border-t border-white/50 bg-cream/95 px-4 py-3 shadow-paper md:hidden"
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
