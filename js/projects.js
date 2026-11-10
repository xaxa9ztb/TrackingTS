const ProjectsPage = (() => {
  let projects = [];
  let colFilters = [];
  let builtHeaderKey = null;
  let selected = new Set();
  let lastFilteredIds = [];
  let editing = null;          // WBS của dòng đang sửa ngay trên bảng

  async function load() {
    selected.clear();
    projects = await DB.getAll('projects');
    projects.sort((a, b) => String(a.projectName || '').localeCompare(String(b.projectName || '')));
    render();
  }

  function fmt(n) { return (Math.round((n || 0) * 100) / 100).toLocaleString('vi-VN'); }

  function specHeaders() {
    let list = [];
    try {
      const stored = JSON.parse(localStorage.getItem('specHeaders') || 'null');
      if (stored && stored.length) list = stored;
    } catch (e) { /* ignore */ }
    if (!list.length) {
      // fall back to keys of the first project that has specs
      const withSpecs = projects.find(p => p.specs && Object.keys(p.specs).length);
      list = withSpecs ? Object.keys(withSpecs.specs) : [];
    }
    // Bỏ cột "Inst_time_kg"; ẩn INST_TIME_STANDARD vì đã có cột "X hour" riêng.
    const norm = h => String(h).toUpperCase().replace(/[^A-Z0-9]/g, '');
    return list.filter(h => norm(h) !== 'INSTTIMEKG' && norm(h) !== 'INSTTIMESTANDARD');
  }

  // X hour = giờ lấy theo TÊN cột GRP_INST_TIME_STANDARD của file Yan_COM
  function xHourOf(p) {
    const s = p.specs || {};
    const raw = s.INST_TIME_STANDARD != null ? s.INST_TIME_STANDARD
      : (s['INS Time Standard'] != null ? s['INS Time Standard'] : '');
    const n = parseFloat(String(raw).split('|')[0].replace(/,/g, '').trim());
    if (!isNaN(n)) return n;
    return (p.xHour != null && p.xHour !== '') ? p.xHour : null;
  }

  // tên hiển thị cho một số cột thông số kỹ thuật (dữ liệu bên dưới giữ nguyên key gốc)
  const SPEC_DISPLAY = {
    'NUMBER_OF_STOPS': 'Số điểm dừng',
    'CDT': 'Car Door Type',
    'BRANCH_EFFICIENCY_FACTOR': 'BEF',
    'INST_TIME_STANDARD': 'INS Time Standard',
    'INST_TIME_TOTAL': 'INS Time Total',
  };

  // rebuild the header + filter row only when the spec columns change,
  // so typing in a filter input doesn't lose focus
  function buildHead(headers) {
    const key = headers.join('|');
    const thead = document.querySelector('#projectsTable thead');
    if (builtHeaderKey === key && thead.querySelector('.filter-row')) return;
    builtHeaderKey = key;
    thead.innerHTML =
      '<tr><th class="chk-col"><input type="checkbox" id="projChkAll" title="Chọn tất cả"></th>' +
      '<th>WBS Element</th><th>Project Number</th><th>Project Name</th><th>Product Line</th><th>Giám sát</th>' +
      headers.map(h => `<th>${SPEC_DISPLAY[h] || h}</th>`).join('') +
      '<th>X hour</th><th>SWAT Target Hour</th><th></th></tr>';
    const cols = ['chk'].concat(new Array(7 + headers.length).fill(true)).concat([false]);
    colFilters = TableFilter.build(thead, cols, render);
    thead.querySelector('#projChkAll').addEventListener('change', (e) => {
      if (e.target.checked) lastFilteredIds.forEach(id => selected.add(id));
      else selected.clear();
      render();
    });
  }

  function render() {
    const q = (document.getElementById('projectSearch').value || '').toLowerCase();
    const headers = specHeaders();
    buildHead(headers);

    const disp = projects
      .filter(p => String(p.projectName || '').toLowerCase().includes(q) || String(p.wbs || '').toLowerCase().includes(q))
      .map(p => ({
        p,
        cells: [
          p.wbs, p.projectNumber || '', p.projectName || '', p.productLine || '',
          p.supervisor || '',
          ...headers.map(h => (p.specs && p.specs[h]) || ''),
          xHourOf(p) != null ? fmt(xHourOf(p)) : '',
          p.swatTargetHour != null ? fmt(p.swatTargetHour) : '',
        ],
      }))
      .filter(d => TableFilter.match(colFilters, d.cells, 1));

    lastFilteredIds = disp.map(d => d.p.wbs);

    // dòng đang sửa luôn hiện (kể cả khi đổi giá trị làm nó không còn khớp bộ lọc)
    if (editing && !disp.some(d => d.p.wbs === editing)) { const ep = projects.find(x => x.wbs === editing); if (ep) disp.unshift({ p: ep, cells: [] }); }
    document.querySelector('#projectsTable tbody').innerHTML = disp.map(d => d.p.wbs === editing ? editRow(d.p, headers) : `
      <tr>
        <td class="chk-col"><input type="checkbox" class="row-chk" data-id="${esc(d.p.wbs)}" ${selected.has(d.p.wbs) ? 'checked' : ''}></td>
        ${d.cells.map((c, i) => {
          const cls = (i === 2) ? ' class="col-name"' : '';
          return `<td${cls}>${esc(c)}</td>`;
        }).join('')}
        <td class="col-actions">
          <button class="btn-icon" data-edit="${esc(d.p.wbs)}" title="Sửa ngay trên dòng (cả thông số kỹ thuật)">✏️</button>
          <button class="btn-icon" data-del="${esc(d.p.wbs)}" title="Xoá dự án">🗑️</button>
        </td>
      </tr>`).join('');

    document.querySelectorAll('#projectsTable .row-chk').forEach(chk => chk.addEventListener('change', () => {
      if (chk.checked) selected.add(chk.dataset.id); else selected.delete(chk.dataset.id);
      updateSelectionUI();
    }));
    document.querySelectorAll('#projectsTable [data-edit]').forEach(b => b.addEventListener('click', () => {
      if (editing && editing !== b.dataset.edit && !confirm('Đang sửa dự án ' + editing + ' chưa lưu — bỏ thay đổi đó?')) return;
      editing = b.dataset.edit; render();
      const first = document.querySelector('#projectsTable tr.row-editing input[data-k]'); if (first) first.focus();
    }));
    const er = document.querySelector('#projectsTable tr.row-editing');
    if (er) {
      er.querySelector('[data-save]').addEventListener('click', () => saveInline(er));
      er.querySelector('[data-cancel]').addEventListener('click', () => { editing = null; render(); });
      er.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); saveInline(er); }
        if (ev.key === 'Escape') { ev.preventDefault(); editing = null; render(); }
      });
    }
    document.querySelectorAll('#projectsTable [data-del]').forEach(b => b.addEventListener('click', () => remove(b.dataset.del)));
    updateSelectionUI();
  }

  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // ô X hour ghi vào thông số INST_TIME_STANDARD nếu dự án có cột đó (X hour đọc từ đây), không thì vào trường xHour
  const xKey = (p) => (p.specs && p.specs.INST_TIME_STANDARD != null ? 'spec:INST_TIME_STANDARD' : (p.specs && p.specs['INS Time Standard'] != null ? 'spec:INS Time Standard' : 'xHour'));
  function editRow(p, headers) {
    const inp = (k, v, w, extra) => `<td><input class="cell-in" data-k="${esc(k)}" value="${esc(v)}" style="min-width:${w || 70}px"${extra || ''}></td>`;
    const x = xHourOf(p);
    return `<tr class="row-editing">
      <td class="chk-col"></td>
      <td><b>${esc(p.wbs)}</b></td>
      ${inp('projectNumber', p.projectNumber || '', 90)}
      ${inp('projectName', p.projectName || '', 200)}
      ${inp('productLine', p.productLine || '', 90)}
      ${inp('supervisor', p.supervisor || '', 130)}
      ${headers.map(h => inp('spec:' + h, (p.specs && p.specs[h] != null) ? p.specs[h] : '', 60)).join('')}
      ${inp(xKey(p), x != null ? x : '', 60, ' inputmode="decimal"')}
      ${inp('swatTargetHour', p.swatTargetHour != null ? p.swatTargetHour : '', 70, ' inputmode="decimal"')}
      <td class="col-actions"><button class="btn-icon" data-save title="Lưu (Enter)">💾</button><button class="btn-icon" data-cancel title="Huỷ (Esc)">✕</button></td>
    </tr>`;
  }
  // "12,5" / "12.5" → số; chữ (vd. "ES1", "Side opening") giữ nguyên
  const toVal = (s) => { const t = String(s).trim(); if (t === '') return ''; const n = Number(t.replace(',', '.')); return /^-?[\d.,]+$/.test(t) && isFinite(n) ? n : t; };
  async function saveInline(tr) {
    const p = projects.find(x => x.wbs === editing); if (!p) return;
    const fields = {}, specs = { ...(p.specs || {}) };
    let specChanged = false;
    tr.querySelectorAll('input[data-k]').forEach(i => {
      const k = i.dataset.k, v = i.value;
      if (k.startsWith('spec:')) {
        const h = k.slice(5), nv = toVal(v), ov = specs[h] == null ? '' : specs[h];
        if (String(nv) !== String(ov)) { if (nv === '') delete specs[h]; else specs[h] = nv; specChanged = true; }
      } else if (k === 'swatTargetHour' || k === 'xHour') {
        const nv = v.trim() === '' ? null : Number(v.replace(',', '.'));
        if (nv !== null && !isFinite(nv)) return;
        if ((p[k] == null ? null : Number(p[k])) !== nv) fields[k] = nv;
      } else if (String(p[k] || '') !== v.trim()) fields[k] = v.trim();
    });
    if (specChanged) fields.specs = specs;
    if (!Object.keys(fields).length) { editing = null; render(); return; }
    const btn = tr.querySelector('[data-save]'); btn.disabled = true; btn.textContent = '…';
    try { await Cloud.saveProject(p.wbs, fields); }
    catch (err) { console.error(err); alert('Không lưu được lên máy chủ: ' + err.message); btn.disabled = false; btn.textContent = '💾'; return; }
    const record = { ...p, ...fields };
    await DB.put('projects', record);
    editing = null;
    await load();
    await Dashboard.reloadAndRefresh();
  }

  function updateSelectionUI() {
    const btn = document.getElementById('btnDelSelProjects');
    btn.style.display = selected.size ? '' : 'none';
    btn.textContent = `Xoá đã chọn (${selected.size})`;
    const chkAll = document.getElementById('projChkAll');
    if (chkAll) chkAll.checked = lastFilteredIds.length > 0 && lastFilteredIds.every(id => selected.has(id));
  }

  async function removeSelected() {
    if (!selected.size) return;
    if (!confirm(`Xoá ${selected.size} dự án đã chọn?`)) return;
    await Backup.snapshot(`Trước khi xoá ${selected.size} dự án (tự động)`);
    try { await Cloud.deleteProjects([...selected]); }
    catch (err) { console.error(err); alert('Không xoá được trên máy chủ: ' + err.message + '\nChưa xoá gì.'); return; }
    for (const id of selected) await DB.remove('projects', id);
    await load();
    await Dashboard.reloadAndRefresh();
  }

  function openForm(wbs) {
    const p = wbs ? projects.find(x => x.wbs === wbs) : null;
    const body = `
      <label class="full">WBS Element${p ? '' : ' *'}
        <input id="f_wbs" value="${p ? p.wbs : ''}" ${p ? 'readonly' : ''}>
      </label>
      <label class="full">Project Number
        <input id="f_num" value="${p ? (p.projectNumber || '') : ''}">
      </label>
      <label class="full">Tên dự án
        <input id="f_name" value="${p ? (p.projectName || '') : ''}">
      </label>
      <label>Khách hàng
        <input id="f_customer" value="${p ? (p.customer || '') : ''}">
      </label>
      <label>Product Line
        <input id="f_line" value="${p ? (p.productLine || '') : ''}">
      </label>
      <label>Giám sát
        <input id="f_sup" value="${p ? (p.supervisor || '') : ''}">
      </label>
      <label>Target Hour
        <input id="f_target" type="number" value="${p ? (p.targetHour || 0) : 0}">
      </label>
    `;
    Modal.open(p ? 'Sửa dự án' : 'Thêm dự án', body, async () => {
      const wbsVal = (document.getElementById('f_wbs').value || '').trim();
      if (!wbsVal) { alert('WBS Element là bắt buộc'); return false; }
      const record = {
        ...(p || { source: 'manual' }),
        wbs: wbsVal,
        projectNumber: document.getElementById('f_num').value,
        projectName: document.getElementById('f_name').value,
        customer: document.getElementById('f_customer').value,
        productLine: document.getElementById('f_line').value,
        supervisor: document.getElementById('f_sup').value,
        targetHour: parseFloat(document.getElementById('f_target').value) || 0,
        targetHourManual: true,
      };
      try {
        await Cloud.saveProject(wbsVal, {
          projectNumber: record.projectNumber, projectName: record.projectName, customer: record.customer,
          productLine: record.productLine, supervisor: record.supervisor, targetHour: record.targetHour,
          targetHourManual: true, ...(p ? {} : { source: record.source }),
        });
      } catch (err) { console.error(err); alert('Không lưu được lên máy chủ: ' + err.message); return false; }
      await DB.put('projects', record);
      await load();
      await Dashboard.reloadAndRefresh();
      return true;
    });
  }

  async function remove(wbs) {
    if (!confirm(`Xoá dự án ${wbs}?`)) return;
    try { await Cloud.deleteProjects([wbs]); }
    catch (err) { console.error(err); alert('Không xoá được trên máy chủ: ' + err.message); return; }
    await DB.remove('projects', wbs);
    await load();
    await Dashboard.reloadAndRefresh();
  }

  function wire() {
    document.getElementById('btnAddProject').addEventListener('click', () => openForm(null));
    document.getElementById('btnDelSelProjects').addEventListener('click', removeSelected);
    document.getElementById('projectSearch').addEventListener('input', render);
  }

  return { load, wire };
})();
