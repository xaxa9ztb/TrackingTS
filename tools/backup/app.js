// Sao lưu & khôi phục toàn bộ dữ liệu — giao diện cho /api/admin/backup/* (server/backup.mjs). Chỉ Admin.
// Đọc / ghi theo từng trang nhỏ để không vượt giới hạn của máy chủ; file sao lưu nén gzip ngay trong trình duyệt.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtTime = (iso) => { try { return new Date(iso).toLocaleString('vi-VN'); } catch (e) { return iso; } };
  const fmtSize = (n) => (n >= 1048576 ? (n / 1048576).toFixed(2) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
  const FORMAT = 'trackingts-backup';
  // tên bảng → tên dễ hiểu (bảng mới chưa có tên thì hiện tên gốc)
  const TNAME = {
    employees: 'Nhân viên', projects: 'Dự án', project_staff: 'Phân công dự án', supervisor_alias: 'Tên gọi quản lý', timesheets: 'Bảng công (theo dõi)',
    ts_docs: 'Bảng công cá nhân', ts_doc_wbs: 'Bảng công cá nhân theo dự án', ts_approvals: 'Duyệt bảng công', ts_ot: 'Đơn OT', ts_leave: 'Đơn nghỉ phép / ốm',
    kv_store: 'Kho dữ liệu chung (Quản lý dự án…)', audit_log: 'Nhật ký thao tác', mail_log: 'Nhật ký email', registrations: 'Yêu cầu đăng ký',
    inc_batches: 'Đợt incentive', inc_lines: 'Incentive (chi tiết)', hs_projects: 'Hồ sơ dự án', bracket_surveys: 'Khảo sát bracket',
    bracket_info: 'ID đặt hàng bracket', bracket_files: 'Bản vẽ / tài liệu bracket', bracket_file_chunks: 'Nội dung file bracket',
  };
  const tname = (n) => TNAME[n] ? `${TNAME[n]} <small class="ac-note">(${esc(n)})</small>` : esc(n);
  let info = null, pending = null;   // pending: bản sao lưu đang chờ khôi phục { data, name, from }

  function toast(msg) { const el = $('toast'); el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 4000); }

  async function api(method, path, body, raw) {
    let resp;
    try {
      resp = await fetch(path, { method, credentials: 'same-origin', redirect: 'manual',
        headers: raw ? { 'content-type': 'application/octet-stream', 'x-ts-upload': '1' } : body === undefined ? {} : { 'content-type': 'application/json' },
        body: raw || (body === undefined ? undefined : JSON.stringify(body)) });
    } catch (e) { const err = new Error('Không gửi được yêu cầu tới máy chủ — kiểm tra mạng rồi thử lại.'); err.status = 0; throw err; }
    if (resp.type === 'opaqueredirect' || (resp.status >= 300 && resp.status < 400)) { const err = new Error('Phiên đăng nhập đã hết hạn — tải lại trang (F5) để đăng nhập lại.'); err.status = 401; throw err; }
    return resp;
  }
  async function apiJson(method, path, body, raw) {
    const resp = await api(method, path, body, raw);
    let data = {}; try { data = await resp.json(); } catch (e) { /* không phải JSON */ }
    if (!resp.ok) { const err = new Error(data.error || ('Lỗi máy chủ (HTTP ' + resp.status + ')')); err.status = resp.status; throw err; }
    return data;
  }

  // ---------- nén / giải nén ----------
  async function gzip(text) {
    if (typeof CompressionStream === 'undefined') throw new Error('Trình duyệt này không hỗ trợ nén file — dùng Chrome / Edge / Safari bản mới');
    return new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  }
  async function readBackup(bytes) {
    let text;
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
      if (typeof DecompressionStream === 'undefined') throw new Error('Trình duyệt này không giải nén được file .gz');
      text = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    } else text = new TextDecoder().decode(bytes);
    let d; try { d = JSON.parse(text); } catch (e) { throw new Error('File không phải bản sao lưu hợp lệ (không đọc được JSON)'); }
    if (!d || d.format !== FORMAT || !d.tables || typeof d.tables !== 'object') throw new Error('File không phải bản sao lưu của Bộ công cụ dự án');
    return d;
  }
  const stamp = () => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; };
  function saveFile(bytes, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/gzip' })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  function prog(box, frac, text) { box.hidden = false; box.querySelector('i').style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%'; box.querySelector('span').textContent = text; }

  // ---------- tạo bản sao lưu (đọc từng trang) ----------
  async function buildBackup(box) {
    const meta = await apiJson('GET', '/api/admin/backup/tables');
    const total = meta.tables.reduce((a, t) => a + t.rows, 0) || 1;
    const out = { format: FORMAT, version: 1, createdAt: new Date().toISOString(), createdBy: me.email, source: 'manual', schema: meta.schema, tables: {} };
    let done = 0;
    for (const t of meta.tables) {
      const rows = []; let after = 0;
      for (;;) {
        const p = await apiJson('GET', `/api/admin/backup/rows?table=${encodeURIComponent(t.name)}&after=${after}`);
        rows.push(...p.rows); done += p.rows.length; after = p.last;
        prog(box, done / total, `Đang đọc ${TNAME[t.name] || t.name}… ${done.toLocaleString('vi-VN')} / ${total.toLocaleString('vi-VN')} dòng`);
        if (p.done || !p.rows.length) break;
      }
      out.tables[t.name] = { columns: t.columns, blobs: t.blobs, rows };
    }
    prog(box, 1, 'Đang nén file…');
    const gz = await gzip(JSON.stringify(out));
    return { gz, name: `trackingts-backup-${stamp()}.json.gz`, rows: done };
  }

  let me = null;
  async function refreshSummary() {
    info = await apiJson('GET', '/api/admin/backup/tables');
    const n = info.tables.reduce((a, t) => a + t.rows, 0);
    $('dbSummary').textContent = `${info.tables.length} bảng · ${n.toLocaleString('vi-VN')} dòng dữ liệu${info.schema ? ' · cấu trúc ' + info.schema.replace(/\.sql$/, '') : ''}`;
    $('btnToDrive').disabled = !info.drive;
    $('btnToDrive').title = info.drive ? '' : 'Chưa cấu hình Google Drive (xem mục 2)';
  }

  async function onDownload() {
    const btn = $('btnDownload'), box = $('progNow'); btn.disabled = true;
    try { const b = await buildBackup(box); saveFile(b.gz, b.name); prog(box, 1, `✓ Đã tải ${b.name} (${fmtSize(b.gz.length)}, ${b.rows.toLocaleString('vi-VN')} dòng)`); }
    catch (e) { prog(box, 0, '⚠ ' + e.message); }
    finally { btn.disabled = false; }
  }
  async function onToDrive() {
    const btn = $('btnToDrive'), box = $('progNow'); btn.disabled = true;
    try {
      const b = await buildBackup(box);
      prog(box, 1, 'Đang đẩy lên Google Drive…');
      const r = await apiJson('POST', '/api/admin/backup/drive?name=' + encodeURIComponent(b.name), undefined, b.gz);
      prog(box, 1, `✓ Đã lưu ${b.name} lên Google Drive (${fmtSize(b.gz.length)})${r.pruned ? ` — đã xoá ${r.pruned} bản cũ nhất (giữ tối đa 10)` : ''}`);
      loadDrive();
    } catch (e) { prog(box, 0, '⚠ ' + e.message); }
    finally { btn.disabled = !(info && info.drive); }
  }

  // ---------- Google Drive ----------
  async function loadDrive() {
    const tb = $('driveTable').querySelector('tbody'), off = $('driveOff'), note = $('driveNote');
    note.textContent = 'Đang tải danh sách…';
    try {
      const d = await apiJson('GET', '/api/admin/backup/drive');
      if (!d.configured) {
        off.hidden = false; $('driveTable').hidden = true; note.textContent = '';
        off.innerHTML = 'Chưa cấu hình Google Drive. Cài Apps Script theo <b>tools/backup/apps-script/HUONG-DAN.md</b> rồi khai báo 2 secret <b>BACKUP_DRIVE_URL</b>, <b>BACKUP_DRIVE_TOKEN</b> trên GitHub (Settings → Secrets and variables → Actions). Vẫn tải bản sao lưu về máy được.';
        return;
      }
      off.hidden = true; $('driveTable').hidden = !d.files.length;
      tb.innerHTML = d.files.map(f => `<tr><td><b>${esc(f.name)}</b>${f.note ? `<br><small class="ac-note">${esc(f.note)}</small>` : ''}</td><td>${esc(fmtTime(f.created))}</td>
        <td><span class="bk-tag${/-auto\.json\.gz$/.test(f.name) ? ' auto' : ''}">${/-auto\.json\.gz$/.test(f.name) ? 'Tự động' : 'Thủ công'}</span></td><td class="num">${fmtSize(f.size || 0)}</td>
        <td><div class="bk-acts"><button class="btn small" data-dl="${esc(f.id)}" data-name="${esc(f.name)}" type="button">⬇ Tải về</button><button class="btn small" data-rs="${esc(f.id)}" data-name="${esc(f.name)}" type="button">Khôi phục…</button></div></td></tr>`).join('');
      note.textContent = d.files.length ? `${d.files.length} / ${d.keep || 10} bản` : 'Chưa có bản sao lưu nào trên Drive.';
    } catch (e) { off.hidden = false; off.classList.add('err'); off.textContent = '⚠ ' + e.message; note.textContent = ''; }
  }
  async function driveBytes(id) {
    const resp = await api('GET', '/api/admin/backup/drive/file?id=' + encodeURIComponent(id));
    if (!resp.ok) { let d = {}; try { d = await resp.json(); } catch (e) { /* bỏ qua */ } throw new Error(d.error || 'Không tải được bản sao lưu từ Drive'); }
    return new Uint8Array(await resp.arrayBuffer());
  }
  $('driveTable').addEventListener('click', async (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    b.disabled = true;
    try {
      const bytes = await driveBytes(b.dataset.dl || b.dataset.rs);
      if (b.dataset.dl) saveFile(bytes, b.dataset.name);
      else openRestore(await readBackup(bytes), b.dataset.name, 'drive');
    } catch (e) { toast('⚠ ' + e.message); }
    finally { b.disabled = false; }
  });

  // ---------- khôi phục ----------
  $('fileIn').addEventListener('change', async () => {
    const f = $('fileIn').files[0]; if (!f) return;
    try { openRestore(await readBackup(new Uint8Array(await f.arrayBuffer())), f.name, 'file'); }
    catch (e) { toast('⚠ ' + e.message); }
    $('fileIn').value = '';
  });
  function openRestore(data, name, from) {
    pending = { data, name, from };
    const cur = new Map(info.tables.map(t => [t.name, t.rows]));
    const names = [...new Set([...info.tables.map(t => t.name), ...Object.keys(data.tables)])];
    const empty = names.filter(n => !(data.tables[n] && data.tables[n].rows.length) && !cur.get(n));
    $('rsTable').querySelector('tbody').innerHTML = names.filter(n => !empty.includes(n)).map(n => {
      const b = data.tables[n], inCur = cur.has(n);
      const bk = b ? b.rows.length.toLocaleString('vi-VN') : '<span class="ac-note">— không có (giữ nguyên)</span>';
      const now = inCur ? cur.get(n).toLocaleString('vi-VN') : '<span class="ac-note">— không còn (bỏ qua)</span>';
      return `<tr><td>${tname(n)}</td><td class="num">${bk}</td><td class="num">${now}</td></tr>`;
    }).join('');
    if (empty.length) $('rsTable').querySelector('tbody').insertAdjacentHTML('beforeend', `<tr><td colspan="3" class="ac-note">… và ${empty.length} bảng trống ở cả hai phía</td></tr>`);
    $('rsInfo').innerHTML = `Bản sao lưu <b>${esc(name)}</b> — tạo lúc <b>${esc(fmtTime(data.createdAt))}</b>${data.createdBy ? ' bởi ' + esc(data.createdBy) : ''}${data.source === 'auto' ? ' (tự động)' : ''}` +
      (data.schema && info.schema && data.schema !== info.schema ? `<br>⚠ Cấu trúc dữ liệu khác bản hiện tại (${esc(data.schema)} → ${esc(info.schema)}): chỉ khôi phục các cột còn có; cột mới để mặc định.` : '');
    $('rsConfirm').value = ''; $('btnRestore').disabled = true; $('progRs').hidden = true;
    $('secRestore').hidden = false; $('secRestore').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('rsConfirm').addEventListener('input', () => { $('btnRestore').disabled = $('rsConfirm').value.trim().toUpperCase() !== 'KHÔI PHỤC'; });
  $('btnRsCancel').addEventListener('click', () => { pending = null; $('secRestore').hidden = true; });

  async function onRestore() {
    if (!pending) return;
    const btn = $('btnRestore'), box = $('progRs'), { data, name, from } = pending;
    btn.disabled = true; $('btnRsCancel').disabled = true;
    try {
      if ($('rsSafety').checked) {
        const b = await buildBackup(box); saveFile(b.gz, b.name.replace('.json.gz', '-truoc-khoi-phuc.json.gz'));
      }
      const meta = await apiJson('GET', '/api/admin/backup/tables');
      const order = meta.tables.filter(t => data.tables[t.name]);   // thứ tự máy chủ: bảng cha trước
      const total = order.reduce((a, t) => a + data.tables[t.name].rows.length, 0) || 1;
      prog(box, 0, 'Đang xoá dữ liệu hiện tại…');
      await apiJson('POST', '/api/admin/backup/restore/clear', { tables: order.map(t => t.name) });
      let done = 0; const counts = {};
      for (const t of order) {
        const src = data.tables[t.name], rows = src.rows;
        let i = 0;
        while (i < rows.length) {
          // gom dòng theo dung lượng (~1,5 MB / lần) — dòng chứa file nhị phân lớn đi riêng
          let size = 0, j = i;
          while (j < rows.length && j - i < 500) { size += JSON.stringify(rows[j]).length; j++; if (size > 1.5 * 1024 * 1024) break; }
          await apiJson('POST', '/api/admin/backup/restore/rows', { table: t.name, columns: src.columns, blobs: src.blobs || [], rows: rows.slice(i, j) });
          done += j - i; i = j;
          prog(box, done / total, `Đang khôi phục ${TNAME[t.name] || t.name}… ${done.toLocaleString('vi-VN')} / ${total.toLocaleString('vi-VN')} dòng`);
        }
        counts[t.name] = rows.length;
      }
      await apiJson('POST', '/api/admin/backup/restore/done', { name, from, createdAt: data.createdAt, rows: counts });
      prog(box, 1, `✓ Đã khôi phục ${done.toLocaleString('vi-VN')} dòng từ ${name}. Mọi người nên tải lại trang để thấy dữ liệu mới.`);
      pending = null; refreshSummary();
    } catch (e) {
      prog(box, 0, '⚠ Khôi phục dừng giữa chừng: ' + e.message + ' — dữ liệu có thể chưa đầy đủ; hãy khôi phục lại (dùng bản vừa tải về máy nếu cần quay về trạng thái trước).');
    } finally { $('btnRsCancel').disabled = false; btn.disabled = $('rsConfirm').value.trim().toUpperCase() !== 'KHÔI PHỤC'; }
  }

  $('btnDownload').addEventListener('click', onDownload);
  $('btnToDrive').addEventListener('click', onToDrive);
  $('btnDriveReload').addEventListener('click', loadDrive);
  $('btnRestore').addEventListener('click', onRestore);

  (async function init() {
    const gate = $('gate');
    try {
      me = await apiJson('GET', '/api/me');
      if (!me.isAdmin) { gate.classList.add('err'); gate.textContent = 'Chỉ Admin được sao lưu / khôi phục dữ liệu.'; return; }
      if (me.demo) { gate.textContent = 'Đang ở chế độ demo — sao lưu / khôi phục chỉ dùng với dữ liệu thật. Thoát demo để dùng.'; return; }
      await refreshSummary();
      gate.hidden = true; ['secNow', 'secDrive', 'secFile'].forEach(id => { $(id).hidden = false; });
      loadDrive();
    } catch (e) { gate.classList.add('err'); gate.textContent = e.status === 404 || e.status === 0 ? 'Chức năng này chỉ có ở bản chạy trên máy chủ (Cloudflare).' : '⚠ ' + e.message; }
  })();
})();
