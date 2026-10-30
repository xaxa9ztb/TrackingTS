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
  // Bản chạy trên máy chủ Cloudflare: danh tính + vai trò lấy từ /api/me (Cloudflare Access đã xác thực email),
  // không còn đăng nhập họ tên + mã NV. scripts/build-pages.mjs đổi dòng dưới thành `true` khi đóng gói.
  const SERVER_MODE = false;
  const KEY = 'toolsetSession';
  const REMEMBER_DAYS = 30;  // "Ghi nhớ trên thiết bị này"
  const SESSION_HOURS = 12;  // phiên thường: hết khi đóng tab, tối đa 12 giờ

  // Gốc của bộ công cụ, tính theo vị trí file này (js/session.js → ../)
  const ROOT = (() => {
    const s = document.currentScript;
    return s && s.src ? new URL('../', s.src).href : new URL('./', location.href).href;
  })();

  // Danh mục chức năng. `roles` = vai trò được vào; không khai báo = mọi người đã đăng nhập.
  // `soon: true` = đã có chỗ trên trang chủ nhưng chưa có trang (bấm vào chỉ báo "đang phát triển").
  // Khi làm xong: thêm `path`, bỏ `soon`.
  const PM_TEAM = { roles: ['pm', 'sitesup'], rolesLabel: 'Quản lý dự án và Site Sup' };
  const TOOLS = {
    tracking: { name: 'Thống kê giờ công dự án', path: 'tracking.html' },
    timesheet: { name: 'Timesheet cá nhân', path: 'tools/timesheet/' },
    tiendotm: { name: 'Hồ sơ chất lượng thang máy', path: 'tools/tiendotm/', ...PM_TEAM },
    handover: { name: 'Hồ sơ bàn giao NI – EI', soon: true, ...PM_TEAM },
    ffplus: { name: 'Hồ sơ FF+', soon: true, ...PM_TEAM },
    projectplan: { name: 'Quản lý dự án', path: 'tools/projectplan/', demo: true, ...PM_TEAM }, // bản demo
    leave: { name: 'Nghỉ phép / ốm', path: 'tools/leave/', serverOnly: true },       // mọi nhân viên; chỉ có ở bản máy chủ
    approvals: { name: 'Duyệt bảng công', path: 'tools/approvals/', serverOnly: true, roles: ['pm', 'sitesup', 'projadmin'], rolesLabel: 'Quản lý dự án, Site Sup và Admin dự án' },       // chỉ có ở bản máy chủ
    materials: { name: 'Điều phối công cụ dụng cụ, vật tư', soon: true, ...PM_TEAM },
    tsupload: { name: 'Nhập bảng công từ Excel', path: 'tools/tsupload/', serverOnly: true, roles: ['pm', 'sitesup', 'projadmin'], rolesLabel: 'Site Sup, Quản lý dự án và Admin dự án' },
    tsadmin: { name: 'Quản lý bảng công', path: 'tools/tsadmin/', serverOnly: true, roles: ['projadmin'], rolesLabel: 'Admin và Admin dự án' },
    admin: { name: 'Quản trị', path: 'admin.html', roles: ['admin'], rolesLabel: 'Quản trị viên' },  // nhân viên, dự án, bảng công (Excel), tài khoản & phân quyền
  };
  // chức năng đã có trang để mở
  function ready(toolId) { const t = TOOLS[toolId]; return !!(t && t.path && !t.soon); }

  // Vai trò xác định theo CHỨC DANH (cột Position trong EE Data), so khớp không dấu.
  // Site Sup giữ đúng định nghĩa đang dùng ở Dashboard: supervisor / project engineer.
  const ROLE_RULES = {
    pm: /project ?manager|quan ly du an/,
    sitesup: /superv|site ?sup|project ?engineer|giam sat/,
  };
  const ROLE_LABELS = { admin: 'Quản trị viên', projadmin: 'Admin dự án', pm: 'Quản lý dự án', sitesup: 'Site Sup' };

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
    if (SERVER_MODE && Array.isArray(s.roles)) return s.roles.filter(r => r === 'pm' || r === 'sitesup' || r === 'projadmin'); // vai trò do máy chủ quyết định
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
      exp: now + (SERVER_MODE ? 7 * 864e5 : remember && !data.admin ? REMEMBER_DAYS * 864e5 : SESSION_HOURS * 36e5),
    };
    if (SERVER_MODE) { s.roles = Array.isArray(data.roles) ? data.roles.map(String) : []; s.email = String(data.email || ''); }
    // bản máy chủ: phiên chỉ là bản lưu đệm danh tính (luôn được hỏi lại máy chủ), nên lưu cả cho quản trị
    const keep = SERVER_MODE || (remember && !s.admin) ? 'localStorage' : 'sessionStorage'; // bản github.io: quản trị không bao giờ ghi nhớ
    const drop = keep === 'localStorage' ? 'sessionStorage' : 'localStorage';
    try { window[drop].removeItem(KEY); window[keep].setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
    return s;
  }
  function clear() {
    for (const st of ['sessionStorage', 'localStorage']) { try { window[st].removeItem(KEY); } catch (e) { /* ignore */ } }
    try { ['adminOk', 'viewerOk', 'pmStoreKey'].forEach(k => sessionStorage.removeItem(k)); } catch (e) { /* ignore */ }
  }
  // sửa vài trường của phiên hiện có, giữ nguyên nơi lưu và hạn dùng
  function update(patch) {
    for (const st of ['sessionStorage', 'localStorage']) {
      try {
        const raw = window[st].getItem(KEY);
        if (raw) window[st].setItem(KEY, JSON.stringify(Object.assign(JSON.parse(raw), patch)));
      } catch (e) { /* ignore */ }
    }
  }

  // So phiên với EE Data đang có trên máy (cùng kho với Thống kê giờ công):
  //   - chức danh đổi (ví dụ lên Site Sup)          → cập nhật phiên  → 'updated'
  //   - mã NV không còn trong danh sách (nghỉ việc)  → huỷ phiên       → 'removed'
  // Máy chưa có danh sách nhân viên thì bỏ qua. Chỉ đọc; không tạo cơ sở dữ liệu rỗng.
  function revalidate() {
    if (SERVER_MODE) return revalidateServer();
    const s = current();
    if (!s || s.admin || !s.empId || !window.indexedDB) return Promise.resolve(null);
    return new Promise((resolve) => {
      let req;
      try { req = indexedDB.open('timesheet_app_db'); } catch (e) { resolve(null); return; }
      req.onupgradeneeded = (e) => e.target.transaction.abort(); // chưa có dữ liệu trên máy
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
      req.onsuccess = (e) => {
        const db = e.target.result;
        const done = (v) => { db.close(); resolve(v); };
        if (!db.objectStoreNames.contains('employees')) { done(null); return; }
        const all = db.transaction('employees', 'readonly').objectStore('employees').getAll();
        all.onerror = () => done(null);
        all.onsuccess = () => {
          const list = all.result || [];
          if (!list.length) { done(null); return; }
          const me = list.find(x => norm(x.empId) === norm(s.empId));
          if (!me) { clear(); done('removed'); return; }
          const position = String(me.position || ''), name = String(me.fullName || s.name);
          if (position !== s.position || name !== s.name) { update({ position, name }); done('updated'); return; }
          done(null);
        };
      };
    });
  }

  // ---- chế độ máy chủ: hỏi /api/me ----
  // Trả { status, me?, error? }: 'ok' | 'login' (phiên Cloudflare Access hết hạn) | 'denied' (email chưa gắn / bị khoá) | 'offline' | 'error'
  async function fetchMe() {
    let resp;
    try { resp = await fetch('/api/me', { credentials: 'same-origin', redirect: 'manual', cache: 'no-store' }); }
    catch (e) { return { status: 'offline' }; }
    if (resp.type === 'opaqueredirect' || (resp.status >= 300 && resp.status < 400) || resp.status === 401) return { status: 'login' };
    let body = {};
    try { body = await resp.json(); } catch (e) { /* không phải JSON */ }
    if (resp.status === 403) return { status: 'denied', error: body.error || 'Tài khoản chưa được cấp quyền' };
    if (!resp.ok) return { status: 'error', error: body.error || ('Lỗi máy chủ (HTTP ' + resp.status + ')') };
    return { status: 'ok', me: body };
  }
  const fromMe = (me) => ({ name: me.name, empId: me.empId, position: me.position, admin: !!me.isAdmin, roles: me.roles || [], email: me.email });
  // Đăng nhập tự động: danh tính do Cloudflare Access xác thực, máy chủ cho biết là ai và vai trò gì
  async function boot() {
    const r = await fetchMe();
    if (r.status === 'ok') save(fromMe(r.me), true);
    return r;
  }
  async function revalidateServer() {
    const s = current();
    if (!s) return null;
    const r = await fetchMe();
    if (r.status === 'denied') { clear(); return 'removed'; }       // khoá tài khoản / gỡ email → thoát ngay
    if (r.status !== 'ok') return null;                              // mất mạng / hết phiên Access: giữ nguyên, lần sau hỏi lại
    const n = fromMe(r.me);
    const changed = n.name !== s.name || n.position !== s.position || n.admin !== s.admin || JSON.stringify(n.roles) !== JSON.stringify(s.roles || []);
    if (changed) { update(n); return 'updated'; }
    return null;
  }

  // Gọi lại `onChange` khi phiên có thể đã đổi mà trang không tải lại:
  //  - bấm Back/Forward: trình duyệt khôi phục NGUYÊN trang từ bộ nhớ đệm, không chạy lại script
  //  - đăng xuất / đăng nhập ở tab khác (phiên "ghi nhớ" nằm trong localStorage)
  function watch(onChange) {
    window.addEventListener('pageshow', (e) => { if (e.persisted) onChange(); });
    window.addEventListener('storage', (e) => { if (e.key === KEY || e.key === null) onChange(); });
  }

  // ---- điều hướng ----
  function url(toolId) { return ready(toolId) ? ROOT + TOOLS[toolId].path : null; }
  function homeUrl(params) {
    const q = new URLSearchParams(params || {}).toString();
    return ROOT + 'index.html' + (q ? '?' + q : '');
  }
  function logout() {
    clear();
    // bản máy chủ: kết thúc luôn phiên Cloudflare Access (nếu không, mở lại trang là vào ngay)
    location.href = SERVER_MODE ? '/cdn-cgi/access/logout' : homeUrl();
  }

  // Gọi trong <head> của trang công cụ, trước khi công cụ chạy.
  function redirectFor(toolId) {
    const s = current();
    // giữ phần #… (ví dụ link mở thẳng một bảng công từ email) để mở lại sau khi đăng nhập
    const h = /^#[\w=\/.%-]{1,80}$/.test(location.hash) ? location.hash.slice(1) : '';
    return !s ? homeUrl(h ? { next: toolId, h } : { next: toolId }) : (!canAccess(toolId, s) ? homeUrl({ denied: toolId }) : null);
  }
  function leave(to) {
    document.documentElement.style.display = 'none'; // không để lộ giao diện công cụ trong lúc chuyển trang
    location.replace(to);
  }
  let guardedTool = null; // mỗi trang chỉ đăng ký theo dõi một lần (guard có thể được gọi lại)
  function guard(toolId) {
    const check = () => { const to = redirectFor(guardedTool); if (to) { leave(to); return false; } return true; };
    if (!guardedTool) watch(check);
    guardedTool = toolId;
    if (!check()) return false;
    // vào được rồi: so lại với EE Data trên máy (đổi chức danh / đã nghỉ việc) rồi kiểm tra lần nữa
    revalidate().then((r) => {
      if (r === 'removed') leave(homeUrl({ ended: '1' }));
      else if (r === 'updated') check();
    });
    return true;
  }

  return { SERVER: SERVER_MODE, TOOLS, ready, current, save, clear, logout, roles, roleLabel, canAccess, guard, revalidate, boot, watch, url, homeUrl, norm };
})();
