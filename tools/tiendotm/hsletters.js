// Hồ sơ Dự án › Công văn, biên bản: các thư / biên bản mẫu cùng MỘT khuôn công văn của nhà thầu
// (header logo + footer địa chỉ lấy từ mẫu công văn; phần đầu thư, khối ký, nơi nhận, người liên hệ giống nhau).
// LETTERS[i] = { id, kind: 'letter'|'bb', name, subject, fields:[{k,label,type,def,ph,rows}], body(ctx) → XML thân thư }
// ctx = { I: thông tin dự án dùng chung, f: giá trị ô của văn bản, K: DocxKit }
(function (root) {
  'use strict';
  const K = (typeof module !== 'undefined' && module.exports) ? require('./docxkit.js') : root.DocxKit;
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
    const sign = table([[
      { runs: [r('Nơi nhận:', { b: true, i: true, sz: 11 }), r('\n- Như trên;' + (o.cc ? '\n- ' + o.cc + ';' : '') + '\n- Lưu VP.', { sz: 11 })], vAlign: 'top' },
      { runs: [r('TM. ' + CTY(I), { b: true, sz: 11 }), r('\n' + cv, { b: true, sz: 11 }), r('\n\n\n\n' + (ky || ''), { b: true })], align: 'center', vAlign: 'top' },
    ]], { widths: [3700, 5326], border: false });
    const lh = [I.pmTen, I.pmDT, I.pmEmail].filter(Boolean).join(' – ');
    return p(r(o.thanks || 'Rất mong nhận được sự hợp tác của Quý Khách hàng.'), { align: 'both', before: 4 }) +
      p(r('Trân trọng kính chào.'), { after: 8 }) + sign +
      (lh ? p(r('Người liên hệ: ' + lh, { i: true, sz: 10 }), { before: 6 }) : '');
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
      (soKh ? p(r('Số: ' + (f.so || '……') + '/' + soKh), { align: 'center' }) : '') +
      p([r('Công trình: ', { b: true }), r(orDots(I.congTrinh))], { after: 2 }) +
      p([r('Địa điểm: ', { b: true }), r(orDots(I.diaDiem))], { after: 2 }) +
      p([r('Hợp đồng số: ', { b: true }), r(`${orDots(I.soHD)}${I.ngayHD ? ' ngày ' + dmy(I.ngayHD) : ''}`)]);
  }
  const signRow = (labels) => table([labels.map(l => ({ runs: [r(l.toUpperCase(), { b: true, sz: 11 }), r('\n(Ký và ghi rõ họ tên)\n\n\n\n', { i: true, sz: 10 })], align: 'center', vAlign: 'top' }))],
    { widths: labels.map(() => Math.floor(9026 / labels.length)), border: false });

  const DEF_GIENG = 'Hoàn thiện che chắn, khung bao cửa tầng\nHoàn thiện lỗ thông gió giếng thang\nHoàn thiện lan can an toàn trước cửa tầng\nCung cấp nguồn điện chính thức cho thang máy';
  const LETTERS = [
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
      body: ({ I, f }) => bbHeader(I, f, 'BIÊN BẢN HUẤN LUYỆN\nSỬ DỤNG THANG MÁY VÀ CỨU HỘ HÀNH KHÁCH TRONG TÌNH HUỐNG KHẨN CẤP', '') +
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
  ];
  // các văn bản đã có sẵn trong công cụ (dữ liệu ở phần Tiến độ & nghiệm thu) — chỉ để liệt kê / gọi
  const EXISTING = [
    { id: 'bbxn', name: 'Biên bản xác nhận thiết bị đến công trường', fn: 'exportBBXN' },
    { id: 'bangiao', name: 'Biên bản bàn giao thang máy (song ngữ)', fn: 'exportBanGiao' },
  ];
  async function build(JSZip, templateBuf, def, I, f) {
    const zip = await JSZip.loadAsync(templateBuf);
    const xml = def.body({ I, f, K });
    await K.letterheadDocx(zip, xml);
    return zip;
  }
  const fileName = (def, I, f) => `${def.kind === 'bb' ? 'BB' : 'CV'} - ${def.name.replace(/[\\/:*?"<>|]/g, '')}${I.congTrinh ? ' - ' + String(I.congTrinh).replace(/[\\/:*?"<>|]/g, '').slice(0, 50) : ''}.docx`;
  const api = { LETTERS, EXISTING, build, fileName, header, closing };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HsLetters = api;
})(typeof window !== 'undefined' ? window : globalThis);
