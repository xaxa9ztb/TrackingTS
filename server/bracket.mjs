// Khảo sát Bracket hố thang — phiếu lưu trên máy chủ, mọi người dùng đăng nhập đều xem được.
//   GET    /api/bracket/surveys        danh sách (kèm data — phiếu nhỏ, tối đa 60 vị trí)
//   POST   /api/bracket/surveys        tạo {data} (data.id đã có trên máy chủ → trả phiếu đó, không tạo trùng)
//   GET    /api/bracket/surveys/:id    một phiếu
//   PUT    /api/bracket/surveys/:id    lưu {version, data} — chống ghi đè bằng version; giống hệt → không ghi
//   DELETE /api/bracket/surveys/:id    xoá
// Quyền sửa / xoá: người tạo phiếu và Admin; người khác chỉ xem.
//
// Danh mục bracket (tab Tra dung sai) — mọi người dùng đăng nhập xem:
//   GET    /api/bracket/catalog              { info: {tên: {orderId, note, updatedAt, updatedBy}}, files: {tên: [...]}, canEditId }
//   PUT    /api/bracket/catalog/:tên         {orderId, note} — Admin / Quản lý dự án / Admin dự án (ghi nhật ký)
//   POST   /api/bracket/files?bracket=&name= thân yêu cầu = nội dung file (≤ 10 MB; PDF, ảnh, DWG/DXF) — mọi người dùng
//   GET    /api/bracket/files/:id            tải / xem file
//   DELETE /api/bracket/files/:id            người đính kèm hoặc Admin
//   POST   /api/bracket/catalog/import       {items:[{name, orderId, note}]} — nhập ID hàng loạt (người sửa được ID)
// Tài liệu tham chiếu (bracket = '#docs', VD tài liệu Selection Rule gốc): chỉ Site Sup / Quản lý dự án / Admin dự án / Admin
// xem được; chỉ Admin tải lên / xoá; PDF ≤ 25 MB.
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

const MAX_FILE = 10 * 1024 * 1024, CHUNK = 900 * 1024;
const FILE_TYPES = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', dwg: 'application/acad', dxf: 'image/vnd.dxf' };
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 ./_()-]{0,59}$/;          // tên loại bracket (VD Z-CL3, O-A1 / O-A2  106-1)
const canEditId = (me) => !!(me.isAdmin || me.isProjAdmin || me.roles.includes('pm'));
const DOCS = '#docs', MAX_DOC = 25 * 1024 * 1024;
const canReadDocs = (me) => !!(me.isAdmin || me.isProjAdmin || me.roles.includes('pm') || me.roles.includes('sitesup'));
const fileOut = (f, me) => ({ id: f.id, name: f.file_name, mime: f.mime, size: f.size, createdAt: f.created_at, createdBy: f.created_by,
  canDelete: !!me.isAdmin || (!!f.owner_key && lc(f.owner_key) === ownerKey(me)) });

async function routeCatalog(h, env, me, path, method, request) {
  const by = me.name || me.email;
  if (path === '/api/bracket/catalog' && method === 'GET') {
    const [a, b] = await Promise.all([
      env.DB.prepare('SELECT * FROM bracket_info').all(),
      env.DB.prepare('SELECT id, bracket, file_name, mime, size, owner_key, created_at, created_by FROM bracket_files ORDER BY id').all(),
    ]);
    const info = {}, files = {};
    a.results.forEach(r => { info[r.name] = { orderId: r.order_id, note: r.note, updatedAt: r.updated_at, updatedBy: r.updated_by }; });
    b.results.forEach(f => { if (f.bracket === DOCS && !canReadDocs(me)) return; (files[f.bracket] || (files[f.bracket] = [])).push(fileOut(f, me)); });
    return h.json({ info, files, canEditId: canEditId(me), canReadDocs: canReadDocs(me), canAddDocs: !!me.isAdmin });
  }
  if (path === '/api/bracket/catalog/import' && method === 'POST') {
    if (!canEditId(me)) throw new h.HttpError(403, 'Chỉ Admin, Quản lý dự án hoặc Admin dự án được nhập ID đặt hàng');
    const body = await h.readJson(request);
    const list = Array.isArray(body.items) ? body.items : [];
    if (!list.length || list.length > 300) throw new h.HttpError(400, 'File không có danh sách ID hợp lệ (items)');
    const t = h.now(); let changed = 0; const skipped = [];
    const { results } = await env.DB.prepare('SELECT * FROM bracket_info').all();
    const cur = Object.fromEntries(results.map(r => [r.name, r]));
    const st = [];
    for (const it of list) {
      const name = String(it && it.name || '').trim();
      if (!NAME_RE.test(name)) { skipped.push(name || '(trống)'); continue; }
      const orderId = h.str(it.orderId, 2000), note = h.str(it.note, 1000);
      const c = cur[name];
      if (c && c.order_id === orderId && c.note === note) continue;
      changed++;
      st.push(env.DB.prepare('INSERT INTO bracket_info (name, order_id, note, updated_at, updated_by) VALUES (?, ?, ?, ?, ?) ON CONFLICT(name) DO UPDATE SET order_id = excluded.order_id, note = excluded.note, updated_at = excluded.updated_at, updated_by = excluded.updated_by').bind(name, orderId, note, t, by));
    }
    if (st.length) await env.DB.batch(st);
    if (changed) await h.audit(env, me, 'bracket_info_import', 'bracket', '', undefined, { changed, total: list.length, source: h.str(body.source, 200) });
    return h.json({ ok: true, changed, unchanged: list.length - changed - skipped.length, skipped });
  }
  let m = path.match(/^\/api\/bracket\/catalog\/(.+)$/);
  if (m && method === 'PUT') {
    if (!canEditId(me)) throw new h.HttpError(403, 'Chỉ Admin, Quản lý dự án hoặc Admin dự án được sửa ID đặt hàng');
    const name = decodeURIComponent(m[1]);
    if (!NAME_RE.test(name)) throw new h.HttpError(400, 'Tên loại bracket không hợp lệ');
    const body = await h.readJson(request);
    const orderId = h.str(body.orderId, 2000), note = h.str(body.note, 1000);
    const cur = await env.DB.prepare('SELECT * FROM bracket_info WHERE name = ?').bind(name).first();
    if (cur && cur.order_id === orderId && cur.note === note) return h.json({ ok: true, unchanged: true });
    const t = h.now();
    await env.DB.prepare('INSERT INTO bracket_info (name, order_id, note, updated_at, updated_by) VALUES (?, ?, ?, ?, ?) ON CONFLICT(name) DO UPDATE SET order_id = excluded.order_id, note = excluded.note, updated_at = excluded.updated_at, updated_by = excluded.updated_by')
      .bind(name, orderId, note, t, by).run();
    await h.audit(env, me, 'bracket_info', 'bracket', name, cur ? { orderId: cur.order_id, note: cur.note } : undefined, { orderId, note });
    return h.json({ ok: true, info: { orderId, note, updatedAt: t, updatedBy: by } });
  }
  if (path === '/api/bracket/files' && method === 'POST') {
    const u = new URL(request.url);
    const bracket = String(u.searchParams.get('bracket') || '').trim(), fname = h.str(u.searchParams.get('name'), 150);
    const isDoc = bracket === DOCS;
    if (!isDoc && !NAME_RE.test(bracket)) throw new h.HttpError(400, 'Tên loại bracket không hợp lệ');
    if (isDoc && !me.isAdmin) throw new h.HttpError(403, 'Chỉ Admin được tải tài liệu tham chiếu lên');
    const ext = (fname.match(/\.([A-Za-z0-9]+)$/) || [])[1];
    const mime = ext && FILE_TYPES[ext.toLowerCase()];
    if (!mime) throw new h.HttpError(415, 'Chỉ nhận bản vẽ PDF, ảnh (PNG, JPG, WEBP, GIF) hoặc DWG / DXF');
    if (isDoc && mime !== 'application/pdf') throw new h.HttpError(415, 'Tài liệu tham chiếu chỉ nhận file PDF');
    const buf = new Uint8Array(await request.arrayBuffer());
    if (!buf.length) throw new h.HttpError(400, 'File rỗng');
    if (buf.length > (isDoc ? MAX_DOC : MAX_FILE)) throw new h.HttpError(413, isDoc ? 'Tài liệu quá lớn — tối đa 25 MB' : 'File quá lớn — tối đa 10 MB (nén PDF hoặc giảm độ phân giải ảnh)');
    const n = await env.DB.prepare('SELECT COUNT(*) c FROM bracket_files WHERE bracket = ?').bind(bracket).first();
    if (n && n.c >= 30) throw new h.HttpError(409, 'Loại bracket này đã có 30 file — xoá bớt bản cũ trước');
    const t = h.now(), parts = Math.ceil(buf.length / CHUNK);
    const f = await env.DB.prepare('INSERT INTO bracket_files (bracket, file_name, mime, size, chunks, owner_key, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *')
      .bind(bracket, fname, mime, buf.length, parts, ownerKey(me), t, by).first();
    try {
      const st = [];
      for (let i = 0; i < parts; i++) st.push(env.DB.prepare('INSERT INTO bracket_file_chunks (file_id, seq, data) VALUES (?, ?, ?)').bind(f.id, i, buf.subarray(i * CHUNK, (i + 1) * CHUNK)));
      await env.DB.batch(st);
    } catch (e) {
      await env.DB.batch([env.DB.prepare('DELETE FROM bracket_file_chunks WHERE file_id = ?').bind(f.id), env.DB.prepare('DELETE FROM bracket_files WHERE id = ?').bind(f.id)]);
      throw e;
    }
    await h.audit(env, me, 'bracket_file_add', 'bracket', bracket, undefined, { id: f.id, name: fname, size: buf.length });
    return h.json({ ok: true, file: fileOut(f, me) });
  }
  m = path.match(/^\/api\/bracket\/files\/(\d+)$/);
  if (!m) return null;
  const f = await env.DB.prepare('SELECT * FROM bracket_files WHERE id = ?').bind(Number(m[1])).first();
  if (!f) throw new h.HttpError(404, 'File không còn (có thể đã bị xoá)');
  if (f.bracket === DOCS && !canReadDocs(me)) throw new h.HttpError(403, 'Tài liệu tham chiếu chỉ dành cho Site Sup, Quản lý dự án và Admin');
  if (method === 'GET') {
    const { results } = await env.DB.prepare('SELECT data FROM bracket_file_chunks WHERE file_id = ? ORDER BY seq').bind(f.id).all();
    const out = new Uint8Array(f.size); let pos = 0;
    results.forEach(r => { const d = r.data instanceof Uint8Array ? r.data : new Uint8Array(r.data); out.set(d, pos); pos += d.length; });
    const ascii = f.file_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
    return new Response(out, { headers: { 'content-type': f.mime, 'content-length': String(f.size), 'cache-control': 'private, max-age=86400',
      'content-disposition': `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(f.file_name)}`, 'x-content-type-options': 'nosniff' } });
  }
  if (method === 'DELETE') {
    if (!fileOut(f, me).canDelete) throw new h.HttpError(403, 'Chỉ người đính kèm file hoặc Admin được xoá');
    await env.DB.batch([env.DB.prepare('DELETE FROM bracket_file_chunks WHERE file_id = ?').bind(f.id), env.DB.prepare('DELETE FROM bracket_files WHERE id = ?').bind(f.id)]);
    await h.audit(env, me, 'bracket_file_delete', 'bracket', f.bracket, { id: f.id, name: f.file_name, by: f.created_by }, undefined);
    return h.json({ ok: true });
  }
  return null;
}

export async function routeBracket(h, env, me, path, method, request) {
  if (path.startsWith('/api/bracket/catalog') || path.startsWith('/api/bracket/files')) return routeCatalog(h, env, me, path, method, request);
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
