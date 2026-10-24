// Thanh điều hướng "Bộ công cụ" dùng chung cho các công cụ trong thư mục tools/.
//
// Cách dùng: đặt ngay sau thẻ <body> của công cụ
//   <script src="../toolset-nav.js" data-tool="Tên công cụ"></script>
//
// Chèn một dải mỏng NẰM TRONG LUỒNG TRANG (không position: fixed) ở đầu <body>,
// nên không che bất kỳ phần nào của công cụ; ẩn khi in để không lẫn vào bản in.
// Đường dẫn về trang chủ tính theo vị trí của chính file này (tools/../index.html),
// nên dùng được cho mọi thư mục con mà không phải sửa.
(function () {
  var script = document.currentScript;
  if (!script || !document.body || document.querySelector('.tsn-bar')) return;

  var home = new URL('../index.html', script.src).href;
  var name = script.getAttribute('data-tool') || document.title;

  var style = document.createElement('style');
  style.textContent =
    '.tsn-bar{box-sizing:border-box;display:flex;align-items:center;gap:12px;min-height:36px;' +
    'padding:0 16px;background:#111827;color:#9ca3af;' +
    'font:500 13px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}' +
    '.tsn-bar a.tsn-home{display:inline-flex;align-items:center;gap:6px;color:#f9fafb;' +
    'text-decoration:none;padding:6px 10px 6px 6px;margin-left:-6px;border-radius:6px}' +
    '.tsn-bar a.tsn-home:hover,.tsn-bar a.tsn-home:focus-visible{background:#1f2937;outline:none}' +
    '.tsn-bar .tsn-dot{width:8px;height:8px;border-radius:2px;background:#dc0000;flex:none}' +
    '.tsn-bar .tsn-sep{color:#4b5563}' +
    '.tsn-bar .tsn-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
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
  document.body.insertBefore(bar, document.body.firstChild);
})();
