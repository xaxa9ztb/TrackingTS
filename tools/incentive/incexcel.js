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
      row.getCell('N').value = p.note || ((KIND_NOTE[p.kind] || '') + (p.supRule && p.supRule.zero && !p.imported ? ' — Site-sup = 0' + (p.supRule.days != null ? ` (final sau ${p.supRule.days} ngày)` : '') : ''));
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

  // ===== Báo cáo tổng quan chi thưởng của đợt (Admin / kế toán đọc nhanh) =====
  // Sheet "Tổng quan": số tổng + bảng theo dự án (quỹ, Fitter / Site-sup nhận, ngày bàn giao, GHI CHÚ vì sao Site-sup = 0)
  //   + mục "Quy định" và danh sách dự án KHÔNG chi thưởng giám sát (final quá 60 ngày / đợt 20%) + chữ ký.
  // Sheet "Theo người": tổng theo người (Site-sup, Fitter). Sheet "Chi tiết": từng dòng chia thưởng theo dự án.
  const vnDate = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
  const KIND_VN = { first70: 'Đợt 1 – 70%', first100: 'Trả đủ 100%', final30: 'Đợt cuối 30% (đã final)', final20: 'Đợt cuối 20% (quá 6 tháng chưa final)' };
  // ghi chú Site-sup của một dự án → { text, zero, warn }
  function supNote(Inc, p) {
    const rule = Inc.supRule(p);
    const sup = (p.lines || []).find(l => l.role === 'sup');
    const supAmt = sup ? Number(sup.amount) || 0 : 0;
    if (rule.zero && p.kind === 'final30') return { zero: true, text: `KHÔNG chi thưởng giám sát: final bàn giao sau ${rule.days} ngày kể từ ngày bàn giao khách hàng (quá ${Inc.FINAL_LATE_DAYS} ngày)` + (supAmt ? ` — LƯU Ý: đang nhập tay ${supAmt.toLocaleString('vi-VN')} đ` : '') };
    if (rule.zero) return { zero: true, text: 'KHÔNG chi thưởng giám sát: đợt cuối 20% — dự án firstpass quá 6 tháng chưa final bàn giao' + (supAmt ? ` — LƯU Ý: đang nhập tay ${supAmt.toLocaleString('vi-VN')} đ` : '') };
    if (rule.need) return p.imported ? { zero: !supAmt, text: supAmt ? 'Theo file Excel (không có ngày bàn giao để kiểm tra điều kiện 60 ngày)' : 'Site-sup = 0 theo file Excel' }
      : { warn: true, text: `LƯU Ý: chưa nhập ngày bàn giao khách hàng / ngày final — chưa kiểm tra điều kiện ${Inc.FINAL_LATE_DAYS} ngày` };
    if (p.kind === 'final30' && rule.days != null) return { text: `Final sau ${rule.days} ngày (trong ${Inc.FINAL_LATE_DAYS} ngày) — giám sát nhận đủ` };
    if (sup && sup.manual) return { text: 'Site-sup: số tiền nhập tay' };
    return { text: '' };
  }

  function buildOverview(ExcelJS, batch, opts = {}) {
    const Inc = opts.Incentive || root.Incentive;
    const projects = batch.projects || [];
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Bộ công cụ dự án';
    const thin = { style: 'thin', color: { argb: 'FFB0B0B0' } };
    const border = { top: thin, left: thin, bottom: thin, right: thin };
    const money = '#,##0';
    const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
    const head = (row) => row.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = fill('FF1F4E79'); c.border = border; c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }; });
    const sum = (f) => Math.round(projects.reduce((s, p) => s + (Number(f(p)) || 0), 0));
    const amt = (p, role) => (p.lines || []).filter(l => l.role === role).reduce((s, l) => s + (Number(l.amount) || 0), 0);

    // ---------- Sheet 1: Tổng quan ----------
    const ws = wb.addWorksheet('Tổng quan', { views: [{ showGridLines: false }] });
    const W = [5, 13, 38, 20, 14, 14, 14, 14, 15, 12, 12, 8, 60];
    W.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    ws.mergeCells('A1:M1');
    ws.getCell('A1').value = `BÁO CÁO TỔNG QUAN CHI THƯỞNG SWAT — ĐỢT ${batch.month.slice(5, 7)}/${batch.month.slice(0, 4)}`;
    ws.getCell('A1').font = { bold: true, size: 15, color: { argb: 'FF1F4E79' } };
    ws.mergeCells('A2:M2');
    ws.getCell('A2').value = [batch.title, batch.status === 'done' ? 'Đã chốt' : 'Bản nháp (chưa chốt)', batch.publishedAt ? 'Đã phát hành' : '', 'Xuất ngày ' + vnDate(opts.today || new Date().toISOString().slice(0, 10))].filter(Boolean).join(' · ');
    ws.getCell('A2').font = { italic: true, color: { argb: 'FF595959' } };
    const people = Inc.byPerson(projects).filter(x => x.amount);
    const tf = sum(p => amt(p, 'fitter')), ts = sum(p => amt(p, 'sup'));
    const zeroList = projects.map(p => ({ p, n: supNote(Inc, p) })).filter(x => x.n.zero && Inc.supRule(x.p).zero);
    const kpi = [['Tổng chi đợt này (đ)', tf + ts], ['Fitter (đ)', tf], ['Site-sup (đ)', ts], ['Số dự án', projects.length],
      ['Người nhận', `${people.filter(x => x.role === 'fitter').length} fitter · ${people.filter(x => x.role === 'sup').length} site-sup`], ['Dự án không chi giám sát', zeroList.length]];
    let r = 4;
    kpi.forEach(([l, v], i) => {
      const col = 1 + (i % 3) * 4, row = r + Math.floor(i / 3) * 2;
      ws.mergeCells(row, col, row, col + 2); ws.mergeCells(row + 1, col, row + 1, col + 2);
      const a = ws.getCell(row, col), b = ws.getCell(row + 1, col);
      a.value = l; a.font = { color: { argb: 'FF595959' } }; a.fill = fill('FFF2F6FB');
      b.value = v; b.font = { bold: true, size: 13, color: { argb: i === 5 && v ? 'FFC00000' : 'FF000000' } }; b.fill = fill('FFF2F6FB');
      if (typeof v === 'number' && i < 3) b.numFmt = money;
      b.alignment = { horizontal: 'left' };
    });
    r = 9;
    const H = ['STT', 'WBS', 'Dự án', 'Đợt trả', 'Quỹ Fitter', 'Quỹ Site-sup', 'Fitter nhận', 'Site-sup nhận', 'Tổng chi', 'Ngày BG khách hàng', 'Ngày final BG', 'Số ngày', 'Ghi chú'];
    ws.getRow(r).values = H; head(ws.getRow(r)); ws.getRow(r).height = 32;
    ws.views = [{ state: 'frozen', ySplit: r, showGridLines: false }];
    const first = r + 1;
    projects.forEach((p, i) => {
      r++;
      const n = supNote(Inc, p), rule = Inc.supRule(p);
      const row = ws.getRow(r);
      row.values = [i + 1, p.wbs, p.name || '', KIND_VN[p.kind] || p.kind, Number(p.fundF) || 0, Number(p.fundS) || 0, amt(p, 'fitter'), amt(p, 'sup'), amt(p, 'fitter') + amt(p, 'sup'),
        vnDate(p.handoverDate), vnDate(p.finalDate), rule.days != null ? rule.days : '', n.text];
      row.eachCell({ includeEmpty: true }, (c, col) => { if (col > 13) return; c.border = border; c.alignment = { vertical: 'top', wrapText: col === 3 || col === 4 || col === 13, horizontal: col >= 10 && col <= 12 ? 'center' : undefined }; if (col >= 5 && col <= 9) c.numFmt = money; });
      if (n.zero && rule.zero) { row.eachCell({ includeEmpty: true }, (c, col) => { if (col <= 13) c.fill = fill('FFFDE9E7'); }); ws.getCell(r, 13).font = { bold: true, color: { argb: 'FFC00000' } }; ws.getCell(r, 8).font = { bold: true, color: { argb: 'FFC00000' } }; }
      else if (n.warn) ws.getCell(r, 13).font = { color: { argb: 'FFB45F06' } };
    });
    r++;
    const tot = ws.getRow(r);
    tot.getCell(3).value = 'TỔNG CỘNG';
    [5, 6, 7, 8, 9].forEach(c => { const L = String.fromCharCode(64 + c); tot.getCell(c).value = projects.length ? { formula: `SUM(${L}${first}:${L}${r - 1})`, result: [sum(p => p.fundF), sum(p => p.fundS), tf, ts, tf + ts][c - 5] } : 0; tot.getCell(c).numFmt = money; });
    for (let c = 1; c <= 13; c++) { const x = tot.getCell(c); x.font = { bold: true }; x.fill = fill('FFDDEBF7'); x.border = border; }

    // quy định + danh sách không chi giám sát
    r += 2;
    ws.mergeCells(r, 1, r, 13); ws.getCell(r, 1).value = 'QUY ĐỊNH CHI THƯỞNG GIÁM SÁT (SITE-SUP) Ở ĐỢT CUỐI'; ws.getCell(r, 1).font = { bold: true, color: { argb: 'FF1F4E79' } };
    const rules = [
      `1. Đợt cuối 30% (dự án đã final bàn giao): nếu ngày final bàn giao QUÁ ${Inc.FINAL_LATE_DAYS} NGÀY kể từ ngày bàn giao khách hàng thì KHÔNG chi thưởng cho giám sát (Site-sup = 0). Fitter vẫn nhận theo tỉ lệ giờ công.`,
      '2. Đợt cuối 20% (dự án firstpass quá 6 tháng chưa final bàn giao): KHÔNG chi thưởng cho giám sát (Site-sup = 0). Fitter nhận 90% quỹ final.',
      '3. Dòng tô đỏ trong bảng trên là dự án KHÔNG chi thưởng giám sát ở đợt này; lý do ghi ở cột "Ghi chú".'];
    rules.forEach(t => { r++; ws.mergeCells(r, 1, r, 13); ws.getCell(r, 1).value = t; ws.getCell(r, 1).alignment = { wrapText: true, vertical: 'top' }; ws.getRow(r).height = 30; });
    r += 2;
    ws.mergeCells(r, 1, r, 13);
    ws.getCell(r, 1).value = zeroList.length ? `DỰ ÁN KHÔNG CHI THƯỞNG GIÁM SÁT TRONG ĐỢT NÀY (${zeroList.length})` : 'Đợt này không có dự án nào bị trừ thưởng giám sát.';
    ws.getCell(r, 1).font = { bold: true, color: { argb: zeroList.length ? 'FFC00000' : 'FF375623' } };
    zeroList.forEach(({ p, n }, i) => {
      r++;
      const sup = (p.sup && p.sup.name) || ((p.lines || []).find(l => l.role === 'sup') || {}).name || '';
      ws.mergeCells(r, 1, r, 13);
      ws.getCell(r, 1).value = `${i + 1}. ${p.wbs} — ${p.name || ''}${sup ? ` (giám sát: ${sup})` : ''}: ${n.text}` + (p.handoverDate || p.finalDate ? ` [BG khách hàng ${vnDate(p.handoverDate) || '?'} → final ${vnDate(p.finalDate) || '?'}]` : '');
      ws.getCell(r, 1).alignment = { wrapText: true, vertical: 'top' }; ws.getRow(r).height = 30;
    });
    // ký tên
    r += 3;
    const sg = batch.signers || {};
    [[2, 'Prepared - NID', sg.prepared], [4, 'Agreed - HAN Director', sg.director], [7, 'Agreed - NID', sg.nid1], [9, 'Agreed - NID', sg.nid2], [13, 'Verified - FIN', sg.fin]].forEach(([c, l, n]) => {
      ws.getCell(r, c).value = l; ws.getCell(r, c).font = { bold: true };
      if (n) ws.getCell(r + 5, c).value = n;
    });
    ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } };

    // ---------- Sheet 2: Theo người ----------
    const wp = wb.addWorksheet('Theo người', { views: [{ state: 'frozen', ySplit: 1 }] });
    [12, 32, 12, 10, 16].forEach((w, i) => { wp.getColumn(i + 1).width = w; });
    wp.getRow(1).values = ['Vai trò', 'Họ tên', 'Mã NV', 'Số dự án', 'Tiền thưởng (đ)']; head(wp.getRow(1));
    let pr = 1;
    ['sup', 'fitter'].forEach(role => {
      const g = people.filter(x => x.role === role).sort((a, b) => b.amount - a.amount);
      g.forEach(x => { pr++; wp.getRow(pr).values = [role === 'sup' ? 'Site-sup' : 'Fitter', x.name, x.empId || '—', x.projects, x.amount]; });
      pr++; const t = wp.getRow(pr);
      t.values = ['', `Cộng ${role === 'sup' ? 'Site-sup' : 'Fitter'} (${g.length} người)`, '', '', Math.round(g.reduce((s, x) => s + x.amount, 0))];
      t.eachCell(c => { c.font = { bold: true }; c.fill = fill('FFDDEBF7'); });
    });
    pr++; wp.getRow(pr).values = ['', 'TỔNG CỘNG', '', '', tf + ts]; wp.getRow(pr).font = { bold: true };
    wp.eachRow((row, i) => { if (i > 1) row.eachCell({ includeEmpty: true }, (c, col) => { if (col <= 5) { c.border = border; if (col === 5) c.numFmt = money; } }); });

    // ---------- Sheet 3: Chi tiết ----------
    const wd = wb.addWorksheet('Chi tiết', { views: [{ state: 'frozen', ySplit: 1 }] });
    [12, 36, 16, 10, 30, 12, 10, 10, 16].forEach((w, i) => { wd.getColumn(i + 1).width = w; });
    wd.getRow(1).values = ['WBS', 'Dự án', 'Đợt trả', 'Vai trò', 'Họ tên', 'Mã NV', 'Giờ công', '% giờ', 'Tiền thưởng (đ)']; head(wd.getRow(1));
    let dr = 1;
    projects.forEach(p => (p.lines || []).forEach(l => {
      dr++;
      wd.getRow(dr).values = [p.wbs, p.name || '', KIND_VN[p.kind] || p.kind, l.role === 'sup' ? 'Site-sup' : 'Fitter', l.name || '', l.empId || '—', l.hours == null ? '' : Number(l.hours),
        l.pct == null ? '' : Number(l.pct), Number(l.amount) || 0];
      wd.getRow(dr).eachCell({ includeEmpty: true }, (c, col) => { if (col <= 9) c.border = border; if (col === 9) c.numFmt = money; if (col === 8) c.numFmt = '0.0%'; });
      if (l.role === 'sup' && Inc.supRule(p).zero) wd.getRow(dr).eachCell({ includeEmpty: true }, (c, col) => { if (col <= 9) c.fill = fill('FFFDE9E7'); });
    }));
    return wb;
  }
  const overviewName = (batch) => `Bao cao tong quan chi thuong SWAT - ${batch.month.slice(5, 7)}-${batch.month.slice(0, 4)}.xlsx`;
  const api = { build, fileName, monthLabel, buildOverview, overviewName, supNote };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.IncExcel = api;
})(typeof window !== 'undefined' ? window : globalThis);
