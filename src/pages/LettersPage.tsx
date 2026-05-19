import ClassMessageBoard from '../components/ClassMessageBoard';
import FirebaseNotice from '../components/FirebaseNotice';
import type { GuestbookEntry, UserProfile } from '../types';

interface LettersPageProps {
  guestbook: GuestbookEntry[];
  firebaseNotice: string;
  profile: UserProfile | null;
  onJoin: () => void;
  onAddGuestbook: (message: string) => void | Promise<void>;
  onDeleteGuestbook: (entry: GuestbookEntry) => void | Promise<void>;
  onAddAnonymousMessage: (message: string) => void | Promise<void>;
}

export default function LettersPage({
  guestbook,
  firebaseNotice,
  profile,
  onJoin,
  onAddGuestbook,
  onDeleteGuestbook,
  onAddAnonymousMessage,
}: LettersPageProps) {
  return (
    <div className="relative">
      <ClassMessageBoard
        guestbook={guestbook}
        profile={profile}
        onJoin={onJoin}
        onAddGuestbook={onAddGuestbook}
        onDeleteGuestbook={onDeleteGuestbook}
        onAddAnonymousMessage={onAddAnonymousMessage}
      />
      <FirebaseNotice message={firebaseNotice} />
    </div>
  );
}
