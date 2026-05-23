import { AnimatePresence, LazyMotion, domAnimation, m } from 'framer-motion';
import {
  BadgeCheck,
  Bell,
  Heart,
  Home,
  Image as ImageIcon,
  Lock,
  Menu,
  MessageCircle,
  Sparkles,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AccountLockScreen from './components/AccountLockScreen';
import AppStatusToast from './components/AppStatusToast';
import BootSplash from './components/BootSplash';
import FutureMessagePopup from './components/FutureMessagePopup';
import LoadingScreen from './components/LoadingScreen';
import NotificationCenter from './components/NotificationCenter';
import { useMobilePerformanceMode } from './hooks/useMobilePerformanceMode';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion';
import LandingPage from './pages/LandingPage';
import { isStandaloneMode, shouldSkipIntroOnInstalledLaunch } from './pwaInstallPrompt';
import type {
  AppRoute,
  CinematicSlideshowSettings,
  ClassmateProfile,
  CommentReactionId,
  GuestbookEntry,
  MemoryComment,
  MemoryItem,
  NotificationActivity,
  NotificationItem,
  PublishMemoryDraft,
  RememberNote,
  RememberNoteDraft,
  RememberReactionId,
  SecretDiaryEntry,
  TimeCapsuleEntry,
  TimeCapsuleSettings,
  UserProfile,
  VoteCategory,
  VoteCategoryDraft,
  VoteRecord,
  YouthProfileDraft,
} from './types';

const JoinPage = lazy(() => import('./pages/JoinPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const FutureMessagesPage = lazy(() => import('./pages/FutureMessagesPage'));
const RememberPage = lazy(() => import('./pages/RememberPage'));
const DiaryPage = lazy(() => import('./pages/DiaryPage'));
const PhotobookPage = lazy(() => import('./pages/PhotobookPage'));
const PeoplePage = lazy(() => import('./pages/PeoplePage'));
const VotesPage = lazy(() => import('./pages/VotesPage'));
const MyMemoriesPage = lazy(() => import('./pages/MyMemoriesPage'));

const appRoutes: AppRoute[] = ['landing', 'join', 'home', 'letters', 'future', 'remember', 'diary', 'photobook', 'people', 'votes', 'mine'];
const MENU_HINT_STORAGE_VERSION = 'v4';

const menuHintStorageKey = (uid: string) => `memory98-menu-hint-seen:${MENU_HINT_STORAGE_VERSION}:${uid}`;

type Memory98HistoryState = {
  memory98?: true;
  route?: AppRoute;
  rootAnchor?: boolean;
  rootGuard?: boolean;
};

const isAppRoute = (value: string): value is AppRoute => appRoutes.includes(value as AppRoute);
const routeHash = (nextRoute: AppRoute) => `#/${nextRoute}`;
const makeHistoryState = (nextRoute: AppRoute, extra: Omit<Memory98HistoryState, 'memory98' | 'route'> = {}): Memory98HistoryState => ({
  memory98: true,
  route: nextRoute,
  ...extra,
});

const isRootAnchorState = (state: unknown) => Boolean((state as Memory98HistoryState | null)?.memory98 && (state as Memory98HistoryState | null)?.rootAnchor);

const routeFromHash = (respectBrowserHash = false): AppRoute => {
  const route = window.location.hash.replace('#/', '') as AppRoute;
  const isKnownRoute = isAppRoute(route);
  const skipIntro = shouldSkipIntroOnInstalledLaunch();

  if (!isKnownRoute) return skipIntro ? 'home' : 'landing';
  if (route === 'landing' && skipIntro) return 'home';
  if (!skipIntro && route !== 'landing' && !respectBrowserHash) return 'landing';

  return route;
};

type NavGroupId = 'memories' | 'class' | 'messages' | 'me';

type AccountBlockState = {
  kind: 'disabled';
  name: string;
  reason?: string;
};

type NavMenuItem = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  isActive: boolean;
  onSelect: () => void;
  badgeCount?: number;
};

type NavMenuGroup = {
  id: NavGroupId;
  label: string;
  description: string;
  icon: LucideIcon;
  isActive: boolean;
  items: NavMenuItem[];
  badgeCount?: number;
};

const formatBadgeCount = (count: number) => (count > 9 ? '9+' : String(count));

const rememberReactionLabels: Record<RememberReactionId, string> = {
  'miss-you': 'Nhớ cậu',
  'thank-you': 'Cảm ơn',
  regret: 'Tiếc nuối',
  'good-luck': 'Chúc may mắn',
};

const logoSrc = `${import.meta.env.BASE_URL}logo-web-class-98.svg?v=20260521-logo2`;

const sortCommentsNewestFirst = (comments: MemoryComment[]) =>
  [...comments].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

const makeEmptyCommentReactionCounts = (): Record<CommentReactionId, number> => ({
  haha: 0,
  love: 0,
  miss: 0,
  wow: 0,
  angry: 0,
});

const commentReactionLabels: Record<CommentReactionId, string> = {
  haha: 'Haha',
  love: 'Thương',
  miss: 'Nhớ',
  wow: 'Wow',
  angry: 'Tức giận',
};

const readNotificationIdsKey = (uid: string) => `memory98-notifications-read-ids:${uid}`;

const readStoredNotificationIds = (uid: string) => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(readNotificationIdsKey(uid)) || '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []);
  } catch {
    return new Set<string>();
  }
};

const defaultCinematicSlideshowSettings: CinematicSlideshowSettings = {
  enabled: false,
  mood: 'cinematic',
};

const makeDefaultTimeCapsuleSettings = (): TimeCapsuleSettings => ({ unlockAt: '' });

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => routeFromHash());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [remoteMemories, setRemoteMemories] = useState<MemoryItem[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [remoteComments, setRemoteComments] = useState<MemoryComment[]>([]);
  const [remoteGuestbook, setRemoteGuestbook] = useState<GuestbookEntry[]>([]);
  const [timeCapsules, setTimeCapsules] = useState<TimeCapsuleEntry[]>([]);
  const [classmates, setClassmates] = useState<ClassmateProfile[]>([]);
  const [classmatesLoading, setClassmatesLoading] = useState(false);
  const [voteCategories, setVoteCategories] = useState<VoteCategory[]>([]);
  const [voteRecords, setVoteRecords] = useState<VoteRecord[]>([]);
  const [votesLoading, setVotesLoading] = useState(false);
  const [focusedPersonKey, setFocusedPersonKey] = useState('');
  const [peopleListResetKey, setPeopleListResetKey] = useState(0);
  const [rememberNotes, setRememberNotes] = useState<RememberNote[]>([]);
  const [rememberNotesLoading, setRememberNotesLoading] = useState(false);
  const [sentRememberNotes, setSentRememberNotes] = useState<RememberNote[]>([]);
  const [sentRememberNotesLoading, setSentRememberNotesLoading] = useState(false);
  const [secretDiaries, setSecretDiaries] = useState<SecretDiaryEntry[]>([]);
  const [notificationActivity, setNotificationActivity] = useState<NotificationActivity>({
    ownMemories: [],
    ownMemoryComments: [],
    receivedNotes: [],
    sentNotes: [],
    voteCategories: [],
  });
  const [notificationActivityLoading, setNotificationActivityLoading] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsSeenAt, setNotificationsSeenAt] = useState(() => new Date(0).toISOString());
  const [notificationReadIds, setNotificationReadIds] = useState<Set<string>>(() => new Set());
  const [futureMessagePopupOpen, setFutureMessagePopupOpen] = useState(false);
  const [memoryRecapEnabled, setMemoryRecapEnabled] = useState(false);
  const [classLettersEnabled, setClassLettersEnabled] = useState(false);
  const [writingPromptsEnabled, setWritingPromptsEnabled] = useState(false);
  const [cinematicSlideshowSettings, setCinematicSlideshowSettings] = useState<CinematicSlideshowSettings>(
    defaultCinematicSlideshowSettings,
  );
  const [timeCapsuleSettings, setTimeCapsuleSettings] = useState<TimeCapsuleSettings>(() =>
    makeDefaultTimeCapsuleSettings(),
  );
  const [firebaseNotice, setFirebaseNotice] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuHintVisible, setMenuHintVisible] = useState(false);
  const [accountBlock, setAccountBlock] = useState<AccountBlockState | null>(null);
  const [sessionNotice, setSessionNotice] = useState('');
  const [openNavGroup, setOpenNavGroup] = useState<NavGroupId | null>(null);
  const [bootSplashDone, setBootSplashDone] = useState(false);
  const [routeFeedbackVisible, setRouteFeedbackVisible] = useState(false);
  const [pendingReactionIds, setPendingReactionIds] = useState<string[]>([]);
  const [pendingCommentReactionIds, setPendingCommentReactionIds] = useState<string[]>([]);
  const memoriesLoadedOnceRef = useRef(false);
  const pendingReactionIdsRef = useRef(new Set<string>());
  const pendingCommentReactionIdsRef = useRef(new Set<string>());
  const routeFeedbackTimerRef = useRef(0);
  const notificationPopupTimerRef = useRef(0);
  const menuHintTimerRef = useRef(0);
  const menuHintDismissTimerRef = useRef(0);
  const previousUnreadNotificationCountRef = useRef(0);
  const desktopNavRef = useRef<HTMLDivElement | null>(null);
  const installedBackGuardReadyRef = useRef(false);
  const mobilePerformanceMode = useMobilePerformanceMode();
  const { isOnline, justRestored } = useNetworkStatus();
  const prefersReducedMotion = usePrefersReducedMotion();
  const reduceHeavyMotion = prefersReducedMotion || mobilePerformanceMode;
  const futureUnlockTime = useMemo(() => new Date(timeCapsuleSettings.unlockAt).getTime(), [timeCapsuleSettings.unlockAt]);
  const futureMessagesUnlocked = Number.isFinite(futureUnlockTime) && Date.now() >= futureUnlockTime;
  const futurePopupStorageKey = profile
    ? `memory98-future-popup:${profile.uid}:${timeCapsuleSettings.unlockAt}:${timeCapsules.length}:${timeCapsules[0]?.id || 'none'}`
    : '';

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const nextRoute = routeFromHash(true);

      setFirebaseNotice('');
      setMenuOpen(false);
      setOpenNavGroup(null);
      setNotificationsOpen(false);
      setRoute(nextRoute);

      if (!isStandaloneMode() || !isRootAnchorState(event.state)) return;

      window.setTimeout(() => {
        window.history.pushState(makeHistoryState(nextRoute, { rootGuard: true }), '', routeHash(nextRoute));
      }, 0);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!isStandaloneMode() || installedBackGuardReadyRef.current) return;
    installedBackGuardReadyRef.current = true;

    const currentRoute = routeFromHash(true);
    const currentState = window.history.state as Memory98HistoryState | null;
    if (currentState?.memory98 && currentState.rootGuard) return;

    window.history.replaceState(makeHistoryState(currentRoute, { rootAnchor: true }), '', routeHash(currentRoute));
    window.history.pushState(makeHistoryState(currentRoute, { rootGuard: true }), '', routeHash(currentRoute));
    setRoute(currentRoute);
  }, []);

  useEffect(() => {
    if (route !== 'landing' || !shouldSkipIntroOnInstalledLaunch()) return;

    setRoute('home');
    window.history.replaceState(makeHistoryState('home'), '', routeHash('home'));
  }, [route]);

  useEffect(() => {
    if (route !== 'landing' || shouldSkipIntroOnInstalledLaunch()) return;
    if (window.location.hash === '#/landing') return;

    window.history.replaceState(makeHistoryState('landing'), '', routeHash('landing'));
  }, [route]);

  useEffect(() => {
    if (!bootSplashDone) return undefined;

    const timer = window.setTimeout(() => {
      void import('./pages/HomePage');
      void import('./pages/RememberPage');
      void import('./pages/PeoplePage');
      void import('./pages/VotesPage');
      void import('./pages/FutureMessagesPage');
      void import('./pages/DiaryPage');
      void import('./pages/JoinPage');
      if (!mobilePerformanceMode) void import('./pages/PhotobookPage');
    }, mobilePerformanceMode ? 2200 : 900);

    return () => window.clearTimeout(timer);
  }, [bootSplashDone, mobilePerformanceMode]);

  useEffect(
    () => () => {
      if (routeFeedbackTimerRef.current) window.clearTimeout(routeFeedbackTimerRef.current);
      if (menuHintTimerRef.current) window.clearTimeout(menuHintTimerRef.current);
      if (menuHintDismissTimerRef.current) window.clearTimeout(menuHintDismissTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!openNavGroup || menuOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (desktopNavRef.current?.contains(target)) return;

      setOpenNavGroup(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenNavGroup(null);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen, openNavGroup]);

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
    if (!profile) {
      memoriesLoadedOnceRef.current = false;
      setMenuHintVisible(false);
      setAccountBlock(null);
      setRemoteMemories([]);
      setRemoteComments([]);
      setRemoteGuestbook([]);
      setTimeCapsules([]);
      setClassmates([]);
      setVoteCategories([]);
      setVoteRecords([]);
      setRememberNotes([]);
      setSentRememberNotes([]);
      setSecretDiaries([]);
      pendingCommentReactionIdsRef.current.clear();
      setPendingCommentReactionIds([]);
      setNotificationsSeenAt(new Date(0).toISOString());
      setNotificationReadIds(new Set());
      setNotificationActivity({
        ownMemories: [],
        ownMemoryComments: [],
        receivedNotes: [],
        sentNotes: [],
        voteCategories: [],
      });
      return;
    }

    if (profile.disabled || profile.deleted) {
      setAccountBlock({ kind: 'disabled', name: profile.name, reason: profile.disabledReason });
    } else {
      setAccountBlock(null);
    }

    setNotificationsSeenAt(
      window.localStorage.getItem(`memory98-notifications-seen:${profile.uid}`) || new Date(0).toISOString(),
    );
    setNotificationReadIds(readStoredNotificationIds(profile.uid));
  }, [profile]);

  const dismissMenuHint = useCallback(() => {
    if (menuHintDismissTimerRef.current) {
      window.clearTimeout(menuHintDismissTimerRef.current);
      menuHintDismissTimerRef.current = 0;
    }
    setMenuHintVisible(false);
    if (profile) {
      window.localStorage.setItem(menuHintStorageKey(profile.uid), '1');
    }
  }, [profile]);

  const scheduleMenuHintDismiss = useCallback(() => {
    if (menuHintDismissTimerRef.current) return;
    menuHintDismissTimerRef.current = window.setTimeout(() => {
      menuHintDismissTimerRef.current = 0;
      dismissMenuHint();
    }, 2600);
  }, [dismissMenuHint]);

  useEffect(() => {
    window.clearTimeout(menuHintTimerRef.current);
    window.clearTimeout(menuHintDismissTimerRef.current);
    menuHintDismissTimerRef.current = 0;
    setMenuHintVisible(false);

    if (!profile || accountBlock || !bootSplashDone || route === 'landing' || route === 'join') return undefined;
    if (menuOpen || notificationsOpen || futureMessagePopupOpen) return undefined;
    if (!window.matchMedia('(max-width: 1023px)').matches) return undefined;
    if (window.localStorage.getItem(menuHintStorageKey(profile.uid))) return undefined;

    menuHintTimerRef.current = window.setTimeout(() => {
      setMenuHintVisible(true);
    }, reduceHeavyMotion ? 480 : 900);

    return () => {
      window.clearTimeout(menuHintTimerRef.current);
    };
  }, [
    bootSplashDone,
    accountBlock,
    futureMessagePopupOpen,
    menuOpen,
    notificationsOpen,
    profile,
    reduceHeavyMotion,
    route,
  ]);

  useEffect(() => {
    if (!menuHintVisible) return undefined;

    const onPointerDown = () => scheduleMenuHintDismiss();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismissMenuHint();
      if (event.key === 'Enter' || event.key === ' ') scheduleMenuHintDismiss();
    };

    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('pointerdown', onPointerDown, { capture: true });
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [dismissMenuHint, menuHintVisible, scheduleMenuHintDismiss]);

  useEffect(() => {
    if (!profile || !bootSplashDone) return undefined;

    let unsubscribe: (() => void) | undefined;
    let isActive = true;
    setNotificationActivityLoading(true);

    void import('./services/firebaseMemoryBook')
      .then((service) => {
        if (!isActive) return;

        unsubscribe = service.subscribeNotificationActivity(
          profile,
          (activity) => {
            if (!isActive) return;
            setNotificationActivity(activity);
            setNotificationActivityLoading(false);
          },
          (error) => {
            if (!isActive) return;
            setNotificationActivityLoading(false);
            setFirebaseNotice(error.message);
          },
        );
      })
      .catch((caught) => {
        if (!isActive) return;
        setNotificationActivityLoading(false);
        setFirebaseNotice(caught instanceof Error ? caught.message : 'Không thể mở trung tâm thông báo lúc này.');
      });

    return () => {
      isActive = false;
      unsubscribe?.();
    };
  }, [bootSplashDone, profile?.uid]);

  useEffect(() => {
    if (!sessionNotice) return undefined;
    const timer = window.setTimeout(() => setSessionNotice(''), 5200);
    return () => window.clearTimeout(timer);
  }, [sessionNotice]);

  useEffect(() => {
    if (!bootSplashDone) return undefined;

    let unsubscribeRecap: (() => void) | undefined;
    let unsubscribeClassLetters: (() => void) | undefined;
    let unsubscribeWritingPrompts: (() => void) | undefined;
    let unsubscribeSlideshow: (() => void) | undefined;
    let unsubscribeTimeCapsuleSettings: (() => void) | undefined;
    let isActive = true;

    void import('./services/firebaseMemoryBook')
      .then((service) => {
        if (!isActive) return;
        unsubscribeRecap = service.subscribeMemoryRecapSettings(
          (settings) => {
            if (!isActive) return;
            setMemoryRecapEnabled(settings.enabled);
          },
          () => {
            if (!isActive) return;
            setMemoryRecapEnabled(false);
          },
        );
        unsubscribeSlideshow = service.subscribeCinematicSlideshowSettings(
          (settings) => {
            if (!isActive) return;
            setCinematicSlideshowSettings(settings);
          },
          () => {
            if (!isActive) return;
            setCinematicSlideshowSettings(defaultCinematicSlideshowSettings);
          },
        );
        unsubscribeClassLetters = service.subscribeClassLettersSettings(
          (settings) => {
            if (!isActive) return;
            setClassLettersEnabled(settings.enabled);
          },
          () => {
            if (!isActive) return;
            setClassLettersEnabled(false);
          },
        );
        unsubscribeWritingPrompts = service.subscribeWritingPromptsSettings(
          (settings) => {
            if (!isActive) return;
            setWritingPromptsEnabled(settings.enabled);
          },
          () => {
            if (!isActive) return;
            setWritingPromptsEnabled(false);
          },
        );
        unsubscribeTimeCapsuleSettings = service.subscribeTimeCapsuleSettings(
          (settings) => {
            if (!isActive) return;
            setTimeCapsuleSettings(settings);
          },
          () => {
            if (!isActive) return;
            setTimeCapsuleSettings(makeDefaultTimeCapsuleSettings());
          },
        );
      })
      .catch(() => {
        if (isActive) {
          setMemoryRecapEnabled(false);
          setClassLettersEnabled(false);
          setWritingPromptsEnabled(false);
          setCinematicSlideshowSettings(defaultCinematicSlideshowSettings);
          setTimeCapsuleSettings(makeDefaultTimeCapsuleSettings());
        }
      });

    return () => {
      isActive = false;
      unsubscribeRecap?.();
      unsubscribeClassLetters?.();
      unsubscribeWritingPrompts?.();
      unsubscribeSlideshow?.();
      unsubscribeTimeCapsuleSettings?.();
    };
  }, [bootSplashDone]);

  useEffect(() => {
    if (!bootSplashDone || !profile) {
      setTimeCapsules([]);
      setFutureMessagePopupOpen(false);
      return undefined;
    }

    let unsubscribeTimeCapsules: (() => void) | undefined;
    let isActive = true;

    void import('./services/firebaseMemoryBook')
      .then((service) => {
        if (!isActive) return;
        unsubscribeTimeCapsules = service.subscribeTimeCapsules(
          (items) => {
            if (!isActive) return;
            setTimeCapsules(items);
          },
          (error) => {
            if (!isActive) return;
            setFirebaseNotice(error.message);
          },
        );
      })
      .catch((caught) => {
        if (!isActive) return;
        setFirebaseNotice(caught instanceof Error ? caught.message : 'Không thể tải Gửi cho lớp trong tương lai lúc này.');
      });

    return () => {
      isActive = false;
      unsubscribeTimeCapsules?.();
    };
  }, [bootSplashDone, profile]);

  useEffect(() => {
    if (!bootSplashDone || !profile || !futureMessagesUnlocked || !timeCapsules.length || !futurePopupStorageKey) {
      return undefined;
    }
    if (window.sessionStorage.getItem(futurePopupStorageKey)) return undefined;

    window.sessionStorage.setItem(futurePopupStorageKey, '1');
    const timer = window.setTimeout(() => setFutureMessagePopupOpen(true), mobilePerformanceMode ? 250 : 650);
    return () => window.clearTimeout(timer);
  }, [bootSplashDone, futureMessagesUnlocked, futurePopupStorageKey, mobilePerformanceMode, profile?.uid, timeCapsules.length]);

  useEffect(() => {
    if (route === 'landing' || route === 'join') return undefined;
    if (accountBlock) {
      setMemoriesLoading(false);
      setClassmatesLoading(false);
      setRememberNotesLoading(false);
      setSentRememberNotesLoading(false);
      setVotesLoading(false);
      return undefined;
    }

    let unsubscribeMemories: (() => void) | undefined;
    let unsubscribeComments: (() => void) | undefined;
    let unsubscribeGuestbook: (() => void) | undefined;
    let unsubscribeClassmates: (() => void) | undefined;
    let unsubscribeRememberNotes: (() => void) | undefined;
    let unsubscribeSentRememberNotes: (() => void) | undefined;
    let unsubscribeDiaries: (() => void) | undefined;
    let unsubscribeVoteBoard: (() => void) | undefined;
    let isActive = true;

    if ((route === 'home' || route === 'people') && !profile) {
      memoriesLoadedOnceRef.current = false;
      setMemoriesLoading(false);
      setRemoteMemories([]);
      setRemoteComments([]);
      setRemoteGuestbook([]);
      setFirebaseNotice('');
    }

    if ((route === 'home' || route === 'people') && profile) {
      setMemoriesLoading(!memoriesLoadedOnceRef.current);

      void import('./services/firebaseRealtimeMemoryBook')
        .then((service) => {
          if (!isActive) return;

          unsubscribeMemories = service.subscribeMemoriesRealtime(
            profile,
            (items) => {
              if (!isActive) return;
              memoriesLoadedOnceRef.current = true;
              setRemoteMemories(items);
              setMemoriesLoading(false);
              setFirebaseNotice('');
            },
            (error) => {
              if (!isActive) return;
              memoriesLoadedOnceRef.current = true;
              setMemoriesLoading(false);
              setFirebaseNotice(error.message);
            },
          );

          unsubscribeComments = service.subscribeMemoryCommentsRealtime(
            (items) => {
              if (!isActive) return;
              setRemoteComments(sortCommentsNewestFirst(items));
              setFirebaseNotice('');
            },
            (error) => {
              if (!isActive) return;
              setFirebaseNotice(error.message);
            },
          );
        })
        .catch((caught) => {
          if (!isActive) return;
          memoriesLoadedOnceRef.current = true;
          setMemoriesLoading(false);
          setFirebaseNotice(caught instanceof Error ? caught.message : 'Không thể tải ảnh từ database lúc này.');
        });
    }

    if (route === 'remember' || route === 'people' || route === 'votes' || route === 'photobook') {
      setClassmatesLoading(true);

      void import('./services/firebaseMemoryBook')
        .then((service) => {
          if (!isActive) return;

          unsubscribeClassmates = service.subscribeClassmates(
            (items) => {
              if (!isActive) return;
              setClassmates(items);
              setClassmatesLoading(false);
              setFirebaseNotice('');
            },
            (error) => {
              if (!isActive) return;
              setClassmatesLoading(false);
              setFirebaseNotice(error.message);
            },
          );
        })
        .catch((caught) => {
          if (!isActive) return;
          setClassmatesLoading(false);
          setFirebaseNotice(caught instanceof Error ? caught.message : 'Không thể mở danh sách lớp lúc này.');
        });
    }

    if (route === 'remember') {
      setRememberNotesLoading(Boolean(profile));
      setSentRememberNotesLoading(Boolean(profile));

      void import('./services/firebaseMemoryBook')
        .then((service) => {
          if (!isActive) return;

          if (profile) {
            unsubscribeRememberNotes = service.subscribeRememberNotes(
              profile,
              (items) => {
                if (!isActive) return;
                setRememberNotes(items);
                setRememberNotesLoading(false);
                setFirebaseNotice('');
              },
              (error) => {
                if (!isActive) return;
                setRememberNotesLoading(false);
                setFirebaseNotice(error.message);
              },
            );

            unsubscribeSentRememberNotes = service.subscribeSentRememberNotes(
              profile,
              (items) => {
                if (!isActive) return;
                setSentRememberNotes(items);
                setSentRememberNotesLoading(false);
                setFirebaseNotice('');
              },
              (error) => {
                if (!isActive) return;
                setSentRememberNotesLoading(false);
                setFirebaseNotice(error.message);
              },
            );
          } else {
            setRememberNotes([]);
            setSentRememberNotes([]);
            setRememberNotesLoading(false);
            setSentRememberNotesLoading(false);
          }
        })
        .catch((caught) => {
          if (!isActive) return;
          setRememberNotesLoading(false);
          setSentRememberNotesLoading(false);
          setFirebaseNotice(caught instanceof Error ? caught.message : 'Không thể mở Secret Message lúc này.');
        });
    }

    const shouldLoadGuestbook = Boolean(profile) && (route === 'letters' || (route === 'home' && classLettersEnabled));
    if (!shouldLoadGuestbook) {
      setRemoteGuestbook([]);
    }

    if (shouldLoadGuestbook || route === 'diary') {
      void import('./services/firebaseMemoryBook').then((service) => {
        if (!isActive) return;

        if (shouldLoadGuestbook) {
          unsubscribeGuestbook = service.subscribeGuestbook(
            (items) => {
              setRemoteGuestbook(items);
              setFirebaseNotice('');
            },
            (error) => setFirebaseNotice(error.message),
          );
        }

        if (route === 'diary' && profile) {
          unsubscribeDiaries = service.subscribeSecretDiaries(
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
    }

    if (route === 'votes') {
      setVotesLoading(true);

      void import('./services/firebaseMemoryBook')
        .then((service) => {
          if (!isActive) return;

          unsubscribeVoteBoard = service.subscribeVoteBoard(
            ({ categories, votes }) => {
              if (!isActive) return;
              setVoteCategories(categories);
              setVoteRecords(votes);
              setVotesLoading(false);
              setFirebaseNotice('');
            },
            (error) => {
              if (!isActive) return;
              setVotesLoading(false);
              setFirebaseNotice(error.message);
            },
          );
        })
        .catch((caught) => {
          if (!isActive) return;
          setVotesLoading(false);
          setFirebaseNotice(caught instanceof Error ? caught.message : 'Không thể mở bảng bình chọn lúc này.');
        });
    }

    return () => {
      isActive = false;
      unsubscribeMemories?.();
      unsubscribeComments?.();
      unsubscribeGuestbook?.();
      unsubscribeClassmates?.();
      unsubscribeRememberNotes?.();
      unsubscribeSentRememberNotes?.();
      unsubscribeDiaries?.();
      unsubscribeVoteBoard?.();
    };
  }, [accountBlock, classLettersEnabled, profile, route]);

  const navigate = useCallback(
    (nextRoute: AppRoute) => {
      const scrollBehavior: ScrollBehavior = reduceHeavyMotion ? 'auto' : 'smooth';

      setFirebaseNotice('');
      setMenuOpen(false);
      setOpenNavGroup(null);
      window.scrollTo({ top: 0, behavior: scrollBehavior });

      if (nextRoute === route) return;

      setRouteFeedbackVisible(true);
      if (routeFeedbackTimerRef.current) window.clearTimeout(routeFeedbackTimerRef.current);
      routeFeedbackTimerRef.current = window.setTimeout(
        () => {
          routeFeedbackTimerRef.current = 0;
          setRouteFeedbackVisible(false);
        },
        reduceHeavyMotion ? 180 : 520,
      );

      setRoute(nextRoute);
      window.history.pushState(makeHistoryState(nextRoute), '', routeHash(nextRoute));
    },
    [reduceHeavyMotion, route],
  );

  useEffect(() => {
    if (route === 'letters') navigate('home');
  }, [navigate, route]);

  const resetAuthenticatedState = useCallback(() => {
    memoriesLoadedOnceRef.current = false;
    setRemoteMemories([]);
    setRemoteComments([]);
    setRemoteGuestbook([]);
    setTimeCapsules([]);
    setClassmates([]);
    setVoteCategories([]);
    setVoteRecords([]);
    setRememberNotes([]);
    setSentRememberNotes([]);
    setSecretDiaries([]);
    setNotificationActivity({
      ownMemories: [],
      ownMemoryComments: [],
      receivedNotes: [],
      sentNotes: [],
      voteCategories: [],
    });
    setNotificationReadIds(new Set());
  }, []);

  const signOutToJoin = useCallback(
    (notice?: string) => {
      setMenuOpen(false);
      setOpenNavGroup(null);
      setNotificationsOpen(false);
      setFutureMessagePopupOpen(false);
      setAccountBlock(null);
      resetAuthenticatedState();
      setSessionNotice(notice || '');
      setProfile(null);
      navigate('join');

      void import('./services/firebaseMemoryBook')
        .then((service) => service.logoutStudent())
        .catch(() => undefined);
    },
    [navigate, resetAuthenticatedState],
  );

  useEffect(() => {
    if (!profile?.uid || !profile.nameKey) return undefined;

    let unsubscribe: (() => void) | undefined;
    let isActive = true;

    void import('./services/firebaseRealtimeMemoryBook')
      .then((service) => {
        if (!isActive) return;

        unsubscribe = service.subscribeStudentAccountRealtime(
          profile,
          (status) => {
            if (!isActive) return;

            if (status.state === 'deleted') {
              signOutToJoin('Tài khoản của bạn đã bị manager xóa khỏi database lớp 9/8.');
              return;
            }

            if (status.state === 'disabled') {
              setMenuOpen(false);
              setOpenNavGroup(null);
              setNotificationsOpen(false);
              setFutureMessagePopupOpen(false);
              setAccountBlock({ kind: 'disabled', name: status.profile.name, reason: status.profile.disabledReason });
              setProfile((current) => {
                if (!current || current.uid !== status.profile.uid) return current;
                return {
                  ...current,
                  name: status.profile.name,
                  nameKey: status.profile.nameKey,
                  className: status.profile.className,
                  joinedAt: status.profile.joinedAt,
                  disabled: true,
                  disabledReason: status.profile.disabledReason,
                  deleted: false,
                };
              });
              return;
            }

            setAccountBlock(null);
            setProfile((current) => {
              if (!current || current.uid !== status.profile.uid) return current;
              if (
                current.name === status.profile.name &&
                current.nameKey === status.profile.nameKey &&
                current.className === status.profile.className &&
                current.joinedAt === status.profile.joinedAt &&
                current.disabledReason === status.profile.disabledReason &&
                !current.disabled &&
                !current.deleted
              ) {
                return current;
              }

              return {
                ...current,
                name: status.profile.name,
                nameKey: status.profile.nameKey,
                className: status.profile.className,
                joinedAt: status.profile.joinedAt,
                disabled: false,
                disabledReason: '',
                deleted: false,
              };
            });
          },
          (error) => {
            if (!isActive) return;
            setFirebaseNotice(error.message);
          },
        );
      })
      .catch((caught) => {
        if (!isActive) return;
        setFirebaseNotice(caught instanceof Error ? caught.message : 'Không thể theo dõi trạng thái tài khoản lúc này.');
      });

    return () => {
      isActive = false;
      unsubscribe?.();
    };
  }, [profile?.uid, profile?.nameKey, signOutToJoin]);

  const handleBootSplashComplete = useCallback(() => {
    setBootSplashDone(true);
  }, []);

  const handleJoin = useCallback(
    (nextProfile: UserProfile) => {
      setProfile(nextProfile);
      navigate('home');
    },
    [navigate],
  );

  const openPersonProfile = useCallback(
    (nameKey: string) => {
      setFocusedPersonKey(nameKey);
      navigate('people');
    },
    [navigate],
  );

  const openPeopleList = useCallback(() => {
    setFocusedPersonKey('');
    setPeopleListResetKey((key) => key + 1);
    navigate('people');
  }, [navigate]);

  const allMemories = useMemo(() => remoteMemories, [remoteMemories]);
  const allGuestbook = useMemo(() => remoteGuestbook, [remoteGuestbook]);

  const commentsByMemory = useMemo(() => {
    const grouped: Record<string, MemoryComment[]> = {};
    remoteComments.forEach((comment) => {
      if (!grouped[comment.memoryId]) grouped[comment.memoryId] = [];
      grouped[comment.memoryId].push(comment);
    });
    return grouped;
  }, [remoteComments]);

  const ownCommentsByMemory = useMemo(() => {
    const grouped: Record<string, MemoryComment[]> = {};
    notificationActivity.ownMemoryComments.forEach((comment) => {
      if (!grouped[comment.memoryId]) grouped[comment.memoryId] = [];
      grouped[comment.memoryId].push(comment);
    });
    return grouped;
  }, [notificationActivity.ownMemoryComments]);

  const notificationItems = useMemo<NotificationItem[]>(() => {
    if (!profile) return [];

    const seenAt = new Date(notificationsSeenAt).getTime();
    const makeUnread = (id: string, createdAt: string) =>
      new Date(createdAt).getTime() > seenAt && !notificationReadIds.has(id);
    const items: NotificationItem[] = [];

    notificationActivity.receivedNotes
      .filter((note) => note.fromUid !== profile.uid)
      .slice(0, 24)
      .forEach((note) => {
        const id = `message-${note.id}`;
        items.push({
          id,
          kind: 'message',
          route: 'remember',
          title: note.anonymous ? 'Secret Message mới' : `${note.fromName} gửi Secret Message`,
          body: note.message,
          createdAt: note.createdAt,
          unread: makeUnread(id, note.createdAt),
          accent: 'pink',
        });
      });

    notificationActivity.sentNotes
      .filter((note) => note.reactionId && note.reactedAt)
      .slice(0, 24)
      .forEach((note) => {
        const createdAt = note.reactedAt || note.createdAt;
        const id = `reaction-${note.id}-${note.reactionId}`;
        items.push({
          id,
          kind: 'reaction',
          route: 'remember',
          title: `${note.toName} đã phản hồi`,
          body: `Người nhận đã thả: ${note.reactionLabel || rememberReactionLabels[note.reactionId!]}`,
          createdAt,
          unread: makeUnread(id, createdAt),
          accent: 'blue',
        });
      });

    const ownMemoryById = new Map(notificationActivity.ownMemories.map((memory) => [memory.id, memory]));
    notificationActivity.ownMemoryComments
      .filter((comment) => comment.uid !== profile.uid)
      .slice(0, 32)
      .forEach((comment) => {
        const memory = ownMemoryById.get(comment.memoryId);
        const id = `comment-${comment.id}`;
        items.push({
          id,
          kind: 'comment',
          route: 'mine',
          title: `${comment.name} bình luận`,
          body: memory?.caption ? `${comment.message} · ${memory.caption}` : comment.message,
          createdAt: comment.createdAt,
          unread: makeUnread(id, comment.createdAt),
          accent: 'cream',
        });
      });

    notificationActivity.ownMemoryComments
      .filter((comment) => comment.uid === profile.uid && !comment.pending)
      .slice(0, 48)
      .forEach((comment) => {
        const reactionsByUid = Object.entries(comment.reactionByUid || {}).filter(([uid]) => uid !== profile.uid);
        if (!reactionsByUid.length) return;

        const reactionIds = Array.from(new Set(reactionsByUid.map(([, reactionId]) => reactionId))).sort();
        const reactionText = reactionIds.map((reactionId) => commentReactionLabels[reactionId]).filter(Boolean).join(', ');
        const createdAt = comment.updatedAt || comment.createdAt;
        const id = `comment-reaction-${comment.id}-${reactionsByUid.length}-${reactionIds.join('-')}`;
        const shortMessage = comment.message.length > 86 ? `${comment.message.slice(0, 86)}...` : comment.message;
        items.push({
          id,
          kind: 'commentReaction',
          route: 'home',
          title: `${reactionsByUid.length} cảm xúc trên bình luận của bạn`,
          body: reactionText ? `${reactionText} · "${shortMessage}"` : shortMessage,
          createdAt,
          unread: makeUnread(id, createdAt),
          accent: 'blue',
        });
      });

    notificationActivity.ownMemories
      .filter((memory) => memory.likedBy.some((uid) => uid !== profile.uid))
      .slice(0, 28)
      .forEach((memory) => {
        const otherLikes = memory.likedBy.filter((uid) => uid !== profile.uid).length;
        const createdAt = memory.updatedAt || memory.createdAt;
        const id = `like-${memory.storageCollection || 'memories98'}-${memory.id}-${otherLikes}`;
        items.push({
          id,
          kind: 'like',
          route: 'mine',
          title: `${otherLikes} tim mới trên ${memory.mediaType === 'video' ? 'video' : 'ảnh'} của bạn`,
          body: memory.caption || 'Một kỷ niệm của bạn vừa được lớp tương tác.',
          createdAt,
          unread: makeUnread(id, createdAt),
          accent: 'pink',
        });
      });

    notificationActivity.voteCategories
      .filter((category) => category.uid !== profile.uid)
      .slice(0, 16)
      .forEach((category) => {
        const id = `vote-${category.id}`;
        items.push({
          id,
          kind: 'vote',
          route: 'votes',
          title: 'Có hạng mục bình chọn mới',
          body: category.title,
          createdAt: category.createdAt,
          unread: makeUnread(id, category.createdAt),
          accent: 'chalk',
        });
      });

    return items
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 60);
  }, [notificationActivity, notificationReadIds, notificationsSeenAt, profile]);

  const unreadNotificationCount = useMemo(
    () => notificationItems.filter((item) => item.unread).length,
    [notificationItems],
  );
  const unreadNotificationItems = useMemo(
    () => notificationItems.filter((item) => item.unread),
    [notificationItems],
  );

  useEffect(() => {
    const badgeNavigator = navigator as Navigator & {
      setAppBadge?: (contents?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };

    if (!badgeNavigator.setAppBadge || !badgeNavigator.clearAppBadge) return;

    if (unreadNotificationCount > 0) {
      void badgeNavigator.setAppBadge(unreadNotificationCount).catch(() => undefined);
      return;
    }

    void badgeNavigator.clearAppBadge().catch(() => undefined);
  }, [unreadNotificationCount]);

  useEffect(() => {
    if (!bootSplashDone || !profile || notificationsOpen || notificationActivityLoading) return undefined;
    if (route === 'landing' || route === 'join') return undefined;

    const latestUnread = unreadNotificationItems[0];
    if (!latestUnread || unreadNotificationCount === 0) {
      previousUnreadNotificationCountRef.current = 0;
      return undefined;
    }

    const previousUnreadCount = previousUnreadNotificationCountRef.current;
    previousUnreadNotificationCountRef.current = unreadNotificationCount;
    if (previousUnreadCount !== 0 && unreadNotificationCount <= previousUnreadCount) return undefined;

    const popupKey = `memory98-notification-popup:${profile.uid}:${latestUnread.id}`;
    if (window.sessionStorage.getItem(popupKey)) return undefined;
    window.sessionStorage.setItem(popupKey, '1');

    notificationPopupTimerRef.current = window.setTimeout(() => {
      setNotificationsOpen(true);
    }, reduceHeavyMotion ? 220 : 520);

    return () => {
      window.clearTimeout(notificationPopupTimerRef.current);
    };
  }, [
    bootSplashDone,
    notificationActivityLoading,
    notificationsOpen,
    profile,
    reduceHeavyMotion,
    route,
    unreadNotificationCount,
    unreadNotificationItems,
  ]);

  const markNotificationsRead = useCallback(() => {
    if (!profile) return;
    const now = new Date().toISOString();
    window.localStorage.setItem(`memory98-notifications-seen:${profile.uid}`, now);
    window.localStorage.removeItem(readNotificationIdsKey(profile.uid));
    setNotificationsSeenAt(now);
    setNotificationReadIds(new Set());
    previousUnreadNotificationCountRef.current = 0;
  }, [profile]);

  const markNotificationRead = useCallback(
    (item: NotificationItem) => {
      if (!profile) return;
      setNotificationReadIds((current) => {
        if (current.has(item.id)) return current;
        const next = new Set(current);
        next.add(item.id);
        const stored = Array.from(next).slice(-240);
        window.localStorage.setItem(readNotificationIdsKey(profile.uid), JSON.stringify(stored));
        return new Set(stored);
      });
    },
    [profile],
  );

  const handleOpenNotification = useCallback(
    (item: NotificationItem) => {
      markNotificationRead(item);
      setNotificationsOpen(false);
      if (item.route === 'mine' && profile) {
        setFocusedPersonKey(profile.nameKey);
        navigate('people');
        return;
      }
      navigate(item.route);
    },
    [markNotificationRead, navigate, profile],
  );

  const navBadgeCount = useCallback(
    (itemRoute: AppRoute) => {
      if (itemRoute === 'remember') {
        return notificationItems.filter((item) => item.unread && (item.kind === 'message' || item.kind === 'reaction')).length;
      }

      if (itemRoute === 'people' || itemRoute === 'mine') {
        return notificationItems.filter(
          (item) => item.unread && (item.kind === 'comment' || item.kind === 'commentReaction' || item.kind === 'like'),
        ).length;
      }

      if (itemRoute === 'votes') {
        return notificationItems.filter((item) => item.unread && item.kind === 'vote').length;
      }

      return 0;
    },
    [notificationItems],
  );

  const navigationGroups = useMemo<NavMenuGroup[]>(() => {
    const ownActivityCount = navBadgeCount('mine');
    const messageCount = navBadgeCount('remember');
    const voteCount = navBadgeCount('votes');
    const activityCount = unreadNotificationCount;
    const isOwnProfileOpen = Boolean(profile && route === 'people' && focusedPersonKey === profile.nameKey);
    return [
      {
        id: 'memories',
        label: 'Ký ức',
        description: 'Ảnh, video và album của lớp',
        icon: Home,
        isActive: route === 'home' || route === 'photobook' || route === 'mine',
        badgeCount: ownActivityCount,
        items: [
          {
            id: 'home',
            label: 'Ký ức lớp',
            description: 'Xem ảnh/video mới nhất của lớp 9/8.',
            icon: ImageIcon,
            isActive: route === 'home',
            onSelect: () => navigate('home'),
          },
          {
            id: 'mine',
            label: 'Ảnh/video của tôi',
            description: 'Quản lý những kỷ niệm mình đã đăng.',
            icon: UserRound,
            isActive: route === 'mine',
            badgeCount: ownActivityCount,
            onSelect: () => navigate('mine'),
          },
        ],
      },
      {
        id: 'class',
        label: 'Lớp 9/8',
        description: 'Hồ sơ, album và bình chọn lớp',
        icon: Users,
        isActive: (route === 'people' && !isOwnProfileOpen) || route === 'votes',
        badgeCount: voteCount,
        items: [
          {
            id: 'people',
            label: 'Hồ sơ lớp',
            description: 'Tìm bạn bè, xem hồ sơ và album riêng.',
            icon: Users,
            isActive: route === 'people' && !isOwnProfileOpen,
            onSelect: openPeopleList,
          },
          {
            id: 'votes',
            label: 'Bình chọn',
            description: 'Tạo danh hiệu vui và vote cho bạn trong lớp.',
            icon: BadgeCheck,
            isActive: route === 'votes',
            badgeCount: voteCount,
            onSelect: () => navigate('votes'),
          },
        ],
      },
      {
        id: 'messages',
        label: 'Lời nhắn',
        description: 'Secret Message, nhật ký và lời nhắn tương lai',
        icon: MessageCircle,
        isActive: route === 'future' || route === 'remember' || route === 'diary',
        badgeCount: messageCount,
        items: [
          {
            id: 'future',
            label: 'Gửi cho lớp trong tương lai',
            description: 'Viết lời nhắn để cả lớp mở lại sau này.',
            icon: Sparkles,
            isActive: route === 'future',
            onSelect: () => navigate('future'),
          },
          {
            id: 'remember',
            label: 'Secret Message',
            description: 'Gửi điều chưa kịp nói cho một người trong lớp.',
            icon: Heart,
            isActive: route === 'remember',
            badgeCount: messageCount,
            onSelect: () => navigate('remember'),
          },
          {
            id: 'diary',
            label: 'Nhật ký riêng',
            description: 'Lưu những tiếc nuối chỉ mình bạn thấy.',
            icon: Lock,
            isActive: route === 'diary',
            onSelect: () => navigate('diary'),
          },
        ],
      },
      {
        id: 'me',
        label: 'Tôi',
        description: profile ? `${profile.name} - ${profile.className}` : 'Tài khoản cá nhân',
        icon: UserRound,
        isActive: route === 'join' || notificationsOpen,
        badgeCount: activityCount,
        items: [
          {
            id: 'activity',
            label: 'Hoạt động của tôi',
            description: 'Xem gọn tin nhắn, tim, bình luận và bình chọn mới.',
            icon: Bell,
            isActive: notificationsOpen,
            badgeCount: activityCount,
            onSelect: () => {
              setMenuOpen(false);
              setOpenNavGroup(null);
              setNotificationsOpen(true);
            },
          },
          {
            id: 'account',
            label: 'Tài khoản',
            description: profile ? 'Đổi người dùng bằng màn hình check-in.' : 'Nhập tên để tạo hoặc mở tài khoản.',
            icon: Lock,
            isActive: route === 'join',
            onSelect: () => navigate('join'),
          },
        ],
      },
    ];
  }, [
    focusedPersonKey,
    navBadgeCount,
    navigate,
    notificationsOpen,
    openPeopleList,
    profile,
    route,
    unreadNotificationCount,
  ]);

  const handleYouthProfileUpdate = useCallback(
    async (draft: YouthProfileDraft) => {
      if (!profile) {
        navigate('join');
        return;
      }

      const service = await import('./services/firebaseMemoryBook');
      await service.updateStudentYouthProfile(profile, draft);
      setClassmates((items) =>
        items.map((item) =>
          item.nameKey === profile.nameKey
            ? {
                ...item,
                avatarDataUrl: draft.avatarDataUrl,
                nickname: draft.nickname,
                quote: draft.quote,
                classMessage: draft.classMessage,
                personalityTags: draft.personalityTags,
                profileUpdatedAt: new Date().toISOString(),
              }
            : item,
        ),
      );
      setFirebaseNotice('');
    },
    [navigate, profile],
  );

  const handleVoteCategoryAdd = useCallback(
    async (draft: VoteCategoryDraft) => {
      if (!profile) {
        navigate('join');
        return;
      }

      const service = await import('./services/firebaseMemoryBook');
      const category = await service.addVoteCategory(profile, draft);
      setVoteCategories((items) => [category, ...items.filter((item) => item.id !== category.id)]);
      setNotificationActivity((activity) => ({
        ...activity,
        voteCategories: [category, ...activity.voteCategories.filter((item) => item.id !== category.id)],
      }));
      setFirebaseNotice('');
    },
    [navigate, profile],
  );

  const handleVoteCategoryHide = useCallback(
    async (category: VoteCategory) => {
      if (!profile) {
        navigate('join');
        return;
      }

      setVoteCategories((items) => items.filter((item) => item.id !== category.id));
      setNotificationActivity((activity) => ({
        ...activity,
        voteCategories: activity.voteCategories.filter((item) => item.id !== category.id),
      }));

      try {
        const service = await import('./services/firebaseMemoryBook');
        await service.hideVoteCategory(profile, category);
        setFirebaseNotice('');
      } catch (caught) {
        setVoteCategories((items) => [category, ...items.filter((item) => item.id !== category.id)]);
        setNotificationActivity((activity) => ({
          ...activity,
          voteCategories: [category, ...activity.voteCategories.filter((item) => item.id !== category.id)],
        }));
        setFirebaseNotice(caught instanceof Error ? caught.message : 'Không thể ẩn hạng mục bình chọn lúc này.');
      }
    },
    [navigate, profile],
  );

  const handleVoteCast = useCallback(
    async (category: VoteCategory, target: ClassmateProfile) => {
      if (!profile) {
        navigate('join');
        return;
      }

      const previous = voteRecords.find((vote) => vote.categoryId === category.id && vote.voterUid === profile.uid);
      const optimisticVote: VoteRecord = {
        id: profile.uid,
        categoryId: category.id,
        voterUid: profile.uid,
        voterName: profile.name,
        voterNameKey: profile.nameKey,
        targetUid: target.uid,
        targetName: target.name,
        targetNameKey: target.nameKey,
        createdAt: previous?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setVoteRecords((items) => [
        optimisticVote,
        ...items.filter((item) => !(item.categoryId === category.id && item.voterUid === profile.uid)),
      ]);

      try {
        const service = await import('./services/firebaseMemoryBook');
        const savedVote = await service.castVote(profile, category, target);
        setVoteRecords((items) =>
          items.map((item) =>
            item.categoryId === category.id && item.voterUid === profile.uid ? savedVote : item,
          ),
        );
        setFirebaseNotice('');
      } catch (caught) {
        setVoteRecords((items) => {
          const withoutOptimistic = items.filter((item) => !(item.categoryId === category.id && item.voterUid === profile.uid));
          return previous ? [previous, ...withoutOptimistic] : withoutOptimistic;
        });
        setFirebaseNotice(caught instanceof Error ? caught.message : 'Không thể lưu bình chọn lúc này.');
      }
    },
    [navigate, profile, voteRecords],
  );

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

      if (memory.likedBy.includes(profile.uid) || pendingReactionIdsRef.current.has(memory.id)) return;

      pendingReactionIdsRef.current.add(memory.id);
      setPendingReactionIds(Array.from(pendingReactionIdsRef.current));

      setRemoteMemories((items) =>
        items.map((item) => {
          if (item.id !== memory.id || item.likedBy.includes(profile.uid)) return item;
          return {
            ...item,
            reactions: item.reactions + 1,
            likedBy: [...item.likedBy, profile.uid],
            updatedAt: new Date().toISOString(),
          };
        }),
      );
      setNotificationActivity((activity) => ({
        ...activity,
        ownMemories: activity.ownMemories.map((item) => {
          if (item.id !== memory.id || item.likedBy.includes(profile.uid)) return item;
          return {
            ...item,
            reactions: item.reactions + 1,
            likedBy: [...item.likedBy, profile.uid],
            updatedAt: new Date().toISOString(),
          };
        }),
      }));

      try {
        const service = await import('./services/firebaseMemoryBook');
        await service.reactToFirebaseMemory(profile, memory);
        setFirebaseNotice('');
      } catch (caught) {
        setRemoteMemories((items) =>
          items.map((item) => {
            if (item.id !== memory.id || !item.likedBy.includes(profile.uid)) return item;
            return {
              ...item,
              reactions: Math.max(0, item.reactions - 1),
              likedBy: item.likedBy.filter((uid) => uid !== profile.uid),
            };
          }),
        );
        setNotificationActivity((activity) => ({
          ...activity,
          ownMemories: activity.ownMemories.map((item) => {
            if (item.id !== memory.id || !item.likedBy.includes(profile.uid)) return item;
            return {
              ...item,
              reactions: Math.max(0, item.reactions - 1),
              likedBy: item.likedBy.filter((uid) => uid !== profile.uid),
            };
          }),
        }));
        setFirebaseNotice(caught instanceof Error ? caught.message : 'Không thể thả tim lúc này.');
      } finally {
        pendingReactionIdsRef.current.delete(memory.id);
        setPendingReactionIds(Array.from(pendingReactionIdsRef.current));
      }
    },
    [navigate, profile],
  );

  const handleMemoryDownload = useCallback(
    async (memory: MemoryItem) => {
      if (!profile) {
        navigate('join');
        return;
      }

      try {
        const service = await import('./services/firebaseMemoryBook');
        await service.logMemoryDownload(profile, memory);
      } catch {
        // The browser download should still work if the manager log cannot be saved.
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
        setRemoteComments((items) => items.filter((item) => item.memoryId !== memory.id));
        setNotificationActivity((activity) => ({
          ...activity,
          ownMemories: activity.ownMemories.filter((item) => item.id !== memory.id),
          ownMemoryComments: activity.ownMemoryComments.filter((item) => item.memoryId !== memory.id),
        }));
        setFirebaseNotice('');
      } catch (caught) {
        setFirebaseNotice(caught instanceof Error ? caught.message : 'Không thể xóa ảnh lúc này.');
      }
    },
    [navigate, profile],
  );

  const handleMemoryCommentAdd = useCallback(
    async (memory: MemoryItem, message: string) => {
      if (!profile) {
        navigate('join');
        return;
      }

      const safeMessage = message.trim().slice(0, 240);
      if (!safeMessage) return;

      const tempComment: MemoryComment = {
        id: `pending-${memory.id}-${Date.now()}`,
        memoryId: memory.id,
        memoryUid: memory.uid,
        uid: profile.uid,
        name: profile.name,
        nameKey: profile.nameKey,
        message: safeMessage,
        createdAt: new Date().toISOString(),
        reactionCounts: makeEmptyCommentReactionCounts(),
        reactionByUid: {},
        pending: true,
      };

      setRemoteComments((items) => sortCommentsNewestFirst([tempComment, ...items]));
      if (memory.uid === profile.uid) {
        setNotificationActivity((activity) => ({
          ...activity,
          ownMemoryComments: sortCommentsNewestFirst([tempComment, ...activity.ownMemoryComments]),
        }));
      }

      try {
        const service = await import('./services/firebaseMemoryBook');
        const savedComment = await service.addMemoryComment(profile, memory, safeMessage);
        setRemoteComments((items) =>
          sortCommentsNewestFirst(items.map((item) => (item.id === tempComment.id ? savedComment : item))),
        );
        if (memory.uid === profile.uid) {
          setNotificationActivity((activity) => ({
            ...activity,
            ownMemoryComments: sortCommentsNewestFirst(
              activity.ownMemoryComments.map((item) => (item.id === tempComment.id ? savedComment : item)),
            ),
          }));
        }
        setFirebaseNotice('');
      } catch (caught) {
        setRemoteComments((items) => items.filter((item) => item.id !== tempComment.id));
        setNotificationActivity((activity) => ({
          ...activity,
          ownMemoryComments: activity.ownMemoryComments.filter((item) => item.id !== tempComment.id),
        }));
        setFirebaseNotice(caught instanceof Error ? caught.message : 'Không thể gửi bình luận lúc này.');
      }
    },
    [navigate, profile],
  );

  const handleMemoryCommentDelete = useCallback(
    async (comment: MemoryComment) => {
      if (!profile) {
        navigate('join');
        return;
      }

      if (comment.pending) {
        setRemoteComments((items) => items.filter((item) => item.id !== comment.id));
        setNotificationActivity((activity) => ({
          ...activity,
          ownMemoryComments: activity.ownMemoryComments.filter((item) => item.id !== comment.id),
        }));
        return;
      }

      setRemoteComments((items) => items.filter((item) => item.id !== comment.id));
      setNotificationActivity((activity) => ({
        ...activity,
        ownMemoryComments: activity.ownMemoryComments.filter((item) => item.id !== comment.id),
      }));

      try {
        const service = await import('./services/firebaseMemoryBook');
        await service.deleteMemoryComment(profile, comment);
        setFirebaseNotice('');
      } catch (caught) {
        setRemoteComments((items) => sortCommentsNewestFirst([comment, ...items]));
        if (comment.memoryUid === profile.uid) {
          setNotificationActivity((activity) => ({
            ...activity,
            ownMemoryComments: sortCommentsNewestFirst([comment, ...activity.ownMemoryComments]),
          }));
        }
        setFirebaseNotice(caught instanceof Error ? caught.message : 'Không thể xóa bình luận lúc này.');
      }
    },
    [navigate, profile],
  );

  const handleMemoryCommentReact = useCallback(
    async (comment: MemoryComment, reactionId: CommentReactionId) => {
      if (!profile) {
        navigate('join');
        return;
      }

      if (
        comment.pending ||
        pendingCommentReactionIdsRef.current.has(comment.id)
      ) {
        return;
      }

      const previousReactionId = comment.reactionByUid?.[profile.uid];
      if (previousReactionId === reactionId) return;

      pendingCommentReactionIdsRef.current.add(comment.id);
      setPendingCommentReactionIds(Array.from(pendingCommentReactionIdsRef.current));

      const reactedAt = new Date().toISOString();
      const applyReaction = (item: MemoryComment): MemoryComment => {
        if (item.id !== comment.id) return item;
        const currentCounts = { ...makeEmptyCommentReactionCounts(), ...(item.reactionCounts || {}) };
        const itemPreviousReactionId = item.reactionByUid?.[profile.uid];
        if (itemPreviousReactionId && itemPreviousReactionId !== reactionId) {
          currentCounts[itemPreviousReactionId] = Math.max(0, (currentCounts[itemPreviousReactionId] || 0) - 1);
        }
        return {
          ...item,
          updatedAt: reactedAt,
          reactionCounts: {
            ...currentCounts,
            [reactionId]: (currentCounts[reactionId] || 0) + 1,
          },
          reactionByUid: {
            ...(item.reactionByUid || {}),
            [profile.uid]: reactionId,
          },
        };
      };
      const rollbackReaction = (item: MemoryComment): MemoryComment => (item.id === comment.id ? comment : item);

      setRemoteComments((items) => items.map(applyReaction));
      setNotificationActivity((activity) => ({
        ...activity,
        ownMemoryComments: activity.ownMemoryComments.map(applyReaction),
      }));

      try {
        const service = await import('./services/firebaseMemoryBook');
        await service.reactToMemoryComment(profile, comment, reactionId);
        setFirebaseNotice('');
      } catch (caught) {
        setRemoteComments((items) => items.map(rollbackReaction));
        setNotificationActivity((activity) => ({
          ...activity,
          ownMemoryComments: activity.ownMemoryComments.map(rollbackReaction),
        }));
        setFirebaseNotice(caught instanceof Error ? caught.message : 'KhÃ´ng thá»ƒ reaction bÃ¬nh luáº­n lÃºc nÃ y.');
      } finally {
        pendingCommentReactionIdsRef.current.delete(comment.id);
        setPendingCommentReactionIds(Array.from(pendingCommentReactionIdsRef.current));
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
        setFirebaseNotice(caught instanceof Error ? caught.message : 'Không thể xóa tin nhắn lúc này.');
      }
    },
    [navigate, profile],
  );

  const handleTimeCapsuleAdd = useCallback(
    async (message: string) => {
      if (!profile) {
        navigate('join');
        return;
      }
      const service = await import('./services/firebaseMemoryBook');
      const entry = await service.addTimeCapsuleEntry(profile, message);
      setTimeCapsules((items) => [entry, ...items]);
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
        setFirebaseNotice(caught instanceof Error ? caught.message : 'Không thể xóa nhật ký lúc này.');
      }
    },
    [navigate, profile],
  );

  const handleRememberNoteAdd = useCallback(
    async (draft: RememberNoteDraft) => {
      if (!profile) {
        navigate('join');
        return;
      }

      const service = await import('./services/firebaseMemoryBook');
      const note = await service.addRememberNote(profile, draft);

      setSentRememberNotes((items) => [note, ...items.filter((item) => item.id !== note.id)]);
      setNotificationActivity((activity) => ({
        ...activity,
        sentNotes: [note, ...activity.sentNotes.filter((item) => item.id !== note.id)],
        receivedNotes:
          note.toNameKey === profile.nameKey
            ? [note, ...activity.receivedNotes.filter((item) => item.id !== note.id)]
            : activity.receivedNotes,
      }));

      if (note.toNameKey === profile.nameKey) {
        setRememberNotes((items) => [note, ...items.filter((item) => item.id !== note.id)]);
      }
    },
    [navigate, profile],
  );

  const handleRememberNoteDelete = useCallback(
    async (note: RememberNote) => {
      if (!profile) {
        navigate('join');
        return;
      }

      const wasReceived = note.toNameKey === profile.nameKey;
      const wasSent = note.fromUid === profile.uid;

      setRememberNotes((items) => items.filter((item) => item.id !== note.id));
      setSentRememberNotes((items) => items.filter((item) => item.id !== note.id));
      setNotificationActivity((activity) => ({
        ...activity,
        receivedNotes: activity.receivedNotes.filter((item) => item.id !== note.id),
        sentNotes: activity.sentNotes.filter((item) => item.id !== note.id),
      }));

      try {
        const service = await import('./services/firebaseMemoryBook');
        await service.deleteRememberNote(profile, note);
        setFirebaseNotice('');
      } catch (caught) {
        if (wasReceived) setRememberNotes((items) => [note, ...items.filter((item) => item.id !== note.id)]);
        if (wasSent) setSentRememberNotes((items) => [note, ...items.filter((item) => item.id !== note.id)]);
        setNotificationActivity((activity) => ({
          ...activity,
          receivedNotes: wasReceived ? [note, ...activity.receivedNotes.filter((item) => item.id !== note.id)] : activity.receivedNotes,
          sentNotes: wasSent ? [note, ...activity.sentNotes.filter((item) => item.id !== note.id)] : activity.sentNotes,
        }));
        setFirebaseNotice(caught instanceof Error ? caught.message : 'Không thể xóa lời nhắn lúc này.');
      }
    },
    [navigate, profile],
  );

  const handleRememberNotesViewed = useCallback(
    async (notes: RememberNote[]) => {
      if (!profile || !notes.length) return;

      const now = new Date().toISOString();
      const ids = new Set(notes.map((note) => note.id));
      setRememberNotes((items) => items.map((item) => (ids.has(item.id) ? { ...item, viewedAt: item.viewedAt || now } : item)));
      setSentRememberNotes((items) => items.map((item) => (ids.has(item.id) ? { ...item, viewedAt: item.viewedAt || now } : item)));
      setNotificationActivity((activity) => ({
        ...activity,
        receivedNotes: activity.receivedNotes.map((item) => (ids.has(item.id) ? { ...item, viewedAt: item.viewedAt || now } : item)),
        sentNotes: activity.sentNotes.map((item) => (ids.has(item.id) ? { ...item, viewedAt: item.viewedAt || now } : item)),
      }));

      try {
        const service = await import('./services/firebaseMemoryBook');
        await service.markRememberNotesViewed(profile, notes);
        setFirebaseNotice('');
      } catch (caught) {
        setFirebaseNotice(caught instanceof Error ? caught.message : 'KhÃ´ng thá»ƒ cáº­p nháº­t tráº¡ng thÃ¡i Ä‘Ã£ xem.');
      }
    },
    [profile],
  );

  const handleRememberNoteHeart = useCallback(
    async (note: RememberNote) => {
      if (!profile) {
        navigate('join');
        return;
      }

      if (note.heartedBy.includes(profile.uid)) return;

      const addHeart = (item: RememberNote) =>
        item.id === note.id && !item.heartedBy.includes(profile.uid)
          ? { ...item, heartedBy: [...item.heartedBy, profile.uid] }
          : item;

      const removeHeart = (item: RememberNote) =>
        item.id === note.id ? { ...item, heartedBy: item.heartedBy.filter((uid) => uid !== profile.uid) } : item;

      setRememberNotes((items) => items.map(addHeart));
      setSentRememberNotes((items) => items.map(addHeart));

      try {
        const service = await import('./services/firebaseMemoryBook');
        await service.heartRememberNote(profile, note);
        setFirebaseNotice('');
      } catch (caught) {
        setRememberNotes((items) => items.map(removeHeart));
        setSentRememberNotes((items) => items.map(removeHeart));
        setFirebaseNotice(caught instanceof Error ? caught.message : 'KhÃ´ng thá»ƒ tháº£ tim Secret Message lÃºc nÃ y.');
      }
    },
    [navigate, profile],
  );

  const handleRememberNoteReact = useCallback(
    async (note: RememberNote, reactionId: RememberReactionId) => {
      if (!profile) {
        navigate('join');
        return;
      }

      const previousReaction = {
        reactionId: note.reactionId,
        reactionLabel: note.reactionLabel,
        reactedAt: note.reactedAt,
        reactedBy: note.reactedBy,
      };
      const nextReaction = {
        reactionId,
        reactionLabel: rememberReactionLabels[reactionId],
        reactedAt: new Date().toISOString(),
        reactedBy: profile.uid,
      };

      const applyReaction = (item: RememberNote) => (item.id === note.id ? { ...item, ...nextReaction } : item);
      const rollbackReaction = (item: RememberNote) => (item.id === note.id ? { ...item, ...previousReaction } : item);

      setRememberNotes((items) => items.map(applyReaction));
      setSentRememberNotes((items) => items.map(applyReaction));
      setNotificationActivity((activity) => ({
        ...activity,
        receivedNotes: activity.receivedNotes.map(applyReaction),
        sentNotes: activity.sentNotes.map(applyReaction),
      }));

      try {
        const service = await import('./services/firebaseMemoryBook');
        await service.reactRememberNote(profile, note, reactionId);
        setFirebaseNotice('');
      } catch (caught) {
        setRememberNotes((items) => items.map(rollbackReaction));
        setSentRememberNotes((items) => items.map(rollbackReaction));
        setNotificationActivity((activity) => ({
          ...activity,
          receivedNotes: activity.receivedNotes.map(rollbackReaction),
          sentNotes: activity.sentNotes.map(rollbackReaction),
        }));
        setFirebaseNotice(caught instanceof Error ? caught.message : 'Không thể phản hồi Secret Message lúc này.');
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
        <Suspense fallback={<LoadingScreen label="Đang mở check-in lớp" />}>
          <JoinPage profile={profile} onJoin={handleJoin} onSkip={() => navigate('home')} />
        </Suspense>
      );
    }

    if (route === 'photobook') {
      return (
        <Suspense fallback={<LoadingScreen label="Đang mở photobooth" />}>
          <PhotobookPage
            profile={profile}
            classmates={classmates}
            onJoinNeeded={() => navigate('join')}
            onPublish={publishMemory}
          />
        </Suspense>
      );
    }

    if (route === 'future') {
      return (
        <Suspense fallback={<LoadingScreen label="Đang mở Gửi cho lớp trong tương lai" />}>
          <FutureMessagesPage
            timeCapsules={timeCapsules}
            timeCapsuleSettings={timeCapsuleSettings}
            firebaseNotice={firebaseNotice}
            profile={profile}
            onJoin={() => navigate('join')}
            onAddTimeCapsule={handleTimeCapsuleAdd}
            onOpenFutureMessages={() => setFutureMessagePopupOpen(true)}
          />
        </Suspense>
      );
    }

    if (route === 'remember') {
      return (
        <Suspense fallback={<LoadingScreen label="Đang mở Secret Message" />}>
          <RememberPage
            classmates={classmates}
            notes={rememberNotes}
            sentNotes={sentRememberNotes}
            isLoading={rememberNotesLoading}
            isLoadingSent={sentRememberNotesLoading}
            firebaseNotice={firebaseNotice}
            profile={profile}
            onJoin={() => navigate('join')}
            onAddNote={handleRememberNoteAdd}
            onDeleteNote={handleRememberNoteDelete}
            onMarkNotesViewed={handleRememberNotesViewed}
            onReactNote={handleRememberNoteReact}
          />
        </Suspense>
      );
    }

    if (route === 'people') {
      return (
        <Suspense fallback={<LoadingScreen label="Đang mở hồ sơ lớp" />}>
          <PeoplePage
            classmates={classmates}
            memories={allMemories}
            ownMemories={notificationActivity.ownMemories}
            commentsByMemory={commentsByMemory}
            ownCommentsByMemory={ownCommentsByMemory}
            firebaseNotice={firebaseNotice}
            isLoading={classmatesLoading || memoriesLoading}
            isOwnMemoriesLoading={notificationActivityLoading}
            profile={profile}
            focusedNameKey={focusedPersonKey}
            listResetKey={peopleListResetKey}
            onJoin={() => navigate('join')}
            onPhotobook={() => navigate('photobook')}
            onUpdateProfile={handleYouthProfileUpdate}
            onDeleteMemory={handleMemoryDelete}
            onDownloadMemory={handleMemoryDownload}
            onClearFocusedProfile={() => setFocusedPersonKey('')}
          />
        </Suspense>
      );
    }

    if (route === 'votes') {
      return (
        <Suspense fallback={<LoadingScreen label="Đang mở bình chọn lớp" />}>
          <VotesPage
            classmates={classmates}
            categories={voteCategories}
            votes={voteRecords}
            firebaseNotice={firebaseNotice}
            isLoading={votesLoading || classmatesLoading}
            profile={profile}
            onJoin={() => navigate('join')}
            onAddCategory={handleVoteCategoryAdd}
            onHideCategory={handleVoteCategoryHide}
            onVote={handleVoteCast}
          />
        </Suspense>
      );
    }

    if (route === 'diary') {
      return (
        <Suspense fallback={<LoadingScreen label="Đang mở nhật ký riêng" />}>
          <DiaryPage
            diaries={secretDiaries}
            firebaseNotice={firebaseNotice}
            writingPromptsEnabled={writingPromptsEnabled}
            profile={profile}
            onJoin={() => navigate('join')}
            onAddDiary={handleSecretDiaryAdd}
            onDeleteDiary={handleSecretDiaryDelete}
          />
        </Suspense>
      );
    }

    if (route === 'mine') {
      return (
        <Suspense fallback={<LoadingScreen label="Đang mở ảnh và video của tôi" />}>
          <MyMemoriesPage
            memories={notificationActivity.ownMemories}
            commentsByMemory={ownCommentsByMemory}
            firebaseNotice={firebaseNotice}
            isLoading={notificationActivityLoading}
            profile={profile}
            pendingReactionIds={pendingReactionIds}
            pendingCommentReactionIds={pendingCommentReactionIds}
            onJoin={() => navigate('join')}
            onPhotobook={() => navigate('photobook')}
            onOpenProfile={openPersonProfile}
            onReact={handleReact}
            onReactComment={handleMemoryCommentReact}
            onAddComment={handleMemoryCommentAdd}
            onDeleteComment={handleMemoryCommentDelete}
            onDeleteMemory={handleMemoryDelete}
            onDownloadMemory={handleMemoryDownload}
          />
        </Suspense>
      );
    }

    return (
      <Suspense fallback={<LoadingScreen label="Đang sắp xếp scrapbook" />}>
        <HomePage
          memories={allMemories}
          commentsByMemory={commentsByMemory}
          guestbook={allGuestbook}
          firebaseNotice={firebaseNotice}
          isLoadingMemories={memoriesLoading}
          memoryRecapEnabled={memoryRecapEnabled}
          classLettersEnabled={classLettersEnabled}
          writingPromptsEnabled={writingPromptsEnabled}
          cinematicSlideshowSettings={cinematicSlideshowSettings}
          profile={profile}
          pendingReactionIds={pendingReactionIds}
          pendingCommentReactionIds={pendingCommentReactionIds}
          onJoin={() => navigate('join')}
          onPhotobook={() => navigate('photobook')}
          onOpenFuture={() => navigate('future')}
          onOpenRemember={() => navigate('remember')}
          onOpenDiary={() => navigate('diary')}
          onOpenProfile={openPersonProfile}
          onReact={handleReact}
          onReactComment={handleMemoryCommentReact}
          onAddComment={handleMemoryCommentAdd}
          onDeleteComment={handleMemoryCommentDelete}
          onDeleteMemory={handleMemoryDelete}
          onDownloadMemory={handleMemoryDownload}
          onAddGuestbook={handleGuestbookAdd}
          onDeleteGuestbook={handleGuestbookDelete}
          onAddAnonymousMessage={handleAnonymousMessageAdd}
        />
      </Suspense>
    );
  };

  return (
    <LazyMotion features={domAnimation}>
      <div className="min-h-screen overflow-x-hidden bg-cream text-ink">
        <div className="fixed inset-0 pointer-events-none bg-paper opacity-80" aria-hidden="true" />
        <div className="film-grain" aria-hidden="true" />
        {routeFeedbackVisible && <div className="app-route-progress" aria-hidden="true" />}

        <AnimatePresence>
          {!bootSplashDone && <BootSplash logoSrc={logoSrc} onComplete={handleBootSplashComplete} />}
        </AnimatePresence>

        {bootSplashDone && sessionNotice && (
          <div
            className="fixed left-1/2 top-[max(1rem,env(safe-area-inset-top))] z-[125] w-[min(92vw,28rem)] -translate-x-1/2 rounded-3xl border border-roseDust/20 bg-[#fffaf1] px-4 py-3 text-sm font-extrabold leading-6 text-coffee shadow-[0_18px_46px_rgba(53,41,31,0.2)]"
            role="status"
            aria-live="polite"
          >
            {sessionNotice}
          </div>
        )}

        {bootSplashDone && route !== 'landing' && (
          <header className="app-header fixed left-0 right-0 top-0 z-[70] border-b border-coffee/10 bg-[#fbf3e7] shadow-[0_8px_28px_rgba(53,41,31,0.08)]">
            <nav className="app-header-nav mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
              <button
                className="flex items-center gap-2 rounded-full px-2 py-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coffee"
                onClick={() => navigate('home')}
              >
                <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-[0.9rem] bg-white/78 p-1 shadow-paper ring-1 ring-coffee/20">
                  <img src={logoSrc} alt="" className="h-full w-full object-contain" loading="eager" decoding="async" />
                </span>
                <span>
                  <span className="block font-display text-2xl leading-none">Memory98</span>
                  <span className="block text-[11px] font-semibold uppercase text-coffee/70">
                    {profile ? `${profile.name} - ${profile.className}` : 'School Youth Archive'}
                  </span>
                </span>
              </button>

              <div ref={desktopNavRef} className="hidden items-center gap-2 lg:flex">
                {navigationGroups.map((group) => {
                  const Icon = group.icon;
                  const isOpen = openNavGroup === group.id;

                  return (
                    <div key={group.id} className="relative">
                      <button
                        className={`nav-pill relative h-11 ${group.isActive ? 'nav-pill-active' : 'bg-white/35'}`}
                        onClick={() => setOpenNavGroup((current) => (current === group.id ? null : group.id))}
                        aria-expanded={isOpen}
                        aria-haspopup="menu"
                      >
                        <Icon size={16} />
                        <span>{group.label}</span>
                        <span
                          className={`h-0 w-0 border-x-[4px] border-t-[5px] border-x-transparent border-t-current transition-transform duration-150 ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                          aria-hidden="true"
                        />
                        {(group.badgeCount || 0) > 0 && (
                          <span className="nav-notification-dot" aria-label={`${group.badgeCount} thông báo mới`}>
                            {formatBadgeCount(group.badgeCount || 0)}
                          </span>
                        )}
                      </button>

                      <AnimatePresence>
                        {isOpen && (
                          <m.div
                            className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-80 overflow-hidden rounded-[1.25rem] border border-coffee/15 bg-[#fffaf1] p-3 text-ink shadow-[0_24px_60px_rgba(53,41,31,0.2)]"
                            role="menu"
                            initial={reduceHeavyMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={reduceHeavyMotion ? undefined : { opacity: 0, y: 6, scale: 0.98 }}
                            transition={{ duration: reduceHeavyMotion ? 0 : 0.16, ease: 'easeOut' }}
                          >
                            <div className="mb-2 rounded-2xl bg-[#fbf3e7] px-3 py-2 ring-1 ring-coffee/8">
                              <p className="text-xs font-black uppercase tracking-[0.18em] text-coffee/60">{group.label}</p>
                              <p className="mt-1 text-sm font-bold leading-5 text-coffee/82">{group.description}</p>
                            </div>

                            <div className="grid gap-1.5">
                              {group.items.map((item) => {
                                const ItemIcon = item.icon;

                                return (
                                  <button
                                    key={item.id}
                                    className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left transition-colors ${
                                      item.isActive ? 'bg-ink text-paper' : 'text-ink hover:bg-white/70'
                                    }`}
                                    onClick={item.onSelect}
                                    role="menuitem"
                                  >
                                    <span
                                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                                        item.isActive ? 'bg-paper/18 text-paper' : 'bg-white text-coffee'
                                      }`}
                                    >
                                      <ItemIcon size={17} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="flex items-center gap-2 text-sm font-black">
                                        {item.label}
                                        {(item.badgeCount || 0) > 0 && (
                                          <span
                                            className={`inline-flex min-w-6 justify-center rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                                              item.isActive ? 'bg-paper text-ink' : 'bg-roseDust text-white'
                                            }`}
                                          >
                                            {formatBadgeCount(item.badgeCount || 0)}
                                          </span>
                                        )}
                                      </span>
                                      <span className={`mt-1 block text-xs font-bold leading-5 ${item.isActive ? 'text-paper/78' : 'text-coffee/68'}`}>
                                        {item.description}
                                      </span>
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </m.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="icon-button relative"
                  onClick={() => {
                    setMenuOpen(false);
                    setOpenNavGroup(null);
                    setNotificationsOpen((open) => !open);
                  }}
                  aria-label="Mở trung tâm thông báo"
                >
                  <Bell size={19} />
                  {unreadNotificationCount > 0 && (
                    <span className="header-notification-badge">
                      {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                    </span>
                  )}
                </button>
                <button
                  className="icon-button"
                  onClick={() => {
                    setMenuOpen(false);
                    setOpenNavGroup(null);
                    if (profile) {
                      openPersonProfile(profile.nameKey);
                      return;
                    }

                    navigate('join');
                  }}
                  aria-label={profile ? 'Xem hồ sơ của tôi' : 'Đăng nhập / tạo tài khoản'}
                  title={profile ? 'Hồ sơ của tôi' : 'Đăng nhập / tạo tài khoản'}
                >
                  <UserRound size={19} />
                </button>
                <button
                  className="icon-button lg:hidden"
                  onClick={() =>
                    setMenuOpen((open) => {
                      const nextOpen = !open;
                      if (!nextOpen) setOpenNavGroup(null);
                      return nextOpen;
                    })
                  }
                  aria-label="Mở menu"
                >
                  {menuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>
            </nav>

            <AnimatePresence>
              {menuOpen && (
                <m.div
                  initial={reduceHeavyMotion ? false : { opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceHeavyMotion ? undefined : { opacity: 0, y: -10 }}
                  transition={{ duration: reduceHeavyMotion ? 0 : 0.16 }}
                  className="app-mobile-menu fixed inset-x-0 bottom-0 top-16 z-[75] overflow-y-auto border-t border-coffee/15 bg-[#fbf3e7] px-4 py-3 shadow-[0_18px_42px_rgba(53,41,31,0.18)] lg:hidden"
                >
                  <div className="mx-auto grid max-w-2xl gap-3 pb-[max(0.65rem,env(safe-area-inset-bottom))]">
                    {navigationGroups.map((group) => {
                      const Icon = group.icon;
                      const isExpanded = openNavGroup === group.id;

                      return (
                        <section
                          key={group.id}
                          className={`rounded-[1.2rem] border p-3 shadow-paper ${
                            group.isActive ? 'border-ink/20 bg-[#fffaf1]' : 'border-coffee/12 bg-[#fffaf1]'
                          }`}
                        >
                          <button
                            className="flex w-full items-start gap-3 text-left"
                            onClick={() => setOpenNavGroup((current) => (current === group.id ? null : group.id))}
                            aria-expanded={isExpanded}
                          >
                            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${group.isActive ? 'bg-ink text-paper' : 'bg-[#fbf3e7] text-ink'}`}>
                              <Icon size={18} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h2 className="text-base font-black">{group.label}</h2>
                                {(group.badgeCount || 0) > 0 && (
                                  <span className="inline-flex min-w-6 justify-center rounded-full bg-roseDust px-1.5 py-0.5 text-[10px] font-black text-white">
                                    {formatBadgeCount(group.badgeCount || 0)}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-xs font-bold leading-5 text-coffee/68">{group.description}</p>
                            </div>
                            <span className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-[11px] font-black text-paper">
                              {isExpanded ? 'Ẩn' : 'Mở'}
                              <span
                                className={`h-0 w-0 border-x-[3.5px] border-t-[4.5px] border-x-transparent border-t-current transition-transform duration-150 ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                                aria-hidden="true"
                              />
                            </span>
                          </button>

                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <m.div
                                className="mt-3 grid gap-2 sm:grid-cols-2"
                                initial={reduceHeavyMotion ? false : { opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={reduceHeavyMotion ? undefined : { opacity: 0, height: 0 }}
                                transition={{ duration: reduceHeavyMotion ? 0 : 0.16, ease: 'easeOut' }}
                              >
                                {group.items.map((item) => {
                                  const ItemIcon = item.icon;

                                  return (
                                    <button
                                      key={item.id}
                                      className={`flex min-h-[4.65rem] w-full items-start gap-3 rounded-2xl p-3 text-left transition-colors ${
                                        item.isActive ? 'bg-ink text-paper' : 'bg-[#fbf3e7] text-ink hover:bg-[#f6e9d9]'
                                      }`}
                                      onClick={item.onSelect}
                                    >
                                      <span
                                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                                          item.isActive ? 'bg-paper/18 text-paper' : 'bg-white text-coffee'
                                        }`}
                                      >
                                        <ItemIcon size={17} />
                                      </span>
                                      <span className="min-w-0 flex-1">
                                        <span className="flex items-center gap-2 text-sm font-black leading-5">
                                          {item.label}
                                          {(item.badgeCount || 0) > 0 && (
                                            <span
                                              className={`inline-flex min-w-6 justify-center rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                                                item.isActive ? 'bg-paper text-ink' : 'bg-roseDust text-white'
                                              }`}
                                            >
                                              {formatBadgeCount(item.badgeCount || 0)}
                                            </span>
                                          )}
                                        </span>
                                        <span className={`mt-1 block text-xs font-bold leading-5 ${item.isActive ? 'text-paper/78' : 'text-coffee/68'}`}>
                                          {item.description}
                                        </span>
                                      </span>
                                    </button>
                                  );
                                })}
                              </m.div>
                            )}
                          </AnimatePresence>
                        </section>
                      );
                    })}
                  </div>
                </m.div>
              )}
            </AnimatePresence>
          </header>
        )}

        <AnimatePresence>
          {menuHintVisible && bootSplashDone && route !== 'landing' && !menuOpen && (
            <m.button
              type="button"
              className={`menu-discovery-hint fixed z-[90] text-left lg:hidden ${reduceHeavyMotion ? 'menu-hint-static' : ''}`}
              initial={reduceHeavyMotion ? false : { opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceHeavyMotion ? undefined : { opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: reduceHeavyMotion ? 0 : 0.18, ease: 'easeOut' }}
              onClick={scheduleMenuHintDismiss}
              aria-label="Ẩn gợi ý mở menu"
            >
              <span className="menu-hint-ring" />
              <div className="menu-hint-card">
                <span className="menu-hint-arrow" />
                <span className="menu-hint-kicker">
                  <Sparkles size={14} aria-hidden="true" />
                  Gợi ý nhanh
                </span>
                <p>Khám phá thêm những tính năng mới mẻ</p>
                <small>Chạm nút 3 gạch ở góc trên để mở menu.</small>
                <span className="menu-hint-dismiss">Chạm màn hình, tự ẩn sau vài giây</span>
              </div>
            </m.button>
          )}
        </AnimatePresence>

        {bootSplashDone && (
        <main className={route === 'landing' ? '' : 'app-main pt-16'}>
          <AnimatePresence mode="wait">
            <m.div
              key={route}
              initial={reduceHeavyMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceHeavyMotion ? undefined : { opacity: 0, y: -10 }}
              transition={{ duration: reduceHeavyMotion ? 0 : 0.22, ease: 'easeOut' }}
            >
              {renderRoute()}
            </m.div>
          </AnimatePresence>
        </main>
        )}
        {bootSplashDone && (
          <NotificationCenter
            open={notificationsOpen}
            items={unreadNotificationItems}
            unreadCount={unreadNotificationCount}
            onClose={() => setNotificationsOpen(false)}
            onMarkAllRead={markNotificationsRead}
            onOpenItem={handleOpenNotification}
          />
        )}
        {bootSplashDone && (
          <AnimatePresence>
            {futureMessagePopupOpen && futureMessagesUnlocked && timeCapsules.length > 0 && (
              <FutureMessagePopup
                isOpen={futureMessagePopupOpen}
                entries={timeCapsules}
                unlockAt={timeCapsuleSettings.unlockAt}
                onClose={() => setFutureMessagePopupOpen(false)}
              />
            )}
          </AnimatePresence>
        )}
        {bootSplashDone && accountBlock && (
          <AccountLockScreen
            name={accountBlock.name}
            reason={accountBlock.reason}
            onSignOut={() => signOutToJoin('Bạn đã rời khỏi tài khoản bị khóa.')}
          />
        )}
        {bootSplashDone && <AppStatusToast isOnline={isOnline} justRestored={justRestored} />}
      </div>
    </LazyMotion>
  );
}
