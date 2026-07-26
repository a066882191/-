// ... existing imports ...
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { leaveTypes } from '@/mocks/leaveTypes';
import { addLeaveRequest } from '@/stores/leaveStore';

export default function LeaveApplyPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [leaveType, setLeaveType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [workShift, setWorkShift] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitError, setSubmitError] = useState('');

  // 季度申請窗口：1~3月申請1~4月、4~7月申請4~8月、8~11月申請8~12月、12月申請12月~隔年4月
  const APPLICATION_WINDOWS: Record<number, { min: Date; max: Date; label: string }> = {
    1: {
      min: new Date(new Date().getFullYear(), 0, 1),
      max: new Date(new Date().getFullYear(), 4, 0),
      label: '1/1 ~ 4/30',
    },
    2: {
      min: new Date(new Date().getFullYear(), 0, 1),
      max: new Date(new Date().getFullYear(), 4, 0),
      label: '1/1 ~ 4/30',
    },
    3: {
      min: new Date(new Date().getFullYear(), 0, 1),
      max: new Date(new Date().getFullYear(), 4, 0),
      label: '1/1 ~ 4/30',
    },
    4: {
      min: new Date(new Date().getFullYear(), 3, 1),
      max: new Date(new Date().getFullYear(), 8, 0),
      label: '4/1 ~ 8/31',
    },
    5: {
      min: new Date(new Date().getFullYear(), 3, 1),
      max: new Date(new Date().getFullYear(), 8, 0),
      label: '4/1 ~ 8/31',
    },
    6: {
      min: new Date(new Date().getFullYear(), 3, 1),
      max: new Date(new Date().getFullYear(), 8, 0),
      label: '4/1 ~ 8/31',
    },
    7: {
      min: new Date(new Date().getFullYear(), 3, 1),
      max: new Date(new Date().getFullYear(), 8, 0),
      label: '4/1 ~ 8/31',
    },
    8: {
      min: new Date(new Date().getFullYear(), 7, 1),
      max: new Date(new Date().getFullYear(), 12, 0),
      label: '8/1 ~ 12/31',
    },
    9: {
      min: new Date(new Date().getFullYear(), 7, 1),
      max: new Date(new Date().getFullYear(), 12, 0),
      label: '8/1 ~ 12/31',
    },
    10: {
      min: new Date(new Date().getFullYear(), 7, 1),
      max: new Date(new Date().getFullYear(), 12, 0),
      label: '8/1 ~ 12/31',
    },
    11: {
      min: new Date(new Date().getFullYear(), 7, 1),
      max: new Date(new Date().getFullYear(), 12, 0),
      label: '8/1 ~ 12/31',
    },
    12: {
      min: new Date(new Date().getFullYear(), 11, 1),
      max: new Date(new Date().getFullYear() + 1, 4, 0),
      label: `12/1 ~ ${new Date().getFullYear() + 1}/4/30`,
    },
  };

  const currentMonth = new Date().getMonth() + 1; // 1-indexed
  const currentWindow = APPLICATION_WINDOWS[currentMonth] ?? APPLICATION_WINDOWS[1];

  // 避免時區偏移：用本地時間組 YYYY-MM-DD 字串
  function toLocalDateString(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const minDate = toLocalDateString(currentWindow.min);
  const maxDate = toLocalDateString(currentWindow.max);
  const windowLabel = currentWindow.label;

  // 7天緩衝：開始日期必須距離今天至少7天（今天算第1天，最早可選 今天+7）
  const today = new Date();
  const sevenDaysLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const minAdvanceDate = toLocalDateString(sevenDaysLater);
  const effectiveMinDate = minDate > minAdvanceDate ? minDate : minAdvanceDate;

  // 計算請假天數（自然日，含首尾）
  const daysCount = (() => {
    if (!startDate || !endDate) return 0;
    const s = new Date(startDate);
    const e = new Date(endDate);
    const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 0;
  })();

  const isDateValid = (() => {
    if (!startDate) return true;
    if (startDate < effectiveMinDate || startDate > maxDate) return false;
    if (endDate) {
      if (endDate < effectiveMinDate || endDate > maxDate) return false;
      if (endDate < startDate) return false;
    }
    return true;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitError('');
    if (!user || !leaveType || !startDate || !endDate) return;

    if (startDate < effectiveMinDate) {
      setErrorMsg(`請假須提前 7 天申請，最早可選 ${effectiveMinDate}，請重新選擇`);
      return;
    }
    if (startDate < minDate || startDate > maxDate) {
      setErrorMsg(`開始日期僅限 ${minDate} 至 ${maxDate}，請重新選擇`);
      return;
    }
    if (endDate < effectiveMinDate) {
      setErrorMsg(`結束日期須提前 7 天申請，最早可選 ${effectiveMinDate}，請重新選擇`);
      return;
    }
    if (endDate < minDate || endDate > maxDate) {
      setErrorMsg(`結束日期僅限 ${minDate} 至 ${maxDate}，請重新選擇`);
      return;
    }
    if (endDate < startDate) {
      setErrorMsg('結束日期不能早於開始日期');
      return;
    }

    setSubmitting(true);
    try {
      await addLeaveRequest({
        employee_id: user.id,
        employee_name: user.name,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        days_count: daysCount,
        reason: reason.trim(),
        work_shift: workShift,
      });
      setSubmitting(false);
      setShowSuccess(true);
      setTimeout(() => {
        navigate('/leave/records');
      }, 1200);
    } catch (err) {
      setSubmitting(false);
      setSubmitError(err instanceof Error ? err.message : '提交失敗，請稍後再試');
    }
  };

  const selectedType = leaveTypes.find((t) => t.id === leaveType);

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
        <h1 className="text-lg font-bold text-stone-800">{t('leave_apply')}</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5">
        {showSuccess ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <i className="ri-check-line text-2xl text-emerald-600" />
            </div>
            <p className="font-medium text-emerald-800">申請已提交</p>
            <p className="text-sm text-emerald-600 mt-1">請假申請已成功送出，等待主管審核</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 假別選擇 */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                {t('leave_type')} <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {leaveTypes.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setLeaveType(type.id)}
                    className={`flex items-center gap-2 px-3 py-3 rounded-xl border text-sm font-medium transition-all text-left ${
                      leaveType === type.id
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500'
                        : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${type.color}`}>
                      <i className={type.icon} />
                    </div>
                    <span className="truncate">{type.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 日期選擇 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  {t('start_date')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  min={effectiveMinDate}
                  max={maxDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStartDate(val);
                    setErrorMsg('');
                    if (val && endDate && val > endDate) {
                      setEndDate(val);
                    }
                  }}
                  className={`w-full px-3 py-2.5 rounded-xl border text-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors ${
                    !isDateValid && startDate ? 'border-red-300 bg-red-50' : 'border-stone-200'
                  }`}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  {t('end_date')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || effectiveMinDate}
                  max={maxDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEndDate(val);
                    setErrorMsg('');
                  }}
                  className={`w-full px-3 py-2.5 rounded-xl border text-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors ${
                    !isDateValid && endDate ? 'border-red-300 bg-red-50' : 'border-stone-200'
                  }`}
                  required
                />
              </div>
            </div>
            <p className="text-xs text-stone-400 -mt-3">
              請假日期範圍：{windowLabel}（須提前 7 天申請）
            </p>

            {/* 工作班 */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                工作班別
                <span className="text-xs text-stone-400 font-normal ml-1">（選填，跨天請逐日填寫）</span>
              </label>
              <textarea
                value={workShift}
                onChange={(e) => setWorkShift(e.target.value)}
                placeholder={`例如：\n05/26（一）日勤\n05/27（二）701\n05/28（三）702`}
                rows={3}
                maxLength={200}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
              />
              <p className="text-xs text-stone-400 mt-1 text-right">{workShift.length}/200</p>
            </div>

            {/* 錯誤提示 */}
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
                <i className="ri-error-warning-line text-red-500" />
                <p className="text-sm text-red-700">{errorMsg}</p>
              </div>
            )}

            {/* 提交錯誤提示 */}
            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
                <i className="ri-error-warning-line text-red-500" />
                <p className="text-sm text-red-700">{submitError}</p>
              </div>
            )}

            {/* 天數統計 */}
            {daysCount > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <i className="ri-time-line text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-800">{t('days_count')}</span>
                </div>
                <span className="text-lg font-bold text-emerald-700">{daysCount} 天</span>
              </div>
            )}

            {/* 請假事由 */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                {t('reason')}（選填）
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="請說明請假原因..."
                rows={4}
                maxLength={500}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
              />
              <p className="text-xs text-stone-400 mt-1 text-right">{reason.length}/500</p>
            </div>

            {/* 選中的假別提示 */}
            {selectedType && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${selectedType.color}`}>
                <i className={selectedType.icon} />
                <span>已選擇：{selectedType.name}</span>
              </div>
            )}

            {/* 提交按鈕 */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="flex-1 px-4 py-3 rounded-xl border border-stone-200 text-stone-600 font-medium text-sm hover:bg-stone-50 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={submitting || !leaveType || !startDate || !endDate || !isDateValid}
                className="flex-[2] bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-medium py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <i className="ri-loader-4-line animate-spin" />
                    提交中...
                  </>
                ) : (
                  <>
                    <i className="ri-send-plane-line" />
                    {t('submit')}
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}