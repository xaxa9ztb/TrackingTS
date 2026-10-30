// Nhập bảng công vào hệ thống:
//   1) Lịch sử từ bảng "Theo dõi giờ công" (Excel đã nạp, bảng timesheets): dựng lại bảng công của TỪNG nhân viên theo từng kỳ lương trong quá khứ
//      (kể cả nhân viên không có tài khoản app), trạng thái "đã duyệt xong" — Admin / Admin dự án làm theo từng đợt nhỏ.
//   2) Nhập hộ từ Excel (giám sát, Quản lý dự án, Admin): trình duyệt đọc file Excel, người nhập chỉnh theo định dạng / quy tắc / dự án, rồi nộp:
//      máy chủ ghi bảng công cho từng nhân viên (kể cả người không có tài khoản) và bắt đầu quy trình duyệt từ đầu.
// Các hàm dùng chung của api.mjs được truyền vào qua `h` để tránh nhập vòng.
import { PERIOD_RE, periodRange, checkDoc, checkSubmitEntries, projectWbs } from './tsdoc.mjs';

const OTK = ['ot1', 'ot2', 'ot3', 'ot4', 'ot5', 'ot6', 'ot7'];
const r2 = (n) => Math.round(n * 100) / 100;
const isAdminish = (me) => !!(me && (me.isAdmin || me.isProjAdmin));
const ph = (n) => Array.from({ length: n }, () => '?').join(', ');
const parse = (s, d) => { try { return JSON.parse(s); } catch (e) { return d; } };
const hm = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '')); return m ? +m[1] + +m[2] / 60 : null; };
const toHM = (h) => { const x = Math.round((((h % 24) + 24) % 24) * 60); return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };
const HISTORY_BATCH = 15;       // nhân viên mỗi lần gọi (giới hạn lượt gọi D1 của gói miễn phí)

// Dòng "Theo dõi giờ công" → dòng chấm công của Timesheet cá nhân (có phân loại giờ bd)
export function entryFromTracking(r, idx) {
  const n = (k) => r2(Number(r[k]) || 0);
  const bd = {};
  if (n('normal')) bd.NORMAL = n('normal');
  OTK.forEach((k, i) => { if (n(k)) bd['OT' + (i + 1)] = n(k); });
  const total = Object.values(bd).reduce((a, v) => a + v, 0);
  let start = /^\d{1,2}:\d{2}$/.test(String(r.timeFrom || '')) ? r.timeFrom : '', end = /^\d{1,2}:\d{2}$/.test(String(r.timeTo || '')) ? r.timeTo : '';
  let brk = 0;
  if (start && end) { let g = hm(end) - hm(start); if (g < 0) g += 24; brk = Math.max(0, r2(g - total)); }
  else if (total > 0) { start = '08:00'; end = toHM(8 + total); }
  const main = Object.keys(bd).sort((a, b) => bd[b] - bd[a])[0] || 'NORMAL';
  return {
    id: Number(String(r.date).replace(/-/g, '')) * 1000 + (idx % 1000), date: r.date, startTime: start, endTime: end, breakTime: String(brk), otMode: 'manual', otType: main,
    projectName: String(r.projectNameFree || '').slice(0, 200), workNumber: String(r.wbs || '').slice(0, 100), activityCode: String(r.activities || '').slice(0, 20),
    dutyHour: '0', remarks: 'Nhập từ Theo dõi giờ công', report: '', cat: String(r.category || '').slice(0, 12), bd, u: 1, imp: 1,
  };
}

async function activeBatch(h, env) {
  const row = await env.DB.prepare("SELECT data FROM kv_store WHERE key = 'timesheets_meta'").first();
  return row && row.data ? (parse(row.data, {}).active || 0) : 0;
}

// GET ?period= → số nhân viên có dữ liệu trong kỳ ở bảng Theo dõi giờ công và số đã có bảng công
async function historyInfo(h, env, me, url) {
  if (!isAdminish(me)) throw new h.HttpError(403, 'Chỉ Admin hoặc Admin dự án nhập dữ liệu lịch sử');
  const period = String(url.searchParams.get('period') || '');
  if (!PERIOD_RE.test(period)) throw new h.HttpError(400, 'Kỳ lương không hợp lệ (dạng YYYY-MM)');
  const batch = await activeBatch(h, env), { start, end } = periodRange(period);
  if (!batch) return h.json({ period, employees: 0, done: 0, rows: 0 });
  const emps = (await env.DB.prepare("SELECT emp_id, COUNT(*) n FROM timesheets WHERE batch = ? AND date >= ? AND date <= ? AND (src IS NULL OR src NOT LIKE 'ts:%') GROUP BY emp_id").bind(batch, start, end).all()).results;
  const have = new Set((await env.DB.prepare('SELECT emp_id FROM ts_docs WHERE period = ?').bind(period).all()).results.map(r => r.emp_id));
  return h.json({ period, employees: emps.length, done: emps.filter(e => have.has(e.emp_id)).length, rows: emps.reduce((a, e) => a + e.n, 0) });
}

// POST {period} → nhập tối đa HISTORY_BATCH nhân viên chưa có bảng công kỳ đó; trả về còn lại bao nhiêu
async function importHistory(h, env, me, request) {
  if (!isAdminish(me)) throw new h.HttpError(403, 'Chỉ Admin hoặc Admin dự án nhập dữ liệu lịch sử');
  const body = await h.readJson(request);
  const period = String(body.period || '');
  if (!PERIOD_RE.test(period)) throw new h.HttpError(400, 'Kỳ lương không hợp lệ (dạng YYYY-MM)');
  const batch = await activeBatch(h, env), { start, end } = periodRange(period);
  if (!batch) return h.json({ ok: true, period, imported: 0, remaining: 0, rows: 0 });
  const all = (await env.DB.prepare("SELECT DISTINCT emp_id FROM timesheets WHERE batch = ? AND date >= ? AND date <= ? AND (src IS NULL OR src NOT LIKE 'ts:%') ORDER BY emp_id").bind(batch, start, end).all()).results.map(r => r.emp_id);
  const have = new Set((await env.DB.prepare('SELECT emp_id FROM ts_docs WHERE period = ?').bind(period).all()).results.map(r => r.emp_id));
  const todo = all.filter(e => !have.has(e)), take = todo.slice(0, HISTORY_BATCH);
  if (!take.length) return h.json({ ok: true, period, imported: 0, remaining: 0, rows: 0 });
  const rows = (await env.DB.prepare(`SELECT emp_id, date, data FROM timesheets WHERE batch = ? AND date >= ? AND date <= ? AND emp_id IN (${ph(take.length)}) AND (src IS NULL OR src NOT LIKE 'ts:%') ORDER BY emp_id, date, id`)
    .bind(batch, start, end, ...take).all()).results;
  const by = new Map();
  for (const r of rows) { if (!by.has(r.emp_id)) by.set(r.emp_id, []); by.get(r.emp_id).push(parse(r.data, {})); }
  const t = h.now(), by_ = me.name, stmts = [];
  let total = 0;
  for (const [emp, list] of by) {
    const entries = list.filter(r => r && r.date).map((r, i) => entryFromTracking(r, i)).filter(e => e.date >= start && e.date <= end).slice(0, 400);
    if (!entries.length) continue;
    const checked = checkDoc(period, { entries, deleted: {} });
    stmts.push(env.DB.prepare(`INSERT INTO ts_docs (emp_id, period, version, status, data, entry_count, saved_at, saved_by, submitted_at, final_by, final_at)
      VALUES (?, ?, 1, 'approved', ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(emp_id, period) DO NOTHING`)
      .bind(emp, period, checked.data, checked.count, t, 'Nhập từ Theo dõi giờ công', t, 'Nhập lịch sử · ' + by_, t));
    const wbs = projectWbs(entries);
    if (wbs.length) stmts.push(env.DB.prepare(`INSERT OR IGNORE INTO ts_doc_wbs (emp_id, period, wbs) VALUES ${wbs.map(() => '(?, ?, ?)').join(', ')}`).bind(...wbs.flatMap(w => [emp, period, w])));
    total += entries.length;
  }
  for (let i = 0; i < stmts.length; i += 40) await env.DB.batch(stmts.slice(i, i + 40));
  await h.audit(env, me, 'ts_history_import', 'ts_doc', period, undefined, { employees: take.length, rows: total });
  return h.json({ ok: true, period, imported: by.size, rows: total, remaining: todo.length - take.length });
}

// POST /api/ts/import {items:[{empId, period, sch?, entries:[…đủ bd + cat…]}]} — nhập hộ rồi bắt đầu quy trình duyệt từ đầu
async function importDocs(h, env, me, request) {
  h.need(me, 'sitesup', 'pm', 'projadmin');
  const body = await h.readJson(request);
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length || items.length > 10) throw new h.HttpError(400, 'Mỗi lần nhập tối đa 10 bảng công (mỗi nhân viên một bảng)');
  const out = [];
  for (const it of items) {
    const empId = h.str(it && it.empId, 50), period = String((it && it.period) || '');
    const res = { empId, period, ok: false };
    out.push(res);
    try {
      if (!PERIOD_RE.test(period)) throw new h.HttpError(400, 'Kỳ lương không hợp lệ');
      const owner = await env.DB.prepare('SELECT emp_id, full_name FROM employees WHERE emp_id = ?').bind(empId).first();
      if (!owner) throw new h.HttpError(404, `Mã nhân viên ${empId} chưa có trong EE Data — nhờ Admin đưa nhân viên lên trước`);
      res.name = owner.full_name;
      const entries = Array.isArray(it.entries) ? it.entries : [];
      let checked;
      try { checked = checkDoc(period, { entries, deleted: {}, sch: it.sch }); } catch (e) { throw new h.HttpError(400, e.message); }
      const clean = JSON.parse(checked.data).entries;
      const bad = checkSubmitEntries(clean);
      if (bad) throw new h.HttpError(400, bad);
      const cur = await env.DB.prepare('SELECT version, status FROM ts_docs WHERE emp_id = ? AND period = ?').bind(empId, period).first();
      if (cur && !['draft', 'rejected'].includes(cur.status)) throw new h.HttpError(409, `Bảng công kỳ ${period} của ${owner.full_name} đã nộp / đang duyệt (${cur.status}) — không ghi đè`);
      const t = h.now();
      const saver = 'Nhập hộ · ' + me.name;
      let version;
      if (cur) {
        const r = await env.DB.prepare("UPDATE ts_docs SET version = version + 1, data = ?, entry_count = ?, saved_at = ?, saved_by = ? WHERE emp_id = ? AND period = ? AND version = ? AND status IN ('draft', 'rejected')")
          .bind(checked.data, checked.count, t, saver, empId, period, cur.version).run();
        if (!(r.meta && r.meta.changes === 1)) throw new h.HttpError(409, 'Bảng công vừa thay đổi — thử lại');
        version = cur.version + 1;
      } else {
        const r = await env.DB.prepare("INSERT INTO ts_docs (emp_id, period, version, status, data, entry_count, saved_at, saved_by) VALUES (?, ?, 1, 'draft', ?, ?, ?, ?) ON CONFLICT(emp_id, period) DO NOTHING")
          .bind(empId, period, checked.data, checked.count, t, saver).run();
        if (!(r.meta && r.meta.changes === 1)) throw new h.HttpError(409, 'Bảng công vừa được tạo — thử lại');
        version = 1;
      }
      const st = await h.startApproval(env, me, empId, period, version, clean, 0);
      await h.audit(env, me, 'ts_import', 'ts_doc', `${empId}:${period}`, undefined, { entries: clean.length, by: me.email });
      res.ok = true; res.status = st.status; res.entries = clean.length;
    } catch (e) { res.error = e && e.status ? e.message : 'Lỗi máy chủ'; if (!(e && e.status)) console.error(e); }
  }
  return h.json({ ok: out.every(x => x.ok), results: out });
}

export async function routeTsImport(h, env, me, path, method, url, request) {
  if (path === '/api/ts/import' && method === 'POST') return importDocs(h, env, me, request);
  if (path === '/api/admin/ts/history' && method === 'GET') return historyInfo(h, env, me, url);
  if (path === '/api/admin/ts/history' && method === 'POST') return importHistory(h, env, me, request);
  return null;
}
