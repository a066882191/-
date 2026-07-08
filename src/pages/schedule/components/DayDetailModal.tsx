import type { DayLeaveInfo } from './CalendarGrid';

interface DayDetailModalProps {
  dateStr: string;
  leaves: DayLeaveInfo[];
  onClose: () => void;
}

function formatDateTime(isoStr: string) {
  const d = new Date(isoStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${month}月${day}日 ${hours}:${mins}`;
}

function statusBadge(status: string) {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-100">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        已核准
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-100">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        待審核
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-medium border border-red-100">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        已駁回
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 text-xs font-medium border border-stone-200">
      <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
      已取消
    </span>
  );
}

export default function DayDetailModal({ dateStr, leaves, onClose }: DayDetailModalProps) {
  const dateObj = new Date(dateStr);
  const weekDayNames = ['日', '一', '二', '三', '四', '五', '六'];
  const title = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日（${weekDayNames[dateObj.getDay()]}）`;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white w-full max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[80vh] flex flex-col animate-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-stone-800">{title}</h3>
            <p className="text-xs text-stone-400 mt-0.5">
              共 {leaves.length} 筆請假紀錄
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 transition-colors"
          >
            <i className="ri-close-line text-lg text-stone-500" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-4 space-y-3">
          {leaves.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-2">
                <i className="ri-calendar-check-line text-xl text-stone-300" />
              </div>
              <p className="text-sm text-stone-400">當天無人請假</p>
            </div>
          ) : (
            leaves.map((leave) => (
              <div
                key={leave.id}
                className={`bg-white border rounded-xl p-3.5 ${
                  leave.status === 'rejected' ? 'border-stone-200 opacity-70' : 'border-stone-100'
                }`}
              >
                {/* Top row: name + status */}
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-xs font-bold text-stone-600">
                      {leave.employeeName.slice(0, 1)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-stone-800">{leave.employeeName}</p>
                      <p className="text-[11px] text-stone-400">{leave.title}</p>
                    </div>
                  </div>
                  {statusBadge(leave.status)}
                </div>

                {/* Leave type badge */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${leave.leaveTypeColor}`}>
                    <i className={leave.leaveTypeIcon} />
                    {leave.leaveTypeName}
                  </span>
                </div>

                {/* Apply time - 這是核心要求 */}
                <div className="flex items-center gap-1.5 bg-amber-50 rounded-lg px-2.5 py-1.5 border border-amber-100">
                  <i className="ri-time-line text-amber-500 text-xs" />
                  <span className="text-xs font-medium text-amber-800">
                    申請時間：{formatDateTime(leave.createdAt)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer close button for mobile */}
        <div className="p-3 border-t border-stone-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-stone-800 hover:bg-stone-900 text-white font-medium py-2.5 rounded-xl text-sm transition-colors whitespace-nowrap"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}