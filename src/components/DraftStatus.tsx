import { CheckCheck } from 'lucide-react';
import { memo } from 'react';

interface DraftStatusProps {
  hasDraft: boolean;
  restored?: boolean;
}

function DraftStatus({ hasDraft, restored = false }: DraftStatusProps) {
  if (!hasDraft) return null;

  return (
    <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-paper/78 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.04em] text-coffee shadow-sm">
      <CheckCheck size={13} />
      {restored ? 'Đã khôi phục nháp trên máy này' : 'Nháp đang tự lưu'}
    </p>
  );
}

export default memo(DraftStatus);
