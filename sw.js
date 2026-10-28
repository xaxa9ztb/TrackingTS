// Service worker của Bộ công cụ dự án — cho phép mở các chức năng khi MẤT MẠNG / SÓNG YẾU
// (công trường, hố thang…) và cài lên màn hình điện thoại như một ứng dụng.
//
//  - Trang (HTML):            lấy mới từ mạng, chờ tối đa 4 giây; không được thì dùng bản đã lưu.
//  - JS / CSS / file mẫu:     dùng ngay bản đã lưu, cập nhật ngầm (các file đã có ?v=… nên an toàn).
//  - Thư viện CDN:            tải 1 lần (chỉ lưu khi tải THÀNH CÔNG), sau đó dùng bản đã lưu.
//  - Google Drive / đăng nhập Google: KHÔNG lưu đệm (dữ liệu đã có IndexedDB lo).
//
// Khi đổi danh sách file bên dưới hoặc cách lưu đệm: tăng VERSION.
const VERSION = 'v71';
const SHELL = `toolset-shell-${VERSION}`;
const CDN = 'toolset-cdn-v1';
const HTML_TIMEOUT = 4000;

const SHELL_FILES = [
  './', './index.html', './tracking.html', './admin.html', './huong-dan.html', './huong-dan-timesheet.html', './manifest.webmanifest',
  './css/style.css',
  './js/demo.js', './js/config.js', './js/db.js', './js/cloud.js', './js/session.js', './js/pwa.js', './js/backup.js',
  './js/importer.js', './js/charts.js', './js/combo.js', './js/tablefilter.js', './js/dashboard.js',
  './js/projects.js', './js/timesheet.js', './js/employees.js', './js/swat.js', './js/main.js', './js/xlsx.full.min.js',
  './tools/toolset-nav.js', './tools/swat-hour/index.html', './tools/accounts/index.html', './tools/accounts/app.js', './tools/accounts/style.css',
  './tools/timesheet/', './tools/timesheet/index.html', './tools/timesheet/labor.js', './tools/timesheet/tssync.js', './tools/timesheet/allowance.js', './tools/timesheet/otleave.js', './tools/timesheet/app.js',
  './tools/timesheet/tailwind.css', './tools/timesheet/ts-template.xlsx', './tools/timesheet/phucap-xe-template.xlsx',
  './tools/tiendotm/', './tools/tiendotm/index.html',
  './tools/projectplan/', './tools/projectplan/index.html', './tools/projectplan/app.js', './tools/projectplan/pmio.js', './tools/projectplan/actual.js', './tools/projectplan/style.css',
  './tools/tiendotm/hoso_chatluong_template.docx', './tools/tiendotm/thu_hangve_template.docx', './tools/tiendotm/chungtu.js',
  './tools/tiendotm/nhatky_template.docx', './tools/tiendotm/bbxn_hangve_template.docx', './tools/tiendotm/bangiao_template.docx',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-64.png',
];
const CDN_FILES = [
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.0/tesseract.min.js',
];
const CDN_HOSTS = ['unpkg.com', 'cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com', 'tessdata.projectnaptha.com'];
const NEVER_CACHE = ['www.googleapis.com', 'accounts.google.com', 'oauth2.googleapis.com'];

const cacheable = (res) => res && res.ok && res.status !== 206 && !res.redirected;
async function put(cache, req, res) { try { if (cacheable(res)) await cache.put(req, res); } catch (e) { /* hết dung lượng… */ } }

// Thư viện CDN: tải ở chế độ CORS để biết chắc tải thành công (không lưu bản lỗi "mờ")
async function fetchCdn(url) {
  try { return await fetch(url, { mode: 'cors', credentials: 'omit' }); }
  catch (e) { return null; }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL);
    await Promise.all(SHELL_FILES.map(async (u) => {
      try { await put(shell, u, await fetch(new Request(u, { cache: 'reload' }))); } catch (e) { /* bỏ qua file lỗi */ }
    }));
    const cdn = await caches.open(CDN);
    await Promise.all(CDN_FILES.map(async (u) => {
      if (await cdn.match(u)) return;
      await put(cdn, u, await fetchCdn(u));
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('toolset-shell-') && key !== SHELL) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

const offlineHtml = () => `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Ngoại tuyến</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:0 20px;
background:#f4f5f7;color:#111827;font:15px/1.6 system-ui,sans-serif}main{max-width:420px;background:#fff;
border:1px solid #e5e7eb;border-radius:14px;padding:24px}h1{font-size:19px;margin:0 0 8px}a{color:#111827}</style>
</head><body><main><h1>📴 Đang ngoại tuyến</h1><p>Trang này chưa được lưu trên máy nên chưa mở được khi mất mạng.
Hãy mở lại khi có mạng — sau đó trang sẽ dùng được cả khi ngoại tuyến.</p><p><a href="${self.registration.scope}">‹ Về Bộ công cụ</a></p></main></body></html>`;

async function matchShell(req) {
  const cache = await caches.open(SHELL);
  return (await cache.match(req)) || (await cache.match(req, { ignoreSearch: true }));
}

// Trang: mạng trước (tối đa HTML_TIMEOUT), rồi bản đã lưu; vẫn cập nhật bản lưu khi mạng trả về muộn
async function pageFirstNetwork(event, req) {
  const cache = await caches.open(SHELL);
  const network = fetch(req).then(async (res) => { await put(cache, req, res.clone()); return res; });
  const quick = await Promise.race([network.catch(() => null), new Promise(r => setTimeout(r, HTML_TIMEOUT, null))]);
  if (quick) return quick;
  const cached = await matchShell(req);
  if (cached) { event.waitUntil(network.catch(() => {})); return cached; }
  try { return await network; }
  catch (e) { return new Response(offlineHtml(), { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }); }
}

// File trong repo: dùng bản đã lưu ngay, cập nhật ngầm
async function staleWhileRevalidate(event, req) {
  const cache = await caches.open(SHELL);
  const cached = await cache.match(req);
  const network = fetch(req).then(async (res) => { await put(cache, req, res.clone()); return res; });
  if (cached) { event.waitUntil(network.catch(() => {})); return cached; }
  try { return await network; }
  catch (e) { return (await cache.match(req, { ignoreSearch: true })) || Response.error(); }
}

// Thư viện CDN: bản đã lưu trước, chưa có thì tải (và lưu nếu thành công)
async function cdnCacheFirst(req) {
  const cache = await caches.open(CDN);
  const hit = await cache.match(req.url);
  if (hit) return hit;
  const res = await fetchCdn(req.url);
  if (res && res.ok) { await put(cache, req.url, res.clone()); return res; }
  return fetch(req); // CDN không hỗ trợ CORS → để trình duyệt tự xử lý như bình thường
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (NEVER_CACHE.includes(url.hostname)) return;

  if (url.origin === self.location.origin) {
    if (!req.url.startsWith(self.registration.scope)) return; // trang khác cùng tên miền (repo khác)
    // Dữ liệu máy chủ (/api) và trang đăng nhập Cloudflare Access (/cdn-cgi/): luôn lấy mới, không lưu đệm
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/cdn-cgi/')) return;
    const isPage = req.mode === 'navigate' || req.destination === 'document' || req.destination === 'iframe';
    event.respondWith(isPage ? pageFirstNetwork(event, req) : staleWhileRevalidate(event, req));
    return;
  }
  if (CDN_HOSTS.includes(url.hostname)) event.respondWith(cdnCacheFirst(req));
});
