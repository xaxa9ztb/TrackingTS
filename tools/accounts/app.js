// Tài khoản & phân quyền — giao diện cho API máy chủ Cloudflare (/api, xem server/api.mjs).
// Đăng nhập do Cloudflare Access lo; máy chủ kiểm tra quyền cho từng yêu cầu. Trang này chỉ hiển thị.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plain = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  const ROLE_LABEL = { admin: 'Admin', pm: 'Quản lý dự án', sitesup: 'Site Sup', staff: 'Nhân viên' };
  const fmtTime = (iso) => { try { return new Date(iso).toLocaleString('vi-VN'); } catch (e) { return iso; } };

  let me = null, employees = [], projects = [], localData = null;

  function toast(msg) {
    const el = $('toast');
    el.textContent = msg; el.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 3500);
  }

  async function api(method, path, body) {
    let resp;
    try {
      resp = await fetch(path, {
        method, credentials: 'same-origin', redirect: 'manual',
        headers: body === undefined ? {} : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      const err = new Error('Không gửi được yêu cầu tới máy chủ (' + (e && e.message ? e.message : 'lỗi mạng') + ') — kiểm tra mạng rồi thử lại.');
      err.status = 0; throw err;
    }
    // Phiên Cloudflare Access hết hạn: yêu cầu bị chuyển hướng sang trang đăng nhập
    if (resp.type === 'opaqueredirect' || (resp.status >= 300 && resp.status < 400)) {
      const err = new Error('Phiên đăng nhập đã hết hạn — tải lại trang (F5) để đăng nhập lại.');
      err.status = 401; throw err;
    }
    let data = {};
    try { data = await resp.json(); } catch (e) { /* không phải JSON */ }
    if (!resp.ok) {
      const err = new Error(data.error || ('Lỗi máy chủ (HTTP ' + resp.status + ')'));
      err.status = resp.status; throw err;
    }
    return data;
  }

  function gate(msg, isErr) {
    const el = $('gate');
    el.innerHTML = msg; el.className = 'ac-msg' + (isErr ? ' err' : ''); el.hidden = false;
  }

  // ---------- 1. đưa dữ liệu lên ----------
  async function decodeFile(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes[0] === 0x1f && bytes[1] === 0x8b && typeof DecompressionStream !== 'undefined') {
      return await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    }
    return new TextDecoder('utf-8').decode(bytes);
  }

  function showLocal(src) {
    const n = (k) => (localData && Array.isArray(localData[k]) ? localData[k].length : 0);
    $('localCounts').textContent = localData && (n('employees') || n('projects'))
      ? `${src}: ${n('employees')} nhân viên · ${n('projects')} dự án.`
      : 'Máy này chưa có dữ liệu. Chọn file sao lưu .json (Thống kê giờ công → Cập nhật Data → ⬇ Tải bản sao lưu) hoặc file timesheet-data.json tải từ Drive.';
    $('btnImport').disabled = !(localData && (n('employees') || n('projects')));
  }

  async function initImport() {
    try {
      if (typeof DB !== 'undefined') {
        const [emps, projs] = await Promise.all([DB.getAll('employees'), DB.getAll('projects')]);
        if ((emps || []).length || (projs || []).length) localData = { employees: emps || [], projects: projs || [] };
      }
    } catch (e) { /* chưa có dữ liệu trên máy */ }
    showLocal('Trên máy này');
    const pick = document.createElement('button');
    pick.className = 'btn'; pick.textContent = 'Chọn file sao lưu (.json)…'; pick.id = 'btnPick';
    $('btnImport').before(pick);
    pick.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = '.json,application/json,application/gzip';
      input.addEventListener('change', async () => {
        const f = input.files[0]; if (!f) return;
        try {
          const data = JSON.parse(await decodeFile(f));
          if (!Array.isArray(data.employees) && !Array.isArray(data.projects)) throw new Error('File không có employees / projects');
          localData = { employees: data.employees || [], projects: data.projects || [] };
          showLocal('File ' + f.name);
        } catch (e) { toast('Không đọc được file: ' + e.message); }
      });
      input.click();
    });
    $('btnImport').addEventListener('click', async () => {
      const msg = $('importMsg');
      msg.className = 'ac-note'; msg.textContent = 'Đang đưa lên…';
      $('btnImport').disabled = true;
      try {
        // chỉ gửi trường cần thiết — không gửi ngày sinh, giới tính, mã cá nhân; gửi từng đợt nhỏ (giới hạn của máy chủ miễn phí)
        const emps = localData.employees.map(e => ({ empId: e.empId, fullName: e.fullName, position: e.position, supervisor: e.supervisor }));
        const projs = localData.projects;
        const EMP_BATCH = 200, PROJ_BATCH = 100;
        const steps = Math.ceil(emps.length / EMP_BATCH) + Math.ceil(projs.length / PROJ_BATCH) + ($('deactivateMissing').checked ? 1 : 0);
        let done = 0, nEmp = 0, nProj = 0, deact = 0;
        const progress = () => { msg.textContent = `Đang đưa lên… ${Math.round(done / steps * 100)}% (${nEmp} nhân viên, ${nProj} dự án)`; };
        for (let i = 0; i < emps.length; i += EMP_BATCH) {
          nEmp += (await api('POST', '/api/admin/import', { employees: emps.slice(i, i + EMP_BATCH) })).employees; done++; progress();
        }
        for (let i = 0; i < projs.length; i += PROJ_BATCH) {
          nProj += (await api('POST', '/api/admin/import', { projects: projs.slice(i, i + PROJ_BATCH) })).projects; done++; progress();
        }
        if ($('deactivateMissing').checked) {
          deact = (await api('POST', '/api/admin/import', { deactivateMissing: true, allEmpIds: emps.map(e => e.empId) })).deactivated; done++;
        }
        msg.className = 'ac-note ok';
        msg.textContent = `✓ Đã đưa lên ${nEmp} nhân viên, ${nProj} dự án` + (deact ? `, khoá ${deact} người không còn trong EE Data.` : '.');
        await loadAll();
      } catch (e) {
        msg.className = 'ac-note err'; msg.textContent = '✗ ' + e.message + ' (dữ liệu đã gửi trước đó vẫn được giữ; bấm lại để gửi tiếp)';
      } finally { $('btnImport').disabled = false; }
    });
  }

  // ---------- 2b. dán danh sách email ----------
  const EMAIL_TOKEN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // Mỗi dòng: mã NV và email, cách nhau bằng tab / dấu phẩy / chấm phẩy / khoảng trắng (dán thẳng từ Excel được)
  function parsePaste(text) {
    const rows = [], bad = [];
    String(text || '').split(/\r?\n/).forEach((line, i) => {
      const raw = line.trim(); if (!raw) return;
      const tokens = raw.split(/[\t,;]+|\s+/).map(x => x.trim()).filter(Boolean);
      const email = tokens.find(x => EMAIL_TOKEN.test(x));
      const id = tokens.find(x => !EMAIL_TOKEN.test(x));
      if (!email || !id) {
        if (i === 0 && /m[ãa]|email/i.test(raw)) return;            // dòng tiêu đề
        bad.push(`Dòng ${i + 1}: "${raw.slice(0, 60)}" — ` + (!email && tokens.length >= 2 ? 'email không hợp lệ' : 'cần có mã NV và email'));
        return;
      }
      rows.push({ empId: id, email: email.toLowerCase() });
    });
    return { rows, bad };
  }

  function wirePaste() {
    $('btnPaste').addEventListener('click', async () => {
      const out = $('pasteMsg');
      const { rows, bad } = parsePaste($('pasteBox').value);
      if (!rows.length) { out.className = 'ac-note err'; out.textContent = '✗ Chưa có dòng hợp lệ. Mỗi dòng gồm mã NV và email.' + (bad.length ? '\n' + bad.join('\n') : ''); return; }
      out.className = 'ac-note'; out.textContent = 'Đang gắn email…'; $('btnPaste').disabled = true;
      let applied = 0, unchanged = 0; const problems = [...bad];
      try {
        for (let i = 0; i < rows.length; i += 40) {
          const r = await api('POST', '/api/admin/emails', { items: rows.slice(i, i + 40) });
          applied += r.applied;
          for (const x of r.results) {
            if (!x.ok) problems.push(`${x.empId || '(trống)'} · ${x.email}: ${x.error}`);
            else if (x.unchanged) unchanged++;
          }
        }
        out.className = problems.length ? 'ac-note err' : 'ac-note ok';
        out.textContent = `✓ Đã gắn ${applied} email` + (unchanged ? `, ${unchanged} dòng không đổi` : '') + (problems.length ? `; ${problems.length} dòng chưa được:\n` + problems.join('\n') : '.');
        await loadAll();
      } catch (e) { out.className = 'ac-note err'; out.textContent = '✗ ' + e.message; }
      finally { $('btnPaste').disabled = false; }
    });
  }

  // ---------- 2. nhân viên ----------
  function rolesText(e) {
    const r = e.roles && e.roles.length ? e.roles.map(x => ROLE_LABEL[x] || x).join(', ') : 'Nhân viên';
    return e.roleOverride ? r + ' (chỉnh tay)' : r;
  }

  function renderPeople() {
    const q = plain($('q').value.trim());
    const rows = employees.filter(e => !q || plain(`${e.empId} ${e.name} ${e.email} ${e.position}`).includes(q));
    $('peopleCount').textContent = `${rows.length} / ${employees.length} người · ${employees.filter(e => e.email && e.active).length} người có email đăng nhập`;
    $('people').tBodies[0].innerHTML = rows.map(e => `
      <tr data-id="${esc(e.empId)}" class="${e.active ? '' : 'off'}">
        <td class="mono">${esc(e.empId)}</td>
        <td>${esc(e.name)}${me.empId === e.empId ? ' <i>(bạn)</i>' : ''}</td>
        <td>${esc(e.position)}</td>
        <td><input type="email" value="${esc(e.email)}" placeholder="email@…" aria-label="Email của ${esc(e.name)}" data-f="email"></td>
        <td><select data-f="roleOverride" aria-label="Vai trò của ${esc(e.name)}" title="${esc(rolesText(e))}">
          <option value="">Theo chức danh${!e.roleOverride ? ' — ' + esc(rolesText(e)) : ''}</option>
          ${['admin', 'pm', 'sitesup', 'staff'].map(r => `<option value="${r}"${e.roleOverride === r ? ' selected' : ''}>${ROLE_LABEL[r]}</option>`).join('')}
        </select></td>
        <td><input type="checkbox" data-f="active"${e.active ? ' checked' : ''} aria-label="${esc(e.name)} đang làm"></td>
        <td><button class="btn small" data-save disabled>Lưu</button></td>
      </tr>`).join('');
    const active = employees.filter(e => e.active && e.email).map(e => e.email);
    $('accessList').value = active.join(', ');
  }

  function rowChanges(tr) {
    const e = employees.find(x => x.empId === tr.dataset.id);
    const email = tr.querySelector('[data-f=email]').value.trim().toLowerCase();
    const roleOverride = tr.querySelector('[data-f=roleOverride]').value;
    const active = tr.querySelector('[data-f=active]').checked;
    const out = {};
    if (email !== (e.email || '')) out.email = email;
    if (roleOverride !== (e.roleOverride || '')) out.roleOverride = roleOverride;
    if (active !== !!e.active) out.active = active;
    return out;
  }

  function wirePeople() {
    $('q').addEventListener('input', renderPeople);
    const tbody = $('people').tBodies[0];
    tbody.addEventListener('input', (ev) => {
      const tr = ev.target.closest('tr'); if (!tr) return;
      const dirty = Object.keys(rowChanges(tr)).length > 0;
      tr.classList.toggle('dirty', dirty);
      tr.querySelector('[data-save]').disabled = !dirty;
    });
    tbody.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('[data-save]'); if (!btn) return;
      const tr = btn.closest('tr');
      const changes = rowChanges(tr);
      if (changes.active === false && !confirm('Khoá tài khoản này? Người đó sẽ không vào được Bộ công cụ nữa.')) return;
      btn.disabled = true;
      try {
        const r = await api('PATCH', '/api/admin/employees/' + encodeURIComponent(tr.dataset.id), changes);
        const i = employees.findIndex(x => x.empId === tr.dataset.id);
        employees[i] = r.employee;
        renderPeople();
        toast('Đã lưu ' + r.employee.name + (changes.email !== undefined ? ' — nhớ cập nhật danh sách email ở Cloudflare Access' : ''));
        loadAudit();
      } catch (e) {
        btn.disabled = false;
        toast('✗ ' + e.message);
      }
    });
    $('btnCopy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText($('accessList').value); toast('Đã sao chép danh sách email'); }
      catch (e) { $('accessList').select(); toast('Bấm Ctrl+C để sao chép'); }
    });
  }

  // ---------- 3. phân công dự án ----------
  function optionList(role, selected) {
    const cands = employees.filter(e => e.active && ((e.roles || []).includes(role) || (e.roles || []).includes('admin')) || selected.includes(e.empId));
    return cands.map(e => `<option value="${esc(e.empId)}"${selected.includes(e.empId) ? ' selected' : ''}>${esc(e.name)} (${esc(e.empId)})</option>`).join('');
  }

  function renderStaff() {
    const q = plain($('qp').value.trim());
    const rows = projects.filter(p => !q || plain(`${p.wbs} ${p.projectName}`).includes(q));
    $('staff').tBodies[0].innerHTML = rows.map(p => `
      <tr data-wbs="${esc(p.wbs)}">
        <td class="mono">${esc(p.wbs)}</td>
        <td>${esc(p.projectName)}</td>
        <td><select multiple size="3" data-role="sitesup" aria-label="Site Sup của ${esc(p.wbs)}">${optionList('sitesup', p.staff.sitesup)}</select></td>
        <td><select multiple size="3" data-role="pm" aria-label="Quản lý dự án của ${esc(p.wbs)}">${optionList('pm', p.staff.pm)}</select></td>
        <td><button class="btn small" data-save disabled>Lưu</button></td>
      </tr>`).join('') || '<tr><td colspan="5" class="ac-note">Chưa có dự án trên máy chủ — đưa dữ liệu lên ở mục 1.</td></tr>';
  }

  function wireStaff() {
    $('qp').addEventListener('input', renderStaff);
    const tbody = $('staff').tBodies[0];
    tbody.addEventListener('change', (ev) => {
      const tr = ev.target.closest('tr'); if (!tr) return;
      tr.classList.add('dirty'); tr.querySelector('[data-save]').disabled = false;
    });
    tbody.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('[data-save]'); if (!btn) return;
      const tr = btn.closest('tr');
      const val = (role) => [...tr.querySelector(`[data-role=${role}]`).selectedOptions].map(o => o.value);
      btn.disabled = true;
      try {
        const r = await api('PUT', `/api/projects/${encodeURIComponent(tr.dataset.wbs)}/staff`, { sitesup: val('sitesup'), pm: val('pm') });
        const p = projects.find(x => x.wbs === tr.dataset.wbs);
        p.staff = r.staff;
        tr.classList.remove('dirty');
        toast('Đã lưu phân công ' + p.wbs);
        loadAudit();
      } catch (e) { btn.disabled = false; toast('✗ ' + e.message); }
    });
  }

  // ---------- 4. nhật ký ----------
  const ACTION = { import: 'Đưa dữ liệu lên', update: 'Sửa nhân viên', set_staff: 'Phân công dự án', set_emails: 'Gắn email hàng loạt' };
  const FIELD = { email: 'email', roleOverride: 'vai trò chỉnh tay', active: 'đang làm', sitesup: 'Site Sup', pm: 'QLDA',
    employees: 'nhân viên', projects: 'dự án', deactivated: 'khoá', changes: 'thay đổi' };
  const val = (v) => Array.isArray(v) ? (v.length && typeof v[0] === 'object' ? v.length + ' dòng' : (v.join(', ') || '—')) : v === true ? 'có' : v === false ? 'không' : (v === '' || v == null ? '—' : (ROLE_LABEL[v] || v));
  function detail(e) {
    const show = (o) => o ? Object.entries(o).map(([k, v]) => `${FIELD[k] || k}: ${val(v)}`).join(' · ') : '';
    return e.before ? `${show(e.before)} → ${show(e.after)}` : show(e.after);
  }
  async function loadAudit() {
    if (!me.isAdmin) return;
    try {
      const r = await api('GET', '/api/admin/audit?limit=50');
      $('audit').tBodies[0].innerHTML = r.entries.map(e => `<tr>
        <td>${esc(fmtTime(e.at))}</td><td>${esc(e.actor)}</td><td>${esc(ACTION[e.action] || e.action)}</td>
        <td class="mono">${esc(e.entity_id || e.entity)}</td><td class="detail">${esc(detail(e))}</td></tr>`).join('')
        || '<tr><td colspan="5" class="ac-note">Chưa có thay đổi nào.</td></tr>';
    } catch (e) { /* bỏ qua */ }
  }

  async function loadAll() {
    const [emp, proj] = await Promise.all([api('GET', '/api/employees'), api('GET', '/api/projects')]);
    employees = emp.employees; projects = proj.projects;
    if (me.isAdmin) renderPeople();
    renderStaff();
    loadAudit();
  }

  async function start() {
    try {
      me = await api('GET', '/api/me');
    } catch (e) {
      $('who').textContent = '';
      if (e.status === 404 || e.status === 405 || (e.status === 0 && location.hostname.endsWith('github.io'))) {
        gate('Trang này chỉ dùng trên <b>máy chủ mới (Cloudflare)</b>. Bản đang chạy trên GitHub Pages chưa có máy chủ.');
      } else if (e.status === 503) {
        gate('Máy chủ chưa bật đăng nhập: ' + esc(e.message) + '. Làm theo README-DEPLOY.md, mục <i>Bật Cloudflare Access</i>.');
      } else {
        gate(esc(e.message), true);
      }
      return;
    }
    const roles = me.roles.map(r => ROLE_LABEL[r] || r).join(', ') || 'Nhân viên';
    $('who').innerHTML = `Đăng nhập: <b>${esc(me.name)}</b>${me.name !== me.email ? ' · ' + esc(me.email) : ''} · ${esc(roles)}`;
    if (!me.isAdmin && !me.roles.includes('pm')) {
      gate('Chỉ <b>Admin</b> và <b>Quản lý dự án</b> dùng trang này.');
      return;
    }
    $('secStaff').hidden = false;
    wireStaff();
    if (me.isAdmin) {
      ['secImport', 'secPeople', 'secAudit'].forEach(id => { $(id).hidden = false; });
      wirePeople();
      wirePaste();
      initImport();
    }
    try { await loadAll(); } catch (e) { gate(esc(e.message), true); }
  }

  start();
})();
