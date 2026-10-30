// Nghỉ phép / ốm — giao diện cho /api/ts/leave/* (xem server/otleave.mjs). Quản lý trực tiếp duyệt; duyệt xong tự ghi vào bảng công (Timesheet).
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDMY = (s) => String(s).split('-').reverse().join('/');
  const fmtH = (h) => (Math.round(h * 10) / 10).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  const ST = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Không duyệt', cancelled: 'Đã huỷ' };
  const T = TsOtLeave;
  let inbox = [], rejId = 0;

  function toast(msg) { const el = $('toast'); el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 5000); }
  async function api(method, path, body) {
    let resp;
    try {
      resp = await fetch(path, { method, credentials: 'same-origin', redirect: 'manual', cache: 'no-store',
        headers: body === undefined ? {} : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) { const err = new Error('Không gửi được yêu cầu tới máy chủ — kiểm tra mạng rồi thử lại.'); err.status = 0; throw err; }
    if (resp.type === 'opaqueredirect' || (resp.status >= 300 && resp.status < 400)) { const err = new Error('Phiên đăng nhập đã hết hạn — tải lại trang (F5).'); err.status = 401; throw err; }
    let data = {}; try { data = await resp.json(); } catch (e) { /* không phải JSON */ }
    if (!resp.ok) { const err = new Error(data.error || ('Lỗi máy chủ (HTTP ' + resp.status + ')')); err.status = resp.status; throw err; }
    return data;
  }
  const gate = (m, err) => { const el = $('gate'); el.innerHTML = m; el.className = 'ac-msg' + (err ? ' err' : ''); el.hidden = false; };

  // lịch làm việc của người dùng (Timesheet lưu trong hồ sơ cá nhân trên máy)
  const schedule = () => { try { const p = JSON.parse(localStorage.getItem('ts_profile_v28') || '{}'); return LaborVN.SCHEDULES[p.schedule] ? p.schedule : LaborVN.DEFAULT_SCHEDULE; } catch (e) { return LaborVN.DEFAULT_SCHEDULE; } };

  // ---------- form ----------
  const typeVal = () => (document.querySelector('input[name=lvType]:checked') || {}).value || '';
  function preview() {
    const type = typeVal(), from = $('lvFrom').value, to = $('lvTo').value, box = $('lvPreview'), btn = $('lvSend');
    btn.disabled = true; box.className = 'ap-flag';
    document.querySelectorAll('.lv-types label').forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
    if (!type || !from || !to) { box.textContent = 'Chọn loại nghỉ và ngày.'; return; }
    const today = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
    if (to < from) { box.className = 'ap-flag err'; box.textContent = 'Ngày kết thúc phải sau ngày bắt đầu.'; return; }
    if (from < today) { box.className = 'ap-flag err'; box.textContent = 'Không làm đơn cho ngày đã qua.'; return; }
    const days = T.leaveDays(from, to, schedule(), LaborVN);
    if (!days.length) { box.className = 'ap-flag err'; box.textContent = 'Khoảng ngày này toàn ngày nghỉ hằng tuần / ngày lễ — không cần làm đơn.'; return; }
    const count = T.dayCount(days), notice = T.leaveNotice(type, count), deadline = T.submitDeadlineMs(type, count, from);
    const late = Date.now() > deadline;
    box.className = 'ap-flag' + (late ? ' err' : ' ok');
    box.innerHTML = `<b>${fmtH(count)} ngày công</b> (${days.length} ngày làm việc${days.some(d => d.half) ? ', có ngày nghỉ buổi sáng' : ''}). Phải nộp trước <b>${esc(notice.label)}</b> — muộn nhất <b>${esc(T.fmtDeadline(deadline))}</b>.`
      + (late ? '<br>⚠ Đã quá hạn nộp — báo trực tiếp quản lý của bạn.' : '');
    btn.disabled = late;
  }
  async function send(ev) {
    ev.preventDefault();
    const btn = $('lvSend'), msg = $('lvMsg');
    btn.disabled = true; msg.className = 'ac-note'; msg.textContent = 'Đang gửi…';
    try {
      const r = await api('POST', '/api/ts/leave', { type: typeVal(), from: $('lvFrom').value, to: $('lvTo').value, reason: $('lvReason').value, sch: schedule() });
      msg.textContent = ''; $('lvReason').value = '';
      toast(`✓ Đã gửi đơn ${r.leave.label.toLowerCase()} — chờ quản lý trực tiếp duyệt (có email báo).`);
      await loadMine();
    } catch (e) { msg.className = 'ac-note err'; msg.textContent = '✗ ' + e.message; }
    preview();
  }

  // ---------- đơn của tôi ----------
  async function loadMine() {
    const body = $('lvMine').tBodies[0];
    try {
      const r = await api('GET', '/api/ts/leave/mine');
      body.innerHTML = r.leaves.map(l => {
        const st = l.expired ? ['expired', 'Quá hạn duyệt'] : [l.status, ST[l.status] || l.status];
        return `<tr data-id="${l.id}"><td>${esc(l.label)}</td><td>${esc(fmtDMY(l.from))}${l.to !== l.from ? ` → ${esc(fmtDMY(l.to))}` : ''}</td><td class="r">${fmtH(l.count)}</td>
          <td><span class="lv-st ${st[0]}">${esc(st[1])}</span>${l.status === 'approved' ? `<div class="ac-note">${esc(l.decidedBy)} duyệt — đã ghi vào Timesheet${l.written ? ` (${esc(l.written)})` : ''}</div>` : ''}${l.status === 'rejected' && l.note ? `<div class="ac-note" style="color:#b91c1c">${esc(l.decidedBy)}: ${esc(l.note)}</div>` : ''}${l.status === 'pending' ? `<div class="ac-note">duyệt trước ${esc(l.approveBy)}</div>` : ''}</td>
          <td>${l.status === 'pending' ? '<button class="btn small" data-cancel>Huỷ đơn</button>' : ''}</td></tr>`;
      }).join('') || '<tr><td colspan="5" class="ac-note">Bạn chưa có đơn nghỉ nào.</td></tr>';
    } catch (e) { body.innerHTML = `<tr><td colspan="5" class="ac-note err">✗ ${esc(e.message)}</td></tr>`; }
  }

  // ---------- đơn chờ tôi duyệt (quản lý trực tiếp) ----------
  async function loadInbox() {
    const body = $('lvInbox').tBodies[0];
    try {
      inbox = (await api('GET', '/api/ts/leave/inbox')).items;
      $('secInbox').hidden = false;
      body.innerHTML = inbox.map(l => `<tr data-id="${l.id}"><td><b>${esc(l.name)}</b><div class="ac-note">${esc(l.empId)}</div></td><td>${esc(l.label)} <span class="mono">${esc(l.type)}</span></td>
          <td>${esc(fmtDMY(l.from))}${l.to !== l.from ? ` → ${esc(fmtDMY(l.to))}` : ''}${l.expired ? '<div class="ap-exp">Quá hạn duyệt — chỉ có thể không duyệt</div>' : `<div class="ac-note">duyệt trước ${esc(l.approveBy)}</div>`}</td>
          <td class="r"><b>${fmtH(l.count)}</b></td><td>${esc(l.reason || '—')}</td>
          <td style="white-space:nowrap">${l.expired ? '' : '<button class="btn small primary" data-act="approve">Duyệt</button> '}<button class="btn small" data-act="reject">Không duyệt</button></td></tr>`).join('')
        || '<tr><td colspan="6" class="ac-note">Không có đơn nào chờ bạn duyệt.</td></tr>';
      $('lvCount').textContent = inbox.length || '';
    } catch (e) { if (e.status === 403) $('secInbox').hidden = true; else { $('secInbox').hidden = false; body.innerHTML = `<tr><td colspan="6" class="ac-note err">✗ ${esc(e.message)}</td></tr>`; } }
  }
  async function decide(id, action, note) {
    const l = inbox.find(x => x.id === id), msg = $('inMsg');
    msg.className = 'ac-note'; msg.textContent = 'Đang gửi…';
    try {
      const r = await api('POST', `/api/ts/leave/${id}/${action}`, action === 'reject' ? { note } : {});
      toast(action === 'approve' ? `✓ Đã duyệt đơn của ${l ? l.name : ''} — ${r.written} ngày nghỉ đã ghi vào Timesheet.` : '✓ Đã không duyệt đơn — đã gửi email báo người xin nghỉ.');
      msg.textContent = action === 'approve' && r.note ? `Ghi vào bảng công: ${r.note}` : '';
      $('rejBox').hidden = true; $('rejNote').value = '';
      await loadInbox();
    } catch (e) { msg.className = 'ac-note err'; msg.textContent = '✗ ' + e.message; }
  }

  function wire() {
    $('lvTypes').innerHTML = Object.keys(T.LEAVE_TYPES).map(k => `<label><input type="radio" name="lvType" value="${k}"${k === '6010' ? ' checked' : ''}><span><b>${esc(T.LEAVE_TYPES[k].label)}</b><small>${k} · ${esc(T.LEAVE_TYPES[k].wn)}</small></span></label>`).join('');
    const tomorrow = new Date(Date.now() + 7 * 36e5 + 864e5).toISOString().slice(0, 10);
    $('lvFrom').min = $('lvTo').min = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10); $('lvFrom').value = $('lvTo').value = tomorrow;
    $('lvFrom').addEventListener('change', () => { if (!$('lvTo').value || $('lvTo').value < $('lvFrom').value) $('lvTo').value = $('lvFrom').value; preview(); });
    ['lvTo'].forEach(id => $(id).addEventListener('change', preview));
    $('lvTypes').addEventListener('change', preview);
    $('lvForm').addEventListener('submit', send);
    $('lvMine').tBodies[0].addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-cancel]'); if (!b) return;
      if (!confirm('Huỷ đơn nghỉ này?')) return;
      try { await api('POST', `/api/ts/leave/${b.closest('tr').dataset.id}/cancel`, {}); toast('Đã huỷ đơn.'); await loadMine(); } catch (e) { toast('✗ ' + e.message); }
    });
    $('btnReload').addEventListener('click', loadInbox);
    $('lvInbox').tBodies[0].addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]'); if (!b) return;
      const id = +b.closest('tr').dataset.id, l = inbox.find(x => x.id === id);
      if (b.dataset.act === 'approve') { if (confirm(`Duyệt đơn ${l.label.toLowerCase()} của ${l.name} (${fmtDMY(l.from)}${l.to !== l.from ? ' → ' + fmtDMY(l.to) : ''}, ${fmtH(l.count)} ngày công)?\nCác ngày nghỉ sẽ tự ghi vào Timesheet.`)) decide(id, 'approve'); }
      else { rejId = id; $('rejLabel').textContent = `Lý do không duyệt đơn của ${l.name} (người xin nghỉ nhận email)`; $('rejBox').hidden = false; $('rejNote').focus(); }
    });
    $('btnRejCancel').addEventListener('click', () => { $('rejBox').hidden = true; });
    $('btnRej').addEventListener('click', () => {
      const note = $('rejNote').value.trim();
      if (note.length < 3) { $('inMsg').className = 'ac-note err'; $('inMsg').textContent = 'Cần ghi lý do không duyệt.'; return; }
      decide(rejId, 'reject', note);
    });
  }

  async function start() {
    let me;
    try { me = await api('GET', '/api/me'); }
    catch (e) {
      $('who').textContent = '';
      if (e.status === 404 || e.status === 405 || (e.status === 0 && location.hostname.endsWith('github.io'))) gate('Trang này chỉ dùng trên <b>máy chủ mới (Cloudflare)</b>.'); else gate(esc(e.message), true);
      return;
    }
    $('who').innerHTML = `Đăng nhập: <b>${esc(me.name)}</b>`;
    if (!me.empId) { gate('Tài khoản chưa gắn với nhân viên nào nên chưa làm được đơn nghỉ — liên hệ admin.'); }
    else { $('secForm').hidden = false; $('secMine').hidden = false; }
    wire(); preview();
    await Promise.all([me.empId ? loadMine() : null, loadInbox()]);
    if (location.hash === '#duyet') $('secInbox').scrollIntoView();
  }
  start();
})();
