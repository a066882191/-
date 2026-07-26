import { useState, useEffect } from 'react';
import { getShiftImages, updateShiftImages } from '@/stores/shiftImageStore';

interface ShiftImagesTabProps {
  year: number;
  month: number;
  onNavigate: (year: number, month: number) => void;
}

export default function ShiftImagesTab({ year: imgYear, month: imgMonth, onNavigate }: ShiftImagesTabProps) {
  const today = new Date();
  const [aGroupUrlInput, setAGroupUrlInput] = useState('');
  const [bGroupUrlInput, setBGroupUrlInput] = useState('');
  const [imageSaveMsg, setImageSaveMsg] = useState('');
  const [isShiftImageSaving, setIsShiftImageSaving] = useState(false);

  const monthLabel = `${imgYear} 年 ${imgMonth} 月`;

  useEffect(() => {
    getShiftImages(imgYear, imgMonth).then((imgs) => {
      setAGroupUrlInput(imgs.aGroupUrl);
      setBGroupUrlInput(imgs.bGroupUrl);
    });
  }, [imgYear, imgMonth]);

  function goImgPrevMonth() {
    if (imgMonth === 1) {
      onNavigate(imgYear - 1, 12);
    } else {
      onNavigate(imgYear, imgMonth - 1);
    }
  }

  function goImgNextMonth() {
    if (imgMonth === 12) {
      onNavigate(imgYear + 1, 1);
    } else {
      onNavigate(imgYear, imgMonth + 1);
    }
  }

  function goImgToday() {
    onNavigate(today.getFullYear(), today.getMonth() + 1);
  }

  const handleSaveShiftImages = async () => {
    setIsShiftImageSaving(true);
    setImageSaveMsg('');
    try {
      const updated = await updateShiftImages(imgYear, imgMonth, {
        aGroupUrl: (aGroupUrlInput ?? '').trim(),
        bGroupUrl: (bGroupUrlInput ?? '').trim(),
      });
      setAGroupUrlInput(updated.aGroupUrl);
      setBGroupUrlInput(updated.bGroupUrl);
      setImageSaveMsg('儲存成功！');
      setTimeout(() => setImageSaveMsg(''), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '儲存異常';
      setImageSaveMsg('儲存失敗：' + msg);
      console.error('儲存班表圖片失敗', err);
    } finally {
      setIsShiftImageSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Month navigator for shift images */}
      <div className="bg-white rounded-xl border border-stone-100 px-4 py-3 flex items-center justify-between">
        <button
          onClick={goImgPrevMonth}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-stone-50 transition-colors"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-arrow-left-s-line text-lg text-stone-600" />
          </div>
        </button>
        <div className="text-center">
          <p className="text-base font-bold text-stone-800">{monthLabel}</p>
          <p className="text-[10px] text-stone-400 mt-0.5">切換月份來管理上傳不同月份的圖片</p>
        </div>
        <button
          onClick={goImgNextMonth}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-stone-50 transition-colors"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-arrow-right-s-line text-lg text-stone-600" />
          </div>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-stone-100 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center">
              <i className="ri-image-line text-teal-600 text-sm" />
            </div>
            <h2 className="text-sm font-bold text-stone-800">班表圖片管理</h2>
          </div>
          <button
            onClick={goImgToday}
            className="text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
          >
            回到本月
          </button>
        </div>
        <p className="text-xs text-stone-400">
          請貼上 Google Drive 圖片連結，系統會自動顯示預覽並儲存。
        </p>

        {/* A Group Image */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-stone-600">A 組班表圖片</label>
          <input
            type="text"
            value={aGroupUrlInput}
            onChange={(e) => setAGroupUrlInput(e.target.value)}
            placeholder="貼上 Google Drive 圖片連結"
            className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          />
          {aGroupUrlInput && (
            <div className="rounded-lg overflow-hidden border border-stone-100 mt-2">
              <img
                src={aGroupUrlInput}
                alt="A 組班表預覽"
                className="w-full h-40 object-contain bg-stone-50"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
        </div>

        {/* B Group Image */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-stone-600">B 組班表圖片</label>
          <input
            type="text"
            value={bGroupUrlInput}
            onChange={(e) => setBGroupUrlInput(e.target.value)}
            placeholder="貼上 Google Drive 圖片連結"
            className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          />
          {bGroupUrlInput && (
            <div className="rounded-lg overflow-hidden border border-stone-100 mt-2">
              <img
                src={bGroupUrlInput}
                alt="B 組班表預覽"
                className="w-full h-40 object-contain bg-stone-50"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
        </div>

        <button
          onClick={handleSaveShiftImages}
          disabled={isShiftImageSaving}
          className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 disabled:bg-teal-400"
        >
          {isShiftImageSaving ? (
            <>
              <i className="ri-loader-4-line animate-spin" />
              儲存中...
            </>
          ) : (
            <>
              <i className="ri-save-line" />
              儲存 {monthLabel} 圖片設定
            </>
          )}
        </button>

        {imageSaveMsg && (
          <p className="text-xs text-emerald-600 text-center font-medium">{imageSaveMsg}</p>
        )}
      </div>
    </div>
  );
}