// Quản lý dự án — Đợt 2 + Đợt 3: tải nguồn lực, cảnh báo xung đột, lý do sai lệch, đánh giá subcon,
// % hoàn thành theo công đoạn, kế hoạch 3 tuần + PPC, gợi ý fitter, báo cáo tuần.
// Hàm thuần (không đụng trình duyệt) — kiểm thử bằng Node (test/client/pminsights.test.mjs). Cần PMIO (pmio.js).
(function (root) {
  'use strict';
  const P = root.PMIO || (typeof require === 'function' ? require('./pmio.js') : null);
  const plain = P.plain, addDays = P.addDays, daysBetween = P.daysBetween;
  const dow = (s) => P.isoToUTCDate(s).getUTCDay();
  const mondayOf = (s) => addDays(s, -((dow(s) + 6) % 7));
  const dm = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '');

  // ---------- lý do sai lệch (ghi khi dời mốc / khi cam kết tuần không đạt) ----------
  const REASONS = [
    { k: 'shaft', label: 'Hố / mặt bằng chưa bàn giao' },
    { k: 'goods', label: 'Hàng về trễ / thiếu hàng' },
    { k: 'crew', label: 'Thiếu nhân lực' },
    { k: 'owner', label: 'Chủ đầu tư yêu cầu' },
    { k: 'design', label: 'Thiết kế / kỹ thuật' },
    { k: 'power', label: 'Chưa có điện thi công' },
    { k: 'weather', label: 'Thời tiết' },
    { k: 'subcon', label: 'Subcon chậm' },
    { k: 'quality', label: 'Lỗi chất lượng / làm lại' },
    { k: 'other', label: 'Khác' },
  ];
  const reasonLabel = (k) => (REASONS.find(r => r.k === k) || { label: k || '—' }).label;

  // ---------- % hoàn thành theo công đoạn (trọng số cộng = 100) ----------
  const STAGES = [
    { k: 'rail', label: 'Ray & giá đỡ', w: 25 },
    { k: 'doors', label: 'Cửa tầng', w: 20 },
    { k: 'car', label: 'Cabin & đối trọng', w: 20 },
    { k: 'machine', label: 'Máy & tủ điện', w: 15 },
    { k: 'wiring', label: 'Đấu điện & cáp', w: 10 },
    { k: 'test', label: 'Chạy thử & test', w: 10 },
  ];
  // p.prog = { rail: 0..100, … }; trả về % hoàn thành có trọng số (null nếu chưa cập nhật lần nào)
  function progressPct(p) {
    const g = p && p.prog;
    if (!g || !STAGES.some(s => g[s.k] != null && g[s.k] !== '')) return null;
    return Math.round(STAGES.reduce((a, s) => a + s.w * Math.max(0, Math.min(100, Number(g[s.k]) || 0)) / 100, 0));
  }
  // điều kiện cần trước khi lắp (lookahead): p.pre = { shaft, goods, power, scaffold } (true = đã sẵn sàng)
  const PREREQ = [
    { k: 'shaft', label: 'Hố / mặt bằng', ms: 'shaftReady' },
    { k: 'goods', label: 'Hàng về', ms: 'arrival' },
    { k: 'power', label: 'Điện thi công' },
    { k: 'scaffold', label: 'Giàn giáo / an toàn' },
  ];
  // sẵn sàng = tick tay, hoặc mốc tương ứng đã xác nhận xong
  const preOk = (p, q) => !!((p.pre || {})[q.k] || (q.ms && p[q.ms] && p[q.ms].done));

  // ---------- nghỉ phép ----------
  // leaves: [{ empId, from, to, status, days? }] → Set 'EMP|YYYY-MM-DD'
  function leaveDays(leaves) {
    const out = new Map();
    (leaves || []).forEach(l => {
      if (!l || !l.empId || !l.from) return;
      const ds = Array.isArray(l.days) && l.days.length ? l.days.map(x => (typeof x === 'string' ? x : x.date)).filter(Boolean) : daysBetween(l.from, l.to || l.from);
      ds.forEach(d => out.set(String(l.empId).trim().toUpperCase() + '|' + d, l.status || 'approved'));
    });
    return out;
  }

  // ---------- cửa sổ lắp đặt của dự án ----------
  function installWindow(p) {
    const a = (p.teamStart && p.teamStart.date) || (p.ownerStart && p.ownerStart.date) || (p.shaftReady && p.shaftReady.date) || '';
    const b = (p.handover && p.handover.date) || (p.testReady && p.testReady.date) || (a ? addDays(a, 30) : '');
    return a ? { from: a, to: b < a ? a : b } : null;
  }

  // ---------- (8) tải nguồn lực theo tuần ----------
  // opts: { data, from (thứ Hai), weeks, offDay(d), leaves, testers: [empId] }
  function resourceLoad(opts) {
    const { data, offDay } = opts, weeks = opts.weeks || 8, start = mondayOf(opts.from);
    const inh = (data.fitters || []).filter(f => !f.sub), subs = (data.fitters || []).filter(f => f.sub);
    const lv = leaveDays(opts.leaves), testers = (opts.testers || []).map(x => String(x).trim().toUpperCase());
    const pm = {}; (data.projects || []).forEach(p => { pm[p.id] = p; });
    const rows = [];
    for (let i = 0; i < weeks; i++) {
      const w0 = addDays(start, i * 7), days = daysBetween(w0, addDays(w0, 6)).filter(d => !offDay(d));
      let cap = 0, booked = 0, tent = 0, leave = 0;
      inh.forEach(f => days.forEach(d => {
        const v = (data.alloc[f.id] || {})[d], onLeave = f.empId && lv.has(String(f.empId).trim().toUpperCase() + '|' + d);
        cap++;
        if (onLeave) leave++;
        if (v && pm[v.p]) { if (v.t) tent++; else booked++; }
      }));
      const free = Math.max(0, cap - booked - tent - leave);
      // dự án inhouse / kết hợp / chưa ghi đang trong cửa sổ lắp đặt mà tuần này chưa có ai (inhouse hoặc subcon)
      const staffed = new Set();
      [...inh, ...subs].forEach(f => days.forEach(d => { const v = (data.alloc[f.id] || {})[d]; if (v && pm[v.p]) staffed.add(v.p); }));
      const unstaffed = (data.projects || []).filter(p => !p.done && !staffed.has(p.id) && p.mode !== 'sub' && (() => { const wdw = installWindow(p); return wdw && wdw.from <= addDays(w0, 6) && wdw.to >= w0 && !(p.handover && p.handover.done); })());
      const subUnstaffed = (data.projects || []).filter(p => !p.done && !staffed.has(p.id) && p.mode === 'sub' && (() => { const wdw = installWindow(p); return wdw && wdw.from <= addDays(w0, 6) && wdw.to >= w0 && !(p.handover && p.handover.done); })());
      const testDemand = (data.projects || []).filter(p => !p.done && p.testReady && p.testReady.date && !p.testReady.done && p.testReady.date >= w0 && p.testReady.date <= addDays(w0, 6));
      const testerLeave = testers.reduce((a, t) => a + days.filter(d => lv.has(t + '|' + d)).length, 0);
      rows.push({ w: w0, workdays: days.length, fitters: inh.length, cap, booked, tent, leave, free,
        util: cap ? Math.round((booked + tent) / cap * 100) : null,
        unstaffed: unstaffed.map(p => p.id), subUnstaffed: subUnstaffed.map(p => p.id),
        testDemand: testDemand.map(p => p.id), testers: testers.length, testerDays: testers.length * days.length - testerLeave });
    }
    return rows;
  }

  // ---------- (9) cảnh báo xung đột ----------
  // opts: { data, today, leaves, offDay, target(wbs) → giờ định mức | 0, actual(wbs) → giờ đã chấm, testers: [empId], horizon (ngày, mặc định 42) }
  // → [{ lvl: 'bad'|'warn', type, pid?, fid?, msg, date? }]
  function conflicts(opts) {
    const { data, today } = opts, H = opts.horizon || 42, end = addDays(today, H), out = [];
    const lv = leaveDays(opts.leaves), pm = {}; (data.projects || []).forEach(p => { pm[p.id] = p; });
    const fitters = data.fitters || [];
    // 1) fitter bị phân công vào ngày nghỉ phép (đã duyệt = đỏ, đang chờ duyệt = vàng)
    fitters.filter(f => !f.sub && f.empId).forEach(f => {
      const runs = {};
      Object.keys(data.alloc[f.id] || {}).sort().forEach(d => {
        if (d < today || d > end) return;
        const st = lv.get(String(f.empId).trim().toUpperCase() + '|' + d); if (!st) return;
        const v = data.alloc[f.id][d], k = v.p + '|' + st;
        (runs[k] = runs[k] || { p: v.p, st, days: [] }).days.push(d);
      });
      Object.values(runs).forEach(r => {
        const p = pm[r.p]; if (!p) return;
        out.push({ lvl: r.st === 'approved' ? 'bad' : 'warn', type: 'leave', pid: p.id, fid: f.id, date: r.days[0],
          msg: `${f.name} ${r.st === 'approved' ? 'nghỉ phép (đã duyệt)' : 'xin nghỉ (chờ duyệt)'} ${r.days.map(dm).join(', ')} nhưng đang được phân công ${p.name}` });
      });
    });
    // 2) phân công trước khi hàng về / hố được bàn giao (mốc chưa xác nhận)
    const firstAlloc = {};
    fitters.forEach(f => Object.keys(data.alloc[f.id] || {}).forEach(d => {
      const v = data.alloc[f.id][d]; if (!v || v.t || d < today || d > end) return;
      if (!firstAlloc[v.p] || d < firstAlloc[v.p]) firstAlloc[v.p] = d;
    }));
    Object.keys(firstAlloc).forEach(pid => {
      const p = pm[pid]; if (!p || p.done) return;
      const d = firstAlloc[pid];
      [['arrival', 'hàng về'], ['shaftReady', 'XD giao hố']].forEach(([k, t]) => {
        const m = p[k]; if (m && m.date && !m.done && d < m.date) out.push({ lvl: 'warn', type: 'early', pid, date: d, msg: `${p.name}: đã xếp người từ ${dm(d)} nhưng ${t} dự kiến ${dm(m.date)} (chưa xác nhận)` });
      });
    });
    // 3) giờ công: đã chấm + phân công sắp tới (× 8) vượt định mức
    if (opts.target) (data.projects || []).forEach(p => {
      if (p.done || !p.wbs) return;
      const tg = Number(opts.target(p.wbs)) || 0; if (!tg) return;
      const act = Number(opts.actual ? opts.actual(p.wbs) : 0) || 0;
      let future = 0; fitters.filter(f => !f.sub).forEach(f => Object.keys(data.alloc[f.id] || {}).forEach(d => { const v = data.alloc[f.id][d]; if (v.p === p.id && !v.t && d >= today) future++; }));
      const proj = act + future * 8;
      if (proj > tg) out.push({ lvl: act > tg ? 'bad' : 'warn', type: 'hours', pid: p.id, msg: `${p.name}: đã chấm ${Math.round(act)}h + phân công tới ${future * 8}h = ${Math.round(proj)}h > định mức ${Math.round(tg)}h` });
    });
    // 4) sẵn sàng test trong 14 ngày tới — đếm theo tuần so với số tester
    const testers = (opts.testers || []).length;
    const byWeek = {};
    (data.projects || []).forEach(p => {
      const m = p.testReady; if (p.done || !m || !m.date || m.done || m.date < today || m.date > addDays(today, 13)) return;
      (byWeek[mondayOf(m.date)] = byWeek[mondayOf(m.date)] || []).push(p);
    });
    Object.keys(byWeek).sort().forEach(w => {
      const l = byWeek[w];
      if (!testers) out.push({ lvl: 'warn', type: 'tester', date: w, msg: `Tuần ${dm(w)}: ${l.length} dự án sẵn sàng test (${l.map(p => p.name).join(', ')}) — chưa xác định được tester (chức danh T&C trong dữ liệu nhân sự)` });
      else if (l.length > testers) out.push({ lvl: 'warn', type: 'tester', date: w, msg: `Tuần ${dm(w)}: ${l.length} dự án sẵn sàng test nhưng chỉ có ${testers} tester` });
    });
    // 5) công ty subcon nhận nhiều dự án cùng lúc hơn số đội đang có trên lưới
    const teams = {}; fitters.filter(f => f.sub && f.company).forEach(f => { const k = plain(f.company); teams[k] = (teams[k] || 0) + 1; });
    const subP = (data.projects || []).filter(p => !p.done && p.subcon && (p.mode === 'sub' || p.mode === 'mix'));
    const names = {}; subP.forEach(p => { names[plain(p.subcon)] = p.subcon; });
    Object.keys(names).forEach(k => {
      for (let i = 0; i < Math.ceil(H / 7); i++) {
        const w0 = addDays(mondayOf(today), i * 7), w1 = addDays(w0, 6);
        const act = subP.filter(p => plain(p.subcon) === k && (() => { const wdw = installWindow(p); return wdw && wdw.from <= w1 && wdw.to >= w0; })());
        const t = teams[k] || 0;
        if (act.length > Math.max(1, t)) { out.push({ lvl: 'warn', type: 'subcon', date: w0, msg: `${names[k]}: ${act.length} dự án cùng thi công tuần ${dm(w0)} (${act.map(p => p.name).join(', ')}) — trên lưới có ${t} đội` }); break; }
      }
    });
    // 6) dự án inhouse sắp nhận hố (≤ 14 ngày) mà chưa có ai
    (data.projects || []).forEach(p => {
      const m = p.teamStart; if (p.done || !m || !m.date || m.done || m.date < today || m.date > addDays(today, 14)) return;
      const has = fitters.some(f => Object.keys(data.alloc[f.id] || {}).some(d => d >= addDays(m.date, -3) && d <= addDays(m.date, 14) && data.alloc[f.id][d].p === p.id));
      if (!has) out.push({ lvl: 'bad', type: 'unstaffed', pid: p.id, date: m.date, msg: `${p.name}: nhận hố ${dm(m.date)} — chưa phân công fitter / đội subcon` });
    });
    const rank = { bad: 0, warn: 1 };
    return out.sort((a, b) => rank[a.lvl] - rank[b.lvl] || String(a.date || '').localeCompare(String(b.date || '')));
  }

  // ---------- (6) lý do sai lệch ----------
  // p.log = [{ at, by, k (mốc), from, to, r (mã lý do), note }] — ghi khi dời mốc trong hộp thoại dự án
  function reasonStats(projects, filter) {
    const cnt = {}, days = {};
    (projects || []).forEach(p => (p.log || []).forEach(x => {
      if (filter && !filter(p, x)) return;
      const k = x.r || 'other', d = x.from && x.to ? Math.max(0, Math.round((P.isoToUTCDate(x.to) - P.isoToUTCDate(x.from)) / 864e5)) : 0;
      cnt[k] = (cnt[k] || 0) + 1; days[k] = (days[k] || 0) + d;
    }));
    return Object.keys(cnt).map(k => ({ k, label: reasonLabel(k), n: cnt[k], days: days[k] })).sort((a, b) => b.days - a.days || b.n - a.n);
  }

  // ---------- đánh giá subcon ----------
  // → [{ name, projects, active, done, onTime, late, avgLate, reasons: [...] }]
  function subconScore(data, which) {
    const by = {};
    (data.projects || []).filter(p => p.subcon && (p.mode === 'sub' || p.mode === 'mix')).forEach(p => {
      const k = plain(p.subcon), o = by[k] || (by[k] = { name: p.subcon, list: [] });
      o.list.push(p);
    });
    const v = {}; P.variance(data, which).forEach(r => { v[r.p.id] = r; });
    return Object.values(by).map(o => {
      const fin = o.list.filter(p => p.done || (p.handover && p.handover.done));
      const cmp = o.list.map(p => v[p.id]).filter(r => r && r.slip != null);
      const late = cmp.filter(r => r.slip > 0);
      return { name: o.name, projects: o.list.length, active: o.list.length - fin.length, done: fin.length,
        compared: cmp.length, onTime: cmp.length - late.length, late: late.length,
        onTimePct: cmp.length ? Math.round((cmp.length - late.length) / cmp.length * 100) : null,
        avgLate: late.length ? Math.round(late.reduce((a, r) => a + r.slip, 0) / late.length) : 0,
        reasons: reasonStats(o.list).slice(0, 3) };
    }).sort((a, b) => (b.late - a.late) || b.projects - a.projects || a.name.localeCompare(b.name, 'vi'));
  }

  // ---------- (7) kế hoạch 3 tuần + cam kết tuần (PPC) ----------
  const LOOK_KEYS = ['arrival', 'shaftReady', 'teamStart', 'mechDone', 'testReady', 'sais', 'inspect', 'handover'];
  // việc đến hạn trong `weeks` tuần tới (tính từ thứ Hai tuần này), kèm điều kiện cần
  function lookahead(data, today, weeks) {
    const w0 = mondayOf(today), end = addDays(w0, (weeks || 3) * 7 - 1), out = [];
    (data.projects || []).forEach(p => {
      if (p.done) return;
      LOOK_KEYS.forEach(k => {
        const m = p[k]; if (!m || !m.date || m.done || m.date > end) return;
        const overdue = m.date < w0;
        if (overdue && m.date < addDays(w0, -28)) return;   // quá hạn lâu → đã có ở cảnh báo mốc trễ
        const needPre = ['teamStart', 'mechDone'].includes(k);
        const pre = needPre ? PREREQ.map(q => ({ k: q.k, label: q.label, ok: preOk(p, q) })) : [];
        out.push({ pid: p.id, name: p.name, k, label: P.MILESTONES.find(x => x.key === k).short, date: m.date, week: overdue ? w0 : mondayOf(m.date), overdue,
          pre, ready: pre.every(x => x.ok), committed: (p.cm || []).some(c => c.k === k && c.w === (overdue ? w0 : mondayOf(m.date))) });
      });
    });
    return out.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, 'vi'));
  }
  // cam kết của tuần: p.cm = [{ w: thứ Hai, k: mốc, d: ngày hẹn, ok: null|true|false, r: lý do, at, by }]
  function commitWeek(data, week, items, info) {
    const i = info || {}; let n = 0;
    (items || []).forEach(it => {
      const p = (data.projects || []).find(x => x.id === it.pid); if (!p) return;
      p.cm = p.cm || [];
      if (p.cm.some(c => c.w === week && c.k === it.k)) return;
      p.cm.push({ w: week, k: it.k, d: it.date, ok: null, r: '', at: i.at || new Date().toISOString(), by: i.by || '' }); n++;
    });
    return n;
  }
  // tự đánh dấu: mốc đã xác nhận xong trong / trước tuần → đạt
  function autoClose(data, today) {
    let n = 0;
    (data.projects || []).forEach(p => (p.cm || []).forEach(c => {
      if (c.ok != null) return;
      const m = p[c.k];
      if (m && m.done) { c.ok = true; n++; }
    }));
    return n;
  }
  // PPC theo tuần (chỉ tính cam kết đã có kết quả) → [{ w, total, done, failed, open, pct, reasons }]
  function ppc(data) {
    const by = {};
    (data.projects || []).forEach(p => (p.cm || []).forEach(c => {
      const o = by[c.w] || (by[c.w] = { w: c.w, total: 0, done: 0, failed: 0, open: 0, reasons: {} });
      o.total++;
      if (c.ok === true) o.done++; else if (c.ok === false) { o.failed++; const r = c.r || 'other'; o.reasons[r] = (o.reasons[r] || 0) + 1; } else o.open++;
    }));
    return Object.values(by).map(o => ({ ...o, pct: o.done + o.failed ? Math.round(o.done / (o.done + o.failed) * 100) : null,
      reasons: Object.keys(o.reasons).map(k => ({ k, label: reasonLabel(k), n: o.reasons[k] })).sort((a, b) => b.n - a.n) }))
      .sort((a, b) => b.w.localeCompare(a.w));
  }

  // ---------- (10) gợi ý fitter cho một phân công ----------
  // opts: { data, project, from, to, offDay, leaves, exp: { EMP: { liftTypes: {type: giờ}, province: giờ, hours } } }
  // → [{ f, free (số ngày trống / số ngày làm việc), leave, score, why: [...] }] — chỉ fitter công ty
  function suggestFitters(opts) {
    const { data, project: p, from, to, offDay } = opts, lv = leaveDays(opts.leaves), exp = opts.exp || {};
    const days = daysBetween(from, to).filter(d => !offDay || !offDay(d));
    const lt = plain(p && p.liftType), prov = !!(p && p.province);
    return (data.fitters || []).filter(f => !f.sub).map(f => {
      const m = data.alloc[f.id] || {}, key = String(f.empId || '').trim().toUpperCase();
      const busy = days.filter(d => m[d] && m[d].p !== (p && p.id)).length;
      const leave = key ? days.filter(d => lv.has(key + '|' + d)).length : 0;
      const free = days.length - busy - leave;
      const e = exp[key] || {}, why = [];
      let score = days.length ? free / days.length * 60 : 0;
      const same = lt ? Object.keys(e.liftTypes || {}).filter(t => plain(t) && (plain(t).includes(lt) || lt.includes(plain(t)))).reduce((a, t) => a + e.liftTypes[t], 0) : 0;
      if (same > 0) { score += Math.min(25, same / 40); why.push(`đã lắp ${p.liftType} ~${Math.round(same)}h`); }
      if (prov && e.province > 0) { score += Math.min(10, e.province / 40); why.push('có kinh nghiệm dự án tỉnh'); }
      const onThis = Object.values(m).filter(v => v.p === (p && p.id)).length;
      if (onThis) { score += 5; why.push('đã làm dự án này'); }
      if (busy) why.push(`bận ${busy} ngày`);
      if (leave) why.push(`nghỉ phép ${leave} ngày`);
      return { f, free, total: days.length, busy, leave, score: Math.round(score), why };
    }).sort((a, b) => b.score - a.score || a.f.name.localeCompare(b.f.name, 'vi'));
  }
  // kinh nghiệm theo chấm công: rows (Theo dõi giờ công) + shared (dự án chung: wbs → { productLine, province? })
  function experience(rows, sharedByWbs, provinceWbs) {
    const out = {};
    (rows || []).forEach(r => {
      if (!r || !r.empId || !r.wbs) return;
      const h = typeof r.total === 'number' ? r.total : (Number(r.normal) || 0);
      if (!(h > 0)) return;
      const k = String(r.empId).trim().toUpperCase(), o = out[k] || (out[k] = { liftTypes: {}, province: 0, hours: 0 });
      o.hours += h;
      const sp = sharedByWbs ? sharedByWbs(r.wbs) : null;
      if (sp && sp.productLine) o.liftTypes[sp.productLine] = (o.liftTypes[sp.productLine] || 0) + h;
      if (provinceWbs && provinceWbs(r.wbs)) o.province += h;
    });
    return out;
  }

  // ---------- (11) báo cáo tuần ----------
  function weeklyReport(opts) {
    const { data, today } = opts, w0 = mondayOf(today), w1 = addDays(w0, 6), nw0 = addDays(w0, 7), nw1 = addDays(w0, 13);
    const v = P.variance(data, opts.which || 'last').filter(r => !r.p.done);
    const late = v.filter(r => r.slip > 0).sort((a, b) => b.slip - a.slip);
    const notBl = v.filter(r => !r.inBase).length;
    const due = [];
    (data.projects || []).filter(p => !p.done).forEach(p => P.MILESTONES.forEach(m => {
      const x = p[m.key]; if (x && x.date && !x.done && x.date >= w0 && x.date <= nw1) due.push({ p, m, d: x.date, next: x.date > w1 });
    }));
    due.sort((a, b) => a.d.localeCompare(b.d));
    const overdue = [];
    (data.projects || []).filter(p => !p.done).forEach(p => P.MILESTONES.forEach(m => { const x = p[m.key]; if (x && x.date && !x.done && x.date < w0) overdue.push({ p, m, d: x.date }); }));
    const load = opts.load || [];
    const pp = ppc(data).find(x => x.w === addDays(w0, -7)) || null;
    return { week: w0, weekEnd: w1, nextWeek: nw0, late, notBl, due, overdue: overdue.sort((a, b) => a.d.localeCompare(b.d)),
      conflicts: opts.conflicts || [], load: load.slice(0, 2), ppcLast: pp, subcons: opts.subcons || [], reasons: reasonStats(data.projects).slice(0, 5) };
  }

  const api = { REASONS, reasonLabel, STAGES, progressPct, PREREQ, preOk, leaveDays, installWindow, resourceLoad, conflicts, reasonStats, subconScore,
    LOOK_KEYS, lookahead, commitWeek, autoClose, ppc, suggestFitters, experience, weeklyReport, mondayOf };
  root.PMInsights = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
