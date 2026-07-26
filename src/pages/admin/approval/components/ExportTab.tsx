import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx-js-style';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { getLeaveRequests, isDayCancelled, getRequestDayStatusMap } from '@/stores/leaveStore';
import { leaveTypes } from '@/mocks/leaveTypes';
import {
  groupByDate,
  sortByLeaveType,
  formatWeekday,
  getEmployeeInfo,
  requestOverlapsMonth,
  requestCoversDate,
} from '@/pages/admin/approval/utils/leaveHelpers';
import type { LeaveRequest } from '@/stores/leaveStore';

interface ExportTabProps {
  year: number;
  month: number;
  onNavigate: (year: number, month: number) => void;
}

export default function ExportTab({ year: exportYear, month: exportMonth, onNavigate }: ExportTabProps) {
  const today = new Date();
  const [exporting, setExporting] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const [exportLightboxOpen, setExportLightboxOpen] = useState(false);
  const [exportLightboxScale, setExportLightboxScale] = useState(1);
  const calendarRef = useRef<HTMLDivElement>(null);

  const exportMonthLabel = `${exportYear} 年 ${exportMonth} 月`;

  function goExportPrevMonth() {
    if (exportMonth === 1) {
      onNavigate(exportYear - 1, 12);
    } else {
      onNavigate(exportYear, exportMonth - 1);
    }
  }

  function goExportNextMonth() {
    if (exportMonth === 12) {
      onNavigate(exportYear + 1, 1);
    } else {
      onNavigate(exportYear, exportMonth + 1);
    }
  }

  function goExportToday() {
    onNavigate(today.getFullYear(), today.getMonth() + 1);
  }

  const getMonthRequests = useCallback(() => {
    return getLeaveRequests().filter(
      (r) => r.status !== 'cancelled' && requestOverlapsMonth(r, exportYear, exportMonth),
    );
  }, [exportYear, exportMonth]);

  function handleExportExcel() {
    const monthRequests = getMonthRequests();

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

    const daysInMonth = new Date(exportYear, exportMonth, 0).getDate();
    const firstWeekday = new Date(exportYear, exportMonth - 1, 1).getDay();
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const COLS_PER_DAY = 4;
    const TOTAL_COLS = 7 * COLS_PER_DAY;

    const rows: (string | number)[][] = [];
    const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
    const dayRegions: { startRow: number; endRow: number; startCol: number; endCol: number }[] = [];

    const titleRow: (string | number)[] = new Array(TOTAL_COLS).fill('');
    titleRow[0] = `${exportYear}年${String(exportMonth).padStart(2, '0')}月`;
    rows.push(titleRow);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: TOTAL_COLS - 1 } });

    rows.push(new Array(TOTAL_COLS).fill(''));

    const totalWeeks = Math.ceil((firstWeekday + daysInMonth) / 7);

    for (let week = 0; week < totalWeeks; week++) {
      const weekStartRow = rows.length;

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
          const actualDate = new Date(exportYear, exportMonth - 1, dayNum);
          const actualWeekday = actualDate.getDay();
          weekData.push({
            dayNum,
            weekdayName: weekdays[actualWeekday],
            dateStr,
            requests: monthRequests
              .filter((r) => requestCoversDate(r, dateStr) && !isDayCancelled(r.id, dateStr))
              .sort((a, b) => a.employee_name.localeCompare(b.employee_name, 'zh-Hant')),
          });
        } else {
          weekData.push({ dayNum: null, weekdayName: '', dateStr: null, requests: [] });
        }
      }

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

      const subHeaderRow: (string | number)[] = new Array(TOTAL_COLS).fill('');
      for (let d = 0; d < 7; d++) {
        const startCol = d * COLS_PER_DAY;
        subHeaderRow[startCol] = '序號';
        subHeaderRow[startCol + 1] = '姓名';
        subHeaderRow[startCol + 2] = '假別';
        subHeaderRow[startCol + 3] = '工作班';
      }
      rows.push(subHeaderRow);

      const maxDataRows = 12;
      for (let r = 0; r < maxDataRows; r++) {
        const dataRow: (string | number)[] = new Array(TOTAL_COLS).fill('');
        weekData.forEach((d, idx) => {
          const startCol = idx * COLS_PER_DAY;
          const req = d.requests[r];
          dataRow[startCol] = r + 1;
          if (req) {
            const typeInfo = leaveTypes.find((t) => t.id === req.leave_type);
            dataRow[startCol + 1] = req.employee_name;
            dataRow[startCol + 2] = typeInfo?.name || req.leave_type_name;
            dataRow[startCol + 3] = req.work_shift || '-';
          }
        });
        rows.push(dataRow);
      }

      const weekEndRow = rows.length - 1;

      for (let d = 0; d < 7; d++) {
        const startCol = d * COLS_PER_DAY;
        dayRegions.push({
          startRow: weekStartRow,
          endRow: weekEndRow,
          startCol,
          endCol: startCol + COLS_PER_DAY - 1,
        });
      }

      rows.push(new Array(TOTAL_COLS).fill(''));
    }

    const wsCalendar = XLSX.utils.aoa_to_sheet(rows);
    wsCalendar['!cols'] = Array(TOTAL_COLS)
      .fill(null)
      .map((_, i) => {
        if (i % COLS_PER_DAY === 0) return { wch: 6 };
        if (i % COLS_PER_DAY === 1) return { wch: 12 };
        return { wch: 10 };
      });

    const calRange = XLSX.utils.decode_range(wsCalendar['!ref'] || 'A1');
    for (let R = calRange.s.r; R <= calRange.e.r; ++R) {
      for (let C = calRange.s.c; C <= calRange.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        if (!wsCalendar[cellRef]) wsCalendar[cellRef] = { v: '' };

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
    if (!calendarRef.current) {
      alert('預覽區尚未載入');
      return;
    }

    setPdfExporting(true);
    try {
      const rowsFirstPage = 3;

      async function screenshotWeeks(showWeekStart: number, showWeekEnd: number): Promise<string> {
        const tempDiv = document.createElement('div');
        tempDiv.style.cssText = 'position:absolute;left:-9999px;top:0;min-width:1050px;background:#fff;';
        const clone = calendarRef.current!.cloneNode(true) as HTMLDivElement;

        clone.style.transform = 'none';
        clone.style.width = '1050px';

        const weekRows = clone.querySelectorAll('.pdf-week-row');
        weekRows.forEach((el, i) => {
          if (i < showWeekStart || i >= showWeekEnd) {
            (el as HTMLElement).style.display = 'none';
          }
        });

        tempDiv.appendChild(clone);
        document.body.appendChild(tempDiv);

        let dataUrl: string;
        try {
          dataUrl = await toPng(clone, {
            quality: 1,
            pixelRatio: 2,
            backgroundColor: '#ffffff',
            skipFonts: true,
          });
        } catch (fontErr) {
          if (fontErr instanceof Error && fontErr.message.includes('cssRules')) {
            dataUrl = await toPng(clone, {
              quality: 1,
              pixelRatio: 2,
              backgroundColor: '#ffffff',
              skipFonts: true,
            });
          } else {
            throw fontErr;
          }
        } finally {
          document.body.removeChild(tempDiv);
        }

        return dataUrl;
      }

      const pdf = new jsPDF('p', 'mm', 'a3');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 5;
      const contentWidth = pdfWidth - margin * 2;
      const titleHeight = 12;
      const title = `${exportYear}/${String(exportMonth).padStart(2, '0')} month`;

      // Page 1: first 3 weeks
      const dataUrl1 = await screenshotWeeks(0, Math.min(rowsFirstPage, weekCount));
      const img1 = new Image();
      img1.src = dataUrl1;
      await new Promise<void>((resolve) => { img1.onload = () => resolve(); });

      const scale1 = contentWidth / img1.naturalWidth;
      const scaledHeight1 = img1.naturalHeight * scale1;

      pdf.setFontSize(14);
      pdf.text(title, pdfWidth / 2, margin + 5, { align: 'center' });
      pdf.addImage(dataUrl1, 'PNG', margin, margin + titleHeight, contentWidth, scaledHeight1);

      // Page 2: remaining weeks
      if (weekCount > rowsFirstPage) {
        pdf.addPage();
        const dataUrl2 = await screenshotWeeks(rowsFirstPage, weekCount);
        const img2 = new Image();
        img2.src = dataUrl2;
        await new Promise<void>((resolve) => { img2.onload = () => resolve(); });

        const scale2 = contentWidth / img2.naturalWidth;
        const scaledHeight2 = img2.naturalHeight * scale2;

        pdf.setFontSize(14);
        pdf.text(title, pdfWidth / 2, margin + 5, { align: 'center' });
        pdf.addImage(dataUrl2, 'PNG', margin, margin + titleHeight, contentWidth, scaledHeight2);
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

  const monthRequests = getMonthRequests();
  const daysInMonth = new Date(exportYear, exportMonth, 0).getDate();
  const firstWeekday = new Date(exportYear, exportMonth - 1, 1).getDay();
  const weekCount = Math.ceil((firstWeekday + daysInMonth) / 7);
  const totalCells = weekCount * 7;
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

  return (
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
      <div
        className="bg-white rounded-xl border border-stone-100 p-4 space-y-3 md:cursor-pointer md:group relative"
        onClick={() => { if (window.innerWidth >= 768) setExportLightboxOpen(true); }}
      >
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
          <div
            ref={calendarRef}
            className="min-w-[1050px] text-center"
            style={{ transform: `scale(${previewScale})`, transformOrigin: 'top left', width: `${100 / previewScale}%` }}
          >
            <div className="grid grid-cols-7 gap-0">
              {weekdays.map((w) => (
                <div
                  key={w}
                  className={`text-center text-sm font-medium text-stone-600 py-1.5 border border-black ${w === '日' || w === '六' ? 'bg-stone-200/70' : 'bg-stone-50'}`}
                >
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0">
              {Array.from({ length: weekCount }).map((_, weekIdx) => (
                <div key={weekIdx} className="contents pdf-week-row">
                  {Array.from({ length: 7 }).map((_, dayIdx) => {
                    const idx = weekIdx * 7 + dayIdx;
                    const dayNum = idx - firstWeekday + 1;
                    const isWeekend = idx % 7 === 0 || idx % 7 === 6;
                    if (dayNum < 1 || dayNum > daysInMonth) {
                      return <div key={idx} className={`border border-black min-h-[180px] ${isWeekend ? 'bg-stone-100/70' : 'bg-stone-50/40'}`} />;
                    }
                    const dateStr = `${exportYear}-${String(exportMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                    const dayRequests = monthRequests
                      .filter((r) => requestCoversDate(r, dateStr) && !isDayCancelled(r.id, dateStr))
                      .sort(sortByLeaveType)
                      .slice(0, 12);
                    return (
                      <div key={idx} className={`border border-black p-2 min-h-[420px] flex flex-col ${isWeekend ? 'bg-stone-50/80' : 'bg-white'}`}>
                        <div className="text-sm font-bold text-stone-700 mb-2 text-center border-b border-black pb-1">
                          {dayNum} <span className="text-stone-400 font-normal text-xs">週{weekdays[idx % 7]}</span>
                        </div>
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
                            const dayStatus = req ? (getRequestDayStatusMap(req.id)[dateStr] || req.status) : null;
                            return (
                              <div key={rowIdx} className="grid grid-cols-[24px_1fr_1fr_1fr_32px] gap-0.5 text-[11px] leading-tight py-0.5 border-b border-dashed border-stone-100">
                                <div className="text-center text-stone-400">{rowIdx + 1}</div>
                                <div className="text-center truncate text-stone-700">{req ? req.employee_name : ''}</div>
                                <div className="text-center truncate text-stone-500">{req ? (typeInfo?.name || req.leave_type_name) : ''}</div>
                                <div className="text-center truncate text-stone-500">{req ? (req.work_shift || '-') : ''}</div>
                                <div className="text-center">
                                  {req ? (
                                    dayStatus === 'approved' ? (
                                      <span className="text-emerald-600 font-bold text-xs" title="已核准">✓</span>
                                    ) : dayStatus === 'rejected' ? (
                                      <span className="text-red-500 font-bold text-xs" title="已駁回">✗</span>
                                    ) : dayStatus === 'pending' ? (
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
              ))}
            </div>
          </div>
        </div>
        <p className="hidden md:block text-[10px] text-stone-400 text-right">按住 Ctrl + 滾輪可縮放 · 拖曳捲軸可瀏覽</p>
      </div>

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

        <div className="bg-stone-50 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="ri-calendar-line text-stone-400 text-sm" />
            <span className="text-sm text-stone-600">{exportMonthLabel} 請假紀錄</span>
          </div>
          <span className="text-sm font-bold text-stone-800">{monthRequests.length} 筆</span>
        </div>

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
              <div
                className="min-w-[1050px] text-center"
                style={{
                  transform: `scale(${exportLightboxScale})`,
                  transformOrigin: 'top left',
                  width: `${100 / exportLightboxScale}%`,
                }}
              >
                <div className="grid grid-cols-7 gap-0">
                  {weekdays.map((w) => (
                    <div
                      key={w}
                      className={`text-center text-base font-bold text-stone-700 py-2.5 border border-black ${w === '日' || w === '六' ? 'bg-stone-200/70' : 'bg-stone-50'}`}
                    >
                      {w}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-0">
                  {Array.from({ length: weekCount }).map((_, weekIdx) => (
                    <div key={weekIdx} className="contents pdf-week-row">
                      {Array.from({ length: 7 }).map((_, dayIdx) => {
                        const idx = weekIdx * 7 + dayIdx;
                        const dayNum = idx - firstWeekday + 1;
                        const isWeekend = idx % 7 === 0 || idx % 7 === 6;
                        if (dayNum < 1 || dayNum > daysInMonth) {
                          return <div key={idx} className={`border border-black min-h-[140px] ${isWeekend ? 'bg-stone-100/70' : 'bg-stone-50/40'}`} />;
                        }
                        const dateStr = `${exportYear}-${String(exportMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                        const dayRequests = monthRequests
                          .filter((r) => requestCoversDate(r, dateStr) && !isDayCancelled(r.id, dateStr))
                          .sort(sortByLeaveType)
                          .slice(0, 12);
                        return (
                          <div key={idx} className={`border border-black p-2.5 min-h-[420px] flex flex-col ${isWeekend ? 'bg-stone-50/80' : 'bg-white'}`}>
                            <div className="text-base font-bold text-stone-700 mb-2 text-center border-b border-black pb-1.5">
                              {dayNum} <span className="text-stone-400 font-normal text-sm">週{weekdays[idx % 7]}</span>
                            </div>
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
                                const dayStatus = req ? (getRequestDayStatusMap(req.id)[dateStr] || req.status) : null;
                                return (
                                  <div key={rowIdx} className="grid grid-cols-[28px_1fr_1fr_1fr_36px] gap-0.5 text-sm leading-tight py-1 border-b border-dashed border-stone-100">
                                    <div className="text-center text-stone-400">{rowIdx + 1}</div>
                                    <div className="text-center truncate text-stone-700 font-medium">{req ? req.employee_name : ''}</div>
                                    <div className="text-center truncate text-stone-500">{req ? (typeInfo?.name || req.leave_type_name) : ''}</div>
                                    <div className="text-center truncate text-stone-500">{req ? (req.work_shift || '-') : ''}</div>
                                    <div className="text-center">
                                      {req ? (
                                        dayStatus === 'approved' ? (
                                          <span className="text-emerald-600 font-bold" title="已核准">✓</span>
                                        ) : dayStatus === 'rejected' ? (
                                          <span className="text-red-500 font-bold" title="已駁回">✗</span>
                                        ) : dayStatus === 'pending' ? (
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
                  ))}
                </div>
              </div>
            </div>

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
    </div>
  );
}