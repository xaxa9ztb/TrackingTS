// Hồ sơ Dự án › Bìa & trang ký bản vẽ: tạo trang bìa + trang "Duyệt bản vẽ thi công" (A3 ngang, PDF),
// ghép trước các file bản vẽ người dùng tải lên. Dùng pdf-lib + fontkit + phông Tinos (Apache 2.0, metric như Times New Roman).
// Mọi xử lý trên trình duyệt — bản vẽ không gửi lên máy chủ.
(function (root) {
  'use strict';
  const A3 = [1190.55, 841.89];
  const PAPER = [['A0', 2384, 3370], ['A1', 1684, 2384], ['A2', 1191, 1684], ['A3', 842, 1191], ['A4', 595, 842]];
  // khổ giấy của một trang PDF (sai số 4%)
  function paperName(w, h) {
    const a = Math.min(w, h), b = Math.max(w, h);
    const f = PAPER.find(([, x, y]) => Math.abs(a - x) / x < 0.04 && Math.abs(b - y) / y < 0.04);
    return f ? f[0] : `${Math.round(a / 72 * 25.4)}×${Math.round(b / 72 * 25.4)}`;
  }
  const S = (v) => String(v == null ? '' : v).trim();
  const up = (v) => S(v).toLocaleUpperCase('vi');
  const DOT = '………………………';

  function wrap(text, font, size, maxW) {
    const out = [];
    S(text).split('\n').forEach((para) => {
      let line = '';
      para.split(/\s+/).forEach((w) => {
        const t = line ? line + ' ' + w : w;
        if (font.widthOfTextAtSize(t, size) <= maxW || !line) line = t; else { out.push(line); line = w; }
      });
      out.push(line);
    });
    return out;
  }
  function pen(page, F) {
    const H = page.getHeight();
    const k = { color: undefined };
    // văn bản theo toạ độ tính từ MÉP TRÊN; align: left | center | right (x là mép trái / tâm / mép phải)
    function text(t, x, top, o = {}) {
      const font = F[o.f || 'r'], size = o.s || 10;
      let lines = o.w ? wrap(t, font, size, o.w) : [S(t)];
      if (o.maxLines) lines = lines.slice(0, o.maxLines);
      lines.forEach((ln, i) => {
        const w = font.widthOfTextAtSize(ln, size);
        const xx = o.a === 'center' ? x - w / 2 : o.a === 'right' ? x - w : x;
        page.drawText(ln, { x: xx, y: H - top - size - i * size * (o.lh || 1.25), size, font, color: o.color || k.color });
      });
      return lines.length * size * (o.lh || 1.25);
    }
    const rect = (x, top, w, h, o = {}) => page.drawRectangle({ x, y: H - top - h, width: w, height: h, borderWidth: o.bw == null ? 0.8 : o.bw, borderColor: o.bc, color: o.fill });
    const line = (x1, t1, x2, t2, o = {}) => page.drawLine({ start: { x: x1, y: H - t1 }, end: { x: x2, y: H - t2 }, thickness: o.t || 0.8, color: o.color });
    return { text, rect, line, H, W: page.getWidth() };
  }

  // D: { chuDauTu, banQLDA, tieuDe, phuDe, heThong, congTrinh, diaDiem, hangMuc, hopDong, thietBi, nhaThau, nhaThauDiaChi, noiLap, ngay(YYYY-MM-DD),
  //      drawings:[{so, ten, kho}], ky:[{title, org, ten, chucVu}] }
  async function buildCover(PDFLib, fontkit, fonts, D) {
    const { PDFDocument, rgb } = PDFLib;
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const F = { r: await doc.embedFont(fonts.r, { subset: false }), b: await doc.embedFont(fonts.b, { subset: false }), i: await doc.embedFont(fonts.i, { subset: false }) };
    F.bi = fonts.bi ? await doc.embedFont(fonts.bi, { subset: false }) : F.b;
    doc.setTitle('Bìa và trang ký bản vẽ — ' + S(D.congTrinh));
    doc.setCreator('Hồ sơ Dự án');
    const black = rgb(0, 0, 0), grey = rgb(0.35, 0.35, 0.35), band = rgb(0.9, 0.92, 0.95);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(D.ngay || '');
    const noi = S(D.noiLap) || 'Hà Nội';
    const nDwg = (D.drawings || []).length;
    const khoList = [...new Set((D.drawings || []).map(x => S(x.kho)).filter(Boolean))].join(', ');
    const soBanVe = S(D.soBanVe) || (nDwg ? `${String(nDwg).padStart(2, '0')} bản vẽ${khoList ? ' khổ ' + khoList : ''}` : DOT);

    // ---------- trang 1: bìa ----------
    const p1 = doc.addPage(A3), a = pen(p1, F), cx = a.W / 2;
    a.rect(28, 28, a.W - 56, a.H - 56, { bw: 2.2, bc: black });
    a.rect(34, 34, a.W - 68, a.H - 68, { bw: 0.6, bc: black });
    let y = 92;
    if (S(D.chuDauTu)) y += a.text('CHỦ ĐẦU TƯ: ' + up(D.chuDauTu), cx, y, { f: 'b', s: 11, a: 'center', w: 900 }) + 4;
    if (S(D.banQLDA)) y += a.text(up(D.banQLDA), cx, y, { f: 'b', s: 11, a: 'center', w: 900 });
    a.text(up(D.tieuDe || 'BẢN VẼ THI CÔNG'), cx, 190, { f: 'b', s: 40, a: 'center' });
    a.text(S(D.phuDe || '(SHOP DRAWING)'), cx, 240, { f: 'i', s: 15, a: 'center', color: grey });
    a.text(up(D.heThong || 'HỆ THỐNG THANG MÁY'), cx, 272, { f: 'b', s: 26, a: 'center' });
    a.line(cx - 300, 318, cx + 300, 318, { t: 1.2 });
    const rows = [['CÔNG TRÌNH', D.congTrinh], ['ĐỊA ĐIỂM', D.diaDiem], ['HẠNG MỤC', D.hangMuc || 'Cung cấp và lắp đặt hệ thống thang máy'], ['HỢP ĐỒNG', D.hopDong],
      ['THIẾT BỊ', D.thietBi], ['SỐ LƯỢNG BẢN VẼ', soBanVe]].filter(r => S(r[1]));
    y = 352;
    const lx = cx - 300;
    rows.forEach(([k, v]) => { a.text(k, lx, y, { f: 'b', s: 11 }); a.text(':', lx + 175, y, { f: 'b', s: 11 }); y += Math.max(22, a.text(v, lx + 195, y, { s: 11, w: 400 }) + 8); });
    y = Math.max(y + 30, 560);
    a.text('NHÀ THẦU CUNG CẤP, LẮP ĐẶT', cx, y, { f: 'b', s: 11, a: 'center' });
    a.text(up(D.nhaThau || 'Chi nhánh Công ty TNHH Schindler Việt Nam tại Hà Nội'), cx, y + 20, { f: 'b', s: 17, a: 'center' });
    if (S(D.nhaThauDiaChi)) a.text(D.nhaThauDiaChi, cx, y + 44, { f: 'i', s: 9.5, a: 'center', color: grey, w: 800 });
    a.text(`${up(noi)}, THÁNG ${m ? m[2] : '……'} NĂM ${m ? m[1] : new Date().getFullYear()}`, cx, a.H - 92, { f: 'i', s: 11, a: 'center' });

    // ---------- trang 2+: duyệt bản vẽ + danh mục + khối ký ----------
    const list = (D.drawings || []).map((x, i) => [String(i + 1), S(x.so), S(x.ten), S(x.kho)]);
    const SIG_TOP = 548, FULL_BOTTOM = 790, HEAD_TOP = 276;
    const capFull = Math.floor((FULL_BOTTOM - HEAD_TOP) / 18), capSig = Math.floor((SIG_TOP - 16 - HEAD_TOP) / 13);
    const chunks = [];
    let rest = list.slice();
    while (rest.length > capSig) { const k = Math.min(capFull, rest.length - 1); chunks.push(rest.slice(0, k)); rest = rest.slice(k); }
    chunks.push(rest);
    const COLS = [[60, 40, 'TT', 'center'], [100, 120, 'Số hiệu bản vẽ', 'center'], [220, 820, 'Tên bản vẽ', 'left'], [1040, 90, 'Khổ giấy', 'center']];
    chunks.forEach((ch, ci) => {
      const last = ci === chunks.length - 1;
      const pg = doc.addPage(A3), b = pen(pg, F), cx2 = b.W / 2;
      b.rect(28, 28, b.W - 56, b.H - 56, { bw: 1.4, bc: black });
      b.text(ci ? 'DUYỆT BẢN VẼ THI CÔNG (tiếp)' : 'DUYỆT BẢN VẼ THI CÔNG', cx2, 62, { f: 'b', s: 26, a: 'center' });
      b.text(`${up(D.heThong || 'HỆ THỐNG THANG MÁY')} – CÔNG TRÌNH ${up(D.congTrinh) || DOT}`, cx2, 98, { f: 'b', s: 14, a: 'center', w: 1000, maxLines: 2 });
      if (S(D.hopDong)) b.text('Hợp đồng số ' + D.hopDong, cx2, 120, { f: 'i', s: 10, a: 'center' });
      let yy = 150;
      [['Chủ đầu tư', D.chuDauTu], ['Ban quản lý dự án', D.banQLDA], ['Nhà thầu cung cấp, lắp đặt', D.nhaThau || 'Chi nhánh Công ty TNHH Schindler Việt Nam tại Hà Nội'], ['Địa điểm xây dựng', D.diaDiem]]
        .filter(r => S(r[1])).forEach(([k, v]) => { b.text(k, 70, yy, { f: 'b', s: 10 }); b.text(': ' + (k === 'Địa điểm xây dựng' ? S(v) : up(v)), 250, yy, { s: 10, w: 860, maxLines: 1 }); yy += 16; });
      b.text('DANH MỤC BẢN VẼ', 60, 236, { f: 'b', s: 11 });
      const rh = last ? (ch.length <= Math.floor((SIG_TOP - 16 - HEAD_TOP) / 18) ? 18 : 13) : 18, fs = rh === 18 ? 9.5 : 8.5;
      b.rect(60, 258, 1070, 18, { bw: 0.6, bc: black, fill: band });
      COLS.forEach(([x, w, t, al]) => b.text(t, al === 'center' ? x + w / 2 : x + 6, 262, { f: 'b', s: 9.5, a: al }));
      ch.forEach((row, ri) => {
        const top = HEAD_TOP + ri * rh;
        b.rect(60, top, 1070, rh, { bw: 0.5, bc: black });
        COLS.forEach(([x, w, , al], k) => b.text(row[k], al === 'center' ? x + w / 2 : x + 6, top + (rh - fs) / 2 - 1, { s: fs, a: al, maxLines: 1, w: w - 10 }));
      });
      [100, 220, 1040].forEach(x => b.line(x, 258, x, HEAD_TOP + ch.length * rh, { t: 0.5 }));
      if (!ch.length) b.text('(chưa có bản vẽ — thêm ở danh mục)', 595, HEAD_TOP + 4, { f: 'i', s: 9, a: 'center', color: grey });
      if (!last) { b.text(`Trang ${ci + 2}`, 1130, 800, { f: 'i', s: 8, a: 'right', color: grey }); return; }
      // khối ký 3 cột
      const ky = (D.ky && D.ky.length ? D.ky : [{ title: 'CHỦ ĐẦU TƯ', org: D.chuDauTu }, { title: 'BAN QUẢN LÝ DỰ ÁN / TƯ VẤN GIÁM SÁT', org: D.banQLDA }, { title: 'NHÀ THẦU CUNG CẤP, LẮP ĐẶT', org: D.nhaThau || 'Chi nhánh Công ty TNHH Schindler Việt Nam tại Hà Nội' }]).slice(0, 4);
      const gap = 18, bw = (1070 - gap * (ky.length - 1)) / ky.length, bot = 790;
      ky.forEach((c, i) => {
        const x = 60 + i * (bw + gap), xc = x + bw / 2;
        b.rect(x, SIG_TOP, bw, bot - SIG_TOP, { bw: 0.8, bc: black });
        b.rect(x, SIG_TOP, bw, 22, { bw: 0.8, bc: black, fill: band });
        b.text(up(c.title), xc, SIG_TOP + 6, { f: 'b', s: 9.5, a: 'center', w: bw - 12, maxLines: 1 });
        let ty = SIG_TOP + 32;
        if (S(c.org)) ty += b.text(up(c.org), xc, ty, { s: 9, a: 'center', w: bw - 30, maxLines: 3 });
        b.text('(Ký, ghi rõ họ tên và đóng dấu)', xc, ty + 4, { f: 'i', s: 8.5, a: 'center', color: grey });
        b.text('Họ và tên: ' + (S(c.ten) || '…………………………………………'), x + 12, bot - 40, { s: 9.5 });
        b.text('Chức vụ: ' + (S(c.chucVu) || '……………………………………………'), x + 12, bot - 24, { s: 9.5 });
      });
      b.text(`${noi}, ngày ${m ? m[3] : '……'} tháng ${m ? m[2] : '……'} năm ${m ? m[1] : new Date().getFullYear()}`, 1130, 798, { f: 'i', s: 9, a: 'right' });
    });
    return doc.save();
  }
  // đọc danh mục bản vẽ từ các file PDF tải lên: mỗi trang = 1 bản vẽ (số hiệu tự đánh, tên theo tên file, khổ theo kích thước trang)
  async function listDrawings(PDFLib, files, prefix) {
    const out = [];
    let n = 0;
    for (const f of files) {
      const src = await PDFLib.PDFDocument.load(f.bytes, { ignoreEncryption: true });
      const pages = src.getPages();
      const base = S(f.name).replace(/\.pdf$/i, '').replace(/[_]+/g, ' ');
      pages.forEach((pg, i) => {
        const { width, height } = pg.getSize();
        n++;
        out.push({ so: `${prefix || 'TM'}-${String(n).padStart(2, '0')}`, ten: pages.length > 1 ? `${base} (tờ ${i + 1})` : base, kho: paperName(width, height), file: f.name, page: i });
      });
    }
    return out;
  }
  // ghép: bìa + trang ký (bytes) rồi tới toàn bộ trang của các file bản vẽ, đúng thứ tự tải lên
  async function merge(PDFLib, coverBytes, files) {
    const out = await PDFLib.PDFDocument.load(coverBytes);
    for (const f of files) {
      const src = await PDFLib.PDFDocument.load(f.bytes, { ignoreEncryption: true });
      (await out.copyPages(src, src.getPageIndices())).forEach(p => out.addPage(p));
    }
    return out.save();
  }
  const api = { buildCover, listDrawings, merge, paperName };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HsDrawing = api;
})(typeof window !== 'undefined' ? window : globalThis);
