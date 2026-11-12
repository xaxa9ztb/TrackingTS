// SWAT Analysis (scheme SWAT) — bảng phân tích tiết kiệm của đợt, cùng bố cục file "SWAT Analysis - HN <tháng>" (sheet MMYYYY, cột A–AH,
// công thức như file gốc) + sheet "Standard Saving" (cột Q tra ngay trong file, không còn liên kết file ngoài).
//   Lấy từ dữ liệu: A tháng chi, B chi nhánh, C PM/PE, D Project Number, E WBS, F tên dự án, G số unit, H số điểm dừng,
//   I Product line (ES1.1 / ES1.2 / ES1.3 … → "ES1"), W thưởng SWAT theo Scorecard đã duyệt (Fitter + Site-sup, × unit),
//   AD đã chi các đợt trước, AE chi đợt này, AG = giờ thực tế theo Scorecard (đã dùng + dự phòng). Admin nhập J (YANSPN cost).
// Dùng được trong trình duyệt và Node (kiểm thử).
(function (root) {
  'use strict';
  // Standard saving for S3300 in 2016 theo số điểm dừng (2–20)
  const STD_SAVING = { 2: 27428571, 3: 28571429, 4: 29714286, 5: 30857143, 6: 32000000, 7: 33142857, 8: 34285714, 9: 35428571, 10: 36571429,
    11: 28000000, 12: 29400000, 13: 30800000, 14: 32200000, 15: 33600000, 16: 35000000, 17: 36000000, 18: 37000000, 19: 38000000, 20: 39000000 };
  const DEFAULTS = { branch: 'Ha Noi', offset: 50000000, adjust: 0.815, rate2023: 168000, rate2024: 199000, rate2025: 216000, extraHours: 40 };
  const cfgOf = (c) => ({ ...DEFAULTS, ...(c || {}) });
  // "ES1.1", "ES 1.2", "es1.3" → "ES1"; các dòng khác giữ nguyên
  const productLine = (s) => { const t = String(s || '').trim(); return /^ES\s*1(\.\d+)?\b/i.test(t) && !/^ES\s*1\d/i.test(t) ? 'ES1' : t; };
  const num = (v) => (v === '' || v == null || !isFinite(+v) ? null : +v);

  // các dòng của đợt. ctx: { project(wbs) → {projectNumber, productLine, projectName}, pmName(wbs) → tên, paidBefore(wbs) → số tiền }
  function rows(batch, ctx = {}) {
    return (batch.projects || []).map(p => {
      const pr = (ctx.project && ctx.project(p.wbs)) || {};
      const sc = (p.swat && p.swat.sc) || null, units = Number(p.units) || 1;
      const incentive = sc ? Math.round(((Number(sc.pf) || 0) + (Number(sc.ps) || 0)) * units) : Math.round((Number(p.fundF) || 0) + (Number(p.fundS) || 0));
      // AG = "Giờ thực tế = đã dùng + dự phòng" của Scorecard đã duyệt
      const fitterHours = sc && sc.act != null ? Number(sc.act)
        : sc && sc.used != null ? Number(sc.used) + (Number(sc.reserve) || 0)
        : (p.swat && p.swat.std && p.swat.std.used != null ? Number(p.swat.std.used) : null);
      const a = p.analysis || {};
      // chưa nhập ở đợt này → lấy YANSPN cost đã nhập cho công trình ở đợt trước (vd. đợt 2 / final)
      const prev = num(a.yanspn) == null && ctx.prevYanspn ? ctx.prevYanspn(p.wbs) : null;
      return {
        wbs: p.wbs, projectNumber: pr.projectNumber || p.projectNumber || '', name: p.name || pr.projectName || '',
        pm: (ctx.pmName && ctx.pmName(p.wbs)) || '', units, stops: num(p.stops) != null ? +p.stops : num(pr.stops),
        product: productLine(pr.productLine || p.product || ''), yanspn: num(a.yanspn) != null ? num(a.yanspn) : (prev ? num(prev.yanspn) : null),
        yanspnFrom: num(a.yanspn) == null && prev ? prev.month : '',
        incentive, paidBefore: Math.round(Number(ctx.paidBefore ? ctx.paidBefore(p.wbs) : 0) || 0), paidNow: Math.round(Number(p.total) || 0),
        fitterHours: fitterHours == null || !isFinite(fitterHours) ? null : Math.round(fitterHours * 100) / 100,
      };
    });
  }
  // tính như công thức Excel (để xem ngay trên màn hình); thiếu J → các cột phụ thuộc = null
  function calc(r, c) {
    c = cfgOf(c);
    const div = (a, b) => (a == null || b == null || !b ? null : a / b);
    const K = r.yanspn == null ? null : r.yanspn + c.offset * r.units;
    const L = r.fitterHours == null ? null : r.fitterHours * c.rate2025;
    const M = L == null ? null : c.adjust * L;
    const N = K == null || M == null ? null : K - M;
    const O = K == null || L == null ? null : K - L;
    const Q = STD_SAVING[r.stops] != null ? STD_SAVING[r.stops] : null;
    const R = r.product === 'ES1' ? 8000000 + (r.stops || 0) * 2000000 : 0;
    const S = Q == null ? null : Q - R;
    const W = r.incentive;
    const V = N == null || S == null ? null : N - S;
    const AF = r.fitterHours == null ? null : r.fitterHours + c.extraHours;
    return { K, L, M, N, O, P: div(N, K), Q, R, S, T: O == null ? null : O - W, U: div(K, M), V, W, X: div(V, K), Y: div(W, V), Z: V == null || !V ? null : 1 - W / V,
      AA: V == null || K == null || !K ? null : (V - W) / K, AB: div(W, K), AC: V == null ? null : V - W, AD: r.paidBefore, AE: r.paidNow, AF, AG: r.fitterHours,
      AH: AF ? 1 - r.fitterHours / AF : null };
  }

  const HEAD = ['Month of Incentive Payment', 'Branch', 'PM/PE Name', 'Project Number', 'WBS Number', 'Project Name', 'Number of units', 'No of stop', 'Product Line (S3300 or ES1)',
    'YANSPN cost', 'Labour plan cost', 'Actual Labor in SHAPE (Reflecting SHAPE)', 'Labour actual cost (After Adjustment)', 'Saving with SWAT', 'Saving with SWAT reflecting SHAPE', 'Saving %',
    'Standard saving defined for S3300 in 2016', 'Off set reduction \n\n-(8mil+2mil*stops)\nDiff between IPC (S3300) vs ANC (ES1) ', 'Standard Saving defined for 2021 Scheme',
    'Net savings reflecting SHAPE (after incentive)', 'BE', 'Gap current vs SWAT', 'Incentive applied (if any)', '% var X / plan cost', '% incentive /var X', '%company benefit/Var X',
    '% company benefit/plan cost', '% incentive/ labour plan cost', 'Saving after Incentive', 'Incentive Paid in Past Period', 'To be paid this period', 'Total Time Sheet Hour', 'Fitters hours', 'Non-Fitters %'];
  const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUNE', 'JULY', 'AUG', 'SEPT', 'OCT', 'NOV', 'DEC'];
  const sheetOf = (month) => month.slice(5, 7) + month.slice(0, 4);
  const fileName = (month) => `SWAT Analysis - HN ${MON[+month.slice(5, 7) - 1]} ${month.slice(0, 4)}.xlsx`;

  function build(ExcelJS, batch, list, cfg) {
    const c = cfgOf(cfg);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Bộ công cụ dự án';
    const thin = { style: 'thin', color: { argb: 'FF9E9E9E' } };
    const border = { top: thin, left: thin, bottom: thin, right: thin };
    const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
    const ACC = '_-* #,##0_-;\\-* #,##0_-;_-* "-"??_-;_-@_-', ACC2 = '_(* #,##0_);_(* \\(#,##0\\);_(* "-"??_);_(@_)';

    // ----- sheet tháng -----
    const ws = wb.addWorksheet(sheetOf(batch.month), { views: [{ state: 'frozen', xSplit: 6, ySplit: 7 }] });
    const W = { A: 9, B: 11.6, C: 18, D: 12, E: 11, F: 35, G: 6, H: 6.2, I: 9, J: 14, K: 14.9, L: 16, M: 16, N: 14, O: 14, P: 9, Q: 13.4, R: 16.4, S: 14.2, T: 14, U: 8, V: 12.1, W: 12,
      X: 10.4, Y: 8.9, Z: 11.1, AA: 12.2, AB: 10.1, AC: 12, AD: 14.6, AE: 13, AF: 11, AG: 9, AH: 9 };
    Object.entries(W).forEach(([k, w]) => { ws.getColumn(k).width = w; });
    ws.mergeCells('A1:AH1');
    ws.getCell('A1').value = `SWAT ANALYSIS - HN ${MON[+batch.month.slice(5, 7) - 1]} ${batch.month.slice(0, 4)}`;
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.getCell('N2').value = 'Offset / unit'; ws.getCell('O2').value = c.offset; ws.getCell('O2').numFmt = '#,##0';
    ws.getCell('K3').value = 'Hourly for COM Performance'; ws.getCell('L3').value = { formula: 'L5*L4' }; ws.getCell('L3').numFmt = '#,##0';
    ws.getCell('K4').value = 'Adjustment rate'; ws.getCell('L4').value = c.adjust;
    [['K5', 'L5', '2023 Hourrate on SHAPE', c.rate2023], ['M5', 'N5', '2024 Hourrate on SHAPE', c.rate2024], ['O5', 'P5', '2025 Hourrate on SHAPE', c.rate2025]].forEach(([a, b, l, v]) => {
      ws.getCell(a).value = l; ws.getCell(b).value = v; ws.getCell(b).numFmt = '#,##0'; ws.getCell(b).fill = fill('FFFFF2CC');
    });
    ws.getCell('L4').fill = fill('FFFFF2CC'); ws.getCell('O2').fill = fill('FFFFF2CC');
    ws.getCell('V6').value = 'Gross Saving'; ws.mergeCells('X6:AB6'); ws.getCell('X6').value = 'Var X ~ gross saving after SWAT '; ws.getCell('AC6').value = 'Net Saving';
    ['V6', 'X6', 'AC6'].forEach(a => { ws.getCell(a).font = { bold: true }; ws.getCell(a).alignment = { horizontal: 'center' }; });
    const hr = ws.getRow(7);
    hr.values = HEAD; hr.height = 78;
    hr.eachCell((cell, col) => {
      cell.font = { bold: true, color: { argb: [15, 18, 20].includes(col) ? 'FFFF0000' : 'FF000000' } };
      cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
      cell.fill = fill(col === 10 ? 'FFFFF2CC' : col <= 9 ? 'FFDDEBF7' : col >= 30 ? 'FFE2EFDA' : 'FFF2F2F2'); cell.border = border;
    });
    const first = 8;
    list.forEach((r, i) => {
      const n = first + i, row = ws.getRow(n);
      const f = (x) => ({ formula: x });
      row.values = [new Date(Date.UTC(+batch.month.slice(0, 4), +batch.month.slice(5, 7) - 1, 1)), c.branch, r.pm, r.projectNumber ? (/^\d+$/.test(r.projectNumber) ? +r.projectNumber : r.projectNumber) : '',
        /^\d+$/.test(r.wbs) ? +r.wbs : r.wbs, r.name, r.units, r.stops == null ? '' : r.stops, r.product, r.yanspn == null ? null : r.yanspn,
        f(`J${n}+$O$2*G${n}`), f(`AG${n}*$P$5`), f(`$L$4*L${n}`), f(`K${n}-M${n}`), f(`K${n}-L${n}`), f(`N${n}/K${n}`),
        f(`VLOOKUP(H${n},'Standard Saving'!$B$5:$E$23,2,0)`), f(`IF(I${n}="ES1",8000000+H${n}*2000000,0)`), f(`Q${n}-R${n}`), f(`O${n}-W${n}`), f(`K${n}/M${n}`), f(`N${n}-S${n}`),
        r.incentive, f(`V${n}/K${n}`), f(`W${n}/V${n}`), f(`100%-Y${n}`), f(`(V${n}-W${n})/K${n}`), f(`W${n}/K${n}`), f(`V${n}-W${n}`),
        r.paidBefore || null, r.paidNow, f(`AG${n}+${c.extraHours}`), r.fitterHours == null ? null : r.fitterHours, f(`1-AG${n}/AF${n}`)];
      const fmt = { A: 'mmm-yy', J: '#,##0', K: '#,##0', L: '#,##0', M: '#,##0', N: ACC, O: ACC, P: '0%', Q: ACC, R: ACC, S: ACC, T: ACC2, U: '#,##0.0', V: ACC2, W: '#,##0', X: '0%', Y: '0%',
        Z: '0%', AA: '0%', AB: '0%', AC: ACC2, AD: ACC, AE: ACC, AF: '0', AG: '0', AH: '0%' };
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        if (col > 34) return;
        cell.border = border;
        const L = ws.getColumn(col).letter; if (fmt[L]) cell.numFmt = fmt[L];
        if (col === 10) cell.fill = fill(r.yanspn == null ? 'FFFCE4D6' : 'FFFFF2CC');
      });
    });
    const last = first + list.length - 1;
    if (list.length) {
      const t = ws.getRow(last + 1);
      t.getCell(6).value = 'TOTAL';
      ['J', 'K', 'L', 'M', 'N', 'O', 'T', 'V', 'W', 'AC', 'AD', 'AE', 'AF', 'AG'].forEach(L => { const x = ws.getCell(`${L}${last + 1}`); x.value = { formula: `SUM(${L}${first}:${L}${last})` }; x.numFmt = '#,##0'; });
      for (let col = 1; col <= 34; col++) { const x = t.getCell(col); x.font = { bold: true }; x.fill = fill('FFDDEBF7'); x.border = border; }
    }
    ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

    // ----- sheet Standard Saving (cột Q tra ở đây) -----
    const ss = wb.addWorksheet('Standard Saving');
    [4, 8, 22, 26, 24].forEach((w, i) => { ss.getColumn(i + 1).width = w; });
    ss.mergeCells('A1:G2');
    ss.getCell('A1').value = '1/ Defined Standard Saving for ES1.\n2016-2017 Labor set-up: Labor Planned by SAP=> after study we have define Standard Saving in 2016 for SWAT proposal.\n'
      + '2018: SHAPE - IPC: Installation Proce (based on BEF~0.28 & hourly rate) + Off-set amount (58,000,000+stops*2,000,000) = Labor planned cost.\n'
      + '2021: SHAPE – ANC: Installation Proco (based on BEF~0.28 & hourly rate) + 50,000,000 = Labor planned cost.';
    ss.getCell('A1').alignment = { wrapText: true, vertical: 'top' }; ss.getRow(1).height = 45; ss.getRow(2).height = 45;
    ss.getRow(4).values = ['', 'Stops', 'Standard saving  for S3300 in 2016', 'Off set reduction \n\n-(8mil+2mil*stops)\nDiff between IPC (S3300) vs ANC (ES1) ', 'Defined Standard Saving for ES1'];
    ss.getRow(4).height = 70;
    ss.getRow(4).eachCell(x => { x.font = { bold: true }; x.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }; x.border = border; x.fill = fill('FFDDEBF7'); });
    Object.keys(STD_SAVING).map(Number).sort((a, b) => a - b).forEach((st, i) => {
      const n = 5 + i;
      ss.getRow(n).values = ['', st, STD_SAVING[st], { formula: `8000000+B${n}*2000000` }, { formula: `C${n}-D${n}` }];
      ['B', 'C', 'D', 'E'].forEach(L => { const x = ss.getCell(`${L}${n}`); x.border = border; if (L !== 'B') x.numFmt = '#,##0'; });
    });
    ss.getCell('A6').value = 'Key area of S3300/ES1';
    wb.calcProperties = { fullCalcOnLoad: true };
    return wb;
  }

  const api = { STD_SAVING, DEFAULTS, cfgOf, productLine, rows, calc, build, fileName, sheetOf, HEAD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SwatAnalysis = api;
})(typeof window !== 'undefined' ? window : globalThis);
