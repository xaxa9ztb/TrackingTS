const Dashboard = (() => {
  let projects = [];
  let employeesById = {};
  let allTimesheets = [];
  let projectDateBounds = { min: null, max: null };
  let projCombo = null;

  // roles per user spec: sitesup = position title is supervisor / project engineer / project manager
  const SUP_TITLES = /superv|project\s*engineer|project\s*manager/i;

  function fmtVN(n) {
    return (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
  }
  function fmtPct(n) {
    return (Math.round(n * 10) / 10).toFixed(1).replace('.', ',') + '%';
  }

  function els() {
    return {
      chkSiteSup: document.getElementById('chkSiteSup'),
      chkFitter: document.getElementById('chkFitter'),
      dateFrom: document.getElementById('dateFrom'),
      dateTo: document.getElementById('dateTo'),
      sliderFrom: document.getElementById('sliderFrom'),
      sliderTo: document.getElementById('sliderTo'),
      targetHourInput: document.getElementById('targetHourInput'),
    };
  }

  async function loadData() {
    projects = await DB.getAll('projects');
    projects.sort((a, b) => (a.projectName || '').localeCompare(b.projectName || ''));
    const employees = await DB.getAll('employees');
    employeesById = {};
    employees.forEach(e => employeesById[e.empId] = e);
    allTimesheets = await DB.getAll('timesheets');
  }

  function populateProjectCombo() {
    if (!projCombo) return;
    projCombo.setItems(projects.map(p => ({ value: p.wbs, label: `${p.projectName} (${p.wbs})` })));
  }

  // name resolved from EE Data by employee id, so typos in TS All don't matter
  function displayName(empId, fallback) {
    const e = employeesById[empId];
    return e ? e.fullName : (fallback || empId);
  }

  function isSupRole(empId) {
    const e = employeesById[empId];
    return !!(e && SUP_TITLES.test(e.position || ''));
  }

  function rowsForProject(wbs) {
    return allTimesheets.filter(t => t.wbs === wbs);
  }

  function updateDateBoundsForProject(wbs) {
    const rows = rowsForProject(wbs).filter(r => r.date);
    if (rows.length === 0) {
      projectDateBounds = { min: null, max: null };
      return;
    }
    const dates = rows.map(r => r.date).sort();
    projectDateBounds = { min: dates[0], max: dates[dates.length - 1] };
    const { dateFrom, dateTo } = els();
    dateFrom.min = projectDateBounds.min; dateFrom.max = projectDateBounds.max;
    dateTo.min = projectDateBounds.min; dateTo.max = projectDateBounds.max;
    dateFrom.value = projectDateBounds.min;
    dateTo.value = projectDateBounds.max;
  }

  function dateToPct(dateStr) {
    const { min, max } = projectDateBounds;
    if (!min || !max || min === max) return 0;
    const t = new Date(dateStr).getTime();
    const t0 = new Date(min).getTime(), t1 = new Date(max).getTime();
    return Math.round(((t - t0) / (t1 - t0)) * 100);
  }
  function pctToDate(pct) {
    const { min, max } = projectDateBounds;
    if (!min || !max) return '';
    const t0 = new Date(min).getTime(), t1 = new Date(max).getTime();
    const t = t0 + (t1 - t0) * (pct / 100);
    return new Date(t).toISOString().slice(0, 10);
  }

  function syncSlidersFromDates() {
    const { dateFrom, dateTo, sliderFrom, sliderTo } = els();
    if (!projectDateBounds.min) return;
    sliderFrom.value = dateToPct(dateFrom.value || projectDateBounds.min);
    sliderTo.value = dateToPct(dateTo.value || projectDateBounds.max);
  }

  function refresh() {
    const { chkSiteSup, chkFitter, dateFrom, dateTo, targetHourInput } = els();
    const wbs = projCombo ? projCombo.getValue() : '';
    const project = projects.find(p => p.wbs === wbs);

    document.getElementById('statWbs').textContent = wbs || '-';
    targetHourInput.value = project ? (project.targetHour || 0) : 0;

    if (!wbs) {
      renderEmpty();
      return;
    }

    let rows = rowsForProject(wbs);
    if (dateFrom.value) rows = rows.filter(r => r.date >= dateFrom.value);
    if (dateTo.value) rows = rows.filter(r => r.date <= dateTo.value);

    // role filter based on EE Data position title:
    // sitesup only -> supervisor/PE/PM group; fitter only -> everyone else; both/none -> all
    const supSel = chkSiteSup.checked, fitSel = chkFitter.checked;
    let mainRows = rows;
    if (supSel && !fitSel) mainRows = rows.filter(r => isSupRole(r.empId));
    else if (fitSel && !supSel) mainRows = rows.filter(r => !isSupRole(r.empId));

    // group by employee id
    const byEmp = {};
    mainRows.forEach(r => {
      if (!byEmp[r.empId]) byEmp[r.empId] = { empId: r.empId, name: displayName(r.empId, r.empName), normal: 0, ot1: 0, ot2: 0, ot3: 0, total: 0 };
      const g = byEmp[r.empId];
      g.normal += r.normal; g.ot1 += r.ot1; g.ot2 += r.ot2; g.ot3 += r.ot3;
      g.total += r.total;
    });
    const empRows = Object.values(byEmp).sort((a, b) => b.total - a.total);
    const grand = empRows.reduce((s, e) => s + e.total, 0);

    renderPie(empRows);
    renderTable(empRows, grand);
    renderActivities(mainRows, grand);

    const normalTotal = empRows.reduce((s, e) => s + e.normal, 0);
    const ot1Total = empRows.reduce((s, e) => s + e.ot1, 0);
    const ot2Total = empRows.reduce((s, e) => s + e.ot2, 0);
    const ot3Total = empRows.reduce((s, e) => s + e.ot3, 0);

    document.getElementById('statNormalTotal').textContent = fmtVN(normalTotal);
    document.getElementById('statGrandTotal').textContent = fmtVN(grand);
    document.getElementById('statOT1').textContent = fmtVN(ot1Total);
    document.getElementById('statOT2').textContent = fmtVN(ot2Total);
    document.getElementById('statOT3').textContent = fmtVN(ot3Total);

    const siteSupEl = document.getElementById('statSiteSupName');
    siteSupEl.textContent = (project && project.supervisor) ? project.supervisor : '-';
    siteSupEl.title = (project && project.supervisor) || '';

    const target = project ? (project.targetHour || 0) : 0;
    Charts.renderGauge(document.getElementById('gaugeSvg'), grand, target);
    document.getElementById('gaugeValue').textContent = fmtVN(grand);
    document.getElementById('gaugeMin').textContent = '0';
    document.getElementById('gaugeMax').textContent = fmtVN(target);
  }

  function renderEmpty() {
    Charts.renderPie(document.getElementById('pieChart'), []);
    Charts.renderPie(document.getElementById('actPieChart'), []);
    document.querySelector('#empTable tbody').innerHTML = '';
    document.querySelector('#empTable tfoot').innerHTML = '';
    document.querySelector('#actTable tbody').innerHTML = '';
    document.querySelector('#actTable tfoot').innerHTML = '';
    ['statNormalTotal', 'statGrandTotal', 'statOT1', 'statOT2', 'statOT3'].forEach(id => document.getElementById(id).textContent = '0,0');
    document.getElementById('statSiteSupName').textContent = '-';
    Charts.renderGauge(document.getElementById('gaugeSvg'), 0, 0);
    document.getElementById('gaugeValue').textContent = '0,0';
  }

  function renderPie(empRows) {
    const slices = empRows.map((e, i) => ({ label: e.name, value: e.total, color: Charts.colorFor(i) }));
    Charts.renderPie(document.getElementById('pieChart'), slices);
  }

  function renderTable(empRows, grand) {
    const tbody = document.querySelector('#empTable tbody');
    tbody.innerHTML = empRows.map(e =>
      `<tr><td>${e.name}</td><td>${e.empId}</td><td class="num">${fmtVN(e.normal)}</td><td class="num">${fmtVN(e.ot1)}</td><td class="num">${fmtVN(e.ot2)}</td><td class="num">${fmtVN(e.ot3)}</td><td class="num">${fmtVN(e.total)}</td><td class="num">${grand > 0 ? fmtPct(e.total / grand * 100) : '-'}</td></tr>`
    ).join('');
    const totals = empRows.reduce((s, e) => ({
      normal: s.normal + e.normal, ot1: s.ot1 + e.ot1, ot2: s.ot2 + e.ot2, ot3: s.ot3 + e.ot3, total: s.total + e.total
    }), { normal: 0, ot1: 0, ot2: 0, ot3: 0, total: 0 });
    document.querySelector('#empTable tfoot').innerHTML =
      `<tr><td>Tổng</td><td></td><td class="num">${fmtVN(totals.normal)}</td><td class="num">${fmtVN(totals.ot1)}</td><td class="num">${fmtVN(totals.ot2)}</td><td class="num">${fmtVN(totals.ot3)}</td><td class="num">${fmtVN(totals.total)}</td><td class="num">100%</td></tr>`;
  }

  function renderActivities(mainRows, grand) {
    const byAct = {};
    mainRows.forEach(r => {
      const key = (r.activities && r.activities !== '#N/A') ? String(r.activities) : '(không có)';
      byAct[key] = (byAct[key] || 0) + r.total;
    });
    const actRows = Object.entries(byAct)
      .map(([act, hours]) => ({ act, hours }))
      .filter(a => a.hours > 0)
      .sort((a, b) => b.hours - a.hours);

    document.querySelector('#actTable tbody').innerHTML = actRows.map(a =>
      `<tr><td>${a.act}</td><td class="num">${fmtVN(a.hours)}</td><td class="num">${grand > 0 ? fmtPct(a.hours / grand * 100) : '-'}</td></tr>`
    ).join('');
    const total = actRows.reduce((s, a) => s + a.hours, 0);
    document.querySelector('#actTable tfoot').innerHTML =
      `<tr><td>Tổng</td><td class="num">${fmtVN(total)}</td><td class="num">100%</td></tr>`;

    const slices = actRows.map((a, i) => ({ label: a.act, value: a.hours, color: Charts.colorFor(i) }));
    Charts.renderPie(document.getElementById('actPieChart'), slices);
  }

  function wire() {
    const { chkSiteSup, chkFitter, dateFrom, dateTo, sliderFrom, sliderTo, targetHourInput } = els();

    projCombo = Combo.create(document.getElementById('projectCombo'), {
      placeholder: 'Chọn / gõ tên dự án hoặc WBS...',
      onChange: () => {
        updateDateBoundsForProject(projCombo.getValue());
        syncSlidersFromDates();
        refresh();
      },
    });

    chkSiteSup.addEventListener('change', refresh);
    chkFitter.addEventListener('change', refresh);
    dateFrom.addEventListener('change', () => { syncSlidersFromDates(); refresh(); });
    dateTo.addEventListener('change', () => { syncSlidersFromDates(); refresh(); });
    sliderFrom.addEventListener('input', () => {
      if (+sliderFrom.value > +sliderTo.value) sliderFrom.value = sliderTo.value;
      dateFrom.value = pctToDate(+sliderFrom.value);
      refresh();
    });
    sliderTo.addEventListener('input', () => {
      if (+sliderTo.value < +sliderFrom.value) sliderTo.value = sliderFrom.value;
      dateTo.value = pctToDate(+sliderTo.value);
      refresh();
    });
    targetHourInput.addEventListener('change', async () => {
      const wbs = projCombo.getValue();
      const project = projects.find(p => p.wbs === wbs);
      if (!project) return;
      project.targetHour = parseFloat(targetHourInput.value) || 0;
      project.targetHourManual = true;
      await DB.put('projects', project);
      refresh();
    });
    window.addEventListener('resize', refresh);
  }

  async function init() {
    await loadData();
    wire();
    populateProjectCombo();
    renderEmpty();
  }

  async function reloadAndRefresh() {
    await loadData();
    populateProjectCombo();
    refresh();
  }

  return { init, reloadAndRefresh, refresh };
})();
