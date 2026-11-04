// Kiểm thử đọc EE Data theo TÊN CỘT (js/eemap.js): file HRMS của HR, mẫu EE DATA cũ, file app xuất ra — không lệch cột.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../../js/eemap.js');

// bố cục file HRMS (29 cột, không có Username / DOB) — dữ liệu giả
const HR_HEAD = ['User/Employee ID', 'Person Id', 'First Name', 'Last Name', 'Full name in Vietnamese', 'Gender', 'Employment Details Hire Date',
  'Employment Details Group Start Date', 'Employment Details Seniority Start Date', 'Position Title', 'Supervisor', 'Department Name (Org Unit)',
  'Department', 'Personnel Area', 'Personnel SubArea', 'Employee Class', 'Employee Sub-Class', 'Business  Email Information Email Address', 'Company',
  'Job Name', 'Job Name Cost type', 'Employee Status', 'Business  Phone Information Phone Number', 'S20', 'Department Code', 'Cost Center', 'Position',
  'Job Name Headcount', 'Learning HRBP  Job Relationships Name'];
const hrRow = (o) => HR_HEAD.map(h => (h in o ? o[h] : ''));

test('file HRMS: đọc đúng theo tên cột dù thứ tự khác mẫu cũ', () => {
  const rows = [HR_HEAD,
    hrRow({ 'User/Employee ID': 100001, 'Person Id': 200001, 'First Name': 'Van An', 'Last Name': 'Nguyen', 'Full name in Vietnamese': 'Nguyễn Văn An', Gender: 'Male',
      'Employment Details Hire Date': 45940, 'Employment Details Seniority Start Date': 45941, 'Position Title': 'EI Technician', Supervisor: 'Tran, Binh',
      'Department Name (Org Unit)': 'NI Team', Department: '12345678-NI', 'Employee Status': 'Active', Position: '50001234' }),
    hrRow({ 'User/Employee ID': 100002, 'First Name': 'Thi Hoa', 'Last Name': 'Le', 'Position Title': 'Site Supervisor', Supervisor: 'Pham, Dung',
      'Employment Details Hire Date': '15/03/2016', 'Employment Details Group Start Date': 42444, 'Employee Status': 'Dormant' }),
    hrRow({}),   // dòng trống bị bỏ qua
  ];
  const r = E.mapEmployees(rows);
  assert.equal(r.mode, 'header');
  assert.deepEqual(r.missing, []);
  assert.equal(r.employees.length, 2);
  const [a, b] = r.employees;
  assert.equal(a.empId, '100001');
  assert.equal(a.fullName, 'Nguyễn Văn An');
  assert.equal(a.position, 'EI Technician', 'chức danh lấy "Position Title", không lấy mã "Position"');
  assert.equal(a.supervisor, 'Tran, Binh');
  assert.equal(a.hireDate, '2025-10-10');
  assert.equal(a.startDate, '2025-10-11');
  assert.equal(a.gender, 'Male');
  assert.equal(a.department, 'NI Team');
  // thiếu tên tiếng Việt → Họ (Last) + Tên (First); ngày dạng dd/mm/yyyy; thiếu Seniority → Group Start
  assert.equal(b.fullName, 'Le Thi Hoa');
  assert.equal(b.hireDate, '2016-03-15');
  assert.equal(b.startDate, '2016-03-15');
  assert.equal(b.status, 'Dormant');
  assert.equal(r.columns.position, 'Position Title');
});

test('tiêu đề không nằm ở dòng đầu, có dấu tiếng Việt, thứ tự lộn xộn', () => {
  const rows = [['DANH SÁCH NHÂN VIÊN'], [], ['Chức danh', 'Họ và tên', 'Mã NV', 'Quản lý trực tiếp', 'Ngày vào làm'],
    ['Fitter', 'Phạm Minh Dũng', 'D101', 'Trần Thị Bình', '2026-01-05']];
  const r = E.mapEmployees(rows);
  assert.equal(r.mode, 'header');
  assert.equal(r.headerRow, 2);
  assert.deepEqual(r.employees[0], { empId: 'D101', personId: '', fullName: 'Phạm Minh Dũng', username: '', dob: '', gender: '', hireDate: '2026-01-05',
    startDate: '', position: 'Fitter', supervisor: 'Trần Thị Bình', department: '', status: '' });
});

test('thiếu cột quan trọng → báo trong missing (không đọc lệch sang cột khác)', () => {
  const r = E.mapEmployees([['Employee ID', 'Full Name', 'Gender'], ['E1', 'A B', 'Nữ']]);
  assert.equal(r.mode, 'header');
  assert.deepEqual(r.missing, ['position', 'supervisor', 'hireDate']);
  assert.equal(r.employees[0].position, '');
});

test('file EE do app xuất ra (Position Title, Seniority Start Date) đọc lại đúng', () => {
  const r = E.mapEmployees([['Employee ID', 'Person Id', 'Full Name', 'Username', 'DOB', 'Gender', 'Hire Date', 'Seniority Start Date', 'Position Title', 'Supervisor'],
    ['E9', 'P9', 'Võ Văn Chín', 'vvc', '1990-02-03', 'Nam', '2020-05-06', '2020-05-07', 'Fitter', 'Trần Thị Bình']]);
  const e = r.employees[0];
  assert.equal(e.position, 'Fitter');
  assert.equal(e.supervisor, 'Trần Thị Bình');
  assert.equal(e.dob, '1990-02-03');
  assert.equal(e.startDate, '2020-05-07');
});

test('mẫu EE DATA cũ không có tiêu đề nhận diện được → đọc theo vị trí như trước', () => {
  const row = ['F01', 'P1', 'An', 'Nguyen', 'Nguyễn Văn An', 'nvan', '1990-01-01', 'Nam', '45000', '', '45001', 'Fitter', 'Trần Giám Sát'];
  const r = E.mapEmployees([['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11', 'c12'], row]);
  assert.equal(r.mode, 'legacy');
  assert.equal(r.employees[0].position, 'Fitter');
  assert.equal(r.employees[0].supervisor, 'Trần Giám Sát');
  assert.equal(r.employees[0].fullName, 'Nguyễn Văn An');
});
