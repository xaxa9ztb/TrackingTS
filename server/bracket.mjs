// Khảo sát Bracket hố thang — phiếu lưu trên máy chủ, mọi người dùng đăng nhập đều xem được.
//   GET    /api/bracket/surveys        danh sách (kèm data — phiếu nhỏ, tối đa 60 vị trí)
//   POST   /api/bracket/surveys        tạo {data} (data.id đã có trên máy chủ → trả phiếu đó, không tạo trùng)
//   GET    /api/bracket/surveys/:id    một phiếu
//   PUT    /api/bracket/surveys/:id    lưu {version, data} — chống ghi đè bằng version; giống hệt → không ghi
//   DELETE /api/bracket/surveys/:id    xoá
// Quyền sửa / xoá: người tạo phiếu và Admin; người khác chỉ xem.
const MAX_DATA = 60000;
const parse = (s) => { try { return JSON.parse(s || '{}'); } catch (e) { return {}; } };
const lc = (s) => String(s || '').trim().toLowerCase();
// chủ phiếu theo mã nhân viên (ổn định, đúng cả khi đổi vai ở Demo); không có mã NV thì theo email
const ownerKey = (me) => lc(me.empId ? 'emp:' + me.empId : me.email);
const isOwner = (me, r) => !!r.owner_key && (lc(r.owner_key) === ownerKey(me) || lc(r.owner_key) === lc(me.email));
const canEdit = (me, r) => !!me.isAdmin || isOwner(me, r);
const out = (r, me) => ({ id: r.id, cid: r.cid, version: r.version, createdAt: r.created_at, createdBy: r.created_by,
  updatedAt: r.updated_at, updatedBy: r.updated_by, mine: isOwner(me, r), canEdit: canEdit(me, r), data: parse(r.data) });

function fields(h, body) {
  const d = body.data;
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw new h.HttpError(400, 'Thiếu dữ liệu phiếu khảo sát');
  if (d.rows != null && !Array.isArray(d.rows)) throw new h.HttpError(400, 'Danh sách vị trí không hợp lệ');
  const text = JSON.stringify(d);
  if (text.length > MAX_DATA) throw new h.HttpError(413, 'Phiếu khảo sát quá lớn');
  return { cid: h.str(d.id, 40), project: h.str(d.project, 200), lift: h.str(d.liftId, 60), date: h.str(d.date, 10), text };
}

export async function routeBracket(h, env, me, path, method, request) {
  if (!path.startsWith('/api/bracket/surveys')) return null;
  const by = me.name || me.email;
  if (path === '/api/bracket/surveys' && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM bracket_surveys ORDER BY updated_at DESC LIMIT 1000').all();
    return h.json({ items: results.map(r => out(r, me)) });
  }
  if (path === '/api/bracket/surveys' && method === 'POST') {
    const f = fields(h, await h.readJson(request));
    if (f.cid) {
      const ex = await env.DB.prepare('SELECT * FROM bracket_surveys WHERE cid = ?').bind(f.cid).first();
      if (ex) return h.json({ ok: true, existing: true, survey: out(ex, me) });
    }
    const t = h.now();
    const r = await env.DB.prepare('INSERT INTO bracket_surveys (cid, project, lift_id, survey_date, data, version, owner_key, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?) RETURNING *')
      .bind(f.cid, f.project, f.lift, f.date, f.text, ownerKey(me), t, by, t, by).first();
    return h.json({ ok: true, survey: out(r, me) });
  }
  const m = path.match(/^\/api\/bracket\/surveys\/(\d+)$/);
  if (!m) return null;
  const id = Number(m[1]);
  const row = await env.DB.prepare('SELECT * FROM bracket_surveys WHERE id = ?').bind(id).first();
  if (!row) throw new h.HttpError(404, 'Phiếu khảo sát này không còn (có thể đã bị xoá)');
  if (method === 'GET') return h.json({ survey: out(row, me) });
  if (method === 'PUT') {
    if (!canEdit(me, row)) throw new h.HttpError(403, `Phiếu của ${row.created_by || 'người khác'} — bạn chỉ được xem. Chỉ người tạo phiếu và Admin được sửa.`);
    const body = await h.readJson(request);
    if (Number(body.version) !== row.version) throw new h.HttpError(409, 'Phiếu vừa được sửa ở nơi khác — tải lại để xem bản mới', { version: row.version });
    const f = fields(h, body);
    if (f.text === row.data) return h.json({ ok: true, unchanged: true, survey: out(row, me) });
    const t = h.now();
    const r = await env.DB.prepare('UPDATE bracket_surveys SET project = ?, lift_id = ?, survey_date = ?, data = ?, version = version + 1, updated_at = ?, updated_by = ? WHERE id = ? AND version = ?')
      .bind(f.project, f.lift, f.date, f.text, t, by, id, row.version).run();
    if (!(r.meta && r.meta.changes === 1)) throw new h.HttpError(409, 'Phiếu vừa được sửa ở nơi khác — tải lại để xem bản mới');
    return h.json({ ok: true, survey: out({ ...row, project: f.project, lift_id: f.lift, survey_date: f.date, data: f.text, version: row.version + 1, updated_at: t, updated_by: by }, me) });
  }
  if (method === 'DELETE') {
    if (!canEdit(me, row)) throw new h.HttpError(403, 'Chỉ người tạo phiếu và Admin được xoá');
    await env.DB.prepare('DELETE FROM bracket_surveys WHERE id = ?').bind(id).run();
    await h.audit(env, me, 'bracket_delete', 'bracket_survey', String(id), { project: row.project, liftId: row.lift_id, by: row.created_by }, undefined);
    return h.json({ ok: true });
  }
  return null;
}
