// Google Drive integration: viewers read a public data.json via API key;
// admin writes it back after signing in with Google (OAuth, scope drive.file).
const Cloud = (() => {
  let lastUpdatedAt = null;

  function configured() {
    return !!(window.CONFIG && CONFIG.DRIVE_FILE_ID && CONFIG.GOOGLE_API_KEY);
  }
  function canWrite() {
    return !!(window.CONFIG && CONFIG.DRIVE_FILE_ID && CONFIG.GOOGLE_CLIENT_ID);
  }

  async function gatherAll() {
    const [employees, projects, timesheets] = await Promise.all([
      DB.getAll('employees'), DB.getAll('projects'), DB.getAll('timesheets'),
    ]);
    let specHeaders = null;
    try { specHeaders = JSON.parse(localStorage.getItem('specHeaders') || 'null'); } catch (e) { /* ignore */ }
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      specHeaders,
      employees, projects, timesheets,
    };
  }

  async function applyData(data) {
    if (!data || !Array.isArray(data.employees) || !Array.isArray(data.projects) || !Array.isArray(data.timesheets)) {
      throw new Error('File dữ liệu trên Drive không đúng định dạng');
    }
    await DB.clear('employees');
    await DB.clear('projects');
    await DB.clear('timesheets');
    await DB.bulkPut('employees', data.employees);
    await DB.bulkPut('projects', data.projects);
    await DB.bulkPut('timesheets', data.timesheets);
    if (data.specHeaders) {
      try { localStorage.setItem('specHeaders', JSON.stringify(data.specHeaders)); } catch (e) { /* ignore */ }
    }
    lastUpdatedAt = data.updatedAt || null;
  }

  // ---- read path (everyone) ----
  async function loadFromDrive() {
    const url = `https://www.googleapis.com/drive/v3/files/${CONFIG.DRIVE_FILE_ID}?alt=media&key=${CONFIG.GOOGLE_API_KEY}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Không tải được dữ liệu từ Drive (HTTP ' + resp.status + ')');
    const data = await resp.json();
    await applyData(data);
    return data;
  }

  // ---- write path (admin) ----
  function loadGis() {
    return new Promise((resolve, reject) => {
      if (window.google && google.accounts && google.accounts.oauth2) return resolve();
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Không tải được Google Sign-In (kiểm tra kết nối mạng)'));
      document.head.appendChild(s);
    });
  }

  async function getToken() {
    await loadGis();
    return new Promise((resolve, reject) => {
      const tc = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (resp) => {
          if (resp.access_token) resolve(resp.access_token);
          else reject(new Error(resp.error || 'Không lấy được quyền truy cập Google'));
        },
        error_callback: (err) => reject(new Error(err.message || 'Đăng nhập Google bị huỷ')),
      });
      tc.requestAccessToken();
    });
  }

  async function saveToDrive() {
    if (!canWrite()) throw new Error('Chưa cấu hình DRIVE_FILE_ID / GOOGLE_CLIENT_ID trong config.js');
    const token = await getToken();
    const data = await gatherAll();
    const resp = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${CONFIG.DRIVE_FILE_ID}?uploadType=media`,
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }
    );
    if (!resp.ok) throw new Error('Lưu lên Drive thất bại (HTTP ' + resp.status + '): ' + (await resp.text()).slice(0, 200));
    lastUpdatedAt = data.updatedAt;
    return { employees: data.employees.length, projects: data.projects.length, timesheets: data.timesheets.length };
  }

  // One-time setup: create timesheet-data.json on the admin's Drive with current
  // app data, make it public-readable, and print its file ID. Run from Console:
  //   await Cloud.createDriveFile()
  async function createDriveFile() {
    if (!window.CONFIG || !CONFIG.GOOGLE_CLIENT_ID) throw new Error('Cần điền GOOGLE_CLIENT_ID trong config.js trước');
    const token = await getToken();
    const boundary = 'xTimesheetBoundary7391';
    const meta = { name: 'timesheet-data.json' };
    const content = JSON.stringify(await gatherAll());
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
    const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'multipart/related; boundary=' + boundary },
      body,
    });
    if (!resp.ok) throw new Error('Tạo file thất bại (HTTP ' + resp.status + '): ' + (await resp.text()).slice(0, 200));
    const file = await resp.json();

    const permResp = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}/permissions`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });
    if (!permResp.ok) throw new Error('File đã tạo (' + file.id + ') nhưng chưa mở quyền xem công khai được: HTTP ' + permResp.status);

    console.log('%cDRIVE_FILE_ID = ' + file.id, 'font-weight:bold;font-size:14px');
    console.log('Dán giá trị trên vào DRIVE_FILE_ID trong js/config.js rồi upload lại lên GitHub.');
    return file.id;
  }

  return {
    configured, canWrite, loadFromDrive, saveToDrive, createDriveFile,
    getLastUpdatedAt: () => lastUpdatedAt,
  };
})();
