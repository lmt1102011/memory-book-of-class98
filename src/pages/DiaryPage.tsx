import FirebaseNotice from '../components/FirebaseNotice';
import SecretMailbox from '../components/SecretMailbox';
import type { SecretDiaryEntry, UserProfile } from '../types';

interface DiaryPageProps {
  diaries: SecretDiaryEntry[];
  firebaseNotice: string;
  profile: UserProfile | null;
  onJoin: () => void;
  onAddDiary: (message: string) => void | Promise<void>;
  onDeleteDiary: (diary: SecretDiaryEntry) => void | Promise<void>;
}

export default function DiaryPage({
  diaries,
  firebaseNotice,
  profile,
  onJoin,
  onAddDiary,
  onDeleteDiary,
}: DiaryPageProps) {
  return (
    <div className="relative">
      {!profile && (
        <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
          <button className="secondary-button" onClick={onJoin}>
            Đăng nhập để mở nhật ký riêng
          </button>
        </section>
      )}
      <SecretMailbox
        diaries={diaries}
        profile={profile}
        onAddDiary={onAddDiary}
        onDeleteDiary={onDeleteDiary}
      />
      <FirebaseNotice message={firebaseNotice} />
    </div>
  );
}
