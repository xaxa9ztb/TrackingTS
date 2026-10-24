/* FILE ĐƯỢC SINH TỰ ĐỘNG từ src/app.jsx bằng `npm run build` — đừng sửa trực tiếp. */
const {
  useState,
  useEffect,
  useMemo,
  useCallback
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
const OT_TYPES = [{
  code: 'NORMAL',
  label: 'Giờ công thường'
}, {
  code: 'OT1',
  label: 'OT1 (17:00-22:00 T2-T7)'
}, {
  code: 'OT2',
  label: 'OT2 (08:00-22:00 CN/Chiều T7)'
}, {
  code: 'OT3',
  label: 'OT3 (08:00-22:00 Lễ)'
}, {
  code: 'OT4',
  label: 'OT4 (22:00-06:00 Đêm)'
}, {
  code: 'OT5',
  label: 'OT5 (22:00-06:00 Đêm T7/CN)'
}, {
  code: 'OT6',
  label: 'OT6 (22:00-06:00 Đêm Lễ)'
}, {
  code: 'OT7',
  label: 'OT7 (Đêm có OT trước)'
}];

// COMMON VIETNAMESE HOLIDAYS
const VN_HOLIDAYS = ['01-01', '04-30', '05-01', '09-02', '09-03',
// Fixed
// 2024
'2024-02-08', '2024-02-09', '2024-02-10', '2024-02-11', '2024-02-12', '2024-02-13', '2024-02-14',
// Tet 2024
'2024-04-18',
// Hung Kings 2024
// 2025
'2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31', '2025-02-01',
// Tet 2025
'2025-04-07',
// Hung Kings 2025
// 2026
'2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20',
// Tet 2026
'2026-04-26', '2026-04-27',
// Hung Kings 2026
// 2027
'2027-02-05', '2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09',
// Tet 2027
'2027-04-16' // Hung Kings 2027
];
const isVietnameseHoliday = dateStr => {
  if (!dateStr) return false;
  if (VN_HOLIDAYS.includes(dateStr)) return true;
  const [y, m, d] = dateStr.split('-');
  const md = `${m}-${d}`;
  if (['01-01', '04-30', '05-01', '09-02', '09-03'].includes(md)) return true;
  return false;
};
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
function App() {
  const [view, setView] = useState('list');
  const [entries, setEntries] = useState([]);
  const [profile, setProfile] = useState({
    name: '',
    empId: '',
    position: '',
    dept: 'NI',
    sheetId: '1OuwcTThIkpC_871JIv_D5fd29-jPsoqwsyP55AFAd_I'
  });
  const [projects, setProjects] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(getTodayLocal().slice(0, 7));
  const [editingEntry, setEditingEntry] = useState(null);
  const [syncStatus, setSyncStatus] = useState('');
  const [projSyncing, setProjSyncing] = useState(false);
  const [projStatus, setProjStatus] = useState('');
  useEffect(() => {
    const savedEntries = localStorage.getItem('ts_entries_v28');
    const savedProfile = localStorage.getItem('ts_profile_v28');
    const savedProjects = localStorage.getItem('ts_projects_v28');
    if (savedEntries) setEntries(JSON.parse(savedEntries));
    if (savedProfile) setProfile(JSON.parse(savedProfile));
    // Bộ công cụ: điền sẵn họ tên / mã NV / chức vụ từ phiên đăng nhập — chỉ điền ô còn trống
    const who = typeof Session !== 'undefined' ? Session.current() : null;
    if (who && !who.admin) setProfile(p => ({
      ...p,
      name: p.name || who.name,
      empId: p.empId || who.empId,
      position: p.position || who.position
    }));
    if (savedProjects) setProjects(JSON.parse(savedProjects));
    // Dự án dùng chung: lấy ngay bản trên máy (cùng dữ liệu với Thống kê giờ công);
    // máy chưa có thì tải từ Google Drive; vẫn không có thì mở Cài đặt như trước.
    (async () => {
      const shared = await loadSharedProjects();
      if (shared.length) {
        setProjects(shared);
        return;
      }
      const n = await syncSharedProjects();
      if (!n && !savedProjects) setView('settings');
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
  const period = useMemo(() => getSalaryPeriod(currentMonth), [currentMonth]);
  const monthlyEntries = useMemo(() => {
    // IMPORTANT: String comparison works correctly for YYYY-MM-DD
    return entries.filter(e => e.date >= period.start && e.date <= period.end).sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, period]);
  const stats = useMemo(() => {
    let normal = 0,
      ot = 0;
    monthlyEntries.forEach(e => {
      const h = calculateHours(e.startTime, e.endTime, e.breakTime);
      if (e.otType === 'NORMAL') normal += h;else ot += h;
    });
    return {
      normal: normal.toFixed(1),
      ot: ot.toFixed(1)
    };
  }, [monthlyEntries]);

  // Đồng bộ Dự án: tải bản mới nhất từ Google Drive vào kho dùng chung rồi đọc lại.
  // Drive lỗi (mất mạng / hết hạn mức) thì giữ bản đang có trên máy. Trả về số dự án.
  const syncSharedProjects = async () => {
    setProjSyncing(true);
    setProjStatus('');
    let reason = '';
    try {
      if (typeof Cloud !== 'undefined' && Cloud.configured()) await Cloud.loadFromDrive();
    } catch (err) {
      reason = /QUOTA/.test(err.message) ? 'Google Drive đang giới hạn lượt tải hôm nay' : 'Không tải được từ Google Drive';
    }
    const shared = await loadSharedProjects();
    if (shared.length) setProjects(shared);
    setProjSyncing(false);
    setProjStatus(shared.length ? reason ? `${reason} — đang dùng ${shared.length} dự án đã có trên máy.` : `Đã cập nhật ${shared.length} dự án.` : reason ? `${reason}. Vui lòng thử lại sau.` : 'Chưa có dữ liệu Dự án — vui lòng liên hệ quản trị viên.');
    return shared.length;
  };
  const handleSyncProjects = () => {
    syncSharedProjects();
  };
  const handleDelete = id => {
    if (confirm('Xóa dòng này?')) setEntries(entries.filter(e => e.id !== id));
  };
  const handleResetData = () => {
    if (confirm("CẢNH BÁO: Bạn có chắc chắn muốn xóa TOÀN BỘ dữ liệu? Hành động này sẽ xóa sạch lịch sử chấm công và thông tin cá nhân. Không thể hoàn tác!")) {
      if (confirm("Xác nhận lần 2: Xóa tất cả dữ liệu?")) {
        localStorage.removeItem('ts_entries_v28');
        localStorage.removeItem('ts_profile_v28');
        localStorage.removeItem('ts_projects_v28');
        setEntries([]);
        setProfile({
          name: '',
          empId: '',
          position: '',
          dept: 'NI',
          sheetId: '1OuwcTThIkpC_871JIv_D5fd29-jPsoqwsyP55AFAd_I'
        });
        setProjects([]);
        alert("Đã xóa dữ liệu thành công! Ứng dụng đã được reset.");
      }
    }
  };
  const handleNewEntry = () => {
    let defaultD = getTodayLocal();
    if (entries && entries.length > 0) {
      const latest = entries.reduce((a, b) => b.date > a.date ? b : a);
      defaultD = addDaysLocal(latest.date, 1);
    }
    setEditingEntry(null);
    setView('form_new_' + defaultD);
  };
  const handleSaveEntry = data => {
    if (editingEntry) setEntries(entries.map(e => e.id === editingEntry.id ? {
      ...data,
      id: editingEntry.id
    } : e));else setEntries([...entries, {
      ...data,
      id: Date.now()
    }]);
    setEditingEntry(null);
    setView('list');
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
    sheet.getCell('AS3').value = new Date(hy, hm - 1, 1);

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
      row.getCell(3).value = new Date(dy, dm - 1, dd);
      row.getCell(4).value = {
        formula: `WEEKDAY(C${r})`
      };
      row.getCell(5).value = timeToExcel(e.startTime);
      row.getCell(6).value = timeToExcel(e.endTime);
      row.getCell(7).value = e.otType === 'NORMAL' ? {
        formula: normalHourFormula(r)
      } : 0;
      const brk = parseFloat(e.breakTime) || 0;
      row.getCell(8).value = brk > 0 ? brk : null;
      if (e.otType !== 'NORMAL' && OT_COL[e.otType]) {
        row.getCell(OT_COL[e.otType]).value = calculateHours(e.startTime, e.endTime, e.breakTime);
      }
      row.getCell(16).value = {
        formula: `(F${r}-E${r})*24-SUM(G${r}:O${r})`
      };
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
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.entries) setEntries(data.entries);
        if (data.profile) setProfile(data.profile);
        if (data.projects) setProjects(data.projects);
        alert("Thành công!");
      } catch (err) {
        alert("Lỗi file");
      }
    };
    reader.readAsText(file);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "max-w-md mx-auto bg-white min-h-screen shadow-2xl overflow-hidden relative flex flex-col"
  }, /*#__PURE__*/React.createElement("header", {
    className: "bg-blue-800 text-white p-4 sticky top-0 z-50 shadow-lg"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center mb-3"
  }, /*#__PURE__*/React.createElement("h1", {
    className: "font-bold text-lg flex items-center gap-2"
  }, "Timesheet ", /*#__PURE__*/React.createElement("span", {
    className: "bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded"
  }, "V35")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setView('settings')
  }, /*#__PURE__*/React.createElement(Icons.Settings, null))), /*#__PURE__*/React.createElement("div", {
    className: "bg-blue-900/50 p-2 rounded-lg flex items-center justify-between backdrop-blur-sm border border-blue-700"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-bold text-white"
  }, "K\u1EF3 l\u01B0\u01A1ng"), /*#__PURE__*/React.createElement("input", {
    type: "month",
    value: currentMonth,
    onChange: e => setCurrentMonth(e.target.value),
    className: "bg-white text-blue-900 text-sm font-bold px-2 py-1 rounded w-32 text-center"
  })), /*#__PURE__*/React.createElement("div", {
    className: "mt-3 grid grid-cols-2 gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white/10 p-2 rounded flex flex-col items-center"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] text-blue-200"
  }, "Gi\u1EDD c\xF4ng th\u01B0\u1EDDng"), /*#__PURE__*/React.createElement("span", {
    className: "font-bold text-white text-lg"
  }, stats.normal, "h")), /*#__PURE__*/React.createElement("div", {
    className: "bg-white/10 p-2 rounded flex flex-col items-center"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] text-orange-200"
  }, "T\u0103ng ca (OT)"), /*#__PURE__*/React.createElement("span", {
    className: "font-bold text-orange-300 text-lg"
  }, stats.ot, "h")))), /*#__PURE__*/React.createElement("main", {
    className: "flex-1 bg-slate-50 p-3 pb-28 overflow-y-auto"
  }, view === 'list' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-3"
  }, monthlyEntries.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-center text-slate-400 py-10"
  }, "Ch\u01B0a c\xF3 d\u1EEF li\u1EC7u (", period.label, ")") : monthlyEntries.map(e => /*#__PURE__*/React.createElement("div", {
    key: e.id,
    className: "bg-white p-3 rounded-xl shadow-sm border relative"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between border-b pb-2 mb-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-bold text-blue-800"
  }, e.date.split('-').reverse().join('/')), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setEditingEntry(e);
      setView('form');
    },
    className: "text-blue-500"
  }, /*#__PURE__*/React.createElement(Icons.Edit, null)), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleDelete(e.id),
    className: "text-red-400"
  }, /*#__PURE__*/React.createElement(Icons.Trash, null)))), /*#__PURE__*/React.createElement("div", {
    className: "text-sm flex justify-between mb-1"
  }, /*#__PURE__*/React.createElement("span", null, e.startTime, " - ", e.endTime), /*#__PURE__*/React.createElement("span", {
    className: "font-bold text-orange-600"
  }, e.otType !== 'NORMAL' ? e.otType : 'Giờ công thường')), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500 truncate"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-bold text-blue-600"
  }, "[", e.activityCode, "]"), " ", e.projectName)))), (view === 'form' || view.startsWith('form_new_')) && /*#__PURE__*/React.createElement(EntryForm, {
    initialData: editingEntry,
    defaultDate: view.startsWith('form_new_') ? view.split('_')[2] : getTodayLocal(),
    onSave: handleSaveEntry,
    onCancel: () => {
      setEditingEntry(null);
      setView('list');
    },
    entries: entries,
    projects: projects
  }), view === 'settings' && /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-5 rounded-xl space-y-6"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "font-bold text-lg text-slate-800"
  }, "C\xE0i \u0111\u1EB7t"), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-3"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "H\u1ECD T\xEAn",
    value: profile.name,
    onChange: e => setProfile({
      ...profile,
      name: e.target.value
    }),
    className: "w-full border p-2 rounded"
  }), /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "M\xE3 NV",
    value: profile.empId,
    onChange: e => setProfile({
      ...profile,
      empId: e.target.value
    }),
    className: "w-full border p-2 rounded"
  }), /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "Ch\u1EE9c v\u1EE5",
    value: profile.position,
    onChange: e => setProfile({
      ...profile,
      position: e.target.value
    }),
    className: "w-full border p-2 rounded"
  }), /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "Ph\xF2ng ban",
    value: profile.dept,
    onChange: e => setProfile({
      ...profile,
      dept: e.target.value
    }),
    className: "w-full border p-2 rounded"
  })), /*#__PURE__*/React.createElement("hr", null), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    className: "font-bold text-sm text-slate-800 mb-2 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Icons.Database, null), " D\u1EEF li\u1EC7u D\u1EF1 \xE1n"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-2"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-500"
  }, "D\xF9ng chung v\u1EDBi \u201CTh\u1ED1ng k\xEA gi\u1EDD c\xF4ng d\u1EF1 \xE1n\u201D (ngu\u1ED3n Google Drive) \u2014 kh\xF4ng c\u1EA7n nh\u1EADp g\xEC th\xEAm."), /*#__PURE__*/React.createElement("button", {
    onClick: handleSyncProjects,
    disabled: projSyncing,
    className: "bg-blue-600 text-white p-2 rounded text-sm disabled:opacity-50"
  }, /*#__PURE__*/React.createElement(Icons.Refresh, null), " ", projSyncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'), /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-green-600"
  }, projects.length, " d\u1EF1 \xE1n \u0111\xE3 l\u01B0u"), projStatus && /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-slate-600",
    role: "status"
  }, projStatus))), /*#__PURE__*/React.createElement("hr", null), /*#__PURE__*/React.createElement("div", {
    className: "bg-slate-50 p-3 rounded border grid grid-cols-2 gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: handleBackup,
    className: "bg-white border p-2 rounded text-blue-700 text-xs font-bold"
  }, /*#__PURE__*/React.createElement(Icons.Download, null), " Backup"), /*#__PURE__*/React.createElement("label", {
    className: "bg-white border p-2 rounded text-green-700 text-xs font-bold cursor-pointer flex justify-center items-center"
  }, /*#__PURE__*/React.createElement(Icons.Upload, null), " Restore ", /*#__PURE__*/React.createElement("input", {
    type: "file",
    onChange: handleRestore,
    className: "hidden"
  }))), /*#__PURE__*/React.createElement("hr", null), /*#__PURE__*/React.createElement("div", {
    className: "p-4 border border-red-200 rounded-lg bg-red-50"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-red-700 font-bold text-sm mb-2 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Icons.Alert, null), " V\xF9ng Nguy Hi\u1EC3m"), /*#__PURE__*/React.createElement("button", {
    onClick: handleResetData,
    className: "w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-bold shadow-sm transition-colors"
  }, "X\xF3a To\xE0n B\u1ED9 D\u1EEF Li\u1EC7u"), /*#__PURE__*/React.createElement("p", {
    className: "text-red-500 text-[10px] mt-2 text-center"
  }, "H\xE0nh \u0111\u1ED9ng n\xE0y s\u1EBD x\xF3a h\u1EBFt l\u1ECBch s\u1EED v\xE0 c\xE0i \u0111\u1EB7t. Kh\xF4ng th\u1EC3 kh\xF4i ph\u1EE5c.")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setView('list'),
    className: "w-full bg-slate-800 text-white p-3 rounded font-bold"
  }, "L\u01B0u th\xF4ng tin"))), view === 'list' && /*#__PURE__*/React.createElement("div", {
    className: "fixed bottom-6 right-6 flex flex-col gap-3 z-40"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: handleExportExcel,
    className: "bg-green-600 text-white w-14 h-14 rounded-full shadow-xl flex items-center justify-center border-2 border-white"
  }, /*#__PURE__*/React.createElement(Icons.Download, null)), /*#__PURE__*/React.createElement("button", {
    onClick: handleNewEntry,
    className: "bg-blue-600 text-white w-16 h-16 rounded-full shadow-xl flex items-center justify-center border-4 border-blue-100"
  }, /*#__PURE__*/React.createElement(Icons.Plus, null))));
}
function EntryForm({
  onSave,
  onCancel,
  defaultDate,
  initialData,
  entries,
  projects
}) {
  const [formData, setFormData] = useState({
    date: defaultDate,
    startTime: '08:00',
    endTime: '17:00',
    breakTime: '1',
    otType: 'NORMAL',
    projectName: '',
    workNumber: '',
    activityCode: '1110',
    dutyHour: '0',
    remarks: ''
  });
  const [customCode, setCustomCode] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const isHR = useMemo(() => {
    const act = ACTIVITY_META.find(a => a.id === formData.activityCode);
    return act && act.cat === 'HR';
  }, [formData.activityCode]);

  // === AUTO-SELECT OT LOGIC ===
  const determineOTType = useCallback((dateStr, startTime) => {
    if (!dateStr || !startTime) return 'NORMAL';
    const [dy, dm, dd] = dateStr.split('-').map(Number);
    const day = new Date(dy, dm - 1, dd).getDay(); // 0 = Sun, 6 = Sat (local, TZ-safe)
    const isHol = isVietnameseHoliday(dateStr);
    const startHour = parseInt(startTime.split(':')[0]);

    // NIGHT SHIFT (Starts >= 22:00)
    if (startHour >= 22) {
      if (isHol) return 'OT6'; // Holiday Night
      if (day === 0 || day === 6) return 'OT5'; // Sat/Sun Night
      return 'OT4'; // Normal Night (Default)
    }

    // DAY SHIFT
    if (isHol) return 'OT3'; // Holiday Day

    if (day === 0) return 'OT2'; // Sunday Day

    if (day === 6) {
      // Saturday: Afternoon (>= 13:00) is OT2
      if (startHour >= 13) return 'OT2';
      return 'NORMAL'; // Saturday Morning is usually Normal
    }

    // Mon-Fri
    if (startHour >= 17) return 'OT1'; // Normal Day Evening

    return 'NORMAL';
  }, []);

  // Auto-run logic when Date or StartTime changes
  useEffect(() => {
    const suggested = determineOTType(formData.date, formData.startTime);

    // SPECIAL CASE: Don't auto-switch if user selected OT7 and suggestion is OT4
    if (formData.otType === 'OT7' && suggested === 'OT4') return;
    if (formData.otType !== suggested) {
      // NEW LOGIC: Normal -> BreakTime = 1, OT -> BreakTime = 0
      const newBreakTime = suggested !== 'NORMAL' ? '0' : '1';
      setFormData(prev => ({
        ...prev,
        otType: suggested,
        breakTime: newBreakTime
      }));
    }
  }, [formData.date, formData.startTime, determineOTType]);
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
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
  const handleOtChange = e => {
    const type = e.target.value;
    let newData = {
      ...formData,
      otType: type
    };

    // NEW LOGIC: Manual OT Selection
    if (type !== 'NORMAL') {
      newData.breakTime = '0';
    } else {
      newData.breakTime = '1';
    }
    setFormData(newData);
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
  const handleSubmit = () => {
    const finalData = {
      ...formData
    };
    if (finalData.activityCode === 'OTHER') {
      if (!customCode) return alert("Vui lòng nhập mã code!");
      finalData.activityCode = customCode;
    }
    onSave(finalData);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-xl shadow-lg animate-fade-in-up"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "font-bold text-lg mb-4 text-blue-800 border-b pb-2"
  }, initialData ? 'Sửa' : 'Thêm'), /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-500"
  }, "NG\xC0Y"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: formData.date,
    onChange: handleDateChange,
    className: "w-full border p-3 rounded-lg"
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-3 gap-2"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-500"
  }, "T\u1EEA"), /*#__PURE__*/React.createElement("input", {
    type: "time",
    value: formData.startTime,
    onChange: e => setFormData({
      ...formData,
      startTime: e.target.value
    }),
    className: "w-full border p-2 rounded-lg text-center"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-500"
  }, "\u0110\u1EBEN"), /*#__PURE__*/React.createElement("input", {
    type: "time",
    value: formData.endTime,
    onChange: e => setFormData({
      ...formData,
      endTime: e.target.value
    }),
    className: "w-full border p-2 rounded-lg text-center"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-500"
  }, "NGH\u1EC8"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "0.5",
    value: formData.breakTime,
    onChange: e => setFormData({
      ...formData,
      breakTime: e.target.value
    }),
    className: "w-full border p-2 rounded-lg text-center"
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-500"
  }, "TR\u1EF0C (STANDBY)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "0.5",
    value: formData.dutyHour,
    onChange: e => setFormData({
      ...formData,
      dutyHour: e.target.value
    }),
    className: "w-full border p-3 rounded-lg"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-500"
  }, "LO\u1EA0I GI\u1EDC (T\u1EF1 \u0111\u1ED9ng \u0111\u1EC1 xu\u1EA5t)"), /*#__PURE__*/React.createElement("select", {
    value: formData.otType,
    onChange: handleOtChange,
    className: "w-full border p-3 rounded-lg bg-white"
  }, OT_TYPES.map(t => /*#__PURE__*/React.createElement("option", {
    key: t.code,
    value: t.code
  }, t.label))), isVietnameseHoliday(formData.date) && /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-red-500 mt-1"
  }, "* Ph\xE1t hi\u1EC7n ng\xE0y l\u1EC5 VN: ", formData.date)), /*#__PURE__*/React.createElement("div", {
    className: "pt-2 border-t space-y-3"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-500"
  }, "M\xC3 C\xD4NG VI\u1EC6C"), /*#__PURE__*/React.createElement("select", {
    value: formData.activityCode,
    onChange: handleActivityCodeChange,
    className: "w-full border p-3 rounded-lg font-bold text-blue-900"
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
    className: "mt-2 w-full border p-2 rounded text-sm bg-yellow-50"
  })), /*#__PURE__*/React.createElement("div", {
    className: "relative"
  }, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-500"
  }, "T\xCAN D\u1EF0 \xC1N"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: formData.projectName,
    onChange: e => handleProjectNameSearch(e.target.value),
    className: "w-full border p-3 rounded-lg",
    placeholder: "Nh\u1EADp t\xEAn d\u1EF1 \xE1n..."
  }), suggestions.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "suggestion-list"
  }, suggestions.map((p, idx) => /*#__PURE__*/React.createElement("div", {
    key: idx,
    onClick: () => selectProject(p),
    className: "suggestion-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, p.projectName), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500 text-xs"
  }, p.workNumber))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-500"
  }, "WORK NUMBER / WBS / M\xC3 CHI PH\xCD"), isHR ? /*#__PURE__*/React.createElement("select", {
    value: formData.workNumber,
    onChange: e => setFormData({
      ...formData,
      workNumber: e.target.value
    }),
    className: "w-full border p-3 rounded-lg bg-white"
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "-- Ch\u1ECDn lo\u1EA1i ngh\u1EC9 --"), HR_WORK_NUMBERS.map(wn => /*#__PURE__*/React.createElement("option", {
    key: wn,
    value: wn
  }, wn))) : /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: formData.workNumber,
    onChange: e => setFormData({
      ...formData,
      workNumber: e.target.value
    }),
    className: "w-full border p-3 rounded-lg"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-bold text-slate-500"
  }, "GHI CH\xDA (REMARKS)"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: formData.remarks || '',
    onChange: e => setFormData({
      ...formData,
      remarks: e.target.value
    }),
    className: "w-full border p-3 rounded-lg",
    placeholder: "Ghi ch\xFA th\xEAm..."
  }))), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-3 pt-4"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onCancel,
    className: "flex-1 p-3 border rounded-lg font-bold text-slate-500"
  }, "H\u1EE7y"), /*#__PURE__*/React.createElement("button", {
    onClick: handleSubmit,
    className: "flex-1 p-3 bg-blue-600 text-white rounded-lg font-bold shadow"
  }, "L\u01B0u"))));
}
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(/*#__PURE__*/React.createElement(App, null));
