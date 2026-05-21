interface LoadingScreenProps {
  label?: string;
}

export default function LoadingScreen({ label = 'Loading memories' }: LoadingScreenProps) {
  return (
    <div className="grid min-h-[60vh] place-items-center px-6" role="status" aria-live="polite">
      <div className="text-center">
        <div className="mx-auto mb-5 h-14 w-14 rounded-full border-4 border-coffee/15 border-t-coffee motion-safe:animate-spin" />
        <p className="font-hand text-3xl text-coffee">{label}...</p>
      </div>
    </div>
  );
}
