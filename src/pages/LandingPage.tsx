import { AnimatePresence, m } from 'framer-motion';
import {
  BadgeCheck,
  BookOpen,
  Camera,
  Download,
  Heart,
  Home,
  Lock,
  MessageCircle,
  Music,
  Music2,
  Search,
  Send,
  Sparkles,
  Upload,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { LANDING_SLIDES } from '../data/memories';
import { useAmbientTone } from '../hooks/useAmbientTone';
import { useMobilePerformanceMode } from '../hooks/useMobilePerformanceMode';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { useRafScrollProgress } from '../hooks/useRafScrollProgress';

interface LandingPageProps {
  onJoin: () => void;
  onExplore: () => void;
}

const quotes = [
  'One day, these memories will become the most beautiful part of our youth.',
  'The classroom was small, but our stories were wide as the sky.',
  'We were only students, and somehow that was everything.',
];

const logoSrc = `${import.meta.env.BASE_URL}logo-web-class-98.svg`;

const tutorialImage = (index: number) => LANDING_SLIDES[index % LANDING_SLIDES.length].src.replace('w=1800', 'w=900');

type TutorialKind = 'join' | 'feed' | 'photobook' | 'profile' | 'votes' | 'letters' | 'secret' | 'diary';
type TutorialDevice = 'phone' | 'desktop';

type TutorialStep = {
  title: string;
  text: string;
  where: string;
  action: string;
  result: string;
  highlight: string;
  image: string;
  alt: string;
  kind: TutorialKind;
};

const desktopTutorialSteps: TutorialStep[] = [
  {
    title: '1. Vào lớp 9/8',
    text: 'Bắt đầu bằng tài khoản theo họ tên thật trong lớp. Nếu tên chưa có, bạn đặt mật khẩu mới; nếu tên đã tồn tại, nhập đúng mật khẩu để quay lại hồ sơ của mình.',
    where: 'Intro → Join Memory Book',
    action: 'Nhập họ tên, sau đó đặt hoặc nhập mật khẩu.',
    result: 'Web nhận ra bạn để lưu ảnh, tim, bình luận, thư và nhật ký riêng.',
    highlight: 'Join Memory Book',
    image: tutorialImage(0),
    alt: 'Học sinh chụp ảnh kỷ niệm trong lớp học',
    kind: 'join',
  },
  {
    title: '2. Xem ký ức, tim và bình luận',
    text: 'Ở trang Ký ức, ảnh cập nhật theo thời gian thực. Bạn có thể tìm theo tên, lọc hashtag, bấm vào ảnh để xem rõ hơn, thả tim một lần và viết bình luận.',
    where: 'Navbar → Ký ức',
    action: 'Bấm ảnh để phóng to; dùng tim, bình luận hoặc nút tải ảnh trong popup xem ảnh.',
    result: 'Mỗi bức ảnh có tương tác rõ ràng và tải được trên điện thoại.',
    highlight: 'Ký ức',
    image: tutorialImage(1),
    alt: 'Bạn bè học sinh tạo dáng trong ngày tốt nghiệp',
    kind: 'feed',
  },
  {
    title: '3. Chụp hoặc upload photobook',
    text: 'Bấm Đăng ảnh hoặc Photobook, chọn số ảnh, kiểu layout, chất lượng, nền. Sau đó mở camera toàn màn hình hoặc upload ảnh có sẵn, chỉnh ảnh và chọn có làm đẹp hay không.',
    where: 'Ký ức / Hồ sơ → Đăng ảnh',
    action: 'Chọn layout, chụp từng tấm hoặc upload ảnh, xem trước rồi tạo photobook.',
    result: 'Ảnh cuối có thể đăng công khai lên Ký ức hoặc tải riêng về máy.',
    highlight: 'Đăng ảnh',
    image: tutorialImage(2),
    alt: 'Học sinh tốt nghiệp tung mũ trước trường',
    kind: 'photobook',
  },
  {
    title: '4. Hồ sơ lớp và album từng người',
    text: 'Trong Hồ sơ lớp, bấm vào một bạn để xem thông tin, ảnh đại diện, câu nói riêng và album của bạn đó. Muốn sửa hồ sơ của mình thì bấm Sửa hồ sơ để mở popup.',
    where: 'Navbar → Hồ sơ lớp',
    action: 'Bấm Xem hồ sơ trên thẻ bạn bè; bấm Sửa hồ sơ để cập nhật thông tin của mình.',
    result: 'Mỗi người có một góc kỷ yếu riêng, dễ tìm và dễ xem trên điện thoại.',
    highlight: 'Xem hồ sơ',
    image: tutorialImage(0),
    alt: 'Không khí lớp học và kỷ niệm tuổi học trò',
    kind: 'profile',
  },
  {
    title: '5. Bình chọn lớp 9/8',
    text: 'Bấm Tạo hạng mục mới để mở popup tạo danh hiệu. Sau đó cả lớp có thể vote một bạn trong từng hạng mục và đổi vote nếu bấm nhầm.',
    where: 'Navbar → Bình chọn',
    action: 'Tạo hạng mục, chọn biểu tượng, chọn tone màu rồi vote cho một bạn.',
    result: 'Bảng bình chọn hiện top 3, tổng lượt vote và lựa chọn của bạn.',
    highlight: 'Tạo hạng mục mới',
    image: tutorialImage(1),
    alt: 'Nhóm học sinh trong không khí kỷ yếu',
    kind: 'votes',
  },
  {
    title: '6. Bảng thư lớp',
    text: 'Bảng thư là nơi các mảnh thư được dán trên nền bảng học. Bấm một mảnh thư để đọc rõ hơn; bấm Viết thư để mở popup gửi có tên hoặc gửi ẩn danh.',
    where: 'Navbar → Bảng thư',
    action: 'Bấm Viết thư, chọn gửi có tên hoặc gửi ẩn danh.',
    result: 'Lời nhắn xuất hiện như giấy nhớ trên bảng lớp.',
    highlight: 'Viết thư',
    image: tutorialImage(2),
    alt: 'Bảng lớp và những mảnh ký ức học trò',
    kind: 'letters',
  },
  {
    title: '7. Secret Message',
    text: 'Secret Message có hai tab: Thư mình nhận và Thư mình gửi. Bấm Viết thư cho ai đó để chọn đúng một người trong lớp và gửi lời chưa kịp nói.',
    where: 'Navbar → Secret Message',
    action: 'Chọn người nhận, viết thư, chọn ẩn danh hoặc hiện tên, rồi gửi.',
    result: 'Người nhận có thể phản hồi bằng cảm xúc; người gửi xem được trạng thái đã gửi/đã xem.',
    highlight: 'Viết thư cho ai đó',
    image: tutorialImage(0),
    alt: 'Một góc lưu bút tuổi học trò',
    kind: 'secret',
  },
  {
    title: '8. Nhật ký bí mật',
    text: 'Nhật ký là nơi riêng tư cho những điều không chia sẻ với ai. Bấm Tạo nhật ký để mở popup viết; chỉ tài khoản của bạn thấy các trang nhật ký của mình.',
    where: 'Navbar → Nhật ký',
    action: 'Bấm Tạo nhật ký, viết nội dung rồi lưu.',
    result: 'Nhật ký được lưu riêng theo tên người viết và có thể xóa khi cần.',
    highlight: 'Tạo nhật ký',
    image: tutorialImage(1),
    alt: 'Trang giấy lưu bút và ký ức học trò',
    kind: 'diary',
  },
];

const phoneTutorialOverrides: Record<TutorialKind, Omit<Partial<TutorialStep>, 'kind' | 'image' | 'alt'>> = {
  join: {
    title: '1. Vào lớp 9/8 trên điện thoại',
    text: 'Trên điện thoại, mở trang intro rồi chạm Join Memory Book. Nhập đúng họ tên trong lớp 9/8; nếu tên mới thì đặt mật khẩu, nếu tên đã có thì nhập mật khẩu cũ.',
    where: 'Intro → Join Memory Book',
    action: 'Chạm từng ô nhập, dùng bàn phím điện thoại để nhập tên và mật khẩu, rồi bấm nút xác nhận.',
    result: 'Tài khoản của bạn được giữ lại trên điện thoại để xem ký ức, đăng ảnh, gửi thư và viết nhật ký riêng.',
    highlight: 'Chạm Join Memory Book',
  },
  feed: {
    title: '2. Lướt ký ức trên điện thoại',
    text: 'Trang Ký ức trên điện thoại được xếp một cột dễ vuốt. Dùng ô tìm kiếm ở đầu trang để tìm theo tên, chạm ảnh/video để mở popup xem rõ hơn.',
    where: 'Menu → Ký ức',
    action: 'Vuốt để xem feed, chạm vào ảnh để mở, chạm lần nữa vào ảnh để vào màn zoom rồi dùng hai ngón tay để phóng to/thu nhỏ.',
    result: 'Ảnh xem rõ trên màn hình nhỏ, có tim, bình luận và nút tải lớn nằm trong phần thông tin bên dưới.',
    highlight: 'Chạm ảnh để xem rõ',
  },
  photobook: {
    title: '3. Chụp hoặc upload bằng điện thoại',
    text: 'Bấm Đăng ảnh/video, chọn số tấm và layout. Khi mở camera, màn chụp sẽ gần full màn hình để dễ tạo dáng; cũng có thể upload ảnh sẵn từ thư viện điện thoại.',
    where: 'Ký ức → Đăng ảnh/video',
    action: 'Chọn layout, bấm Mở cam hoặc Upload ảnh, xem trước ảnh gốc và ảnh làm đẹp, rồi xác nhận từng tấm.',
    result: 'Photobook tạo ra đủ nét để đăng lên feed hoặc tải về máy mà không cần Firebase Storage.',
    highlight: 'Mở cam / Upload ảnh',
  },
  profile: {
    title: '4. Xem hồ sơ lớp trên điện thoại',
    text: 'Trong Hồ sơ lớp, các bạn được xếp thành card dọc. Chạm một bạn để mở popup hồ sơ; chỉ khi bấm Sửa hồ sơ mới hiện form chỉnh thông tin của bạn.',
    where: 'Menu → Hồ sơ lớp',
    action: 'Vuốt danh sách, chạm Xem hồ sơ, rồi mở album riêng của bạn đó ngay trong popup.',
    result: 'Mỗi bạn có một góc kỷ yếu riêng với avatar, biệt danh, câu nói và album đã đăng.',
    highlight: 'Chạm Xem hồ sơ',
  },
  votes: {
    title: '5. Bình chọn nhanh trên điện thoại',
    text: 'Trang Bình chọn hiển thị dạng card dọc. Chỉ khi bấm Tạo hạng mục mới hiện popup tạo danh hiệu, còn vote thì chạm vào tên một bạn trong danh sách.',
    where: 'Menu → Bình chọn',
    action: 'Chạm Tạo hạng mục nếu muốn tạo danh hiệu mới, hoặc vuốt từng card để vote/đổi vote cho một bạn.',
    result: 'Top 3, tổng vote và lựa chọn của bạn cập nhật gọn gàng trên màn hình điện thoại.',
    highlight: 'Chạm để vote',
  },
  letters: {
    title: '6. Đọc bảng thư trên điện thoại',
    text: 'Bảng thư hiện như những mảnh giấy dán trên bảng lớp. Trên điện thoại, chạm một lá thư để mở popup đọc rõ; chạm Viết thư để mở form gửi tin cho lớp.',
    where: 'Menu → Bảng thư',
    action: 'Chạm lá thư để đọc, hoặc bấm Viết thư rồi chọn gửi có tên hay ẩn danh.',
    result: 'Tin nhắn hiện trên bảng thư lớp theo dạng giấy nhớ, dễ đọc và dễ gửi bằng điện thoại.',
    highlight: 'Chạm lá thư / Viết thư',
  },
  secret: {
    title: '7. Secret Message trên điện thoại',
    text: 'Secret Message có tab Thư mình nhận và Thư mình gửi. Chỉ khi bấm Viết thư cho ai đó mới mở popup chọn người nhận và viết thư.',
    where: 'Menu → Secret Message',
    action: 'Chạm Viết thư cho ai đó, chọn một bạn, nhập nội dung, chọn ẩn danh nếu muốn rồi gửi.',
    result: 'Người nhận có thể thả một cảm xúc; bạn xem được trạng thái đã gửi, đã xem hoặc đã phản hồi.',
    highlight: 'Viết thư cho ai đó',
  },
  diary: {
    title: '8. Nhật ký riêng trên điện thoại',
    text: 'Nhật ký là nơi riêng tư cho những điều tiếc nuối chưa kịp nói. Trên điện thoại, chỉ khi bấm Tạo nhật ký mới mở popup viết nội dung.',
    where: 'Menu → Nhật ký',
    action: 'Bấm Tạo nhật ký, viết nội dung bằng bàn phím điện thoại rồi lưu. Có thể xóa trang nhật ký của mình khi cần.',
    result: 'Chỉ tài khoản của bạn thấy nhật ký trong web; manager vẫn lưu được tên người viết để quản lý.',
    highlight: 'Tạo nhật ký',
  },
};

const phoneTutorialSteps: TutorialStep[] = desktopTutorialSteps.map((step) => ({
  ...step,
  ...phoneTutorialOverrides[step.kind],
}));

const tutorialVisuals: Record<
  TutorialKind,
  { Icon: LucideIcon; nav: string[]; primary: string; secondary: string; details: string[] }
> = {
  join: {
    Icon: UserRound,
    nav: ['Intro', 'Join'],
    primary: 'Join Memory Book',
    secondary: 'Họ tên + mật khẩu',
    details: ['Tên lớp 9/8', 'Mật khẩu riêng', 'Lưu hồ sơ'],
  },
  feed: {
    Icon: Home,
    nav: ['Ký ức', 'Tìm kiếm', '#tag'],
    primary: 'Bấm ảnh để xem rõ',
    secondary: 'Tim • Bình luận • Tải ảnh',
    details: ['Realtime', 'Mỗi người 1 tim', 'Popup xem ảnh'],
  },
  photobook: {
    Icon: Camera,
    nav: ['Đăng ảnh', 'Layout', 'Camera'],
    primary: 'Chụp / Upload ảnh',
    secondary: 'Tạo photobook sắc nét',
    details: ['1/2/4/6 ảnh', 'Làm đẹp tùy chọn', 'Download hoặc đăng'],
  },
  profile: {
    Icon: UserRound,
    nav: ['Hồ sơ lớp', 'Album', 'Sửa hồ sơ'],
    primary: 'Xem hồ sơ',
    secondary: 'Popup sửa hồ sơ',
    details: ['Avatar', 'Biệt danh', 'Album riêng'],
  },
  votes: {
    Icon: BadgeCheck,
    nav: ['Bình chọn', 'Top 3', 'Vote'],
    primary: 'Tạo hạng mục mới',
    secondary: 'Chọn biểu tượng + tone màu',
    details: ['Một vote mỗi mục', 'Đổi vote được', 'Top 3 tự cập nhật'],
  },
  letters: {
    Icon: MessageCircle,
    nav: ['Bảng thư', 'Letters Wall', 'Popup đọc thư'],
    primary: 'Viết thư',
    secondary: 'Có tên hoặc ẩn danh',
    details: ['Dán lên bảng', 'Bấm để xem rõ', 'Xóa thư của mình'],
  },
  secret: {
    Icon: Heart,
    nav: ['Secret Message', 'Thư nhận', 'Thư gửi'],
    primary: 'Viết thư cho ai đó',
    secondary: 'Chọn người nhận',
    details: ['Ẩn danh tùy chọn', 'Cảm xúc phản hồi', 'Xóa thư đã gửi'],
  },
  diary: {
    Icon: Lock,
    nav: ['Nhật ký', 'Riêng tư', 'Lưu lại'],
    primary: 'Tạo nhật ký',
    secondary: 'Chỉ mình bạn thấy',
    details: ['Viết điều tiếc nuối', 'Lưu theo tài khoản', 'Có thể xóa'],
  },
};

const isPhoneTutorialViewport = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(max-width: 767px), (pointer: coarse) and (max-width: 900px)').matches;

function usePhoneTutorialMode() {
  const [isPhone, setIsPhone] = useState(() => isPhoneTutorialViewport());

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px), (pointer: coarse) and (max-width: 900px)');
    const update = () => setIsPhone(media.matches);

    update();
    media.addEventListener('change', update);

    return () => media.removeEventListener('change', update);
  }, []);

  return isPhone;
}

function TutorialIllustration({ step, device }: { step: TutorialStep; device: TutorialDevice }) {
  const visual = tutorialVisuals[step.kind];
  const Icon = visual.Icon;
  const DeviceIcon = device === 'phone' ? Camera : Home;
  const toolPills =
    device === 'phone'
      ? [
          { Icon: Search, label: 'Tìm' },
          { Icon: Upload, label: 'Thêm' },
          { Icon: Send, label: 'Gửi' },
        ]
      : [
          { Icon: Search, label: 'Tìm' },
          { Icon: Upload, label: 'Thêm' },
          { Icon: Download, label: 'Tải' },
          { Icon: Send, label: 'Gửi' },
        ];
  const deviceLabel = device === 'phone' ? 'Điện thoại' : 'Máy tính';

  return (
    <div className="relative min-h-64 overflow-hidden bg-ink">
      <img
        src={step.image}
        alt={step.alt}
        loading="lazy"
        decoding="async"
        sizes="(min-width: 1280px) 42vw, 92vw"
        className="absolute inset-0 h-full w-full object-cover opacity-70"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(21,16,12,.16),rgba(21,16,12,.58))]" />

      <div className="relative z-10 grid min-h-64 gap-3 p-3 text-paper sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 self-start">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1.5 text-[11px] font-black uppercase text-coffee shadow-paper">
            <DeviceIcon size={14} />
            {deviceLabel}
          </span>
          <div className="flex flex-wrap justify-end gap-1.5">
            {visual.nav.slice(0, 3).map((item) => (
              <span key={item} className="rounded-full bg-white/18 px-2.5 py-1 text-[10px] font-black uppercase text-paper/88 backdrop-blur-md">
                {item}
              </span>
            ))}
          </div>
        </div>

        {device === 'phone' ? (
          <div className="mx-auto w-[min(15.5rem,78vw)] rounded-[2rem] border-[7px] border-ink/88 bg-paper p-2 text-ink shadow-[0_24px_54px_rgba(18,15,13,.38)]">
            <div className="mx-auto mb-2 h-1.5 w-14 rounded-full bg-ink/20" />
            <div className="overflow-hidden rounded-[1.35rem] bg-cream">
              <div className="flex items-center justify-between bg-ink px-3 py-2 text-paper">
                <span className="text-[10px] font-black uppercase">Class 9/8</span>
                <Icon size={16} />
              </div>
              <div className="space-y-2 p-3">
                <div className="rounded-[0.9rem] bg-paper p-3 shadow-paper">
                  <p className="text-[10px] font-black uppercase text-coffee/70">Chạm vào</p>
                  <p className="mt-1 text-sm font-black leading-4">{step.highlight}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {visual.details.slice(0, 4).map((detail) => (
                    <span key={detail} className="rounded-[0.75rem] bg-white px-2 py-2 text-[10px] font-bold leading-3 text-ink/68">
                      {detail}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-around rounded-full bg-ink px-2 py-2 text-paper">
                  {toolPills.map(({ Icon: ToolIcon, label }) => (
                    <span key={label} className="grid h-8 w-8 place-items-center rounded-full bg-paper/12" title={label}>
                      <ToolIcon size={14} />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-[1rem] border border-white/24 bg-paper/94 p-2 text-ink shadow-glass">
            <div className="mb-2 flex items-center gap-1.5 rounded-t-[0.8rem] bg-ink/10 px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#e87d8c]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#f2c66d]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#7bbd8a]" />
              <span className="ml-2 min-w-0 flex-1 rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase text-coffee/60">
                memory-book-of-class98
              </span>
            </div>
            <div className="grid gap-3 p-2 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
              <div className="space-y-2 rounded-[0.8rem] bg-cream p-3">
                {visual.nav.map((item) => (
                  <span key={item} className="block rounded-full bg-white px-3 py-2 text-[11px] font-black text-coffee">
                    {item}
                  </span>
                ))}
              </div>
              <div className="min-w-0 rounded-[0.8rem] bg-white p-3 shadow-paper">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-paper shadow-paper">
                    <Icon size={20} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-coffee/70">Chỗ bấm trên máy tính</p>
                    <p className="mt-1 break-words text-lg font-black leading-5">{step.highlight}</p>
                  </div>
                </div>
                <div className="mt-3 rounded-[0.8rem] bg-cream px-3 py-2">
                  <p className="text-sm font-black">{visual.primary}</p>
                  <p className="mt-0.5 text-xs font-bold text-coffee/70">{visual.secondary}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {toolPills.map(({ Icon: ToolIcon, label }) => (
                    <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-1.5 text-[11px] font-bold text-paper">
                      <ToolIcon size={13} />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LandingPage({ onJoin, onExplore }: LandingPageProps) {
  const [active, setActive] = useState(0);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const mobilePerformanceMode = useMobilePerformanceMode();
  const isPhoneTutorial = usePhoneTutorialMode();
  const prefersReducedMotion = usePrefersReducedMotion();
  const reduceHeavyMotion = prefersReducedMotion || mobilePerformanceMode;
  const scrollProgress = useRafScrollProgress();
  const { enabled, toggle } = useAmbientTone();
  const activeQuote = useMemo(() => quotes[active % quotes.length], [active]);
  const activeSlide = LANDING_SLIDES[active % LANDING_SLIDES.length];
  const activeSlideSrc = mobilePerformanceMode ? activeSlide.src.replace('w=1800', 'w=900') : activeSlide.src;
  const tutorialDevice: TutorialDevice = isPhoneTutorial ? 'phone' : 'desktop';
  const visibleTutorialSteps = isPhoneTutorial ? phoneTutorialSteps : desktopTutorialSteps;
  const tutorialDeviceLabel = isPhoneTutorial ? 'điện thoại' : 'máy tính';
  const tutorialHeading = isPhoneTutorial ? 'Cách dùng trên điện thoại' : 'Cách dùng trên máy tính';
  const tutorialSummary = isPhoneTutorial
    ? 'Hướng dẫn này chỉ hiện cho người đang dùng điện thoại: thao tác chạm, vuốt, mở menu, zoom ảnh bằng tay, chụp/upload và gửi thư trên màn hình nhỏ.'
    : 'Hướng dẫn này chỉ hiện cho người đang dùng máy tính: dùng navbar, click chuột, popup rộng, tìm kiếm, tải ảnh và quản lý các mục bằng bố cục desktop.';
  const tutorialQuickSteps = isPhoneTutorial
    ? [
        ['1', 'Chạm để vào lớp'],
        ['2', 'Vuốt ký ức'],
        ['3', 'Zoom bằng tay'],
        ['4', 'Gửi thư'],
      ]
    : [
        ['1', 'Dùng navbar'],
        ['2', 'Click ảnh'],
        ['3', 'Tạo photobook'],
        ['4', 'Quản lý thư'],
      ];

  useEffect(() => {
    if (reduceHeavyMotion) return undefined;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % LANDING_SLIDES.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [reduceHeavyMotion]);

  useEffect(() => {
    const nextSlide = LANDING_SLIDES[(active + 1) % LANDING_SLIDES.length];
    const image = new Image();
    image.decoding = 'async';
    image.src = mobilePerformanceMode ? nextSlide.src.replace('w=1800', 'w=900') : nextSlide.src;
  }, [active, mobilePerformanceMode]);

  useEffect(() => {
    if (!tutorialOpen) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTutorialOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [tutorialOpen]);

  return (
    <div className="relative">
      <section className="relative min-h-[100svh] overflow-hidden">
        <div className="absolute inset-0">
          <AnimatePresence initial={false} mode="sync">
            <m.div
              key={activeSlideSrc}
              className="absolute inset-0 will-change-transform"
              style={{
                transform: `translate3d(0, ${scrollProgress * 24}px, 0) scale(1.04)`,
              }}
                initial={reduceHeavyMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduceHeavyMotion ? undefined : { opacity: 0 }}
                transition={{ duration: reduceHeavyMotion ? 0 : 1.2, ease: 'easeOut' }}
            >
              <img
                src={activeSlideSrc}
                alt={activeSlide.alt}
                loading={active === 0 ? 'eager' : 'lazy'}
                decoding="async"
                fetchPriority={active === 0 ? 'high' : 'auto'}
                sizes="100vw"
                className="h-full w-full object-cover"
                style={{ objectPosition: activeSlide.position }}
              />
            </m.div>
          </AnimatePresence>
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(21,16,12,.18),rgba(21,16,12,.34)_58%,rgba(251,243,231,.94))]" />
          <div className="absolute inset-0 bg-grain opacity-40 [background-size:16px_16px]" />
        </div>

        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <m.div
            className="floating-polaroid left-[7%] top-[18%] hidden rotate-[-8deg] sm:block"
            animate={reduceHeavyMotion ? undefined : { y: [0, -12, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="h-28 rounded bg-skySoft/70" />
          </m.div>
          <m.div
            className="floating-polaroid right-[8%] top-[24%] rotate-[7deg]"
            animate={reduceHeavyMotion ? undefined : { y: [0, 14, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="h-32 rounded bg-blush/70" />
          </m.div>
          <m.div
            className="floating-polaroid bottom-[13%] left-[15%] hidden rotate-[5deg] md:block"
            animate={reduceHeavyMotion ? undefined : { y: [0, 10, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="h-24 rounded bg-[#f4dfbf]" />
          </m.div>
        </div>

        <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          <header className="flex items-center justify-between gap-4">
            <div className="hidden items-center gap-2 rounded-full bg-white/35 px-3 py-2 shadow-glass backdrop-blur-xl sm:inline-flex">
              <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-paper ring-1 ring-coffee/15">
                <img src={logoSrc} alt="" className="h-8 w-8 object-contain" loading="eager" decoding="async" />
              </span>
              <span className="pr-1 text-sm font-bold text-ink">Class 98</span>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-full bg-white/35 px-3 py-2 text-sm font-bold text-ink shadow-glass backdrop-blur-xl transition hover:bg-white/55"
              onClick={toggle}
            >
              {enabled ? <Music2 size={17} /> : <Music size={17} />}
              {enabled ? 'Music On' : 'Music Off'}
            </button>
            <div className="flex items-center gap-2">
              <button className="secondary-button intro-header-button bg-white/40 backdrop-blur-xl" onClick={() => setTutorialOpen(true)}>
                <BookOpen size={17} />
                Tutorial
              </button>
              <button className="secondary-button intro-header-button hidden bg-white/40 backdrop-blur-xl sm:inline-flex" onClick={onExplore}>
                Explore Memories
              </button>
            </div>
          </header>

          <div className="flex flex-1 items-center">
            <div className="max-w-4xl py-16 text-paper drop-shadow-[0_18px_38px_rgba(53,41,31,.32)]">
              <m.p
                className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-xs font-bold uppercase text-white backdrop-blur-md"
                initial={reduceHeavyMotion ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceHeavyMotion ? 0 : 0.45 }}
              >
                <Sparkles size={15} />
                Graduation memory archive
              </m.p>

              <m.h1
                className="font-display text-7xl leading-[0.82] xs:text-8xl sm:text-9xl lg:text-[10rem] 3xl:text-[12rem]"
                initial={reduceHeavyMotion ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceHeavyMotion ? 0 : 0.55, delay: reduceHeavyMotion ? 0 : 0.05 }}
              >
                School Memory Photobook
              </m.h1>

              <m.p
                key={activeQuote}
                className="mt-7 max-w-2xl font-hand text-4xl leading-tight text-white sm:text-5xl"
                initial={reduceHeavyMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceHeavyMotion ? 0 : 0.55 }}
              >
                {activeQuote}
              </m.p>

              <m.div
                className="mt-8 flex flex-col gap-3 sm:flex-row"
                initial={reduceHeavyMotion ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceHeavyMotion ? 0 : 0.5, delay: reduceHeavyMotion ? 0 : 0.16 }}
              >
                <button className="primary-button min-h-14 px-7 text-base" onClick={onJoin}>
                  <Camera size={19} />
                  Join Memory Book
                </button>
                <button className="secondary-button min-h-14 px-7 text-base" onClick={onExplore}>
                  Explore Memories
                </button>
                <button className="secondary-button min-h-14 px-7 text-base" onClick={() => setTutorialOpen(true)}>
                  <BookOpen size={19} />
                  Tutorial
                </button>
              </m.div>
            </div>
          </div>

          <div className="grid gap-3 rounded-[1.25rem] border border-white/35 bg-white/20 p-3 text-white shadow-glass backdrop-blur-xl sm:grid-cols-3">
            {['Korean photo booth', 'Scrapbook journal', 'Graduation keepsake'].map((item) => (
              <div key={item} className="rounded-2xl bg-white/18 px-4 py-3 text-sm font-semibold">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <AnimatePresence>
        {tutorialOpen && (
          <m.div
            className="fixed inset-0 z-50 grid place-items-center bg-ink/82 p-3 backdrop-blur-sm sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label={`Hướng dẫn sử dụng Memory Book trên ${tutorialDeviceLabel}`}
            initial={reduceHeavyMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceHeavyMotion ? undefined : { opacity: 0 }}
            transition={{ duration: reduceHeavyMotion ? 0 : 0.18 }}
            onClick={() => setTutorialOpen(false)}
          >
            <m.div
              className="relative max-h-[92svh] w-full max-w-6xl overflow-auto rounded-[1.25rem] bg-paper p-4 text-ink shadow-glass sm:p-6"
              initial={reduceHeavyMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceHeavyMotion ? undefined : { opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: reduceHeavyMotion ? 0 : 0.22, ease: 'easeOut' }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-ink text-paper shadow-paper"
                onClick={() => setTutorialOpen(false)}
                aria-label="Đóng tutorial"
              >
                <X size={19} />
              </button>

              <div className="pr-12">
                <p className="section-kicker">Tutorial {tutorialDeviceLabel}</p>
                <h2 className="font-display text-5xl leading-none sm:text-7xl">{tutorialHeading}</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-ink/66">
                  {tutorialSummary}
                </p>
              </div>

              <div className="mt-5 grid gap-2 rounded-[1rem] bg-white/55 p-2 sm:grid-cols-4">
                {tutorialQuickSteps.map(([index, label]) => (
                  <div key={index} className="rounded-[0.8rem] bg-paper/78 px-3 py-3 text-center">
                    <span className="mx-auto grid h-7 w-7 place-items-center rounded-full bg-ink text-xs font-black text-paper">{index}</span>
                    <p className="mt-2 text-xs font-black uppercase text-coffee/70">{label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                {visibleTutorialSteps.map((step) => (
                  <article key={step.title} className="overflow-hidden rounded-[1rem] bg-white/62 shadow-paper">
                    <TutorialIllustration step={step} device={tutorialDevice} />
                    <div className="p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-4xl leading-none">{step.title}</h3>
                        <span className="rounded-full bg-coffee/10 px-3 py-1 text-[11px] font-black uppercase text-coffee">
                          {step.where}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-7 text-ink/68">{step.text}</p>
                      <div className="mt-3 grid gap-2 text-xs font-bold text-ink/64 sm:grid-cols-2">
                        <p className="rounded-[0.75rem] bg-paper/76 px-3 py-2">
                          <span className="block uppercase text-coffee/70">Cách làm</span>
                          {step.action}
                        </p>
                        <p className="rounded-[0.75rem] bg-paper/76 px-3 py-2">
                          <span className="block uppercase text-coffee/70">Kết quả</span>
                          {step.result}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  className="primary-button min-h-12 px-6"
                  onClick={() => {
                    setTutorialOpen(false);
                    onJoin();
                  }}
                >
                  <Camera size={18} />
                  Bắt đầu vào lớp
                </button>
                <button
                  className="secondary-button min-h-12 px-6"
                  onClick={() => {
                    setTutorialOpen(false);
                    onExplore();
                  }}
                >
                  Xem ký ức
                </button>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      <section className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            ['Capture', 'Large webcam previews, countdown, flash, and retake controls.'],
            ['Create', 'Printable high-resolution strips with names, class, date, and notes.'],
            ['Remember', 'Share publicly to the feed or keep a private download.'],
          ].map(([title, text]) => (
            <div key={title} className="rounded-[1.25rem] bg-white/45 p-5 shadow-paper backdrop-blur-xl">
              <h2 className="font-display text-4xl">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-ink/68">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
