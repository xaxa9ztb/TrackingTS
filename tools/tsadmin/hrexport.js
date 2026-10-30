// Xuất hàng loạt cho HR (Admin / Admin dự án): các bảng công đã duyệt xong của một kỳ lương → 1 file zip gồm 2 thư mục
//   "Bảng công/"  : mỗi nhân viên 1 file Excel (TEN VIET LIEN KHONG DAU.xlsx)
//   "Phụ cấp/"    : "Pc Xe - thang M YYYY.xlsx" (mọi phụ cấp xe đi tỉnh, mỗi nhân viên 1 tab) và "Pc Xang - thang M YYYY.xlsx" (phụ cấp xăng, mỗi nhân viên 1 tab)
// Chạy hoàn toàn trên trình duyệt của Admin (Workers không đủ CPU dựng Excel); không gửi email.
// Thư viện (ExcelJS, JSZip, TsExcel, TsAllowance) và mẫu Excel được truyền vào để dùng được cả trong Node khi kiểm thử.
(function (root) {
  'use strict';

  const BAD = /[\[\]:*?\/\\]/g;
  // Tên tab Excel: tối đa 31 ký tự, không có []:*?/\ ; trùng thì thêm mã nhân viên
  function sheetName(name, empId, used) {
    const clean = String(name || empId).replace(BAD, ' ').replace(/\s+/g, ' ').trim() || String(empId);
    let n = clean.slice(0, 31);
    if (used.has(n.toLowerCase())) n = (clean.slice(0, 31 - String(empId).length - 3) + ' (' + empId + ')').slice(0, 31);
    for (let i = 2; used.has(n.toLowerCase()); i++) n = (n.slice(0, 28) + ' ' + i).slice(0, 31);
    used.add(n.toLowerCase());
    return n;
  }
  const monthLabel = (period) => `thang ${parseInt(String(period).slice(5), 10)} ${String(period).slice(0, 4)}`;
  const periodRange = (p) => { const [y, m] = p.split('-').map(Number); const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1; const f = (n) => String(n).padStart(2, '0'); return { start: `${py}-${f(pm)}-16`, end: `${y}-${f(m)}-15` }; };

  // docs: [{empId, name, position, data:{entries, allow}}]; tpl: { timesheet: ArrayBuffer, allowance: ArrayBuffer }
  async function build({ ExcelJS, JSZip, TsExcel, TsAllowance }, { docs, period, tpl, today, onProgress }) {
    const zip = new JSZip();
    const tsDir = zip.folder('Bảng công'), pcDir = zip.folder('Phụ cấp');
    const masters = { province: { wb: new ExcelJS.Workbook(), used: new Set(), n: 0 }, fuel: { wb: new ExcelJS.Workbook(), used: new Set(), n: 0 } };
    const usedFiles = new Set(), skipped = [];
    const range = periodRange(period);
    let done = 0;
    for (const d of docs) {
      const entries = (d.data && d.data.entries) || [];
      const ts = await TsExcel.buildTimesheet(ExcelJS, tpl.timesheet, { entries, bdOf: (e) => e.bd || {}, profile: { name: d.name, empId: d.empId, position: d.position, dept: 'NI' }, month: period });
      let fn = ts.name;
      if (usedFiles.has(fn.toLowerCase())) fn = fn.replace(/\.xlsx$/i, '') + ' ' + d.empId + '.xlsx';
      usedFiles.add(fn.toLowerCase());
      tsDir.file(fn, ts.buffer);

      const allow = TsAllowance.compute(entries, (d.data && d.data.allow) || { rows: [] }, range);
      for (const type of ['province', 'fuel']) {
        if (!allow.rows.some(x => x.type === type)) continue;
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(tpl.allowance);
        TsAllowance.fillWorkbook(wb, { name: d.name, empId: d.empId, computed: allow, date: today });
        TsAllowance.keepSheet(wb, type);
        const src = wb.worksheets[0], m = masters[type];
        const name = sheetName(d.name, d.empId, m.used);
        const ws = m.wb.addWorksheet(name);
        ws.model = Object.assign({}, src.model, { mergeCells: src.model.merges, name });   // không nhân bản bằng JSON: sẽ làm hỏng ô ngày
        ws.name = name;
        m.n++;
      }
      if (onProgress) onProgress(++done, docs.length);
    }
    const files = { tsCount: docs.length, province: masters.province.n, fuel: masters.fuel.n };
    if (masters.province.n) pcDir.file(`Pc Xe - ${monthLabel(period)}.xlsx`, await masters.province.wb.xlsx.writeBuffer());
    if (masters.fuel.n) pcDir.file(`Pc Xang - ${monthLabel(period)}.xlsx`, await masters.fuel.wb.xlsx.writeBuffer());
    const blob = await zip.generateAsync({ type: root.Blob ? 'blob' : 'nodebuffer', compression: 'DEFLATE' });
    return { blob, name: `HR - Bang cong va phu cap - ky ${period.slice(5)}-${period.slice(0, 4)}.zip`, files, skipped };
  }

  const api = { build, sheetName, monthLabel, periodRange };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TsHrExport = api;
})(typeof window !== 'undefined' ? window : globalThis);
