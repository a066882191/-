import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resetEmployeePassword } from '@/mocks/employees';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!code) {
      navigate('/forgot-password');
    }
  }, [code, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password || password.length < 4) {
      setError('密碼至少需 4 位字元');
      return;
    }
    if (password !== confirmPassword) {
      setError('兩次輸入的密碼不一致');
      return;
    }

    setLoading(true);
    try {
      const result = await resetEmployeePassword(code, password);
      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('重設失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://readdy.ai/api/search-image?query=A%20sleek%20modern%20Taiwan%20railway%20EMU-3000%20express%20train%20in%20elegant%20black%20and%20white%20color%20scheme%2C%20captured%20from%20a%20dynamic%20side%20angle%2C%20running%20through%20scenic%20coastal%20countryside%20during%20golden%20hour%20with%20warm%20atmospheric%20lighting%2C%20minimalist%20industrial%20design%2C%20professional%20railway%20photography%20style%2C%20clean%20cinematic%20composition%2C%20blurred%20natural%20landscape%20background%2C%20dramatic%20sky%20with%20soft%20clouds%2C%20high%20quality%20transportation%20photography&width=1600&height=900&seq=99&orientation=landscape"
            alt="EMU-3000 Background"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/40 to-black/60" />
        </div>

        <div className="w-full max-w-sm relative z-10">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6 text-center">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-check-line text-emerald-600 text-2xl" />
            </div>
            <h2 className="text-lg font-bold text-stone-800 mb-1">密碼重設成功</h2>
            <p className="text-sm text-stone-500 mb-6">
              您的密碼已更新，請使用新密碼登入系統。
            </p>
            <button
              onClick={() => navigate('/')}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-xl transition-colors whitespace-nowrap"
            >
              前往登入
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://readdy.ai/api/search-image?query=A%20sleek%20modern%20Taiwan%20railway%20EMU-3000%20express%20train%20in%20elegant%20black%20and%20white%20color%20scheme%2C%20captured%20from%20a%20dynamic%20side%20angle%2C%20running%20through%20scenic%20coastal%20countryside%20during%20golden%20hour%20with%20warm%20atmospheric%20lighting%2C%20minimalist%20industrial%20design%2C%20professional%20railway%20photography%20style%2C%20clean%20cinematic%20composition%2C%20blurred%20natural%20landscape%20background%2C%20dramatic%20sky%20with%20soft%20clouds%2C%20high%20quality%20transportation%20photography&width=1600&height=900&seq=99&orientation=landscape"
          alt="EMU-3000 Background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/40 to-black/60" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <i className="ri-key-2-line text-white text-3xl" />
          </div>
          <h1 className="text-2xl font-bold text-white drop-shadow-lg">重設密碼</h1>
          <p className="text-white/80 mt-1 text-sm drop-shadow">為帳號 {code} 設定新密碼</p>
        </div>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                新密碼 <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 4 位字元"
                minLength={4}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-stone-800 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                確認新密碼 <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次輸入新密碼"
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-stone-800 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                required
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
                  更新中...
                </span>
              ) : (
                '確認重設密碼'
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
            >
              <i className="ri-arrow-left-line mr-1" />
              返回驗證頁
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}