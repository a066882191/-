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

let requests: LeaveRequest[] = [];
const listeners = new Set<() => void>();
let isLoading = false;

function emit() {
  listeners.forEach((l) => l());
}

function mapRow(row: Record<string, unknown>): LeaveRequest {
  return {
    id: String(row.id),
    employee_id: String(row.employee_id),
    employee_name: String(row.employee_name),
    leave_type: String(row.leave_type),
    leave_type_name: String(row.leave_type_name),
    start_date: String(row.start_date),
    end_date: String(row.end_date),
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

    requests = (data || []).map(mapRow);
    emit();
  } catch (err) {
    console.error('載入請假紀錄異常:', err);
  } finally {
    isLoading = false;
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

  const typeName = data.leave_type_name || leaveTypes.find((t) => t.id === data.leave_type)?.name || data.leave_type;

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
}

export async function cancelLeaveRequest(
  employeeId: string,
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  const idx = requests.findIndex((r) => r.id === requestId && r.employee_id === employeeId);
  if (idx < 0) {
    return { success: false, error: '找不到該請假申請' };
  }

  if (requests[idx].status !== 'pending') {
    return { success: false, error: '僅「待審核」的申請可以取消' };
  }

  // 檢查是否在 24 小時取消窗口內
  const createdTime = new Date(requests[idx].created_at).getTime();
  const now = Date.now();
  const hoursDiff = (now - createdTime) / (1000 * 60 * 60);
  if (hoursDiff > 24) {
    return { success: false, error: '申請已超過 24 小時，無法取消' };
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
}

export function useLeaveStore() {
  const [, setTick] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cb = () => setTick((t) => t + 1);
    listeners.add(cb);

    // 初始載入
    if (requests.length === 0 && !isLoading) {
      setLoading(true);
      loadLeaveRequests().finally(() => setLoading(false));
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
    addRequest: addLeaveRequest,
    updateStatus: updateLeaveStatus,
    refresh,
  };
}