// Tab "SWAT Hour": nhúng công cụ tính giờ công lắp đặt (tools/swat-hour) và
// nối dữ liệu với TrackingTS. Danh sách công trình đổ từ tab Dự án vào ô
// "Tên công trình" (droplist) — chỉ gồm dự án thuộc các dòng sản phẩm SWAT
// áp dụng. Chọn 1 công trình -> tự điền thông số + giờ đã dùng; công cụ tính
// -> hiển thị giờ định mức/còn lại + bảng dự kiến tiền thưởng từng người;
// admin ghi giờ định mức thành Target giờ dự án (đánh dấu "đã cập nhật Swat").
const SwatPage = (() => {
  let projects = [];
  let timesheets = [];
  let employeesById = {};
  let lastResult = null;
  let currentWbs = '';

  // giám sát: chức danh có superv / project engineer / project manager (như Dashboard)
  const SUP_TITLES = /superv|project\s*engineer|project\s*manager/i;

  function frame() { return document.getElementById('swatFrame'); }
  function swatWin() { const f = frame(); return f && f.contentWindow; }
  function swatApi() { try { const w = swatWin(); return (w && w.SWAT) || null; } catch (e) { return null; } }
  function fmtVN(n) { return (Math.round((+n || 0) * 10) / 10).toFixed(1).replace('.', ','); }
  function fmtMoney(n) { return (Math.round(+n || 0)).toLocaleString('vi-VN') + ' ₫'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

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

  // SWAT chỉ áp dụng cho: Schindler 3300, ES1.x -> S3300/ES1; ES5.0 -> ES 5.0;
  // Other Schindler Prod -> Villa Lift. Dòng khác -> '' (không áp dụng).
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
      // tự tích Bộ TSD nếu HSG Type = Low Pit hoặc HSK Type = Reduced Head
      tsd: /low\s*pit/i.test(spec(s, 'HSG_TYPE')) || /reduced\s*head/i.test(spec(s, 'HSK_TYPE')),
      usedHours: usedHoursFor(p.wbs),
    };
  }

  // đổ danh sách công trình (chỉ dòng sản phẩm SWAT áp dụng) vào droplist
  function pushList() {
    const api = swatApi();
    if (!api || typeof api.loadProjects !== 'function') return false;
    try { api.loadProjects(projects.filter(isSwatProject).map(toToolItem)); return true; } catch (e) { return false; }
  }

  function pushProject(wbs) {
    const p = projects.find(x => x.wbs === wbs);
    const api = swatApi();
    if (!p || !api || !isSwatProject(p)) return;
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
      renderBonus(null);
      return;
    }
    const h = r.hours;
    box.innerHTML = `
      <div class="swat-stat"><span>Công trình</span><b class="swat-small">${esc(r.project.name) || '-'}</b></div>
      <div class="swat-stat"><span>Giờ định mức / thang</span><b>${fmtVN(h.standard_per_unit)}</b></div>
      <div class="swat-stat"><span>Giờ định mức toàn dự án</span><b>${fmtVN(h.standard_whole_project)}</b></div>
      <div class="swat-stat"><span>Đã dùng (bảng công)</span><b>${fmtVN(h.used)}</b></div>
      <div class="swat-stat"><span>Còn lại</span><b class="${(+h.remaining) < 0 ? 'swat-neg' : 'swat-pos'}">${fmtVN(h.remaining)}</b></div>
      <div class="swat-stat"><span>Đã dùng</span><b>${Math.round(h.used_pct || 0)}%</b></div>`;
    const known = currentWbs && projects.some(p => p.wbs === currentWbs);
    btn.style.display = (known && Auth.isAdmin()) ? '' : 'none';
    btn.textContent = `⤓ Ghi ${fmtVN(h.standard_whole_project)} thành Target giờ dự án`;
    renderBonus(r);
  }

  // Bảng dự kiến tiền thưởng cho từng người của công trình đang chọn:
  //  - Fitter: chia thưởng Fitter theo tỉ lệ giờ công của người / tổng giờ fitter.
  //  - Supervisor: nhận phần thưởng Site-sup (chia đều nếu có nhiều giám sát).
  function renderBonus(r) {
    const wrap = document.getElementById('swatBonus');
    if (!wrap) return;
    if (!r || !r.incentive_2025 || !currentWbs) {
      wrap.innerHTML = '<div class="swat-muted" style="padding:6px 2px">Chưa có dữ liệu tiền thưởng — chọn công trình để tính.</div>';
      return;
    }
    const fitterPool = +r.incentive_2025.fitter_vnd || 0;
    const supPool = +r.incentive_2025.sitesup_vnd || 0;

    // gom giờ công theo nhân viên trên WBS này
    const byEmp = {};
    timesheets.filter(t => t.wbs === currentWbs).forEach(t => {
      if (!byEmp[t.empId]) byEmp[t.empId] = { empId: t.empId, name: (employeesById[t.empId] || {}).fullName || t.empName || t.empId, hours: 0 };
      byEmp[t.empId].hours += (+t.total || 0);
    });
    const people = Object.values(byEmp);
    const isSup = e => { const p = employeesById[e.empId]; return !!(p && SUP_TITLES.test(p.position || '')); };
    const sups = people.filter(isSup);
    const fitters = people.filter(e => !isSup(e));
    const totalFitH = fitters.reduce((s, e) => s + e.hours, 0);

    const rows = [];
    fitters.forEach(e => rows.push({ name: e.name, empId: e.empId, role: 'Fitter', hours: e.hours,
      pct: totalFitH > 0 ? e.hours / totalFitH * 100 : 0,
      bonus: totalFitH > 0 ? fitterPool * e.hours / totalFitH : 0 }));
    sups.forEach(e => rows.push({ name: e.name, empId: e.empId, role: 'Supervisor', hours: e.hours,
      pct: null, bonus: sups.length > 0 ? supPool / sups.length : 0 }));
    rows.sort((a, b) => b.bonus - a.bonus);

    if (!rows.length) {
      wrap.innerHTML = '<div class="swat-muted" style="padding:6px 2px">Công trình chưa có dòng bảng công nào để chia thưởng.</div>';
      return;
    }
    const totalBonus = rows.reduce((s, r0) => s + r0.bonus, 0);
    wrap.innerHTML = `
      <h3 class="swat-bonus-title">Dự kiến tiền thưởng theo người — ${esc(r.project.name)}</h3>
      <div class="swat-bonus-note">Fitter: chia theo tỉ lệ giờ công / tổng giờ fitter (tổng ${fmtMoney(fitterPool)}). Site-sup: ${fmtMoney(supPool)}${sups.length > 1 ? ' (chia đều ' + sups.length + ' người)' : ''}. Số liệu tham khảo.</div>
      <div class="table-scroll" style="max-height:320px">
        <table class="data-table">
          <thead><tr><th>Tên NV</th><th>Mã NV</th><th>Vai trò</th><th class="num">Giờ công</th><th class="num">Tỉ lệ</th><th class="num">Tiền thưởng (VND)</th></tr></thead>
          <tbody>
            ${rows.map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.empId)}</td><td>${x.role}</td><td class="num">${fmtVN(x.hours)}</td><td class="num">${x.pct == null ? '-' : fmtVN(x.pct) + '%'}</td><td class="num">${fmtMoney(x.bonus)}</td></tr>`).join('')}
          </tbody>
          <tfoot><tr><td colspan="5">Tổng cộng (${rows.length} người)</td><td class="num"><b>${fmtMoney(totalBonus)}</b></td></tr></tfoot>
        </table>
      </div>`;
  }

  async function writeTarget() {
    if (!lastResult || !currentWbs) return;
    const target = Math.round((+lastResult.hours.standard_whole_project || 0) * 10) / 10;
    const p = projects.find(x => x.wbs === currentWbs);
    if (!p) { alert('Không tìm thấy dự án tương ứng WBS ' + currentWbs + ' trong tab Dự án.'); return; }
    if (!confirm(`Ghi Target giờ của dự án "${p.projectName}" (WBS ${p.wbs}) = ${fmtVN(target)} giờ?`)) return;
    p.targetHour = target;
    p.targetHourManual = true;
    p.targetSwat = true; // đánh dấu target được ghi từ SWAT Hour
    await DB.put('projects', p);
    await load();
    await Dashboard.reloadAndRefresh();
    alert('Đã cập nhật Target giờ (đã đánh dấu "đã cập nhật Swat"). Kiểm tra lại trên Dashboard' +
      (typeof Cloud !== 'undefined' && Cloud.canWrite && Cloud.canWrite() ? ' rồi bấm "Lưu lên Drive" để xuất bản.' : '.'));
  }

  function syncFromDashboard(wbs) { if (wbs) pushProject(wbs); }

  function wire() {
    document.getElementById('swatWriteTarget').addEventListener('click', writeTarget);
    window.addEventListener('message', (ev) => {
      const d = ev.data;
      if (d && d.type === 'SWAT_RESULT') renderResult(d.data);
    });
    const f = frame();
    if (f) f.addEventListener('load', () => { pushList(); if (currentWbs) pushProject(currentWbs); });
    pushList();
    renderResult(null);
  }

  return { load, wire, syncFromDashboard };
})();
