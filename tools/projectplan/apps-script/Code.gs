// Kho dữ liệu chung cho "Quản lý dự án" (Bộ công cụ dự án) — Google Apps Script.
//
// Ứng dụng web chạy BẰNG TÀI KHOẢN NGƯỜI TRIỂN KHAI (admin): giám sát không cần tài khoản Google,
// chỉ cần đăng nhập Bộ công cụ. Dữ liệu nằm trong 1 file JSON RIÊNG TƯ trên Drive của admin
// (không chia sẻ công khai), Drive tự giữ các phiên bản cũ.
//
//   POST {action:'load', user}                       → {ok, version, updatedAt, updatedBy, data}
//   POST {action:'save', user, baseVersion, data}    → {ok, version, updatedAt, updatedBy}
//                                                      | {ok:false, conflict:true, version, …, data}  (đã có người lưu trước)
//   user = {name, empId}   — phải có trong EE Data với chức danh Quản lý dự án / Site Sup
//        | {admin: key}    — key = SHA-256(mật khẩu admin + '|pm-store')  (Script property ADMIN_KEY)
//
// Script properties (Project Settings → Script properties):
//   MAIN_FILE_ID  — id file timesheet-data.json (DRIVE_FILE_ID trong js/config.js) để kiểm tra người dùng
//   ADMIN_KEY     — (không bắt buộc) cho phép quản trị viên đọc / lưu
//   DATA_FILE_ID  — tự tạo ở lần lưu đầu tiên (projectplan-data.json)
// Hướng dẫn triển khai: HUONG-DAN.md cùng thư mục.

var ROLE_RE = /project ?manager|quan ly du an|superv|site ?sup|project ?engineer|giam sat/;

function doGet() {
  return out_({ ok: true, service: 'pm-store', hint: 'Dùng POST {action: "load" | "save"}' });
}

function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); } catch (x) { return out_({ ok: false, error: 'Yêu cầu không hợp lệ' }); }
  try { return out_(handle_(req, gasEnv_())); }
  catch (x) { return out_({ ok: false, error: 'Lỗi máy chủ: ' + (x && x.message ? x.message : x) }); }
}

// ---------- xử lý (không phụ thuộc Google — kiểm thử được) ----------
function handle_(req, env) {
  var who = authorize_(req && req.user, env);
  if (!who.ok) return { ok: false, denied: true, error: who.error };
  if (req.action === 'load') {
    var s = env.read();
    return { ok: true, version: s.version, updatedAt: s.updatedAt, updatedBy: s.updatedBy, data: s.data, user: who.name };
  }
  if (req.action === 'save') {
    var d = req.data;
    if (!d || !Array.isArray(d.fitters) || !Array.isArray(d.projects) || typeof d.alloc !== 'object' || d.alloc === null) {
      return { ok: false, error: 'Dữ liệu không hợp lệ' };
    }
    return env.withLock(function () {
      var cur = env.read();
      if (Number(req.baseVersion) !== cur.version) {
        return { ok: false, conflict: true, version: cur.version, updatedAt: cur.updatedAt, updatedBy: cur.updatedBy, data: cur.data };
      }
      var next = { version: cur.version + 1, updatedAt: env.now(), updatedBy: who.name, data: d };
      env.write(next);
      return { ok: true, version: next.version, updatedAt: next.updatedAt, updatedBy: next.updatedBy };
    });
  }
  return { ok: false, error: 'Thao tác không hỗ trợ' };
}

function authorize_(user, env) {
  if (!user) return { ok: false, error: 'Chưa đăng nhập Bộ công cụ' };
  if (user.admin) {
    var key = env.prop('ADMIN_KEY');
    return key && String(user.admin) === key ? { ok: true, name: 'Quản trị viên' } : { ok: false, error: 'Quyền quản trị chưa được cấp cho kho dữ liệu' };
  }
  var me = null, list = env.employees();
  for (var i = 0; i < list.length; i++) {
    if (norm_(list[i].empId) === norm_(user.empId) && norm_(list[i].fullName) === norm_(user.name)) { me = list[i]; break; }
  }
  if (!me) return { ok: false, error: 'Không tìm thấy họ tên + mã NV trong dữ liệu nhân sự (hoặc chức danh không được phép)' };
  if (!ROLE_RE.test(plain_(me.position))) return { ok: false, error: 'Chỉ Quản lý dự án và Site Sup được dùng kho dữ liệu này' };
  return { ok: true, name: me.fullName };
}

function plain_(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
function norm_(s) { return plain_(s).replace(/ /g, ''); }

// ---------- môi trường Google ----------
function gasEnv_() {
  var props = PropertiesService.getScriptProperties();
  return {
    prop: function (k) { return props.getProperty(k) || ''; },
    now: function () { return new Date().toISOString(); },
    withLock: function (fn) {
      var lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try { return fn(); } finally { lock.releaseLock(); }
    },
    read: function () {
      var t = storeFile_(props).getBlob().getDataAsString('UTF-8');
      var o = t ? JSON.parse(t) : {};
      return { version: o.version || 0, updatedAt: o.updatedAt || '', updatedBy: o.updatedBy || '', data: o.data || null };
    },
    write: function (o) { storeFile_(props).setContent(JSON.stringify(o)); },
    employees: function () { return employees_(props); },
  };
}

function storeFile_(props) {
  var id = props.getProperty('DATA_FILE_ID');
  if (id) return DriveApp.getFileById(id);
  var f = DriveApp.createFile('projectplan-data.json', JSON.stringify({ version: 0, data: null }), 'application/json');
  props.setProperty('DATA_FILE_ID', f.getId());
  return f;
}

// Danh sách Quản lý dự án / Site Sup lấy từ file dữ liệu chung (có thể đã nén gzip), lưu đệm 10 phút
function employees_(props) {
  var cache = CacheService.getScriptCache(), hit = cache.get('pm-users');
  if (hit) return JSON.parse(hit);
  var id = props.getProperty('MAIN_FILE_ID');
  if (!id) throw new Error('Chưa đặt MAIN_FILE_ID trong Script properties');
  var blob = DriveApp.getFileById(id).getBlob(), bytes = blob.getBytes();
  var text = bytes.length > 1 && bytes[0] === 31 && (bytes[1] & 255) === 139
    ? Utilities.ungzip(blob.setContentType('application/x-gzip')).getDataAsString('UTF-8')
    : blob.getDataAsString('UTF-8');
  var list = (JSON.parse(text).employees || [])
    .map(function (e) { return { empId: String(e.empId || ''), fullName: String(e.fullName || ''), position: String(e.position || '') }; })
    .filter(function (e) { return ROLE_RE.test(plain_(e.position)); });
  try { cache.put('pm-users', JSON.stringify(list), 600); } catch (x) { /* danh sách lớn: bỏ qua lưu đệm */ }
  return list;
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
