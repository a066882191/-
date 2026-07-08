export type ShiftType = 'day' | 'night' | 'rest';

export interface ShiftInfo {
  type: ShiftType;
  label: string;
  timeRange: string;
  startTime: string;
  endTime: string;
  color: string;
  bgColor: string;
  icon: string;
  hideStartTime?: boolean;
}

export interface WeekShiftItem {
  dateStr: string;
  dayOfWeek: string;
  dayNum: number;
  month: number;
  shift: ShiftInfo;
  isToday: boolean;
}

export const shiftTypeMap: Record<ShiftType, ShiftInfo> = {
  day: {
    type: 'day',
    label: '白班',
    timeRange: '06:00 – 14:00',
    startTime: '06:00',
    endTime: '14:00',
    color: 'text-teal-700',
    bgColor: 'bg-teal-50 border-teal-200',
    icon: 'ri-sun-line',
  },
  night: {
    type: 'night',
    label: '夜班',
    timeRange: '14:00 – 22:00',
    startTime: '14:00',
    endTime: '22:00',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50 border-indigo-200',
    icon: 'ri-moon-line',
  },
  rest: {
    type: 'rest',
    label: '休假',
    timeRange: '-',
    startTime: '-',
    endTime: '-',
    color: 'text-stone-500',
    bgColor: 'bg-stone-50 border-stone-200',
    icon: 'ri-hotel-bed-line',
  },
};

// ===== 班次代碼定義（701 ~ 762） =====
export interface ShiftCodeInfo {
  code: string;
  label: string;
  timeRange: string;
  startTime: string;
  endTime: string;
  type: ShiftType;
  color: string;
  bgColor: string;
  icon: string;
  hideStartTime?: boolean;
}

/** 所有可用班次代碼映射 */
export const shiftCodeMap: Record<string, ShiftCodeInfo> = {
  // === 701-730：白班基礎系列 ===
  ...Object.fromEntries(
    Array.from({ length: 30 }, (_, i) => {
      const code = String(701 + i);
      return [code, {
        code,
        label: `${code}班`,
        timeRange: '06:00 – 14:00',
        startTime: '06:00',
        endTime: '14:00',
        type: 'day' as ShiftType,
        color: 'text-teal-700',
        bgColor: 'bg-teal-50 border-teal-200',
        icon: 'ri-sun-line',
      }];
    }),
  ),
  // === 732：特殊班 ===
  '732': {
    code: '732',
    label: '732班',
    timeRange: '14:00 – 22:00',
    startTime: '14:00',
    endTime: '22:00',
    type: 'night',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50 border-indigo-200',
    icon: 'ri-moon-line',
  },
  // === 741-743：早班系列 ===
  '741': {
    code: '741', label: '741班', timeRange: '05:00 – 13:00',
    startTime: '05:00', endTime: '13:00', type: 'day',
    color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line',
  },
  '742': {
    code: '742', label: '742班', timeRange: '05:30 – 13:30',
    startTime: '05:30', endTime: '13:30', type: 'day',
    color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line',
  },
  '743': {
    code: '743', label: '743班', timeRange: '05:30 – 13:30',
    startTime: '05:30', endTime: '13:30', type: 'day',
    color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line',
  },
  // === 746-748：偏移白班 ===
  '746': {
    code: '746', label: '746班', timeRange: '07:00 – 15:00',
    startTime: '07:00', endTime: '15:00', type: 'day',
    color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line',
  },
  '747': {
    code: '747', label: '747班', timeRange: '07:30 – 15:30',
    startTime: '07:30', endTime: '15:30', type: 'day',
    color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line',
  },
  '748': {
    code: '748', label: '748班', timeRange: '08:00 – 16:00',
    startTime: '08:00', endTime: '16:00', type: 'day',
    color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line',
  },
  // === 751-755：晚班系列 ===
  '751': {
    code: '751', label: '751班', timeRange: '14:00 – 22:00',
    startTime: '14:00', endTime: '22:00', type: 'night',
    color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200', icon: 'ri-moon-line',
  },
  '752': {
    code: '752', label: '752班', timeRange: '14:30 – 22:30',
    startTime: '14:30', endTime: '22:30', type: 'night',
    color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200', icon: 'ri-moon-line',
  },
  '753': {
    code: '753', label: '753班', timeRange: '15:00 – 23:00',
    startTime: '15:00', endTime: '23:00', type: 'night',
    color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200', icon: 'ri-moon-line',
  },
  '754': {
    code: '754', label: '754班', timeRange: '15:30 – 23:30',
    startTime: '15:30', endTime: '23:30', type: 'night',
    color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200', icon: 'ri-moon-line',
  },
  '755': {
    code: '755', label: '755班', timeRange: '16:00 – 00:00',
    startTime: '16:00', endTime: '00:00', type: 'night',
    color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200', icon: 'ri-moon-line',
  },
  // === 761-762：深夜班 ===
  '761': {
    code: '761', label: '761班', timeRange: '22:00 – 06:00',
    startTime: '22:00', endTime: '06:00', type: 'night',
    color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200', icon: 'ri-moon-line',
  },
  '762': {
    code: '762', label: '762班', timeRange: '23:00 – 07:00',
    startTime: '23:00', endTime: '07:00', type: 'night',
    color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200', icon: 'ri-moon-line',
  },
  // === 休假 ===
  'OFF': {
    code: 'OFF',
    label: '休假',
    timeRange: '-',
    startTime: '-',
    endTime: '-',
    type: 'rest',
    color: 'text-stone-500',
    bgColor: 'bg-stone-50 border-stone-200',
    icon: 'ri-hotel-bed-line',
  },
  // === 完整班序時間定義 ===
  '701': { code: '701', label: '701班', timeRange: '08:55 – 16:55', startTime: '08:55', endTime: '16:55', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '702': { code: '702', label: '702班', timeRange: '09:55 – 17:55', startTime: '09:55', endTime: '17:55', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '703': { code: '703', label: '703班', timeRange: '12:00 – 20:00', startTime: '12:00', endTime: '20:00', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '704': { code: '704', label: '704班', timeRange: '09:14 – 17:14', startTime: '09:14', endTime: '17:14', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '705': { code: '705', label: '705班', timeRange: '16:12 – 00:12', startTime: '16:12', endTime: '00:12', type: 'night', color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200', icon: 'ri-moon-line' },
  '706': { code: '706', label: '706班', timeRange: '10:17 – 18:17', startTime: '10:17', endTime: '18:17', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '707': { code: '707', label: '707班', timeRange: '13:28 – 21:28', startTime: '13:28', endTime: '21:28', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '708': { code: '708', label: '708班', timeRange: '05:11 – 13:11', startTime: '05:11', endTime: '13:11', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '709': { code: '709', label: '709班', timeRange: '16:28 – 00:28', startTime: '16:28', endTime: '00:28', type: 'night', color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200', icon: 'ri-moon-line' },
  '710': { code: '710', label: '710班', timeRange: '09:26 – 17:26', startTime: '09:26', endTime: '17:26', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '711': { code: '711', label: '711班', timeRange: '15:19 – 23:19', startTime: '15:19', endTime: '23:19', type: 'night', color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200', icon: 'ri-moon-line' },
  '712': { code: '712', label: '712班', timeRange: '05:34 – 13:34', startTime: '05:34', endTime: '13:34', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '713': { code: '713', label: '713班', timeRange: '08:07 – 16:07', startTime: '08:07', endTime: '16:07', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '714': { code: '714', label: '714班', timeRange: '12:23 – 20:23', startTime: '12:23', endTime: '20:23', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '715': { code: '715', label: '715班', timeRange: '06:23 – 14:23', startTime: '06:23', endTime: '14:23', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '716': { code: '716', label: '716班', timeRange: '08:27 – 16:27', startTime: '08:27', endTime: '16:27', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '717': { code: '717', label: '717班', timeRange: '11:20 – 19:20', startTime: '11:20', endTime: '19:20', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '718': { code: '718', label: '718班', timeRange: '18:56 – 06:56', startTime: '18:56', endTime: '06:56', type: 'night', color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200', icon: 'ri-moon-line' },
  '719': { code: '719', label: '719班', timeRange: '07:31 – 15:31', startTime: '07:31', endTime: '15:31', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '720': { code: '720', label: '720班', timeRange: '17:37 – 01:37', startTime: '17:37', endTime: '01:37', type: 'night', color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200', icon: 'ri-moon-line' },
  '722': { code: '722', label: '722班', timeRange: '14:31 – 22:31', startTime: '14:31', endTime: '22:31', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '723': { code: '723', label: '723班', timeRange: '13:37 – 21:37', startTime: '13:37', endTime: '21:37', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '724': { code: '724', label: '724班', timeRange: '12:58 – 20:58', startTime: '12:58', endTime: '20:58', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '725': { code: '725', label: '725班', timeRange: '10:47 – 18:47', startTime: '10:47', endTime: '18:47', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '726': { code: '726', label: '726班', timeRange: '11:36 – 19:36', startTime: '11:36', endTime: '19:36', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '727': { code: '727', label: '727班', timeRange: '12:39 – 20:39', startTime: '12:39', endTime: '20:39', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '729': { code: '729', label: '729班', timeRange: '15:13 – 23:13', startTime: '15:13', endTime: '23:13', type: 'night', color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200', icon: 'ri-moon-line' },
  '730': { code: '730', label: '730班', timeRange: '14:14 – 22:14', startTime: '14:14', endTime: '22:14', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '732': { code: '732', label: '732班', timeRange: '15:53 – 23:53', startTime: '15:53', endTime: '23:53', type: 'night', color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200', icon: 'ri-moon-line' },
  '741': { code: '741', label: '741班', timeRange: '11:11 – 19:11', startTime: '11:11', endTime: '19:11', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '742': { code: '742', label: '742班', timeRange: '14:52 – 22:52', startTime: '14:52', endTime: '22:52', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '743': { code: '743', label: '743班', timeRange: '16:05 – 00:05', startTime: '16:05', endTime: '00:05', type: 'night', color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200', icon: 'ri-moon-line' },
  '746': { code: '746', label: '746班', timeRange: '08:28 – 16:28', startTime: '08:28', endTime: '16:28', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '747': { code: '747', label: '747班', timeRange: '14:22 – 22:22', startTime: '14:22', endTime: '22:22', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '748': { code: '748', label: '748班', timeRange: '15:27 – 23:27', startTime: '15:27', endTime: '23:27', type: 'night', color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200', icon: 'ri-moon-line' },
  '751': { code: '751', label: '751班', timeRange: '10:39 – 18:39', startTime: '10:39', endTime: '18:39', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '752': { code: '752', label: '752班', timeRange: '05:36 – 13:36', startTime: '05:36', endTime: '13:36', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '753': { code: '753', label: '753班', timeRange: '10:19 – 18:19', startTime: '10:19', endTime: '18:19', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '754': { code: '754', label: '754班', timeRange: '12:03 – 20:03', startTime: '12:03', endTime: '20:03', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '755': { code: '755', label: '755班', timeRange: '05:19 – 13:19', startTime: '05:19', endTime: '13:19', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '761A': { code: '761A', label: '761A班', timeRange: '09:32 – 17:32', startTime: '09:32', endTime: '17:32', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  '762B': { code: '762B', label: '762B班', timeRange: '06:54 – 14:54', startTime: '06:54', endTime: '14:54', type: 'day', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'ri-sun-line' },
  'AG': { code: 'AG', label: '阿給', timeRange: '07:00 – 15:00', startTime: '07:00', endTime: '15:00', type: 'day', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200', icon: 'ri-run-line', hideStartTime: true },
  // === 休假 ===
  'OFF': { code: 'OFF', label: '休假', timeRange: '-', startTime: '-', endTime: '-', type: 'rest', color: 'text-stone-500', bgColor: 'bg-stone-50 border-stone-200', icon: 'ri-hotel-bed-line' },
};

/** 完整班序循環（點擊卡片時依此順序自動切換） */
export const USER_CYCLE_ORDER = [
  'OFF',   // 例假
  '718',   // 18:56
  'AG',    // 07:00
  '706',   // 10:17
  '708',   // 05:11
  '748',   // 15:27
  'AG',    // 07:00
  'OFF',   // 例假
  '717',   // 11:20
  '712',   // 05:34
  '701',   // 08:55
  'AG',    // 07:00
  'OFF',   // 例假
  '722',   // 14:31
  'AG',    // 07:00
  '754',   // 12:03
  '761A',  // 09:32
  '725',   // 10:47
  'AG',    // 07:00
  'OFF',   // 例假
  '723',   // 13:37
  'AG',    // 07:00
  '746',   // 08:28
  '715',   // 06:23
  '727',   // 12:39
  'AG',    // 07:00
  'OFF',   // 例假
  '711',   // 15:19
  'AG',    // 07:00
  '702',   // 09:55
  'AG',    // 07:00
  'OFF',   // 例假
  '720',   // 17:37
  'AG',    // 07:00
  '741',   // 11:11
  '713',   // 08:07
  '703',   // 12:00
  'AG',    // 07:00
  'OFF',   // 例假
  '705',   // 16:12
  'AG',    // 07:00
  '751',   // 10:39
  '762B',  // 06:54
  '709',   // 16:28
  'AG',    // 07:00
  'OFF',   // 例假
  '714',   // 12:23
  '719',   // 07:31
  '742',   // 14:52
  'AG',    // 07:00
  'OFF',   // 例假
  '730',   // 14:14
  'AG',    // 07:00
  '710',   // 09:26
  '752',   // 05:36
  '747',   // 14:22
  'AG',    // 07:00
  'OFF',   // 例假
  '732',   // 15:53
  '704',   // 09:14
  '707',   // 13:28
  'AG',    // 07:00
  'OFF',   // 例假
  '743',   // 16:05
  'AG',    // 07:00
  '724',   // 12:58
  '716',   // 08:27
  '726',   // 11:36
  'AG',    // 07:00
  'OFF',   // 例假
  '729',   // 15:13
  '755',   // 05:19
  '753',   // 10:19
  'AG',    // 07:00
];

/** 取得循環中的下一個班次代碼 */
export function getNextCycleShiftCode(currentCode: string | undefined): string {
  const code = currentCode || 'OFF';
  const idx = USER_CYCLE_ORDER.indexOf(code);
  if (idx === -1) return USER_CYCLE_ORDER[0];
  return USER_CYCLE_ORDER[(idx + 1) % USER_CYCLE_ORDER.length];
}

/** 根據班次代碼取得班次資訊 */
export function getShiftByCode(code: string | undefined): ShiftCodeInfo | null {
  if (!code) return null;
  return shiftCodeMap[code] || null;
}

/** 根據 ShiftType 取得預設班次代碼 */
export function getDefaultShiftCode(type: ShiftType): string {
  switch (type) {
    case 'day': return '701';
    case 'night': return '732';
    case 'rest': return 'OFF';
  }
}

/** 輪班週期（6天循環：白/白/夜/夜/休/休） */
const CYCLE: ShiftType[] = ['day', 'day', 'night', 'night', 'rest', 'rest'];

function getCycleIndex(group: 'A' | 'B', dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  // 以 2026-01-01 為第 0 天
  const base = new Date('2026-01-01T00:00:00').getTime();
  const diffMs = d.getTime() - base;
  const dayIndex = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  // A 組從第 0 天開始，B 組錯開 3 天
  const offset = group === 'A' ? 0 : 3;
  const index = (dayIndex + offset) % CYCLE.length;
  return index >= 0 ? index : (index + CYCLE.length) % CYCLE.length;
}

export function getShiftForDate(
  group: 'A' | 'B' | null,
  dateStr: string,
): ShiftInfo | null {
  if (!group) return null;
  const idx = getCycleIndex(group, dateStr);
  return shiftTypeMap[CYCLE[idx]];
}

/** 取得明天的日期字串 YYYY-MM-DD */
export function getTomorrowStr(): string {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** 取得今天的日期字串 YYYY-MM-DD */
export function getTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** 取得未來 7 天的排班資訊 */
const weekDayNames = ['日', '一', '二', '三', '四', '五', '六'];

export function getWeekShifts(
  group: 'A' | 'B' | null,
  fromDate: Date = new Date(),
): WeekShiftItem[] {
  if (!group) return [];
  const items: WeekShiftItem[] = [];
  const todayStr = getTodayStr();

  for (let i = 0; i < 8; i++) {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    items.push({
      dateStr,
      dayOfWeek: weekDayNames[d.getDay()],
      dayNum: d.getDate(),
      month: d.getMonth() + 1,
      shift: getShiftForDate(group, dateStr)!,
      isToday: dateStr === todayStr,
    });
  }

  return items;
}

// ===== 用戶自定義班表（允許員工自行修改） =====
const USER_SHIFT_STORAGE_KEY = 'user_custom_shifts';

export function getUserCustomShiftCodes(userId: string): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(USER_SHIFT_STORAGE_KEY);
    if (!raw) return {};
    const all = JSON.parse(raw) as Record<string, Record<string, string>>;
    return all[userId] || {};
  } catch {
    return {};
  }
}

/** 兼容舊版 ShiftType 數據 */
export function getUserCustomShifts(userId: string): Record<string, ShiftType> {
  const codes = getUserCustomShiftCodes(userId);
  const result: Record<string, ShiftType> = {};
  Object.entries(codes).forEach(([date, code]) => {
    const info = getShiftByCode(code);
    if (info) result[date] = info.type;
  });
  return result;
}

export function saveUserCustomShiftCode(userId: string, dateStr: string, shiftCode: string): void {
  if (typeof window === 'undefined') return;
  const all: Record<string, Record<string, string>> = {};
  try {
    const raw = localStorage.getItem(USER_SHIFT_STORAGE_KEY);
    if (raw) Object.assign(all, JSON.parse(raw));
  } catch { /* ignore */ }
  if (!all[userId]) all[userId] = {};
  all[userId][dateStr] = shiftCode;
  localStorage.setItem(USER_SHIFT_STORAGE_KEY, JSON.stringify(all));
}

export function removeUserCustomShift(userId: string, dateStr: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(USER_SHIFT_STORAGE_KEY);
    if (!raw) return;
    const all = JSON.parse(raw) as Record<string, Record<string, string>>;
    if (all[userId]) {
      delete all[userId][dateStr];
      localStorage.setItem(USER_SHIFT_STORAGE_KEY, JSON.stringify(all));
    }
  } catch { /* ignore */ }
}

export function resetUserCustomShifts(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(USER_SHIFT_STORAGE_KEY);
    if (!raw) return;
    const all = JSON.parse(raw) as Record<string, Record<string, string>>;
    delete all[userId];
    localStorage.setItem(USER_SHIFT_STORAGE_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

export function getUserWeekShifts(
  userId: string,
  group: 'A' | 'B' | null,
  fromDate: Date = new Date(),
): WeekShiftItem[] {
  if (!group) return [];
  const customCodes = getUserCustomShiftCodes(userId);
  const items: WeekShiftItem[] = [];
  const todayStr = getTodayStr();

  for (let i = 0; i < 8; i++) {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const customCode = customCodes[dateStr];
    let shift: ShiftInfo;
    if (customCode) {
      const codeInfo = getShiftByCode(customCode);
      shift = codeInfo
        ? {
            type: codeInfo.type,
            label: codeInfo.label,
            timeRange: codeInfo.timeRange,
            startTime: codeInfo.startTime,
            endTime: codeInfo.endTime,
            color: codeInfo.color,
            bgColor: codeInfo.bgColor,
            icon: codeInfo.icon,
            hideStartTime: codeInfo.hideStartTime,
          }
        : getShiftForDate(group, dateStr)!;
    } else {
      shift = getShiftForDate(group, dateStr)!;
    }
    items.push({
      dateStr,
      dayOfWeek: weekDayNames[d.getDay()],
      dayNum: d.getDate(),
      month: d.getMonth() + 1,
      shift,
      isToday: dateStr === todayStr,
    });
  }

  return items;
}

/** 檢查某天是否有自定義班表 */
export function hasUserCustomShift(userId: string, dateStr: string): boolean {
  const custom = getUserCustomShiftCodes(userId);
  return dateStr in custom;
}

/** 取得某天用戶自定義的班次代碼 */
export function getUserCustomShiftCode(userId: string, dateStr: string): string | undefined {
  const custom = getUserCustomShiftCodes(userId);
  return custom[dateStr];
}