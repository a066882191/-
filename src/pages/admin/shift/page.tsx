import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { convertGoogleDriveUrl } from '@/mocks/announcements';

function formatYearMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function isGoogleDriveUrl(url: string): boolean {
  return url.includes('drive.google.com') && !url.includes('googleusercontent.com');
}

function resolveUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (isGoogleDriveUrl(trimmed)) return convertGoogleDriveUrl(trimmed);
  return trimmed;
}

export default function AdminShiftPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [aGroupUrl, setAGroupUrl] = useState('');
  const [bGroupUrl, setBGroupUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [formError, setFormError] = useState('');

  const monthLabel = `${year} 年 ${month} 月`;

  // 載入當月班表連結
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setFormError('');
      try {
        const { data, error } = await supabase
          .from('shift_monthly_images')
          .select('a_group_url, b_group_url')
          .eq('year', year)
          .eq('month', month)
          .maybeSingle();

        if (!mounted) return;
        if (error) {
          console.error('班表載入失敗', error);
          setFormError('班表載入失敗：' + error.message);
          setAGroupUrl('');
          setBGroupUrl('');
          return;
        }

        if (data) {
          setAGroupUrl(String(data.a_group_url || ''));
          setBGroupUrl(String(data.b_group_url || ''));
        } else {
          setAGroupUrl('');
          setBGroupUrl('');
        }
      } catch (err) {
        if (!mounted) return;
        console.error('班表載入異常', err);
        setFormError('班表載入異常');
        setAGroupUrl('');
        setBGroupUrl('');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [year, month]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function goPrevMonth() {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  }

  function goNextMonth() {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  }

  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
  }

  async function handleSave() {
    setSaving(true);
    setFormError('');
    try {
      const { error } = await supabase
        .from('shift_monthly_images')
        .upsert(
          {
            year,
            month,
            a_group_url: aGroupUrl.trim(),
            b_group_url: bGroupUrl.trim(),
          },
          { onConflict: 'year,month' },
        );

      if (error) {
        console.error('班表儲存失敗', error);
        setFormError('儲存失敗：' + error.message);
        showToast('儲存失敗：' + error.message);
        return;
      }

      showToast('班表連結已儲存');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '儲存異常';
      console.error('班表儲存異常', err);
      setFormError('儲存失敗：' + msg);
      showToast('儲存失敗：' + msg);
    } finally {
      setSaving(false);
    }
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
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center">
            <i className="ri-table-line text-teal-600 text-sm" />
          </div>
          <h1 className="text-lg font-bold text-stone-800">班表管理</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">
        {/* Month Navigator */}
        <div className="bg-white rounded-xl border border-stone-100 px-4 py-3 flex items-center justify-between">
          <button
            onClick={goPrevMonth}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-stone-50 transition-colors"
          >
            <i className="ri-arrow-left-s-line text-lg text-stone-600" />
          </button>
          <div className="text-center">
            <p className="text-base font-bold text-stone-800">{monthLabel}</p>
          </div>
          <button
            onClick={goNextMonth}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-stone-50 transition-colors"
          >
            <i className="ri-arrow-right-s-line text-lg text-stone-600" />
          </button>
        </div>

        <button
          onClick={goToday}
          className="w-full text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 py-2 rounded-lg transition-colors"
        >
          回到本月
        </button>

        {/* A 組 */}
        <div className="bg-white rounded-xl border border-stone-100 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center">
              <span className="text-xs font-bold text-white">A</span>
            </div>
            <h2 className="text-sm font-semibold text-stone-700">A 組班表連結</h2>
          </div>
          <input
            type="text"
            value={aGroupUrl}
            onChange={(e) => { setAGroupUrl(e.target.value); setFormError(''); }}
            placeholder="貼上 Google Drive 連結或圖片網址"
            disabled={loading}
            className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 disabled:opacity-50"
          />
          {aGroupUrl && (
            <div className="rounded-lg overflow-hidden border border-stone-100 relative bg-stone-50">
              <div className="absolute inset-0 flex items-center justify-center z-0">
                <i className="ri-loader-4-line animate-spin text-stone-300" />
              </div>
              <img
                src={resolveUrl(aGroupUrl)}
                alt="A 組班表預覽"
                className="w-full h-48 object-contain relative z-10"
                onLoad={(e) => {
                  (e.target as HTMLImageElement).previousElementSibling?.classList.add('hidden');
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  const loader = (e.target as HTMLImageElement).previousElementSibling;
                  if (loader) {
                    loader.innerHTML = '<span class="text-xs text-stone-400">圖片載入失敗</span>';
                    loader.classList.remove('hidden');
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* B 組 */}
        <div className="bg-white rounded-xl border border-stone-100 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center">
              <span className="text-xs font-bold text-white">B</span>
            </div>
            <h2 className="text-sm font-semibold text-stone-700">B 組班表連結</h2>
          </div>
          <input
            type="text"
            value={bGroupUrl}
            onChange={(e) => { setBGroupUrl(e.target.value); setFormError(''); }}
            placeholder="貼上 Google Drive 連結或圖片網址"
            disabled={loading}
            className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 disabled:opacity-50"
          />
          {bGroupUrl && (
            <div className="rounded-lg overflow-hidden border border-stone-100 relative bg-stone-50">
              <div className="absolute inset-0 flex items-center justify-center z-0">
                <i className="ri-loader-4-line animate-spin text-stone-300" />
              </div>
              <img
                src={resolveUrl(bGroupUrl)}
                alt="B 組班表預覽"
                className="w-full h-48 object-contain relative z-10"
                onLoad={(e) => {
                  (e.target as HTMLImageElement).previousElementSibling?.classList.add('hidden');
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  const loader = (e.target as HTMLImageElement).previousElementSibling;
                  if (loader) {
                    loader.innerHTML = '<span class="text-xs text-stone-400">圖片載入失敗</span>';
                    loader.classList.remove('hidden');
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* Error */}
        {formError && (
          <div className="bg-red-50 border border-red-100 rounded-lg p-2.5 flex items-start gap-2">
            <i className="ri-error-warning-line text-red-500 mt-0.5 text-sm" />
            <span className="text-xs text-red-600 font-medium">{formError}</span>
          </div>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 text-white text-sm font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
        >
          {saving ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-save-line" />}
          {saving ? '儲存中...' : '儲存班表連結'}
        </button>

        {/* Existing Records */}
        <ExistingRecords />
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-stone-800 text-white text-xs px-5 py-3 rounded-full shadow-lg z-50 flex items-center gap-2">
          <i className="ri-check-line" />
          {toast}
        </div>
      )}
    </div>
  );
}

function ExistingRecords() {
  const [records, setRecords] = useState<Array<{ year: number; month: number; a_group_url: string; b_group_url: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('shift_monthly_images')
        .select('year, month, a_group_url, b_group_url')
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (error) {
        console.error('讀取班表記錄失敗', error);
      } else if (data) {
        setRecords(data);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleDelete(year: number, month: number) {
    if (!window.confirm(`確定要刪除 ${year} 年 ${month} 月的班表連結嗎？`)) return;
    const { error } = await supabase
      .from('shift_monthly_images')
      .delete()
      .eq('year', year)
      .eq('month', month);

    if (error) {
      alert('刪除失敗：' + error.message);
      return;
    }

    setRecords((prev) => prev.filter((r) => !(r.year === year && r.month === month)));
  }

  if (loading) {
    return (
      <div className="text-center py-4">
        <i className="ri-loader-4-line animate-spin text-stone-300" />
      </div>
    );
  }

  if (records.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-stone-700 mb-2 flex items-center gap-2">
        <i className="ri-history-line text-stone-400" />
        已設定班表
      </h3>
      <div className="space-y-2">
        {records.map((r) => {
          const hasA = !!r.a_group_url?.trim();
          const hasB = !!r.b_group_url?.trim();
          return (
            <div key={`${r.year}-${r.month}`} className="bg-white rounded-xl border border-stone-100 p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-stone-800">
                  {r.year} 年 {r.month} 月
                </p>
                <div className="flex gap-2 mt-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${hasA ? 'bg-teal-50 text-teal-600' : 'bg-stone-50 text-stone-400'}`}>
                    A{hasA ? '' : ' 未設定'}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${hasB ? 'bg-teal-50 text-teal-600' : 'bg-stone-50 text-stone-400'}`}>
                    B{hasB ? '' : ' 未設定'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleDelete(r.year, r.month)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <i className="ri-delete-bin-line text-sm" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}