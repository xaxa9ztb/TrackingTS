/* FILE ĐƯỢC SINH TỰ ĐỘNG từ src/app.jsx bằng `npm run build` — đừng sửa trực tiếp. */
const {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef
} = React;

// --- ICONS ---
const Icons = {
  Settings: () => /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
  })),
  Download: () => /*#__PURE__*/React.createElement("svg", {
    width: "24",
    height: "24",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "7 10 12 15 17 10"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "15",
    x2: "12",
    y2: "3"
  })),
  Plus: () => /*#__PURE__*/React.createElement("svg", {
    width: "24",
    height: "24",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "5",
    x2: "12",
    y2: "19"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "5",
    y1: "12",
    x2: "19",
    y2: "12"
  })),
  Trash: () => /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "3 6 5 6 21 6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
  })),
  Edit: () => /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
  })),
  Cloud: () => /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"
  })),
  Refresh: () => /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M23 4v6h-6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M1 20v-6h6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
  })),
  Upload: () => /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "17 8 12 3 7 8"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "3",
    x2: "12",
    y2: "15"
  })),
  Database: () => /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("ellipse", {
    cx: "12",
    cy: "5",
    rx: "9",
    ry: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"
  })),
  Calendar: () => /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "4.5",
    width: "18",
    height: "16.5",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 9.5h18M8 2.5v4M16 2.5v4"
  })),
  ChevronLeft: () => /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "15 18 9 12 15 6"
  })),
  ChevronRight: () => /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "9 18 15 12 9 6"
  })),
  X: () => /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "18",
    y1: "6",
    x2: "6",
    y2: "18"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "6",
    y1: "6",
    x2: "18",
    y2: "18"
  })),
  Chart: () => /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M3 3v18h18"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "7",
    y: "12",
    width: "3",
    height: "6",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "12",
    y: "8",
    width: "3",
    height: "10",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "17",
    y: "5",
    width: "3",
    height: "13",
    rx: "1"
  })),
  Alert: () => /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "8",
    x2: "12",
    y2: "12"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "16",
    x2: "12.01",
    y2: "16"
  }))
};

// --- DATA CONFIG ---
// Loại giờ = cột G, I..O của mẫu bảng chấm công; tỷ lệ theo Điều 98 BLLĐ 2019 + Điều 57 NĐ 145/2020 (xem labor.js)
const OT_TYPES = [{
  code: 'NORMAL',
  label: 'Giờ công thường',
  short: 'Giờ thường'
}, {
  code: 'OT1',
  label: 'OT1 — Ngày thường, ban ngày (150%)',
  short: 'OT1 · 150%'
}, {
  code: 'OT2',
  label: 'OT2 — Ngày nghỉ hằng tuần, ban ngày (200%)',
  short: 'OT2 · 200%'
}, {
  code: 'OT3',
  label: 'OT3 — Ngày lễ, Tết, ban ngày (300%)',
  short: 'OT3 · 300%'
}, {
  code: 'OT4',
  label: 'OT4 — Đêm ngày thường (200%)',
  short: 'OT4 · 200%'
}, {
  code: 'OT5',
  label: 'OT5 — Đêm ngày nghỉ hằng tuần (270%)',
  short: 'OT5 · 270%'
}, {
  code: 'OT6',
  label: 'OT6 — Đêm ngày lễ, Tết (390%)',
  short: 'OT6 · 390%'
}, {
  code: 'OT7',
  label: 'OT7 — Đêm ngày thường, đã làm thêm 17:00–22:00 (210%)',
  short: 'OT7 · 210%'
}];

// Ngày nghỉ lễ, Tết tự tính theo Bộ luật Lao động (âm lịch, nghỉ bù, 24/11 từ 2026) — xem labor.js.
// `sch` = lịch làm việc của người dùng (quyết định ngày nghỉ hằng tuần → ngày nghỉ bù).
const holidayOf = (dateStr, sch) => dateStr ? LaborVN.holidayInfo(dateStr, sch) : null;
const isVietnameseHoliday = (dateStr, sch) => !!holidayOf(dateStr, sch);
const HR_WORK_NUMBERS = ['PAID LEAVE', 'UNPAID LEAVE', 'TRAINING-NI', 'TRAINING-EI', 'MEETINGS'];

// Activities aligned 1:1 with the official Schindler timesheet template columns U..AX (21..50).
// `col` = Excel column index where the "x" mark goes when this activity is selected.
const ACTIVITY_META = [{
  id: '100',
  code: '100',
  cat: 'NI',
  col: 21,
  desc: '100 - Travel (thời gian đi đường đến công trình tỉnh)'
}, {
  id: '1193',
  code: '1193',
  cat: 'NI',
  col: 22,
  desc: '1193 - NI Quality hour ( pre-work)'
}, {
  id: '1110',
  code: '1110',
  cat: 'NI',
  col: 23,
  desc: '1110 - NI Prod. Hours Fitter (thời gian lắp đặt)'
}, {
  id: '1731',
  code: '1731',
  cat: 'NI',
  col: 24,
  desc: '1731 - T&C (Thời gian thử nghiệm và vận hành)'
}, {
  id: '1194',
  code: '1194',
  cat: 'NI',
  col: 25,
  desc: '1194 - NI Quality Hour ( open item) (Thời gian sửa lỗi và các hạng mục dỡ dang)'
}, {
  id: '1720',
  code: '1720',
  cat: 'NI',
  col: 26,
  desc: '1720 - NI Inspection (NI/EI handover) - Kiểm tra công trường'
}, {
  id: '1900',
  code: '1900',
  cat: 'Other',
  col: 27,
  desc: '1900 - Customer Legal Audit'
}, {
  id: '1191',
  code: '1191',
  cat: 'NI',
  col: 28,
  desc: '1191 - Temporary Maintenance (trực Bảo trì tạm thời trước khi bàn giao EI)'
}, {
  id: '1192-0',
  code: '1192-0',
  cat: 'NI',
  col: 29,
  desc: '1192-0 - NI Quality hours-logistics'
}, {
  id: '1192-1',
  code: '1192-1',
  cat: 'NI',
  col: 30,
  desc: '1192-1 - NI Quality hours-Material / FI / LPCA / Site Cause'
}, {
  id: '1393',
  code: '1393',
  cat: 'MOD',
  col: 31,
  desc: '1393 - MOD Quality hour ( Pre-work)'
}, {
  id: '1394',
  code: '1394',
  cat: 'MOD',
  col: 32,
  desc: '1394 - MOD Quality Hour ( open item)'
}, {
  id: '1310',
  code: '1310',
  cat: 'MOD',
  col: 33,
  desc: '1310 - MOD Prod. Hours Fitter'
}, {
  id: '1392-0',
  code: '1392-0',
  cat: 'MOD',
  col: 34,
  desc: '1392-0 - MOD Quality hours - Logistics'
}, {
  id: '1400',
  code: '1400',
  cat: 'EI',
  col: 35,
  desc: '1400 - Maintenance (Bảo trì)'
}, {
  id: '1500',
  code: '1500',
  cat: 'EI',
  col: 36,
  desc: '1500 - Call back'
}, {
  id: '1600',
  code: '1600',
  cat: 'EI',
  col: 37,
  desc: '1600 - Repair'
}, {
  id: '1710',
  code: '1710',
  cat: 'TF',
  col: 38,
  desc: '1710 - SAIS Acceptance Test'
}, {
  id: '1715',
  code: '1715',
  cat: 'TF',
  col: 39,
  desc: '1715 - SAIS Re-Inspection'
}, {
  id: '1725',
  code: '1725',
  cat: 'TF',
  col: 40,
  desc: '1725 - CPSI'
}, {
  id: '1700',
  code: '1700',
  cat: 'SAF',
  col: 41,
  desc: '1700 - Safety'
}, {
  id: '5010',
  code: '5010',
  cat: 'HR',
  col: 42,
  desc: '5010 - Meetings (Họp)'
}, {
  id: '5021',
  code: '5021',
  cat: 'HR',
  col: 43,
  desc: '5021 - Training-Classroom (Huấn luyện - trong lớp)'
}, {
  id: '5022',
  code: '5022',
  cat: 'HR',
  col: 44,
  desc: '5022 - Training-On the job (Huấn luyện tại công trường)'
}, {
  id: '5040',
  code: '5040',
  cat: 'HR',
  col: 45,
  desc: '5040 - Other Administrative Task (nhiệm vụ khác không thuộc công trình)'
}, {
  id: '5060',
  code: '5060',
  cat: 'HR',
  col: 46,
  desc: '5060 - Safety / Tools Box Meeting (Họp giao ban an toàn)'
}, {
  id: '5090',
  code: '5090',
  cat: 'NI',
  col: 47,
  desc: '5090/ ES1 (NI) Supervisor, Safety, Travelling time'
}, {
  id: '6010',
  code: '6010',
  cat: 'HR',
  col: 48,
  desc: '6010/1 - Holiday / Public Holiday / Annual Leave day/hr (Nghỉ hưởng lương)'
}, {
  id: '6020',
  code: '6020',
  cat: 'HR',
  col: 49,
  desc: '6020 - Illness (day) / Medical / Accident (nghỉ ốm, nghỉ tai nạn)'
}, {
  id: '6090',
  code: '6090',
  cat: 'HR',
  col: 50,
  desc: '6090 - Unpaid leave (Nghỉ không hưởng lương)'
}];

// OT type -> Excel column index (I..O = 9..15) in the template
const OT_COL = {
  OT1: 9,
  OT2: 10,
  OT3: 11,
  OT4: 12,
  OT5: 13,
  OT6: 14,
  OT7: 15
};
// Resolve an entry's activity code to a template column (handles legacy ids like plain '1192'/'1392')
const activityToCol = code => {
  const hit = ACTIVITY_META.find(a => a.id === code || a.code === code);
  if (hit) return hit.col;
  if (code === '1192') return 29;
  if (code === '1392') return 34;
  return null;
};

// --- FIXED FUNCTION: MANUAL DATE STRING CONSTRUCTION ---
const toLocalISOString = date => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Today's date in the user's local timezone (avoids UTC off-by-one at night/morning)
const getTodayLocal = () => toLocalISOString(new Date());

// Add n days to a YYYY-MM-DD string, staying in local time (TZ-safe)
const addDaysLocal = (dateStr, n) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return toLocalISOString(new Date(y, m - 1, d + n));
};

// Danh sách Dự án lấy CHUNG với "Thống kê giờ công dự án": đọc kho dữ liệu trên máy
// (IndexedDB do js/db.js quản lý, được làm mới từ Google Drive). WBS = Work Number.
const loadSharedProjects = async () => {
  if (typeof DB === 'undefined') return [];
  const rows = await DB.getAll('projects').catch(() => []);
  return rows.map(p => ({
    workNumber: String(p.wbs == null ? '' : p.wbs).trim(),
    projectName: String(p.projectName == null ? '' : p.projectName).trim()
  })).filter(p => p.workNumber && p.projectName).sort((a, b) => a.projectName.localeCompare(b.projectName, 'vi'));
};

// ExcelJS (~1 MB) và mẫu bảng chấm công chỉ cần khi XUẤT EXCEL → tải lúc đó
// để mở Timesheet nhanh hơn (đã cài sẵn cho chế độ ngoại tuyến trong sw.js).
const EXCELJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
const loadScript = src => new Promise((resolve, reject) => {
  const s = document.createElement('script');
  s.src = src;
  s.onload = resolve;
  s.onerror = () => reject(new Error('không tải được thư viện Excel'));
  document.head.appendChild(s);
});
let excelJsLoading = null;
const ensureExcelJS = () => {
  if (window.ExcelJS) return Promise.resolve();
  excelJsLoading = excelJsLoading || loadScript(EXCELJS_URL).catch(e => {
    excelJsLoading = null;
    throw e;
  });
  return excelJsLoading;
};
// Mẫu bảng chấm công chính thức (Schindler, .xlsx trắng) nằm cạnh trang: ts-template.xlsx
const getTemplateBuffer = async () => {
  const res = await fetch('ts-template.xlsx');
  if (!res.ok) throw new Error('không tải được mẫu bảng chấm công (HTTP ' + res.status + ')');
  return res.arrayBuffer();
};
const cloneStyle = s => s ? JSON.parse(JSON.stringify(s)) : {};
// Ngày ghi vào Excel PHẢI tạo theo UTC: ExcelJS đổi Date sang số ngày Excel theo giờ UTC.
// new Date(y, m-1, d) là 0 giờ GIỜ MÁY — ở Việt Nam (UTC+7) = 17 giờ hôm TRƯỚC theo UTC → Excel lùi 1 ngày
// (cả cột Thứ / giờ công thường theo ngày cũng sai theo).
const excelDate = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
// Column G "Normal Hour" formula from the template (references $E$9=08:00, $F$9=17:00)
const normalHourFormula = r => `IF(D${r}=1,0,IF(AND(E${r}<$E$9,F${r}>$F$9),9-H${r},IF(OR(AND(E${r}<$E$9,F${r}<$E$9),AND(E${r}>$F$9,F${r}>$F$9)),0,IF(AND(E${r}>=$E$9,F${r}<=$F$9),(F${r}-E${r})*24-H${r},IF(AND(F${r}>$F$9,E${r}>=$E$9),($F$9-E${r})*24-H${r},IF(AND(E${r}<$E$9,F${r}<=$F$9),(F${r}-$E$9)*24-H${r}))))))`;
const getSalaryPeriod = monthStr => {
  if (!monthStr) return {
    start: '',
    end: '',
    label: ''
  };
  const [year, month] = monthStr.split('-').map(Number);

  // Salary Period: 16th Prev Month -> 15th Current Month
  // Use local dates, avoid UTC conversion
  const startDate = new Date(year, month - 2, 16);
  const endDate = new Date(year, month - 1, 15);
  const startDateStr = toLocalISOString(startDate); // FIXED
  const endDateStr = toLocalISOString(endDate); // FIXED

  const formatDate = d => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  return {
    start: startDateStr,
    end: endDateStr,
    label: `${formatDate(startDate)} - ${formatDate(endDate)}`
  };
};
const timeToExcel = timeStr => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h + m / 60) / 24;
};
const calculateHours = (start, end, breakTime) => {
  if (!start || !end) return 0;
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  let diff = h2 + m2 / 60 - (h1 + m1 / 60);
  if (diff < 0) diff += 24;
  return Math.max(0, diff - (parseFloat(breakTime) || 0));
};
const formatMonthVietnamese = yyyy_mm => {
  if (!yyyy_mm) return "";
  const [y, m] = yyyy_mm.split('-');
  return `Tháng ${parseInt(m)}`;
};
const normalizeString = str => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const removeAccents = str => normalizeString(str).replace(/\s+/g, '_');
// ================================================================
//   GIAO DIỆN (responsive: điện thoại · tablet · máy tính)
// ================================================================
const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const WEEKDAYS_LONG = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const parseLocal = s => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const weekdayOf = s => parseLocal(s).getDay();
const fmtDM = s => {
  const [, m, d] = s.split('-');
  return `${d}/${m}`;
};
const fmtDMY = s => s.split('-').reverse().join('/');
const fmtH = h => (Math.round(h * 10) / 10).toLocaleString('vi-VN', {
  maximumFractionDigits: 1
});
const entryHours = e => calculateHours(e.startTime, e.endTime, e.breakTime);
const otLabel = code => (OT_TYPES.find(t => t.code === code) || {}).label || code;
const otShort = code => (OT_TYPES.find(t => t.code === code) || {}).short || code;
const scheduleOf = profile => profile && LaborVN.SCHEDULES[profile.schedule] ? profile.schedule : LaborVN.DEFAULT_SCHEDULE;
// Giờ công từng loại của mỗi dòng: dòng "tự động" chia theo luật, dòng cũ / chọn tay giữ loại đã chọn
const breakdownsOf = (entries, sch) => LaborVN.breakdownAll(entries, sch, entryHours);
const sumBd = bd => Object.values(bd || {}).reduce((a, b) => a + b, 0);
// Kỳ lương tháng M = 16/(M-1) → 15/M, nên từ ngày 16 trở đi thuộc kỳ của tháng sau
const periodMonthOf = dateStr => {
  const d = parseLocal(dateStr);
  if (d.getDate() >= 16) d.setMonth(d.getMonth() + 1, 1);
  return toLocalISOString(d).slice(0, 7);
};
const shiftMonth = (ym, n) => {
  const [y, m] = ym.split('-').map(Number);
  return toLocalISOString(new Date(y, m - 1 + n, 1)).slice(0, 7);
};
const daysBetween = (start, end) => {
  const out = [];
  for (let d = start; d <= end; d = addDaysLocal(d, 1)) out.push(d);
  return out;
};
// ngày phải chấm công: T2–T6 (thêm T7 nếu làm cả T7), trừ ngày lễ / nghỉ bù
const isWorkday = (s, sch) => {
  const w = weekdayOf(s);
  return w >= 1 && (w <= 5 || w === 6 && sch === 'mon-sat') && !isVietnameseHoliday(s, sch);
};
const finePointer = () => !!(window.matchMedia && matchMedia('(pointer: fine)').matches);
const DEFAULT_PROFILE = {
  name: '',
  empId: '',
  position: '',
  dept: 'NI',
  sheetId: '1OuwcTThIkpC_871JIv_D5fd29-jPsoqwsyP55AFAd_I'
};
const inputCls = 'w-full h-11 rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:bg-slate-50';
const btnGhost = 'inline-flex items-center justify-center gap-2 h-10 px-3 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-60';
const btnPrimary = 'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-blue-700 text-white font-semibold hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60';
function App() {
  const [entries, setEntries] = useState([]);
  // Đọc ngay khi mở (không đợi useEffect) để thẻ Thông tin nhân viên hiện đúng từ lần vẽ đầu.
  // Bộ công cụ: điền sẵn họ tên / mã NV / chức vụ từ phiên đăng nhập — chỉ điền ô còn trống.
  const [profile, setProfile] = useState(() => {
    let p = DEFAULT_PROFILE;
    try {
      const saved = localStorage.getItem('ts_profile_v28');
      if (saved) p = JSON.parse(saved);
    } catch (e) {/* bỏ qua */}
    const who = typeof Session !== 'undefined' ? Session.current() : null;
    if (who && !who.admin) p = {
      ...p,
      name: p.name || who.name,
      empId: p.empId || who.empId,
      position: p.position || who.position
    };
    return p;
  });
  const [projects, setProjects] = useState([]);
  // Mặc định mở KỲ LƯƠNG ĐANG DIỄN RA (chứa hôm nay) — chấm công hôm nay hiện ngay trong danh sách
  const [currentMonth, setCurrentMonth] = useState(periodMonthOf(getTodayLocal()));
  const [drawer, setDrawer] = useState(null); // null | {type:'form', entry, date, key} | {type:'settings'}
  const [reportOpen, setReportOpen] = useState(false); // báo cáo tổng quan cho giám sát
  const [dayFilter, setDayFilter] = useState(null);
  const [toast, setToast] = useState(null);
  const [syncStatus, setSyncStatus] = useState('');
  const [projSyncing, setProjSyncing] = useState(false);
  const [projStatus, setProjStatus] = useState(null); // {ok, text} của lần đồng bộ gần nhất
  const [needProjects, setNeedProjects] = useState(false); // máy chưa có danh sách dự án → nhắc (không chặn màn hình)
  // lần tải dữ liệu chung từ Drive gần nhất (trang chủ / Thống kê giờ công / Timesheet đều cập nhật)
  const lastDriveSync = () => typeof Cloud !== 'undefined' && Cloud.getLastSyncedAt ? Cloud.getLastSyncedAt() : '';
  const [projSyncedAt, setProjSyncedAt] = useState(lastDriveSync);
  useEffect(() => {
    const savedEntries = localStorage.getItem('ts_entries_v28');
    const savedProjects = localStorage.getItem('ts_projects_v28');
    if (savedEntries) setEntries(JSON.parse(savedEntries));
    if (savedProjects) setProjects(JSON.parse(savedProjects));
    // Dự án dùng chung: lấy ngay bản trên máy (cùng dữ liệu với Thống kê giờ công);
    // máy chưa có thì tải từ Google Drive; vẫn không có thì hiện lời nhắc trên trang (vẫn chấm công được).
    (async () => {
      const shared = await loadSharedProjects();
      if (shared.length) {
        setProjects(shared);
        return;
      }
      const {
        n
      } = await syncSharedProjects();
      if (!n && !savedProjects) setNeedProjects(true);
    })();
  }, []);
  useEffect(() => {
    localStorage.setItem('ts_entries_v28', JSON.stringify(entries));
  }, [entries]);
  useEffect(() => {
    localStorage.setItem('ts_profile_v28', JSON.stringify(profile));
  }, [profile]);
  useEffect(() => {
    localStorage.setItem('ts_projects_v28', JSON.stringify(projects));
  }, [projects]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  const period = useMemo(() => getSalaryPeriod(currentMonth), [currentMonth]);
  const monthlyEntries = useMemo(() => {
    // IMPORTANT: String comparison works correctly for YYYY-MM-DD
    return entries.filter(e => e.date >= period.start && e.date <= period.end).sort((a, b) => b.date.localeCompare(a.date) || String(a.startTime || '').localeCompare(String(b.startTime || '')));
  }, [entries, period]);
  const sch = scheduleOf(profile);
  // giờ thường / OT từng loại của mọi dòng (tính trên toàn bộ dữ liệu: OT7 cần biết các dòng cùng ngày)
  const bds = useMemo(() => breakdownsOf(entries, sch), [entries, sch]);
  const bdOf = e => bds.get(e.id) || {};
  const dayTotals = useMemo(() => {
    const t = {};
    monthlyEntries.forEach(e => {
      const d = t[e.date] || (t[e.date] = {
        hours: 0,
        ot: false,
        count: 0
      });
      const bd = bdOf(e);
      d.hours += sumBd(bd);
      d.count++;
      if (Object.keys(bd).some(k => k !== 'NORMAL')) d.ot = true;
    });
    return t;
  }, [monthlyEntries, bds]);
  const stats = useMemo(() => {
    let normal = 0,
      ot = 0;
    const byOt = {};
    monthlyEntries.forEach(e => {
      const bd = bdOf(e);
      Object.keys(bd).forEach(k => {
        if (k === 'NORMAL') normal += bd[k];else {
          ot += bd[k];
          byOt[k] = (byOt[k] || 0) + bd[k];
        }
      });
    });
    // ngày làm việc (không phải ngày lễ / nghỉ bù) đã qua trong kỳ mà chưa chấm công
    const today = getTodayLocal();
    const last = period.end < today ? period.end : today;
    const missing = period.start <= last ? daysBetween(period.start, last).filter(d => isWorkday(d, sch) && !dayTotals[d]) : [];
    return {
      normal,
      ot,
      total: normal + ot,
      byOt,
      days: Object.keys(dayTotals).length,
      missing
    };
  }, [monthlyEntries, dayTotals, period, bds, sch]);
  const holidays = useMemo(() => LaborVN.holidaysBetween(period.start, period.end, sch), [period, sch]);
  const visible = dayFilter ? monthlyEntries.filter(e => e.date === dayFilter) : monthlyEntries;

  // Đồng bộ Dự án: tải bản mới nhất từ Google Drive vào kho dùng chung rồi đọc lại.
  // Drive lỗi (mất mạng / hết hạn mức) thì giữ bản đang có trên máy. Trả về {n: số dự án, reason: lỗi}.
  const syncSharedProjects = async () => {
    setProjSyncing(true);
    setProjStatus(null);
    let reason = '';
    try {
      if (typeof Cloud !== 'undefined' && Cloud.configured()) await Cloud.loadFromDrive();
    } catch (err) {
      reason = /QUOTA/.test(err.message) ? 'Google Drive đang giới hạn lượt tải hôm nay' : 'Không tải được từ Google Drive';
    }
    const shared = await loadSharedProjects();
    if (shared.length) setProjects(shared);
    setProjSyncedAt(lastDriveSync());
    setProjSyncing(false);
    setProjStatus({
      ok: !reason && shared.length > 0,
      text: shared.length ? reason ? `${reason} — đang dùng ${shared.length} dự án đã có trên máy.` : `Đã cập nhật ${shared.length} dự án.` : reason ? `${reason}. Vui lòng thử lại sau.` : 'Chưa có dữ liệu Dự án — vui lòng liên hệ quản trị viên.'
    });
    return {
      n: shared.length,
      reason
    };
  };
  const handleSyncProjects = async () => {
    const {
      n,
      reason
    } = await syncSharedProjects();
    if (n && !reason) showToast(`Đã cập nhật ${n} dự án.`);
  };
  const showToast = (message, action) => setToast({
    message,
    action,
    id: Date.now()
  });
  const changeMonth = m => {
    setCurrentMonth(m);
    setDayFilter(null);
  };
  const closeDrawer = () => setDrawer(null);
  const openNewEntry = date => {
    let d = date;
    if (!d) {
      // như trước: ngày kế tiếp ngày chấm công gần nhất (chưa có thì hôm nay)
      d = getTodayLocal();
      if (entries.length > 0) d = addDaysLocal(entries.reduce((a, b) => b.date > a.date ? b : a).date, 1);
    }
    setDrawer({
      type: 'form',
      entry: null,
      date: d,
      key: Date.now()
    });
  };
  const openEdit = entry => setDrawer({
    type: 'form',
    entry,
    date: entry.date,
    key: Date.now()
  });
  const handleSaveEntry = data => {
    const editing = drawer && drawer.entry;
    if (editing) setEntries(prev => prev.map(e => e.id === editing.id ? {
      ...data,
      id: editing.id
    } : e));else setEntries(prev => [...prev, {
      ...data,
      id: Date.now()
    }]);
    setDrawer(null);
    const pm = periodMonthOf(data.date); // ngày thuộc kỳ khác → chuyển sang kỳ đó để thấy ngay
    if (pm !== currentMonth) changeMonth(pm);
    showToast(`${editing ? 'Đã cập nhật' : 'Đã thêm'} chấm công ${fmtDMY(data.date)}.`);
  };
  const handleDelete = entry => {
    setEntries(prev => prev.filter(e => e.id !== entry.id));
    if (drawer && drawer.entry && drawer.entry.id === entry.id) setDrawer(null);
    showToast(`Đã xóa chấm công ${fmtDMY(entry.date)}.`, {
      label: 'Hoàn tác',
      run: () => setEntries(prev => [...prev, entry])
    });
  };
  const handleResetData = () => {
    if (confirm("CẢNH BÁO: Bạn có chắc chắn muốn xóa TOÀN BỘ dữ liệu? Hành động này sẽ xóa sạch lịch sử chấm công và thông tin cá nhân. Không thể hoàn tác!")) {
      if (confirm("Xác nhận lần 2: Xóa tất cả dữ liệu?")) {
        localStorage.removeItem('ts_entries_v28');
        localStorage.removeItem('ts_profile_v28');
        localStorage.removeItem('ts_projects_v28');
        setEntries([]);
        setProfile(DEFAULT_PROFILE);
        setProjects([]);
        setDrawer(null);
        showToast('Đã xóa toàn bộ dữ liệu Timesheet trên máy này.');
      }
    }
  };
  const handleExportExcel = async () => {
    if (monthlyEntries.length === 0) return alert("Chưa có dữ liệu!");
    const sortedData = [...monthlyEntries].sort((a, b) => a.date.localeCompare(b.date));
    setSyncStatus('Đang tạo file...');
    let workbook;
    try {
      await ensureExcelJS();
      workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await getTemplateBuffer());
    } catch (err) {
      setSyncStatus('');
      return alert('Không xuất được Excel: ' + err.message + (navigator.onLine === false ? ' — đang ngoại tuyến, hãy thử lại khi có mạng.' : '.'));
    }
    const sheet = workbook.getWorksheet('New TS') || workbook.worksheets[0];

    // Snapshot template styles BEFORE editing: a data row (11), the total row (59),
    // and the signature block (62-64, captured as offsets from the total row).
    const dataStyle = {},
      totalStyle = {};
    for (let c = 1; c <= 51; c++) {
      dataStyle[c] = cloneStyle(sheet.getRow(11).getCell(c).style);
      totalStyle[c] = cloneStyle(sheet.getRow(59).getCell(c).style);
    }
    const sigCells = [];
    for (let r = 62; r <= 64; r++) {
      for (let c = 1; c <= 51; c++) {
        const cell = sheet.getRow(r).getCell(c);
        const hasTop = cell.border && cell.border.top && cell.border.top.style;
        if (cell.value !== null || hasTop) sigCells.push({
          off: r - 59,
          c,
          value: cell.value,
          style: cloneStyle(cell.style)
        });
      }
    }

    // --- Header fields ---
    sheet.getCell('E3').value = profile.name || '';
    sheet.getCell('E4').value = profile.empId || '';
    sheet.getCell('X4').value = profile.position || '';
    sheet.getCell('AS4').value = profile.dept || '';
    sheet.getCell('AR4').value = ':';
    const [hy, hm] = currentMonth.split('-').map(Number);
    sheet.getCell('AS3').value = excelDate(hy, hm, 1);

    // Clear the old body (sample rows 10..64 plus whatever our new layout will span): values + styles
    const clearUntil = Math.max(70, 10 + sortedData.length + 6);
    for (let r = 10; r <= clearUntil; r++) {
      const row = sheet.getRow(r);
      for (let c = 1; c <= 51; c++) {
        const cell = row.getCell(c);
        cell.value = null;
        cell.style = {};
      }
      row.height = undefined;
    }

    // --- Data rows (one per entry), starting at row 10 ---
    sortedData.forEach((e, index) => {
      const r = 10 + index;
      const row = sheet.getRow(r);
      row.height = 25.5;
      for (let c = 1; c <= 51; c++) row.getCell(c).style = cloneStyle(dataStyle[c]);
      row.getCell(1).value = {
        formula: '$E$4'
      };
      row.getCell(2).value = {
        formula: '$E$3'
      };
      const [dy, dm, dd] = e.date.split('-').map(Number);
      row.getCell(3).value = excelDate(dy, dm, dd);
      row.getCell(4).value = {
        formula: `WEEKDAY(C${r})`
      };
      row.getCell(5).value = timeToExcel(e.startTime);
      row.getCell(6).value = timeToExcel(e.endTime);
      const brk = parseFloat(e.breakTime) || 0;
      row.getCell(8).value = brk > 0 ? brk : null;
      if (LaborVN.isAuto(e)) {
        // tự động theo luật: một dòng có thể vừa giờ thường vừa nhiều loại OT (cột "Check" vẫn = 0)
        const bd = bdOf(e);
        row.getCell(7).value = bd.NORMAL || 0;
        Object.keys(OT_COL).forEach(k => {
          if (bd[k]) row.getCell(OT_COL[k]).value = bd[k];
        });
      } else {
        row.getCell(7).value = e.otType === 'NORMAL' ? {
          formula: normalHourFormula(r)
        } : 0;
        if (e.otType !== 'NORMAL' && OT_COL[e.otType]) {
          row.getCell(OT_COL[e.otType]).value = calculateHours(e.startTime, e.endTime, e.breakTime);
        }
      }
      row.getCell(16).value = {
        formula: `MOD(F${r}-E${r},1)*24-SUM(G${r}:O${r})`
      }; // MOD: ca qua nửa đêm vẫn = 0
      row.getCell(17).value = {
        formula: `INDEX($U$9:$AX$9,1,MATCH("x",$U${r}:$AX${r}))`
      };
      row.getCell(18).value = e.projectName || '';
      row.getCell(19).value = e.workNumber || '';
      row.getCell(20).value = {
        formula: `INDEX($U$6:$AX$6,1,MATCH("x",$U${r}:$AX${r}))`
      };
      const actCol = activityToCol(e.activityCode);
      if (actCol) {
        const xc = row.getCell(actCol);
        xc.value = 'x';
        xc.font = {
          name: 'Times New Roman',
          size: 14
        };
        xc.alignment = {
          horizontal: 'center',
          vertical: 'middle'
        };
      }
      row.getCell(51).value = e.remarks || '';
    });

    // --- Total row, right after the last data row ---
    const rt = 10 + sortedData.length;
    const totalRow = sheet.getRow(rt);
    totalRow.height = 24.75;
    for (let c = 1; c <= 51; c++) totalRow.getCell(c).style = cloneStyle(totalStyle[c]);
    totalRow.getCell(6).value = 'Total:';
    for (let c = 7; c <= 16; c++) {
      const letter = sheet.getColumn(c).letter;
      totalRow.getCell(c).value = {
        formula: `SUM(${letter}10:${letter}${rt - 1})`
      };
    }

    // --- Signature block (Verified / Approved / Employee Signature) ---
    sigCells.forEach(s => {
      const cell = sheet.getRow(rt + s.off).getCell(s.c);
      cell.value = s.value;
      cell.style = cloneStyle(s.style);
    });
    sheet.pageSetup.printArea = `A1:AY${rt + 5}`;
    const buffer = await workbook.xlsx.writeBuffer();
    const cleanName = removeAccents(profile.name || 'Timesheet');
    const [y, m] = currentMonth.split('-');
    saveAs(new Blob([buffer]), `${cleanName}_Thang_${m}_${y}.xlsx`);
    setSyncStatus('');
  };
  const handleBackup = () => {
    const blob = new Blob([JSON.stringify({
      profile,
      entries,
      projects
    })], {
      type: "application/json"
    });
    saveAs(blob, `TS_Backup_${profile.name}.json`);
  };
  const handleRestore = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.entries) setEntries(data.entries);
        if (data.profile) setProfile(data.profile);
        if (data.projects) setProjects(data.projects);
        showToast(`Đã khôi phục ${data.entries ? data.entries.length : 0} dòng chấm công từ bản sao lưu.`);
      } catch (err) {
        alert('Lỗi file: không đọc được bản sao lưu.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };
  const exporting = syncStatus === 'Đang tạo file...';
  const todayPeriod = periodMonthOf(getTodayLocal());
  return /*#__PURE__*/React.createElement("div", {
    className: "min-h-screen bg-slate-100 text-slate-800"
  }, /*#__PURE__*/React.createElement("header", {
    className: "sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200"
  }, /*#__PURE__*/React.createElement("div", {
    className: "max-w-7xl mx-auto px-4 lg:px-6 py-3 flex flex-wrap items-center gap-x-4 gap-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3 min-w-0 mr-auto"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-10 h-10 rounded-xl bg-blue-700 text-white grid place-items-center shrink-0",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement(Icons.Calendar, null)), /*#__PURE__*/React.createElement("div", {
    className: "min-w-0"
  }, /*#__PURE__*/React.createElement("h1", {
    className: "font-bold text-lg leading-tight"
  }, "Timesheet"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-500 truncate max-w-[52vw] md:max-w-xs"
  }, profile.name || 'Chưa có họ tên', profile.empId ? ` · ${profile.empId}` : ''))), /*#__PURE__*/React.createElement(PeriodSwitcher, {
    month: currentMonth,
    period: period,
    todayPeriod: todayPeriod,
    onChange: changeMonth
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    id: "tsAddBtn",
    type: "button",
    onClick: () => openNewEntry(),
    className: `${btnPrimary} hidden md:inline-flex`
  }, /*#__PURE__*/React.createElement(Icons.Plus, null), " Th\xEAm ch\u1EA5m c\xF4ng"), /*#__PURE__*/React.createElement("button", {
    id: "tsReportBtn",
    type: "button",
    onClick: () => setReportOpen(true),
    className: btnGhost,
    title: "B\xE1o c\xE1o t\u1ED5ng quan c\u1EE7a k\u1EF3 (in / l\u01B0u PDF g\u1EEDi gi\xE1m s\xE1t)",
    "aria-label": "B\xE1o c\xE1o t\u1ED5ng quan"
  }, /*#__PURE__*/React.createElement(Icons.Chart, null), /*#__PURE__*/React.createElement("span", {
    className: "hidden sm:inline"
  }, "B\xE1o c\xE1o")), /*#__PURE__*/React.createElement("button", {
    id: "tsExportBtn",
    type: "button",
    onClick: handleExportExcel,
    disabled: exporting,
    className: btnGhost,
    title: "Xu\u1EA5t b\u1EA3ng ch\u1EA5m c\xF4ng c\u1EE7a k\u1EF3 ra Excel (m\u1EABu Schindler)",
    "aria-label": "Xu\u1EA5t Excel"
  }, /*#__PURE__*/React.createElement(Icons.Download, null), /*#__PURE__*/React.createElement("span", {
    className: "hidden sm:inline"
  }, exporting ? 'Đang tạo file...' : 'Xuất Excel')), /*#__PURE__*/React.createElement("button", {
    id: "tsSettingsBtn",
    type: "button",
    onClick: () => setDrawer({
      type: 'settings'
    }),
    className: btnGhost,
    "aria-label": "Sao l\u01B0u & kh\xF4i ph\u1EE5c",
    title: "Sao l\u01B0u & kh\xF4i ph\u1EE5c"
  }, /*#__PURE__*/React.createElement(Icons.Settings, null), /*#__PURE__*/React.createElement("span", {
    className: "hidden xl:inline"
  }, "Sao l\u01B0u"))))), /*#__PURE__*/React.createElement("div", {
    className: "max-w-7xl mx-auto px-4 lg:px-6 pt-4 lg:pt-6 grid gap-4 lg:gap-6 md:grid-cols-2"
  }, /*#__PURE__*/React.createElement(ProfileCard, {
    profile: profile,
    setProfile: setProfile
  }), /*#__PURE__*/React.createElement(ProjectSyncCard, {
    count: projects.length,
    syncing: projSyncing,
    status: projStatus,
    syncedAt: projSyncedAt,
    missing: needProjects && projects.length === 0,
    onSync: handleSyncProjects
  })), /*#__PURE__*/React.createElement("main", {
    className: "max-w-7xl mx-auto px-4 lg:px-6 pt-4 lg:pt-6 pb-28 md:pb-10 grid gap-4 lg:gap-6 lg:grid-cols-[minmax(300px,360px)_1fr] items-start"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-4 md:items-start lg:block lg:space-y-4 lg:sticky lg:top-24"
  }, /*#__PURE__*/React.createElement(StatsPanel, {
    stats: stats
  }), /*#__PURE__*/React.createElement(PeriodCalendar, {
    period: period,
    dayTotals: dayTotals,
    missing: stats.missing,
    selected: dayFilter,
    sch: sch,
    holidays: holidays,
    onPick: d => dayTotals[d] ? setDayFilter(dayFilter === d ? null : d) : openNewEntry(d)
  })), /*#__PURE__*/React.createElement("section", {
    className: "bg-white rounded-2xl border border-slate-200 min-w-0",
    "aria-labelledby": "tsListTitle"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100"
  }, /*#__PURE__*/React.createElement("h2", {
    id: "tsListTitle",
    className: "font-semibold"
  }, "Ch\u1EA5m c\xF4ng trong k\u1EF3"), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-slate-500"
  }, visible.length, " d\xF2ng"), dayFilter && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setDayFilter(null),
    className: "inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-blue-50 text-blue-800 text-sm font-medium hover:bg-blue-100"
  }, WEEKDAYS[weekdayOf(dayFilter)], ", ", fmtDMY(dayFilter), " ", /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true"
  }, "\u2715"), /*#__PURE__*/React.createElement("span", {
    className: "sr-only"
  }, "B\u1ECF l\u1ECDc ng\xE0y")), dayFilter && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => openNewEntry(dayFilter),
    className: "ml-auto text-sm font-semibold text-blue-700 hover:text-blue-900"
  }, "+ Th\xEAm cho ng\xE0y ", fmtDM(dayFilter))), visible.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "px-6 py-14 text-center"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mx-auto w-12 h-12 rounded-2xl bg-slate-100 grid place-items-center text-slate-400 mb-3",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement(Icons.Calendar, null)), /*#__PURE__*/React.createElement("p", {
    className: "font-medium text-slate-700"
  }, "Ch\u01B0a c\xF3 ch\u1EA5m c\xF4ng trong k\u1EF3 ", fmtDMY(period.start), " \u2013 ", fmtDMY(period.end)), /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-slate-500 mt-1"
  }, "B\u1EA5m ", /*#__PURE__*/React.createElement("b", null, "Th\xEAm ch\u1EA5m c\xF4ng"), " ho\u1EB7c ch\u1ECDn m\u1ED9t ng\xE0y tr\xEAn l\u1ECBch."), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => openNewEntry(),
    className: `${btnPrimary} mt-4`
  }, /*#__PURE__*/React.createElement(Icons.Plus, null), " Th\xEAm ch\u1EA5m c\xF4ng")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(EntryTable, {
    rows: visible,
    bdOf: bdOf,
    sch: sch,
    onEdit: openEdit,
    onDelete: handleDelete
  }), /*#__PURE__*/React.createElement(EntryCards, {
    rows: visible,
    bdOf: bdOf,
    sch: sch,
    onEdit: openEdit,
    onDelete: handleDelete
  })))), /*#__PURE__*/React.createElement("button", {
    id: "tsFab",
    type: "button",
    onClick: () => openNewEntry(),
    "aria-label": "Th\xEAm ch\u1EA5m c\xF4ng",
    className: "md:hidden fixed bottom-5 right-5 z-30 w-14 h-14 rounded-full bg-blue-700 text-white shadow-xl grid place-items-center active:scale-95 transition"
  }, /*#__PURE__*/React.createElement(Icons.Plus, null)), drawer && drawer.type === 'form' && /*#__PURE__*/React.createElement(Drawer, {
    title: drawer.entry ? 'Sửa chấm công' : 'Thêm chấm công',
    onClose: closeDrawer
  }, /*#__PURE__*/React.createElement(EntryForm, {
    key: drawer.key,
    initialData: drawer.entry,
    defaultDate: drawer.date,
    onSave: handleSaveEntry,
    onCancel: closeDrawer,
    onDelete: drawer.entry ? () => handleDelete(drawer.entry) : null,
    entries: entries,
    projects: projects,
    sch: sch
  })), drawer && drawer.type === 'settings' && /*#__PURE__*/React.createElement(Drawer, {
    title: "Sao l\u01B0u & kh\xF4i ph\u1EE5c",
    onClose: closeDrawer
  }, /*#__PURE__*/React.createElement(SettingsPanel, {
    onBackup: handleBackup,
    onRestore: handleRestore,
    onReset: handleResetData,
    onDone: closeDrawer
  })), reportOpen && /*#__PURE__*/React.createElement(ReportView, {
    onClose: () => setReportOpen(false),
    data: buildReport({
      rows: monthlyEntries,
      bdOf,
      period,
      sch,
      holidays,
      missing: stats.missing
    }),
    profile: profile,
    sch: sch,
    period: period,
    month: currentMonth
  }), toast && /*#__PURE__*/React.createElement(Toast, {
    toast: toast,
    onClose: () => setToast(null)
  }));
}

// ---------- Kỳ lương: ‹ tháng › + chọn nhanh ----------
function PeriodSwitcher({
  month,
  period,
  todayPeriod,
  onChange
}) {
  const [y, m] = month.split('-');
  return /*#__PURE__*/React.createElement("div", {
    className: "order-last w-full md:order-none md:w-auto flex items-center gap-1 bg-slate-100 rounded-xl p-1"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => onChange(shiftMonth(month, -1)),
    "aria-label": "K\u1EF3 l\u01B0\u01A1ng tr\u01B0\u1EDBc",
    className: "w-9 h-10 grid place-items-center rounded-lg text-slate-600 hover:bg-white"
  }, /*#__PURE__*/React.createElement(Icons.ChevronLeft, null)), /*#__PURE__*/React.createElement("label", {
    className: "relative flex-1 md:flex-none md:min-w-[11.5rem] text-center px-2 cursor-pointer rounded-lg hover:bg-white"
  }, /*#__PURE__*/React.createElement("span", {
    className: "block text-sm font-semibold leading-5"
  }, "K\u1EF3 l\u01B0\u01A1ng th\xE1ng ", parseInt(m, 10), "/", y), /*#__PURE__*/React.createElement("span", {
    className: "block text-xs text-slate-500 leading-4"
  }, fmtDMY(period.start), " \u2013 ", fmtDMY(period.end)), /*#__PURE__*/React.createElement("input", {
    type: "month",
    value: month,
    "aria-label": "Ch\u1ECDn k\u1EF3 l\u01B0\u01A1ng",
    onChange: e => e.target.value && onChange(e.target.value),
    onClick: e => {
      try {
        e.currentTarget.showPicker();
      } catch (_) {/* trình duyệt cũ */}
    },
    className: "absolute inset-0 w-full h-full opacity-0 cursor-pointer"
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => onChange(shiftMonth(month, 1)),
    "aria-label": "K\u1EF3 l\u01B0\u01A1ng sau",
    className: "w-9 h-10 grid place-items-center rounded-lg text-slate-600 hover:bg-white"
  }, /*#__PURE__*/React.createElement(Icons.ChevronRight, null)), month !== todayPeriod && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => onChange(todayPeriod),
    className: "h-10 px-2.5 rounded-lg text-sm font-medium text-blue-700 hover:bg-white whitespace-nowrap"
  }, "K\u1EF3 hi\u1EC7n t\u1EA1i"));
}

// ---------- Thẻ tổng hợp ----------
function StatsPanel({
  stats
}) {
  const ots = Object.keys(stats.byOt).sort();
  const Tile = ({
    label,
    value,
    unit,
    tone,
    note,
    warn
  }) => /*#__PURE__*/React.createElement("div", {
    className: "bg-white rounded-2xl border border-slate-200 p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-medium text-slate-500"
  }, label), /*#__PURE__*/React.createElement("div", {
    className: `mt-1 text-2xl font-bold tabular-nums ${tone === 'blue' ? 'text-blue-700' : tone === 'orange' ? 'text-orange-600' : 'text-slate-900'}`
  }, value, /*#__PURE__*/React.createElement("span", {
    className: "ml-1 text-sm font-medium text-slate-500"
  }, unit)), note && /*#__PURE__*/React.createElement("div", {
    className: `mt-1 text-xs ${warn ? 'text-rose-600 font-medium' : 'text-slate-500'}`
  }, note));
  return /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement(Tile, {
    label: "Gi\u1EDD c\xF4ng th\u01B0\u1EDDng",
    value: fmtH(stats.normal),
    unit: "gi\u1EDD",
    tone: "blue"
  }), /*#__PURE__*/React.createElement(Tile, {
    label: "T\u0103ng ca (OT)",
    value: fmtH(stats.ot),
    unit: "gi\u1EDD",
    tone: "orange",
    note: ots.length ? ots.map(k => `${k}: ${fmtH(stats.byOt[k])}`).join(' · ') : null
  }), /*#__PURE__*/React.createElement(Tile, {
    label: "T\u1ED5ng gi\u1EDD",
    value: fmtH(stats.total),
    unit: "gi\u1EDD"
  }), /*#__PURE__*/React.createElement(Tile, {
    label: "Ng\xE0y \u0111\xE3 ch\u1EA5m",
    value: stats.days,
    unit: "ng\xE0y",
    warn: stats.missing.length > 0,
    note: stats.missing.length ? `Còn ${stats.missing.length} ngày T2–T6 chưa chấm` : 'Đủ ngày làm việc đến hôm nay'
  }));
}

// ---------- Lịch kỳ lương (16 → 15) ----------
function PeriodCalendar({
  period,
  dayTotals,
  missing,
  selected,
  onPick,
  sch,
  holidays
}) {
  const today = getTodayLocal();
  const days = daysBetween(period.start, period.end);
  const lead = (weekdayOf(period.start) + 6) % 7; // tuần bắt đầu từ Thứ 2
  const missingSet = new Set(missing);
  return /*#__PURE__*/React.createElement("div", {
    className: "bg-white rounded-2xl border border-slate-200 p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-3"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "font-semibold"
  }, "L\u1ECBch k\u1EF3 l\u01B0\u01A1ng"), /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-slate-500"
  }, fmtDM(period.start), " \u2013 ", fmtDM(period.end))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-500 mb-1",
    "aria-hidden": "true"
  }, ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(w => /*#__PURE__*/React.createElement("div", {
    key: w
  }, w))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-7 gap-1"
  }, Array.from({
    length: lead
  }).map((_, i) => /*#__PURE__*/React.createElement("div", {
    key: 'blank' + i
  })), days.map(d => {
    const t = dayTotals[d],
      w = weekdayOf(d),
      holi = holidayOf(d, sch),
      hol = !!holi,
      miss = missingSet.has(d);
    const [, mm, dd] = d.split('-');
    const showMonth = dd === '01' || d === period.start;
    const label = `${WEEKDAYS_LONG[w]} ${fmtDMY(d)}${hol ? `, ${holi.name}` : ''}: ` + (t ? `${fmtH(t.hours)} giờ — bấm để xem` : miss ? 'chưa chấm công — bấm để thêm' : 'bấm để thêm chấm công');
    return /*#__PURE__*/React.createElement("button", {
      key: d,
      type: "button",
      onClick: () => onPick(d),
      "aria-pressed": selected === d,
      "aria-label": label,
      title: label,
      className: `relative h-11 sm:h-12 rounded-lg flex flex-col items-center justify-center text-sm border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${selected === d ? 'border-blue-600 ring-2 ring-blue-600/30' : d === today ? 'border-slate-800' : 'border-transparent'} ${t ? t.ot ? 'bg-orange-50 hover:bg-orange-100' : 'bg-blue-50 hover:bg-blue-100' : miss ? 'bg-rose-50 hover:bg-rose-100' : hol ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-slate-100'}`
    }, /*#__PURE__*/React.createElement("span", {
      className: `leading-none ${showMonth ? 'text-[11px] font-semibold' : ''} ${hol || w === 0 ? 'text-rose-600' : w === 6 ? 'text-slate-500' : 'text-slate-800'}`
    }, showMonth ? `${parseInt(dd, 10)}/${parseInt(mm, 10)}` : parseInt(dd, 10)), t ? /*#__PURE__*/React.createElement("span", {
      className: `mt-1 text-[10px] font-semibold leading-none ${t.ot ? 'text-orange-700' : 'text-blue-700'}`
    }, fmtH(t.hours), "h") : miss ? /*#__PURE__*/React.createElement("span", {
      className: "mt-1 w-1.5 h-1.5 rounded-full bg-rose-500",
      "aria-hidden": "true"
    }) : null);
  })), /*#__PURE__*/React.createElement("div", {
    className: "mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("span", {
    className: "inline-flex items-center gap-1"
  }, /*#__PURE__*/React.createElement("i", {
    className: "w-2.5 h-2.5 rounded bg-blue-100 inline-block"
  }), "\u0110\xE3 ch\u1EA5m"), /*#__PURE__*/React.createElement("span", {
    className: "inline-flex items-center gap-1"
  }, /*#__PURE__*/React.createElement("i", {
    className: "w-2.5 h-2.5 rounded bg-orange-100 inline-block"
  }), "C\xF3 OT"), /*#__PURE__*/React.createElement("span", {
    className: "inline-flex items-center gap-1"
  }, /*#__PURE__*/React.createElement("i", {
    className: "w-1.5 h-1.5 rounded-full bg-rose-500 inline-block"
  }), "Ch\u01B0a ch\u1EA5m (T2\u2013T6)"), /*#__PURE__*/React.createElement("span", {
    className: "inline-flex items-center gap-1"
  }, /*#__PURE__*/React.createElement("i", {
    className: "w-2.5 h-2.5 rounded border border-slate-800 inline-block"
  }), "H\xF4m nay"), /*#__PURE__*/React.createElement("span", {
    className: "inline-flex items-center gap-1"
  }, /*#__PURE__*/React.createElement("i", {
    className: "w-2.5 h-2.5 rounded bg-amber-100 inline-block"
  }), /*#__PURE__*/React.createElement("b", {
    className: "font-medium text-rose-600"
  }, "L\u1EC5"))), holidays.length > 0 && /*#__PURE__*/React.createElement("div", {
    id: "tsHolidays",
    className: "mt-3 pt-3 border-t border-slate-100"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xs font-semibold text-slate-600 mb-1"
  }, "Ng\xE0y l\u1EC5 trong k\u1EF3 \u2014 l\xE0m vi\u1EC7c t\xEDnh OT3 / OT6 (300% / 390%)"), /*#__PURE__*/React.createElement("ul", {
    className: "space-y-0.5 text-xs text-slate-600"
  }, holidays.map(h => /*#__PURE__*/React.createElement("li", {
    key: h.date,
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tabular-nums font-medium text-rose-600 w-12 shrink-0"
  }, fmtDM(h.date)), /*#__PURE__*/React.createElement("span", null, h.name))))));
}

// Giờ thường / OT của một dòng, mỗi loại một nhãn (vd. "Giờ thường 8" "OT1 · 150% 3")
function HourPills({
  bd
}) {
  const keys = OT_TYPES.map(t => t.code).filter(k => bd[k] > 0);
  if (!keys.length) return /*#__PURE__*/React.createElement("span", {
    className: "text-slate-400"
  }, "\u2014");
  return /*#__PURE__*/React.createElement("span", {
    className: "inline-flex flex-wrap gap-1"
  }, keys.map(k => /*#__PURE__*/React.createElement("span", {
    key: k,
    title: otLabel(k),
    className: `inline-flex items-center gap-1 h-6 px-2 rounded-full text-xs font-semibold whitespace-nowrap ${k === 'NORMAL' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`
  }, otShort(k), /*#__PURE__*/React.createElement("span", {
    className: "tabular-nums font-bold"
  }, fmtH(bd[k])))));
}

// ---------- Máy tính: bảng ----------
function EntryTable({
  rows,
  bdOf,
  sch,
  onEdit,
  onDelete
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "hidden lg:block overflow-x-auto"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-sm"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-slate-50 text-slate-500 text-xs whitespace-nowrap"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    scope: "col",
    className: "text-left font-medium px-4 py-2.5"
  }, "Ng\xE0y"), /*#__PURE__*/React.createElement("th", {
    scope: "col",
    className: "text-left font-medium px-3 py-2.5"
  }, "Th\u1EDDi gian"), /*#__PURE__*/React.createElement("th", {
    scope: "col",
    className: "text-right font-medium px-3 py-2.5"
  }, "Gi\u1EDD"), /*#__PURE__*/React.createElement("th", {
    scope: "col",
    className: "text-left font-medium px-3 py-2.5"
  }, "Lo\u1EA1i gi\u1EDD"), /*#__PURE__*/React.createElement("th", {
    scope: "col",
    className: "text-left font-medium px-3 py-2.5"
  }, "M\xE3 CV"), /*#__PURE__*/React.createElement("th", {
    scope: "col",
    className: "text-left font-medium px-3 py-2.5 w-full"
  }, "D\u1EF1 \xE1n / WBS / Ghi ch\xFA"), /*#__PURE__*/React.createElement("th", {
    scope: "col",
    className: "px-4 py-2.5"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sr-only"
  }, "Thao t\xE1c")))), /*#__PURE__*/React.createElement("tbody", {
    className: "divide-y divide-slate-100"
  }, rows.map((e, i) => {
    const firstOfDay = i === 0 || rows[i - 1].date !== e.date;
    const w = weekdayOf(e.date),
      hol = isVietnameseHoliday(e.date, sch);
    const bd = bdOf(e);
    const brk = parseFloat(e.breakTime) || 0,
      duty = parseFloat(e.dutyHour) || 0;
    return /*#__PURE__*/React.createElement("tr", {
      key: e.id,
      onClick: () => onEdit(e),
      className: `cursor-pointer hover:bg-blue-50/50 ${firstOfDay && i > 0 ? 'border-t-2 border-slate-200' : ''}`
    }, /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-2.5 whitespace-nowrap align-top"
    }, firstOfDay ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
      className: "font-semibold tabular-nums"
    }, fmtDM(e.date)), ' ', /*#__PURE__*/React.createElement("span", {
      className: hol || w === 0 ? 'text-rose-600' : 'text-slate-500'
    }, WEEKDAYS[w], hol ? ' · Lễ' : '')) : /*#__PURE__*/React.createElement("span", {
      className: "sr-only"
    }, fmtDMY(e.date))), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2.5 whitespace-nowrap tabular-nums align-top"
    }, e.startTime && e.endTime ? `${e.startTime} – ${e.endTime}` : '—', (brk > 0 || duty > 0) && /*#__PURE__*/React.createElement("div", {
      className: "text-xs text-slate-400"
    }, [brk > 0 ? `nghỉ ${fmtH(brk)}h` : '', duty > 0 ? `trực ${fmtH(duty)}h` : ''].filter(Boolean).join(' · '))), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2.5 text-right font-semibold tabular-nums align-top"
    }, fmtH(sumBd(bd))), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2.5 align-top"
    }, /*#__PURE__*/React.createElement(HourPills, {
      bd: bd
    })), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2.5 font-mono text-xs text-blue-700 align-top whitespace-nowrap"
    }, e.activityCode), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2.5 align-top max-w-0"
    }, /*#__PURE__*/React.createElement("div", {
      className: "truncate",
      title: e.projectName
    }, e.projectName || '—'), e.workNumber && /*#__PURE__*/React.createElement("div", {
      className: "text-xs text-slate-500 font-mono truncate"
    }, e.workNumber), e.remarks && /*#__PURE__*/React.createElement("div", {
      className: "text-xs text-slate-500 italic truncate",
      title: e.remarks
    }, e.remarks)), /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-2 align-top text-right whitespace-nowrap"
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      "aria-label": `Sửa chấm công ${fmtDMY(e.date)}`,
      onClick: ev => {
        ev.stopPropagation();
        onEdit(e);
      },
      className: "w-8 h-8 inline-grid place-items-center rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50"
    }, /*#__PURE__*/React.createElement(Icons.Edit, null)), /*#__PURE__*/React.createElement("button", {
      type: "button",
      "aria-label": `Xóa chấm công ${fmtDMY(e.date)}`,
      onClick: ev => {
        ev.stopPropagation();
        onDelete(e);
      },
      className: "w-8 h-8 inline-grid place-items-center rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50"
    }, /*#__PURE__*/React.createElement(Icons.Trash, null))));
  }))));
}

// ---------- Điện thoại / tablet: thẻ theo ngày ----------
function EntryCards({
  rows,
  bdOf,
  sch,
  onEdit,
  onDelete
}) {
  const groups = [];
  rows.forEach(e => {
    const g = groups[groups.length - 1];
    if (g && g.date === e.date) g.items.push(e);else groups.push({
      date: e.date,
      items: [e]
    });
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "lg:hidden divide-y divide-slate-100"
  }, groups.map(g => {
    const total = g.items.reduce((s, e) => s + sumBd(bdOf(e)), 0);
    const w = weekdayOf(g.date),
      hol = isVietnameseHoliday(g.date, sch);
    return /*#__PURE__*/React.createElement("div", {
      key: g.date,
      className: "px-4 py-3"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-baseline justify-between mb-2"
    }, /*#__PURE__*/React.createElement("span", {
      className: "font-semibold"
    }, /*#__PURE__*/React.createElement("span", {
      className: hol || w === 0 ? 'text-rose-600' : ''
    }, WEEKDAYS_LONG[w]), ", ", fmtDMY(g.date), hol ? /*#__PURE__*/React.createElement("span", {
      className: "text-rose-600"
    }, " \xB7 L\u1EC5") : null), /*#__PURE__*/React.createElement("span", {
      className: "text-sm text-slate-500 tabular-nums"
    }, fmtH(total), " gi\u1EDD")), /*#__PURE__*/React.createElement("ul", {
      className: "space-y-2"
    }, g.items.map(e => /*#__PURE__*/React.createElement("li", {
      key: e.id,
      className: "rounded-xl border border-slate-200 flex items-stretch"
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => onEdit(e),
      className: "flex-1 min-w-0 text-left p-3 rounded-l-xl hover:bg-slate-50"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2 flex-wrap"
    }, /*#__PURE__*/React.createElement("span", {
      className: "font-medium tabular-nums"
    }, e.startTime && e.endTime ? `${e.startTime} – ${e.endTime}` : 'Không có giờ'), /*#__PURE__*/React.createElement("span", {
      className: "text-sm text-slate-500 tabular-nums"
    }, fmtH(sumBd(bdOf(e))), "h")), /*#__PURE__*/React.createElement("div", {
      className: "mt-1"
    }, /*#__PURE__*/React.createElement(HourPills, {
      bd: bdOf(e)
    })), /*#__PURE__*/React.createElement("div", {
      className: "mt-1 text-sm truncate"
    }, /*#__PURE__*/React.createElement("span", {
      className: "font-mono text-blue-700"
    }, "[", e.activityCode, "]"), " ", e.projectName), e.workNumber && /*#__PURE__*/React.createElement("div", {
      className: "text-xs text-slate-500 font-mono truncate"
    }, e.workNumber), e.remarks && /*#__PURE__*/React.createElement("div", {
      className: "text-xs text-slate-500 truncate"
    }, "Ghi ch\xFA: ", e.remarks)), /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => onDelete(e),
      "aria-label": `Xóa chấm công ${fmtDMY(e.date)}`,
      className: "w-12 grid place-items-center rounded-r-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border-l border-slate-100"
    }, /*#__PURE__*/React.createElement(Icons.Trash, null))))));
  }));
}

// ---------- Ngăn trượt (máy tính: bên phải · điện thoại: toàn màn hình) ----------
function Drawer({
  title,
  onClose,
  children
}) {
  const panel = useRef(null);
  useEffect(() => {
    const prevFocus = document.activeElement;
    const onKey = e => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (panel.current) {
      const first = finePointer() ? panel.current.querySelector('[data-autofocus]') : null; // không tự bật bàn phím trên điện thoại
      (first || panel.current).focus();
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (prevFocus && prevFocus.focus) prevFocus.focus();
    };
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-50",
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "tsDrawerTitle"
  }, /*#__PURE__*/React.createElement("div", {
    className: "absolute inset-0 bg-slate-900/40 ts-fade",
    onClick: onClose
  }), /*#__PURE__*/React.createElement("div", {
    ref: panel,
    tabIndex: -1,
    className: "absolute inset-y-0 right-0 w-full md:max-w-xl bg-white shadow-2xl flex flex-col outline-none ts-drawer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between px-5 h-14 border-b border-slate-200 shrink-0"
  }, /*#__PURE__*/React.createElement("h2", {
    id: "tsDrawerTitle",
    className: "font-semibold text-lg"
  }, title), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClose,
    "aria-label": "\u0110\xF3ng",
    className: "w-10 h-10 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
  }, /*#__PURE__*/React.createElement(Icons.X, null))), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 overflow-y-auto"
  }, children)));
}

// ================================================================
//   BÁO CÁO TỔNG QUAN (cho giám sát xem nhanh) — in / lưu PDF bằng trình duyệt
// ================================================================
const CAT_LABEL = {
  NI: 'Lắp đặt mới (NI)',
  MOD: 'Hiện đại hoá (MOD)',
  EI: 'Bảo trì, sửa chữa (EI)',
  TF: 'Kiểm định (TF)',
  SAF: 'An toàn',
  HR: 'Họp, đào tạo, hành chính',
  Other: 'Khác'
};
const LEAVE_LABEL = {
  '6010': 'Nghỉ hưởng lương (phép năm / lễ)',
  '6020': 'Nghỉ ốm / tai nạn',
  '6090': 'Nghỉ không lương'
};
const pct = (x, total) => total > 0 ? Math.round(x / total * 1000) / 10 : 0;
const fmtPct = x => x.toLocaleString('vi-VN', {
  maximumFractionDigits: 1
}) + '%';

// Tổng hợp số liệu của kỳ: giờ làm việc (không tính nghỉ), dự án, hoạt động, nghỉ, theo ngày
function buildReport({
  rows,
  bdOf,
  period,
  sch,
  holidays,
  missing
}) {
  const isLeave = e => LaborVN.LEAVE_CODES.includes(String(e.activityCode));
  const work = rows.filter(e => !isLeave(e)),
    leaveRows = rows.filter(isLeave);
  const byType = {};
  let normal = 0,
    ot = 0,
    weighted = 0;
  const projects = {},
    activities = {},
    cats = {},
    leave = {};
  const day = {};
  work.forEach(e => {
    const bd = bdOf(e),
      h = sumBd(bd);
    Object.keys(bd).forEach(k => {
      byType[k] = (byType[k] || 0) + bd[k];
      if (k === 'NORMAL') normal += bd[k];else ot += bd[k];
      weighted += bd[k] * (LaborVN.OT_RATES[k] || 100) / 100;
    });
    const d = day[e.date] || (day[e.date] = {
      normal: 0,
      ot: 0,
      leave: false
    });
    d.normal += bd.NORMAL || 0;
    d.ot += h - (bd.NORMAL || 0);
    const pk = (e.workNumber || '') + '|' + (e.projectName || '');
    const p = projects[pk] || (projects[pk] = {
      name: e.projectName || '(không ghi dự án)',
      wbs: e.workNumber || '',
      days: {},
      normal: 0,
      ot: 0
    });
    p.days[e.date] = true;
    p.normal += bd.NORMAL || 0;
    p.ot += h - (bd.NORMAL || 0);
    const meta = ACTIVITY_META.find(a => a.id === e.activityCode || a.code === e.activityCode);
    const ak = String(e.activityCode || '—');
    const a = activities[ak] || (activities[ak] = {
      code: ak,
      desc: meta ? meta.desc.replace(/^\S+\s*-\s*/, '') : 'Mã khác',
      cat: meta ? meta.cat : 'Other',
      hours: 0
    });
    a.hours += h;
    cats[a.cat] = (cats[a.cat] || 0) + h;
  });
  leaveRows.forEach(e => {
    const code = String(e.activityCode);
    const l = leave[code] || (leave[code] = {
      code,
      label: LEAVE_LABEL[code] || code,
      days: {},
      hours: 0
    });
    l.days[e.date] = true;
    l.hours += entryHours(e);
    (day[e.date] || (day[e.date] = {
      normal: 0,
      ot: 0,
      leave: false
    })).leave = true;
  });
  const total = normal + ot;
  const projectList = Object.values(projects).map(p => ({
    ...p,
    days: Object.keys(p.days).length,
    total: p.normal + p.ot
  })).sort((a, b) => b.total - a.total);
  const activityList = Object.values(activities).sort((a, b) => b.hours - a.hours);
  const catList = Object.keys(cats).map(c => ({
    cat: c,
    label: CAT_LABEL[c] || c,
    hours: cats[c]
  })).sort((a, b) => b.hours - a.hours);
  const leaveList = Object.values(leave).map(l => ({
    ...l,
    dates: Object.keys(l.days).sort(),
    days: Object.keys(l.days).length
  }));
  const workDays = Object.keys(day).filter(d => day[d].normal + day[d].ot > 0).length;
  const days = daysBetween(period.start, period.end).map(d => ({
    date: d,
    ...(day[d] || {
      normal: 0,
      ot: 0,
      leave: false
    }),
    holiday: holidayOf(d, sch),
    rest: LaborVN.isRestDay(d, sch),
    missing: missing.includes(d)
  }));
  return {
    total,
    normal,
    ot,
    weighted,
    byType,
    workDays,
    projectList,
    activityList,
    catList,
    leaveList,
    leaveDays: new Set(leaveRows.map(e => e.date)).size,
    leaveHours: leaveRows.reduce((s, e) => s + entryHours(e), 0),
    days,
    holidays,
    missing,
    entries: rows.length
  };
}

// Giờ làm theo ngày: cột chồng giờ thường (xanh) + tăng ca (cam), vạch tham chiếu 8 giờ
function DailyChart({
  days
}) {
  const W = 720,
    H = 190,
    padL = 26,
    padB = 30,
    padT = 10;
  const max = Math.max(12, ...days.map(d => d.normal + d.ot));
  const top = Math.ceil(max / 4) * 4;
  const cw = (W - padL) / days.length,
    bw = Math.max(6, Math.min(16, cw - 4));
  const y = h => padT + (H - padT - padB) * (1 - h / top);
  const grid = [];
  for (let g = 0; g <= top; g += 4) grid.push(g);
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${W} ${H}`,
    className: "rp-chart",
    role: "img",
    "aria-label": "Bi\u1EC3u \u0111\u1ED3 gi\u1EDD l\xE0m theo ng\xE0y trong k\u1EF3"
  }, grid.map(g => /*#__PURE__*/React.createElement("g", {
    key: g
  }, /*#__PURE__*/React.createElement("line", {
    x1: padL,
    x2: W,
    y1: y(g),
    y2: y(g),
    stroke: g === 0 ? '#94a3b8' : '#e2e8f0',
    strokeWidth: "1"
  }), /*#__PURE__*/React.createElement("text", {
    x: padL - 5,
    y: y(g) + 3,
    textAnchor: "end",
    className: "rp-axis"
  }, g))), /*#__PURE__*/React.createElement("line", {
    x1: padL,
    x2: W,
    y1: y(8),
    y2: y(8),
    stroke: "#64748b",
    strokeWidth: "1",
    strokeDasharray: "3 3"
  }), /*#__PURE__*/React.createElement("text", {
    x: W - 2,
    y: y(8) - 3,
    textAnchor: "end",
    className: "rp-axis"
  }, "8 gi\u1EDD"), days.map((d, i) => {
    const x = padL + i * cw + (cw - bw) / 2,
      cx = padL + i * cw + cw / 2;
    const [, mm, dd] = d.date.split('-');
    const total = d.normal + d.ot;
    const label = `${WEEKDAYS_LONG[weekdayOf(d.date)]} ${fmtDMY(d.date)}: ${fmtH(d.normal)} giờ thường` + (d.ot ? `, ${fmtH(d.ot)} giờ tăng ca` : '') + (d.holiday ? ` — ${d.holiday.name}` : '') + (d.leave ? ' — có nghỉ' : '') + (d.missing ? ' — chưa chấm' : '');
    const yN = y(d.normal),
      yT = y(total),
      gap = d.normal > 0 && d.ot > 0 ? 2 : 0;
    return /*#__PURE__*/React.createElement("g", {
      key: d.date
    }, /*#__PURE__*/React.createElement("title", null, label), (d.holiday || d.rest) && /*#__PURE__*/React.createElement("rect", {
      x: padL + i * cw,
      y: padT,
      width: cw,
      height: H - padT - padB,
      fill: d.holiday ? '#fef3c7' : '#f1f5f9'
    }), /*#__PURE__*/React.createElement("rect", {
      x: padL + i * cw,
      y: padT,
      width: cw,
      height: H - padT - padB,
      fill: "transparent"
    }), d.normal > 0 && /*#__PURE__*/React.createElement("path", {
      d: barPath(x, yN, bw, y(0) - yN, d.ot > 0 ? 0 : 3),
      fill: "#1d4ed8"
    }), d.ot > 0 && /*#__PURE__*/React.createElement("path", {
      d: barPath(x, yT, bw, Math.max(1, yN - yT - gap), 3),
      fill: "#ea580c"
    }), /*#__PURE__*/React.createElement("text", {
      x: cx,
      y: H - padB + 12,
      textAnchor: "middle",
      className: `rp-axis ${d.holiday || weekdayOf(d.date) === 0 ? 'rp-red' : ''}`
    }, dd === '01' || i === 0 ? `${parseInt(dd, 10)}/${parseInt(mm, 10)}` : parseInt(dd, 10)), d.leave && /*#__PURE__*/React.createElement("text", {
      x: cx,
      y: H - padB + 24,
      textAnchor: "middle",
      className: "rp-axis rp-leave"
    }, "P"), d.missing && /*#__PURE__*/React.createElement("circle", {
      cx: cx,
      cy: H - padB + 21,
      r: "2.5",
      fill: "#e11d48"
    }));
  }));
}
// cột bo góc 4px ở đầu dữ liệu (phía trên), đáy vuông nằm trên trục
const barPath = (x, y, w, h, r) => {
  if (h <= 0) return '';
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
};
function Bar({
  value,
  max,
  color
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "rp-bar"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: `${max > 0 ? Math.max(1, value / max * 100) : 0}%`,
      background: color || '#1d4ed8'
    }
  }));
}
function ReportView({
  data,
  profile,
  sch,
  period,
  month,
  onClose
}) {
  useEffect(() => {
    document.body.classList.add('ts-report-open');
    const onKey = e => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const title = document.title;
    const [y, m] = month.split('-');
    document.title = `Bao_cao_tong_quan_${removeAccents(profile.name || 'Timesheet')}_Thang_${m}_${y}`; // tên file PDF gợi ý
    return () => {
      document.body.classList.remove('ts-report-open');
      document.removeEventListener('keydown', onKey);
      document.title = title;
    };
  }, []);
  const [y, m] = month.split('-');
  const d = data;
  const otTypes = OT_TYPES.filter(t => d.byType[t.code] > 0);
  const maxProj = d.projectList.length ? d.projectList[0].total : 0;
  const maxAct = d.activityList.length ? d.activityList[0].hours : 0;
  const leaveDates = l => l.dates.map(fmtDM).join(', ');
  return /*#__PURE__*/React.createElement("div", {
    className: "rp-overlay",
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "rpTitle"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rp-toolbar"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => window.print(),
    className: btnPrimary
  }, /*#__PURE__*/React.createElement(Icons.Download, null), " In / L\u01B0u PDF"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClose,
    className: btnGhost
  }, "\u0110\xF3ng"), /*#__PURE__*/React.createElement("span", {
    className: "rp-hint"
  }, "Ch\u1ECDn \u201CL\u01B0u d\u01B0\u1EDBi d\u1EA1ng PDF\u201D \u0111\u1EC3 g\u1EEDi gi\xE1m s\xE1t.")), /*#__PURE__*/React.createElement("article", {
    className: "rp-page",
    id: "tsReport"
  }, /*#__PURE__*/React.createElement("header", {
    className: "rp-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "rp-kicker"
  }, "Schindler \xB7 Timesheet c\xE1 nh\xE2n"), /*#__PURE__*/React.createElement("h1", {
    id: "rpTitle"
  }, "B\xE1o c\xE1o t\u1ED5ng quan ch\u1EA5m c\xF4ng"), /*#__PURE__*/React.createElement("div", {
    className: "rp-sub"
  }, "K\u1EF3 l\u01B0\u01A1ng th\xE1ng ", parseInt(m, 10), "/", y, " \xB7 ", fmtDMY(period.start), " \u2013 ", fmtDMY(period.end))), /*#__PURE__*/React.createElement("dl", {
    className: "rp-who"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, "H\u1ECD t\xEAn"), /*#__PURE__*/React.createElement("dd", null, profile.name || '—')), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, "M\xE3 NV"), /*#__PURE__*/React.createElement("dd", null, profile.empId || '—')), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, "Ch\u1EE9c v\u1EE5"), /*#__PURE__*/React.createElement("dd", null, profile.position || '—')), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, "Ph\xF2ng ban"), /*#__PURE__*/React.createElement("dd", null, profile.dept || '—')), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, "L\u1ECBch l\xE0m vi\u1EC7c"), /*#__PURE__*/React.createElement("dd", null, LaborVN.SCHEDULES[sch].short)))), /*#__PURE__*/React.createElement("section", {
    className: "rp-kpis",
    "aria-label": "S\u1ED1 li\u1EC7u ch\xEDnh"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rp-kpi"
  }, /*#__PURE__*/React.createElement("span", null, "T\u1ED5ng gi\u1EDD l\xE0m vi\u1EC7c"), /*#__PURE__*/React.createElement("b", null, fmtH(d.total), /*#__PURE__*/React.createElement("small", null, " gi\u1EDD")), /*#__PURE__*/React.createElement("em", null, d.workDays, " ng\xE0y c\xF3 l\xE0m vi\u1EC7c")), /*#__PURE__*/React.createElement("div", {
    className: "rp-kpi"
  }, /*#__PURE__*/React.createElement("span", null, "Gi\u1EDD c\xF4ng th\u01B0\u1EDDng"), /*#__PURE__*/React.createElement("b", {
    className: "rp-blue"
  }, fmtH(d.normal), /*#__PURE__*/React.createElement("small", null, " gi\u1EDD")), /*#__PURE__*/React.createElement("em", null, fmtPct(pct(d.normal, d.total)), " t\u1ED5ng gi\u1EDD")), /*#__PURE__*/React.createElement("div", {
    className: "rp-kpi"
  }, /*#__PURE__*/React.createElement("span", null, "T\u0103ng ca (OT)"), /*#__PURE__*/React.createElement("b", {
    className: "rp-orange"
  }, fmtH(d.ot), /*#__PURE__*/React.createElement("small", null, " gi\u1EDD")), /*#__PURE__*/React.createElement("em", null, fmtPct(pct(d.ot, d.total)), " t\u1ED5ng gi\u1EDD")), /*#__PURE__*/React.createElement("div", {
    className: "rp-kpi"
  }, /*#__PURE__*/React.createElement("span", null, "Ngh\u1EC9"), /*#__PURE__*/React.createElement("b", null, d.leaveDays, /*#__PURE__*/React.createElement("small", null, " ng\xE0y")), /*#__PURE__*/React.createElement("em", null, d.leaveHours > 0 ? `${fmtH(d.leaveHours)} giờ` : 'không có')), /*#__PURE__*/React.createElement("div", {
    className: `rp-kpi ${d.missing.length ? 'rp-warn' : ''}`
  }, /*#__PURE__*/React.createElement("span", null, "Ng\xE0y ch\u01B0a ch\u1EA5m"), /*#__PURE__*/React.createElement("b", null, d.missing.length, /*#__PURE__*/React.createElement("small", null, " ng\xE0y")), /*#__PURE__*/React.createElement("em", null, d.missing.length ? '⚠ ' + d.missing.map(fmtDM).join(', ') : '✓ đủ ngày làm việc'))), /*#__PURE__*/React.createElement("section", {
    className: "rp-sec"
  }, /*#__PURE__*/React.createElement("h2", null, "Gi\u1EDD l\xE0m theo ng\xE0y"), /*#__PURE__*/React.createElement("div", {
    className: "rp-chartwrap"
  }, /*#__PURE__*/React.createElement(DailyChart, {
    days: d.days
  })), /*#__PURE__*/React.createElement("div", {
    className: "rp-legend"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
    style: {
      background: '#1d4ed8'
    }
  }), "Gi\u1EDD th\u01B0\u1EDDng"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
    style: {
      background: '#ea580c'
    }
  }), "T\u0103ng ca"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
    style: {
      background: '#fef3c7',
      border: '1px solid #fcd34d'
    }
  }), "Ng\xE0y l\u1EC5 / ngh\u1EC9 b\xF9"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
    style: {
      background: '#f1f5f9',
      border: '1px solid #cbd5e1'
    }
  }), "Ng\xE0y ngh\u1EC9 h\u1EB1ng tu\u1EA7n"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", {
    className: "rp-leave"
  }, "P"), " Ngh\u1EC9 ph\xE9p / \u1ED1m"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
    className: "rp-dot"
  }), "Ch\u01B0a ch\u1EA5m"))), /*#__PURE__*/React.createElement("div", {
    className: "rp-cols"
  }, /*#__PURE__*/React.createElement("section", {
    className: "rp-sec"
  }, /*#__PURE__*/React.createElement("h2", null, "Theo d\u1EF1 \xE1n"), d.projectList.length ? /*#__PURE__*/React.createElement("table", {
    className: "rp-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "D\u1EF1 \xE1n / WBS"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "Ng\xE0y"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "Th\u01B0\u1EDDng"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "OT"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "T\u1ED5ng"), /*#__PURE__*/React.createElement("th", {
    className: "rp-wbar"
  }, "T\u1EF7 l\u1EC7"))), /*#__PURE__*/React.createElement("tbody", null, d.projectList.map(p => /*#__PURE__*/React.createElement("tr", {
    key: p.wbs + p.name
  }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    className: "rp-name"
  }, p.name), p.wbs && /*#__PURE__*/React.createElement("div", {
    className: "rp-mono"
  }, p.wbs)), /*#__PURE__*/React.createElement("td", {
    className: "r"
  }, p.days), /*#__PURE__*/React.createElement("td", {
    className: "r"
  }, fmtH(p.normal)), /*#__PURE__*/React.createElement("td", {
    className: "r"
  }, fmtH(p.ot)), /*#__PURE__*/React.createElement("td", {
    className: "r b"
  }, fmtH(p.total)), /*#__PURE__*/React.createElement("td", {
    className: "rp-wbar"
  }, /*#__PURE__*/React.createElement(Bar, {
    value: p.total,
    max: maxProj
  }), /*#__PURE__*/React.createElement("span", {
    className: "rp-pct"
  }, fmtPct(pct(p.total, d.total)))))))) : /*#__PURE__*/React.createElement("p", {
    className: "rp-empty"
  }, "Ch\u01B0a c\xF3 gi\u1EDD l\xE0m vi\u1EC7c trong k\u1EF3.")), /*#__PURE__*/React.createElement("section", {
    className: "rp-sec"
  }, /*#__PURE__*/React.createElement("h2", null, "Theo ho\u1EA1t \u0111\u1ED9ng"), d.activityList.length ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("table", {
    className: "rp-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "M\xE3 \xB7 Ho\u1EA1t \u0111\u1ED9ng"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "Gi\u1EDD"), /*#__PURE__*/React.createElement("th", {
    className: "rp-wbar"
  }, "T\u1EF7 l\u1EC7"))), /*#__PURE__*/React.createElement("tbody", null, d.activityList.map(a => /*#__PURE__*/React.createElement("tr", {
    key: a.code
  }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
    className: "rp-mono"
  }, a.code), " ", a.desc), /*#__PURE__*/React.createElement("td", {
    className: "r b"
  }, fmtH(a.hours)), /*#__PURE__*/React.createElement("td", {
    className: "rp-wbar"
  }, /*#__PURE__*/React.createElement(Bar, {
    value: a.hours,
    max: maxAct
  }), /*#__PURE__*/React.createElement("span", {
    className: "rp-pct"
  }, fmtPct(pct(a.hours, d.total)))))))), /*#__PURE__*/React.createElement("h3", null, "Theo nh\xF3m c\xF4ng vi\u1EC7c"), /*#__PURE__*/React.createElement("ul", {
    className: "rp-cats"
  }, d.catList.map(c => /*#__PURE__*/React.createElement("li", {
    key: c.cat
  }, /*#__PURE__*/React.createElement("span", null, c.label), /*#__PURE__*/React.createElement("b", null, fmtH(c.hours), " gi\u1EDD \xB7 ", fmtPct(pct(c.hours, d.total))))))) : /*#__PURE__*/React.createElement("p", {
    className: "rp-empty"
  }, "Ch\u01B0a c\xF3 ho\u1EA1t \u0111\u1ED9ng trong k\u1EF3."))), /*#__PURE__*/React.createElement("div", {
    className: "rp-cols"
  }, /*#__PURE__*/React.createElement("section", {
    className: "rp-sec"
  }, /*#__PURE__*/React.createElement("h2", null, "Gi\u1EDD c\xF4ng theo lo\u1EA1i"), /*#__PURE__*/React.createElement("table", {
    className: "rp-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Lo\u1EA1i gi\u1EDD"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "H\u1EC7 s\u1ED1"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "Gi\u1EDD"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "T\u1EF7 l\u1EC7"))), /*#__PURE__*/React.createElement("tbody", null, otTypes.length ? otTypes.map(t => /*#__PURE__*/React.createElement("tr", {
    key: t.code
  }, /*#__PURE__*/React.createElement("td", null, t.label.replace(/ \(\d+%\)$/, '')), /*#__PURE__*/React.createElement("td", {
    className: "r"
  }, LaborVN.OT_RATES[t.code], "%"), /*#__PURE__*/React.createElement("td", {
    className: "r b"
  }, fmtH(d.byType[t.code])), /*#__PURE__*/React.createElement("td", {
    className: "r"
  }, fmtPct(pct(d.byType[t.code], d.total))))) : /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "4",
    className: "rp-empty"
  }, "Ch\u01B0a c\xF3 gi\u1EDD l\xE0m vi\u1EC7c."))), /*#__PURE__*/React.createElement("tfoot", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "T\u1ED5ng"), /*#__PURE__*/React.createElement("td", null), /*#__PURE__*/React.createElement("td", {
    className: "r b"
  }, fmtH(d.total)), /*#__PURE__*/React.createElement("td", {
    className: "r"
  }, "100%")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "2"
  }, "Gi\u1EDD quy \u0111\u1ED5i theo h\u1EC7 s\u1ED1"), /*#__PURE__*/React.createElement("td", {
    className: "r b"
  }, fmtH(d.weighted)), /*#__PURE__*/React.createElement("td", null))))), /*#__PURE__*/React.createElement("section", {
    className: "rp-sec"
  }, /*#__PURE__*/React.createElement("h2", null, "Ngh\u1EC9 & ng\xE0y l\u1EC5"), /*#__PURE__*/React.createElement("table", {
    className: "rp-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Lo\u1EA1i ngh\u1EC9"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "Ng\xE0y"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "Gi\u1EDD"))), /*#__PURE__*/React.createElement("tbody", null, d.leaveList.length ? d.leaveList.map(l => /*#__PURE__*/React.createElement("tr", {
    key: l.code
  }, /*#__PURE__*/React.createElement("td", null, l.label, /*#__PURE__*/React.createElement("div", {
    className: "rp-muted"
  }, leaveDates(l))), /*#__PURE__*/React.createElement("td", {
    className: "r b"
  }, l.days), /*#__PURE__*/React.createElement("td", {
    className: "r"
  }, fmtH(l.hours)))) : /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "3",
    className: "rp-empty"
  }, "Kh\xF4ng ngh\u1EC9 ph\xE9p / \u1ED1m / kh\xF4ng l\u01B0\u01A1ng trong k\u1EF3.")))), /*#__PURE__*/React.createElement("h3", null, "Ng\xE0y l\u1EC5 trong k\u1EF3"), d.holidays.length ? /*#__PURE__*/React.createElement("ul", {
    className: "rp-list"
  }, d.holidays.map(h => /*#__PURE__*/React.createElement("li", {
    key: h.date
  }, /*#__PURE__*/React.createElement("b", null, fmtDM(h.date)), " ", h.name))) : /*#__PURE__*/React.createElement("p", {
    className: "rp-muted"
  }, "Kh\xF4ng c\xF3 ng\xE0y l\u1EC5."))), /*#__PURE__*/React.createElement("footer", {
    className: "rp-foot"
  }, /*#__PURE__*/React.createElement("p", null, "Gi\u1EDD t\u0103ng ca t\xEDnh theo B\u1ED9 lu\u1EADt Lao \u0111\u1ED9ng 2019 (\u0110i\u1EC1u 98, 106) v\xE0 Ngh\u1ECB \u0111\u1ECBnh 145/2020 (\u0110i\u1EC1u 57). Chi ti\u1EBFt t\u1EEBng d\xF2ng xem file b\u1EA3ng ch\u1EA5m c\xF4ng Excel. L\u1EADp ng\xE0y ", fmtDMY(getTodayLocal()), " t\u1EEB Timesheet c\xE1 nh\xE2n (", d.entries, " d\xF2ng ch\u1EA5m c\xF4ng)."), /*#__PURE__*/React.createElement("div", {
    className: "rp-sign"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", null, "Ng\u01B0\u1EDDi lao \u0111\u1ED9ng"), /*#__PURE__*/React.createElement("i", null), profile.name || ''), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", null, "Gi\xE1m s\xE1t (PM / PE) x\xE1c nh\u1EADn"), /*#__PURE__*/React.createElement("i", null))))));
}
function Toast({
  toast,
  onClose
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "status",
    className: "fixed z-[60] left-1/2 -translate-x-1/2 bottom-24 md:bottom-6 w-max max-w-[92vw] bg-slate-900 text-white text-sm rounded-xl shadow-xl pl-4 pr-2 py-2 flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: "py-1"
  }, toast.message), toast.action && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => {
      toast.action.run();
      onClose();
    },
    className: "h-8 px-3 rounded-lg font-semibold text-blue-300 hover:bg-white/10"
  }, toast.action.label), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClose,
    "aria-label": "\u0110\xF3ng th\xF4ng b\xE1o",
    className: "w-8 h-8 grid place-items-center rounded-lg text-slate-400 hover:bg-white/10"
  }, /*#__PURE__*/React.createElement(Icons.X, null)));
}
function Field({
  label,
  htmlFor,
  hint,
  children,
  className
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: className
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: htmlFor,
    className: "block text-sm font-medium text-slate-700 mb-1"
  }, label), children, hint && /*#__PURE__*/React.createElement("p", {
    className: "mt-1 text-xs text-slate-500"
  }, hint));
}

// ---------- Thông tin nhân viên (in ở đầu bảng chấm công Excel) ----------
function ProfileCard({
  profile,
  setProfile
}) {
  const incomplete = !profile.name || !profile.empId;
  const [editing, setEditing] = useState(incomplete); // chưa đủ họ tên / mã NV → mở sẵn ô nhập
  const set = k => e => setProfile({
    ...profile,
    [k]: e.target.value
  });
  const initial = (String(profile.name || '').trim().split(/\s+/).pop() || '?').charAt(0).toUpperCase();
  const facts = [['Mã NV', profile.empId], ['Chức vụ', profile.position], ['Phòng ban', profile.dept], ['Lịch', LaborVN.SCHEDULES[scheduleOf(profile)].short]];
  return /*#__PURE__*/React.createElement("section", {
    id: "tsProfileCard",
    className: "bg-white rounded-2xl border border-slate-200 p-4",
    "aria-labelledby": "tsProfileTitle"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-10 h-10 rounded-full bg-slate-800 text-white grid place-items-center font-semibold shrink-0",
    "aria-hidden": "true"
  }, initial), /*#__PURE__*/React.createElement("div", {
    className: "min-w-0 flex-1"
  }, /*#__PURE__*/React.createElement("h2", {
    id: "tsProfileTitle",
    className: "text-xs font-medium text-slate-500"
  }, "Th\xF4ng tin nh\xE2n vi\xEAn"), /*#__PURE__*/React.createElement("p", {
    className: "font-semibold leading-6 truncate"
  }, profile.name || /*#__PURE__*/React.createElement("span", {
    className: "text-rose-600"
  }, "Ch\u01B0a c\xF3 h\u1ECD t\xEAn"))), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setEditing(!editing),
    "aria-expanded": editing,
    "aria-controls": "tsProfileForm",
    className: `${btnGhost} h-9 text-sm shrink-0`
  }, editing ? 'Xong' : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Icons.Edit, null), " S\u1EEDa"))), !editing && /*#__PURE__*/React.createElement("dl", {
    className: "mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-slate-600"
  }, facts.map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    className: "flex gap-1 min-w-0"
  }, /*#__PURE__*/React.createElement("dt", {
    className: "text-slate-400"
  }, k, ":"), /*#__PURE__*/React.createElement("dd", {
    className: `truncate ${v ? '' : 'text-rose-600'}`
  }, v || 'chưa nhập')))), editing && /*#__PURE__*/React.createElement("div", {
    id: "tsProfileForm",
    className: "mt-3 grid sm:grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "H\u1ECD v\xE0 t\xEAn",
    htmlFor: "tsName"
  }, /*#__PURE__*/React.createElement("input", {
    id: "tsName",
    className: inputCls,
    value: profile.name,
    onChange: set('name'),
    placeholder: "H\u1ECD T\xEAn",
    autoComplete: "name"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "M\xE3 nh\xE2n vi\xEAn",
    htmlFor: "tsEmpId"
  }, /*#__PURE__*/React.createElement("input", {
    id: "tsEmpId",
    className: inputCls,
    value: profile.empId,
    onChange: set('empId'),
    placeholder: "M\xE3 NV"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Ch\u1EE9c v\u1EE5",
    htmlFor: "tsPosition"
  }, /*#__PURE__*/React.createElement("input", {
    id: "tsPosition",
    className: inputCls,
    value: profile.position,
    onChange: set('position'),
    placeholder: "Ch\u1EE9c v\u1EE5"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Ph\xF2ng ban",
    htmlFor: "tsDept"
  }, /*#__PURE__*/React.createElement("input", {
    id: "tsDept",
    className: inputCls,
    value: profile.dept,
    onChange: set('dept'),
    placeholder: "Ph\xF2ng ban"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "L\u1ECBch l\xE0m vi\u1EC7c (ng\xE0y ngh\u1EC9 h\u1EB1ng tu\u1EA7n)",
    htmlFor: "tsSchedule",
    className: "sm:col-span-2",
    hint: "D\xF9ng \u0111\u1EC3 t\xEDnh OT ng\xE0y ngh\u1EC9 h\u1EB1ng tu\u1EA7n (OT2 / OT5) v\xE0 ng\xE0y ngh\u1EC9 b\xF9 khi ng\xE0y l\u1EC5 tr\xF9ng ng\xE0y ngh\u1EC9."
  }, /*#__PURE__*/React.createElement("select", {
    id: "tsSchedule",
    className: inputCls,
    value: scheduleOf(profile),
    onChange: set('schedule')
  }, Object.keys(LaborVN.SCHEDULES).map(k => /*#__PURE__*/React.createElement("option", {
    key: k,
    value: k
  }, LaborVN.SCHEDULES[k].label)))), /*#__PURE__*/React.createElement("p", {
    className: "sm:col-span-2 text-xs text-slate-500"
  }, "H\u1ECD t\xEAn, m\xE3 NV, ch\u1EE9c v\u1EE5, ph\xF2ng ban in \u1EDF \u0111\u1EA7u b\u1EA3ng ch\u1EA5m c\xF4ng Excel. T\u1EF1 l\u01B0u khi b\u1EA1n g\xF5.")));
}

// ---------- Dữ liệu dự án (dùng chung với Thống kê giờ công, nguồn Google Drive) ----------
const fmtSyncedAt = iso => {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const day = toLocalISOString(d);
  return day === getTodayLocal() ? `${hm} hôm nay` : `${hm} ${fmtDMY(day)}`;
};
function ProjectSyncCard({
  count,
  syncing,
  status,
  syncedAt,
  missing,
  onSync
}) {
  const warn = missing || status && !status.ok;
  const state = syncing ? {
    dot: 'bg-blue-500 animate-pulse',
    text: 'Đang đồng bộ…'
  } : warn ? {
    dot: 'bg-amber-500',
    text: 'Chưa đồng bộ được'
  } : syncedAt ? {
    dot: 'bg-emerald-500',
    text: `Đã đồng bộ lúc ${fmtSyncedAt(syncedAt)}`
  } : {
    dot: 'bg-slate-400',
    text: 'Đang dùng dữ liệu đã có trên máy'
  };
  return /*#__PURE__*/React.createElement("section", {
    id: "tsProjectCard",
    "aria-labelledby": "tsProjectTitle",
    className: `rounded-2xl border p-4 ${missing ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200'}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: `w-10 h-10 rounded-full grid place-items-center shrink-0 ${missing ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-700'}`,
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement(Icons.Database, null)), /*#__PURE__*/React.createElement("div", {
    className: "min-w-0 flex-1"
  }, /*#__PURE__*/React.createElement("h2", {
    id: "tsProjectTitle",
    className: "text-xs font-medium text-slate-500",
    title: "D\xF9ng chung v\u1EDBi Th\u1ED1ng k\xEA gi\u1EDD c\xF4ng d\u1EF1 \xE1n (ngu\u1ED3n Google Drive)"
  }, "D\u1EEF li\u1EC7u d\u1EF1 \xE1n"), /*#__PURE__*/React.createElement("p", {
    className: "font-semibold leading-6"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tabular-nums"
  }, count), " d\u1EF1 \xE1n")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onSync,
    disabled: syncing,
    className: `${btnGhost} h-9 text-sm shrink-0`
  }, /*#__PURE__*/React.createElement(Icons.Refresh, null), " ", syncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay')), /*#__PURE__*/React.createElement("p", {
    className: "mt-2 text-sm text-slate-600 flex items-center gap-2",
    "aria-live": "polite"
  }, /*#__PURE__*/React.createElement("span", {
    className: `w-2 h-2 rounded-full shrink-0 ${state.dot}`,
    "aria-hidden": "true"
  }), state.text), warn && !syncing && /*#__PURE__*/React.createElement("p", {
    role: "alert",
    className: "mt-1 text-sm text-amber-900"
  }, missing && /*#__PURE__*/React.createElement("b", null, "Ch\u01B0a c\xF3 danh s\xE1ch d\u1EF1 \xE1n tr\xEAn m\xE1y n\xE0y. "), status ? status.text : '', missing ? ' Bạn vẫn chấm công bình thường; gợi ý tên dự án / WBS sẽ có sau khi đồng bộ.' : ''));
}

// ---------- Sao lưu & khôi phục ----------
function SettingsPanel({
  onBackup,
  onRestore,
  onReset,
  onDone
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "px-5 py-5 space-y-6"
  }, /*#__PURE__*/React.createElement("section", {
    className: "space-y-2"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-semibold"
  }, "Sao l\u01B0u & kh\xF4i ph\u1EE5c"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-500"
  }, "D\u1EEF li\u1EC7u Timesheet ch\u1EC9 n\u1EB1m tr\xEAn tr\xECnh duy\u1EC7t n\xE0y \u2014 n\xEAn sao l\u01B0u \u0111\u1ECBnh k\u1EF3 ho\u1EB7c tr\u01B0\u1EDBc khi \u0111\u1ED5i m\xE1y."), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onBackup,
    className: btnGhost
  }, /*#__PURE__*/React.createElement(Icons.Download, null), " Backup"), /*#__PURE__*/React.createElement("label", {
    className: `${btnGhost} cursor-pointer`
  }, /*#__PURE__*/React.createElement(Icons.Upload, null), " Restore", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: ".json,application/json",
    onChange: onRestore,
    className: "sr-only"
  })))), /*#__PURE__*/React.createElement("section", {
    className: "space-y-2 pt-5 border-t border-slate-200"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-semibold text-rose-700 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Icons.Alert, null), " V\xF9ng nguy hi\u1EC3m"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-500"
  }, "X\xF3a h\u1EBFt l\u1ECBch s\u1EED ch\u1EA5m c\xF4ng v\xE0 th\xF4ng tin c\xE1 nh\xE2n tr\xEAn m\xE1y n\xE0y. Kh\xF4ng th\u1EC3 kh\xF4i ph\u1EE5c (tr\u1EEB khi c\xF3 b\u1EA3n Backup)."), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onReset,
    className: "inline-flex items-center justify-center h-10 px-4 rounded-lg border border-rose-300 text-rose-700 font-semibold hover:bg-rose-50"
  }, "X\xF3a to\xE0n b\u1ED9 d\u1EEF li\u1EC7u")), /*#__PURE__*/React.createElement("div", {
    className: "pt-2"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onDone,
    className: `${btnPrimary} w-full`
  }, "Xong")));
}

// ---------- Form thêm / sửa chấm công ----------
function EntryForm({
  onSave,
  onCancel,
  onDelete,
  defaultDate,
  initialData,
  entries,
  projects,
  sch
}) {
  const [formData, setFormData] = useState({
    date: defaultDate,
    startTime: '08:00',
    endTime: '17:00',
    breakTime: '1',
    otMode: 'auto',
    otType: 'NORMAL',
    projectName: '',
    workNumber: '',
    activityCode: '1110',
    dutyHour: '0',
    remarks: ''
  });
  // người dùng đã tự sửa ô "Nghỉ" → không tự đổi nữa (dòng đang sửa: giữ nguyên số đã lưu)
  const [breakTouched, setBreakTouched] = useState(!!initialData);
  const [customCode, setCustomCode] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const isHR = useMemo(() => {
    const act = ACTIVITY_META.find(a => a.id === formData.activityCode);
    return act && act.cat === 'HR';
  }, [formData.activityCode]);
  const auto = formData.otMode === 'auto';
  // Tự động: ca đi qua trọn giờ nghỉ trưa 12:00–13:00 → gợi ý nghỉ 1 giờ, không thì 0
  useEffect(() => {
    if (!auto || breakTouched) return;
    const b = LaborVN.coversLunch(formData.startTime, formData.endTime) ? '1' : '0';
    if (formData.breakTime !== b) setFormData(prev => ({
      ...prev,
      breakTime: b
    }));
  }, [auto, breakTouched, formData.startTime, formData.endTime]);
  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        otMode: initialData.otMode || 'manual'
      }); // dòng cũ: giữ loại giờ đã chọn
      const isStandard = ACTIVITY_META.some(opt => opt.id === initialData.activityCode);
      if (!isStandard) {
        setCustomCode(initialData.activityCode);
        setFormData(prev => ({
          ...prev,
          activityCode: 'OTHER'
        }));
      }
    } else {
      fillFromDate(defaultDate);
    }
  }, [initialData]);
  const fillFromDate = targetDate => {
    if (!entries || entries.length === 0) {
      setFormData(prev => ({
        ...prev,
        projectName: '',
        workNumber: '',
        activityCode: '1110'
      }));
      return;
    }
    const prevDateStr = addDaysLocal(targetDate, -1);
    let sourceEntry = entries.find(e => e.date === prevDateStr);
    if (!sourceEntry) {
      sourceEntry = entries.reduce((a, b) => b.date > a.date ? b : a);
    }
    if (sourceEntry) {
      setFormData(prev => ({
        ...prev,
        projectName: sourceEntry.projectName,
        workNumber: sourceEntry.workNumber,
        activityCode: sourceEntry.activityCode || '1110'
      }));
      const isStandard = ACTIVITY_META.some(opt => opt.id === sourceEntry.activityCode);
      if (!isStandard && sourceEntry.activityCode !== 'OTHER') {
        setCustomCode(sourceEntry.activityCode);
        setFormData(prev => ({
          ...prev,
          activityCode: 'OTHER'
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        projectName: '',
        workNumber: '',
        activityCode: '1110'
      }));
    }
  };
  const handleDateChange = e => {
    const newDate = e.target.value;
    setFormData(prev => ({
      ...prev,
      date: newDate
    }));
    if (!initialData) fillFromDate(newDate);
  };
  const handleActivityCodeChange = e => {
    const code = e.target.value;
    let newData = {
      ...formData,
      activityCode: code
    };
    if (code === '6090') {
      newData.startTime = '';
      newData.endTime = '';
      newData.breakTime = '0';
    }
    setFormData(newData);
  };

  // Chọn tay một loại giờ cho cả dòng (như trước): giờ thường nghỉ 1 giờ, OT không nghỉ
  const handleOtChange = e => {
    const type = e.target.value;
    setFormData({
      ...formData,
      otType: type,
      breakTime: type !== 'NORMAL' ? '0' : '1'
    });
  };
  const toggleAuto = e => {
    const on = e.target.checked;
    setFormData(prev => ({
      ...prev,
      otMode: on ? 'auto' : 'manual',
      otType: on ? prev.otType : LaborVN.dominant(preview)
    }));
    if (on) setBreakTouched(false);
  };
  const handleProjectNameSearch = val => {
    setFormData(prev => ({
      ...prev,
      projectName: val
    }));
    if (val.length > 0 && projects) {
      const searchTerms = normalizeString(val).split(" ").filter(Boolean);
      const matches = projects.filter(p => {
        const pName = normalizeString(p.projectName);
        const pNum = normalizeString(p.workNumber);
        return searchTerms.every(t => pName.includes(t) || pNum.includes(t));
      });
      setSuggestions(matches);
    } else {
      setSuggestions([]);
    }
  };
  const selectProject = proj => {
    setFormData(prev => ({
      ...prev,
      workNumber: proj.workNumber,
      projectName: proj.projectName
    }));
    setSuggestions([]);
  };
  const handleSubmit = ev => {
    if (ev) ev.preventDefault();
    if (!formData.date) return alert("Vui lòng chọn ngày!");
    const finalData = {
      ...formData
    };
    if (finalData.activityCode === 'OTHER') {
      if (!customCode) return alert("Vui lòng nhập mã code!");
      finalData.activityCode = customCode;
    }
    if (finalData.otMode === 'auto') finalData.otType = LaborVN.dominant(preview); // loại giờ chính (hiển thị gọn / dữ liệu cũ)
    onSave(finalData);
  };
  const set = k => e => setFormData({
    ...formData,
    [k]: e.target.value
  });
  const hours = calculateHours(formData.startTime, formData.endTime, formData.breakTime);
  const w = formData.date ? weekdayOf(formData.date) : null;
  const holi = holidayOf(formData.date, sch);
  const leave = LaborVN.LEAVE_CODES.includes(formData.activityCode === 'OTHER' ? customCode : formData.activityCode);
  // giờ thường / OT của dòng đang nhập, xét cả các dòng khác (OT7: đêm sau khi đã làm thêm buổi tối)
  const preview = useMemo(() => LaborVN.breakdown({
    ...formData,
    id: initialData ? initialData.id : undefined,
    activityCode: formData.activityCode === 'OTHER' ? customCode : formData.activityCode
  }, sch, entries, entryHours), [formData, customCode, sch, entries]);
  const dayNote = w === null ? null : holi ? `${WEEKDAYS_LONG[w]} — ${holi.name}: làm việc tính OT3 (ngày) / OT6 (đêm)` : LaborVN.isRestDay(formData.date, sch) ? `${WEEKDAYS_LONG[w]} — ngày nghỉ hằng tuần: làm việc tính OT2 (ngày) / OT5 (đêm)` : w === 6 && sch === 'mon-sat-am' ? 'Thứ 7 — sáng giờ thường, từ 12:00 tính OT2 (ngày nghỉ hằng tuần)' : WEEKDAYS_LONG[w];
  return /*#__PURE__*/React.createElement("form", {
    onSubmit: handleSubmit,
    className: "min-h-full flex flex-col",
    noValidate: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "px-5 py-5 space-y-6 flex-1"
  }, /*#__PURE__*/React.createElement("section", {
    className: "space-y-3"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-semibold text-slate-900"
  }, "Th\u1EDDi gian"), /*#__PURE__*/React.createElement(Field, {
    label: "Ng\xE0y",
    htmlFor: "tsDate",
    hint: dayNote
  }, /*#__PURE__*/React.createElement("input", {
    id: "tsDate",
    "data-autofocus": true,
    type: "date",
    value: formData.date,
    onChange: handleDateChange,
    className: inputCls,
    required: true
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-3 gap-3"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "T\u1EEB",
    htmlFor: "tsFrom"
  }, /*#__PURE__*/React.createElement("input", {
    id: "tsFrom",
    type: "time",
    value: formData.startTime,
    onChange: set('startTime'),
    className: `${inputCls} text-center px-1`
  })), /*#__PURE__*/React.createElement(Field, {
    label: "\u0110\u1EBFn",
    htmlFor: "tsTo"
  }, /*#__PURE__*/React.createElement("input", {
    id: "tsTo",
    type: "time",
    value: formData.endTime,
    onChange: set('endTime'),
    className: `${inputCls} text-center px-1`
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Ngh\u1EC9 (gi\u1EDD)",
    htmlFor: "tsBreak"
  }, /*#__PURE__*/React.createElement("input", {
    id: "tsBreak",
    type: "number",
    min: "0",
    step: "0.5",
    inputMode: "decimal",
    value: formData.breakTime,
    onChange: e => {
      setBreakTouched(true);
      set('breakTime')(e);
    },
    className: `${inputCls} text-center`
  }))), /*#__PURE__*/React.createElement("div", {
    id: "tsSplit",
    className: "rounded-lg bg-slate-50 px-3 py-2 text-sm",
    "aria-live": "polite"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-slate-600"
  }, "S\u1ED1 gi\u1EDD t\xEDnh c\xF4ng"), /*#__PURE__*/React.createElement("span", {
    className: "font-semibold tabular-nums"
  }, fmtH(hours), " gi\u1EDD")), auto && /*#__PURE__*/React.createElement("div", {
    className: "mt-2 pt-2 border-t border-slate-200"
  }, /*#__PURE__*/React.createElement(HourPills, {
    bd: preview
  }), /*#__PURE__*/React.createElement("p", {
    className: "mt-1.5 text-xs text-slate-500"
  }, leave ? 'Nghỉ phép / ốm / không lương: không tính làm thêm giờ.' : 'Tự tính theo Bộ luật Lao động 2019 (Điều 98, 106) và NĐ 145/2020: giờ thường 08:00–12:00, 13:00–17:00; ban đêm 22:00–06:00.'))), /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-2 min-h-11 text-sm text-slate-700 cursor-pointer"
  }, /*#__PURE__*/React.createElement("input", {
    id: "tsAuto",
    type: "checkbox",
    checked: auto,
    onChange: toggleAuto,
    className: "w-4 h-4 shrink-0 accent-blue-700"
  }), /*#__PURE__*/React.createElement("span", null, "T\u1EF1 t\xEDnh gi\u1EDD th\u01B0\u1EDDng / OT theo Lu\u1EADt Lao \u0111\u1ED9ng ", /*#__PURE__*/React.createElement("span", {
    className: "text-slate-500"
  }, "(b\u1ECF ch\u1ECDn \u0111\u1EC3 t\u1EF1 ch\u1ECDn m\u1ED9t lo\u1EA1i gi\u1EDD cho c\u1EA3 d\xF2ng)"))), /*#__PURE__*/React.createElement("div", {
    className: "grid sm:grid-cols-2 gap-3"
  }, !auto && /*#__PURE__*/React.createElement(Field, {
    label: "Lo\u1EA1i gi\u1EDD",
    htmlFor: "tsOt"
  }, /*#__PURE__*/React.createElement("select", {
    id: "tsOt",
    value: formData.otType,
    onChange: handleOtChange,
    className: inputCls
  }, OT_TYPES.map(t => /*#__PURE__*/React.createElement("option", {
    key: t.code,
    value: t.code
  }, t.label)))), /*#__PURE__*/React.createElement(Field, {
    label: "Gi\u1EDD tr\u1EF1c (standby)",
    htmlFor: "tsDuty"
  }, /*#__PURE__*/React.createElement("input", {
    id: "tsDuty",
    type: "number",
    min: "0",
    step: "0.5",
    inputMode: "decimal",
    value: formData.dutyHour,
    onChange: set('dutyHour'),
    className: inputCls
  })))), /*#__PURE__*/React.createElement("section", {
    className: "space-y-3 pt-5 border-t border-slate-200"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-semibold text-slate-900"
  }, "C\xF4ng vi\u1EC7c"), /*#__PURE__*/React.createElement(Field, {
    label: "M\xE3 c\xF4ng vi\u1EC7c",
    htmlFor: "tsAct"
  }, /*#__PURE__*/React.createElement("select", {
    id: "tsAct",
    value: formData.activityCode,
    onChange: handleActivityCodeChange,
    className: `${inputCls} font-medium text-blue-900`
  }, ACTIVITY_META.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt.id,
    value: opt.id
  }, opt.desc)), /*#__PURE__*/React.createElement("option", {
    value: "OTHER"
  }, "Kh\xE1c")), formData.activityCode === 'OTHER' && /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: customCode,
    onChange: e => setCustomCode(e.target.value),
    placeholder: "Nh\u1EADp m\xE3 code",
    "aria-label": "M\xE3 c\xF4ng vi\u1EC7c kh\xE1c",
    className: `${inputCls} mt-2 bg-amber-50`
  })), /*#__PURE__*/React.createElement(Field, {
    label: "T\xEAn d\u1EF1 \xE1n",
    htmlFor: "tsProject",
    hint: projects.length ? `Gõ tên hoặc WBS để chọn trong ${projects.length} dự án.` : null
  }, /*#__PURE__*/React.createElement("div", {
    className: "relative"
  }, /*#__PURE__*/React.createElement("input", {
    id: "tsProject",
    type: "text",
    autoComplete: "off",
    value: formData.projectName,
    role: "combobox",
    "aria-expanded": suggestions.length > 0,
    "aria-controls": "tsProjectList",
    "aria-autocomplete": "list",
    onChange: e => handleProjectNameSearch(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter' && suggestions.length) {
        e.preventDefault();
        selectProject(suggestions[0]);
      }
      if (e.key === 'Escape' && suggestions.length) {
        e.stopPropagation();
        setSuggestions([]);
      }
    },
    onBlur: () => setTimeout(() => setSuggestions([]), 150),
    className: inputCls,
    placeholder: "Nh\u1EADp t\xEAn d\u1EF1 \xE1n..."
  }), suggestions.length > 0 && /*#__PURE__*/React.createElement("div", {
    id: "tsProjectList",
    className: "suggestion-list",
    role: "listbox"
  }, suggestions.slice(0, 50).map((p, idx) => /*#__PURE__*/React.createElement("div", {
    key: idx,
    role: "option",
    "aria-selected": idx === 0,
    onMouseDown: ev => {
      ev.preventDefault();
      selectProject(p);
    },
    className: "suggestion-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-semibold"
  }, p.projectName), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    className: "text-slate-500 text-xs font-mono"
  }, p.workNumber)))))), /*#__PURE__*/React.createElement(Field, {
    label: "Work Number / WBS / M\xE3 chi ph\xED",
    htmlFor: "tsWbs"
  }, isHR ? /*#__PURE__*/React.createElement("select", {
    id: "tsWbs",
    value: formData.workNumber,
    onChange: set('workNumber'),
    className: inputCls
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "-- Ch\u1ECDn lo\u1EA1i ngh\u1EC9 --"), HR_WORK_NUMBERS.map(wn => /*#__PURE__*/React.createElement("option", {
    key: wn,
    value: wn
  }, wn))) : /*#__PURE__*/React.createElement("input", {
    id: "tsWbs",
    type: "text",
    value: formData.workNumber,
    onChange: set('workNumber'),
    className: `${inputCls} font-mono`
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Ghi ch\xFA",
    htmlFor: "tsRemarks"
  }, /*#__PURE__*/React.createElement("input", {
    id: "tsRemarks",
    type: "text",
    value: formData.remarks || '',
    onChange: set('remarks'),
    className: inputCls,
    placeholder: "Ghi ch\xFA th\xEAm..."
  })))), /*#__PURE__*/React.createElement("div", {
    className: "sticky bottom-0 bg-white border-t border-slate-200 px-5 py-3 flex items-center gap-3"
  }, onDelete && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onDelete,
    className: "h-11 px-3 rounded-lg text-rose-700 font-semibold hover:bg-rose-50 inline-flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Icons.Trash, null), " X\xF3a"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onCancel,
    className: `${btnGhost} h-11 flex-1 md:flex-none md:ml-auto`
  }, "H\u1EE7y"), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: `${btnPrimary} h-11 flex-1 md:flex-none md:min-w-[8rem]`
  }, "L\u01B0u")));
}
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(/*#__PURE__*/React.createElement(App, null));
