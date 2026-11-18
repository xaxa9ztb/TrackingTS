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

test('công văn & biên bản: đủ 15 mẫu (gồm RFA, RFI, báo giá phát sinh), cùng khuôn đầu thư, điền thông tin dự án', () => {
  assert.equal(L.LETTERS.length, 15);
  assert.equal(new Set(L.LETTERS.map(x => x.id)).size, 15, 'id không trùng');
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
