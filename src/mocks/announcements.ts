import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface Announcement {
  id: string;
  title: string;
  date: string;
  imageUrl: string;
  rawUrl: string;
  manager: string;
}

/**
 * 把 Google Drive 分享連結轉成可直接顯示的圖片 URL
 * 支援格式：
 * - https://drive.google.com/file/d/FILE_ID/view
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/uc?id=FILE_ID
 * @param url - Google Drive 分享連結
 * @param size - 縮圖尺寸參數，預設 w1000；放大檢視建議 w1920 或 w2560
 */
export function convertGoogleDriveUrl(url: string, size = 'w1000'): string {
  if (!url) return url;

  // 已經是 Supabase Storage URL 或其他非 Drive URL，直接返回
  if (!url.includes('drive.google.com')) return url;

  // 已經是 Google 直接圖片網址（含 thumbnail），替換尺寸參數即可
  if (url.includes('googleusercontent.com')) return url;
  
  if (url.includes('thumbnail?id=')) {
    // 如果已有 thumbnail URL，替換 sz 參數
    return url.replace(/&sz=[^&]*/, `&sz=${size}`).replace(/[?&]sz=[^&]*/, `&sz=${size}`);
  }

  // /file/d/FILE_ID/view or /preview
  const fileMatch = url.match(/\/file\/d\/([^/?]+)/);
  if (fileMatch) {
    return `https://drive.google.com/thumbnail?id=${fileMatch[1]}&sz=${size}`;
  }

  // /open?id=FILE_ID or /uc?id=FILE_ID
  const openMatch = url.match(/[?&]id=([^&]+)/);
  if (openMatch) {
    return `https://drive.google.com/thumbnail?id=${openMatch[1]}&sz=${size}`;
  }

  return url;
}

/** 判斷是否為 Google Drive 連結 */
export function isGoogleDriveUrl(url: string): boolean {
  return url.includes('drive.google.com');
}

/** 從 Google Drive 連結取得預覽用 embed URL */
export function getGoogleDrivePreviewUrl(url: string): string {
  const fileMatch = url.match(/\/file\/d\/([^/?]+)/);
  if (fileMatch) {
    return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
  }
  const openMatch = url.match(/[?&]id=([^&]+)/);
  if (openMatch) {
    return `https://drive.google.com/file/d/${openMatch[1]}/preview`;
  }
  return url;
}

/** 預設公告（資料庫為空時顯示） */
export const defaultAnnouncements: Announcement[] = [
  {
    id: 'ANN-001',
    title: '六月份班表異動公告',
    date: '2026/05/20',
    imageUrl:
      'https://readdy.ai/api/search-image?query=A%20minimalist%20modern%20office%20bulletin%20board%20illustration%20with%20warm%20beige%20and%20soft%20green%20tones%2C%20featuring%20abstract%20geometric%20shapes%20representing%20team%20announcements%20and%20schedules%2C%20clean%20flat%20design%20style%2C%20warm%20lighting%2C%20professional%20workplace%20atmosphere%2C%20subtle%20texture%20background%2C%20no%20text&width=400&height=200&seq=1&orientation=landscape',
    rawUrl:
      'https://readdy.ai/api/search-image?query=A%20minimalist%20modern%20office%20bulletin%20board%20illustration%20with%20warm%20beige%20and%20soft%20green%20tones%2C%20featuring%20abstract%20geometric%20shapes%20representing%20team%20announcements%20and%20schedules%2C%20clean%20flat%20design%20style%2C%20warm%20lighting%2C%20professional%20workplace%20atmosphere%2C%20subtle%20texture%20background%2C%20no%20text&width=400&height=200&seq=1&orientation=landscape',
    manager: '嘉義機務段主管',
  },
  {
    id: 'ANN-002',
    title: '團隊合作與安全宣導',
    date: '2026/05/18',
    imageUrl:
      'https://readdy.ai/api/search-image?query=An%20abstract%20artistic%20illustration%20of%20teamwork%20collaboration%20in%20a%20modern%20workplace%2C%20featuring%20soft%20flowing%20lines%20connecting%20human%20silhouettes%20in%20warm%20earth%20tones%20and%20muted%20teal%20colors%2C%20minimalist%20style%20with%20gentle%20gradients%2C%20clean%20composition%2C%20professional%20atmosphere%2C%20subtle%20paper%20texture%20background%2C%20no%20text%20or%20letters&width=400&height=200&seq=2&orientation=landscape',
    rawUrl:
      'https://readdy.ai/api/search-image?query=An%20abstract%20artistic%20illustration%20of%20teamwork%20collaboration%20in%20a%20modern%20workplace%2C%20featuring%20soft%20flowing%20lines%20connecting%20human%20silhouettes%20in%20warm%20earth%20tones%20and%20muted%20teal%20colors%2C%20minimalist%20style%20with%20gentle%20gradients%2C%20clean%20composition%2C%20professional%20atmosphere%2C%20subtle%20paper%20texture%20background%2C%20no%20text%20or%20letters&width=400&height=200&seq=2&orientation=landscape',
    manager: '嘉義機務段主管',
  },
  {
    id: 'ANN-003',
    title: '出勤時間管理提醒',
    date: '2026/05/15',
    imageUrl:
      'https://readdy.ai/api/search-image?query=A%20modern%20abstract%20illustration%20of%20calendar%20and%20time%20management%20concept%2C%20featuring%20soft%20overlapping%20circular%20shapes%20in%20warm%20beige%20and%20sage%20green%20colors%2C%20subtle%20clock%20elements%2C%20minimalist%20flat%20design%2C%20clean%20white%20background%20with%20gentle%20shadows%2C%20professional%20office%20aesthetic%2C%20no%20text%20or%20numbers%20visible&width=400&height=200&seq=3&orientation=landscape',
    rawUrl:
      'https://readdy.ai/api/search-image?query=A%20modern%20abstract%20illustration%20of%20calendar%20and%20time%20management%20concept%2C%20featuring%20soft%20overlapping%20circular%20shapes%20in%20warm%20beige%20and%20sage%20green%20colors%2C%20subtle%20clock%20elements%2C%20minimalist%20flat%20design%2C%20clean%20white%20background%20with%20gentle%20shadows%2C%20professional%20office%20aesthetic%2C%20no%20text%20or%20numbers%20visible&width=400&height=200&seq=3&orientation=landscape',
    manager: '嘉義機務段主管',
  },
];

function toAnnouncement(row: Record<string, unknown>): Announcement {
  const rawUrl = String(row.image_url || row.imageUrl || '');
  return {
    id: String(row.id),
    title: String(row.title),
    date: String(row.date),
    imageUrl: convertGoogleDriveUrl(rawUrl),
    rawUrl,
    manager: String(row.manager),
  };
}

export function useAnnouncements(): Announcement[] {
  const [items, setItems] = useState<Announcement[]>(defaultAnnouncements);

  useEffect(() => {
    let mounted = true;

    async function fetchAnnouncements() {
      try {
        const { data, error } = await supabase
          .from('announcements')
          .select('*')
          .order('created_at', { ascending: false });

        if (!mounted) return;
        if (error) {
          console.error('公告讀取失敗', error);
          return;
        }
        if (data && data.length > 0) {
          setItems(data.map((row) => {
            try {
              return toAnnouncement(row);
            } catch (mapErr) {
              console.error('公告資料轉換失敗', mapErr, row);
              return null;
            }
          }).filter((item): item is Announcement => item !== null));
        }
      } catch (err) {
        if (!mounted) return;
        console.error('公告載入異常', err);
      }
    }

    fetchAnnouncements();

    // 每 5 秒輪詢一次，讓不同頁面/裝置能即時同步
    const interval = setInterval(fetchAnnouncements, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return items;
}