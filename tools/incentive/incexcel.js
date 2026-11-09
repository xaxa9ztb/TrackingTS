// Xuất file "List Fitter and Supervisor for Incentive" (Excel, giữ công thức) cho một đợt thưởng SWAT — cùng bố cục
// với file kế toán đang dùng (cột A–W), thêm cột X "Giờ công" để % giờ công (W) tự tính bằng công thức.
//   Trả lần đầu (70% / 100%): P = quỹ (dòng Site-sup: quỹ Site-sup; dòng Fitter đầu: quỹ Fitter), Q = P × O × W, L/M = Q.
//   Đợt cuối (final 30% / 20%): R = quỹ final, S = R × O × W (O = 1 hoặc 0,9), Q = đã nhận đợt 1, T = S − Q, L/M = T.
// Số tiền nhập tay (đã sửa so với công thức) ghi thẳng giá trị và tô cam để dễ thấy.
// Dùng được trong trình duyệt (ExcelJS từ CDN) và Node (kiểm thử).
(function (root) {
  'use strict';
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  const monthLabel = (m) => `${MON[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`;
  const KIND_NOTE = { first70: 'Đợt 1 - 70%', first100: 'Trả 100%', final30: 'Final - đã final bàn giao (30%)', final20: 'Chốt 20% - quá 6 tháng chưa final bàn giao', other: '' };

  function build(ExcelJS, batch, opts = {}) {
    const Inc = opts.Incentive || root.Incentive;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Bộ công cụ dự án';
    const sheetName = `${batch.month.slice(5, 7)} ${batch.month.slice(0, 4)}`;
    const ws = wb.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 2 }] });
    const widths = { A: 5, B: 34, C: 13, D: 11, E: 8, F: 7, G: 12, H: 10, I: 20, J: 22, K: 14, L: 13, M: 13, N: 22, O: 8, P: 14, Q: 14, R: 14, S: 15, T: 15, U: 9, V: 7, W: 9, X: 9 };
    Object.entries(widths).forEach(([c, w]) => { ws.getColumn(c).width = w; });
    const thin = { style: 'thin', color: { argb: 'FFB0B0B0' } };
    const border = { top: thin, left: thin, bottom: thin, right: thin };
    const money = '#,##0';
    const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

    const title = opts.title || `LIST FITTER AND SUPERVISOR FOR INCENTIVE - HN ${monthLabel(batch.month)}`;
    ws.mergeCells('A1:N1');
    ws.getCell('A1').value = title;
    ws.getCell('A1').font = { bold: true, size: 14 };
    const top = { P1: 'Tổng số tiền tạm tính đợt 1', Q1: 'Trả Đợt 1', R1: 'Tổng số tiền Final', S1: 'Tổng tiền cụ thể từng người -FINAL', T1: 'Tổng tiền thanh toán đợt 2 = Final - đợt 1',
      U1: 'Final EI over 60days', V1: 'Check', W1: '% Tỉ lệ Giờ Công', X1: 'Giờ công' };
    const hdr = ['No.', 'Project Name', 'Project Number', 'WBS', 'No. Of passed Units', 'No of stop', 'Product\nLine', 'Month of Final HO to EI ', 'Site-sup\nName', 'Fitter\nName',
      'Incentive Package', 'Site-sup incentive', 'Fitter\nincentive', 'Note', 'Payment Rate'];
    Object.entries(top).forEach(([a, v]) => { ws.mergeCells(`${a}:${a[0]}2`); ws.getCell(a).value = v; });
    hdr.forEach((v, i) => { ws.getRow(2).getCell(i + 1).value = v; });
    [1, 2].forEach(r => ws.getRow(r).eachCell({ includeEmpty: false }, c => {
      if (r === 2 || c.col >= 16) { c.font = { bold: true }; c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }; c.fill = fill('FFDDEBF7'); c.border = border; }
    }));
    ws.getRow(2).height = 42;

    let r = 3, no = 0;
    const firstRows = [], lastRows = [];
    for (const p of batch.projects || []) {
      const k = Inc.KINDS[p.kind] || Inc.KINDS.first70;
      const final = k.stage === 'final';
      const lines = p.lines || [];
      const sup = lines.filter(l => l.role === 'sup'), fit = lines.filter(l => l.role === 'fitter');
      const h = r, first = h + 1, last = h + Math.max(1, sup.length + fit.length);
      const supRows = sup.map((_, i) => first + i), fitRows = fit.map((_, i) => first + sup.length + i);
      const f1 = fitRows[0];
      const row = ws.getRow(h);
      no++;
      row.getCell('A').value = no;
      row.getCell('B').value = p.name || '';
      row.getCell('C').value = p.projectNumber ? (/^\d+$/.test(p.projectNumber) ? Number(p.projectNumber) : p.projectNumber) : null;
      row.getCell('D').value = /^\d+$/.test(p.wbs) ? Number(p.wbs) : p.wbs;
      row.getCell('E').value = p.units || 1;
      row.getCell('F').value = p.stops || null;
      row.getCell('G').value = p.product || '';
      row.getCell('K').value = { formula: `SUM(L${h}:M${last})` };
      row.getCell('N').value = p.note || KIND_NOTE[p.kind] || '';
      row.getCell('O').value = k.rate;
      if (fitRows.length) ws.getCell(`X${h}`).value = { formula: `SUM(X${fitRows[0]}:X${fitRows[fitRows.length - 1]})` };
      const pctF = (rr) => (fitRows.length ? { formula: `IF($X$${h}>0,X${rr}/$X$${h},0)` } : 0);
      if (!final) {
        row.getCell('P').value = { formula: `SUM(P${first}:P${last})` };
        row.getCell('Q').value = { formula: `SUM(Q${first}:Q${last})` };
        row.getCell('V').value = { formula: `ROUND(Q${h}-K${h},0)=0` };
        supRows.forEach((rr, i) => {
          ws.getCell(`I${rr}`).value = sup[i].name;
          ws.getCell(`P${rr}`).value = i === 0 ? Number(p.fundS) || 0 : null;
          ws.getCell(`Q${rr}`).value = i === 0 ? { formula: `P${rr}*$O$${h}` } : 0;
          ws.getCell(`L${rr}`).value = sup[i].manual ? sup[i].amount : { formula: `Q${rr}` };
        });
        fitRows.forEach((rr, i) => {
          ws.getCell(`J${rr}`).value = fit[i].name;
          ws.getCell(`X${rr}`).value = Number(fit[i].hours) || 0;
          ws.getCell(`W${rr}`).value = pctF(rr);
          if (i === 0) ws.getCell(`P${rr}`).value = Number(p.fundF) || 0;
          ws.getCell(`Q${rr}`).value = { formula: `$P$${f1}*$O$${h}*W${rr}` };
          ws.getCell(`M${rr}`).value = fit[i].manual ? fit[i].amount : { formula: `Q${rr}` };
        });
      } else {
        ['Q', 'R', 'S', 'T'].forEach(c => { row.getCell(c).value = { formula: `SUM(${c}${first}:${c}${last})` }; });
        row.getCell('V').value = { formula: `ROUND(T${h}-K${h},0)=0` };
        supRows.forEach((rr, i) => {
          ws.getCell(`I${rr}`).value = sup[i].name;
          ws.getCell(`R${rr}`).value = i === 0 ? Number(p.fundS) || 0 : null;
          ws.getCell(`S${rr}`).value = i === 0 ? { formula: `R${rr}*$O$${h}` } : 0;
          ws.getCell(`Q${rr}`).value = Number(sup[i].before) || 0;
          ws.getCell(`T${rr}`).value = { formula: `S${rr}-Q${rr}` };
          ws.getCell(`L${rr}`).value = sup[i].manual ? sup[i].amount : { formula: `T${rr}` };
        });
        fitRows.forEach((rr, i) => {
          ws.getCell(`J${rr}`).value = fit[i].name;
          ws.getCell(`X${rr}`).value = Number(fit[i].hours) || 0;
          ws.getCell(`W${rr}`).value = pctF(rr);
          if (i === 0) ws.getCell(`R${rr}`).value = Number(p.fundF) || 0;
          ws.getCell(`S${rr}`).value = { formula: `$R$${f1}*$O$${h}*W${rr}` };
          ws.getCell(`Q${rr}`).value = Number(fit[i].before) || 0;
          ws.getCell(`T${rr}`).value = { formula: `S${rr}-Q${rr}` };
          ws.getCell(`M${rr}`).value = fit[i].manual ? fit[i].amount : { formula: `T${rr}` };
        });
      }
      // định dạng khối
      for (let rr = h; rr <= last; rr++) {
        const rw = ws.getRow(rr);
        for (let c = 1; c <= 24; c++) {
          const cell = rw.getCell(c);
          cell.border = border;
          if ([11, 12, 13, 16, 17, 18, 19, 20].includes(c)) cell.numFmt = money;
          if (c === 23 || c === 15) cell.numFmt = '0.0%';
          if (rr === h) { cell.font = { bold: true }; cell.fill = fill('FFF2F2F2'); }
        }
      }
      [...supRows.map((rr, i) => [rr, sup[i], 'L']), ...fitRows.map((rr, i) => [rr, fit[i], 'M'])].forEach(([rr, l, col]) => {
        if (l.manual) ws.getCell(`${col}${rr}`).fill = fill('FFFFC000');
        if (l.empId) ws.getCell(`${l.role === 'sup' ? 'I' : 'J'}${rr}`).note = 'Mã NV ' + l.empId;
      });
      firstRows.push(h); lastRows.push(last);
      r = last + 1;
    }
    const end = r - 1;
    // tổng
    const tr = r + 1;
    ws.getCell(`J${tr}`).value = 'TỔNG';
    ['K', 'L', 'M'].forEach(c => { ws.getCell(`${c}${tr}`).value = { formula: end >= 3 ? `SUM(${c}3:${c}${end})` : '0' }; ws.getCell(`${c}${tr}`).numFmt = money; ws.getCell(`${c}${tr}`).font = { bold: true }; });
    ws.getCell(`K${tr + 1}`).value = { formula: `ROUND(K${tr}-SUM(L${tr}:M${tr}),0)=0` };

    // danh sách theo người (Mã NV) — SUMIF như file kế toán
    const people = Inc.byPerson(batch.projects || []);
    let pr = tr + 3;
    ws.mergeCells(`G${pr}:M${pr}`);
    ws.getCell(`G${pr}`).value = `List of Fitter and Supervisor  derserve Incentive in ${monthLabel(batch.month)}`;
    ws.getCell(`G${pr}`).font = { bold: true };
    pr++;
    const block = (label, role, col, amt, extra) => {
      ws.getCell(`I${pr}`).value = 'Mã NV'; ws.getCell(`J${pr}`).value = label; ws.getCell(`K${pr}`).value = 'Incentive';
      ['I', 'J', 'K', 'L'].forEach(c => { ws.getCell(`${c}${pr}`).font = { bold: true }; ws.getCell(`${c}${pr}`).fill = fill('FFDDEBF7'); });
      pr++;
      const start = pr;
      people.filter(x => x.role === role).forEach(x => {
        ws.getCell(`I${pr}`).value = x.empId ? (/^\d+$/.test(x.empId) ? Number(x.empId) : x.empId) : null;
        ws.getCell(`J${pr}`).value = x.name;
        ws.getCell(`K${pr}`).value = { formula: `SUMIF($${col}$3:$${col}$${Math.max(3, end)},J${pr},$${amt}$3:$${amt}$${Math.max(3, end)})${extra ? extra(pr) : ''}` };
        ws.getCell(`K${pr}`).numFmt = money;
        pr++;
      });
      if (pr > start) { ws.getCell(`L${start}`).value = { formula: `SUM(K${start}:K${pr - 1})` }; ws.getCell(`L${start}`).numFmt = money; }
      return [start, pr - 1];
    };
    // Site-sup: cả tiền Site-sup lẫn tiền Fitter (nếu giám sát có làm fitter ở dự án nào đó) như file gốc
    const [s1, s2] = block('Site-sup name', 'sup', 'I', 'L', (rr) => `+SUMIF($J$3:$J$${Math.max(3, end)},J${rr},$M$3:$M$${Math.max(3, end)})`);
    const [f1r, f2r] = block('Fitter', 'fitter', 'J', 'M');
    ws.getCell(`I${pr}`).value = 'TOTAL';
    ws.getCell(`L${pr}`).value = { formula: `${s2 >= s1 ? `SUM(K${s1}:K${s2})` : '0'}+${f2r >= f1r ? `SUM(K${f1r}:K${f2r})` : '0'}` };
    ws.getCell(`L${pr}`).numFmt = money; ws.getCell(`L${pr}`).font = { bold: true };
    ws.getCell(`M${pr}`).value = { formula: `ROUND(L${pr}-K${tr},0)=0` };
    pr += 2;
    // ký tên
    const sg = batch.signers || {};
    const sign = [['B', 'Prepared - NID', sg.prepared], ['D', 'Agreed -HAN Director', sg.director], ['H', 'Agreed -NID', sg.nid1], ['J', 'Agreed - NID', sg.nid2], ['L', 'Verified - FIN', sg.fin]];
    sign.forEach(([c, lbl, name]) => {
      ws.getCell(`${c}${pr}`).value = lbl; ws.getCell(`${c}${pr}`).font = { bold: true };
      if (name) ws.getCell(`${c}${pr + 5}`).value = name;
    });
    ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printArea: `A1:N${pr + 5}` };
    wb.calcProperties = { fullCalcOnLoad: true };
    return wb;
  }

  const fileName = (batch) => `List Fitter and Supervisor for Incentive - HN ${monthLabel(batch.month)}.xlsx`;
  const api = { build, fileName, monthLabel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.IncExcel = api;
})(typeof window !== 'undefined' ? window : globalThis);
