import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx-js-style';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { useAuth } from '@/hooks/useAuth';
import { leaveTypes } from '@/mocks/leaveTypes';
import { getAllEmployees } from '@/mocks/employees';
import { getLeaveRequests, updateLeaveStatus, useLeaveStore, loadLeaveRequests } from '@/stores/leaveStore';
import { getShiftImages, updateShiftImages } from '@/stores/shiftImageStore';
import type { LeaveRequest } from '@/stores/leaveStore';

export default function AdminApprovalPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refresh: refreshLeaveStore } = useLeaveStore();

  // 每次進入頁面都重新從 Supabase 拉取最新資料
  useEffect(() => {
    loadLeaveRequests();
  }, []);

  const today = new Date();
  const calendarRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<'pending' | 'shiftImages' | 'export'>('pending');
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [comment, setComment] = useState('');
  const [actionType, setActionType] = useState<'approved' | 'rejected' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Export state
  const [exportYear, setExportYear] = useState(today.getFullYear());
  const [exportMonth, setExportMonth] = useState(today.getMonth() + 1);
  const [exporting, setExporting] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const [exportLightboxOpen, setExportLightboxOpen] = useState(false);
  const [exportLightboxScale, setExportLightboxScale] = useState(1);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Shift image management state
  const [imgYear, setImgYear] = useState(today.getFullYear());
  const [imgMonth, setImgMonth] = useState(today.getMonth() + 1);
  const [aGroupUrlInput, setAGroupUrlInput] = useState('');
  const [bGroupUrlInput, setBGroupUrlInput] = useState('');
  const [imageSaveMsg, setImageSaveMsg] = useState('');
  const [isShiftImageSaving, setIsShiftImageSaving] = useState(false);

  const [expandedTodaySection, setExpandedTodaySection] = useState(true);

  // Calendar view state for pending/processed tabs
  const [showCalendarView, setShowCalendarView] = useState(false);
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth() + 1);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [inlineReviewingId, setInlineReviewingId] = useState<string | null>(null);
  const [inlineProcessingId, setInlineProcessingId] = useState<string | null>(null);
  const [locallyReviewed, setLocallyReviewed] = useState<Record<string, 'approved' | 'rejected'>>({});
  const calendarMonthLabel = `${calendarYear} 年 ${calendarMonth} 月`;

  const monthLabel = `${imgYear} 年 ${imgMonth} 月`;
  const exportMonthLabel = `${exportYear} 年 ${exportMonth} 月`;

  const [expandedPendingDates, setExpandedPendingDates] = useState<Set<string>>(new Set());

  const togglePendingDate = (date: string) => {
    setExpandedPendingDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  const [expandedProcessedDates, setExpandedProcessedDates] = useState<Set<string>>(new Set());

  const toggleProcessedDate = (date: string) => {
    setExpandedProcessedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  // Reload images when month changes
  useEffect(() => {
    getShiftImages(imgYear, imgMonth).then((imgs) => {
      setAGroupUrlInput(imgs.aGroupUrl);
      setBGroupUrlInput(imgs.bGroupUrl);
    });
  }, [imgYear, imgMonth]);

  // Clear inline review state when tab or month changes
  useEffect(() => {
    setInlineReviewingId(null);
    setLocallyReviewed({});
  }, [activeTab, calendarYear, calendarMonth, showCalendarView]);

  function goImgPrevMonth() {
    if (imgMonth === 1) {
      setImgMonth(12);
      setImgYear(imgYear - 1);
    } else {
      setImgMonth(imgMonth - 1);
    }
  }

  function goImgNextMonth() {
    if (imgMonth === 12) {
      setImgMonth(1);
      setImgYear(imgYear + 1);
    } else {
      setImgMonth(imgMonth + 1);
    }
  }

  function goImgToday() {
    setImgYear(today.getFullYear());
    setImgMonth(today.getMonth() + 1);
  }

  // Export month navigation
  function goExportPrevMonth() {
    if (exportMonth === 1) {
      setExportMonth(12);
      setExportYear(exportYear - 1);
    } else {
      setExportMonth(exportMonth - 1);
    }
  }

  function goExportNextMonth() {
    if (exportMonth === 12) {
      setExportMonth(1);
      setExportYear(exportYear + 1);
    } else {
      setExportMonth(exportMonth + 1);
    }
  }

  function goExportToday() {
    setExportYear(today.getFullYear());
    setExportMonth(today.getMonth() + 1);
  }

  // Calendar view month navigation
  function goCalendarPrevMonth() {
    if (calendarMonth === 1) {
      setCalendarMonth(12);
      setCalendarYear(calendarYear - 1);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  }

  function goCalendarNextMonth() {
    if (calendarMonth === 12) {
      setCalendarMonth(1);
      setCalendarYear(calendarYear + 1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  }

  function goCalendarToday() {
    setCalendarYear(today.getFullYear());
    setCalendarMonth(today.getMonth() + 1);
  }

  function groupByDate(requests: LeaveRequest[]) {
    const groups: Record<string, LeaveRequest[]> = {};
    for (const req of requests) {
      const date = req.start_date;
      if (!groups[date]) groups[date] = [];
      groups[date].push(req);
    }
    // sort each group by created_at ascending, then sort dates ascending
    Object.values(groups).forEach((arr) => arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }

  function sortByLeaveType(a: LeaveRequest, b: LeaveRequest) {
    const aLast = a.leave_type === 'compensatory' || a.leave_type === 'annual';
    const bLast = b.leave_type === 'compensatory' || b.leave_type === 'annual';
    if (aLast && !bLast) return 1;
    if (!aLast && bLast) return -1;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  }

  function groupByMonth(requests: LeaveRequest[]) {
    const months: Record<string, Record<string, LeaveRequest[]>> = {};
    for (const req of requests) {
      const month = req.start_date.slice(0, 7); // "2026-05"
      const date = req.start_date;
      if (!months[month]) months[month] = {};
      if (!months[month][date]) months[month][date] = [];
      months[month][date].push(req);
    }
    // sort months descending (newest first)
    const sortedMonths = Object.entries(months).sort(([a], [b]) => b.localeCompare(a));
    return sortedMonths.map(([month, dates]) => {
      const sortedDates = Object.entries(dates).sort(([a], [b]) => a.localeCompare(b));
      sortedDates.forEach(([, arr]) => arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
      return [month, sortedDates] as [string, [string, LeaveRequest[]][]];
    });
  }

  const formatWeekday = (dateStr: string) => {
    const d = new Date(dateStr);
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return weekdays[d.getDay()];
  };

  const formatMonthLabel = (monthStr: string) => {
    const [y, m] = monthStr.split('-');
    return `${y} 年 ${m} 月`;
  };

  const [expandedPendingMonths, setExpandedPendingMonths] = useState<Set<string>>(new Set());
  const togglePendingMonth = (month: string) => {
    setExpandedPendingMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  };

  const [expandedProcessedMonths, setExpandedProcessedMonths] = useState<Set<string>>(new Set());
  const toggleProcessedMonth = (month: string) => {
    setExpandedProcessedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  };

  // Export monthly leave list to Excel — calendar + detail sheets
  function handleExportExcel() {
    const allRequests = getLeaveRequests();
    const monthPrefix = `${exportYear}-${String(exportMonth).padStart(2, '0')}`;
    const monthRequests = allRequests.filter(
      (r) => r.start_date.startsWith(monthPrefix) && r.status !== 'cancelled'
    );

    if (monthRequests.length === 0) {
      alert(`${exportMonthLabel} 沒有請假紀錄`);
      return;
    }

    setExporting(true);

    const wb = XLSX.utils.book_new();

    const thinBorder = {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    };

    const mediumBorder = {
      top: { style: 'medium', color: { rgb: '000000' } },
      bottom: { style: 'medium', color: { rgb: '000000' } },
      left: { style: 'medium', color: { rgb: '000000' } },
      right: { style: 'medium', color: { rgb: '000000' } },
    };

    // ========== Sheet 1: 月曆總表 ==========
    const daysInMonth = new Date(exportYear, exportMonth, 0).getDate();
    const firstWeekday = new Date(exportYear, exportMonth - 1, 1).getDay(); // 0=Sun
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const COLS_PER_DAY = 4; // 序號 / 姓名 / 假別 / 工作班
    const TOTAL_COLS = 7 * COLS_PER_DAY; // 28

    const rows: (string | number)[][] = [];
    const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
    // 記錄每天區塊的座標，用於加粗邊框
    const dayRegions: { startRow: number; endRow: number; startCol: number; endCol: number }[] = [];

    // 大標題行：年與月合併顯示（字體加大）
    const titleRow: (string | number)[] = new Array(TOTAL_COLS).fill('');
    titleRow[0] = `${exportYear}年${String(exportMonth).padStart(2, '0')}月`;
    rows.push(titleRow);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: TOTAL_COLS - 1 } });

    // 空行分隔
    rows.push(new Array(TOTAL_COLS).fill(''));

    const totalWeeks = Math.ceil((firstWeekday + daysInMonth) / 7);

    for (let week = 0; week < totalWeeks; week++) {
      const weekStartRow = rows.length;

      // 組裝這週的 7 天資料
      const weekData: {
        dayNum: number | null;
        weekdayName: string;
        dateStr: string | null;
        requests: LeaveRequest[];
      }[] = [];

      for (let w = 0; w < 7; w++) {
        const dayNum = week * 7 + w - firstWeekday + 1;
        if (dayNum >= 1 && dayNum <= daysInMonth) {
          const dateStr = `${exportYear}-${String(exportMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          // 用實際 Date 物件取得正確星期幾，避免計算錯誤
          const actualDate = new Date(exportYear, exportMonth - 1, dayNum);
          const actualWeekday = actualDate.getDay(); // 0=Sun..6=Sat
          weekData.push({
            dayNum,
            weekdayName: weekdays[actualWeekday],
            dateStr,
            requests: monthRequests
              .filter((r) => {
                const reqDate = r.start_date ? r.start_date.split('T')[0] : '';
                return reqDate === dateStr;
              })
              .sort((a, b) => a.employee_name.localeCompare(b.employee_name, 'zh-Hant')),
          });
        } else {
          weekData.push({ dayNum: null, weekdayName: '', dateStr: null, requests: [] });
        }
      }

      // 日期標題行（合併每天 4 列）
      const dateHeaderRow: (string | number)[] = new Array(TOTAL_COLS).fill('');
      weekData.forEach((d, idx) => {
        const startCol = idx * COLS_PER_DAY;
        if (d.dayNum !== null) {
          dateHeaderRow[startCol] = `${d.dayNum}  週${d.weekdayName}`;
        }
        merges.push({
          s: { r: rows.length, c: startCol },
          e: { r: rows.length, c: startCol + COLS_PER_DAY - 1 },
        });
      });
      rows.push(dateHeaderRow);

      // 小表頭行：序號 / 姓名 / 假別 / 工作班
      const subHeaderRow: (string | number)[] = new Array(TOTAL_COLS).fill('');
      for (let d = 0; d < 7; d++) {
        const startCol = d * COLS_PER_DAY;
        subHeaderRow[startCol] = '序號';
        subHeaderRow[startCol + 1] = '姓名';
        subHeaderRow[startCol + 2] = '假別';
        subHeaderRow[startCol + 3] = '工作班';
      }
      rows.push(subHeaderRow);

      // 數據行：每天固定 12 行，序號自動填 1~12
      const maxDataRows = 12;
      for (let r = 0; r < maxDataRows; r++) {
        const dataRow: (string | number)[] = new Array(TOTAL_COLS).fill('');
        weekData.forEach((d, idx) => {
          const startCol = idx * COLS_PER_DAY;
          const req = d.requests[r];
          dataRow[startCol] = r + 1; // 序號固定填 1~12
          if (req) {
            const typeInfo = leaveTypes.find((t) => t.id === req.leave_type);
            dataRow[startCol + 1] = req.employee_name; // 姓名
            dataRow[startCol + 2] = typeInfo?.name || req.leave_type_name; // 假別
            dataRow[startCol + 3] = req.work_shift || '-'; // 工作班
          }
        });
        rows.push(dataRow);
      }

      const weekEndRow = rows.length - 1;

      // 記錄這週 7 天的區塊座標
      for (let d = 0; d < 7; d++) {
        const startCol = d * COLS_PER_DAY;
        dayRegions.push({
          startRow: weekStartRow,
          endRow: weekEndRow,
          startCol,
          endCol: startCol + COLS_PER_DAY - 1,
        });
      }

      // 週與週之間空行
      rows.push(new Array(TOTAL_COLS).fill(''));
    }

    const wsCalendar = XLSX.utils.aoa_to_sheet(rows);
    wsCalendar['!cols'] = Array(TOTAL_COLS).fill(null).map((_, i) => {
      if (i % COLS_PER_DAY === 0) return { wch: 6 };   // 序號欄窄一點
      if (i % COLS_PER_DAY === 1) return { wch: 12 };  // 姓名
      return { wch: 10 };
    });

    // 設置所有儲存格：置中 + 標楷體 + 全細線邊框
    const calRange = XLSX.utils.decode_range(wsCalendar['!ref'] || 'A1');
    for (let R = calRange.s.r; R <= calRange.e.r; ++R) {
      for (let C = calRange.s.c; C <= calRange.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        if (!wsCalendar[cellRef]) wsCalendar[cellRef] = { v: '' };

        // 年月標題行（R=0）字體加大加粗
        const isTitleRow = R === 0;

        wsCalendar[cellRef].s = {
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          font: {
            name: '標楷體',
            sz: isTitleRow ? 16 : 11,
            bold: isTitleRow,
          },
          border: thinBorder,
        };
      }
    }

    wsCalendar['!merges'] = merges;
    XLSX.utils.book_append_sheet(wb, wsCalendar, '月曆總表');

    // ========== Sheet 2: 詳細列表 ==========
    const grouped = groupByDate(monthRequests);
    const detailRows: Record<string, string | number>[] = [];

    grouped.forEach(([date, reqs]) => {
      detailRows.push({
        序號: '',
        員工姓名: `${date}（星期${formatWeekday(date)}）`,
        員工代號: '',
        職稱: '',
        組別: '',
        假別: '',
        工作班: '',
        開始日期: '',
        結束日期: '',
        天數: '',
        事由: '',
        狀態: '',
        申請時間: '',
        審核意見: '',
      });

      reqs.forEach((req) => {
        const emp = getEmployeeInfo(req.employee_id);
        const typeInfo = leaveTypes.find((t) => t.id === req.leave_type);
        const statusMap: Record<string, string> = {
          pending: '待審核',
          approved: '已核准',
          rejected: '已駁回',
          cancelled: '已取消',
        };
        const createdAt = new Date(req.created_at).toLocaleString('zh-TW', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
        detailRows.push({
          序號: detailRows.filter((r) => r.假別 !== '').length + 1,
          員工姓名: req.employee_name,
          員工代號: emp?.employee_code || '-',
          職稱: emp?.title || '-',
          組別: emp?.group || '-',
          假別: typeInfo?.name || req.leave_type_name,
          工作班: req.work_shift || '-',
          開始日期: req.start_date,
          結束日期: req.end_date,
          天數: req.days_count,
          事由: req.reason,
          狀態: statusMap[req.status] || req.status,
          申請時間: createdAt,
          審核意見: req.approver_comment || '-',
        });
      });

      detailRows.push({
        序號: '',
        員工姓名: '',
        員工代號: '',
        職稱: '',
        組別: '',
        假別: '',
        工作班: '',
        開始日期: '',
        結束日期: '',
        天數: '',
        事由: '',
        狀態: '',
        申請時間: '',
        審核意見: '',
      });
    });

    const wsDetail = XLSX.utils.json_to_sheet(detailRows);
    wsDetail['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 12 },
      { wch: 10 },
      { wch: 8 },
      { wch: 12 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
      { wch: 8 },
      { wch: 30 },
      { wch: 10 },
      { wch: 18 },
      { wch: 20 },
    ];

    // 詳細列表也加上置中 + 標楷體 + 黑色細邊框
    const detailRange = XLSX.utils.decode_range(wsDetail['!ref'] || 'A1');
    for (let R = detailRange.s.r; R <= detailRange.e.r; ++R) {
      for (let C = detailRange.s.c; C <= detailRange.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        if (!wsDetail[cellRef]) wsDetail[cellRef] = { v: '' };
        wsDetail[cellRef].s = {
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          font: { name: '標楷體', sz: 11 },
          border: thinBorder,
        };
      }
    }

    XLSX.utils.book_append_sheet(wb, wsDetail, '詳細列表');

    const fileName = `請假名單_${exportYear}${String(exportMonth).padStart(2, '0')}.xlsx`;
    XLSX.writeFile(wb, fileName);

    setTimeout(() => setExporting(false), 500);
  }

  async function handleExportPDF() {
    const monthPrefix = `${exportYear}-${String(exportMonth).padStart(2, '0')}`;
    const monthRequests = getLeaveRequests().filter(
      (r) => r.start_date.startsWith(monthPrefix) && r.status !== 'cancelled'
    );

    if (monthRequests.length === 0) {
      alert(`${exportMonthLabel} 沒有請假紀錄`);
      return;
    }

    if (!calendarRef.current) {
      alert('預覽區尚未載入');
      return;
    }

    setPdfExporting(true);
    try {
      const dataUrl = await toPng(calendarRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 5;
      const contentWidth = pdfWidth - margin * 2;
      const titleHeight = 12;

      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve) => { img.onload = () => resolve(); });

      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;
      const scale = contentWidth / imgWidth;
      const scaledHeight = imgHeight * scale;
      const contentHeight = pdfHeight - margin * 2 - titleHeight;

      const title = `${exportYear}年${String(exportMonth).padStart(2, '0')}月 請假排班表`;

      if (scaledHeight <= contentHeight) {
        // Fits on one page
        pdf.setFontSize(14);
        pdf.text(title, pdfWidth / 2, 10, { align: 'center' });
        pdf.addImage(dataUrl, 'PNG', margin, titleHeight, contentWidth, scaledHeight);
      } else {
        // Multi-page: split image into page-sized chunks
        const fullCanvas = document.createElement('canvas');
        fullCanvas.width = imgWidth;
        fullCanvas.height = imgHeight;
        const fullCtx = fullCanvas.getContext('2d');
        fullCtx?.drawImage(img, 0, 0);

        const totalPages = Math.ceil(scaledHeight / contentHeight);

        for (let page = 0; page < totalPages; page++) {
          if (page > 0) pdf.addPage();

          pdf.setFontSize(12);
          pdf.text(title, pdfWidth / 2, 8, { align: 'center' });

          const sourceY = page * (contentHeight / scale);
          const sourceHeight = Math.min(contentHeight / scale, imgHeight - sourceY);
          const destHeight = sourceHeight * scale;

          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = imgWidth;
          pageCanvas.height = sourceHeight;
          const pageCtx = pageCanvas.getContext('2d');
          pageCtx?.drawImage(fullCanvas, 0, sourceY, imgWidth, sourceHeight, 0, 0, imgWidth, sourceHeight);

          const pageDataUrl = pageCanvas.toDataURL('image/png');
          pdf.addImage(pageDataUrl, 'PNG', margin, titleHeight - 2, contentWidth, destHeight);
        }
      }

      const fileName = `請假名單_${exportYear}${String(exportMonth).padStart(2, '0')}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('PDF 導出失敗:', err);
      alert('PDF 導出失敗，請重試');
    } finally {
      setPdfExporting(false);
    }
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

  const allRequests = getLeaveRequests();
  const pendingRequests = allRequests.filter((r) => r.status === 'pending');
  const processedRequests = allRequests.filter((r) => r.status !== 'pending');

  // 今日申請（待審核中今天提交的）
  const todayStr = new Date().toISOString().split('T')[0];
  const todayRequests = pendingRequests.filter((r) => {
    const reqDate = r.created_at.split('T')[0];
    return reqDate === todayStr;
  });

  const sortedPending = [...pendingRequests].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const sortedProcessed = [...processedRequests].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  const getEmployeeInfo = (employeeId: string) => {
    return getAllEmployees().find((e) => e.id === employeeId);
  };

  const formatDateTime = (isoString: string) => {
    const d = new Date(isoString);
    return {
      date: d.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' }),
      time: d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
      full: d.toLocaleString('zh-TW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'short',
      }),
    };
  };

  const handleApprove = async () => {
    if (!selectedRequest || !user || !actionType) return;
    setSubmitting(true);
    try {
      await updateLeaveStatus(selectedRequest.id, actionType, user.id, comment.trim());
      setSubmitting(false);
      setSelectedRequest(null);
      setComment('');
      setActionType(null);
    } catch (err) {
      setSubmitting(false);
      console.error('審核失敗:', err);
    }
  };

  const openDetail = (req: LeaveRequest, action: 'approved' | 'rejected' | null) => {
    setSelectedRequest(req);
    setActionType(action);
    setComment('');
  };

  const handleInlineAction = async (req: LeaveRequest, action: 'approved' | 'rejected') => {
    if (!user) return;
    setInlineProcessingId(req.id);
    try {
      await updateLeaveStatus(req.id, action, user.id, '');
      setLocallyReviewed(prev => ({ ...prev, [req.id]: action }));
    } catch (err) {
      console.error('審核失敗:', err);
    } finally {
      setInlineProcessingId(null);
      setInlineReviewingId(null);
    }
  };

  const closeDetail = () => {
    setSelectedRequest(null);
    setComment('');
    setActionType(null);
  };

  const handleSaveShiftImages = async () => {
    setIsShiftImageSaving(true);
    setImageSaveMsg('');
    try {
      const updated = await updateShiftImages(imgYear, imgMonth, {
        aGroupUrl: (aGroupUrlInput ?? '').trim(),
        bGroupUrl: (bGroupUrlInput ?? '').trim(),
      });
      setAGroupUrlInput(updated.aGroupUrl);
      setBGroupUrlInput(updated.bGroupUrl);
      setImageSaveMsg('儲存成功！');
      setTimeout(() => setImageSaveMsg(''), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '儲存異常';
      setImageSaveMsg('儲存失敗：' + msg);
      console.error('儲存班表圖片失敗', err);
    } finally {
      setIsShiftImageSaving(false);
    }
  };

  const statusConfig: Record<string, { label: string; color: string; dot: string; bg: string }> = {
    pending: { label: t('pending'), color: 'text-amber-700', dot: 'bg-amber-500', bg: 'bg-amber-50 border-amber-200' },
    approved: { label: t('approved'), color: 'text-emerald-700', dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-200' },
    rejected: { label: t('rejected'), color: 'text-red-700', dot: 'bg-red-500', bg: 'bg-red-50 border-red-200' },
    cancelled: { label: '已取消', color: 'text-stone-500', dot: 'bg-stone-400', bg: 'bg-stone-100 border-stone-200' },
  };

  const renderRequestCard = (req: LeaveRequest, showActions: boolean) => {
    const status = statusConfig[req.status];
    const typeInfo = leaveTypes.find((t) => t.id === req.leave_type);
    const empInfo = getEmployeeInfo(req.employee_id);
    const dt = formatDateTime(req.created_at);

    return (
      <div key={req.id} className="bg-white rounded-xl p-4 border border-stone-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-stone-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-stone-600">
                {req.employee_name.charAt(0)}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-stone-800">{req.employee_name}</p>
              <p className="text-[10px] text-stone-400">
                {empInfo?.title} · {empInfo?.employee_code}
              </p>
            </div>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${status.bg} ${status.color}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${status.dot} mr-1`} />
            {status.label}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${typeInfo?.color}`}>
            <i className={`${typeInfo?.icon} text-xs`} />
          </div>
          <div>
            <p className="text-sm font-medium text-stone-700">{typeInfo?.name}</p>
            <p className="text-xs text-stone-500">
              {req.start_date}
            </p>
          </div>
        </div>

        {req.work_shift && (
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-5 h-5 rounded flex items-center justify-center bg-stone-100">
              <i className="ri-briefcase-line text-[10px] text-stone-500" />
            </div>
            <span className="text-xs text-stone-500">當天工作班：{req.work_shift}</span>
          </div>
        )}

        <p className="text-xs text-stone-500 mt-2.5 bg-stone-50 rounded-lg px-3 py-2">
          {req.reason}
        </p>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-stone-100">
          <span className="text-[10px] text-stone-400">
            申請時間：{dt.date} {dt.time}
          </span>
          {showActions ? (
            <div className="flex gap-2">
              <button
                onClick={() => openDetail(req, 'rejected')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
              >
                {t('reject')}
              </button>
              <button
                onClick={() => openDetail(req, 'approved')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
              >
                {t('approve')}
              </button>
            </div>
          ) : req.approver_comment ? (
            <span className="text-[10px] text-stone-400 truncate max-w-[180px]">
              意見：{req.approver_comment}
            </span>
          ) : null}
        </div>
      </div>
    );
  };

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
        <div className="flex-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-stone-800">{t('approval')}</h1>
            {pendingRequests.length > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingRequests.length}
              </span>
            )}
          </div>
          <button
            onClick={() => navigate('/admin/employees')}
            className="flex items-center gap-1 text-xs font-medium text-sky-600 bg-sky-50 hover:bg-sky-100 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            <i className="ri-team-line" />
            員工管理
          </button>
          <button
            onClick={() => navigate('/admin/announcements')}
            className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            <i className="ri-image-line" />
            公告管理
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* 今日申請人員 */}
        {todayRequests.length > 0 && activeTab !== 'shiftImages' && activeTab !== 'export' && (
          <div className="mb-4">
            <button
              onClick={() => setExpandedTodaySection((v) => !v)}
              className="w-full flex items-center gap-2 mb-2 text-left cursor-pointer group"
            >
              <i className="ri-notification-3-line text-amber-500 text-sm" />
              <h2 className="text-sm font-semibold text-stone-700">今日申請人員</h2>
              <span className="text-xs text-stone-400">({todayRequests.length} 人)</span>
              <div className="w-5 h-5 flex items-center justify-center ml-auto">
                <i className={`ri-arrow-down-s-line text-stone-400 transition-transform duration-200 ${expandedTodaySection ? '' : '-rotate-90'}`} />
              </div>
            </button>

            {expandedTodaySection && (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {todayRequests.map((req) => {
                  const dt = formatDateTime(req.created_at);
                  const typeInfo = leaveTypes.find((t) => t.id === req.leave_type);
                  const reqStatus = statusConfig[req.status];
                  return (
                    <div
                      key={req.id}
                      className="flex-shrink-0 bg-white rounded-xl p-3 border border-stone-100 min-w-[200px]"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                            <span className="text-xs font-bold text-amber-700">
                              {req.employee_name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-stone-800">{req.employee_name}</p>
                            <p className="text-[10px] text-stone-400">{dt.time}</p>
                          </div>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${reqStatus.bg} ${reqStatus.color}`}>
                          <span className={`inline-block w-1 h-1 rounded-full ${reqStatus.dot} mr-0.5`} />
                          {reqStatus.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-5 h-5 rounded flex items-center justify-center ${typeInfo?.color}`}>
                          <i className={`${typeInfo?.icon} text-[10px]`} />
                        </div>
                        <span className="text-[11px] text-stone-600">{typeInfo?.name}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-stone-100 rounded-xl p-1 mb-4">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'pending'
                ? 'bg-white text-stone-800 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            審核
            <span className={`ml-1 text-xs ${activeTab === 'pending' ? 'text-stone-400' : 'text-stone-400'}`}>
              ({pendingRequests.length})
            </span>
          </button>
          <button
            onClick={() => setActiveTab('shiftImages')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'shiftImages'
                ? 'bg-white text-stone-800 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <span className="flex items-center justify-center gap-1">
              <i className="ri-image-line text-xs" />
              班表圖片
            </span>
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'export'
                ? 'bg-white text-stone-800 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <span className="flex items-center justify-center gap-1">
              <i className="ri-file-excel-line text-xs" />
              導出名單
            </span>
          </button>
        </div>

        {/* Shift Images Management Tab */}
        {activeTab === 'shiftImages' && (
          <div className="space-y-4">
            {/* Month navigator for shift images */}
            <div className="bg-white rounded-xl border border-stone-100 px-4 py-3 flex items-center justify-between">
              <button
                onClick={goImgPrevMonth}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-stone-50 transition-colors"
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-arrow-left-s-line text-lg text-stone-600" />
                </div>
              </button>
              <div className="text-center">
                <p className="text-base font-bold text-stone-800">{monthLabel}</p>
                <p className="text-[10px] text-stone-400 mt-0.5">切換月份來管理上傳不同月份的圖片</p>
              </div>
              <button
                onClick={goImgNextMonth}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-stone-50 transition-colors"
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-arrow-right-s-line text-lg text-stone-600" />
                </div>
              </button>
            </div>

            <div className="bg-white rounded-xl border border-stone-100 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center">
                    <i className="ri-image-line text-teal-600 text-sm" />
                  </div>
                  <h2 className="text-sm font-bold text-stone-800">班表圖片管理</h2>
                </div>
                <button
                  onClick={goImgToday}
                  className="text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
                >
                  回到本月
                </button>
              </div>
              <p className="text-xs text-stone-400">
                請貼上 Google Drive 圖片連結，系統會自動顯示預覽並儲存。
              </p>

              {/* A Group Image */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-stone-600">A 組班表圖片</label>
                <input
                  type="text"
                  value={aGroupUrlInput}
                  onChange={(e) => setAGroupUrlInput(e.target.value)}
                  placeholder="貼上 Google Drive 圖片連結"
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
                {aGroupUrlInput && (
                  <div className="rounded-lg overflow-hidden border border-stone-100 mt-2">
                    <img
                      src={aGroupUrlInput}
                      alt="A 組班表預覽"
                      className="w-full h-40 object-contain bg-stone-50"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                )}
              </div>

              {/* B Group Image */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-stone-600">B 組班表圖片</label>
                <input
                  type="text"
                  value={bGroupUrlInput}
                  onChange={(e) => setBGroupUrlInput(e.target.value)}
                  placeholder="貼上 Google Drive 圖片連結"
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
                {bGroupUrlInput && (
                  <div className="rounded-lg overflow-hidden border border-stone-100 mt-2">
                    <img
                      src={bGroupUrlInput}
                      alt="B 組班表預覽"
                      className="w-full h-40 object-contain bg-stone-50"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                )}
              </div>

              <button
                onClick={handleSaveShiftImages}
                disabled={isShiftImageSaving}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 disabled:bg-teal-400"
              >
                {isShiftImageSaving ? (
                  <>
                    <i className="ri-loader-4-line animate-spin" />
                    儲存中...
                  </>
                ) : (
                  <>
                    <i className="ri-save-line" />
                    儲存 {monthLabel} 圖片設定
                  </>
                )}
              </button>

              {imageSaveMsg && (
                <p className="text-xs text-emerald-600 text-center font-medium">{imageSaveMsg}</p>
              )}
            </div>
          </div>
        )}

        {/* Export Monthly Leave List Tab */}
        {activeTab === 'export' && (
          <div className="space-y-4">
            {/* Month navigator for export */}
            <div className="bg-white rounded-xl border border-stone-100 px-4 py-3 flex items-center justify-between">
              <button
                onClick={goExportPrevMonth}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-stone-50 transition-colors"
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-arrow-left-s-line text-lg text-stone-600" />
                </div>
              </button>
              <div className="text-center">
                <p className="text-base font-bold text-stone-800">{exportMonthLabel}</p>
                <p className="text-[10px] text-stone-400 mt-0.5">選擇要導出的月份</p>
              </div>
              <button
                onClick={goExportNextMonth}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-stone-50 transition-colors"
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-arrow-right-s-line text-lg text-stone-600" />
                </div>
              </button>
            </div>

            {/* Preview Calendar Grid */}
            {(() => {
              const monthPrefix = `${exportYear}-${String(exportMonth).padStart(2, '0')}`;
              const monthRequests = getLeaveRequests().filter(
                (r) => r.start_date.startsWith(monthPrefix) && r.status !== 'cancelled'
              );
              const daysInMonth = new Date(exportYear, exportMonth, 0).getDate();
              const firstWeekday = new Date(exportYear, exportMonth - 1, 1).getDay();
              const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
              const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

              return (
                <div
                  className="bg-white rounded-xl border border-stone-100 p-4 space-y-3 md:cursor-pointer md:group relative"
                  onClick={() => { if (window.innerWidth >= 768) setExportLightboxOpen(true); }}
                >
                  {/* 電腦版全螢幕提示 */}
                  <div className="hidden md:block absolute top-3 right-3 z-10 opacity-0 md:group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="bg-black/60 text-white text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                      <i className="ri-fullscreen-line" />
                      點擊放大
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-stone-100 flex items-center justify-center">
                        <i className="ri-table-line text-stone-600 text-sm" />
                      </div>
                      <h2 className="text-sm font-bold text-stone-800">預覽排班表</h2>
                    </div>
                    {/* 縮放控制 - 僅電腦版顯示 */}
                    <div className="hidden md:flex items-center gap-1 bg-stone-100 rounded-lg p-0.5">
                      <button
                        onClick={() => setPreviewScale((s) => Math.max(0.4, s - 0.1))}
                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white hover:shadow-sm transition-all text-stone-600"
                        title="縮小"
                      >
                        <i className="ri-zoom-out-line text-sm" />
                      </button>
                      <span className="text-xs font-mono font-medium text-stone-600 min-w-[2.5rem] text-center">
                        {Math.round(previewScale * 100)}%
                      </span>
                      <button
                        onClick={() => setPreviewScale((s) => Math.min(3, s + 0.1))}
                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white hover:shadow-sm transition-all text-stone-600"
                        title="放大"
                      >
                        <i className="ri-zoom-in-line text-sm" />
                      </button>
                      <button
                        onClick={() => setPreviewScale(1)}
                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white hover:shadow-sm transition-all text-stone-400"
                        title="重置"
                      >
                        <i className="ri-fullscreen-line text-xs" />
                      </button>
                    </div>
                  </div>

                  <div
                    className="overflow-auto"
                    style={{ fontFamily: '"DFKai-SB", "BiauKai", "標楷體", "KaiTi", serif' }}
                    onWheel={(e) => {
                      if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        const delta = e.deltaY > 0 ? -0.05 : 0.05;
                        setPreviewScale((s) => Math.min(3, Math.max(0.4, s + delta)));
                      }
                    }}
                  >
                    <div ref={calendarRef} className="min-w-[1050px] text-center" style={{ transform: `scale(${previewScale})`, transformOrigin: 'top left', width: `${100 / previewScale}%` }}>
                      {/* Weekday headers */}
                      <div className="grid grid-cols-7 gap-0">
                        {weekdays.map((w) => (
                          <div key={w} className={`text-center text-sm font-medium text-stone-600 py-1.5 border border-black ${w === '日' || w === '六' ? 'bg-stone-200/70' : 'bg-stone-50'}`}>
                            {w}
                          </div>
                        ))}
                      </div>

                      {/* Calendar grid */}
                      <div className="grid grid-cols-7 gap-0">
                        {Array.from({ length: totalCells }).map((_, idx) => {
                          const dayNum = idx - firstWeekday + 1;
                          const isWeekend = idx % 7 === 0 || idx % 7 === 6;
                          if (dayNum < 1 || dayNum > daysInMonth) {
                            return <div key={idx} className={`border border-black min-h-[180px] ${isWeekend ? 'bg-stone-100/70' : 'bg-stone-50/40'}`} />;
                          }
                          const dateStr = `${exportYear}-${String(exportMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                          const dayRequests = monthRequests
                            .filter((r) => r.start_date === dateStr)
                            .sort(sortByLeaveType)
                            .slice(0, 12); // 最多顯示 12 筆
                          return (
                            <div key={idx} className={`border border-black p-2 min-h-[420px] flex flex-col ${isWeekend ? 'bg-stone-50/80' : 'bg-white'}`}>
                              <div className="text-sm font-bold text-stone-700 mb-2 text-center border-b border-black pb-1">
                                {dayNum} <span className="text-stone-400 font-normal text-xs">週{weekdays[idx % 7]}</span>
                              </div>
                              {/* 表頭：序號 / 姓名 / 假別 / 工作班 / 審核 */}
                              <div className="grid grid-cols-[24px_1fr_1fr_1fr_32px] gap-0.5 text-[10px] text-stone-500 border-b border-stone-200 pb-0.5 mb-1">
                                <div className="text-center">序</div>
                                <div className="text-center">姓名</div>
                                <div className="text-center">假別</div>
                                <div className="text-center">工作班</div>
                                <div className="text-center">審核</div>
                              </div>
                              <div className="flex-1 space-y-0">
                                {Array.from({ length: 12 }).map((_, rowIdx) => {
                                  const req = dayRequests[rowIdx];
                                  const typeInfo = req ? leaveTypes.find((t) => t.id === req.leave_type) : null;
                                  return (
                                    <div key={rowIdx} className="grid grid-cols-[24px_1fr_1fr_1fr_32px] gap-0.5 text-[11px] leading-tight py-0.5 border-b border-dashed border-stone-100">
                                      <div className="text-center text-stone-400">{rowIdx + 1}</div>
                                      <div className="text-center truncate text-stone-700">{req ? req.employee_name : ''}</div>
                                      <div className="text-center truncate text-stone-500">{req ? (typeInfo?.name || req.leave_type_name) : ''}</div>
                                      <div className="text-center truncate text-stone-500">{req ? (req.work_shift || '-') : ''}</div>
                                      <div className="text-center">
                                        {req ? (
                                          req.status === 'approved' ? (
                                            <span className="text-emerald-600 font-bold text-xs" title="已核准">✓</span>
                                          ) : req.status === 'rejected' ? (
                                            <span className="text-red-500 font-bold text-xs" title="已駁回">✗</span>
                                          ) : req.status === 'pending' ? (
                                            <span className="text-amber-500 font-bold text-xs" title="待審核">⏳</span>
                                          ) : (
                                            <span className="text-stone-300 font-bold text-xs" title="已取消">—</span>
                                          )
                                        ) : ''}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <p className="hidden md:block text-[10px] text-stone-400 text-right">按住 Ctrl + 滾輪可縮放 · 拖曳捲軸可瀏覽</p>
                </div>
              );
            })()}

            <div className="bg-white rounded-xl border border-stone-100 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <i className="ri-file-excel-line text-emerald-600 text-sm" />
                  </div>
                  <h2 className="text-sm font-bold text-stone-800">導出每月請假名單</h2>
                </div>
                <button
                  onClick={goExportToday}
                  className="text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
                >
                  回到本月
                </button>
              </div>

              <p className="text-xs text-stone-400">
                選擇月份後點擊「導出 Excel」，系統會將該月所有請假紀錄下載為 Excel 檔案。
              </p>

              {/* Preview count */}
              {(() => {
                const monthPrefix = `${exportYear}-${String(exportMonth).padStart(2, '0')}`;
                const monthRequests = getLeaveRequests().filter(
                  (r) => r.start_date.startsWith(monthPrefix) && r.status !== 'cancelled'
                );
                return (
                  <div className="bg-stone-50 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <i className="ri-calendar-line text-stone-400 text-sm" />
                      <span className="text-sm text-stone-600">{exportMonthLabel} 請假紀錄</span>
                    </div>
                    <span className="text-sm font-bold text-stone-800">{monthRequests.length} 筆</span>
                  </div>
                );
              })()}

              <div className="flex gap-2">
                <button
                  onClick={handleExportPDF}
                  disabled={pdfExporting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center gap-2 disabled:bg-red-300"
                >
                  {pdfExporting ? (
                    <>
                      <i className="ri-loader-4-line animate-spin" />
                      導出中...
                    </>
                  ) : (
                    <>
                      <i className="ri-file-pdf-line" />
                      導出 PDF
                    </>
                  )}
                </button>
                <button
                  onClick={handleExportExcel}
                  disabled={exporting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:bg-emerald-400"
                >
                  {exporting ? (
                    <>
                      <i className="ri-loader-4-line animate-spin" />
                      導出中...
                    </>
                  ) : (
                    <>
                      <i className="ri-download-line" />
                      導出 Excel
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Export Full-screen Lightbox (Desktop) */}
        {exportLightboxOpen && (
          <div
            className="fixed inset-0 bg-black/70 z-[60] hidden md:flex items-center justify-center p-4"
            onClick={() => { setExportLightboxOpen(false); setExportLightboxScale(1); }}
          >
            <div
              className="bg-white rounded-2xl overflow-hidden w-full max-w-[96vw] max-h-[95vh] flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Lightbox header */}
              <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={goExportPrevMonth}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 transition-colors"
                  >
                    <i className="ri-arrow-left-s-line text-lg text-stone-600" />
                  </button>
                  <h2 className="text-base font-bold text-stone-800">{exportMonthLabel} 預覽排班表</h2>
                  <button
                    onClick={goExportNextMonth}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 transition-colors"
                  >
                    <i className="ri-arrow-right-s-line text-lg text-stone-600" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {/* 縮放控制 */}
                  <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-0.5">
                    <button
                      onClick={() => setExportLightboxScale((s) => Math.max(0.3, s - 0.1))}
                      className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white transition-all text-stone-600"
                      title="縮小"
                    >
                      <i className="ri-zoom-out-line text-sm" />
                    </button>
                    <span className="text-xs font-mono font-medium text-stone-600 min-w-[2.5rem] text-center">
                      {Math.round(exportLightboxScale * 100)}%
                    </span>
                    <button
                      onClick={() => setExportLightboxScale((s) => Math.min(3, s + 0.1))}
                      className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white transition-all text-stone-600"
                      title="放大"
                    >
                      <i className="ri-zoom-in-line text-sm" />
                    </button>
                    <button
                      onClick={() => setExportLightboxScale(1)}
                      className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white transition-all text-stone-400"
                      title="重置"
                    >
                      <i className="ri-fullscreen-line text-xs" />
                    </button>
                  </div>
                  <button
                    onClick={() => { setExportLightboxOpen(false); setExportLightboxScale(1); }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 transition-colors text-stone-500"
                  >
                    <i className="ri-close-line text-xl" />
                  </button>
                </div>
              </div>

              {/* Lightbox calendar content */}
              <div
                className="flex-1 overflow-auto p-4"
                style={{ fontFamily: '"DFKai-SB", "BiauKai", "標楷體", "KaiTi", serif' }}
                onWheel={(e) => {
                  if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    const delta = e.deltaY > 0 ? -0.05 : 0.05;
                    setExportLightboxScale((s) => Math.min(3, Math.max(0.3, s + delta)));
                  }
                }}
              >
                {(() => {
                  const monthPrefix = `${exportYear}-${String(exportMonth).padStart(2, '0')}`;
                  const monthRequests = getLeaveRequests().filter(
                    (r) => r.start_date.startsWith(monthPrefix) && r.status !== 'cancelled'
                  );
                  const daysInMonth = new Date(exportYear, exportMonth, 0).getDate();
                  const firstWeekday = new Date(exportYear, exportMonth - 1, 1).getDay();
                  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
                  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

                  return (
                    <div
                      className="min-w-[1050px] text-center"
                      style={{
                        transform: `scale(${exportLightboxScale})`,
                        transformOrigin: 'top left',
                        width: `${100 / exportLightboxScale}%`,
                      }}
                    >
                      {/* Weekday headers */}
                      <div className="grid grid-cols-7 gap-0">
                        {weekdays.map((w) => (
                          <div key={w} className={`text-center text-base font-bold text-stone-700 py-2.5 border border-black ${w === '日' || w === '六' ? 'bg-stone-200/70' : 'bg-stone-50'}`}>
                            {w}
                          </div>
                        ))}
                      </div>

                      {/* Calendar grid */}
                      <div className="grid grid-cols-7 gap-0">
                        {Array.from({ length: totalCells }).map((_, idx) => {
                          const dayNum = idx - firstWeekday + 1;
                          const isWeekend = idx % 7 === 0 || idx % 7 === 6;
                          if (dayNum < 1 || dayNum > daysInMonth) {
                            return <div key={idx} className={`border border-black min-h-[140px] ${isWeekend ? 'bg-stone-100/70' : 'bg-stone-50/40'}`} />;
                          }
                          const dateStr = `${exportYear}-${String(exportMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                          const dayRequests = monthRequests
                            .filter((r) => r.start_date === dateStr)
                            .sort(sortByLeaveType)
                            .slice(0, 12);
                          return (
                            <div key={idx} className={`border border-black p-2.5 min-h-[420px] flex flex-col ${isWeekend ? 'bg-stone-50/80' : 'bg-white'}`}>
                              <div className="text-base font-bold text-stone-700 mb-2 text-center border-b border-black pb-1.5">
                                {dayNum} <span className="text-stone-400 font-normal text-sm">週{weekdays[idx % 7]}</span>
                              </div>
                              {/* 表頭 */}
                              <div className="grid grid-cols-[28px_1fr_1fr_1fr_36px] gap-0.5 text-xs text-stone-500 border-b border-stone-200 pb-1 mb-1">
                                <div className="text-center">序</div>
                                <div className="text-center">姓名</div>
                                <div className="text-center">假別</div>
                                <div className="text-center">工作班</div>
                                <div className="text-center">審核</div>
                              </div>
                              <div className="flex-1 space-y-0.5">
                                {Array.from({ length: 12 }).map((_, rowIdx) => {
                                  const req = dayRequests[rowIdx];
                                  const typeInfo = req ? leaveTypes.find((t) => t.id === req.leave_type) : null;
                                  return (
                                    <div key={rowIdx} className="grid grid-cols-[28px_1fr_1fr_1fr_36px] gap-0.5 text-sm leading-tight py-1 border-b border-dashed border-stone-100">
                                      <div className="text-center text-stone-400">{rowIdx + 1}</div>
                                      <div className="text-center truncate text-stone-700 font-medium">{req ? req.employee_name : ''}</div>
                                      <div className="text-center truncate text-stone-500">{req ? (typeInfo?.name || req.leave_type_name) : ''}</div>
                                      <div className="text-center truncate text-stone-500">{req ? (req.work_shift || '-') : ''}</div>
                                      <div className="text-center">
                                        {req ? (
                                          req.status === 'approved' ? (
                                            <span className="text-emerald-600 font-bold" title="已核准">✓</span>
                                          ) : req.status === 'rejected' ? (
                                            <span className="text-red-500 font-bold" title="已駁回">✗</span>
                                          ) : req.status === 'pending' ? (
                                            <span className="text-amber-500 font-bold" title="待審核">⏳</span>
                                          ) : (
                                            <span className="text-stone-300 font-bold" title="已取消">—</span>
                                          )
                                        ) : ''}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 底部提示 */}
              <div className="px-5 py-2 border-t border-stone-100 flex-shrink-0 flex items-center justify-between">
                <p className="text-[10px] text-stone-400">按住 Ctrl + 滾輪可縮放 · 點擊背景關閉</p>
                <button
                  onClick={() => setExportLightboxScale(1)}
                  className="text-[10px] text-stone-400 hover:text-stone-600 transition-colors flex items-center gap-1"
                >
                  <i className="ri-fullscreen-line text-xs" />
                  重置縮放
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toggle: List vs Calendar */}
        {activeTab !== 'shiftImages' && activeTab !== 'export' && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex bg-stone-100 rounded-lg p-0.5 flex-1">
              <button
                onClick={() => setShowCalendarView(false)}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  !showCalendarView ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                <i className="ri-list-check mr-1" />
                列表檢視
              </button>
              <button
                onClick={() => setShowCalendarView(true)}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  showCalendarView ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                <i className="ri-calendar-2-line mr-1" />
                月曆檢視
              </button>
            </div>
          </div>
        )}

        {/* Calendar View */}
        {showCalendarView && activeTab !== 'shiftImages' && activeTab !== 'export' && (
          <div className="-mx-4 px-4 space-y-3 mb-4">
            {/* Month navigator */}
            <div className="bg-white rounded-xl border border-stone-100 px-3 py-2.5 flex items-center justify-between max-w-lg mx-auto">
              <button
                onClick={goCalendarPrevMonth}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-50 transition-colors"
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-arrow-left-s-line text-lg text-stone-600" />
                </div>
              </button>
              <div className="text-center flex items-center gap-2">
                <p className="text-sm font-bold text-stone-800">{calendarMonthLabel}</p>
                <button
                  onClick={goCalendarToday}
                  className="text-[10px] font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded transition-colors whitespace-nowrap"
                >
                  本月
                </button>
              </div>
              <button
                onClick={goCalendarNextMonth}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-50 transition-colors"
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-arrow-right-s-line text-lg text-stone-600" />
                </div>
              </button>
            </div>

            {/* Calendar Grid */}
            {(() => {
              const monthPrefix = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}`;
              const currentList = [...sortedPending, ...sortedProcessed];
              const monthRequests = (() => {
                const base = currentList.filter(
                  (r) => r.start_date.startsWith(monthPrefix)
                );
                const reviewedIds = Object.keys(locallyReviewed);
                if (reviewedIds.length > 0) {
                  const reviewedItems = allRequests.filter(
                    r => r.start_date.startsWith(monthPrefix) && locallyReviewed[r.id] && !base.some(b => b.id === r.id)
                  );
                  return [...base, ...reviewedItems].sort(sortByLeaveType);
                }
                return base.sort(sortByLeaveType);
              })();
              const daysInMonth = new Date(calendarYear, calendarMonth, 0).getDate();
              const firstWeekday = new Date(calendarYear, calendarMonth - 1, 1).getDay();
              const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
              const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

              return (
                <div
                  className="bg-white rounded-xl border border-stone-100 overflow-hidden cursor-pointer group relative hidden md:block"
                  onClick={() => setLightboxOpen(true)}
                >
                  <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-black/60 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
                      <i className="ri-fullscreen-line" />
                      點擊放大
                    </div>
                  </div>

                  <div className="overflow-x-auto" style={{ fontFamily: '"DFKai-SB", "BiauKai", "標楷體", "KaiTi", serif' }}>
                    <div className="min-w-[900px] text-center">
                      {/* Weekday headers */}
                      <div className="grid grid-cols-7 gap-0">
                        {weekdays.map((w) => (
                          <div key={w} className={`text-center text-sm font-bold text-stone-700 py-2 border border-black ${w === '日' || w === '六' ? 'bg-stone-200/70' : 'bg-stone-50'}`}>
                            {w}
                          </div>
                        ))}
                      </div>

                      {/* Calendar grid */}
                      <div className="grid grid-cols-7 gap-0">
                        {Array.from({ length: totalCells }).map((_, idx) => {
                          const dayNum = idx - firstWeekday + 1;
                          const isWeekend = idx % 7 === 0 || idx % 7 === 6;
                          if (dayNum < 1 || dayNum > daysInMonth) {
                            return <div key={idx} className={`border border-black min-h-[100px] ${isWeekend ? 'bg-stone-100/70' : 'bg-stone-50/40'}`} />;
                          }
                          const dateStr = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                          const dayRequests = monthRequests
                            .filter((r) => r.start_date === dateStr)
                            .sort(sortByLeaveType)
                            .slice(0, 12);
                          const hasRequests = dayRequests.length > 0;
                          return (
                            <div key={idx} className={`border border-black p-2 min-h-[200px] flex flex-col ${isWeekend ? 'bg-stone-50/80' : 'bg-white'}`}>
                              <div className={`text-sm font-bold mb-1.5 text-center border-b pb-1 ${hasRequests ? 'text-amber-700 border-amber-400' : 'text-stone-600 border-black'}`}>
                                {dayNum} <span className="text-stone-400 font-normal text-xs">週{weekdays[idx % 7]}</span>
                              </div>
                              {hasRequests ? (
                                <div className="flex-1 space-y-0.5">
                                  {dayRequests.map((req, ri) => {
                                    const typeInfo = leaveTypes.find((t) => t.id === req.leave_type);
                                    const status = statusConfig[req.status];
                                    const reviewedStatus = locallyReviewed[req.id];
                                    const isReviewed = !!reviewedStatus;
                                    const isPendingItem = req.status === 'pending' && !isReviewed;
                                    const isReviewing = inlineReviewingId === req.id;
                                    const isProcessing = inlineProcessingId === req.id;
                                    return (
                                      <div
                                        key={ri}
                                        className={`flex items-center gap-1.5 text-xs leading-tight py-0.5 px-1 rounded ${isPendingItem ? 'cursor-pointer hover:bg-amber-100/60' : ''} ${isReviewing ? 'bg-amber-50 ring-1 ring-amber-200' : ''} ${isReviewed ? 'opacity-90' : ''}`}
                                        onClick={(e) => {
                                          if (isPendingItem) {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            setInlineReviewingId(isReviewing ? null : req.id);
                                          }
                                        }}
                                        title={isPendingItem ? (isReviewing ? '再點一次收起' : '點擊顯示審核按鈕') : isReviewed ? (reviewedStatus === 'approved' ? '已核准' : '已駁回') : ''}
                                      >
                                        {isProcessing ? (
                                          <i className="ri-loader-4-line animate-spin text-amber-500 flex-shrink-0 text-xs" />
                                        ) : isReviewed ? (
                                          reviewedStatus === 'approved' ? (
                                            <i className="ri-checkbox-circle-fill text-emerald-500 flex-shrink-0 text-xs" />
                                          ) : (
                                            <i className="ri-close-circle-fill text-red-400 flex-shrink-0 text-xs" />
                                          )
                                        ) : (
                                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status.dot}`} />
                                        )}
                                        <span className="truncate text-stone-700 font-semibold">{req.employee_name}</span>
                                        <span className="truncate text-stone-500 flex-shrink-0">{typeInfo?.name || req.leave_type_name}</span>
                                        <span className="text-stone-400 flex-shrink-0 text-[11px]">{new Date(req.created_at).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                        {isProcessing ? null : isReviewed ? (
                                          <span className={`flex-shrink-0 ml-auto text-xs font-bold ${reviewedStatus === 'approved' ? 'text-emerald-500' : 'text-red-500'}`}>
                                            {reviewedStatus === 'approved' ? '✓' : '✗'}
                                          </span>
                                        ) : isReviewing ? (
                                          <div className="flex items-center gap-0.5 flex-shrink-0 ml-auto">
                                            <button
                                              onClick={(e) => { e.stopPropagation(); handleInlineAction(req, 'approved'); }}
                                              className="w-5 h-5 flex items-center justify-center rounded bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                                              title="核准"
                                            >
                                              <i className="ri-check-line text-[10px]" />
                                            </button>
                                            <button
                                              onClick={(e) => { e.stopPropagation(); handleInlineAction(req, 'rejected'); }}
                                              className="w-5 h-5 flex items-center justify-center rounded bg-red-400 text-white hover:bg-red-500 transition-colors"
                                              title="駁回"
                                            >
                                              <i className="ri-close-line text-[10px]" />
                                            </button>
                                          </div>
                                        ) : isPendingItem ? (
                                          <i className="ri-edit-circle-line text-amber-500 flex-shrink-0 ml-auto text-xs" />
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="flex-1 flex items-center justify-center">
                                  <span className="text-xs text-stone-300">-</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Mobile: just show info text */}
                  <div className="md:hidden text-center py-3 bg-stone-50">
                    <p className="text-xs text-stone-400">
                      {monthRequests.length > 0 ? `${monthRequests.length} 筆請假紀錄` : '本月尚無請假紀錄'}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Full-screen Calendar Lightbox (Desktop) */}
        {lightboxOpen && (
          <div
            className="fixed inset-0 bg-black/70 z-[60] hidden md:flex items-center justify-center p-6"
            onClick={() => setLightboxOpen(false)}
          >
            <div
              className="bg-white rounded-2xl overflow-hidden w-full max-w-[95vw] max-h-[90vh] flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Lightbox header */}
              <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={goCalendarPrevMonth}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 transition-colors"
                  >
                    <i className="ri-arrow-left-s-line text-lg text-stone-600" />
                  </button>
                  <h2 className="text-base font-bold text-stone-800">{calendarMonthLabel}</h2>
                  <button
                    onClick={goCalendarNextMonth}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 transition-colors"
                  >
                    <i className="ri-arrow-right-s-line text-lg text-stone-600" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                    審核
                  </span>
                  <button
                    onClick={() => setLightboxOpen(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 transition-colors text-stone-500"
                  >
                    <i className="ri-close-line text-xl" />
                  </button>
                </div>
              </div>

              {/* Lightbox calendar content */}
              <div className="flex-1 overflow-auto p-4">
                {(() => {
                  const monthPrefix = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}`;
                  const currentList = [...sortedPending, ...sortedProcessed];
                  const monthRequests = (() => {
                    const base = currentList.filter(
                      (r) => r.start_date.startsWith(monthPrefix)
                    );
                    const reviewedIds = Object.keys(locallyReviewed);
                    if (reviewedIds.length > 0) {
                      const reviewedItems = allRequests.filter(
                        r => r.start_date.startsWith(monthPrefix) && locallyReviewed[r.id] && !base.some(b => b.id === r.id)
                      );
                      return [...base, ...reviewedItems].sort(sortByLeaveType);
                    }
                    return base.sort(sortByLeaveType);
                  })();
                  const daysInMonth = new Date(calendarYear, calendarMonth, 0).getDate();
                  const firstWeekday = new Date(calendarYear, calendarMonth - 1, 1).getDay();
                  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
                  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

                  return (
                    <div style={{ fontFamily: '"DFKai-SB", "BiauKai", "標楷體", "KaiTi", serif' }}>
                      {/* Weekday headers */}
                      <div className="grid grid-cols-7 gap-0">
                        {weekdays.map((w) => (
                          <div key={w} className={`text-center text-base font-bold text-stone-700 py-2.5 border border-black ${w === '日' || w === '六' ? 'bg-stone-200/70' : 'bg-stone-50'}`}>
                            {w}
                          </div>
                        ))}
                      </div>

                      {/* Calendar grid - larger version */}
                      <div className="grid grid-cols-7 gap-0">
                        {Array.from({ length: totalCells }).map((_, idx) => {
                          const dayNum = idx - firstWeekday + 1;
                          const isWeekend = idx % 7 === 0 || idx % 7 === 6;
                          if (dayNum < 1 || dayNum > daysInMonth) {
                            return <div key={idx} className={`border border-black min-h-[160px] ${isWeekend ? 'bg-stone-100/70' : 'bg-stone-50/40'}`} />;
                          }
                          const dateStr = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                          const dayRequests = monthRequests
                            .filter((r) => r.start_date === dateStr)
                            .sort(sortByLeaveType)
                            .slice(0, 12);
                          const hasRequests = dayRequests.length > 0;
                          return (
                            <div key={idx} className={`border border-black p-2.5 min-h-[260px] flex flex-col ${isWeekend ? 'bg-stone-50/80' : 'bg-white'}`}>
                              <div className={`text-base font-bold mb-2 text-center border-b pb-1.5 ${hasRequests ? 'text-amber-700 border-amber-400' : 'text-stone-600 border-black'}`}>
                                {dayNum} <span className="text-stone-400 font-normal text-sm">週{weekdays[idx % 7]}</span>
                              </div>
                              {hasRequests ? (
                                <div className="flex-1 space-y-1">
                                  {dayRequests.map((req, ri) => {
                                    const typeInfo = leaveTypes.find((t) => t.id === req.leave_type);
                                    const status = statusConfig[req.status];
                                    const reviewedStatus = locallyReviewed[req.id];
                                    const isReviewed = !!reviewedStatus;
                                    const isPendingItem = req.status === 'pending' && !isReviewed;
                                    const isReviewing = inlineReviewingId === req.id;
                                    const isProcessing = inlineProcessingId === req.id;
                                    return (
                                      <div
                                        key={ri}
                                        className={`flex items-center gap-2 text-sm leading-tight py-1 px-1.5 rounded border-b border-dashed border-stone-100 ${isPendingItem ? 'cursor-pointer hover:bg-amber-100/60' : ''} ${isReviewing ? 'bg-amber-50 ring-1 ring-amber-200' : ''} ${isReviewed ? 'opacity-90' : ''}`}
                                        onClick={(e) => {
                                          if (isPendingItem) {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            setInlineReviewingId(isReviewing ? null : req.id);
                                          }
                                        }}
                                        title={isPendingItem ? (isReviewing ? '再點一次收起' : '點擊顯示審核按鈕') : isReviewed ? (reviewedStatus === 'approved' ? '已核准' : '已駁回') : ''}
                                      >
                                        {isProcessing ? (
                                          <i className="ri-loader-4-line animate-spin text-amber-500 flex-shrink-0 text-sm" />
                                        ) : isReviewed ? (
                                          reviewedStatus === 'approved' ? (
                                            <i className="ri-checkbox-circle-fill text-emerald-500 flex-shrink-0 text-sm" />
                                          ) : (
                                            <i className="ri-close-circle-fill text-red-400 flex-shrink-0 text-sm" />
                                          )
                                        ) : (
                                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status.dot}`} />
                                        )}
                                        <span className="font-semibold text-stone-700 truncate">{req.employee_name}</span>
                                        <span className="text-stone-500 truncate flex-shrink-0">{typeInfo?.name || req.leave_type_name}</span>
                                        <span className="text-stone-400 flex-shrink-0 text-xs">{new Date(req.created_at).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                        {req.work_shift && (
                                          <span className="text-stone-400 text-xs truncate flex-shrink-0">{req.work_shift}</span>
                                        )}
                                        {isProcessing ? null : isReviewed ? (
                                          <span className={`flex-shrink-0 ml-auto text-sm font-bold ${reviewedStatus === 'approved' ? 'text-emerald-500' : 'text-red-500'}`}>
                                            {reviewedStatus === 'approved' ? '✓' : '✗'}
                                          </span>
                                        ) : isReviewing ? (
                                          <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                                            <button
                                              onClick={(e) => { e.stopPropagation(); handleInlineAction(req, 'approved'); }}
                                              className="w-6 h-6 flex items-center justify-center rounded bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                                              title="核准"
                                            >
                                              <i className="ri-check-line text-xs" />
                                            </button>
                                            <button
                                              onClick={(e) => { e.stopPropagation(); handleInlineAction(req, 'rejected'); }}
                                              className="w-6 h-6 flex items-center justify-center rounded bg-red-400 text-white hover:bg-red-500 transition-colors"
                                              title="駁回"
                                            >
                                              <i className="ri-close-line text-xs" />
                                            </button>
                                          </div>
                                        ) : isPendingItem ? (
                                          <i className="ri-edit-circle-line text-amber-500 flex-shrink-0 ml-auto text-sm" />
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="flex-1 flex items-center justify-center">
                                  <span className="text-sm text-stone-300">-</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* List — merged: pending first, then processed */}
        {activeTab === 'pending' ? (
          (() => {
            const allMerged = [...sortedPending, ...sortedProcessed];
            if (allMerged.length === 0) {
              return (
                <div className="bg-white rounded-xl p-8 text-center border border-stone-100">
                  <i className="ri-inbox-line text-4xl text-stone-300 mb-3" />
                  <p className="text-sm text-stone-400">尚無任何請假紀錄</p>
                </div>
              );
            }
            return (
              <div className="space-y-3">
                {groupByMonth(allMerged).map(([month, dates]) => {
                  const monthReqCount = dates.reduce((sum, [, reqs]) => sum + reqs.length, 0);
                  const pendingCount = dates.reduce((sum, [, reqs]) => sum + reqs.filter(r => r.status === 'pending').length, 0);
                  const isMonthExpanded = expandedPendingMonths.has(month);
                  return (
                    <div key={month} className="space-y-2">
                      <button
                        onClick={() => togglePendingMonth(month)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-stone-100 hover:bg-stone-50 transition-colors text-left cursor-pointer"
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${pendingCount > 0 ? 'bg-amber-100' : 'bg-stone-100'}`}>
                          <i className={`ri-calendar-2-line text-xs ${pendingCount > 0 ? 'text-amber-600' : 'text-stone-500'}`} />
                        </div>
                        <div className="flex-1 flex items-center min-w-0">
                          <span className="text-sm font-bold text-stone-800 whitespace-nowrap">{formatMonthLabel(month)}</span>
                          <span className={`text-xs ml-2 font-medium whitespace-nowrap ${pendingCount > 0 ? 'text-amber-600' : 'text-stone-400'}`}>
                            {monthReqCount} 筆{pendingCount > 0 ? `（${pendingCount} 筆待審）` : ''}
                          </span>
                        </div>
                        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                          <i className={`ri-arrow-down-s-line text-stone-400 transition-transform duration-200 ${isMonthExpanded ? '' : '-rotate-90'}`} />
                        </div>
                      </button>

                      {isMonthExpanded && (
                        <div className="space-y-1 pl-2">
                          {dates.map(([date, reqs]) => {
                            const datePendingCount = reqs.filter(r => r.status === 'pending').length;
                            return (
                              <div key={date} className="space-y-1">
                                <button
                                  onClick={() => togglePendingDate(date)}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-stone-100 transition-colors text-left cursor-pointer"
                                >
                                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${datePendingCount > 0 ? 'bg-amber-50' : 'bg-stone-50'}`}>
                                    <i className={`ri-calendar-line text-[10px] ${datePendingCount > 0 ? 'text-amber-500' : 'text-stone-400'}`} />
                                  </div>
                                  <div className="flex-1 flex items-center min-w-0">
                                    <span className="text-sm font-medium text-stone-700 whitespace-nowrap">{date}</span>
                                    <span className={`text-xs ml-1.5 whitespace-nowrap ${datePendingCount > 0 ? 'text-amber-600' : 'text-stone-400'}`}>星期{formatWeekday(date)}</span>
                                  </div>
                                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium whitespace-nowrap flex-shrink-0 ${datePendingCount > 0 ? 'bg-amber-50 text-amber-700' : 'text-stone-400'}`}>{reqs.length} 筆</span>
                                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                                    <i className={`ri-arrow-down-s-line text-stone-400 transition-transform duration-200 ${expandedPendingDates.has(date) ? '' : '-rotate-90'}`} />
                                  </div>
                                </button>

                                {expandedPendingDates.has(date) && (
                                  <div className="space-y-3 pl-8 pt-1">
                                    {reqs.map((req) => renderRequestCard(req, req.status === 'pending'))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()
        ) : null}
      </div>

      {/* Approval Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden animate-[slideUp_0.2s_ease-out]">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-stone-800">
                {actionType === 'approved' ? '核准請假申請' : actionType === 'rejected' ? '駁回請假申請' : '審核請假申請'}
              </h2>
              <button
                onClick={closeDetail}
                className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-600"
              >
                <i className="ri-close-line text-xl" />
              </button>
            </div>

            {/* Request Detail */}
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-stone-600">
                    {selectedRequest.employee_name.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-800">{selectedRequest.employee_name}</p>
                  <p className="text-xs text-stone-400">
                    {getEmployeeInfo(selectedRequest.employee_id)?.title}
                  </p>
                </div>
              </div>

              {/* 申請時間（彈窗中更詳細） */}
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 flex items-center gap-2">
                <i className="ri-time-line text-amber-500 text-sm" />
                <div>
                  <p className="text-xs font-medium text-amber-800">申請時間</p>
                  <p className="text-xs text-amber-700">
                    {formatDateTime(selectedRequest.created_at).full}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {(() => {
                  const ti = leaveTypes.find((t) => t.id === selectedRequest.leave_type);
                  return (
                    <>
                      <div className={`w-6 h-6 rounded flex items-center justify-center ${ti?.color}`}>
                        <i className={`${ti?.icon} text-[10px]`} />
                      </div>
                      <span className="text-sm font-medium text-stone-700">{ti?.name}</span>
                    </>
                  );
                })()}
              </div>

              <div className="bg-stone-50 rounded-xl p-3 space-y-2">
                <p className="text-xs text-stone-500">
                  <i className="ri-calendar-line mr-1" />
                  請假日期：{selectedRequest.start_date}
                </p>
                {selectedRequest.work_shift && (
                  <p className="text-xs text-stone-500">
                    <i className="ri-briefcase-line mr-1" />
                    當天工作班：{selectedRequest.work_shift}
                  </p>
                )}
              </div>

              <div className="bg-stone-50 rounded-xl px-3 py-2.5">
                <p className="text-xs text-stone-500">{selectedRequest.reason}</p>
              </div>

              {/* Comment Input */}
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1.5">
                  審核意見（選填）
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={actionType === 'approved' ? '可選填核准意見...' : actionType === 'rejected' ? '請說明駁回原因...' : '選擇核准或駁回...'}
                  rows={3}
                  maxLength={200}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                />
                <p className="text-[10px] text-stone-400 mt-1 text-right">{comment.length}/200</p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-5 py-4 border-t border-stone-100 flex gap-3">
              <button
                onClick={closeDetail}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 transition-colors"
              >
                {t('cancel')}
              </button>
              {actionType === null ? (
                <>
                  <button
                    onClick={() => { setActionType('rejected'); }}
                    className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <i className="ri-close-line" />
                    {t('reject')}
                  </button>
                  <button
                    onClick={() => { setActionType('approved'); }}
                    className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <i className="ri-check-line" />
                    {t('approve')}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleApprove}
                  disabled={submitting}
                  className={`flex-[2] py-2.5 rounded-xl text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    actionType === 'approved'
                      ? 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400'
                      : 'bg-red-500 hover:bg-red-600 disabled:bg-red-300'
                  }`}
                >
                  {submitting ? (
                    <>
                      <i className="ri-loader-4-line animate-spin" />
                      處理中...
                    </>
                  ) : actionType === 'approved' ? (
                    <>
                      <i className="ri-check-line" />
                      {t('approve')}
                    </>
                  ) : (
                    <>
                      <i className="ri-close-line" />
                      {t('reject')}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}