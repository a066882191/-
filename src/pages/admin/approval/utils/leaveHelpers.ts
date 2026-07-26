import type { LeaveRequest } from '@/stores/leaveStore';
import { getAllEmployees } from '@/mocks/employees';
import { leaveTypes } from '@/mocks/leaveTypes';

export function groupByDate(requests: LeaveRequest[]) {
  const groups: Record<string, LeaveRequest[]> = {};
  for (const req of requests) {
    const start = new Date(req.start_date);
    const end = new Date(req.end_date);
    const added = new Set<string>();
    const current = new Date(start);
    while (current <= end) {
      const date = current.toISOString().split('T')[0];
      if (!added.has(date)) {
        added.add(date);
        if (!groups[date]) groups[date] = [];
        groups[date].push(req);
      }
      current.setDate(current.getDate() + 1);
    }
  }
  Object.values(groups).forEach((arr) =>
    arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
  );
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

export function groupByMonth(requests: LeaveRequest[]) {
  const months: Record<string, Record<string, LeaveRequest[]>> = {};
  for (const req of requests) {
    const startDate = new Date(req.start_date);
    const endDate = new Date(req.end_date);

    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (cursor <= endDate) {
      const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      if (!months[monthKey]) months[monthKey] = {};

      const dayInMonth = cursor > startDate
        ? cursor.toISOString().split('T')[0]
        : req.start_date;

      if (!months[monthKey][dayInMonth]) months[monthKey][dayInMonth] = [];
      months[monthKey][dayInMonth].push(req);

      cursor.setMonth(cursor.getMonth() + 1);
    }
  }
  const sortedMonths = Object.entries(months).sort(([a], [b]) => b.localeCompare(a));
  return sortedMonths.map(([month, dates]) => {
    const sortedDates = Object.entries(dates).sort(([a], [b]) => a.localeCompare(b));
    sortedDates.forEach(([, arr]) =>
      arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    );
    return [month, sortedDates] as [string, [string, LeaveRequest[]][]];
  });
}

export function sortByLeaveType(a: LeaveRequest, b: LeaveRequest) {
  const aLast = a.leave_type === 'compensatory' || a.leave_type === 'annual';
  const bLast = b.leave_type === 'compensatory' || b.leave_type === 'annual';
  if (aLast && !bLast) return 1;
  if (!aLast && bLast) return -1;
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

export function formatWeekday(dateStr: string) {
  const d = new Date(dateStr);
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return weekdays[d.getDay()];
}

export function formatMonthLabel(monthStr: string) {
  const [y, m] = monthStr.split('-');
  return `${y} 年 ${m} 月`;
}

export function getEmployeeInfo(employeeId: string) {
  return getAllEmployees().find((e) => e.id === employeeId);
}

export function requestOverlapsMonth(r: LeaveRequest, year: number, month: number): boolean {
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  return r.start_date <= monthEnd && r.end_date >= monthStart;
}

export function requestCoversDate(r: LeaveRequest, dateStr: string): boolean {
  return dateStr >= r.start_date && dateStr <= r.end_date;
}