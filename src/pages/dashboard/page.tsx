import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { leaveTypes } from '@/mocks/leaveTypes';
import { getLeaveRequestsByEmployee } from '@/stores/leaveStore';
import { useLeaveStore } from '@/stores/leaveStore';
import {
  getShiftForDate,
  getTomorrowStr,
  getTodayStr,
  getUserWeekShifts,
  getUserCustomShiftCode,
  getShiftByCode,
} from '@/mocks/shiftSchedule';
import WeekShiftPreview from './components/WeekShiftPreview';
import { useAnnouncements, convertGoogleDriveUrl } from '@/mocks/announcements';
import ImageLightbox from '@/pages/shift/components/ImageLightbox';

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  useLeaveStore(); // subscribe to store changes

  const announcements = useAnnouncements();
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxTitle, setLightboxTitle] = useState('');

  const myRequests = getLeaveRequestsByEmployee(user?.id || '');
  const pendingCount = myRequests.filter((r) => r.status === 'pending').length;
  const approvedCount = myRequests.filter((r) => r.status === 'approved').length;
  const rejectedCount = myRequests.filter((r) => r.status === 'rejected').length;

  const recentLeaves = [...myRequests]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3);

  // 今日申請（員工自己今天提交的）
  const today = new Date().toISOString().split('T')[0];
  const todayMyRequests = myRequests.filter((r) => {
    const reqDate = r.created_at.split('T')[0];
    return reqDate === today;
  });

  // 明日班表
  const tomorrowStr = getTomorrowStr();
  const todayStr = getTodayStr();
  const userGroup = (user?.group as 'A' | 'B' | null) || (user ? 'A' : null);

  /** 取得某天的班次（優先讀取用戶自定義） */
  const getTodayOrTomorrowShift = (dateStr: string) => {
    if (!userGroup) return null;
    // 優先讀取用戶自定義班次
    const customCode = getUserCustomShiftCode(user?.id || '', dateStr);
    if (customCode) {
      const codeInfo = getShiftByCode(customCode);
      if (codeInfo) {
        return {
          type: codeInfo.type,
          label: codeInfo.label,
          timeRange: codeInfo.timeRange,
          startTime: codeInfo.startTime,
          endTime: codeInfo.endTime,
          color: codeInfo.color,
          bgColor: codeInfo.bgColor,
          icon: codeInfo.icon,
          hideStartTime: codeInfo.hideStartTime,
        };
      }
    }
    // 無自定義則用預設輪班
    return getShiftForDate(userGroup, dateStr);
  };

  const tomorrowShift = getTodayOrTomorrowShift(tomorrowStr);
  const todayShift = getTodayOrTomorrowShift(todayStr);

  // 查詢今日/明日請假狀態
  function findLeaveForDate(dateStr: string) {
    return myRequests
      .filter((r) => r.status !== 'cancelled' && dateStr >= r.start_date && dateStr <= r.end_date)
      .sort((a, b) => {
        const priority: Record<string, number> = { approved: 3, pending: 2, rejected: 1 };
        return (priority[b.status] || 0) - (priority[a.status] || 0);
      })[0];
  }
  const todayLeave = findLeaveForDate(todayStr);
  const tomorrowLeave = findLeaveForDate(tomorrowStr);

  function leaveBadgeClass(status: string) {
    switch (status) {
      case 'approved':
        return { text: '准假', bg: 'bg-emerald-100', color: 'text-emerald-700', icon: 'ri-check-line' };
      case 'pending':
        return { text: '待審', bg: 'bg-amber-100', color: 'text-amber-700', icon: 'ri-time-line' };
      case 'rejected':
        return { text: '駁回', bg: 'bg-red-100', color: 'text-red-700', icon: 'ri-close-line' };
      default:
        return null;
    }
  }

  // 本周班表（支持用戶自定義）
  const [shiftRefreshKey, setShiftRefreshKey] = useState(0);
  const weekShifts = useMemo(
    () => (userGroup ? getUserWeekShifts(user?.id || '', userGroup) : []),
    [userGroup, user?.id, shiftRefreshKey],
  );

  const statusConfig: Record<string, { label: string; color: string; dot: string; bg: string }> = {
    pending: { label: t('pending'), color: 'text-amber-700', dot: 'bg-amber-500', bg: 'bg-amber-50 border-amber-200' },
    approved: { label: t('approved'), color: 'text-emerald-700', dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-200' },
    rejected: { label: t('rejected'), color: 'text-red-700', dot: 'bg-red-500', bg: 'bg-red-50 border-red-200' },
  };

  // 假別使用統計
  const typeUsage: Record<string, number> = {};
  myRequests.filter((r) => r.status === 'approved').forEach((r) => {
    typeUsage[r.leave_type] = (typeUsage[r.leave_type] || 0) + r.days_count;
  });

  // 假別剩餘天數模擬數據
  const remainingDays: Record<string, number> = {
    annual: user?.annual_leave_days || 0,
    sick: user?.sick_leave_days || 0,
    personal: 14,
    family_care: 7,
    mental: 5,
    menstrual: 3,
    official: 999,
    compensatory: 999,
    marriage: 14,
    bereavement: 999,
    paternity: 5,
    maternity: 42,
    prenatal: 8,
  };

  const usedDays = (typeId: string) => typeUsage[typeId] || 0;
  const totalDays = (typeId: string) => remainingDays[typeId] || 0;

  return (
    <div className="min-h-screen relative pb-24">
      {/* Soft Background Image */}
      <div className="fixed inset-0 z-0">
        <img
          src="https://readdy.ai/api/search-image?query=Beautiful%20soft%20pastel%20sunrise%20sky%20over%20peaceful%20rolling%20hills%20and%20green%20meadows%2C%20warm%20golden%20light%20with%20gentle%20pink%20and%20lavender%20clouds%2C%20soft%20dreamy%20watercolor%20texture%2C%20serene%20countryside%20landscape%2C%20calming%20nature%20scenery%2C%20warm%20beige%20and%20sage%20green%20tones%2C%20delicate%20morning%20atmosphere%2C%20no%20text%2C%20peaceful%20and%20relaxing%20mood%2C%20high%20quality%20fine%20art%20style%2C%20wide%20panoramic%20composition&width=1600&height=900&seq=88&orientation=landscape"
          alt="Dashboard Background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-white/5" />
      </div>

      <div className="relative z-10">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm px-4 py-5 border-b border-white/40">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <p className="text-xs text-stone-500">{t('welcome')}</p>
            <h1 className="text-lg font-bold text-stone-800">{user?.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              user?.role === 'manager'
                ? 'bg-violet-100 text-violet-700'
                : 'bg-stone-100 text-stone-600'
            }`}>
              {user?.role === 'manager' ? t('role_manager') : t('role_employee')}
            </span>
            <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center">
              <i className="ri-user-line text-emerald-700" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">
        {/* 管理者公告圖片 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                <i className="ri-image-line text-amber-600 text-sm" />
              </div>
              <h2 className="text-sm font-semibold text-stone-700">公告</h2>
            </div>
            <span className="text-[10px] text-stone-400 flex items-center gap-1">
              <i className="ri-shield-user-line" />
              由管理者新增
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {announcements.map((item) => (
              <div
                key={item.id}
                className="flex-shrink-0 w-[260px] rounded-xl overflow-hidden border border-white/30 bg-white/75 backdrop-blur-sm cursor-pointer hover:shadow-md transition-shadow shadow-sm"
                onClick={() => {
                  if (item.imageUrl) {
                    setLightboxImage(item.imageUrl);
                    setLightboxTitle(item.title);
                  }
                }}
              >
                {item.imageUrl ? (
                  <div className="w-full h-[130px] overflow-hidden">
                    <img
                      src={convertGoogleDriveUrl(item.imageUrl)}
                      alt={item.title}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ) : (
                  <div className="w-full h-[130px] bg-stone-100/50 flex items-center justify-center">
                    <div className="text-center">
                      <i className="ri-article-line text-3xl text-stone-300" />
                      <p className="text-[10px] text-stone-400 mt-1">文字公告</p>
                    </div>
                  </div>
                )}
                <div className="p-3">
                  <p className="text-xs font-medium text-stone-700">{item.title}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-stone-400">{item.date}</span>
                    <span className="text-[10px] text-stone-400 flex items-center gap-0.5">
                      <i className="ri-user-star-line text-[9px]" />
                      {item.manager}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white/70 backdrop-blur-sm rounded-xl p-2.5 border border-white/30 text-center shadow-sm">
            <p className="text-xl font-bold text-amber-600">{pendingCount}</p>
            <p className="text-[10px] text-stone-500 mt-0.5">{t('pending')}</p>
          </div>
          <div className="bg-white/70 backdrop-blur-sm rounded-xl p-2.5 border border-white/30 text-center shadow-sm">
            <p className="text-xl font-bold text-emerald-600">{approvedCount}</p>
            <p className="text-[10px] text-stone-500 mt-0.5">{t('approved')}</p>
          </div>
          <div className="bg-white/70 backdrop-blur-sm rounded-xl p-2.5 border border-white/30 text-center shadow-sm">
            <p className="text-xl font-bold text-red-500">{rejectedCount}</p>
            <p className="text-[10px] text-stone-500 mt-0.5">{t('rejected')}</p>
          </div>
          <div className="bg-white/70 backdrop-blur-sm rounded-xl p-2.5 border border-white/30 text-center shadow-sm">
            <p className="text-xl font-bold text-stone-700">{myRequests.length}</p>
            <p className="text-[10px] text-stone-500 mt-0.5">總申請</p>
          </div>
        </div>

        {/* 今日與明日班表 */}
        {userGroup && (
          <div className="grid grid-cols-2 gap-3">
            {/* 今日班表 */}
            {todayShift && (
              <div className={`rounded-xl p-4 border border-white/30 bg-white/60 backdrop-blur-sm`}>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-white/40`}>
                      <i className={`${todayShift.icon} text-sm ${todayShift.color}`} />
                    </div>
                    <div>
                      <p className="text-[10px] text-stone-500">今日班別</p>
                      <p className={`text-sm font-bold ${todayShift.color}`}>{todayShift.label}</p>
                    </div>
                  </div>
                  {todayLeave && leaveBadgeClass(todayLeave.status) && (
                    <span className={`inline-flex items-center gap-[1px] text-[9px] font-bold px-1.5 py-[2px] rounded-full ${leaveBadgeClass(todayLeave.status)!.bg} ${leaveBadgeClass(todayLeave.status)!.color}`}>
                      <i className={`${leaveBadgeClass(todayLeave.status)!.icon} text-[8px]`} />
                      {leaveBadgeClass(todayLeave.status)!.text}
                    </span>
                  )}
                </div>
                {todayShift.type !== 'rest' && !todayShift.hideStartTime && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <i className="ri-time-line text-stone-400 text-[10px]" />
                    <p className="text-xs text-stone-600 font-medium">{todayShift.startTime} 上班</p>
                  </div>
                )}
                {(todayShift.type === 'rest') && (
                  <p className="text-xs text-stone-400 mt-1">例假</p>
                )}
              </div>
            )}
            {/* 明日班表 */}
            {tomorrowShift && (
              <div className={`rounded-xl p-4 border border-white/30 bg-white/60 backdrop-blur-sm`}>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-white/40`}>
                      <i className={`${tomorrowShift.icon} text-sm ${tomorrowShift.color}`} />
                    </div>
                    <div>
                      <p className="text-[10px] text-stone-500">明日工作班</p>
                      <p className={`text-sm font-bold ${tomorrowShift.color}`}>{tomorrowShift.label}</p>
                    </div>
                  </div>
                  {tomorrowLeave && leaveBadgeClass(tomorrowLeave.status) && (
                    <span className={`inline-flex items-center gap-[1px] text-[9px] font-bold px-1.5 py-[2px] rounded-full ${leaveBadgeClass(tomorrowLeave.status)!.bg} ${leaveBadgeClass(tomorrowLeave.status)!.color}`}>
                      <i className={`${leaveBadgeClass(tomorrowLeave.status)!.icon} text-[8px]`} />
                      {leaveBadgeClass(tomorrowLeave.status)!.text}
                    </span>
                  )}
                </div>
                {tomorrowShift.type !== 'rest' && !tomorrowShift.hideStartTime && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <i className="ri-time-line text-stone-400 text-[10px]" />
                    <p className="text-xs text-stone-600 font-medium">{tomorrowShift.startTime} 上班</p>
                  </div>
                )}
                {(tomorrowShift.type === 'rest') && (
                  <p className="text-xs text-stone-400 mt-1">例假</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 今日申請概覽（員工） */}
        {todayMyRequests.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <i className="ri-calendar-check-line text-emerald-500 text-sm" />
              <h2 className="text-sm font-semibold text-stone-700">今日申請概覽</h2>
              <span className="text-xs text-stone-400">({todayMyRequests.length} 筆)</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {todayMyRequests.map((req) => {
                const dt = new Date(req.created_at);
                const timeStr = dt.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
                const typeInfo = leaveTypes.find((t) => t.id === req.leave_type);
                const reqStatus = statusConfig[req.status];
                return (
                  <div
                    key={req.id}
                    className="flex-shrink-0 bg-white/75 backdrop-blur-sm rounded-xl p-3 border border-white/30 min-w-[180px] shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${typeInfo?.color}`}>
                          <i className={`${typeInfo?.icon} text-[10px]`} />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-stone-800">{typeInfo?.name}</p>
                          <p className="text-[10px] text-stone-400">{timeStr} 提交</p>
                        </div>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${reqStatus.bg} ${reqStatus.color}`}>
                        <span className={`inline-block w-1 h-1 rounded-full ${reqStatus.dot} mr-0.5`} />
                        {reqStatus.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-stone-500">
                      {req.start_date} ~ {req.end_date} · {req.days_count} 天
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 本周班表預覽 */}
        {weekShifts.length > 0 && (
          <WeekShiftPreview
            weekShifts={weekShifts}
            userId={user?.id || ''}
            leaves={myRequests}
            onSaved={() => setShiftRefreshKey((k) => k + 1)}
          />
        )}

        {/* 管理者快捷操作 */}
        {user?.role === 'manager' && (
          <div>
            <h2 className="text-sm font-semibold text-stone-700 mb-3">管理功能</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate('/admin/approval')}
                className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl p-4 text-left transition-colors"
              >
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center mb-2">
                  <i className="ri-list-check text-xl" />
                </div>
                <p className="font-medium text-sm">請假審核</p>
                <p className="text-xs text-violet-100 mt-0.5">審核員工請假申請</p>
              </button>
              <button
                onClick={() => navigate('/admin/employees')}
                className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl p-4 text-left transition-colors"
              >
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center mb-2">
                  <i className="ri-team-line text-xl" />
                </div>
                <p className="font-medium text-sm">員工管理</p>
                <p className="text-xs text-sky-100 mt-0.5">查看與編輯所有員工</p>
              </button>
              <button
                onClick={() => navigate('/admin/announcements')}
                className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl p-4 text-left transition-colors"
              >
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center mb-2">
                  <i className="ri-image-line text-xl" />
                </div>
                <p className="font-medium text-sm">公告管理</p>
                <p className="text-xs text-amber-100 mt-0.5">新增公告與圖片</p>
              </button>
              <button
                onClick={() => navigate('/admin/shift')}
                className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl p-4 text-left transition-colors"
              >
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center mb-2">
                  <i className="ri-table-line text-xl" />
                </div>
                <p className="font-medium text-sm">班表管理</p>
                <p className="text-xs text-teal-100 mt-0.5">設定 A/B 組班表連結</p>
              </button>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-semibold text-stone-700 mb-3">{t('quick_actions')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/leave/apply')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl p-4 text-left transition-colors"
            >
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center mb-2">
                <i className="ri-add-line text-xl" />
              </div>
              <p className="font-medium text-sm">{t('leave_apply')}</p>
              <p className="text-xs text-emerald-100 mt-0.5">提交新的請假申請</p>
            </button>
            <button
              onClick={() => navigate('/shift')}
              className="bg-white/75 backdrop-blur-sm hover:bg-white/90 border border-white/30 text-stone-800 rounded-xl p-4 text-left transition-colors shadow-sm"
            >
              <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center mb-2">
                <i className="ri-table-line text-xl text-stone-600" />
              </div>
              <p className="font-medium text-sm">當月班表</p>
              <p className="text-xs text-stone-500 mt-0.5">查看所有人排班</p>
            </button>
            <button
              onClick={() => navigate('/schedule')}
              className="bg-white/75 backdrop-blur-sm hover:bg-white/90 border border-white/30 text-stone-800 rounded-xl p-4 text-left transition-colors shadow-sm"
            >
              <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center mb-2">
                <i className="ri-calendar-line text-xl text-stone-600" />
              </div>
              <p className="font-medium text-sm">{t('schedule')}</p>
              <p className="text-xs text-stone-500 mt-0.5">查看請假是否通過以及排序</p>
            </button>
          </div>
        </div>

        {/* Leave Type Statistics */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-stone-700">假別統計</h2>
            <span className="text-[10px] text-stone-400">已用 / 剩餘</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {leaveTypes.map((type) => {
              const used = usedDays(type.id);
              const total = totalDays(type.id);
              const remaining = Math.max(0, total - used);
              const percent = total > 0 && total !== 999 ? Math.min(100, (used / total) * 100) : 0;
              const isUnlimited = total === 999;

              return (
                <div key={type.id} className="bg-white/75 backdrop-blur-sm rounded-xl p-3 border border-white/30 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${type.color}`}>
                      <i className={`${type.icon} text-xs`} />
                    </div>
                    <span className="text-xs font-medium text-stone-700">{type.name}</span>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-lg font-bold text-stone-800">
                        {isUnlimited ? '無限制' : `${remaining}`}
                        {!isUnlimited && <span className="text-xs font-normal text-stone-400 ml-0.5">天</span>}
                      </p>
                      <p className="text-[10px] text-stone-400 mt-0.5">
                        {isUnlimited ? `已用 ${used}` : `已用 ${used} / 總計 ${total}`}
                      </p>
                    </div>
                    {!isUnlimited && (
                      <div className="w-10 h-10 relative">
                        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                          <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="#e7e5e4"
                            strokeWidth="3"
                          />
                          <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke={percent > 80 ? '#ef4444' : percent > 50 ? '#f59e0b' : '#10b981'}
                            strokeWidth="3"
                            strokeDasharray={`${percent}, 100`}
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-stone-600">
                          {Math.round(percent)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Leaves */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-stone-700">{t('recent_leaves')}</h2>
            <button
              onClick={() => navigate('/leave/records')}
              className="text-xs text-emerald-600 font-medium"
            >
              {t('view_all')}
            </button>
          </div>

          {recentLeaves.length === 0 ? (
            <div className="bg-white/75 backdrop-blur-sm rounded-xl p-6 text-center border border-white/30 shadow-sm">
              <i className="ri-inbox-line text-3xl text-stone-300 mb-2" />
              <p className="text-sm text-stone-400">{t('no_records')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentLeaves.map((req) => {
                const status = statusConfig[req.status];
                const typeInfo = leaveTypes.find((t) => t.id === req.leave_type);
                const dt = new Date(req.created_at);
                const timeStr = dt.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div
                    key={req.id}
                    className="bg-white/75 backdrop-blur-sm rounded-xl p-4 border border-white/30 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${status.bg} ${status.color}`}>
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${status.dot} mr-1`} />
                          {status.label}
                        </span>
                        <span className="text-sm font-medium text-stone-700">
                          {typeInfo?.name}
                        </span>
                      </div>
                      <span className="text-xs text-stone-400">
                        {req.days_count} 天
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 mt-1.5">
                      {req.start_date} ~ {req.end_date}
                    </p>
                    <p className="text-[10px] text-stone-400 mt-1">
                      申請時間：{dt.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })} {timeStr}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Lightbox Modal */}
        {lightboxImage && (
          <ImageLightbox
            src={convertGoogleDriveUrl(lightboxImage, 'w1920')}
            alt={lightboxTitle}
            onClose={() => {
              setLightboxImage(null);
              setLightboxTitle('');
            }}
          />
        )}
      </div>
    </div>
    </div>
  );
}