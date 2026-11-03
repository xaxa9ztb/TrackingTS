// Thanh điều hướng "Bộ công cụ" dùng chung cho các công cụ trong thư mục tools/.
//
// Cách dùng (xem README-DEPLOY.md):
//   <head>  <script src="../../js/session.js"></script>
//           <script>Session.guard('<id công cụ>');</script>
//   <body>  <script src="../toolset-nav.js" data-tool="Tên công cụ" data-app="id"></script>  ← ngay sau <body>
//   data-app = id chức năng (màu sọc đầu trang, xem [data-app=…] trong css/ni.css).
//
// Chèn một dải mỏng NẰM TRONG LUỒNG TRANG (không position: fixed) ở đầu <body>,
// nên không che bất kỳ phần nào của công cụ; ẩn khi in để không lẫn vào bản in.
// Bên trái: về trang chủ + tên công cụ. Bên phải: người đang đăng nhập + Đăng xuất.
(function () {
  var script = document.currentScript;
  if (!script || !document.body || document.querySelector('.tsn-bar')) return;
  // nhúng trong trang khác (vd. SWAT trong Thống kê giờ công): trang ngoài đã có thanh công cụ
  var framed = false;
  try { framed = window.self !== window.top; } catch (e) { framed = true; }

  var home = new URL('../index.html', script.src).href;
  // tài liệu hướng dẫn: data-help="#mục" mở thẳng phần đó trong huong-dan.html; "trang.html#mục" mở tài liệu riêng
  var dh = script.getAttribute('data-help') || '';
  var help = dh && dh.charAt(0) !== '#' ? new URL('../' + dh, script.src).href : new URL('../huong-dan.html', script.src).href + dh;
  var name = script.getAttribute('data-tool') || document.title;
  var session = (typeof Session !== 'undefined') ? Session.current() : null;

  // Hệ thiết kế NI (css/ni.css): font chung + token màu. Trang nào chưa nạp thì nạp ở đây.
  var root = document.documentElement;
  root.classList.add('ni');
  var app = script.getAttribute('data-app');
  if (app && !root.getAttribute('data-app')) root.setAttribute('data-app', app);
  if (!document.querySelector('link[href*="css/ni.css"]')) {
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = new URL('../css/ni.css?v=1', script.src).href;
    document.head.insertBefore(css, document.head.firstChild);
  }

  if (framed) return;

  var style = document.createElement('style');
  style.textContent =
    '.tsn-bar{box-sizing:border-box;position:relative;display:flex;align-items:center;gap:12px;min-height:48px;' +
    'padding:0 max(16px,env(safe-area-inset-right,0px)) 0 max(16px,env(safe-area-inset-left,0px));' +
    'background:var(--ni-bar,#0f1b2d);color:var(--ni-bar-muted,#8a97ab);' +
    'font:500 13.5px/1.2 var(--ni-font,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif)}' +
    '.tsn-bar::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:var(--ni-app,#dc0000)}' +
    '.tsn-bar a.tsn-home{display:inline-flex;align-items:center;gap:8px;color:var(--ni-bar-ink,#e6ebf2);flex:none;font-weight:700;' +
    'text-decoration:none;padding:6px 10px 6px 6px;margin-left:-6px;border-radius:6px}' +
    '.tsn-bar a.tsn-home:hover,.tsn-bar a.tsn-home:focus-visible{background:var(--ni-bar-hover,#1b2a40);outline:none}' +
    '.tsn-bar .tsn-dot{width:10px;height:10px;border-radius:2px;background:var(--ni-brand,#dc0000);flex:none}' +
    '.tsn-bar .tsn-sep{color:var(--ni-bar-line,#34445c)}' +
    '.tsn-bar .tsn-name{color:var(--ni-bar-ink,#e6ebf2);font-weight:600}' +
    '.tsn-bar .tsn-name,.tsn-bar .tsn-user{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}' +
    '.tsn-bar .tsn-right{margin-left:auto;display:flex;align-items:center;gap:10px;flex:none}' +
    '.tsn-bar .tsn-name{flex:0 1 auto}' +
    '.tsn-bar .tsn-user{color:var(--ni-bar-ink,#e6ebf2);max-width:220px}' +
    '.tsn-bar a.tsn-help,.tsn-bar button.tsn-out{flex:none;display:inline-flex;align-items:center;min-height:32px;color:var(--ni-bar-ink,#e6ebf2);' +
    'background:transparent;text-decoration:none;border:1px solid var(--ni-bar-line,#34445c);border-radius:6px;padding:0 12px;font:inherit;cursor:pointer}' +
    '.tsn-bar a.tsn-help:hover,.tsn-bar a.tsn-help:focus-visible,.tsn-bar button.tsn-out:hover,.tsn-bar button.tsn-out:focus-visible{background:var(--ni-bar-hover,#1b2a40);outline:none}' +
    '.tsn-bar .tsn-off{flex:none;font-size:12px;font-weight:600;color:#fde68a;background:#3f2d0a;border-radius:999px;padding:2px 9px}' +
    '@media (max-width:560px){.tsn-bar{gap:8px}.tsn-bar .tsn-user,.tsn-bar .tsn-home-t{display:none}.tsn-bar .tsn-sep{display:none}}' +
    '@media print{.tsn-bar{display:none!important}}';
  document.head.appendChild(style);

  var bar = document.createElement('nav');
  bar.className = 'tsn-bar';
  bar.setAttribute('aria-label', 'Bộ công cụ');

  var link = document.createElement('a');
  link.className = 'tsn-home';
  link.href = home;
  link.title = 'Về trang chủ Bộ công cụ';
  link.setAttribute('aria-label', 'Về trang chủ Bộ công cụ');
  link.innerHTML = '<span aria-hidden="true">‹</span><span class="tsn-dot" aria-hidden="true"></span><span class="tsn-home-t">Bộ công cụ</span>';

  var sep = document.createElement('span');
  sep.className = 'tsn-sep';
  sep.setAttribute('aria-hidden', 'true');
  sep.textContent = '/';

  var label = document.createElement('span');
  label.className = 'tsn-name';
  label.textContent = name;

  bar.appendChild(link);
  bar.appendChild(sep);
  bar.appendChild(label);

  var right = document.createElement('div');
  right.className = 'tsn-right';
  // trạng thái mạng: chức năng vẫn dùng được khi mất mạng (xem sw.js) — báo để người dùng biết
  var off = document.createElement('span');
  off.className = 'tsn-off';
  off.setAttribute('role', 'status');
  off.textContent = '📴 Ngoại tuyến';
  var syncNet = function () { off.hidden = navigator.onLine !== false; };
  window.addEventListener('online', syncNet);
  window.addEventListener('offline', syncNet);
  syncNet();
  right.appendChild(off);
  var hl = document.createElement('a');
  hl.className = 'tsn-help';
  hl.href = help;
  hl.target = '_blank';
  hl.rel = 'noopener';
  hl.title = 'Hướng dẫn sử dụng (mở tab mới)';
  hl.textContent = 'Hướng dẫn';
  right.appendChild(hl);

  if (session) {
    var who = document.createElement('span');
    who.className = 'tsn-user';
    who.textContent = session.name;
    who.title = session.name + (session.empId ? ' · ' + session.empId : '') + ' — ' + Session.roleLabel(session);
    var out = document.createElement('button');
    out.type = 'button';
    out.className = 'tsn-out';
    out.textContent = 'Đăng xuất';
    out.addEventListener('click', function () { Session.logout(); });
    right.appendChild(who);
    right.appendChild(out);
  }
  bar.appendChild(right);

  document.body.insertBefore(bar, document.body.firstChild);
})();
