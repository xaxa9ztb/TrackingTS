// Incentive (thưởng lắp đặt) — phần tính toán THUẦN, dùng chung cho trình duyệt (tools/incentive) và kiểm thử Node.
// Scheme SWAT (Installation Incentive Scheme): mỗi dự án (WBS) có quỹ thưởng Fitter + quỹ Site-sup theo Scorecard
// (thưởng / unit × số unit). Chia làm 1 hoặc 2 đợt:
//   - Trả lần đầu: 70% (còn lại trả khi final bàn giao) hoặc 100% (trả đủ một lần).
//   - Đợt cuối (dự án đã trả 70%): 30% khi đã final bàn giao (tổng = 100%), hoặc 20% khi quá 6 tháng chưa final bàn giao
//     (tổng = 90%). Số tiền đợt cuối của từng người = quỹ × hệ số × % giờ công − số người đó đã nhận đợt trước
//     (như cột R/S/T trong file "List Fitter and Supervisor for Incentive").
// Fitter chia theo % giờ công trên dự án (giờ của fitter / tổng giờ các fitter); Site-sup nhận quỹ Site-sup.
// Site-sup ở đợt cuối KHÔNG nhận thêm (= 0) khi:
//   - Đợt cuối 30%: ngày final bàn giao quá 60 ngày kể từ ngày bàn giao khách hàng;
//   - Đợt cuối 20%: dự án firstpass quá 6 tháng chưa final được (luôn = 0).
(function (root) {
  'use strict';

  const KINDS = {
    first70: { label: 'Trả lần đầu 70%', short: '70%', stage: 'first', rate: 0.7 },
    first100: { label: 'Trả đủ 100% (một lần)', short: '100%', stage: 'full', rate: 1 },
    final30: { label: 'Đợt cuối 30% — đã final bàn giao', short: 'Final 30%', stage: 'final', rate: 1 },
    final20: { label: 'Đợt cuối 20% — quá 6 tháng chưa final bàn giao', short: 'Final 20%', stage: 'final', rate: 0.9 },
    other: { label: 'Đã chia (dữ liệu cũ)', short: 'Đã chia', stage: 'full', rate: 1 },
  };

  const plain = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ').trim();
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

  // Lịch sử trả thưởng của một dự án → các lựa chọn cho đợt này.
  // history: [{kind, month}] (các đợt đã chốt, không tính đợt đang làm)
  function optionsFor(history) {
    const list = (history || []).filter(h => h && KINDS[h.kind]);
    if (!list.length) return ['first70', 'first100'];
    if (list.some(h => KINDS[h.kind].stage !== 'first')) return [];          // đã trả đủ / đã chốt đợt cuối
    return ['final30', 'final20'];
  }
  // Trạng thái hiển thị của dự án theo lịch sử
  function statusOf(history) {
    const list = (history || []).filter(h => h && KINDS[h.kind]).sort((a, b) => String(a.month).localeCompare(String(b.month)));
    if (!list.length) return { code: 'none', text: 'Chưa trả' };
    const last = list[list.length - 1];
    const done = list.some(h => KINDS[h.kind].stage !== 'first');
    const m = String(last.month || '');
    const when = m ? `${m.slice(5, 7)}/${m.slice(0, 4)}` : '';
    if (done) return { code: 'done', text: `Đã trả đủ (${KINDS[last.kind].short}${when ? ' · ' + when : ''})` };
    return { code: 'first', text: `Đã trả 70%${when ? ' · ' + when : ''}`, since: m };
  }
  // số tháng từ đợt trả lần đầu đến tháng `month` (để nhắc "quá 6 tháng chưa final")
  function monthsBetween(a, b) {
    if (!/^\d{4}-\d{2}$/.test(a || '') || !/^\d{4}-\d{2}$/.test(b || '')) return 0;
    return (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));
  }

  // Tính bảng chia thưởng của MỘT dự án.
  // p: { kind, fundF, fundS, sup: {empId, name} | null, fitters: [{empId, name, hours, amount?(nhập tay)}],
  //      paid: {key → số đã nhận ở các đợt trước (dự án này)} với key = empId hoặc 'n:' + tên không dấu }
  // → { lines: [{role, empId, name, hours, pct, total, before, amount, manual}], fitterTotal, supTotal, total, rate }
  function keyOf(x) { return x && x.empId ? String(x.empId) : 'n:' + plain(x && x.name); }
  // số đã nhận đợt trước: theo Mã NV, không có thì theo tên (lịch sử nhập từ file cũ có thể thiếu Mã NV)
  function paidOf(paid, x) {
    if (x && x.empId && paid[String(x.empId)] != null) return Number(paid[String(x.empId)]) || 0;
    return Number(paid['n:' + plain(x && x.name)]) || 0;
  }
  // bảng "đã nhận" của một dự án từ lịch sử: mỗi khoản cộng vào cả khoá Mã NV (nếu có) lẫn khoá tên
  function paidMap(items) {
    const m = {};
    (items || []).forEach(h => (h.lines || []).forEach(l => {
      const a = Number(l.amount) || 0;
      if (l.empId) m[String(l.empId)] = r2((m[String(l.empId)] || 0) + a);
      const nk = 'n:' + plain(l.name);
      m[nk] = r2((m[nk] || 0) + a);
    }));
    return m;
  }
  const FINAL_LATE_DAYS = 60;
  const dayNo = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? Math.round(Date.parse(iso + 'T00:00:00Z') / 864e5) : null);
  // Quy tắc Site-sup ở đợt cuối → { zero, reason, days, need }
  //   need = true: đợt 30% nhưng chưa nhập đủ ngày bàn giao khách hàng / ngày final bàn giao để kiểm tra
  function supRule(p) {
    if (p.kind === 'final20') return { zero: true, reason: 'Đợt cuối 20%: dự án firstpass quá 6 tháng chưa final — Site-sup không nhận thêm' };
    if (p.kind !== 'final30') return { zero: false };
    const a = dayNo(p.handoverDate), b = dayNo(p.finalDate);
    if (a == null || b == null) return { zero: false, need: true };
    const days = b - a;
    if (days > FINAL_LATE_DAYS) return { zero: true, days, reason: `Final bàn giao sau ${days} ngày kể từ ngày bàn giao khách hàng (quá ${FINAL_LATE_DAYS} ngày) — Site-sup không nhận thêm` };
    return { zero: false, days };
  }
  function compute(p) {
    const k = KINDS[p.kind] || KINDS.first70;
    const rule = supRule(p);
    const rate = k.rate, final = k.stage === 'final';
    const paid = p.paid || {};
    const fundF = Number(p.fundF) || 0, fundS = Number(p.fundS) || 0;
    const fitters = (p.fitters || []).filter(f => f && (f.name || f.empId));
    const hoursSum = fitters.reduce((s, f) => s + Math.max(0, Number(f.hours) || 0), 0);
    const lines = [];
    if (p.sup && (p.sup.name || p.sup.empId)) {
      const total = r2(fundS * rate), before = final ? r2(paidOf(paid, p.sup)) : 0;
      const auto = rule.zero ? 0 : r2(total - before);
      const manual = p.sup.amount != null && p.sup.amount !== '' && isFinite(+p.sup.amount);
      lines.push({ role: 'sup', empId: p.sup.empId || '', name: p.sup.name || '', hours: null, pct: null, total, before, auto, amount: manual ? r2(+p.sup.amount) : auto, manual });
    }
    fitters.forEach(f => {
      const h = Math.max(0, Number(f.hours) || 0);
      const pct = hoursSum > 0 ? h / hoursSum : (fitters.length ? 1 / fitters.length : 0);
      const total = r2(fundF * rate * pct), before = final ? r2(paidOf(paid, f)) : 0;
      const auto = r2(total - before);
      const manual = f.amount != null && f.amount !== '' && isFinite(+f.amount);
      lines.push({ role: 'fitter', empId: f.empId || '', name: f.name || '', hours: h, pct, total, before, auto, amount: manual ? r2(+f.amount) : auto, manual });
    });
    // đợt cuối: người đã nhận đợt trước mà nay không còn trong danh sách → vẫn giữ để thấy (không chia thêm)
    const fitterTotal = r2(lines.filter(l => l.role === 'fitter').reduce((s, l) => s + l.amount, 0));
    const supTotal = r2(lines.filter(l => l.role === 'sup').reduce((s, l) => s + l.amount, 0));
    return { lines, fitterTotal, supTotal, total: r2(fitterTotal + supTotal), rate, final, hoursSum, supRule: rule };
  }

  // Tổng hợp theo người cho cả đợt: [{role, empId, name, amount, projects}]
  function byPerson(projects) {
    const m = new Map();
    (projects || []).forEach(pr => (pr.lines || []).forEach(l => {
      const k = l.role + '|' + keyOf(l);
      const cur = m.get(k) || { role: l.role, empId: l.empId || '', name: l.name, amount: 0, projects: 0 };
      cur.amount = r2(cur.amount + (Number(l.amount) || 0)); cur.projects++;
      if (!cur.empId && l.empId) cur.empId = l.empId;
      m.set(k, cur);
    }));
    return [...m.values()].sort((a, b) => (a.role === b.role ? b.amount - a.amount : a.role === 'sup' ? -1 : 1));
  }

  // ---------- đọc file Excel "List Fitter and Supervisor for Incentive" ----------
  // book: { sheets: [{ name, hidden, cell(r, c) → {v, f} | null, rows }] } — r, c tính từ 1 (cột A = 1).
  // → [{ sheet, hidden, month, title, projects: [{wbs, projectNumber, name, units, stops, product, kind, rate, note,
  //        lines: [{role, empId, name, amount, pct, total, before}]}], warnings }]
  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  function monthOfSheet(name, title) {
    const pad = (n) => String(n).padStart(2, '0');
    let m = /^\s*(\d{1,2})[ .\-/](\d{4})\s*$/.exec(name || '');
    if (m && +m[1] >= 1 && +m[1] <= 12) return `${m[2]}-${pad(+m[1])}`;
    const pick = (s) => {
      const t = String(s || '').toLowerCase();
      const mm = /(jan|feb|mar|apr|april|may|june|jun|july|jul|aug|sept|sep|oct|nov|dec)[a-z]*[ .\-]*'?(\d{4}|\d{2})\b/.exec(t);
      if (!mm) return '';
      const y = mm[2].length === 2 ? '20' + mm[2] : mm[2];
      return `${y}-${pad(MONTHS[mm[1]])}`;
    };
    return pick(title) || pick(name);
  }
  const num = (x) => (x == null || x === '' ? null : (typeof x === 'number' ? x : (/^-?[\d.,\s]+$/.test(String(x).trim()) ? Number(String(x).replace(/[\s.]/g, '').replace(',', '.')) : null)));
  const txt = (x) => (x == null ? '' : String(x).trim());

  function parseSheet(sh) {
    const val = (r, c) => { const x = sh.cell(r, c); return x ? x.v : null; };
    const fml = (r, c) => { const x = sh.cell(r, c); return x && x.f ? String(x.f) : ''; };
    const maxR = sh.rows || 400, maxC = 40;
    // dòng tiêu đề: có "Fitter" ở cột J
    let hr = 0;
    for (let r = 1; r <= 6 && !hr; r++) if (/fitter/i.test(txt(val(r, 10))) && /site/i.test(txt(val(r, 9)))) hr = r;
    if (!hr) return null;
    const title = txt(val(1, 1)) || txt(val(hr - 1, 1));
    const month = monthOfSheet(sh.name, title);
    // tìm cột theo tiêu đề (dòng tiêu đề và dòng ngay trên)
    const head = (re) => { for (let c = 1; c <= maxC; c++) for (const r of [hr, hr - 1]) if (r >= 1 && re.test(txt(val(r, c)).replace(/\s+/g, ' '))) return c; return 0; };
    const cPct = head(/%\s*t[iỉ]\s*l[eệ]/i), cHours = head(/t[ổo]ng s[ốo] gi[ờo] c[ôo]ng/i);
    const cFinalPay = head(/thanh to[áa]n đ[ợo]t 2|final - đ[ợo]t 1/i);   // T (mới) hoặc Y (01/2025)
    const cRateHead = head(/payment rate/i);
    const cNote = head(/^note$/i);
    const cPaid1 = head(/^tr[ảa] đ[ợo]t 1$/i), cFinalEach = head(/t[ừu]ng ng[ưu][ờo]i|t[ổo]ng ti[ềe]n đi[ềe]u ch[ỉi]nh/i);
    const warnings = [];
    // danh sách Mã NV ở cuối sheet (I = mã, J = tên)
    const roster = new Map();
    let end = maxR + 1;
    let fileTotal = null;     // ô tổng cột K (=SUM(K3:K…)) trong file — để đối chiếu
    for (let r = hr + 1; r <= maxR; r++) {
      const a = txt(val(r, 7)) + ' ' + txt(val(r, 9));
      if (/list of fitter|m[ãa] nv/i.test(a)) { if (r < end) end = r; }
      if (/^=?\s*SUM\(K\d+:K\d+\)/i.test(fml(r, 11)) && !txt(val(r, 2)) && !txt(val(r, 9)) && !txt(val(r, 10)) && r < end) { end = r; fileTotal = num(val(r, 11)); }
    }
    for (let r = end; r <= maxR; r++) {
      const id = txt(val(r, 9)), nm = txt(val(r, 10));
      if (/^\d{5,9}$/.test(id) && nm && !/fitter|site-?sup|name/i.test(nm)) roster.set(plain(nm), id);
    }
    const projects = [];
    let cur = null;
    const isWbs = (x) => /^\d{8}$/.test(txt(x));
    for (let r = hr + 1; r < end; r++) {
      const name = txt(val(r, 2)), sup = txt(val(r, 9)), fit = txt(val(r, 10));
      if (name && !sup && !fit) {
        const c3 = txt(val(r, 3)), c4 = txt(val(r, 4));
        const wbs = isWbs(c4) ? c4 : isWbs(c3) ? c3 : (c4 || c3);
        const pn = /^\d{9}$/.test(c3) ? c3 : /^\d{9}$/.test(c4) ? c4 : '';
        // tỉ lệ trả: cột "Payment Rate", hoặc số 0 < x ≤ 1 đầu tiên ở cột N..S của dòng dự án
        let rate = cRateHead ? num(val(r, cRateHead)) : null;
        if (rate == null || !(rate > 0 && rate <= 1)) { rate = null; for (let c = 14; c <= 19 && rate == null; c++) { const x = val(r, c); if (typeof x === 'number' && x > 0 && x <= 1) rate = x; } }
        const note = cNote ? txt(val(r, cNote)) : '';
        const finalRow = cFinalPay && (val(r, cFinalPay) != null || fml(r, cFinalPay));
        let kind = 'other';
        if (cFinalPay || cRateHead || rate != null) {
          if (finalRow) kind = (/20\s*%/.test(note) || rate === 0.9) ? 'final20' : 'final30';
          else kind = rate === 1 ? 'first100' : 'first70';
        }
        cur = { wbs, projectNumber: pn, name, units: num(val(r, 5)) || 1, stops: num(val(r, 6)) || null, product: txt(val(r, 7)), kind, rate, note, lines: [] };
        projects.push(cur);
        continue;
      }
      if (!cur || (!sup && !fit)) continue;
      // một dòng có thể ghi cả tên Site-sup (I) lẫn Fitter (J): mỗi vai có số tiền riêng (L / M)
      const roles = [];
      if (fit) roles.push(['fitter', fit, 13]);
      if (sup && (!fit || num(val(r, 12)) != null)) roles.push(['sup', sup, 12]);
      for (const [role, nm, col] of roles) {
        let amount = num(val(r, col));
        if (amount == null && fml(r, col)) amount = 0;     // công thức không lưu kết quả (= 0)
        if (amount == null) { warnings.push(`${sh.name}: dòng ${r} (${nm}) không có số tiền`); continue; }
        const pct = role === 'fitter' && cPct ? num(val(r, cPct)) : null;
        const line = { role, empId: roster.get(plain(nm)) || '', name: nm, amount: r2(amount), pct };
        if (cHours && role === 'fitter') line.hours = num(val(r, cHours));
        if (cPaid1 && cur.kind.startsWith('final')) line.before = r2(num(val(r, cPaid1)) || 0);
        if (cFinalEach && cur.kind.startsWith('final')) line.total = r2(num(val(r, cFinalEach)) || 0);
        // cùng người hai dòng trong một dự án → cộng dồn
        const dup = cur.lines.find(l => l.role === role && plain(l.name) === plain(nm));
        if (dup) { dup.amount = r2(dup.amount + line.amount); if (line.pct != null) dup.pct = (dup.pct || 0) + line.pct; }
        else cur.lines.push(line);
      }
    }
    // % giờ công: đưa về phân số 0..1 (sheet ghi 0,82 hoặc 82,2)
    projects.forEach(p => {
      const ps = p.lines.filter(l => l.role === 'fitter' && l.pct != null).map(l => l.pct);
      const scale = ps.length && Math.max(...ps) > 1.0001 ? 100 : 1;
      p.lines.forEach(l => { if (l.pct != null) l.pct = l.pct / scale; });
      p.total = r2(p.lines.reduce((s, l) => s + l.amount, 0));
    });
    const kept = projects.filter(p => p.lines.length);
    const total = r2(kept.reduce((s, p) => s + p.total, 0));
    const matches = fileTotal == null ? null : Math.abs(fileTotal - total) < 1;
    if (matches === false) warnings.unshift(`${sh.name}: tổng đọc được ${Math.round(total).toLocaleString('vi-VN')} khác ô tổng trong file ${Math.round(fileTotal).toLocaleString('vi-VN')} (định dạng cũ?) — kiểm tra trước khi nhập`);
    return { sheet: sh.name, hidden: !!sh.hidden, month, title, projects: kept, warnings, total, fileTotal, matches };
  }
  function parseWorkbook(book) {
    return (book.sheets || []).map(parseSheet).filter(x => x && x.projects.length && x.month);
  }

  // ExcelJS Workbook → book cho parseWorkbook (giá trị đã tính sẵn trong file + công thức)
  function bookFromExcelJS(wb) {
    const sheets = [];
    wb.eachSheet(ws => {
      sheets.push({
        name: ws.name, hidden: ws.state && ws.state !== 'visible', rows: Math.min(ws.rowCount || 0, 2000),
        cell(r, c) {
          const v = ws.getRow(r).getCell(c).value;
          if (v == null) return null;
          if (typeof v === 'object' && !(v instanceof Date)) {
            if ('formula' in v || 'sharedFormula' in v) return { v: v.result != null && typeof v.result === 'object' ? (v.result.error ? null : null) : v.result, f: '=' + (v.formula || v.sharedFormula || '') };
            if (v.richText) return { v: v.richText.map(t => t.text).join('') };
            if ('text' in v) return { v: v.text };
            if (v.error) return { v: null };
          }
          return { v };
        },
      });
    });
    return { sheets };
  }

  const api = { bookFromExcelJS, KINDS, FINAL_LATE_DAYS, supRule, plain, r2, keyOf, paidOf, paidMap, optionsFor, statusOf, monthsBetween, compute, byPerson, monthOfSheet, parseSheet, parseWorkbook };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Incentive = api;
})(typeof window !== 'undefined' ? window : globalThis);
