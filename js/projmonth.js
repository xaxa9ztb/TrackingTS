// Tab "Dự án theo tháng" (tracking.html): giờ công đã charge vào từng dự án trong một kỳ chấm công (16 tháng trước → 15 tháng chọn).
// Mỗi dự án: danh sách nhân sự + số giờ; bấm "+" ở một người → các ngày cụ thể người đó charge vào dự án.
// Phần tính (cycleOf, cycleRange, aggregate) là hàm thuần, chạy được cả trong Node để kiểm thử.
(function (root) {
  const pad = (n) => String(n).padStart(2, '0');
  const num = (v) => { const n = +v; return isFinite(n) ? n : 0; };

  // kỳ chấm công chứa ngày `iso`: ngày 16..cuối tháng thuộc kỳ của tháng SAU
  function cycleOf(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    if (!m) return '';
    let y = +m[1], mo = +m[2];
    if (+m[3] >= 16) { mo += 1; if (mo > 12) { mo = 1; y += 1; } }
    return `${y}-${pad(mo)}`;
  }
  function cycleRange(month) {
    const [y, m] = month.split('-').map(Number);
    const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
    return { from: `${py}-${pad(pm)}-16`, to: `${y}-${pad(m)}-15` };
  }
  // tổng giờ của một dòng: dùng `total` nếu có, không thì cộng giờ thường + OT1..OT7
  function hoursOf(r) {
    const ot = num(r.ot1) + num(r.ot2) + num(r.ot3) + num(r.ot4) + num(r.ot5) + num(r.ot6) + num(r.ot7);
    const normal = num(r.normal);
    const total = r.total != null && r.total !== '' ? num(r.total) : normal + ot;
    return { normal, ot: Math.max(0, total - normal), total };
  }

  // rows: các dòng bảng công; month: 'yyyy-mm'; look: { projectName(r), empName(r), position(empId) }
  function aggregate(rows, month, look = {}) {
    const { from, to } = cycleRange(month);
    const projName = look.projectName || ((r) => r.projectNameFree || '');
    const empName = look.empName || ((r) => r.empName || r.empId);
    const position = look.position || (() => '');
    const byProj = new Map();
    for (const r of rows) {
      if (!r || !r.date || r.date < from || r.date > to) continue;
      const h = hoursOf(r);
      if (!h.total) continue;
      const wbs = String(r.wbs || '').trim();
      const name = projName(r) || '';
      const key = wbs || (name ? 'free:' + name.toLowerCase() : '(none)');
      let p = byProj.get(key);
      if (!p) { p = { key, wbs, name: name || (wbs ? '' : 'Chưa ghi dự án'), normal: 0, ot: 0, total: 0, people: new Map() }; byProj.set(key, p); }
      if (!p.name && name) p.name = name;
      p.normal += h.normal; p.ot += h.ot; p.total += h.total;
      const eid = String(r.empId || '').trim() || '?';
      let e = p.people.get(eid);
      if (!e) { e = { empId: eid, name: empName(r) || eid, position: position(eid) || '', normal: 0, ot: 0, total: 0, dates: new Set(), rows: [] }; p.people.set(eid, e); }
      e.normal += h.normal; e.ot += h.ot; e.total += h.total; e.dates.add(r.date);
      e.rows.push({ date: r.date, from: r.timeFrom || '', to: r.timeTo || '', act: String(r.activities || '').trim(), normal: h.normal, ot: h.ot, total: h.total });
    }
    const projects = [...byProj.values()].map(p => {
      const people = [...p.people.values()].map(e => ({
        empId: e.empId, name: e.name, position: e.position, normal: e.normal, ot: e.ot, total: e.total, days: e.dates.size,
        rows: e.rows.sort((a, b) => a.date.localeCompare(b.date) || a.from.localeCompare(b.from)),
      })).sort((a, b) => b.total - a.total || String(a.name).localeCompare(String(b.name)));
      return { key: p.key, wbs: p.wbs, name: p.name, normal: p.normal, ot: p.ot, total: p.total, people };
    }).sort((a, b) => b.total - a.total || String(a.name).localeCompare(String(b.name)));
    const emps = new Set();
    projects.forEach(p => p.people.forEach(e => emps.add(e.empId)));
    const sum = (k) => projects.reduce((s, p) => s + p[k], 0);
    return { month, from, to, projects, totals: { projects: projects.length, people: emps.size, normal: sum('normal'), ot: sum('ot'), total: sum('total') } };
  }
  // các kỳ có dữ liệu, mới nhất trước
  function monthsWithData(rows) {
    const s = new Set();
    rows.forEach(r => { const c = cycleOf(r && r.date); if (c) s.add(c); });
    return [...s].sort().reverse();
  }

  const api = { cycleOf, cycleRange, hoursOf, aggregate, monthsWithData };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  // ---------------- giao diện (trình duyệt) ----------------
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => (Math.round((n || 0) * 10) / 10).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const dmy = (iso) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
  const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const wd = (iso) => WD[new Date(iso + 'T00:00:00Z').getUTCDay()];
  const plain = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

  let rows = [], employees = {}, projectsByWbs = {}, wired = false, data = null;
  const open = new Set(), openPeople = new Set();   // giữ trạng thái mở khi vẽ lại

  async function load() {
    if (!$('pmList')) return;
    rows = await DB.getAll('timesheets');
    employees = {}; (await DB.getAll('employees')).forEach(e => { employees[e.empId] = e; });
    projectsByWbs = {}; (await DB.getAll('projects')).forEach(p => { projectsByWbs[p.wbs] = p; });
    if (!wired) wire();
    fillMonths();
    render();
  }

  function fillMonths() {
    const sel = $('pmMonth');
    const months = monthsWithData(rows);
    const cur = sel.value || months[0] || cycleOf(new Date().toISOString().slice(0, 10));
    const list = months.includes(cur) ? months : [cur, ...months];
    sel.innerHTML = list.map(m => {
      const r = cycleRange(m), [y, mo] = m.split('-');
      return `<option value="${m}">Tháng ${+mo}/${y} (${dmy(r.from).slice(0, 5)} – ${dmy(r.to).slice(0, 5)})</option>`;
    }).join('');
    sel.value = cur;
  }

  function actLabel(code) {
    const name = typeof Dashboard !== 'undefined' && Dashboard.activityName ? Dashboard.activityName(code.replace(/\s+/g, '')) : '';
    return name ? `${code} · ${name}` : code;
  }

  function render() {
    const month = $('pmMonth').value;
    if (!month) return;
    data = aggregate(rows, month, {
      projectName: (r) => (projectsByWbs[r.wbs] && projectsByWbs[r.wbs].projectName) || r.projectNameFree || '',
      empName: (r) => (employees[r.empId] && employees[r.empId].fullName) || r.empName || r.empId,
      position: (id) => (employees[id] && employees[id].position) || '',
    });
    const q = plain($('pmSearch').value.trim());
    const t = data.totals;
    $('pmKpis').innerHTML = [
      ['Dự án có giờ công', t.projects], ['Nhân sự đã charge', t.people], ['Tổng giờ công', fmt(t.total)], ['Giờ thường', fmt(t.normal)], ['Giờ OT', fmt(t.ot)],
    ].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
    $('pmCycle').textContent = `Kỳ chấm công ${dmy(data.from)} – ${dmy(data.to)}`;

    const sortBy = $('pmSort').value;
    let list = data.projects.slice();
    if (sortBy === 'name') list.sort((a, b) => String(a.name || a.wbs).localeCompare(String(b.name || b.wbs), 'vi'));
    if (sortBy === 'people') list.sort((a, b) => b.people.length - a.people.length || b.total - a.total);
    const max = Math.max(1, ...list.map(p => p.total));
    const hits = [];
    list.forEach(p => {
      const projHit = !q || plain(p.name).includes(q) || plain(p.wbs).includes(q);
      const who = q ? p.people.filter(e => plain(e.name).includes(q) || plain(e.empId).includes(q)) : [];
      if (projHit || who.length) hits.push({ p, who: new Set(who.map(e => e.empId)) });
    });
    $('pmCount').textContent = q ? `${hits.length}/${list.length} dự án khớp` : `${list.length} dự án`;
    if (!hits.length) {
      $('pmList').innerHTML = `<p class="pm-empty">${data.projects.length ? 'Không có dự án / nhân sự nào khớp từ khoá.' : 'Chưa có giờ công nào trong kỳ này.'}</p>`;
      return;
    }
    $('pmList').innerHTML = hits.map(({ p, who }) => {
      const isOpen = open.has(p.key) || who.size > 0;
      const pct = data.totals.total ? p.total / data.totals.total * 100 : 0;
      return `<details class="pm-proj" data-key="${esc(p.key)}"${isOpen ? ' open' : ''}>
  <summary>
    <span class="pm-name"><b>${esc(p.name || p.wbs)}</b>${p.wbs ? `<small>WBS ${esc(p.wbs)}</small>` : ''}</span>
    <span class="pm-meta">${p.people.length} người</span>
    <span class="pm-bar" title="${fmt(pct)}% tổng giờ công của kỳ"><i style="width:${(p.total / max * 100).toFixed(1)}%"></i></span>
    <span class="pm-hours"><b>${fmt(p.total)}</b> giờ<small>thường ${fmt(p.normal)} · OT ${fmt(p.ot)}</small></span>
  </summary>
  <div class="pm-body"><table class="data-table pm-people">
    <thead><tr><th class="pm-x"></th><th>Nhân sự</th><th class="pm-opt">Mã NV</th><th class="pm-opt">Chức vụ</th><th class="num">Số ngày</th><th class="num pm-opt">Thường</th><th class="num pm-opt">OT</th><th class="num">Tổng giờ</th></tr></thead>
    <tbody>${p.people.map(e => personRows(p, e, who.has(e.empId))).join('')}</tbody>
    <tfoot><tr><td></td><td>Tổng dự án</td><td class="pm-opt"></td><td class="pm-opt"></td><td class="num"></td><td class="num pm-opt">${fmt(p.normal)}</td><td class="num pm-opt">${fmt(p.ot)}</td><td class="num">${fmt(p.total)}</td></tr></tfoot>
  </table></div>
</details>`;
    }).join('');
  }

  function personRows(p, e, hit) {
    const id = p.key + '|' + e.empId;
    const isOpen = openPeople.has(id) || hit;
    return `<tr class="pm-person${hit ? ' pm-hit' : ''}">
  <td class="pm-x"><button type="button" class="pm-toggle" data-person="${esc(id)}" aria-expanded="${isOpen}" title="${isOpen ? 'Thu gọn' : 'Xem các ngày'}">${isOpen ? '−' : '+'}</button></td>
  <td>${esc(e.name)}</td><td class="pm-opt">${esc(e.empId)}</td><td class="pm-opt">${esc(e.position)}</td>
  <td class="num">${e.days}</td><td class="num pm-opt">${fmt(e.normal)}</td><td class="num pm-opt">${fmt(e.ot)}</td><td class="num"><b>${fmt(e.total)}</b></td>
</tr>
<tr class="pm-days"${isOpen ? '' : ' hidden'}><td></td><td colspan="7"><table class="pm-daytable">
  <thead><tr><th>Ngày</th><th class="pm-opt">Giờ làm</th><th>Hoạt động</th><th class="num pm-opt">Thường</th><th class="num pm-opt">OT</th><th class="num">Tổng</th></tr></thead>
  <tbody>${e.rows.map(r => `<tr><td>${wd(r.date)} ${dmy(r.date)}</td><td class="pm-opt">${r.from || r.to ? `${esc(r.from)}–${esc(r.to)}` : ''}</td><td class="pm-act">${esc(actLabel(r.act))}</td><td class="num pm-opt">${fmt(r.normal)}</td><td class="num pm-opt">${r.ot ? fmt(r.ot) : ''}</td><td class="num">${fmt(r.total)}</td></tr>`).join('')}</tbody>
</table></td></tr>`;
  }

  function wire() {
    wired = true;
    $('pmMonth').addEventListener('change', () => { open.clear(); openPeople.clear(); render(); });
    $('pmSort').addEventListener('change', render);
    let t = null;
    $('pmSearch').addEventListener('input', () => { clearTimeout(t); t = setTimeout(render, 150); });
    $('pmExpand').addEventListener('click', () => {
      const all = data && data.projects.length && data.projects.every(p => open.has(p.key));
      open.clear();
      if (!all && data) data.projects.forEach(p => open.add(p.key));
      $('pmExpand').textContent = all ? 'Mở tất cả' : 'Thu gọn tất cả';
      render();
    });
    $('pmList').addEventListener('toggle', (ev) => {
      const d = ev.target.closest && ev.target.closest('details.pm-proj');
      if (d) { if (d.open) open.add(d.dataset.key); else open.delete(d.dataset.key); }
    }, true);
    $('pmList').addEventListener('click', (ev) => {
      const b = ev.target.closest('.pm-toggle');
      if (!b) return;
      const tr = b.closest('tr').nextElementSibling;
      const show = tr.hidden;
      tr.hidden = !show;
      b.textContent = show ? '−' : '+';
      b.setAttribute('aria-expanded', String(show));
      b.title = show ? 'Thu gọn' : 'Xem các ngày';
      if (show) openPeople.add(b.dataset.person); else openPeople.delete(b.dataset.person);
    });
  }

  root.ProjMonth = { ...api, load, render };
})(typeof window !== 'undefined' ? window : globalThis);
