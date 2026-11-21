// Hồ sơ Dự án › Công văn, biên bản: các thư / biên bản mẫu cùng MỘT khuôn công văn của nhà thầu
// (header logo + footer địa chỉ lấy từ mẫu công văn; phần đầu thư, khối ký, nơi nhận, người liên hệ giống nhau).
// LETTERS[i] = { id, kind: 'letter'|'bb', name, subject, fields:[{k,label,type,def,ph,rows}], body(ctx) → XML thân thư }
// ctx = { I: thông tin dự án dùng chung, f: giá trị ô của văn bản, K: DocxKit }
(function (root) {
  'use strict';
  const K = (typeof module !== 'undefined' && module.exports) ? require('./docxkit.js') : root.DocxKit;
  const PV = (typeof module !== 'undefined' && module.exports) ? require('./hspreview.js') : root.HsPreview;
  const { r, p, bullet, table, ngayVN, dmy, orDots } = K;
  const lines = (s) => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
  const NHA_THAU = 'CHI NHÁNH CÔNG TY TNHH SCHINDLER VIỆT NAM TẠI HÀ NỘI';
  const CTY = (I) => I.nhaThau || NHA_THAU;
  const short = (I) => I.nhaThauNgan || 'Schindler Việt Nam';

  // ---------- khung chung ----------
  function header(I, f, subject) {
    const so = f.so || I.soCV || '';
    const top = table([[
      { runs: [r(CTY(I), { b: true, sz: 11 }), r('\nSố: ' + (so || '……/……'), { sz: 11 })] },
      { runs: [r(ngayVN(f.ngay, I.noiLap || 'Hà Nội'), { i: true, sz: 11 })], align: 'right' },
    ]], { widths: [5200, 3826], border: false });
    const kg = f.kinhGui || I.chuDauTu;
    const rows = [
      [{ t: 'Kính gửi:', b: true, vAlign: 'top' }, { runs: [r(orDots(kg), { b: true, caps: true }), (f.kgDiaChi || I.cdtDiaChi) ? r('\nĐịa chỉ: ' + (f.kgDiaChi || I.cdtDiaChi), {}) : '', (f.kgNguoi || I.cdtDaiDien) ? r('\nNgười đại diện: ' + (f.kgNguoi || I.cdtDaiDien) + (I.cdtChucVu ? ' – ' + I.cdtChucVu : ''), {}) : ''], vAlign: 'top' }],
    ];
    const cc = f.dongKinhGui || [I.banQLDA, I.tvgs].filter(Boolean).join('; ');
    if (cc) rows.push([{ t: 'Đồng kính gửi:', b: true, vAlign: 'top' }, { t: cc, vAlign: 'top' }]);
    rows.push([{ t: 'Công trình:', b: true }, { t: orDots(I.congTrinh) }]);
    if (I.diaDiem) rows.push([{ t: 'Địa chỉ:', b: true }, { t: I.diaDiem }]);
    rows.push([{ t: 'V/v:', b: true, vAlign: 'top' }, { runs: [r(subject, { b: true })], vAlign: 'top' }]);
    return top + table(rows, { widths: [1800, 7226], border: false }) +
      p([r('Tham chiếu: ', { b: true }), r(`Hợp đồng số ${orDots(I.soHD)} ký ngày ${I.ngayHD ? dmy(I.ngayHD) : '…/…/……'} về việc ${(I.hangMuc || 'cung cấp và lắp đặt thang máy').toLowerCase()} (dưới đây gọi là “Hợp đồng”).`)], { align: 'both', after: 6 });
  }
  function closing(I, f, o = {}) {
    const ky = f.nguoiKy || I.nguoiKy || '';
    const cv = f.chucVuKy || I.chucVuKy || 'Quản lý dự án';
    // o.left: thay ô "Nơi nhận" bằng ô khác (vd. Khách hàng ký xác nhận) — nơi nhận chuyển xuống 1 dòng dưới khối ký
    const sign = table([[
      o.left ? { runs: o.left, align: 'center', vAlign: 'top' } : { runs: [r('Nơi nhận:', { b: true, i: true, sz: 11 }), r('\n- Như trên;' + (o.cc ? '\n- ' + o.cc + ';' : '') + '\n- Lưu VP.', { sz: 11 })], vAlign: 'top' },
      { runs: [r('TM. ' + CTY(I), { b: true, sz: 11 }), r('\n' + cv, { b: true, sz: 11 }), r('\n\n\n\n' + (ky || ''), { b: true })], align: 'center', vAlign: 'top' },
    ]], { widths: [3700, 5326], border: false, cantSplit: true });
    const lh = [I.pmTen, I.pmDT, I.pmEmail].filter(Boolean).join(' – ');
    return p(r(o.thanks || 'Rất mong nhận được sự hợp tác của Quý Khách hàng.'), { align: 'both', before: 4, keep: true }) +
      p(r('Trân trọng kính chào.'), { after: 8, keep: true }) + sign +
      (o.left ? p([r('Nơi nhận: ', { b: true, i: true, sz: 10 }), r('Như trên; ' + (o.cc ? o.cc + '; ' : '') + 'Lưu VP.', { sz: 10 })], { before: 6, after: 0 }) : '') +
      (lh ? p(r('Người liên hệ: ' + lh, { i: true, sz: 10 }), { before: o.left ? 0 : 6 }) : '');
  }
  const salute = () => p(r('Kính gửi Quý Khách hàng,'), { before: 4 });
  const intro = (I) => p(r(`Lời đầu tiên, ${CTY(I).replace(/^CHI NHÁNH/, 'Chi nhánh').replace(/CÔNG TY TNHH/, 'Công ty TNHH').replace(/SCHINDLER VIỆT NAM TẠI HÀ NỘI/, 'Schindler Việt Nam tại Hà Nội')} (“${short(I)}”) xin gửi đến Quý Khách hàng lời chào trân trọng và cảm ơn Quý Khách hàng đã tin tưởng, hợp tác và sử dụng sản phẩm, dịch vụ của chúng tôi trong thời gian qua.`), { align: 'both' });
  const para = (t) => p(r(t), { align: 'both' });
  const head2 = (t) => p(r(t, { b: true }), { before: 4, keep: true });
  const list = (arr, mark) => arr.map((t, i) => bullet(t, { mark: mark === '1' ? (i + 1) + '.' : '•' })).join('');
  const qtyThang = (I, f) => f.soThang || I.soThang || '……';
  const letter = (subject, fn) => (ctx) => header(ctx.I, ctx.f, typeof subject === 'function' ? subject(ctx) : subject) + fn(ctx);

  // ---------- biên bản (cùng khuôn header/footer; quốc hiệu thay cho phần kính gửi) ----------
  function bbHeader(I, f, title, soKh) {
    return table([[
      { runs: [r(CTY(I), { b: true, sz: 11 }), r('\n——————', { sz: 11 })], align: 'center', vAlign: 'top' },
      { runs: [r('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { b: true, sz: 11 }), r('\nĐộc lập – Tự do – Hạnh phúc', { b: true, sz: 11 }), r('\n——————', { sz: 11 })], align: 'center', vAlign: 'top' },
    ]], { widths: [4300, 4726], border: false }) +
      p(r(ngayVN(f.ngay, I.noiLap || 'Hà Nội'), { i: true }), { align: 'right' }) +
      p(r(title, { b: true, sz: 14 }), { align: 'center', before: 6, after: 2 }) +
      p(r('Số: ' + (f.so || '……/' + (soKh || 'BB'))), { align: 'center' }) +   // in đúng số người dùng nhập — như công văn
      p([r('Công trình: ', { b: true }), r(orDots(I.congTrinh))], { after: 2 }) +
      p([r('Địa điểm: ', { b: true }), r(orDots(I.diaDiem))], { after: 2 }) +
      p([r('Hợp đồng số: ', { b: true }), r(`${orDots(I.soHD)}${I.ngayHD ? ' ngày ' + dmy(I.ngayHD) : ''}`)]);
  }
  const signRow = (labels) => table([labels.map(l => ({ runs: [r(l.toUpperCase(), { b: true, sz: 11 }), r('\n(Ký và ghi rõ họ tên)\n\n\n\n', { i: true, sz: 10 })], align: 'center', vAlign: 'top' }))],
    { widths: labels.map(() => Math.floor(9026 / labels.length)), border: false });

  // bảng cuối văn bản: thay đoạn trống sau bảng bằng đoạn cao 1pt (Word bắt buộc có đoạn sau bảng) → không đẩy sang trang trống
  const tail = (tbl) => { const e = p('', { after: 0 }); return tbl.endsWith(e) ? tbl.slice(0, -e.length) + '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr></w:p>' : tbl; };
  // người duyệt: chỉ Chủ đầu tư (không phải dự án nào cũng có TVGS) hoặc TVGS + Chủ đầu tư; để trống → có TVGS trong thông tin dự án thì duyệt 2 bên
  const APPROVERS = ['Chủ đầu tư', 'Tư vấn giám sát + Chủ đầu tư'];
  const withTvgs = (I, f) => (f.duyet ? /tư vấn|tvgs/i.test(f.duyet) : !!(I.tvgs));
  const sendTo = (I, f) => f.guiDen || (withTvgs(I, f) ? [I.chuDauTu, I.tvgs || I.banQLDA] : [I.chuDauTu]).filter(Boolean).join('; ');
  const ownerBox = (I, f) => withTvgs(I, f) ? { head: 'TƯ VẤN GIÁM SÁT / CHỦ ĐẦU TƯ (FOR CONSULTANT / OWNER USE)', who: 'Tư vấn giám sát / Chủ đầu tư' } : { head: 'CHỦ ĐẦU TƯ (FOR OWNER USE)', who: 'Chủ đầu tư' };
  // hàng ký của bên duyệt: 1 cột (chỉ CĐT) hoặc 2 cột (TVGS + CĐT)
  const reviewSigns = (I, f) => withTvgs(I, f)
    ? [{ runs: [r('TƯ VẤN GIÁM SÁT', { b: true }), r('\n(Ký, ghi rõ họ tên)\n\nNgày: …/…/……', { i: true, sz: 10 })], align: 'center', vAlign: 'top' },
      { runs: [r('CHỦ ĐẦU TƯ', { b: true }), r('\n(Ký, ghi rõ họ tên, đóng dấu)\n\nNgày: …/…/……', { i: true, sz: 10 })], align: 'center', vAlign: 'top' }]
    : [{ runs: [r('CHỦ ĐẦU TƯ', { b: true }), r('\n(Ký, ghi rõ họ tên, đóng dấu)\n\nNgày: …/…/……', { i: true, sz: 10 })], align: 'center', vAlign: 'top', span: 2 }];
  const APPROVER_FIELD = { k: 'duyet', label: 'Bên duyệt / trả lời', type: 'select', options: APPROVERS, ph: 'để trống: có TVGS trong thông tin dự án → TVGS + CĐT, không có → chỉ CĐT' };
  const ckbox = (on) => r(on ? '☒ ' : '☐ ', { font: 'Segoe UI Symbol' });
  const pickBox = (opts, val) => opts.map(o => [ckbox(o === val), r(o + '    ')]).flat();
  // ---- tiền: đọc số tiền bằng chữ (tiếng Việt), định dạng 1.234.567, đọc số nhập kiểu 1.250.000 / 1,250,000 / 2,5
  const DIG = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  function read3(n, full) {
    const h = Math.floor(n / 100), t = Math.floor(n / 10) % 10, u = n % 10, out = [];
    if (full || h) out.push(DIG[h] + ' trăm');
    if (t === 0) { if (u && (full || h)) out.push('linh'); }
    else if (t === 1) out.push('mười'); else out.push(DIG[t] + ' mươi');
    if (u) out.push(u === 1 && t >= 2 ? 'mốt' : u === 5 && t >= 1 ? 'lăm' : u === 4 && t >= 2 ? 'tư' : DIG[u]);
    return out.join(' ');
  }
  function docSo(x) {
    let n = Math.round(Math.abs(Number(x) || 0));
    if (!n) return 'Không đồng';
    const units = ['', ' nghìn', ' triệu', ' tỷ', ' nghìn tỷ', ' triệu tỷ'], parts = [];
    let i = 0;
    while (n > 0) { parts.unshift([n % 1000, i]); n = Math.floor(n / 1000); i++; }
    const words = parts.map(([g, k], j) => (g ? read3(g, j > 0) + units[k] : '')).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    return (Number(x) < 0 ? 'Âm ' : '') + words.charAt(0).toUpperCase() + words.slice(1) + ' đồng';
  }
  const money = (n) => Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const numIn = (v, dec) => {   // dec: cho phép số lẻ (số lượng): '2,5' → 2.5 ; tiền: bỏ mọi dấu phân cách
    let t = String(v == null ? '' : v).trim().replace(/\s|đ|vnđ|vnd/gi, '');
    if (!t) return 0;
    if (dec) { if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ''); t = t.replace(',', '.'); return Number(t) || 0; }
    return Number(t.replace(/[.,]/g, '')) || 0;
  };
  // báo giá: dòng "nội dung | ĐVT | số lượng | đơn giá" → { rows, sub, vat, total }
  // hiệu lực báo giá: "30" / "30 ngày" → "30 ngày kể từ ngày báo giá (đến hết ngày dd/mm/yyyy)"
  function validity(v, iso) {
    const t = String(v || '').trim(), m = /^(\d{1,3})(?:\s*ngày)?$/i.exec(t), d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!t) return '…… ngày kể từ ngày báo giá';
    if (!m) return t;
    const n = Number(m[1]);
    if (!d) return `${n} ngày kể từ ngày báo giá`;
    const e = new Date(Date.UTC(+d[1], +d[2] - 1, +d[3] + n));
    return `${n} ngày kể từ ngày báo giá (đến hết ngày ${String(e.getUTCDate()).padStart(2, '0')}/${String(e.getUTCMonth() + 1).padStart(2, '0')}/${e.getUTCFullYear()})`;
  }
  // một đợt thanh toán có "x%" → thêm số tiền tương ứng của tổng cộng (đã gồm VAT)
  function payLine(ln, total) {
    const t = String(ln || '').trim().replace(/\.$/, ''), m = /(\d+(?:[.,]\d+)?)\s*%/.exec(t);
    if (!m || !total || /\bđ(ồng)?\b|vnđ/i.test(t)) return t + '.';
    const v = Math.round(total * Number(m[1].replace(',', '.')) / 100);
    return `${t} (tương đương ${money(v)} đồng).`;
  }
  function quoteCalc(text, vatPct) {
    const rows = lines(text).map(ln => { const c = ln.split('|').map(x => x.trim()); const q = numIn(c[2], true), u = numIn(c[3]); return { ten: c[0] || '', dvt: c[1] || '', q, u, tt: Math.round(q * u) }; });
    const sub = rows.reduce((a, x) => a + x.tt, 0), pct = numIn(vatPct, true), vat = Math.round(sub * pct / 100);
    return { rows, sub, pct, vat, total: sub + vat };
  }
  const RFA_TYPES = ['Bản vẽ thi công (Shop drawing)', 'Vật tư, thiết bị (Material / Equipment)', 'Biện pháp thi công (Method statement)', 'Tiến độ thi công (Schedule)', 'Mẫu hoàn thiện (Sample)', 'Tài liệu kỹ thuật (Catalogue)'];
  const RFA_PURPOSE = ['Phê duyệt', 'Xem xét, cho ý kiến', 'Để thông tin'];
  const RFI_IMPACT = ['Không ảnh hưởng', 'Ảnh hưởng tiến độ', 'Ảnh hưởng chi phí', 'Ảnh hưởng tiến độ và chi phí'];
  const VO_REASONS = ['Theo yêu cầu của Chủ đầu tư', 'Do thay đổi thiết kế', 'Do điều kiện thực tế công trường', 'Phát sinh ngoài phạm vi Hợp đồng'];
  const DEF_DKCT = [
    'Mặt bằng / kho tập kết thiết bị có mái che, khoá được, gần giếng thang |',
    'Đường vận chuyển thiết bị từ kho đến giếng thang thông thoáng |',
    'Nguồn điện thi công (1 pha + 3 pha, có aptomat) tại tầng trên cùng / phòng máy |',
    'Chiếu sáng tạm trong giếng thang và tại sảnh các tầng |',
    'Lan can, rào chắn an toàn tại tất cả cửa tầng (cao tối thiểu 1,1 m) |',
    'Móc treo / đà treo tải đỉnh giếng thang đã hoàn thiện, đủ tải |',
    'Đáy hố thang khô ráo, đã chống thấm, không đọng nước |',
    'Mốc cao độ hoàn thiện sàn (FFL) và trục tim tại từng tầng |',
    'Nước sạch, nhà vệ sinh, khu vực nghỉ cho công nhân |',
  ].join('\n');
const DEF_XN_CV = 'Sắp xếp nhân sự nhận hàng và tham gia các công tác giám định đồng bộ, đánh giá hợp quy và nghiệm thu hàng hoá\nHoàn tất xây dựng các giếng thang theo bản vẽ được duyệt để thi công lắp đặt\nChuẩn bị nguồn điện 3 pha cho công tác lắp đặt, vận hành';
const DEF_TD_CDT = 'Bàn giao mặt bằng phòng máy / đỉnh giếng thang hoàn thiện | \nCấp nguồn điện thi công 3 pha ổn định tại tầng trên cùng | ';
const DEF_TD_NTXD = 'Hoàn thiện vách giếng thang, xử lý các vị trí sai lệch kích thước | \nHoàn thiện khung bao, đổ bù cửa tầng; lắp lan can an toàn trước cửa tầng | \nDọn vệ sinh hố pít, xử lý thấm nước hố pít | ';
const DEF_TD_CONLAI = 'Lắp đặt máy kéo, cabin, đối trọng | 10\nKéo cáp tải, lắp cửa tầng | 10\nĐi dây điện, lắp tủ điều khiển | 7\nCăn chỉnh, chạy thử | 5\nKiểm định, bàn giao | 3';
const DEF_GIENG = 'Hoàn thiện che chắn, khung bao cửa tầng\nHoàn thiện lỗ thông gió giếng thang\nHoàn thiện lan can an toàn trước cửa tầng\nCung cấp nguồn điện chính thức cho thang máy';
  const LETTERS = [
    {
      // thư xác nhận ngày giao vật tư về công trường (trước đây là file Word riêng) — nay cùng khuôn công văn
      id: 'xn_hangve', kind: 'letter', name: 'Thư xác nhận ngày giao vật tư thang máy về công trường', subject: 'Xác nhận ngày giao vật tư thang máy về công trường',
      fields: [{ k: 'soThang', label: 'Số lượng thang', def: '01' }, { k: 'cang', label: 'Cảng nhập hàng', def: 'Hải Phòng' },
        { k: 'ngayVe', label: 'Ngày hàng về công trình (dự kiến)', type: 'date' }, { k: 'matBang', label: 'Cần xong mặt bằng lưu kho trước ngày', type: 'date' },
        { k: 'dienTich', label: 'Diện tích mặt bằng tối thiểu (m²/thang)', def: '30' },
        { k: 'congViec', label: 'Các công việc cần hoàn thiện / chuẩn bị trước khi hàng về (mỗi dòng 1 mục)', type: 'textarea', rows: 4, def: DEF_XN_CV }],
      body: letter('Xác nhận ngày giao vật tư thang máy về công trường', ({ I, f }) => salute() + intro(I) +
        para('Chúng tôi xin thông báo với Quý Khách hàng một số nội dung sau:') +
        head2('1. Thời gian giao hàng về công trình') +
        para(`Theo nội dung Hợp đồng, toàn bộ vật tư thiết bị của ${qtyThang(I, f)} thang máy dự kiến sẽ được nhập về đến cảng ${f.cang || '……'}; sau khi hoàn tất thủ tục hải quan, lô hàng dự kiến được chuyển đến công trình vào khoảng ngày ${dmy(f.ngayVe)}.`) +
        para(`Đề nghị Quý Khách hàng bố trí mặt bằng khô ráo, đủ rộng để lưu kho hàng hoá tại công trường trước ngày ${dmy(f.matBang)} (tối thiểu ${f.dienTich || '30'} m²/01 thang máy). Chi tiết vị trí mặt bằng, chúng tôi sẽ cử cán bộ làm việc với Quý Khách hàng trước khi hàng về dự án tối thiểu 07 ngày.`) +
        head2('2. Trường hợp tiến độ lắp đặt chậm hoặc chưa chuẩn bị được mặt bằng lưu hàng') +
        para('Nếu ngày lắp đặt theo thoả thuận bị kéo dài do phía Bên Mua, rất mong Quý Khách hàng thông báo ngay cho chúng tôi. Việc trì hoãn công tác lắp đặt sẽ cần sắp xếp lại lịch thi công của nhân lực và ảnh hưởng đến ngày bàn giao thiết bị.') +
        para('Nếu Quý Khách hàng không chuẩn bị được mặt bằng tại dự án, chúng tôi sẽ làm việc với bên thứ ba để chuẩn bị kho bãi lưu vật tư trong thời gian chờ, với chi phí do Khách hàng thanh toán. Chào giá chi phí lưu kho phát sinh sẽ được gửi Khách hàng xác nhận trước khi thực hiện.') +
        head2('3. Các công việc cần hoàn thiện / chuẩn bị trước khi hàng về') + list(lines(f.congViec || DEF_XN_CV), '1') +
        closing(I, f) +
        tail(table([[{ runs: [r('XÁC NHẬN CỦA QUÝ KHÁCH HÀNG', { b: true }), r('\n'), ckbox(false), r('Đồng ý với kế hoạch hàng về như trên\n'), ckbox(false), r('Ý kiến khác: ………………………')], vAlign: 'top' },
          { runs: [r('Đại diện Khách hàng', { b: true }), r('\n(Ký, ghi rõ họ tên, chức vụ)\n\nNgày: …/…/……', { i: true, sz: 10 })], align: 'center', vAlign: 'top' }]], { widths: [4513, 4513], cantSplit: true }))),
    },
    {
      // thông báo đã đủ điều kiện đặt hàng theo Hợp đồng → đã đặt hàng nhà máy, ngày hàng về dự kiến; có ô Khách hàng xác nhận
      id: 'dat_hang', kind: 'letter', name: 'Thông báo đặt hàng thiết bị thang máy', subject: 'Thông báo đặt hàng sản xuất thiết bị thang máy',
      fields: [
        { k: 'ngayTamUng', label: 'Ngày nhận đủ tiền tạm ứng', type: 'date' }, { k: 'tamUng', label: 'Khoản tạm ứng (tuỳ chọn)', ph: 'VD: tạm ứng đợt 1 – 30% giá trị Hợp đồng' },
        { k: 'ngayBanVe', label: 'Ngày phê duyệt bản vẽ thi công', type: 'date' }, { k: 'ngayTienDo', label: 'Ngày phê duyệt tiến độ', type: 'date' },
        { k: 'ngayVatLieu', label: 'Ngày phê duyệt vật liệu hoàn thiện', type: 'date' }, { k: 'vatLieu', label: 'Vật liệu đã duyệt (tuỳ chọn)', ph: 'VD: cabin, cửa tầng inox sọc nhuyễn; sàn đá granite' },
        { k: 'dkKhac', label: 'Điều kiện khác (tuỳ chọn) — mỗi dòng: nội dung | ngày', type: 'textarea', rows: 2, ph: 'VD: Xác nhận kích thước giếng thang thực tế | 2026-11-20' },
        { k: 'ngayDatHang', label: 'Ngày đặt hàng nhà máy', type: 'date' }, { k: 'nhaMay', label: 'Nhà máy sản xuất', def: 'nhà máy Schindler' },
        { k: 'soThang', label: 'Số lượng thang' }, { k: 'ngayVe', label: 'Ngày hàng về công trình (dự kiến)', type: 'date' },
        { k: 'hanXN', label: 'Đề nghị Khách hàng xác nhận trước ngày (tuỳ chọn)', type: 'date' }],
      body: letter('Thông báo đặt hàng sản xuất thiết bị thang máy', ({ I, f }) => {
        const d = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '').trim()) ? dmy(v) : (String(v || '').trim() || '…/…/……'));
        const rows = [
          ['Thanh toán tạm ứng theo Hợp đồng' + (f.tamUng ? ` (${f.tamUng})` : ''), d(f.ngayTamUng)],
          ['Phê duyệt bản vẽ thi công', d(f.ngayBanVe)],
          ['Phê duyệt tiến độ thực hiện', d(f.ngayTienDo)],
          ['Phê duyệt vật liệu hoàn thiện' + (f.vatLieu ? ` (${f.vatLieu})` : ''), d(f.ngayVatLieu)],
          ...lines(f.dkKhac).map((ln) => { const c = ln.split('|').map((x) => x.trim()); return [c[0] || '', d(c[1])]; }),
        ];
        const n = qtyThang(I, f);
        return salute() +
          para(`Căn cứ Hợp đồng, ${short(I)} xác nhận đã nhận đủ các điều kiện đặt hàng sản xuất thiết bị như sau:`) +
          table([['STT', 'Điều kiện đặt hàng theo Hợp đồng', 'Ngày hoàn thành'],
            ...rows.map((c, i) => [{ t: String(i + 1), align: 'center' }, c[0], { t: c[1], align: 'center' }])], { widths: [650, 6176, 2200], header: 1 }) +
          para(`Ngày ${d(f.ngayDatHang)}, ${short(I)} đã đặt hàng sản xuất thiết bị cho ${n} thang máy của công trình tới ${f.nhaMay || 'nhà máy Schindler'} theo đúng bản vẽ và vật liệu đã được phê duyệt. Theo kế hoạch sản xuất và vận chuyển, lô hàng dự kiến về đến công trình vào ngày ${d(f.ngayVe)}. Lịch giao hàng chi tiết và yêu cầu chuẩn bị mặt bằng sẽ được chúng tôi thông báo trước khi hàng về khoảng 30 ngày.`) +
          para('Kể từ thời điểm đặt hàng, mọi thay đổi về thiết kế, chủng loại hoặc vật liệu hoàn thiện có thể ảnh hưởng đến tiến độ giao hàng và chi phí, cần được hai bên thống nhất bằng văn bản.') +
          closing(I, f, { thanks: `Kính đề nghị Quý Khách hàng ký xác nhận và gửi lại cho chúng tôi${f.hanXN ? ` trước ngày ${dmy(f.hanXN)}` : ''}. Trân trọng cảm ơn sự hợp tác của Quý Khách hàng.`,
            left: [r('XÁC NHẬN CỦA KHÁCH HÀNG', { b: true, sz: 11 }), r('\n'), ckbox(false), r('Đồng ý    ', { sz: 11 }), ckbox(false), r('Ý kiến khác:', { sz: 11 }), r('\n……………………………………', { sz: 11 }), r('\n(Ký, ghi rõ họ tên, chức vụ, đóng dấu)\n\n\nNgày: …/…/……', { i: true, sz: 10 })] });
      }),
    },
    {
      id: 'hangve1', kind: 'letter', name: 'Thông báo hàng về công trường — lần 1 (trước 30 ngày)', subject: 'Thông báo thời gian lô hàng thang máy về đến công trình',
      fields: [
        { k: 'ngayCang', label: 'Ngày dự kiến hàng về cảng', type: 'date' }, { k: 'cang', label: 'Cảng nhập', def: 'Hải Phòng' },
        { k: 'ngayVe', label: 'Ngày dự kiến hàng về công trình', type: 'date' }, { k: 'ngayMatBang', label: 'Hoàn thành mặt bằng trước ngày', type: 'date' },
        { k: 'dienTich', label: 'Diện tích mặt bằng để hàng (m²)', def: '30' }, { k: 'soThang', label: 'Số lượng thang' },
      ],
      body: letter('Thông báo thời gian lô hàng thang máy về đến công trình', ({ I, f }) => salute() + intro(I) +
        para(`Theo nội dung Hợp đồng, toàn bộ vật tư thiết bị của ${qtyThang(I, f)} thang máy dự kiến sẽ được nhập về cảng ${f.cang || '……'} vào ngày ${dmy(f.ngayCang)}. Sau khi hoàn tất thủ tục hải quan, lô hàng nói trên dự kiến sẽ được vận chuyển đến công trình vào ngày ${dmy(f.ngayVe)}.`) +
        para('Chúng tôi xin thông báo đến Quý Khách hàng các công việc cần hoàn thiện / chuẩn bị trước khi hàng về:') +
        list([`Chuẩn bị mặt bằng khô ráo, đủ rộng để lưu kho hàng hóa tại công trường trước ngày ${dmy(f.ngayMatBang)}. Dự kiến cần tối thiểu ${f.dienTich || 30} m² mặt bằng để hàng; chi tiết vị trí mặt bằng, chúng tôi sẽ cử cán bộ làm việc với Quý Khách hàng trước khi hàng về tối thiểu 07 ngày.`,
          'Bố trí nhân sự tổ chức nghiệm thu hàng hóa.', 'Hoàn tất xây dựng các giếng thang theo bản vẽ được duyệt để bàn giao cho chúng tôi thi công lắp đặt.', 'Chuẩn bị nguồn điện 3 pha cho công tác lắp đặt, vận hành.']) +
        closing(I, f)),
    },
    {
      id: 'hangve2', kind: 'letter', name: 'Thông báo hàng về công trường — lần 2 (trước 01 tuần)', subject: 'Thông báo ngày giao vật tư thang máy về công trường',
      fields: [
        { k: 'tauRoi', label: 'Hành trình tàu (rời cảng… / về cảng…)', ph: 'VD: rời cảng Thượng Hải, dự kiến về cảng Hải Phòng đầu tháng 08/2025' },
        { k: 'ngayVe', label: 'Ngày giao hàng về công trường', type: 'date' }, { k: 'khaoSat', label: 'Khảo sát mặt bằng, phương án nâng hạ trước khi hàng về', def: '3–5 ngày' },
        { k: 'dienTich', label: 'Diện tích mặt bằng để hàng (m²)', def: '30' },
      ],
      body: letter('Thông báo ngày giao vật tư thang máy về công trường', ({ I, f }) => salute() + intro(I) + para('Chúng tôi xin thông báo một số nội dung sau:') +
        head2('1. Thời gian giao hàng về dự án') +
        list([f.tauRoi ? `Tàu vận chuyển hàng hóa đã ${f.tauRoi}.` : 'Tàu vận chuyển hàng hóa đã rời cảng xuất và đang trên hành trình về cảng nhập.',
          `Sau khi hoàn thành thủ tục hải quan nhập khẩu, lô hàng thang máy dự kiến được vận chuyển về công trường ngày ${dmy(f.ngayVe)}.`,
          `${short(I)} sẽ cử cán bộ phụ trách và đơn vị vận chuyển khảo sát mặt bằng, lên phương án vận chuyển, nâng hạ hàng hóa trước khi hàng về ${f.khaoSat || '3–5 ngày'}.`]) +
        head2('2. Các công việc cần hoàn thiện / chuẩn bị trước khi hàng về') +
        list([`Bố trí mặt bằng lưu hàng tại công trường trước ngày ${dmy(f.ngayVe)}; diện tích khoảng ${f.dienTich || 30} m², khô ráo, sạch sẽ, không ảnh hưởng tới các nhà thầu khác thi công tại dự án.`,
          'Sắp xếp nhân sự nhận hàng và tham gia các công tác giám định đồng bộ, đánh giá hợp quy và nghiệm thu hàng hóa.',
          'Hoàn tất xây dựng, chống thấm, vệ sinh giếng thang theo bản vẽ được duyệt để bàn giao cho chúng tôi thi công lắp đặt sau khi hàng về.',
          'Chuẩn bị nguồn điện 3 pha cho công tác lắp đặt, vận hành.']) + closing(I, f)),
    },
    {
      id: 'defect_mos', kind: 'letter', name: 'Thông báo tồn tại giếng thang trước khi hàng tới công trình', subject: 'Thông báo kết quả khảo sát giếng thang trước khi hàng về công trình',
      fields: [{ k: 'ngayKS', label: 'Ngày khảo sát', type: 'date' }, { k: 'tonTai', label: 'Các tồn tại cần khắc phục (mỗi dòng 1 mục)', type: 'textarea', rows: 6, def: DEF_GIENG },
        { k: 'hanXong', label: 'Đề nghị hoàn thành giếng thang trước ngày', type: 'date' }, { k: 'ngayBG', label: 'Ngày bàn giao thang theo tiến độ', type: 'date' }],
      body: letter('Thông báo kết quả khảo sát giếng thang trước khi hàng về công trình', ({ I, f }) => salute() +
        para(`Trước hết xin cảm ơn Quý Khách hàng đã tin tưởng và sử dụng sản phẩm, dịch vụ thang máy do ${short(I)} cung cấp và lắp đặt.`) +
        para(`Ngày ${dmy(f.ngayKS)}, đại diện ${short(I)} đã tiến hành khảo sát giếng thang tại công trình ${orDots(I.congTrinh)} và ghi nhận một số tồn tại cần hoàn thiện trước khi hàng về như sau:`) +
        list(lines(f.tonTai || DEF_GIENG), '1') +
        para('Các kết quả trên chưa bao gồm việc kiểm tra độ thẳng đứng của giếng thang.') +
        para(`Để đảm bảo tiến độ lắp đặt, vận hành và bàn giao thang máy${f.ngayBG ? ' vào ngày ' + dmy(f.ngayBG) : ''}, rất mong Quý Khách hàng sắp xếp hoàn thành các hạng mục trên trước ngày ${dmy(f.hanXong)}.`) + closing(I, f, { thanks: 'Rất mong nhận được sự hỗ trợ và hợp tác của Quý Khách hàng.' })),
    },
    {
      // trước khi lắp đặt: tồn tại giếng thang + bảng kiểm tra điều kiện công trường (có cột tình trạng)
      id: 'defect_ld', kind: 'letter', name: 'Thông báo tồn tại giếng thang và điều kiện công trường trước khi lắp đặt',
      subject: 'Thông báo tồn tại giếng thang và điều kiện công trường cần đáp ứng trước khi lắp đặt thang máy',
      fields: [{ k: 'ngayKS', label: 'Ngày kiểm tra hiện trường', type: 'date' }, { k: 'thang', label: 'Thang / giếng thang kiểm tra', ph: 'VD: PL1, PL2 (để trống = toàn bộ)' },
        { k: 'ngayLD', label: 'Ngày dự kiến bắt đầu lắp đặt', type: 'date' }, { k: 'hanXong', label: 'Đề nghị hoàn thành trước ngày', type: 'date' },
        { k: 'tonTai', label: '1. Tồn tại giếng thang cần khắc phục (mỗi dòng 1 mục)', type: 'textarea', rows: 6, def: DEF_GIENG },
        { k: 'dieuKien', label: '2. Điều kiện công trường — mỗi dòng: nội dung | tình trạng (Đạt / Chưa đạt; để trống = ô đánh dấu)', type: 'textarea', rows: 9, def: DEF_DKCT },
        { k: 'ghiChu', label: 'Ghi chú thêm (tuỳ chọn)', type: 'textarea', rows: 2 }],
      body: letter('Thông báo tồn tại giếng thang và điều kiện công trường cần đáp ứng trước khi lắp đặt thang máy', ({ I, f }) => {
        const dk = lines(f.dieuKien || DEF_DKCT).map((ln, i) => {
          const c = ln.split('|').map(x => x.trim()), st = c[1] || '';
          const ok = /^đạt$|^ok$|^rồi|^đã/i.test(st), no = /chưa|không|^x$/i.test(st);
          return [{ t: String(i + 1), align: 'center' }, c[0], st ? { runs: [r(ok ? '✔ ' : no ? '✘ ' : ''), r(st, { b: no })], align: 'center' } : { runs: [ckbox(false), r('Đạt  '), ckbox(false), r('Chưa đạt')], align: 'center' }];
        });
        const where = f.thang ? `giếng thang ${f.thang}` : 'các giếng thang';
        return salute() +
          para(`Trước hết xin cảm ơn Quý Khách hàng đã tin tưởng và sử dụng sản phẩm, dịch vụ thang máy do ${short(I)} cung cấp và lắp đặt.`) +
          para(`Ngày ${dmy(f.ngayKS)}, đại diện ${short(I)} đã kiểm tra hiện trạng ${where} và điều kiện công trường tại ${orDots(I.congTrinh)} để chuẩn bị triển khai lắp đặt${f.ngayLD ? ' (dự kiến bắt đầu từ ngày ' + dmy(f.ngayLD) + ')' : ''}. Kết quả như sau:`) +
          head2('1. Tồn tại giếng thang cần khắc phục') + list(lines(f.tonTai || DEF_GIENG), '1') +
          head2('2. Điều kiện công trường cần đáp ứng trước khi lắp đặt') +
          table([['STT', 'Nội dung', 'Tình trạng'], ...dk], { widths: [650, 6176, 2200], header: 1 }) +
          (f.ghiChu ? lines(f.ghiChu).map(para).join('') : '') +
          para(`Công tác lắp đặt chỉ được bắt đầu khi giếng thang được hoàn thiện, bàn giao và các điều kiện trên được đáp ứng. Rất mong Quý Khách hàng sắp xếp hoàn thành các hạng mục còn tồn tại trước ngày ${dmy(f.hanXong)}; trường hợp chậm trễ, thời gian lắp đặt và bàn giao sẽ được điều chỉnh tương ứng theo quy định của Hợp đồng.`) +
          closing(I, f, { thanks: 'Rất mong nhận được sự hỗ trợ và hợp tác của Quý Khách hàng.' });
      }),
    },
    {
      id: 'defect_kd', kind: 'letter', name: 'Thông báo tồn tại giếng thang trước khi kiểm định', subject: 'Thông báo các tồn tại giếng thang cần khắc phục trước khi kiểm định',
      fields: [{ k: 'ngayKS', label: 'Ngày kiểm tra', type: 'date' }, { k: 'tonTai', label: 'Các tồn tại cần khắc phục (mỗi dòng 1 mục)', type: 'textarea', rows: 6, def: DEF_GIENG },
        { k: 'hanXong', label: 'Đề nghị hoàn thành trước ngày', type: 'date' }, { k: 'ngayKD', label: 'Ngày kiểm định dự kiến', type: 'date' }],
      body: letter('Thông báo các tồn tại giếng thang cần khắc phục trước khi kiểm định', ({ I, f }) => salute() +
        para(`Trước hết xin cảm ơn Quý Khách hàng đã tin tưởng và sử dụng sản phẩm, dịch vụ thang máy do ${short(I)} cung cấp và lắp đặt.`) +
        para(`Ngày ${dmy(f.ngayKS)}, đại diện ${short(I)} đã kiểm tra hiện trạng giếng thang tại công trình ${orDots(I.congTrinh)} và ghi nhận một số tồn tại thuộc phạm vi của Bên Mua cần khắc phục trước khi mời đơn vị kiểm định:`) +
        list(lines(f.tonTai || DEF_GIENG), '1') +
        para(`Để đảm bảo công tác kiểm định kỹ thuật an toàn${f.ngayKD ? ' dự kiến ngày ' + dmy(f.ngayKD) : ''} và bàn giao thang máy đúng tiến độ, rất mong Quý Khách hàng sắp xếp hoàn thành các hạng mục trên trước ngày ${dmy(f.hanXong)}.`) + closing(I, f, { thanks: 'Rất mong nhận được sự hỗ trợ và hợp tác của Quý Khách hàng.' })),
    },
    {
      id: 'moi_kd', kind: 'letter', name: 'Thư mời tham gia kiểm định thang máy', subject: (ctx) => `Thư mời tham gia kiểm định thang máy ${ctx.f.thang || ''}`.trim(),
      fields: [{ k: 'thang', label: 'Thang được kiểm định (số hiệu)', ph: 'VD: PL1, PL2' }, { k: 'soThang', label: 'Số lượng thang' },
        { k: 'gio', label: 'Giờ kiểm định', def: '08h30' }, { k: 'ngayKD', label: 'Ngày kiểm định', type: 'date' }, { k: 'donVi', label: 'Đơn vị kiểm định', ph: 'VD: Trung tâm kiểm định…' }],
      body: (ctx) => { const { I, f } = ctx; return header(I, f, `Thư mời tham gia kiểm định thang máy ${f.thang || ''}`.trim()) + salute() +
        para(`Trước hết xin chân thành cảm ơn Quý Khách hàng đã hỗ trợ chúng tôi trong suốt quá trình lắp đặt thang máy tại công trình ${orDots(I.congTrinh)}.`) +
        para(`Hiện nay ${short(I)} đã hoàn tất phần lắp đặt cơ khí, vận hành và chạy thử ${qtyThang(I, f)} thang máy ${f.thang || ''}; chúng tôi dự kiến mời ${f.donVi || 'đơn vị kiểm định'} tiến hành kiểm định kỹ thuật an toàn vào lúc ${f.gio || '……'} ngày ${dmy(f.ngayKD)}.`) +
        para('Nay chúng tôi trân trọng kính mời đại diện Chủ đầu tư / Ban Quản lý dự án / Tư vấn giám sát tới tham gia buổi kiểm định cùng chúng tôi vào thời gian như trên.') +
        closing(I, f, { thanks: 'Chân thành cảm ơn sự quan tâm và hợp tác của Quý Khách hàng.' }); },
    },
    {
      id: 'han_bh', kind: 'letter', name: 'Thông báo thời hạn bảo hành, bảo trì của công trình', subject: 'Thông báo thời hạn bảo hành, bảo trì miễn phí và đề nghị nhận bàn giao thang máy',
      fields: [{ k: 'ngayVe', label: 'Ngày thiết bị về đến công trình', type: 'date' }, { k: 'tuNgay', label: 'Bắt đầu bảo hành, bảo trì từ ngày', type: 'date' },
        { k: 'denNgay', label: 'Hết hạn ngày', type: 'date' }, { k: 'dieu', label: 'Điều khoản bảo hành trong hợp đồng', def: 'Điều 7.1' },
        { k: 'thangBG', label: 'Số tháng tính từ ngày bàn giao', def: '12' }, { k: 'thangVe', label: 'Số tháng tính từ ngày thiết bị về', def: '18' }],
      body: letter('Thông báo thời hạn bảo hành, bảo trì miễn phí và đề nghị nhận bàn giao thang máy', ({ I, f }) => p(r('Kính thưa Quý Khách hàng,'), { before: 4 }) +
        para(`Lời đầu thư, thay mặt ${short(I)}, chúng tôi xin trân trọng cảm ơn Quý Khách hàng đã tin tưởng lựa chọn sản phẩm thang máy do chúng tôi cung cấp và lắp đặt cho công trình “${orDots(I.congTrinh)}”, Hợp đồng số ${orDots(I.soHD)}.`) +
        list([`Căn cứ Biên bản xác nhận hàng hóa về công trình ngày ${dmy(f.ngayVe)};`, `Căn cứ ${f.dieu || 'Điều 7.1'} của Hợp đồng về bảo hành và bảo trì miễn phí;`, 'Căn cứ điều kiện thực tế tại công trình.']) +
        para(`Theo ${f.dieu || 'Điều 7.1'} của Hợp đồng: “Thời hạn bảo hành và bảo trì miễn phí thang máy là ${f.thangBG || 12} tháng tính từ ngày bàn giao thang máy hoặc ${f.thangVe || 18} tháng kể từ ngày thiết bị về đến công trình (hoặc lưu kho bên ngoài do Bên Mua không sắp xếp được mặt bằng công trình), tùy theo điều kiện nào đến sớm hơn”.`) +
        para(`Thiết bị thang máy về đến công trình ngày ${dmy(f.ngayVe)}; như vậy thời hạn bảo hành, bảo trì miễn phí được tính từ ngày ${dmy(f.tuNgay)} và sẽ hết hạn vào ngày ${dmy(f.denNgay)} (theo điều kiện ${f.thangVe || 18} tháng kể từ ngày thiết bị về đến công trình), cho dù thang máy có được đưa vào sử dụng hay không.`) +
        para('Hiện tại Nhà thầu đã hoàn thành công tác lắp đặt, kiểm định nội bộ và kiểm định kỹ thuật an toàn của cơ quan nhà nước. Kính đề nghị Quý Khách hàng có kế hoạch nhận bàn giao để đưa thang máy vào sử dụng, đảm bảo quyền lợi của Quý Khách hàng về thời hạn bảo hành, bảo trì miễn phí theo đúng các điều khoản của Hợp đồng.') +
        closing(I, f, { thanks: 'Chúng tôi xin trân trọng cảm ơn và mong sớm nhận được phản hồi từ Quý Khách hàng.' })),
    },
    {
      id: 'tinh_bh', kind: 'letter', name: 'Thông báo về việc tính thời gian bảo hành và bảo trì miễn phí', subject: 'Thông báo về việc tính thời gian bảo hành và bảo trì miễn phí của Hợp đồng',
      fields: [{ k: 'soThangBH', label: 'Thời gian bảo hành, bảo trì (tháng)', def: '18' }, { k: 'tuNgay', label: 'Bắt đầu từ ngày', type: 'date' }, { k: 'denNgay', label: 'Kết thúc ngày', type: 'date' }, { k: 'dieu', label: 'Điều khoản hợp đồng', def: 'Điều 7.1' }],
      body: letter('Thông báo về việc tính thời gian bảo hành và bảo trì miễn phí của Hợp đồng', ({ I, f }) => salute() +
        para('Lời đầu tiên, chúng tôi xin chân thành cảm ơn sự hợp tác và tín nhiệm của Quý Công ty trong thời gian qua.') +
        para('Trong suốt thời gian qua, chúng tôi luôn cố gắng thực hiện công việc của Hợp đồng một cách nhanh chóng, an toàn và đảm bảo chất lượng tốt nhất. Tuy nhiên, trong quá trình thực hiện Hợp đồng đã xảy ra việc tạm dừng / chậm trễ không do lỗi và không nằm trong tầm kiểm soát của chúng tôi. Thời gian tạm dừng như vậy không được cộng thêm vào thời gian bảo hành và bảo trì miễn phí.') +
        para(`Căn cứ ${f.dieu || 'Điều 7.1'} của Hợp đồng, chúng tôi xin thông báo: thời gian bảo hành và bảo trì miễn phí chính thức của Hợp đồng là ${f.soThangBH || 18} tháng tính từ ngày thiết bị đến công trường hoặc được lưu kho bên ngoài (nếu có), tức bắt đầu từ ngày ${dmy(f.tuNgay)} và kết thúc vào ngày ${dmy(f.denNgay)}, không phụ thuộc vào tình trạng hoàn thành của công tác lắp đặt hay công tác bàn giao theo Hợp đồng.`) +
        closing(I, f, { thanks: 'Trân trọng cảm ơn sự hợp tác của Quý Công ty.' })),
    },
    {
      id: 'tam_dung', kind: 'letter', name: 'Thông báo tạm dừng thi công lắp đặt thang máy', subject: 'Thông báo tạm dừng thi công lắp đặt thang máy',
      fields: [{ k: 'ngayDung', label: 'Tạm dừng thi công từ ngày', type: 'date' }, { k: 'thang', label: 'Thang / phạm vi tạm dừng', ph: 'VD: PL1–PL4 (để trống = toàn bộ thang của Hợp đồng)' },
        { k: 'lyDo', label: 'Lý do tạm dừng (tóm tắt)', def: 'Mặt bằng và điều kiện thi công chưa đáp ứng để tiếp tục lắp đặt do còn các tồn đọng nêu tại mục 1', wide: true },
        { k: 'tonCDT', label: '1.1 Tồn đọng phía Chủ đầu tư — mỗi dòng: nội dung | hạn đề nghị hoàn thành (tuỳ chọn)', type: 'textarea', rows: 5, def: DEF_TD_CDT },
        { k: 'nhaThauXD', label: 'Tên nhà thầu xây dựng (tuỳ chọn)', ph: 'VD: Công ty CP Xây dựng ABC', wide: true },
        { k: 'tonNTXD', label: '1.2 Tồn đọng phía Nhà thầu xây dựng — mỗi dòng: nội dung | hạn đề nghị hoàn thành (tuỳ chọn)', type: 'textarea', rows: 5, def: DEF_TD_NTXD },
        { k: 'hienTrang', label: '2. Hiện trạng đã thi công — mỗi dòng: thang | công việc đã hoàn thành | tỷ lệ hoàn thành', type: 'textarea', rows: 4, ph: 'VD:\nPL1 | Lắp đặt ray dẫn hướng cabin, đối trọng và bracket | 40%\nPL2 | Lắp đặt ray, bracket, máy kéo | 55%' },
        { k: 'conLai', label: '3. Khối lượng còn lại — mỗi dòng: công việc còn lại | số ngày làm việc', type: 'textarea', rows: 6, def: DEF_TD_CONLAI },
        { k: 'tgConLai', label: 'Tổng thời gian thi công còn lại (ngày làm việc) — để trống = cộng cột số ngày ở mục 3', ph: 'VD: 35' },
        { k: 'baoTruoc', label: 'Báo trước khi quay lại thi công (ngày làm việc)', def: '07' },
        { k: 'ghiChu', label: 'Ghi chú thêm (tuỳ chọn)', type: 'textarea', rows: 2 }],
      body: letter('Thông báo tạm dừng thi công lắp đặt thang máy', ({ I, f }) => {
        const cut = (ln) => { const c = ln.split('|').map(x => x.trim()); return c; };
        const issueTbl = (txt) => {
          const rows = lines(txt).map(cut);
          if (!rows.length) return para('Không có.');
          return table([['STT', 'Nội dung tồn đọng cần giải quyết', 'Hạn đề nghị hoàn thành'],
            ...rows.map((c, i) => [{ t: String(i + 1), align: 'center' }, c[0], { t: c[1] ? (/^\d{4}-\d{2}-\d{2}$/.test(c[1]) ? dmy(c[1]) : c[1]) : '…/…/……', align: 'center' }])],
            { widths: [650, 6176, 2200], header: 1 });
        };
        const done = lines(f.hienTrang).map(cut);
        const rest = lines(f.conLai || DEF_TD_CONLAI).map(cut);
        const sumDays = rest.reduce((a, c) => a + (Number(String(c[1] || '').replace(',', '.').match(/[\d.]+/)) || 0), 0);
        const total = String(f.tgConLai || '').trim() || (sumDays ? String(sumDays) : '……');
        const bt = String(f.baoTruoc || '07').trim(), btN = Number(bt);
        const btTxt = btN > 0 && btN < 100 ? `${String(btN).padStart(2, '0')} (${read3(btN, false)})` : bt;
        const where = f.thang ? `thang máy ${f.thang}` : `${qtyThang(I, f)} thang máy`;
        const ntxd = f.nhaThauXD ? ` (${f.nhaThauXD})` : '';
        return salute() +
          para(`Trước hết, ${short(I)} xin chân thành cảm ơn sự hợp tác của Quý Khách hàng trong quá trình thực hiện Hợp đồng.`) +
          para(`Trong thời gian qua, ${short(I)} đã triển khai công tác lắp đặt ${where} tại công trình ${orDots(I.congTrinh)}. Tuy nhiên, hiện nay ${(f.lyDo || 'mặt bằng và điều kiện thi công chưa đáp ứng để tiếp tục lắp đặt').replace(/^./, (x) => x.toLowerCase())}. Vì vậy, ${short(I)} xin thông báo tạm dừng thi công kể từ ngày ${dmy(f.ngayDung)} cho đến khi các tồn đọng dưới đây được giải quyết.`) +
          head2('1. Các tồn đọng cần giải quyết trước khi tiếp tục thi công') +
          p(r('1.1. Phía Chủ đầu tư', { b: true, i: true }), { before: 2, keep: true }) + issueTbl(f.tonCDT == null ? DEF_TD_CDT : f.tonCDT) +
          p(r(`1.2. Phía Nhà thầu xây dựng${ntxd}`, { b: true, i: true }), { before: 2, keep: true }) + issueTbl(f.tonNTXD == null ? DEF_TD_NTXD : f.tonNTXD) +
          head2(`2. Hiện trạng đã thi công (tính đến ngày ${dmy(f.ngayDung)})`) +
          (done.length ? table([['STT', 'Thang', 'Công việc đã hoàn thành', 'Tỷ lệ hoàn thành'],
            ...done.map((c, i) => [{ t: String(i + 1), align: 'center' }, { t: c[0] || '', align: 'center' }, c[1] || '', { t: c[2] || '', align: 'center' }])], { widths: [650, 1300, 5276, 1800], header: 1 }) : para('……')) +
          head2('3. Khối lượng và thời gian thi công còn lại') +
          table([['STT', 'Công việc còn lại', 'Thời gian (ngày làm việc)'],
            ...rest.map((c, i) => [{ t: String(i + 1), align: 'center' }, c[0] || '', { t: c[1] || '', align: 'center' }]),
            [{ t: 'Tổng thời gian thi công còn lại', b: true, span: 2, align: 'right' }, { t: total + ' ngày', b: true, align: 'center' }]], { widths: [650, 6176, 2200], header: 1 }) +
          para(`Thời gian thi công còn lại dự kiến khoảng ${total} ngày làm việc, tính từ ngày ${short(I)} quay lại công trường sau khi các tồn đọng nêu tại mục 1 đã được giải quyết xong. Tiến độ hoàn thành và bàn giao thang máy theo Hợp đồng sẽ được điều chỉnh tương ứng với thời gian tạm dừng.`) +
          head2('4. Đề nghị') +
          list([`Quý Khách hàng chỉ đạo các bên liên quan (Chủ đầu tư, Nhà thầu xây dựng) sớm hoàn thành các tồn đọng nêu tại mục 1.`,
            `Khi có kế hoạch hoàn thành các mục tồn đọng, đề nghị Quý Khách hàng thông báo bằng văn bản cho ${short(I)} trước tối thiểu ${btTxt} ngày làm việc để ${short(I)} thu xếp nhân sự, máy móc, thiết bị quay lại tiếp tục thi công.`,
            `Trong thời gian tạm dừng, đề nghị Quý Khách hàng phối hợp bảo quản các thiết bị, vật tư đã lắp đặt và đang lưu kho tại công trường.`], '•') +
          (f.ghiChu ? lines(f.ghiChu).map(para).join('') : '') +
          closing(I, f, { thanks: 'Rất mong nhận được sự hỗ trợ và hợp tác của Quý Khách hàng.' });
      }),
    },
    {
      id: 'bao_quan', kind: 'letter', name: 'Thông báo trách nhiệm bảo quản tài sản khi tạm dừng thi công', subject: 'Thông báo về việc bảo quản tài sản trên công trường',
      fields: [{ k: 'soTB', label: 'Số thông báo tạm dừng của Bên Mua' }, { k: 'ngayTB', label: 'Ngày thông báo tạm dừng', type: 'date' }, { k: 'tuNgay', label: 'Tạm ngưng thi công từ ngày', type: 'date' }],
      body: letter('Thông báo về việc bảo quản tài sản trên công trường', ({ I, f }) => p([r('Căn cứ: ', { b: true }), r(`Thông báo tạm dừng thi công số ${f.soTB || '……'} ngày ${dmy(f.ngayTB)} của Quý Công ty (dưới đây gọi là “Thông báo”).`)], { align: 'both' }) + salute() +
        para('Lời đầu tiên, chúng tôi xin chân thành cảm ơn sự hợp tác và tín nhiệm của Quý Công ty.') +
        para(`Trong suốt thời gian qua, chúng tôi luôn cố gắng thực hiện công việc của Hợp đồng một cách nhanh chóng, an toàn và đảm bảo chất lượng tốt nhất. Tuy nhiên, để tuân thủ Thông báo kể trên, chúng tôi đã buộc phải tạm ngưng toàn bộ công tác lắp đặt${f.tuNgay ? ' kể từ ngày ' + dmy(f.tuNgay) : ''} cũng như rút toàn bộ nhân lực ra khỏi công trường để giảm thiểu chi phí.`) +
        para('Vì việc tạm ngưng là theo quyết định của Quý Công ty, toàn bộ vật tư, thiết bị đã được tập kết đến công trường phải được giám sát và bảo vệ bởi Quý Công ty. Quý Công ty chịu trách nhiệm đối với những mất mát, hư hỏng xảy ra đối với vật tư, thiết bị kể trên (nếu có).') + closing(I, f, { thanks: 'Rất mong nhận được sự hợp tác của Quý Công ty.' })),
    },
    {
      id: 'kq_nt', kind: 'letter', name: 'Thông báo về kết quả nghiệm thu', subject: (ctx) => `Thông báo về kết quả nghiệm thu ${ctx.f.hangMucNT || '……'}`,
      fields: [{ k: 'hangMucNT', label: 'Hạng mục / công việc đã mời nghiệm thu' }, { k: 'ngayMoi', label: 'Ngày gửi thư mời nghiệm thu', type: 'date' }, { k: 'soMoi', label: 'Số thư mời nghiệm thu' },
        { k: 'soNgay', label: 'Số ngày không nhận được phản hồi', def: '07' }, { k: 'ngayNT', label: 'Ngày nghiệm thu (theo thư mời)', type: 'date' }, { k: 'dieu', label: 'Điều khoản hợp đồng', def: 'Điều 6.2' },
        { k: 'dotTT', label: 'Đợt thanh toán liên quan' }, { k: 'dinhKem', label: 'Tài liệu đính kèm (mỗi dòng 1 tài liệu)', type: 'textarea', rows: 4, def: 'Thư mời nghiệm thu đã gửi\nGiấy giao nhận thư mời\nBản vẽ phục vụ nghiệm thu\nCác chứng chỉ, hồ sơ phục vụ nghiệm thu' }],
      body: (ctx) => { const { I, f } = ctx; const hm = f.hangMucNT || '……'; return header(I, f, `Thông báo về kết quả nghiệm thu ${hm}`) + salute() +
        para('Lời đầu tiên, chúng tôi xin chân thành cảm ơn sự hợp tác và tín nhiệm của Quý Công ty trong thời gian qua.') +
        para(`Ngày ${dmy(f.ngayMoi)}, chúng tôi đã gửi thư mời nghiệm thu số ${f.soMoi || '……'} đến Quý Công ty và các bên liên quan để mời nghiệm thu ${hm} cùng các tài liệu phục vụ nghiệm thu như đính kèm. Tuy nhiên, sau ${f.soNgay || '……'} ngày kể từ ngày gửi, chúng tôi vẫn không nhận được phản hồi hợp lý nào từ phía Quý Công ty và/hoặc các bên liên quan về việc từ chối thực hiện nghiệm thu.`) +
        para(`Do đó, căn cứ ${f.dieu || 'Điều 6.2'} của Hợp đồng, chúng tôi xin thông báo:`) +
        list([`Ngày nghiệm thu ${hm} là ngày nghiệm thu theo thư mời nghiệm thu của chúng tôi; theo đó ${hm} được hiểu là đã được nghiệm thu và bàn giao cho Quý Công ty vào ngày ${dmy(f.ngayNT)}.`,
          'Mọi rủi ro liên quan đến thang máy kể từ thời điểm trên được chuyển giao cho Quý Công ty; chúng tôi được miễn trừ mọi trách nhiệm liên quan.',
          `Yêu cầu về tài liệu nghiệm thu và bàn giao được ký xác nhận bởi các Bên tại đợt thanh toán ${f.dotTT || '……'} sẽ không được áp dụng.`], '-') +
        para('Tài liệu đính kèm:') + list(lines(f.dinhKem), '1') + closing(I, f, { thanks: 'Rất mong nhận được sự hợp tác của Quý Công ty.' }); },
    },
    {
      id: 'ban_giao', kind: 'letter', name: 'Thông báo về việc bàn giao thang máy', subject: 'Thông báo về việc bàn giao thang máy',
      fields: [{ k: 'soNgay', label: 'Biên bản bàn giao coi như hợp lệ sau (ngày)', def: '07' }, { k: 'ngayNT', label: 'Ngày nghiệm thu, tiếp nhận đề xuất', type: 'date' }, { k: 'dieu', label: 'Điều khoản hợp đồng', def: 'Điều 6.4' }],
      body: letter('Thông báo về việc bàn giao thang máy', ({ I, f }) => salute() +
        para('Lời đầu tiên, chúng tôi xin chân thành cảm ơn sự hợp tác và tín nhiệm của Quý Công ty.') +
        para('Hiện tại, chúng tôi đã hoàn tất các công việc cần thiết và sẵn sàng bàn giao thang máy theo đúng quy định của Hợp đồng. Tuy nhiên đến thời điểm này, sau khi chúng tôi đã phát hành các thông báo mời Quý Công ty tham gia nghiệm thu để thực hiện việc bàn giao, Quý Công ty vẫn chưa tham gia nghiệm thu cũng như chưa có phản hồi về việc tiếp nhận bàn giao thang máy.') +
        para('Trong trường hợp việc trì hoãn nhận bàn giao kéo dài, chúng tôi e rằng sẽ dẫn đến các hệ quả không mong muốn sau:') +
        list(['Phát sinh chi phí bảo vệ, bảo trì thang máy trong thời gian trì hoãn nhận bàn giao;', 'Phát sinh chi phí kéo dài thời gian bảo hành, bảo trì tương ứng với khoảng thời gian trì hoãn;', 'Phát sinh các chi phí liên quan khác (nếu có).']) +
        para(`Căn cứ ${f.dieu || 'Điều 6.4'} của Hợp đồng, biên bản bàn giao thang máy sẽ được coi như phát hành hợp lệ sau ${f.soNgay || '……'} ngày kể từ ngày nghiệm thu theo thông báo mời nghiệm thu của chúng tôi.`) +
        para(`Công văn này được hiểu như một thông báo mời tham gia nghiệm thu. Chúng tôi mong muốn Quý Công ty thực hiện việc nghiệm thu và tiếp nhận thang máy vào ngày ${dmy(f.ngayNT)} và nhận được xác nhận của Quý Công ty không muộn hơn ngày nêu trên. Nếu không nhận được phản hồi, thang máy sẽ được coi là đã được nghiệm thu vào ngày ${dmy(f.ngayNT)} theo quy định của Hợp đồng; mọi rủi ro, sự cố liên quan đến thang máy sẽ chính thức chuyển cho Quý Công ty kể từ thời điểm trên.`) +
        closing(I, f, { thanks: 'Rất mong nhận được sự hợp tác của Quý Công ty.' })),
    },
    {
      id: 'bb_cote', kind: 'bb', name: 'Biên bản hiện trường nghiệm thu cote cửa tầng', subject: 'Biên bản hiện trường — kiểm tra cao độ (cote) cửa thang máy',
      fields: [{ k: 'gio', label: 'Thời gian (giờ)', def: '…… giờ ……' }, { k: 'tangs', label: 'Các tầng (cách nhau dấu phẩy)', def: 'B, 1, 2, 3, 4, 5' },
        { k: 'daiDien1', label: 'Đại diện Chủ đầu tư / TVGS (họ tên – chức vụ)' }, { k: 'daiDien2', label: 'Đại diện Nhà thầu (họ tên – chức vụ)' },
        { k: 'yeuCau', label: 'Yêu cầu kiểm tra', def: 'Sill cửa thang cao hơn cote hoàn thiện của tòa nhà từ 0–5 mm' }],
      body: ({ I, f }) => bbHeader(I, f, 'BIÊN BẢN HIỆN TRƯỜNG', 'BBHT') +
        head2('1. Thời gian và địa điểm') + para(`Vào lúc ${f.gio || '…… giờ ……'}, ${ngayVN(f.ngay)}, tại công trình ${orDots(I.congTrinh)}. Chúng tôi gồm:`) +
        head2('2. Thành phần') + para('Đại diện Chủ đầu tư / Tư vấn giám sát: ' + orDots(f.daiDien1, 60)) + para('Đại diện Nhà thầu: ' + orDots(f.daiDien2, 60)) +
        head2('3. Nội dung: kiểm tra cao độ / cote cửa thang máy') + bullet(f.yeuCau || 'Sill cửa thang cao hơn cote hoàn thiện của tòa nhà từ 0–5 mm') +
        table([['Tầng', 'Đạt', 'Không đạt', 'Ghi chú'], ...String(f.tangs || 'B, 1, 2, 3').split(',').map(s => s.trim()).filter(Boolean).map(t => [{ t, align: 'center' }, '', '', ''])],
          { widths: [1800, 1800, 1800, 3626], header: 1, rowH: 400 }) +
        head2('4. Kết luận') + para('…'.repeat(90)) + signRow(['Đại diện Chủ đầu tư / TVGS', 'Đại diện Nhà thầu']),
    },
    {
      id: 'bb_huanluyen', kind: 'bb', name: 'Biên bản huấn luyện sử dụng, cứu hộ và bàn giao chìa khoá', subject: 'Biên bản huấn luyện và bàn giao chìa khoá',
      fields: [{ k: 'tg', label: 'Thời gian huấn luyện', def: '……h…… đến ……h……' }, { k: 'nguoiHL', label: 'Người huấn luyện / người giao chìa khoá' }, { k: 'chucDanh', label: 'Chức danh người giao', def: 'Giám sát lắp đặt' },
        { k: 'chiaKhoa', label: 'Chìa khoá bàn giao (mỗi dòng 1 loại)', type: 'textarea', rows: 5, def: '01 chìa khoá tam giác mở cửa tầng\n01 chìa khoá mở hộp ưu tiên trong cabin\n01 chìa khoá khoá thang tại tầng chính\n01 chìa khoá tủ điều khiển' },
        { k: 'soDong', label: 'Số dòng danh sách học viên', def: '12' }],
      body: ({ I, f }) => bbHeader(I, f, 'BIÊN BẢN HUẤN LUYỆN\nSỬ DỤNG THANG MÁY VÀ CỨU HỘ HÀNH KHÁCH TRONG TÌNH HUỐNG KHẨN CẤP', 'BBHL') +
        para(`Thời gian huấn luyện: ${f.tg || '……h…… đến ……h……'}, ${ngayVN(f.ngay)}.`) + para('Người huấn luyện: ' + orDots(f.nguoiHL || I.chtTen, 40)) +
        head2('A. Nội dung huấn luyện') + list([
          'Hướng dẫn sử dụng thang máy và các chức năng cơ bản: kích hoạt công tắc báo cháy cho thang về tầng thoát hiểm khi có báo cháy, vận hành thang ở chế độ ưu tiên (Reservation).',
          'Hướng dẫn cứu hộ hành khách kẹt trong thang máy khi có sự cố theo quy trình của nhà sản xuất.',
          'Thực hành các thao tác trên thực tế thang máy (danh sách nhân viên kỹ thuật, bảo vệ tòa nhà được huấn luyện ký tên ở trang sau).',
          'Bàn giao chìa khoá cửa tầng thang máy (biên bản bàn giao chìa khoá đính kèm).'], '1') +
        head2('B. Khuyến cáo') + list([
          `Vì sự an toàn của hành khách và người cứu hộ, ${short(I)} yêu cầu chỉ những nhân viên đã được huấn luyện mới được thực hiện việc cứu hộ; khuyến cáo mọi quy trình cứu hộ nên được thực hiện bởi nhân viên của ${short(I)}.`,
          'Chìa khoá cửa tầng phải được quản lý nghiêm ngặt; chỉ người đã được huấn luyện mới được phép sử dụng.',
          'Ban Quản lý tòa nhà và chủ sở hữu thang máy có trách nhiệm tuân thủ các quy định về quản lý, sử dụng thang máy theo tiêu chuẩn Việt Nam hiện hành.',
          'Khuyến nghị tổ chức các lớp huấn luyện nhắc lại về cứu hộ hành khách định kỳ cho nhân viên vận hành.'], '1') +
        head2('C. Hướng dẫn sử dụng thang máy') + list(['Không dùng bất cứ vật gì để chèn, chặn cửa thang khi cửa đang đóng / mở.', 'Không sử dụng thang máy khi có cháy.', 'Không xô đẩy, nhảy trong cabin; không chở quá tải trọng cho phép.',
          'Khi bị kẹt trong thang: bấm và giữ nút chuông (khoảng 5 giây) đến khi chuông kêu, liên lạc qua loa – micro và giữ bình tĩnh chờ cứu hộ.']) +
        signRow(['Đại diện Bên nhận huấn luyện', 'Đại diện Nhà thầu']) +
        p(r('DANH SÁCH THAM DỰ KHOÁ HUẤN LUYỆN', { b: true, sz: 13 }), { align: 'center', pageBreak: true, after: 6 }) +
        table([['STT', 'Họ và tên', 'Đơn vị / chức danh', 'Ký tên', 'Ghi chú'], ...Array.from({ length: Math.max(1, Math.min(40, +f.soDong || 12)) }, (_, i) => [{ t: String(i + 1), align: 'center' }, '', '', '', ''])],
          { widths: [700, 2900, 2300, 1700, 1426], header: 1, rowH: 460 }) +
        p(r('BIÊN BẢN BÀN GIAO CHÌA KHOÁ CỬA TẦNG THANG MÁY', { b: true, sz: 13 }), { align: 'center', pageBreak: true, after: 6 }) +
        para(`Bên giao: ${CTY(I)}`) + para(`Họ và tên người giao: ${orDots(f.nguoiHL || I.chtTen, 40)}     Chức danh: ${f.chucDanh || 'Giám sát lắp đặt'}`) +
        para('Bên nhận: ' + orDots(I.chuDauTu, 60)) + para('Họ và tên người nhận: ' + '.'.repeat(40) + '     Chức danh: ' + '.'.repeat(30)) +
        para('Gồm:') + list(lines(f.chiaKhoa)) + signRow(['Bên nhận', 'Bên giao']),
    },
    {
      // Phiếu đề xuất phê duyệt (RFA — Request For Approval): nhà thầu trình hồ sơ để TVGS / Chủ đầu tư xem xét, phê duyệt
      id: 'rfa', kind: 'rfa', name: 'RFA — Phiếu đề xuất phê duyệt (Request For Approval)', subject: (ctx) => `Đề xuất phê duyệt ${(ctx.f.loai || 'hồ sơ').toLowerCase()}`,
      fields: [
        { k: 'loai', label: 'Loại hồ sơ trình', type: 'select', def: 'Bản vẽ thi công (Shop drawing)', options: RFA_TYPES },
        { k: 'mucDich', label: 'Mục đích trình', type: 'select', def: 'Phê duyệt', options: RFA_PURPOSE },
        { k: 'tieuDe', label: 'Nội dung trình (tiêu đề)', def: 'Bản vẽ thi công hệ thống thang máy', wide: true },
        { k: 'lan', label: 'Lần trình / phiên bản', def: 'Lần 1 – Rev.00' },
        { k: 'thayThe', label: 'Thay thế RFA số (nếu trình lại)', ph: 'để trống nếu trình lần đầu' },
        { k: 'hanPH', label: 'Đề nghị phản hồi trước ngày', type: 'date' },
        APPROVER_FIELD,
        { k: 'guiDen', label: 'Gửi đến (để trống = theo bên duyệt)', ph: 'VD: Ban QLDA / Tư vấn giám sát' },
        { k: 'taiLieu', label: 'Tài liệu đính kèm — mỗi dòng: số hiệu | tên tài liệu | phiên bản | số bản', type: 'textarea', rows: 6,
          def: 'TM-01 | Bản vẽ mặt bằng hố thang | 00 | 03\nTM-02 | Bản vẽ mặt cắt giếng thang | 00 | 03\nTM-03 | Bản vẽ mặt trước và lỗ chờ cửa tầng | 00 | 03\nTM-04 | Thông số kỹ thuật thang máy | 00 | 03' },
        { k: 'dienGiai', label: 'Diễn giải / nội dung đề xuất (để trống = câu mặc định theo bên duyệt)', type: 'textarea', rows: 4 },
        { k: 'canCu', label: 'Căn cứ (mỗi dòng 1 mục)', type: 'textarea', rows: 3,
          def: 'Hợp đồng và các phụ lục hợp đồng\nHồ sơ thiết kế, bản vẽ kiến trúc của công trình\nTCVN 6395:2008 / TCVN 6396 (thang máy điện) và quy định hiện hành' },
        { k: 'nguoiLap', label: 'Người lập (nhà thầu)', ph: 'Họ tên – chức danh' },
      ],
      body: ({ I, f }) => {
        const box = (on) => r(on ? '☒ ' : '☐ ', { font: 'Segoe UI Symbol' });
        const pick = (opts, val) => opts.map(o => [box(o === val), r(o + '    ')]).flat();
        const otherType = f.loai && !RFA_TYPES.includes(f.loai);
        const docs = lines(f.taiLieu).map((ln, i) => { const c = ln.split('|').map(x => x.trim()); return [{ t: String(i + 1), align: 'center' }, c[0] || '', c[1] || (c.length === 1 ? c[0] : ''), { t: c[2] || '', align: 'center' }, { t: c[3] || '', align: 'center' }]; })
          .map(row => (row[2] === row[1] && row[1] ? [row[0], '', row[1], row[3], row[4]] : row));
        const to = sendTo(I, f), ob = ownerBox(I, f);
        const info = table([
          [{ t: 'Dự án / Project', b: true }, { t: orDots(I.congTrinh), span: 3 }],
          [{ t: 'Hợp đồng số', b: true }, { t: `${orDots(I.soHD)}${I.ngayHD ? ' ngày ' + dmy(I.ngayHD) : ''}`, span: 3 }],
          [{ t: 'Số RFA', b: true }, { runs: [r(f.so || '……', { b: true })] }, { t: 'Ngày trình', b: true }, dmy(f.ngay)],
          [{ t: 'Lần trình', b: true }, f.lan || 'Lần 1 – Rev.00', { t: 'Hạn phản hồi', b: true }, f.hanPH ? dmy(f.hanPH) : '…/…/……'],
          [{ t: 'Từ (Nhà thầu)', b: true }, { t: CTY(I), span: 3 }],
          [{ t: 'Gửi đến', b: true }, { t: orDots(to), span: 3 }],
          ...(f.thayThe ? [[{ t: 'Thay thế RFA', b: true }, { t: f.thayThe, span: 3 }]] : []),
          [{ t: 'Mục đích trình', b: true }, { runs: pick(RFA_PURPOSE, f.mucDich || RFA_PURPOSE[0]), span: 3 }],
        ], { widths: [2000, 2700, 1700, 2626] });
        const resp = table([
          [{ t: 'PHẦN DÀNH CHO ' + ob.head, b: true, span: 2, fill: 'D9E2F3', align: 'center' }],
          [{ runs: [box(false), r('A – Phê duyệt', { b: true }), r(' (Approved)', { i: true })] }, { runs: [box(false), r('B – Duyệt theo ý kiến', { b: true }), r(' (Approved as noted)', { i: true })] }],
          [{ runs: [box(false), r('C – Sửa và trình lại', { b: true }), r(' (Revise & resubmit)', { i: true })] }, { runs: [box(false), r('D – Từ chối', { b: true }), r(' (Rejected)', { i: true })] }],
          [{ runs: [r('Ý kiến / Comments:', { b: true }), r('\n' + '…'.repeat(40) + '\n' + '…'.repeat(40), { sz: 11 })], span: 2 }],
          reviewSigns(I, f),
        ], { widths: [4513, 4513] });
        return p(r('PHIẾU ĐỀ XUẤT PHÊ DUYỆT', { b: true, sz: 15 }), { align: 'center', after: 0 }) +
          p(r('REQUEST FOR APPROVAL (RFA)', { b: true, i: true, sz: 11 }), { align: 'center', after: 6 }) + info +
          head2('1. Loại hồ sơ trình') + p(otherType ? [box(true), r(f.loai)] : pick(RFA_TYPES, f.loai || RFA_TYPES[0]), { align: 'left' }) +
          head2('2. Nội dung đề xuất') + p([r('Nội dung trình: ', { b: true }), r(orDots(f.tieuDe || 'Bản vẽ thi công hệ thống thang máy'))]) + para(f.dienGiai || `Nhà thầu trình hồ sơ nêu trên để ${ob.who} xem xét, phê duyệt làm cơ sở triển khai thi công lắp đặt hệ thống thang máy theo Hợp đồng.`) +
          head2('3. Tài liệu đính kèm') +
          table([['STT', 'Số hiệu', 'Tên tài liệu', 'Phiên bản', 'Số bản'], ...(docs.length ? docs : [[{ t: '1', align: 'center' }, '', '', '', '']])], { widths: [650, 1600, 4476, 1200, 1100], header: 1 }) +
          (lines(f.canCu).length ? p([r('4. Căn cứ: ', { b: true }), r(lines(f.canCu).join('; ') + '.')], { align: 'both', before: 4 }) : '') +
          table([[
            { runs: [r('Người lập', { b: true, sz: 11 }), r('\n(Ký, ghi rõ họ tên)\n\n' + (f.nguoiLap || ''), { i: true, sz: 10 })], align: 'center', vAlign: 'top' },
            { runs: [r('ĐẠI DIỆN NHÀ THẦU', { b: true, sz: 11 }), r('\n' + (f.chucVuKy || I.chucVuKy || 'Quản lý dự án'), { b: true, sz: 11 }), r('\n\n' + (f.nguoiKy || I.nguoiKy || ''), { b: true })], align: 'center', vAlign: 'top' },
          ]], { widths: [4513, 4513], border: false }) + tail(resp);
      },
    },
    {
      // Phiếu yêu cầu cung cấp thông tin / làm rõ (RFI — Request For Information)
      id: 'rfi', kind: 'rfa', file: 'Yeu cau cung cap thong tin', name: 'RFI — Phiếu yêu cầu cung cấp thông tin (Request For Information)', subject: (ctx) => `Yêu cầu cung cấp thông tin – ${ctx.f.hangMuc || 'hệ thống thang máy'}`,
      fields: [
        { k: 'hangMuc', label: 'Hạng mục / khu vực', def: 'Hệ thống thang máy' },
        { k: 'thamChieu', label: 'Bản vẽ / tài liệu tham chiếu', ph: 'VD: Bản vẽ kiến trúc KT-05, mặt cắt giếng thang' },
        { k: 'hanTL', label: 'Đề nghị trả lời trước ngày', type: 'date' },
        APPROVER_FIELD,
        { k: 'guiDen', label: 'Gửi đến (để trống = theo bên trả lời)' },
        { k: 'cauHoi', label: 'Nội dung cần làm rõ (mỗi dòng 1 câu hỏi)', type: 'textarea', rows: 5,
          def: 'Đề nghị xác nhận cao độ hoàn thiện sàn (FFL) tại các tầng để lắp đặt cửa tầng thang máy\nĐề nghị cung cấp vị trí và công suất nguồn điện cấp cho phòng máy / tủ điều khiển' },
        { k: 'deXuat', label: 'Đề xuất của nhà thầu (nếu có)', type: 'textarea', rows: 3 },
        { k: 'anhHuong', label: 'Ảnh hưởng nếu chưa có trả lời', type: 'select', def: 'Ảnh hưởng tiến độ', options: RFI_IMPACT },
        { k: 'dinhKem', label: 'Tài liệu đính kèm (mỗi dòng 1 mục)', type: 'textarea', rows: 2 },
        { k: 'nguoiLap', label: 'Người lập (nhà thầu)', ph: 'Họ tên – chức danh' },
      ],
      body: ({ I, f }) => {
        const ob = ownerBox(I, f), qs = lines(f.cauHoi), att = lines(f.dinhKem);
        const info = table([
          [{ t: 'Dự án / Project', b: true }, { t: orDots(I.congTrinh), span: 3 }],
          [{ t: 'Hợp đồng số', b: true }, { t: `${orDots(I.soHD)}${I.ngayHD ? ' ngày ' + dmy(I.ngayHD) : ''}`, span: 3 }],
          [{ t: 'Số RFI', b: true }, { runs: [r(f.so || '……', { b: true })] }, { t: 'Ngày gửi', b: true }, dmy(f.ngay)],
          [{ t: 'Hạng mục', b: true }, f.hangMuc || 'Hệ thống thang máy', { t: 'Hạn trả lời', b: true }, f.hanTL ? dmy(f.hanTL) : '…/…/……'],
          [{ t: 'Từ (Nhà thầu)', b: true }, { t: CTY(I), span: 3 }],
          [{ t: 'Gửi đến', b: true }, { t: orDots(sendTo(I, f)), span: 3 }],
          [{ t: 'Tham chiếu', b: true }, { t: f.thamChieu || '—', span: 3 }],
        ], { widths: [2000, 2700, 1700, 2626] });
        const resp = table([
          [{ t: 'PHẦN TRẢ LỜI CỦA ' + ob.head.replace(' (FOR CONSULTANT / OWNER USE)', ' (RESPONSE)').replace(' (FOR OWNER USE)', ' (RESPONSE)'), b: true, span: 2, fill: 'D9E2F3', align: 'center' }],
          [{ runs: [r('Nội dung trả lời / Response:', { b: true }), r('\n' + Array.from({ length: 4 }, () => '…'.repeat(40)).join('\n'), { sz: 11 })], span: 2 }],
          reviewSigns(I, f),
        ], { widths: [4513, 4513] });
        return p(r('PHIẾU YÊU CẦU CUNG CẤP THÔNG TIN', { b: true, sz: 15 }), { align: 'center', after: 0 }) +
          p(r('REQUEST FOR INFORMATION (RFI)', { b: true, i: true, sz: 11 }), { align: 'center', after: 6 }) + info +
          head2('1. Nội dung cần làm rõ') + (qs.length ? list(qs, '1') : para('…'.repeat(90))) +
          (lines(f.deXuat).length ? head2('2. Đề xuất của nhà thầu') + para(lines(f.deXuat).join(' ')) : '') +
          head2((lines(f.deXuat).length ? '3' : '2') + '. Ảnh hưởng nếu chưa có trả lời') + p(pickBox(RFI_IMPACT, f.anhHuong || RFI_IMPACT[1])) +
          (att.length ? p([r('Tài liệu đính kèm: ', { b: true }), r(att.join('; ') + '.')], { before: 4 }) : '') +
          table([[
            { runs: [r('Người lập', { b: true, sz: 11 }), r('\n(Ký, ghi rõ họ tên)\n\n' + (f.nguoiLap || ''), { i: true, sz: 10 })], align: 'center', vAlign: 'top' },
            { runs: [r('ĐẠI DIỆN NHÀ THẦU', { b: true, sz: 11 }), r('\n' + (f.chucVuKy || I.chucVuKy || 'Quản lý dự án'), { b: true, sz: 11 }), r('\n\n' + (f.nguoiKy || I.nguoiKy || ''), { b: true })], align: 'center', vAlign: 'top' },
          ]], { widths: [4513, 4513], border: false }) + tail(resp);
      },
    },
    {
      // Công văn báo giá công việc phát sinh: bảng hạng mục tự tính thành tiền, VAT, tổng cộng, số tiền bằng chữ
      id: 'bao_gia_ps', kind: 'letter', name: 'Báo giá công việc phát sinh', subject: (ctx) => `Báo giá công việc phát sinh${ctx.f.tieuDe ? ' – ' + ctx.f.tieuDe : ''}`,
      fields: [
        { k: 'tieuDe', label: 'Tên công việc phát sinh (ngắn)', def: 'Bổ sung hạng mục thang máy', wide: true },
        { k: 'lyDo', label: 'Lý do phát sinh', type: 'select', def: 'Theo yêu cầu của Chủ đầu tư', options: VO_REASONS },
        { k: 'canCuYC', label: 'Căn cứ (văn bản yêu cầu / biên bản hiện trường)', ph: 'VD: Công văn số 15/CV-CĐT ngày 10/11/2026' },
        { k: 'hangMucBG', label: 'Hạng mục báo giá — mỗi dòng: nội dung | ĐVT | số lượng | đơn giá (VNĐ)', type: 'textarea', rows: 5,
          def: 'Bổ sung cửa tầng thang máy (tầng tum) | bộ | 1 | 45.000.000\nNhân công lắp đặt, căn chỉnh bổ sung | gói | 1 | 8.000.000' },
        { k: 'vat', label: 'Thuế GTGT (%)', def: '8' },
        { k: 'thoiGian', label: 'Thời gian thực hiện', def: '…… ngày kể từ ngày báo giá được chấp thuận và nhận tạm ứng (nếu có)', wide: true },
        { k: 'hieuLuc', label: 'Hiệu lực báo giá (số ngày)', def: '30', ph: 'VD: 30 — tự ghi ngày hết hiệu lực' },
        { k: 'thanhToan', label: 'Điều khoản thanh toán — mỗi dòng 1 đợt (ghi % để tự tính số tiền)', type: 'textarea', rows: 3,
          def: 'Đợt 1: Tạm ứng 50% giá trị báo giá sau khi báo giá được chấp thuận\nĐợt 2: Thanh toán 50% còn lại sau khi hoàn thành và nghiệm thu công việc' },
        { k: 'hinhThucTT', label: 'Hình thức thanh toán', def: 'Chuyển khoản vào tài khoản của Nhà thầu, trong vòng 15 ngày kể từ ngày nhận đủ hồ sơ thanh toán hợp lệ', wide: true },
        { k: 'hoSoTT', label: 'Hồ sơ thanh toán', def: 'Đề nghị thanh toán, hoá đơn GTGT, biên bản nghiệm thu khối lượng phát sinh', wide: true },
        { k: 'ghiChu', label: 'Ghi chú (mỗi dòng 1 mục)', type: 'textarea', rows: 3, def: 'Đơn giá đã bao gồm vật tư, vận chuyển đến công trình và nhân công lắp đặt\nChưa bao gồm các công việc xây dựng, điện ngoài phạm vi thang máy' },
      ],
      body: ({ I, f }) => {
        const q = quoteCalc(f.hangMucBG, f.vat == null || f.vat === '' ? '0' : f.vat);
        const rows = (q.rows.length ? q.rows : [{ ten: '', dvt: '', q: 0, u: 0, tt: 0 }]).map((x, i) => [{ t: String(i + 1), align: 'center' }, x.ten, { t: x.dvt, align: 'center' },
          { t: x.q ? String(x.q).replace('.', ',') : '', align: 'center' }, { t: x.u ? money(x.u) : '', align: 'right' }, { t: x.tt ? money(x.tt) : '', align: 'right' }]);
        const item = (lb, v) => p([r(lb, { b: true }), r(v ? ' ' + String(v).replace(/\.?$/, '.') : '')], { align: 'both', keep: !v });
        const sub = (t) => p(r(t), { align: 'both', ind: 360 });
        const sum = (label, v, b) => [{ t: label, span: 5, align: 'right', b: !!b }, { runs: [r(money(v), { b: !!b })], align: 'right' }];
        return letter((ctx) => `Báo giá công việc phát sinh${ctx.f.tieuDe ? ' – ' + ctx.f.tieuDe : ''}`, () =>
          para(`${f.canCuYC ? 'Căn cứ ' + f.canCuYC + ', ' : ''}${f.lyDo ? (f.lyDo.charAt(0).toLowerCase() + f.lyDo.slice(1)) + ', ' : ''}chúng tôi trân trọng gửi đến Quý Công ty báo giá các công việc phát sinh ngoài phạm vi Hợp đồng như sau:`.replace(/^./, c => c.toUpperCase())) +
          table([['STT', 'Nội dung công việc', 'ĐVT', 'SL', 'Đơn giá (VNĐ)', 'Thành tiền (VNĐ)'], ...rows,
            sum('Cộng (chưa thuế GTGT)', q.sub), sum(`Thuế GTGT ${String(q.pct).replace('.', ',')}%`, q.vat), sum('TỔNG CỘNG', q.total, true)],
            { widths: [650, 4050, 700, 750, 1400, 1476], header: 1 }) +
          p([r('Bằng chữ: ', { b: true }), r(docSo(q.total) + '.', { i: true })], { before: 2 }) +
          head2('Điều khoản báo giá') +
          item('1. Thời gian thực hiện:', f.thoiGian) +
          item('2. Hiệu lực báo giá:', validity(f.hieuLuc, f.ngay)) +
          item('3. Điều khoản thanh toán:', '') + lines(f.thanhToan).map(ln => sub('– ' + payLine(ln, q.total))).join('') +
          (f.hinhThucTT ? sub('– Hình thức: ' + f.hinhThucTT.replace(/\.?$/, '.')) : '') + (f.hoSoTT ? sub('– Hồ sơ thanh toán: ' + f.hoSoTT.replace(/\.?$/, '.')) : '') +
          (lines(f.ghiChu).length ? item('4. Ghi chú:', '') + lines(f.ghiChu).map(x => sub('– ' + x.replace(/\.?$/, '.'))).join('') : '') +
          closing(I, f, { thanks: 'Kính đề nghị Quý Công ty xem xét, ký xác nhận chấp thuận để chúng tôi triển khai. Giá trị phát sinh sẽ được ký phụ lục và thanh toán theo Hợp đồng.' }) +
          tail(table([[{ runs: [r('XÁC NHẬN CỦA CHỦ ĐẦU TƯ', { b: true }), r('\n'), ckbox(false), r('Đồng ý     '), ckbox(false), r('Không đồng ý\n'), ckbox(false), r('Đồng ý có điều chỉnh: ……………')], vAlign: 'top' },
            { runs: [r('Đại diện Chủ đầu tư', { b: true }), r('\n(Ký, ghi rõ họ tên, đóng dấu)\n\nNgày: …/…/……', { i: true, sz: 10 })], align: 'center', vAlign: 'top' }]], { widths: [4513, 4513], cantSplit: true })))({ I, f });
      },
    },
  ];
  // các văn bản đã có sẵn trong công cụ (dữ liệu ở phần Tiến độ & nghiệm thu) — chỉ để liệt kê / gọi
  const EXISTING = [
    { id: 'bbxn', name: 'Biên bản xác nhận thiết bị đến công trường', fn: 'exportBBXN' },
    { id: 'bangiao', name: 'Biên bản bàn giao thang máy (song ngữ)', fn: 'exportBanGiao' },
  ];
  // thân văn bản (XML) từ ô thông tin — chưa áp sửa tay; xem trước dùng cái này
  const compose = (def, I, f) => def.body({ I, f: f || {}, K });
  async function build(JSZip, templateBuf, def, I, f) {
    const zip = await JSZip.loadAsync(templateBuf);
    const xml = PV && f && f._ed ? PV.applyEdits(compose(def, I, f), f._ed).xml : compose(def, I, f);   // sửa tay trên bản xem trước
    await K.letterheadDocx(zip, xml);
    return zip;
  }
  // tên file thống nhất: <CV|BB|RFA|RFI> <số> - <tên văn bản> - <công trình>.docx
  const safe = (x) => String(x).replace(/[\\/:*?"<>|]/g, '-');
  const fileName = (def, I, f) => `${def.kind === 'bb' ? 'BB' : def.kind === 'rfa' ? def.id.toUpperCase() : 'CV'}${f && f.so ? ' ' + safe(f.so) : ''} - ${def.kind === 'rfa' ? (def.file || 'De xuat phe duyet') : safe(def.name).replace(/-/g, ' ').replace(/\s+/g, ' ')}${I.congTrinh ? ' - ' + safe(I.congTrinh).slice(0, 50) : ''}.docx`;
  // số tiếp theo: tăng phần số đầu, giữ nguyên phần còn lại và độ dài (VD 125/2026/SCH-HN → 126/2026/SCH-HN; RFA-SCH-009 → RFA-SCH-010)
  function nextSo(so) {
    const t = String(so || '').trim(); if (!t) return '';
    const m = /^(\D*?)(\d+)(.*)$/.exec(t); if (!m) return '';
    const n = String(+m[2] + 1).padStart(m[2].length, '0');
    return m[1] + n + m[3];
  }
  const api = { LETTERS, EXISTING, build, compose, fileName, nextSo, header, closing, docSo, quoteCalc, money, validity, payLine };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HsLetters = api;
})(typeof window !== 'undefined' ? window : globalThis);
