// Đọc dữ liệu nhân viên (EE Data) từ file Excel THEO TÊN CỘT TIÊU ĐỀ — thứ tự cột trong file không quan trọng.
// Dùng cho: file HRMS của HR ("HRMS EE DATA …", 29 cột, không có Username / DOB), sheet EE DATA trong "Data v1.xlsx"
// và file EE do chính app xuất ra. File không nhận diện được tiêu đề → đọc theo vị trí cột như cách cũ (file Data v1 cũ).
//   EEMap.mapEmployees(rows)  rows = mảng các dòng (sheet_to_json header:1)
//   → { employees: [...], mode: 'header' | 'legacy', columns: { field: 'Tên cột trong file' }, missing: [field], headerRow }
(function (root) {
  'use strict';

  // khử dấu, viết thường, gộp khoảng trắng — so khớp tiêu đề không phụ thuộc cách viết
  const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[_\-./()]+/g, ' ').replace(/\s+/g, ' ').trim();

  // tên cột chấp nhận cho từng trường, ƯU TIÊN theo thứ tự (khớp nguyên văn sau khi chuẩn hoá).
  // Lưu ý file HR có cả "Position Title" (chức danh) và "Position" (mã vị trí, số) → chức danh lấy "Position Title" trước.
  const FIELDS = {
    empId: ['user employee id', 'employee id', 'emp id', 'empid', 'employee no', 'employee number', 'ma nv', 'ma nhan vien', 'ma so nhan vien'],
    personId: ['person id', 'personid'],
    firstName: ['first name', 'firstname', 'ten'],
    lastName: ['last name', 'lastname', 'ho'],
    fullName: ['full name in vietnamese', 'full name vn', 'full name vietnamese', 'ho va ten', 'ho ten', 'ten day du', 'full name', 'name'],
    username: ['username', 'user name'],
    dob: ['dob', 'date of birth', 'birth date', 'ngay sinh'],
    gender: ['gender', 'gioi tinh'],
    hireDate: ['employment details hire date', 'hire date', 'ngay vao lam', 'ngay vao cong ty'],
    groupStartDate: ['employment details group start date', 'group start date'],
    startDate: ['employment details seniority start date', 'seniority start date', 'ngay bat dau', 'start date'],
    position: ['position title', 'job title', 'chuc danh', 'chuc vu', 'position'],
    supervisor: ['supervisor', 'quan ly truc tiep', 'line manager', 'manager'],
    department: ['department name org unit', 'department name', 'phong ban'],
    status: ['employee status', 'trang thai'],
  };
  // cột BẮT BUỘC (thiếu là báo lỗi, không nhập lệch); cột QUAN TRỌNG (thiếu thì cảnh báo)
  const REQUIRED = ['empId'];
  const IMPORTANT = ['position', 'supervisor', 'hireDate'];

  // số ngày của Excel (vd 46245) / chuỗi ngày → 'YYYY-MM-DD'; giá trị khác giữ nguyên dạng chữ
  function toDate(v) {
    if (v === undefined || v === null || v === '') return '';
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
    const s = String(v).trim();
    if (/^\d{5}(\.\d+)?$/.test(s) && +s > 20000 && +s < 80000) return toDate(+s);
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);       // dd/mm/yyyy hoặc dd.mm.yyyy
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return s;
  }
  const txt = (v) => (v === undefined || v === null) ? '' : String(v).trim();
  const idTxt = (v) => (typeof v === 'number' && Number.isInteger(v)) ? String(v) : txt(v);

  // tìm dòng tiêu đề trong 10 dòng đầu: dòng có cột mã NV + ít nhất 2 cột đã biết khác
  function locate(rows) {
    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      const heads = (rows[r] || []).map(norm);
      const cols = {};
      for (const [field, names] of Object.entries(FIELDS)) {
        for (const n of names) { const i = heads.indexOf(n); if (i >= 0 && !Object.values(cols).includes(i)) { cols[field] = i; break; } }
      }
      const known = Object.keys(cols).length;
      if (cols.empId !== undefined && known >= 3) return { headerRow: r, cols };
    }
    return null;
  }

  function mapEmployees(rows) {
    rows = rows || [];
    const found = locate(rows);
    if (!found) return legacy(rows);
    const { headerRow, cols } = found;
    const head = rows[headerRow];
    const get = (r, f) => cols[f] === undefined ? '' : r[cols[f]];
    const employees = [];
    for (const r of rows.slice(headerRow + 1)) {
      const empId = idTxt(get(r, 'empId'));
      if (!empId) continue;
      const first = txt(get(r, 'firstName')), last = txt(get(r, 'lastName'));
      // tên tiếng Việt; thiếu thì ghép Họ (Last) + Tên (First) như cách viết tiếng Việt
      const fullName = txt(get(r, 'fullName')) || [last, first].filter(Boolean).join(' ');
      employees.push({
        empId,
        personId: idTxt(get(r, 'personId')),
        fullName,
        username: txt(get(r, 'username')),
        dob: toDate(get(r, 'dob')),
        gender: txt(get(r, 'gender')),
        hireDate: toDate(get(r, 'hireDate')),
        startDate: toDate(get(r, 'startDate')) || toDate(get(r, 'groupStartDate')),
        position: txt(get(r, 'position')),
        supervisor: txt(get(r, 'supervisor')),
        department: txt(get(r, 'department')),
        status: txt(get(r, 'status')),
      });
    }
    const columns = {};
    for (const [f, i] of Object.entries(cols)) columns[f] = txt(head[i]);
    const missing = [...REQUIRED, ...IMPORTANT].filter(f => cols[f] === undefined);
    if (cols.fullName === undefined && cols.firstName === undefined && cols.lastName === undefined) missing.unshift('fullName');
    return { employees, mode: 'header', columns, missing, headerRow };
  }

  // cách cũ: cột cố định của sheet EE DATA trong "Data v1.xlsx"
  // 0 EmpID, 1 PersonId, 2 First, 3 Last, 4 FullNameVN, 5 Username, 6 DOB, 7 Gender, 8 HireDate, 9 GroupStart, 10 Seniority, 11 Position, 12 Supervisor
  function legacy(rows) {
    const employees = rows.slice(1).filter(r => r[0] !== undefined && r[0] !== '').map(r => ({
      empId: idTxt(r[0]),
      personId: r[1] !== undefined ? idTxt(r[1]) : '',
      fullName: txt(r[4]) || `${txt(r[2])} ${txt(r[3])}`.trim(),
      username: txt(r[5]),
      dob: r[6] !== undefined ? String(r[6]) : '',
      gender: txt(r[7]),
      hireDate: r[8] !== undefined ? String(r[8]) : '',
      startDate: r[10] !== undefined ? String(r[10]) : '',
      position: txt(r[11]),
      supervisor: txt(r[12]),
    }));
    return { employees, mode: 'legacy', columns: {}, missing: [], headerRow: 0 };
  }

  const LABELS = { empId: 'Mã NV', fullName: 'Họ tên', position: 'Chức danh', supervisor: 'Quản lý trực tiếp', hireDate: 'Ngày vào làm' };
  const api = { mapEmployees, toDate, norm, FIELDS, LABELS };
  root.EEMap = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
