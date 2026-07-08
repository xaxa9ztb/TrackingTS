const EmployeesPage = (() => {
  let employees = [];
  let colFilters = [];
  let selected = new Set();
  let lastFilteredIds = [];

  // EE Data dates arrive either as Excel serials ("39760") or "m.d.yyyy" strings -> dd/mm/yyyy
  function fmtShortDate(v) {
    if (v === undefined || v === null || v === '') return '';
    const s = String(v).trim();
    const pad = n => String(n).padStart(2, '0');
    if (/^\d+(\.\d+)?$/.test(s) && parseFloat(s) > 20000) {
      const d = new Date(Math.round((parseFloat(s) - 25569) * 86400 * 1000));
      return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
    }
    let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) return `${pad(m[2])}/${pad(m[1])}/${m[3]}`;
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return s;
  }

  async function load() {
    selected.clear();
    employees = await DB.getAll('employees');
    employees.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
    render();
  }

  function render() {
    const q = (document.getElementById('employeeSearch').value || '').toLowerCase();
    const disp = employees
      .filter(e => (e.fullName || '').toLowerCase().includes(q) || (e.empId || '').toLowerCase().includes(q))
      .map(e => ({
        e,
        cells: [e.empId, e.fullName || '', e.position || '', e.supervisor || '', fmtShortDate(e.hireDate), fmtShortDate(e.startDate)],
      }))
      .filter(d => TableFilter.match(colFilters, d.cells, 1));

    lastFilteredIds = disp.map(d => d.e.empId);

    document.querySelector('#employeesTable tbody').innerHTML = disp.map(d => `
      <tr>
        <td class="chk-col"><input type="checkbox" class="row-chk" data-id="${d.e.empId}" ${selected.has(d.e.empId) ? 'checked' : ''}></td>
        ${d.cells.map(c => `<td>${c}</td>`).join('')}
        <td>
          <button class="btn-icon" data-edit="${d.e.empId}">✏️</button>
          <button class="btn-icon" data-del="${d.e.empId}">🗑️</button>
        </td>
      </tr>`).join('');

    document.querySelectorAll('#employeesTable .row-chk').forEach(chk => chk.addEventListener('change', () => {
      if (chk.checked) selected.add(chk.dataset.id); else selected.delete(chk.dataset.id);
      updateSelectionUI();
    }));
    updateSelectionUI();

    document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openForm(b.dataset.edit)));
    document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => remove(b.dataset.del)));
  }

  function openForm(empId) {
    const e = empId ? employees.find(x => x.empId === empId) : null;
    const body = `
      <label class="full">Mã NV${e ? '' : ' *'}
        <input id="f_id" value="${e ? e.empId : ''}" ${e ? 'readonly' : ''}>
      </label>
      <label class="full">Họ tên
        <input id="f_name" value="${e ? (e.fullName || '') : ''}">
      </label>
      <label>Chức danh
        <input id="f_pos" value="${e ? (e.position || '') : ''}">
      </label>
      <label>Quản lý trực tiếp
        <input id="f_sup" value="${e ? (e.supervisor || '') : ''}">
      </label>
      <label>Ngày vào làm
        <input id="f_hire" value="${e ? (e.hireDate || '') : ''}">
      </label>
      <label>Ngày bắt đầu
        <input id="f_start" value="${e ? (e.startDate || '') : ''}">
      </label>
      <label>Giới tính
        <input id="f_gender" value="${e ? (e.gender || '') : ''}">
      </label>
    `;
    Modal.open(e ? 'Sửa nhân viên' : 'Thêm nhân viên', body, async () => {
      const idVal = (document.getElementById('f_id').value || '').trim();
      if (!idVal) { alert('Mã NV là bắt buộc'); return false; }
      const record = {
        ...(e || {}),
        empId: idVal,
        fullName: document.getElementById('f_name').value,
        position: document.getElementById('f_pos').value,
        supervisor: document.getElementById('f_sup').value,
        hireDate: document.getElementById('f_hire').value,
        startDate: document.getElementById('f_start').value,
        gender: document.getElementById('f_gender').value,
      };
      await DB.put('employees', record);
      await load();
      await Dashboard.reloadAndRefresh();
      await TimesheetPage.reloadFilters();
      return true;
    });
  }

  async function remove(empId) {
    if (!confirm(`Xoá nhân viên ${empId}?`)) return;
    await DB.remove('employees', empId);
    await load();
    await Dashboard.reloadAndRefresh();
    await TimesheetPage.reloadFilters();
  }

  function updateSelectionUI() {
    const btn = document.getElementById('btnDelSelEmployees');
    btn.style.display = selected.size ? '' : 'none';
    btn.textContent = `Xoá đã chọn (${selected.size})`;
    const chkAll = document.getElementById('empChkAll');
    chkAll.checked = lastFilteredIds.length > 0 && lastFilteredIds.every(id => selected.has(id));
  }

  async function removeSelected() {
    if (!selected.size) return;
    if (!confirm(`Xoá ${selected.size} nhân viên đã chọn?`)) return;
    await Backup.snapshot(`Trước khi xoá ${selected.size} nhân viên (tự động)`);
    for (const id of selected) await DB.remove('employees', id);
    await load();
    await Dashboard.reloadAndRefresh();
    await TimesheetPage.reloadFilters();
  }

  function wire() {
    document.getElementById('btnAddEmployee').addEventListener('click', () => openForm(null));
    document.getElementById('btnDelSelEmployees').addEventListener('click', removeSelected);
    document.getElementById('empChkAll').addEventListener('change', (e) => {
      if (e.target.checked) lastFilteredIds.forEach(id => selected.add(id));
      else selected.clear();
      render();
    });
    document.getElementById('employeeSearch').addEventListener('input', render);
    colFilters = TableFilter.build(
      document.querySelector('#employeesTable thead'),
      ['chk', true, true, true, true, true, true, false],
      render
    );
  }

  return { load, wire };
})();
