import { supabase } from '@/lib/supabase';
import { convertGoogleDriveUrl } from '@/mocks/announcements';

export interface ShiftGroupImages {
  aGroupUrl: string;
  bGroupUrl: string;
}

async function fetchFromDb(year: number, month: number): Promise<ShiftGroupImages | null> {
  try {
    const { data, error } = await supabase
      .from('shift_monthly_images')
      .select('a_group_url, b_group_url')
      .eq('year', year)
      .eq('month', month)
      .maybeSingle();

    if (error) {
      console.error('班表讀取失敗', error);
      return null;
    }

    if (!data) return null;

    return {
      aGroupUrl: String(data.a_group_url || ''),
      bGroupUrl: String(data.b_group_url || ''),
    };
  } catch (err) {
    console.error('班表讀取異常', err);
    return null;
  }
}

export async function getShiftImages(year: number, month: number): Promise<ShiftGroupImages> {
  const fromDb = await fetchFromDb(year, month);
  if (fromDb) return fromDb;

  // fallback: localStorage（向下兼容舊資料）
  try {
    const raw = localStorage.getItem('shift_group_images_v2');
    if (raw) {
      const all = JSON.parse(raw) as Record<string, ShiftGroupImages>;
      const key = `${year}-${String(month).padStart(2, '0')}`;
      if (all[key]) return all[key];
    }
  } catch {
    // ignore
  }

  return { aGroupUrl: '', bGroupUrl: '' };
}

export async function updateShiftImages(
  year: number,
  month: number,
  updates: Partial<ShiftGroupImages>,
): Promise<ShiftGroupImages> {
  const current = await fetchFromDb(year, month);

  const next: ShiftGroupImages = {
    aGroupUrl: updates.aGroupUrl !== undefined ? updates.aGroupUrl : (current?.aGroupUrl ?? ''),
    bGroupUrl: updates.bGroupUrl !== undefined ? updates.bGroupUrl : (current?.bGroupUrl ?? ''),
  };

  // 改成 update / insert 分開，加上 retry（跟公告一樣穩定）
  let lastError: Error | null = null;
  for (let i = 0; i < 3; i++) {
    try {
      if (current) {
        // 已存在 → update
        const { error } = await supabase
          .from('shift_monthly_images')
          .update({
            a_group_url: next.aGroupUrl,
            b_group_url: next.bGroupUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('year', year)
          .eq('month', month);

        if (!error) {
          lastError = null;
          break;
        }
        lastError = new Error(error.message);
      } else {
        // 不存在 → insert
        const { error } = await supabase
          .from('shift_monthly_images')
          .insert({
            year,
            month,
            a_group_url: next.aGroupUrl,
            b_group_url: next.bGroupUrl,
          });

        if (!error) {
          lastError = null;
          break;
        }
        lastError = new Error(error.message);
      }

      const isTimeout = lastError.message?.toLowerCase().includes('timeout') || lastError.message?.toLowerCase().includes('bad gateway');
      if (!isTimeout || i === 2) break;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isTimeout = lastError.message?.toLowerCase().includes('timeout') || lastError.message?.toLowerCase().includes('bad gateway');
      if (!isTimeout || i === 2) break;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }

  if (lastError) {
    console.error('班表儲存失敗', lastError);
    throw new Error('班表儲存失敗：' + lastError.message);
  }

  // 同步更新 localStorage（向下兼容）
  try {
    const raw = localStorage.getItem('shift_group_images_v2');
    const all: Record<string, ShiftGroupImages> = raw ? JSON.parse(raw) : {};
    const key = `${year}-${String(month).padStart(2, '0')}`;
    all[key] = next;
    localStorage.setItem('shift_group_images_v2', JSON.stringify(all));
  } catch {
    // ignore
  }

  return next;
}

/**
 * 取得解析後可直接顯示的圖片 URL（支援 Google Drive thumbnail）
 * @param highRes - true 時使用 w1920 大尺寸，適合放大檢視
 */
export function resolveShiftImageUrl(url: string, highRes = false): string {
  if (!url.trim()) return '';
  return convertGoogleDriveUrl(url, highRes ? 'w1920' : 'w1000');
}

export async function getAllShiftImageKeys(): Promise<string[]> {
  const { data, error } = await supabase
    .from('shift_monthly_images')
    .select('year, month');

  if (error || !data) return [];
  return data.map((r) => `${r.year}-${String(r.month).padStart(2, '0')}`);
}