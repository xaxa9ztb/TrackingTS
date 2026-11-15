// Lịch chọn KHOẢNG NGÀY trên một bảng: chạm ngày bắt đầu rồi chạm ngày kết thúc (chạm ngày trước ngày bắt đầu → tự đảo).
// Dùng chung cho mọi trang (không phụ thuộc thư viện; tự chèn CSS).
//   RangeCal.create(el, opts)  → vẽ lịch ngay trong el. opts:
//       from, to ('YYYY-MM-DD'), min, max, month ('YYYY-MM' tháng hiển thị đầu),
//       off(d)   → chuỗi/true nếu là ngày nghỉ (mặc định: Chủ nhật + ngày lễ của LaborVN nếu có), tô đỏ
//       mark(d)  → chuỗi chú thích nếu ngày có dữ liệu (chấm cam), vd "đã có phân công"
//       single   → true: chỉ chọn 1 ngày (from = to)
//       onChange(from, to, done)  done = true khi đã chọn xong cả ngày kết thúc
//     trả về { update(opts), stage() }
//   RangeCal.pair(fromInput, toInput, opts) → gắn vào 2 ô <input type="date"> sẵn có: ẩn 2 ô (opts.hide = phần tử bọc),
//     thay bằng 1 nút "dd/mm/yyyy → dd/mm/yyyy · n ngày", bấm mở lịch ngay bên dưới. Giá trị vẫn ghi vào 2 ô cũ
//     và phát sự kiện input + change như người dùng gõ → code cũ của trang không phải sửa.
(function (root) {
  'use strict';
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const parse = (s) => new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)));
  const add = (s, n) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const shiftM = (ym, k) => { const d = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + k, 1)); return iso(d).slice(0, 7); };
  const dmy = (s) => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '';
  const days = (a, b) => Math.round((parse(b) - parse(a)) / 864e5) + 1;
  const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function defOff(d) {
    if (parse(d).getUTCDay() === 0) return 'Chủ nhật';
    const L = root.LaborVN; const h = L && L.holidayInfo ? L.holidayInfo(d) : null;
    return h ? (h.name || 'Ngày lễ') : false;
  }

  const CSS = `
.rcx{border:1px solid var(--ni-line,#e3e7ee);border-radius:12px;padding:8px;background:var(--ni-surface,#fff);color:var(--ni-ink,#0f1b2d);user-select:none;-webkit-user-select:none;font-size:14px;max-width:420px}
.rcx-head{display:flex;align-items:center;gap:2px;margin-bottom:4px}
.rcx-head b{flex:1;text-align:center;font-size:14.5px}
.rcx-nav{border:0;background:none;font:inherit;font-size:20px;line-height:1;min-width:36px;height:36px;border-radius:8px;cursor:pointer;color:var(--ni-ink-2,#344054);padding:0}
.rcx-nav.y{font-size:16px;color:var(--ni-muted,#667085)}
.rcx-nav:hover{background:var(--ni-sunk,#eef1f5)}
.rcx-nav:disabled{opacity:.3;cursor:default;background:none}
.rcx-grid{display:grid;grid-template-columns:repeat(7,1fr);row-gap:2px}
.rcx-w{text-align:center;font-size:12px;font-weight:600;color:var(--ni-muted,#667085);padding:4px 0}
.rcx-d{position:relative;height:38px;border:0;background:none;font:inherit;font-size:14px;color:inherit;cursor:pointer;border-radius:0;padding:0;margin:0;text-align:center}
.rcx-d.out{color:#b7bfcc}
.rcx-d.off{color:var(--ni-danger,#b42318)}
.rcx-d.out.off{color:#e6a9a3}
.rcx-d.now{font-weight:700;text-decoration:underline}
.rcx-d.in{background:var(--ni-action-soft,#eef4ff)}
.rcx-d.a,.rcx-d.b{background:var(--ni-action,#1d4ed8);color:#fff;font-weight:700}
.rcx-d.a{border-radius:10px 0 0 10px}.rcx-d.b{border-radius:0 10px 10px 0}.rcx-d.a.b{border-radius:10px}
.rcx-d.mk::after{content:"";position:absolute;left:50%;bottom:4px;width:5px;height:5px;margin-left:-2.5px;border-radius:50%;background:var(--ni-warn,#b45309)}
.rcx-d.a.mk::after,.rcx-d.b.mk::after{background:#fff}
.rcx-d:disabled{color:#d0d5dd;cursor:not-allowed;background:none;text-decoration:line-through}
.rcx-d:focus-visible{outline:2px solid var(--ni-action,#1d4ed8);outline-offset:-2px}
.rcx-sum{margin-top:6px;font-size:13px;color:var(--ni-ink-2,#344054);min-height:18px}
.rcx-next{color:var(--ni-action,#1d4ed8);font-weight:600}
.rcx-btn{display:flex;align-items:center;gap:8px;width:100%;max-width:420px;min-height:44px;padding:8px 12px;border:1px solid var(--ni-line-strong,#c9d0db);border-radius:10px;background:var(--ni-surface,#fff);color:var(--ni-ink,#0f1b2d);font:inherit;font-size:14px;text-align:left;cursor:pointer}
.rcx-btn:hover{border-color:var(--ni-action,#1d4ed8)}
.rcx-btn .ic{flex:none}.rcx-btn .tx{flex:1;min-width:0}.rcx-btn .n{color:var(--ni-muted,#667085);font-size:13px;white-space:nowrap}
.rcx-btn .ph{color:var(--ni-muted,#667085)}
.rcx-lbl{display:block;font-size:13px;font-weight:600;margin:0 0 4px;color:var(--ni-ink-2,#344054)}
.rcx-wrap{margin:0 0 10px}
.rcx-pop{margin-top:6px}
.rcx-wrap.float{position:relative}
.rcx-wrap.float .rcx-pop{position:absolute;z-index:60;top:100%;left:0;width:min(340px,92vw)}
.rcx-wrap.float .rcx-pop{box-shadow:0 12px 32px rgba(17,24,39,.18)}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]) .rcx-d.out{color:#5b6472}}
`;
  function injectCSS() {
    if (typeof document === 'undefined' || document.getElementById('rcx-css')) return;
    const s = document.createElement('style'); s.id = 'rcx-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  function create(el, opts) {
    injectCSS();
    let o = Object.assign({}, opts || {});
    let stage = 0;                                  // 0: lần chạm tới là ngày bắt đầu; 1: là ngày kết thúc
    let month = (isDate(o.from) ? o.from : (isDate(o.min) && today() < o.min ? o.min : today())).slice(0, 7);
    if (o.month) month = o.month;
    el.classList.add('rcx');
    function render() {
      if (isDate(o.min) && month < o.min.slice(0, 7)) month = o.min.slice(0, 7);   // tháng hiển thị luôn nằm trong khoảng cho phép
      if (isDate(o.max) && month > o.max.slice(0, 7)) month = o.max.slice(0, 7);
      const a = isDate(o.from) ? o.from : '', b0 = isDate(o.to) ? o.to : a;
      const lo = a && b0 ? (a <= b0 ? a : b0) : a, hi = a && b0 ? (a <= b0 ? b0 : a) : a;
      const off = o.off || defOff, td = today(), first = month + '-01';
      const start = add(first, -((parse(first).getUTCDay() + 6) % 7));
      let cells = '';
      for (let i = 0; i < 42; i++) {
        const d = add(start, i);
        if (i === 35 && d.slice(0, 7) !== month) break;
        const cls = ['rcx-d'], tips = [dmy(d)];
        if (d.slice(0, 7) !== month) cls.push('out');
        const of = off(d); if (of) { cls.push('off'); if (typeof of === 'string') tips.push(of); }
        if (d === td) cls.push('now');
        if (lo && d >= lo && d <= hi) cls.push('in');
        if (d === lo) cls.push('a'); if (d === hi) cls.push('b');
        const mk = o.mark ? o.mark(d) : null; if (mk) { cls.push('mk'); tips.push(mk); }
        const dis = (o.min && d < o.min) || (o.max && d > o.max);
        cells += `<button type="button" class="${cls.join(' ')}" data-d="${d}" title="${esc(tips.join(' · '))}"${dis ? ' disabled' : ''}>${+d.slice(8)}</button>`;
      }
      const canPrev = !o.min || shiftM(month, -1) >= o.min.slice(0, 7), canNext = !o.max || shiftM(month, 1) <= o.max.slice(0, 7);
      const canPY = !o.min || shiftM(month, -12) >= o.min.slice(0, 7), canNY = !o.max || shiftM(month, 12) <= o.max.slice(0, 7);
      const n = lo ? days(lo, hi) : 0;
      const sum = !lo ? '' : o.single ? `<b>${dmy(lo)}</b>` : `<b>${dmy(lo)}</b> → <b>${dmy(hi)}</b> · ${n} ngày`;
      el.innerHTML = `<div class="rcx-head">${o.years ? `<button type="button" class="rcx-nav y" data-m="-12" aria-label="Năm trước"${canPY ? '' : ' disabled'}>«</button>` : ''}<button type="button" class="rcx-nav" data-m="-1" aria-label="Tháng trước"${canPrev ? '' : ' disabled'}>‹</button><b>Tháng ${+month.slice(5)}/${month.slice(0, 4)}</b><button type="button" class="rcx-nav" data-m="1" aria-label="Tháng sau"${canNext ? '' : ' disabled'}>›</button>${o.years ? `<button type="button" class="rcx-nav y" data-m="12" aria-label="Năm sau"${canNY ? '' : ' disabled'}>»</button>` : ''}</div>
        <div class="rcx-grid">${['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(x => `<span class="rcx-w">${x}</span>`).join('')}${cells}</div>
        <div class="rcx-sum">${sum}${stage === 1 && !o.single ? ' <span class="rcx-next">— chạm ngày kết thúc</span>' : (!lo ? '<span class="rcx-next">Chạm ngày bắt đầu</span>' : '')}</div>`;
    }
    el.addEventListener('click', (e) => {
      const nav = e.target.closest('.rcx-nav');
      if (nav) { if (!nav.disabled) { month = shiftM(month, +nav.dataset.m); render(); } return; }
      const c = e.target.closest('.rcx-d'); if (!c || c.disabled) return;
      const d = c.dataset.d;
      let done;
      if (o.single || stage === 0) { o.from = d; o.to = d; stage = o.single ? 0 : 1; done = !!o.single; }
      else { const a = o.from; if (d < a) { o.from = d; o.to = a; } else o.to = d; stage = 0; done = true; }
      if (d.slice(0, 7) !== month) month = d.slice(0, 7);
      render();
      if (o.onChange) o.onChange(o.from, o.to, done);
    });
    render();
    return {
      update(p) {
        const before = o.from;
        Object.assign(o, p || {});
        if (p && 'from' in p && p.from !== before && isDate(p.from) && !p.keepMonth) { month = p.from.slice(0, 7); }
        if (p && p.month) month = p.month;
        if (p && p.reset) stage = 0;
        render();
      },
      stage: () => stage,
      el,
    };
  }

  // gắn vào 2 ô ngày sẵn có
  function pair(fromInput, toInput, opts) {
    injectCSS();
    opts = opts || {};
    const hide = opts.hide || [fromInput, toInput];
    (Array.isArray(hide) ? hide : [hide]).forEach(h => { h.hidden = true; h.style.display = 'none'; });
    const wrap = document.createElement('div'); wrap.className = 'rcx-wrap' + (opts.float ? ' float' : '') + (opts.className ? ' ' + opts.className : '');
    const id = (fromInput.id || 'rc') + 'Range';
    wrap.innerHTML = (opts.label ? `<span class="rcx-lbl" id="${id}Lbl">${esc(opts.label)}</span>` : '') +
      `<button type="button" class="rcx-btn" id="${id}" aria-expanded="false"${opts.label ? ` aria-labelledby="${id}Lbl ${id}"` : ''}><span class="ic" aria-hidden="true">📅</span><span class="tx"></span><span class="n"></span></button><div class="rcx-pop" hidden></div>`;
    const anchor = opts.after || (Array.isArray(hide) ? hide[hide.length - 1] : hide);
    anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
    const btn = wrap.querySelector('.rcx-btn'), pop = wrap.querySelector('.rcx-pop');
    let cal = null;
    const val = (inp) => getVal.call(inp);
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    const getVal = desc.get, setVal = desc.set;
    function label() {
      const a = val(fromInput), b = val(toInput) || a;
      btn.querySelector('.tx').innerHTML = a ? `${dmy(a)} → ${dmy(b < a ? a : b)}` : `<span class="ph">${esc(opts.placeholder || 'Chọn ngày bắt đầu – kết thúc')}</span>`;
      btn.querySelector('.n').textContent = a && b >= a ? `${days(a, b)} ngày` : '';
    }
    // code của trang gán .value trực tiếp → cập nhật nút + lịch
    [fromInput, toInput].forEach(inp => Object.defineProperty(inp, 'value', {
      configurable: true, get() { return getVal.call(this); },
      set(v) { setVal.call(this, v); label(); if (cal && !pop.hidden) cal.update({ from: val(fromInput), to: val(toInput), min: fromInput.min || undefined, max: toInput.max || fromInput.max || undefined }); },
    }));
    const fire = (inp) => { inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); };
    function open(show) {
      pop.hidden = !show; btn.setAttribute('aria-expanded', String(show));
      if (!show) return;
      const cfg = { from: val(fromInput), to: val(toInput), min: fromInput.min || undefined, max: toInput.max || fromInput.max || undefined, off: opts.off, mark: opts.mark, years: opts.years, reset: true,
        onChange(a, b, done) {
          setVal.call(fromInput, a); fire(fromInput);
          setVal.call(toInput, b); fire(toInput);
          label();
          if (done && opts.autoClose !== false) setTimeout(() => open(false), 180);
        } };
      if (!cal) cal = create(pop, cfg); else cal.update(cfg);
    }
    btn.addEventListener('click', () => open(pop.hidden));
    if (opts.float) {   // lịch nổi: bấm ra ngoài hoặc Esc thì đóng
      document.addEventListener('click', (e) => { if (!pop.hidden && !e.composedPath().includes(wrap)) open(false); });
      wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) { open(false); btn.focus(); } });
    }
    label();
    if (opts.open) open(true);
    return { refresh: label, open, el: wrap, button: btn };
  }

  const api = { create, pair, dmy, days };
  root.RangeCal = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
