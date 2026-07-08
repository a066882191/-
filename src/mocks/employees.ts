import { supabase } from '@/lib/supabase';

export interface Employee {
  id: string;
  employee_code: string;
  name: string;
  role: 'employee' | 'manager';
  title: string;
  group: string | null;
  annual_leave_days: number;
  sick_leave_days: number;
  hire_date?: string;
  phone_home?: string;
  phone_mobile?: string;
  email?: string;
  gender?: 'male' | 'female' | 'other';
  password?: string;
}

/** 根據入職日計算特休天數（台灣勞基法） */
export function calculateAnnualLeave(hireDateStr: string): number {
  const hireDate = new Date(hireDateStr);
  const now = new Date();
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  const years = (now.getTime() - hireDate.getTime()) / msPerYear;

  if (years < 0.5) return 0;
  if (years < 1) return 3;
  if (years < 2) return 7;
  if (years < 3) return 10;
  if (years < 5) return 14;
  if (years < 10) return 15;

  const extraYears = Math.floor(years) - 9;
  return Math.min(15 + extraYears, 30);
}

// ===== 預設員工資料（僅保留管理者） =====
const mockEmployees: Employee[] = [
  { id: 'M1', employee_code: 'Chiayi0609', name: '嘉義機務段主管', role: 'manager', title: '運務主任', group: null, annual_leave_days: 15, sick_leave_days: 30, password: '06090609', email: 'manager@chiayi-railway.example.com' },
];

// 向後兼容：導出 mock 陣列
export const employees = mockEmployees;

// ===== Supabase 快取機制 =====
let _cachedEmployees: Employee[] = [...mockEmployees];
let _loading = false;
let _loaded = false;

function mapRow(row: Record<string, unknown>): Employee {
  return {
    id: String(row.id),
    employee_code: String(row.employee_code),
    name: String(row.name),
    role: String(row.role) as 'employee' | 'manager',
    title: String(row.title),
    group: row.group ? String(row.group) : null,
    annual_leave_days: Number(row.annual_leave_days ?? 10),
    sick_leave_days: Number(row.sick_leave_days ?? 30),
    hire_date: row.hire_date ? String(row.hire_date) : undefined,
    phone_home: row.phone_home ? String(row.phone_home) : undefined,
    phone_mobile: row.phone_mobile ? String(row.phone_mobile) : undefined,
    email: row.email ? String(row.email) : undefined,
    gender: row.gender ? String(row.gender) as 'male' | 'female' | 'other' : undefined,
    password: row.password ? String(row.password) : undefined,
  };
}

/** 從 Supabase 載入所有員工到快取 */
export async function loadEmployees(): Promise<void> {
  if (_loading) return;
  _loading = true;
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('status', 'active')
      .order('employee_code');

    if (error) {
      console.error('載入員工資料失敗:', error);
      return;
    }

    if (data && data.length > 0) {
      _cachedEmployees = data.map(mapRow);
      _loaded = true;
    }
  } catch (err) {
    console.error('載入員工資料異常:', err);
  } finally {
    _loading = false;
  }
}

/** 取得所有員工（返回快取，同步） */
export function getAllEmployees(): Employee[] {
  return [..._cachedEmployees];
}

/** 註冊新員工（寫入 Supabase） */
export async function registerEmployee(
  data: Omit<Employee, 'id' | 'annual_leave_days'> & { password: string }
): Promise<{ success: boolean; message: string }> {
  await loadEmployees();

  const all = getAllEmployees();
  if (all.find((e) => e.employee_code === data.employee_code)) {
    return { success: false, message: '此員工代號已被使用' };
  }

  if (data.email) {
    const existingEmail = all.find(
      (e) => e.email && e.email.trim().toLowerCase() === data.email!.trim().toLowerCase()
    );
    if (existingEmail) {
      return { success: false, message: '此 Email 已被註冊' };
    }
  }

  const annualLeave = data.hire_date ? calculateAnnualLeave(data.hire_date) : 10;
  const newId = crypto.randomUUID ? crypto.randomUUID() : `emp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const { error } = await supabase
    .from('employees')
    .insert({
      id: newId,
      employee_code: data.employee_code,
      name: data.name,
      role: data.role || 'employee',
      title: data.title || '司機員',
      group: data.group,
      password: data.password,
      gender: data.gender,
      phone_home: data.phone_home,
      phone_mobile: data.phone_mobile,
      email: data.email,
      hire_date: data.hire_date,
      annual_leave_days: annualLeave,
      sick_leave_days: 30,
      status: 'active',
    });

  if (error) {
    console.error('註冊員工失敗:', error);
    return { success: false, message: error.message };
  }

  // 刷新快取
  await loadEmployees();
  return { success: true, message: '註冊成功' };
}

/** 更新員工特休天數 */
export async function updateEmployeeAnnualLeave(employeeId: string, days: number): Promise<boolean> {
  const { error } = await supabase
    .from('employees')
    .update({ annual_leave_days: days, updated_at: new Date().toISOString() })
    .eq('id', employeeId);

  if (error) {
    console.error('更新特休天數失敗:', error);
    return false;
  }

  const idx = _cachedEmployees.findIndex((e) => e.id === employeeId);
  if (idx >= 0) {
    _cachedEmployees[idx] = { ..._cachedEmployees[idx], annual_leave_days: days };
  }
  return true;
}

/** 驗證員工代號與 Email */
export async function verifyEmployeeEmail(
  code: string,
  email: string
): Promise<{ success: boolean; message: string; maskedEmail?: string }> {
  if (!_loaded) await loadEmployees();

  const all = getAllEmployees();
  const emp = all.find((e) => e.employee_code === code);
  if (!emp) {
    return { success: false, message: '找不到此員工代號' };
  }
  if (!emp.email) {
    return { success: false, message: '該帳號尚未綁定 Email，請聯繫管理員' };
  }
  if (emp.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
    return { success: false, message: '員工代號與 Email 不符' };
  }
  const masked = emp.email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
  return { success: true, message: '驗證成功', maskedEmail: masked };
}

/** 重設員工密碼 */
export async function resetEmployeePassword(
  code: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  if (!newPassword || newPassword.length < 4) {
    return { success: false, message: '密碼至少需 4 位字元' };
  }

  if (!_loaded) await loadEmployees();

  const all = getAllEmployees();
  const emp = all.find((e) => e.employee_code === code);
  if (!emp) {
    return { success: false, message: '找不到此員工代號' };
  }

  const { error } = await supabase
    .from('employees')
    .update({ password: newPassword, updated_at: new Date().toISOString() })
    .eq('employee_code', code);

  if (error) {
    console.error('重設密碼失敗:', error);
    return { success: false, message: error.message };
  }

  const idx = _cachedEmployees.findIndex((e) => e.employee_code === code);
  if (idx >= 0) {
    _cachedEmployees[idx] = { ..._cachedEmployees[idx], password: newPassword };
  }

  return { success: true, message: '密碼重設成功' };
}

/** 取得員工重設後的密碼（從快取） */
export function getResetPassword(code: string): string | undefined {
  const emp = _cachedEmployees.find((e) => e.employee_code === code);
  return emp?.password;
}