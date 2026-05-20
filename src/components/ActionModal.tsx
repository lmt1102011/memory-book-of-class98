import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

interface ActionModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  onClose: () => void;
}

export default function ActionModal({ isOpen, title, description, icon, children, onClose }: ActionModalProps) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/58 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="relative max-h-[92svh] w-full max-w-2xl overflow-auto rounded-[1.25rem] border border-white/70 bg-white/92 p-4 text-ink shadow-[0_24px_70px_rgba(18,15,13,.28)] sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-ink text-paper shadow-paper transition hover:bg-coffee"
          onClick={onClose}
          aria-label="Đóng popup"
          title="Đóng popup"
        >
          <X size={18} />
        </button>

        <div className="flex min-w-0 items-start gap-3 pr-12">
          {icon && <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-paper">{icon}</span>}
          <div className="min-w-0">
            <h2 className="font-display text-4xl leading-none sm:text-5xl">{title}</h2>
            {description && <p className="mt-2 text-sm leading-6 text-ink/62">{description}</p>}
          </div>
        </div>

        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
