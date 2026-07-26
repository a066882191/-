import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { setCustomCycleOrder, resetCycleOrder, setCycleOffset } from '@/mocks/shiftSchedule';

/** 載入管理員設定的循環排序，回傳 cycleVersion 供消費者當作 memo 依賴 */
export function useShiftCycleOrder(): { cycleVersion: number } {
  const [cycleVersion, setCycleVersion] = useState(0);
  const mountedRef = useRef(true);
  const requestedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    if (requestedRef.current) return;
    requestedRef.current = true;

    async function load() {
      try {
        const { data, error } = await supabase
          .from('shift_cycle_order')
          .select('shift_code, sort_order');

        if (!mountedRef.current) return;

        if (error) {
          console.error('班次排序載入失敗', error);
          return;
        }

        if (data && data.length > 0) {
          // 分離 offset 行（sort_order=0）與排序行，並強制按 sort_order 排序
          const offsetRow = data.find((row: { sort_order: number }) => row.sort_order === 0);
          const orderRows = data
            .filter((row: { sort_order: number }) => row.sort_order > 0)
            .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order);

          if (orderRows.length > 0) {
            const order = orderRows.map((row: { shift_code: string }) => row.shift_code);
            setCustomCycleOrder(order);
            console.log('[useShiftCycleOrder] 載入排序', order.length, '項，首項', order[0], '末項', order[order.length - 1]);
          }

          if (offsetRow) {
            const match = (offsetRow as { shift_code: string }).shift_code.match(/^CYCLE_OFFSET:(-?\d+)$/);
            if (match) {
              const off = parseInt(match[1], 10);
              setCycleOffset(off);
              console.log('[useShiftCycleOrder] 載入 offset', off);
            }
          }
        }
        // 無論有無資料，都觸發一次 re-render（確保 memo 更新）
        setCycleVersion((v) => v + 1);
      } catch (err) {
        console.error('班次排序載入異常', err);
      }
    }

    load();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  return { cycleVersion };
}

/** 儲存排序到 DB 並更新記憶體（offset 為自動計算的循環偏移量） */
export async function saveCycleOrder(order: string[], offset?: number): Promise<void> {
  const rows: Array<{ shift_code: string; sort_order: number }> = order.map((code, idx) => ({
    shift_code: code,
    sort_order: idx + 1,
  }));

  // 若有 offset，追加特殊行
  if (offset !== undefined) {
    rows.push({ shift_code: `CYCLE_OFFSET:${offset}`, sort_order: 0 });
  }

  // 先刪除再插入（簡化方案）
  const { error: delErr } = await supabase
    .from('shift_cycle_order')
    .delete()
    .neq('id', 0);

  if (delErr) throw delErr;

  const { error: insErr } = await supabase
    .from('shift_cycle_order')
    .insert(rows);

  if (insErr) throw insErr;

  setCustomCycleOrder(order);
  if (offset !== undefined) {
    setCycleOffset(offset);
  }
}

/** 恢復預設排序 */
export async function restoreDefaultCycleOrder(): Promise<void> {
  const { error: delErr } = await supabase
    .from('shift_cycle_order')
    .delete()
    .neq('id', 0);

  if (delErr) throw delErr;

  resetCycleOrder();
}