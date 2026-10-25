// Kiểm thử logic đồng bộ Timesheet cá nhân (tools/timesheet/tssync.js) bằng máy chủ giả trong bộ nhớ.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const TsSync = require('../../tools/timesheet/tssync.js');

const E = (id, date, u = 0, extra = {}) => ({ id, date, activityCode: '1110', u, ...extra });

test('kỳ lương: ngày 16 trở đi thuộc kỳ của tháng sau (kể cả qua năm)', () => {
  assert.equal(TsSync.periodOf('2026-10-16'), '2026-11');
  assert.equal(TsSync.periodOf('2026-11-15'), '2026-11');
  assert.equal(TsSync.periodOf('2026-12-31'), '2027-01');
  assert.equal(TsSync.periodOf('2027-01-01'), '2027-01');
});

test('gộp: dòng sửa sau thắng; dòng chỉ có một bên được giữ', () => {
  const m = TsSync.mergeDoc(
    [E(1, '2026-11-02', 200, { v: 'local' }), E(2, '2026-11-03', 100)],
    {}, { entries: [E(1, '2026-11-02', 100, { v: 'remote' }), E(3, '2026-11-04', 50)], deleted: {} });
  const byId = Object.fromEntries(m.entries.map(e => [e.id, e]));
  assert.equal(m.entries.length, 3); assert.equal(byId[1].v, 'local'); assert.ok(byId[2] && byId[3]);
  const m2 = TsSync.mergeDoc([E(1, '2026-11-02', 100, { v: 'local' })], {}, { entries: [E(1, '2026-11-02', 300, { v: 'remote' })], deleted: {} });
  assert.equal(m2.entries[0].v, 'remote', 'bản trên máy chủ mới hơn thắng');
});

test('gộp: dòng đã xoá (ở máy nào) không bị sống lại; sửa lại sau khi xoá thì còn', () => {
  const now = Date.now();
  const a = TsSync.mergeDoc([E(1, '2026-11-02', 100)], {}, { entries: [], deleted: { 1: now } });
  assert.equal(a.entries.length, 0, 'máy khác đã xoá');
  const b = TsSync.mergeDoc([], { 2: now }, { entries: [E(2, '2026-11-03', 100)], deleted: {} });
  assert.equal(b.entries.length, 0, 'máy này đã xoá, bản trên máy chủ còn dòng cũ');
  const c = TsSync.mergeDoc([E(3, '2026-11-04', now + 5000)], {}, { entries: [], deleted: { 3: now } });
  assert.equal(c.entries.length, 1, 'sửa sau lần xoá → còn');
  const old = TsSync.mergeDoc([], { 9: now - 100 * 864e5 }, { entries: [], deleted: {} });
  assert.deepEqual(old.tomb, {}, 'bản ghi xoá quá 90 ngày được dọn');
});

test('gộp: differs chỉ true khi kết quả khác bản trên máy chủ', () => {
  const remote = { entries: [E(1, '2026-11-02', 10)], deleted: {} };
  assert.equal(TsSync.mergeDoc([E(1, '2026-11-02', 10)], {}, remote).differs, false);
  assert.equal(TsSync.mergeDoc([], {}, remote).differs, false, 'thiếu dòng của máy chủ → lấy về, không cần gửi');
  assert.equal(TsSync.mergeDoc([E(1, '2026-11-02', 10), E(2, '2026-11-03', 11)], {}, remote).differs, true);
  assert.equal(TsSync.mergeDoc([E(1, '2026-11-02', 20)], {}, remote).differs, true);
});

test('applyChanges: giữ dòng người dùng vừa sửa / thêm trong lúc đồng bộ, không đụng kỳ khác', () => {
  const started = 1000;
  const current = [E(1, '2026-11-02', 500), E(2, '2026-11-03', 2000), E(4, '2026-11-05', 1500), E(9, '2026-12-20', 1)];
  const merged = [E(1, '2026-11-02', 700, { v: 'm' }), E(2, '2026-11-03', 100, { v: 'm' }), E(3, '2026-11-04', 10)];
  const out = TsSync.applyChanges(current, '2026-11', merged, started);
  const byId = Object.fromEntries(out.map(e => [e.id, e]));
  assert.equal(byId[1].v, 'm', 'bản đã gộp mới hơn');
  assert.equal(byId[2].u, 2000, 'người dùng sửa tiếp sau khi bắt đầu đồng bộ → giữ');
  assert.ok(byId[3], 'dòng từ máy chủ');
  assert.ok(byId[4], 'dòng mới thêm trong lúc đồng bộ');
  assert.ok(byId[9], 'kỳ khác không bị đụng');
  const removed = TsSync.applyChanges([E(5, '2026-11-02', 10)], '2026-11', [], started);
  assert.equal(removed.length, 0, 'dòng đã bị xoá ở máy khác biến mất');
});

// ---- máy chủ giả: cùng quy tắc với /api/ts/docs (phiên bản, 409, 423) ----
function fakeServer() {
  const docs = new Map();            // period → {version, status, entries, deleted}
  const log = [];
  const handler = async (url, init = {}) => {
    const method = init.method || 'GET', body = init.body ? JSON.parse(init.body) : undefined;
    const reply = (status, data) => ({ status, ok: status < 300, type: 'basic', json: async () => data });
    if (fakeServer.offline) throw new TypeError('Failed to fetch');
    log.push(method + ' ' + url);
    let m;
    if (url === '/api/ts/docs' && method === 'GET') return reply(200, { docs: [...docs].map(([period, d]) => ({ period, version: d.version, status: d.status, entries: d.entries.length })) });
    if ((m = url.match(/^\/api\/ts\/docs\/(.+)$/))) {
      const p = m[1], d = docs.get(p);
      if (method === 'GET') return reply(200, { period: p, version: d ? d.version : 0, status: d ? d.status : 'draft', data: d ? { entries: d.entries, deleted: d.deleted } : { entries: [], deleted: {} } });
      if (method === 'PUT') {
        const cur = d ? d.version : 0;
        if (d && ['submitted', 'sitesup_ok', 'approved'].includes(d.status)) return reply(423, { locked: true, version: cur, status: d.status });
        if (body.baseVersion !== cur) return reply(409, { conflict: true, version: cur, status: d ? d.status : 'draft', data: d ? { entries: d.entries, deleted: d.deleted } : { entries: [], deleted: {} } });
        docs.set(p, { version: cur + 1, status: d ? d.status : 'draft', entries: body.data.entries, deleted: body.data.deleted });
        return reply(200, { ok: true, version: cur + 1 });
      }
    }
    return reply(404, { error: 'nf' });
  };
  return { docs, log, handler };
}

// Mỗi "thiết bị" có localStorage + mảng dòng riêng
function device(server) {
  const store = new Map();
  const ls = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  const dev = { entries: [] };
  dev.run = async () => {
    globalThis.localStorage = ls; globalThis.fetch = server.handler;
    return TsSync.sync({ getEntries: () => dev.entries, onMerged: (p, merged, startedAt) => { dev.entries = TsSync.applyChanges(dev.entries, p, merged, startedAt); } });
  };
  dev.add = (e) => { globalThis.localStorage = ls; dev.entries = [...dev.entries, { ...e, u: Date.now() }]; TsSync.markDirty(e.date); };
  dev.del = (id) => { globalThis.localStorage = ls; const e = dev.entries.find(x => x.id === id); dev.entries = dev.entries.filter(x => x.id !== id); TsSync.markDeleted(e); TsSync.markDirty(e.date); };
  dev.state = () => { globalThis.localStorage = ls; return TsSync.load(); };
  return dev;
}

test('đồng bộ: lần đầu gửi các kỳ đã có dòng trên máy; lần sau không gửi gì nếu không đổi', async () => {
  const srv = fakeServer(), a = device(srv);
  a.entries = [E(1, '2026-10-16', 1), E(2, '2026-11-02', 2), E(3, '2026-11-20', 3)];
  const r = await a.run();
  assert.equal(r.ok, true); assert.equal(r.pushed, 2);
  assert.equal(srv.docs.get('2026-11').entries.length, 2); assert.equal(srv.docs.get('2026-12').entries.length, 1);
  srv.log.length = 0;
  const r2 = await a.run();
  assert.equal(r2.pushed, 0); assert.deepEqual(srv.log, ['GET /api/ts/docs'], 'chỉ hỏi danh sách');
});

test('đồng bộ: hai thiết bị — thêm, sửa, xoá ở máy này hiện ở máy kia, không mất dữ liệu của ai', async () => {
  const srv = fakeServer(), phone = device(srv), laptop = device(srv);
  phone.add(E(1, '2026-11-02')); await phone.run();
  laptop.entries = []; await laptop.run();
  assert.deepEqual(laptop.entries.map(e => e.id), [1], 'máy mới tải bảng công về');
  // cả hai cùng thêm một dòng khác nhau khi chưa đồng bộ
  phone.add(E(2, '2026-11-03')); laptop.add(E(3, '2026-11-04'));
  await phone.run(); await laptop.run(); await phone.run();
  assert.deepEqual(phone.entries.map(e => e.id).sort(), [1, 2, 3]); assert.deepEqual(laptop.entries.map(e => e.id).sort(), [1, 2, 3]);
  assert.equal(srv.docs.get('2026-11').entries.length, 3);
  // xoá ở laptop → điện thoại cũng mất dòng đó
  laptop.del(2); await laptop.run(); await phone.run();
  assert.deepEqual(phone.entries.map(e => e.id).sort(), [1, 3]);
  assert.ok(srv.docs.get('2026-11').deleted[2], 'máy chủ nhớ dòng đã xoá');
});

test('đồng bộ: mất mạng thì giữ dữ liệu + dấu chưa gửi, có mạng lại thì gửi', async () => {
  const srv = fakeServer(), a = device(srv);
  a.add(E(1, '2026-11-02'));
  fakeServer.offline = true;
  const r = await a.run();
  assert.equal(r.ok, false); assert.equal(r.offline, true);
  assert.equal(a.entries.length, 1); assert.ok(a.state().dirty['2026-11']);
  fakeServer.offline = false;
  const r2 = await a.run();
  assert.equal(r2.ok, true); assert.equal(srv.docs.get('2026-11').entries.length, 1); assert.equal(a.state().dirty['2026-11'], undefined);
});

test('đồng bộ: kỳ đã nộp / đã duyệt (khoá) → không gửi đè, vẫn tải bản trên máy chủ về', async () => {
  const srv = fakeServer(), a = device(srv);
  srv.docs.set('2026-11', { version: 4, status: 'approved', entries: [E(1, '2026-11-02', 1)], deleted: {} });
  a.add(E(9, '2026-11-05'));
  const r = await a.run();
  assert.equal(r.ok, true); assert.equal(r.pushed, 0); assert.equal(r.statuses['2026-11'], 'approved');
  assert.equal(srv.docs.get('2026-11').entries.length, 1, 'bản đã duyệt không bị đè');
  assert.ok(a.entries.some(e => e.id === 1), 'dòng đã duyệt được tải về');
});

test('đồng bộ: gửi cùng lúc bị 409 thì gộp lại và gửi tiếp', async () => {
  const srv = fakeServer(), a = device(srv);
  a.add(E(1, '2026-11-02')); await a.run();
  a.add(E(2, '2026-11-03'));
  // máy khác chen vào ngay trước lần gửi của máy này
  srv.docs.get('2026-11').version = 7; srv.docs.get('2026-11').entries.push(E(3, '2026-11-04', 5));
  const r = await a.run();
  assert.equal(r.ok, true);
  assert.deepEqual(srv.docs.get('2026-11').entries.map(e => e.id).sort(), [1, 2, 3]);
  assert.deepEqual(a.entries.map(e => e.id).sort(), [1, 2, 3]);
});
