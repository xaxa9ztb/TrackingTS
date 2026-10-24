// Phiên đăng nhập dùng chung cho cả Bộ công cụ: trang chủ (index.html),
// Thống kê giờ công (tracking.html) và các công cụ trong tools/.
//
// Người dùng đăng nhập MỘT LẦN ở trang chủ (họ tên + mã NV, đối chiếu EE Data),
// rồi chọn chức năng. Mỗi trang công cụ gọi Session.guard('<id>') trong <head>:
//   - chưa đăng nhập      → về trang chủ để đăng nhập, xong quay lại đúng công cụ
//   - không đủ quyền       → về trang chủ kèm thông báo
//
// LƯU Ý: đây là lớp kiểm soát phía trình duyệt (web tĩnh trên GitHub Pages),
// giúp điều hướng đúng người — không thay thế được xác thực phía máy chủ.
const Session = (() => {
  const KEY = 'toolsetSession';
  const REMEMBER_DAYS = 30;  // "Ghi nhớ trên thiết bị này"
  const SESSION_HOURS = 12;  // phiên thường: hết khi đóng tab, tối đa 12 giờ

  // Gốc của bộ công cụ, tính theo vị trí file này (js/session.js → ../)
  const ROOT = (() => {
    const s = document.currentScript;
    return s && s.src ? new URL('../', s.src).href : new URL('./', location.href).href;
  })();

  // Danh mục chức năng. `roles` = vai trò được vào; không khai báo = mọi người đã đăng nhập.
  const TOOLS = {
    tracking: { name: 'Thống kê giờ công dự án', path: 'tracking.html' },
    timesheet: { name: 'Timesheet cá nhân', path: 'tools/timesheet/' },
    tiendotm: {
      name: 'Tiến độ thi công thang máy', path: 'tools/tiendotm/',
      roles: ['pm', 'sitesup'], rolesLabel: 'Quản lý dự án và Site Sup',
    },
  };

  // Vai trò xác định theo CHỨC DANH (cột Position trong EE Data), so khớp không dấu.
  // Site Sup giữ đúng định nghĩa đang dùng ở Dashboard: supervisor / project engineer.
  const ROLE_RULES = {
    pm: /project ?manager|quan ly du an/,
    sitesup: /superv|site ?sup|project ?engineer|giam sat/,
  };
  const ROLE_LABELS = { admin: 'Quản trị viên', pm: 'Quản lý dự án', sitesup: 'Site Sup' };

  // bỏ dấu, chữ thường, gom khoảng trắng — dùng cho chức danh
  function plain(s) {
    return String(s == null ? '' : s).toLowerCase().normalize('NFD')
      .replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }
  // bỏ hết ký tự không phải chữ/số — dùng để so họ tên + mã NV khi đăng nhập
  function norm(s) { return plain(s).replace(/ /g, ''); }

  function roles(s) {
    if (!s) return [];
    if (s.admin) return ['admin'];
    const pos = plain(s.position);
    return Object.keys(ROLE_RULES).filter(r => ROLE_RULES[r].test(pos));
  }
  function roleLabel(s) {
    const r = roles(s)[0];
    return r ? ROLE_LABELS[r] : 'Nhân viên';
  }
  function canAccess(toolId, s) {
    const t = TOOLS[toolId];
    if (!t || !s) return false;
    if (s.admin || !t.roles) return true;
    return roles(s).some(r => t.roles.includes(r));
  }

  // ---- lưu trữ phiên ----
  function read(store) {
    try {
      const raw = window[store].getItem(KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.exp || Date.now() > s.exp) { window[store].removeItem(KEY); return null; }
      return s;
    } catch (e) { return null; }
  }
  function current() { return read('sessionStorage') || read('localStorage'); }

  function save(data, remember) {
    const now = Date.now();
    const s = {
      name: String(data.name || ''), empId: String(data.empId || ''),
      position: String(data.position || ''), admin: !!data.admin, at: now,
      exp: now + (remember && !data.admin ? REMEMBER_DAYS * 864e5 : SESSION_HOURS * 36e5),
    };
    const keep = remember && !s.admin ? 'localStorage' : 'sessionStorage'; // quản trị không bao giờ ghi nhớ
    const drop = keep === 'localStorage' ? 'sessionStorage' : 'localStorage';
    try { window[drop].removeItem(KEY); window[keep].setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
    return s;
  }
  function clear() {
    for (const st of ['sessionStorage', 'localStorage']) { try { window[st].removeItem(KEY); } catch (e) { /* ignore */ } }
    try { sessionStorage.removeItem('adminOk'); sessionStorage.removeItem('viewerOk'); } catch (e) { /* ignore */ }
  }

  // ---- điều hướng ----
  function url(toolId) { return ROOT + TOOLS[toolId].path; }
  function homeUrl(params) {
    const q = new URLSearchParams(params || {}).toString();
    return ROOT + 'index.html' + (q ? '?' + q : '');
  }
  function logout() { clear(); location.href = homeUrl(); }

  // Gọi trong <head> của trang công cụ, trước khi công cụ chạy.
  function guard(toolId) {
    const s = current();
    const to = !s ? homeUrl({ next: toolId }) : (!canAccess(toolId, s) ? homeUrl({ denied: toolId }) : null);
    if (!to) return true;
    document.documentElement.style.display = 'none'; // không để lộ giao diện công cụ trong lúc chuyển trang
    location.replace(to);
    return false;
  }

  return { TOOLS, current, save, clear, logout, roles, roleLabel, canAccess, guard, url, homeUrl, norm };
})();
