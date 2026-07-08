const TimesheetPage = (() => {
  let timesheets = [];
  let employees = [];
  let projects = [];
  let empCombo = null;
  let projCombo = null;
  let colFilters = [];
  let selected = new Set();      // ids of rows ticked for bulk delete
  let lastFilteredIds = [];      // ids of all rows matching current filters
  let dupMode = false;           // true = only show suspected-duplicate groups

  function fmt(n) { return (Math.round((n || 0) * 10) / 10).toFixed(1).replace('.', ','); }

  // chu kỳ bảng công của tháng N: từ 16 tháng (N-1) đến 15 tháng N
  // ví dụ chu kỳ tháng 7 = 16/06 -> 15/07
  function cycleRange(month) { // month: 'yyyy-mm'
    const [y, m] = month.split('-').map(Number);
    const prevY = m === 1 ? y - 1 : y;
    const prevM = m === 1 ? 12 : m - 1;
    const pad = n => String(n).padStart(2, '0');
    return { from: `${prevY}-${pad(prevM)}-16`, to: `${y}-${pad(m)}-15` };
  }

  function fmtDMY(iso) { // 'yyyy-mm-dd' -> 'dd/mm/yyyy'
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  async function load() {
    selected.clear();
    timesheets = await DB.getAll('timesheets');
    employees = await DB.getAll('employees');
    projects = await DB.getAll('projects');
    employees.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
    projects.sort((a, b) => (a.projectName || '').localeCompare(b.projectName || ''));
    populateFilterOptions();
    render();
  }

  async function reloadFilters() {
    employees = await DB.getAll('employees');
    projects = await DB.getAll('projects');
    populateFilterOptions();
  }

  function ensureCombos() {
    if (!projCombo) {
      projCombo = Combo.create(document.getElementById('tsProjectCombo'), {
        placeholder: 'Tất cả dự án — gõ để tìm...',
        onChange: () => { populateEmployeeFilter(); render(); },
      });
    }
    if (!empCombo) {
      empCombo = Combo.create(document.getElementById('tsEmployeeCombo'), {
        placeholder: 'Tất cả nhân viên — gõ để tìm...',
        onChange: () => render(),
      });
    }
  }

  function populateFilterOptions() {
    ensureCombos();
    projCombo.setItems(projects.map(p => ({ value: p.wbs, label: `${p.projectName} (${p.wbs})` })));
    populateEmployeeFilter();
  }

  // employee droplist only lists employees who actually have timesheet rows on the selected project
  function populateEmployeeFilter() {
    const projFilter = projCombo.getValue();
    let options;
    if (projFilter) {
      const seen = {};
      timesheets.filter(r => r.wbs === projFilter).forEach(r => {
        if (!seen[r.empId]) seen[r.empId] = r.empName || employeeName(r.empId);
      });
      options = Object.entries(seen)
        .map(([empId, name]) => ({ empId, name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } else {
      options = employees.map(e => ({ empId: e.empId, name: e.fullName }));
    }
    empCombo.setItems(options.map(o => ({ value: o.empId, label: `${o.name} (${o.empId})` })));
  }

  function employeeName(empId) {
    const e = employees.find(x => x.empId === empId);
    return e ? e.fullName : empId;
  }
  function projectLabel(wbs) {
    if (!wbs) return '(không xác định)';
    const p = projects.find(x => x.wbs === wbs);
    return p ? `${p.projectName} (${wbs})` : wbs;
  }

  function render() {
    const month = document.getElementById('tsMonthFilter').value; // yyyy-mm
    const empFilter = empCombo ? empCombo.getValue() : '';
    const projFilter = projCombo ? projCombo.getValue() : '';

    const cycleLabel = document.getElementById('tsCycleLabel');
    let rows = timesheets;
    if (month) {
      const { from, to } = cycleRange(month);
      rows = rows.filter(r => r.date && r.date >= from && r.date <= to);
      if (cycleLabel) cycleLabel.textContent = `Chu kỳ: ${fmtDMY(from)} – ${fmtDMY(to)}`;
    } else if (cycleLabel) {
      cycleLabel.textContent = '';
    }
    if (empFilter) rows = rows.filter(r => r.empId === empFilter);
    if (projFilter) rows = rows.filter(r => r.wbs === projFilter);

    // duplicate finder: keep only groups where one employee has 2+ rows on
    // the same day; rows stay grouped so admin can compare and delete extras
    const dupInfo = document.getElementById('tsDupInfo');
    const dupGroupOf = new Map(); // row id -> group index (for striping)
    if (dupMode) {
      const groups = new Map();
      rows.forEach(r => {
        const k = `${r.empId}|${r.date || ''}`;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(r);
      });
      const dupGroups = [...groups.values()]
        .filter(g => g.length > 1)
        .sort((a, b) => (b[0].date || '').localeCompare(a[0].date || '') || a[0].empId.localeCompare(b[0].empId));
      rows = [];
      dupGroups.forEach((g, i) => g.forEach(r => { dupGroupOf.set(r.id, i); rows.push(r); }));
      if (dupInfo) {
        dupInfo.textContent = dupGroups.length
          ? `⚠️ ${dupGroups.length} nhóm nghi trùng (${rows.length} dòng)`
          : '✓ Không có dòng nào trùng nhân viên + ngày';
      }
    } else {
      if (dupInfo) dupInfo.textContent = '';
      rows = rows.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }

    // display cells per row; per-column filters run on these strings
    const disp = rows.map(r => ({
      r,
      cells: [
        r.date || '', r.empId, r.empName || employeeName(r.empId), projectLabel(r.wbs),
        r.activities || '', fmt(r.normal), fmt(r.ot1), fmt(r.ot2), fmt(r.ot3),
        r.isSiteSup ? 'Site Sup' : (r.isFitter ? 'Fitter' : ''),
      ],
    })).filter(d => TableFilter.match(colFilters, d.cells, 1));

    lastFilteredIds = disp.map(d => d.r.id);

    document.querySelector('#timesheetTable tbody').innerHTML = disp.slice(0, 500).map(d => `
      <tr${dupMode ? ` class="dup-row ${dupGroupOf.get(d.r.id) % 2 ? 'dup-b' : 'dup-a'}"` : ''}>
        <td class="chk-col"><input type="checkbox" class="row-chk" data-id="${d.r.id}" ${selected.has(d.r.id) ? 'checked' : ''}></td>
        ${d.cells.map((c, i) => `<td${i >= 5 && i <= 8 ? ' class="num"' : ''}>${c}</td>`).join('')}
        <td>
          <button class="btn-icon" data-edit="${d.r.id}">✏️</button>
          <button class="btn-icon" data-del="${d.r.id}">🗑️</button>
        </td>
      </tr>`).join('');

    if (disp.length > 500) {
      document.querySelector('#timesheetTable tbody').insertAdjacentHTML('beforeend',
        `<tr><td colspan="12" style="text-align:center;color:#888">... và ${disp.length - 500} dòng khác (thu hẹp bộ lọc để xem)</td></tr>`);
    }
    if (dupMode && !disp.length) {
      document.querySelector('#timesheetTable tbody').innerHTML =
        `<tr><td colspan="12" style="text-align:center;color:#888">Không tìm thấy dòng trùng lặp nào (theo bộ lọc hiện tại) 🎉</td></tr>`;
    }

    // sum over ALL filtered rows (not just the 500 displayed)
    const sums = disp.reduce((s, d) => ({
      normal: s.normal + d.r.normal, ot1: s.ot1 + d.r.ot1, ot2: s.ot2 + d.r.ot2, ot3: s.ot3 + d.r.ot3,
    }), { normal: 0, ot1: 0, ot2: 0, ot3: 0 });
    const grand = sums.normal + sums.ot1 + sums.ot2 + sums.ot3;
    document.querySelector('#timesheetTable tfoot').innerHTML = `
      <tr>
        <td colspan="6">Tổng (${disp.length} dòng)</td>
        <td class="num">${fmt(sums.normal)}</td>
        <td class="num">${fmt(sums.ot1)}</td>
        <td class="num">${fmt(sums.ot2)}</td>
        <td class="num">${fmt(sums.ot3)}</td>
        <td colspan="2"><b>Tổng cộng: ${fmt(grand)}</b></td>
      </tr>`;

    document.querySelectorAll('#timesheetTable .row-chk').forEach(chk => chk.addEventListener('change', () => {
      const id = +chk.dataset.id;
      if (chk.checked) selected.add(id); else selected.delete(id);
      updateSelectionUI();
    }));
    document.querySelectorAll('#timesheetTable [data-edit]').forEach(b => b.addEventListener('click', () => openForm(+b.dataset.edit)));
    document.querySelectorAll('#timesheetTable [data-del]').forEach(b => b.addEventListener('click', () => remove(+b.dataset.del)));
    updateSelectionUI();
  }

  function updateSelectionUI() {
    const btn = document.getElementById('btnDelSelTs');
    btn.style.display = selected.size ? '' : 'none';
    btn.textContent = `Xoá đã chọn (${selected.size})`;
    const chkAll = document.getElementById('tsChkAll');
    chkAll.checked = lastFilteredIds.length > 0 && lastFilteredIds.every(id => selected.has(id));
  }

  async function removeSelected() {
    if (!selected.size) return;
    if (!confirm(`Xoá ${selected.size} dòng bảng công đã chọn?`)) return;
    await Backup.snapshot(`Trước khi xoá ${selected.size} dòng bảng công (tự động)`);
    const store = (await DB.open()).transaction('timesheets', 'readwrite').objectStore('timesheets');
    await new Promise((resolve, reject) => {
      const tx = store.transaction;
      selected.forEach(id => store.delete(id));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    await load();
    await Dashboard.reloadAndRefresh();
  }

  function openForm(id) {
    const r = id ? timesheets.find(x => x.id === id) : null;
    let empC = null, projC = null;
    const body = `
      <label class="full">Nhân viên
        <div id="f_emp_combo"></div>
      </label>
      <label class="full">Dự án
        <div id="f_proj_combo"></div>
      </label>
      <label>Ngày
        <input id="f_date" type="date" value="${r ? r.date : ''}">
      </label>
      <label>Hoạt động
        <input id="f_act" value="${r ? (r.activities || '') : ''}">
      </label>
      <label>Giờ thường (Normal)
        <input id="f_normal" type="number" step="0.5" value="${r ? r.normal : 0}">
      </label>
      <label>OT1
        <input id="f_ot1" type="number" step="0.5" value="${r ? r.ot1 : 0}">
      </label>
      <label>OT2
        <input id="f_ot2" type="number" step="0.5" value="${r ? r.ot2 : 0}">
      </label>
      <label>OT3
        <input id="f_ot3" type="number" step="0.5" value="${r ? r.ot3 : 0}">
      </label>
      <label class="full"><input id="f_fitter" type="checkbox" style="width:auto" ${r && r.isFitter ? 'checked' : ''}> Fitter</label>
      <label class="full"><input id="f_sitesup" type="checkbox" style="width:auto" ${r && r.isSiteSup ? 'checked' : ''}> Site Sup</label>
    `;
    Modal.open(r ? 'Sửa bảng công' : 'Thêm bảng công', body, async () => {
      const empId = empC.getValue();
      const date = document.getElementById('f_date').value;
      if (!empId || !date) { alert('Cần chọn nhân viên và ngày'); return false; }
      const wbsVal = projC.getValue();
      const actVal = document.getElementById('f_act').value;
      // chống nhập trùng: cùng nhân viên + ngày + dự án + hoạt động chỉ ghi nhận 1 dòng
      const dup = timesheets.find(t =>
        (!r || t.id !== r.id) &&
        t.empId === empId && t.date === date &&
        (t.wbs || '') === (wbsVal || '') &&
        String(t.activities || '') === String(actVal || ''));
      if (dup) {
        alert('Bảng công này đã được nhập trước đó (trùng nhân viên, ngày, dự án và hoạt động).\nChỉ ghi nhận 1 dòng — hãy sửa dòng đã có thay vì thêm mới.');
        return false;
      }
      const normal = parseFloat(document.getElementById('f_normal').value) || 0;
      const ot1 = parseFloat(document.getElementById('f_ot1').value) || 0;
      const ot2 = parseFloat(document.getElementById('f_ot2').value) || 0;
      const ot3 = parseFloat(document.getElementById('f_ot3').value) || 0;
      const record = {
        source: 'manual',
        empId,
        empName: employeeName(empId),
        date,
        wbs: wbsVal,
        activities: actVal,
        normal, ot1, ot2, ot3, ot4: 0, ot5: 0, ot6: 0, ot7: 0,
        total: normal + ot1 + ot2 + ot3,
        isFitter: document.getElementById('f_fitter').checked,
        isSiteSup: document.getElementById('f_sitesup').checked,
      };
      if (r) record.id = r.id;
      await DB.put('timesheets', record);
      await load();
      await Dashboard.reloadAndRefresh();
      return true;
    });

    // Modal.open renders synchronously, so the combo containers exist now
    empC = Combo.create(document.getElementById('f_emp_combo'), { placeholder: 'Gõ tên hoặc mã NV...' });
    const empItems = employees.map(e => ({ value: e.empId, label: `${e.fullName} (${e.empId})` }));
    if (r && r.empId && !employees.some(e => e.empId === r.empId)) {
      empItems.push({ value: r.empId, label: `${r.empName || r.empId} (${r.empId})` });
    }
    empC.setItems(empItems);
    projC = Combo.create(document.getElementById('f_proj_combo'), { placeholder: 'Không có dự án — gõ để tìm...' });
    projC.setItems(projects.map(p => ({ value: p.wbs, label: `${p.projectName} (${p.wbs})` })));
    if (r) { empC.setValue(r.empId); projC.setValue(r.wbs); }
  }

  async function remove(id) {
    if (!confirm('Xoá dòng bảng công này?')) return;
    await DB.remove('timesheets', id);
    await load();
    await Dashboard.reloadAndRefresh();
  }

  function wire() {
    document.getElementById('btnAddTimesheet').addEventListener('click', () => openForm(null));
    document.getElementById('btnFindDupTs').addEventListener('click', () => {
      dupMode = !dupMode;
      const btn = document.getElementById('btnFindDupTs');
      btn.textContent = dupMode ? '✕ Tắt lọc trùng lặp' : '🔍 Tìm trùng lặp';
      btn.classList.toggle('btn-primary', dupMode);
      btn.classList.toggle('btn-secondary', !dupMode);
      render();
    });
    document.getElementById('btnDelSelTs').addEventListener('click', removeSelected);
    document.getElementById('tsChkAll').addEventListener('change', (e) => {
      if (e.target.checked) lastFilteredIds.forEach(id => selected.add(id));
      else selected.clear();
      render();
    });
    document.getElementById('tsMonthFilter').addEventListener('change', render);
    // checkbox column + 10 filterable columns + action column
    colFilters = TableFilter.build(
      document.querySelector('#timesheetTable thead'),
      ['chk', true, true, true, true, true, true, true, true, true, true, false],
      render
    );
  }

  return { load, wire, reloadFilters };
})();
