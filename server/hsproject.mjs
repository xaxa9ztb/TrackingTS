// Hồ sơ Dự án — lưu thông tin đã nhập theo dự án (Quản lý dự án, Site Sup, Admin dự án, Admin).
//   GET    /api/hs/projects            danh sách (không kèm data) — bảng tra cứu lịch sử
//   POST   /api/hs/projects            tạo {wbs?, name, customer?, contract?, data} (WBS đã có → trả dự án đó)
//   GET    /api/hs/projects/:id        một dự án (kèm data)
//   PUT    /api/hs/projects/:id        lưu {version, name?, wbs?, customer?, contract?, data} (chống ghi đè bằng version; giống hệt → không ghi)
//   DELETE /api/hs/projects/:id        xoá (Admin hoặc người tạo)
const MAX_DATA = 600000;
const parse = (s) => { try { return JSON.parse(s || '{}'); } catch (e) { return {}; } };
const head = (r) => ({ id: r.id, wbs: r.wbs, name: r.name, customer: r.customer, contract: r.contract, version: r.version,
  createdAt: r.created_at, createdBy: r.created_by, updatedAt: r.updated_at, updatedBy: r.updated_by });

function fields(h, body, cur = {}) {
  const data = body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : parse(cur.data);
  const text = JSON.stringify(data);
  if (text.length > MAX_DATA) throw new h.HttpError(413, 'Dữ liệu hồ sơ dự án quá lớn');
  const pick = (k, n) => (body[k] == null ? (cur[k] || '') : h.str(body[k], n));
  const name = pick('name', 300);
  if (!name) throw new h.HttpError(400, 'Cần nhập tên dự án');
  return { wbs: pick('wbs', 60), name, customer: pick('customer', 300), contract: pick('contract', 120), text };
}

export async function routeHsProject(h, env, me, path, method, request) {
  if (!path.startsWith('/api/hs/projects')) return null;
  h.need(me, 'pm', 'sitesup', 'projadmin');
  const by = me.name || me.email;
  if (path === '/api/hs/projects' && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT id, wbs, name, customer, contract, version, created_at, created_by, updated_at, updated_by FROM hs_projects ORDER BY updated_at DESC LIMIT 1000').all();
    return h.json({ items: results.map(head) });
  }
  if (path === '/api/hs/projects' && method === 'POST') {
    const body = await h.readJson(request);
    const f = fields(h, body);
    if (f.wbs) {
      const ex = await env.DB.prepare('SELECT * FROM hs_projects WHERE wbs = ?').bind(f.wbs).first();
      if (ex) return h.json({ ok: true, existing: true, project: { ...head(ex), data: parse(ex.data) } });
    }
    const t = h.now();
    const r = await env.DB.prepare('INSERT INTO hs_projects (wbs, name, customer, contract, data, version, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?) RETURNING *')
      .bind(f.wbs, f.name, f.customer, f.contract, f.text, t, by, t, by).first();
    return h.json({ ok: true, project: { ...head(r), data: parse(r.data) } });
  }
  const m = path.match(/^\/api\/hs\/projects\/(\d+)$/);
  if (!m) return null;
  const id = Number(m[1]);
  const row = await env.DB.prepare('SELECT * FROM hs_projects WHERE id = ?').bind(id).first();
  if (!row) throw new h.HttpError(404, 'Không có hồ sơ dự án này');
  if (method === 'GET') return h.json({ project: { ...head(row), data: parse(row.data) } });
  if (method === 'PUT') {
    const body = await h.readJson(request);
    if (Number(body.version) !== row.version) throw new h.HttpError(409, 'Hồ sơ dự án vừa được người khác sửa — tải lại để xem bản mới', { version: row.version });
    const f = fields(h, body, row);
    // không đổi gì → không ghi (tiết kiệm lượt ghi D1)
    if (f.text === row.data && f.wbs === row.wbs && f.name === row.name && f.customer === row.customer && f.contract === row.contract)
      return h.json({ ok: true, unchanged: true, project: head(row) });
    const t = h.now();
    const r = await env.DB.prepare('UPDATE hs_projects SET wbs = ?, name = ?, customer = ?, contract = ?, data = ?, version = version + 1, updated_at = ?, updated_by = ? WHERE id = ? AND version = ?')
      .bind(f.wbs, f.name, f.customer, f.contract, f.text, t, by, id, row.version).run();
    if (!(r.meta && r.meta.changes === 1)) throw new h.HttpError(409, 'Hồ sơ dự án vừa được người khác sửa — tải lại để xem bản mới');
    return h.json({ ok: true, project: { ...head({ ...row, wbs: f.wbs, name: f.name, customer: f.customer, contract: f.contract, version: row.version + 1, updated_at: t, updated_by: by }) } });
  }
  if (method === 'DELETE') {
    if (!me.isAdmin && row.created_by !== by) throw new h.HttpError(403, 'Chỉ Admin hoặc người tạo được xoá hồ sơ dự án');
    await env.DB.prepare('DELETE FROM hs_projects WHERE id = ?').bind(id).run();
    await h.audit(env, me, 'hs_project_delete', 'hs_project', String(id), { name: row.name, wbs: row.wbs }, undefined);
    return h.json({ ok: true });
  }
  return null;
}
