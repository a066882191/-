import { useState, useEffect } from 'react';
import { loadEmployees, getAllEmployees, calculateAnnualLeave, updateEmployeeAnnualLeave, type Employee } from '@/mocks/employees';

export interface User {
  id: string;
  employee_code: string;
  name: string;
  role: 'employee' | 'manager';
  department: string;
  annual_leave_days: number;
  sick_leave_days: number;
  hire_date?: string;
  phone_home?: string;
  phone_mobile?: string;
  email?: string;
  group?: string | null;
}

let currentUser: User | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function initFromStorage() {
  if (typeof window === 'undefined') return;
  const saved = localStorage.getItem('leave_user');
  if (saved) {
    try {
      currentUser = JSON.parse(saved) as User;
      // 注意：此時快取可能只有 mock 資料，真正的驗證在 loadEmployees 後由 refreshCurrentUser 處理
      if (currentUser && !currentUser.group) {
        const all = getAllEmployees();
        const emp = all.find((e) => e.id === currentUser!.id);
        const fallbackGroup = emp?.group || 'A';
        currentUser = { ...currentUser, group: fallbackGroup };
        localStorage.setItem('leave_user', JSON.stringify(currentUser));
      }
      if (currentUser) {
        const all = getAllEmployees();
        const emp = all.find((e) => e.id === currentUser!.id);
        if (emp && emp.name !== currentUser.name) {
          currentUser = { ...currentUser, name: emp.name };
          localStorage.setItem('leave_user', JSON.stringify(currentUser));
        }
      }
    } catch {
      currentUser = null;
    }
  }
}

initFromStorage();

export async function login(code: string, password: string): Promise<boolean> {
  await loadEmployees();
  const allEmployees = getAllEmployees();
  const emp = allEmployees.find((e) => e.employee_code === code);
  const resetPwd = getResetPassword(code);
  const matchedPassword = resetPwd ?? emp?.password ?? '1234';
  if (emp && password === matchedPassword) {
    currentUser = {
      id: emp.id,
      employee_code: emp.employee_code,
      name: emp.name,
      role: emp.role as 'employee' | 'manager',
      department: '',
      annual_leave_days: emp.annual_leave_days,
      sick_leave_days: emp.sick_leave_days,
      hire_date: emp.hire_date,
      phone_home: emp.phone_home,
      phone_mobile: emp.phone_mobile,
      email: emp.email,
      group: emp.group || 'A',
    };
    localStorage.setItem('leave_user', JSON.stringify(currentUser));
    emit();
    return true;
  }
  return false;
}

export function logout(): void {
  currentUser = null;
  localStorage.removeItem('leave_user');
  emit();
}

export function getUser(): User | null {
  return currentUser;
}

/** 載入員工後，同步 currentUser 的 id 與資料（解決 localStorage 舊 id 與資料庫不同步的問題） */
export function refreshCurrentUser(): void {
  try {
    if (!currentUser) return;
    const all = getAllEmployees();

    // 先用 id 找，找不到再用 employee_code 找
    let emp = all.find((e) => e.id === currentUser!.id);
    if (!emp && currentUser!.employee_code) {
      emp = all.find((e) => e.employee_code === currentUser!.employee_code);
    }

    if (emp) {
      // 更新 id（防止舊 localStorage 存的是過期 id）
      if (emp.id !== currentUser!.id) {
        currentUser = { ...currentUser, id: emp.id };
      }
      // 同步其他可能變更的欄位
      currentUser = {
        ...currentUser,
        name: emp.name,
        role: emp.role as 'employee' | 'manager',
        annual_leave_days: emp.annual_leave_days,
        sick_leave_days: emp.sick_leave_days,
        group: emp.group || 'A',
        hire_date: emp.hire_date,
        phone_home: emp.phone_home,
        phone_mobile: emp.phone_mobile,
        email: emp.email,
      };
      localStorage.setItem('leave_user', JSON.stringify(currentUser));
      emit();
    } else {
      // 如果連 employee_code 也找不到，表示該帳號已被刪除，強制登出
      console.warn('refreshCurrentUser: 找不到對應員工，強制登出');
      logout();
    }
  } catch (err) {
    console.error('refreshCurrentUser 異常:', err);
  }
}

export async function updateUserAnnualLeave(days: number): Promise<boolean> {
  if (!currentUser) return false;
  currentUser = { ...currentUser, annual_leave_days: days };
  localStorage.setItem('leave_user', JSON.stringify(currentUser));
  await updateEmployeeAnnualLeave(currentUser.id, days);
  emit();
  return true;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(currentUser);

  useEffect(() => {
    const cb = () => setUser(currentUser);
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);

  return { user, login, logout, updateUserAnnualLeave, refreshCurrentUser };
}

function getResetPassword(code: string): string | undefined {
  const all = getAllEmployees();
  const emp = all.find((e) => e.employee_code === code);
  return emp?.password;
}