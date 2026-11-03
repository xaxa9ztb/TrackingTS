// Trạng thái bảng công — MỘT bộ tên + màu cho mọi chức năng (Timesheet, Duyệt bảng công,
// Quản lý bảng công, Trang chủ…). Màu dùng lớp .ni-pill.<tone> trong css/ni.css.
//   NiStatus.label('sitesup_ok')        → 'Chờ QLDA'
//   NiStatus.pill('approved')           → '<span class="ni-pill ok">Đã duyệt xong</span>'
(function (root) {
  var MAP = {
    draft:      { label: 'Đang chấm',        tone: 'draft' },
    submitted:  { label: 'Chờ Site Sup',     tone: 'wait' },
    sitesup_ok: { label: 'Chờ QLDA',         tone: 'wait' },
    pm_ok:      { label: 'Chờ Admin xử lý',  tone: 'admin' },
    approved:   { label: 'Đã duyệt xong',    tone: 'ok' },
    rejected:   { label: 'Bị trả lại',       tone: 'bad' },
  };
  // giải thích dài hơn (cho dòng trạng thái ở Timesheet / trang chi tiết)
  var HINT = {
    draft: 'Chưa nộp — vẫn sửa được.',
    submitted: 'Đã nộp — Site Sup của dự án đang duyệt.',
    sitesup_ok: 'Site Sup đã duyệt — Quản lý dự án đang duyệt.',
    pm_ok: 'Đã qua Site Sup và QLDA — Admin đang xử lý bước cuối.',
    approved: 'Đã duyệt xong — dữ liệu đã chuyển sang bảng Theo dõi giờ công.',
    rejected: 'Bị trả lại — xem lý do, sửa rồi nộp lại.',
  };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var api = {
    MAP: MAP,
    label: function (s) { return (MAP[s] && MAP[s].label) || String(s || ''); },
    tone: function (s) { return (MAP[s] && MAP[s].tone) || 'draft'; },
    hint: function (s) { return HINT[s] || ''; },
    pill: function (s, text) { return '<span class="ni-pill ' + api.tone(s) + '">' + esc(text || api.label(s)) + '</span>'; },
  };
  root.NiStatus = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
