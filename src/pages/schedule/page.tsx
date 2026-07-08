import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import CalendarGrid, { type DayLeaveInfo } from './components/CalendarGrid';
import DayDetailModal from './components/DayDetailModal';

export default function SchedulePage() {
  const { t } = useTranslation();
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<{ dateStr: string; leaves: DayLeaveInfo[] } | null>(null);

  const todayStr = useMemo(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [today]);

  const monthLabel = `${year} 年 ${month} 月`;

  function goPrevMonth() {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  }

  function goNextMonth() {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  }

  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
  }

  function handleSelectDay(dateStr: string, leaves: DayLeaveInfo[]) {
    setSelectedDay({ dateStr, leaves });
    setModalOpen(true);
  }

  function handleCloseModal() {
    setModalOpen(false);
    setTimeout(() => setSelectedDay(null), 200);
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-28">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-stone-100">
        <h1 className="text-lg font-bold text-stone-800">{t('schedule')}</h1>
      </div>

      <div className="max-w-lg mx-auto px-3 md:px-4 py-4 space-y-4">
        {/* Month navigator */}
        <div className="bg-white rounded-xl border border-stone-100 px-4 py-3 flex items-center justify-between">
          <button
            onClick={goPrevMonth}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-stone-50 transition-colors"
          >
            <div className="w-5 h-5 flex items-center justify-center">
              <i className="ri-arrow-left-s-line text-lg text-stone-600" />
            </div>
          </button>

          <div className="text-center">
            <p className="text-base font-bold text-stone-800">{monthLabel}</p>
          </div>

          <button
            onClick={goNextMonth}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-stone-50 transition-colors"
          >
            <div className="w-5 h-5 flex items-center justify-center">
              <i className="ri-arrow-right-s-line text-lg text-stone-600" />
            </div>
          </button>
        </div>

        {/* Today button */}
        <div className="flex items-center justify-between">
          <button
            onClick={goToday}
            className="text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            <span className="flex items-center gap-1">
              <i className="ri-focus-3-line" />
              {t('today')}
            </span>
          </button>
          <p className="text-xs text-stone-400">點擊日期查看詳情</p>
        </div>

        {/* Calendar */}
        <CalendarGrid
          year={year}
          month={month}
          todayStr={todayStr}
          onSelectDay={handleSelectDay}
        />

        {/* Legend */}
        <div className="bg-white rounded-xl border border-stone-100 px-4 py-3">
          <p className="text-xs font-medium text-stone-500 mb-2">圖例說明</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-stone-500">已核准</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-xs text-stone-500">待審核</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-xs text-stone-500">已駁回</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600 text-white text-[8px] flex items-center justify-center">今</span>
              <span className="text-xs text-stone-500">今天</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && selectedDay && (
        <DayDetailModal
          dateStr={selectedDay.dateStr}
          leaves={selectedDay.leaves}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}