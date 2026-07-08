import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerEmployee } from '@/mocks/employees';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    employee_code: '',
    name: '',
    password: '',
    confirmPassword: '',
    gender: 'male' as 'male' | 'female' | 'other',
    phone_home: '',
    phone_mobile: '',
    email: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function updateField<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError('');
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.employee_code.trim()) {
      setError('請輸入員工代號');
      return;
    }
    if (!form.name.trim()) {
      setError('請輸入姓名');
      return;
    }
    if (!form.password || form.password.length < 4) {
      setError('密碼至少需 4 位字元');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('兩次輸入的密碼不一致');
      return;
    }

    setLoading(true);
    try {
      const result = await registerEmployee({
        employee_code: form.employee_code.trim(),
        name: form.name.trim(),
        role: 'employee',
        group: null,
        password: form.password,
        gender: form.gender,
        phone_home: form.phone_home.trim() || undefined,
        phone_mobile: form.phone_mobile.trim() || undefined,
        email: form.email.trim() || undefined,
      });

      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('註冊失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-check-line text-emerald-600 text-3xl" />
          </div>
          <h1 className="text-xl font-bold text-stone-800 mb-2">註冊成功</h1>
          <p className="text-sm text-stone-500 mb-6">
            您的帳號已建立，請使用員工代號與密碼登入系統。
          </p>
          <div className="bg-white rounded-xl border border-stone-100 p-4 mb-6 text-left space-y-2">
            <p className="text-sm text-stone-700">
              <span className="text-stone-400">員工代號：</span>
              <span className="font-medium">{form.employee_code}</span>
            </p>
            <p className="text-sm text-stone-700">
              <span className="text-stone-400">姓名：</span>
              <span className="font-medium">{form.name}</span>
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-xl transition-colors whitespace-nowrap"
          >
            前往登入
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i className="ri-user-add-line text-white text-3xl" />
          </div>
          <h1 className="text-2xl font-bold text-stone-800">註冊新帳號</h1>
          <p className="text-stone-500 mt-1 text-sm">請填寫資料建立員工帳號</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 員工代號 */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                員工代號 <span className="text-red-500">*</span>
                <span className="text-xs text-stone-400 font-normal ml-1">（即為登入帳號）</span>
              </label>
              <input
                type="text"
                value={form.employee_code}
                onChange={(e) => updateField('employee_code', e.target.value)}
                placeholder="EMP-A001"
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-stone-800 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                required
              />
            </div>

            {/* 姓名 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  姓名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="請輸入真實姓名"
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 text-stone-800 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  性別 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  {[
                    { value: 'male', label: '男' },
                    { value: 'female', label: '女' },
                    { value: 'other', label: '其他' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateField('gender', opt.value as typeof form.gender)}
                      className={`flex-1 px-3 py-3 rounded-xl border text-sm font-medium transition-colors ${
                        form.gender === opt.value
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                          : 'border-stone-200 text-stone-600 hover:border-stone-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 密碼 */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                密碼 <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => updateField('password', e.target.value)}
                placeholder="至少 4 位字元"
                minLength={4}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-stone-800 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                required
              />
            </div>

            {/* 確認密碼 */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                確認密碼 <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => updateField('confirmPassword', e.target.value)}
                placeholder="再次輸入密碼"
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-stone-800 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                required
              />
            </div>

            {/* 家用電話 */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                家用電話
                <span className="text-xs text-stone-400 font-normal ml-1">（選填）</span>
              </label>
              <input
                type="tel"
                value={form.phone_home}
                onChange={(e) => updateField('phone_home', e.target.value)}
                placeholder="02-12345678"
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-stone-800 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* 手機 */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                手機
                <span className="text-xs text-stone-400 font-normal ml-1">（選填）</span>
              </label>
              <input
                type="tel"
                value={form.phone_mobile}
                onChange={(e) => updateField('phone_mobile', e.target.value)}
                placeholder="0912-345-678"
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-stone-800 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Email
                <span className="text-xs text-stone-400 font-normal ml-1">（選填，忘記密碼時需要使用）</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="name@example.com"
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-stone-800 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
                <i className="ri-error-warning-line" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium py-3 rounded-xl transition-colors whitespace-nowrap"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="ri-loader-4-line animate-spin" />
                  註冊中...
                </span>
              ) : (
                '建立帳號'
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => navigate('/')}
              className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
            >
              已有帳號？<span className="text-emerald-600 font-medium">返回登入</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}