// Bảng tiến độ — trình chỉnh Gantt (kéo thả, thêm / xoá / sửa dòng) trước khi xuất Excel / in.
// Dữ liệu: danh sách dòng (items) theo thứ tự hiển thị:
//   { uid, kind: 'base' | 'group' | 'task' | 'ms', name, ph: 'P' | 'I' | 'H' | 'M', days, link, lag, start }
//   base  = mốc khởi tính (ngày bản vẽ được duyệt) — luôn ở dòng đầu, ngày lấy từ bước 1
//   group = nhóm công việc (I, II, III…): có việc con → dòng tổng hợp (tự tính từ việc con); không có việc con → như 1 công việc
//   task  = công việc; ms = mốc (◆, 0 ngày)
//   link  = nối tiếp việc ngay phía trên (bắt đầu ngày làm việc kế tiếp sau khi việc trên kết thúc) + lag (ngày làm việc, âm = gối đầu)
//   link = false → bắt đầu cố định tại `start` (YYYY-MM-DD)
// Phần thuần (tính lịch, thao tác dòng) kiểm thử bằng Node: test/client/gantt.test.mjs
(function (root) {
  'use strict';
  const DAY = 864e5;
  const pd = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; };
  const iso = (d) => d.toISOString().slice(0, 10);
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];
  let seq = 0;
  const uid = () => 'g' + Date.now().toString(36) + (++seq).toString(36);

  // lịch làm việc: mode 'work' bỏ T7, CN, ngày lễ; 'cal' chỉ bỏ ngày lễ
  function cal(mode, H) {
    const hol = H instanceof Set ? H : new Set(H || []);
    const isWork = (d) => !hol.has(iso(d)) && (mode === 'cal' || (d.getUTCDay() !== 0 && d.getUTCDay() !== 6));
    const nx = (d) => new Date(d.getTime() + DAY), pv = (d) => new Date(d.getTime() - DAY);
    const CAP = 3660;
    const snap = (d) => { let x = d, k = 0; while (!isWork(x) && k++ < CAP) x = nx(x); return x; };
    const nextStart = (e) => snap(nx(e));
    const end = (s, n) => { if (!(n > 0)) return new Date(s.getTime()); let d = s, c = isWork(d) ? 1 : 0, k = 0; while (c < n && k++ < CAP * 3) { d = nx(d); if (isWork(d)) c++; } return d; };
    const count = (a, b) => { if (b <= a) return isWork(a) ? 1 : 0; let c = 0, d = a, k = 0; while (d <= b && k++ < CAP * 3) { if (isWork(d)) c++; d = nx(d); } return c; };
    // dời n ngày làm việc (n âm = lùi), tính từ ngày làm việc d
    const shift = (d, n) => { let x = d, k = Math.abs(n | 0), g = 0; const st = n >= 0 ? nx : pv; while (k > 0 && g++ < CAP * 3) { x = st(x); if (isWork(x)) k--; } return x; };
    return { isWork, snap, nextStart, end, count, shift };
  }

  // từ các dòng của computeSchedule() (bảng tiến độ tự sinh ở bước 2) → items có thể chỉnh
  function fromRows(rows) {
    return (rows || []).map((r) => {
      if (r.ph === 'M') return { uid: uid(), kind: 'base', name: r.name, ph: 'M' };
      if (r.sec) return { uid: uid(), kind: 'group', name: r.name, ph: r.ph || 'I', days: +r.days || 0, link: true, lag: 0 };
      return { uid: uid(), kind: 'task', name: r.name, ph: r.ph || 'I', days: +r.days || 0, link: true, lag: 0 };
    });
  }

  // ---------- loại công việc & màu (tự gợi ý theo tên — cùng loại cùng màu; sửa được) ----------
  const TYPES = [
    { k: 'base', n: 'Mốc khởi tính', c: '#111827' },
    { k: 'sx', n: 'Sản xuất & vận chuyển', c: '#2E74B5', re: /san xuat|van chuyen thiet bi|nhap khau|hang ve|giao vat tu|giao hang/ },
    { k: 'yt', n: 'Phê duyệt / chờ / yếu tố ảnh hưởng', c: '#F59E0B', re: /phe duyet|cho |gian tien do|yeu cau|thanh toan|tam ung/ },
    { k: 'cb', n: 'Chuẩn bị, mặt bằng, giàn giáo', c: '#64748B', re: /nhan ban giao ho|ban giao ho thang|tap ket|gian giao|san thao tac|tha doi|dinh vi|kiem tra kich thuoc|khao sat/ },
    { k: 'ck', n: 'Lắp đặt cơ khí (ray, máy, cabin, cáp)', c: '#DC0000', re: /ray|bracket|doi trong|day ho|giam chan|khung xe|cabin|may keo|gia may|thang meo|cap tai|governor|tha cap|lien ket/ },
    { k: 'cua', n: 'Cửa tầng', c: '#EA580C', re: /cua tang|nguong|canh cua|khung cua/ },
    { k: 'dien', n: 'Điện & điều khiển', c: '#CA8A04', re: /tu dieu khien|di day|tin hieu|dau noi|dien|nguon/ },
    { k: 'test', n: 'Căn chỉnh & chạy thử', c: '#7C3AED', re: /can chinh|chay thu|cai dat|commissioning|hieu chinh/ },
    { k: 'kd', n: 'Kiểm định & nghiệm thu', c: '#0891B2', re: /kiem dinh|nghiem thu|bbkd|giam dinh/ },
    { k: 'bg', n: 'Bàn giao & huấn luyện', c: '#00B050', re: /ban giao|huan luyen|dao tao|dua vao su dung/ },
    { k: 'ht', n: 'Hoàn thiện, vệ sinh', c: '#94A3B8', re: /thao do|ve sinh|hoan thien|don dep/ },
    { k: 'ms', n: 'Mốc', c: '#111827' },
    { k: 'khac', n: 'Khác', c: '#6366F1' },
  ];
  const TYPE = Object.fromEntries(TYPES.map((t) => [t.k, t]));
  const PH_TYPE = { P: 'sx', I: 'ck', H: 'bg', M: 'base' };
  const PALETTE = ['#2E74B5', '#0EA5E9', '#0891B2', '#00B050', '#16A34A', '#84CC16', '#CA8A04', '#F59E0B', '#EA580C', '#DC0000', '#DB2777', '#7C3AED', '#6366F1', '#64748B', '#94A3B8', '#111827'];
  const fold = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  // loại gợi ý theo tên (thứ tự quy tắc quan trọng: “Cấp nguồn…, căn chỉnh, chạy thử” → chạy thử; “Nhận bàn giao hố thang” → chuẩn bị)
  function classify(name, kind, ph) {
    if (kind === 'base') return 'base';
    if (kind === 'ms') return 'ms';
    const t = fold(name);
    for (const k of ['yt', 'ht', 'cb', 'test', 'kd', 'sx', 'cua', 'ck', 'dien', 'bg']) if (TYPE[k].re.test(t)) return k;
    return PH_TYPE[ph] || 'khac';
  }
  // màu cuối cùng: màu riêng của dòng → màu của loại (đã đổi) → màu mặc định của loại
  const colorOf = (type, it, tc) => (it && it.color) || (tc && tc[type]) || (TYPE[type] || TYPE.khac).c;

  const hasKids = (items, i) => items[i] && items[i].kind === 'group' && items[i + 1] && (items[i + 1].kind === 'task' || items[i + 1].kind === 'ms');

  // tính ngày cho từng dòng → { rows, total, start, end }
  //   rows: { uid, id, name, days ('–' với mốc), s, e, ph, sec, kind, link, lag, summary, natural }
  function compute(items, ctx) {
    const C = cal(ctx.mode, ctx.H), base = ctx.base, tc = ctx.typeColors || {};
    const out = [];
    let prevEnd = null, gi = -1, ci = 0, ph = 'I', groupRow = null;
    items.forEach((it, i) => {
      if (it.kind === 'base') { out.push({ uid: it.uid, id: '0', name: it.name, days: '–', s: base, e: base, ph: 'M', sec: true, kind: 'base', type: 'base', color: colorOf('base', it, tc) }); prevEnd = base; return; }
      if (it.kind === 'group') { gi++; ci = 0; ph = it.ph || 'I'; }
      const kids = hasKids(items, i);
      const id = it.kind === 'group' ? (ROMAN[gi] || String(gi + 1)) : (gi >= 0 ? `${ROMAN[gi] || gi + 1}.${++ci}` : String(++ci));
      if (it.kind === 'group' && kids) {
        const gt = it.type || PH_TYPE[ph] || 'khac';
        groupRow = { uid: it.uid, id, name: it.name, days: 0, s: null, e: null, ph, sec: true, kind: 'group', summary: true, type: gt, color: colorOf(gt, it, tc) };
        out.push(groupRow); return;
      }
      const after = prevEnd || base;
      let s, e, natural;
      if (it.kind === 'ms') {
        natural = after;
        s = it.link === false ? (pd(it.start) || after) : (it.lag ? C.shift(C.snap(after), it.lag) : after);
        e = s;
      } else {
        natural = C.nextStart(after);
        s = it.link === false ? C.snap(pd(it.start) || natural) : C.shift(natural, it.lag || 0);
        e = C.end(s, +it.days || 0);
      }
      const row = { uid: it.uid, id, name: it.name, days: it.kind === 'ms' ? '–' : (+it.days || 0), s, e, ph: it.kind === 'ms' ? 'M' : ph, sec: it.kind === 'group',
        kind: it.kind, link: it.link !== false, lag: it.lag || 0, natural, msInGroup: it.kind === 'ms' ? ph : undefined };
      row.type = it.type || classify(it.name, it.kind, ph); row.autoType = !it.type; row.color = colorOf(row.type, it, tc); row.ownColor = !!it.color;
      out.push(row);
      prevEnd = e;
      if (it.kind !== 'group' && groupRow) {
        if (!groupRow.s || s < groupRow.s) groupRow.s = s;
        if (!groupRow.e || e > groupRow.e) groupRow.e = e;
      }
      if (it.kind === 'group') groupRow = null;
    });
    // dòng tổng hợp nhóm: số ngày = số ngày (làm việc / lịch) từ đầu đến cuối nhóm
    out.forEach((r) => { if (r.summary) { if (!r.s) { r.s = r.e = base; r.days = 0; } else r.days = C.count(r.s, r.e); } });
    const work = out.filter((r) => r.kind !== 'base');
    const start = work.length ? new Date(Math.min(...work.map((r) => r.s.getTime()))) : base;
    const end = out.length ? new Date(Math.max(...out.map((r) => r.e.getTime()))) : base;
    const total = work.length ? C.count(start, end) : 0;
    return { rows: out, total, start, end };
  }

  // ---------- thao tác (trả về mảng mới, không sửa mảng cũ) ----------
  const clone = (items) => items.map((x) => ({ ...x }));
  const idx = (items, id) => items.findIndex((x) => x.uid === id);
  function patch(items, id, p) { const a = clone(items), i = idx(a, id); if (i >= 0) Object.assign(a[i], p); return a; }

  // đặt ngày bắt đầu mong muốn (kéo thanh / sửa ô Bắt đầu): việc nối tiếp → đổi lag; việc cố định → đổi start
  function setStart(items, id, wantISO, ctx) {
    const want = pd(wantISO); if (!want) return items;
    const { rows } = compute(items, ctx), r = rows.find((x) => x.uid === id); if (!r || r.summary || r.kind === 'base') return items;
    const C = cal(ctx.mode, ctx.H);
    if (r.kind === 'ms') return patch(items, id, { link: false, start: wantISO, lag: 0 });
    if (!r.link) return patch(items, id, { start: iso(C.snap(want)) });
    const w = C.snap(want), n = r.natural;
    const lag = w >= n ? C.count(n, w) - 1 : -(C.count(w, n) - 1);
    return patch(items, id, { lag });
  }
  // số ngày (kéo mép phải / sửa ô Số ngày); đặt ngày kết thúc → tính lại số ngày
  function setDays(items, id, n) { return patch(items, id, { days: Math.max(0, Math.round(+n || 0)) }); }
  function setEnd(items, id, endISO, ctx) {
    const e = pd(endISO); if (!e) return items;
    const r = compute(items, ctx).rows.find((x) => x.uid === id); if (!r || r.summary || r.kind === 'ms' || r.kind === 'base') return items;
    const C = cal(ctx.mode, ctx.H);
    return setDays(items, id, e < r.s ? 1 : Math.max(1, C.count(r.s, e)));
  }
  // bật / tắt "nối tiếp" mà không làm dịch chuyển công việc
  function setLink(items, id, on, ctx) {
    const r = compute(items, ctx).rows.find((x) => x.uid === id); if (!r || r.summary || r.kind === 'base') return items;
    if (!on) return patch(items, id, { link: false, start: iso(r.s), lag: 0 });
    return setStart(patch(items, id, { link: true, lag: 0 }), id, iso(r.s), ctx);
  }
  function insert(items, afterId, kind, ctx) {
    const a = clone(items);
    let i = afterId ? idx(a, afterId) : a.length - 1;
    if (i < 0) i = a.length - 1;
    // chèn sau một nhóm có việc con → chèn sau việc con cuối của nhóm đó khi thêm nhóm
    if (kind === 'group') { let j = i + 1; while (a[j] && a[j].kind !== 'group') j++; i = j - 1; }
    const it = kind === 'group' ? { uid: uid(), kind: 'group', name: 'NHÓM CÔNG VIỆC MỚI', ph: 'I', days: 1, link: true, lag: 0 }
      : kind === 'ms' ? { uid: uid(), kind: 'ms', name: 'Mốc mới', ph: 'M', link: true, lag: 0 }
        : { uid: uid(), kind: 'task', name: 'Công việc mới', ph: 'I', days: 1, link: true, lag: 0 };
    a.splice(i + 1, 0, it);
    return { items: a, uid: it.uid };
  }
  function remove(items, id) { const a = clone(items), i = idx(a, id); if (i < 0 || a[i].kind === 'base') return items; a.splice(i, 1); return a; }
  // chuyển dòng tới vị trí `to` (chỉ số trong mảng sau khi bỏ dòng đó); dòng mốc khởi tính luôn đứng đầu
  function move(items, id, to) {
    const a = clone(items), i = idx(a, id); if (i < 0 || a[i].kind === 'base') return items;
    const [it] = a.splice(i, 1);
    const min = a[0] && a[0].kind === 'base' ? 1 : 0;
    a.splice(Math.max(min, Math.min(a.length, to)), 0, it);
    return a;
  }
  // khoá so sánh dữ liệu bước 2: đổi dữ liệu nguồn → nhắc tạo lại
  const srcKey = (o) => JSON.stringify(o);

  const api = { TYPES, TYPE, PALETTE, classify, colorOf, cal, fromRows, compute, setStart, setDays, setEnd, setLink, insert, remove, move, srcKey, pd, iso, ROMAN };

  // ======================= giao diện (trình duyệt) =======================
  if (typeof document !== 'undefined') {
    const COLOR = { P: '#2E74B5', I: '#DC0000', H: '#00B050', M: '#111827' };
    const PH_NAME = { P: 'Sản xuất', I: 'Lắp đặt', H: 'Bàn giao' };
    const ZOOM = { day: 28, week: 12, month: 4.5 }, ZMIN = 2, ZMAX = 60;
    const e = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const dmy = (d) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
    const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    // host: phần tử chứa; o: { get(): items, set(items), ctx(): {base, mode, H}, onChange() }
    api.mount = function (host, o) {
      const st = { sel: null, zoom: 'week', px: ZOOM.week, undo: [], redo: [] };
      const getTC = () => (o.getTC && o.getTC()) || {};
      const ctx = () => Object.assign({}, o.ctx(), { typeColors: getTC() });
      const snap = () => JSON.stringify({ i: o.get(), t: getTC() });
      const load = (j) => { const d = JSON.parse(j); o.set(d.i); if (o.setTC) o.setTC(d.t || {}); };
      const push = () => { st.undo.push(snap()); if (st.undo.length > 80) st.undo.shift(); st.redo = []; };
      const commit = (next, keepSel) => {
        const cur = o.get();
        if (next === cur) return;
        push();
        o.set(next); if (!keepSel && !next.some((x) => x.uid === st.sel)) st.sel = null;
        render(); o.onChange && o.onChange();
      };
      // đổi màu theo loại (cả loại cùng đổi)
      const commitTC = (tc) => { push(); if (o.setTC) o.setTC(tc); render(); o.onChange && o.onChange(); };
      const undo = () => { if (!st.undo.length) return; st.redo.push(snap()); load(st.undo.pop()); render(); o.onChange && o.onChange(); };
      const redo = () => { if (!st.redo.length) return; st.undo.push(snap()); load(st.redo.pop()); render(); o.onChange && o.onChange(); };

      host.innerHTML = `<div class="gx-bar" role="toolbar" aria-label="Chỉnh tiến độ">
          <button type="button" class="btn sm pri" data-a="task">＋ Công việc</button>
          <button type="button" class="btn sm gho" data-a="ms">◆ Mốc</button>
          <button type="button" class="btn sm gho" data-a="group">＋ Nhóm</button>
          <span class="gx-sep"></span>
          <button type="button" class="btn sm gho" data-a="up" title="Chuyển dòng lên">↑</button>
          <button type="button" class="btn sm gho" data-a="down" title="Chuyển dòng xuống">↓</button>
          <button type="button" class="btn sm gho gx-del" data-a="del" title="Xoá dòng đang chọn (phím Delete)">🗑 Xoá dòng</button>
          <span class="gx-sep"></span>
          <button type="button" class="btn sm gho" data-a="undo" title="Hoàn tác (Ctrl+Z)">↶</button>
          <button type="button" class="btn sm gho" data-a="redo" title="Làm lại (Ctrl+Y)">↷</button>
          <span class="gx-zoom" role="group" aria-label="Thu phóng">
            <button type="button" data-z="day">Ngày</button><button type="button" data-z="week">Tuần</button><button type="button" data-z="month">Tháng</button>
          </span>
          <span class="gx-zm" role="group" aria-label="Phóng to / thu nhỏ">
            <button type="button" data-zs="-1" title="Thu nhỏ (Ctrl + lăn chuột trên biểu đồ)" aria-label="Thu nhỏ">−</button><span class="gx-zp" data-zp></span><button type="button" data-zs="1" title="Phóng to (Ctrl + lăn chuột trên biểu đồ)" aria-label="Phóng to">＋</button><button type="button" class="gx-fit" data-zfit title="Vừa khung — thấy toàn bộ tiến độ">↔</button>
          </span>
          <span class="gx-info" data-info></span>
        </div>
        <div class="gx-leg" data-legend aria-label="Màu theo loại công việc"></div>
        <div class="gx-wrap" tabindex="-1"><table class="gx"><thead></thead><tbody></tbody></table></div>
        <div class="gx-tip" hidden></div><div class="gx-pop" hidden role="dialog" aria-label="Chọn màu"></div>`;
      const thead = host.querySelector('thead'), tbody = host.querySelector('tbody'), wrap = host.querySelector('.gx-wrap'), tip = host.querySelector('.gx-tip'), pop = host.querySelector('.gx-pop'), leg = host.querySelector('[data-legend]');

      let G = null;   // trạng thái lưới thời gian của lần vẽ gần nhất
      function render() {
        const items = o.get(), c = ctx(), R = compute(items, c), Cl = cal(c.mode, c.H);
        const px = st.px;
        st.zoom = px >= 18 ? 'day' : px >= 7 ? 'week' : 'month';   // nhãn thang thời gian theo độ phóng
        const lo = new Date(Math.min(c.base.getTime(), R.start.getTime())), hi = R.end;
        // khung thời gian: từ đầu tuần chứa mốc sớm nhất − 1 tuần, tới cuối tuần + 2 tuần sau mốc muộn nhất
        const t0 = new Date(lo.getTime() - (((lo.getUTCDay() + 6) % 7) + 7) * DAY);
        const t1 = new Date(hi.getTime() + (14 + (7 - ((hi.getUTCDay() + 6) % 7))) * DAY);
        const nd = Math.round((t1 - t0) / DAY), W = Math.round(nd * px);
        G = { t0, px, nd, W, rows: R.rows };
        // nền: ngày nghỉ tô xám, thứ 2 có vạch mảnh
        const bg = [];
        for (let k = 0; k < nd; k++) {
          const d = new Date(t0.getTime() + k * DAY);
          if (!Cl.isWork(d)) { const a = (k * px).toFixed(1), b = ((k + 1) * px).toFixed(1); bg.push(`transparent ${a}px,${c.H.has(iso(d)) ? '#fde2e2' : '#eef1f5'} ${a}px,${c.H.has(iso(d)) ? '#fde2e2' : '#eef1f5'} ${b}px,transparent ${b}px`); }
        }
        host.style.setProperty('--gx-bg', bg.length ? `linear-gradient(to right,${bg.join(',')})` : 'none');
        host.style.setProperty('--gx-w', W + 'px');
        host.style.setProperty('--gx-wk', (7 * px) + 'px');
        host.style.setProperty('--gx-off', (((8 - t0.getUTCDay()) % 7) * px) + 'px');
        // tiêu đề thời gian: hàng tháng + hàng ngày / tuần
        let top = '', bot = '';
        for (let k = 0; k < nd;) {
          const d = new Date(t0.getTime() + k * DAY), last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
          const n = Math.min(nd - k, last - d.getUTCDate() + 1);
          top += `<span style="left:${k * px}px;width:${n * px}px">${n * px > 46 ? `Tháng ${d.getUTCMonth() + 1}/${d.getUTCFullYear()}` : n * px > 22 ? d.getUTCMonth() + 1 : ''}</span>`;
          k += n;
        }
        for (let k = 0; k < nd; k++) {
          const d = new Date(t0.getTime() + k * DAY);
          if (st.zoom === 'day') bot += `<span class="${Cl.isWork(d) ? '' : 'off'}" style="left:${k * px}px;width:${px}px" title="${DOW[d.getUTCDay()]} ${dmy(d)}">${d.getUTCDate()}</span>`;
          else if (d.getUTCDay() === 1) bot += `<span style="left:${k * px}px;width:${7 * px}px" title="Tuần từ ${dmy(d)}">${st.zoom === 'week' ? d.getUTCDate() + '/' + (d.getUTCMonth() + 1) : ''}</span>`;
        }
        thead.innerHTML = `<tr><th class="gx-h gx-hd" aria-label="Kéo để đổi thứ tự"></th><th class="gx-h gx-id">STT</th><th class="gx-h gx-nm">Nội dung công việc</th>
          <th class="gx-h gx-dt">Bắt đầu</th><th class="gx-h gx-n">Số ngày</th><th class="gx-h gx-dt">Kết thúc</th><th class="gx-h gx-lk" title="Nối tiếp việc phía trên — tự dời theo">↳</th>
          <th class="gx-tl"><div class="gx-sc"><div class="gx-m">${top}</div><div class="gx-d">${bot}</div></div></th></tr>`;
        const unit = c.mode === 'work' ? 'ngày làm việc' : 'ngày lịch';
        tbody.innerHTML = R.rows.map((r, i) => {
          const it = items[i], col = r.color || COLOR[r.ph] || COLOR.I;
          const L = Math.round((r.s - t0) / DAY * px), Wd = Math.max(px, Math.round(((r.e - r.s) / DAY + 1) * px));
          let bar;
          if (r.kind === 'base' || r.kind === 'ms') bar = `<div class="gx-ms${r.kind === 'base' ? ' fix' : ''}" data-drag="${r.kind === 'base' ? '' : 'move'}" style="left:${L + px / 2 - 8}px;--c:${col}" title="${e(r.name)} — ${dmy(r.s)}"></div><span class="gx-lb" style="left:${L + px / 2 + 12}px">${dmy(r.s)}</span>`;
          else if (r.summary) bar = `<div class="gx-sum" style="left:${L}px;width:${Wd}px;--c:${col}" title="${e(r.name)}: ${dmy(r.s)} → ${dmy(r.e)} (${r.days} ${unit})"></div><span class="gx-lb" style="left:${L + Wd + 6}px">${r.days} ngày</span>`;
          else { bar = `<div class="gx-b${r.sec ? ' grp' : ''}" data-drag="move" style="left:${L}px;width:${Wd}px;--c:${col}" title="${e(r.name)}: ${dmy(r.s)} → ${dmy(r.e)} (${r.days} ${unit}) — kéo để dời, kéo mép phải để đổi số ngày"><i class="gx-rz" data-drag="size"></i></div><span class="gx-lb" style="left:${L + Wd + 6}px">${r.days} ngày${r.link && r.lag ? ` · ${r.lag > 0 ? '+' : ''}${r.lag}` : ''}</span>`; }
          const fixed = r.kind === 'base' || r.summary;
          const nm = `<input class="gx-in" data-f="name" value="${e(it.name)}"${r.kind === 'base' ? ' list="baseNameList" title="Mốc khởi tính — vd. xác nhận bản vẽ, thanh toán tạm ứng, phê duyệt vật liệu"' : ''} aria-label="Tên công việc dòng ${r.id}">`;
          const sw = r.kind === 'base' ? '' : `<button type="button" class="gx-sw${r.ownColor ? ' own' : ''}" data-sw="${r.uid}" style="--c:${col}" title="Màu: ${e((TYPE[r.type] || TYPE.khac).n)}${r.ownColor ? ' (màu riêng)' : ''} — bấm để đổi màu / loại"></button>`;
          const phSel = it.kind === 'group' ? `<select class="gx-ph" data-f="ph" title="Màu / giai đoạn" style="--c:${col}">${Object.keys(PH_NAME).map((k) => `<option value="${k}"${it.ph === k ? ' selected' : ''}>${PH_NAME[k]}</option>`).join('')}</select>` : '';
          return `<tr class="gx-r ${r.sec ? 'sec' : ''} k-${r.kind}${st.sel === r.uid ? ' on' : ''}" data-uid="${r.uid}">
            <td class="gx-hd">${r.kind === 'base' ? '' : '<span class="gx-grip" title="Kéo để đổi thứ tự">⋮⋮</span>'}</td>
            <td class="gx-id">${e(r.id)}</td>
            <td class="gx-nm"><div class="gx-nmw${r.sec || r.kind === 'base' ? '' : ' ind'}">${sw}${nm}${phSel}</div></td>
            <td class="gx-dt">${r.kind === 'base' ? `<input type="date" data-f="base" value="${iso(r.s)}" aria-label="Ngày mốc khởi tính" title="Ngày mốc khởi tính — cả tiến độ tự dời theo">` : fixed ? `<span>${DOW[r.s.getUTCDay()]} ${dmy(r.s)}</span>` : `<input type="date" data-f="start" value="${iso(r.s)}" aria-label="Bắt đầu">`}</td>
            <td class="gx-n">${fixed || r.kind === 'ms' ? `<span>${r.kind === 'ms' || r.kind === 'base' ? '–' : r.days}</span>` : `<input type="number" min="0" data-f="days" value="${r.days}" aria-label="Số ngày">`}</td>
            <td class="gx-dt">${fixed || r.kind === 'ms' ? `<span>${DOW[r.e.getUTCDay()]} ${dmy(r.e)}</span>` : `<input type="date" data-f="end" value="${iso(r.e)}" aria-label="Kết thúc">`}</td>
            <td class="gx-lk">${fixed ? '' : `<input type="checkbox" data-f="link" ${r.link ? 'checked' : ''} title="Nối tiếp việc phía trên (tự dời theo)">`}</td>
            <td class="gx-tl"><div class="gx-sc">${bar}</div></td></tr>`;
        }).join('');
        host.querySelectorAll('[data-z]').forEach((b) => b.classList.toggle('on', Math.abs(ZOOM[b.dataset.z] - px) < 0.01));
        host.querySelector('[data-zp]').textContent = Math.round(px / ZOOM.week * 100) + '%';
        host.querySelector('[data-zs="-1"]').disabled = px <= ZMIN + 0.01; host.querySelector('[data-zs="1"]').disabled = px >= ZMAX - 0.01;
        host.querySelector('[data-info]').textContent = `Tổng: ${R.total} ${unit} · ${dmy(R.start)} → ${dmy(R.end)}`;
        // chú giải màu: các loại đang có trong bảng — bấm để đổi màu cả loại
        const used = []; R.rows.forEach((r) => { if (r.kind !== 'base' && !used.includes(r.type)) used.push(r.type); });
        const tc = getTC(), anyOwn = R.rows.some((r) => r.ownColor);
        leg.innerHTML = '<span class="gx-leg-l">Màu theo loại:</span>' + used.map((k) => `<button type="button" class="gx-lc" data-tsw="${k}" title="Bấm để đổi màu cho mọi việc loại này"><i style="background:${tc[k] || (TYPE[k] || TYPE.khac).c}"></i>${e((TYPE[k] || TYPE.khac).n)}</button>`).join('') +
          (Object.keys(tc).length || anyOwn ? '<button type="button" class="gx-lr" data-treset title="Bỏ mọi màu đã đổi, dùng màu app gợi ý">↺ Màu gợi ý</button>' : '');
        host.querySelector('[data-a="undo"]').disabled = !st.undo.length;
        host.querySelector('[data-a="redo"]').disabled = !st.redo.length;
        const sel = items.find((x) => x.uid === st.sel);
        ['up', 'down', 'del'].forEach((a) => { host.querySelector(`[data-a="${a}"]`).disabled = !sel || sel.kind === 'base'; });
      }

      // ----- chọn màu / loại -----
      const closePop = () => { pop.hidden = true; pop.innerHTML = ''; };
      function openPop(btn, html) {
        pop.innerHTML = html; pop.hidden = false;
        const b = btn.getBoundingClientRect(), hb = host.getBoundingClientRect();
        pop.style.left = Math.max(0, Math.min(b.left - hb.left, hb.width - 270)) + 'px'; pop.style.top = (b.bottom - hb.top + 6) + 'px';
      }
      const swatches = (cur) => '<div class="gx-pal">' + PALETTE.map((c) => `<button type="button" data-pc="${c}" style="background:${c}"${c.toLowerCase() === String(cur || '').toLowerCase() ? ' class="on"' : ''} aria-label="${c}"></button>`).join('') + '</div>';
      host.addEventListener('click', (ev) => {
        const sw = ev.target.closest('[data-sw]'), tsw = ev.target.closest('[data-tsw]');
        if (sw) {
          ev.stopPropagation();
          const r = G.rows.find((x) => x.uid === sw.dataset.sw); if (!r) return;
          st.popFor = { uid: r.uid };
          openPop(sw, `<b>Màu dòng ${e(r.id)}</b><label class="gx-pl">Loại công việc<select data-ptype>${TYPES.filter((t) => !['base'].includes(t.k)).map((t) => `<option value="${t.k}"${t.k === r.type ? ' selected' : ''}>${e(t.n)}${t.k === classify(r.name, r.kind, r.ph) ? ' (gợi ý)' : ''}</option>`).join('')}</select></label>
            <div class="gx-ph2">Màu riêng cho dòng này:</div>${swatches(r.ownColor ? r.color : '')}
            <div class="gx-pa">${r.ownColor ? '<button type="button" class="hs-link" data-pclear>Dùng màu theo loại</button>' : '<span class="gx-pm">Đang dùng màu của loại</span>'}</div>`);
          return;
        }
        if (tsw) {
          ev.stopPropagation(); const k = tsw.dataset.tsw; st.popFor = { type: k };
          openPop(tsw, `<b>Màu cho loại “${e((TYPE[k] || TYPE.khac).n)}”</b><div class="gx-ph2">Mọi việc thuộc loại này cùng đổi màu.</div>${swatches(getTC()[k] || (TYPE[k] || TYPE.khac).c)}
            ${getTC()[k] ? '<div class="gx-pa"><button type="button" class="hs-link" data-pclear>Về màu gợi ý</button></div>' : ''}`);
          return;
        }
        if (ev.target.closest('[data-treset]')) { push(); if (o.setTC) o.setTC({}); o.set(o.get().map((x) => { const y = { ...x }; delete y.color; delete y.type; return y; })); render(); o.onChange && o.onChange(); return; }
        const pc = ev.target.closest('[data-pc]'), pcl = ev.target.closest('[data-pclear]');
        if ((pc || pcl) && st.popFor) {
          const f = st.popFor; closePop();
          if (f.uid) commit(patch(o.get(), f.uid, { color: pc ? pc.dataset.pc : undefined }), true);
          else { const tc = { ...getTC() }; if (pc) tc[f.type] = pc.dataset.pc; else delete tc[f.type]; commitTC(tc); }
          return;
        }
        if (!ev.target.closest('.gx-pop')) closePop();
      }, true);
      pop.addEventListener('change', (ev) => {
        if (!ev.target.matches('[data-ptype]') || !st.popFor || !st.popFor.uid) return;
        const r = G.rows.find((x) => x.uid === st.popFor.uid), v = ev.target.value; closePop();
        commit(patch(o.get(), r.uid, { type: v === classify(r.name, r.kind, r.ph) ? undefined : v }), true);
      });
      document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !pop.hidden) closePop(); });

      // ----- phóng to / thu nhỏ: giữ nguyên ngày đang ở giữa (hoặc dưới con trỏ) -----
      function zoomTo(px, clientX) {
        px = Math.max(ZMIN, Math.min(ZMAX, px)); if (!G || Math.abs(px - st.px) < 0.001) { st.px = px; render(); return; }
        const tl = tbody.querySelector('.gx-tl') || thead.querySelector('.gx-tl'); const lw = tl ? tl.offsetLeft : 0;
        const vis = wrap.clientWidth - lw, ax = clientX != null ? clientX - wrap.getBoundingClientRect().left - lw : vis / 2;
        const day = (wrap.scrollLeft + Math.max(0, ax)) / G.px, t0 = G.t0.getTime();
        st.px = px; render();
        wrap.scrollLeft = Math.max(0, ((t0 - G.t0.getTime()) / DAY + day) * G.px - Math.max(0, ax));
      }
      wrap.addEventListener('wheel', (ev) => {
        if (!(ev.ctrlKey || ev.metaKey) || !ev.target.closest('.gx-tl')) return;
        ev.preventDefault(); zoomTo(st.px * (ev.deltaY < 0 ? 1.15 : 1 / 1.15), ev.clientX);
      }, { passive: false });
      host.addEventListener('keydown', (ev) => {
        if (/INPUT|SELECT|TEXTAREA/.test(ev.target.tagName)) return;
        if (ev.key === '+' || ev.key === '=') { ev.preventDefault(); zoomTo(st.px * 1.25); } else if (ev.key === '-' || ev.key === '_') { ev.preventDefault(); zoomTo(st.px * 0.8); }
      });

      // ----- sửa ô -----
      host.addEventListener('change', (ev) => {
        const t = ev.target, tr = t.closest('tr[data-uid]'); if (!tr || !t.dataset.f) return;
        const id = tr.dataset.uid, items = o.get(), f = t.dataset.f;
        st.sel = id;
        if (f === 'name') { const it = items.find((x) => x.uid === id); if (it && it.kind === 'base' && o.setBaseName) o.setBaseName(t.value); commit(patch(items, id, { name: t.value }), true); }
        else if (f === 'base') { if (t.value && o.setBase) { o.setBase(t.value); render(); o.onChange && o.onChange(); } }
        else if (f === 'ph') commit(patch(items, id, { ph: t.value }), true);
        else if (f === 'days') commit(setDays(items, id, t.value), true);
        else if (f === 'start') commit(setStart(items, id, t.value, ctx()), true);
        else if (f === 'end') commit(setEnd(items, id, t.value, ctx()), true);
        else if (f === 'link') commit(setLink(items, id, t.checked, ctx()), true);
      });
      // ----- chọn dòng, nút công cụ -----
      host.addEventListener('click', (ev) => {
        const z = ev.target.closest('[data-z]'); if (z) { zoomTo(ZOOM[z.dataset.z]); return; }
        if (ev.target.closest('[data-zfit]')) { const tl = thead.querySelector('.gx-tl'), vis = wrap.clientWidth - (tl ? tl.offsetLeft : 0) - 8; zoomTo(st.px * vis / G.W); wrap.scrollLeft = 0; return; }
        const zs = ev.target.closest('[data-zs]'); if (zs) { zoomTo(st.px * (+zs.dataset.zs > 0 ? 1.25 : 0.8)); return; }
        const b = ev.target.closest('[data-a]');
        if (b) {
          const a = b.dataset.a, items = o.get();
          if (a === 'undo') return undo();
          if (a === 'redo') return redo();
          if (a === 'task' || a === 'ms' || a === 'group') { const r = insert(items, st.sel, a, ctx()); st.sel = r.uid; commit(r.items, true); const inp = host.querySelector(`tr[data-uid="${r.uid}"] .gx-in`); if (inp) { inp.focus(); inp.select(); } return; }
          if (!st.sel) return;
          const i = items.findIndex((x) => x.uid === st.sel);
          if (a === 'del') { const nx = items[i + 1] || items[i - 1]; commit(remove(items, st.sel)); st.sel = nx && nx.kind !== 'base' ? nx.uid : null; render(); return; }
          if (a === 'up') return commit(move(items, st.sel, i - 1), true);
          if (a === 'down') return commit(move(items, st.sel, i + 1), true);
          return;
        }
        const tr = ev.target.closest('tr[data-uid]');
        // bấm vào phần bảng bên trái → cuộn ngang tới thanh của dòng đó
        if (tr && !ev.target.closest('.gx-tl')) { const bar = tr.querySelector('.gx-b,.gx-sum,.gx-ms'); if (bar) { const lw = tr.querySelector('.gx-tl').offsetLeft, x = lw + bar.offsetLeft - 60; if (x < wrap.scrollLeft + lw || x > wrap.scrollLeft + wrap.clientWidth - 80) wrap.scrollTo({ left: Math.max(0, x - lw), behavior: 'smooth' }); } }
        if (tr && st.sel !== tr.dataset.uid) { st.sel = tr.dataset.uid; host.querySelectorAll('tr.on').forEach((x) => x.classList.remove('on')); tr.classList.add('on'); const it = o.get().find((x) => x.uid === st.sel); ['up', 'down', 'del'].forEach((a) => { host.querySelector(`[data-a="${a}"]`).disabled = !it || it.kind === 'base'; }); }
      });
      host.addEventListener('keydown', (ev) => {
        const typing = /INPUT|SELECT|TEXTAREA/.test(ev.target.tagName) && ev.target.type !== 'checkbox';
        if ((ev.ctrlKey || ev.metaKey) && !typing && ev.key.toLowerCase() === 'z') { ev.preventDefault(); ev.shiftKey ? redo() : undo(); }
        else if ((ev.ctrlKey || ev.metaKey) && !typing && ev.key.toLowerCase() === 'y') { ev.preventDefault(); redo(); }
        else if (ev.key === 'Delete' && !typing && st.sel) { ev.preventDefault(); host.querySelector('[data-a="del"]').click(); }
        else if (ev.key === 'Enter' && ev.target.classList.contains('gx-in')) ev.target.blur();
      });

      // ----- kéo thanh (dời / đổi số ngày) và kéo tay nắm (đổi thứ tự) -----
      let drag = null;
      const showTip = (x, y, text) => { tip.hidden = false; tip.textContent = text; tip.style.left = (x + 14) + 'px'; tip.style.top = (y + 14) + 'px'; };
      host.addEventListener('pointerdown', (ev) => {
        if (ev.button !== 0) return;
        const grip = ev.target.closest('.gx-grip');
        const tr = ev.target.closest('tr[data-uid]');
        if (grip && tr) { drag = { kind: 'row', uid: tr.dataset.uid, tr, y0: ev.clientY }; tr.classList.add('drag'); grip.setPointerCapture(ev.pointerId); ev.preventDefault(); return; }
        const h = ev.target.closest('[data-drag]'); if (!h || !tr || !h.dataset.drag) return;
        const el = h.classList.contains('gx-rz') ? h.parentElement : h;
        const r = G.rows.find((x) => x.uid === tr.dataset.uid); if (!r) return;
        drag = { kind: h.dataset.drag, uid: r.uid, r, el, x0: ev.clientX, L: parseFloat(el.style.left), W: parseFloat(el.style.width) || 0, dd: 0 };
        st.sel = r.uid; host.querySelectorAll('tr.on').forEach((x) => x.classList.remove('on')); tr.classList.add('on');
        el.classList.add('drag'); h.setPointerCapture(ev.pointerId); ev.preventDefault();
      });
      host.addEventListener('pointermove', (ev) => {
        if (!drag) return;
        if (drag.kind === 'row') {
          const over = document.elementFromPoint(ev.clientX, ev.clientY), t = over && over.closest('tr[data-uid]');
          tbody.querySelectorAll('tr.dropb,tr.dropa').forEach((x) => x.classList.remove('dropb', 'dropa'));
          if (t && t !== drag.tr && !t.classList.contains('k-base')) { const rc = t.getBoundingClientRect(); t.classList.add(ev.clientY < rc.top + rc.height / 2 ? 'dropb' : 'dropa'); drag.over = t; }
          else drag.over = null;
          return;
        }
        const dd = Math.round((ev.clientX - drag.x0) / G.px); drag.dd = dd;
        const r = drag.r, C = cal(ctx().mode, ctx().H);
        if (drag.kind === 'size') {
          drag.el.style.width = Math.max(G.px, drag.W + dd * G.px) + 'px';
          const ne = new Date(r.e.getTime() + dd * DAY); const n = ne < r.s ? 1 : Math.max(1, C.count(r.s, ne));
          showTip(ev.clientX, ev.clientY, `Kết thúc ${dmy(ne < r.s ? r.s : ne)} · ${n} ngày`);
        } else {
          drag.el.style.left = (drag.L + dd * G.px) + 'px';
          const ns = new Date(r.s.getTime() + dd * DAY), s2 = r.kind === 'ms' ? ns : C.snap(ns);
          showTip(ev.clientX, ev.clientY, r.kind === 'ms' ? `Mốc ${dmy(s2)}` : `Bắt đầu ${dmy(s2)} → ${dmy(C.end(s2, +r.days || 0))}`);
        }
      });
      const endDrag = () => {
        if (!drag) return;
        const d = drag; drag = null; tip.hidden = true;
        if (d.kind === 'row') {
          d.tr.classList.remove('drag');
          const t = d.over; tbody.querySelectorAll('tr.dropb,tr.dropa').forEach((x) => x.classList.remove('dropb', 'dropa'));
          if (!t) return;
          const items = o.get(), from = items.findIndex((x) => x.uid === d.uid);
          let to = items.findIndex((x) => x.uid === t.dataset.uid) + (d.dropAfter ? 1 : 0);
          if (to > from) to--;
          if (to !== from) commit(move(items, d.uid, to), true);
          return;
        }
        d.el.classList.remove('drag');
        if (!d.dd) return;
        const items = o.get(), r = d.r;
        if (d.kind === 'size') { const C = cal(ctx().mode, ctx().H), ne = new Date(r.e.getTime() + d.dd * DAY); commit(setDays(items, r.uid, ne < r.s ? 1 : Math.max(1, C.count(r.s, ne))), true); }
        else commit(setStart(items, r.uid, iso(new Date(r.s.getTime() + d.dd * DAY)), ctx()), true);
      };
      // ghi lại hướng thả trước khi xoá class
      host.addEventListener('pointermove', () => { if (drag && drag.kind === 'row' && drag.over) drag.dropAfter = drag.over.classList.contains('dropa'); });
      host.addEventListener('pointerup', endDrag);
      host.addEventListener('pointercancel', endDrag);

      render();
      return { render, undo, redo, select: (id) => { st.sel = id; render(); }, state: st };
    };
  }

  root.Gantt = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
