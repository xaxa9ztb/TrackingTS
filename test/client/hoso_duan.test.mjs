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

test('công văn & biên bản: đủ 12 mẫu, cùng khuôn đầu thư, điền thông tin dự án', () => {
  assert.equal(L.LETTERS.length, 12);
  assert.equal(new Set(L.LETTERS.map(x => x.id)).size, 12, 'id không trùng');
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
    } else assert.match(xml, /CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM/, d.id);
  }
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
