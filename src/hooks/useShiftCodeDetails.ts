import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  setShiftCodeDetails,
  registerCustomShiftCodes,
  type ShiftCodeDetail,
} from '@/mocks/shiftSchedule';

let _customCodesLoaded = false;

export function useShiftCodeDetails() {
  useEffect(() => {
    // 載入班次詳細資訊（管制地點、管制時間）
    supabase
      .from('shift_code_details')
      .select('shift_code, control_location, control_time, control_location_2, control_time_2, label')
      .then(({ data }) => {
        if (data && data.length > 0) {
          setShiftCodeDetails(data as ShiftCodeDetail[]);
        }
      })
      .catch(() => {
        // silently fail, fallback to defaults
      });

    // 載入自訂班次代碼
    if (_customCodesLoaded) return;
    _customCodesLoaded = true;
    supabase
      .from('shift_custom_codes')
      .select('code, label, type, start_time, end_time')
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          registerCustomShiftCodes(data as Array<{
            code: string;
            label: string;
            type: string;
            start_time: string;
            end_time: string;
          }>);
        }
      })
      .catch(() => {
        // silently fail
      });

    return () => {
      _customCodesLoaded = false;
    };
  }, []);
}