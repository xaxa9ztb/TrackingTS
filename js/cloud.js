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

  // Ép các trường ĐỊNH DANH / VĂN BẢN về chuỗi. Dữ liệu nhập từ Excel (hoặc
  // file sao lưu cũ) có thể lưu tên dự án, mã NV… ở KIỂU SỐ; khi đó các thao
  // tác chuỗi (.toLowerCase / .localeCompare / .trim…) sẽ văng lỗi và chặn
  // toàn bộ giao diện. Chỉ ép trường văn bản — KHÔNG đụng các trường số
  // (normal/ot1/xHour…) để không phá phép tính.
  function normalizeLoaded(data) {
    const toStr = (v) => (v === undefined || v === null) ? '' : String(v);
    const stringFields = {
      employees: ['empId', 'fullName', 'personId', 'username', 'position', 'supervisor', 'gender', 'dob', 'hireDate', 'startDate'],
      projects: ['wbs', 'projectName', 'projectNumber', 'productLine', 'customer', 'supervisor', 'salesRep'],
      timesheets: ['empId', 'empName', 'wbs', 'projectName', 'activities', 'category', 'date', 'timeFrom', 'timeTo', 'role'],
    };
    for (const store of Object.keys(stringFields)) {
      const rows = data[store];
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        if (!row || typeof row !== 'object') continue;
        for (const f of stringFields[store]) {
          if (f in row && typeof row[f] !== 'string') row[f] = toStr(row[f]);
        }
      }
    }
    return data;
  }

  async function applyData(data) {
    if (!data || !Array.isArray(data.employees) || !Array.isArray(data.projects) || !Array.isArray(data.timesheets)) {
      throw new Error('File dữ liệu trên Drive không đúng định dạng');
    }
    normalizeLoaded(data);
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

  // ---- nén/giải nén gzip (giảm dung lượng file Drive ~5-10 lần để lâu chạm
  // hạn mức lượt tải công khai của Google Drive). Không cần thư viện ngoài. ----
  async function gzipBytes(str) {
    if (typeof CompressionStream === 'undefined') return null;
    const stream = new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  // Nhận ArrayBuffer từ Drive; tự nhận biết gzip (magic 1F 8B) hoặc JSON thường.
  async function decodeToText(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b && typeof DecompressionStream !== 'undefined') {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      return await new Response(stream).text();
    }
    return new TextDecoder('utf-8').decode(bytes);
  }

  // ---- read path (everyone) ----
  async function loadFromDrive() {
    const url = `https://www.googleapis.com/drive/v3/files/${CONFIG.DRIVE_FILE_ID}?alt=media&key=${CONFIG.GOOGLE_API_KEY}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    let resp;
    try {
      resp = await fetch(url, { signal: ctrl.signal });
    } catch (e) {
      throw new Error(e.name === 'AbortError'
        ? 'Quá thời gian tải dữ liệu từ Drive (25s) — kiểm tra kết nối mạng.'
        : ('Lỗi mạng khi tải dữ liệu từ Drive: ' + e.message));
    } finally { clearTimeout(timer); }
    if (resp.status === 403 || resp.status === 429) {
      // Google Drive chặn tải file công khai do vượt hạn mức lượt tải trong ngày.
      throw new Error('QUOTA: Google Drive đang giới hạn lượt tải file công khai trong hôm nay (hạn mức reset sau ~24 giờ).');
    }
    if (!resp.ok) throw new Error('Không tải được dữ liệu từ Drive (HTTP ' + resp.status + ')');
    const text = await decodeToText(await resp.arrayBuffer());
    let data;
    try { data = JSON.parse(text); }
    catch (e) { throw new Error('Dữ liệu trên Drive không đọc được (Drive có thể trả về trang lỗi thay vì file).'); }
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

  let cachedToken = null;
  let cachedTokenExpiry = 0;

  async function getToken() {
    if (cachedToken && Date.now() < cachedTokenExpiry - 60000) return cachedToken;
    await loadGis();
    return new Promise((resolve, reject) => {
      const tc = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (resp) => {
          if (resp.access_token) {
            cachedToken = resp.access_token;
            cachedTokenExpiry = Date.now() + (parseInt(resp.expires_in, 10) || 3600) * 1000;
            resolve(resp.access_token);
          } else {
            reject(new Error(resp.error || 'Không lấy được quyền truy cập Google'));
          }
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
    const json = JSON.stringify(data);
    const gz = await gzipBytes(json);            // nén nếu trình duyệt hỗ trợ
    const resp = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${CONFIG.DRIVE_FILE_ID}?uploadType=media`,
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': gz ? 'application/gzip' : 'application/json' },
        body: gz || json,
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

  // Drive keeps old revisions of the file (~30 days). List them so a bad
  // published update can be rolled back.
  async function listDriveRevisions() {
    if (!canWrite()) throw new Error('Chưa cấu hình Drive trong config.js');
    const token = await getToken();
    const resp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${CONFIG.DRIVE_FILE_ID}/revisions?fields=revisions(id,modifiedTime,size)&pageSize=1000`,
      { headers: { Authorization: 'Bearer ' + token } }
    );
    if (!resp.ok) throw new Error('Không lấy được danh sách phiên bản (HTTP ' + resp.status + ')');
    const j = await resp.json();
    return (j.revisions || []).sort((a, b) => (a.modifiedTime < b.modifiedTime ? 1 : -1));
  }

  // Download an old revision's content and load it into the app (local only —
  // press "Lưu lên Drive" afterwards to publish the rollback to everyone).
  async function restoreDriveRevision(revisionId) {
    const token = await getToken();
    const resp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${CONFIG.DRIVE_FILE_ID}/revisions/${revisionId}?alt=media`,
      { headers: { Authorization: 'Bearer ' + token } }
    );
    if (!resp.ok) throw new Error('Không tải được phiên bản cũ (HTTP ' + resp.status + ')');
    const data = JSON.parse(await decodeToText(await resp.arrayBuffer()));
    await applyData(data);
    return {
      updatedAt: data.updatedAt || '',
      employees: data.employees.length, projects: data.projects.length, timesheets: data.timesheets.length,
    };
  }

  // ---- sao lưu / phục hồi bằng file JSON trên máy (phương án dự phòng) ----
  // Dùng CHUNG định dạng với file Drive (gatherAll/applyData).
  async function exportLocalBackup() {
    const data = await gatherAll();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `TrackingTS-backup-${stamp}.json`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); document.body.removeChild(a); }, 100);
    return { employees: data.employees.length, projects: data.projects.length, timesheets: data.timesheets.length };
  }

  async function importLocalBackup(file) {
    const text = await file.text();
    let data;
    try { data = JSON.parse(text); }
    catch (e) { throw new Error('File không phải JSON hợp lệ.'); }
    await applyData(data); // tự kiểm tra định dạng + thay thế toàn bộ dữ liệu
    return {
      updatedAt: data.updatedAt || '',
      employees: data.employees.length, projects: data.projects.length, timesheets: data.timesheets.length,
    };
  }

  return {
    configured, canWrite, loadFromDrive, saveToDrive, createDriveFile,
    listDriveRevisions, restoreDriveRevision, exportLocalBackup, importLocalBackup,
    getLastUpdatedAt: () => lastUpdatedAt,
  };
})();
