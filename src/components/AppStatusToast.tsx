interface AppStatusToastProps {
  isOnline: boolean;
  justRestored: boolean;
}

export default function AppStatusToast({ isOnline, justRestored }: AppStatusToastProps) {
  if (isOnline && !justRestored) return null;

  return (
    <div
      className={`app-status-toast ${isOnline ? 'app-status-toast-online' : 'app-status-toast-offline'}`}
      role="status"
      aria-live="polite"
    >
      <span className="app-status-dot" aria-hidden="true" />
      <span>
        <strong>{isOnline ? 'Đã có mạng lại' : 'Bạn đang offline'}</strong>
        <small>
          {isOnline
            ? 'Ký ức và bình luận sẽ tự cập nhật tiếp.'
            : 'Bạn vẫn xem được phần đã tải, dữ liệu mới sẽ cập nhật khi có mạng.'}
        </small>
      </span>
    </div>
  );
}
