const ProjectsPage = (() => {
  let projects = [];
  let colFilters = [];
  let builtHeaderKey = null;

  async function load() {
    projects = await DB.getAll('projects');
    projects.sort((a, b) => (a.projectName || '').localeCompare(b.projectName || ''));
    render();
  }

  function fmt(n) { return (Math.round((n || 0) * 100) / 100).toLocaleString('vi-VN'); }

  function specHeaders() {
    try {
      const stored = JSON.parse(localStorage.getItem('specHeaders') || 'null');
      if (stored && stored.length) return stored;
    } catch (e) { /* ignore */ }
    // fall back to keys of the first project that has specs
    const withSpecs = projects.find(p => p.specs && Object.keys(p.specs).length);
    return withSpecs ? Object.keys(withSpecs.specs) : [];
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
      '<tr><th>WBS Element</th><th>Project Number</th><th>Project Name</th><th>Customer</th><th>Product Line</th><th>Giám sát</th>' +
      headers.map(h => `<th>${SPEC_DISPLAY[h] || h}</th>`).join('') +
      '<th></th></tr>';
    const cols = new Array(6 + headers.length).fill(true).concat([false]);
    colFilters = TableFilter.build(thead, cols, render);
  }

  function render() {
    const q = (document.getElementById('projectSearch').value || '').toLowerCase();
    const headers = specHeaders();
    buildHead(headers);

    const disp = projects
      .filter(p => (p.projectName || '').toLowerCase().includes(q) || (p.wbs || '').toLowerCase().includes(q))
      .map(p => ({
        p,
        cells: [
          p.wbs, p.projectNumber || '', p.projectName || '', p.customer || '', p.productLine || '',
          p.supervisor || '',
          ...headers.map(h => (p.specs && p.specs[h]) || ''),
        ],
      }))
      .filter(d => TableFilter.match(colFilters, d.cells));

    document.querySelector('#projectsTable tbody').innerHTML = disp.map(d => `
      <tr>
        ${d.cells.map((c, i) => {
          const cls = (i === 2 || i === 3) ? ' class="col-name"' : '';
          return `<td${cls}>${c}</td>`;
        }).join('')}
        <td class="col-actions">
          <button class="btn-icon" data-edit="${d.p.wbs}">✏️</button>
          <button class="btn-icon" data-del="${d.p.wbs}">🗑️</button>
        </td>
      </tr>`).join('');

    document.querySelectorAll('#projectsTable [data-edit]').forEach(b => b.addEventListener('click', () => openForm(b.dataset.edit)));
    document.querySelectorAll('#projectsTable [data-del]').forEach(b => b.addEventListener('click', () => remove(b.dataset.del)));
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
      await DB.put('projects', record);
      await load();
      await Dashboard.reloadAndRefresh();
      return true;
    });
  }

  async function remove(wbs) {
    if (!confirm(`Xoá dự án ${wbs}?`)) return;
    await DB.remove('projects', wbs);
    await load();
    await Dashboard.reloadAndRefresh();
  }

  function wire() {
    document.getElementById('btnAddProject').addEventListener('click', () => openForm(null));
    document.getElementById('projectSearch').addEventListener('input', render);
  }

  return { load, wire };
})();
