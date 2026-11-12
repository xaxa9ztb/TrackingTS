// Hồ sơ Dự án › Hồ sơ pháp lý: tạo bộ file mẫu (Word) từ thông tin dự án + danh sách nhân sự + máy móc.
// Không chứa dữ liệu cá nhân: họ tên nhân sự do người dùng nhập cho từng dự án.
// I (thông tin dự án dùng chung): congTrinh, duAn, diaDiem, chuDauTu, soHD, ngayHD, hangMuc, nhaThau, noiLap, nguoiKy, chucVuKy
// L (dữ liệu riêng): { so, ngay, people:[{ten, gioi, role, viTri, bch, pccc}], machines:[{ten, dvt, sl}], pccc:{phuongAn} }
(function (root) {
  'use strict';
  const K = (typeof module !== 'undefined' && module.exports) ? require('./docxkit.js') : root.DocxKit;
  const { r, p, bullet, table, ngayVN, dmy, orDots } = K;
  const NHA_THAU = 'CHI NHÁNH CÔNG TY TNHH SCHINDLER VIỆT NAM TẠI HÀ NỘI';
  const CTY = (I) => (I.nhaThau || NHA_THAU).toUpperCase();
  const cty = (I) => (!I.nhaThau || I.nhaThau.toUpperCase() === NHA_THAU) ? 'Chi nhánh Công ty TNHH Schindler Việt Nam tại Hà Nội' : I.nhaThau;
  const ROLES = {
    cht: { label: 'Chỉ huy trưởng, Giám sát chất lượng', bch: true },
    chp: { label: 'Chỉ huy phó', bch: true },
    atld: { label: 'Trưởng ban ATLĐ, VSMT, PCCC', bch: true, pccc: true },
    cn: { label: 'Công nhân kỹ thuật lắp đặt' },
    khac: { label: '' },
  };
  const MAY_MOC = [['Sàn thao tác lắp đặt', 'Bộ', 1], ['Máy vặn ốc', 'Chiếc', 1], ['Máy khoan sắt', 'Chiếc', 1], ['Máy khoan bê tông', 'Chiếc', 1], ['Máy khoan đục', 'Chiếc', 1],
    ['Máy khoan sắt cầm tay', 'Chiếc', 1], ['Tủ nguồn 3 pha', 'Chiếc', 1], ['Hộp nguồn thi công', 'Chiếc', 1], ['Máy khoan pin', 'Chiếc', 1], ['Pa lăng 3T', 'Chiếc', 1],
    ['Máy cắt cầm tay', 'Chiếc', 1], ['Máy laser', 'Chiếc', 1], ['Dụng cụ cầm tay (cần lực, kìm,…)', 'Bộ', 1]].map(([ten, dvt, sl]) => ({ ten, dvt, sl }));
  const people = (L) => (L.people || []).filter(x => String(x.ten || '').trim());
  const vt = (x) => x.viTri || (ROLES[x.role] || {}).label || '';
  const gioi = (x) => x.gioi || 'Ông';
  const shortName = (x) => String(x.ten || '').trim().split(/\s+/).pop();
  const ngay = (L, I) => ngayVN(L.ngay, I.noiLap || 'Hà Nội');
  const hangMuc = (I) => I.hangMuc || 'Cung cấp và lắp đặt hệ thống thang máy';

  function quocHieu(I, L, so) {
    return table([[
      { runs: [r(CTY(I), { b: true, sz: 12 }), r('\n——————', { sz: 11 }), so ? r('\nSố: ' + so, { sz: 12 }) : ''], align: 'center', vAlign: 'top' },
      { runs: [r('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { b: true, sz: 12 }), r('\nĐộc lập – Tự do – Hạnh phúc', { b: true, sz: 13 }), r('\n——————', { sz: 11 })], align: 'center', vAlign: 'top' },
    ]], { widths: [3900, 5425], border: false }) + p(r(ngay(L, I), { i: true }), { align: 'right', after: 8 });
  }
  const title = (t, sub) => p(r(t, { b: true, sz: 14 }), { align: 'center', before: 6, after: 2 }) + (sub ? p(r(sub, { b: true }), { align: 'center', after: 8 }) : '');
  const para = (t, o) => p(Array.isArray(t) ? t : r(t), { align: 'both', first: 567, ...(o || {}) });
  const ky = (I, left) => table([[
    { runs: left ? [r('Nơi nhận:', { b: true, i: true, sz: 11 }), r('\n' + left, { sz: 11 })] : [r('')], vAlign: 'top' },
    { runs: [r(CTY(I), { b: true, sz: 12 }), I.chucVuKy ? r('\n' + I.chucVuKy, { b: true }) : '', r('\n\n\n\n\n' + (I.nguoiKy || ''), { b: true })], align: 'center', vAlign: 'top' },
  ]], { widths: [4000, 5325], border: false });
  const soQD = (L, I, kh) => `……/${I.soHD ? String(I.soHD).replace(/\s+/g, '') + '/' : ''}${kh}`;

  // ---------- từng tài liệu ----------
  const DOCS = [
    {
      id: 'bia', name: 'Bìa hồ sơ pháp lý', body: (I, L) =>
        p('', { before: 60 }) + p(r(CTY(I), { b: true, sz: 14 }), { align: 'center', after: 40 }) +
        p(r('HỒ SƠ PHÁP LÝ', { b: true, sz: 32 }), { align: 'center', after: 40 }) +
        table([
          ['DỰ ÁN', ':', I.duAn || I.congTrinh], ['CÔNG TRÌNH', ':', I.congTrinh], ['ĐỊA ĐIỂM', ':', I.diaDiem], ['HẠNG MỤC', ':', hangMuc(I)],
          ['HỢP ĐỒNG', ':', I.soHD + (I.ngayHD ? ' ngày ' + dmy(I.ngayHD) : '')], ['CHỦ ĐẦU TƯ', ':', I.chuDauTu], ['NHÀ THẦU THI CÔNG', ':', CTY(I)],
        ].filter(x => String(x[2] || '').trim()).map(([a, b, c]) => [{ t: a, b: true }, { t: b, align: 'center' }, { runs: [r(String(c).toUpperCase(), { b: true })] }]),
        { widths: [2600, 300, 6400], border: false, rowH: 520 }) +
        p(r(`${(I.noiLap || 'Hà Nội').toUpperCase()}, THÁNG ${L.ngay ? L.ngay.slice(5, 7) : '……'} NĂM ${L.ngay ? L.ngay.slice(0, 4) : new Date().getFullYear()}`, { b: true }), { align: 'center', before: 160 }),
    },
    {
      id: 'danhmuc', name: 'Danh mục hồ sơ pháp lý', body: (I, L) => {
        const names = people(L).map(x => x.ten.trim()).join(', ');
        const bchNames = people(L).filter(x => x.bch).map(x => x.ten.trim()).join(', ');
        const wn = (t, n) => t + (n ? ` (${n})` : '');
        const G = [
          ['Giấy đăng ký kinh doanh của Nhà thầu', 'Chứng chỉ năng lực hoạt động xây dựng', 'Chứng nhận hoạt động chi nhánh', 'Giấy ủy quyền cho chi nhánh / người đại diện ký hợp đồng'],
          ['Hồ sơ năng lực'], ['Hợp đồng kinh tế', 'Biện pháp thi công', 'Tiến độ thi công'],
          ['Quyết định bổ nhiệm ban chỉ huy và nhân lực thi công tại công trình', 'Phân công nhiệm vụ từng thành viên trong Ban chỉ huy công trình', 'Quyết định thành lập ban ATLĐ – VSMT', 'Quyết định cử nhân sự tham gia đội PCCC', 'Danh sách mẫu chữ ký cán bộ Ban chỉ huy công trường'],
          ['Sơ đồ tổ chức công trường', wn('Căn cước công dân', names), wn('Hợp đồng lao động', names), wn('Bảo hiểm', names), wn('Giấy khám sức khỏe', names)],
          [wn('Bằng cấp', bchNames)], ['Kế hoạch an toàn'],
          ['Nội quy an toàn lao động', wn('Cam kết an toàn', names), wn('Thẻ an toàn lao động', names), wn('Thẻ PCCC', names)],
          ['Bảo hiểm trách nhiệm cộng đồng, bảo hiểm rủi ro bên thứ ba, bảo hiểm thiết bị thi công'], ['Hồ sơ thiết bị'],
        ];
        const rows = [['STT', 'HỒ SƠ PHÁP LÝ NHÀ THẦU THI CÔNG', 'Ghi chú']];
        G.forEach((g, i) => g.forEach((t, j) => rows.push([{ t: j ? '' : String(i + 1), align: 'center', b: !j }, { t: (j ? '– ' : '') + t, b: !j }, ''])));
        return title('DANH MỤC HỒ SƠ PHÁP LÝ') +
          table([['Dự án', I.duAn || I.congTrinh], ['Công trình', I.congTrinh], ['Phần việc', hangMuc(I)], ['Hợp đồng', `Số ${orDots(I.soHD)}${I.ngayHD ? ' ngày ' + dmy(I.ngayHD) : ''}`], ['Địa điểm', I.diaDiem], ['Chủ đầu tư', I.chuDauTu]]
            .map(([a, b]) => [{ t: a + ':', b: true }, { t: orDots(b) }]), { widths: [1800, 7525], border: false }) +
          table(rows, { widths: [800, 7125, 1400], header: 1 });
      },
    },
    {
      id: 'qd_bch', name: 'Quyết định thành lập Ban chỉ huy công trường', body: (I, L) =>
        quocHieu(I, L, soQD(L, I, 'QĐ')) + title('QUYẾT ĐỊNH THÀNH LẬP BAN CHỈ HUY CÔNG TRƯỜNG') +
        p([r('V/v: ', { b: true }), r(`Bổ nhiệm nhân sự của Nhà thầu phục vụ thi công lắp đặt thang máy tại công trình ${orDots(I.congTrinh)}; gói thầu: ${hangMuc(I)}.`)], { align: 'center', after: 8 }) +
        bullet(`Căn cứ Hợp đồng số ${orDots(I.soHD)}${I.ngayHD ? ' ngày ' + dmy(I.ngayHD) : ''} giữa ${orDots(I.chuDauTu)} và ${cty(I)} về việc ${hangMuc(I).toLowerCase()};`) +
        bullet('Căn cứ vào nhu cầu thực tế trong quá trình thi công lắp đặt hệ thống thang máy tại công trình.') +
        p(r('QUYẾT ĐỊNH', { b: true }), { align: 'center', before: 6 }) +
        para([r('Điều 1: ', { b: true }), r(`Bố trí nhân sự làm việc tại công trình ${orDots(I.congTrinh)}${I.diaDiem ? ', địa chỉ: ' + I.diaDiem : ''} theo danh sách dưới đây:`)]) +
        table([['STT', 'HỌ TÊN', 'VỊ TRÍ CÔNG VIỆC'], ...people(L).filter(x => x.bch).map((x, i) => [{ t: String(i + 1), align: 'center' }, x.ten, vt(x)])], { widths: [800, 3600, 4925], header: 1, rowH: 420 }) +
        para([r('Điều 2: ', { b: true }), r('Công nhân viên và cán bộ kỹ thuật chịu sự quản lý và phân công nhiệm vụ tại công trình của Quản lý dự án và Chỉ huy trưởng công trường.')]) +
        para([r('Điều 3: ', { b: true }), r('Quyết định này có hiệu lực kể từ ngày ký.')]) + ky(I, '- Như Điều 1;\n- Ban QLDA, TVGS;\n- Lưu VP.'),
    },
    {
      id: 'trach_nhiem', name: 'Trách nhiệm, quyền hạn của từng cá nhân', body: (I, L) => {
        const ps = people(L);
        let n = 0;
        const dieu = (t) => para([r(`Điều ${++n}: `, { b: true }), r(t)]);
        const cht = ps.filter(x => x.role === 'cht' || x.role === 'chp'), at = ps.filter(x => x.role === 'atld'), cn = ps.filter(x => x.role === 'cn');
        const other = ps.filter(x => !['cht', 'chp', 'atld', 'cn'].includes(x.role));
        return quocHieu(I, L, soQD(L, I, 'QĐ')) + title('TRÁCH NHIỆM, QUYỀN HẠN CỦA TỪNG CÁ NHÂN', `CÔNG TRÌNH: ${String(orDots(I.congTrinh)).toUpperCase()}`) +
          (I.diaDiem ? p(r('Tại: ' + I.diaDiem), { align: 'center', after: 6 }) : '') +
          bullet(`Căn cứ Hợp đồng số ${orDots(I.soHD)}${I.ngayHD ? ' ngày ' + dmy(I.ngayHD) : ''};`) + bullet('Căn cứ Điều lệ và chức năng, nhiệm vụ của Nhà thầu;') +
          p(r(CTY(I), { b: true }), { align: 'center', before: 6 }) + p(r('QUYẾT ĐỊNH', { b: true }), { align: 'center' }) +
          cht.map(x => dieu(`Bổ nhiệm ${gioi(x).toLowerCase()} ${x.ten}, đảm nhiệm chức vụ ${vt(x)} đối với công trình ${orDots(I.congTrinh)}. ${gioi(x)} ${shortName(x)} có trách nhiệm phối hợp tiến độ, kỹ thuật thi công với chủ đầu tư, đơn vị thiết kế, đơn vị giám sát và các nhà thầu xây dựng, cơ điện tại công trình; chịu trách nhiệm về chất lượng công việc của Nhà thầu, dự họp giao ban thường kỳ và ký các biên bản liên quan đến công việc tại công trường.`)).join('') +
          at.map(x => dieu(`Bổ nhiệm ${gioi(x).toLowerCase()} ${x.ten}, đảm nhiệm chức vụ Giám sát An toàn lao động, Vệ sinh môi trường và Phòng chống cháy nổ đối với công trình ${orDots(I.congTrinh)}. ${gioi(x)} ${shortName(x)} có trách nhiệm phối hợp thực hiện công tác an toàn, vệ sinh môi trường và phòng chống cháy nổ tại dự án với chủ đầu tư, đơn vị giám sát và các nhà thầu khác; đồng thời đảm bảo các vấn đề về vệ sinh, an toàn liên quan đến công việc tại công trường.`)).join('') +
          other.map(x => dieu(`Bổ nhiệm ${gioi(x).toLowerCase()} ${x.ten}, đảm nhiệm vị trí ${vt(x) || '……'} tại công trình ${orDots(I.congTrinh)}.`)).join('') +
          (cn.length ? dieu(`${cn.map(x => gioi(x) + ' ' + x.ten).join(', ')} là công nhân kỹ thuật thực hiện lắp đặt đối với công trình ${orDots(I.congTrinh)}; có trách nhiệm lắp đặt theo đúng tiêu chuẩn kỹ thuật lắp đặt cũng như các tiêu chuẩn an toàn nội bộ của Nhà thầu.`) : '') +
          dieu('Các cá nhân có tên trên cùng các Trưởng phòng ban, Trưởng bộ phận liên quan có trách nhiệm thi hành quyết định này. Quyết định này có hiệu lực kể từ ngày ký.') + ky(I, '- Như trên;\n- Lưu VP.');
      },
    },
    {
      id: 'chu_ky', name: 'Danh sách chữ ký mẫu Ban chỉ huy', body: (I, L) =>
        quocHieu(I, L) + title('DANH SÁCH CHỮ KÝ BAN CHỈ HUY CÔNG TRƯỜNG', `CÔNG TRÌNH: ${String(orDots(I.congTrinh)).toUpperCase()}`) +
        p(r('GÓI THẦU: ' + hangMuc(I).toUpperCase(), { b: true }), { align: 'center', after: 8 }) +
        table([['STT', 'HỌ TÊN', 'VỊ TRÍ CÔNG VIỆC', 'CHỮ KÝ MẪU'], ...people(L).filter(x => x.bch).map((x, i) => [{ t: String(i + 1), align: 'center' }, x.ten, vt(x), ''])],
          { widths: [700, 2700, 3125, 2800], header: 1, rowH: 1100 }) + ky(I),
    },
    {
      id: 'pccc', name: 'Quyết định cử nhân sự tham gia Đội PCCC cơ sở', body: (I, L) =>
        quocHieu(I, L, soQD(L, I, 'QĐ-PCCC')) + title('QUYẾT ĐỊNH', 'V/v: Cử nhân sự tham gia Đội Phòng cháy và Chữa cháy cơ sở của Ban Quản lý') +
        p([r('Kính gửi: ', { b: true }), r('Ban Quản lý dự án; Tư vấn giám sát dự án ' + orDots(I.congTrinh))], { after: 6 }) + p(r('Căn cứ:', { b: true })) +
        ['Luật Phòng cháy, chữa cháy và cứu nạn, cứu hộ hiện hành;', 'Luật An toàn, vệ sinh lao động số 84/2015/QH13;', 'Các nghị định, hướng dẫn hiện hành về phòng cháy, chữa cháy;',
          `Phương án PCCC của công trình ${orDots(I.congTrinh)};`, `Phạm vi thi công của ${cty(I)} tại công trình.`].map(t => bullet(t)).join('') +
        para(`${cty(I)} xin thông báo và cử nhân sự như sau:`) +
        p(r('1. Nội dung cử', { b: true })) +
        para(`${cty(I)} là nhà thầu đang thi công tại công trình ${orDots(I.congTrinh)} do Ban Quản lý quản lý công tác PCCC. Nhằm thực hiện đúng quy định về phòng cháy và chữa cháy, chúng tôi cử nhân sự tham gia Đội PCCC cơ sở của Ban Quản lý, chịu sự quản lý, điều hành và phân công theo Phương án PCCC chung của công trình.`) +
        p(r('2. Danh sách cử', { b: true })) +
        table([['STT', 'Họ và tên', 'Chức danh', 'Vị trí / nhiệm vụ'], ...people(L).filter(x => x.pccc).map((x, i) => [{ t: String(i + 1), align: 'center' }, x.ten, x.role === 'cn' ? 'Công nhân' : (x.role === 'atld' ? 'An toàn' : vt(x)), 'Thành viên PCCC'])],
          { widths: [700, 3200, 2600, 2825], header: 1, rowH: 400 }) +
        p(r('3. Nhiệm vụ thực hiện', { b: true })) +
        ['Chấp hành nghiêm các quy định, nội quy và phương án PCCC của công trình;', 'Tham gia đầy đủ các buổi huấn luyện, diễn tập PCCC theo yêu cầu của Ban Quản lý;',
          'Phối hợp xử lý khi có sự cố cháy, nổ xảy ra trong phạm vi công trình;', 'Nhà thầu chịu trách nhiệm quản lý nhân sự và trang bị PCCC cơ bản theo phạm vi công việc của mình.'].map(t => bullet(t)).join('') +
        ky(I, '- Ban QLDA, TVGS;\n- Lưu VP.'),
    },
    {
      id: 'so_do', name: 'Sơ đồ tổ chức công trường', body: (I, L) => {
        const ps = people(L);
        const box = (head, names, fill) => table([[{ runs: [r(head, { b: true }), names ? r('\n' + names, {}) : ''], align: 'center', fill }]], { widths: [5200], center: true });
        const arrow = p(r('▼', { sz: 14 }), { align: 'center', after: 0 });
        const by = (k) => ps.filter(x => x.role === k).map(x => x.ten).join('\n');
        return title('SƠ ĐỒ TỔ CHỨC CÔNG TRƯỜNG') +
          table([['Công trình', I.congTrinh], ['Địa chỉ', I.diaDiem], ['Hợp đồng', I.soHD], ['Gói thầu', hangMuc(I)], ['Nhà thầu', cty(I)]]
            .map(([a, b]) => [{ t: a + ':', b: true }, { t: orDots(b) }]), { widths: [1800, 7525], border: false }) +
          box('BAN GIÁM ĐỐC / QUẢN LÝ DỰ ÁN', I.pmTen || '', 'D9E2F3') + arrow +
          box('CHỈ HUY TRƯỞNG – GIÁM SÁT CHẤT LƯỢNG', [by('cht'), by('chp')].filter(Boolean).join('\n'), 'E2EFDA') + arrow +
          box('AN TOÀN LAO ĐỘNG – VSMT – PCCC', by('atld'), 'FFF2CC') + arrow +
          box('ĐỘI LẮP ĐẶT', by('cn') || '', 'FCE4D6') +
          (ps.some(x => x.role === 'khac') ? p('') + box('BỘ PHẬN KHÁC', ps.filter(x => x.role === 'khac').map(x => x.ten + (x.viTri ? ' – ' + x.viTri : '')).join('\n'), 'EDEDED') : '') +
          p('', { before: 12 }) + ky(I);
      },
    },
    {
      id: 'may_moc', name: 'Danh sách máy móc, thiết bị thi công', body: (I, L) => {
        const ms = (L.machines && L.machines.length ? L.machines : MAY_MOC).filter(x => String(x.ten || '').trim());
        return quocHieu(I, L) + title('DANH SÁCH MÁY MÓC, THIẾT BỊ THI CÔNG') +
          table([['Công trình', I.congTrinh], ['Hợp đồng số', I.soHD]].map(([a, b]) => [{ t: a + ':', b: true }, { t: orDots(b) }]), { widths: [1800, 7525], border: false }) +
          table([['STT', 'Trang thiết bị, máy móc', 'Đơn vị tính', 'Số lượng / 01 công trình'], ...ms.map((x, i) => [{ t: String(i + 1), align: 'center' }, x.ten, { t: x.dvt || '', align: 'center' }, { t: String(x.sl == null ? '' : x.sl), align: 'center' }])],
            { widths: [700, 4925, 1500, 2200], header: 1, rowH: 380 }) + ky(I);
      },
    },
  ];
  async function build(JSZip, id, I, L) {
    const d = DOCS.find(x => x.id === id);
    if (!d) throw new Error('Không có tài liệu ' + id);
    return K.blankDocx(JSZip, d.body(I, L || {}), { title: d.name, pageNumbers: id !== 'bia' });
  }
  const fileName = (d, i) => `${String(i + 1).padStart(2, '0')}. ${d.name}.docx`;
  // Thay tên công trình cũ → mới trong file Word mẫu do người dùng tải lên (VD: Kế hoạch an toàn tổng hợp).
  // Tên có thể bị Word cắt thành nhiều run → ghép chữ trong từng đoạn rồi thay, giữ định dạng của run đầu.
  async function replaceInDocx(JSZip, buf, pairs) {
    const zip = await JSZip.loadAsync(buf);
    const parts = Object.keys(zip.files).filter(n => /^word\/(document|header\d*|footer\d*)\.xml$/.test(n));
    let count = 0;
    const list = pairs.filter(([a, b]) => String(a || '').trim() && a !== b);
    const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
    for (const n of parts) {
      let xml = await zip.file(n).async('string');
      xml = xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (para) => {
        const ts = [...para.matchAll(/(<w:t(?: [^>]*)?>)([^<]*)(<\/w:t>)/g)];
        if (!ts.length) return para;
        const full = ts.map(m => unesc(m[2])).join('');
        let nu = full;
        for (const [a, b] of list) { const re = new RegExp(a.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); nu = nu.replace(re, () => { count++; return b; }); }
        if (nu === full) return para;
        let i = 0;
        return para.replace(/(<w:t)(?: [^>]*)?>([^<]*)(<\/w:t>)/g, (m, a, t, c) => (i++ === 0 ? `<w:t xml:space="preserve">${K.esc(nu)}</w:t>` : '<w:t></w:t>'));
      });
      zip.file(n, xml);
    }
    return { zip, count };
  }
  const api = { DOCS, ROLES, MAY_MOC, build, fileName, replaceInDocx };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HsLegal = api;
})(typeof window !== 'undefined' ? window : globalThis);
