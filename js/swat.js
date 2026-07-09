// Tab "SWAT Hour": nhúng công cụ tính giờ công lắp đặt (tools/swat-hour) và
// nối dữ liệu với TrackingTS. Toàn bộ danh sách công trình được đổ từ tab
// Dự án của TrackingTS vào ô "Tên công trình" (droplist) của công cụ — không
// còn nạp YAN_COM bằng tay. Chọn 1 công trình -> tự điền thông số kỹ thuật
// (từ specs) + giờ đã dùng (tổng bảng công theo WBS); công cụ tính xong trả
// kết quả -> hiển thị giờ định mức/còn lại, admin ghi thành Target giờ dự án.
const SwatPage = (() => {
  let projects = [];
  let timesheets = [];
  let lastResult = null;
  let currentWbs = '';

  function frame() { return document.getElementById('swatFrame'); }
  function swatWin() { const f = frame(); return f && f.contentWindow; }
  function swatApi() { try { const w = swatWin(); return (w && w.SWAT) || null; } catch (e) { return null; } }
  function fmtVN(n) { return (Math.round((+n || 0) * 10) / 10).toFixed(1).replace('.', ','); }

  async function load() {
    projects = await DB.getAll('projects');
    timesheets = await DB.getAll('timesheets');
    projects.sort((a, b) => (a.projectName || '').localeCompare(b.projectName || ''));
    pushList();
  }

  // giờ đã dùng của 1 dự án = tổng cột total của các dòng bảng công cùng WBS
  function usedHoursFor(wbs) {
    return Math.round(timesheets.filter(t => t.wbs === wbs)
      .reduce((s, t) => s + (+t.total || 0), 0) * 10) / 10;
  }

  function detectProduct(desc) {
    const d = (desc || '').toString().toLowerCase();
    if (d.includes('villa')) return 'villa';
    if (d.includes('5.0') || d.includes('es5') || d.includes('es 5')) return 'es50';
    return 's3300';
  }

  // lấy 1 giá trị specs theo nhiều tên khoá (bỏ dấu gạch/hoa-thường)
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

  // 1 dự án TrackingTS -> phần tử danh sách cho droplist của công cụ
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
      tsd: /low pit/i.test(spec(s, 'HSG_TYPE')) || /reduced head/i.test(spec(s, 'HSK_TYPE')),
      usedHours: usedHoursFor(p.wbs),
    };
  }

  // đổ danh sách công trình vào droplist "Tên công trình" của công cụ
  function pushList() {
    const api = swatApi();
    if (!api || typeof api.loadProjects !== 'function') return false;
    try { api.loadProjects(projects.map(toToolItem)); return true; } catch (e) { return false; }
  }

  // Dashboard đổi dự án -> chọn đúng công trình đó trong công cụ
  function pushProject(wbs) {
    const p = projects.find(x => x.wbs === wbs);
    const api = swatApi();
    if (!p || !api) return;
    currentWbs = wbs;
    try { api.setInputs(toToolItem(p)); renderResult(api.getResult()); } catch (e) { /* ignore */ }
  }

  function renderResult(r) {
    lastResult = r || null;
    if (r && r.project && r.project.ref) currentWbs = String(r.project.ref).trim();
    const box = document.getElementById('swatReadout');
    const btn = document.getElementById('swatWriteTarget');
    if (!r || !r.hours) {
      box.innerHTML = '<span class="swat-muted">Chọn công trình ở ô “Tên công trình” của công cụ bên dưới để tính giờ công định mức.</span>';
      btn.style.display = 'none';
      return;
    }
    const h = r.hours;
    box.innerHTML = `
      <div class="swat-stat"><span>Công trình</span><b class="swat-small">${r.project.name || '-'}</b></div>
      <div class="swat-stat"><span>Giờ định mức / thang</span><b>${fmtVN(h.standard_per_unit)}</b></div>
      <div class="swat-stat"><span>Giờ định mức toàn dự án</span><b>${fmtVN(h.standard_whole_project)}</b></div>
      <div class="swat-stat"><span>Đã dùng (bảng công)</span><b>${fmtVN(h.used)}</b></div>
      <div class="swat-stat"><span>Còn lại</span><b class="${(+h.remaining) < 0 ? 'swat-neg' : 'swat-pos'}">${fmtVN(h.remaining)}</b></div>
      <div class="swat-stat"><span>Đã dùng</span><b>${Math.round(h.used_pct || 0)}%</b></div>`;
    const known = currentWbs && projects.some(p => p.wbs === currentWbs);
    btn.style.display = (known && Auth.isAdmin()) ? '' : 'none';
    btn.textContent = `⤓ Ghi ${fmtVN(h.standard_whole_project)} thành Target giờ dự án`;
  }

  async function writeTarget() {
    if (!lastResult || !currentWbs) return;
    const target = Math.round((+lastResult.hours.standard_whole_project || 0) * 10) / 10;
    const p = projects.find(x => x.wbs === currentWbs);
    if (!p) { alert('Không tìm thấy dự án tương ứng WBS ' + currentWbs + ' trong tab Dự án.'); return; }
    if (!confirm(`Ghi Target giờ của dự án "${p.projectName}" (WBS ${p.wbs}) = ${fmtVN(target)} giờ?`)) return;
    p.targetHour = target;
    p.targetHourManual = true;
    await DB.put('projects', p);
    await load();
    await Dashboard.reloadAndRefresh();
    alert('Đã cập nhật Target giờ. Kiểm tra lại trên Dashboard' +
      (typeof Cloud !== 'undefined' && Cloud.canWrite && Cloud.canWrite() ? ' rồi bấm "Lưu lên Drive" để xuất bản.' : '.'));
  }

  // Dashboard gọi khi người dùng đổi dự án đang chọn, để đồng bộ sang tab SWAT
  function syncFromDashboard(wbs) { if (wbs) pushProject(wbs); }

  function wire() {
    document.getElementById('swatWriteTarget').addEventListener('click', writeTarget);
    // công cụ tự tính lại (chọn công trình / chỉnh thông số) -> cập nhật readout
    window.addEventListener('message', (ev) => {
      const d = ev.data;
      if (d && d.type === 'SWAT_RESULT') renderResult(d.data);
    });
    // khi iframe nạp xong -> đổ danh sách công trình và đồng bộ dự án đang chọn
    const f = frame();
    if (f) f.addEventListener('load', () => { pushList(); if (currentWbs) pushProject(currentWbs); });
    pushList();
    renderResult(null);
  }

  return { load, wire, syncFromDashboard };
})();
