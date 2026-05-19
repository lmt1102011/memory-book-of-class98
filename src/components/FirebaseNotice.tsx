interface FirebaseNoticeProps {
  message: string;
}

export default function FirebaseNotice({ message }: FirebaseNoticeProps) {
  if (!message) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
      <p className="rounded-2xl bg-blush/30 px-4 py-3 text-sm font-semibold text-coffee">
        Firebase: {message}
      </p>
    </div>
  );
}
