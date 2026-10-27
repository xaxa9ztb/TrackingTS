// Chế độ DEMO (chạy thử) — phía trình duyệt. Chỉ có tác dụng ở bản Cloudflare (máy chủ có cơ sở dữ liệu demo riêng,
// xem server/demo.mjs); ở bản github.io không bao giờ bật.
//
// Khi bật (cờ ts_demo_on trong localStorage + cookie ts_demo do máy chủ đặt):
//  1. Máy chủ dùng CƠ SỞ DỮ LIỆU DEMO riêng cho mọi yêu cầu /api (không đụng dữ liệu thật).
//  2. Dữ liệu lưu trên trình duyệt (localStorage / sessionStorage / IndexedDB) được ĐỔI TÊN KHOÁ có tiền tố "demo:" / "demo_",
//     nên bảng công cá nhân, phiên đăng nhập, bản sao dữ liệu… của người dùng thật không bị đọc hay ghi đè,
//     và những gì nhập trong demo không bị đẩy lên máy chủ thật khi thoát.
//  3. Thanh "CHẾ ĐỘ DEMO" luôn hiện ở đầu trang với nút Làm mới dữ liệu / Thoát demo.
//
// File này phải được nạp TRƯỚC mọi script dùng localStorage / IndexedDB (db.js, session.js…).
(function () {
  'use strict';
  var FLAG = 'ts_demo_on', CLEAN = 'ts_demo_cleanup', PREFIX = 'demo:', IDB_PREFIX = 'demo_';
  var on = false;
  try { on = Storage.prototype.getItem.call(localStorage, FLAG) === '1'; } catch (e) { /* trình duyệt chặn lưu trữ */ }

  var api = { on: on, FLAG: FLAG };
  // bản gốc (chưa đổi tên khoá) của các hàm Storage — luôn dùng bản này khi cần đụng khoá thật / khoá demo theo ĐÚNG tên
  var rawGet = Storage.prototype.getItem, rawSet = Storage.prototype.setItem, rawRemove = Storage.prototype.removeItem, rawKey = Storage.prototype.key;
  // bản gốc (chưa đổi tên) của các hàm IndexedDB — dùng khi xoá dữ liệu demo theo ĐÚNG tên đã có tiền tố
  var origDelete = window.IDBFactory ? IDBFactory.prototype.deleteDatabase : null;

  if (on) {
    // ---- 1. đổi tên khoá lưu trữ ----
    var proto = Storage.prototype;
    var g = rawGet, s = rawSet, r = rawRemove, k = rawKey;
    var map = function (key) { return key === FLAG ? key : PREFIX + key; };
    proto.getItem = function (key) { return g.call(this, map(key)); };
    proto.setItem = function (key, v) { if (api.leaving) return; return s.call(this, map(key), v); };   // đang thoát: không ghi thêm
    proto.removeItem = function (key) { return r.call(this, map(key)); };
    // clear(): chỉ xoá phần demo, không bao giờ xoá dữ liệu thật
    proto.clear = function () {
      var del = [];
      for (var i = 0; i < this.length; i++) { var n = k.call(this, i); if (n && n.indexOf(PREFIX) === 0) del.push(n); }
      del.forEach(function (n) { r.call(this, n); }, this);
    };
    // ---- IndexedDB ----
    if (window.IDBFactory) {
      var idbProto = IDBFactory.prototype, open = idbProto.open, del = idbProto.deleteDatabase;
      idbProto.open = function (name, ver) { return ver === undefined ? open.call(this, IDB_PREFIX + name) : open.call(this, IDB_PREFIX + name, ver); };
      idbProto.deleteDatabase = function (name) { return del.call(this, IDB_PREFIX + name); };
    }
  }

  // ---- xoá dữ liệu demo trên trình duyệt (khi bắt đầu mới / làm mới / thoát) ----
  function wipe() {
    ['localStorage', 'sessionStorage'].forEach(function (st) {
      try {
        var store = window[st], names = [];
        for (var i = 0; i < store.length; i++) { var n = rawKey.call(store, i); if (n && n.indexOf(PREFIX) === 0) names.push(n); }
        names.forEach(function (n) { rawRemove.call(store, n); });
      } catch (e) { /* ignore */ }
    });
    try {
      if (indexedDB.databases && origDelete) indexedDB.databases().then(function (list) {
        // chỉ xoá cơ sở dữ liệu có tiền tố demo_ — không bao giờ đụng cơ sở dữ liệu thật
        list.forEach(function (d) { if (d.name && d.name.indexOf(IDB_PREFIX) === 0) origDelete.call(indexedDB, d.name); });
      });
    } catch (e) { /* ignore */ }
  }
  function root() { var sc = document.currentScript; return sc && sc.src ? new URL('../', sc.src).href : new URL('./', location.href).href; }
  var ROOT = root();

  function post(path, body) {
    return fetch(path, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function (resp) { return resp.json().catch(function () { return {}; }).then(function (d) { if (!resp.ok) throw new Error(d.error || ('Lỗi máy chủ (HTTP ' + resp.status + ')')); return d; }); });
  }
  api.available = function () {
    return fetch('/api/demo/status', { credentials: 'same-origin', cache: 'no-store', redirect: 'manual' })
      .then(function (resp) { return resp.ok ? resp.json().then(function (d) { d.ok = true; return d; }) : { ok: false, available: false, active: false }; })
      .catch(function () { return { ok: false, available: false, active: false }; });
  };
  // vào demo với vai trò: 'admin' | 'pm' | 'sitesup' | 'staff'
  api.start = function (role) {
    return post('/api/demo/start', { role: role }).then(function () {
      wipe();
      try { rawSet.call(localStorage, FLAG, '1'); } catch (e) { throw new Error('Trình duyệt không cho lưu dữ liệu — bật lưu trữ rồi thử lại'); }
      location.href = ROOT + 'index.html';
    });
  };
  api.reset = function () {
    return post('/api/demo/reset', {}).then(function () { wipe(); location.reload(); });
  };
  api.stop = function () {
    return post('/api/demo/stop', {}).catch(function () { /* mất mạng: vẫn thoát phía trình duyệt */ }).then(function () {
      api.leaving = true;      // các tác vụ nền còn chạy không được ghi thêm khoá demo
      wipe();
      try { rawRemove.call(localStorage, FLAG); rawSet.call(localStorage, CLEAN, '1'); } catch (e) { /* ignore */ }
      location.href = ROOT + 'index.html';
    });
  };
  window.TsDemo = api;
  // vừa thoát demo: dọn nốt khoá demo còn sót (tác vụ nền của trang cũ) ở lần mở trang đầu tiên
  if (!on) {
    try { if (rawGet.call(localStorage, CLEAN)) { wipe(); rawRemove.call(localStorage, CLEAN); } } catch (e) { /* ignore */ }
  }

  if (!on || window.top !== window) return;   // chỉ trang chính hiện thanh demo (không hiện trong iframe)

  // ---- thanh thông báo ----
  function banner() {
    var bar = document.createElement('div');
    bar.id = 'tsDemoBar';
    bar.setAttribute('role', 'status');
    bar.style.cssText = 'position:sticky;top:0;z-index:2147483000;display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:7px 14px;' +
      'background:#fef3c7;color:#78350f;border-bottom:2px solid #f59e0b;font:600 13px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif';
    bar.innerHTML = '<span>🧪 CHẾ ĐỘ DEMO — dữ liệu thử, không ảnh hưởng dữ liệu thật; không gửi email.</span>' +
      '<span style="margin-left:auto;display:flex;gap:8px"><button type="button" data-a="reset">Làm mới dữ liệu demo</button>' +
      '<button type="button" data-a="role">Đổi vai trò</button><button type="button" data-a="stop">Thoát demo</button></span>';
    bar.querySelectorAll('button').forEach(function (b) {
      b.style.cssText = 'border:1px solid #b45309;background:#fff;color:#78350f;border-radius:6px;padding:4px 10px;font:600 12.5px system-ui,sans-serif;cursor:pointer';
      b.addEventListener('click', function () {
        var a = b.getAttribute('data-a');
        b.disabled = true;
        var done = function () { b.disabled = false; };
        if (a === 'reset') { if (confirm('Dựng lại toàn bộ dữ liệu mẫu? Mọi thay đổi bạn đã làm trong demo sẽ mất.')) api.reset().catch(function (e) { alert(e.message); done(); }); else done(); }
        else if (a === 'role') location.href = ROOT + 'index.html#demo';
        else api.stop().catch(function (e) { alert(e.message); done(); });
      });
    });
    document.body.insertBefore(bar, document.body.firstChild);
  }
  if (document.body) banner(); else document.addEventListener('DOMContentLoaded', banner);

  // cờ còn nhưng máy chủ không ở chế độ demo nữa (hết hạn cookie / tắt demo) → bỏ cờ để không lẫn dữ liệu
  api.available().then(function (st) {
    if (st && st.ok && !st.active) {
      try { rawRemove.call(localStorage, FLAG); rawSet.call(localStorage, CLEAN, '1'); } catch (e) { /* ignore */ }
      location.reload();
    }
  });
})();
