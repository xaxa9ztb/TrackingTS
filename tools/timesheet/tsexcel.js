// Xuất bảng chấm công Excel theo mẫu Schindler (ts-template.xlsx) — dùng chung cho Timesheet (Xuất Excel / Gửi mail)
// và trang Duyệt bảng công (đính kèm thư khi Quản lý dự án duyệt xong). ExcelJS và mẫu do nơi gọi nạp.
(function (root) {
  'use strict';
  const LaborVN = typeof require === 'function' && typeof module !== 'undefined' ? require('./labor.js') : root.LaborVN;

  // Mã công việc: [mã, nhóm (cat), cột dấu "x" của mẫu (V..AY = 22..51, mẫu 2026), mô tả] — khớp ACTIVITY_META của Timesheet.
  // Mẫu 2026 (ts-template.xlsx, theo file chấm công mới của Schindler): thêm cột P "Số giờ trực Standby" nên từ P trở đi lùi 1 cột so với
  // mẫu cũ (Check Q, Activities R, Project S, Work Number T, Identifier U), 5090 đứng trước 5060, thêm AZ/BA (1192-0 / 1192-1), Remarks BB,
  // tháng ở AT3, phòng ban ở AT4. Đọc file: dò cột theo tiêu đề (dòng 8) nên đọc được cả mẫu cũ lẫn mẫu mới.
  const ACT = [
    ['100', 'NI', 22, "100 - Travel (thời gian đi đường đến công trình tỉnh)"],
    ['1193', 'NI', 23, "1193 - NI Quality hour ( pre-work)"],
    ['1110', 'NI', 24, "1110 - NI Prod. Hours Fitter (thời gian lắp đặt)"],
    ['1731', 'NI', 25, "1731 - T&C (Thời gian thử nghiệm và vận hành)"],
    ['1194', 'NI', 26, "1194 - NI Quality Hour ( open item) (Thời gian sửa lỗi và các hạng mục dỡ dang)"],
    ['1720', 'NI', 27, "1720 - NI Inspection (NI/EI handover) - Kiểm tra công trường"],
    ['1900', 'Other', 28, "1900 - Customer Legal Audit"],
    ['1191', 'NI', 29, "1191 - Temporary Maintenance (trực Bảo trì tạm thời trước khi bàn giao EI)"],
    ['1192-0', 'NI', 30, "1192-0 - NI Quality hours-logistics"],
    ['1192-1', 'NI', 31, "1192-1 - NI Quality hours-Material / FI / LPCA / Site Cause"],
    ['1393', 'MOD', 32, "1393 - MOD Quality hour ( Pre-work)"],
    ['1394', 'MOD', 33, "1394 - MOD Quality Hour ( open item)"],
    ['1310', 'MOD', 34, "1310 - MOD Prod. Hours Fitter"],
    ['1392-0', 'MOD', 35, "1392-0 - MOD Quality hours - Logistics"],
    ['1400', 'EI', 36, "1400 - Maintenance (Bảo trì)"],
    ['1500', 'EI', 37, "1500 - Call back"],
    ['1600', 'EI', 38, "1600 - Repair"],
    ['1710', 'TF', 39, "1710 - SAIS Acceptance Test"],
    ['1715', 'TF', 40, "1715 - SAIS Re-Inspection"],
    ['1725', 'TF', 41, "1725 - CPSI"],
    ['1700', 'SAF', 42, "1700 - Safety"],
    ['5010', 'HR', 43, "5010 - Meetings (Họp)"],
    ['5021', 'HR', 44, "5021 - Training-Classroom (Huấn luyện - trong lớp)"],
    ['5022', 'HR', 45, "5022 - Training-On the job (Huấn luyện tại công trường)"],
    ['5040', 'HR', 46, "5040 - Other Administrative Task (nhiệm vụ khác không thuộc công trình)"],
    ['5060', 'HR', 48, "5060 - Safety / Tools Box Meeting (Họp giao ban an toàn)"],
    ['5090', 'NI', 47, "5090/ ES1 (NI) Supervisor, Safety, Travelling time"],
    ['6010', 'HR', 49, "6010/1 - Holiday / Public Holiday / Annual Leave day/hr (Nghỉ hưởng lương)"],
    ['6020', 'HR', 50, "6020 - Illness (day) / Medical / Accident (nghỉ ốm, nghỉ tai nạn)"],
    ['6090', 'HR', 51, "6090 - Unpaid leave (Nghỉ không hưởng lương)"]
  ];
  const ACT_META = ACT.map(([id, cat, col, desc]) => ({ id, cat, col, desc }));
  const ACT_COL = {}; ACT.forEach(([id, , col]) => { ACT_COL[id] = col; });
  const catOf = (code) => (ACT_META.find(a => a.id === code) || { cat: 'Other' }).cat;
  const OT_COL = { OT1: 9, OT2: 10, OT3: 11, OT4: 12, OT5: 13, OT6: 14, OT7: 15 };   // cột I..O của mẫu
  // các cột khác của mẫu 2026
  const COL = { standby: 16, check: 17, act: 18, project: 19, wbs: 20, ident: 21, firstAct: 22, lastAct: 53, remarks: 54, last: 57 };
  const activityToCol = (code) => {
    if (ACT_COL[code] !== undefined) return ACT_COL[code];
    if (code === '1192') return ACT_COL['1192-0'];
    if (code === '1392') return ACT_COL['1392-0'];
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
    // Chặn xuất lệch cột: mẫu phải đúng bố cục 2026 (P = Số giờ trực Standby, S = Project, T = Work Number). Gặp mẫu cũ (trình duyệt còn giữ bản lưu cũ) → báo lỗi.
    const tl = layoutOf(sheet);
    if (!tl || tl.standby !== COL.standby || tl.project !== COL.project || tl.wbs !== COL.wbs || tl.remarks !== COL.remarks) {
        throw new Error('Mẫu bảng chấm công (ts-template.xlsx) không đúng mẫu Schindler 2026 — tải lại trang (Ctrl+F5) rồi xuất lại');
    }

    // Mẫu: dòng 10.. là dòng dữ liệu mẫu (trống), dòng "Total:" (cột F) và khối chữ ký ngay dưới. Chụp kiểu ô TRƯỚC khi sửa.
    const N = COL.last;
    let tplTotal = 0;
    for (let r = 10; r <= 80 && !tplTotal; r++) if (String(cellVal(sheet.getRow(r).getCell(6).value) || '').trim() === 'Total:') tplTotal = r;
    if (!tplTotal) tplTotal = 41;
    const dataStyle = {}, totalStyle = {};
    for (let c = 1; c <= N; c++) {
        dataStyle[c] = cloneStyle(sheet.getRow(11).getCell(c).style);
        totalStyle[c] = cloneStyle(sheet.getRow(tplTotal).getCell(c).style);
    }
    const sigCells = [];
    for (let r = tplTotal + 1; r <= tplTotal + 8; r++) {
        for (let c = 1; c <= N; c++) {
            const cell = sheet.getRow(r).getCell(c);
            const hasTop = cell.border && cell.border.top && cell.border.top.style;
            if (cell.value !== null || hasTop) sigCells.push({ off: r - tplTotal, c, value: cell.value, style: cloneStyle(cell.style) });
        }
    }

    // --- Header fields ---
    sheet.getCell('E3').value = profile.name || '';
    sheet.getCell('E4').value = profile.empId || '';
    sheet.getCell('X4').value = profile.position || '';
    sheet.getCell('AS4').value = ':';
    sheet.getCell('AT4').value = profile.dept || '';
    const [hy, hm] = month.split('-').map(Number);
    sheet.getCell('AT3').value = excelDate(hy, hm, 1);

    // Xoá thân mẫu (dòng mẫu, Total, chữ ký) và phần bảng mới sẽ chiếm: giá trị + kiểu ô
    const clearUntil = Math.max(sheet.rowCount || 0, tplTotal + 12, 10 + sortedData.length + 12);
    for (let r = 10; r <= clearUntil; r++) {
        const row = sheet.getRow(r);
        for (let c = 1; c <= N; c++) { const cell = row.getCell(c); cell.value = null; cell.style = {}; }
        row.height = undefined;
    }

    // --- Data rows (one per entry), starting at row 10 ---
    const A = (c) => sheet.getColumn(c).letter;
    const actRange = (r) => `$${A(COL.firstAct)}${r}:$${A(COL.lastAct)}${r}`;
    sortedData.forEach((e, index) => {
        const r = 10 + index;
        const row = sheet.getRow(r);
        row.height = 25.5;
        for (let c = 1; c <= N; c++) row.getCell(c).style = cloneStyle(dataStyle[c]);

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
        const duty = parseFloat(e.dutyHour) || 0;                 // P: số giờ trực Standby (không tính vào giờ làm)
        if (duty > 0) row.getCell(COL.standby).value = duty;
        row.getCell(COL.check).value = { formula: `MOD(F${r}-E${r},1)*24-SUM(G${r}:O${r})` };   // như mẫu: (To-From)*24 - SUM(G:O) (G:O gồm cả giờ nghỉ H) = 0; MOD: ca qua nửa đêm
        row.getCell(COL.act).value = { formula: `INDEX($${A(COL.firstAct)}$9:$${A(COL.lastAct)}$9,1,MATCH("x",${actRange(r)},0))` };
        row.getCell(COL.project).value = e.projectName || '';
        row.getCell(COL.wbs).value = e.workNumber || '';
        row.getCell(COL.ident).value = { formula: `INDEX($${A(COL.firstAct)}$6:$${A(COL.lastAct)}$6,1,MATCH("x",${actRange(r)},0))` };
        const actCol = activityToCol(e.activityCode);
        if (actCol) {
            const xc = row.getCell(actCol);
            xc.value = 'x';
            xc.font = { name: 'Times New Roman', size: 14 };
            xc.alignment = { horizontal: 'center', vertical: 'middle' };
        }
        row.getCell(COL.remarks).value = e.remarks || '';
    });

    // --- Total row, right after the last data row ---
    const rt = 10 + sortedData.length;
    const totalRow = sheet.getRow(rt);
    totalRow.height = 24.75;
    for (let c = 1; c <= N; c++) totalRow.getCell(c).style = cloneStyle(totalStyle[c]);
    totalRow.getCell(6).value = 'Total:';
    for (let c = 7; c <= COL.check; c++) {
        totalRow.getCell(c).value = { formula: `SUM(${A(c)}10:${A(c)}${rt - 1})` };
    }

    // --- Signature block (Employee / Verified / Approved) ---
    let sigEnd = rt;
    sigCells.forEach(s => {
        const cell = sheet.getRow(rt + s.off).getCell(s.c);
        cell.value = s.value;
        cell.style = cloneStyle(s.style);
        sigEnd = Math.max(sigEnd, rt + s.off);
    });

    sheet.pageSetup.printArea = `A1:${A(COL.remarks)}${sigEnd}`;
    workbook.calcProperties = { fullCalcOnLoad: true };

    const buffer = await workbook.xlsx.writeBuffer();
    const cleanName = removeAccents(profile.name || 'Timesheet');
    const [y, m] = month.split('-');
    return { buffer, name: fileName(profile.name) };
  }

  // Tên file bảng chấm công: tên nhân viên IN HOA không dấu, vd "PHAN ANH DUC.xlsx"
  const plainName = (s) => String(s || 'NHAN VIEN').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase() || 'NHAN VIEN';
  const fileName = (name) => plainName(name) + '.xlsx';

  // ---------- đọc lại file bảng chấm công Excel (mẫu Schindler / file do Timesheet xuất) ----------
  // sheet: worksheet ExcelJS (hoặc giả lập có getCell(addr), getRow(r).getCell(c), rowCount) → { name, empId, position, dept, period, entries[], problems[] }
  // Mỗi dòng: { date, startTime, endTime, breakTime, activityCode, projectName, workNumber, remarks, excel:{ normal, ot:{OT1…} } }
  const COL_ACT = {}; ACT_META.forEach(a => { COL_ACT[a.col] = a.id; });   // cột → mã (mẫu 2026)
  const cellVal = (v) => {
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if ('result' in v) return v.result;
      if (Array.isArray(v.richText)) return v.richText.map(t => t.text).join('');
      if ('text' in v) return v.text;
      return null;
    }
    return v === undefined ? null : v;
  };
  const pad2 = (n) => String(n).padStart(2, '0');
  function asDate(v) {
    v = cellVal(v);
    if (v instanceof Date && !isNaN(v)) return `${v.getUTCFullYear()}-${pad2(v.getUTCMonth() + 1)}-${pad2(v.getUTCDate())}`;
    if (typeof v === 'number' && v > 30000 && v < 80000) return asDate(new Date(Math.round((v - 25569) * 864e5)));      // số ngày Excel
    const s = String(v == null ? '' : v).trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s); if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s); if (m) return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`;
    return '';
  }
  function asTime(v) {
    v = cellVal(v);
    if (v == null || v === '') return '';
    if (v instanceof Date && !isNaN(v)) return v.getTime() === Date.UTC(1899, 11, 30) ? '' : `${pad2(v.getUTCHours())}:${pad2(v.getUTCMinutes())}`;      // 0 giờ của ngày gốc Excel = ô trống
    if (v === 0) return '';       // ô giờ để trống được xuất ra là 0 (00:00)
    if (typeof v === 'number') { const t = Math.round(((v % 1) + 1) % 1 * 1440); return `${pad2(Math.floor(t / 60) % 24)}:${pad2(t % 60)}`; }
    const m = /^(\d{1,2})[:h.](\d{2})/.exec(String(v).trim());
    return m ? `${pad2(m[1])}:${m[2]}` : '';
  }
  const asNum = (v) => { v = cellVal(v); const n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : 0; };
  const asStr = (v) => { v = cellVal(v); return v == null ? '' : String(v).trim(); };

  // Bản đồ cột theo tiêu đề (dòng 8: tiêu đề, dòng 9: mã công việc =LEFT(...,4)) — đọc được mẫu cũ (P = Check) lẫn mẫu 2026 (P = Standby).
  // Không nhận ra tiêu đề → dùng vị trí cột của mẫu cũ.
  const LEGACY = { date: 3, from: 5, to: 6, normal: 7, brk: 8, ot: [9, 10, 11, 12, 13, 14, 15], standby: 0, project: 18, wbs: 19, remarks: 51, acts: null };
  const LEGACY_ACT = { 21: '100', 22: '1193', 23: '1110', 24: '1731', 25: '1194', 26: '1720', 27: '1900', 28: '1191', 29: '1192-0', 30: '1192-1', 31: '1393', 32: '1394', 33: '1310', 34: '1392-0',
    35: '1400', 36: '1500', 37: '1600', 38: '1710', 39: '1715', 40: '1725', 41: '1700', 42: '5010', 43: '5021', 44: '5022', 45: '5040', 46: '5060', 47: '5090', 48: '6010', 49: '6020', 50: '6090' };
  const IDS = new Set(ACT.map(a => a[0]));
  function codeOf(text) {
    const t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    const m = /^(\d{3,4})(?:\s*-\s*(\d))?/.exec(t);
    if (!m) return '';
    const full = m[2] != null ? `${m[1]}-${m[2]}` : m[1];
    if (IDS.has(full)) return full;
    if (m[1] === '1192' || m[1] === '1392') return m[1] + '-0';
    return IDS.has(m[1]) ? m[1] : '';
  }
  function layoutOf(sheet) {
    const h = (c) => String(cellVal(sheet.getRow(8).getCell(c).value) || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const L = { date: 0, from: 0, to: 0, normal: 0, brk: 0, ot: [0, 0, 0, 0, 0, 0, 0], standby: 0, project: 0, wbs: 0, remarks: 0, acts: {} };
    for (let c = 1; c <= 70; c++) {
      const t = h(c);
      if (!t) continue;
      if (!L.date && /^date/.test(t)) L.date = c;
      else if (!L.from && /^from\b/.test(t)) L.from = c;
      else if (!L.to && /^to\b/.test(t)) L.to = c;
      else if (!L.normal && /^normal hour/.test(t)) L.normal = c;
      else if (!L.brk && /^break ?time/.test(t)) L.brk = c;
      else if (/^ot([1-7])\b/.test(t)) L.ot[+/^ot([1-7])/.exec(t)[1] - 1] = c;
      else if (!L.standby && /standby/.test(t)) L.standby = c;
      else if (!L.project && /^project name/.test(t)) L.project = c;
      else if (!L.wbs && /^work number/.test(t)) L.wbs = c;
      else if (!L.remarks && /^remarks?\b/.test(t)) L.remarks = c;
      else if (c > 15) {
        const code = codeOf(t) || codeOf(cellVal(sheet.getRow(9).getCell(c).value));
        if (code) L.acts[c] = code;
      }
    }
    return L.date && L.from && L.to && L.project && L.wbs && Object.keys(L.acts).length >= 10 ? L : null;
  }
  // giá trị ngay bên phải nhãn (vd. "MONTH" → AS3 / AT3), bỏ qua ô chỉ có dấu ":"
  function rightOf(sheet, r, re, accept) {
    const row = sheet.getRow(r);
    for (let c = 1; c <= 60; c++) {
      if (!re.test(String(cellVal(row.getCell(c).value) || '').trim())) continue;
      for (let k = c + 1; k <= c + 6; k++) { const v = cellVal(row.getCell(k).value); if (accept(v)) return v; }
    }
    return null;
  }
  function parseTimesheet(sheet) {
    const g = (addr) => cellVal(sheet.getCell(addr).value);
    const L = layoutOf(sheet) || LEGACY;
    const label = (v) => v != null && String(v).replace(/[:\s]/g, '') !== '';
    const position = rightOf(sheet, 4, /^position/i, label);
    const dept = rightOf(sheet, 4, /^dept/i, (v) => label(v) && !/^\s*:/.test(String(v)));
    const out = { name: asStr(g('E3')), empId: asStr(g('E4')), position: asStr(position != null ? position : g('X4')), dept: asStr(dept != null ? dept : g('AS4')), period: '', entries: [], problems: [] };
    const mo = asDate(rightOf(sheet, 3, /^month/i, (v) => !!asDate(v))) || asDate(g('AS3')) || asDate(g('AT3'));
    if (mo) out.period = mo.slice(0, 7);
    const actCols = L.acts ? Object.keys(L.acts).map(Number).sort((a, b) => a - b) : Object.keys(LEGACY_ACT).map(Number);
    const actOf = (c) => (L.acts ? L.acts[c] : LEGACY_ACT[c]) || '';
    for (let r = 10; r <= (sheet.rowCount || 200); r++) {
      const row = sheet.getRow(r);
      const date = asDate(row.getCell(L.date).value);
      if (!date) continue;                                         // dòng trống / dòng Total / chữ ký
      let code = '';
      for (const c of actCols) { if (String(asStr(row.getCell(c).value)).toLowerCase() === 'x') { code = actOf(c); break; } }
      const ot = {}; L.ot.forEach((c, k) => { const h = c ? asNum(row.getCell(c).value) : 0; if (h) ot['OT' + (k + 1)] = h; });
      const e = { date, startTime: asTime(row.getCell(L.from).value), endTime: asTime(row.getCell(L.to).value), breakTime: String(asNum(row.getCell(L.brk).value)),
        activityCode: code, projectName: asStr(row.getCell(L.project).value), workNumber: asStr(row.getCell(L.wbs).value), remarks: L.remarks ? asStr(row.getCell(L.remarks).value) : '',
        excel: { normal: asNum(row.getCell(L.normal).value), ot }, row: r };
      if (L.standby) { const sb = asNum(row.getCell(L.standby).value); if (sb) e.dutyHour = String(sb); }
      out.entries.push(e);
    }
    if (!out.empId) out.problems.push('Không đọc được mã nhân viên (ô E4)');
    if (!out.period) out.problems.push('Không đọc được tháng của bảng công (ô MONTH — AT3 ở mẫu mới, AS3 ở mẫu cũ)');
    if (!out.entries.length) out.problems.push('Không có dòng chấm công nào (từ dòng 10)');
    out.layout = L === LEGACY ? 'legacy' : (L.standby ? '2026' : 'cũ (theo tiêu đề)');
    return out;
  }

  const TEMPLATE = 'ts-template.xlsx?v=2026.1';   // đổi số khi thay file mẫu → trình duyệt không dùng bản đã lưu cũ
  const api = { TEMPLATE, parseTimesheet, layoutOf, codeOf, COL, COL_ACT, plainName, fileName, buildTimesheet, activityToCol, ACT_COL, ACT_META, catOf, OT_COL, calculateHours, removeAccents };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TsExcel = api;
})(typeof window !== 'undefined' ? window : globalThis);
