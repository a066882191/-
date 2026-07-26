import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import {
  getShiftForDate,
  getTomorrowStr,
  getTodayStr,
  getUserCustomShiftCode,
  getShiftByCode,
  getShiftForDateWithCycle,
} from '@/mocks/shiftSchedule';
import { useShiftCodeDetails } from '@/hooks/useShiftCodeDetails';
import { useShiftCycleOrder } from '@/hooks/useShiftCycleOrder';

export default function ProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout, updateUserAnnualLeave } = useAuth();
  const [isEditingLeave, setIsEditingLeave] = useState(false);
  const [leaveInput, setLeaveInput] = useState(user?.annual_leave_days || 0);
  useShiftCodeDetails();
  useShiftCycleOrder();

  // 今日/明日班表管制資訊
  const userGroup = (user?.group as 'A' | 'B' | null) || (user ? 'A' : null);
  const todayStr = getTodayStr();
  const tomorrowStr = getTomorrowStr();

  const getShiftControlInfo = (dateStr: string) => {
    if (!userGroup) return null;
    const customCode = getUserCustomShiftCode(user?.id || '', dateStr);
    if (customCode) {
      const codeInfo = getShiftByCode(customCode);
      if (codeInfo) {
        return {
          type: codeInfo.type,
          label: codeInfo.label,
          startTime: codeInfo.startTime,
          hideStartTime: codeInfo.hideStartTime,
          controlLocation: codeInfo.controlLocation,
          controlTime: codeInfo.controlTime,
          controlLocation2: codeInfo.controlLocation2,
          controlTime2: codeInfo.controlTime2,
        };
      }
    }
    // 優先使用管理員循環排序
    const cycleInfo = getShiftForDateWithCycle(userGroup, dateStr);
    if (cycleInfo) {
      return {
        type: cycleInfo.type,
        label: cycleInfo.label,
        startTime: cycleInfo.startTime,
        hideStartTime: cycleInfo.hideStartTime,
        controlLocation: cycleInfo.controlLocation,
        controlTime: cycleInfo.controlTime,
        controlLocation2: cycleInfo.controlLocation2,
        controlTime2: cycleInfo.controlTime2,
      };
    }
    // fallback：原本的 6 天循環
    const shift = getShiftForDate(userGroup, dateStr);
    if (!shift) return null;
    const defaultCode = shift.type === 'day' ? '701' : shift.type === 'night' ? '732' : 'OFF';
    const detail = getShiftByCode(defaultCode);
    return {
      type: shift.type,
      label: shift.label,
      startTime: shift.startTime,
      hideStartTime: shift.hideStartTime,
      controlLocation: detail?.controlLocation,
      controlTime: detail?.controlTime,
      controlLocation2: detail?.controlLocation2,
      controlTime2: detail?.controlTime2,
    };
  };

  const todayInfo = getShiftControlInfo(todayStr);
  const tomorrowInfo = getShiftControlInfo(tomorrowStr);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  function handleSaveLeave() {
    const days = Math.max(0, Math.min(30, Math.round(Number(leaveInput))));
    updateUserAnnualLeave(days);
    setIsEditingLeave(false);
  }

  function handleCancelLeave() {
    setLeaveInput(user?.annual_leave_days || 0);
    setIsEditingLeave(false);
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <div className="bg-white px-4 py-4 border-b border-stone-100">
        <h1 className="text-lg font-bold text-stone-800">{t('profile')}</h1>
      </div>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* User Card */}
        <div className="bg-white rounded-xl p-5 border border-stone-100 flex items-center gap-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
            <i className="ri-user-line text-2xl text-emerald-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-stone-800 text-lg">{user?.name}</p>
            <p className="text-sm text-stone-500">{user?.employee_code}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                {user?.department}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                user?.role === 'manager'
                  ? 'bg-violet-100 text-violet-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}>
                {user?.role === 'manager' ? t('role_manager') : t('role_employee')}
              </span>
            </div>
          </div>
        </div>

        {/* 管制資訊 */}
        {userGroup && (
          <div className="space-y-3">
            {/* 今日管制資訊 */}
            {todayInfo && todayInfo.type !== 'rest' && (
              <div className="bg-white rounded-xl border border-stone-100 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-50 bg-stone-50/50">
                  <i className="ri-calendar-check-line text-emerald-500 text-sm" />
                  <span className="text-xs font-semibold text-stone-700">今日管制資訊</span>
                  <span className="text-[10px] text-stone-400">{todayInfo.label}</span>
                </div>
                <div className="p-4 space-y-2.5">
                  {/* 第一組 */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 min-w-[120px]">
                      <span className="text-[10px] text-stone-400 w-10">地點一</span>
                      <span className="text-xs text-rose-600 font-medium">
                        {todayInfo.controlLocation && todayInfo.controlLocation !== '-' ? todayInfo.controlLocation : '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-stone-400 w-10">時間一</span>
                      <span className="text-xs text-amber-600 font-medium">
                        {todayInfo.controlTime && todayInfo.controlTime !== '-' ? todayInfo.controlTime : '—'}
                      </span>
                    </div>
                  </div>
                  {/* 第二組 */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 min-w-[120px]">
                      <span className="text-[10px] text-stone-400 w-10">地點二</span>
                      <span className="text-xs text-rose-600 font-medium">
                        {todayInfo.controlLocation2 && todayInfo.controlLocation2 !== '-' ? todayInfo.controlLocation2 : '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-stone-400 w-10">時間二</span>
                      <span className="text-xs text-amber-600 font-medium">
                        {todayInfo.controlTime2 && todayInfo.controlTime2 !== '-' ? todayInfo.controlTime2 : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 明日管制資訊 */}
            {tomorrowInfo && tomorrowInfo.type !== 'rest' && (
              <div className="bg-white rounded-xl border border-stone-100 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-50 bg-stone-50/50">
                  <i className="ri-calendar-todo-line text-sky-500 text-sm" />
                  <span className="text-xs font-semibold text-stone-700">明日管制資訊</span>
                  <span className="text-[10px] text-stone-400">{tomorrowInfo.label}</span>
                </div>
                <div className="p-4 space-y-2.5">
                  {/* 第一組 */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 min-w-[120px]">
                      <span className="text-[10px] text-stone-400 w-10">地點一</span>
                      <span className="text-xs text-rose-600 font-medium">
                        {tomorrowInfo.controlLocation && tomorrowInfo.controlLocation !== '-' ? tomorrowInfo.controlLocation : '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-stone-400 w-10">時間一</span>
                      <span className="text-xs text-amber-600 font-medium">
                        {tomorrowInfo.controlTime && tomorrowInfo.controlTime !== '-' ? tomorrowInfo.controlTime : '—'}
                      </span>
                    </div>
                  </div>
                  {/* 第二組 */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 min-w-[120px]">
                      <span className="text-[10px] text-stone-400 w-10">地點二</span>
                      <span className="text-xs text-rose-600 font-medium">
                        {tomorrowInfo.controlLocation2 && tomorrowInfo.controlLocation2 !== '-' ? tomorrowInfo.controlLocation2 : '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-stone-400 w-10">時間二</span>
                      <span className="text-xs text-amber-600 font-medium">
                        {tomorrowInfo.controlTime2 && tomorrowInfo.controlTime2 !== '-' ? tomorrowInfo.controlTime2 : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {/* 特休 — 可編輯 */}
          <div className="bg-white rounded-xl p-4 border border-stone-100 relative">
            {!isEditingLeave ? (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-stone-500">{t('annual_leave')}{t('remaining_days')}</p>
                  <button
                    onClick={() => {
                      setLeaveInput(user?.annual_leave_days || 0);
                      setIsEditingLeave(true);
                    }}
                    className="text-stone-400 hover:text-emerald-600 transition-colors"
                    title="修改特休天數"
                  >
                    <i className="ri-edit-line text-sm" />
                  </button>
                </div>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{user?.annual_leave_days || 0}</p>
              </>
            ) : (
              <>
                <p className="text-xs text-stone-500 mb-2">{t('annual_leave')}{t('remaining_days')}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={leaveInput}
                    onChange={(e) => setLeaveInput(Number(e.target.value))}
                    className="w-20 px-2 py-1.5 rounded-lg border border-stone-200 text-stone-800 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    autoFocus
                  />
                  <span className="text-sm text-stone-500">天</span>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleSaveLeave}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium py-1.5 rounded-lg transition-colors"
                  >
                    確認
                  </button>
                  <button
                    onClick={handleCancelLeave}
                    className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-600 text-xs font-medium py-1.5 rounded-lg transition-colors"
                  >
                    取消
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 病假 — 唯讀 */}
          <div className="bg-white rounded-xl p-4 border border-stone-100">
            <p className="text-xs text-stone-500">{t('sick_leave')}{t('remaining_days')}</p>
            <p className="text-2xl font-bold text-sky-600 mt-1">{user?.sick_leave_days || 0}</p>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full bg-white hover:bg-red-50 border border-stone-200 hover:border-red-200 text-red-600 font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <i className="ri-logout-box-r-line" />
          {t('logout')}
        </button>
      </div>
    </div>
  );
}