// Chế độ DEMO (chạy thử) cho bản Cloudflare.
//
// Dùng MỘT CƠ SỞ DỮ LIỆU D1 RIÊNG (binding DB_DEMO, tên trackingts-demo) có cùng cấu trúc với cơ sở dữ liệu thật.
// Khi trình duyệt có cookie ts_demo=1, máy chủ đổi env.DB sang DB_DEMO (xem handle() trong api.mjs) nên mọi
// thao tác — sửa nhân viên, dự án, nạp bảng công, nộp / duyệt bảng công — chỉ tác động vào dữ liệu thử.
// Thư không được gửi (bỏ cấu hình Brevo), danh sách admin khởi tạo bị bỏ qua (vai trò do người dùng chọn lúc vào demo).
//
// Dữ liệu mẫu là dữ liệu BỊA (không có người thật), dựng lại bất cứ lúc nào bằng seedDemo().

export const DEMO_COOKIE = 'ts_demo';
export const DEMO_ROLES = ['admin', 'pm', 'sitesup', 'staff'];

export function demoRequested(request) {
  return /(?:^|;\s*)ts_demo=1(?:;|$)/.test(request.headers.get('cookie') || '');
}
export function demoCookie(on) {
  // HttpOnly: trang không đọc được; trình duyệt tự gửi kèm mọi yêu cầu cùng nguồn
  return on
    ? `${DEMO_COOKIE}=1; Path=/; Max-Age=604800; SameSite=Lax; Secure; HttpOnly`
    : `${DEMO_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; Secure; HttpOnly`;
}

// env dùng cho yêu cầu ở chế độ demo: dữ liệu thử, không gửi thư, không có admin khởi tạo
export function demoEnv(env) {
  return { ...env, DB: env.DB_DEMO, DEMO: true, BREVO_API_KEY: '', MAIL_FROM: '', ADMIN_EMAILS: '' };
}

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (d, n) => new Date(d.getTime() + n * 864e5);

// kỳ lương 'YYYY-MM' chứa ngày d (16 → 15)
export function periodOf(d) {
  let y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
  if (d.getUTCDate() >= 16) { m += 1; if (m > 12) { m = 1; y += 1; } }
  return `${y}-${pad(m)}`;
}
function periodStart(period) {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(m === 1 ? y - 1 : y, m === 1 ? 11 : m - 2, 16));
}
export function prevPeriod(period) {
  const [y, m] = period.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
}

export const DEMO_EMPLOYEES = [
  { id: 'D001', name: 'Nguyễn Văn An', pos: 'Project Manager', sup: '' },
  { id: 'D002', name: 'Trần Thị Bình', pos: 'Site Supervisor', sup: 'Nguyễn Văn An' },
  { id: 'D003', name: 'Lê Quốc Cường', pos: 'Site Supervisor', sup: 'Nguyễn Văn An' },
  { id: 'D101', name: 'Phạm Minh Dũng', pos: 'Fitter', sup: 'Trần Thị Bình' },
  { id: 'D102', name: 'Hoàng Văn Em', pos: 'Fitter', sup: 'Trần Thị Bình' },
  { id: 'D103', name: 'Vũ Đức Phát', pos: 'Fitter', sup: 'Trần Thị Bình' },
  { id: 'D104', name: 'Đặng Quang Giang', pos: 'Fitter', sup: 'Lê Quốc Cường' },
  { id: 'D105', name: 'Bùi Thanh Hải', pos: 'Fitter', sup: 'Lê Quốc Cường' },
];

export const DEMO_PROJECTS = [
  { wbs: 'DEMO-001', name: 'Toà nhà Văn phòng Hoà Bình', no: 'P-1001', line: 'Schindler 3000', customer: 'Công ty Hoà Bình', sup: 'Trần Thị Bình', specs: { stops: 13, speed: 1.75, load: 900, model: 'Schindler 3000', units: 2 } },
  { wbs: 'DEMO-002', name: 'Chung cư Sao Mai - Block A', no: 'P-1002', line: 'Schindler 3300', customer: 'Sao Mai Land', sup: 'Trần Thị Bình', specs: { stops: 20, speed: 2.5, load: 1000, model: 'Schindler 3300', units: 4 } },
  { wbs: 'DEMO-003', name: 'Nhà máy Á Châu', no: 'P-1003', line: 'Schindler 2600', customer: 'Á Châu JSC', sup: 'Lê Quốc Cường', specs: { stops: 4, speed: 1, load: 2000, model: 'Schindler 2600', units: 1 } },
  { wbs: 'DEMO-004', name: 'Bệnh viện Phương Đông', no: 'P-1004', line: 'Schindler 5500', customer: 'BV Phương Đông', sup: 'Lê Quốc Cường', specs: { stops: 9, speed: 1.6, load: 1600, model: 'Schindler 5500', units: 3 } },
];

const STAFF = [   // wbs, empId, role
  ['DEMO-001', 'D002', 'sitesup'], ['DEMO-002', 'D002', 'sitesup'], ['DEMO-003', 'D003', 'sitesup'], ['DEMO-004', 'D003', 'sitesup'],
  ['DEMO-001', 'D001', 'pm'], ['DEMO-002', 'D001', 'pm'], ['DEMO-003', 'D001', 'pm'], ['DEMO-004', 'D001', 'pm'],
];

const DEMO_REPORTS = ['Lắp ray dẫn hướng tầng 1–4, kiểm tra độ thẳng.', 'Lắp khung cabin, treo đối trọng.', 'Đi dây hố thang, lắp tủ điều khiển.', 'Lắp cửa tầng, căn chỉnh khe hở.', 'Chạy thử không tải, chỉnh phanh.'];
// một dòng chấm công cá nhân hợp lệ khi nộp (có bd khớp giờ vào - ra)
function tsEntry(n, date, wbs, name, start, end, brk) {
  const t = (s) => { const [h, m] = s.split(':').map(Number); return h + m / 60; };
  const hours = Math.max(0, t(end) - t(start) - brk);
  const normal = Math.min(8, hours), ot = Math.max(0, hours - 8);
  return {
    id: String(1700000000000 + n), date, startTime: start, endTime: end, breakTime: String(brk),
    otMode: 'auto', otType: 'NORMAL', dutyHour: '0', remarks: '', report: DEMO_REPORTS[n % DEMO_REPORTS.length],
    activityCode: '1110', workNumber: wbs, projectName: name, cat: 'NI', u: 1700000000000 + n,
    bd: ot > 0 ? { NORMAL: normal, OT1: ot } : { NORMAL: normal },
  };
}

// Xoá toàn bộ dữ liệu demo và dựng lại dữ liệu mẫu + tài khoản của người đang thử.
// `me` = { email, name } từ Cloudflare Access; role = 'admin' | 'pm' | 'sitesup' | 'staff'.
export async function seedDemo(db, me, role, today = new Date()) {
  if (!DEMO_ROLES.includes(role)) role = 'staff';
  const stamp = today.toISOString();
  const wipe = ['project_staff', 'employees', 'projects', 'timesheets', 'ts_doc_wbs', 'ts_docs', 'kv_store', 'audit_log', 'mail_log'];
  await db.batch(wipe.map((t) => db.prepare(`DELETE FROM ${t}`)));

  const stmts = [];
  DEMO_EMPLOYEES.forEach((e) => stmts.push(db.prepare(
    "INSERT INTO employees (emp_id, full_name, position, supervisor, email, role_override, active, updated_at, hire_date, start_date) VALUES (?, ?, ?, ?, NULL, '', 1, ?, '2020-03-01', '2020-03-01')")
    .bind(e.id, e.name, e.pos, e.sup, stamp)));
  // người đang thử: một nhân viên riêng, vai trò theo lựa chọn
  const myPos = { admin: 'Quản trị hệ thống', pm: 'Project Manager', sitesup: 'Site Supervisor', staff: 'Fitter' }[role];
  stmts.push(db.prepare(
    "INSERT INTO employees (emp_id, full_name, position, supervisor, email, role_override, active, updated_at, hire_date, start_date) VALUES ('DEMO', ?, ?, ?, ?, ?, 1, ?, '2024-01-01', '2024-01-01')")
    .bind('Bạn (Demo)', myPos, role === 'staff' ? 'Trần Thị Bình' : '', String(me.email || '').toLowerCase(), role === 'staff' ? 'staff' : role, stamp));
  DEMO_PROJECTS.forEach((p) => stmts.push(db.prepare(
    'INSERT INTO projects (wbs, project_name, project_number, product_line, customer, supervisor, extra, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(p.wbs, p.name, p.no, p.line, p.customer, p.sup, JSON.stringify({ specs: p.specs }), stamp)));
  await db.batch(stmts);

  const st = STAFF.map(([w, e, r]) => db.prepare('INSERT INTO project_staff (wbs, emp_id, role) VALUES (?, ?, ?)').bind(w, e, r));
  // người đang thử cũng được gán Site Sup / QLDA cho các dự án để thấy luồng duyệt
  if (role === 'sitesup' || role === 'pm') DEMO_PROJECTS.forEach((p) => st.push(db.prepare('INSERT OR IGNORE INTO project_staff (wbs, emp_id, role) VALUES (?, ?, ?)').bind(p.wbs, 'DEMO', role)));
  await db.batch(st);

  // ----- bảng công "Theo dõi giờ công" (dữ liệu nạp từ Excel): 5 fitter, 30 ngày gần nhất -----
  const fitters = DEMO_EMPLOYEES.filter((e) => e.pos === 'Fitter');
  const rows = [];
  for (let d = 0; d < 30; d++) {
    const day = addDays(today, -d), wd = day.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    fitters.forEach((f, i) => {
      const p = DEMO_PROJECTS[(i + d) % DEMO_PROJECTS.length];
      const ot = (i + d) % 4 === 0 ? 2 : 0;
      rows.push([f.id, iso(day), p.wbs, JSON.stringify({
        source: 'import', empId: f.id, empName: f.name, date: iso(day), timeFrom: '08:00', timeTo: ot ? '19:00' : '17:00',
        normal: 8, ot1: ot, ot2: 0, ot3: 0, ot4: 0, ot5: 0, ot6: 0, ot7: 0, total: 8 + ot, activities: '1110',
        projectNameFree: p.name, wbs: p.wbs, category: 'INS', isFitter: true, isSiteSup: false,
      })]);
    });
  }
  for (let i = 0; i < rows.length; i += 20) {
    const c = rows.slice(i, i + 20);
    await db.prepare(`INSERT INTO timesheets (batch, emp_id, date, wbs, data) VALUES ${c.map(() => '(1, ?, ?, ?, ?)').join(', ')}`).bind(...c.flat()).run();
  }
  await db.prepare('INSERT INTO kv_store (key, version, data, saved_at, saved_by) VALUES (?, 1, ?, ?, ?)')
    .bind('timesheets_meta', JSON.stringify({ active: 1, next: 2, dataVersion: 1, count: rows.length, updatedAt: stamp, updatedBy: 'Demo' }), stamp, 'demo').run();

  // ----- bảng công cá nhân của kỳ vừa qua: một bản chờ Site Sup duyệt, một bản chờ QLDA, một bản nháp -----
  const per = prevPeriod(periodOf(today));
  const start = periodStart(per);
  const docFor = (wbs, name, n0) => {
    const entries = [];
    let n = n0;
    for (let d = 0; d < 31; d++) {
      const day = addDays(start, d), wd = day.getUTCDay();
      if (periodOf(day) !== per) break;
      if (wd === 0) continue;
      n++;
      // T2–T6 08:00–17:00 (8 giờ thường), cứ 4 ngày có 1 ngày tăng ca đến 19:00 (OT1 2 giờ); T7 làm sáng
      entries.push(tsEntry(n, iso(day), wbs, name, '08:00', wd === 6 ? '12:00' : (n % 4 === 0 ? '19:00' : '17:00'), wd === 6 ? 0 : 1));
    }
    return entries;
  };
  const docs = [
    ['D101', 'DEMO-001', 'submitted'], ['D102', 'DEMO-002', 'sitesup_ok'], ['D103', 'DEMO-001', 'draft'],
  ];
  let k = 0;
  for (const [emp, wbs, status] of docs) {
    const proj = DEMO_PROJECTS.find((p) => p.wbs === wbs);
    const entries = docFor(wbs, proj.name, (++k) * 1000);
    const data = JSON.stringify({ entries, deleted: {} });
    await db.prepare(
      "INSERT INTO ts_docs (emp_id, period, version, status, data, entry_count, saved_at, saved_by, submitted_at, sitesup_by, sitesup_at) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(emp, per, status, data, entries.length, stamp, 'demo', status === 'draft' ? '' : stamp, status === 'sitesup_ok' ? 'Trần Thị Bình' : '', status === 'sitesup_ok' ? stamp : '').run();
    if (status !== 'draft') await db.prepare('INSERT INTO ts_doc_wbs (emp_id, period, wbs) VALUES (?, ?, ?)').bind(emp, per, wbs).run();
  }
  return { employees: DEMO_EMPLOYEES.length + 1, projects: DEMO_PROJECTS.length, timesheets: rows.length, docs: docs.length, period: per };
}
