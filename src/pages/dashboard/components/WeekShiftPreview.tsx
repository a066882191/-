import { useState, useEffect, useCallback, useRef } from 'react';
import { toPng } from 'html-to-image';
import type { WeekShiftItem } from '@/mocks/shiftSchedule';
import type { LeaveRequest } from '@/stores/leaveStore';
import {
  shiftCodeMap,
  USER_CYCLE_ORDER,
  getShiftByCode,
  saveUserCustomShiftCode,
  resetUserCustomShifts,
  hasUserCustomShift,
} from '@/mocks/shiftSchedule';

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

/** 從 shift label 推斷它在循環中最可能的索引 */
function inferCycleIndex(label: string): number {
  const code = labelToCode(label);
  if (!code) return -1;
  return USER_CYCLE_ORDER.indexOf(code);
}

/** 產生分享用日期範圍文字 */
function formatDateRange(items: WeekShiftItem[]): string {
  if (items.length === 0) return '';
  const first = items[0];
  const last = items[items.length - 1];
  return `${first.month}/${first.dayNum} – ${last.month}/${last.dayNum}`;
}

/** 查詢某天是否有請假（返回最高優先級的一筆） */
function findLeaveForDate(dateStr: string, leaves: LeaveRequest[]): LeaveRequest | undefined {
  return leaves
    .filter((r) => r.status !== 'cancelled' && dateStr >= r.start_date && dateStr <= r.end_date)
    .sort((a, b) => {
      const priority = { approved: 3, pending: 2, rejected: 1 };
      return (priority[b.status] || 0) - (priority[a.status] || 0);
    })[0];
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
    default:
      return { text: '', bg: '', color: '', icon: '' };
  }
}

export default function WeekShiftPreview({ weekShifts, userId, leaves = [], onSaved }: WeekShiftPreviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editItems, setEditItems] = useState<WeekShiftItem[]>([]);
  const [cycleIndices, setCycleIndices] = useState<number[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('已儲存');
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing) {
      setEditItems([...weekShifts]);
      setCycleIndices(weekShifts.map((item) => inferCycleIndex(item.shift.label)));
    }
  }, [isEditing, weekShifts]);

  const cycleShift = useCallback((dateStr: string) => {
    setCycleIndices((prevIndices) => {
      const clickedIdx = editItems.findIndex((item) => item.dateStr === dateStr);
      if (clickedIdx === -1) return prevIndices;
      const nextIndices = [...prevIndices];
      nextIndices[clickedIdx] = (prevIndices[clickedIdx] + 1) % USER_CYCLE_ORDER.length;
      for (let i = clickedIdx + 1; i < nextIndices.length; i++) {
        nextIndices[i] = (nextIndices[i - 1] + 1) % USER_CYCLE_ORDER.length;
      }
      return nextIndices;
    });
  }, [editItems]);

  useEffect(() => {
    if (!isEditing || editItems.length === 0 || cycleIndices.length !== editItems.length) return;
    setEditItems((prev) =>
      prev.map((item, idx) => {
        const cycleIdx = cycleIndices[idx];
        if (cycleIdx === undefined || cycleIdx === -1) return item;
        const code = USER_CYCLE_ORDER[cycleIdx];
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
    editItems.forEach((item) => {
      const code = labelToCode(item.shift.label);
      if (code) saveUserCustomShiftCode(userId, item.dateStr, code);
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

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center">
            <i className="ri-calendar-todo-line text-teal-600 text-sm" />
          </div>
          <h2 className="text-sm font-semibold text-stone-700">
            {isEditing ? '編輯本周班表' : '本周班表'}
          </h2>
          <span className="text-[10px] text-stone-400">未來 8 天</span>
        </div>
        {!isEditing && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleExportImage}
              className="flex items-center gap-1 text-[11px] text-stone-500 hover:text-emerald-600 transition-colors px-2 py-1 rounded-lg hover:bg-emerald-50"
              title="匯出圖片 / 分享"
            >
              <i className="ri-share-forward-line" />
              分享
            </button>
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1 text-[11px] text-stone-500 hover:text-emerald-600 transition-colors px-2 py-1 rounded-lg hover:bg-emerald-50"
            >
              <i className="ri-pencil-line" />
              編輯
            </button>
          </div>
        )}
      </div>

      {/* 編輯提示 */}
      {isEditing && (
        <div className="flex items-center gap-1.5 mb-2 px-1">
          <i className="ri-information-line text-amber-500 text-xs" />
          <span className="text-[11px] text-amber-600">
            點擊任意一天，後面日期會自動按 74 項循環排列
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
              className={`flex-shrink-0 w-[76px] rounded-xl border p-2.5 text-center transition-all ${
                item.isToday
                  ? 'border-emerald-300 bg-emerald-50/60 ring-1 ring-emerald-200'
                  : `border ${shiftBgClass(item.shift.type)}`
              } ${isEditing ? 'cursor-pointer active:scale-95 select-none' : ''}`}
              onClick={() => { if (isEditing) cycleShift(item.dateStr); }}
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
                <span className="inline-block mt-0.5 text-[8px] font-bold text-amber-600 bg-amber-100 px-1 py-[1px] rounded-full">
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