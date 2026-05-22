import ClassMessageBoard from '../components/ClassMessageBoard';
import FirebaseNotice from '../components/FirebaseNotice';
import type { GuestbookEntry, TimeCapsuleEntry, TimeCapsuleSettings, UserProfile } from '../types';

interface LettersPageProps {
  guestbook: GuestbookEntry[];
  timeCapsules: TimeCapsuleEntry[];
  timeCapsuleSettings: TimeCapsuleSettings;
  firebaseNotice: string;
  profile: UserProfile | null;
  onJoin: () => void;
  onAddGuestbook: (message: string) => void | Promise<void>;
  onDeleteGuestbook: (entry: GuestbookEntry) => void | Promise<void>;
  onAddAnonymousMessage: (message: string) => void | Promise<void>;
  onAddTimeCapsule: (message: string) => void | Promise<void>;
  onOpenFutureMessages: () => void;
}

export default function LettersPage({
  guestbook,
  timeCapsules,
  timeCapsuleSettings,
  firebaseNotice,
  profile,
  onJoin,
  onAddGuestbook,
  onDeleteGuestbook,
  onAddAnonymousMessage,
  onAddTimeCapsule,
  onOpenFutureMessages,
}: LettersPageProps) {
  return (
    <div className="relative">
      <ClassMessageBoard
        guestbook={guestbook}
        timeCapsules={timeCapsules}
        timeCapsuleSettings={timeCapsuleSettings}
        profile={profile}
        onJoin={onJoin}
        onAddGuestbook={onAddGuestbook}
        onDeleteGuestbook={onDeleteGuestbook}
        onAddAnonymousMessage={onAddAnonymousMessage}
        onAddTimeCapsule={onAddTimeCapsule}
        onOpenFutureMessages={onOpenFutureMessages}
      />
      <FirebaseNotice message={firebaseNotice} />
    </div>
  );
}
