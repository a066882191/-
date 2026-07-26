import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

interface Employee {
  id: string;
  employee_code: string;
  name: string;
  role: string;
  title: string;
  group: string | null;
  annual_leave_days: number;
  sick_leave_days: number;
  hire_date?: string;
  phone_home?: string;
  phone_mobile?: string;
  email?: string;
  gender?: string;
  created_at?: string;
  status?: string;
}

export default function AdminEmployeesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');

  // 編輯彈窗狀態
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState<Partial<Employee>>();
  const [saving, setSaving] = useState(false);

  // 詳情彈窗狀態
  const [detailEmp, setDetailEmp] = useState<Employee | null>(null);

  // 刪除確認狀態
  const [deletingEmp, setDeletingEmp] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = employees.filter((e) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      e.name.toLowerCase().includes(q) ||
      e.employee_code.toLowerCase().includes(q) ||
      e.id.toLowerCase().includes(q) ||
      (e.email?.toLowerCase().includes(q) ?? false)
    );
  });

  const activeCount = employees.filter((e) => e.status === 'active').length;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        showToast('載入失敗：' + error.message);
        console.error('載入員工失敗:', error);
      } else if (data) {
        setEmployees(
          data.map((row: Record<string, unknown>) => ({
            id: String(row.id),
            employee_code: String(row.employee_code),
            name: String(row.name),
            role: String(row.role),
            title: String(row.title || '司機員'),
            group: row.group ? String(row.group) : null,
            annual_leave_days: Number(row.annual_leave_days ?? 10),
            sick_leave_days: Number(row.sick_leave_days ?? 30),
            hire_date: row.hire_date ? String(row.hire_date) : undefined,
            phone_home: row.phone_home ? String(row.phone_home) : undefined,
            phone_mobile: row.phone_mobile ? String(row.phone_mobile) : undefined,
            email: row.email ? String(row.email) : undefined,
            gender: row.gender ? String(row.gender) : undefined,
            created_at: row.created_at ? String(row.created_at) : undefined,
            status: row.status ? String(row.status) : 'active',
          })),
        );
      }
    } catch (err) {
      console.error('載入員工異常:', err);
      showToast('載入異常');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSaveEdit() {
    if (!editingEmp) return;
    setSaving(true);
    try {
      const updatePayload: Record<string, unknown> = {};
      if (editForm.name !== undefined) updatePayload.name = editForm.name;
      if (editForm.employee_code !== undefined) updatePayload.employee_code = editForm.employee_code;
      if (editForm.role !== undefined) updatePayload.role = editForm.role;
      if (editForm.title !== undefined) updatePayload.title = editForm.title;
      if (editForm.group !== undefined) updatePayload.group = editForm.group;
      if (editForm.annual_leave_days !== undefined) updatePayload.annual_leave_days = editForm.annual_leave_days;
      if (editForm.sick_leave_days !== undefined) updatePayload.sick_leave_days = editForm.sick_leave_days;
      if (editForm.hire_date !== undefined) updatePayload.hire_date = editForm.hire_date || null;
      if (editForm.phone_home !== undefined) updatePayload.phone_home = editForm.phone_home || null;
      if (editForm.phone_mobile !== undefined) updatePayload.phone_mobile = editForm.phone_mobile || null;
      if (editForm.email !== undefined) updatePayload.email = editForm.email || null;
      if (editForm.gender !== undefined) updatePayload.gender = editForm.gender;
      if (editForm.status !== undefined) updatePayload.status = editForm.status;

      const { error } = await supabase
        .from('employees')
        .update(updatePayload)
        .eq('id', editingEmp.id);

      if (error) {
        showToast('更新失敗：' + error.message);
        console.error('更新員工失敗:', error);
        setSaving(false);
        return;
      }

      setEmployees((prev) =>
        prev.map((e) => (e.id === editingEmp.id ? { ...e, ...editForm } as Employee : e)),
      );
      setEditingEmp(null);
      setEditForm({});
      showToast('更新成功');
    } catch (err) {
      console.error('更新員工異常:', err);
      showToast('更新異常');
    } finally {
      setSaving(false);
    }
  }

  function openEdit(emp: Employee) {
    setEditingEmp(emp);
    setEditForm({ ...emp });
  }

  function cancelEdit() {
    setEditingEmp(null);
    setEditForm({});
  }

  function openDetail(emp: Employee) {
    setDetailEmp(emp);
  }

  function cancelDetail() {
    setDetailEmp(null);
  }

  function openDeleteConfirm(emp: Employee) {
    setDeletingEmp(emp);
  }

  function cancelDelete() {
    setDeletingEmp(null);
  }

  async function handleDelete() {
    if (!deletingEmp) return;

    // 禁止刪除管理員帳號
    if (deletingEmp.role === 'manager') {
      showToast('無法刪除管理員帳號');
      setDeletingEmp(null);
      return;
    }

    setDeleting(true);
    try {
      // 先取得該員工所有請假申請的 ID
      const { data: leaveReqs } = await supabase
        .from('leave_requests')
        .select('id')
        .eq('employee_id', deletingEmp.id);

      const reqIds = (leaveReqs || []).map((r: Record<string, unknown>) => String(r.id));

      if (reqIds.length > 0) {
        // 清理請假子表（透過 request_id 關聯）
        await supabase.from('leave_day_approvals').delete().in('request_id', reqIds);
        await supabase.from('leave_day_cancellations').delete().in('request_id', reqIds);
      }

      // 清理其他關聯資料
      await supabase.from('leave_requests').delete().eq('employee_id', deletingEmp.id);
      await supabase.from('leave_cancel_counts').delete().eq('employee_id', deletingEmp.id);
      await supabase.from('shift_customizations').delete().eq('employee_id', deletingEmp.id);

      // 刪除員工本人
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', deletingEmp.id);

      if (error) {
        showToast('刪除失敗：' + error.message);
        console.error('刪除員工失敗:', error);
        setDeleting(false);
        return;
      }

      setEmployees((prev) => prev.filter((e) => e.id !== deletingEmp.id));
      setDeletingEmp(null);
      showToast('已刪除 ' + deletingEmp.name);
    } catch (err) {
      console.error('刪除員工異常:', err);
      showToast('刪除異常');
    } finally {
      setDeleting(false);
    }
  }

  function roleLabel(role: string) {
    return role === 'manager' ? '主管' : '司機員';
  }

  function roleBadgeClass(role: string) {
    return role === 'manager'
      ? 'bg-violet-100 text-violet-700'
      : 'bg-emerald-100 text-emerald-700';
  }

  function statusBadgeClass(status?: string) {
    return status === 'active' || !status
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-stone-100 text-stone-500';
  }

  function statusLabel(status?: string) {
    return status === 'active' || !status ? '啟用' : '停用';
  }

  if (user?.role !== 'manager') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center pb-24">
        <div className="text-center px-4">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <i className="ri-shield-cross-line text-3xl text-red-500" />
          </div>
          <p className="text-stone-600 font-medium">無權限訪問</p>
          <p className="text-sm text-stone-400 mt-1">此頁面僅供主管使用</p>
        </div>
      </div>
    );
  }

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
        <div className="flex-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
              <i className="ri-team-line text-amber-600 text-sm" />
            </div>
            <h1 className="text-lg font-bold text-stone-800">員工管理</h1>
            <span className="text-xs text-stone-400 font-normal">({activeCount} 人)</span>
          </div>
          <button
            onClick={() => navigate('/admin/approval')}
            className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            <i className="ri-shield-check-line" />
            審核管理
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* 搜尋框 */}
        <div className="bg-white rounded-xl border border-stone-100 px-3 py-2 flex items-center gap-2">
          <div className="w-6 h-6 flex items-center justify-center text-stone-400">
            <i className="ri-search-line text-sm" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋姓名、代號、Email..."
            className="flex-1 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none bg-transparent"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="w-6 h-6 flex items-center justify-center text-stone-400 hover:text-stone-600"
            >
              <i className="ri-close-line text-sm" />
            </button>
          )}
        </div>

        {/* 統計 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl p-3 border border-stone-100 text-center">
            <p className="text-xl font-bold text-stone-800">{employees.length}</p>
            <p className="text-[10px] text-stone-400 mt-0.5">總人數</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-stone-100 text-center">
            <p className="text-xl font-bold text-emerald-600">{activeCount}</p>
            <p className="text-[10px] text-stone-400 mt-0.5">啟用中</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-stone-100 text-center">
            <p className="text-xl font-bold text-violet-600">
              {employees.filter((e) => e.role === 'manager').length}
            </p>
            <p className="text-[10px] text-stone-400 mt-0.5">主管</p>
          </div>
        </div>

        {/* 列表 */}
        {loading ? (
          <div className="bg-white rounded-xl p-6 text-center border border-stone-100">
            <i className="ri-loader-4-line animate-spin text-2xl text-stone-300 mb-2" />
            <p className="text-sm text-stone-400">載入中...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-stone-100">
            <i className="ri-user-search-line text-4xl text-stone-300 mb-3" />
            <p className="text-sm text-stone-400">
              {search ? '沒有符合搜尋條件的員工' : '尚無員工資料'}
            </p>
            <p className="text-xs text-stone-300 mt-1">
              {search ? '請嘗試其他關鍵字' : '請先在註冊頁面新增員工'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((emp) => (
              <div
                key={emp.id}
                className="bg-white rounded-xl border border-stone-100 p-4 hover:border-stone-200 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-stone-600">
                        {emp.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-stone-800">{emp.name}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${roleBadgeClass(emp.role)}`}>
                          {roleLabel(emp.role)}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusBadgeClass(emp.status)}`}>
                          {statusLabel(emp.status)}
                        </span>
                      </div>
                      <p className="text-[10px] text-stone-400">
                        {emp.employee_code}
                        {emp.group && ` · ${emp.group} 組`}
                        {emp.title && ` · ${emp.title}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openDetail(emp)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                      title="詳情"
                    >
                      <i className="ri-eye-line text-sm" />
                    </button>
                    <button
                      onClick={() => openEdit(emp)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                      title="編輯"
                    >
                      <i className="ri-pencil-line text-sm" />
                    </button>
                    {emp.role !== 'manager' && (
                      <button
                        onClick={() => openDeleteConfirm(emp)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="刪除"
                      >
                        <i className="ri-delete-bin-line text-sm" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-stone-50">
                  <div className="flex items-center gap-1">
                    <i className="ri-sun-line text-[10px] text-amber-500" />
                    <span className="text-[10px] text-stone-500">特休 {emp.annual_leave_days} 天</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <i className="ri-hospital-line text-[10px] text-sky-500" />
                    <span className="text-[10px] text-stone-500">病假 {emp.sick_leave_days} 天</span>
                  </div>
                  {emp.email && (
                    <div className="flex items-center gap-1">
                      <i className="ri-mail-line text-[10px] text-stone-400" />
                      <span className="text-[10px] text-stone-500 truncate max-w-[100px]">
                        {emp.email}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== 編輯彈窗 ===== */}
      {editingEmp && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden animate-[slideUp_0.2s_ease-out] max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-stone-800">編輯員工</h2>
              <button
                onClick={cancelEdit}
                className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-600"
              >
                <i className="ri-close-line text-xl" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* 姓名 */}
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1.5">姓名</label>
                <input
                  type="text"
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* 代號 + 角色 並排 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1.5">員工代號</label>
                  <input
                    type="text"
                    value={editForm.employee_code || ''}
                    onChange={(e) => setEditForm({ ...editForm, employee_code: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1.5">角色</label>
                  <select
                    value={editForm.role || 'employee'}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                  >
                    <option value="employee">司機員</option>
                    <option value="manager">主管</option>
                  </select>
                </div>
              </div>

              {/* 職稱 + 組別 並排 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1.5">職稱</label>
                  <input
                    type="text"
                    value={editForm.title || ''}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1.5">組別</label>
                  <select
                    value={editForm.group || ''}
                    onChange={(e) => setEditForm({ ...editForm, group: e.target.value || null })}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                  >
                    <option value="">無</option>
                    <option value="A">A 組</option>
                    <option value="B">B 組</option>
                  </select>
                </div>
              </div>

              {/* 特休 + 病假 並排 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1.5">特休天數</label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={editForm.annual_leave_days ?? 0}
                    onChange={(e) => setEditForm({ ...editForm, annual_leave_days: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1.5">病假天數</label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={editForm.sick_leave_days ?? 0}
                    onChange={(e) => setEditForm({ ...editForm, sick_leave_days: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* 狀態 */}
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1.5">帳號狀態</label>
                <select
                  value={editForm.status || 'active'}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                >
                  <option value="active">啟用</option>
                  <option value="inactive">停用</option>
                </select>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1.5">Email</label>
                <input
                  type="email"
                  value={editForm.email || ''}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* 性別 + 入職日 並排 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1.5">性別</label>
                  <select
                    value={editForm.gender || ''}
                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value || undefined })}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                  >
                    <option value="">未設定</option>
                    <option value="male">男</option>
                    <option value="female">女</option>
                    <option value="other">其他</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1.5">入職日</label>
                  <input
                    type="date"
                    value={editForm.hire_date || ''}
                    onChange={(e) => setEditForm({ ...editForm, hire_date: e.target.value || undefined })}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-stone-100 flex gap-3">
              <button
                onClick={cancelEdit}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex-[2] bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-sm font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <i className="ri-loader-4-line animate-spin" />
                    儲存中...
                  </>
                ) : (
                  <>
                    <i className="ri-save-line" />
                    儲存變更
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 詳情彈窗 ===== */}
      {detailEmp && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden animate-[slideUp_0.2s_ease-out]">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-stone-800">員工詳情</h2>
              <button
                onClick={cancelDetail}
                className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-600"
              >
                <i className="ri-close-line text-xl" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-stone-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-bold text-stone-600">
                    {detailEmp.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold text-stone-800">{detailEmp.name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${roleBadgeClass(detailEmp.role)}`}>
                      {roleLabel(detailEmp.role)}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 mt-0.5">{detailEmp.employee_code}</p>
                </div>
              </div>

              <div className="bg-stone-50 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-stone-500">職稱</span>
                  <span className="text-sm font-medium text-stone-800">{detailEmp.title}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-stone-500">組別</span>
                  <span className="text-sm font-medium text-stone-800">{detailEmp.group || '未設定'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-stone-500">特休天數</span>
                  <span className="text-sm font-medium text-emerald-700">{detailEmp.annual_leave_days} 天</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-stone-500">病假天數</span>
                  <span className="text-sm font-medium text-sky-700">{detailEmp.sick_leave_days} 天</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-stone-500">狀態</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadgeClass(detailEmp.status)}`}>
                    {statusLabel(detailEmp.status)}
                  </span>
                </div>
              </div>

              {(detailEmp.email || detailEmp.phone_mobile || detailEmp.hire_date || detailEmp.gender) && (
                <div className="bg-stone-50 rounded-xl p-3 space-y-2.5">
                  {detailEmp.email && (
                    <div className="flex items-center gap-2">
                      <i className="ri-mail-line text-xs text-stone-400" />
                      <span className="text-sm text-stone-700">{detailEmp.email}</span>
                    </div>
                  )}
                  {detailEmp.phone_mobile && (
                    <div className="flex items-center gap-2">
                      <i className="ri-smartphone-line text-xs text-stone-400" />
                      <span className="text-sm text-stone-700">{detailEmp.phone_mobile}</span>
                    </div>
                  )}
                  {detailEmp.hire_date && (
                    <div className="flex items-center gap-2">
                      <i className="ri-calendar-line text-xs text-stone-400" />
                      <span className="text-sm text-stone-700">{detailEmp.hire_date}</span>
                    </div>
                  )}
                  {detailEmp.gender && (
                    <div className="flex items-center gap-2">
                      <i className="ri-user-line text-xs text-stone-400" />
                      <span className="text-sm text-stone-700">
                        {detailEmp.gender === 'male' ? '男' : detailEmp.gender === 'female' ? '女' : '其他'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {detailEmp.created_at && (
                <p className="text-[10px] text-stone-400 text-center">
                  註冊時間：{new Date(detailEmp.created_at).toLocaleString('zh-TW')}
                </p>
              )}
            </div>

            <div className="px-5 py-4 border-t border-stone-100 flex gap-3">
              <button
                onClick={() => {
                  cancelDetail();
                  openEdit(detailEmp);
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <i className="ri-pencil-line" />
                編輯
              </button>
              <button
                onClick={cancelDetail}
                className="flex-1 border border-stone-200 text-stone-600 text-sm font-medium py-2.5 rounded-xl hover:bg-stone-50 transition-colors"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 刪除確認彈窗 ===== */}
      {deletingEmp && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden animate-[slideUp_0.2s_ease-out]">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-stone-800">確認刪除</h2>
              <button
                onClick={cancelDelete}
                disabled={deleting}
                className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-600"
              >
                <i className="ri-close-line text-xl" />
              </button>
            </div>

            <div className="px-5 py-5 text-center space-y-3">
              <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                <i className="ri-error-warning-line text-3xl text-red-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-stone-800">
                  確定要刪除 <span className="text-red-600 font-bold">{deletingEmp.name}</span> 嗎？
                </p>
                <p className="text-xs text-stone-400 mt-1.5">
                  此操作將一併清除該員工的所有請假記錄、排班資料等相關數據，且無法復原。
                </p>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-stone-100 flex gap-3">
              <button
                onClick={cancelDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 transition-colors whitespace-nowrap"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-[2] bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {deleting ? (
                  <>
                    <i className="ri-loader-4-line animate-spin" />
                    刪除中...
                  </>
                ) : (
                  <>
                    <i className="ri-delete-bin-line" />
                    確認刪除
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-stone-800 text-white text-xs px-5 py-3 rounded-full shadow-lg z-50 flex items-center gap-2 animate-in fade-in duration-300">
          <i className="ri-check-line" />
          {toast}
        </div>
      )}
    </div>
  );
}