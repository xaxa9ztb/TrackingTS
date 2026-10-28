// Xuất bảng chấm công Excel theo mẫu Schindler (ts-template.xlsx) — dùng chung cho Timesheet (Xuất Excel / Gửi mail)
// và trang Duyệt bảng công (đính kèm thư khi Quản lý dự án duyệt xong). ExcelJS và mẫu do nơi gọi nạp.
(function (root) {
  'use strict';
  const LaborVN = typeof require === 'function' && typeof module !== 'undefined' ? require('./labor.js') : root.LaborVN;

  // Mã công việc -> cột dấu "x" của mẫu (U..AX = 21..50), khớp ACTIVITY_META của Timesheet
  const ACT_COL = {
    '100': 21,
    '1193': 22,
    '1110': 23,
    '1731': 24,
    '1194': 25,
    '1720': 26,
    '1900': 27,
    '1191': 28,
    '1192-0': 29,
    '1192-1': 30,
    '1393': 31,
    '1394': 32,
    '1310': 33,
    '1392-0': 34,
    '1400': 35,
    '1500': 36,
    '1600': 37,
    '1710': 38,
    '1715': 39,
    '1725': 40,
    '1700': 41,
    '5010': 42,
    '5021': 43,
    '5022': 44,
    '5040': 45,
    '5060': 46,
    '5090': 47,
    '6010': 48,
    '6020': 49,
    '6090': 50
  };
  const OT_COL = { OT1: 9, OT2: 10, OT3: 11, OT4: 12, OT5: 13, OT6: 14, OT7: 15 };   // cột I..O của mẫu
  const activityToCol = (code) => {
    if (ACT_COL[code] !== undefined) return ACT_COL[code];
    if (code === '1192') return 29;
    if (code === '1392') return 34;
    return null;
  };
  const timeToExcel = (t) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return (h + m / 60) / 24; };
  const calculateHours = (start, end, breakTime) => {
    if (!start || !end) return 0;
    const [h1, m1] = start.split(':').map(Number), [h2, m2] = end.split(':').map(Number);
    let diff = (h2 + m2 / 60) - (h1 + m1 / 60);
    if (diff < 0) diff += 24;
    return Math.max(0, diff - (parseFloat(breakTime) || 0));
  };
  const removeAccents = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, '_');
  const cloneStyle = (s) => (s ? JSON.parse(JSON.stringify(s)) : {});
  // Ngày ghi vào Excel PHẢI tạo theo UTC (ExcelJS đổi Date sang số ngày Excel theo giờ UTC)
  const excelDate = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
  // Cột G "Normal Hour" theo mẫu ($E$9 = 08:00, $F$9 = 17:00)
  const normalHourFormula = (r) => `IF(D${r}=1,0,IF(AND(E${r}<$E$9,F${r}>$F$9),9-H${r},IF(OR(AND(E${r}<$E$9,F${r}<$E$9),AND(E${r}>$F$9,F${r}>$F$9)),0,IF(AND(E${r}>=$E$9,F${r}<=$F$9),(F${r}-E${r})*24-H${r},IF(AND(F${r}>$F$9,E${r}>=$E$9),($F$9-E${r})*24-H${r},IF(AND(E${r}<$E$9,F${r}<=$F$9),(F${r}-$E$9)*24-H${r}))))))`;

  // ExcelJS: lớp ExcelJS; templateBuffer: nội dung ts-template.xlsx; entries: các dòng của kỳ;
  // bdOf(e): {NORMAL, OT1…} của dòng; profile: {name, empId, position, dept}; month: 'YYYY-MM'
  // → { buffer, name }
  async function buildTimesheet(ExcelJS, templateBuffer, { entries, bdOf, profile, month }) {
    const sortedData = [...entries].sort((a,b) => a.date.localeCompare(b.date));
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(templateBuffer);
    const sheet = workbook.getWorksheet('New TS') || workbook.worksheets[0];

    // Snapshot template styles BEFORE editing: a data row (11), the total row (59),
    // and the signature block (62-64, captured as offsets from the total row).
    const dataStyle = {}, totalStyle = {};
    for (let c = 1; c <= 51; c++) {
        dataStyle[c] = cloneStyle(sheet.getRow(11).getCell(c).style);
        totalStyle[c] = cloneStyle(sheet.getRow(59).getCell(c).style);
    }
    const sigCells = [];
    for (let r = 62; r <= 64; r++) {
        for (let c = 1; c <= 51; c++) {
            const cell = sheet.getRow(r).getCell(c);
            const hasTop = cell.border && cell.border.top && cell.border.top.style;
            if (cell.value !== null || hasTop) sigCells.push({ off: r - 59, c, value: cell.value, style: cloneStyle(cell.style) });
        }
    }

    // --- Header fields ---
    sheet.getCell('E3').value = profile.name || '';
    sheet.getCell('E4').value = profile.empId || '';
    sheet.getCell('X4').value = profile.position || '';
    sheet.getCell('AS4').value = profile.dept || '';
    sheet.getCell('AR4').value = ':';
    const [hy, hm] = month.split('-').map(Number);
    sheet.getCell('AS3').value = excelDate(hy, hm, 1);

    // Clear the old body (sample rows 10..64 plus whatever our new layout will span): values + styles
    const clearUntil = Math.max(70, 10 + sortedData.length + 6);
    for (let r = 10; r <= clearUntil; r++) {
        const row = sheet.getRow(r);
        for (let c = 1; c <= 51; c++) { const cell = row.getCell(c); cell.value = null; cell.style = {}; }
        row.height = undefined;
    }

    // --- Data rows (one per entry), starting at row 10 ---
    sortedData.forEach((e, index) => {
        const r = 10 + index;
        const row = sheet.getRow(r);
        row.height = 25.5;
        for (let c = 1; c <= 51; c++) row.getCell(c).style = cloneStyle(dataStyle[c]);

        row.getCell(1).value = { formula: '$E$4' };
        row.getCell(2).value = { formula: '$E$3' };
        const [dy, dm, dd] = e.date.split('-').map(Number);
        row.getCell(3).value = excelDate(dy, dm, dd);
        row.getCell(4).value = { formula: `WEEKDAY(C${r})` };
        row.getCell(5).value = timeToExcel(e.startTime);
        row.getCell(6).value = timeToExcel(e.endTime);
        const brk = parseFloat(e.breakTime) || 0;
        row.getCell(8).value = brk > 0 ? brk : null;
        if (LaborVN.isAuto(e)) {
            // tự động theo luật: một dòng có thể vừa giờ thường vừa nhiều loại OT (cột "Check" vẫn = 0)
            const bd = bdOf(e);
            row.getCell(7).value = bd.NORMAL || 0;
            Object.keys(OT_COL).forEach(k => { if (bd[k]) row.getCell(OT_COL[k]).value = bd[k]; });
        } else {
            row.getCell(7).value = e.otType === 'NORMAL' ? { formula: normalHourFormula(r) } : 0;
            if (e.otType !== 'NORMAL' && OT_COL[e.otType]) {
                row.getCell(OT_COL[e.otType]).value = calculateHours(e.startTime, e.endTime, e.breakTime);
            }
        }
        row.getCell(16).value = { formula: `MOD(F${r}-E${r},1)*24-SUM(G${r}:O${r})` }; // MOD: ca qua nửa đêm vẫn = 0
        row.getCell(17).value = { formula: `INDEX($U$9:$AX$9,1,MATCH("x",$U${r}:$AX${r}))` };
        row.getCell(18).value = e.projectName || '';
        row.getCell(19).value = e.workNumber || '';
        row.getCell(20).value = { formula: `INDEX($U$6:$AX$6,1,MATCH("x",$U${r}:$AX${r}))` };
        const actCol = activityToCol(e.activityCode);
        if (actCol) {
            const xc = row.getCell(actCol);
            xc.value = 'x';
            xc.font = { name: 'Times New Roman', size: 14 };
            xc.alignment = { horizontal: 'center', vertical: 'middle' };
        }
        row.getCell(51).value = e.remarks || '';
    });

    // --- Total row, right after the last data row ---
    const rt = 10 + sortedData.length;
    const totalRow = sheet.getRow(rt);
    totalRow.height = 24.75;
    for (let c = 1; c <= 51; c++) totalRow.getCell(c).style = cloneStyle(totalStyle[c]);
    totalRow.getCell(6).value = 'Total:';
    for (let c = 7; c <= 16; c++) {
        const letter = sheet.getColumn(c).letter;
        totalRow.getCell(c).value = { formula: `SUM(${letter}10:${letter}${rt - 1})` };
    }

    // --- Signature block (Verified / Approved / Employee Signature) ---
    sigCells.forEach(s => {
        const cell = sheet.getRow(rt + s.off).getCell(s.c);
        cell.value = s.value;
        cell.style = cloneStyle(s.style);
    });

    sheet.pageSetup.printArea = `A1:AY${rt + 5}`;


    const buffer = await workbook.xlsx.writeBuffer();
    const cleanName = removeAccents(profile.name || 'Timesheet');
    const [y, m] = month.split('-');
    return { buffer, name: `${cleanName}_Thang_${m}_${y}.xlsx` };
  }

  const api = { buildTimesheet, activityToCol, ACT_COL, OT_COL, calculateHours, removeAccents };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TsExcel = api;
})(typeof window !== 'undefined' ? window : globalThis);
