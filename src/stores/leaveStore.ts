import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { leaveTypes } from '@/mocks/leaveTypes';
import { getAllEmployees } from '@/mocks/employees';

export interface LeaveRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  leave_type: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  days_count: number;
  reason: string;
  work_shift: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approver_id: string | null;
  approver_comment: string;
  created_at: string;
  updated_at: string;
}

export interface DayApproval {
  id: string;
  request_id: string;
  date: string;
  status: 'approved' | 'rejected';
  approver_id: string;
  approver_comment: string;
  created_at: string;
}

export interface DayCancellation {
  id: string;
  request_id: string;
  date: string;
  employee_id: string;
  created_at: string;
}

let requests: LeaveRequest[] = [];
let dayApprovals: DayApproval[] = [];
let dayCancellations: DayCancellation[] = [];
const listeners = new Set<() => void>();
let isLoading = false;
let loadError: string | null = null;

function emit() {
  listeners.forEach((l) => l());
}

function mapRow(row: Record<string, unknown>): LeaveRequest {
  const dateOnly = (v: unknown) => String(v).split('T')[0];
  return {
    id: String(row.id),
    employee_id: String(row.employee_id),
    employee_name: String(row.employee_name),
    leave_type: String(row.leave_type),
    leave_type_name: String(row.leave_type_name),
    start_date: dateOnly(row.start_date),
    end_date: dateOnly(row.end_date),
    start_time: String(row.start_time),
    end_time: String(row.end_time),
    days_count: Number(row.days_count),
    reason: String(row.reason || ''),
    work_shift: String(row.work_shift || ''),
    status: String(row.status) as LeaveRequest['status'],
    approver_id: row.approver_id ? String(row.approver_id) : null,
    approver_comment: String(row.approver_comment || ''),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

// 從 Supabase 載入所有請假紀錄
export async function loadLeaveRequests(): Promise<void> {
  if (isLoading) return;
  isLoading = true;
  try {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('載入請假紀錄失敗:', error);
      return;
    }

    loadError = null;
    requests = (data || []).map(mapRow);
    emit();

    // 同時載入逐日審核紀錄與逐日取消紀錄
    await loadDayApprovalsSilent();
    await loadDayCancellationsSilent();
  } catch (err) {
    console.error('載入請假紀錄異常:', err);
    loadError = err instanceof Error ? err.message : '載入請假資料時發生錯誤';
    emit();
  } finally {
    isLoading = false;
  }
}

// 靜默載入逐日審核（不觸發 isLoading 鎖）
async function loadDayApprovalsSilent(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('leave_day_approvals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('載入逐日審核紀錄失敗:', error);
      return;
    }

    dayApprovals = (data || []).map(mapDayRow);
    emit();
  } catch (err) {
    console.error('載入逐日審核紀錄異常:', err);
  }
}

// 靜默載入逐日取消紀錄
async function loadDayCancellationsSilent(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('leave_day_cancellations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('載入逐日取消紀錄失敗:', error);
      return;
    }

    dayCancellations = (data || []).map(mapDayCancelRow);
    emit();
  } catch (err) {
    console.error('載入逐日取消紀錄異常:', err);
  }
}

export async function loadDayCancellations(): Promise<void> {
  await loadDayCancellationsSilent();
}

// ========== 逐日取消 ==========

export function getDayCancellations(): DayCancellation[] {
  return [...dayCancellations];
}

export function getCancelledDaysForRequest(requestId: string): string[] {
  return dayCancellations
    .filter((d) => d.request_id === requestId)
    .map((d) => d.date);
}

/**
 * 回傳一個 Map：date string → true（表示該日已被員工自行取消）
 */
export function getDayCancelledMap(requestId: string): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const d of dayCancellations) {
    if (d.request_id === requestId) {
      map[d.date] = true;
    }
  }
  return map;
}

export function isDayCancelled(requestId: string, date: string): boolean {
  return dayCancellations.some((d) => d.request_id === requestId && d.date === date);
}

/**
 * 員工取消單一請假日
 */
export async function cancelLeaveDay(
  requestId: string,
  date: string,
  employeeId: string,
): Promise<void> {
  try {
    // 檢查該天是否已被管理端審核過（已核准或已駁回的不能取消）
    const dayMap = getRequestDayStatusMap(requestId);
    if (dayMap[date]) {
      throw new Error(`${date} 已被審核，無法取消`);
    }

    const { error } = await supabase
      .from('leave_day_cancellations')
      .upsert(
        {
          request_id: requestId,
          date,
          employee_id: employeeId,
        },
        { onConflict: 'request_id,date' },
      );

    if (error) {
      console.error('逐日取消失敗:', error);
      throw new Error(error.message);
    }

    await loadDayCancellationsSilent();

    // 如果所有天數都被取消，也把整筆申請狀態更新為 cancelled
    await syncRequestStatusIfAllCancelled(requestId);
  } catch (err) {
    console.error('逐日取消異常:', err);
    throw err;
  }
}

/**
 * 員工批次取消多個請假日
 */
export async function cancelLeaveDays(
  requestId: string,
  dates: string[],
  employeeId: string,
): Promise<{ success: boolean; error?: string; cancelledCount: number }> {
  try {
    if (dates.length === 0) {
      return { success: false, error: '請至少選取一天', cancelledCount: 0 };
    }

    // 檢查是否有已被審核的天
    const dayMap = getRequestDayStatusMap(requestId);
    const blockedDates = dates.filter((d) => dayMap[d]);
    if (blockedDates.length > 0) {
      throw new Error(`${blockedDates.join('、')} 已被審核，無法取消`);
    }

    const rows = dates.map((date) => ({
      request_id: requestId,
      date,
      employee_id: employeeId,
    }));

    const { error } = await supabase
      .from('leave_day_cancellations')
      .upsert(rows, { onConflict: 'request_id,date' });

    if (error) {
      console.error('批次逐日取消失敗:', error);
      return { success: false, error: error.message, cancelledCount: 0 };
    }

    await loadDayCancellationsSilent();

    // 如果所有天數都被取消，也把整筆申請狀態更新為 cancelled
    await syncRequestStatusIfAllCancelled(requestId);

    return { success: true, cancelledCount: dates.length };
  } catch (err) {
    console.error('批次逐日取消異常:', err);
    return { success: false, error: err instanceof Error ? err.message : '取消失敗，請稍後再試', cancelledCount: 0 };
  }
}

/**
 * 檢查某筆申請是否所有日都被取消，如果是就把整筆狀態設為 cancelled
 */
async function syncRequestStatusIfAllCancelled(requestId: string): Promise<void> {
  try {
    const req = requests.find((r) => r.id === requestId);
    if (!req || req.status !== 'pending') return;

    const cancelledDays = getCancelledDaysForRequest(requestId);
    const start = new Date(req.start_date + 'T00:00:00');
    const end = new Date(req.end_date + 'T00:00:00');
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (cancelledDays.length >= totalDays) {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) {
        console.error('同步取消狀態失敗:', error);
      }

      await loadLeaveRequests();
    }
  } catch (err) {
    console.error('同步取消狀態異常:', err);
  }
}

export async function addLeaveRequest(
  data: Omit<LeaveRequest, 'id' | 'created_at' | 'updated_at' | 'status' | 'approver_id' | 'approver_comment' | 'leave_type_name' | 'start_time' | 'end_time'>
    & Partial<Pick<LeaveRequest, 'leave_type_name' | 'start_time' | 'end_time'>>
) {
  // 驗證 employee_id 是否存在于員工資料表中
  const allEmployees = getAllEmployees();
  const empExists = allEmployees.some((e) => e.id === data.employee_id);
  if (!empExists) {
    throw new Error(
      `員工 ID "${data.employee_id}" 不存在於資料庫中，請重新登入後再試。`
    );
  }

  // 驗證日期範圍：季度申請窗口
  const today = new Date();
  const currentMonth = today.getMonth() + 1; // 1-indexed

  const WINDOWS: Record<number, { min: Date; max: Date }> = {
    1: {
      min: new Date(today.getFullYear(), 0, 1),
      max: new Date(today.getFullYear(), 4, 0),
    },
    2: {
      min: new Date(today.getFullYear(), 0, 1),
      max: new Date(today.getFullYear(), 4, 0),
    },
    3: {
      min: new Date(today.getFullYear(), 0, 1),
      max: new Date(today.getFullYear(), 4, 0),
    },
    4: {
      min: new Date(today.getFullYear(), 3, 1),
      max: new Date(today.getFullYear(), 8, 0),
    },
    5: {
      min: new Date(today.getFullYear(), 3, 1),
      max: new Date(today.getFullYear(), 8, 0),
    },
    6: {
      min: new Date(today.getFullYear(), 3, 1),
      max: new Date(today.getFullYear(), 8, 0),
    },
    7: {
      min: new Date(today.getFullYear(), 3, 1),
      max: new Date(today.getFullYear(), 8, 0),
    },
    8: {
      min: new Date(today.getFullYear(), 7, 1),
      max: new Date(today.getFullYear(), 12, 0),
    },
    9: {
      min: new Date(today.getFullYear(), 7, 1),
      max: new Date(today.getFullYear(), 12, 0),
    },
    10: {
      min: new Date(today.getFullYear(), 7, 1),
      max: new Date(today.getFullYear(), 12, 0),
    },
    11: {
      min: new Date(today.getFullYear(), 7, 1),
      max: new Date(today.getFullYear(), 12, 0),
    },
    12: {
      min: new Date(today.getFullYear(), 11, 1),
      max: new Date(today.getFullYear() + 1, 4, 0),
    },
  };

  const win = WINDOWS[currentMonth];
  if (!win) {
    throw new Error('目前非申請開放期間，請假申請僅於每年 1~3 月、4 月、8 月、12 月開放');
  }

  const minAllowed = win.min;
  const maxAllowed = win.max;

  const startObj = new Date(data.start_date + 'T00:00:00');
  const endObj = new Date(data.end_date + 'T00:00:00');

  if (startObj < minAllowed || startObj > maxAllowed) {
    throw new Error(`開始日期超出允許範圍，僅開放 ${minAllowed.toLocaleDateString('zh-TW')} 至 ${maxAllowed.toLocaleDateString('zh-TW')} 申請`);
  }
  if (endObj < minAllowed || endObj > maxAllowed) {
    throw new Error(`結束日期超出允許範圍，僅開放 ${minAllowed.toLocaleDateString('zh-TW')} 至 ${maxAllowed.toLocaleDateString('zh-TW')} 申請`);
  }

  const typeName = data.leave_type_name || leaveTypes.find((t) => t.id === data.leave_type)?.name || data.leave_type;

  try {
    const { data: inserted, error } = await supabase
      .from('leave_requests')
      .insert({
        employee_id: data.employee_id,
        employee_name: data.employee_name,
        leave_type: data.leave_type,
        leave_type_name: typeName,
        start_date: data.start_date,
        end_date: data.end_date,
        start_time: data.start_time || '09:00',
        end_time: data.end_time || '18:00',
        days_count: data.days_count,
        reason: data.reason,
        work_shift: data.work_shift || '',
        status: 'pending',
        approver_id: null,
        approver_comment: '',
      })
      .select()
      .single();

    if (error) {
      console.error('新增請假申請失敗:', error);
      throw new Error(error.message);
    }

    // 重新載入以確保資料一致性
    await loadLeaveRequests();
    return mapRow(inserted);
  } catch (err) {
    console.error('新增請假申請異常:', err);
    throw err instanceof Error ? err : new Error('新增申請失敗，請稍後再試');
  }
}

// ========== 逐日審核 ==========

function mapDayRow(row: Record<string, unknown>): DayApproval {
  return {
    id: String(row.id),
    request_id: String(row.request_id),
    date: String(row.date).split('T')[0],
    status: String(row.status) as DayApproval['status'],
    approver_id: String(row.approver_id),
    approver_comment: String(row.approver_comment || ''),
    created_at: String(row.created_at),
  };
}

function mapDayCancelRow(row: Record<string, unknown>): DayCancellation {
  return {
    id: String(row.id),
    request_id: String(row.request_id),
    date: String(row.date).split('T')[0],
    employee_id: String(row.employee_id),
    created_at: String(row.created_at),
  };
}

export async function loadDayApprovals(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('leave_day_approvals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('載入逐日審核紀錄失敗:', error);
      return;
    }

    dayApprovals = (data || []).map(mapDayRow);
    emit();
  } catch (err) {
    console.error('載入逐日審核紀錄異常:', err);
  }
}

export function getDayApprovals(): DayApproval[] {
  return [...dayApprovals];
}

export function getDayApprovalsForRequest(requestId: string): DayApproval[] {
  return dayApprovals.filter((d) => d.request_id === requestId);
}

/**
 * 回傳一個 Map：date string → 'approved' | 'rejected'
 */
export function getRequestDayStatusMap(requestId: string): Record<string, 'approved' | 'rejected'> {
  const map: Record<string, 'approved' | 'rejected'> = {};
  for (const d of dayApprovals) {
    if (d.request_id === requestId) {
      map[d.date] = d.status;
    }
  }
  return map;
}

/**
 * 對某一筆請假的「單一一天」進行核准或駁回。
 * 完全獨立：只寫入該 (request_id, date) 一列，絕不觸碰其他天，
 * 也絕不改動整筆 leave_requests.status（沒有任何整筆同步邏輯）。
 */
export async function approveRejectDay(
  requestId: string,
  date: string,
  dayStatus: 'approved' | 'rejected',
  approverId: string,
  comment: string = '',
): Promise<void> {
  try {
    // 以 (request_id, date) 為唯一鍵做 upsert：
    // 同一天重複審核只會覆寫「那一天」，不會影響其他天。
    const { error } = await supabase
      .from('leave_day_approvals')
      .upsert(
        {
          request_id: requestId,
          date,
          status: dayStatus,
          approver_id: approverId,
          approver_comment: comment,
        },
        { onConflict: 'request_id,date' },
      );

    if (error) {
      console.error('逐日審核失敗:', error);
      throw new Error(error.message);
    }

    await loadDayApprovals();
  } catch (err) {
    console.error('逐日審核異常:', err);
    throw err instanceof Error ? err : new Error('審核操作失敗，請稍後再試');
  }
}

/**
 * 刪除某一筆請假的單日審核紀錄，讓該天回到待審狀態。
 */
export async function removeDayApproval(
  requestId: string,
  date: string,
): Promise<void> {
  try {
    const { error } = await supabase
      .from('leave_day_approvals')
      .delete()
      .eq('request_id', requestId)
      .eq('date', date);

    if (error) {
      console.error('移除逐日審核失敗:', error);
      throw new Error(error.message);
    }

    await loadDayApprovals();
  } catch (err) {
    console.error('移除逐日審核異常:', err);
    throw err instanceof Error ? err : new Error('移除審核操作失敗，請稍後再試');
  }
}

/**
 * 依逐日審核結果計算「衍生」的整體摘要（僅供顯示 / 篩選使用）。
 * 注意：這只是讀取計算，不會寫回 leave_requests，避免任何整筆同步副作用。
 * - 'pending'  : 尚無任何一天被審核
 * - 'partial'  : 部分天已審 / 已審天有核准也有駁回
 * - 'approved' : 全部天都審完且都是核准
 * - 'rejected' : 全部天都審完且都是駁回
 */
export function getRequestDerivedStatus(
  requestId: string,
): 'pending' | 'partial' | 'approved' | 'rejected' {
  const req = requests.find((r) => r.id === requestId);
  if (!req) return 'pending';

  const map = getRequestDayStatusMap(requestId);
  const reviewedDates = Object.keys(map);
  if (reviewedDates.length === 0) return 'pending';

  const start = new Date(req.start_date + 'T00:00:00');
  const end = new Date(req.end_date + 'T00:00:00');
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const allApproved = reviewedDates.every((d) => map[d] === 'approved');
  const allRejected = reviewedDates.every((d) => map[d] === 'rejected');

  if (reviewedDates.length < totalDays) return 'partial';
  if (allApproved) return 'approved';
  if (allRejected) return 'rejected';
  return 'partial';
}

export function getLeaveRequests(): LeaveRequest[] {
  return [...requests];
}

export function getLeaveRequestsByEmployee(employeeId: string): LeaveRequest[] {
  return requests.filter((r) => r.employee_id === employeeId);
}

export function getPendingRequests(): LeaveRequest[] {
  return requests.filter((r) => r.status === 'pending');
}

export async function updateLeaveStatus(
  id: string,
  status: 'approved' | 'rejected',
  approverId: string,
  comment: string
) {
  try {
    const { error } = await supabase
      .from('leave_requests')
      .update({
        status,
        approver_id: approverId,
        approver_comment: comment,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('更新請假狀態失敗:', error);
      throw new Error(error.message);
    }

    await loadLeaveRequests();
  } catch (err) {
    console.error('更新請假狀態異常:', err);
    throw err instanceof Error ? err : new Error('更新狀態失敗，請稍後再試');
  }
}

export async function cancelLeaveRequest(
  employeeId: string,
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const idx = requests.findIndex((r) => r.id === requestId && r.employee_id === employeeId);
    if (idx < 0) {
      return { success: false, error: '找不到該請假申請' };
    }

    if (requests[idx].status !== 'pending') {
      return { success: false, error: '僅「待審核」的申請可以取消' };
    }

    // 檢查是否在請假開始日期前 10 天內（10 天內不可取消）
    const startDate = new Date(requests[idx].start_date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysDiff = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff < 10) {
      return { success: false, error: '請假開始日期前 10 天內不可取消' };
    }

    // 更新 Supabase 狀態
    const { error } = await supabase
      .from('leave_requests')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('employee_id', employeeId);

    if (error) {
      console.error('取消請假申請失敗:', error);
      return { success: false, error: error.message };
    }

    // 重新載入
    await loadLeaveRequests();
    return { success: true };
  } catch (err) {
    console.error('取消請假申請異常:', err);
    return { success: false, error: err instanceof Error ? err.message : '取消失敗，請稍後再試' };
  }
}

export async function supervisorCancelLeaveRequest(
  supervisorId: string,
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const idx = requests.findIndex((r) => r.id === requestId);
    if (idx < 0) {
      return { success: false, error: '找不到該請假申請' };
    }

    if (requests[idx].status === 'cancelled') {
      return { success: false, error: '該申請已取消' };
    }

    const { error } = await supabase
      .from('leave_requests')
      .update({
        status: 'cancelled',
        approver_id: supervisorId,
        approver_comment: supervisorId === requests[idx].employee_id ? '自行取消' : '主管取消',
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (error) {
      console.error('取消請假申請失敗:', error);
      return { success: false, error: error.message };
    }

    await loadLeaveRequests();
    return { success: true };
  } catch (err) {
    console.error('取消請假申請異常:', err);
    return { success: false, error: err instanceof Error ? err.message : '取消失敗，請稍後再試' };
  }
}

export async function supervisorCancelLeaveDays(
  requestId: string,
  dates: string[],
  supervisorId: string,
): Promise<{ success: boolean; error?: string; cancelledCount: number }> {
  try {
    if (dates.length === 0) {
      return { success: false, error: '請至少選取一天', cancelledCount: 0 };
    }

    const rows = dates.map((date) => ({
      request_id: requestId,
      date,
      employee_id: supervisorId,
    }));

    const { error } = await supabase
      .from('leave_day_cancellations')
      .upsert(rows, { onConflict: 'request_id,date' });

    if (error) {
      console.error('主管逐日取消失敗:', error);
      return { success: false, error: error.message, cancelledCount: 0 };
    }

    await loadDayCancellationsSilent();
    await syncRequestStatusIfAllCancelled(requestId);

    return { success: true, cancelledCount: dates.length };
  } catch (err) {
    console.error('主管逐日取消異常:', err);
    return { success: false, error: err instanceof Error ? err.message : '取消失敗，請稍後再試', cancelledCount: 0 };
  }
}

export function useLeaveStore() {
  const [, setTick] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cb = () => {
      setTick((t) => t + 1);
      if (loadError) {
        setError(loadError);
      } else {
        setError(null);
      }
    };
    listeners.add(cb);

    // 初始載入
    if (requests.length === 0 && !isLoading) {
      setLoading(true);
      loadLeaveRequests()
        .then(() => {
          if (loadError) setError(loadError);
        })
        .catch((err) => {
          console.error('useLeaveStore 初始載入異常:', err);
          setError(err instanceof Error ? err.message : '載入資料失敗');
        })
        .finally(() => setLoading(false));
    } else if (dayApprovals.length === 0) {
      // 如果 requests 已有但 dayApprovals 還沒載入，補載
      loadDayApprovals().catch((err) => {
        console.error('useLeaveStore 補載審核紀錄異常:', err);
      });
    }

    // 補載逐日取消紀錄（獨立於 requests / approvals）
    if (dayCancellations.length === 0) {
      loadDayCancellations().catch((err) => {
        console.error('useLeaveStore 補載取消紀錄異常:', err);
      });
    }

    return () => {
      listeners.delete(cb);
    };
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    loadLeaveRequests().finally(() => setLoading(false));
  }, []);

  return {
    requests: getLeaveRequests(),
    loading,
    error,
    addRequest: addLeaveRequest,
    updateStatus: updateLeaveStatus,
    refresh,
  };
}