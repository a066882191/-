import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { leaveTypes } from '@/mocks/leaveTypes';
import {
  getLeaveRequests,
  useLeaveStore,
  loadLeaveRequests,
  cancelLeaveRequest,
  cancelLeaveDays,
  getRequestDayStatusMap,
  getDayCancelledMap,
} from '@/stores/leaveStore';
import {
  requestOverlapsMonth,
  requestCoversDate,
  sortByLeaveType,
} from '@/pages/admin/approval/utils/leaveHelpers';

export default function SchedulePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  useLeaveStore();

  useEffect(() => {
    loadLeaveRequests();
  }, []);

  const today = new Date();
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth() + 1);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);

  // Cancel modal states
  const [cancelModalReq, setCancelModalReq] = useState<string | null>(null);
  const [cancelMsg, setCancelMsg] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // 逐日取消：記錄每筆 pending 申請中被選取要取消的日期
  const [selectedCancelDays, setSelectedCancelDays] = useState<Record<string, string[]>>({});
  const [dayCancelLoading, setDayCancelLoading] = useState(false);

  function toggleCancelDay(reqId: string, date: string) {
    setSelectedCancelDays((prev) => {
      const current = prev[reqId] || [];
      if (current.includes(date)) {
        return { ...prev, [reqId]: current.filter((d) => d !== date) };
      }
      return { ...prev, [reqId]: [...current, date] };
    });
  }

  function generateDateRange(start: string, end: string): string[] {
    const dates: string[] = [];
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    const cur = new Date(s);
    while (cur <= e) {
      dates.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }

  useEffect(() => {
    setLightboxOpen(false);
  }, [calendarYear, calendarMonth]);

  const allRequests = getLeaveRequests();
  const todayStr = new Date().toISOString().split('T')[0];
  const todayRequests = allRequests.filter((r) => requestCoversDate(r, todayStr));

  const calendarMonthLabel = `${calendarYear} 年 ${calendarMonth} 月`;

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

  function isWithinCancelWindow(startDate: string): boolean {
    const start = new Date(startDate + 'T00:00:00').getTime();
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return Math.ceil((start - t.getTime()) / (1000 * 60 * 60 * 24)) >= 10;
  }

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
      setTimeout(() => setCancelMsg(null), 2500);
    }
  }

  async function confirmDayCancel(reqId: string) {
    if (!user) return;
    const dates = selectedCancelDays[reqId] || [];
    if (dates.length === 0) return;
    setDayCancelLoading(true);
    try {
      const result = await cancelLeaveDays(reqId, dates, user.id);
      setSelectedCancelDays((prev) => {
        const next = { ...prev };
        delete next[reqId];
        return next;
      });
      setCalendarRefreshKey((k) => k + 1); // 強制刷新月曆
      if (!result.success) {
        setCancelMsg(result.error || '取消失敗');
      } else {
        setCancelMsg(`已取消 ${result.cancelledCount} 天申請`);
      }
    } catch (err) {
      setCancelMsg(err instanceof Error ? err.message : '取消失敗');
    } finally {
      setDayCancelLoading(false);
      setTimeout(() => setCancelMsg(null), 2500);
    }
  }

  const statusConfig: Record<string, { label: string; color: string; dot: string; bg: string }> = {
    pending: { label: t('pending'), color: 'text-amber-700', dot: 'bg-amber-500', bg: 'bg-amber-50 border-amber-200' },
    approved: { label: t('approved'), color: 'text-emerald-700', dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-200' },
    rejected: { label: t('rejected'), color: 'text-red-700', dot: 'bg-red-500', bg: 'bg-red-50 border-red-200' },
    cancelled: { label: '已取消', color: 'text-stone-500', dot: 'bg-stone-400', bg: 'bg-stone-100 border-stone-200' },
  };

  const formatDateTime = (isoString: string) => ({
    full: new Date(isoString).toLocaleString('zh-TW', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }),
  });

  // ── 共用月曆渲染 ──
  const renderCalendar = useCallback(
    (isLightbox: boolean) => {
      const monthRequests = allRequests
        .filter((r) => requestOverlapsMonth(r, calendarYear, calendarMonth))
        .sort(sortByLeaveType);

      const daysInMonth = new Date(calendarYear, calendarMonth, 0).getDate();
      const firstWeekday = new Date(calendarYear, calendarMonth - 1, 1).getDay();
      const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
      const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

      const cellMinH = isLightbox ? 'min-h-[170px]' : 'min-h-[140px]';
      const dayNumSize = isLightbox ? 'text-sm' : 'text-xs';

      return (
        <div className="overflow-x-auto" style={{ fontFamily: '"DFKai-SB", "BiauKai", "標楷體", "KaiTi", serif' }}>
          <div className={isLightbox ? '' : 'min-w-[950px] text-center'}>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-0">
              {weekdays.map((w) => (
                <div
                  key={w}
                  className={`text-center text-[10px] font-bold text-stone-700 py-1 border border-black ${w === '日' || w === '六' ? 'bg-stone-200/70' : 'bg-stone-50'}`}
                >
                  {w}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-0">
              {Array.from({ length: totalCells }).map((_, idx) => {
                const dayNum = idx - firstWeekday + 1;
                const isWeekend = idx % 7 === 0 || idx % 7 === 6;
                if (dayNum < 1 || dayNum > daysInMonth) {
                  return (
                    <div
                      key={idx}
                      className={`border border-black ${cellMinH} ${isWeekend ? 'bg-stone-100/70' : 'bg-stone-50/40'}`}
                    />
                  );
                }
                const dateStr = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const isToday = dateStr === todayStr;
                const dayRequests = monthRequests
                  .filter((r) => requestCoversDate(r, dateStr) && !getDayCancelledMap(r.id)[dateStr])
                  .sort(sortByLeaveType)
                  .slice(0, isLightbox ? 15 : 12);
                const hasRequests = dayRequests.length > 0;

                return (
                  <div
                    key={idx}
                    className={`border border-black p-0.5 ${cellMinH} flex flex-col ${isWeekend ? 'bg-stone-50/80' : 'bg-white'}`}
                  >
                    {/* Day number header */}
                    <div
                      className={`${dayNumSize} font-bold mb-0.5 text-center border-b pb-0.5 flex items-center justify-center gap-0.5 ${hasRequests ? 'text-amber-700 border-amber-400' : 'text-stone-600 border-black'}`}
                    >
                      {isToday ? (
                        <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-bold">
                          {dayNum}
                        </span>
                      ) : (
                        <span>{dayNum}</span>
                      )}
                      <span className="text-stone-400 font-normal text-[8px]">週{weekdays[idx % 7]}</span>
                    </div>

                    {hasRequests ? (
                      <div className="flex-1 space-y-0.5 overflow-hidden">
                        {dayRequests.map((req, ri) => {
                          const typeInfo = leaveTypes.find((t) => t.id === req.leave_type);
                          const status = statusConfig[req.status];
                          const dayMap = getRequestDayStatusMap(req.id);
                          const dayReview = dayMap[dateStr];
                          const dayCancelMap = getDayCancelledMap(req.id);
                          const isDayCancelled = req.status === 'cancelled' || dayCancelMap[dateStr];
                          const isCancelled = isDayCancelled;
                          const dt = formatDateTime(req.created_at);

                          return (
                            <div
                              key={ri}
                              className={`relative rounded px-0.5 py-0 border-b border-dashed border-stone-100 ${req.status === 'pending' && !dayReview ? 'bg-amber-50/60' : ''} ${isCancelled ? 'bg-stone-200/50' : ''}`}
                              title={`${req.employee_name} · ${typeInfo?.name || req.leave_type_name} · ${status.label}${dayReview ? ` (${dayReview === 'approved' ? '當日已核准' : '當日已駁回'})` : ''}${isCancelled ? ' (已取消申請)' : ''} · ${dt.full}`}
                            >
                              {isCancelled && (
                                <div className="absolute inset-y-0 left-0 right-0 flex items-center pointer-events-none z-10">
                                  <div className="w-full h-[2px] bg-stone-500/80" />
                                </div>
                              )}
                              {/* Line 1: status + name + day review badge */}
                              <div className="flex items-center gap-0.5 text-[8px] leading-tight">
                                {dayReview ? (
                                  dayReview === 'approved' ? (
                                    <i className="ri-checkbox-circle-fill text-emerald-500 flex-shrink-0 text-[8px]" />
                                  ) : (
                                    <i className="ri-close-circle-fill text-red-400 flex-shrink-0 text-[8px]" />
                                  )
                                ) : isCancelled ? (
                                  <i className="ri-close-circle-line text-stone-400 flex-shrink-0 text-[8px]" />
                                ) : (
                                  <span className={`w-1 h-1 rounded-full flex-shrink-0 ${status.dot}`} />
                                )}
                                <span className={`font-semibold truncate ${isCancelled ? 'text-stone-400 line-through' : 'text-stone-800'}`}>{req.employee_name}</span>
                                {isCancelled ? (
                                  <span className="flex-shrink-0 ml-auto text-[7px] text-stone-400 bg-stone-100 px-0.5 rounded">已取消</span>
                                ) : dayReview && (
                                  <span className={`flex-shrink-0 ml-auto text-[7px] font-bold px-0.5 rounded ${
                                    dayReview === 'approved'
                                      ? 'text-emerald-600 bg-emerald-50'
                                      : 'text-red-500 bg-red-50'
                                  }`}>
                                    {dayReview === 'approved' ? '✓' : '✗'}
                                  </span>
                                )}
                              </div>

                              {/* Line 2: leave type + time + shift */}
                              <div className={`flex items-center gap-0.5 text-[7px] leading-tight mt-0 ${isCancelled ? 'text-stone-400' : 'text-stone-500'}`}>
                                <span className={`truncate flex-shrink-0 max-w-[35%] ${isCancelled ? 'line-through' : ''}`}>{typeInfo?.name || req.leave_type_name}</span>
                                <span className="text-stone-300 text-[6px]">·</span>
                                <span className={`flex-shrink-0 ${isCancelled ? 'text-stone-400 line-through' : 'text-stone-400'}`}>{dt.full}</span>
                                {req.work_shift && (
                                  <>
                                    <span className="text-stone-300 text-[6px]">·</span>
                                    <span className={`truncate flex-shrink-0 ${isCancelled ? 'text-stone-400 line-through' : 'text-stone-400'}`}>{req.work_shift}</span>
                                  </>
                                )}
                              </div>
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
      );
    },
    [allRequests, calendarYear, calendarMonth, todayStr, calendarRefreshKey],
  );

  // ── 我的申請明細 ──
  const myPendingRequests = allRequests
    .filter((r) => r.employee_id === user?.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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
          <h1 className="text-lg font-bold text-stone-800">{t('schedule')}</h1>
          <span className="text-xs text-stone-400 bg-stone-50 px-2 py-1 rounded">
            共 {allRequests.length} 筆紀錄
          </span>
        </div>
      </div>

      <div className="max-w-3xl md:max-w-7xl mx-auto px-4 md:px-8 py-4">
        {/* Toast */}
        {cancelMsg && (
          <div className="mb-3 bg-white border border-stone-200 rounded-xl px-4 py-3 flex items-center gap-2 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
            <i className={cancelMsg.includes('已取消') ? 'ri-checkbox-circle-line text-emerald-500' : 'ri-error-warning-line text-red-500'} />
            <span className={`text-sm font-medium ${cancelMsg.includes('已取消') ? 'text-emerald-700' : 'text-red-700'}`}>
              {cancelMsg}
            </span>
          </div>
        )}

        {/* 今日請假人員快覽 */}
        {todayRequests.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <i className="ri-calendar-check-line text-emerald-500 text-sm" />
              <h2 className="text-sm font-semibold text-stone-700">今日請假人員</h2>
              <span className="text-xs text-stone-400">({todayRequests.length} 人)</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {todayRequests.map((req) => {
                const typeInfo = leaveTypes.find((t) => t.id === req.leave_type);
                const reqStatus = statusConfig[req.status];
                return (
                  <div
                    key={req.id}
                    className="flex-shrink-0 bg-white rounded-xl p-3 border border-stone-100 min-w-[180px]"
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
                          <p className="text-[10px] text-stone-400">{req.start_date} ~ {req.end_date}</p>
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
          </div>
        )}

        {/* ─── 主月曆 ─── */}
        <div className="space-y-3 mb-4">
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
            {renderCalendar(false)}
          </div>

          {/* Mobile: show calendar inline */}
          <div className="md:hidden bg-white rounded-xl border border-stone-100 overflow-hidden">
            <div className="px-3 py-2 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
              <span className="text-xs text-stone-500">滑動查看完整月曆</span>
              <button
                onClick={() => setLightboxOpen(true)}
                className="text-xs text-emerald-600 font-medium flex items-center gap-1"
              >
                <i className="ri-fullscreen-line" />
                放大
              </button>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[950px]">
                {renderCalendar(false)}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="bg-white rounded-xl border border-stone-100 px-4 py-3 flex flex-wrap gap-3 items-center justify-center">
            <span className="text-xs text-stone-400 mr-1">圖例說明</span>
            <span className="flex items-center gap-1 text-xs text-stone-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> 已核准
            </span>
            <span className="flex items-center gap-1 text-xs text-stone-600">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> 待審核
            </span>
            <span className="flex items-center gap-1 text-xs text-stone-600">
              <span className="w-2 h-2 rounded-full bg-red-500" /> 已駁回
            </span>
            <span className="flex items-center gap-1 text-xs text-stone-600">
              <span className="w-2 h-2 rounded-full bg-stone-400" /> 已取消
            </span>
            <span className="flex items-center gap-1 text-xs text-stone-600">
              <i className="ri-checkbox-circle-fill text-emerald-500 text-[10px]" /> 當日已核准
            </span>
            <span className="flex items-center gap-1 text-xs text-stone-600">
              <i className="ri-close-circle-fill text-red-400 text-[10px]" /> 當日已駁回
            </span>
            <span className="flex items-center gap-1 text-xs text-stone-600">
              <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-bold">今</span> 今天
            </span>
          </div>
        </div>

        {/* ─── 我的申請明細 ─── */}
        <div className="mt-2">
          <h2 className="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-2">
            <i className="ri-user-line text-stone-400" />
            我的申請紀錄
            {myPendingRequests.filter((r) => r.status === 'pending').length > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {myPendingRequests.filter((r) => r.status === 'pending').length} 筆待審
              </span>
            )}
          </h2>
          {myPendingRequests.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-stone-100">
              <i className="ri-inbox-line text-4xl text-stone-300 mb-3" />
              <p className="text-sm text-stone-400">尚無申請紀錄</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myPendingRequests.map((req) => {
                const reqStatus = statusConfig[req.status];
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
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${reqStatus.bg} ${reqStatus.color}`}>
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${reqStatus.dot} mr-1`} />
                          {reqStatus.label}
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

                    {/* 逐日審核狀態 */}
                    {(() => {
                      const dayStatusMap = getRequestDayStatusMap(req.id);
                      const dayEntries = Object.entries(dayStatusMap);
                      if (dayEntries.length === 0) return null;
                      return (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {dayEntries.map(([d, dayReview]) => (
                            <span
                              key={d}
                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                dayReview === 'approved'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-red-50 text-red-600 border border-red-200'
                              }`}
                            >
                              {d.slice(5)} {dayReview === 'approved' ? '✓' : '✗'}
                            </span>
                          ))}
                        </div>
                      );
                    })()}

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

                    {req.status === 'pending' && (
                      <div className="mt-2.5 pt-2.5 border-t border-stone-100">
                        {/* 逐日勾選取消 */}
                        {(() => {
                          const allDates = generateDateRange(req.start_date, req.end_date);
                          const dayStatusMap = getRequestDayStatusMap(req.id);
                          const dayCancelMap = getDayCancelledMap(req.id);
                          const selected = selectedCancelDays[req.id] || [];
                          const cancellableDates = allDates.filter((d) => !dayStatusMap[d] && !dayCancelMap[d]);
                          const hasSelection = selected.length > 0;
                          const allDatesCancelled = cancellableDates.length === 0 && Object.keys(dayCancelMap).length > 0;

                          return (
                            <div className="space-y-2">
                              {/* 標題 + 提示 */}
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-stone-600">
                                  選擇要取消的日期：
                                </span>
                                {hasSelection && (
                                  <span className="text-xs text-red-500 font-bold">
                                    已選 {selected.length} 天
                                  </span>
                                )}
                              </div>

                              {/* 日期標籤 */}
                              <div className="flex flex-wrap gap-1.5">
                                {allDates.map((d) => {
                                  const isReviewed = !!dayStatusMap[d];
                                  const isAlreadyCancelled = !!dayCancelMap[d];
                                  const isSelected = selected.includes(d);
                                  const canSelect = !isReviewed && !isAlreadyCancelled;
                                  const dayLabel = d.slice(5); // MM-DD

                                  if (isAlreadyCancelled) {
                                    return (
                                      <span
                                        key={d}
                                        className="text-[10px] px-2 py-1 rounded-lg border border-stone-200 bg-stone-100 text-stone-400 line-through cursor-default"
                                      >
                                        {dayLabel} 已取消
                                      </span>
                                    );
                                  }

                                  if (isReviewed) {
                                    return (
                                      <span
                                        key={d}
                                        className={`text-[10px] px-2 py-1 rounded-lg border cursor-default ${
                                          dayStatusMap[d] === 'approved'
                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                                            : 'border-red-200 bg-red-50 text-red-500'
                                        }`}
                                      >
                                        {dayLabel} {dayStatusMap[d] === 'approved' ? '✓' : '✗'}
                                      </span>
                                    );
                                  }

                                  return (
                                    <button
                                      key={d}
                                      onClick={() => canSelect && toggleCancelDay(req.id, d)}
                                      className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all whitespace-nowrap cursor-pointer ${
                                        isSelected
                                          ? 'bg-red-500 text-white border-red-500 shadow-sm scale-105'
                                          : 'bg-white text-stone-600 border-stone-200 hover:border-red-300 hover:bg-red-50 hover:text-red-600'
                                      }`}
                                    >
                                      {dayLabel} {isSelected ? '✕' : ''}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* 操作區 */}
                              {hasSelection ? (
                                <div className="flex items-center gap-3 pt-1">
                                  <button
                                    onClick={() => confirmDayCancel(req.id)}
                                    disabled={dayCancelLoading}
                                    className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:bg-red-300 shadow-sm flex items-center gap-1.5 whitespace-nowrap"
                                  >
                                    {dayCancelLoading ? (
                                      <>
                                        <i className="ri-loader-4-line animate-spin" />
                                        處理中...
                                      </>
                                    ) : (
                                      <>
                                        <i className="ri-close-line" />
                                        取消選取天數 ({selected.length})
                                      </>
                                    )}
                                  </button>
                                  <button
                                    onClick={() => setSelectedCancelDays((prev) => {
                                      const next = { ...prev };
                                      delete next[req.id];
                                      return next;
                                    })}
                                    className="text-xs text-stone-400 hover:text-stone-600 whitespace-nowrap px-2 py-1"
                                  >
                                    清除選擇
                                  </button>
                                </div>
                              ) : (
                                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
                                  <i className="ri-information-line mr-1" />
                                  請先點擊上方日期標籤，選擇要取消的天數
                                </p>
                              )}

                              {/* 分隔線 + 整筆取消（次級操作） */}
                              {!allDatesCancelled && (
                                <div className="pt-2 mt-1 border-t border-dashed border-stone-200">
                                  <div className="flex items-center justify-between">
                                    {isWithinCancelWindow(req.start_date) ? (
                                      <>
                                        <span className="text-[10px] text-stone-400">
                                          距離開始還有 {(() => {
                                            const start = new Date(req.start_date + 'T00:00:00').getTime();
                                            const t = new Date();
                                            t.setHours(0, 0, 0, 0);
                                            return Math.ceil((start - t.getTime()) / (1000 * 60 * 60 * 24));
                                          })()} 天
                                        </span>
                                        <button
                                          onClick={() => handleCancelClick(req.id)}
                                          className="text-[10px] text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors flex items-center gap-0.5 whitespace-nowrap px-2 py-1 rounded"
                                        >
                                          <i className="ri-delete-back-line" />
                                          取消整筆申請
                                        </button>
                                      </>
                                    ) : (
                                      <span className="text-[10px] text-stone-400 ml-auto">開始前 10 天內不可整筆取消</span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {allDatesCancelled && (
                                <p className="text-xs text-stone-400 text-center py-1">所有日期皆已取消</p>
                              )}
                            </div>
                          );
                        })()}
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
      </div>

      {/* ─── Full-screen Calendar Lightbox (Desktop) ─── */}
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
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                  全體請假查詢
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
              {renderCalendar(true)}
            </div>
          </div>
        </div>
      )}

      {/* ─── Mobile Lightbox ─── */}
      {lightboxOpen && (
        <div className="fixed inset-0 bg-black/70 z-[60] md:hidden flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-h-[85vh] overflow-auto flex flex-col">
            <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <button
                  onClick={goCalendarPrevMonth}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100"
                >
                  <i className="ri-arrow-left-s-line text-lg text-stone-600" />
                </button>
                <h2 className="text-sm font-bold text-stone-800">{calendarMonthLabel}</h2>
                <button
                  onClick={goCalendarNextMonth}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100"
                >
                  <i className="ri-arrow-right-s-line text-lg text-stone-600" />
                </button>
              </div>
              <button
                onClick={() => setLightboxOpen(false)}
                className="w-8 h-8 flex items-center justify-center text-stone-500"
              >
                <i className="ri-close-line text-xl" />
              </button>
            </div>
            <div className="p-3 overflow-x-auto">
              <div className="min-w-[950px]">
                {renderCalendar(true)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Cancel Confirm Modal ─── */}
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