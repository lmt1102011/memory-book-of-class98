import { m } from 'framer-motion';
import { BadgeCheck, Camera, Eye, EyeOff, Lock, UserRound } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useMobilePerformanceMode } from '../hooks/useMobilePerformanceMode';
import { checkStudentName, CLASS_NAME, loginStudent, registerStudent } from '../services/firebaseMemoryBook';
import type { UserProfile } from '../types';

interface JoinPageProps {
  profile: UserProfile | null;
  onJoin: (profile: UserProfile) => void;
  onSkip: () => void;
}

type JoinMode = 'name' | 'login' | 'register';

export default function JoinPage({ profile, onJoin, onSkip }: JoinPageProps) {
  const [name, setName] = useState(profile?.name || '');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<JoinMode>('name');
  const [nameWasDeleted, setNameWasDeleted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [joined, setJoined] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState('');
  const mobilePerformanceMode = useMobilePerformanceMode();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isChecking) return;
    setError('');

    try {
      if (mode === 'name') {
        setIsChecking(true);
        const result = await checkStudentName(name);
        setNameWasDeleted(Boolean(result.deleted));
        setMode(result.exists ? 'login' : 'register');
        setPassword('');
        setShowPassword(false);
        return;
      }

      setIsChecking(true);
      const nextProfile =
        mode === 'login' ? await loginStudent(name, password) : await registerStudent(name, password);

      setJoined(true);
      window.setTimeout(() => {
        onJoin(nextProfile);
      }, 900);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Không thể đăng nhập lúc này.';
      if (message.includes('auth/invalid-credential') || message.includes('auth/wrong-password')) {
        setError('Mật khẩu chưa đúng. Hãy thử lại.');
      } else if (message.includes('auth/email-already-in-use')) {
        setError('Tên này đã có trong lớp 9/8. Hãy nhập mật khẩu để tiếp tục.');
        setMode('login');
      } else {
        setError(message);
      }
    } finally {
      setIsChecking(false);
    }
  };

  const resetName = () => {
    setMode('name');
    setNameWasDeleted(false);
    setPassword('');
    setShowPassword(false);
    setError('');
  };

  useEffect(() => {
    document.title = 'Join Memory Book';
  }, []);

  return (
    <section className="relative min-h-[calc(100svh-4rem)] overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(247,183,199,.28),transparent_36%),linear-gradient(245deg,rgba(169,205,232,.24),transparent_42%),linear-gradient(135deg,#fbf3e7,#fffaf1)]" />
      <div className="relative mx-auto grid min-h-[calc(100svh-9rem)] max-w-6xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="section-kicker">Photobooth Check-In</p>
          <h1 className="font-display text-6xl leading-none sm:text-8xl">Step into the memory book</h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-ink/68">
            Nhập họ tên của bạn trong lớp {CLASS_NAME}. Nếu tên đã có, dùng mật khẩu cũ; nếu là tên mới, đặt mật
            khẩu để giữ ký ức của riêng bạn.
          </p>
        </div>

        <m.div
          initial={mobilePerformanceMode ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: mobilePerformanceMode ? 0 : 0.2, ease: 'easeOut' }}
          className="relative rounded-[2rem] border border-white/65 bg-white/55 p-4 shadow-paper backdrop-blur-xl sm:p-6"
        >
          <div className="absolute -top-4 left-8 h-8 w-32 rotate-[-3deg] rounded bg-[#f4dfbf]/80 shadow-sm" />
          <div className="rounded-[1.4rem] bg-ink p-3 shadow-glass">
            <div className="rounded-[1rem] bg-[linear-gradient(135deg,#fffaf1,#f7b7c7_58%,#a9cde8)] p-5 sm:p-7">
              {joined ? (
                <m.div
                  initial={mobilePerformanceMode ? false : { scale: 0.96, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: mobilePerformanceMode ? 0 : 0.18, ease: 'easeOut' }}
                  className="grid min-h-[25rem] place-items-center text-center"
                >
                  <div>
                    <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-ink text-paper shadow-glow">
                      <BadgeCheck size={34} />
                    </div>
                    <h2 className="font-hand text-5xl font-bold text-ink">
                      Welcome to the Memory Book of our youth.
                    </h2>
                  </div>
                </m.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase text-coffee/70">Class {CLASS_NAME} pass</p>
                      <h2 className="font-display text-5xl leading-none">Memory Booth</h2>
                    </div>
                    <div className="grid h-14 w-14 place-items-center rounded-full bg-white/70 text-coffee shadow-sm">
                      <Camera size={24} />
                    </div>
                  </div>

                  <label className="block">
                    <span className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
                      <UserRound size={16} />
                      Họ tên của bạn trong lớp {CLASS_NAME}
                    </span>
                    <input
                      className="input-field"
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value);
                        if (mode !== 'name') resetName();
                      }}
                      placeholder="Minh Tri"
                      autoComplete="name"
                      maxLength={40}
                    />
                  </label>

                  {mode !== 'name' && (
                    <m.label
                      initial={mobilePerformanceMode ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: mobilePerformanceMode ? 0 : 0.16, ease: 'easeOut' }}
                      className="block"
                    >
                      <span className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
                        <Lock size={16} />
                        {mode === 'login'
                          ? 'Tên này đã có. Nhập mật khẩu'
                          : nameWasDeleted
                            ? 'Tên này đã từng bị xóa. Đặt mật khẩu mới để tạo lại'
                            : 'Tên mới. Đặt mật khẩu'}
                      </span>
                      <div className="relative">
                        <input
                          className="input-field pr-14"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="Tối thiểu 6 ký tự"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                          minLength={6}
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/75 text-coffee shadow-sm transition hover:bg-white hover:text-ink focus:outline-none focus:ring-2 focus:ring-chalk/45 active:scale-95"
                          aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                          aria-pressed={showPassword}
                          onClick={() => setShowPassword((value) => !value)}
                        >
                          {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                        </button>
                      </div>
                    </m.label>
                  )}

                  {error && <p className="rounded-2xl bg-blush/35 px-4 py-3 text-sm font-semibold text-coffee">{error}</p>}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button className="primary-button min-h-13 justify-center" type="submit" disabled={isChecking}>
                      {isChecking
                        ? 'Đang kiểm tra...'
                        : mode === 'name'
                          ? 'Tiếp tục'
                          : mode === 'login'
                            ? 'Đăng nhập'
                            : 'Tạo tài khoản'}
                    </button>
                    <button className="secondary-button min-h-13 justify-center" type="button" onClick={onSkip}>
                      Explore First
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </m.div>
      </div>
    </section>
  );
}
