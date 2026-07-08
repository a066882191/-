import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyEmployeeEmail } from '@/mocks/employees';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await verifyEmployeeEmail(code.trim(), email.trim());
      if (result.success) {
        setMaskedEmail(result.maskedEmail || '');
        setSent(true);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('驗證失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
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
            <i className="ri-lock-unlock-line text-white text-3xl" />
          </div>
          <h1 className="text-2xl font-bold text-white drop-shadow-lg">忘記密碼</h1>
          <p className="text-white/80 mt-1 text-sm drop-shadow">驗證身份後重設密碼</p>
        </div>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  員工代號
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="EMP-A001"
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 text-stone-800 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  註冊時填寫的 Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
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
                    驗證中...
                  </span>
                ) : (
                  '發送重設驗證'
                )}
              </button>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <i className="ri-mail-send-line text-emerald-600 text-2xl" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-stone-800 mb-1">驗證成功</h2>
                <p className="text-sm text-stone-500">
                  系統已發送重設密碼連結至
                  <br />
                  <span className="font-medium text-stone-700">{maskedEmail}</span>
                </p>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-left">
                <p className="text-xs text-amber-700 flex items-start gap-1.5">
                  <i className="ri-information-line mt-0.5 shrink-0" />
                  此為 Demo 環境，無法實際發送郵件。請點擊下方按鈕直接前往重設密碼。
                </p>
              </div>
              <button
                onClick={() => navigate(`/reset-password?code=${encodeURIComponent(code.trim())}`)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-xl transition-colors whitespace-nowrap"
              >
                前往重設密碼
              </button>
            </div>
          )}

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
            >
              <i className="ri-arrow-left-line mr-1" />
              返回登入
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