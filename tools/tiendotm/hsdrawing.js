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

  // D: { chuDauTu, banQLDA, tieuDe, phuDe, kyTitle (tiêu đề trang ký: DUYỆT BẢN VẼ THI CÔNG / XÁC NHẬN BẢN VẼ HOÀN CÔNG), heThong, congTrinh, diaDiem, hangMuc, hopDong, thietBi, nhaThau, nhaThauDiaChi, noiLap, ngay(YYYY-MM-DD),
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
    const sets = D.sets || [];
    const soBanVe = S(D.soBanVe) || (sets.length > 1 ? `${String(sets.length).padStart(2, '0')} bộ (${sets.map(x => S(x.label)).join(', ')})${nDwg ? ` · ${String(nDwg).padStart(2, '0')} bản vẽ` : ''}${khoList ? ' khổ ' + khoList : ''}`
      : nDwg ? `${String(nDwg).padStart(2, '0')} bản vẽ${khoList ? ' khổ ' + khoList : ''}` : DOT);
    // không lập danh mục riêng (mỗi bộ bản vẽ đã có danh mục) → trang ký liệt kê các bộ bản vẽ
    const bySet = D.useIndex === false && sets.length;

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
    const list = bySet ? sets.map((x, i) => [String(i + 1), S(x.label), S(x.no) || S(x.file), `${x.drawings || 0} bản vẽ${x.pages > x.drawings ? ` / ${x.pages} trang` : ''}`, x.hasIndex ? 'có danh mục riêng' : ''])
      : (D.drawings || []).map((x, i) => [String(i + 1), S(x.so), S(x.ten), S(x.kho)]);
    const SIG_TOP = 548, FULL_BOTTOM = 790, HEAD_TOP = 276;
    const capFull = Math.floor((FULL_BOTTOM - HEAD_TOP) / 18), capSig = Math.floor((SIG_TOP - 16 - HEAD_TOP) / 13);
    const chunks = [];
    let rest = list.slice();
    while (rest.length > capSig) { const k = Math.min(capFull, rest.length - 1); chunks.push(rest.slice(0, k)); rest = rest.slice(k); }
    chunks.push(rest);
    const COLS = bySet ? [[60, 40, 'TT', 'center'], [100, 220, 'Thang / bộ bản vẽ', 'left'], [320, 420, 'Số hiệu bộ bản vẽ', 'left'], [740, 200, 'Số tờ', 'center'], [940, 190, 'Ghi chú', 'center']]
      : [[60, 40, 'TT', 'center'], [100, 120, 'Số hiệu bản vẽ', 'center'], [220, 820, 'Tên bản vẽ', 'left'], [1040, 90, 'Khổ giấy', 'center']];
    chunks.forEach((ch, ci) => {
      const last = ci === chunks.length - 1;
      const pg = doc.addPage(A3), b = pen(pg, F), cx2 = b.W / 2;
      b.rect(28, 28, b.W - 56, b.H - 56, { bw: 1.4, bc: black });
      const kt = up(D.kyTitle || 'DUYỆT BẢN VẼ THI CÔNG');
      b.text(ci ? kt + ' (tiếp)' : kt, cx2, 62, { f: 'b', s: 26, a: 'center' });
      b.text(`${up(D.heThong || 'HỆ THỐNG THANG MÁY')} – CÔNG TRÌNH ${up(D.congTrinh) || DOT}`, cx2, 98, { f: 'b', s: 14, a: 'center', w: 1000, maxLines: 2 });
      if (S(D.hopDong)) b.text('Hợp đồng số ' + D.hopDong, cx2, 120, { f: 'i', s: 10, a: 'center' });
      let yy = 150;
      [['Chủ đầu tư', D.chuDauTu], ['Ban quản lý dự án', D.banQLDA], ['Nhà thầu cung cấp, lắp đặt', D.nhaThau || 'Chi nhánh Công ty TNHH Schindler Việt Nam tại Hà Nội'], ['Địa điểm xây dựng', D.diaDiem]]
        .filter(r => S(r[1])).forEach(([k, v]) => { b.text(k, 70, yy, { f: 'b', s: 10 }); b.text(': ' + (k === 'Địa điểm xây dựng' ? S(v) : up(v)), 250, yy, { s: 10, w: 860, maxLines: 1 }); yy += 16; });
      b.text(bySet ? 'CÁC BỘ BẢN VẼ KÈM THEO (danh mục chi tiết nằm ở đầu mỗi bộ)' : 'DANH MỤC BẢN VẼ', 60, 236, { f: 'b', s: 11 });
      const rh = last ? (ch.length <= Math.floor((SIG_TOP - 16 - HEAD_TOP) / 18) ? 18 : 13) : 18, fs = rh === 18 ? 9.5 : 8.5;
      b.rect(60, 258, 1070, 18, { bw: 0.6, bc: black, fill: band });
      COLS.forEach(([x, w, t, al]) => b.text(t, al === 'center' ? x + w / 2 : x + 6, 262, { f: 'b', s: 9.5, a: al }));
      ch.forEach((row, ri) => {
        const top = HEAD_TOP + ri * rh;
        b.rect(60, top, 1070, rh, { bw: 0.5, bc: black });
        COLS.forEach(([x, w, , al], k) => b.text(row[k], al === 'center' ? x + w / 2 : x + 6, top + (rh - fs) / 2 - 1, { s: fs, a: al, maxLines: 1, w: w - 10 }));
      });
      COLS.slice(1).forEach(([x]) => b.line(x, 258, x, HEAD_TOP + ch.length * rh, { t: 0.5 }));
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
  // ================= đọc khung tên bản vẽ =================
  // items: [{ s: chữ, x, y (mép TRÊN, tính từ mép trên trang), w, h }] — toạ độ pt của trang (pdf.js, viewport scale 1)
  const LBL = /(tên bản vẽ|drawing title|số bản vẽ|drawing no|duyệt|approved|kiểm tra|checked|^vẽ$|drawn|tỉ lệ|tỷ lệ|scale|ngày\s*\/|date|revision|hiệu chỉnh|trang$|^page$|tên dự án|project name|địa chỉ|address|bên mua|client)/i;
  function lines(items) {
    const its = items.filter(t => S(t.s)).slice().sort((a, b) => a.y - b.y || a.x - b.x);
    const out = [];
    its.forEach(t => {
      const l = out.find(L => Math.abs(L.y - t.y) <= Math.max(2, Math.min(L.h, t.h) * 0.5) && t.x > L.x - 2000);
      if (l) { l.items.push(t); l.h = Math.max(l.h, t.h); } else out.push({ y: t.y, h: t.h, x: t.x, items: [t] });
    });
    out.forEach(L => { L.items.sort((a, b) => a.x - b.x); L.x = L.items[0].x; });
    return out;
  }
  const join = (arr) => arr.map(t => S(t.s)).join(' ').replace(/\s+/g, ' ').trim();
  // phần chữ bên phải nhãn trên cùng dòng (bỏ chính nhãn)
  function rightOf(L, lab, re) {
    const after = L.items.filter(t => t.x >= lab.x - 0.5 && t !== lab);
    let txt = join([lab, ...after.filter(t => t.x > lab.x)]);
    // nhãn song ngữ "Số bản vẽ / Drawing No:" → cắt sau lần khớp CUỐI cùng
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m, end = -1; while ((m = g.exec(txt))) { end = m.index + m[0].length; if (!m[0]) g.lastIndex++; }
    if (end >= 0) txt = txt.slice(end);
    return txt.replace(/^[\s:：/]+/, '').trim();
  }
  function parseTitleBlock(items, W, H) {
    const Ls = lines(items), all = Ls.map(L => join(L.items)).join('\n'), r = { kind: 'other', no: '', title: '', sheet: '', rev: '', scale: '', project: '', client: '', line: '' };
    const find = (re) => { for (const L of Ls) for (const t of L.items) if (re.test(t.s) || re.test(join(L.items.filter(u => u.x >= t.x && u.x < t.x + 400)).slice(0, 60))) return { L, t }; return null; };
    // --- số bản vẽ (+ tờ "02 04" → 02/04)
    const fNo = find(/số bản vẽ|drawing\s*no/i);
    if (fNo) {
      const v = rightOf(fNo.L, fNo.t, /(drawing\s*no\.?|số bản vẽ)\s*[:：]?/i);
      const m = /([A-Za-z0-9][A-Za-z0-9_.\-/]{3,})(?:\s+(\d{1,3})\s*(?:\/|\s)\s*(\d{1,3}))?/.exec(v);
      if (m) { r.no = m[1]; if (m[2]) r.sheet = `${m[2].padStart(2, '0')}/${m[3].padStart(2, '0')}`; }
    }
    // --- tên bản vẽ: cùng dòng sau dấu ':' hoặc các dòng ngay bên dưới nhãn (tới nhãn kế tiếp)
    const fT = find(/tên bản vẽ|drawing\s*title/i);
    if (fT) {
      let v = rightOf(fT.L, fT.t, /(drawing\s*title|tên bản vẽ)\s*[:：]?/i).replace(/^(tên bản vẽ|drawing title|\/|\s)+[:：]?/i, '').trim();
      if (!v || v.length < 3) {
        const x0 = fT.t.x - 40, x1 = fT.t.x + Math.max(300, W * 0.2), parts = [];
        for (const L of Ls) {
          if (L.y <= fT.L.y + 1) continue;
          if (L.y > fT.L.y + Math.max(80, fT.t.h * 7)) break;
          const its = L.items.filter(t => t.x >= x0 && t.x <= x1);
          if (!its.length) continue;
          const txt = join(its);
          if (LBL.test(txt)) break;
          parts.push(txt);
          if (parts.length >= 3) break;
        }
        v = parts.join(' ');
      }
      r.title = v.replace(/\s+/g, ' ').trim();
    }
    // --- hiệu chỉnh (revision): số / chữ ngắn ngay dưới nhãn
    const fR = find(/^(revision|hiệu chỉnh)$/i);
    if (fR) {
      const cand = items.filter(t => /^(\d{1,2}|[A-Z])$/.test(S(t.s)) && t.y > fR.t.y && t.y < fR.t.y + 60 && Math.abs(t.x - fR.t.x) < 60).sort((a, b) => a.y - b.y)[0];
      if (cand) r.rev = S(cand.s);
    }
    const fS = find(/tỉ lệ|tỷ lệ|scale/i);
    if (fS) { const v = rightOf(fS.L, fS.t, /(scale|tỉ lệ|tỷ lệ)\s*[:：]?/i).replace(/^(\/\s*scale\s*[:：]?)/i, '').trim(); const m = /^(NTS|1\s*[:/]\s*\d+|[\d.,]+\s*[:/]\s*\d+)/i.exec(v); if (m) r.scale = m[1].replace(/\s+/g, ''); }
    const mp = /(?:project name|tên dự án)\s*[:：]\s*([^\n]+)/i.exec(all); if (mp) r.project = mp[1].trim();
    const mc = /(?:client|bên mua)\s*[:：]\s*([^\n]+)/i.exec(all); if (mc) r.client = mc[1].trim();
    const ml = /\b(schindler\s*\d{3,4}[a-z]*|s\d{4}[a-z]*)\b/i.exec(all); if (ml) r.line = ml[1].replace(/\s+/g, ' ');
    // --- loại trang
    if (/danh\s*mục\s*bản\s*vẽ|drawing\s*list|list\s*of\s*drawings|drawing\s*register/i.test(all)) r.kind = 'index';
    else if (r.title || r.no) r.kind = 'drawing';
    else if (items.length < 40 && /bản vẽ|drawing/i.test(all)) r.kind = 'cover';
    return r;
  }
  // ký hiệu thang lấy từ số bản vẽ: VQ22530_SCH_LB_PL1 → PL1 ; …-TM02 → TM02
  function liftLabel(no, file) {
    const m = /[_\-\s]((?:PL|TM|TH|L|E|EL|LIFT|T)\s*\d{1,3}[A-Z]?)$/i.exec(S(no));
    if (m) return m[1].toUpperCase().replace(/\s+/g, '');
    const all = [...S(file).replace(/\.pdf$/i, '').matchAll(/(PL|TM|EL|LIFT|TH)\s*(\d{1,3}[A-Z]?)(?![0-9])/gi)];
    return all.length ? (all[all.length - 1][1] + all[all.length - 1][2]).toUpperCase() : S(file).replace(/\.pdf$/i, '').slice(-24);
  }
  // pages: [{ w, h, info: parseTitleBlock(...) }] của 1 file → thông tin bộ bản vẽ
  function summarizeSet(file, pages) {
    const dw = pages.filter(p => p.info.kind === 'drawing');
    const nos = {}; dw.forEach(p => { if (p.info.no) nos[p.info.no] = (nos[p.info.no] || 0) + 1; });
    const no = Object.keys(nos).sort((a, b) => nos[b] - nos[a])[0] || '';
    const line = (pages.find(p => p.info.line) || { info: {} }).info.line || '';
    return { file, no, label: liftLabel(no, file), line, pages: pages.length, drawings: dw.length, hasIndex: pages.some(p => p.info.kind === 'index'),
      kho: [...new Set(pages.map(p => paperName(p.w, p.h)))].join(', '), project: (dw.find(p => p.info.project) || { info: {} }).info.project || '' };
  }
  // danh mục từ kết quả đọc: chỉ trang bản vẽ (bỏ bìa, danh mục riêng của bộ); tên theo khung tên, thiếu thì theo tên file
  function rowsFromSets(sets, opts) {
    const o = opts || {}, out = [];
    sets.forEach((st, si) => {
      const base = S(st.file).replace(/\.pdf$/i, '').replace(/[_]+/g, ' ');
      st.pageInfo.forEach((p, i) => {
        if (p.info.kind !== 'drawing' && st.pageInfo.some(q => q.info.kind === 'drawing')) return;
        const so = p.info.no ? p.info.no + (p.info.sheet ? ' – ' + p.info.sheet : '') : `${o.prefix || 'TM'}-${String(out.length + 1).padStart(2, '0')}`;
        out.push({ so, ten: p.info.title || (st.pageInfo.length > 1 ? `${base} (tờ ${i + 1})` : base), kho: o.a3 ? 'A3' : paperName(p.w, p.h), goc: paperName(p.w, p.h), rev: p.info.rev || '', file: st.file, page: i, set: si });
      });
    });
    return out;
  }
  // dùng cho bản không đọc được chữ: mỗi trang = 1 bản vẽ (tên theo tên file)
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
  // trình duyệt: đọc chữ + toạ độ từng trang bằng pdf.js → bộ bản vẽ đã phân tích
  async function analyze(pdfjsLib, files) {
    const sets = [];
    for (const f of files) {
      const pdf = await pdfjsLib.getDocument({ data: f.bytes.slice() }).promise;
      const pages = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const pg = await pdf.getPage(i), vp = pg.getViewport({ scale: 1 }), tc = await pg.getTextContent();
        const items = tc.items.filter(t => S(t.str)).map(t => {
          const m = pdfjsLib.Util.transform(vp.transform, t.transform), h = Math.hypot(m[2], m[3]) || 8;
          return { s: t.str, x: m[4], y: m[5] - h, w: t.width, h };
        });
        const view = pg.view, w = Math.abs(view[2] - view[0]), h = Math.abs(view[3] - view[1]);
        pages.push({ w, h, info: parseTitleBlock(items, vp.width, vp.height) });
        pg.cleanup();
      }
      await pdf.destroy();
      const st = summarizeSet(f.name, pages); st.pageInfo = pages;
      sets.push(st);
    }
    return sets;
  }

  // ================= ghép: bìa + trang ký, rồi từng bộ (trang ngăn cách + bản vẽ, có thể đưa về A3) =================
  // đưa 1 trang (đã copy vào file kết quả) về khổ A3 (ngang/dọc theo trang gốc): co giữ tỉ lệ, căn giữa.
  // Bọc nội dung gốc bằng ma trận co + dời (giữ nguyên dạng vector, dùng chung phông / hình giữa các trang → file không phình).
  function fitA3(page) {
    const L = PDFLibRef, cb = page.getCropBox(), w = cb.width, h = cb.height;
    const [AW, AH] = w >= h ? A3 : [A3[1], A3[0]];
    if (Math.abs(w - AW) < 3 && Math.abs(h - AH) < 3 && Math.abs(cb.x) < 1 && Math.abs(cb.y) < 1) return false;
    const k = Math.min(AW / w, AH / h), dx = (AW - w * k) / 2 - k * cb.x, dy = (AH - h * k) / 2 - k * cb.y;
    page.node.normalize(); page.getContentStream();
    const start = page.createContentStream(L.pushGraphicsState(), L.concatTransformationMatrix(k, 0, 0, k, dx, dy));
    const end = page.createContentStream(L.popGraphicsState());
    page.node.wrapContentStreams(page.doc.context.register(start), page.doc.context.register(end));
    page.setMediaBox(0, 0, AW, AH); page.setCropBox(0, 0, AW, AH);
    ['BleedBox', 'TrimBox', 'ArtBox'].forEach(n => page.node.delete(L.PDFName.of(n)));
    page.node.delete(L.PDFName.of('Annots'));   // ghi chú / liên kết trong bản vẽ CAD — không còn đúng vị trí sau khi co
    return true;
  }
  let PDFLibRef = null;
  // trang ngăn cách cho 1 bộ (thang): nhãn lớn + số hiệu + danh sách bản vẽ; tab đánh dấu ở mép phải lệch theo thứ tự bộ
  function separator(out, F, st, i, n, D) {
    const { rgb } = PDFLibRef;
    const page = out.addPage(A3), a = pen(page, F), cx = a.W / 2, black = rgb(0, 0, 0), grey = rgb(0.35, 0.35, 0.35);
    a.rect(28, 28, a.W - 56, a.H - 56, { bw: 1.6, bc: black });
    // tab mép phải: cao 1/n khổ (tối đa 150pt), lệch theo thứ tự → in ra xếp chồng thấy được từng thang
    const th = Math.min(150, (a.H - 120) / Math.max(1, n)), tt = 60 + i * th;
    a.rect(a.W - 74, tt, 46, th - 6, { bw: 0, fill: rgb(0.11, 0.25, 0.55) });
    const lab = S(st.label) || `Bộ ${i + 1}`;
    page.drawText(lab.slice(0, 14), { x: a.W - 46, y: a.H - tt - (th - 6) / 2 - F.b.widthOfTextAtSize(lab.slice(0, 14), 14) / 2, size: 14, font: F.b, color: rgb(1, 1, 1), rotate: PDFLibRef.degrees(90) });
    if (S(D.congTrinh)) a.text(up(D.congTrinh), cx, 70, { f: 'b', s: 13, a: 'center', w: 900, maxLines: 2 });
    a.text(up(D.tieuDe || 'BẢN VẼ THI CÔNG') + (S(D.heThong) ? ' – ' + up(D.heThong) : ''), cx, 100, { s: 11, a: 'center', color: grey, w: 900, maxLines: 1 });
    a.text(`BỘ ${i + 1}/${n}`, cx, 200, { f: 'b', s: 16, a: 'center', color: grey });
    a.text(/^thang\b/i.test(lab) ? up(lab) : 'THANG ' + up(lab), cx, 230, { f: 'b', s: 64, a: 'center' });
    let y = 330;
    [['Số hiệu bộ bản vẽ', st.no], ['Dòng thang', st.line], ['Số tờ', `${st.drawings || 0} bản vẽ${st.pages > st.drawings ? ` (${st.pages} trang gồm bìa, danh mục)` : ''}`], ['File', st.file]]
      .filter(r => S(r[1])).forEach(([k, v]) => { a.text(k, cx - 300, y, { f: 'b', s: 12 }); a.text(': ' + v, cx - 120, y, { s: 12, w: 520, maxLines: 1 }); y += 22; });
    const dws = (st.pageInfo || []).filter(p => p.info.kind === 'drawing');
    if (dws.length) {
      y += 14; a.text('Bản vẽ trong bộ:', cx - 300, y, { f: 'b', s: 11 }); y += 20;
      dws.slice(0, 16).forEach(p => { a.text(`${p.info.sheet || ''}`, cx - 300, y, { s: 10.5, color: grey }); a.text(p.info.title || '—', cx - 240, y, { s: 10.5, w: 600, maxLines: 1 }); y += 17; });
      if (dws.length > 16) a.text(`… và ${dws.length - 16} bản vẽ khác`, cx - 240, y, { f: 'i', s: 10, color: grey });
    }
  }
  // opts: { a3: bool, sep: bool, sets: [...] (theo đúng thứ tự files), D, fonts, fontkit }
  async function assemble(PDFLib, coverBytes, files, opts) {
    PDFLibRef = PDFLib;
    const o = opts || {}, out = await PDFLib.PDFDocument.load(coverBytes);
    let F = null;
    if (o.sep && files.length && o.fontkit && o.fonts) {
      out.registerFontkit(o.fontkit);
      F = { r: await out.embedFont(o.fonts.r, { subset: false }), b: await out.embedFont(o.fonts.b, { subset: false }), i: await out.embedFont(o.fonts.i, { subset: false }) };
    }
    let resized = 0;
    for (let fi = 0; fi < files.length; fi++) {
      const f = files[fi], src = await PDFLib.PDFDocument.load(f.bytes, { ignoreEncryption: true });
      if (F) separator(out, F, (o.sets || [])[fi] || { label: liftLabel('', f.name), file: f.name, pages: src.getPageCount(), drawings: src.getPageCount() }, fi, files.length, o.D || {});
      (await out.copyPages(src, src.getPageIndices())).forEach(p => { out.addPage(p); if (o.a3 && fitA3(p)) resized++; });
    }
    const bytes = await out.save();
    return o.stats ? { bytes, resized } : bytes;
  }
  // tương thích cũ
  const merge = (PDFLib, coverBytes, files) => assemble(PDFLib, coverBytes, files, {});
  const api = { buildCover, listDrawings, merge, paperName, parseTitleBlock, liftLabel, summarizeSet, rowsFromSets, analyze, assemble, A3 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HsDrawing = api;
})(typeof window !== 'undefined' ? window : globalThis);
