import { useState, useEffect, useCallback, useRef } from 'react';
import { toPng } from 'html-to-image';
import type { WeekShiftItem } from '@/mocks/shiftSchedule';
import type { LeaveRequest } from '@/stores/leaveStore';
import { getRequestDayStatusMap } from '@/stores/leaveStore';
import {
  shiftCodeMap,
  getCurrentCycleOrder,
  getShiftByCode,
  saveUserCustomShiftCode,
  resetUserCustomShifts,
  hasUserCustomShift,
  setShiftTimeOverrides,
  getUserCustomShiftCode,
  getShiftForDateWithCycle,
  getCycleShiftCodeForDate,
  removeUserCustomShift,
  type ShiftTimeOverride,
  getUserCustomShiftCodes,
} from '@/mocks/shiftSchedule';
import { useAuth } from '@/hooks/useAuth';
import { saveCycleOrder, restoreDefaultCycleOrder } from '@/hooks/useShiftCycleOrder';
import { supabase } from '@/lib/supabase';

interface WeekShiftPreviewProps {
  weekShifts: WeekShiftItem[];
  userId: string;
  leaves?: LeaveRequest[];
  onSaved?: () => void;
}

function shiftBgClass(type: string) {
  switch (type) {
    case 'day':
      return 'bg-teal-50 border-teal-200';
    case 'night':
      return 'bg-indigo-50 border-indigo-200';
    default:
      return 'bg-stone-50 border-stone-200';
  }
}

function shiftIconClass(type: string) {
  switch (type) {
    case 'day':
      return 'text-teal-600';
    case 'night':
      return 'text-indigo-600';
    default:
      return 'text-stone-400';
  }
}

function shiftLabelClass(type: string) {
  switch (type) {
    case 'day':
      return 'text-teal-700';
    case 'night':
      return 'text-indigo-700';
    default:
      return 'text-stone-500';
  }
}

/** 從 shift label 反查 code（取第一個匹配） */
function labelToCode(label: string): string | undefined {
  return Object.entries(shiftCodeMap).find(([, info]) => info.label === label)?.[0];
}

/** 從 shift label 推斷它在循環中「最合理」的索引（從 startFrom 位置開始往後找第一個匹配） */
function inferCycleIndexFrom(label: string, startFrom: number): number {
  const code = labelToCode(label);
  if (!code) return -1;
  const order = getCurrentCycleOrder();
  // 從 startFrom 往後搜尋，必要時繞回開頭
  for (let i = 0; i < order.length; i++) {
    const idx = (startFrom + i) % order.length;
    if (order[idx] === code) return idx;
  }
  return order.indexOf(code);
}

/** 產生分享用日期範圍文字 */
function formatDateRange(items: WeekShiftItem[]): string {
  if (items.length === 0) return '';
  const first = items[0];
  const last = items[items.length - 1];
  return `${first.month}/${first.dayNum} – ${last.month}/${last.dayNum}`;
}

/** 查詢某天是否有請假（返回最高優先級的一筆，優先使用逐日審核狀態） */
function findLeaveForDate(dateStr: string, leaves: LeaveRequest[]): LeaveRequest | undefined {
  const matched = leaves
    .filter((r) => r.status !== 'cancelled' && dateStr >= r.start_date && dateStr <= r.end_date)
    .sort((a, b) => {
      const priority = { approved: 3, pending: 2, rejected: 1 };
      return (priority[b.status] || 0) - (priority[a.status] || 0);
    })[0];

  if (!matched) return undefined;

  const dayMap = getRequestDayStatusMap(matched.id);
  if (dayMap[dateStr]) {
    return { ...matched, status: dayMap[dateStr] as LeaveRequest['status'] };
  }

  return matched;
}

/** 請假狀態小徽章配置 */
function leaveBadgeConfig(status: string): { text: string; bg: string; color: string; icon: string } {
  switch (status) {
    case 'approved':
      return { text: '准假', bg: 'bg-emerald-100', color: 'text-emerald-700', icon: 'ri-check-line' };
    case 'pending':
      return { text: '待審', bg: 'bg-amber-100', color: 'text-amber-700', icon: 'ri-time-line' };
    case 'rejected':
      return { text: '駁回', bg: 'bg-red-100', color: 'text-red-700', icon: 'ri-close-line' };
    case 'cancelled':
      return { text: '已取消', bg: 'bg-stone-100', color: 'text-stone-500', icon: 'ri-forbid-line' };
    default:
      return { text: '', bg: '', color: '', icon: '' };
  }
}

export default function WeekShiftPreview({ weekShifts, userId, leaves = [], onSaved }: WeekShiftPreviewProps) {
  const { user } = useAuth();
  const isManager = user?.role === 'manager';
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editItems, setEditItems] = useState<WeekShiftItem[]>([]);
  const [cycleIndices, setCycleIndices] = useState<number[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('已儲存');
  const exportRef = useRef<HTMLDivElement>(null);

  // 時間編輯狀態
  const [editingTimeCode, setEditingTimeCode] = useState<string | null>(null);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [savingTime, setSavingTime] = useState(false);

  // 排序編輯狀態
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [orderList, setOrderList] = useState<string[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);
  // 排序面板中正在編輯代碼的 row index
  const [editingOrderCodeIdx, setEditingOrderCodeIdx] = useState<number | null>(null);

  const allShiftCodes = Object.keys(shiftCodeMap);

  useEffect(() => {
    if (isEditing) {
      setEditItems([...weekShifts]);
      // 用純循環日期計算 cycleIndices，確保連續無跳空（不再從顯示標籤反推）
      const order = getCurrentCycleOrder();
      const indices: number[] = [];
      const userGroup = user?.group as 'A' | 'B' | null;
      for (let i = 0; i < weekShifts.length; i++) {
        const expectedCode = userGroup
          ? getCycleShiftCodeForDate(userGroup, weekShifts[i].dateStr)
          : 'OFF';
        const idx = order.indexOf(expectedCode);
        indices.push(idx >= 0 ? idx : 0);
      }
      setCycleIndices(indices);
    }
  }, [isEditing, weekShifts]);

  const cycleShift = useCallback((dateStr: string) => {
    setCycleIndices((prevIndices) => {
      const clickedIdx = editItems.findIndex((item) => item.dateStr === dateStr);
      if (clickedIdx === -1) return prevIndices;
      const order = getCurrentCycleOrder();
      const nextIndices = [...prevIndices];
      nextIndices[clickedIdx] = (prevIndices[clickedIdx] + 1) % order.length;
      for (let i = clickedIdx + 1; i < nextIndices.length; i++) {
        nextIndices[i] = (nextIndices[i - 1] + 1) % order.length;
      }
      return nextIndices;
    });
  }, [editItems]);

  useEffect(() => {
    if (!isEditing || editItems.length === 0 || cycleIndices.length !== editItems.length) return;
    const order = getCurrentCycleOrder();
    setEditItems((prev) =>
      prev.map((item, idx) => {
        const cycleIdx = cycleIndices[idx];
        if (cycleIdx === undefined || cycleIdx === -1) return item;
        const code = order[cycleIdx];
        const codeInfo = getShiftByCode(code);
        if (!codeInfo) return item;
        return {
          ...item,
          shift: {
            type: codeInfo.type,
            label: codeInfo.label,
            timeRange: codeInfo.timeRange,
            startTime: codeInfo.startTime,
            endTime: codeInfo.endTime,
            color: codeInfo.color,
            bgColor: codeInfo.bgColor,
            icon: codeInfo.icon,
          },
        };
      }),
    );
  }, [cycleIndices, isEditing]);

  function handleSave() {
    // 只儲存與循環預設不同的日期（避免把所有天都凍結成自訂）
    const userGroup = user?.group as 'A' | 'B' | null;
    editItems.forEach((item) => {
      const code = labelToCode(item.shift.label);
      if (!code) return;
      // 查詢該日期的循環預設班次
      const cycleDefault = userGroup ? getShiftForDateWithCycle(userGroup, item.dateStr) : null;
      const cycleCode = cycleDefault?.code;
      // 只有當用戶選擇的代碼和循環預設不同時，才儲存為自訂
      if (code !== cycleCode) {
        saveUserCustomShiftCode(userId, item.dateStr, code);
      } else {
        // 和循環預設相同就清除舊的自訂記錄
        removeUserCustomShift(userId, item.dateStr);
      }
    });
    setIsEditing(false);
    setToastMsg('已儲存');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
    onSaved?.();
  }

  function handleCancel() {
    setIsEditing(false);
    setEditItems([]);
    setCycleIndices([]);
  }

  function handleReset() {
    if (window.confirm('確定要恢復預設輪班嗎？這會清除你所有的自定義班表。')) {
      resetUserCustomShifts(userId);
      setIsEditing(false);
      setToastMsg('已恢復預設');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
      onSaved?.();
    }
  }

  /** 匯出班表圖片 */
  async function handleExportImage() {
    if (!exportRef.current) return;
    try {
      const dataUrl = await toPng(exportRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });
      const range = formatDateRange(weekShifts);
      const fileName = `班表_${range}.png`;

      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: '本周班表',
          text: `我的排班 ${range}`,
          files: [file],
        });
        setToastMsg('已分享');
      } else {
        const link = document.createElement('a');
        link.download = fileName;
        link.href = dataUrl;
        link.click();
        setToastMsg('已下載圖片');
      }
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } catch {
      setToastMsg('匯出失敗');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    }
  }

  const displayItems = isEditing ? editItems : weekShifts;

  /** 點擊卡片開始編輯時間 */
  function startTimeEdit(item: WeekShiftItem) {
    const code = labelToCode(item.shift.label);
    if (!code || code === 'OFF' || item.shift.type === 'rest') return;
    setEditingTimeCode(code);
    setEditStartTime(item.shift.startTime);
    setEditEndTime(item.shift.endTime);
  }

  /** 儲存班次時間覆寫 */
  async function handleTimeSave() {
    if (!editingTimeCode || !editStartTime.trim() || !editEndTime.trim()) {
      setToastMsg('請填寫完整時間');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
      return;
    }
    setSavingTime(true);
    try {
      const { error } = await supabase
        .from('shift_time_overrides')
        .upsert({
          shift_code: editingTimeCode,
          start_time: editStartTime.trim(),
          end_time: editEndTime.trim(),
        });

      if (error) {
        setToastMsg('儲存失敗：' + error.message);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
        return;
      }

      // 重新讀取所有覆寫並更新全域快取
      const { data } = await supabase
        .from('shift_time_overrides')
        .select('shift_code, start_time, end_time');
      if (data) {
        setShiftTimeOverrides(data as ShiftTimeOverride[]);
      }

      setEditingTimeCode(null);
      setToastMsg('時間已儲存，全站生效');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
      onSaved?.();
    } catch {
      setToastMsg('儲存異常');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } finally {
      setSavingTime(false);
    }
  }

  /** 重置班次時間（恢復預設） */
  async function handleTimeReset() {
    if (!editingTimeCode) return;
    if (!window.confirm('確定要恢復此班次的預設時間嗎？')) return;
    setSavingTime(true);
    try {
      await supabase
        .from('shift_time_overrides')
        .delete()
        .eq('shift_code', editingTimeCode);

      const { data } = await supabase
        .from('shift_time_overrides')
        .select('shift_code, start_time, end_time');
      if (data) {
        setShiftTimeOverrides(data as ShiftTimeOverride[]);
      }

      setEditingTimeCode(null);
      setToastMsg('已恢復預設時間');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
      onSaved?.();
    } catch {
      setToastMsg('重置異常');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } finally {
      setSavingTime(false);
    }
  }

  function cancelTimeEdit() {
    setEditingTimeCode(null);
  }

  function handleExitTimeEdit() {
    setIsEditingTime(false);
    setEditingTimeCode(null);
  }

  /** 進入排序編輯模式 */
  function startOrderEdit() {
    setOrderList([...getCurrentCycleOrder()]);
    setIsEditingOrder(true);
  }

  /** 移動排序項目 */
  function moveOrderItem(idx: number, direction: 'up' | 'down') {
    setOrderList((prev) => {
      const next = [...prev];
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= next.length) return prev;
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      return next;
    });
  }

  /** 儲存排序 */
  async function handleOrderSave() {
    setSavingOrder(true);
    try {
      // 自動計算循環偏移量：讓循環對齊目前預覽中的班表
      // 找第一筆有自訂代碼的日期，計算其在新循環中的位置與絕對日期計算的差異
      let offset = 0;
      const todayStr = weekShifts[0]?.dateStr;
      if (todayStr) {
        const customCode = getUserCustomShiftCode(userId, todayStr);
        if (customCode) {
          const posInNewCycle = orderList.indexOf(customCode);
          if (posInNewCycle >= 0) {
            const d = new Date(todayStr + 'T00:00:00');
            const base = new Date('2026-01-01T00:00:00').getTime();
            const diffMs = d.getTime() - base;
            const dayIndex = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const cycleLen = orderList.length;
            // 計算讓這個代碼出現在今天所需的偏移量
            offset = posInNewCycle - (dayIndex % cycleLen);
            // 正規化到 0..cycleLen-1
            offset = ((offset % cycleLen) + cycleLen) % cycleLen;
          }
        }
      }

      await saveCycleOrder(orderList, offset);
      // 清除管理員自己的自定義班表，讓循環排序立即在預覽中生效
      resetUserCustomShifts(userId);
      setIsEditingOrder(false);
      setToastMsg(offset !== 0 ? '排序已儲存，循環已對齊' : '排序已儲存，全站生效');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
      onSaved?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '儲存異常';
      setToastMsg('排序儲存失敗：' + msg);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } finally {
      setSavingOrder(false);
    }
  }

  /** 恢復預設排序 */
  async function handleOrderRestore() {
    if (!window.confirm(`確定要恢復預設的 ${getCurrentCycleOrder().length} 項循環排序嗎？`)) return;
    setSavingOrder(true);
    try {
      await restoreDefaultCycleOrder();
      setOrderList([...getCurrentCycleOrder()]);
      setToastMsg('已恢復預設排序');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
      onSaved?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '重置異常';
      setToastMsg('恢復失敗：' + msg);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } finally {
      setSavingOrder(false);
    }
  }

  function handleExitOrderEdit() {
    setIsEditingOrder(false);
    setOrderList([]);
    setEditingOrderCodeIdx(null);
  }

  /** 開始編輯某行的班次代碼 */
  function startOrderCodeEdit(idx: number) {
    setEditingOrderCodeIdx(idx);
  }

  /** 更換班次代碼 */
  function handleOrderCodeChange(newCode: string) {
    if (editingOrderCodeIdx === null) return;
    setOrderList((prev) => {
      const next = [...prev];
      next[editingOrderCodeIdx] = newCode;
      return next;
    });
    setEditingOrderCodeIdx(null);
  }

  /** 取消代碼編輯 */
  function cancelOrderCodeEdit() {
    setEditingOrderCodeIdx(null);
  }

  /** 新增項目到指定位置之後（預設 OFF） */
  function addOrderItem(afterIdx: number) {
    setOrderList((prev) => {
      const next = [...prev];
      next.splice(afterIdx + 1, 0, 'OFF');
      return next;
    });
  }

  /** 刪除指定位置的項目 */
  function deleteOrderItem(idx: number) {
    if (orderList.length <= 1) {
      setToastMsg('至少保留一項');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
      return;
    }
    setOrderList((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center">
            <i className="ri-calendar-todo-line text-teal-600 text-sm" />
          </div>
          <h2 className="text-sm font-semibold text-stone-700">
            {isEditing ? '編輯本周班表' : isEditingTime ? '編輯班次時間' : isEditingOrder ? '編輯循環排序' : '本周班表'}
          </h2>
          <span className="text-[10px] text-stone-400">{isEditingOrder ? `${orderList.length} 項` : '未來 8 天'}</span>
        </div>
        {!isEditing && !isEditingTime && !isEditingOrder && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleExportImage}
              className="flex items-center gap-1 text-[11px] text-stone-500 hover:text-emerald-600 transition-colors px-2 py-1 rounded-lg hover:bg-emerald-50"
              title="匯出圖片 / 分享"
            >
              <i className="ri-share-forward-line" />
              分享
            </button>
            {isManager && (
              <>
                <button
                  onClick={() => setIsEditingTime(true)}
                  className="flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-700 transition-colors px-2 py-1 rounded-lg hover:bg-amber-50"
                  title="編輯班次上下班時間"
                >
                  <i className="ri-timer-line" />
                  時間
                </button>
                <button
                  onClick={startOrderEdit}
                  className="flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-600 transition-colors px-2 py-1 rounded-lg hover:bg-rose-50"
                  title="編輯循環排序"
                >
                  <i className="ri-sort-desc" />
                  排序
                </button>
              </>
            )}
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1 text-[11px] text-stone-500 hover:text-emerald-600 transition-colors px-2 py-1 rounded-lg hover:bg-emerald-50"
            >
              <i className="ri-pencil-line" />
              編輯
            </button>
          </div>
        )}
        {isEditingTime && (
          <button
            onClick={handleExitTimeEdit}
            className="flex items-center gap-1 text-[11px] text-stone-500 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
          >
            <i className="ri-close-line" />
            完成
          </button>
        )}
        {isEditingOrder && (
          <button
            onClick={handleExitOrderEdit}
            className="flex items-center gap-1 text-[11px] text-stone-500 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
          >
            <i className="ri-close-line" />
            完成
          </button>
        )}
      </div>

      {/* 編輯提示 */}
      {isEditing && (
        <div className="flex items-center gap-1.5 mb-2 px-1">
          <i className="ri-information-line text-amber-500 text-xs" />
          <span className="text-[11px] text-amber-600">
            點擊任意一天，後面日期會自動按 {getCurrentCycleOrder().length} 項循環排列
          </span>
        </div>
      )}

      {/* 時間編輯提示 */}
      {isEditingTime && !editingTimeCode && (
        <div className="flex items-center gap-1.5 mb-2 px-1">
          <i className="ri-information-line text-amber-500 text-xs" />
          <span className="text-[11px] text-amber-600">
            點擊班次卡片即可修改該班次的上下班時間
          </span>
        </div>
      )}

      {/* Cards */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {displayItems.map((item) => {
          const isCustom = !isEditing && hasUserCustomShift(userId, item.dateStr);
          const dayLeave = !isEditing ? findLeaveForDate(item.dateStr, leaves) : undefined;
          const leaveBadge = dayLeave ? leaveBadgeConfig(dayLeave.status) : null;

          return (
            <div
              key={item.dateStr}
              className={`flex-shrink-0 w-[84px] rounded-xl border p-2.5 text-center transition-all ${
                item.isToday
                  ? 'border-emerald-300 bg-emerald-50/60 ring-1 ring-emerald-200'
                  : `border ${shiftBgClass(item.shift.type)}`
              } ${isEditing ? 'cursor-pointer active:scale-95 select-none' : ''} ${isEditingTime && item.shift.type !== 'rest' ? 'cursor-pointer active:scale-95 select-none hover:ring-2 hover:ring-amber-300' : ''}`}
              onClick={() => {
                if (isEditing) cycleShift(item.dateStr);
                else if (isEditingTime) startTimeEdit(item);
              }}
            >
              {/* 星期 + 請假徽章列 */}
              <div className="flex items-center justify-center gap-1">
                <p className={`text-[10px] font-medium ${item.isToday ? 'text-emerald-700' : 'text-stone-500'}`}>
                  {item.isToday ? '今天' : `週${item.dayOfWeek}`}
                </p>
                {leaveBadge && (
                  <span className={`inline-flex items-center gap-[1px] text-[8px] font-bold px-1 py-[1px] rounded-full ${leaveBadge.bg} ${leaveBadge.color}`}>
                    <i className={`${leaveBadge.icon} text-[7px]`} />
                    {leaveBadge.text}
                  </span>
                )}
              </div>

              {/* 日期 */}
              <p className="text-sm font-bold text-stone-800 mt-0.5 leading-tight">
                {item.month}/{item.dayNum}
              </p>

              {/* 自定義標記 */}
              {isCustom && !isEditing && (
                <span className="inline-block mt-0.5 text-[8px] font-bold text-amber-600 bg-amber-100 px-1 py-[2px] rounded-full">
                  自訂
                </span>
              )}

              {/* 班次圖標 */}
              <div className={`w-8 h-8 mx-auto mt-1.5 rounded-lg flex items-center justify-center ${isEditing ? 'bg-white shadow-sm' : 'bg-white/70'}`}>
                <i className={`${item.shift.icon} text-base ${shiftIconClass(item.shift.type)}`} />
              </div>

              {/* 班次名稱（代碼） */}
              <p className={`text-[10px] font-bold mt-1 leading-tight ${shiftLabelClass(item.shift.type)}`}>
                {item.shift.label}
              </p>

              {/* 上班時間（只顯示開始時間；hideStartTime 為 true 時不顯示） */}
              {item.shift.type !== 'rest' && !item.shift.hideStartTime && (
                <p className="text-[9px] text-stone-400 mt-0.5 leading-tight">
                  {item.shift.startTime} 上班
                </p>
              )}

              {item.shift.type === 'rest' && (
                <p className="text-[9px] text-stone-400 mt-0.5">例假</p>
              )}

              {/* 今天標記 */}
              {item.isToday && (
                <span className="inline-block mt-1 text-[8px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-[2px] rounded-full">
                  NOW
                </span>
              )}

              {/* 編輯提示：點擊切換 */}
              {isEditing && (
                <span className="inline-block mt-0.5 text-[8px] text-stone-400">
                  <i className="ri-refresh-line" /> 點擊
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 隱藏的匯出區域 */}
      <div
        ref={exportRef}
        className="absolute left-[-9999px] top-0 bg-white p-5 rounded-2xl"
        style={{ width: 'fit-content' }}
      >
        <div className="text-center mb-4">
          <p className="text-lg font-bold text-stone-800">本周班表</p>
          <p className="text-xs text-stone-400 mt-0.5">{formatDateRange(weekShifts)}</p>
        </div>
        <div className="flex gap-2">
          {weekShifts.map((item) => (
            <div
              key={`export-${item.dateStr}`}
              className={`w-[80px] rounded-xl border p-3 text-center ${
                item.isToday
                  ? 'border-emerald-300 bg-emerald-50/60'
                  : `border ${shiftBgClass(item.shift.type)}`
              }`}
            >
              <p className="text-[10px] font-medium text-stone-500">
                {item.isToday ? '今天' : `週${item.dayOfWeek}`}
              </p>
              <p className="text-sm font-bold text-stone-800 mt-0.5">
                {item.month}/{item.dayNum}
              </p>
              <div className="w-8 h-8 mx-auto mt-1.5 rounded-lg flex items-center justify-center bg-white/70">
                <i className={`${item.shift.icon} text-base ${shiftIconClass(item.shift.type)}`} />
              </div>
              <p className={`text-[10px] font-bold mt-1 leading-tight ${shiftLabelClass(item.shift.type)}`}>
                {item.shift.label}
              </p>
              {item.shift.type !== 'rest' && !item.shift.hideStartTime && (
                <p className="text-[9px] text-stone-400 mt-0.5 leading-tight">
                  {item.shift.startTime} 上班
                </p>
              )}
              {item.shift.type === 'rest' && (
                <p className="text-[9px] text-stone-400 mt-0.5">例假</p>
              )}
              {item.isToday && (
                <span className="inline-block mt-1 text-[8px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-[2px] rounded-full">
                  NOW
                </span>
              )}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-stone-300 text-center mt-3">排班小幫手</p>
      </div>

      {/* 時間編輯器面板 */}
      {editingTimeCode && (() => {
        const codeInfo = getShiftByCode(editingTimeCode);
        return (
          <div className="mt-3 bg-white rounded-xl border border-amber-200 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${codeInfo?.type === 'day' ? 'bg-teal-50' : 'bg-indigo-50'}`}>
                <span className={`text-xs font-bold ${codeInfo?.type === 'day' ? 'text-teal-600' : 'text-indigo-600'}`}>
                  {editingTimeCode}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-800">{codeInfo?.label || editingTimeCode + '班'}</p>
                <p className="text-[11px] text-stone-400">修改上下班時間</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-stone-400 mb-1 block">上班時間</label>
                <input
                  type="time"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg border border-stone-200 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
              <span className="text-stone-300 mt-4">–</span>
              <div className="flex-1">
                <label className="text-[10px] text-stone-400 mb-1 block">下班時間</label>
                <input
                  type="time"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg border border-stone-200 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleTimeSave}
                disabled={savingTime}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-xs font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-1 whitespace-nowrap"
              >
                {savingTime ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-check-line" />}
                儲存
              </button>
              <button
                onClick={handleTimeReset}
                disabled={savingTime}
                className="px-3 py-2 rounded-lg border border-red-200 text-red-500 text-xs font-medium hover:bg-red-50 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                恢復預設
              </button>
              <button
                onClick={cancelTimeEdit}
                disabled={savingTime}
                className="px-4 py-2 rounded-lg border border-stone-200 text-stone-600 text-xs font-medium hover:bg-stone-50 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                取消
              </button>
            </div>
          </div>
        );
      })()}

      {/* 排序編輯器面板 */}
      {isEditingOrder && (
        <div className="mt-3 bg-white rounded-xl border border-rose-200 overflow-hidden">
          <div className="p-3 border-b border-rose-100 bg-rose-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <i className="ri-sort-desc text-rose-500 text-sm" />
              <span className="text-xs font-semibold text-stone-700">循環排序（{orderList.length} 項）</span>
            </div>
            <span className="text-[10px] text-stone-400">點擊代碼更換 | ±增刪 | 箭頭排序</span>
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {orderList.map((code, idx) => {
              const info = getShiftByCode(code);
              const isFirst = idx === 0;
              const isLast = idx === orderList.length - 1;
              const typeClass = info?.type === 'day' ? 'bg-teal-50 text-teal-700' :
                info?.type === 'night' ? 'bg-indigo-50 text-indigo-700' :
                'bg-stone-100 text-stone-600';
              return (
                <div
                  key={`${code}-${idx}`}
                  className={`flex items-center gap-2 px-3 py-2 border-b border-stone-100 hover:bg-stone-50/50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-stone-50/30'}`}
                >
                  <span className="text-[10px] text-stone-400 w-5 text-right font-mono">{idx + 1}</span>
                  {editingOrderCodeIdx === idx ? (
                    <select
                      value={code}
                      onChange={(e) => handleOrderCodeChange(e.target.value)}
                      onBlur={cancelOrderCodeEdit}
                      autoFocus
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-emerald-300 text-stone-800 min-w-[44px] text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none cursor-pointer"
                    >
                      {allShiftCodes.map((c) => {
                        const ci = getShiftByCode(c);
                        return (
                          <option key={c} value={c}>
                            {c} - {ci?.label || c}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <button
                      onClick={() => startOrderCodeEdit(idx)}
                      disabled={savingOrder}
                      title="點擊更換班次代碼"
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${typeClass} min-w-[36px] text-center hover:ring-2 hover:ring-emerald-300 transition-all disabled:cursor-not-allowed cursor-pointer`}
                    >
                      {code}
                    </button>
                  )}
                  <span className="text-[11px] text-stone-600 flex-1 whitespace-nowrap truncate">
                    {info?.label || code}
                  </span>
                  <span className="text-[10px] text-stone-400 hidden sm:block whitespace-nowrap">
                    {info?.timeRange || '-'}
                  </span>
                  <div className="flex items-center gap-0.5 ml-auto">
                    <button
                      onClick={() => addOrderItem(idx)}
                      disabled={savingOrder}
                      className="w-6 h-6 rounded flex items-center justify-center text-stone-300 hover:text-emerald-500 hover:bg-emerald-50 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                      title="在下方新增一項"
                    >
                      <i className="ri-add-line text-sm" />
                    </button>
                    <button
                      onClick={() => deleteOrderItem(idx)}
                      disabled={savingOrder}
                      className="w-6 h-6 rounded flex items-center justify-center text-stone-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                      title="刪除此項"
                    >
                      <i className="ri-close-line text-sm" />
                    </button>
                    <button
                      onClick={() => moveOrderItem(idx, 'up')}
                      disabled={isFirst || savingOrder}
                      className="w-6 h-6 rounded flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                    >
                      <i className="ri-arrow-up-s-line text-sm" />
                    </button>
                    <button
                      onClick={() => moveOrderItem(idx, 'down')}
                      disabled={isLast || savingOrder}
                      className="w-6 h-6 rounded flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                    >
                      <i className="ri-arrow-down-s-line text-sm" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="p-3 border-t border-rose-100 bg-rose-50/30 flex items-center gap-2">
            <button
              onClick={handleOrderSave}
              disabled={savingOrder}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-xs font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-1 whitespace-nowrap"
            >
              {savingOrder ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-check-line" />}
              儲存排序
            </button>
            <button
              onClick={handleOrderRestore}
              disabled={savingOrder}
              className="px-4 py-2 rounded-lg border border-red-200 text-red-500 text-xs font-medium hover:bg-red-50 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              恢復預設
            </button>
          </div>
        </div>
      )}

      {/* 編輯操作按鈕 */}
      {isEditing && (
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={handleSave}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            <i className="ri-check-line mr-1" />
            儲存
          </button>
          <button
            onClick={handleCancel}
            className="flex-1 bg-white hover:bg-stone-50 border border-stone-200 text-stone-600 text-xs font-medium py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            取消
          </button>
          <button
            onClick={handleReset}
            className="flex-1 bg-white hover:bg-red-50 border border-stone-200 text-red-500 text-xs font-medium py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            恢復預設
          </button>
        </div>
      )}

      {/* Toast */}
      {showToast && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-stone-800 text-white text-xs px-4 py-2 rounded-full shadow-lg animate-bounce z-50">
          <i className="ri-check-line mr-1" />
          {toastMsg}
        </div>
      )}
    </div>
  );
}