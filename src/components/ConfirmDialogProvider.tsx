import { Check, Sparkles, Trash2, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type ConfirmDialogTone = 'danger' | 'default';

export interface ConfirmDialogOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
}

type ConfirmRequest = {
  options: ConfirmDialogOptions;
  resolve: (confirmed: boolean) => void;
};

const ConfirmDialogContext = createContext<((options: ConfirmDialogOptions) => Promise<boolean>) | null>(null);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const confirmDialog = useCallback((options: ConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      setRequest({ options, resolve });
    });
  }, []);

  const close = useCallback(
    (confirmed: boolean) => {
      setRequest((current) => {
        current?.resolve(confirmed);
        return null;
      });
    },
    [],
  );

  useEffect(() => {
    if (!request) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [close, request]);

  const dialog = useMemo(() => {
    if (!request) return null;

    const { options } = request;
    const tone = options.tone || 'default';
    const isDanger = tone === 'danger';

    return (
      <div
        className="app-safe-modal-overlay fixed inset-0 z-[120] grid place-items-center bg-[rgba(18,15,13,0.72)] p-4"
        role="dialog"
        aria-modal="true"
        aria-label={options.title}
        onClick={() => close(false)}
      >
        <div
          className="app-safe-modal-panel w-full max-w-[25rem] overflow-hidden rounded-[1.2rem] border border-[#7a5639]/18 bg-[#fffaf1] text-ink shadow-[0_24px_70px_rgba(18,15,13,0.38)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="relative p-4 pb-3 sm:p-5 sm:pb-4">
            <button
              type="button"
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-ink text-paper shadow-sm transition hover:bg-coffee"
              onClick={() => close(false)}
              aria-label="Đóng xác nhận"
              title="Đóng"
            >
              <X size={17} />
            </button>

            <div className="flex items-start gap-3 pr-10">
              <span
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full shadow-sm ${
                  isDanger ? 'bg-blush/42 text-[#9d3b4b]' : 'bg-skySoft/38 text-chalk'
                }`}
              >
                {isDanger ? <Trash2 size={19} /> : <Sparkles size={19} />}
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-4xl leading-none sm:text-5xl">{options.title}</h2>
                {options.description && <p className="mt-2 text-sm font-semibold leading-6 text-ink/66">{options.description}</p>}
              </div>
            </div>
          </div>

          <div className="grid gap-2 border-t border-coffee/10 bg-white/36 p-3 sm:grid-cols-2 sm:p-4">
            <button type="button" className="secondary-button min-h-11 justify-center" onClick={() => close(false)}>
              <X size={16} />
              {options.cancelLabel || 'Hủy'}
            </button>
            <button
              type="button"
              className={`min-h-11 justify-center ${isDanger ? 'secondary-button border-blush/60 bg-blush/30 text-coffee' : 'primary-button'}`}
              onClick={() => close(true)}
            >
              <Check size={16} />
              {options.confirmLabel || 'Xác nhận'}
            </button>
          </div>
        </div>
      </div>
    );
  }, [close, request]);

  return (
    <ConfirmDialogContext.Provider value={confirmDialog}>
      {children}
      {dialog}
    </ConfirmDialogContext.Provider>
  );
}

export const useConfirmDialog = () => {
  const confirmDialog = useContext(ConfirmDialogContext);
  if (!confirmDialog) throw new Error('useConfirmDialog must be used inside ConfirmDialogProvider');
  return confirmDialog;
};
