// Incentive (thưởng lắp đặt) — chỉ Admin. Giao diện ở tools/incentive/, phần tính toán dùng chung ở tools/incentive/incentive.js.
//   GET    /api/incentive/batches?scheme=swat        danh sách đợt (không kèm dữ liệu)
//   POST   /api/incentive/batches                    tạo đợt {scheme, month, title}
//   GET    /api/incentive/batches/:id                một đợt (kèm data)
//   PUT    /api/incentive/batches/:id                lưu {version, data, status?, title?} (chống ghi đè bằng version)
//   DELETE /api/incentive/batches/:id
//   GET    /api/incentive/history?scheme=swat        các khoản đã chia của các đợt ĐÃ CHỐT (để biết dự án đã trả đợt nào)
//   GET    /api/incentive/hours?wbs=a,b              giờ công theo người của từng dự án (bảng Theo dõi giờ công)
//   POST   /api/incentive/import                     ghi đè các đợt từ file Excel kế toán đã sửa {scheme, sheets:[{month, title, projects}]}
//   POST   /api/incentive/batches/:id/publish        phát hành đợt đã chốt {sendMail} → email chi tiết cho từng người được chia
//   POST   /api/incentive/rename-wbs                 đổi mã WBS (và tên) của một dự án ở MỌI đợt {scheme, from, to, name?, dryRun?}
//   GET    /api/incentive/mine                       (mọi nhân viên) thưởng CỦA MÌNH ở các đợt đã phát hành
//   GET    /api/incentive/mine/:batchId/:wbs         (mọi nhân viên) chi tiết một dự án: báo cáo SWAT + dòng của mình
import Inc from '../tools/incentive/incentive.js';
import { rolesFromPosition } from './roles.mjs';
import { sendMailBatch, mailConfigured, layout, esc } from './mail.mjs';

const SCHEMES = ['swat', 'site'];
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_DATA = 900000;
const parse = (s, d) => { try { return JSON.parse(s); } catch (e) { return d; } };
const fin = (x) => (x == null || x === '' ? null : (Number.isFinite(+x) ? Math.round(+x * 100) / 100 : null));

function needAdmin(h, me) { if (!(me && me.isAdmin)) throw new h.HttpError(403, 'Chỉ Quản trị viên (Admin) dùng được chức năng Incentive'); }
const schemeOf = (h, s) => { s = String(s || 'swat'); if (!SCHEMES.includes(s)) throw new h.HttpError(400, 'Scheme không hợp lệ'); return s; };

// Làm sạch dữ liệu một đợt: giữ các trường của dự án (ảnh chụp Standard Hour / Scorecard…) nhưng kiểm tra phần tiền
function cleanData(h, data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.projects)) throw new h.HttpError(400, 'Dữ liệu đợt thưởng không hợp lệ');
  if (data.projects.length > 200) throw new h.HttpError(400, 'Tối đa 200 dự án một đợt');
  const seen = new Set();
  const projects = data.projects.map((p) => {
    if (!p || typeof p !== 'object') throw new h.HttpError(400, 'Có dự án không hợp lệ');
    const wbs = h.str(p.wbs, 40);
    if (!wbs) throw new h.HttpError(400, 'Dự án thiếu WBS');
    if (seen.has(wbs)) throw new h.HttpError(400, `Dự án ${wbs} bị lặp trong đợt`);
    seen.add(wbs);
    if (!Inc.KINDS[p.kind]) throw new h.HttpError(400, `Dự án ${wbs}: loại trả không hợp lệ`);
    const lines = Array.isArray(p.lines) ? p.lines : [];
    if (lines.length > 80) throw new h.HttpError(400, `Dự án ${wbs}: quá nhiều người`);
    return { ...p, wbs, name: h.str(p.name, 300), kind: p.kind,
      lines: lines.map(l => {
        const amount = fin(l && l.amount);
        if (amount == null) throw new h.HttpError(400, `Dự án ${wbs}: có dòng thiếu số tiền`);
        return { ...l, role: l.role === 'sup' ? 'sup' : 'fitter', empId: h.str(l.empId, 20), name: h.str(l.name, 120), amount,
          hours: fin(l.hours), pct: l.pct == null ? null : Number(l.pct) || 0, total: fin(l.total), before: fin(l.before), manual: !!l.manual };
      }) };
  });
  const out = { ...data, projects };
  const text = JSON.stringify(out);
  if (text.length > MAX_DATA) throw new h.HttpError(413, 'Dữ liệu đợt thưởng quá lớn');
  return { data: out, text, total: Math.round(projects.reduce((s, p) => s + p.lines.reduce((a, l) => a + l.amount, 0), 0) * 100) / 100 };
}

function lineStmts(env, id, projects) {
  const stmts = [env.DB.prepare('DELETE FROM inc_lines WHERE batch_id = ?').bind(id)];
  const rows = projects.flatMap(p => p.lines.map(l => [id, p.wbs, p.name || '', p.kind, l.role, l.empId || '', l.name || '', l.amount, l.pct == null ? null : l.pct]));
  for (let i = 0; i < rows.length; i += 10) {
    const c = rows.slice(i, i + 10);
    stmts.push(env.DB.prepare(`INSERT INTO inc_lines (batch_id, wbs, project_name, kind, role, emp_id, name, amount, pct) VALUES ${c.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`).bind(...c.flat()));
  }
  return stmts;
}
const head = (r) => ({ id: r.id, scheme: r.scheme, month: r.month, title: r.title, status: r.status, source: r.source, total: r.total, projects: r.n_projects,
  version: r.version, createdAt: r.created_at, createdBy: r.created_by, updatedAt: r.updated_at, updatedBy: r.updated_by,
  publishedAt: r.published_at || '', publishedBy: r.published_by || '' });

async function listBatches(h, env, me, url) {
  needAdmin(h, me);
  const scheme = schemeOf(h, url.searchParams.get('scheme'));
  const { results } = await env.DB.prepare('SELECT id, scheme, month, title, status, source, total, n_projects, version, created_at, created_by, updated_at, updated_by, published_at, published_by FROM inc_batches WHERE scheme = ? ORDER BY month DESC LIMIT 200').bind(scheme).all();
  return h.json({ batches: results.map(head) });
}

async function getBatch(h, env, me, id) {
  needAdmin(h, me);
  const r = await env.DB.prepare('SELECT * FROM inc_batches WHERE id = ?').bind(id).first();
  if (!r) throw new h.HttpError(404, 'Không có đợt thưởng này');
  return h.json({ ...head(r), data: parse(r.data, { projects: [] }) });
}

async function createBatch(h, env, me, request) {
  needAdmin(h, me);
  const body = await h.readJson(request);
  const scheme = schemeOf(h, body.scheme), month = String(body.month || '');
  if (!MONTH_RE.test(month)) throw new h.HttpError(400, 'Tháng không hợp lệ (dạng YYYY-MM)');
  const title = h.str(body.title, 200);
  const t = h.now();
  const r = await env.DB.prepare("INSERT INTO inc_batches (scheme, month, title, status, source, data, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, 'draft', 'app', '{\"projects\":[]}', ?, ?, ?, ?) ON CONFLICT(scheme, month) DO NOTHING")
    .bind(scheme, month, title, t, me.name || me.email, t, me.name || me.email).run();
  if (!(r.meta && r.meta.changes === 1)) throw new h.HttpError(409, `Đã có đợt thưởng tháng ${month.slice(5)}/${month.slice(0, 4)} — mở đợt đó để làm tiếp`);
  const row = await env.DB.prepare('SELECT * FROM inc_batches WHERE scheme = ? AND month = ?').bind(scheme, month).first();
  await h.audit(env, me, 'inc_create', 'inc_batch', String(row.id), undefined, { scheme, month });
  return h.json({ ...head(row), data: { projects: [] } });
}

async function putBatch(h, env, me, id, request) {
  needAdmin(h, me);
  const body = await h.readJson(request);
  const row = await env.DB.prepare('SELECT * FROM inc_batches WHERE id = ?').bind(id).first();
  if (!row) throw new h.HttpError(404, 'Không có đợt thưởng này');
  if (Number(body.version) !== row.version) throw new h.HttpError(409, 'Đợt thưởng vừa được sửa ở nơi khác — tải lại trang để xem bản mới', { version: row.version });
  const { data, text, total } = cleanData(h, body.data);
  const status = body.status === 'done' ? 'done' : body.status === 'draft' ? 'draft' : row.status;
  const title = body.title == null ? row.title : h.str(body.title, 200);
  const t = h.now();
  const upd = env.DB.prepare('UPDATE inc_batches SET data = ?, total = ?, n_projects = ?, status = ?, title = ?, version = version + 1, updated_at = ?, updated_by = ? WHERE id = ? AND version = ?')
    .bind(text, total, data.projects.length, status, title, t, me.name || me.email, id, row.version);
  const res = await env.DB.batch([upd, ...lineStmts(env, id, data.projects)]);
  if (!(res[0].meta && res[0].meta.changes === 1)) throw new h.HttpError(409, 'Đợt thưởng vừa được sửa ở nơi khác — tải lại trang');
  if (status !== row.status) await h.audit(env, me, status === 'done' ? 'inc_done' : 'inc_reopen', 'inc_batch', String(id), { status: row.status }, { status, total });
  return h.json({ ok: true, id, version: row.version + 1, status, total, updatedAt: t });
}

async function deleteBatch(h, env, me, id) {
  needAdmin(h, me);
  const row = await env.DB.prepare('SELECT id, month, scheme, total FROM inc_batches WHERE id = ?').bind(id).first();
  if (!row) throw new h.HttpError(404, 'Không có đợt thưởng này');
  await env.DB.batch([env.DB.prepare('DELETE FROM inc_lines WHERE batch_id = ?').bind(id), env.DB.prepare('DELETE FROM inc_batches WHERE id = ?').bind(id)]);
  await h.audit(env, me, 'inc_delete', 'inc_batch', String(id), { month: row.month, scheme: row.scheme, total: row.total }, undefined);
  return h.json({ ok: true });
}

// Các khoản đã chia của các đợt ĐÃ CHỐT: [{batchId, month, wbs, name, kind, lines:[{role, empId, name, amount, pct}]}]
async function history(h, env, me, url) {
  needAdmin(h, me);
  const scheme = schemeOf(h, url.searchParams.get('scheme'));
  const { results } = await env.DB.prepare(`SELECT l.batch_id, b.month, l.wbs, l.project_name, l.kind, l.role, l.emp_id, l.name, l.amount, l.pct
      FROM inc_lines l JOIN inc_batches b ON b.id = l.batch_id WHERE b.scheme = ? AND b.status = 'done' ORDER BY b.month, l.wbs`).bind(scheme).all();
  const map = new Map();
  for (const r of results) {
    const k = r.batch_id + '|' + r.wbs;
    if (!map.has(k)) map.set(k, { batchId: r.batch_id, month: r.month, wbs: r.wbs, name: r.project_name, kind: r.kind, lines: [] });
    map.get(k).lines.push({ role: r.role, empId: r.emp_id, name: r.name, amount: r.amount, pct: r.pct });
  }
  return h.json({ items: [...map.values()] });
}

// Giờ công theo người của từng dự án, lấy từ bảng Theo dõi giờ công (đợt dữ liệu đang dùng)
async function hours(h, env, me, url) {
  needAdmin(h, me);
  const list = [...new Set(String(url.searchParams.get('wbs') || '').split(',').map(x => x.trim()).filter(Boolean))].slice(0, 60);
  if (!list.length) return h.json({ projects: [] });
  const { meta } = await h.tsMetaRow(env);
  const ph = list.map(() => '?').join(', ');
  const rows = meta.active ? (await env.DB.prepare(`SELECT wbs, emp_id, MAX(json_extract(data, '$.empName')) AS name, SUM(json_extract(data, '$.total')) AS hours
      FROM timesheets WHERE batch = ? AND wbs IN (${ph}) GROUP BY wbs, emp_id`).bind(meta.active, ...list).all()).results : [];
  const emps = rows.length ? (await env.DB.prepare(`SELECT emp_id, full_name, position FROM employees WHERE emp_id IN (${[...new Set(rows.map(r => r.emp_id))].map(() => '?').join(', ')})`)
    .bind(...new Set(rows.map(r => r.emp_id))).all()).results : [];
  const byEmp = new Map(emps.map(e => [e.emp_id, e]));
  return h.json({ projects: list.map(w => {
    const people = rows.filter(r => r.wbs === w).map(r => {
      const e = byEmp.get(r.emp_id) || {};
      const roles = rolesFromPosition(e.position || '');
      return { empId: r.emp_id, name: e.full_name || r.name || r.emp_id, position: e.position || '', hours: Math.round((Number(r.hours) || 0) * 100) / 100,
        role: roles.includes('sitesup') || roles.includes('pm') ? 'sup' : 'fitter' };
    }).sort((a, b) => b.hours - a.hours);
    return { wbs: w, total: Math.round(people.reduce((s, p) => s + p.hours, 0) * 100) / 100, people };
  }) });
}

// Ghi đè từ file Excel (kế toán đã sửa): mỗi sheet = một đợt theo tháng. Đợt đã có → thay phần chia tiền của các dự án
// (giữ ảnh chụp Standard Hour / Scorecard của dự án trùng WBS); chưa có → tạo đợt mới. Các đợt nhập vào coi như đã chốt.
async function importSheets(h, env, me, request) {
  needAdmin(h, me);
  const body = await h.readJson(request);
  const scheme = schemeOf(h, body.scheme);
  const sheets = Array.isArray(body.sheets) ? body.sheets : [];
  if (!sheets.length) throw new h.HttpError(400, 'Không có đợt nào để nhập');
  if (sheets.length > 40) throw new h.HttpError(400, 'Tối đa 40 đợt mỗi lần nhập');
  const months = new Set();
  const out = [];
  for (const s of sheets) {
    const month = String(s && s.month || '');
    if (!MONTH_RE.test(month)) throw new h.HttpError(400, 'Có sheet không xác định được tháng');
    if (months.has(month)) throw new h.HttpError(400, `Tháng ${month} xuất hiện hai lần trong file`);
    months.add(month);
    const row = await env.DB.prepare('SELECT * FROM inc_batches WHERE scheme = ? AND month = ?').bind(scheme, month).first();
    const old = row ? parse(row.data, { projects: [] }) : { projects: [] };
    const oldBy = new Map((old.projects || []).map(p => [p.wbs, p]));
    const projects = (Array.isArray(s.projects) ? s.projects : []).map(p => {
      const prev = oldBy.get(String(p.wbs)) || {};
      return { ...prev, wbs: String(p.wbs), name: p.name || prev.name || '', projectNumber: p.projectNumber || prev.projectNumber || '', units: p.units || prev.units || 1,
        stops: p.stops || prev.stops || null, product: p.product || prev.product || '', kind: p.kind, rate: p.rate == null ? null : p.rate, note: p.note || '',
        lines: p.lines, imported: true };
    });
    const { data, text, total } = cleanData(h, { ...old, projects, importedAt: h.now(), importedFrom: h.str(s.sheet, 60) });
    const t = h.now();
    let id;
    if (row) {
      await env.DB.prepare("UPDATE inc_batches SET data = ?, total = ?, n_projects = ?, status = 'done', source = 'import', title = ?, version = version + 1, updated_at = ?, updated_by = ? WHERE id = ?")
        .bind(text, total, data.projects.length, h.str(s.title, 200) || row.title, t, me.name || me.email, row.id).run();
      id = row.id;
    } else {
      await env.DB.prepare("INSERT INTO inc_batches (scheme, month, title, status, source, data, total, n_projects, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, 'done', 'import', ?, ?, ?, ?, ?, ?, ?)")
        .bind(scheme, month, h.str(s.title, 200), text, total, data.projects.length, t, me.name || me.email, t, me.name || me.email).run();
      id = (await env.DB.prepare('SELECT id FROM inc_batches WHERE scheme = ? AND month = ?').bind(scheme, month).first()).id;
    }
    await env.DB.batch(lineStmts(env, id, data.projects));
    out.push({ id, month, projects: data.projects.length, total, replaced: !!row, before: row ? row.total : null });
  }
  await h.audit(env, me, 'inc_import', 'inc_batch', [...months].join(',').slice(0, 300), undefined, { scheme, batches: out.map(o => ({ month: o.month, total: o.total, replaced: o.replaced })) });
  return h.json({ ok: true, batches: out });
}

// ---------- phát hành + "Thưởng của tôi" ----------
const ml = (m) => `${m.slice(5, 7)}/${m.slice(0, 4)}`;
const vnd = (n) => Math.round(Number(n) || 0).toLocaleString('vi-VN');
const appLink = (env, path) => (env.APP_URL ? String(env.APP_URL).replace(/\/+$/, '') + path : '');
// phần CÔNG KHAI của một dự án trong đợt (không có dòng của người khác)
function publicProject(p) {
  const sw = p.swat || {};
  return { wbs: p.wbs, name: p.name || '', projectNumber: p.projectNumber || '', product: p.product || '', units: p.units || 1, stops: p.stops || null,
    kind: p.kind, kindLabel: (Inc.KINDS[p.kind] || {}).label || '', rate: (Inc.KINDS[p.kind] || {}).rate || null, fundF: p.fundF == null ? null : Number(p.fundF), fundS: p.fundS == null ? null : Number(p.fundS),
    std: sw.std || null, sc: sw.sc ? { act: sw.sc.act, std: sw.sc.std, reserve: sw.sc.reserve, save: sw.sc.save, block: sw.sc.block, fs: sw.sc.fs, ss: sw.sc.ss, bf: sw.sc.bf, bs: sw.sc.bs, pf: sw.sc.pf, ps: sw.sc.ps, crit: sw.sc.crit } : null,
    hasSwat: !!sw.state, imported: !!p.imported,
    fitterHours: (p.lines || []).filter(l => l.role === 'fitter').reduce((a, l) => a + (Number(l.hours) || 0), 0) || null };
}
const myLine = (l) => ({ role: l.role, name: l.name, amount: l.amount, hours: l.hours == null ? null : l.hours, pct: l.pct == null ? null : l.pct, total: l.total == null ? null : l.total, before: l.before == null ? null : l.before });

async function publish(h, env, me, id, request) {
  needAdmin(h, me);
  const body = await h.readJson(request);
  const row = await env.DB.prepare('SELECT * FROM inc_batches WHERE id = ?').bind(id).first();
  if (!row) throw new h.HttpError(404, 'Không có đợt thưởng này');
  if (row.status !== 'done') throw new h.HttpError(409, 'Chốt đợt trước rồi mới phát hành');
  const t = row.published_at || h.now();
  if (!row.published_at) await env.DB.prepare('UPDATE inc_batches SET published_at = ?, published_by = ? WHERE id = ?').bind(t, me.name || me.email, id).run();
  const data = parse(row.data, { projects: [] });
  // dòng của từng người (theo Mã NV); dòng không có Mã NV thì không gửi được
  const byEmp = new Map(), noId = new Set();
  data.projects.forEach(p => (p.lines || []).forEach(l => {
    if (!(Number(l.amount) || 0)) return;
    if (!l.empId) { noId.add(l.name); return; }
    if (!byEmp.has(l.empId)) byEmp.set(l.empId, []);
    byEmp.get(l.empId).push({ p, l });
  }));
  const out = { ok: true, publishedAt: t, people: byEmp.size, sent: 0, failed: 0, noEmail: [], noId: [...noId], mail: !!body.sendMail };
  if (body.sendMail && byEmp.size) {
    if (!h.mailConfigured(env)) throw new h.HttpError(503, 'Chưa cấu hình gửi email (BREVO_API_KEY, MAIL_FROM) — bỏ chọn "Gửi email" để chỉ phát hành');
    const ids = [...byEmp.keys()];
    const emps = [];
    for (let i = 0; i < ids.length; i += 80) emps.push(...(await env.DB.prepare(`SELECT emp_id, full_name, email, active FROM employees WHERE emp_id IN (${ids.slice(i, i + 80).map(() => '?').join(', ')})`).bind(...ids.slice(i, i + 80)).all()).results);
    const empBy = new Map(emps.map(e => [e.emp_id, e]));
    const link = appLink(env, `/tools/mybonus/#dot=${id}`);
    const items = [];
    for (const [empId, list] of byEmp) {
      const e = empBy.get(empId);
      if (!e || !e.email || e.active === 0) { out.noEmail.push(list[0].l.name); continue; }
      const total = list.reduce((a, x) => a + (Number(x.l.amount) || 0), 0);
      const rows = list.map(({ p, l }) => `<tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${esc(p.name)}<br><span style="color:#6b7280;font-size:12px">WBS ${esc(p.wbs)} · ${esc((Inc.KINDS[p.kind] || {}).label || '')}</span></td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${l.role === 'sup' ? 'Site-sup' : 'Fitter'}${l.role === 'fitter' && l.pct != null ? `<br><span style="color:#6b7280;font-size:12px">${(Math.round(l.pct * 1000) / 10).toLocaleString('vi-VN')}% giờ công${l.hours != null ? ` (${l.hours} giờ)` : ''}</span>` : ''}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap"><b>${vnd(l.amount)} đ</b>${l.before ? `<br><span style="color:#6b7280;font-size:12px">tổng ${vnd(l.total)} − đã nhận ${vnd(l.before)}</span>` : ''}</td></tr>`).join('');
      items.push({ to: { email: e.email, name: e.full_name },
        subject: `[Thưởng lắp đặt] Thưởng SWAT đợt ${ml(row.month)} của bạn: ${vnd(total)} đ`,
        html: layout(`Thưởng lắp đặt SWAT — đợt ${ml(row.month)}`, `<p>Chào ${esc(e.full_name)}, bạn được chia thưởng lắp đặt (Installation Incentive Scheme — SWAT) ở <b>${list.length} dự án</b>, tổng <b>${vnd(total)} đ</b>:</p>
          <table style="border-collapse:collapse;width:100%;font-size:13px"><thead><tr style="background:#f3f4f6"><th style="padding:6px 8px;text-align:left">Dự án</th><th style="padding:6px 8px;text-align:left">Vai trò</th><th style="padding:6px 8px;text-align:right">Tiền thưởng</th></tr></thead>
          <tbody>${rows}</tbody><tfoot><tr><td colspan="2" style="padding:6px 8px"><b>Tổng</b></td><td style="padding:6px 8px;text-align:right"><b>${vnd(total)} đ</b></td></tr></tfoot></table>
          <p style="color:#6b7280;font-size:12px">Fitter chia theo % giờ công trên dự án; số tiền thực nhận theo kỳ lương do kế toán chi trả. Thắc mắc liên hệ quản trị viên.</p>
          <p>Mở app → <b>Thưởng của tôi</b> để xem chi tiết từng dự án và báo cáo SWAT (Standard Hour, Scorecard) của dự án.</p>`, link ? { url: link, label: 'Xem thưởng của tôi' } : null) });
    }
    if (items.length) { const r = await sendMailBatch(env, items); out.sent = r.sent; out.failed = r.failed; if (r.errors.length) out.error = r.errors[0]; }
  }
  await h.audit(env, me, 'inc_publish', 'inc_batch', String(id), undefined, { month: row.month, mail: out.mail, sent: out.sent, noEmail: out.noEmail.length });
  return h.json(out);
}

// Thưởng của tôi: chỉ các đợt ĐÃ CHỐT + ĐÃ PHÁT HÀNH, chỉ các dòng mang Mã NV của người đăng nhập
async function mine(h, env, me) {
  if (!me.empId) return h.json({ batches: [], note: 'Tài khoản chưa gắn với nhân viên nào' });
  const { results } = await env.DB.prepare(`SELECT l.batch_id, l.wbs, b.month, b.title, b.scheme, b.published_at FROM inc_lines l JOIN inc_batches b ON b.id = l.batch_id
      WHERE l.emp_id = ? AND b.status = 'done' AND b.published_at <> '' GROUP BY l.batch_id, l.wbs ORDER BY b.month DESC`).bind(me.empId).all();
  const ids = [...new Set(results.map(r => r.batch_id))].slice(0, 60);
  const out = [];
  for (const id of ids) {
    const b = await env.DB.prepare('SELECT id, scheme, month, title, published_at, data FROM inc_batches WHERE id = ?').bind(id).first();
    const data = parse(b.data, { projects: [] });
    const projects = data.projects.map(p => {
      const mineL = (p.lines || []).filter(l => l.empId === me.empId);
      return mineL.length ? { ...publicProject(p), lines: mineL.map(myLine), amount: Math.round(mineL.reduce((a, l) => a + (Number(l.amount) || 0), 0) * 100) / 100 } : null;
    }).filter(Boolean);
    if (projects.length) out.push({ id: b.id, scheme: b.scheme, month: b.month, title: b.title, publishedAt: b.published_at, projects, total: Math.round(projects.reduce((a, p) => a + p.amount, 0) * 100) / 100 });
  }
  return h.json({ empId: me.empId, name: me.name, batches: out });
}
async function mineDetail(h, env, me, id, wbs) {
  if (!me.empId) throw new h.HttpError(403, 'Tài khoản chưa gắn với nhân viên nào');
  const b = await env.DB.prepare("SELECT id, month, title, data FROM inc_batches WHERE id = ? AND status = 'done' AND published_at <> ''").bind(id).first();
  const p = b && parse(b.data, { projects: [] }).projects.find(x => x.wbs === wbs);
  const mineL = p ? (p.lines || []).filter(l => l.empId === me.empId) : [];
  if (!mineL.length) throw new h.HttpError(404, 'Không có thưởng của bạn ở dự án này');
  return h.json({ batch: { id: b.id, month: b.month, title: b.title }, project: { ...publicProject(p), lines: mineL.map(myLine) }, swatState: (p.swat && p.swat.state) || null });
}

// Sửa mã WBS bị nhầm ở các đợt (thường từ file Excel cũ): đổi `from` → `to` (và tên dự án nếu có) trong dữ liệu mọi đợt của scheme,
// dựng lại inc_lines (báo cáo, lịch sử "đã trả", Thưởng của tôi đọc từ đây). dryRun → chỉ báo đợt / dòng sẽ đổi.
// Một đợt mà đã có sẵn dự án `to` → không gộp tự động, báo lại để Admin mở đợt đó sửa tay.
async function renameWbs(h, env, me, request) {
  needAdmin(h, me);
  const body = await h.readJson(request);
  const scheme = schemeOf(h, body.scheme);
  const from = h.str(body.from, 40), to = h.str(body.to, 40), name = h.str(body.name, 300);
  if (!from || !to) throw new h.HttpError(400, 'Cần nhập mã WBS cũ và mã WBS mới');
  if (from === to && !name) throw new h.HttpError(400, 'Mã WBS mới trùng mã cũ');
  const { results } = await env.DB.prepare('SELECT id, month, status, version, data FROM inc_batches WHERE scheme = ? ORDER BY month').bind(scheme).all();
  const hits = [], conflicts = [];
  for (const r of results) {
    const data = parse(r.data, { projects: [] });
    const p = (data.projects || []).find(x => String(x.wbs) === from);
    if (!p) continue;
    if (from !== to && data.projects.some(x => String(x.wbs) === to)) { conflicts.push({ id: r.id, month: r.month }); continue; }
    hits.push({ r, data, p, lines: (p.lines || []).length, oldName: p.name || '' });
  }
  const summary = { from, to, batches: hits.map(x => ({ id: x.r.id, month: x.r.month, status: x.r.status, lines: x.lines, name: x.oldName })), conflicts };
  if (body.dryRun) return h.json({ ok: true, dryRun: true, ...summary });
  const t = h.now(), by = me.name || me.email;
  for (const x of hits) {
    x.p.wbs = to; if (name) x.p.name = name;
    const text = JSON.stringify(x.data);
    const upd = env.DB.prepare('UPDATE inc_batches SET data = ?, version = version + 1, updated_at = ?, updated_by = ? WHERE id = ? AND version = ?').bind(text, t, by, x.r.id, x.r.version);
    const res = await env.DB.batch([upd, ...lineStmts(env, x.r.id, x.data.projects)]);
    if (!(res[0].meta && res[0].meta.changes === 1)) throw new h.HttpError(409, `Đợt ${x.r.month} vừa được sửa ở nơi khác — tải lại rồi làm lại`);
  }
  await h.audit(env, me, 'inc_rename_wbs', 'inc_batch', scheme, { wbs: from }, { wbs: to, name, batches: hits.map(x => x.r.month) });
  return h.json({ ok: true, ...summary });
}

export async function routeIncentive(h, env, me, path, method, url, request) {
  let m;
  if (path === '/api/incentive/mine' && method === 'GET') return mine(h, env, me);
  if ((m = path.match(/^\/api\/incentive\/mine\/(\d+)\/([^/]+)$/)) && method === 'GET') return mineDetail(h, env, me, Number(m[1]), decodeURIComponent(m[2]));
  if ((m = path.match(/^\/api\/incentive\/batches\/(\d+)\/publish$/)) && method === 'POST') return publish(h, env, me, Number(m[1]), request);
  if (path === '/api/incentive/batches' && method === 'GET') return listBatches(h, env, me, url);
  if (path === '/api/incentive/batches' && method === 'POST') return createBatch(h, env, me, request);
  if ((m = path.match(/^\/api\/incentive\/batches\/(\d+)$/))) {
    const id = Number(m[1]);
    if (method === 'GET') return getBatch(h, env, me, id);
    if (method === 'PUT') return putBatch(h, env, me, id, request);
    if (method === 'DELETE') return deleteBatch(h, env, me, id);
  }
  if (path === '/api/incentive/history' && method === 'GET') return history(h, env, me, url);
  if (path === '/api/incentive/hours' && method === 'GET') return hours(h, env, me, url);
  if (path === '/api/incentive/import' && method === 'POST') return importSheets(h, env, me, request);
  if (path === '/api/incentive/rename-wbs' && method === 'POST') return renameWbs(h, env, me, request);
  return null;
}
