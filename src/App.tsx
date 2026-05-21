import { AnimatePresence, LazyMotion, domAnimation, m } from 'framer-motion';
import { BadgeCheck, Bell, Heart, Home, Lock, Menu, MessageCircle, UserRound, X } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppStatusToast from './components/AppStatusToast';
import BootSplash from './components/BootSplash';
import LoadingScreen from './components/LoadingScreen';
import NotificationCenter from './components/NotificationCenter';
import { useMobilePerformanceMode } from './hooks/useMobilePerformanceMode';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion';
import LandingPage from './pages/LandingPage';
import { isStandaloneMode } from './pwaInstallPrompt';
import type {
  AppRoute,
  ClassmateProfile,
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
  UserProfile,
  VoteCategory,
  VoteCategoryDraft,
  VoteRecord,
  YouthProfileDraft,
} from './types';

const JoinPage = lazy(() => import('./pages/JoinPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const LettersPage = lazy(() => import('./pages/LettersPage'));
const RememberPage = lazy(() => import('./pages/RememberPage'));
const DiaryPage = lazy(() => import('./pages/DiaryPage'));
const PhotobookPage = lazy(() => import('./pages/PhotobookPage'));
const PeoplePage = lazy(() => import('./pages/PeoplePage'));
const VotesPage = lazy(() => import('./pages/VotesPage'));
const MyMemoriesPage = lazy(() => import('./pages/MyMemoriesPage'));

const routeFromHash = (): AppRoute => {
  const route = window.location.hash.replace('#/', '') as AppRoute;
  const isKnownRoute = ['landing', 'join', 'home', 'letters', 'remember', 'diary', 'photobook', 'people', 'votes', 'mine'].includes(route);

  if (!isKnownRoute) return isStandaloneMode() ? 'home' : 'landing';
  if (route === 'landing' && isStandaloneMode()) return 'home';

  return route;
};

const navItems: Array<{ route: AppRoute; label: string; icon: typeof Home }> = [
  { route: 'home', label: 'Ký ức', icon: Home },
  { route: 'people', label: 'Hồ sơ', icon: UserRound },
  { route: 'remember', label: 'Secret', icon: Heart },
  { route: 'letters', label: 'Thư lớp', icon: MessageCircle },
  { route: 'votes', label: 'Bình chọn', icon: BadgeCheck },
  { route: 'diary', label: 'Nhật ký', icon: Lock },
];

const navOrder: AppRoute[] = ['home', 'people', 'remember', 'letters', 'votes', 'diary'];
const orderedNavItems = [...navItems].sort((left, right) => navOrder.indexOf(left.route) - navOrder.indexOf(right.route));

const rememberReactionLabels: Record<RememberReactionId, string> = {
  'miss-you': 'Nhớ cậu',
  'thank-you': 'Cảm ơn',
  regret: 'Tiếc nuối',
  'good-luck': 'Chúc may mắn',
};

const logoSrc = `${import.meta.env.BASE_URL}logo-web-class-98.svg?v=20260521-logo2`;

const sortCommentsNewestFirst = (comments: MemoryComment[]) =>
  [...comments].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => routeFromHash());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [remoteMemories, setRemoteMemories] = useState<MemoryItem[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [remoteComments, setRemoteComments] = useState<MemoryComment[]>([]);
  const [remoteGuestbook, setRemoteGuestbook] = useState<GuestbookEntry[]>([]);
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
  const [firebaseNotice, setFirebaseNotice] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [bootSplashDone, setBootSplashDone] = useState(false);
  const [routeFeedbackVisible, setRouteFeedbackVisible] = useState(false);
  const [pendingReactionIds, setPendingReactionIds] = useState<string[]>([]);
  const memoriesLoadedOnceRef = useRef(false);
  const pendingReactionIdsRef = useRef(new Set<string>());
  const routeFeedbackTimerRef = useRef(0);
  const mobilePerformanceMode = useMobilePerformanceMode();
  const { isOnline, justRestored } = useNetworkStatus();
  const prefersReducedMotion = usePrefersReducedMotion();
  const reduceHeavyMotion = prefersReducedMotion || mobilePerformanceMode;

  useEffect(() => {
    const onPopState = () => setRoute(routeFromHash());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!bootSplashDone) return undefined;

    const timer = window.setTimeout(() => {
      void import('./pages/HomePage');
      void import('./pages/RememberPage');
      void import('./pages/PeoplePage');
      void import('./pages/VotesPage');
      void import('./pages/LettersPage');
      void import('./pages/DiaryPage');
      void import('./pages/JoinPage');
      if (!mobilePerformanceMode) void import('./pages/PhotobookPage');
    }, mobilePerformanceMode ? 2200 : 900);

    return () => window.clearTimeout(timer);
  }, [bootSplashDone, mobilePerformanceMode]);

  useEffect(
    () => () => {
      if (routeFeedbackTimerRef.current) window.clearTimeout(routeFeedbackTimerRef.current);
    },
    [],
  );

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
      setNotificationsSeenAt(new Date(0).toISOString());
      setNotificationActivity({
        ownMemories: [],
        ownMemoryComments: [],
        receivedNotes: [],
        sentNotes: [],
        voteCategories: [],
      });
      return;
    }

    setNotificationsSeenAt(
      window.localStorage.getItem(`memory98-notifications-seen:${profile.uid}`) || new Date(0).toISOString(),
    );
  }, [profile]);

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
  }, [bootSplashDone, profile]);

  useEffect(() => {
    if (route === 'landing' || route === 'join') return undefined;

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

    if (route === 'letters' || route === 'diary') {
      void import('./services/firebaseMemoryBook').then((service) => {
        if (!isActive) return;

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
  }, [profile, route]);

  const navigate = useCallback(
    (nextRoute: AppRoute) => {
      const scrollBehavior: ScrollBehavior = reduceHeavyMotion ? 'auto' : 'smooth';

      setFirebaseNotice('');
      setMenuOpen(false);
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
      window.history.pushState(null, '', `#/${nextRoute}`);
    },
    [reduceHeavyMotion, route],
  );

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

  const handleNavItemClick = useCallback(
    (itemRoute: AppRoute) => {
      if (itemRoute === 'people') {
        openPeopleList();
        return;
      }

      navigate(itemRoute);
    },
    [navigate, openPeopleList],
  );

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
    const makeUnread = (createdAt: string) => new Date(createdAt).getTime() > seenAt;
    const items: NotificationItem[] = [];

    notificationActivity.receivedNotes
      .filter((note) => note.fromUid !== profile.uid)
      .slice(0, 24)
      .forEach((note) => {
        items.push({
          id: `message-${note.id}`,
          kind: 'message',
          route: 'remember',
          title: note.anonymous ? 'Secret Message mới' : `${note.fromName} gửi Secret Message`,
          body: note.message,
          createdAt: note.createdAt,
          unread: makeUnread(note.createdAt),
          accent: 'pink',
        });
      });

    notificationActivity.sentNotes
      .filter((note) => note.reactionId && note.reactedAt)
      .slice(0, 24)
      .forEach((note) => {
        const createdAt = note.reactedAt || note.createdAt;
        items.push({
          id: `reaction-${note.id}-${note.reactionId}`,
          kind: 'reaction',
          route: 'remember',
          title: `${note.toName} đã phản hồi`,
          body: `Người nhận đã thả: ${note.reactionLabel || rememberReactionLabels[note.reactionId!]}`,
          createdAt,
          unread: makeUnread(createdAt),
          accent: 'blue',
        });
      });

    const ownMemoryById = new Map(notificationActivity.ownMemories.map((memory) => [memory.id, memory]));
    notificationActivity.ownMemoryComments
      .filter((comment) => comment.uid !== profile.uid)
      .slice(0, 32)
      .forEach((comment) => {
        const memory = ownMemoryById.get(comment.memoryId);
        items.push({
          id: `comment-${comment.id}`,
          kind: 'comment',
          route: 'mine',
          title: `${comment.name} bình luận`,
          body: memory?.caption ? `${comment.message} · ${memory.caption}` : comment.message,
          createdAt: comment.createdAt,
          unread: makeUnread(comment.createdAt),
          accent: 'cream',
        });
      });

    notificationActivity.ownMemories
      .filter((memory) => memory.likedBy.some((uid) => uid !== profile.uid))
      .slice(0, 28)
      .forEach((memory) => {
        const otherLikes = memory.likedBy.filter((uid) => uid !== profile.uid).length;
        const createdAt = memory.updatedAt || memory.createdAt;
        items.push({
          id: `like-${memory.storageCollection || 'memories98'}-${memory.id}-${otherLikes}`,
          kind: 'like',
          route: 'mine',
          title: `${otherLikes} tim mới trên ${memory.mediaType === 'video' ? 'video' : 'ảnh'} của bạn`,
          body: memory.caption || 'Một kỷ niệm của bạn vừa được lớp tương tác.',
          createdAt,
          unread: makeUnread(createdAt),
          accent: 'pink',
        });
      });

    notificationActivity.voteCategories
      .filter((category) => category.uid !== profile.uid)
      .slice(0, 16)
      .forEach((category) => {
        items.push({
          id: `vote-${category.id}`,
          kind: 'vote',
          route: 'votes',
          title: 'Có hạng mục bình chọn mới',
          body: category.title,
          createdAt: category.createdAt,
          unread: makeUnread(category.createdAt),
          accent: 'chalk',
        });
      });

    return items
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 60);
  }, [notificationActivity, notificationsSeenAt, profile]);

  const unreadNotificationCount = useMemo(
    () => notificationItems.filter((item) => item.unread).length,
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

  const markNotificationsRead = useCallback(() => {
    if (!profile) return;
    const now = new Date().toISOString();
    window.localStorage.setItem(`memory98-notifications-seen:${profile.uid}`, now);
    setNotificationsSeenAt(now);
  }, [profile]);

  const handleOpenNotification = useCallback(
    (item: NotificationItem) => {
      markNotificationsRead();
      setNotificationsOpen(false);
      if (item.route === 'mine' && profile) {
        setFocusedPersonKey(profile.nameKey);
        navigate('people');
        return;
      }
      navigate(item.route);
    },
    [markNotificationsRead, navigate, profile],
  );

  const navBadgeCount = useCallback(
    (itemRoute: AppRoute) => {
      if (itemRoute === 'remember') {
        return notificationItems.filter((item) => item.unread && (item.kind === 'message' || item.kind === 'reaction')).length;
      }

      if (itemRoute === 'people' || itemRoute === 'mine') {
        return notificationItems.filter((item) => item.unread && (item.kind === 'comment' || item.kind === 'like')).length;
      }

      if (itemRoute === 'votes') {
        return notificationItems.filter((item) => item.unread && item.kind === 'vote').length;
      }

      return 0;
    },
    [notificationItems],
  );

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

    if (route === 'letters') {
      return (
        <Suspense fallback={<LoadingScreen label="Đang mở bảng thư lớp" />}>
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
            onJoin={() => navigate('join')}
            onPhotobook={() => navigate('photobook')}
            onOpenProfile={openPersonProfile}
            onReact={handleReact}
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
          firebaseNotice={firebaseNotice}
          isLoadingMemories={memoriesLoading}
          profile={profile}
          pendingReactionIds={pendingReactionIds}
          onJoin={() => navigate('join')}
          onPhotobook={() => navigate('photobook')}
          onOpenProfile={openPersonProfile}
          onReact={handleReact}
          onAddComment={handleMemoryCommentAdd}
          onDeleteComment={handleMemoryCommentDelete}
          onDeleteMemory={handleMemoryDelete}
          onDownloadMemory={handleMemoryDownload}
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

        {bootSplashDone && route !== 'landing' && (
          <header className="fixed left-0 right-0 top-0 z-40 border-b border-white/40 bg-cream/72 backdrop-blur-xl">
            <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
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

              <div className="hidden items-center gap-2 lg:flex">
                {orderedNavItems.map(({ route: itemRoute, label, icon: Icon }) => {
                  const badgeCount = navBadgeCount(itemRoute);

                  return (
                    <button
                      key={itemRoute}
                      className={`nav-pill relative ${route === itemRoute ? 'nav-pill-active' : ''}`}
                      onClick={() => handleNavItemClick(itemRoute)}
                    >
                      <Icon size={16} />
                      {label}
                      {badgeCount > 0 && (
                        <span className="nav-notification-dot" aria-label={`${badgeCount} thông báo mới`}>
                          {badgeCount > 9 ? '9+' : badgeCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="icon-button relative"
                  onClick={() => setNotificationsOpen((open) => !open)}
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
                  onClick={() => (profile ? openPersonProfile(profile.nameKey) : navigate('join'))}
                  aria-label={profile ? 'Xem hồ sơ của tôi' : 'Đăng nhập / tạo tài khoản'}
                  title={profile ? 'Hồ sơ của tôi' : 'Đăng nhập / tạo tài khoản'}
                >
                  <UserRound size={19} />
                </button>
                <button
                  className="icon-button lg:hidden"
                  onClick={() => setMenuOpen((open) => !open)}
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
                  className="border-t border-white/50 bg-cream/95 px-4 py-3 shadow-paper lg:hidden"
                >
                  <div className="grid gap-2">
                    {orderedNavItems.map(({ route: itemRoute, label, icon: Icon }) => {
                      const badgeCount = navBadgeCount(itemRoute);

                      return (
                        <button
                          key={itemRoute}
                          className={`nav-pill relative justify-start ${route === itemRoute ? 'nav-pill-active' : ''}`}
                          onClick={() => handleNavItemClick(itemRoute)}
                        >
                          <Icon size={16} />
                          {label}
                          {badgeCount > 0 && (
                            <span className="ml-auto inline-flex min-w-6 justify-center rounded-full bg-roseDust px-1.5 py-0.5 text-[10px] font-black text-white">
                              {badgeCount > 9 ? '9+' : badgeCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </m.div>
              )}
            </AnimatePresence>
          </header>
        )}

        {bootSplashDone && (
        <main className={route === 'landing' ? '' : 'pt-16'}>
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
            items={notificationItems}
            unreadCount={unreadNotificationCount}
            onClose={() => setNotificationsOpen(false)}
            onMarkAllRead={markNotificationsRead}
            onOpenItem={handleOpenNotification}
          />
        )}
        {bootSplashDone && <AppStatusToast isOnline={isOnline} justRestored={justRestored} />}
      </div>
    </LazyMotion>
  );
}
