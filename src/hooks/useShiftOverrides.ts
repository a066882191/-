import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { ShiftTimeOverride } from '@/mocks/shiftSchedule';
import { setShiftTimeOverrides } from '@/mocks/shiftSchedule';

let _loaded = false;

/** 從資料庫載入管理員自訂的班次時間覆寫，並更新全域快取 */
export function useShiftOverrides() {
  useEffect(() => {
    if (_loaded) return;
    _loaded = true;

    async function load() {
      try {
        const { data, error } = await supabase
          .from('shift_time_overrides')
          .select('shift_code, start_time, end_time');

        if (error) {
          console.error('班次時間覆寫載入失敗', error);
          return;
        }

        if (data && data.length > 0) {
          setShiftTimeOverrides(data as ShiftTimeOverride[]);
        }
      } catch (err) {
        console.error('班次時間覆寫載入異常', err);
      }
    }

    load();
  }, []);
}