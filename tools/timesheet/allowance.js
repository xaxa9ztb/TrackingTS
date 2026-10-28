// Phụ cấp xe của Timesheet cá nhân — dùng chung cho trình duyệt (Timesheet, Duyệt bảng công) và máy chủ (server/api.mjs).
//
// Hai loại (theo mẫu "Bảng phụ cấp xe" của phòng NI):
//   fuel      Phụ cấp xăng xe: dự án cách trụ sở chính từ 25 km đến dưới 35 km — 60.000 đ / ngày làm việc tại dự án
//   province  Phụ cấp xe đi tỉnh: làm dự án tỉnh TRÊN 20 ngày trong kỳ và tự mang xe máy đi — 1.000.000 đ / tháng
// Fitter chọn loại, dự án (WBS tự điền) và khoảng ngày; SỐ NGÀY luôn tính từ chính các dòng chấm công của dự án đó
// trong khoảng đã chọn (không tính ngày nghỉ phép), nên không khai khống được. Một ngày chỉ được tính xăng xe một lần.
// Dữ liệu nằm trong bảng công của kỳ: data.allow = { rows: [...], u: thời điểm sửa } (gộp giữa các máy: bản sửa sau thắng).
// Hàm thuần — kiểm thử bằng Node (test/client/allowance.test.mjs).
(function (root) {
  'use strict';

  const TYPES = {
    fuel: {
      label: 'Phụ cấp xăng xe', short: 'Xăng xe', rate: 60000,
      rule: 'Dự án cách trụ sở chính từ 25 km đến dưới 35 km · 60.000 đ / ngày làm việc tại dự án',
    },
    province: {
      label: 'Phụ cấp xe đi tỉnh', short: 'Xe đi tỉnh', amount: 1000000, minDays: 21,
      rule: 'Làm dự án tỉnh trên 20 ngày trong kỳ và tự mang xe máy đi · 1.000.000 đ / tháng',
    },
  };
  const MAX_ROWS = { fuel: 11, province: 1 };      // số dòng của mẫu Excel / mỗi kỳ chỉ một phụ cấp đi tỉnh
  const LEAVE_CODES = ['6010', '6020', '6090'];
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const norm = (s) => String(s == null ? '' : s).trim().toUpperCase();
  const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const fmtDMY = (d) => String(d).split('-').reverse().join('/');
  const money = (n) => Math.round(n).toLocaleString('vi-VN');

  // Các ngày (YYYY-MM-DD) có chấm công làm việc tại dự án `wbs` trong [from, to]
  function workDates(entries, wbs, from, to) {
    const w = norm(wbs), out = new Set();
    if (!w) return [];
    (entries || []).forEach((e) => {
      if (!e || typeof e.date !== 'string' || e.date < from || e.date > to) return;
      if (LEAVE_CODES.includes(String(e.activityCode))) return;
      if (norm(e.workNumber) === w) out.add(e.date);
    });
    return [...out].sort();
  }

  // Dự án đã chấm công trong [start, end] → [{ wbs, project, first, last, days }] (nhiều ngày nhất trước)
  function projectsOf(entries, start, end) {
    const m = new Map();
    (entries || []).forEach((e) => {
      if (!e || e.date < start || e.date > end || LEAVE_CODES.includes(String(e.activityCode))) return;
      const w = norm(e.workNumber);
      if (!w) return;
      const p = m.get(w) || { wbs: String(e.workNumber).trim(), project: String(e.projectName || '').trim(), dates: new Set() };
      p.dates.add(e.date);
      if (!p.project && e.projectName) p.project = String(e.projectName).trim();
      m.set(w, p);
    });
    return [...m.values()].map((p) => {
      const d = [...p.dates].sort();
      return { wbs: p.wbs, project: p.project, first: d[0], last: d[d.length - 1], days: d.length };
    }).sort((a, b) => b.days - a.days || a.wbs.localeCompare(b.wbs));
  }

  // Làm sạch dữ liệu phụ cấp (máy chủ khi lưu bảng công; máy khách trước khi lưu). Sai → ném Error.
  // range = { start, end } của kỳ lương. input null/undefined → null (kỳ không có phụ cấp).
  function sanitize(input, range) {
    if (input === null || input === undefined) return null;
    if (typeof input !== 'object' || Array.isArray(input)) throw new Error('Phụ cấp xe không hợp lệ');
    const rows = Array.isArray(input.rows) ? input.rows : [];
    if (rows.length > MAX_ROWS.fuel + MAX_ROWS.province + 4) throw new Error('Quá nhiều dòng phụ cấp xe');
    const out = [], seen = new Set();
    rows.forEach((r) => {
      if (!r || typeof r !== 'object' || Array.isArray(r)) throw new Error('Có dòng phụ cấp xe không hợp lệ');
      const id = String(r.id == null ? '' : r.id);
      if (!/^\d{1,16}$/.test(id)) throw new Error('Dòng phụ cấp xe thiếu mã (id)');
      if (seen.has(id)) return;
      seen.add(id);
      if (!TYPES[r.type]) throw new Error('Loại phụ cấp xe không hợp lệ');
      if (!DATE_RE.test(String(r.from)) || !DATE_RE.test(String(r.to))) throw new Error('Ngày của phụ cấp xe không hợp lệ');
      if (range && (r.from < range.start || r.to > range.end)) throw new Error(`Phụ cấp xe phải nằm trong kỳ lương ${fmtDMY(range.start)} → ${fmtDMY(range.end)}`);
      out.push({
        id, type: r.type, wbs: str(r.wbs, 100), project: str(r.project, 200), from: r.from, to: r.to,
        location: str(r.location, 200), remarks: str(r.remarks, 300), ownVehicle: r.type === 'province' ? !!r.ownVehicle : false,
      });
    });
    return { rows: out, u: Number(input.u) || 0 };
  }

  // Số ngày, số tiền và các lỗi của từng dòng + tổng. entries = các dòng chấm công của kỳ.
  function compute(entries, allow, range) {
    const rows = (allow && Array.isArray(allow.rows)) ? allow.rows : [];
    const res = rows.map((r) => ({ ...r, days: 0, amount: 0, overlap: 0, problems: [] }));
    const byId = new Map(res.map((x) => [x.id, x]));
    const fuelWbs = new Set(rows.filter((r) => r.type === 'fuel').map((r) => norm(r.wbs)));
    const used = new Set(), seenType = { fuel: 0, province: 0 };
    rows.slice().sort((a, b) => String(a.from).localeCompare(String(b.from)) || String(a.id).localeCompare(String(b.id))).forEach((r) => {
      const x = byId.get(r.id);
      if (!TYPES[r.type]) { x.problems.push('Loại phụ cấp không hợp lệ'); return; }
      seenType[r.type]++;
      if (seenType[r.type] > MAX_ROWS[r.type]) x.problems.push(r.type === 'province' ? 'Mỗi kỳ chỉ có một phụ cấp xe đi tỉnh' : `Tối đa ${MAX_ROWS.fuel} dòng phụ cấp xăng xe`);
      if (!norm(r.wbs)) x.problems.push('Chưa chọn dự án');
      if (r.from > r.to) x.problems.push('Ngày bắt đầu sau ngày kết thúc');
      if (range && (r.from < range.start || r.to > range.end)) x.problems.push('Ngoài kỳ lương');
      const dates = norm(r.wbs) && r.from <= r.to ? workDates(entries, r.wbs, r.from, r.to) : [];
      if (r.type === 'fuel') {
        const fresh = dates.filter((d) => !used.has(d));
        fresh.forEach((d) => used.add(d));
        x.days = fresh.length; x.overlap = dates.length - fresh.length;
        x.amount = x.days * TYPES.fuel.rate;
        if (norm(r.wbs) && !dates.length) x.problems.push('Không có ngày chấm công ở dự án này trong khoảng đã chọn');
      } else {
        x.days = dates.length;
        if (x.days < TYPES.province.minDays) x.problems.push(`Cần làm dự án tỉnh trên 20 ngày trong kỳ (đang có ${x.days} ngày chấm công)`);
        if (!r.ownVehicle) x.problems.push('Chưa xác nhận tự mang xe máy đi');
        if (fuelWbs.has(norm(r.wbs))) x.problems.push('Dự án này đã có phụ cấp xăng xe');
        x.amount = TYPES.province.amount;
      }
    });
    const fuel = res.filter((x) => x.type === 'fuel'), prov = res.filter((x) => x.type === 'province');
    const sum = (list, k) => list.reduce((a, x) => a + (x[k] || 0), 0);
    const totals = { fuelDays: sum(fuel, 'days'), fuelAmount: sum(fuel, 'amount'), provinceAmount: sum(prov, 'amount') };
    totals.amount = totals.fuelAmount + totals.provinceAmount;
    const problems = res.flatMap((x) => x.problems.map((p) => `${TYPES[x.type] ? TYPES[x.type].short : '?'} · ${x.wbs || 'chưa chọn dự án'}: ${p}`));
    return { rows: res, totals, problems, ok: problems.length === 0 };
  }

  // Một dòng tóm tắt (email, hộp xác nhận nộp)
  function summary(c) {
    if (!c || !c.rows.length) return '';
    const parts = [];
    if (c.totals.fuelAmount) parts.push(`Xăng xe ${c.totals.fuelDays} ngày = ${money(c.totals.fuelAmount)} đ`);
    if (c.rows.some((x) => x.type === 'province')) parts.push(`Xe đi tỉnh ${money(c.totals.provinceAmount)} đ`);
    return `${parts.join(' · ')} — tổng ${money(c.totals.amount)} đ`;
  }

  // ---------- Excel theo mẫu "Bảng phụ cấp xe" (phucap-xe-template.xlsx, 2 sheet) ----------
  const xd = (iso) => { const [y, m, d] = String(iso).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };   // ExcelJS ghi ngày theo UTC
  const FUEL_ROW0 = 8, FUEL_ROWS = 11, PROV_ROW0 = 10, PROV_ROWS = 8;
  // wb: workbook ExcelJS đã nạp mẫu; info = { name, empId, computed (kết quả compute), date (YYYY-MM-DD ngày lập) }
  function fillWorkbook(wb, info) {
    const c = info.computed;
    const fuel = c.rows.filter((x) => x.type === 'fuel').sort((a, b) => a.from.localeCompare(b.from)).slice(0, FUEL_ROWS);
    const prov = c.rows.filter((x) => x.type === 'province').slice(0, PROV_ROWS);
    const s1 = wb.getWorksheet('Xăng xe 60K') || wb.worksheets[0];
    const s2 = wb.getWorksheet('Phụ cấp Xe đi tỉnh') || wb.worksheets[1];
    if (s1) {
      const dateFmt = s1.getCell(`E${FUEL_ROW0}`).numFmt || 'dd/mm/yyyy', moneyFmt = s1.getCell(`H${FUEL_ROW0}`).numFmt || '#,##0';
      for (let i = 0; i < FUEL_ROWS; i++) {                    // xoá dòng mẫu
        const r = FUEL_ROW0 + i;
        'ABCDEFGHIJ'.split('').forEach((k) => { s1.getCell(`${k}${r}`).value = null; });
      }
      fuel.forEach((x, i) => {
        const r = FUEL_ROW0 + i;
        s1.getCell(`A${r}`).value = info.empId || '';
        s1.getCell(`B${r}`).value = info.name || '';
        s1.getCell(`C${r}`).value = x.wbs;
        s1.getCell(`D${r}`).value = x.project;
        s1.getCell(`E${r}`).value = xd(x.from); s1.getCell(`E${r}`).numFmt = dateFmt;
        s1.getCell(`F${r}`).value = xd(x.to); s1.getCell(`F${r}`).numFmt = dateFmt;
        s1.getCell(`G${r}`).value = x.days;                     // số ngày có chấm công tại dự án (đã trừ ngày trùng)
        s1.getCell(`H${r}`).value = { formula: `G${r}*${TYPES.fuel.rate}`, result: x.amount }; s1.getCell(`H${r}`).numFmt = moneyFmt;
        s1.getCell(`I${r}`).value = x.location;
        s1.getCell(`J${r}`).value = x.remarks;
        ['A', 'B', 'C', 'D', 'G', 'H', 'I'].forEach((k) => { s1.getCell(`${k}${r}`).alignment = { horizontal: k === 'D' || k === 'I' ? 'left' : 'center', vertical: 'middle', wrapText: true }; });
      });
      s1.getCell(`G${FUEL_ROW0 + FUEL_ROWS}`).value = { formula: `SUM(G${FUEL_ROW0}:G${FUEL_ROW0 + FUEL_ROWS - 1})`, result: c.totals.fuelDays };
      s1.getCell(`H${FUEL_ROW0 + FUEL_ROWS}`).value = { formula: `SUM(H${FUEL_ROW0}:H${FUEL_ROW0 + FUEL_ROWS - 1})`, result: c.totals.fuelAmount };
      s1.getCell('A21').value = `Claimed by: ${info.name || '……………………………….'}`;
    }
    if (s2) {
      s2.getCell('F6').value = fmtDMY(info.date || '');
      for (let i = 0; i < PROV_ROWS; i++) 'ABCDEFG'.split('').forEach((k) => { s2.getCell(`${k}${PROV_ROW0 + i}`).value = null; });
      prov.forEach((x, i) => {
        const r = PROV_ROW0 + i;
        s2.getCell(`A${r}`).value = info.empId || '';
        s2.getCell(`B${r}`).value = info.name || '';
        s2.getCell(`C${r}`).value = x.wbs;
        s2.getCell(`D${r}`).value = x.location;
        s2.getCell(`E${r}`).value = `${fmtDMY(x.from)} – ${fmtDMY(x.to)}`;
        s2.getCell(`F${r}`).value = x.amount; s2.getCell(`F${r}`).numFmt = '#,##0';
        s2.getCell(`G${r}`).value = [x.project, `${x.days} ngày`, x.remarks].filter(Boolean).join(' · ');
        'ABCDEFG'.split('').forEach((k) => { s2.getCell(`${k}${r}`).alignment = { horizontal: k === 'D' || k === 'G' ? 'left' : 'center', vertical: 'middle', wrapText: true }; });
      });
      s2.getCell('A21').value = `Claimed by: ${info.name || '…………………………………………'}`;
    }
    return wb;
  }
  const fileName = (name, period) => {
    const clean = String(name || 'Nhan_vien').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
    return `Phu_cap_xe_${clean}_Thang_${String(period).slice(5)}_${String(period).slice(0, 4)}.xlsx`;
  };

  const api = { TYPES, MAX_ROWS, LEAVE_CODES, workDates, projectsOf, sanitize, compute, summary, fillWorkbook, fileName, money };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TsAllowance = api;
})(typeof window !== 'undefined' ? window : globalThis);
