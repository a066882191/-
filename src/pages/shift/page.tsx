import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getShiftImages, resolveShiftImageUrl } from '@/stores/shiftImageStore';
import ImageLightbox from './components/ImageLightbox';

export default function ShiftPage() {
  const navigate = useNavigate();
  const [group, setGroup] = useState<'A' | 'B'>('A');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [shiftImages, setShiftImages] = useState<{ aGroupUrl: string; bGroupUrl: string }>({
    aGroupUrl: '',
    bGroupUrl: '',
  });
  const [loading, setLoading] = useState(false);

  const monthLabel = `${year} 年 ${month} 月`;

  // 從 Supabase 載入班表
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const data = await getShiftImages(year, month);
        if (!mounted) return;
        setShiftImages(data);
      } catch (err) {
        console.error('班表載入失敗', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [year, month]);

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

  const currentImageUrl = group === 'A'
    ? resolveShiftImageUrl(shiftImages.aGroupUrl)
    : resolveShiftImageUrl(shiftImages.bGroupUrl);

  // 放大預覽用高解析度版本
  const currentImageUrlHighRes = group === 'A'
    ? resolveShiftImageUrl(shiftImages.aGroupUrl, true)
    : resolveShiftImageUrl(shiftImages.bGroupUrl, true);

  return (
    <div className="min-h-screen bg-stone-50 pb-28">
      {/* Header */}
      <div className="bg-white px-4 py-4 border-b border-stone-100 flex items-center gap-3">
        <button
          onClick={() => navigate('/dashboard')}
          className="w-8 h-8 flex items-center justify-center text-stone-500 hover:text-stone-700"
        >
          <i className="ri-arrow-left-line text-xl" />
        </button>
        <h1 className="text-lg font-bold text-stone-800">當月班表</h1>
      </div>

      <div className="max-w-lg mx-auto px-3 md:px-4 py-4 space-y-4">
        {/* Group Toggle */}
        <div className="bg-white rounded-xl border border-stone-100 p-1.5 flex gap-1">
          <button
            onClick={() => setGroup('A')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${
              group === 'A'
                ? 'bg-teal-500 text-white shadow-sm'
                : 'text-stone-500 hover:bg-stone-50'
            }`}
          >
            A 組
          </button>
          <button
            onClick={() => setGroup('B')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${
              group === 'B'
                ? 'bg-teal-500 text-white shadow-sm'
                : 'text-stone-500 hover:bg-stone-50'
            }`}
          >
            B 組
          </button>
        </div>

        {/* Month navigator */}
        <div className="bg-white rounded-xl border border-stone-100 px-4 py-3 flex items-center justify-between">
          <button
            onClick={goPrevMonth}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-stone-50 transition-colors"
          >
            <div className="w-5 h-5 flex items-center justify-center">
              <i className="ri-arrow-left-s-line text-lg text-stone-600" />
            </div>
          </button>
          <div className="text-center">
            <p className="text-base font-bold text-stone-800">{monthLabel}</p>
          </div>
          <button
            onClick={goNextMonth}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-stone-50 transition-colors"
          >
            <div className="w-5 h-5 flex items-center justify-center">
              <i className="ri-arrow-right-s-line text-lg text-stone-600" />
            </div>
          </button>
        </div>

        {/* Original Schedule Image */}
        <div className="bg-white rounded-xl border border-stone-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-stone-100 flex items-center justify-center">
                <i className="ri-image-line text-xs text-stone-500" />
              </div>
              <h2 className="text-sm font-bold text-stone-700">{group} 組原始班表</h2>
            </div>
            <button
              onClick={goToday}
              className="text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
            >
              回到本月
            </button>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="text-center py-16">
                <i className="ri-loader-4-line animate-spin text-2xl text-stone-300 mb-2" />
                <p className="text-sm text-stone-400">載入中...</p>
              </div>
            ) : currentImageUrl ? (
              <div
                className="rounded-lg overflow-hidden border border-stone-100 cursor-pointer group relative"
                onClick={() => setLightboxOpen(true)}
              >
                <img
                  src={currentImageUrl}
                  alt={`${group} 組原始班表圖片`}
                  className="w-full h-auto object-contain"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-sm">
                    <i className="ri-zoom-in-line text-xs text-stone-600" />
                    <span className="text-xs font-medium text-stone-600">點擊放大</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 bg-stone-50 rounded-lg border border-dashed border-stone-200">
                <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <i className="ri-image-add-line text-xl text-stone-400" />
                </div>
                <p className="text-sm text-stone-500 mb-1">尚未設定 {group} 組班表圖片</p>
                <p className="text-xs text-stone-400">請至管理後台設定 Google Drive 班表連結</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && currentImageUrl && (
        <ImageLightbox
          src={currentImageUrlHighRes}
          alt={`${group} 組原始班表放大預覽`}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}