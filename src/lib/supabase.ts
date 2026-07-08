import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string | undefined;
const rawKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

const url = (rawUrl || '').replace(/\/$/, '');
const key = rawKey || '';

if (!url || !key) {
  console.error('Supabase 環境變數未設定：VITE_PUBLIC_SUPABASE_URL 或 VITE_PUBLIC_SUPABASE_ANON_KEY 缺失');
}

export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder');