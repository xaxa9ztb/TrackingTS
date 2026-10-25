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
export function effectiveRoles(emp, email, env) {
  const isBootAdmin = adminEmails(env).includes(String(email || '').toLowerCase());
  if (isBootAdmin || (emp && emp.role_override === 'admin')) return ['admin'];
  if (!emp) return [];
  if (emp.role_override === 'staff') return [];
  if (emp.role_override) return [emp.role_override];
  return rolesFromPosition(emp.position);
}
