import { useMemo } from 'react';
import { getLeaveRequests, useLeaveStore } from '@/stores/leaveStore';
import { getAllEmployees } from '@/mocks/employees';
import { leaveTypes } from '@/mocks/leaveTypes';
import type { LeaveRequest } from '@/stores/leaveStore';

export interface DayLeaveInfo {
  id: string;
  employeeName: string;
  title: string;
  leaveTypeName: string;
  leaveTypeColor: string;
  leaveTypeIcon: string;
  status: string;
  createdAt: string;
  startDate: string;
}

interface CalendarGridProps {
  year: number;
  month: number;
  todayStr: string;
  onSelectDay: (dateStr: string, leaves: DayLeaveInfo[]) => void;
}

const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

function getLeavesForDate(dateStr: string, requests: LeaveRequest[]): DayLeaveInfo[] {
  return requests
    .filter((req) => dateStr >= req.start_date && dateStr <= req.end_date)
    .map((req) => {
      const emp = getAllEmployees().find((e) => e.id === req.employee_id);
      const lt = leaveTypes.find((t) => t.id === req.leave_type);
      return {
        id: req.id,
        employeeName: req.employee_name,
        title: emp?.title || '司機員',
        leaveTypeName: lt?.name || req.leave_type_name,
        leaveTypeColor: lt?.color || 'bg-stone-100 text-stone-700',
        leaveTypeIcon: lt?.icon || 'ri-calendar-line',
        status: req.status,
        createdAt: req.created_at,
        startDate: req.start_date,
      };
    });
}

function isToday(dateStr: string, todayStr: string) {
  return dateStr === todayStr;
}

export default function CalendarGrid({ year, month, todayStr, onSelectDay }: CalendarGridProps) {
  useLeaveStore();
  const allRequests = getLeaveRequests();

  const days = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const totalDays = lastDay.getDate();
    const startWeekDay = firstDay.getDay();

    const paddingStart = startWeekDay;
    const cells: {
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      leaves: DayLeaveInfo[];
    }[] = [];

    // Previous month padding
    const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
    for (let i = paddingStart - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const ds = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ dateStr: ds, dayNum: d, isCurrentMonth: false, leaves: getLeavesForDate(ds, allRequests) });
    }

    // Current month
    for (let d = 1; d <= totalDays; d++) {
      const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ dateStr: ds, dayNum: d, isCurrentMonth: true, leaves: getLeavesForDate(ds, allRequests) });
    }

    // Next month padding to fill 42 cells (6 rows)
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const ds = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ dateStr: ds, dayNum: d, isCurrentMonth: false, leaves: getLeavesForDate(ds, allRequests) });
    }

    return cells;
  }, [year, month, allRequests]);

  const rows: typeof days[] = [];
  for (let i = 0; i < days.length; i += 7) {
    rows.push(days.slice(i, i + 7));
  }

  function statusDot(status: string) {
    if (status === 'approved') return 'bg-emerald-500';
    if (status === 'pending') return 'bg-amber-400';
    if (status === 'rejected') return 'bg-red-400';
    if (status === 'cancelled') return 'bg-stone-300';
    return 'bg-stone-300';
  }

  function statusOpacity(status: string) {
    if (status === 'rejected') return 'opacity-50';
    if (status === 'cancelled') return 'opacity-40 grayscale';
    return '';
  }

  return (
    <div className="bg-white rounded-xl border border-stone-100 overflow-hidden">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-stone-100">
        {weekDays.map((wd) => (
          <div key={wd} className="text-center py-2 text-xs font-medium text-stone-400">
            {wd}
          </div>
        ))}
      </div>

      {/* Calendar rows */}
      <div>
        {rows.map((row, ri) => (
          <div key={ri} className="grid grid-cols-7 border-b border-stone-50 last:border-b-0">
            {row.map((cell) => {
              const today = isToday(cell.dateStr, todayStr);
              const hasLeaves = cell.leaves.length > 0;
              const maxDisplay = 4;
              const displayLeaves = cell.leaves.slice(0, maxDisplay);
              const moreCount = cell.leaves.length - maxDisplay;
              const approvedCount = cell.leaves.filter(l => l.status === 'approved').length;

              return (
                <button
                  key={cell.dateStr}
                  onClick={() => onSelectDay(cell.dateStr, cell.leaves)}
                  className={`relative min-h-[80px] md:min-h-[100px] p-1 flex flex-col items-start text-left transition-colors hover:bg-stone-50
                    ${!cell.isCurrentMonth ? 'bg-stone-50/50' : ''}
                    ${today ? 'bg-emerald-50/40' : ''}
                  `}
                >
                  {/* Day number + approved badge */}
                  <div className="flex items-center gap-1 mb-0.5">
                    <span
                      className={`text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-full
                        ${today ? 'bg-emerald-600 text-white' : ''}
                        ${!cell.isCurrentMonth && !today ? 'text-stone-300' : 'text-stone-700'}
                        ${!today && cell.isCurrentMonth ? 'text-stone-600' : ''}
                      `}
                    >
                      {cell.dayNum}
                    </span>
                    {approvedCount > 0 && (
                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 rounded px-1 py-[1px] leading-none">
                        {approvedCount}核
                      </span>
                    )}
                  </div>

                  {/* Leave tags */}
                  <div className="w-full flex flex-col gap-[2px]">
                    {displayLeaves.map((leave) => (
                      <div
                        key={leave.id}
                        className={`w-full flex items-center gap-1 rounded px-1 py-[2px] text-[10px] leading-tight truncate bg-stone-50 border-l-2 ${statusOpacity(leave.status)}
                          ${leave.status === 'approved' ? 'border-l-emerald-400 bg-emerald-50/50' : ''}
                          ${leave.status === 'pending' ? 'border-l-amber-400 bg-amber-50/50' : ''}
                          ${leave.status === 'rejected' ? 'border-l-red-300 bg-red-50/30' : ''}
                        `}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot(leave.status)}`} />
                        <span className="truncate text-stone-600 font-medium">
                          {leave.employeeName}
                        </span>
                        <span className="truncate text-stone-400">
                          {leave.leaveTypeName}
                        </span>
                      </div>
                    ))}
                    {moreCount > 0 && (
                      <span className="text-[10px] text-stone-500 px-1 font-medium bg-stone-100 rounded inline-block w-fit">
                        +{moreCount} 筆
                      </span>
                    )}
                    {!hasLeaves && cell.isCurrentMonth && (
                      <span className="text-[10px] text-stone-200 px-1 invisible">-</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}