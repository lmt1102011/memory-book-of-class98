import { Lock, UserRound } from 'lucide-react';

interface AccountLockScreenProps {
  name?: string;
  reason?: string;
  onSignOut: () => void;
}

export default function AccountLockScreen({ name, reason, onSignOut }: AccountLockScreenProps) {
  const safeReason = reason?.trim();

  return (
    <section
      className="fixed inset-0 z-[130] grid min-h-screen place-items-center bg-[#fbf3e7] px-4 py-8 text-ink"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-lock-title"
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(247,183,199,.28),transparent_38%),linear-gradient(235deg,rgba(169,205,232,.26),transparent_42%),linear-gradient(180deg,#fbf3e7,#fffaf1)]" />
      <div className="relative w-full max-w-md rounded-[1.8rem] border border-white/80 bg-[#fffaf1] p-5 shadow-[0_24px_70px_rgba(53,41,31,0.22)] sm:p-6">
        <div className="absolute -top-4 left-8 h-8 w-28 rotate-[-3deg] rounded bg-[#f4dfbf]/90 shadow-sm" />
        <div className="rounded-[1.35rem] border border-coffee/10 bg-white/72 p-5 text-center shadow-inner">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-ink text-paper shadow-[0_14px_32px_rgba(53,41,31,0.2)]">
            <Lock size={34} strokeWidth={2.6} />
          </div>

          <p className="mt-5 text-xs font-black uppercase text-coffee/60">Tài khoản lớp 9/8</p>
          <h1 id="account-lock-title" className="mt-2 font-display text-5xl leading-none sm:text-6xl">
            Đã bị khóa
          </h1>
          <p className="mt-4 text-sm font-bold leading-6 text-coffee/76">
            {name ? `${name}, tài khoản của bạn hiện đang bị manager khóa.` : 'Tài khoản này hiện đang bị manager khóa.'}
            {' '}Bạn sẽ không thể xem hoặc đăng ký ức cho đến khi manager mở lại.
          </p>

          {safeReason && (
            <div className="mt-5 rounded-[1rem] border border-[#dfb7a2]/55 bg-[#fff4e8] px-4 py-3 text-left shadow-inner">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-coffee/55">Lý do manager ghi chú</p>
              <p className="mt-2 break-words text-sm font-bold leading-6 text-ink">{safeReason}</p>
            </div>
          )}

          <button className="primary-button mt-6 w-full justify-center" type="button" onClick={onSignOut}>
            <UserRound size={18} />
            Về màn hình đăng nhập
          </button>
        </div>
      </div>
    </section>
  );
}
