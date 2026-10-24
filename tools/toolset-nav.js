// Thanh điều hướng "Bộ công cụ" dùng chung cho các công cụ trong thư mục tools/.
//
// Cách dùng (xem README-DEPLOY.md):
//   <head>  <script src="../../js/session.js"></script>
//           <script>Session.guard('<id công cụ>');</script>
//   <body>  <script src="../toolset-nav.js" data-tool="Tên công cụ"></script>  ← ngay sau <body>
//
// Chèn một dải mỏng NẰM TRONG LUỒNG TRANG (không position: fixed) ở đầu <body>,
// nên không che bất kỳ phần nào của công cụ; ẩn khi in để không lẫn vào bản in.
// Bên trái: về trang chủ + tên công cụ. Bên phải: người đang đăng nhập + Đăng xuất.
(function () {
  var script = document.currentScript;
  if (!script || !document.body || document.querySelector('.tsn-bar')) return;

  var home = new URL('../index.html', script.src).href;
  var name = script.getAttribute('data-tool') || document.title;
  var session = (typeof Session !== 'undefined') ? Session.current() : null;

  var style = document.createElement('style');
  style.textContent =
    '.tsn-bar{box-sizing:border-box;display:flex;align-items:center;gap:12px;min-height:40px;' +
    'padding:0 16px;background:#111827;color:#9ca3af;' +
    'font:500 13px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}' +
    '.tsn-bar a.tsn-home{display:inline-flex;align-items:center;gap:6px;color:#f9fafb;flex:none;' +
    'text-decoration:none;padding:6px 10px 6px 6px;margin-left:-6px;border-radius:6px}' +
    '.tsn-bar a.tsn-home:hover,.tsn-bar a.tsn-home:focus-visible{background:#1f2937;outline:none}' +
    '.tsn-bar .tsn-dot{width:8px;height:8px;border-radius:2px;background:#dc0000;flex:none}' +
    '.tsn-bar .tsn-sep{color:#4b5563}' +
    '.tsn-bar .tsn-name,.tsn-bar .tsn-user{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}' +
    '.tsn-bar .tsn-right{margin-left:auto;display:flex;align-items:center;gap:10px;min-width:0}' +
    '.tsn-bar .tsn-user{color:#e5e7eb;max-width:220px}' +
    '.tsn-bar .tsn-off{flex:none;font-size:12px;font-weight:600;color:#fde68a;background:#3f2d0a;border-radius:999px;padding:2px 9px}' +
    '.tsn-bar button.tsn-out{flex:none;background:transparent;color:#f9fafb;border:1px solid #4b5563;' +
    'border-radius:6px;padding:4px 10px;font:inherit;cursor:pointer}' +
    '.tsn-bar button.tsn-out:hover,.tsn-bar button.tsn-out:focus-visible{background:#1f2937;outline:none}' +
    '@media (max-width:520px){.tsn-bar .tsn-sep,.tsn-bar .tsn-name,.tsn-bar .tsn-user{display:none}}' +
    '@media print{.tsn-bar{display:none!important}}';
  document.head.appendChild(style);

  var bar = document.createElement('nav');
  bar.className = 'tsn-bar';
  bar.setAttribute('aria-label', 'Bộ công cụ');

  var link = document.createElement('a');
  link.className = 'tsn-home';
  link.href = home;
  link.title = 'Về trang chủ Bộ công cụ';
  link.innerHTML = '<span class="tsn-dot" aria-hidden="true"></span><span>‹ Bộ công cụ</span>';

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
