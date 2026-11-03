// Bảng → thẻ trên điện thoại (hệ thiết kế NI). Bảng nào có lớp "ni-cards" thì mỗi ô <td> được gắn
// data-label = tên cột lấy từ <thead>; css/ni.css dùng nhãn đó khi màn hình hẹp hơn 640px.
// Tự chạy lại khi nội dung bảng thay đổi (danh sách tải từ máy chủ, lọc…).
(function () {
  function heads(table) {
    var out = [];
    var row = table.tHead && table.tHead.rows[table.tHead.rows.length - 1];
    if (!row) return out;
    for (var i = 0; i < row.cells.length; i++) {
      var th = row.cells[i];
      var t = th.getAttribute('data-label');
      if (t == null) t = th.querySelector('input,button') ? '' : th.textContent.replace(/\s+/g, ' ').trim();
      for (var k = 0; k < (th.colSpan || 1); k++) out.push(t);
    }
    return out;
  }
  function label(table) {
    var h = heads(table);
    if (!h.length) return;
    var bodies = table.tBodies;
    for (var b = 0; b < bodies.length; b++) {
      var rows = bodies[b].rows;
      for (var r = 0; r < rows.length; r++) {
        var col = 0, cells = rows[r].cells;
        if (cells.length === 1 && (cells[0].colSpan || 1) > 1) continue; // dòng "không có dữ liệu"
        for (var c = 0; c < cells.length; c++) {
          var td = cells[c];
          if (!td.hasAttribute('data-label') || td.getAttribute('data-auto') === '1') { td.setAttribute('data-label', h[col] || ''); td.setAttribute('data-auto', '1'); }
          col += td.colSpan || 1;
        }
      }
    }
  }
  var seen = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
  function watch(table) {
    label(table);
    if (!seen || seen.has(table) || typeof MutationObserver === 'undefined') return;
    seen.add(table);
    var busy = false;
    new MutationObserver(function () {
      if (busy) return;
      busy = true;
      (window.requestAnimationFrame || setTimeout)(function () { label(table); busy = false; });
    }).observe(table, { childList: true, subtree: true });
  }
  function scan() { var t = document.querySelectorAll('table.ni-cards'); for (var i = 0; i < t.length; i++) watch(t[i]); }
  window.NiCards = { scan: scan, label: label };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();
  // bảng tạo động sau khi trang tải
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) for (var j = 0; j < muts[i].addedNodes.length; j++) {
        var n = muts[i].addedNodes[j];
        if (n.nodeType === 1 && (n.matches('table.ni-cards') || n.querySelector('table.ni-cards'))) { scan(); return; }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
