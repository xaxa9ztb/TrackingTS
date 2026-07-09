// Tab "SWAT Hour": nhúng công cụ tính giờ công lắp đặt (tools/swat-hour) và
// nối dữ liệu 2 chiều với TrackingTS.
//  - Chọn 1 dự án ở đây (hoặc đồng bộ từ Dashboard) -> đổ thông số kỹ thuật
//    (từ specs YAN_COM) + giờ đã dùng (tổng bảng công theo WBS) sang công cụ.
//  - Công cụ tính xong trả về giờ định mức / còn lại -> hiển thị lại; có nút
//    ghi "giờ định mức toàn dự án" thành Target giờ của dự án.
const SwatPage = (() => {
  let projects = [];
  let timesheets = [];
  let combo = null;
  let lastResult = null;
  let currentWbs = '';

  function frame() { return document.getElementById('swatFrame'); }
  function swatWin() { const f = frame(); return f && f.contentWindow; }

  function fmtVN(n) { return (Math.round((+n || 0) * 10) / 10).toFixed(1).replace('.', ','); }

  function populateCombo() {
    if (combo) combo.setItems(projects.map(p => ({ value: p.wbs, label: `${p.projectName} (${p.wbs})` })));
  }

  async function load() {
    projects = await DB.getAll('projects');
    timesheets = await DB.getAll('timesheets');
    projects.sort((a, b) => (a.projectName || '').localeCompare(b.projectName || ''));
    populateCombo();
  }

  // giờ đã dùng của 1 dự án = tổng cột total của các dòng bảng công cùng WBS
  function usedHoursFor(wbs) {
    return timesheets.filter(t => t.wbs === wbs)
      .reduce((s, t) => s + (+t.total || 0), 0);
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

  // xây payload SWAT_SET từ 1 dự án TrackingTS. Chỉ đưa các ô có dữ liệu thật
  // để không ghi đè giá trị mặc định / người dùng tự nhập bằng số 0.
  function projectToInputs(p) {
    const s = p.specs || {};
    const m = {
      pname: p.projectName || '',
      pref: p.projectNumber || p.wbs || '',
      product: detectProduct(p.productLine),
      usedHours: Math.round(usedHoursFor(p.wbs) * 10) / 10,
    };
    const put = (id, val, div) => {
      const n = numTok(val);
      if (n != null) m[id] = div ? Math.round((n / div) * 100) / 100 : n;
    };
    put('stops', spec(s, 'NUMBER_OF_STOPS', 'NUMBEROFSTOPS', 'STOPS'));
    put('load', spec(s, 'GQ'));
    put('speed', spec(s, 'VKN'));
    put('travel', spec(s, 'HQ'));
    put('pit', spec(s, 'HSG'), 1000);
    put('over', spec(s, 'HSK'), 1000);
    put('shaft', spec(s, 'TS_MIN'), 1000);
    put('befshape', spec(s, 'BRANCH_EFFICIENCY_FACTOR', 'BEF'));
    put('shape', spec(s, 'INST_TIME_STANDARD'));
    return m;
  }

  // đẩy dự án sang công cụ, đọc kết quả trả về (dùng API trực tiếp cùng origin,
  // fallback postMessage nếu bị chặn)
  function pushProject(wbs) {
    const p = projects.find(x => x.wbs === wbs);
    if (!p) return;
    currentWbs = wbs;
    const inputs = projectToInputs(p);
    const w = swatWin();
    try {
      if (w && w.SWAT && typeof w.SWAT.setInputs === 'function') {
        w.SWAT.setInputs(inputs);
        renderResult(w.SWAT.getResult());
        return;
      }
    } catch (e) { /* khác origin -> dùng postMessage */ }
    if (w) w.postMessage({ type: 'SWAT_SET', data: inputs }, '*');
  }

  function renderResult(r) {
    lastResult = r || null;
    const box = document.getElementById('swatReadout');
    const btn = document.getElementById('swatWriteTarget');
    if (!r || !r.hours) {
      box.innerHTML = '<span class="swat-muted">Chọn một dự án để tính giờ công định mức.</span>';
      btn.style.display = 'none';
      return;
    }
    const h = r.hours;
    box.innerHTML = `
      <div class="swat-stat"><span>Giờ định mức / thang</span><b>${fmtVN(h.standard_per_unit)}</b></div>
      <div class="swat-stat"><span>Giờ định mức toàn dự án</span><b>${fmtVN(h.standard_whole_project)}</b></div>
      <div class="swat-stat"><span>Đã dùng (bảng công)</span><b>${fmtVN(h.used)}</b></div>
      <div class="swat-stat"><span>Còn lại</span><b class="${(+h.remaining) < 0 ? 'swat-neg' : 'swat-pos'}">${fmtVN(h.remaining)}</b></div>
      <div class="swat-stat"><span>Đã dùng</span><b>${Math.round(h.used_pct || 0)}%</b></div>`;
    btn.style.display = (currentWbs && Auth.isAdmin()) ? '' : 'none';
    btn.textContent = `⤓ Ghi ${fmtVN(h.standard_whole_project)} thành Target giờ dự án`;
  }

  async function writeTarget() {
    if (!lastResult || !currentWbs) return;
    const target = Math.round((+lastResult.hours.standard_whole_project || 0) * 10) / 10;
    const p = projects.find(x => x.wbs === currentWbs);
    if (!p) return;
    if (!confirm(`Ghi Target giờ của dự án "${p.projectName}" = ${fmtVN(target)} giờ?`)) return;
    p.targetHour = target;
    p.targetHourManual = true;
    await DB.put('projects', p);
    await load();
    await Dashboard.reloadAndRefresh();
    alert('Đã cập nhật Target giờ. Kiểm tra lại trên Dashboard' +
      (Cloud && Cloud.canWrite && Cloud.canWrite() ? ' rồi bấm "Lưu lên Drive" để xuất bản.' : '.'));
  }

  // Dashboard gọi khi người dùng đổi dự án đang chọn, để đồng bộ sang tab SWAT
  function syncFromDashboard(wbs) {
    if (!wbs || !combo) return;
    combo.setValue(wbs);
    pushProject(wbs);
  }

  function wire() {
    combo = Combo.create(document.getElementById('swatProjectCombo'), {
      placeholder: 'Chọn dự án để tính giờ công...',
      onChange: () => { const v = combo.getValue(); if (v) pushProject(v); else renderResult(null); },
    });
    populateCombo(); // đổ danh sách dự án (load() có thể đã chạy trước khi combo tồn tại)
    document.getElementById('swatWriteTarget').addEventListener('click', writeTarget);
    // khi công cụ tự tính lại (người dùng chỉnh trong iframe) -> cập nhật readout
    window.addEventListener('message', (ev) => {
      const d = ev.data;
      if (d && d.type === 'SWAT_RESULT') renderResult(d.data);
    });
    // nạp lại danh sách dự án vào combo khi iframe đã sẵn sàng
    const f = frame();
    if (f) f.addEventListener('load', () => { if (currentWbs) pushProject(currentWbs); });
    renderResult(null);
  }

  return { load, wire, syncFromDashboard };
})();
