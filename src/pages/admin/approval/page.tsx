import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { leaveTypes } from '@/mocks/leaveTypes';
import { getLeaveRequests, useLeaveStore, loadLeaveRequests, supervisorCancelLeaveDays, getRequestDayStatusMap, getDayCancelledMap, isDayCancelled, approveRejectDay, removeDayApproval } from '@/stores/leaveStore';
import type { LeaveRequest } from '@/stores/leaveStore';
import ShiftImagesTab from '@/pages/admin/approval/components/ShiftImagesTab';
import ExportTab from '@/pages/admin/approval/components/ExportTab';
import {
  requestOverlapsMonth,
  requestCoversDate,
} from '@/pages/admin/approval/utils/leaveHelpers';

export default function AdminApprovalPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  useLeaveStore();

  useEffect(() => {
    loadLeaveRequests();
  }, []);

  const today = new Date();

  const [activeTab, setActiveTab] = useState<'pending' | 'shiftImages' | 'export'>('pending');

  const [cancelMsg, setCancelMsg] = useState<string | null>(null);

  const [expandedTodaySection, setExpandedTodaySection] = useState(true);
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth() + 1);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [dayProcessingMap, setDayProcessingMap] = useState<Record<string, boolean>>({});
  const [locallyReviewedDays, setLocallyReviewedDays] = useState<Record<string, 'approved' | 'rejected'>>({});
  const [locallyCancelledDays, setLocallyCancelledDays] = useState<Record<string, boolean>>({});
  const calendarRefreshKey = useState(0)[1];
  const calendarMonthLabel = `${calendarYear} 年 ${calendarMonth} 月`;

  useEffect(() => {
    setDayProcessingMap({});
    setLocallyReviewedDays({});
  }, [activeTab, calendarYear, calendarMonth]);

  function goCalendarPrevMonth() {
    if (calendarMonth === 1) {
      setCalendarMonth(12);
      setCalendarYear(calendarYear - 1);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  }

  function goCalendarNextMonth() {
    if (calendarMonth === 12) {
      setCalendarMonth(1);
      setCalendarYear(calendarYear + 1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  }

  function goCalendarToday() {
    setCalendarYear(today.getFullYear());
    setCalendarMonth(today.getMonth() + 1);
  }

  if (user?.role !== 'manager') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center pb-24">
        <div className="text-center px-4">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <i className="ri-shield-cross-line text-3xl text-red-500" />
          </div>
          <p className="text-stone-600 font-medium">無權限訪問</p>
          <p className="text-sm text-stone-400 mt-1">此頁面僅供主管使用</p>
        </div>
      </div>
    );
  }

  const allRequests = getLeaveRequests();
  const pendingRequests = allRequests.filter((r) => r.status === 'pending');

  const todayStr = new Date().toISOString().split('T')[0];
  const todayRequests = pendingRequests.filter((r) => {
    const reqDate = r.created_at.split('T')[0];
    return reqDate === todayStr;
  });

  const sortedAll = [...allRequests].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const formatDateTime = (isoString: string) => {
    const d = new Date(isoString);
    return {
      date: d.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' }),
      time: d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
      full: d.toLocaleString('zh-TW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'short',
      }),
    };
  };

  const handleDayAction = async (req: LeaveRequest, date: string, action: 'approved' | 'rejected' | 'remove') => {
    if (!user) return;
    const dayKey = `${req.id}_${date}`;
    setDayProcessingMap((prev) => ({ ...prev, [dayKey]: true }));
    try {
      if (action === 'remove') {
        await removeDayApproval(req.id, date);
        setLocallyReviewedDays((prev) => {
          const next = { ...prev };
          delete next[dayKey];
          return next;
        });
      } else {
        await approveRejectDay(req.id, date, action, user.id, '');
        setLocallyReviewedDays((prev) => ({ ...prev, [dayKey]: action }));
      }
    } catch (err) {
      console.error('逐日審核失敗:', err);
    } finally {
      setDayProcessingMap((prev) => ({ ...prev, [dayKey]: false }));
    }
  };

  const handleDayCancel = async (req: LeaveRequest, date: string) => {
    if (!user) return;
    const dayKey = `${req.id}_${date}`;
    setDayProcessingMap((prev) => ({ ...prev, [dayKey]: true }));
    try {
      const result = await supervisorCancelLeaveDays(req.id, [date], user.id);
      if (result.success) {
        setLocallyCancelledDays((prev) => ({ ...prev, [dayKey]: true }));
        setCancelMsg(`已取消 ${req.employee_name} ${date} 的請假`);
        setTimeout(() => setCancelMsg(null), 2500);
      } else {
        setCancelMsg(result.error || '取消失敗');
        setTimeout(() => setCancelMsg(null), 2500);
      }
    } catch (err) {
      console.error('逐日取消失敗:', err);
      setCancelMsg(err instanceof Error ? err.message : '取消失敗');
      setTimeout(() => setCancelMsg(null), 2500);
    } finally {
      setDayProcessingMap((prev) => ({ ...prev, [dayKey]: false }));
    }
  };



  const statusConfig: Record<string, { label: string; color: string; dot: string; bg: string }> = {
    pending: { label: t('pending'), color: 'text-amber-700', dot: 'bg-amber-500', bg: 'bg-amber-50 border-amber-200' },
    approved: { label: t('approved'), color: 'text-emerald-700', dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-200' },
    rejected: { label: t('rejected'), color: 'text-red-700', dot: 'bg-red-500', bg: 'bg-red-50 border-red-200' },
    cancelled: { label: '已取消', color: 'text-stone-500', dot: 'bg-stone-400', bg: 'bg-stone-100 border-stone-200' },
  };

  // ── 共用月曆 JSX ──
  const calendarGrid = (
    <div className="-mx-4 px-4 space-y-3 mb-4">
      {/* Month navigator */}
      <div className="bg-white rounded-xl border border-stone-100 px-3 py-2.5 flex items-center justify-between max-w-lg mx-auto">
        <button
          onClick={goCalendarPrevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-50 transition-colors"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-arrow-left-s-line text-lg text-stone-600" />
          </div>
        </button>
        <div className="text-center flex items-center gap-2">
          <p className="text-sm font-bold text-stone-800">{calendarMonthLabel}</p>
          <button
            onClick={goCalendarToday}
            className="text-[10px] font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded transition-colors whitespace-nowrap"
          >
            本月
          </button>
        </div>
        <button
          onClick={goCalendarNextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-50 transition-colors"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-arrow-right-s-line text-lg text-stone-600" />
          </div>
        </button>
      </div>

      {/* Calendar Grid */}
      {(() => {
        const monthRequests = (() => {
          const base = sortedAll.filter(
            (r) => requestOverlapsMonth(r, calendarYear, calendarMonth),
          );
          const hasLocalReviews = Object.keys(locallyReviewedDays).some((k) =>
            base.some((b) => k.startsWith(`${b.id}_`)),
          );
          if (hasLocalReviews) {
            const reviewedItems = allRequests.filter(
              (r) =>
                requestOverlapsMonth(r, calendarYear, calendarMonth) &&
                Object.keys(locallyReviewedDays).some((k) => k.startsWith(`${r.id}_`)) &&
                !base.some((b) => b.id === r.id),
            );
            return [...base, ...reviewedItems].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          }
          return base;
        })();
        const daysInMonth = new Date(calendarYear, calendarMonth, 0).getDate();
        const firstWeekday = new Date(calendarYear, calendarMonth - 1, 1).getDay();
        const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

        return (
          <div
            className="bg-white rounded-xl border border-stone-100 overflow-hidden cursor-pointer group relative hidden md:block"
            onClick={() => setLightboxOpen(true)}
          >
            <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="bg-black/60 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
                <i className="ri-fullscreen-line" />
                點擊放大
              </div>
            </div>

            <div className="overflow-x-auto" style={{ fontFamily: '"DFKai-SB", "BiauKai", "標楷體", "KaiTi", serif' }}>
              <div className="min-w-[900px] text-center">
                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-0">
                  {weekdays.map((w) => (
                    <div key={w} className={`text-center text-sm font-bold text-stone-700 py-2 border border-black ${w === '日' || w === '六' ? 'bg-stone-200/70' : 'bg-stone-50'}`}>
                      {w}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-0">
                  {Array.from({ length: totalCells }).map((_, idx) => {
                    const dayNum = idx - firstWeekday + 1;
                    const isWeekend = idx % 7 === 0 || idx % 7 === 6;
                    if (dayNum < 1 || dayNum > daysInMonth) {
                      return <div key={idx} className={`border border-black min-h-[100px] ${isWeekend ? 'bg-stone-100/70' : 'bg-stone-50/40'}`} />;
                    }
                    const dateStr = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                    const dayRequests = monthRequests
                      .filter((r) => requestCoversDate(r, dateStr))
                      .slice(0, 12);
                    const hasRequests = dayRequests.length > 0;

                    const getDayReviewStatus = (reqId: string, d: string): 'approved' | 'rejected' | undefined => {
                      const dayKey = `${reqId}_${d}`;
                      if (locallyReviewedDays[dayKey]) return locallyReviewedDays[dayKey];
                      const storeMap = getRequestDayStatusMap(reqId);
                      return storeMap[d];
                    };

                    return (
                      <div key={idx} className={`border border-black p-2 min-h-[200px] flex flex-col ${isWeekend ? 'bg-stone-50/80' : 'bg-white'}`}>
                        <div className={`text-sm font-bold mb-1.5 text-center border-b pb-1 ${hasRequests ? 'text-amber-700 border-amber-400' : 'text-stone-600 border-black'}`}>
                          {dayNum} <span className="text-stone-400 font-normal text-xs">週{weekdays[idx % 7]}</span>
                        </div>
                        {hasRequests ? (
                          <div className="flex-1 space-y-0.5">
                            {dayRequests.map((req, ri) => {
                              const typeInfo = leaveTypes.find((t) => t.id === req.leave_type);
                              const status = statusConfig[req.status];
                              const dayKey = `${req.id}_${dateStr}`;
                              const dayReviewStatus = getDayReviewStatus(req.id, dateStr);
                              const isProcessing = dayProcessingMap[dayKey];
                              const isPendingItem = req.status === 'pending' && !dayReviewStatus;
                              const isCancelled = req.status === 'cancelled';
                              const isDayCancelledLocal = isDayCancelled(req.id, dateStr) || !!locallyCancelledDays[dayKey];
                              return (
                                <div
                                  key={ri}
                                  className={`relative flex items-center gap-1 text-[10px] leading-tight py-0.5 px-0.5 rounded group ${isPendingItem ? 'bg-amber-50/70' : ''} ${dayReviewStatus ? 'opacity-90' : ''} ${isCancelled ? 'bg-stone-200/50' : ''} ${isDayCancelledLocal ? 'bg-orange-50/50' : ''}`}
                                  title={dayReviewStatus ? (dayReviewStatus === 'approved' ? '已核准此日' : '已駁回此日') : isCancelled || isDayCancelledLocal ? '已取消此日' : isPendingItem ? '待審核' : ''}
                                >
                                  {(isCancelled || isDayCancelledLocal) && (
                                    <div className="absolute inset-y-0 left-0 right-0 flex items-center pointer-events-none z-10">
                                      <div className="w-full h-[2px] bg-stone-500/80" />
                                    </div>
                                  )}
                                  {isProcessing ? (
                                    <i className="ri-loader-4-line animate-spin text-amber-500 flex-shrink-0 text-[10px]" />
                                  ) : dayReviewStatus ? (
                                    dayReviewStatus === 'approved' ? (
                                      <i className="ri-checkbox-circle-fill text-emerald-500 flex-shrink-0 text-[10px]" />
                                    ) : (
                                      <i className="ri-close-circle-fill text-red-400 flex-shrink-0 text-[10px]" />
                                    )
                                  ) : isCancelled || isDayCancelledLocal ? (
                                    <i className="ri-close-circle-line text-stone-400 flex-shrink-0 text-[10px]" />
                                  ) : (
                                    <span className={`w-1 h-1 rounded-full flex-shrink-0 ${status.dot}`} />
                                  )}
                                  <span className={`truncate font-semibold ${isCancelled || isDayCancelledLocal ? 'text-stone-400 line-through' : 'text-stone-700'}`}>{req.employee_name}</span>
                                  <span className={`truncate flex-shrink-0 ${isCancelled || isDayCancelledLocal ? 'text-stone-400 line-through' : 'text-stone-500'}`}>{typeInfo?.name || req.leave_type_name}</span>
                                  <span className={`flex-shrink-0 text-[9px] ${isCancelled || isDayCancelledLocal ? 'text-stone-400 line-through' : 'text-stone-400'}`}>{new Date(req.created_at).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                  {isProcessing ? (
                                    <span className="flex-shrink-0 ml-auto text-[10px] text-amber-500">處理中</span>
                                  ) : isCancelled ? (
                                    <span className="flex-shrink-0 ml-auto text-[9px] text-stone-400 bg-stone-100 px-1 py-0.5 rounded">已取消</span>
                                  ) : isDayCancelledLocal ? (
                                    <span className="flex-shrink-0 ml-auto text-[9px] text-orange-500 bg-orange-50 px-1 py-0.5 rounded">已取消此日</span>
                                  ) : (
                                    <div className="flex items-center gap-0.5 flex-shrink-0 ml-auto">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleDayAction(req, dateStr, 'approved'); }}
                                        className={`w-4 h-4 flex items-center justify-center rounded transition-colors ${dayReviewStatus === 'approved' ? 'bg-emerald-500 text-white' : 'bg-stone-200 text-stone-600 hover:bg-emerald-500 hover:text-white'}`}
                                        title="核准此日"
                                      >
                                        <i className="ri-check-line text-[8px]" />
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleDayAction(req, dateStr, 'rejected'); }}
                                        className={`w-4 h-4 flex items-center justify-center rounded transition-colors ${dayReviewStatus === 'rejected' ? 'bg-red-400 text-white' : 'bg-stone-200 text-stone-600 hover:bg-red-400 hover:text-white'}`}
                                        title="駁回此日"
                                      >
                                        <i className="ri-close-line text-[8px]" />
                                      </button>
                                      {dayReviewStatus && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleDayAction(req, dateStr, 'remove'); }}
                                          className="w-4 h-4 flex items-center justify-center rounded bg-stone-200 text-stone-600 hover:bg-stone-400 hover:text-white transition-colors"
                                          title="取消審核此日"
                                        >
                                          <i className="ri-eraser-line text-[8px]" />
                                        </button>
                                      )}
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleDayCancel(req, dateStr); }}
                                        className="w-4 h-4 flex items-center justify-center rounded bg-orange-50 text-orange-400 hover:bg-orange-500 hover:text-white transition-colors"
                                        title="取消此日請假"
                                      >
                                        <i className="ri-calendar-close-line text-[8px]" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center justify-center">
                            <span className="text-xs text-stone-300">-</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="md:hidden text-center py-3 bg-stone-50">
              <p className="text-xs text-stone-400">
                {monthRequests.length > 0 ? `${monthRequests.length} 筆請假紀錄` : '本月尚無請假紀錄'}
              </p>
            </div>
          </div>
        );
      })()}
    </div>
  );

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
        <div className="flex-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-stone-800">{t('approval')}</h1>
            {pendingRequests.length > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingRequests.length}
              </span>
            )}
          </div>
          <button
            onClick={() => navigate('/admin/employees')}
            className="flex items-center gap-1 text-xs font-medium text-sky-600 bg-sky-50 hover:bg-sky-100 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            <i className="ri-team-line" />
            員工管理
          </button>
          <button
            onClick={() => navigate('/admin/announcements')}
            className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            <i className="ri-image-line" />
            公告管理
          </button>
        </div>
      </div>

      <div className="max-w-3xl md:max-w-7xl mx-auto px-4 md:px-8 py-4">
        {/* Cancel Toast */}
        {cancelMsg && (
          <div className="mb-3 bg-white border border-stone-200 rounded-xl px-4 py-3 flex items-center gap-2 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
            <i className={cancelMsg.includes('已取消') ? 'ri-checkbox-circle-line text-emerald-500' : 'ri-error-warning-line text-red-500'} />
            <span className={`text-sm font-medium ${cancelMsg.includes('已取消') ? 'text-emerald-700' : 'text-red-700'}`}>
              {cancelMsg}
            </span>
          </div>
        )}

        {/* 今日申請人員 */}
        {todayRequests.length > 0 && activeTab !== 'shiftImages' && activeTab !== 'export' && (
          <div className="mb-4">
            <button
              onClick={() => setExpandedTodaySection((v) => !v)}
              className="w-full flex items-center gap-2 mb-2 text-left cursor-pointer group"
            >
              <i className="ri-notification-3-line text-amber-500 text-sm" />
              <h2 className="text-sm font-semibold text-stone-700">今日申請人員</h2>
              <span className="text-xs text-stone-400">({todayRequests.length} 人)</span>
              <div className="w-5 h-5 flex items-center justify-center ml-auto">
                <i className={`ri-arrow-down-s-line text-stone-400 transition-transform duration-200 ${expandedTodaySection ? '' : '-rotate-90'}`} />
              </div>
            </button>

            {expandedTodaySection && (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {todayRequests.map((req) => {
                  const dt = formatDateTime(req.created_at);
                  const typeInfo = leaveTypes.find((t) => t.id === req.leave_type);
                  const reqStatus = statusConfig[req.status];
                  return (
                    <div
                      key={req.id}
                      className="flex-shrink-0 bg-white rounded-xl p-3 border border-stone-100 min-w-[200px]"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                            <span className="text-xs font-bold text-amber-700">
                              {req.employee_name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-stone-800">{req.employee_name}</p>
                            <p className="text-[10px] text-stone-400">{dt.time}</p>
                          </div>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${reqStatus.bg} ${reqStatus.color}`}>
                          <span className={`inline-block w-1 h-1 rounded-full ${reqStatus.dot} mr-0.5`} />
                          {reqStatus.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-5 h-5 rounded flex items-center justify-center ${typeInfo?.color}`}>
                          <i className={`${typeInfo?.icon} text-[10px]`} />
                        </div>
                        <span className="text-[11px] text-stone-600">{typeInfo?.name}</span>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-stone-100 rounded-xl p-1 mb-4">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'pending'
                ? 'bg-white text-stone-800 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            主管審核
            <span className="ml-1 text-xs text-stone-400">
              ({pendingRequests.length})
            </span>
          </button>
          <button
            onClick={() => setActiveTab('shiftImages')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'shiftImages'
                ? 'bg-white text-stone-800 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <span className="flex items-center justify-center gap-1">
              <i className="ri-image-line text-xs" />
              班表圖片
            </span>
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'export'
                ? 'bg-white text-stone-800 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <span className="flex items-center justify-center gap-1">
              <i className="ri-file-excel-line text-xs" />
              導出名單
            </span>
          </button>
        </div>

        {/* Shift Images Management Tab */}
        {activeTab === 'shiftImages' && <ShiftImagesTab year={calendarYear} month={calendarMonth} onNavigate={(y, m) => { setCalendarYear(y); setCalendarMonth(m); }} />}

        {/* Export Monthly Leave List Tab */}
        {activeTab === 'export' && <ExportTab year={calendarYear} month={calendarMonth} onNavigate={(y, m) => { setCalendarYear(y); setCalendarMonth(m); }} />}

        {/* 月曆檢視 — 審核 Tab 預設直接顯示 */}
        {activeTab !== 'shiftImages' && activeTab !== 'export' && calendarGrid}

        {/* Full-screen Calendar Lightbox (Desktop) */}
        {lightboxOpen && (
          <div
            className="fixed inset-0 bg-black/70 z-[60] hidden md:flex items-center justify-center p-6"
            onClick={() => setLightboxOpen(false)}
          >
            <div
              className="bg-white rounded-2xl overflow-hidden w-full max-w-[95vw] max-h-[90vh] flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={goCalendarPrevMonth}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 transition-colors"
                  >
                    <i className="ri-arrow-left-s-line text-lg text-stone-600" />
                  </button>
                  <h2 className="text-base font-bold text-stone-800">{calendarMonthLabel}</h2>
                  <button
                    onClick={goCalendarNextMonth}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 transition-colors"
                  >
                    <i className="ri-arrow-right-s-line text-lg text-stone-600" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                    主管審核
                  </span>
                  <button
                    onClick={() => setLightboxOpen(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 transition-colors text-stone-500"
                  >
                    <i className="ri-close-line text-xl" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4">
                {(() => {
                  const monthRequests = (() => {
                    const base = sortedAll.filter(
                      (r) => requestOverlapsMonth(r, calendarYear, calendarMonth),
                    );
                    const hasLocalReviews = Object.keys(locallyReviewedDays).some((k) =>
                      base.some((b) => k.startsWith(`${b.id}_`)),
                    );
                    if (hasLocalReviews) {
                      const reviewedItems = allRequests.filter(
                        (r) =>
                          requestOverlapsMonth(r, calendarYear, calendarMonth) &&
                          Object.keys(locallyReviewedDays).some((k) => k.startsWith(`${r.id}_`)) &&
                          !base.some((b) => b.id === r.id),
                      );
                      return [...base, ...reviewedItems].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                    }
                    return base;
                  })();
                  const daysInMonth = new Date(calendarYear, calendarMonth, 0).getDate();
                  const firstWeekday = new Date(calendarYear, calendarMonth - 1, 1).getDay();
                  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
                  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

                  return (
                    <div style={{ fontFamily: '"DFKai-SB", "BiauKai", "標楷體", "KaiTi", serif' }}>
                      <div className="grid grid-cols-7 gap-0">
                        {weekdays.map((w) => (
                          <div key={w} className={`text-center text-base font-bold text-stone-700 py-2.5 border border-black ${w === '日' || w === '六' ? 'bg-stone-200/70' : 'bg-stone-50'}`}>
                            {w}
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-7 gap-0">
                        {Array.from({ length: totalCells }).map((_, idx) => {
                          const dayNum = idx - firstWeekday + 1;
                          const isWeekend = idx % 7 === 0 || idx % 7 === 6;
                          if (dayNum < 1 || dayNum > daysInMonth) {
                            return <div key={idx} className={`border border-black min-h-[160px] ${isWeekend ? 'bg-stone-100/70' : 'bg-stone-50/40'}`} />;
                          }
                          const dateStr = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                          const dayRequests = monthRequests
                            .filter((r) => requestCoversDate(r, dateStr))
                            .slice(0, 12);
                          const hasRequests = dayRequests.length > 0;

                          const getDayReviewStatusLb = (reqId: string, d: string): 'approved' | 'rejected' | undefined => {
                            const dayKey = `${reqId}_${d}`;
                            if (locallyReviewedDays[dayKey]) return locallyReviewedDays[dayKey];
                            const storeMap = getRequestDayStatusMap(reqId);
                            return storeMap[d];
                          };

                          return (
                            <div key={idx} className={`border border-black p-2.5 min-h-[260px] flex flex-col ${isWeekend ? 'bg-stone-50/80' : 'bg-white'}`}>
                              <div className={`text-base font-bold mb-2 text-center border-b pb-1.5 ${hasRequests ? 'text-amber-700 border-amber-400' : 'text-stone-600 border-black'}`}>
                                {dayNum} <span className="text-stone-400 font-normal text-sm">週{weekdays[idx % 7]}</span>
                              </div>
                              {hasRequests ? (
                                <div className="flex-1 space-y-1">
                                  {dayRequests.map((req, ri) => {
                                    const typeInfo = leaveTypes.find((t) => t.id === req.leave_type);
                                    const status = statusConfig[req.status];
                                    const dayKey = `${req.id}_${dateStr}`;
                                    const dayReviewStatus = getDayReviewStatusLb(req.id, dateStr);
                                    const isProcessing = dayProcessingMap[dayKey];
                                    const isPendingItem = req.status === 'pending' && !dayReviewStatus;
                                    const isCancelled = req.status === 'cancelled';
                                    const isDayCancelledLocal = isDayCancelled(req.id, dateStr) || !!locallyCancelledDays[dayKey];
                                    return (
                                      <div
                                        key={ri}
                                        className={`relative flex items-center gap-1 text-xs leading-tight py-0.5 px-1 rounded border-b border-dashed border-stone-100 group ${isPendingItem ? 'bg-amber-50/70' : ''} ${dayReviewStatus ? 'opacity-90' : ''} ${isCancelled ? 'bg-stone-200/50' : ''} ${isDayCancelledLocal ? 'bg-orange-50/50' : ''}`}
                                        title={dayReviewStatus ? (dayReviewStatus === 'approved' ? '已核准此日' : '已駁回此日') : isCancelled || isDayCancelledLocal ? '已取消申請' : isPendingItem ? '待審核' : ''}
                                      >
                                        {(isCancelled || isDayCancelledLocal) && (
                                          <div className="absolute inset-y-0 left-0 right-0 flex items-center pointer-events-none z-10">
                                            <div className="w-full h-[2px] bg-stone-500/80" />
                                          </div>
                                        )}
                                        {isProcessing ? (
                                          <i className="ri-loader-4-line animate-spin text-amber-500 flex-shrink-0 text-[11px]" />
                                        ) : dayReviewStatus ? (
                                          dayReviewStatus === 'approved' ? (
                                            <i className="ri-checkbox-circle-fill text-emerald-500 flex-shrink-0 text-[11px]" />
                                          ) : (
                                            <i className="ri-close-circle-fill text-red-400 flex-shrink-0 text-[11px]" />
                                          )
                                        ) : isCancelled || isDayCancelledLocal ? (
                                          <i className="ri-close-circle-line text-stone-400 flex-shrink-0 text-[11px]" />
                                        ) : (
                                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status.dot}`} />
                                        )}
                                        <span className={`font-semibold truncate ${isCancelled || isDayCancelledLocal ? 'text-stone-400 line-through' : 'text-stone-700'}`}>{req.employee_name}</span>
                                        <span className={`truncate flex-shrink-0 ${isCancelled || isDayCancelledLocal ? 'text-stone-400 line-through' : 'text-stone-500'}`}>{typeInfo?.name || req.leave_type_name}</span>
                                        <span className={`flex-shrink-0 text-[10px] ${isCancelled || isDayCancelledLocal ? 'text-stone-400 line-through' : 'text-stone-400'}`}>{new Date(req.created_at).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                        {req.work_shift && (
                                          <span className="text-stone-400 text-[10px] truncate flex-shrink-0">{req.work_shift}</span>
                                        )}
                                        {isProcessing ? (
                                          <span className="flex-shrink-0 ml-auto text-[10px] text-amber-500">處理中</span>
                                        ) : isCancelled ? (
                                          <span className="flex-shrink-0 ml-auto text-[10px] text-stone-400 bg-stone-100 px-1 py-0.5 rounded">已取消</span>
                                        ) : isDayCancelledLocal ? (
                                          <span className="flex-shrink-0 ml-auto text-[10px] text-orange-500 bg-orange-50 px-1 py-0.5 rounded">已取消此日</span>
                                        ) : (
                                          <div className="flex items-center gap-0.5 flex-shrink-0 ml-auto">
                                            <button
                                              onClick={(e) => { e.stopPropagation(); handleDayAction(req, dateStr, 'approved'); }}
                                              className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${dayReviewStatus === 'approved' ? 'bg-emerald-500 text-white' : 'bg-stone-200 text-stone-600 hover:bg-emerald-500 hover:text-white'}`}
                                              title="核准此日"
                                            >
                                              <i className="ri-check-line text-[10px]" />
                                            </button>
                                            <button
                                              onClick={(e) => { e.stopPropagation(); handleDayAction(req, dateStr, 'rejected'); }}
                                              className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${dayReviewStatus === 'rejected' ? 'bg-red-400 text-white' : 'bg-stone-200 text-stone-600 hover:bg-red-400 hover:text-white'}`}
                                              title="駁回此日"
                                            >
                                              <i className="ri-close-line text-[10px]" />
                                            </button>
                                            {dayReviewStatus && (
                                              <button
                                                onClick={(e) => { e.stopPropagation(); handleDayAction(req, dateStr, 'remove'); }}
                                                className="w-5 h-5 flex items-center justify-center rounded bg-stone-200 text-stone-600 hover:bg-stone-400 hover:text-white transition-colors"
                                                title="取消審核此日"
                                              >
                                                <i className="ri-eraser-line text-[10px]" />
                                              </button>
                                            )}
                                            <button
                                              onClick={(e) => { e.stopPropagation(); handleDayCancel(req, dateStr); }}
                                              className="w-5 h-5 flex items-center justify-center rounded bg-orange-50 text-orange-400 hover:bg-orange-500 hover:text-white transition-colors"
                                              title="取消此日請假"
                                            >
                                              <i className="ri-calendar-close-line text-[10px]" />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="flex-1 flex items-center justify-center">
                                  <span className="text-sm text-stone-300">-</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}


      </div>
    </div>
  );
}