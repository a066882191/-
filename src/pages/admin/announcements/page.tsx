import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { defaultAnnouncements, type Announcement, convertGoogleDriveUrl } from '@/mocks/announcements';

function formatToday(): string {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}


export default function AdminAnnouncementsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [items, setItems] = useState<Announcement[]>(defaultAnnouncements);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [toast, setToast] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // 載入公告
  useEffect(() => {
    let mounted = true;
    async function fetchItems() {
      try {
        const { data, error } = await supabase
          .from('announcements')
          .select('*')
          .order('created_at', { ascending: false });
        if (!mounted) return;
        if (error) {
          console.error('公告載入失敗', error);
          showToast('公告載入失敗：' + error.message);
        } else if (data && data.length > 0) {
          setItems(
            data.map((row) => ({
              id: String(row.id),
              title: String(row.title),
              date: String(row.date),
              imageUrl: String(row.image_url || row.imageUrl || ''),
              manager: String(row.manager),
            })),
          );
        }
      } catch (err) {
        if (!mounted) return;
        console.error('公告載入異常', err);
        showToast('公告載入異常，請檢查網路');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchItems();
    return () => { mounted = false; };
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function validateForm(): boolean {
    if (!title.trim()) {
      setFormError('請填寫公告標題');
      return false;
    }
    setFormError('');
    return true;
  }

  async function insertWithRetry(payload: Record<string, unknown>, retries = 2): Promise<{ error: Error | null }> {
    let lastError: Error | null = null;
    for (let i = 0; i <= retries; i++) {
      try {
        const { error } = await supabase.from('announcements').insert(payload);
        if (!error) return { error: null };
        lastError = error;
        const isTimeout = error.message?.toLowerCase().includes('timeout') || error.message?.toLowerCase().includes('bad gateway');
        if (!isTimeout || i === retries) return { error };
        await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const isTimeout = lastError.message?.toLowerCase().includes('timeout') || lastError.message?.toLowerCase().includes('bad gateway');
        if (!isTimeout || i === retries) return { error: lastError };
        await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
      }
    }
    return { error: lastError };
  }

  async function handleAdd() {
    if (!validateForm()) return;
    setIsSubmitting(true);

    const newItem: Announcement = {
      id: `ANN-${Date.now()}`,
      title: title.trim(),
      date: formatToday(),
      imageUrl: imageUrl.trim(),
      manager: user?.name || '管理者',
    };

    try {
      const { error } = await insertWithRetry({
        id: newItem.id,
        title: newItem.title,
        date: newItem.date,
        image_url: newItem.imageUrl,
        manager: newItem.manager,
      });

      if (error) {
        console.error('Supabase insert error:', error);
        setFormError('新增失敗：' + error.message);
        showToast('新增失敗：' + error.message);
        return;
      }
      setItems((prev) => [newItem, ...prev]);
      setTitle('');
      setImageUrl('');
      setEditingId(null);
      setFormError('');
      showToast('公告已新增');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '新增異常';
      console.error('新增公告異常', err);
      setFormError('新增失敗：' + msg);
      showToast('新增失敗：' + msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdate() {
    if (!editingId || !validateForm()) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('announcements')
        .update({
          title: title.trim(),
          image_url: imageUrl.trim(),
          date: formatToday(),
        })
        .eq('id', editingId);

      if (error) {
        console.error('Supabase update error:', error);
        setFormError('更新失敗：' + error.message);
        showToast('更新失敗：' + error.message);
        return;
      }

      setItems((prev) =>
        prev.map((it) =>
          it.id === editingId
            ? { ...it, title: title.trim(), imageUrl: imageUrl.trim(), date: formatToday() }
            : it,
        ),
      );
      setTitle('');
      setImageUrl('');
      setEditingId(null);
      setFormError('');
      showToast('公告已更新');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '更新異常';
      console.error('更新公告異常', err);
      setFormError('更新失敗：' + msg);
      showToast('更新失敗：' + msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) {
        showToast('刪除失敗：' + error.message);
        console.error('Supabase delete error:', error);
        return;
      }
      setItems((prev) => prev.filter((it) => it.id !== id));
      setDeleteConfirmId(null);
      showToast('公告已刪除');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '刪除異常';
      showToast('刪除失敗：' + msg);
      console.error('刪除公告異常', err);
    }
  }

  async function handleDeleteAll() {
    if (!window.confirm('確定要刪除所有公告嗎？此操作無法復原。')) return;
    const ids = items.map((it) => it.id);
    if (ids.length === 0) return;
    try {
      const { error } = await supabase.from('announcements').delete().in('id', ids);
      if (error) {
        showToast('清空失敗：' + error.message);
        console.error('Supabase delete all error:', error);
        return;
      }
      setItems([]);
      showToast('已清空所有公告');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '清空異常';
      showToast('清空失敗：' + msg);
      console.error('清空公告異常', err);
    }
  }

  function startEdit(item: Announcement) {
    setEditingId(item.id);
    setTitle(item.title);
    setImageUrl(item.imageUrl);
    setFormError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setTitle('');
    setImageUrl('');
    setFormError('');
  }

  function isGoogleDriveUrl(url: string): boolean {
    return url.includes('drive.google.com') && !url.includes('googleusercontent.com');
  }

  function resolveImageUrl(url: string): string {
    const trimmed = url.trim();
    if (!trimmed) return '';
    if (isGoogleDriveUrl(trimmed)) {
      return convertGoogleDriveUrl(trimmed);
    }
    return trimmed;
  }

  function handleImageUrlChange(value: string) {
    setImageUrl(value);
    if (formError) setFormError('');
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
          <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
            <i className="ri-image-line text-amber-600 text-sm" />
          </div>
          <h1 className="text-lg font-bold text-stone-800">公告管理</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">
        {/* Add / Edit Form */}
        <div className="bg-white rounded-xl border border-stone-100 p-4 space-y-4">
          <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
            <i className="ri-add-circle-line text-emerald-600" />
            {editingId ? '編輯公告' : '新增公告'}
          </h2>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              公告標題 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); if (formError) setFormError(''); }}
              placeholder="例如：六月份班表異動公告"
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Image URL / Upload */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">公告圖片（選填）</label>
          <input
            type="text"
            value={imageUrl}
            onChange={(e) => handleImageUrlChange(e.target.value)}
            placeholder="貼上圖片網址或 Google Drive 連結"
            className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
          <p className="text-[10px] text-stone-400 mt-1">
            Google Drive 連結請設為「知道連結的任何人可檢視」
            </p>

            {/* 圖片預覽區塊 */}
            {imageUrl && (
              <div className="rounded-lg overflow-hidden border border-stone-100 mt-2 relative bg-stone-50">
                <div id="gdrive-preview-loader" className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <i className="ri-loader-4-line animate-spin text-lg text-stone-400" />
                    <span className="text-[10px] text-stone-400">載入圖片中...</span>
                  </div>
                </div>
                <img
                  src={resolveImageUrl(imageUrl)}
                  alt="預覽"
                  className="w-full h-48 object-contain relative z-10"
                  onError={(e) => {
                    const loader = document.getElementById('gdrive-preview-loader');
                    if (loader) loader.style.display = 'none';
                    (e.target as HTMLImageElement).style.display = 'none';
                    setFormError('圖片載入失敗，請檢查網址是否正確或 Google Drive 權限是否設為「知道連結的任何人可檢視」');
                  }}
                  onLoad={() => {
                    const loader = document.getElementById('gdrive-preview-loader');
                    if (loader) loader.style.display = 'none';
                    setFormError('');
                  }}
                />
              </div>
            )}
          </div>

          {/* Form Error */}
          {formError && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-2.5 flex items-start gap-2">
              <i className="ri-error-warning-line text-red-500 mt-0.5 text-sm" />
              <span className="text-xs text-red-600 font-medium">{formError}</span>
            </div>
          )}



          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {editingId ? (
              <>
                <button
                  onClick={handleUpdate}
                  disabled={isSubmitting}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-sm font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-save-line" />}
                  {isSubmitting ? '儲存中...' : '儲存變更'}
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 transition-colors disabled:opacity-50"
                >
                  取消
                </button>
              </>
            ) : (
              <button
                onClick={handleAdd}
                disabled={isSubmitting || !title.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-sm font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-add-line" />}
                {isSubmitting ? '發送中...' : '新增公告'}
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
              <i className="ri-stack-line text-stone-400" />
              現有公告
              <span className="text-xs text-stone-400 font-normal">({items.length})</span>
            </h2>
            {items.length > 0 && (
              <button
                onClick={handleDeleteAll}
                className="text-[11px] text-red-500 hover:text-red-600 font-medium"
              >
                全部刪除
              </button>
            )}
          </div>

          {loading ? (
            <div className="bg-white rounded-xl p-6 text-center border border-stone-100">
              <i className="ri-loader-4-line animate-spin text-2xl text-stone-300 mb-2" />
              <p className="text-sm text-stone-400">載入中...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="bg-white rounded-xl p-6 text-center border border-stone-100">
              <i className="ri-image-add-line text-3xl text-stone-300 mb-2" />
              <p className="text-sm text-stone-400">尚無公告</p>
              <p className="text-xs text-stone-300 mt-1">在上方新增第一則公告</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="bg-white rounded-xl border border-stone-100 overflow-hidden">
                  {item.imageUrl ? (
                    <div className="w-full h-36 md:h-56 overflow-hidden">
                      <img
                        src={convertGoogleDriveUrl(item.imageUrl)}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                  ) : null}
                  <div className="p-3">
                    <p className="text-sm font-medium text-stone-800">{item.title}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-stone-400">{item.date} · {item.manager}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEdit(item)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        >
                          <i className="ri-pencil-line text-sm" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(item.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <i className="ri-delete-bin-line text-sm" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Delete Confirm */}
                  {deleteConfirmId === item.id && (
                    <div className="px-3 pb-3">
                      <div className="bg-red-50 border border-red-100 rounded-lg p-2.5 flex items-center justify-between">
                        <span className="text-xs text-red-600 font-medium">確定刪除此公告？</span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2.5 py-1 rounded-md text-xs text-stone-600 bg-white border border-stone-200 hover:bg-stone-50"
                          >
                            取消
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="px-2.5 py-1 rounded-md text-xs text-white bg-red-500 hover:bg-red-600"
                          >
                            刪除
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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