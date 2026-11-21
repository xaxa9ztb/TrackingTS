// Hồ sơ Dự án: công văn / biên bản (khuôn chung), hồ sơ pháp lý, bìa bản vẽ — kiểm tra phần sinh nội dung Word
// (không cần JSZip): đủ văn bản, thông tin dự án được điền, XML cân thẻ, không lọt "undefined"/"NaN".
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const K = require('../../tools/tiendotm/docxkit.js');
const L = require('../../tools/tiendotm/hsletters.js');
const G = require('../../tools/tiendotm/hslegal.js');
const D = require('../../tools/tiendotm/hsdrawing.js');

const I = { congTrinh: 'Công trình Thử & Co', diaDiem: 'Phường A, Hà Nội', chuDauTu: 'Công ty Thử', banQLDA: 'Ban QLDA Thử', tvgs: 'TVGS Thử',
  soHD: '123/SCH', ngayHD: '2026-06-16', nguoiKy: 'NGƯỜI KÝ', chucVuKy: 'Trưởng phòng', soThang: '02' };
const balanced = (xml) => {
  for (const t of ['w:p', 'w:tbl', 'w:tr', 'w:tc', 'w:r']) {
    const open = (xml.match(new RegExp(`<${t}[ >]`, 'g')) || []).length;
    const close = (xml.match(new RegExp(`</${t}>`, 'g')) || []).length;
    assert.equal(open, close, `thẻ <${t}> mở ${open} / đóng ${close}`);
  }
};

test('docxkit: escape ký tự đặc biệt, ngày tiếng Việt, ô trống in dấu chấm', () => {
  assert.match(K.r('A & B <c>'), /A &amp; B &lt;c&gt;/);
  assert.equal(K.ngayVN('2026-09-05', 'Hà Nội'), 'Hà Nội, ngày 05 tháng 09 năm 2026');
  assert.equal(K.dmy('2026-09-05'), '05/09/2026');
  assert.equal(K.dmy(''), '…/…/……');
  assert.equal(K.orDots('  '), K.DOTS);
  const t = K.table([['a', 'b'], ['c', { t: 'd', span: 1 }]], { widths: [100, 200], header: 1, rowH: 300 });
  assert.equal((t.match(/<w:trPr>/g) || []).length, 2, 'mỗi dòng tối đa 1 <w:trPr>');
  balanced(t);
});

test('công văn & biên bản: đủ 18 mẫu (gồm tạm dừng thi công, RFA, RFI, báo giá phát sinh, điều kiện công trường, thư xác nhận hàng về), cùng khuôn đầu thư, điền thông tin dự án', () => {
  assert.equal(L.LETTERS.length, 18);
  assert.equal(new Set(L.LETTERS.map(x => x.id)).size, 18, 'id không trùng');
  for (const d of L.LETTERS) {
    const f = { so: '01/CV', ngay: '2026-11-12' };
    (d.fields || []).forEach(x => { f[x.k] = x.type === 'date' ? '2026-12-01' : (x.def || 'giá trị'); });
    const xml = d.body({ I, f, K });
    balanced(xml);
    assert.doesNotMatch(xml, /undefined|NaN|\[object Object\]/, d.id);
    assert.match(xml, /Công trình Thử &amp; Co/, d.id + ': có tên công trình');
    assert.match(xml, /123\/SCH/, d.id + ': có số hợp đồng');
    if (d.kind === 'letter') {
      assert.match(xml, /Kính gửi:/, d.id); assert.match(xml, /V\/v:/, d.id); assert.match(xml, /Tham chiếu: /, d.id);
      assert.match(xml, /Nơi nhận:/, d.id); assert.match(xml, /NGƯỜI KÝ/, d.id); assert.match(xml, /Số: 01\/CV/, d.id);
      assert.match(xml, /Ban QLDA Thử; TVGS Thử/, d.id + ': đồng kính gửi mặc định');
    } else if (d.kind === 'bb') assert.match(xml, /CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM/, d.id);
  }
});

test('RFA — phiếu đề xuất phê duyệt: thông tin dự án, loại / mục đích đánh dấu, danh mục tài liệu, phần phê duyệt A–D', () => {
  const d = L.LETTERS.find(x => x.id === 'rfa');
  assert.equal(d.kind, 'rfa');
  const f = { so: 'RFA-SCH-001', ngay: '2026-11-18', hanPH: '2026-11-25', loai: 'Biện pháp thi công (Method statement)', mucDich: 'Phê duyệt', lan: 'Lần 2 – Rev.01', thayThe: 'RFA-SCH-000',
    tieuDe: 'Biện pháp lắp đặt thang máy', taiLieu: 'BP-01 | Biện pháp thi công lắp đặt | 01 | 03\nPhụ lục an toàn', canCu: 'Hợp đồng', nguoiLap: 'Kỹ sư A' };
  const xml = d.body({ I, f, K });
  balanced(xml);
  assert.doesNotMatch(xml, /undefined|NaN/);
  for (const re of [/PHIẾU ĐỀ XUẤT PHÊ DUYỆT/, /REQUEST FOR APPROVAL/, /RFA-SCH-001/, /18\/11\/2026/, /25\/11\/2026/, /Công trình Thử &amp; Co/, /123\/SCH/, /Công ty Thử; TVGS Thử/,
    /Lần 2 – Rev\.01/, /RFA-SCH-000/, /☒ <\/w:t><\/w:r><w:r><w:t xml:space="preserve">Biện pháp thi công \(Method statement\)/, /☒ <\/w:t><\/w:r><w:r><w:t xml:space="preserve">Phê duyệt/,
    /BP-01/, /Biện pháp thi công lắp đặt/, /Phụ lục an toàn/, /A – Phê duyệt/, /C – Sửa và trình lại/, /D – Từ chối/, /TƯ VẤN GIÁM SÁT/, /CHỦ ĐẦU TƯ/, /Kỹ sư A/, /NGƯỜI KÝ/]) assert.match(xml, re);
  assert.equal((xml.match(/☒/g) || []).length, 2, 'chỉ đánh dấu loại + mục đích đã chọn');
  assert.match(L.fileName(d, I, f), /^RFA RFA-SCH-001 - De xuat phe duyet - Công trình Thử & Co\.docx$/);
});

test('công văn: ô trống in dấu chấm, không lỗi', () => {
  for (const d of L.LETTERS) {
    const xml = d.body({ I: {}, f: {}, K });
    balanced(xml);
    assert.doesNotMatch(xml, /undefined|NaN/, d.id);
  }
  assert.match(L.fileName(L.LETTERS[0], I, {}), /^CV - .*\.docx$/);
  assert.doesNotMatch(L.fileName(L.LETTERS[0], { congTrinh: 'A/B:C' }, {}), /[/:]/);
});

test('hồ sơ pháp lý: 8 tài liệu, chỉ người được chọn vào BCH / PCCC', () => {
  const LG = { ngay: '2026-11-12', people: [
    { ten: 'Nguyễn Văn Một', role: 'cht', bch: true }, { ten: 'Trần Văn Hai', role: 'atld', bch: true, pccc: true },
    { ten: 'Lê Văn Ba', role: 'cn', pccc: true }, { ten: 'Phạm Văn Bốn', role: 'cn' }, { ten: '   ', role: 'cn', bch: true }] };
  assert.equal(G.DOCS.length, 8);
  const body = (id) => G.DOCS.find(d => d.id === id).body(I, LG);
  for (const d of G.DOCS) { const x = d.body(I, LG); balanced(x); assert.doesNotMatch(x, /undefined|NaN/, d.id); }
  const bch = body('qd_bch');
  assert.match(bch, /Nguyễn Văn Một/); assert.match(bch, /Trần Văn Hai/); assert.doesNotMatch(bch, /Lê Văn Ba/);
  const pccc = body('pccc');
  assert.match(pccc, /Trần Văn Hai/); assert.match(pccc, /Lê Văn Ba/); assert.doesNotMatch(pccc, /Phạm Văn Bốn/);
  const tn = body('trach_nhiem');
  assert.match(tn, /Điều 1: /); assert.match(tn, /Ông Lê Văn Ba, Ông Phạm Văn Bốn là công nhân/);
  assert.match(body('danhmuc'), /Căn cước công dân \(Nguyễn Văn Một, Trần Văn Hai, Lê Văn Ba, Phạm Văn Bốn\)/);
  assert.match(body('may_moc'), /Pa lăng 3T/, 'danh sách máy móc mặc định');
  // không có dữ liệu → vẫn tạo được
  for (const d of G.DOCS) balanced(d.body({}, {}));
});

test('bìa bản vẽ: nhận khổ giấy theo kích thước trang', () => {
  assert.equal(D.paperName(1190.55, 841.89), 'A3');
  assert.equal(D.paperName(841.89, 1190.55), 'A3');
  assert.equal(D.paperName(2384, 1684), 'A1');
  assert.equal(D.paperName(595, 842), 'A4');
  assert.equal(D.paperName(1000, 700), '247×353');
});


test('RFA: bên duyệt chỉ Chủ đầu tư hoặc TVGS + Chủ đầu tư (tự chọn theo thông tin dự án khi để trống)', () => {
  const d = L.LETTERS.find(x => x.id === 'rfa');
  const only = d.body({ I: { ...I, tvgs: '', banQLDA: '' }, f: { so: 'R1' }, K });
  assert.match(only, /PHẦN DÀNH CHO CHỦ ĐẦU TƯ \(FOR OWNER USE\)/);
  assert.doesNotMatch(only, /TƯ VẤN GIÁM SÁT/);
  assert.match(only, /<w:gridSpan w:val="2"\/>.*CHỦ ĐẦU TƯ/s);
  assert.match(only, /để Chủ đầu tư xem xét, phê duyệt/);
  const both = d.body({ I, f: { so: 'R1' }, K });
  assert.match(both, /TƯ VẤN GIÁM SÁT \/ CHỦ ĐẦU TƯ \(FOR CONSULTANT/); assert.match(both, /Công ty Thử; TVGS Thử/);
  const forced = d.body({ I, f: { so: 'R1', duyet: 'Chủ đầu tư' }, K });
  assert.doesNotMatch(forced, /TƯ VẤN GIÁM SÁT/, 'có TVGS trong hồ sơ nhưng chọn chỉ CĐT duyệt');
  assert.doesNotMatch(forced, /Công ty Thử; TVGS Thử/);
});

test('RFI — phiếu yêu cầu cung cấp thông tin: câu hỏi đánh số, ảnh hưởng, phần trả lời theo bên trả lời', () => {
  const d = L.LETTERS.find(x => x.id === 'rfi');
  const f = { so: 'RFI-001', ngay: '2026-11-18', hanTL: '2026-11-22', hangMuc: 'Giếng thang PL1', thamChieu: 'KT-05', cauHoi: 'Cao độ sàn tầng tum?\nVị trí tủ điện?', anhHuong: 'Ảnh hưởng tiến độ', duyet: 'Chủ đầu tư' };
  const xml = d.body({ I, f, K });
  balanced(xml); assert.doesNotMatch(xml, /undefined|NaN/);
  for (const re of [/PHIẾU YÊU CẦU CUNG CẤP THÔNG TIN/, /REQUEST FOR INFORMATION \(RFI\)/, /RFI-001/, /22\/11\/2026/, /Giếng thang PL1/, /KT-05/, /1\.\t<\/w:t>.*Cao độ sàn tầng tum\?/s, /Vị trí tủ điện\?/,
    /☒ <\/w:t><\/w:r><w:r><w:t xml:space="preserve">Ảnh hưởng tiến độ /, /PHẦN TRẢ LỜI CỦA CHỦ ĐẦU TƯ \(RESPONSE\)/]) assert.match(xml, re);
  assert.doesNotMatch(xml, /TƯ VẤN GIÁM SÁT/);
  assert.match(L.fileName(d, I, f), /^RFI RFI-001 - Yeu cau cung cap thong tin - /);
});

test('Báo giá phát sinh: thành tiền, VAT, tổng cộng, số tiền bằng chữ', () => {
  assert.equal(L.docSo(1005), 'Một nghìn không trăm linh năm đồng');
  assert.equal(L.docSo(57240000), 'Năm mươi bảy triệu hai trăm bốn mươi nghìn đồng');
  assert.equal(L.docSo(2005003001), 'Hai tỷ không trăm linh năm triệu không trăm linh ba nghìn không trăm linh một đồng');
  assert.equal(L.docSo(21), 'Hai mươi mốt đồng'); assert.equal(L.docSo(115), 'Một trăm mười lăm đồng'); assert.equal(L.docSo(24), 'Hai mươi tư đồng');
  const q = L.quoteCalc('Cửa tầng | bộ | 1 | 45.000.000\nNhân công | gói | 2,5 | 8,000,000', '8');
  assert.deepEqual([q.sub, q.vat, q.total], [65000000, 5200000, 70200000]);
  const d = L.LETTERS.find(x => x.id === 'bao_gia_ps');
  const xml = d.body({ I, f: { so: '20/BG', ngay: '2026-11-18', tieuDe: 'Cửa tầng tum', hangMucBG: 'Cửa tầng | bộ | 1 | 45.000.000\nNhân công | gói | 2,5 | 8,000,000', vat: '8', lyDo: 'Theo yêu cầu của Chủ đầu tư',
    thoiGian: '15 ngày', hieuLuc: '30', thanhToan: 'Đợt 1: Tạm ứng 30%\nĐợt 2: 70% sau nghiệm thu', hinhThucTT: 'Chuyển khoản', hoSoTT: 'Hoá đơn GTGT' }, K });
  balanced(xml); assert.doesNotMatch(xml, /undefined|NaN/);
  for (const re of [/Báo giá công việc phát sinh – Cửa tầng tum/, /45\.000\.000/, /20\.000\.000/, /65\.000\.000/, /Thuế GTGT 8%/, /5\.200\.000/, /70\.200\.000/,
    /Bảy mươi triệu hai trăm nghìn đồng\./, /XÁC NHẬN CỦA CHỦ ĐẦU TƯ/, /Kính gửi:/, /Tham chiếu: /, /Điều khoản báo giá/, /1\. Thời gian thực hiện:/, / 15 ngày\./,
    /đến hết ngày 18\/12\/2026/, /3\. Điều khoản thanh toán:/, /Tạm ứng 30% \(tương đương 21\.060\.000 đồng\)/, /70% sau nghiệm thu \(tương đương 49\.140\.000 đồng\)/,
    /Hình thức: Chuyển khoản\./, /Hồ sơ thanh toán: Hoá đơn GTGT\./]) assert.match(xml, re);
  assert.equal(L.validity('45 ngày', ''), '45 ngày kể từ ngày báo giá'); assert.equal(L.validity('đến hết năm 2026', '2026-11-18'), 'đến hết năm 2026');
  assert.equal(L.payLine('Đợt 1: 500.000 đồng', 1e6), 'Đợt 1: 500.000 đồng.');
});

test('Thông báo tồn tại giếng thang & điều kiện công trường trước lắp đặt', () => {
  const d = L.LETTERS.find(x => x.id === 'defect_ld');
  assert.ok(d);
  const xml = d.body({ I: { congTrinh: 'Toà nhà Mẫu', chuDauTu: 'Công ty Mẫu' }, f: { ngayKS: '2026-11-20', thang: 'PL1, PL2', ngayLD: '2026-12-01', hanXong: '2026-11-28',
    dieuKien: 'Kho tập kết | Đạt\nNguồn điện thi công | Chưa đạt\nLan can cửa tầng |' }, K });
  assert.doesNotMatch(xml, /undefined|NaN/);
  for (const re of [/1\. Tồn tại giếng thang cần khắc phục/, /2\. Điều kiện công trường cần đáp ứng/, /giếng thang PL1, PL2/, /01\/12\/2026/, /28\/11\/2026/,
    /✔ <\/w:t>.*Đạt/s, /✘ /, /Kho tập kết/, /Nguồn điện thi công/, /Chưa đạt/]) assert.match(xml, re);
});

test('mọi công văn cùng một khuôn: số hiệu, Kính gửi, V/v, Tham chiếu HĐ, khối ký TM., Nơi nhận; biên bản luôn in số; tên file và số tiếp theo thống nhất', () => {
  const xt = (x) => x.replace(/<[^>]+>/g, '');
  for (const d of L.LETTERS) {
    const f = { so: '125/2026/SCH-HN', ngay: '2026-11-18' };
    (d.fields || []).forEach(x => { if (x.def) f[x.k] = x.def; });
    const t = xt(d.body({ I, f, K }));
    if (d.kind === 'letter') {
      for (const s of ['Số: 125/2026/SCH-HN', 'Kính gửi:', 'V/v:', 'Tham chiếu: Hợp đồng số', 'Trân trọng kính chào.', 'Nơi nhận:', 'TM. ']) assert.ok(t.includes(s), d.id + ' thiếu “' + s + '”');
      assert.doesNotMatch(t, /Reference no\.|From|Subject|MOS01/, d.id + ': không còn khung From / Reference no. kiểu cũ');
    }
    if (d.kind === 'bb') assert.ok(t.includes('Số: 125/2026/SCH-HN'), d.id + ': biên bản in đúng số đã nhập');
    const fn = L.fileName(d, { congTrinh: 'Toà A' }, { so: '125/2026/SCH-HN' });
    assert.match(fn, /^(CV|BB|RFA|RFI) 125-2026-SCH-HN - .+ - Toà A\.docx$/, d.id + ': ' + fn);
  }
  const bbNo = xt(L.LETTERS.find(x => x.id === 'bb_huanluyen').body({ I, f: { ngay: '2026-11-18' }, K }));
  assert.match(bbNo, /Số: ……\/BBHL/);
  assert.equal(L.nextSo('125/2026/SCH-HN'), '126/2026/SCH-HN');
  assert.equal(L.nextSo('RFA-SCH-009'), 'RFA-SCH-010');
  assert.equal(L.nextSo('099/CV'), '100/CV');
  assert.equal(L.nextSo(''), '');
});

test('thư xác nhận ngày giao vật tư về công trường: cùng khuôn công văn, nội dung đủ 3 mục + ô khách hàng xác nhận', () => {
  const d = L.LETTERS.find(x => x.id === 'xn_hangve');
  const f = { so: '125/2026/SCH-HN', ngay: '2026-11-18', ngayVe: '2026-12-05', matBang: '2026-11-26', soThang: '02', cang: 'Cát Lái' };
  d.fields.forEach(x => { if (f[x.k] == null && x.def) f[x.k] = x.def; });
  const t = d.body({ I, f, K }).replace(/<[^>]+>/g, '');
  for (const s of ['V/v:Xác nhận ngày giao vật tư thang máy về công trường', '02 thang máy', 'cảng Cát Lái', 'ngày 05/12/2026', 'trước ngày 26/11/2026', '30 m²/01 thang máy',
    '1. Thời gian giao hàng về công trình', '2. Trường hợp tiến độ lắp đặt chậm', '3. Các công việc cần hoàn thiện / chuẩn bị trước khi hàng về', 'Chuẩn bị nguồn điện 3 pha',
    'XÁC NHẬN CỦA QUÝ KHÁCH HÀNG', 'Đồng ý với kế hoạch hàng về như trên', 'Ý kiến khác']) assert.ok(t.includes(s), 'thiếu ' + s);
});

test('Công văn — xem trước & sửa tay: mỗi đoạn một ô, sửa tay áp vào bản Word, đổi ô khác vẫn giữ, đoạn gốc đổi thì báo không khớp', async () => {
  const PV = require('../../tools/tiendotm/hspreview.js');
  const L = require('../../tools/tiendotm/hsletters.js');
  const d = L.LETTERS.find(x => x.id === 'xn_hangve');
  const I = { congTrinh: 'TOÀ MẪU', chuDauTu: 'Công ty A', soHD: '01/HĐ', ngayHD: '2026-01-05' };
  const x = L.compose(d, I, { so: '1/CV' });
  const ps = PV.paragraphs(x);
  const h = PV.toHtml(x);
  assert.equal((h.html.match(/class="pv-p"/g) || []).length, ps.filter(p => p.text.trim()).length, 'mỗi đoạn có chữ = một ô sửa');
  assert.match(h.html, /<table class="pv-t"/);
  const t = ps.find(p => p.text === 'Trân trọng kính chào.');
  const ed = { [t.i]: { o: t.text, x: '<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Trân trọng cảm ơn.</w:t></w:r>' } };
  // áp vào bản xuất
  const A = PV.applyEdits(x, ed);
  assert.equal(PV.paragraphs(A.xml)[t.i].text, 'Trân trọng cảm ơn.');
  assert.equal(PV.paragraphs(A.xml).length, ps.length);
  // đổi số công văn: đoạn khác đổi, sửa tay vẫn khớp; xem trước đánh dấu đoạn đã sửa
  const x2 = L.compose(d, I, { so: '2/CV' });
  const h2 = PV.toHtml(x2, { ed });
  assert.equal(h2.count, 1); assert.deepEqual(h2.miss, []);
  assert.match(h2.html, /class="pv-p ed"[^>]*data-k="\d+"[^>]*>.*Trân trọng cảm ơn/);
  // đoạn gốc đổi chữ → không còn khớp
  const ed2 = { 3: { o: 'đoạn không còn tồn tại', x: '<w:r><w:t>x</w:t></w:r>' } };
  assert.deepEqual(PV.applyEdits(x, ed2).miss, ['3']);
  // so sánh định dạng: cùng chữ + cùng kiểu, khác cách chia run → bằng nhau
  assert.equal(PV.canon('<w:r><w:t xml:space="preserve">A</w:t></w:r><w:r><w:t>B</w:t></w:r>'), PV.canon('<w:r><w:t>AB</w:t></w:r>'));
  assert.notEqual(PV.canon('<w:r><w:rPr><w:b/></w:rPr><w:t>AB</w:t></w:r>'), PV.canon('<w:r><w:t>AB</w:t></w:r>'));
});

test('Công văn tạm dừng thi công: tồn đọng CĐT / nhà thầu XD, hiện trạng, khối lượng + tổng ngày còn lại, báo trước 07 ngày làm việc', () => {
  const PV = require('../../tools/tiendotm/hspreview.js');
  const d = L.LETTERS.find(x => x.id === 'tam_dung');
  const f = { so: '130/2026/SCH-HN', ngay: '2026-11-20', ngayDung: '2026-11-25', thang: 'PL1–PL4', nhaThauXD: 'Công ty XD Mẫu',
    tonCDT: 'Cấp điện 3 pha | 2026-12-05', tonNTXD: 'Hoàn thiện vách giếng thang', hienTrang: 'PL1 | Lắp ray | 40%', conLai: 'Lắp cabin | 10\nChạy thử | 4,5' };
  const t = PV.paragraphs(L.compose(d, { congTrinh: 'TOÀ MẪU', chuDauTu: 'Công ty A' }, f)).map(p => p.text).join('\n');
  assert.match(t, /tạm dừng thi công kể từ ngày 25\/11\/2026/);
  assert.match(t, /1\.1\. Phía Chủ đầu tư[\s\S]*Cấp điện 3 pha[\s\S]*05\/12\/2026/);
  assert.match(t, /1\.2\. Phía Nhà thầu xây dựng \(Công ty XD Mẫu\)[\s\S]*Hoàn thiện vách giếng thang/);
  assert.match(t, /PL1\nLắp ray\n40%/);
  assert.match(t, /14\.5 ngày/, 'tự cộng số ngày còn lại');
  assert.match(t, /trước tối thiểu 07 \(bảy\) ngày làm việc để Schindler Việt Nam thu xếp nhân sự, máy móc/);
  assert.doesNotMatch(t, /undefined|NaN/);
  const t2 = PV.paragraphs(L.compose(d, {}, { ...f, tgConLai: '30', baoTruoc: '10' })).map(p => p.text).join('\n');
  assert.match(t2, /30 ngày/); assert.match(t2, /10 \(mười\) ngày làm việc/);
});

test('Xem trước & sửa tay trên file Word thật (BB hàng về / bàn giao): thẻ có thuộc tính, giữ thẻ mở đoạn, bảng', () => {
  const PV = require('../../tools/tiendotm/hspreview.js');
  const xml = '<w:body><w:p w:rsidR="00A1" w14:paraId="1"><w:pPr><w:jc w:val="center"/></w:pPr><w:r w:rsidRPr="00B2"><w:rPr><w:b/></w:rPr><w:t>BIÊN BẢN</w:t></w:r><w:proofErr w:type="spellStart"/><w:r><w:t xml:space="preserve"> BÀN GIAO</w:t></w:r></w:p>'
    + '<w:tbl><w:tblPr/><w:tblGrid><w:gridCol w:w="4000"/><w:gridCol w:w="5000"/></w:tblGrid><w:tr w:rsidR="1"><w:tc><w:tcPr/><w:p w:rsidR="2"><w:r><w:t>Bên Mua</w:t></w:r></w:p></w:tc><w:tc><w:tcPr/><w:p w:rsidR="3"><w:r><w:t>CÔNG TY A</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:sectPr/></w:body>';
  const ps = PV.paragraphs(xml);
  assert.deepEqual(ps.map(p => p.text), ['BIÊN BẢN BÀN GIAO', 'Bên Mua', 'CÔNG TY A']);
  const h = PV.toHtml(xml);
  assert.equal((h.html.match(/class="pv-p"/g) || []).length, 3);
  assert.match(h.html, /<table class="pv-t"/);
  const A = PV.applyEdits(xml, { 2: { o: 'CÔNG TY A', x: '<w:r><w:t>CÔNG TY B</w:t></w:r>' } });
  assert.match(A.xml, /<w:p w:rsidR="3"><w:r><w:t>CÔNG TY B<\/w:t><\/w:r><\/w:p>/, 'giữ nguyên thẻ mở đoạn gốc');
  assert.equal(PV.paragraphs(A.xml)[0].text, 'BIÊN BẢN BÀN GIAO');
});

test('Hồ sơ pháp lý: xem trước (compose) + sửa tay áp vào bản Word khi xuất (L.ed[id])', async () => {
  const PV = require('../../tools/tiendotm/hspreview.js');
  const I = { congTrinh: 'TOÀ MẪU', chuDauTu: 'Công ty A' };
  const L = { ngay: '2026-11-21', people: [{ ten: 'Nguyễn Văn A', gioi: 'Ông', role: 'cht', bch: true, pccc: true }], machines: G.MAY_MOC, docs: {} };
  const x = G.compose('qd_bch', I, L);
  const p = PV.paragraphs(x).find(q => q.text.trim().length > 20);
  L.ed = { qd_bch: { [p.i]: { o: p.text, x: '<w:r><w:t>ĐOẠN ĐÃ SỬA TAY</w:t></w:r>' } } };
  let body = '';
  const fakeZip = function () { const files = {}; return { file: (n, d) => { files[n] = d; if (n === 'word/document.xml') body = d; } }; };
  await G.build(fakeZip, 'qd_bch', I, L);
  assert.match(body, /ĐOẠN ĐÃ SỬA TAY/);
  await G.build(fakeZip, 'pccc', I, L);
  assert.doesNotMatch(body, /ĐOẠN ĐÃ SỬA TAY/, 'sửa tay chỉ áp cho đúng văn bản');
});
