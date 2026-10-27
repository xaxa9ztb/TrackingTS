// Kiểm tra các file mẫu Word của chức năng Hồ sơ chất lượng: token có đủ, không còn dữ liệu mẫu cứng,
// và mọi {{TOKEN}} trong mẫu đều được index.html xử lý (tránh sót token khi sửa mẫu).
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../tools/tiendotm');
const html = readFileSync(path.join(dir, 'index.html'), 'utf8');
const parts = (docx) => {
  const list = execFileSync('unzip', ['-Z1', path.join(dir, docx)]).toString().split('\n').filter((f) => /^word\/(document|header\d*|footer\w*)\.xml$/.test(f));
  return list.map((f) => execFileSync('unzip', ['-p', path.join(dir, docx), f], { maxBuffer: 1 << 28 }).toString('utf8'));
};
const text = (docx) => parts(docx).join('\n');
const tokens = (s) => [...new Set(s.match(/\{\{[A-Z0-9_]+\}\}/g) || [])];
// token do mã sinh khối (putBlock) hoặc đặt mốc — không cần xuất hiện nguyên dạng trong index.html dạng chuỗi giá trị
const MARKERS = /^\{\{(BLOCK_\w+|PHASE_BEGIN|PHASE_END|SEC\d_BEGIN|BBG_BEGIN|BBG_END|NK_DAY_BEGIN|NK_DAY_END)\}\}$/;

for (const f of ['hoso_chatluong_template.docx', 'bbxn_hangve_template.docx', 'bangiao_template.docx', 'nhatky_template.docx']) {
  test(`${f}: mọi token đều được index.html xử lý`, () => {
    const miss = tokens(text(f)).filter((t) => !MARKERS.test(t) && !html.includes(t) && !/^\{\{NK_CB\d_/.test(t));
    assert.deepEqual(miss, [], 'token chưa có chỗ điền: ' + miss.join(', '));
  });
}

test('mẫu hồ sơ: không còn dữ liệu đà thép / phụ lục viết cứng', () => {
  const t = text('hoso_chatluong_template.docx').replace(/<[^>]+>/g, '');
  for (const bad of ['14 đà thép', 'Đà thép ngăn hố thang đôi', 'U120x55x900', 'Hệ đà thép, bản mã đỡ ray', 'IV. Vật tư sản xuất trong nước', '{{BBG_TRAVEL}}{{BBG_TRAVEL}}', 'The Supplier'])
    assert.ok(!t.includes(bad), 'còn: ' + bad);
});

test('mẫu hồ sơ: có điểm chèn hạng mục bổ sung ở cả Phần I và Phần II', () => {
  const x = text('hoso_chatluong_template.docx');
  assert.equal((x.match(/\{\{BLOCK_KT_HM\}\}/g) || []).length, 2);
  for (const t of ['{{XUAT_XU}}', '{{CT_COCQ}}', '{{CT_VANDON}}', '{{KL_TEN}}', '{{KL_SPEC}}']) assert.ok(x.includes(t), 'thiếu ' + t);
});

test('biên bản bàn giao nhúng trong hồ sơ dùng Bên Mua / Bên Bán', () => {
  const t = text('hoso_chatluong_template.docx').replace(/<[^>]+>/g, '');
  assert.ok(t.includes('Bên Mua') && t.includes('The Seller') && t.includes('Phụ lục Hợp đồng số {{SO_PL}}'));
});

test('nhật ký thi công: khối ngày có mốc và token ngày', () => {
  const x = text('nhatky_template.docx');
  assert.ok(x.includes('{{NK_DAY_BEGIN}}') && x.includes('{{NK_DAY_END}}') && x.includes('{{NK_NGAY}}'));
  assert.equal((x.match(/\{\{NK_NGAY\}\}/g) || []).length, 1);
});

test('biên bản bàn giao riêng: số biên bản ở chân trang', () => {
  assert.ok(text('bangiao_template.docx').includes('{{SO_BB}}'));
});
