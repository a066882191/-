import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { convertGoogleDriveUrl } from '@/mocks/announcements';
import { shiftCodeMap, setShiftTimeOverrides, setShiftCodeDetails, type ShiftTimeOverride, type ShiftCodeDetail } from '@/mocks/shiftSchedule';

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

  // Section refs for scroll navigation
  const sectionLinksRef = useRef<HTMLDivElement>(null);
  const sectionExistingRef = useRef<HTMLDivElement>(null);
  const sectionConfigRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState('links');

  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>, name: string) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSection(name);
  };

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

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {/* Section Quick Nav */}
        <div className="bg-white rounded-xl border border-stone-100 p-1.5 flex gap-1 overflow-x-auto">
          <button
            onClick={() => scrollToSection(sectionLinksRef, 'links')}
            className={`flex-1 min-w-0 py-2 px-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center justify-center gap-1 ${
              activeSection === 'links'
                ? 'bg-teal-500 text-white shadow-sm'
                : 'text-stone-500 hover:bg-stone-50'
            }`}
          >
            <i className="ri-link text-[11px]" />
            班表連結
          </button>
          <button
            onClick={() => scrollToSection(sectionConfigRef, 'config')}
            className={`flex-1 min-w-0 py-2 px-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center justify-center gap-1 ${
              activeSection === 'config'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-stone-500 hover:bg-stone-50'
            }`}
          >
            <i className="ri-settings-3-line text-[11px]" />
            班次 &amp; 管制設定
          </button>
        </div>

        {/* Month Navigator */}
        <div ref={sectionLinksRef} className="bg-white rounded-xl border border-stone-100 px-4 py-3 flex items-center justify-between">
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
        <div ref={sectionExistingRef}>
          <ExistingRecords />
        </div>

        {/* 班次 & 管制設定 */}
        <div ref={sectionConfigRef}>
          <ShiftConfigEditor />
        </div>
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

function ShiftConfigEditor() {
  const [overrides, setOverrides] = useState<Record<string, { start_time: string; end_time: string }>>({});
  const [details, setDetails] = useState<Record<string, { control_location: string; control_time: string; control_location_2: string; control_time_2: string; label?: string }>>({});
  const [customCodes, setCustomCodes] = useState<Record<string, { label: string; type: 'day' | 'night'; start_time: string; end_time: string }>>({});
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editLoc1, setEditLoc1] = useState('');
  const [editTime1, setEditTime1] = useState('');
  const [editLoc2, setEditLoc2] = useState('');
  const [editTime2, setEditTime2] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editEndNextDay, setEditEndNextDay] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);

  // 新增班次表單
  const [showNewForm, setShowNewForm] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<'day' | 'night'>('day');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newEndNextDay, setNewEndNextDay] = useState(false);
  const [newError, setNewError] = useState('');

  const shiftCodes = useMemo(() => {
    const builtIn = Object.entries(shiftCodeMap)
      .filter(([, info]) => info.type !== 'rest' && info.startTime !== '-')
      .map(([code, info]) => ({ code, info, isCustom: false }));

    const custom = Object.entries(customCodes).map(([code, info]) => ({
      code,
      info: {
        code,
        label: info.label,
        timeRange: `${info.start_time} – ${info.end_time}`,
        startTime: info.start_time,
        endTime: info.end_time,
        type: info.type,
        color: info.type === 'day' ? 'text-teal-700' : 'text-indigo-700',
        bgColor: info.type === 'day' ? 'bg-teal-50 border-teal-200' : 'bg-indigo-50 border-indigo-200',
        icon: info.type === 'day' ? 'ri-sun-line' : 'ri-moon-line',
      } as import('@/mocks/shiftSchedule').ShiftCodeInfo,
      isCustom: true,
    }));

    const all = [...builtIn, ...custom];
    all.sort((a, b) => {
      const numA = parseInt(a.code.replace(/[^0-9]/g, '')) || 0;
      const numB = parseInt(b.code.replace(/[^0-9]/g, '')) || 0;
      if (numA !== numB) return numA - numB;
      return a.code.localeCompare(b.code);
    });
    return all;
  }, [customCodes]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [timeRes, detailRes, customRes] = await Promise.all([
        supabase.from('shift_time_overrides').select('shift_code, start_time, end_time'),
        supabase.from('shift_code_details').select('shift_code, control_location, control_time, control_location_2, control_time_2'),
        supabase.from('shift_custom_codes').select('code, label, type, start_time, end_time'),
      ]);

      if (!timeRes.error && timeRes.data) {
        const map: Record<string, { start_time: string; end_time: string }> = {};
        timeRes.data.forEach((row) => {
          map[row.shift_code] = { start_time: row.start_time, end_time: row.end_time };
        });
        setOverrides(map);
      }

      if (!detailRes.error && detailRes.data) {
        const map: Record<string, { control_location: string; control_time: string; control_location_2: string; control_time_2: string; label?: string }> = {};
        detailRes.data.forEach((row: Record<string, unknown>) => {
          map[row.shift_code as string] = {
            control_location: (row.control_location as string) || '',
            control_time: (row.control_time as string) || '',
            control_location_2: (row.control_location_2 as string) || '',
            control_time_2: (row.control_time_2 as string) || '',
            label: (row.label as string) || undefined,
          };
        });
        setDetails(map);
      }

      if (!customRes.error && customRes.data) {
        const map: Record<string, { label: string; type: 'day' | 'night'; start_time: string; end_time: string }> = {};
        customRes.data.forEach((row) => {
          map[row.code] = { label: row.label, type: row.type as 'day' | 'night', start_time: row.start_time, end_time: row.end_time };
        });
        setCustomCodes(map);
      }

      setLoading(false);
    }
    load();
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  async function handleCreateNew() {
    setNewError('');
    const code = newCode.trim();
    const label = newLabel.trim();
    if (!code) { setNewError('請輸入班次代碼'); return; }
    if (!label) { setNewError('請輸入班次名稱'); return; }
    if (!newStart) { setNewError('請設定上班時間'); return; }
    if (!newEnd) { setNewError('請設定下班時間'); return; }

    // Check for duplicates
    if (shiftCodeMap[code] || customCodes[code]) {
      setNewError(`代碼「${code}」已存在`);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('shift_custom_codes').insert({
        code,
        label,
        type: newType,
        start_time: newStart,
        end_time: newEnd,
      });

      if (error) {
        setNewError('新增失敗：' + error.message);
        return;
      }

      setCustomCodes((prev) => ({
        ...prev,
        [code]: { label, type: newType, start_time: newStart, end_time: newEnd },
      }));

      // Reset form
      setNewCode('');
      setNewLabel('');
      setNewType('day');
      setNewStart('');
      setNewEnd('');
      setNewEndNextDay(false);
      setShowNewForm(false);
      showToast(`已新增班次「${code}」`);
    } catch (err) {
      setNewError('新增異常');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCustom(code: string) {
    if (!window.confirm(`確定要刪除自訂班次「${code}」嗎？相關的時間與管制設定也會一併清除。`)) return;
    setSaving(true);
    try {
      await Promise.all([
        supabase.from('shift_custom_codes').delete().eq('code', code),
        supabase.from('shift_time_overrides').delete().eq('shift_code', code),
        supabase.from('shift_code_details').delete().eq('shift_code', code),
      ]);

      const newCustom = { ...customCodes };
      delete newCustom[code];
      setCustomCodes(newCustom);

      const newOverrides = { ...overrides };
      delete newOverrides[code];
      setOverrides(newOverrides);

      const newDetails = { ...details };
      delete newDetails[code];
      setDetails(newDetails);

      if (editingCode === code) cancelEdit();
      showToast(`已刪除班次「${code}」`);
    } catch (err) {
      showToast('刪除異常');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(code: string) {
    const currentTime = overrides[code];
    const base = shiftCodeMap[code];
    const currentDetail = details[code] || { control_location: '', control_time: '', control_location_2: '', control_time_2: '' };
    const st = currentTime?.start_time || base?.startTime || '';
    const et = currentTime?.end_time || base?.endTime || '';
    setEditingCode(code);
    setEditStart(st);
    setEditEnd(et);
    setEditLoc1(currentDetail.control_location);
    setEditTime1(currentDetail.control_time);
    setEditLoc2(currentDetail.control_location_2);
    setEditTime2(currentDetail.control_time_2);
    setEditLabel(currentDetail?.label || base?.label || code);
    setEditEndNextDay(et && st && et < st);
  }

  function cancelEdit() {
    setEditingCode(null);
    setEditStart('');
    setEditEnd('');
    setEditLoc1('');
    setEditTime1('');
    setEditLoc2('');
    setEditTime2('');
    setEditLabel('');
    setEditEndNextDay(false);
  }

  async function handleSave(code: string) {
    setSaving(true);
    try {
      const promises: Promise<unknown>[] = [];

      // Save time override
      promises.push(
        supabase.from('shift_time_overrides').upsert({
          shift_code: code,
          start_time: editStart.trim(),
          end_time: editEnd.trim(),
        }),
      );

      // Save control details + label override
      promises.push(
        supabase.from('shift_code_details').upsert({
          shift_code: code,
          control_location: editLoc1.trim(),
          control_time: editTime1.trim(),
          control_location_2: editLoc2.trim(),
          control_time_2: editTime2.trim(),
          label: editLabel.trim() || undefined,
        }, { onConflict: 'shift_code' }),
      );

      // Save custom code label
      if (customCodes[code]) {
        promises.push(
          supabase.from('shift_custom_codes').update({ label: editLabel.trim() }).eq('code', code),
        );
      }

      await Promise.all(promises);

      const newOverrides = { ...overrides, [code]: { start_time: editStart.trim(), end_time: editEnd.trim() } };
      setOverrides(newOverrides);

      const newDetails = {
        ...details,
        [code]: {
          label: editLabel.trim() || undefined,
          control_location: editLoc1.trim(),
          control_time: editTime1.trim(),
          control_location_2: editLoc2.trim(),
          control_time_2: editTime2.trim(),
        },
      };
      setDetails(newDetails);

      // Update customCodes state if this is a custom shift
      if (customCodes[code]) {
        setCustomCodes((prev) => ({
          ...prev,
          [code]: { ...prev[code], label: editLabel.trim() },
        }));
        // Also update shiftCodeMap for immediate effect on other pages
        if (shiftCodeMap[code]) {
          shiftCodeMap[code] = { ...shiftCodeMap[code], label: editLabel.trim() };
        }
      }

      // 更新全域快取
      const allOverrides: ShiftTimeOverride[] = Object.entries(newOverrides).map(([shift_code, val]) => ({
        shift_code,
        start_time: val.start_time,
        end_time: val.end_time,
      }));
      setShiftTimeOverrides(allOverrides);

      const allDetails: ShiftCodeDetail[] = Object.entries(newDetails).map(([shift_code, val]) => ({
        shift_code,
        label: val.label,
        control_location: val.control_location,
        control_time: val.control_time,
        control_location_2: val.control_location_2,
        control_time_2: val.control_time_2,
      }));
      setShiftCodeDetails(allDetails);

      setEditingCode(null);
      showToast('已儲存，全站生效');
    } catch (err) {
      showToast('儲存異常');
    } finally {
      setSaving(false);
    }
  }

  async function handleResetTime(code: string) {
    if (!window.confirm('確定要恢復此班次的預設時間嗎？')) return;
    setSaving(true);
    try {
      await supabase.from('shift_time_overrides').delete().eq('shift_code', code);
      const newOverrides = { ...overrides };
      delete newOverrides[code];
      setOverrides(newOverrides);
      const allOverrides: ShiftTimeOverride[] = Object.entries(newOverrides).map(([shift_code, val]) => ({
        shift_code,
        start_time: val.start_time,
        end_time: val.end_time,
      }));
      setShiftTimeOverrides(allOverrides);
      showToast('已恢復預設時間');
    } catch (err) {
      showToast('重置異常');
    } finally {
      setSaving(false);
    }
  }

  async function handleResetControl(code: string) {
    if (!window.confirm('確定要清除此班次的管制地點與時間嗎？')) return;
    setSaving(true);
    try {
      // Preserve label by updating instead of deleting
      await supabase.from('shift_code_details').update({
        control_location: '',
        control_time: '',
        control_location_2: '',
        control_time_2: '',
      }).eq('shift_code', code);
      const newDetails = { ...details };
      if (newDetails[code]) {
        newDetails[code] = {
          ...newDetails[code],
          control_location: '',
          control_time: '',
          control_location_2: '',
          control_time_2: '',
        };
      }
      setDetails(newDetails);
      const allDetails: ShiftCodeDetail[] = Object.entries(newDetails).map(([shift_code, val]) => ({
        shift_code,
        label: val.label,
        control_location: val.control_location,
        control_time: val.control_time,
        control_location_2: val.control_location_2,
        control_time_2: val.control_time_2,
      }));
      setShiftCodeDetails(allDetails);
      showToast('已清除管制資訊');
    } catch (err) {
      showToast('清除異常');
    } finally {
      setSaving(false);
    }
  }

  const hasOverrides = Object.keys(overrides).length;
  const hasDetails = Object.keys(details).filter((k) => {
    const d = details[k];
    return d.control_location || d.control_time || d.control_location_2 || d.control_time_2;
  }).length;

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
          <i className="ri-settings-3-line text-stone-400" />
          班次 &amp; 管制設定
        </h3>
        <div className="flex items-center gap-1.5">
          {hasOverrides > 0 && (
            <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              {hasOverrides} 筆時間
            </span>
          )}
          {hasDetails > 0 && (
            <span className="text-[10px] text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
              {hasDetails} 筆管制
            </span>
          )}
          <button
            onClick={() => { setShowNewForm(!showNewForm); setNewError(''); setNewEndNextDay(false); }}
            className="text-[10px] font-medium text-teal-600 bg-teal-50 hover:bg-teal-100 px-2 py-0.5 rounded-full transition-colors whitespace-nowrap flex items-center gap-0.5"
          >
            <i className={`ri-${showNewForm ? 'subtract' : 'add'}-line text-[11px]`} />
            新增班次
          </button>
        </div>
      </div>

      {/* 新增班次表單 */}
      {showNewForm && (
        <div className="bg-teal-50/50 rounded-xl border border-teal-200 p-3 mb-3 space-y-2.5">
          <p className="text-[10px] font-medium text-teal-700 flex items-center gap-1">
            <i className="ri-add-circle-line text-[11px]" />
            新增自訂班次
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-stone-500 mb-0.5 block">班次代碼</label>
              <input
                type="text"
                value={newCode}
                onChange={(e) => { setNewCode(e.target.value); setNewError(''); }}
                placeholder="如：801"
                className="w-full px-2.5 py-2 rounded-lg border border-stone-200 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-stone-500 mb-0.5 block">班次名稱</label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => { setNewLabel(e.target.value); setNewError(''); }}
                placeholder="如：801班"
                className="w-full px-2.5 py-2 rounded-lg border border-stone-200 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-stone-500 mb-0.5 block">班別</label>
              <div className="flex rounded-lg border border-stone-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setNewType('day')}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${newType === 'day' ? 'bg-teal-500 text-white' : 'bg-white text-stone-500 hover:bg-stone-50'}`}
                >
                  白班
                </button>
                <button
                  type="button"
                  onClick={() => setNewType('night')}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${newType === 'night' ? 'bg-indigo-500 text-white' : 'bg-white text-stone-500 hover:bg-stone-50'}`}
                >
                  夜班
                </button>
              </div>
            </div>
            <div />
            <div>
              <label className="text-[10px] text-stone-500 mb-0.5 block">上班時間</label>
              <input
                type="time"
                value={newStart}
                onChange={(e) => { setNewStart(e.target.value); setNewError(''); }}
                className="w-full px-2.5 py-2 rounded-lg border border-stone-200 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-stone-500 mb-0.5 block">下班時間</label>
              <div className="flex items-center gap-1">
                <input
                  type="time"
                  value={newEnd}
                  onChange={(e) => { setNewEnd(e.target.value); setNewError(''); }}
                  className="flex-1 px-2.5 py-2 rounded-lg border border-stone-200 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
                <button
                  type="button"
                  onClick={() => setNewEndNextDay(!newEndNextDay)}
                  className={`text-[10px] font-medium px-2 py-2 rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${
                    newEndNextDay
                      ? 'bg-teal-500 text-white'
                      : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                  }`}
                >
                  隔日
                </button>
              </div>
            </div>
          </div>
          {newError && (
            <p className="text-[10px] text-red-500 font-medium">{newError}</p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCreateNew}
              disabled={saving}
              className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 text-white text-xs font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
            >
              {saving ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-check-line" />}
              建立班次
            </button>
            <button
              onClick={() => { setShowNewForm(false); setNewError(''); setNewEndNextDay(false); }}
              disabled={saving}
              className="px-3 py-2 rounded-lg border border-stone-200 text-stone-600 text-xs font-medium hover:bg-stone-50 transition-colors disabled:opacity-50"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl p-6 text-center border border-stone-100">
          <i className="ri-loader-4-line animate-spin text-xl text-stone-300" />
        </div>
      ) : (
        <div className="space-y-2">
          {shiftCodes.length === 0 && !loading && (
            <div className="bg-white rounded-xl p-6 text-center border border-stone-100">
              <p className="text-sm text-stone-400">尚無班次</p>
            </div>
          )}
          {shiftCodes.map(({ code, info, isCustom }) => {
            const override = overrides[code];
            const detail = details[code];
            const hasDetail = detail && (detail.control_location || detail.control_time || detail.control_location_2 || detail.control_time_2);
            const isEditing = editingCode === code;
            const displayStart = override?.start_time || info.startTime;
            const displayEnd = override?.end_time || info.endTime;
            const isOverridden = !!override;
            const isNextDay = displayEnd && displayStart && displayEnd < displayStart;

            return (
              <div
                key={code}
                className={`bg-white rounded-xl border transition-colors ${
                  isEditing ? 'border-amber-300 ring-2 ring-amber-100' :
                  (isOverridden || hasDetail) ? 'border-amber-100' : 'border-stone-100'
                }`}
              >
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        info.type === 'day' ? 'bg-teal-50' : 'bg-indigo-50'
                      }`}>
                        <span className={`text-[11px] font-bold ${
                          info.type === 'day' ? 'text-teal-600' : 'text-indigo-600'
                        }`}>
                          {code}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                          />
                        ) : (
                          <p className="text-sm font-medium text-stone-800 truncate">
                            {info.label}
                            {isCustom && (
                              <span className="text-[9px] text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full ml-1.5 font-normal">自訂</span>
                            )}
                          </p>
                        )}
                        {!isEditing && (
                          <div className="flex flex-col gap-0.5 mt-0.5">
                            {/* 時間列 */}
                            <p className={`text-xs ${isOverridden ? 'text-amber-600 font-medium' : 'text-stone-400'}`}>
                              {displayStart} – {displayEnd}
                              {isNextDay && <span className="text-[10px] text-amber-500 ml-1">(隔日)</span>}
                              {isOverridden && <span className="text-[10px] text-amber-500 ml-1">(已自訂)</span>}
                            </p>
                            {/* 管制資訊列 */}
                            {hasDetail && (
                              <div className="flex items-center gap-2 flex-wrap">
                                {detail.control_location && (
                                  <span className="text-[10px] text-rose-500 font-medium flex items-center gap-0.5">
                                    <i className="ri-map-pin-line text-[8px]" />
                                    {detail.control_location}
                                    {detail.control_time && <span className="text-amber-600 ml-0.5">{detail.control_time}</span>}
                                  </span>
                                )}
                                {detail.control_location_2 && (
                                  <span className="text-[10px] text-rose-500 font-medium flex items-center gap-0.5">
                                    <i className="ri-map-pin-line text-[8px]" />
                                    {detail.control_location_2}
                                    {detail.control_time_2 && <span className="text-amber-600 ml-0.5">{detail.control_time_2}</span>}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {!isEditing && (
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button
                          onClick={() => startEdit(code)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        >
                          <i className="ri-pencil-line text-sm" />
                        </button>
                        {isCustom && (
                          <button
                            onClick={() => handleDeleteCustom(code)}
                            disabled={saving}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <i className="ri-delete-bin-line text-sm" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {isEditing && (
                    <div className="mt-3 pt-3 border-t border-stone-100 space-y-3">
                      {/* 上下班時間 */}
                      <div>
                        <p className="text-[10px] font-medium text-stone-500 mb-1.5 flex items-center gap-1">
                          <i className="ri-timer-line text-[11px] text-amber-500" />
                          上下班時間
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <label className="text-[10px] text-stone-400 mb-1 block">上班</label>
                            <input
                              type="time"
                              value={editStart}
                              onChange={(e) => setEditStart(e.target.value)}
                              className="w-full px-2.5 py-2 rounded-lg border border-stone-200 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                            />
                          </div>
                          <span className="text-stone-300 mt-4">–</span>
                          <div className="flex-1">
                            <label className="text-[10px] text-stone-400 mb-1 block">下班</label>
                            <div className="flex items-center gap-1">
                              <input
                                type="time"
                                value={editEnd}
                                onChange={(e) => setEditEnd(e.target.value)}
                                className="flex-1 px-2.5 py-2 rounded-lg border border-stone-200 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                              />
                              <button
                                type="button"
                                onClick={() => setEditEndNextDay(!editEndNextDay)}
                                className={`text-[10px] font-medium px-2 py-2 rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${
                                  editEndNextDay
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                                }`}
                              >
                                隔日
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 管制第一組 */}
                      <div>
                        <p className="text-[10px] font-medium text-stone-500 mb-1.5 flex items-center gap-1">
                          <span className="w-4 h-4 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-[9px] font-bold">1</span>
                          管制地點一 / 管制時間一
                        </p>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editLoc1}
                            onChange={(e) => setEditLoc1(e.target.value)}
                            placeholder="地點（如：大門）"
                            className="flex-[2] px-2.5 py-2 rounded-lg border border-stone-200 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                          />
                          <input
                            type="text"
                            value={editTime1}
                            onChange={(e) => setEditTime1(e.target.value)}
                            placeholder="時間（如：08:55 – 16:55）"
                            className="flex-[3] px-2.5 py-2 rounded-lg border border-stone-200 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                          />
                        </div>
                      </div>

                      {/* 管制第二組 */}
                      <div>
                        <p className="text-[10px] font-medium text-stone-500 mb-1.5 flex items-center gap-1">
                          <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[9px] font-bold">2</span>
                          管制地點二 / 管制時間二
                        </p>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editLoc2}
                            onChange={(e) => setEditLoc2(e.target.value)}
                            placeholder="地點（如：側門）"
                            className="flex-[2] px-2.5 py-2 rounded-lg border border-stone-200 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                          />
                          <input
                            type="text"
                            value={editTime2}
                            onChange={(e) => setEditTime2(e.target.value)}
                            placeholder="時間（如：18:56 – 06:56）"
                            className="flex-[3] px-2.5 py-2 rounded-lg border border-stone-200 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleSave(code)}
                          disabled={saving}
                          className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white text-xs font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                        >
                          {saving ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-check-line" />}
                          儲存全部
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={saving}
                          className="px-3 py-2 rounded-lg border border-stone-200 text-stone-600 text-xs font-medium hover:bg-stone-50 transition-colors disabled:opacity-50"
                        >
                          取消
                        </button>
                        {isOverridden && (
                          <button
                            onClick={() => handleResetTime(code)}
                            disabled={saving}
                            className="px-2.5 py-2 rounded-lg border border-red-200 text-red-500 text-[10px] font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            重置時間
                          </button>
                        )}
                        {hasDetail && (
                          <button
                            onClick={() => handleResetControl(code)}
                            disabled={saving}
                            className="px-2 py-2 rounded-lg border border-red-200 text-red-500 text-[10px] font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            清除管制
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-stone-800 text-white text-xs px-5 py-3 rounded-full shadow-lg z-50 flex items-center gap-2">
          <i className="ri-check-line" />
          {toast}
        </div>
      )}
    </div>
  );
}