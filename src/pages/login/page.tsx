import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, getUser } from '@/hooks/useAuth';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // 已登入則自動跳轉；載入上次記住的帳號
  useEffect(() => {
    if (getUser()) {
      navigate('/dashboard', { replace: true });
      return;
    }
    if (typeof window !== 'undefined') {
      const lastCode = localStorage.getItem('last_login_code');
      if (lastCode) setCode(lastCode);
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const success = await login(code, password);
    if (success) {
      if (rememberMe && typeof window !== 'undefined') {
        localStorage.setItem('last_login_code', code);
      } else {
        localStorage.removeItem('last_login_code');
      }
      navigate('/dashboard');
    } else {
      setError(t('login_error'));
    }
    setLoading(false);
  };

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
            <i className="ri-train-line text-white text-3xl" />
          </div>
          <h1 className="text-2xl font-bold text-white drop-shadow-lg">{t('app_name')}</h1>
          <p className="text-white/80 mt-1 text-sm drop-shadow">Employee Leave Management</p>
        </div>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                {t('employee_code')}
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="EMP-A001 或 EMP-B001"
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-stone-800 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                {t('password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••"
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-stone-800 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                required
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="rememberMe" className="text-sm text-stone-600 cursor-pointer select-none">
                  {t('remember_me')}
                </label>
              </div>
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
              >
                忘記密碼？
              </button>
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
                  {t('login_button')}
                </span>
              ) : (
                t('login_button')
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
            >
              還沒有帳號？<span className="text-emerald-600 font-medium">註冊新帳號</span>
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-white/60 mt-6 drop-shadow">
          2026 嘉義機務段司機員請假系統
        </p>
      </div>
    </div>
  );
}