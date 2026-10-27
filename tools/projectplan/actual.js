// So sánh KẾ HOẠCH điều phối (lưới fitter × ngày) với CHẤM CÔNG THỰC TẾ (bảng "Theo dõi giờ công" của Thống kê giờ công).
// Hàm thuần, không đụng trình duyệt — kiểm thử bằng Node (test/client/actual.test.mjs).
//
// Với mỗi fitter (đã liên kết mã NV trong EE Data) và mỗi ngày làm việc trong khoảng cần xem:
//   ok     kế hoạch chính thức có dự án A, ngày đó có chấm công cho dự án A (đúng WBS)
//   diff   kế hoạch có dự án A nhưng chấm công toàn dự án khác
//   miss   kế hoạch có dự án A nhưng không có chấm công
//   extra  không có kế hoạch nhưng có chấm công (làm ngoài kế hoạch)
//   tent   phân công DỰ KIẾN — không tính vào % (chỉ hiển thị)
//   nolink dự án trong kế hoạch chưa có WBS → không đối chiếu được, không tính vào %
// % bám kế hoạch = ok / (ok + diff + miss). Ngày Chủ nhật, ngày lễ chỉ xét khi có chấm công hoặc kế hoạch (làm bù).
(function (root) {
  'use strict';

  const norm = (s) => String(s == null ? '' : s).trim().toUpperCase();
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : (parseFloat(v) || 0));
  const rowHours = (r) => (typeof r.total === 'number' && isFinite(r.total) ? r.total
    : num(r.normal) + num(r.ot1) + num(r.ot2) + num(r.ot3) + num(r.ot4) + num(r.ot5) + num(r.ot6) + num(r.ot7));

  // rows: dòng bảng công; trả về { 'EMP|YYYY-MM-DD': { total, byWbs: {WBS: giờ} } } cho khoảng [from, to]
  function hoursByDay(rows, from, to) {
    const out = {};
    (rows || []).forEach((r) => {
      if (!r || !r.empId || !r.date || r.date < from || r.date > to) return;
      const h = rowHours(r);
      if (!(h > 0)) return;
      const k = norm(r.empId) + '|' + r.date;
      const e = out[k] || (out[k] = { total: 0, byWbs: {} });
      e.total += h;
      const w = norm(r.wbs);
      e.byWbs[w] = (e.byWbs[w] || 0) + h;
    });
    return out;
  }

  // opts: { data (kế hoạch: fitters, projects, alloc), hours (kết quả hoursByDay), days: ['YYYY-MM-DD'…],
  //         offDay(d) → true nếu Chủ nhật / lễ, hoursPerDay (mặc định 8) }
  function compare(opts) {
    const { data, hours, days, offDay } = opts, hpd = opts.hoursPerDay || 8;
    const proj = {}; (data.projects || []).forEach((p) => { proj[p.id] = p; });
    const fitters = [], tot = { ok: 0, diff: 0, miss: 0, extra: 0, tent: 0, nolink: 0, plannedHours: 0, actualOnPlan: 0, actualHours: 0 };
    const byProject = {}, bySup = {};
    const add = (map, key, label, st, extra) => {
      const m = map[key] || (map[key] = { key, label, ok: 0, diff: 0, miss: 0, plannedHours: 0, actualOnPlan: 0 });
      if (st === 'ok' || st === 'diff' || st === 'miss') m[st]++;
      if (extra) { m.plannedHours += extra.plannedHours || 0; m.actualOnPlan += extra.actualOnPlan || 0; }
    };

    (data.fitters || []).forEach((f) => {
      const row = { id: f.id, name: f.name, empId: f.empId || '', linked: !!f.empId, days: {}, ok: 0, diff: 0, miss: 0, extra: 0, tent: 0, nolink: 0, plannedHours: 0, actualOnPlan: 0, actualHours: 0 };
      const alloc = (data.alloc && data.alloc[f.id]) || {};
      days.forEach((d) => {
        const plan = alloc[d] && proj[alloc[d].p] ? alloc[d] : null;
        const act = row.linked ? hours[norm(f.empId) + '|' + d] || null : null;
        let st = '';
        if (act) { row.actualHours += act.total; tot.actualHours += act.total; }
        if (plan) {
          const p = proj[plan.p], wbs = norm(p.wbs);
          if (plan.t) st = 'tent';
          else if (!row.linked) st = '';                       // chưa liên kết nhân viên → không đối chiếu
          else if (!wbs) st = 'nolink';
          else if (offDay(d) && !act) st = '';                 // ngày nghỉ có kế hoạch nhưng không ai đi làm: không phạt
          else if (act && act.byWbs[wbs] > 0) st = 'ok';
          else if (act) st = 'diff';
          else st = 'miss';
          if (st === 'ok' || st === 'diff' || st === 'miss') {
            const onPlan = act && act.byWbs[wbs] ? act.byWbs[wbs] : 0;
            row.plannedHours += hpd; row.actualOnPlan += Math.min(onPlan, hpd * 1.5);
            const ex = { plannedHours: hpd, actualOnPlan: Math.min(onPlan, hpd * 1.5) };
            add(byProject, p.id, p.name, st, ex);
            add(bySup, norm(p.supervisor) || '—', p.supervisor || '(chưa có giám sát)', st, ex);
          }
        } else if (act && row.linked && !offDay(d)) st = 'extra';
        if (st) row[st]++;
        row.days[d] = { plan, act, st };
      });
      ['ok', 'diff', 'miss', 'extra', 'tent', 'nolink', 'plannedHours', 'actualOnPlan'].forEach((k) => { tot[k] += row[k]; });
      const n = row.ok + row.diff + row.miss;
      row.pct = n ? Math.round(row.ok / n * 1000) / 10 : null;
      row.util = row.plannedHours ? Math.round(row.actualOnPlan / row.plannedHours * 1000) / 10 : null;
      fitters.push(row);
    });

    const fin = (m) => { const n = m.ok + m.diff + m.miss; m.n = n; m.pct = n ? Math.round(m.ok / n * 1000) / 10 : null; m.util = m.plannedHours ? Math.round(m.actualOnPlan / m.plannedHours * 1000) / 10 : null; return m; };
    const n = tot.ok + tot.diff + tot.miss;
    tot.n = n; tot.pct = n ? Math.round(tot.ok / n * 1000) / 10 : null;
    tot.util = tot.plannedHours ? Math.round(tot.actualOnPlan / tot.plannedHours * 1000) / 10 : null;
    return {
      fitters, totals: tot,
      byProject: Object.values(byProject).map(fin).sort((a, b) => (a.pct == null) - (b.pct == null) || a.pct - b.pct),
      bySupervisor: Object.values(bySup).map(fin).sort((a, b) => (a.pct == null) - (b.pct == null) || b.pct - a.pct),
    };
  }

  // Các đoạn LIỀN NHAU cùng dự án (thực tế) của một fitter, để vẽ Gantt thực tế theo tháng.
  // wbsToProject: { WBS: {id, name, color} }; ngày có chấm công nhiều dự án → lấy dự án nhiều giờ nhất.
  function actualRuns(row, days, wbsToProject) {
    const runs = [];
    days.forEach((d, i) => {
      const a = row.days[d] && row.days[d].act;
      if (!a) return;
      let best = '', bh = -1;
      Object.keys(a.byWbs).forEach((w) => { if (a.byWbs[w] > bh) { bh = a.byWbs[w]; best = w; } });
      const pr = wbsToProject[best] || null;
      const key = pr ? pr.id : 'wbs:' + best;
      const last = runs[runs.length - 1];
      if (last && last.key === key && last.endIdx === i - 1) { last.endIdx = i; last.hours += a.total; }
      else runs.push({ key, wbs: best, project: pr, startIdx: i, endIdx: i, hours: a.total });
    });
    return runs;
  }

  const api = { norm, rowHours, hoursByDay, compare, actualRuns };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PlanActual = api;
})(typeof window !== 'undefined' ? window : globalThis);
