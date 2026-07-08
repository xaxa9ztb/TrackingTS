// Admin gate: password only unlocks the UI; real write protection is the
// admin's Google account (only it can overwrite the Drive file).
const Auth = (() => {
  let admin = false;

  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function applyUI() {
    document.body.classList.toggle('admin-mode', admin);
    const btnAdmin = document.getElementById('btnAdmin');
    if (CONFIG.ADMIN_PASSWORD_HASH) {
      btnAdmin.style.display = '';
      btnAdmin.textContent = admin ? 'Admin ✓ (Thoát)' : '🔒 Admin';
    } else {
      btnAdmin.style.display = 'none';
    }
    document.getElementById('btnSaveDrive').style.display = (admin && Cloud.canWrite()) ? '' : 'none';
  }

  function init() {
    if (!CONFIG.ADMIN_PASSWORD_HASH) admin = true; // chạy local, không khoá
    else if (sessionStorage.getItem('adminOk') === CONFIG.ADMIN_PASSWORD_HASH) admin = true;
    applyUI();
  }

  async function toggle() {
    if (admin && CONFIG.ADMIN_PASSWORD_HASH) {
      admin = false;
      sessionStorage.removeItem('adminOk');
      applyUI();
      return;
    }
    const pw = prompt('Nhập mật khẩu admin:');
    if (pw === null || pw === '') return;
    if (!(window.crypto && crypto.subtle)) {
      alert('Trình duyệt không hỗ trợ mã hoá ở địa chỉ này — hãy mở app qua https hoặc localhost để đăng nhập admin.');
      return;
    }
    const h = await sha256(pw);
    if (h === CONFIG.ADMIN_PASSWORD_HASH) {
      admin = true;
      sessionStorage.setItem('adminOk', h);
      applyUI();
    } else {
      alert('Sai mật khẩu!');
    }
  }

  return { init, toggle, sha256, isAdmin: () => admin };
})();

// console helper: await hashPassword('mật khẩu') -> dán kết quả vào config.js
window.hashPassword = (pw) => Auth.sha256(pw);

const Modal = (() => {
  function open(title, bodyHtml, onSave) {
    const root = document.getElementById('modalRoot');
    root.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-box">
          <h3>${title}</h3>
          <div class="modal-grid">${bodyHtml}</div>
          <div class="modal-actions">
            <button class="btn btn-secondary" id="modalCancel">Huỷ</button>
            <button class="btn btn-primary" id="modalSave">Lưu</button>
          </div>
        </div>
      </div>`;
    const close = () => { root.innerHTML = ''; };
    root.querySelector('#modalCancel').addEventListener('click', close);
    root.querySelector('.modal-overlay').addEventListener('click', (e) => { if (e.target.classList.contains('modal-overlay')) close(); });
    root.querySelector('#modalSave').addEventListener('click', async () => {
      const ok = await onSave();
      if (ok !== false) close();
    });
  }
  return { open };
})();

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
}

async function updateDataStatus() {
  const [emp, proj, ts] = await Promise.all([DB.count('employees'), DB.count('projects'), DB.count('timesheets')]);
  const el = document.getElementById('dataStatus');
  if (emp === 0 && proj === 0 && ts === 0) {
    el.textContent = Auth.isAdmin() ? 'Chưa có dữ liệu — bấm "Cập nhật Data" để bắt đầu' : 'Chưa có dữ liệu';
  } else {
    let txt = `${emp} nhân viên · ${proj} dự án · ${ts} dòng bảng công`;
    const upd = Cloud.getLastUpdatedAt();
    if (upd) txt += ` · Drive: ${upd.slice(0, 16).replace('T', ' ')}`;
    el.textContent = txt;
  }
}

function openUpdateModal() {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-box update-modal">
        <h3>Cập nhật Database</h3>

        <div class="update-option">
          <div class="update-info">
            <b>1. Cập nhật toàn bộ</b>
            <p>File Excel đủ 3 sheet (EE DATA, Yan_COM, TS All) như "Data v1.xlsx".
            <b>Thay thế toàn bộ</b> dữ liệu hiện có trong app.</p>
          </div>
          <button class="btn btn-primary" data-mode="full">Chọn file</button>
        </div>

        <div class="update-option">
          <div class="update-info">
            <b>2. Bổ sung Dự án (Yan_COM)</b>
            <p>File có cấu trúc cột như sheet Yan_COM. Thêm dự án mới; dòng <b>trùng WBS</b>
            thì chỉ <b>điền bổ sung vào các ô còn trống</b> (thông số kỹ thuật, giám sát...),
            <b>không ghi đè</b> dữ liệu đã có.</p>
          </div>
          <button class="btn btn-secondary" data-mode="projects">Chọn file</button>
        </div>

        <div class="update-option">
          <div class="update-info">
            <b>3. Bổ sung Nhân viên (EE Data)</b>
            <p>File có cấu trúc cột như sheet EE DATA. Chỉ thêm nhân viên mới —
            dòng <b>trùng mã NV</b> sẽ <b>bị bỏ qua</b>, không ghi đè.</p>
          </div>
          <button class="btn btn-secondary" data-mode="employees">Chọn file</button>
        </div>

        <div class="update-option">
          <div class="update-info">
            <b>4. Bổ sung Bảng công (theo tháng)</b>
            <p>Chọn <b>1 hoặc nhiều file</b> chấm công (mỗi nhân viên 1 file/tháng, cột như
            sheet TS All). Chỉ thêm dòng mới — dòng <b>trùng</b> (cùng nhân viên, ngày,
            dự án, hoạt động) sẽ <b>bị bỏ qua</b>, không ghi trùng.</p>
          </div>
          <button class="btn btn-secondary" data-mode="timesheets">Chọn files</button>
        </div>

        <div class="update-option">
          <div class="update-info">
            <b>5. Khôi phục dữ liệu cũ</b>
            <p>Nếu bản cập nhật mới bị sai: quay về <b>bản sao lưu trên máy</b> (tự tạo trước mỗi
            lần "Cập nhật toàn bộ" / xoá hàng loạt) hoặc <b>bản cũ của file trên Google Drive</b>.</p>
          </div>
          <button class="btn btn-secondary" id="updShowRestore">Xem bản sao lưu</button>
        </div>

        <div id="restorePanel" style="display:none">
          <h4>Bản sao lưu trên máy này</h4>
          <div id="localBackupList" class="backup-list">Đang tải...</div>
          <h4>Bản cũ trên Google Drive</h4>
          <button class="btn btn-secondary" id="btnLoadRevisions">Tải danh sách từ Drive (cần đăng nhập Google)</button>
          <div id="driveRevList" class="backup-list"></div>
        </div>

        <div id="updStatus" class="update-status"></div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="updClose">Đóng</button>
        </div>
      </div>
    </div>`;

  const close = () => { root.innerHTML = ''; };
  root.querySelector('#updClose').addEventListener('click', close);
  root.querySelector('.modal-overlay').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) close();
  });

  const statusEl = root.querySelector('#updStatus');

  // ---- restore section ----
  const fmtTs = ts => (ts || '').slice(0, 16).replace('T', ' ');

  async function renderLocalBackups() {
    const items = await Backup.list();
    const el = root.querySelector('#localBackupList');
    if (!items.length) {
      el.innerHTML = '<div class="backup-empty">Chưa có bản sao lưu nào trên máy này.</div>';
      return;
    }
    el.innerHTML = items.map(b => `
      <div class="backup-item">
        <div>
          <b>${fmtTs(b.ts)}</b> — ${b.label || 'thủ công'}<br>
          <span class="backup-meta">${b.employees} NV · ${b.projects} dự án · ${b.timesheets} dòng công</span>
        </div>
        <button class="btn btn-secondary" data-restore-local="${b.id}">Khôi phục</button>
      </div>`).join('');
    el.querySelectorAll('[data-restore-local]').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Khôi phục dữ liệu về bản sao lưu này?\n(Dữ liệu hiện tại sẽ được tự sao lưu trước khi khôi phục.)')) return;
      statusEl.textContent = 'Đang khôi phục...';
      statusEl.className = 'update-status';
      try {
        const r = await Backup.restore(parseInt(btn.dataset.restoreLocal, 10));
        await refreshAllPages();
        await renderLocalBackups();
        statusEl.textContent = `✓ Đã khôi phục: ${r.employees} NV, ${r.projects} dự án, ${r.timesheets} dòng công.` +
          (Cloud.canWrite() ? ' Kiểm tra lại số liệu rồi bấm "Lưu lên Drive" để xuất bản cho mọi người.' : '');
        statusEl.className = 'update-status ok';
      } catch (err) {
        console.error(err);
        statusEl.textContent = '✗ Lỗi khôi phục: ' + err.message;
        statusEl.className = 'update-status err';
      }
    }));
  }

  root.querySelector('#updShowRestore').addEventListener('click', () => {
    const panel = root.querySelector('#restorePanel');
    const show = panel.style.display === 'none';
    panel.style.display = show ? '' : 'none';
    if (show) renderLocalBackups();
  });

  const btnLoadRev = root.querySelector('#btnLoadRevisions');
  if (!Cloud.canWrite()) btnLoadRev.disabled = true;
  btnLoadRev.addEventListener('click', async () => {
    statusEl.textContent = 'Đang lấy danh sách phiên bản từ Drive...';
    statusEl.className = 'update-status';
    try {
      const revs = await Cloud.listDriveRevisions();
      const el = root.querySelector('#driveRevList');
      if (!revs.length) { el.innerHTML = '<div class="backup-empty">Không có phiên bản nào.</div>'; return; }
      el.innerHTML = revs.map((rv, i) => `
        <div class="backup-item">
          <div>
            <b>${fmtTs(rv.modifiedTime)}</b> ${i === 0 ? '(bản hiện tại)' : ''}<br>
            <span class="backup-meta">${(rv.size / 1048576).toFixed(2)} MB</span>
          </div>
          ${i === 0 ? '' : `<button class="btn btn-secondary" data-restore-rev="${rv.id}">Khôi phục</button>`}
        </div>`).join('');
      el.querySelectorAll('[data-restore-rev]').forEach(btn => btn.addEventListener('click', async () => {
        if (!confirm('Tải phiên bản cũ này về app?\n(Dữ liệu hiện tại sẽ được tự sao lưu trước. Sau khi kiểm tra, bấm "Lưu lên Drive" để xuất bản.)')) return;
        statusEl.textContent = 'Đang tải phiên bản cũ...';
        try {
          await Backup.snapshot('Trước khi khôi phục từ Drive (tự động)');
          const r = await Cloud.restoreDriveRevision(btn.dataset.restoreRev);
          await refreshAllPages();
          statusEl.textContent = `✓ Đã tải về bản ${fmtTs(r.updatedAt)}: ${r.employees} NV, ${r.projects} dự án, ${r.timesheets} dòng công. Kiểm tra số liệu rồi bấm "Lưu lên Drive" để xuất bản cho mọi người.`;
          statusEl.className = 'update-status ok';
        } catch (err) {
          console.error(err);
          statusEl.textContent = '✗ Lỗi: ' + err.message;
          statusEl.className = 'update-status err';
        }
      }));
      statusEl.textContent = '';
    } catch (err) {
      console.error(err);
      statusEl.textContent = '✗ Lỗi: ' + err.message;
      statusEl.className = 'update-status err';
    }
  });

  root.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.xlsx,.xlsm';
      if (mode === 'timesheets') input.multiple = true;
      input.addEventListener('change', async () => {
        const files = [...input.files];
        if (!files.length) return;
        statusEl.textContent = 'Đang xử lý...';
        statusEl.className = 'update-status';
        try {
          let msg;
          if (mode === 'full') {
            const r = await Importer.importFile(files[0]);
            msg = `Đã thay thế toàn bộ: ${r.employees} nhân viên, ${r.projects} dự án, ${r.timesheets} dòng bảng công.`;
          } else if (mode === 'projects') {
            const r = await Importer.importProjectsFile(files[0]);
            msg = `Đã thêm ${r.added} dự án mới, bổ sung thông tin cho ${r.updated} dự án đã có, bỏ qua ${r.skipped} dòng không có gì mới.`;
          } else if (mode === 'employees') {
            const r = await Importer.importEmployeesFile(files[0]);
            msg = `Đã thêm ${r.added} nhân viên mới, bỏ qua ${r.skipped} dòng trùng mã NV.`;
          } else {
            const r = await Importer.importTimesheetFiles(files);
            msg = `Đã import ${r.files} file: thêm ${r.added} dòng mới, bỏ qua ${r.skipped} dòng trùng.`;
          }
          await refreshAllPages();
          statusEl.textContent = '✓ ' + msg;
          statusEl.className = 'update-status ok';
        } catch (err) {
          console.error(err);
          statusEl.textContent = '✗ Lỗi: ' + err.message;
          statusEl.className = 'update-status err';
          await updateDataStatus();
        }
      });
      input.click();
    });
  });
}

async function refreshAllPages() {
  await Dashboard.reloadAndRefresh();
  await ProjectsPage.load();
  await TimesheetPage.load();
  await EmployeesPage.load();
  await updateDataStatus();
}

document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  Auth.init();
  document.getElementById('btnAdmin').addEventListener('click', () => Auth.toggle());

  document.getElementById('btnImport').addEventListener('click', openUpdateModal);

  document.getElementById('btnSaveDrive').addEventListener('click', async () => {
    if (!confirm('Xuất bản dữ liệu hiện tại lên Google Drive cho mọi người cùng xem?')) return;
    const el = document.getElementById('dataStatus');
    el.textContent = 'Đang lưu lên Google Drive...';
    try {
      const r = await Cloud.saveToDrive();
      alert(`Đã lưu lên Drive: ${r.employees} nhân viên, ${r.projects} dự án, ${r.timesheets} dòng bảng công.\nMọi người tải lại trang sẽ thấy dữ liệu mới.`);
    } catch (err) {
      console.error(err);
      alert('Lỗi lưu lên Drive: ' + err.message);
    }
    await updateDataStatus();
  });

  // shared-data mode: pull the latest data.json from Google Drive on startup
  if (Cloud.configured()) {
    document.getElementById('dataStatus').textContent = 'Đang tải dữ liệu từ Google Drive...';
    try {
      await Cloud.loadFromDrive();
    } catch (err) {
      console.error('Drive load failed:', err);
      document.getElementById('dataStatus').textContent = 'Không tải được từ Drive — đang dùng dữ liệu cục bộ';
    }
  }

  document.getElementById('btnExport').addEventListener('click', () => {
    if (!Auth.isAdmin()) { alert('Chỉ admin mới được xuất dữ liệu.'); return; }
    Importer.exportWorkbook();
  });

  await Dashboard.init();
  await ProjectsPage.load();
  ProjectsPage.wire();
  await TimesheetPage.load();
  TimesheetPage.wire();
  await EmployeesPage.load();
  EmployeesPage.wire();
  await updateDataStatus();
});
