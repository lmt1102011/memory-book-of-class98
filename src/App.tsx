import { AnimatePresence, LazyMotion, domAnimation, m } from 'framer-motion';
import { BadgeCheck, Camera, Heart, Home, Lock, Menu, MessageCircle, Sparkles, UserRound, X } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BootSplash from './components/BootSplash';
import LoadingScreen from './components/LoadingScreen';
import { useMobilePerformanceMode } from './hooks/useMobilePerformanceMode';
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion';
import LandingPage from './pages/LandingPage';
import type {
  AppRoute,
  ClassmateProfile,
  GuestbookEntry,
  MemoryComment,
  MemoryItem,
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

const routeFromHash = (): AppRoute => {
  const route = window.location.hash.replace('#/', '') as AppRoute;
  return ['landing', 'join', 'home', 'letters', 'remember', 'diary', 'photobook', 'people', 'votes'].includes(route)
    ? route
    : 'landing';
};

const navItems: Array<{ route: AppRoute; label: string; icon: typeof Home }> = [
  { route: 'people', label: 'Hồ sơ lớp', icon: UserRound },
  { route: 'votes', label: 'Bình chọn', icon: BadgeCheck },
  { route: 'landing', label: 'Intro', icon: Sparkles },
  { route: 'remember', label: 'Secret Message', icon: Heart },
  { route: 'home', label: 'Ký ức', icon: Home },
  { route: 'letters', label: 'Thư lớp', icon: MessageCircle },
  { route: 'diary', label: 'Nhật ký', icon: Lock },
  { route: 'photobook', label: 'Đăng ảnh', icon: Camera },
];

const navOrder: AppRoute[] = ['landing', 'remember', 'home', 'people', 'votes', 'letters', 'diary', 'photobook'];
const orderedNavItems = [...navItems].sort((left, right) => navOrder.indexOf(left.route) - navOrder.indexOf(right.route));

const rememberReactionLabels: Record<RememberReactionId, string> = {
  'miss-you': 'Nhớ cậu',
  'thank-you': 'Cảm ơn',
  regret: 'Tiếc nuối',
  'good-luck': 'Chúc may mắn',
};

const logoSrc = `${import.meta.env.BASE_URL}logo-web-class-98.svg`;

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
  const [rememberNotes, setRememberNotes] = useState<RememberNote[]>([]);
  const [rememberNotesLoading, setRememberNotesLoading] = useState(false);
  const [sentRememberNotes, setSentRememberNotes] = useState<RememberNote[]>([]);
  const [sentRememberNotesLoading, setSentRememberNotesLoading] = useState(false);
  const [secretDiaries, setSecretDiaries] = useState<SecretDiaryEntry[]>([]);
  const [firebaseNotice, setFirebaseNotice] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [bootSplashDone, setBootSplashDone] = useState(false);
  const [pendingReactionIds, setPendingReactionIds] = useState<string[]>([]);
  const memoriesLoadedOnceRef = useRef(false);
  const pendingReactionIdsRef = useRef(new Set<string>());
  const mobilePerformanceMode = useMobilePerformanceMode();
  const prefersReducedMotion = usePrefersReducedMotion();
  const reduceHeavyMotion = prefersReducedMotion || mobilePerformanceMode;

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
    let unsubscribeComments: (() => void) | undefined;
    let unsubscribeGuestbook: (() => void) | undefined;
    let unsubscribeClassmates: (() => void) | undefined;
    let unsubscribeRememberNotes: (() => void) | undefined;
    let unsubscribeSentRememberNotes: (() => void) | undefined;
    let unsubscribeDiaries: (() => void) | undefined;
    let unsubscribeVoteBoard: (() => void) | undefined;
    let isActive = true;

    if (route === 'home' || route === 'people') {
      setMemoriesLoading(!memoriesLoadedOnceRef.current);

      void import('./services/firebaseRealtimeMemoryBook')
        .then((service) => {
          if (!isActive) return;

          unsubscribeMemories = service.subscribeMemoriesRealtime(
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

    if (route === 'remember' || route === 'people' || route === 'votes') {
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

  const navigate = useCallback((nextRoute: AppRoute) => {
    setRoute(nextRoute);
    setFirebaseNotice('');
    setMenuOpen(false);
    window.history.pushState(null, '', `#/${nextRoute}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

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

      try {
        const service = await import('./services/firebaseMemoryBook');
        await service.hideVoteCategory(profile, category);
        setFirebaseNotice('');
      } catch (caught) {
        setVoteCategories((items) => [category, ...items.filter((item) => item.id !== category.id)]);
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
          };
        }),
      );

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
        setFirebaseNotice(caught instanceof Error ? caught.message : 'Không thể thả tim lúc này.');
      } finally {
        pendingReactionIdsRef.current.delete(memory.id);
        setPendingReactionIds(Array.from(pendingReactionIdsRef.current));
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
        uid: profile.uid,
        name: profile.name,
        nameKey: profile.nameKey,
        message: safeMessage,
        createdAt: new Date().toISOString(),
        pending: true,
      };

      setRemoteComments((items) => sortCommentsNewestFirst([tempComment, ...items]));

      try {
        const service = await import('./services/firebaseMemoryBook');
        const savedComment = await service.addMemoryComment(profile, memory, safeMessage);
        setRemoteComments((items) =>
          sortCommentsNewestFirst(items.map((item) => (item.id === tempComment.id ? savedComment : item))),
        );
        setFirebaseNotice('');
      } catch (caught) {
        setRemoteComments((items) => items.filter((item) => item.id !== tempComment.id));
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
        return;
      }

      setRemoteComments((items) => items.filter((item) => item.id !== comment.id));

      try {
        const service = await import('./services/firebaseMemoryBook');
        await service.deleteMemoryComment(profile, comment);
        setFirebaseNotice('');
      } catch (caught) {
        setRemoteComments((items) => sortCommentsNewestFirst([comment, ...items]));
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

      try {
        const service = await import('./services/firebaseMemoryBook');
        await service.deleteRememberNote(profile, note);
        setFirebaseNotice('');
      } catch (caught) {
        if (wasReceived) setRememberNotes((items) => [note, ...items.filter((item) => item.id !== note.id)]);
        if (wasSent) setSentRememberNotes((items) => [note, ...items.filter((item) => item.id !== note.id)]);
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

      try {
        const service = await import('./services/firebaseMemoryBook');
        await service.reactRememberNote(profile, note, reactionId);
        setFirebaseNotice('');
      } catch (caught) {
        setRememberNotes((items) => items.map(rollbackReaction));
        setSentRememberNotes((items) => items.map(rollbackReaction));
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
          <PhotobookPage profile={profile} onJoinNeeded={() => navigate('join')} onPublish={publishMemory} />
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
            commentsByMemory={commentsByMemory}
            firebaseNotice={firebaseNotice}
            isLoading={classmatesLoading || memoriesLoading}
            profile={profile}
            focusedNameKey={focusedPersonKey}
            onJoin={() => navigate('join')}
            onPhotobook={() => navigate('photobook')}
            onUpdateProfile={handleYouthProfileUpdate}
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
        />
      </Suspense>
    );
  };

  return (
    <LazyMotion features={domAnimation}>
      <div className="min-h-screen overflow-x-hidden bg-cream text-ink">
        <div className="fixed inset-0 pointer-events-none bg-paper opacity-80" aria-hidden="true" />
        <div className="film-grain" aria-hidden="true" />

        <AnimatePresence>
          {!bootSplashDone && <BootSplash logoSrc={logoSrc} onComplete={handleBootSplashComplete} />}
        </AnimatePresence>

        {bootSplashDone && route !== 'landing' && (
          <header className="fixed left-0 right-0 top-0 z-40 border-b border-white/40 bg-cream/72 backdrop-blur-xl">
            <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
              <button
                className="flex items-center gap-2 rounded-full px-2 py-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coffee"
                onClick={() => navigate('landing')}
              >
                <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-paper shadow-paper ring-1 ring-coffee/20">
                  <img src={logoSrc} alt="" className="h-9 w-9 object-contain" loading="eager" decoding="async" />
                </span>
                <span>
                  <span className="block font-display text-2xl leading-none">Memory Book</span>
                  <span className="block text-[11px] font-semibold uppercase text-coffee/70">
                    {profile ? `${profile.name} - ${profile.className}` : 'School Youth Archive'}
                  </span>
                </span>
              </button>

              <div className="hidden items-center gap-2 lg:flex">
                {orderedNavItems.map(({ route: itemRoute, label, icon: Icon }) => (
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
                  Đăng ảnh
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
                    {orderedNavItems.map(({ route: itemRoute, label, icon: Icon }) => (
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
      </div>
    </LazyMotion>
  );
}
