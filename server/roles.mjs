// Vai trò theo chức danh — CÙNG quy tắc với js/session.js (ROLE_RULES), để máy chủ và giao diện
// hiểu giống nhau. Admin chỉnh tay được (employees.role_override) và có danh sách email admin
// khởi tạo (biến ADMIN_EMAILS) để đăng nhập lần đầu khi chưa có nhân viên nào gắn email.

export const ROLE_RULES = {
  pm: /project ?manager|quan ly du an/,
  sitesup: /superv|site ?sup|project ?engineer|giam sat/,
};

// bỏ dấu, chữ thường, gom khoảng trắng
export function plain(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

export function rolesFromPosition(position) {
  const pos = plain(position);
  return Object.keys(ROLE_RULES).filter(r => ROLE_RULES[r].test(pos));
}

export function adminEmails(env) {
  return String((env && env.ADMIN_EMAILS) || '')
    .split(/[\s,;]+/).map(e => e.trim().toLowerCase()).filter(Boolean);
}

// emp: dòng employees (có thể null). Trả về danh sách vai trò, 'admin' đứng đầu nếu có.
// Một người có thể kiêm nhiều vai trò: vai trò chính (chỉnh tay role_override hoặc theo chức danh) + vai trò kiêm nhiệm
// (employees.extra_role = danh sách cách nhau bởi dấu phẩy, vd "admin,projadmin"). Kết quả là hợp của hai nhóm.
export const ALL_ROLES = ['admin', 'projadmin', 'pm', 'sitesup'];
export function parseExtraRoles(s) {
  return [...new Set(String(s || '').split(',').map(x => x.trim()).filter(r => ALL_ROLES.includes(r)))];
}
export function effectiveRoles(emp, email, env) {
  const isBootAdmin = adminEmails(env).includes(String(email || '').toLowerCase());
  if (!emp) return isBootAdmin ? ['admin'] : [];
  const base = emp.role_override === 'staff' ? [] : emp.role_override ? [emp.role_override] : rolesFromPosition(emp.position);
  const all = new Set([...base, ...parseExtraRoles(emp.extra_role)]);
  if (isBootAdmin) all.add('admin');
  return ALL_ROLES.filter(r => all.has(r));      // admin đứng đầu
}
