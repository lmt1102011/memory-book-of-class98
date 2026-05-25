import { Component, type ErrorInfo, type ReactNode } from 'react';
import { recoverFromAppLoadError } from '../utils/appUpdateRecovery';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  crashed: boolean;
  recovering: boolean;
}

export default class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    crashed: false,
    recovering: false,
  };

  static getDerivedStateFromError() {
    return { crashed: true, recovering: false };
  }

  componentDidCatch(error: unknown, _info: ErrorInfo) {
    const recovering = recoverFromAppLoadError(error);
    this.setState({ crashed: true, recovering });
  }

  render() {
    if (!this.state.crashed) return this.props.children;

    return (
      <div className="grid min-h-[100svh] place-items-center bg-[#fbf3e7] px-5 text-center text-[#4f3428]">
        <div className="w-full max-w-sm rounded-[1.5rem] border border-[#4f3428]/12 bg-[#fffcf6] p-6 shadow-[0_20px_54px_rgba(79,52,40,0.14)]">
          <img
            className="mx-auto h-20 w-20 rounded-[1.35rem] bg-[#fff7ee] object-contain shadow-[0_10px_24px_rgba(79,52,40,0.13)]"
            src="./logo-web-class-98.png"
            alt="Memory98"
          />
          <h1 className="mt-4 text-lg font-black">
            {this.state.recovering ? 'Đang tải lại bản mới nhất...' : 'Không thể mở trang lúc này'}
          </h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#4f3428]/70">
            {this.state.recovering
              ? 'Ứng dụng đang xóa cache cũ và tự mở lại để tránh lỗi thiếu file.'
              : 'Bạn hãy tải lại trang một lần. Nếu vẫn lỗi, đóng app rồi mở lại.'}
          </p>
          <button
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-[#35291f] px-5 text-sm font-black text-[#fffaf1]"
            type="button"
            onClick={() => window.location.reload()}
          >
            Tải lại ngay
          </button>
        </div>
      </div>
    );
  }
}
