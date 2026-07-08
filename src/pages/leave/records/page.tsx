import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { leaveTypes } from '@/mocks/leaveTypes';
import { getLeaveRequests, useLeaveStore, cancelLeaveRequest } from '@/stores/leaveStore';

export default function LeaveRecordsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  useLeaveStore();

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'processed'>('all');
  const [cancelModalReq, setCancelModalReq] = useState<string | null>(null);
  const [cancelMsg, setCancelMsg] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const allRequests = getLeaveRequests();
  const myRequests = allRequests.filter((r) => r.employee_id === user?.id);

  const processedStatuses = ['approved', 'rejected', 'cancelled'];

  const filteredRequests = statusFilter === 'all'
    ? myRequests
    : statusFilter === 'pending'
      ? myRequests.filter((r) => r.status === 'pending')
      : myRequests.filter((r) => processedStatuses.includes(r.status));

  const sortedRequests = [...filteredRequests].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // 判斷申請是否在 24 小時取消窗口內
  function isWithinCancelWindow(createdAt: string): boolean {
    const createdTime = new Date(createdAt).getTime();
    const hoursDiff = (Date.now() - createdTime) / (1000 * 60 * 60);
    return hoursDiff <= 24;
  }

  const statusConfig: Record<string, { label: string; color: string; dot: string; bg: string }> = {
    pending: { label: t('pending'), color: 'text-amber-700', dot: 'bg-amber-500', bg: 'bg-amber-50 border-amber-200' },
    approved: { label: t('approved'), color: 'text-emerald-700', dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-200' },
    rejected: { label: t('rejected'), color: 'text-red-700', dot: 'bg-red-500', bg: 'bg-red-50 border-red-200' },
    cancelled: { label: '已取消', color: 'text-stone-500', dot: 'bg-stone-400', bg: 'bg-stone-100 border-stone-200' },
  };

  const filters: { key: typeof statusFilter; label: string; count: number }[] = [
    { key: 'all', label: '全部', count: myRequests.length },
    { key: 'pending', label: t('pending'), count: myRequests.filter((r) => r.status === 'pending').length },
    { key: 'processed', label: '已處理', count: myRequests.filter((r) => processedStatuses.includes(r.status)).length },
  ];

  function handleCancelClick(reqId: string) {
    setCancelModalReq(reqId);
  }

  async function confirmCancel() {
    if (!user || !cancelModalReq) return;
    setCancelLoading(true);
    try {
      const result = await cancelLeaveRequest(user.id, cancelModalReq);
      setCancelModalReq(null);
      if (!result.success) {
        setCancelMsg(result.error || '取消失敗');
      } else {
        setCancelMsg('已取消申請');
      }
    } catch (err) {
      setCancelModalReq(null);
      setCancelMsg(err instanceof Error ? err.message : '取消失敗');
    } finally {
      setCancelLoading(false);
      setTimeout(() => setCancelMsg(null), 2000);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      {/* Header */}
      <div className="bg-white px-4 py-4 border-b border-stone-100 flex items-center gap-3">
        <button
          onClick={() => navigate('/dashboard')}
          className="w-8 h-8 flex items-center justify-center text-stone-500 hover:text-stone-700"
        >
          <i className="ri-arrow-left-line text-xl" />
        </button>
        <h1 className="text-lg font-bold text-stone-800">{t('leave_records')}</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Status Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                statusFilter === f.key
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              {f.label}
              <span className={`ml-1 ${statusFilter === f.key ? 'text-emerald-100' : 'text-stone-400'}`}>
                ({f.count})
              </span>
            </button>
          ))}
        </div>

        {/* Toast */}
        {cancelMsg && (
          <div className="mb-3 bg-white border border-stone-200 rounded-xl px-4 py-3 flex items-center gap-2 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
            <i className={cancelMsg.includes('已取消') ? 'ri-checkbox-circle-line text-emerald-500' : 'ri-error-warning-line text-red-500'} />
            <span className={`text-sm font-medium ${cancelMsg.includes('已取消') ? 'text-emerald-700' : 'text-red-700'}`}>
              {cancelMsg}
            </span>
          </div>
        )}

        {/* Records List */}
        {sortedRequests.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-stone-100 mt-4">
            <i className="ri-inbox-line text-4xl text-stone-300 mb-3" />
            <p className="text-sm text-stone-400">{t('no_records')}</p>
          </div>
        ) : (
          <div className="space-y-3 mt-2">
            {sortedRequests.map((req) => {
              const status = statusConfig[req.status];
              const typeInfo = leaveTypes.find((t) => t.id === req.leave_type);
              const dateStr = new Date(req.created_at).toLocaleDateString('zh-TW', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div key={req.id} className="bg-white rounded-xl p-4 border border-stone-100">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${status.bg} ${status.color}`}>
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${status.dot} mr-1`} />
                        {status.label}
                      </span>
                    </div>
                    <span className="text-[10px] text-stone-400">{dateStr}</span>
                  </div>

                  <div className="flex items-center gap-2 mt-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${typeInfo?.color}`}>
                      <i className={`${typeInfo?.icon} text-xs`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stone-800">{typeInfo?.name}</p>
                      <p className="text-xs text-stone-500">
                        {req.start_date} ~ {req.end_date} · {req.days_count} 天
                      </p>
                    </div>
                  </div>

                  {req.work_shift && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="w-5 h-5 rounded flex items-center justify-center bg-stone-100">
                        <i className="ri-briefcase-line text-[10px] text-stone-500" />
                      </div>
                      <span className="text-xs text-stone-500">當天工作班：{req.work_shift}</span>
                    </div>
                  )}

                  <p className="text-xs text-stone-500 mt-2 bg-stone-50 rounded-lg px-3 py-2">
                    {req.reason}
                  </p>

                  {/* Cancel button for pending requests — 24h window */}
                  {req.status === 'pending' && (
                    <div className="mt-2.5 pt-2.5 border-t border-stone-100 flex items-center justify-between">
                      {isWithinCancelWindow(req.created_at) ? (
                        <>
                          <span className="text-[10px] text-stone-400">可於申請後 24 小時內取消</span>
                          <button
                            onClick={() => handleCancelClick(req.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors flex items-center gap-1"
                          >
                            <i className="ri-close-line" />
                            取消申請
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] text-stone-400 flex items-center gap-1">
                            <i className="ri-time-line" />
                            申請已超過 24 小時，無法取消
                          </span>
                          <span className="text-[10px] text-stone-400 px-2 py-1 rounded bg-stone-100">不可取消</span>
                        </>
                      )}
                    </div>
                  )}

                  {req.status !== 'pending' && req.approver_comment && (
                    <p className="text-[10px] text-stone-400 mt-2">
                      審核意見：{req.approver_comment}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cancel Confirm Modal */}
      {cancelModalReq && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden animate-[slideUp_0.2s_ease-out]">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-stone-800">確認取消申請</h2>
              <button
                onClick={() => setCancelModalReq(null)}
                className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-600"
              >
                <i className="ri-close-line text-xl" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center mx-auto">
                <i className="ri-question-line text-2xl text-orange-500" />
              </div>
              <p className="text-sm text-stone-600 text-center">確定要取消這筆請假申請嗎？</p>
            </div>
            <div className="px-5 py-4 border-t border-stone-100 flex gap-3">
              <button
                onClick={() => setCancelModalReq(null)}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 transition-colors"
              >
                保留申請
              </button>
              <button
                onClick={confirmCancel}
                disabled={cancelLoading}
                className="flex-[2] py-2.5 rounded-xl text-white text-sm font-medium bg-red-500 hover:bg-red-600 transition-colors disabled:bg-red-300 flex items-center justify-center gap-1"
              >
                {cancelLoading ? (
                  <>
                    <i className="ri-loader-4-line animate-spin" />
                    處理中...
                  </>
                ) : (
                  '確認取消'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}