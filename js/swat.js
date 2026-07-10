// Tab "SWAT Hour": nhúng công cụ tính giờ công lắp đặt (tools/swat-hour) ở chế
// độ toàn màn hình. Danh sách công trình (chỉ dòng sản phẩm SWAT áp dụng) +
// danh sách người (để dựng mục 6 - tiền thưởng) được đổ từ tab Dự án / bảng
// công của TrackingTS sang công cụ. Công cụ tính -> trả kết quả; admin ghi giờ
// định mức thành Target giờ dự án (đánh dấu "đã cập nhật Swat").
const SwatPage = (() => {
  let projects = [];
  let timesheets = [];
  let employeesById = {};
  let lastResult = null;
  let currentWbs = '';

  const SUP_TITLES = /superv|project\s*engineer|project\s*manager/i;

  function frame() { return document.getElementById('swatFrame'); }
  function swatWin() { const f = frame(); return f && f.contentWindow; }
  function swatApi() { try { const w = swatWin(); return (w && w.SWAT) || null; } catch (e) { return null; } }
  function fmtVN(n) { return (Math.round((+n || 0) * 10) / 10).toFixed(1).replace('.', ','); }

  async function load() {
    projects = await DB.getAll('projects');
    timesheets = await DB.getAll('timesheets');
    const emps = await DB.getAll('employees');
    employeesById = {};
    emps.forEach(e => employeesById[e.empId] = e);
    projects.sort((a, b) => (a.projectName || '').localeCompare(b.projectName || ''));
    pushList();
  }

  function usedHoursFor(wbs) {
    return Math.round(timesheets.filter(t => t.wbs === wbs)
      .reduce((s, t) => s + (+t.total || 0), 0) * 10) / 10;
  }

  // SWAT chỉ áp dụng cho: Schindler 3300, ES1.x -> s3300; ES5.0 -> es50;
  // Other Schindler Prod -> villa. Dòng khác -> '' (không áp dụng).
  function detectProduct(desc) {
    const d = (desc || '').toString().toLowerCase();
    if (!d) return '';
    if (d.includes('5.0') || d.includes('es5') || d.includes('es 5')) return 'es50';
    if (d.includes('3300') || d.includes('es1') || d.includes('es 1')) return 's3300';
    if (d.includes('other schindler') || d.includes('otherschindler')) return 'villa';
    return '';
  }
  function isSwatProject(p) { return !!detectProduct(p && p.productLine); }

  function spec(specs, ...keys) {
    if (!specs) return '';
    const norm = s => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const map = {};
    Object.keys(specs).forEach(k => { map[norm(k)] = specs[k]; });
    for (const k of keys) {
      const v = map[norm(k)];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return '';
  }
  function numTok(v) {
    if (v === '' || v == null) return null;
    const s = String(v).split('|')[0].replace(/,/g, '').replace(/\s/g, '').trim();
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  function toToolItem(p) {
    const s = p.specs || {};
    const div = (val, d) => { const n = numTok(val); return n == null ? '' : Math.round((n / d) * 100) / 100; };
    return {
      label: `${p.projectName || '(không tên)'} (${p.wbs})`,
      pname: p.projectName || '',
      pref: p.wbs || '',
      product: detectProduct(p.productLine),
      load: numTok(spec(s, 'GQ')) || '',
      speed: numTok(spec(s, 'VKN')) || '',
      stops: numTok(spec(s, 'NUMBER_OF_STOPS', 'NUMBEROFSTOPS', 'STOPS')) || '',
      travel: numTok(spec(s, 'HQ')) || '',
      pit: div(spec(s, 'HSG'), 1000),
      over: div(spec(s, 'HSK'), 1000),
      shaft: div(spec(s, 'TS_MIN'), 1000),
      bef: numTok(spec(s, 'BRANCH_EFFICIENCY_FACTOR', 'BEF')) || '',
      shape: numTok(spec(s, 'INST_TIME_STANDARD')) || '',
      tsd: /low\s*pit/i.test(spec(s, 'HSG_TYPE')) || /reduced\s*head/i.test(spec(s, 'HSK_TYPE')),
      usedHours: usedHoursFor(p.wbs),
      saved: p.swatState || null,   // trạng thái mục 1&2 đã "xác nhận Swat" (nếu có)
      confirmed: !!p.targetSwat,
    };
  }

  // danh sách người của 1 dự án (cho mục 6 trong công cụ)
  function peopleFor(wbs) {
    const byEmp = {};
    timesheets.filter(t => t.wbs === wbs).forEach(t => {
      if (!byEmp[t.empId]) byEmp[t.empId] = { empId: t.empId, name: (employeesById[t.empId] || {}).fullName || t.empName || t.empId, hours: 0 };
      byEmp[t.empId].hours += (+t.total || 0);
    });
    return Object.values(byEmp).map(e => ({
      empId: e.empId, name: e.name, hours: Math.round(e.hours * 10) / 10,
      role: (employeesById[e.empId] && SUP_TITLES.test(employeesById[e.empId].position || '')) ? 'sup' : 'fitter',
    }));
  }

  function pushList() {
    const api = swatApi();
    if (!api || typeof api.loadProjects !== 'function') return false;
    try { api.loadProjects(projects.filter(isSwatProject).map(toToolItem)); return true; } catch (e) { return false; }
  }
  function pushPeople(wbs) {
    const api = swatApi();
    if (!api || typeof api.setPeople !== 'function') return;
    try { api.setPeople(peopleFor(wbs)); } catch (e) { /* ignore */ }
  }

  function pushProject(wbs) {
    const p = projects.find(x => x.wbs === wbs);
    const api = swatApi();
    if (!p || !api || !isSwatProject(p)) return;
    currentWbs = wbs;
    try {
      // đảm bảo danh sách (kèm saved-state) đã có trong công cụ rồi chọn đúng dự án
      pushList();
      if (typeof api.selectProject === 'function') api.selectProject(wbs);
      else api.setInputs(toToolItem(p));
      pushPeople(wbs);
      renderResult(api.getResult());
    } catch (e) { /* ignore */ }
  }

  // nhận kết quả từ công cụ -> bật/tắt nút Ghi Swat Target (trong công cụ) + đẩy người
  function renderResult(r) {
    lastResult = r || null;
    if (r && r.project && r.project.ref) {
      const w = String(r.project.ref).trim();
      if (w && w !== currentWbs) { currentWbs = w; pushPeople(w); }
    }
    const api = swatApi();
    const known = currentWbs && projects.some(p => p.wbs === currentWbs);
    if (api && api.setCanWrite) { try { api.setCanWrite(!!(r && r.hours && known && Auth.isAdmin())); } catch (e) { /* ignore */ } }
  }

  async function writeTarget() {
    if (!Auth.isAdmin()) return;
    if (!lastResult || !currentWbs) return;
    const target = Math.round((+lastResult.hours.standard_whole_project || 0) * 10) / 10;
    const p = projects.find(x => x.wbs === currentWbs);
    if (!p) { alert('Không tìm thấy dự án tương ứng WBS ' + currentWbs + ' trong tab Dự án.'); return; }
    if (!confirm(`Ghi Swat Hour Target cho "${p.projectName}" (WBS ${p.wbs}) = ${fmtVN(target)} giờ?\nToàn bộ thông số mục 1 & 2 hiện tại sẽ được lưu cho dự án này.`)) return;
    // lưu Swat Hour Target riêng (KHÔNG ghi đè INS Time Total / targetHour) + thông số mục 1&2
    p.swatTargetHour = target;
    p.targetSwat = true;
    try { const api = swatApi(); if (api && api.getState) p.swatState = api.getState(); } catch (e) { /* ignore */ }
    await DB.put('projects', p);
    try { const api = swatApi(); if (api && api.setConfirmed) api.setConfirmed(true); } catch (e) { /* ignore */ }
    await load();
    await Dashboard.reloadAndRefresh();
    alert('Đã lưu Swat Hour Target và thông số mục 1 & 2 (đã xác nhận Swat Hour). Kiểm tra lại trên Dashboard' +
      (typeof Cloud !== 'undefined' && Cloud.canWrite && Cloud.canWrite() ? ' rồi bấm "Lưu lên Drive" để xuất bản.' : '.'));
  }

  // Báo cáo tổng quan: công cụ xin dữ liệu giờ công (fitter + activities) của dự
  // án đang xem -> gom số liệu (ưu tiên Dashboard, có fallback tự tính) -> gửi
  // ngược vào iframe để công cụ dựng trang PDF tổng quan.
  function localOverview(wbs) {
    const p = projects.find(x => x.wbs === wbs);
    const rows = timesheets.filter(t => t.wbs === wbs);
    const byEmp = {};
    rows.forEach(r => {
      if (!byEmp[r.empId]) byEmp[r.empId] = { empId: r.empId, name: (employeesById[r.empId] || {}).fullName || r.empName || r.empId, normal: 0, ot1: 0, ot2: 0, ot3: 0, total: 0 };
      const g = byEmp[r.empId];
      g.normal += +r.normal || 0; g.ot1 += +r.ot1 || 0; g.ot2 += +r.ot2 || 0; g.ot3 += +r.ot3 || 0; g.total += +r.total || 0;
    });
    const emp = Object.values(byEmp).sort((a, b) => b.total - a.total);
    const grand = emp.reduce((s, e) => s + e.total, 0);
    const byAct = {};
    rows.forEach(r => {
      const code = String(r.activities || '').trim().replace(/\s+/g, '');
      const key = (code && code !== '#N/A') ? code : '(không có)';
      byAct[key] = (byAct[key] || 0) + (+r.total || 0);
    });
    const act = Object.entries(byAct).map(([a, h]) => ({ act: a, name: '', hours: h })).filter(a => a.hours > 0).sort((a, b) => b.hours - a.hours);
    return {
      wbs, projectName: p ? p.projectName : '', supervisor: p ? p.supervisor : '', swatTargetHour: p ? (p.swatTargetHour || 0) : 0, grand,
      emp: emp.map(e => ({ name: e.name, empId: e.empId, normal: e.normal, ot1: e.ot1, ot2: e.ot2, ot3: e.ot3, total: e.total, pct: grand > 0 ? e.total / grand * 100 : 0 })),
      act: act.map(a => ({ act: a.act, name: a.name, hours: a.hours, pct: grand > 0 ? a.hours / grand * 100 : 0 })),
    };
  }
  function sendOverview() {
    const w = swatWin();
    const wbs = currentWbs;
    if (!w || !wbs) return;
    let data = null;
    try { if (typeof Dashboard !== 'undefined' && Dashboard.reportData) data = Dashboard.reportData(wbs); } catch (e) { /* ignore */ }
    if (!data || !data.emp) data = localOverview(wbs);
    try { w.postMessage({ type: 'SWAT_OVERVIEW_DATA', data }, '*'); } catch (e) { /* ignore */ }
  }

  function syncFromDashboard(wbs) { if (wbs) pushProject(wbs); }

  function wire() {
    window.addEventListener('message', (ev) => {
      const d = ev.data;
      if (!d) return;
      if (d.type === 'SWAT_RESULT') renderResult(d.data);
      else if (d.type === 'SWAT_WRITE_TARGET') writeTarget();
      else if (d.type === 'SWAT_OVERVIEW_REPORT') sendOverview();
    });
    const f = frame();
    if (f) f.addEventListener('load', () => { pushList(); if (currentWbs) pushProject(currentWbs); });
    pushList();
  }

  return { load, wire, syncFromDashboard };
})();
