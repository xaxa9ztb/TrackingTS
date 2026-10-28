        const { useState, useEffect, useMemo, useCallback, useRef } = React;

        // --- ICONS ---
        const Icons = {
            Settings: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
            Download: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
            Plus: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
            Trash: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
            Edit: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
            Cloud: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>,
            Refresh: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
            Upload: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
            Database: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>,
            Calendar: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>,
            ChevronLeft: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
            ChevronRight: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
            X: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
            Mail: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="4.5" width="19" height="15" rx="2"/><path d="M3 6.5l9 6.5 9-6.5"/></svg>,
            Chart: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx="1"/><rect x="12" y="8" width="3" height="10" rx="1"/><rect x="17" y="5" width="3" height="13" rx="1"/></svg>,
            Alert: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        };

        // --- DATA CONFIG ---
        // Loại giờ = cột G, I..O của mẫu bảng chấm công; tỷ lệ theo Điều 98 BLLĐ 2019 + Điều 57 NĐ 145/2020 (xem labor.js)
        const OT_TYPES = [
            { code: 'NORMAL', label: 'Giờ công thường', short: 'Giờ thường' },
            { code: 'OT1', label: 'OT1 — Ngày thường, ban ngày (150%)', short: 'OT1 · 150%' },
            { code: 'OT2', label: 'OT2 — Ngày nghỉ hằng tuần, ban ngày (200%)', short: 'OT2 · 200%' },
            { code: 'OT3', label: 'OT3 — Ngày lễ, Tết, ban ngày (300%)', short: 'OT3 · 300%' },
            { code: 'OT4', label: 'OT4 — Đêm ngày thường (200%)', short: 'OT4 · 200%' },
            { code: 'OT5', label: 'OT5 — Đêm ngày nghỉ hằng tuần (270%)', short: 'OT5 · 270%' },
            { code: 'OT6', label: 'OT6 — Đêm ngày lễ, Tết (390%)', short: 'OT6 · 390%' },
            { code: 'OT7', label: 'OT7 — Đêm ngày thường, đã làm thêm 17:00–22:00 (210%)', short: 'OT7 · 210%' },
        ];

        // Ngày nghỉ lễ, Tết tự tính theo Bộ luật Lao động (âm lịch, nghỉ bù, 24/11 từ 2026) — xem labor.js.
        // `sch` = lịch làm việc của người dùng (quyết định ngày nghỉ hằng tuần → ngày nghỉ bù).
        const holidayOf = (dateStr, sch) => (dateStr ? LaborVN.holidayInfo(dateStr, sch) : null);
        const isVietnameseHoliday = (dateStr, sch) => !!holidayOf(dateStr, sch);

        const HR_WORK_NUMBERS = ['PAID LEAVE', 'UNPAID LEAVE', 'TRAINING-NI', 'TRAINING-EI', 'MEETINGS'];

        // Activities aligned 1:1 with the official Schindler timesheet template columns U..AX (21..50).
        // `col` = Excel column index where the "x" mark goes when this activity is selected.
        const ACTIVITY_META = [
            { id: '100', code: '100', cat: 'NI', col: 21, desc: '100 - Travel (thời gian đi đường đến công trình tỉnh)' },
            { id: '1193', code: '1193', cat: 'NI', col: 22, desc: '1193 - NI Quality hour ( pre-work)' },
            { id: '1110', code: '1110', cat: 'NI', col: 23, desc: '1110 - NI Prod. Hours Fitter (thời gian lắp đặt)' },
            { id: '1731', code: '1731', cat: 'NI', col: 24, desc: '1731 - T&C (Thời gian thử nghiệm và vận hành)' },
            { id: '1194', code: '1194', cat: 'NI', col: 25, desc: '1194 - NI Quality Hour ( open item) (Thời gian sửa lỗi và các hạng mục dỡ dang)' },
            { id: '1720', code: '1720', cat: 'NI', col: 26, desc: '1720 - NI Inspection (NI/EI handover) - Kiểm tra công trường' },
            { id: '1900', code: '1900', cat: 'Other', col: 27, desc: '1900 - Customer Legal Audit' },
            { id: '1191', code: '1191', cat: 'NI', col: 28, desc: '1191 - Temporary Maintenance (trực Bảo trì tạm thời trước khi bàn giao EI)' },
            { id: '1192-0', code: '1192-0', cat: 'NI', col: 29, desc: '1192-0 - NI Quality hours-logistics' },
            { id: '1192-1', code: '1192-1', cat: 'NI', col: 30, desc: '1192-1 - NI Quality hours-Material / FI / LPCA / Site Cause' },
            { id: '1393', code: '1393', cat: 'MOD', col: 31, desc: '1393 - MOD Quality hour ( Pre-work)' },
            { id: '1394', code: '1394', cat: 'MOD', col: 32, desc: '1394 - MOD Quality Hour ( open item)' },
            { id: '1310', code: '1310', cat: 'MOD', col: 33, desc: '1310 - MOD Prod. Hours Fitter' },
            { id: '1392-0', code: '1392-0', cat: 'MOD', col: 34, desc: '1392-0 - MOD Quality hours - Logistics' },
            { id: '1400', code: '1400', cat: 'EI', col: 35, desc: '1400 - Maintenance (Bảo trì)' },
            { id: '1500', code: '1500', cat: 'EI', col: 36, desc: '1500 - Call back' },
            { id: '1600', code: '1600', cat: 'EI', col: 37, desc: '1600 - Repair' },
            { id: '1710', code: '1710', cat: 'TF', col: 38, desc: '1710 - SAIS Acceptance Test' },
            { id: '1715', code: '1715', cat: 'TF', col: 39, desc: '1715 - SAIS Re-Inspection' },
            { id: '1725', code: '1725', cat: 'TF', col: 40, desc: '1725 - CPSI' },
            { id: '1700', code: '1700', cat: 'SAF', col: 41, desc: '1700 - Safety' },
            { id: '5010', code: '5010', cat: 'HR', col: 42, desc: '5010 - Meetings (Họp)' },
            { id: '5021', code: '5021', cat: 'HR', col: 43, desc: '5021 - Training-Classroom (Huấn luyện - trong lớp)' },
            { id: '5022', code: '5022', cat: 'HR', col: 44, desc: '5022 - Training-On the job (Huấn luyện tại công trường)' },
            { id: '5040', code: '5040', cat: 'HR', col: 45, desc: '5040 - Other Administrative Task (nhiệm vụ khác không thuộc công trình)' },
            { id: '5060', code: '5060', cat: 'HR', col: 46, desc: '5060 - Safety / Tools Box Meeting (Họp giao ban an toàn)' },
            { id: '5090', code: '5090', cat: 'NI', col: 47, desc: '5090/ ES1 (NI) Supervisor, Safety, Travelling time' },
            { id: '6010', code: '6010', cat: 'HR', col: 48, desc: '6010/1 - Holiday / Public Holiday / Annual Leave day/hr (Nghỉ hưởng lương)' },
            { id: '6020', code: '6020', cat: 'HR', col: 49, desc: '6020 - Illness (day) / Medical / Accident (nghỉ ốm, nghỉ tai nạn)' },
            { id: '6090', code: '6090', cat: 'HR', col: 50, desc: '6090 - Unpaid leave (Nghỉ không hưởng lương)' }
        ];

        // OT type -> Excel column index (I..O = 9..15) in the template
        const OT_COL = { OT1: 9, OT2: 10, OT3: 11, OT4: 12, OT5: 13, OT6: 14, OT7: 15 };
        // Resolve an entry's activity code to a template column (handles legacy ids like plain '1192'/'1392')
        const activityToCol = (code) => {
            const hit = ACTIVITY_META.find(a => a.id === code || a.code === code);
            if (hit) return hit.col;
            if (code === '1192') return 29;
            if (code === '1392') return 34;
            return null;
        };

        // --- FIXED FUNCTION: MANUAL DATE STRING CONSTRUCTION ---
        const toLocalISOString = (date) => {
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
            return rows
                .map(p => ({ workNumber: String(p.wbs == null ? '' : p.wbs).trim(), projectName: String(p.projectName == null ? '' : p.projectName).trim() }))
                .filter(p => p.workNumber && p.projectName)
                .sort((a, b) => a.projectName.localeCompare(b.projectName, 'vi'));
        };

        // ExcelJS (~1 MB) và mẫu bảng chấm công chỉ cần khi XUẤT EXCEL → tải lúc đó
        // để mở Timesheet nhanh hơn (đã cài sẵn cho chế độ ngoại tuyến trong sw.js).
        const EXCELJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
        const loadScript = (src) => new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = () => reject(new Error('không tải được thư viện Excel'));
            document.head.appendChild(s);
        });
        let excelJsLoading = null;
        const ensureExcelJS = () => {
            if (window.ExcelJS) return Promise.resolve();
            excelJsLoading = excelJsLoading || loadScript(EXCELJS_URL).catch(e => { excelJsLoading = null; throw e; });
            return excelJsLoading;
        };
        // Mẫu bảng chấm công chính thức (Schindler, .xlsx trắng) nằm cạnh trang: ts-template.xlsx
        const getTemplateBuffer = async () => {
            const res = await fetch('ts-template.xlsx');
            if (!res.ok) throw new Error('không tải được mẫu bảng chấm công (HTTP ' + res.status + ')');
            return res.arrayBuffer();
        };
        const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        // Mẫu "Bảng phụ cấp xe" (2 sheet: Xăng xe 60K, Phụ cấp Xe đi tỉnh) — điền bằng TsAllowance.fillWorkbook (allowance.js)
        const buildAllowanceFile = async ({ profile, calc, month }) => {
            await ensureExcelJS();
            const res = await fetch('phucap-xe-template.xlsx');
            if (!res.ok) throw new Error('không tải được mẫu bảng phụ cấp xe (HTTP ' + res.status + ')');
            const wb = new ExcelJS.Workbook();
            await wb.xlsx.load(await res.arrayBuffer());
            TsAllowance.fillWorkbook(wb, { name: profile.name, empId: profile.empId, computed: calc, date: getTodayLocal() });
            const buffer = await wb.xlsx.writeBuffer();
            return { blob: new Blob([buffer], { type: XLSX_MIME }), name: TsAllowance.fileName(profile.name, month) };
        };
        const cloneStyle = (s) => (s ? JSON.parse(JSON.stringify(s)) : {});
        // Ngày ghi vào Excel PHẢI tạo theo UTC: ExcelJS đổi Date sang số ngày Excel theo giờ UTC.
        // new Date(y, m-1, d) là 0 giờ GIỜ MÁY — ở Việt Nam (UTC+7) = 17 giờ hôm TRƯỚC theo UTC → Excel lùi 1 ngày
        // (cả cột Thứ / giờ công thường theo ngày cũng sai theo).
        const excelDate = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
        // Column G "Normal Hour" formula from the template (references $E$9=08:00, $F$9=17:00)
        const normalHourFormula = (r) => `IF(D${r}=1,0,IF(AND(E${r}<$E$9,F${r}>$F$9),9-H${r},IF(OR(AND(E${r}<$E$9,F${r}<$E$9),AND(E${r}>$F$9,F${r}>$F$9)),0,IF(AND(E${r}>=$E$9,F${r}<=$F$9),(F${r}-E${r})*24-H${r},IF(AND(F${r}>$F$9,E${r}>=$E$9),($F$9-E${r})*24-H${r},IF(AND(E${r}<$E$9,F${r}<=$F$9),(F${r}-$E$9)*24-H${r}))))))`;

        const getSalaryPeriod = (monthStr) => {
            if(!monthStr) return { start: '', end: '', label: '' };
            const [year, month] = monthStr.split('-').map(Number);
            
            // Salary Period: 16th Prev Month -> 15th Current Month
            // Use local dates, avoid UTC conversion
            const startDate = new Date(year, month - 2, 16);
            const endDate = new Date(year, month - 1, 15);
            
            const startDateStr = toLocalISOString(startDate); // FIXED
            const endDateStr = toLocalISOString(endDate);     // FIXED
            
            const formatDate = (d) => `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
            return { start: startDateStr, end: endDateStr, label: `${formatDate(startDate)} - ${formatDate(endDate)}` };
        };

        const timeToExcel = (timeStr) => {
            if (!timeStr) return 0;
            const [h, m] = timeStr.split(':').map(Number);
            return (h + m/60) / 24;
        };

        const calculateHours = (start, end, breakTime) => {
            if(!start || !end) return 0;
            const [h1, m1] = start.split(':').map(Number);
            const [h2, m2] = end.split(':').map(Number);
            let diff = (h2 + m2/60) - (h1 + m1/60);
            if(diff < 0) diff += 24; 
            return Math.max(0, diff - (parseFloat(breakTime) || 0));
        };

        const formatMonthVietnamese = (yyyy_mm) => {
            if(!yyyy_mm) return "";
            const [y, m] = yyyy_mm.split('-');
            return `Tháng ${parseInt(m)}`;
        };

        const normalizeString = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
        const removeAccents = (str) => normalizeString(str).replace(/\s+/g, '_');
        // ================================================================
        //   GIAO DIỆN (responsive: điện thoại · tablet · máy tính)
        // ================================================================
        const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        const WEEKDAYS_LONG = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
        const parseLocal = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
        const weekdayOf = (s) => parseLocal(s).getDay();
        const fmtDM = (s) => { const [, m, d] = s.split('-'); return `${d}/${m}`; };
        const fmtDMY = (s) => s.split('-').reverse().join('/');
        const fmtH = (h) => (Math.round(h * 10) / 10).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
        const entryHours = (e) => calculateHours(e.startTime, e.endTime, e.breakTime);
        const otLabel = (code) => (OT_TYPES.find(t => t.code === code) || {}).label || code;
        const otShort = (code) => (OT_TYPES.find(t => t.code === code) || {}).short || code;
        const scheduleOf = (profile) => (profile && LaborVN.SCHEDULES[profile.schedule] ? profile.schedule : LaborVN.DEFAULT_SCHEDULE);
        // Giờ công từng loại của mỗi dòng: dòng "tự động" chia theo luật, dòng cũ / chọn tay giữ loại đã chọn
        const breakdownsOf = (entries, sch) => LaborVN.breakdownAll(entries, sch, entryHours);
        const sumBd = (bd) => Object.values(bd || {}).reduce((a, b) => a + b, 0);
        // Kỳ lương tháng M = 16/(M-1) → 15/M, nên từ ngày 16 trở đi thuộc kỳ của tháng sau
        const periodMonthOf = (dateStr) => {
            const d = parseLocal(dateStr);
            if (d.getDate() >= 16) d.setMonth(d.getMonth() + 1, 1);
            return toLocalISOString(d).slice(0, 7);
        };
        const shiftMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); return toLocalISOString(new Date(y, m - 1 + n, 1)).slice(0, 7); };
        const daysBetween = (start, end) => { const out = []; for (let d = start; d <= end; d = addDaysLocal(d, 1)) out.push(d); return out; };
        // ngày phải chấm công: T2–T6 (thêm T7 nếu làm cả T7), trừ ngày lễ / nghỉ bù
        const isWorkday = (s, sch) => { const w = weekdayOf(s); return w >= 1 && (w <= 5 || (w === 6 && sch === 'mon-sat')) && !isVietnameseHoliday(s, sch); };
        const finePointer = () => !!(window.matchMedia && matchMedia('(pointer: fine)').matches);
        // Bản máy chủ (Cloudflare): Timesheet đồng bộ lên máy chủ theo kỳ lương (xem tssync.js); bản github.io: chỉ trên máy
        const SERVER = typeof Session !== 'undefined' && !!Session.SERVER && typeof TsSync !== 'undefined';
        const STATUS_LABEL = { draft: 'Đang chấm', rejected: 'Bị trả lại — cần sửa', submitted: 'Đã nộp — chờ giám sát', sitesup_ok: 'Giám sát đã duyệt — chờ quản lý', approved: 'Đã duyệt xong' };
        const sameEntries = (a, b) => {
            if (a.length !== b.length) return false;
            const m = new Map(a.map(e => [String(e.id), JSON.stringify(e)]));
            return b.every(e => m.get(String(e.id)) === JSON.stringify(e));
        };
        const DEFAULT_PROFILE = { name: '', empId: '', position: '', dept: 'NI', sheetId: '1OuwcTThIkpC_871JIv_D5fd29-jPsoqwsyP55AFAd_I' };

        const inputCls = 'w-full h-11 rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:bg-slate-50';
        const btnGhost = 'inline-flex items-center justify-center gap-2 h-10 px-3 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-60';
        const btnPrimary = 'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-blue-700 text-white font-semibold hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60';

        function App() {
            const [entries, setEntries] = useState([]);
            // Đọc ngay khi mở (không đợi useEffect) để thẻ Thông tin nhân viên hiện đúng từ lần vẽ đầu.
            // Bộ công cụ: điền sẵn họ tên / mã NV / chức vụ từ phiên đăng nhập — chỉ điền ô còn trống.
            const [profile, setProfile] = useState(() => {
                let p = DEFAULT_PROFILE;
                try { const saved = localStorage.getItem('ts_profile_v28'); if (saved) p = JSON.parse(saved); } catch (e) { /* bỏ qua */ }
                const who = (typeof Session !== 'undefined') ? Session.current() : null;
                if (who && !who.admin) p = { ...p, name: p.name || who.name, empId: p.empId || who.empId, position: p.position || who.position };
                return p;
            });
            const [projects, setProjects] = useState([]);
            // Mặc định mở KỲ LƯƠNG ĐANG DIỄN RA (chứa hôm nay) — chấm công hôm nay hiện ngay trong danh sách
            const [currentMonth, setCurrentMonth] = useState(periodMonthOf(getTodayLocal()));
            const [drawer, setDrawer] = useState(null); // null | {type:'form', entry, date, key} | {type:'settings'}
            const [reportOpen, setReportOpen] = useState(false); // báo cáo tổng quan cho giám sát
            const [syncInfo, setSyncInfo] = useState({ state: SERVER ? 'syncing' : 'off', at: '', error: '' });
            const [docStatuses, setDocStatuses] = useState({});
            const [docNotes, setDocNotes] = useState({});
            const [submitting, setSubmitting] = useState(false);
            const entriesRef = useRef([]);
            // Phụ cấp xe theo kỳ: { 'YYYY-MM': { rows, u } } — trên máy + đồng bộ cùng bảng công của kỳ (tssync.js)
            const [allowAll, setAllowAll] = useState(() => { try { return JSON.parse(localStorage.getItem('ts_allow_v1') || '{}') || {}; } catch (e) { return {}; } });
            const allowRef = useRef(allowAll);
            const [allowBusy, setAllowBusy] = useState(false);
            const scheduleRef = useRef('');
            const syncTimer = useRef(null);
            const [ganttOpen, setGanttOpenRaw] = useState(() => { try { return localStorage.getItem('ts_gantt_open') !== '0'; } catch (e) { return true; } });
            const setGanttOpen = (v) => { setGanttOpenRaw(v); try { localStorage.setItem('ts_gantt_open', v ? '1' : '0'); } catch (e) { /* bỏ qua */ } };
            const [mailFile, setMailFile] = useState(null); // file Excel đính kèm khi Gửi mail: {status, blob, name, error}
            const [supervisorName, setSupervisorName] = useState(''); // giám sát theo EE Data (nếu có trên máy)
            const [dayFilter, setDayFilter] = useState(null);
            const [toast, setToast] = useState(null);
            const [syncStatus, setSyncStatus] = useState('');
            const [projSyncing, setProjSyncing] = useState(false);
            const [projStatus, setProjStatus] = useState(null); // {ok, text} của lần đồng bộ gần nhất
            const [needProjects, setNeedProjects] = useState(false); // máy chưa có danh sách dự án → nhắc (không chặn màn hình)
            // lần tải dữ liệu chung từ Drive gần nhất (trang chủ / Thống kê giờ công / Timesheet đều cập nhật)
            const lastDriveSync = () => (typeof Cloud !== 'undefined' && Cloud.getLastSyncedAt ? Cloud.getLastSyncedAt() : '');
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
                    if (shared.length) { setProjects(shared); return; }
                    const { n } = await syncSharedProjects();
                    if (!n && !savedProjects) setNeedProjects(true);
                })();
            }, []);

            useEffect(() => {
                if (typeof DB === 'undefined' || !profile.empId) return;
                DB.getAll('employees').then(list => {
                    const me = (list || []).find(e => String(e.empId).trim().toLowerCase() === String(profile.empId).trim().toLowerCase());
                    setSupervisorName(me && me.supervisor ? String(me.supervisor) : '');
                }).catch(() => {});
            }, [profile.empId, projSyncedAt]); // máy mới: EE Data có sau lần đồng bộ đầu
            useEffect(() => { localStorage.setItem('ts_entries_v28', JSON.stringify(entries)); }, [entries]);
            useEffect(() => { entriesRef.current = entries; }, [entries]);
            useEffect(() => { allowRef.current = allowAll; try { localStorage.setItem('ts_allow_v1', JSON.stringify(allowAll)); } catch (e) { /* hết dung lượng */ } }, [allowAll]);
            useEffect(() => { localStorage.setItem('ts_profile_v28', JSON.stringify(profile)); }, [profile]);

            // ----- đồng bộ máy chủ (chỉ bản Cloudflare) -----
            const runSync = useCallback(async () => {
                if (!SERVER) return;
                setSyncInfo(i => ({ ...i, state: 'syncing' }));
                const r = await TsSync.sync({
                    getSch: () => scheduleRef.current,
                    getEntries: () => entriesRef.current,
                    onMerged: (p, merged, startedAt) => setEntries(prev => {
                        const next = TsSync.applyChanges(prev, p, merged, startedAt);
                        if (sameEntries(prev, next)) return prev;
                        entriesRef.current = next;
                        return next;
                    }),
                    getAllow: (p) => allowRef.current[p] || null,
                    onAllow: (p, a) => setAllowAll(prev => {
                        if (prev[p] && (Number(prev[p].u) || 0) > (Number(a && a.u) || 0)) return prev;   // vừa sửa tiếp trong lúc đồng bộ → giữ
                        const next = { ...prev, [p]: a };
                        allowRef.current = next;
                        return next;
                    }),
                });
                if (r.statuses) setDocStatuses(prev => ({ ...prev, ...r.statuses }));
                if (r.notes) setDocNotes(prev => ({ ...prev, ...r.notes }));
                setSyncInfo(r.ok ? { state: 'ok', at: new Date().toISOString(), error: '' }
                    : r.offline ? { state: 'offline', at: '', error: '' } : { state: 'error', at: '', error: r.error || 'Không đồng bộ được' });
            }, []);
            const scheduleSync = useCallback((ms = 2500) => {
                if (!SERVER) return;
                clearTimeout(syncTimer.current);
                syncTimer.current = setTimeout(runSync, ms);
            }, [runSync]);
            useEffect(() => {
                if (!SERVER) return;
                runSync();
                const onOnline = () => runSync();
                const onVisible = () => { if (document.visibilityState === 'visible') runSync(); };
                window.addEventListener('online', onOnline);
                document.addEventListener('visibilitychange', onVisible);
                const iv = setInterval(runSync, 90000);
                return () => { window.removeEventListener('online', onOnline); document.removeEventListener('visibilitychange', onVisible); clearInterval(iv); clearTimeout(syncTimer.current); };
            }, []);
            useEffect(() => { localStorage.setItem('ts_projects_v28', JSON.stringify(projects)); }, [projects]);
            useEffect(() => {
                if (!toast) return;
                const t = setTimeout(() => setToast(null), 6000);
                return () => clearTimeout(t);
            }, [toast]);

            const period = useMemo(() => getSalaryPeriod(currentMonth), [currentMonth]);
            const monthlyEntries = useMemo(() => {
                // IMPORTANT: String comparison works correctly for YYYY-MM-DD
                return entries.filter(e => e.date >= period.start && e.date <= period.end)
                              .sort((a, b) => b.date.localeCompare(a.date) || String(a.startTime || '').localeCompare(String(b.startTime || '')));
            }, [entries, period]);

            scheduleRef.current = scheduleOf(profile);
            const periodStatus = (SERVER && docStatuses[currentMonth]) || 'draft';
            const locked = SERVER && TsSync.LOCKED.includes(periodStatus);
            const sch = scheduleOf(profile);
            // giờ thường / OT từng loại của mọi dòng (tính trên toàn bộ dữ liệu: OT7 cần biết các dòng cùng ngày)
            const bds = useMemo(() => breakdownsOf(entries, sch), [entries, sch]);
            const bdOf = (e) => bds.get(e.id) || {};

            const dayTotals = useMemo(() => {
                const t = {};
                monthlyEntries.forEach(e => {
                    const d = t[e.date] || (t[e.date] = { hours: 0, ot: false, count: 0 });
                    const bd = bdOf(e);
                    d.hours += sumBd(bd); d.count++; if (Object.keys(bd).some(k => k !== 'NORMAL')) d.ot = true;
                });
                return t;
            }, [monthlyEntries, bds]);

            const stats = useMemo(() => {
                let normal = 0, ot = 0; const byOt = {};
                monthlyEntries.forEach(e => {
                    const bd = bdOf(e);
                    Object.keys(bd).forEach(k => {
                        if (k === 'NORMAL') normal += bd[k]; else { ot += bd[k]; byOt[k] = (byOt[k] || 0) + bd[k]; }
                    });
                });
                // ngày làm việc (không phải ngày lễ / nghỉ bù) đã qua trong kỳ mà chưa chấm công
                const today = getTodayLocal();
                const last = period.end < today ? period.end : today;
                const missing = period.start <= last ? daysBetween(period.start, last).filter(d => isWorkday(d, sch) && !dayTotals[d]) : [];
                return { normal, ot, total: normal + ot, byOt, days: Object.keys(dayTotals).length, missing };
            }, [monthlyEntries, dayTotals, period, bds, sch]);
            const holidays = useMemo(() => LaborVN.holidaysBetween(period.start, period.end, sch), [period, sch]);
            const allow = allowAll[currentMonth] || null;
            const allowCalc = useMemo(() => TsAllowance.compute(monthlyEntries, allow, period), [monthlyEntries, allow, period]);
            const allowProjects = useMemo(() => TsAllowance.projectsOf(monthlyEntries, period.start, period.end), [monthlyEntries, period]);

            const visible = dayFilter ? monthlyEntries.filter(e => e.date === dayFilter) : monthlyEntries;

            // Đồng bộ Dự án: tải bản mới nhất từ Google Drive vào kho dùng chung rồi đọc lại.
            // Drive lỗi (mất mạng / hết hạn mức) thì giữ bản đang có trên máy. Trả về {n: số dự án, reason: lỗi}.
            const syncSharedProjects = async () => {
                setProjSyncing(true); setProjStatus(null);
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
                setProjStatus({ ok: !reason && shared.length > 0, text: shared.length
                    ? (reason ? `${reason} — đang dùng ${shared.length} dự án đã có trên máy.` : `Đã cập nhật ${shared.length} dự án.`)
                    : (reason ? `${reason}. Vui lòng thử lại sau.` : 'Chưa có dữ liệu Dự án — vui lòng liên hệ quản trị viên.') });
                return { n: shared.length, reason };
            };
            const handleSyncProjects = async () => {
                const { n, reason } = await syncSharedProjects();
                if (n && !reason) showToast(`Đã cập nhật ${n} dự án.`);
            };

            const showToast = (message, action) => setToast({ message, action, id: Date.now() });
            const changeMonth = (m) => { setCurrentMonth(m); setDayFilter(null); };
            const closeDrawer = () => setDrawer(null);

            const lockedMsg = () => showToast('Kỳ lương này đã nộp / đã duyệt nên không sửa được. Cần sửa thì nhờ giám sát trả lại bảng công.');
            const openNewEntry = (date) => {
                if (locked) return lockedMsg();
                let d = date;
                if (!d) { // như trước: ngày kế tiếp ngày chấm công gần nhất (chưa có thì hôm nay)
                    d = getTodayLocal();
                    if (entries.length > 0) d = addDaysLocal(entries.reduce((a, b) => (b.date > a.date ? b : a)).date, 1);
                }
                setDrawer({ type: 'form', entry: null, date: d, key: Date.now() });
            };
            const openEdit = (entry) => { if (locked) return lockedMsg(); setDrawer({ type: 'form', entry, date: entry.date, key: Date.now() }); };

            const handleSaveEntry = (formData) => {
                const editing = drawer && drawer.entry;
                const u = Date.now();      // thời điểm sửa — dùng để gộp khi sửa trên nhiều máy
                const { bd: _bd, cat: _cat, ...data } = formData;   // phân loại giờ cũ không còn đúng sau khi sửa (gắn lại khi nộp)
                if (editing) setEntries(prev => prev.map(e => e.id === editing.id ? { ...data, id: editing.id, u } : e));
                else setEntries(prev => [...prev, { ...data, id: Date.now(), u }]);
                if (SERVER) { TsSync.markDirty(editing && editing.date !== data.date ? [data.date, editing.date] : data.date); scheduleSync(); }
                setDrawer(null);
                const pm = periodMonthOf(data.date); // ngày thuộc kỳ khác → chuyển sang kỳ đó để thấy ngay
                if (pm !== currentMonth) changeMonth(pm);
                showToast(`${editing ? 'Đã cập nhật' : 'Đã thêm'} chấm công ${fmtDMY(data.date)}.`);
            };

            const handleDelete = (entry) => {
                if (locked) return lockedMsg();
                setEntries(prev => prev.filter(e => e.id !== entry.id));
                if (SERVER) { TsSync.markDeleted(entry); TsSync.markDirty(entry.date); scheduleSync(); }
                if (drawer && drawer.entry && drawer.entry.id === entry.id) setDrawer(null);
                showToast(`Đã xóa chấm công ${fmtDMY(entry.date)}.`, { label: 'Hoàn tác', run: () => {
                    setEntries(prev => [...prev, SERVER ? { ...entry, u: Date.now() } : entry]);
                    if (SERVER) { TsSync.unmarkDeleted(entry); TsSync.markDirty(entry.date); scheduleSync(); }
                } });
            };

            // ----- nộp / thu hồi bảng công của kỳ đang xem (bản máy chủ) -----
            const catOf = (code) => (ACTIVITY_META.find(a => a.id === code || a.code === code) || { cat: 'Other' }).cat;
            const settleSync = async () => {      // đẩy hết thay đổi của kỳ lên máy chủ (có thể phải qua vài lượt nếu đang có lượt khác chạy)
                for (let i = 0; i < 4; i++) {
                    await runSync();
                    if (!TsSync.load().dirty[currentMonth]) return true;
                }
                return false;
            };
            // Bấm Nộp: mở bảng xác nhận (tổng giờ + phụ cấp xe nộp kèm); phụ cấp còn lỗi thì phải sửa trước
            const handleSubmit = () => {
                if (!SERVER || submitting) return;
                if (!monthlyEntries.length) return showToast('Kỳ này chưa có dòng chấm công nào để nộp.');
                setDrawer({ type: 'submit', key: Date.now() });
            };
            const doSubmit = async () => {
                if (!SERVER || submitting || !allowCalc.ok) return;
                setDrawer(null);
                setSubmitting(true);
                try {
                    const u = Date.now();
                    const stamped = entriesRef.current.map(e => periodMonthOf(e.date) === currentMonth ? { ...e, bd: bdOf(e), cat: catOf(e.activityCode), u } : e);
                    entriesRef.current = stamped; setEntries(stamped);
                    TsSync.markDirty(monthlyEntries.map(e => e.date));
                    if (!(await settleSync())) { showToast('Chưa gửi được bảng công lên máy chủ (mất mạng?). Thử nộp lại khi có mạng.'); return; }
                    const r = await TsSync.submit(currentMonth);
                    if (r.status === 200) { setDocStatuses(prev => ({ ...prev, [currentMonth]: 'submitted' })); setDocNotes(prev => ({ ...prev, [currentMonth]: '' })); showToast('Đã nộp bảng công cho giám sát.'); }
                    else if (r.status === 409) showToast(r.data.error || 'Bảng công vừa thay đổi — thử nộp lại.');
                    else alert('Không nộp được: ' + (r.data.error || ('lỗi máy chủ ' + r.status)));
                } catch (err) {
                    showToast(err && err.offline ? 'Mất mạng — chưa nộp được. Thử lại khi có mạng.' : ('Không nộp được: ' + (err.message || err)));
                } finally { setSubmitting(false); }
            };
            const handleWithdraw = async () => {
                if (!confirm('Thu hồi bảng công về để sửa tiếp? (Giám sát sẽ không còn thấy bảng công này cho đến khi bạn nộp lại.)')) return;
                try {
                    const r = await TsSync.withdraw(currentMonth);
                    if (r.status === 200) { setDocStatuses(prev => ({ ...prev, [currentMonth]: 'draft' })); showToast('Đã thu hồi bảng công — sửa xong nhớ nộp lại.'); }
                    else showToast(r.data.error || 'Không thu hồi được.');
                } catch (err) { showToast('Không thu hồi được: ' + (err.message || err)); }
            };

            // ----- phụ cấp xe của kỳ đang xem -----
            const saveAllowRows = (rows) => {
                const next = { rows, u: Date.now() };
                setAllowAll(prev => { const n = { ...prev, [currentMonth]: next }; allowRef.current = n; return n; });
                if (SERVER) { TsSync.markPeriodDirty(currentMonth); scheduleSync(); }
            };
            const openAllowance = (row) => { if (locked) return lockedMsg(); setDrawer({ type: 'allow', row: row || null, key: Date.now() }); };
            const handleSaveAllowance = (row) => {
                const rows = allow ? allow.rows : [];
                const editing = rows.some(r => r.id === row.id);
                saveAllowRows(editing ? rows.map(r => (r.id === row.id ? row : r)) : [...rows, row]);
                setDrawer(null);
                showToast(`${editing ? 'Đã cập nhật' : 'Đã thêm'} ${TsAllowance.TYPES[row.type].label.toLowerCase()} — ${row.wbs}.`);
            };
            const handleDeleteAllowance = (row) => {
                if (locked) return lockedMsg();
                const before = allow ? allow.rows : [];
                saveAllowRows(before.filter(r => r.id !== row.id));
                if (drawer && drawer.type === 'allow') setDrawer(null);
                showToast(`Đã xóa phụ cấp xe ${row.wbs || ''}.`, { label: 'Hoàn tác', run: () => saveAllowRows(before) });
            };
            const handleAllowanceExcel = async () => {
                setAllowBusy(true);
                try { const f = await buildAllowanceFile({ profile, calc: allowCalc, month: currentMonth }); saveAs(f.blob, f.name); }
                catch (err) { alert(excelError(err)); }
                finally { setAllowBusy(false); }
            };

            const handleResetData = () => {
                if (confirm(SERVER ? "Xóa dữ liệu Timesheet TRÊN MÁY NÀY? (Bản đã lưu trên máy chủ vẫn còn và sẽ được tải lại khi có mạng.)" : "CẢNH BÁO: Bạn có chắc chắn muốn xóa TOÀN BỘ dữ liệu? Hành động này sẽ xóa sạch lịch sử chấm công và thông tin cá nhân. Không thể hoàn tác!")) {
                    if(confirm("Xác nhận lần 2: Xóa tất cả dữ liệu?")) {
                        localStorage.removeItem('ts_entries_v28');
                        if (SERVER) localStorage.removeItem('ts_sync_v1');
                        localStorage.removeItem('ts_allow_v1'); setAllowAll({});
                        localStorage.removeItem('ts_profile_v28');
                        localStorage.removeItem('ts_projects_v28');
                        setEntries([]);
                        setProfile(DEFAULT_PROFILE);
                        setProjects([]);
                        setDrawer(null);
                        showToast(SERVER ? 'Đã xóa dữ liệu Timesheet trên máy này (dữ liệu trên máy chủ vẫn còn và sẽ được tải lại).' : 'Đã xóa toàn bộ dữ liệu Timesheet trên máy này.');
                        if (SERVER) scheduleSync(600);
                    }
                }
            };

            // Tạo file bảng chấm công Excel (mẫu Schindler) của kỳ đang xem → { blob, name }.
            // Dùng cho Xuất Excel và để đính kèm khi Gửi mail. Lỗi tải thư viện / mẫu → throw.
            const buildExcelFile = async () => {
                const sortedData = [...monthlyEntries].sort((a,b) => a.date.localeCompare(b.date));
                await ensureExcelJS();
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(await getTemplateBuffer());
                const sheet = workbook.getWorksheet('New TS') || workbook.worksheets[0];

                // Snapshot template styles BEFORE editing: a data row (11), the total row (59),
                // and the signature block (62-64, captured as offsets from the total row).
                const dataStyle = {}, totalStyle = {};
                for (let c = 1; c <= 51; c++) {
                    dataStyle[c] = cloneStyle(sheet.getRow(11).getCell(c).style);
                    totalStyle[c] = cloneStyle(sheet.getRow(59).getCell(c).style);
                }
                const sigCells = [];
                for (let r = 62; r <= 64; r++) {
                    for (let c = 1; c <= 51; c++) {
                        const cell = sheet.getRow(r).getCell(c);
                        const hasTop = cell.border && cell.border.top && cell.border.top.style;
                        if (cell.value !== null || hasTop) sigCells.push({ off: r - 59, c, value: cell.value, style: cloneStyle(cell.style) });
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
                    for (let c = 1; c <= 51; c++) { const cell = row.getCell(c); cell.value = null; cell.style = {}; }
                    row.height = undefined;
                }

                // --- Data rows (one per entry), starting at row 10 ---
                sortedData.forEach((e, index) => {
                    const r = 10 + index;
                    const row = sheet.getRow(r);
                    row.height = 25.5;
                    for (let c = 1; c <= 51; c++) row.getCell(c).style = cloneStyle(dataStyle[c]);

                    row.getCell(1).value = { formula: '$E$4' };
                    row.getCell(2).value = { formula: '$E$3' };
                    const [dy, dm, dd] = e.date.split('-').map(Number);
                    row.getCell(3).value = excelDate(dy, dm, dd);
                    row.getCell(4).value = { formula: `WEEKDAY(C${r})` };
                    row.getCell(5).value = timeToExcel(e.startTime);
                    row.getCell(6).value = timeToExcel(e.endTime);
                    const brk = parseFloat(e.breakTime) || 0;
                    row.getCell(8).value = brk > 0 ? brk : null;
                    if (LaborVN.isAuto(e)) {
                        // tự động theo luật: một dòng có thể vừa giờ thường vừa nhiều loại OT (cột "Check" vẫn = 0)
                        const bd = bdOf(e);
                        row.getCell(7).value = bd.NORMAL || 0;
                        Object.keys(OT_COL).forEach(k => { if (bd[k]) row.getCell(OT_COL[k]).value = bd[k]; });
                    } else {
                        row.getCell(7).value = e.otType === 'NORMAL' ? { formula: normalHourFormula(r) } : 0;
                        if (e.otType !== 'NORMAL' && OT_COL[e.otType]) {
                            row.getCell(OT_COL[e.otType]).value = calculateHours(e.startTime, e.endTime, e.breakTime);
                        }
                    }
                    row.getCell(16).value = { formula: `MOD(F${r}-E${r},1)*24-SUM(G${r}:O${r})` }; // MOD: ca qua nửa đêm vẫn = 0
                    row.getCell(17).value = { formula: `INDEX($U$9:$AX$9,1,MATCH("x",$U${r}:$AX${r}))` };
                    row.getCell(18).value = e.projectName || '';
                    row.getCell(19).value = e.workNumber || '';
                    row.getCell(20).value = { formula: `INDEX($U$6:$AX$6,1,MATCH("x",$U${r}:$AX${r}))` };
                    const actCol = activityToCol(e.activityCode);
                    if (actCol) {
                        const xc = row.getCell(actCol);
                        xc.value = 'x';
                        xc.font = { name: 'Times New Roman', size: 14 };
                        xc.alignment = { horizontal: 'center', vertical: 'middle' };
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
                    totalRow.getCell(c).value = { formula: `SUM(${letter}10:${letter}${rt - 1})` };
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
                return { blob: new Blob([buffer], { type: XLSX_MIME }), name: `${cleanName}_Thang_${m}_${y}.xlsx` };
            };
            const excelError = (err) => 'Không xuất được Excel: ' + err.message +
                (navigator.onLine === false ? ' — đang ngoại tuyến, hãy thử lại khi có mạng.' : '.');
            const handleExportExcel = async () => {
                if (monthlyEntries.length === 0) return alert("Chưa có dữ liệu!");
                setSyncStatus('Đang tạo file...');
                try {
                    const f = await buildExcelFile();
                    saveAs(f.blob, f.name);
                } catch (err) {
                    alert(excelError(err));
                } finally {
                    setSyncStatus('');
                }
            };

            const openMail = async () => {
                setDrawer({ type: 'mail', key: Date.now() });
                if (!monthlyEntries.length) { setMailFile({ status: 'empty' }); return; }
                setMailFile({ status: 'loading' });
                try {
                    const f = await buildExcelFile();
                    const extra = allowCalc.rows.length ? await buildAllowanceFile({ profile, calc: allowCalc, month: currentMonth }) : null;
                    setMailFile({ status: 'ready', ...f, extra });
                }
                catch (err) { setMailFile({ status: 'error', error: excelError(err) }); }
            };

            const handleBackup = () => { const blob = new Blob([JSON.stringify({ profile, entries, projects, allow: allowAll })], { type: "application/json" }); saveAs(blob, `TS_Backup_${profile.name}.json`); };
            const handleRestore = (e) => {
                const file = e.target.files[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        const data = JSON.parse(ev.target.result);
                        if (data.entries) {
                            const stamped = SERVER ? data.entries.map(x => ({ ...x, u: Date.now() })) : data.entries;   // khôi phục chủ động → thắng khi gộp
                            setEntries(stamped);
                            if (SERVER) { TsSync.markDirty(stamped.map(x => x.date)); scheduleSync(); }
                        }
                        if (data.profile) setProfile(data.profile);
                        if (data.projects) setProjects(data.projects);
                        if (data.allow && typeof data.allow === 'object') {
                            const u = Date.now();
                            const restored = Object.fromEntries(Object.keys(data.allow).filter(p => /^\d{4}-\d{2}$/.test(p) && data.allow[p]).map(p => [p, { ...data.allow[p], u }]));
                            setAllowAll(prev => ({ ...prev, ...restored }));
                            if (SERVER) { Object.keys(restored).forEach(p => TsSync.markPeriodDirty(p)); scheduleSync(); }
                        }
                        showToast(`Đã khôi phục ${data.entries ? data.entries.length : 0} dòng chấm công từ bản sao lưu.`);
                    } catch (err) { alert('Lỗi file: không đọc được bản sao lưu.'); }
                };
                reader.readAsText(file);
                e.target.value = '';
            };

            const exporting = syncStatus === 'Đang tạo file...';
            const todayPeriod = periodMonthOf(getTodayLocal());

            return (
                <div className="min-h-screen bg-slate-100 text-slate-800">
                    {/* ---------- Thanh trên: tên · kỳ lương · thao tác ---------- */}
                    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
                        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-3 flex flex-wrap items-center gap-x-4 gap-y-3">
                            <div className="flex items-center gap-3 min-w-0 mr-auto">
                                <div className="w-10 h-10 rounded-xl bg-blue-700 text-white grid place-items-center shrink-0" aria-hidden="true"><Icons.Calendar/></div>
                                <div className="min-w-0">
                                    <h1 className="font-bold text-lg leading-tight">Timesheet</h1>
                                    <p className="text-xs text-slate-500 truncate max-w-[52vw] md:max-w-xs">
                                        {profile.name || 'Chưa có họ tên'}{profile.empId ? ` · ${profile.empId}` : ''}
                                    </p>
                                </div>
                            </div>

                            <PeriodSwitcher month={currentMonth} period={period} todayPeriod={todayPeriod} onChange={changeMonth}/>

                            <div className="flex items-center gap-2">
                                <button id="tsAddBtn" type="button" onClick={() => openNewEntry()} className={`${btnPrimary} hidden md:inline-flex`}>
                                    <Icons.Plus/> Thêm chấm công
                                </button>
                                <button id="tsReportBtn" type="button" onClick={() => setReportOpen(true)} className={btnGhost}
                                    title="Báo cáo tổng quan của kỳ (in / lưu PDF gửi giám sát)" aria-label="Báo cáo tổng quan">
                                    <Icons.Chart/><span className="hidden sm:inline">Báo cáo</span>
                                </button>
                                <button id="tsExportBtn" type="button" onClick={handleExportExcel} disabled={exporting}
                                    className={btnGhost} title="Xuất bảng chấm công của kỳ ra Excel (mẫu Schindler)" aria-label="Xuất Excel">
                                    <Icons.Download/><span className="hidden sm:inline">{exporting ? 'Đang tạo file...' : 'Xuất Excel'}</span>
                                </button>
                                <button id="tsMailBtn" type="button" onClick={openMail} className={btnGhost}
                                    title="Gửi bảng chấm công của kỳ cho giám sát / quản lý qua email" aria-label="Gửi mail">
                                    <Icons.Mail/><span className="hidden sm:inline">Gửi mail</span>
                                </button>
                                <button id="tsSettingsBtn" type="button" onClick={() => setDrawer({ type: 'settings' })} className={btnGhost} aria-label="Sao lưu & khôi phục" title="Sao lưu & khôi phục">
                                    <Icons.Settings/><span className="hidden xl:inline">Sao lưu</span>
                                </button>
                            </div>
                        </div>
                    </header>

                    {SERVER && (
                        <div className="max-w-7xl mx-auto px-4 lg:px-6 pt-4 lg:pt-6">
                            <SyncBar info={syncInfo} status={periodStatus} note={docNotes[currentMonth] || ''} submitting={submitting} month={currentMonth} period={period}
                                onRetry={runSync} onSubmit={handleSubmit} onWithdraw={handleWithdraw}/>
                        </div>
                    )}

                    {/* ---------- Thông tin nhân viên + Dữ liệu dự án: luôn hiện, không phải mở Cài đặt ---------- */}
                    <div className="max-w-7xl mx-auto px-4 lg:px-6 pt-4 lg:pt-6 grid gap-4 lg:gap-6 md:grid-cols-2">
                        <ProfileCard profile={profile} setProfile={setProfile}/>
                        <ProjectSyncCard count={projects.length} syncing={projSyncing} status={projStatus} syncedAt={projSyncedAt}
                            missing={needProjects && projects.length === 0} onSync={handleSyncProjects}/>
                    </div>

                    {/* ---------- Gantt: lộ trình cả kỳ lương ---------- */}
                    <div className="max-w-7xl mx-auto px-4 lg:px-6 pt-4 lg:pt-6">
                        <GanttCard open={ganttOpen} onToggle={() => setGanttOpen(!ganttOpen)} period={period} month={currentMonth}
                            data={ganttOpen ? buildReport({ rows: monthlyEntries, bdOf, period, sch, holidays, missing: stats.missing }) : null}
                            onPickDay={(d) => setDayFilter(dayFilter === d ? null : d)}/>
                    </div>

                    <main className="max-w-7xl mx-auto px-4 lg:px-6 pt-4 lg:pt-6 pb-28 md:pb-10 grid gap-4 lg:gap-6 lg:grid-cols-[minmax(300px,360px)_1fr] items-start">
                        <aside className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-4 md:items-start lg:block lg:space-y-4 lg:sticky lg:top-24">
                            <StatsPanel stats={stats}/>
                            <PeriodCalendar period={period} dayTotals={dayTotals} missing={stats.missing} selected={dayFilter} sch={sch} holidays={holidays}
                                onPick={(d) => (dayTotals[d] ? setDayFilter(dayFilter === d ? null : d) : openNewEntry(d))}/>
                            <AllowanceCard calc={allowCalc} locked={locked} busy={allowBusy} hasEntries={allowProjects.length > 0}
                                onAdd={() => openAllowance(null)} onEdit={openAllowance} onDelete={handleDeleteAllowance} onDownload={handleAllowanceExcel}/>
                        </aside>

                        <section className="bg-white rounded-2xl border border-slate-200 min-w-0" aria-labelledby="tsListTitle">
                            <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100">
                                <h2 id="tsListTitle" className="font-semibold">Chấm công trong kỳ</h2>
                                <span className="text-sm text-slate-500">{visible.length} dòng</span>
                                {dayFilter && (
                                    <button type="button" onClick={() => setDayFilter(null)} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-blue-50 text-blue-800 text-sm font-medium hover:bg-blue-100">
                                        {WEEKDAYS[weekdayOf(dayFilter)]}, {fmtDMY(dayFilter)} <span aria-hidden="true">✕</span><span className="sr-only">Bỏ lọc ngày</span>
                                    </button>
                                )}
                                <button id="tsDailyMailBtn" type="button" onClick={() => setDrawer({ type: 'dailyMail', date: dayFilter || getTodayLocal(), key: Date.now() })}
                                    className="ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                    title="Gửi giám sát báo cáo thi công của một ngày (tự mở ứng dụng mail)"><Icons.Mail/> Báo cáo ngày</button>
                                {dayFilter && (
                                    <button type="button" onClick={() => openNewEntry(dayFilter)} className="text-sm font-semibold text-blue-700 hover:text-blue-900">
                                        + Thêm cho ngày {fmtDM(dayFilter)}
                                    </button>
                                )}
                            </div>
                            {visible.length === 0 ? (
                                <div className="px-6 py-14 text-center">
                                    <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 grid place-items-center text-slate-400 mb-3" aria-hidden="true"><Icons.Calendar/></div>
                                    <p className="font-medium text-slate-700">Chưa có chấm công trong kỳ {fmtDMY(period.start)} – {fmtDMY(period.end)}</p>
                                    <p className="text-sm text-slate-500 mt-1">Bấm <b>Thêm chấm công</b> hoặc chọn một ngày trên lịch.</p>
                                    <button type="button" onClick={() => openNewEntry()} className={`${btnPrimary} mt-4`}><Icons.Plus/> Thêm chấm công</button>
                                </div>
                            ) : (
                                <React.Fragment>
                                    <EntryTable rows={visible} bdOf={bdOf} sch={sch} onEdit={openEdit} onDelete={handleDelete}/>
                                    <EntryCards rows={visible} bdOf={bdOf} sch={sch} onEdit={openEdit} onDelete={handleDelete}/>
                                </React.Fragment>
                            )}
                        </section>
                    </main>

                    {/* Điện thoại / tablet: nút thêm nổi, trong tầm ngón cái */}
                    <button id="tsFab" type="button" onClick={() => openNewEntry()} aria-label="Thêm chấm công"
                        className="md:hidden fixed bottom-5 right-5 z-30 w-14 h-14 rounded-full bg-blue-700 text-white shadow-xl grid place-items-center active:scale-95 transition">
                        <Icons.Plus/>
                    </button>

                    {drawer && drawer.type === 'form' && (
                        <Drawer title={drawer.entry ? 'Sửa chấm công' : 'Thêm chấm công'} onClose={closeDrawer}>
                            <EntryForm key={drawer.key} initialData={drawer.entry} defaultDate={drawer.date}
                                onSave={handleSaveEntry} onCancel={closeDrawer}
                                onDelete={drawer.entry ? () => handleDelete(drawer.entry) : null}
                                entries={entries} projects={projects} sch={sch}/>
                        </Drawer>
                    )}
                    {drawer && drawer.type === 'mail' && (
                        <Drawer title="Gửi bảng công cho giám sát" onClose={closeDrawer}>
                            <MailPanel key={drawer.key} profile={profile} setProfile={setProfile} file={mailFile} supervisorName={supervisorName}
                                mail={buildMailText(buildReport({ rows: monthlyEntries, bdOf, period, sch, holidays, missing: stats.missing }), profile, period, currentMonth, supervisorName, allowCalc)}
                                onSent={(msg) => { closeDrawer(); showToast(msg); }} onCancel={closeDrawer}/>
                        </Drawer>
                    )}
                    {drawer && drawer.type === 'allow' && (
                        <Drawer title={drawer.row ? 'Sửa phụ cấp xe' : 'Thêm phụ cấp xe'} onClose={closeDrawer}>
                            <AllowanceForm key={drawer.key} initial={drawer.row} projects={allowProjects} entries={monthlyEntries} period={period}
                                rows={allow ? allow.rows : []} onSave={handleSaveAllowance} onCancel={closeDrawer}
                                onDelete={drawer.row ? () => handleDeleteAllowance(drawer.row) : null}/>
                        </Drawer>
                    )}
                    {drawer && drawer.type === 'submit' && (
                        <Drawer title="Nộp bảng công" onClose={closeDrawer}>
                            <SubmitPanel month={currentMonth} period={period} stats={stats} lines={monthlyEntries.length} calc={allowCalc}
                                onSubmit={doSubmit} onCancel={closeDrawer} onAddAllowance={() => openAllowance(null)} onEditAllowance={openAllowance}/>
                        </Drawer>
                    )}
                    {drawer && drawer.type === 'dailyMail' && (
                        <Drawer title="Gửi báo cáo thi công trong ngày" onClose={closeDrawer}>
                            <DailyMailPanel key={drawer.key} profile={profile} setProfile={setProfile} entries={entries} bdOf={bdOf}
                                defaultDate={drawer.date} onSent={(msg) => { closeDrawer(); showToast(msg); }} onCancel={closeDrawer}/>
                        </Drawer>
                    )}
                    {drawer && drawer.type === 'settings' && (
                        <Drawer title="Sao lưu & khôi phục" onClose={closeDrawer}>
                            <SettingsPanel onBackup={handleBackup} onRestore={handleRestore} onReset={handleResetData} onDone={closeDrawer}/>
                        </Drawer>
                    )}
                    {reportOpen && (
                        <ReportView onClose={() => setReportOpen(false)}
                            data={buildReport({ rows: monthlyEntries, bdOf, period, sch, holidays, missing: stats.missing })}
                            profile={profile} sch={sch} period={period} month={currentMonth}/>
                    )}
                    {toast && <Toast toast={toast} onClose={() => setToast(null)}/>}
                </div>
            );
        }

        // ---------- Bản máy chủ: trạng thái kỳ + đồng bộ ----------
        function SyncBar({ info, status, note, submitting, month, period, onRetry, onSubmit, onWithdraw }) {
            const [y, m] = month.split('-');
            const pending = Object.keys(TsSync.load().dirty || {}).length;
            const tone = status === 'approved' ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : status === 'rejected' ? 'bg-rose-50 text-rose-800 border-rose-200'
                : TsSync.LOCKED.includes(status) ? 'bg-amber-50 text-amber-900 border-amber-200' : 'bg-slate-50 text-slate-700 border-slate-200';
            // nhắc hạn: bảng công phải nộp trước ngày 12 của tháng kết thúc kỳ (từ ngày 9 bắt đầu nhắc)
            const today = getTodayLocal(), deadline = `${month}-12`;
            const daysLeft = Math.round((parseLocal(deadline) - parseLocal(today)) / 864e5);
            const open = status === 'draft' || status === 'rejected';
            const remind = open && today >= period.start && daysLeft <= 3
                ? (daysLeft < 0 ? { tone: 'rose', text: `⚠ Đã quá hạn nộp bảng công (hạn ${fmtDM(deadline)}). Nộp ngay để giám sát kịp duyệt.` }
                    : { tone: daysLeft <= 1 ? 'rose' : 'amber', text: `⏰ Hạn nộp bảng công kỳ này là ${fmtDM(deadline)} (${daysLeft === 0 ? 'hôm nay' : `còn ${daysLeft} ngày`}). Chấm trước cả các ngày còn lại của kỳ rồi bấm Nộp.` }) : null;
            const at = info.at ? new Date(info.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
            return (
                <div id="tsSyncBar" className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2" role="status">
                    <span id="tsPeriodStatus" className={`inline-flex items-center h-7 px-3 rounded-full border text-sm font-medium ${tone}`}>
                        Kỳ {parseInt(m, 10)}/{y}: {STATUS_LABEL[status] || status}
                    </span>
                    {status === 'submitted' && <button id="tsWithdrawBtn" type="button" onClick={onWithdraw} className={btnGhost}>Thu hồi để sửa</button>}
                    {(status === 'draft' || status === 'rejected') && (
                        <button id="tsSubmitBtn" type="button" onClick={onSubmit} disabled={submitting || info.state === 'offline'} className={btnPrimary}
                            title={info.state === 'offline' ? 'Cần có mạng để nộp' : 'Nộp bảng công của kỳ này cho giám sát duyệt'}>{submitting ? 'Đang nộp…' : 'Nộp bảng công'}</button>
                    )}
                    {TsSync.LOCKED.includes(status) && <span className="text-sm text-slate-600">{status === 'approved' ? 'Đã chuyển sang bảng Theo dõi giờ công.' : 'Không sửa được trong lúc chờ duyệt.'}</span>}
                    {status === 'rejected' && note && <span id="tsRejectNote" className="text-sm text-rose-700 font-medium">Lý do trả lại — {note}</span>}
                    {remind && <span id="tsDeadline" className={`text-sm font-medium ${remind.tone === 'rose' ? 'text-rose-700' : 'text-amber-800'}`}>{remind.text}</span>}
                    <span id="tsSyncText" className="ml-auto text-sm text-slate-600 inline-flex items-center gap-2">
                        {info.state === 'syncing' && <span>⟳ Đang đồng bộ với máy chủ…</span>}
                        {info.state === 'ok' && <span>✓ Đã lưu trên máy chủ{at ? ` lúc ${at}` : ''}{pending ? ` · còn ${pending} kỳ chưa gửi` : ''}</span>}
                        {info.state === 'offline' && <span>📴 Mất mạng — dữ liệu an toàn trên máy, sẽ tự gửi khi có mạng{pending ? ` (${pending} kỳ chưa gửi)` : ''}</span>}
                        {info.state === 'error' && <span className="text-rose-700">⚠ {info.error}</span>}
                        {(info.state === 'offline' || info.state === 'error') && <button type="button" onClick={onRetry} className="font-semibold text-blue-700 hover:text-blue-900">Thử lại</button>}
                    </span>
                </div>
            );
        }

        // ---------- Phụ cấp xe (xăng xe 60K / xe đi tỉnh) — nộp kèm bảng công cuối kỳ (xem allowance.js) ----------
        const money = (n) => TsAllowance.money(n);
        function AllowanceRowView({ x, locked, onEdit, onDelete }) {
            const T = TsAllowance.TYPES[x.type] || { short: x.type };
            return (
                <li className="py-2.5 flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className={`inline-flex h-5 px-2 rounded-full text-[11px] font-semibold items-center ${x.type === 'province' ? 'bg-violet-50 text-violet-800' : 'bg-sky-50 text-sky-800'}`}>{T.short}</span>
                            <span className="font-medium text-sm">{x.wbs || 'chưa chọn dự án'}</span>
                        </div>
                        <p className="text-xs text-slate-500 truncate" title={x.project}>{x.project}</p>
                        <p className="text-xs text-slate-600 tabular-nums">{fmtDM(x.from)} – {fmtDM(x.to)} · {x.days} ngày{x.type === 'fuel' ? ` × 60.000` : ''} = <b>{money(x.amount)} đ</b>
                            {x.overlap ? <span className="text-slate-400"> ({x.overlap} ngày đã tính ở dòng khác)</span> : null}</p>
                        {x.problems.map(p => <p key={p} className="text-xs text-rose-700 font-medium">⚠ {p}</p>)}
                    </div>
                    {!locked && (
                        <div className="flex shrink-0">
                            <button type="button" onClick={() => onEdit(x)} aria-label={`Sửa phụ cấp ${x.wbs}`} className="w-8 h-8 inline-grid place-items-center rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50"><Icons.Edit/></button>
                            <button type="button" onClick={() => onDelete(x)} aria-label={`Xóa phụ cấp ${x.wbs}`} className="w-8 h-8 inline-grid place-items-center rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50"><Icons.Trash/></button>
                        </div>
                    )}
                </li>
            );
        }
        function AllowanceCard({ calc, locked, busy, hasEntries, onAdd, onEdit, onDelete, onDownload }) {
            const rows = calc.rows.slice().sort((a, b) => a.type.localeCompare(b.type) || a.from.localeCompare(b.from));
            return (
                <section id="tsAllowCard" className="bg-white rounded-2xl border border-slate-200 p-4" aria-labelledby="tsAllowTitle">
                    <div className="flex items-center gap-2">
                        <h2 id="tsAllowTitle" className="font-semibold mr-auto">Phụ cấp xe</h2>
                        {rows.length > 0 && <span id="tsAllowTotal" className="text-sm font-semibold tabular-nums text-slate-900">{money(calc.totals.amount)} đ</span>}
                    </div>
                    {rows.length === 0 ? (
                        <p className="mt-1 text-sm text-slate-500">Đi dự án cách trụ sở 25–35 km (xăng xe 60.000 đ/ngày) hoặc làm dự án tỉnh trên 20 ngày, tự mang xe (1.000.000 đ/tháng)? Thêm phụ cấp — được nộp kèm bảng công.</p>
                    ) : (
                        <ul className="mt-1 divide-y divide-slate-100">{rows.map(x => <AllowanceRowView key={x.id} x={x} locked={locked} onEdit={onEdit} onDelete={onDelete}/>)}</ul>
                    )}
                    {!calc.ok && <p className="mt-1 text-xs text-rose-700">Sửa các dòng có ⚠ (hoặc xóa) thì mới nộp bảng công được.</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                        {!locked && <button id="tsAllowAdd" type="button" onClick={onAdd} disabled={!hasEntries} className={`${btnGhost} h-9 text-sm`}
                            title={hasEntries ? 'Thêm phụ cấp xe cho kỳ này' : 'Chấm công trước rồi thêm phụ cấp (số ngày tính từ chấm công)'}><Icons.Plus/> Thêm phụ cấp</button>}
                        {rows.length > 0 && <button id="tsAllowExcel" type="button" onClick={onDownload} disabled={busy} className={`${btnGhost} h-9 text-sm`}><Icons.Download/> {busy ? 'Đang tạo file…' : 'Tải form phụ cấp (Excel)'}</button>}
                    </div>
                    {!hasEntries && !locked && <p className="mt-1 text-xs text-slate-500">Chấm công trong kỳ trước — số ngày phụ cấp được tính từ các ngày đã chấm ở dự án.</p>}
                </section>
            );
        }

        function AllowanceForm({ initial, projects, entries, period, rows, onSave, onCancel, onDelete }) {
            const pick = (wbs) => projects.find(p => p.wbs.toUpperCase() === String(wbs || '').trim().toUpperCase());
            const [f, setF] = useState(() => initial ? { ...initial } : {
                id: String(Date.now()), type: 'fuel', wbs: '', project: '', from: period.start, to: period.end, location: '', remarks: '', ownVehicle: false,
            });
            const [touched, setTouched] = useState(false);
            const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
            const chooseProject = (wbs) => {
                const p = pick(wbs);
                setF(prev => p ? { ...prev, wbs: p.wbs, project: p.project, from: p.first, to: p.last } : { ...prev, wbs: '', project: '' });
            };
            const others = rows.filter(r => r.id !== f.id);
            const preview = TsAllowance.compute(entries, { rows: [...others, f] }, period).rows.find(r => r.id === f.id);
            const known = !f.wbs || pick(f.wbs);
            let invalid = '';
            try { TsAllowance.sanitize({ rows: [f] }, period); } catch (e) { invalid = e.message; }
            if (!f.wbs) invalid = 'Chọn dự án';
            const submit = (e) => { e.preventDefault(); setTouched(true); if (invalid) return; onSave(TsAllowance.sanitize({ rows: [f] }, period).rows[0]); };
            return (
                <form onSubmit={submit} className="px-5 py-5 space-y-5" noValidate>
                    <fieldset>
                        <legend className="block text-sm font-medium text-slate-700 mb-2">Loại phụ cấp</legend>
                        <div className="grid gap-2">
                            {Object.keys(TsAllowance.TYPES).map(k => {
                                const T = TsAllowance.TYPES[k];
                                return (
                                    <label key={k} className={`flex gap-3 rounded-xl border p-3 cursor-pointer ${f.type === k ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/15' : 'border-slate-300 hover:bg-slate-50'}`}>
                                        <input type="radio" name="tsAllowType" value={k} checked={f.type === k} onChange={() => set('type', k)} className="mt-1"/>
                                        <span><span className="font-semibold">{T.label}</span><span className="block text-xs text-slate-600">{T.rule}</span></span>
                                    </label>
                                );
                            })}
                        </div>
                    </fieldset>

                    <Field label="Dự án" htmlFor="tsAllowProject" hint="Chỉ hiện các dự án bạn đã chấm công trong kỳ. Mã WBS tự điền.">
                        <select id="tsAllowProject" data-autofocus className={inputCls} value={known ? (pick(f.wbs) || {}).wbs || '' : f.wbs} onChange={e => chooseProject(e.target.value)}>
                            <option value="">— Chọn dự án —</option>
                            {!known && <option value={f.wbs}>{f.wbs} (không còn chấm công trong kỳ)</option>}
                            {projects.map(p => <option key={p.wbs} value={p.wbs}>{p.wbs} — {p.project || 'không tên'} ({p.days} ngày)</option>)}
                        </select>
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Mã WBS" htmlFor="tsAllowWbs"><input id="tsAllowWbs" className={inputCls} value={f.wbs} readOnly disabled/></Field>
                        <Field label="Tên dự án" htmlFor="tsAllowName"><input id="tsAllowName" className={inputCls} value={f.project} readOnly disabled/></Field>
                        <Field label="Từ ngày" htmlFor="tsAllowFrom"><input id="tsAllowFrom" type="date" className={inputCls} value={f.from} min={period.start} max={period.end} onChange={e => e.target.value && set('from', e.target.value)}/></Field>
                        <Field label="Đến ngày" htmlFor="tsAllowTo"><input id="tsAllowTo" type="date" className={inputCls} value={f.to} min={period.start} max={period.end} onChange={e => e.target.value && set('to', e.target.value)}/></Field>
                    </div>
                    <Field label={f.type === 'province' ? 'Tỉnh / địa điểm dự án' : 'Địa điểm (phường / quận)'} htmlFor="tsAllowLoc">
                        <input id="tsAllowLoc" className={inputCls} value={f.location} maxLength={200} onChange={e => set('location', e.target.value)} placeholder={f.type === 'province' ? 'VD: Bình Dương' : 'VD: P. Long Trường, TP Thủ Đức'}/>
                    </Field>
                    <Field label="Ghi chú (không bắt buộc)" htmlFor="tsAllowNote">
                        <input id="tsAllowNote" className={inputCls} value={f.remarks} maxLength={300} onChange={e => set('remarks', e.target.value)}/>
                    </Field>
                    {f.type === 'province' && (
                        <label className="flex items-start gap-2 text-sm">
                            <input id="tsAllowOwn" type="checkbox" checked={!!f.ownVehicle} onChange={e => set('ownVehicle', e.target.checked)} className="mt-0.5"/>
                            <span>Tôi <b>tự mang xe máy</b> đi dự án tỉnh này</span>
                        </label>
                    )}

                    <div id="tsAllowPreview" className={`rounded-xl px-4 py-3 text-sm ${preview && preview.problems.length ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'}`} aria-live="polite">
                        {preview && f.wbs ? (
                            <React.Fragment>
                                <p><b className="tabular-nums">{preview.days}</b> ngày chấm công tại dự án trong khoảng đã chọn
                                    {preview.overlap ? ` (${preview.overlap} ngày đã tính ở dòng xăng xe khác)` : ''} → <b className="tabular-nums">{money(preview.amount)} đ</b></p>
                                {preview.problems.map(p => <p key={p} className="text-amber-900 font-medium">⚠ {p}</p>)}
                            </React.Fragment>
                        ) : <p className="text-slate-500">Chọn dự án để xem số ngày và số tiền.</p>}
                        <p className="mt-1 text-xs text-slate-500">Số ngày tính từ chính các dòng chấm công của dự án (không tính ngày nghỉ phép). Khoảng cách 25–35 km do giám sát xác nhận khi duyệt.</p>
                    </div>
                    <p role="alert" className="text-sm text-rose-700 empty:hidden">{touched ? invalid : ''}</p>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                        {onDelete && <button type="button" onClick={onDelete} className="h-11 px-3 rounded-lg text-rose-700 font-semibold hover:bg-rose-50 inline-flex items-center gap-2"><Icons.Trash/> Xóa</button>}
                        <button type="button" onClick={onCancel} className={`${btnGhost} h-11 ml-auto`}>Hủy</button>
                        <button id="tsAllowSave" type="submit" className={`${btnPrimary} h-11`}>Lưu phụ cấp</button>
                    </div>
                </form>
            );
        }

        // Xác nhận nộp bảng công: tổng giờ của kỳ + phụ cấp xe nộp kèm
        function SubmitPanel({ month, period, stats, lines, calc, onSubmit, onCancel, onAddAllowance, onEditAllowance }) {
            const [y, m] = month.split('-');
            const miss = stats.missing;
            return (
                <div className="px-5 py-5 space-y-5">
                    <section>
                        <h3 className="font-semibold">Bảng công kỳ {parseInt(m, 10)}/{y} <span className="font-normal text-slate-500">({fmtDMY(period.start)} – {fmtDMY(period.end)})</span></h3>
                        <p className="mt-1 text-sm">{lines} dòng · {stats.days} ngày · <b>{fmtH(stats.total)} giờ</b> (tăng ca {fmtH(stats.ot)})</p>
                        {miss.length > 0 && <p className="mt-1 text-sm text-amber-800">⚠ Còn {miss.length} ngày làm việc chưa chấm: {miss.slice(0, 8).map(fmtDM).join(', ')}{miss.length > 8 ? '…' : ''}</p>}
                    </section>
                    <section id="tsSubmitAllow" className="pt-4 border-t border-slate-200">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold mr-auto">Phụ cấp xe nộp kèm</h3>
                            {calc.rows.length > 0 && <span className="text-sm font-semibold tabular-nums">{money(calc.totals.amount)} đ</span>}
                        </div>
                        {calc.rows.length === 0 ? (
                            <p className="mt-1 text-sm text-slate-600">Không có phụ cấp xe kỳ này. <button type="button" onClick={onAddAllowance} className="font-semibold text-blue-700 hover:text-blue-900">+ Thêm phụ cấp xe</button></p>
                        ) : (
                            <ul className="mt-1 divide-y divide-slate-100">
                                {calc.rows.map(x => (
                                    <li key={x.id} className="py-2 text-sm flex gap-2">
                                        <span className="min-w-0 flex-1">
                                            <b>{TsAllowance.TYPES[x.type].short}</b> · {x.wbs} · {fmtDM(x.from)}–{fmtDM(x.to)} · {x.days} ngày = {money(x.amount)} đ
                                            {x.problems.map(p => <span key={p} className="block text-rose-700 font-medium">⚠ {p}</span>)}
                                        </span>
                                        {x.problems.length > 0 && <button type="button" onClick={() => onEditAllowance(x)} className="text-sm font-semibold text-blue-700 hover:text-blue-900 shrink-0">Sửa</button>}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {calc.rows.length > 0 && <p className="mt-1 text-xs text-slate-500">Giám sát xem phụ cấp cùng bảng công và tải được Bảng phụ cấp xe (Excel) theo mẫu.</p>}
                    </section>
                    {!calc.ok && <p role="alert" className="text-sm text-rose-700 font-medium">Phụ cấp xe còn lỗi — sửa hoặc xóa dòng có ⚠ rồi nộp.</p>}
                    <p className="text-sm text-slate-600">Nộp xong bạn không sửa được nữa, trừ khi giám sát trả lại hoặc bạn thu hồi trước khi giám sát duyệt.</p>
                    <div className="flex gap-2 pt-2 border-t border-slate-200">
                        <button type="button" onClick={onCancel} className={`${btnGhost} h-11 ml-auto`}>Hủy</button>
                        <button id="tsSubmitConfirm" type="button" onClick={onSubmit} disabled={!calc.ok} className={`${btnPrimary} h-11`}>Nộp cho giám sát</button>
                    </div>
                </div>
            );
        }

        // ---------- Gantt: lộ trình cả kỳ lương (thu gọn được) ----------
        function GanttCard({ open, onToggle, data, period, month, onPickDay }) {
            const [y, m] = month.split('-');
            return (
                <section id="tsGantt" className="bg-white rounded-2xl border border-slate-200 min-w-0" aria-labelledby="tsGanttTitle">
                    <button type="button" id="tsGanttToggle" onClick={onToggle} aria-expanded={open}
                        className="w-full flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left rounded-2xl hover:bg-slate-50">
                        <h2 id="tsGanttTitle" className="font-semibold">Lộ trình kỳ lương (Gantt)</h2>
                        <span className="text-sm text-slate-500">Tháng {parseInt(m, 10)}/{y} · {fmtDMY(period.start)} – {fmtDMY(period.end)}</span>
                        <span className="ml-auto text-sm font-medium text-blue-700">{open ? 'Thu gọn ▴' : 'Mở ▾'}</span>
                    </button>
                    {open && data && (
                        <div className="px-4 pb-4">
                            <div className="rp-chartwrap"><GanttChart days={data.days} gantt={data.gantt} onPickDay={onPickDay}/></div>
                            <GanttLegend/>
                            <p className="mt-1 text-xs text-slate-500">Bấm một ô để lọc danh sách chấm công theo ngày đó. Bảng này cũng nằm trong <b>Báo cáo</b> nộp cuối kỳ.</p>
                        </div>
                    )}
                </section>
            );
        }

        // ---------- Kỳ lương: ‹ tháng › + chọn nhanh ----------
        function PeriodSwitcher({ month, period, todayPeriod, onChange }) {
            const [y, m] = month.split('-');
            return (
                <div className="order-last w-full md:order-none md:w-auto flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                    <button type="button" onClick={() => onChange(shiftMonth(month, -1))} aria-label="Kỳ lương trước"
                        className="w-9 h-10 grid place-items-center rounded-lg text-slate-600 hover:bg-white"><Icons.ChevronLeft/></button>
                    <label className="relative flex-1 md:flex-none md:min-w-[11.5rem] text-center px-2 cursor-pointer rounded-lg hover:bg-white">
                        <span className="block text-sm font-semibold leading-5">Kỳ lương tháng {parseInt(m, 10)}/{y}</span>
                        <span className="block text-xs text-slate-500 leading-4">{fmtDMY(period.start)} – {fmtDMY(period.end)}</span>
                        <input type="month" value={month} aria-label="Chọn kỳ lương"
                            onChange={(e) => e.target.value && onChange(e.target.value)}
                            onClick={(e) => { try { e.currentTarget.showPicker(); } catch (_) { /* trình duyệt cũ */ } }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
                    </label>
                    <button type="button" onClick={() => onChange(shiftMonth(month, 1))} aria-label="Kỳ lương sau"
                        className="w-9 h-10 grid place-items-center rounded-lg text-slate-600 hover:bg-white"><Icons.ChevronRight/></button>
                    {month !== todayPeriod && (
                        <button type="button" onClick={() => onChange(todayPeriod)} className="h-10 px-2.5 rounded-lg text-sm font-medium text-blue-700 hover:bg-white whitespace-nowrap">Kỳ hiện tại</button>
                    )}
                </div>
            );
        }

        // ---------- Thẻ tổng hợp ----------
        function StatsPanel({ stats }) {
            const ots = Object.keys(stats.byOt).sort();
            const Tile = ({ label, value, unit, tone, note, warn }) => (
                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <div className="text-xs font-medium text-slate-500">{label}</div>
                    <div className={`mt-1 text-2xl font-bold tabular-nums ${tone === 'blue' ? 'text-blue-700' : tone === 'orange' ? 'text-orange-600' : 'text-slate-900'}`}>
                        {value}<span className="ml-1 text-sm font-medium text-slate-500">{unit}</span>
                    </div>
                    {note && <div className={`mt-1 text-xs ${warn ? 'text-rose-600 font-medium' : 'text-slate-500'}`}>{note}</div>}
                </div>
            );
            return (
                <div className="grid grid-cols-2 gap-3">
                    <Tile label="Giờ công thường" value={fmtH(stats.normal)} unit="giờ" tone="blue"/>
                    <Tile label="Tăng ca (OT)" value={fmtH(stats.ot)} unit="giờ" tone="orange"
                        note={ots.length ? ots.map(k => `${k}: ${fmtH(stats.byOt[k])}`).join(' · ') : null}/>
                    <Tile label="Tổng giờ" value={fmtH(stats.total)} unit="giờ"/>
                    <Tile label="Ngày đã chấm" value={stats.days} unit="ngày" warn={stats.missing.length > 0}
                        note={stats.missing.length ? `Còn ${stats.missing.length} ngày T2–T6 chưa chấm` : 'Đủ ngày làm việc đến hôm nay'}/>
                </div>
            );
        }

        // ---------- Lịch kỳ lương (16 → 15) ----------
        function PeriodCalendar({ period, dayTotals, missing, selected, onPick, sch, holidays }) {
            const today = getTodayLocal();
            const days = daysBetween(period.start, period.end);
            const lead = (weekdayOf(period.start) + 6) % 7; // tuần bắt đầu từ Thứ 2
            const missingSet = new Set(missing);
            return (
                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="font-semibold">Lịch kỳ lương</h2>
                        <span className="text-xs text-slate-500">{fmtDM(period.start)} – {fmtDM(period.end)}</span>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-500 mb-1" aria-hidden="true">
                        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(w => <div key={w}>{w}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: lead }).map((_, i) => <div key={'blank' + i}/>)}
                        {days.map(d => {
                            const t = dayTotals[d], w = weekdayOf(d), holi = holidayOf(d, sch), hol = !!holi, miss = missingSet.has(d);
                            const [, mm, dd] = d.split('-');
                            const showMonth = dd === '01' || d === period.start;
                            const label = `${WEEKDAYS_LONG[w]} ${fmtDMY(d)}${hol ? `, ${holi.name}` : ''}: ` +
                                (t ? `${fmtH(t.hours)} giờ — bấm để xem` : miss ? 'chưa chấm công — bấm để thêm' : 'bấm để thêm chấm công');
                            return (
                                <button key={d} type="button" onClick={() => onPick(d)} aria-pressed={selected === d} aria-label={label} title={label}
                                    className={`relative h-11 sm:h-12 rounded-lg flex flex-col items-center justify-center text-sm border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${
                                        selected === d ? 'border-blue-600 ring-2 ring-blue-600/30' : d === today ? 'border-slate-800' : 'border-transparent'
                                    } ${t ? (t.ot ? 'bg-orange-50 hover:bg-orange-100' : 'bg-blue-50 hover:bg-blue-100') : miss ? 'bg-rose-50 hover:bg-rose-100' : hol ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-slate-100'}`}>
                                    <span className={`leading-none ${showMonth ? 'text-[11px] font-semibold' : ''} ${hol || w === 0 ? 'text-rose-600' : w === 6 ? 'text-slate-500' : 'text-slate-800'}`}>
                                        {showMonth ? `${parseInt(dd, 10)}/${parseInt(mm, 10)}` : parseInt(dd, 10)}
                                    </span>
                                    {t ? <span className={`mt-1 text-[10px] font-semibold leading-none ${t.ot ? 'text-orange-700' : 'text-blue-700'}`}>{fmtH(t.hours)}h</span>
                                       : miss ? <span className="mt-1 w-1.5 h-1.5 rounded-full bg-rose-500" aria-hidden="true"/> : null}
                                </button>
                            );
                        })}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500" aria-hidden="true">
                        <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded bg-blue-100 inline-block"/>Đã chấm</span>
                        <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded bg-orange-100 inline-block"/>Có OT</span>
                        <span className="inline-flex items-center gap-1"><i className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block"/>Chưa chấm (T2–T6)</span>
                        <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded border border-slate-800 inline-block"/>Hôm nay</span>
                        <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded bg-amber-100 inline-block"/><b className="font-medium text-rose-600">Lễ</b></span>
                    </div>
                    {holidays.length > 0 && (
                        <div id="tsHolidays" className="mt-3 pt-3 border-t border-slate-100">
                            <h3 className="text-xs font-semibold text-slate-600 mb-1">Ngày lễ trong kỳ — làm việc tính OT3 / OT6 (300% / 390%)</h3>
                            <ul className="space-y-0.5 text-xs text-slate-600">
                                {holidays.map(h => (
                                    <li key={h.date} className="flex gap-2"><span className="tabular-nums font-medium text-rose-600 w-12 shrink-0">{fmtDM(h.date)}</span><span>{h.name}</span></li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            );
        }

        // Giờ thường / OT của một dòng, mỗi loại một nhãn (vd. "Giờ thường 8" "OT1 · 150% 3")
        function HourPills({ bd }) {
            const keys = OT_TYPES.map(t => t.code).filter(k => bd[k] > 0);
            if (!keys.length) return <span className="text-slate-400">—</span>;
            return (
                <span className="inline-flex flex-wrap gap-1">
                    {keys.map(k => (
                        <span key={k} title={otLabel(k)} className={`inline-flex items-center gap-1 h-6 px-2 rounded-full text-xs font-semibold whitespace-nowrap ${k === 'NORMAL' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
                            {otShort(k)}<span className="tabular-nums font-bold">{fmtH(bd[k])}</span>
                        </span>
                    ))}
                </span>
            );
        }

        // ---------- Máy tính: bảng ----------
        function EntryTable({ rows, bdOf, sch, onEdit, onDelete }) {
            return (
                <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500 text-xs whitespace-nowrap">
                            <tr>
                                <th scope="col" className="text-left font-medium px-4 py-2.5">Ngày</th>
                                <th scope="col" className="text-left font-medium px-3 py-2.5">Thời gian</th>
                                <th scope="col" className="text-right font-medium px-3 py-2.5">Giờ</th>
                                <th scope="col" className="text-left font-medium px-3 py-2.5">Loại giờ</th>
                                <th scope="col" className="text-left font-medium px-3 py-2.5">Mã CV</th>
                                <th scope="col" className="text-left font-medium px-3 py-2.5 w-full">Dự án / WBS / Ghi chú</th>
                                <th scope="col" className="px-4 py-2.5"><span className="sr-only">Thao tác</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rows.map((e, i) => {
                                const firstOfDay = i === 0 || rows[i - 1].date !== e.date;
                                const w = weekdayOf(e.date), hol = isVietnameseHoliday(e.date, sch);
                                const bd = bdOf(e);
                                const brk = parseFloat(e.breakTime) || 0, duty = parseFloat(e.dutyHour) || 0;
                                return (
                                    <tr key={e.id} onClick={() => onEdit(e)} className={`cursor-pointer hover:bg-blue-50/50 ${firstOfDay && i > 0 ? 'border-t-2 border-slate-200' : ''}`}>
                                        <td className="px-4 py-2.5 whitespace-nowrap align-top">
                                            {firstOfDay ? (
                                                <React.Fragment>
                                                    <span className="font-semibold tabular-nums">{fmtDM(e.date)}</span>{' '}
                                                    <span className={hol || w === 0 ? 'text-rose-600' : 'text-slate-500'}>{WEEKDAYS[w]}{hol ? ' · Lễ' : ''}</span>
                                                </React.Fragment>
                                            ) : <span className="sr-only">{fmtDMY(e.date)}</span>}
                                        </td>
                                        <td className="px-3 py-2.5 whitespace-nowrap tabular-nums align-top">
                                            {e.startTime && e.endTime ? `${e.startTime} – ${e.endTime}` : '—'}
                                            {(brk > 0 || duty > 0) && (
                                                <div className="text-xs text-slate-400">{[brk > 0 ? `nghỉ ${fmtH(brk)}h` : '', duty > 0 ? `trực ${fmtH(duty)}h` : ''].filter(Boolean).join(' · ')}</div>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums align-top">{fmtH(sumBd(bd))}</td>
                                        <td className="px-3 py-2.5 align-top"><HourPills bd={bd}/></td>
                                        <td className="px-3 py-2.5 font-mono text-xs text-blue-700 align-top whitespace-nowrap">{e.activityCode}</td>
                                        <td className="px-3 py-2.5 align-top max-w-0">
                                            <div className="truncate" title={e.projectName}>{e.projectName || '—'}</div>
                                            {e.workNumber && <div className="text-xs text-slate-500 font-mono truncate">{e.workNumber}</div>}
                                            {e.remarks && <div className="text-xs text-slate-500 italic truncate" title={e.remarks}>{e.remarks}</div>}
                                            {e.report && <div className="text-xs text-blue-800 truncate" title={e.report}>📝 {e.report}</div>}
                                        </td>
                                        <td className="px-4 py-2 align-top text-right whitespace-nowrap">
                                            <button type="button" aria-label={`Sửa chấm công ${fmtDMY(e.date)}`} onClick={(ev) => { ev.stopPropagation(); onEdit(e); }}
                                                className="w-8 h-8 inline-grid place-items-center rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50"><Icons.Edit/></button>
                                            <button type="button" aria-label={`Xóa chấm công ${fmtDMY(e.date)}`} onClick={(ev) => { ev.stopPropagation(); onDelete(e); }}
                                                className="w-8 h-8 inline-grid place-items-center rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50"><Icons.Trash/></button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            );
        }

        // ---------- Điện thoại / tablet: thẻ theo ngày ----------
        function EntryCards({ rows, bdOf, sch, onEdit, onDelete }) {
            const groups = [];
            rows.forEach(e => {
                const g = groups[groups.length - 1];
                if (g && g.date === e.date) g.items.push(e); else groups.push({ date: e.date, items: [e] });
            });
            return (
                <div className="lg:hidden divide-y divide-slate-100">
                    {groups.map(g => {
                        const total = g.items.reduce((s, e) => s + sumBd(bdOf(e)), 0);
                        const w = weekdayOf(g.date), hol = isVietnameseHoliday(g.date, sch);
                        return (
                            <div key={g.date} className="px-4 py-3">
                                <div className="flex items-baseline justify-between mb-2">
                                    <span className="font-semibold">
                                        <span className={hol || w === 0 ? 'text-rose-600' : ''}>{WEEKDAYS_LONG[w]}</span>, {fmtDMY(g.date)}{hol ? <span className="text-rose-600"> · Lễ</span> : null}
                                    </span>
                                    <span className="text-sm text-slate-500 tabular-nums">{fmtH(total)} giờ</span>
                                </div>
                                <ul className="space-y-2">
                                    {g.items.map(e => (
                                        <li key={e.id} className="rounded-xl border border-slate-200 flex items-stretch">
                                            <button type="button" onClick={() => onEdit(e)} className="flex-1 min-w-0 text-left p-3 rounded-l-xl hover:bg-slate-50">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-medium tabular-nums">{e.startTime && e.endTime ? `${e.startTime} – ${e.endTime}` : 'Không có giờ'}</span>
                                                    <span className="text-sm text-slate-500 tabular-nums">{fmtH(sumBd(bdOf(e)))}h</span>
                                                </div>
                                                <div className="mt-1"><HourPills bd={bdOf(e)}/>
                                                </div>
                                                <div className="mt-1 text-sm truncate"><span className="font-mono text-blue-700">[{e.activityCode}]</span> {e.projectName}</div>
                                                {e.workNumber && <div className="text-xs text-slate-500 font-mono truncate">{e.workNumber}</div>}
                                                {e.remarks && <div className="text-xs text-slate-500 truncate">Ghi chú: {e.remarks}</div>}
                                                {e.report && <div className="text-xs text-blue-800 truncate">📝 {e.report}</div>}
                                            </button>
                                            <button type="button" onClick={() => onDelete(e)} aria-label={`Xóa chấm công ${fmtDMY(e.date)}`}
                                                className="w-12 grid place-items-center rounded-r-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border-l border-slate-100"><Icons.Trash/></button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        );
                    })}
                </div>
            );
        }

        // ---------- Ngăn trượt (máy tính: bên phải · điện thoại: toàn màn hình) ----------
        function Drawer({ title, onClose, children }) {
            const panel = useRef(null);
            useEffect(() => {
                const prevFocus = document.activeElement;
                const onKey = (e) => { if (e.key === 'Escape') onClose(); };
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
            return (
                <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="tsDrawerTitle">
                    <div className="absolute inset-0 bg-slate-900/40 ts-fade" onClick={onClose}/>
                    <div ref={panel} tabIndex={-1} className="absolute inset-y-0 right-0 w-full md:max-w-xl bg-white shadow-2xl flex flex-col outline-none ts-drawer">
                        <div className="flex items-center justify-between px-5 h-14 border-b border-slate-200 shrink-0">
                            <h2 id="tsDrawerTitle" className="font-semibold text-lg">{title}</h2>
                            <button type="button" onClick={onClose} aria-label="Đóng" className="w-10 h-10 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><Icons.X/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto">{children}</div>
                    </div>
                </div>
            );
        }


        // ================================================================
        //   BÁO CÁO TỔNG QUAN (cho giám sát xem nhanh) — in / lưu PDF bằng trình duyệt
        // ================================================================
        const CAT_LABEL = { NI: 'Lắp đặt mới (NI)', MOD: 'Hiện đại hoá (MOD)', EI: 'Bảo trì, sửa chữa (EI)', TF: 'Kiểm định (TF)',
            SAF: 'An toàn', HR: 'Họp, đào tạo, hành chính', Other: 'Khác' };
        const LEAVE_LABEL = { '6010': 'Nghỉ hưởng lương (phép năm / lễ)', '6020': 'Nghỉ ốm / tai nạn', '6090': 'Nghỉ không lương' };
        const pct = (x, total) => (total > 0 ? Math.round(x / total * 1000) / 10 : 0);
        const fmtPct = (x) => x.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + '%';

        // Tổng hợp số liệu của kỳ: giờ làm việc (không tính nghỉ), dự án, hoạt động, nghỉ, theo ngày
        function buildReport({ rows, bdOf, period, sch, holidays, missing }) {
            const isLeave = (e) => LaborVN.LEAVE_CODES.includes(String(e.activityCode));
            const work = rows.filter(e => !isLeave(e)), leaveRows = rows.filter(isLeave);
            const byType = {}; let normal = 0, ot = 0, weighted = 0;
            const projects = {}, activities = {}, cats = {}, leave = {};
            const day = {};
            work.forEach(e => {
                const bd = bdOf(e), h = sumBd(bd);
                Object.keys(bd).forEach(k => {
                    byType[k] = (byType[k] || 0) + bd[k];
                    if (k === 'NORMAL') normal += bd[k]; else ot += bd[k];
                    weighted += bd[k] * (LaborVN.OT_RATES[k] || 100) / 100;
                });
                const d = day[e.date] || (day[e.date] = { normal: 0, ot: 0, leave: false });
                d.normal += bd.NORMAL || 0; d.ot += h - (bd.NORMAL || 0);
                const pk = (e.workNumber || '') + '|' + (e.projectName || '');
                const p = projects[pk] || (projects[pk] = { name: e.projectName || '(không ghi dự án)', wbs: e.workNumber || '', days: {}, dayHours: {}, normal: 0, ot: 0 });
                p.days[e.date] = true; p.normal += bd.NORMAL || 0; p.ot += h - (bd.NORMAL || 0);
                const pd = p.dayHours[e.date] || (p.dayHours[e.date] = { normal: 0, ot: 0 });
                pd.normal += bd.NORMAL || 0; pd.ot += h - (bd.NORMAL || 0);
                const meta = ACTIVITY_META.find(a => a.id === e.activityCode || a.code === e.activityCode);
                const ak = String(e.activityCode || '—');
                const a = activities[ak] || (activities[ak] = { code: ak, desc: meta ? meta.desc.replace(/^\S+\s*-\s*/, '') : 'Mã khác', cat: meta ? meta.cat : 'Other', hours: 0 });
                a.hours += h;
                cats[a.cat] = (cats[a.cat] || 0) + h;
            });
            leaveRows.forEach(e => {
                const code = String(e.activityCode);
                const l = leave[code] || (leave[code] = { code, label: LEAVE_LABEL[code] || code, days: {}, hours: 0 });
                l.days[e.date] = true; l.hours += entryHours(e);
                (day[e.date] || (day[e.date] = { normal: 0, ot: 0, leave: false })).leave = true;
            });
            const total = normal + ot;
            const projectList = Object.values(projects).map(p => ({ ...p, days: Object.keys(p.days).length, total: p.normal + p.ot }))
                .sort((a, b) => b.total - a.total);
            const activityList = Object.values(activities).sort((a, b) => b.hours - a.hours);
            const catList = Object.keys(cats).map(c => ({ cat: c, label: CAT_LABEL[c] || c, hours: cats[c] })).sort((a, b) => b.hours - a.hours);
            const leaveList = Object.values(leave).map(l => ({ ...l, dates: Object.keys(l.days).sort(), days: Object.keys(l.days).length }));
            const workDays = Object.keys(day).filter(d => day[d].normal + day[d].ot > 0).length;
            const days = daysBetween(period.start, period.end).map(d => ({ date: d, ...(day[d] || { normal: 0, ot: 0, leave: false }),
                holiday: holidayOf(d, sch), rest: LaborVN.isRestDay(d, sch), missing: missing.includes(d) }));
            const gantt = buildGantt(Object.values(projects), leave, days);
            return { total, normal, ot, weighted, byType, workDays, projectList, activityList, catList, leaveList, gantt,
                leaveDays: new Set(leaveRows.map(e => e.date)).size, leaveHours: leaveRows.reduce((s, e) => s + entryHours(e), 0),
                days, holidays, missing, entries: rows.length };
        }

        // Giờ làm theo ngày: cột chồng giờ thường (xanh) + tăng ca (cam), vạch tham chiếu 8 giờ
        function DailyChart({ days, h = 190 }) {
            const W = 720, H = h, padL = 26, padB = 30, padT = 10;
            const max = Math.max(12, ...days.map(d => d.normal + d.ot));
            const top = Math.ceil(max / 4) * 4;
            const cw = (W - padL) / days.length, bw = Math.max(6, Math.min(16, cw - 4));
            const y = (h) => padT + (H - padT - padB) * (1 - h / top);
            const grid = []; for (let g = 0; g <= top; g += 4) grid.push(g);
            return (
                <svg viewBox={`0 0 ${W} ${H}`} className="rp-chart" role="img" aria-label="Biểu đồ giờ làm theo ngày trong kỳ">
                    {grid.map(g => (
                        <g key={g}>
                            <line x1={padL} x2={W} y1={y(g)} y2={y(g)} stroke={g === 0 ? '#94a3b8' : '#e2e8f0'} strokeWidth="1"/>
                            <text x={padL - 5} y={y(g) + 3} textAnchor="end" className="rp-axis">{g}</text>
                        </g>
                    ))}
                    <line x1={padL} x2={W} y1={y(8)} y2={y(8)} stroke="#64748b" strokeWidth="1" strokeDasharray="3 3"/>
                    <text x={W - 2} y={y(8) - 3} textAnchor="end" className="rp-axis">8 giờ</text>
                    {days.map((d, i) => {
                        const x = padL + i * cw + (cw - bw) / 2, cx = padL + i * cw + cw / 2;
                        const [, mm, dd] = d.date.split('-');
                        const total = d.normal + d.ot;
                        const label = `${WEEKDAYS_LONG[weekdayOf(d.date)]} ${fmtDMY(d.date)}: ${fmtH(d.normal)} giờ thường` +
                            (d.ot ? `, ${fmtH(d.ot)} giờ tăng ca` : '') + (d.holiday ? ` — ${d.holiday.name}` : '') + (d.leave ? ' — có nghỉ' : '') + (d.missing ? ' — chưa chấm' : '');
                        const yN = y(d.normal), yT = y(total), gap = d.normal > 0 && d.ot > 0 ? 2 : 0;
                        return (
                            <g key={d.date}>
                                <title>{label}</title>
                                {(d.holiday || d.rest) && <rect x={padL + i * cw} y={padT} width={cw} height={H - padT - padB} fill={d.holiday ? '#fef3c7' : '#f1f5f9'}/>}
                                <rect x={padL + i * cw} y={padT} width={cw} height={H - padT - padB} fill="transparent"/>
                                {d.normal > 0 && <path d={barPath(x, yN, bw, y(0) - yN, d.ot > 0 ? 0 : 3)} fill="#1d4ed8"/>}
                                {d.ot > 0 && <path d={barPath(x, yT, bw, Math.max(1, yN - yT - gap), 3)} fill="#ea580c"/>}
                                <text x={cx} y={H - padB + 12} textAnchor="middle" className={`rp-axis ${d.holiday || weekdayOf(d.date) === 0 ? 'rp-red' : ''}`}>
                                    {dd === '01' || i === 0 ? `${parseInt(dd, 10)}/${parseInt(mm, 10)}` : parseInt(dd, 10)}
                                </text>
                                {d.leave && <text x={cx} y={H - padB + 24} textAnchor="middle" className="rp-axis rp-leave">P</text>}
                                {d.missing && <circle cx={cx} cy={H - padB + 21} r="2.5" fill="#e11d48"/>}
                            </g>
                        );
                    })}
                </svg>
            );
        }
        // cột bo góc 4px ở đầu dữ liệu (phía trên), đáy vuông nằm trên trục
        const barPath = (x, y, w, h, r) => {
            if (h <= 0) return '';
            r = Math.min(r, w / 2, h);
            return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
        };

        // ---------- Gantt: lộ trình cả kỳ lương — mỗi dự án một hàng, mỗi ngày làm một ô ----------
        const GANTT_COLORS = ['#2563eb', '#0d9488', '#e11d48', '#65a30d', '#c026d3', '#475569', '#0891b2', '#9333ea'];
        const GANTT_MAX_ROWS = 10;
        function buildGantt(projectRaw, leave, days) {
            const dayInfo = {}; days.forEach(d => { dayInfo[d.date] = d; });
            const order = days.map(d => d.date);
            const rows = projectRaw.map(p => {
                const dates = Object.keys(p.dayHours).sort();
                return { key: p.wbs + '|' + p.name, name: p.name, wbs: p.wbs, dayHours: p.dayHours, dates,
                    total: p.normal + p.ot, first: dates[0] };
            }).sort((a, b) => (a.first < b.first ? -1 : a.first > b.first ? 1 : b.total - a.total));
            let list = rows;
            if (rows.length > GANTT_MAX_ROWS) {      // quá nhiều dự án: gộp phần còn lại để báo cáo vẫn gọn
                const rest = rows.slice(GANTT_MAX_ROWS - 1), dayHours = {};
                rest.forEach(r => Object.keys(r.dayHours).forEach(dt => {
                    const x = dayHours[dt] || (dayHours[dt] = { normal: 0, ot: 0 });
                    x.normal += r.dayHours[dt].normal; x.ot += r.dayHours[dt].ot;
                }));
                list = rows.slice(0, GANTT_MAX_ROWS - 1).concat([{ key: '_rest', name: `${rest.length} dự án khác`, wbs: '', dayHours,
                    dates: Object.keys(dayHours).sort(), total: rest.reduce((t, r) => t + r.total, 0), first: '', merged: true }]);
            }
            list.forEach((r, i) => {
                r.color = r.merged ? '#64748b' : GANTT_COLORS[i % GANTT_COLORS.length];
                // nối các ngày làm cách nhau chỉ bằng ngày nghỉ hằng tuần / lễ thành một đoạn liền
                r.links = [];
                for (let k = 1; k < r.dates.length; k++) {
                    const a = order.indexOf(r.dates[k - 1]), b = order.indexOf(r.dates[k]);
                    if (b - a > 1 && order.slice(a + 1, b).every(dt => dayInfo[dt].holiday || dayInfo[dt].rest)) r.links.push([a, b]);
                }
            });
            const leaveDates = {}; Object.values(leave).forEach(l => Object.keys(l.days).forEach(dt => { leaveDates[dt] = l.label; }));
            return { rows: list, leaveDates, hasLeave: Object.keys(leaveDates).length > 0 };
        }

        function GanttChart({ days, gantt, onPickDay, compact }) {
            const W = 720, LBL = 150, padT = 28, rowH = compact ? 18 : 24, padB = 14;
            const rows = gantt.rows, nRows = rows.length + (gantt.hasLeave ? 1 : 0);
            const H = padT + Math.max(1, nRows) * rowH + padB;
            const cw = (W - LBL) / days.length, x = (i) => LBL + i * cw;
            const clip = (t, n) => (t.length > n ? t.slice(0, n - 1) + '…' : t);
            const cellLabel = (r, d, hrs) => `${r.name}${r.wbs ? ' (' + r.wbs + ')' : ''} — ${WEEKDAYS_LONG[weekdayOf(d.date)]} ${fmtDMY(d.date)}: ${fmtH(hrs.normal)} giờ thường` + (hrs.ot ? `, ${fmtH(hrs.ot)} giờ tăng ca` : '');
            return (
                <svg viewBox={`0 0 ${W} ${H}`} className="rp-chart rp-gantt" role="img" aria-label="Biểu đồ Gantt: các dự án đã làm theo từng ngày trong kỳ">
                    {days.map((d, i) => (d.holiday || d.rest) && (
                        <rect key={'bg' + d.date} x={x(i)} y={padT - 4} width={cw} height={H - padT - padB + 4} fill={d.holiday ? '#fef3c7' : '#f1f5f9'}/>
                    ))}
                    {days.map((d, i) => {
                        const dd = parseInt(d.date.split('-')[2], 10), red = d.holiday || weekdayOf(d.date) === 0;
                        return (
                            <g key={'h' + d.date}>
                                <text x={x(i) + cw / 2} y={11} textAnchor="middle" className={`rp-axis ${red ? 'rp-red' : ''}`}>{WEEKDAYS[weekdayOf(d.date)]}</text>
                                <text x={x(i) + cw / 2} y={22} textAnchor="middle" className={`rp-axis ${red ? 'rp-red' : ''}`}>{dd === 1 || i === 0 ? `${dd}/${parseInt(d.date.split('-')[1], 10)}` : dd}</text>
                                {d.missing && <circle cx={x(i) + cw / 2} cy={H - padB + 6} r="2.5" fill="#e11d48"><title>{`Chưa chấm ${fmtDMY(d.date)}`}</title></circle>}
                            </g>
                        );
                    })}
                    <line x1={LBL} x2={W} y1={padT - 4} y2={padT - 4} stroke="#94a3b8" strokeWidth="1"/>
                    {rows.map((r, ri) => {
                        const y = padT + ri * rowH, by = y + 4, bh = rowH - 8;
                        return (
                            <g key={r.key}>
                                <line x1={0} x2={W} y1={y + rowH} y2={y + rowH} stroke="#e2e8f0" strokeWidth="1"/>
                                <title>{`${r.name}${r.wbs ? ' (' + r.wbs + ')' : ''} — ${fmtH(r.total)} giờ, ${r.dates.length} ngày`}</title>
                                <rect x={0} y={y + 6} width="4" height={rowH - 12} rx="2" fill={r.color}/>
                                {compact
                                    ? <text x={9} y={y + rowH / 2 + 3} className="rp-gname">{clip(r.name, 21)}<tspan className="rp-axis"> · {fmtH(r.total)} giờ</tspan></text>
                                    : <React.Fragment>
                                        <text x={9} y={y + rowH * 0.46} className="rp-gname">{clip(r.name, 26)}</text>
                                        <text x={9} y={y + rowH * 0.85} className="rp-axis">{(r.wbs ? clip(r.wbs, 14) + ' · ' : '') + fmtH(r.total) + ' giờ'}</text>
                                    </React.Fragment>}
                                {r.links.map(([a, b]) => <rect key={'l' + a} x={x(a) + cw - 1} y={by + bh / 2 - 1.5} width={x(b) - x(a) - cw + 2} height="3" fill={r.color} opacity=".35"/>)}
                                {days.map((d, i) => {
                                    const hrs = r.dayHours[d.date]; if (!hrs) return null;
                                    const tot = hrs.normal + hrs.ot, label = fmtH(tot);
                                    return (
                                        <g key={d.date} className={onPickDay ? 'rp-gcell' : undefined} onClick={onPickDay ? () => onPickDay(d.date) : undefined}>
                                            <title>{cellLabel(r, d, hrs)}</title>
                                            <rect x={x(i) + 0.5} y={by} width={cw - 1} height={bh} rx="2.5" fill={r.color}/>
                                            {hrs.ot > 0 && <rect x={x(i) + 0.5} y={by + bh - 3} width={cw - 1} height="3" fill="#ea580c"/>}
                                            {cw >= 15 && label.length * 4.6 < cw - 1 && <text x={x(i) + cw / 2} y={by + bh / 2 + 3} textAnchor="middle" className="rp-gtxt">{label}</text>}
                                        </g>
                                    );
                                })}
                            </g>
                        );
                    })}
                    {gantt.hasLeave && (() => {
                        const y = padT + rows.length * rowH, by = y + 4, bh = rowH - 8;
                        return (
                            <g>
                                <rect x={0} y={y + 6} width="4" height={rowH - 12} rx="2" fill="#7c3aed"/>
                                {compact
                                    ? <text x={9} y={y + rowH / 2 + 3} className="rp-gname">Nghỉ phép / ốm<tspan className="rp-axis"> · không tính giờ</tspan></text>
                                    : <React.Fragment>
                                        <text x={9} y={y + rowH * 0.46} className="rp-gname">Nghỉ phép / ốm</text>
                                        <text x={9} y={y + rowH * 0.85} className="rp-axis">P · không tính giờ làm</text>
                                    </React.Fragment>}
                                {days.map((d, i) => gantt.leaveDates[d.date] ? (
                                    <g key={d.date}><title>{`${gantt.leaveDates[d.date]} — ${fmtDMY(d.date)}`}</title>
                                        <rect x={x(i) + 0.5} y={by} width={cw - 1} height={bh} rx="2.5" fill="#ede9fe" stroke="#7c3aed" strokeWidth="1"/>
                                        {cw >= 12 && <text x={x(i) + cw / 2} y={by + bh / 2 + 3} textAnchor="middle" className="rp-gtxt" fill="#6d28d9">P</text>}
                                    </g>) : null)}
                            </g>
                        );
                    })()}
                    {nRows === 0 && <text x={LBL + 8} y={padT + 16} className="rp-axis">Chưa có giờ làm việc trong kỳ.</text>}
                </svg>
            );
        }

        function GanttLegend({ short }) {
            return (
                <div className="rp-legend">
                    <span><i style={{ background: '#2563eb' }}/>Ngày làm việc (số giờ trong ô; mỗi dự án một màu)</span>
                    <span><i style={{ background: '#ea580c', height: 4 }}/>Có tăng ca</span>
                    {!short && <span><i style={{ background: '#fef3c7', border: '1px solid #fcd34d' }}/>Ngày lễ / nghỉ bù</span>}
                    {!short && <span><i style={{ background: '#f1f5f9', border: '1px solid #cbd5e1' }}/>Ngày nghỉ hằng tuần</span>}
                    {!short && <span><i className="rp-dot"/>Chưa chấm</span>}
                </div>
            );
        }

        function Bar({ value, max, color }) {
            return <span className="rp-bar"><span style={{ width: `${max > 0 ? Math.max(1, value / max * 100) : 0}%`, background: color || '#1d4ed8' }}/></span>;
        }

        function ReportView({ data, profile, sch, period, month, onClose }) {
            useEffect(() => {
                document.body.classList.add('ts-report-open');
                const onKey = (e) => { if (e.key === 'Escape') onClose(); };
                document.addEventListener('keydown', onKey);
                const title = document.title;
                const [y, m] = month.split('-');
                document.title = `Bao_cao_tong_quan_${removeAccents(profile.name || 'Timesheet')}_Thang_${m}_${y}`; // tên file PDF gợi ý
                return () => { document.body.classList.remove('ts-report-open'); document.removeEventListener('keydown', onKey); document.title = title; };
            }, []);
            const [y, m] = month.split('-');
            const d = data;
            const otTypes = OT_TYPES.filter(t => d.byType[t.code] > 0);
            const maxProj = d.projectList.length ? d.projectList[0].total : 0;
            const maxAct = d.activityList.length ? d.activityList[0].hours : 0;
            const leaveDates = (l) => l.dates.map(fmtDM).join(', ');
            return (
                <div className="rp-overlay" role="dialog" aria-modal="true" aria-labelledby="rpTitle">
                    <div className="rp-toolbar">
                        <button type="button" onClick={() => window.print()} className={btnPrimary}><Icons.Download/> In / Lưu PDF</button>
                        <button type="button" onClick={onClose} className={btnGhost}>Đóng</button>
                        <span className="rp-hint">Chọn “Lưu dưới dạng PDF” để gửi giám sát.</span>
                    </div>
                    <article className="rp-page" id="tsReport">
                        <header className="rp-head">
                            <div>
                                <div className="rp-kicker">Schindler · Timesheet cá nhân</div>
                                <h1 id="rpTitle">Báo cáo tổng quan chấm công</h1>
                                <div className="rp-sub">Kỳ lương tháng {parseInt(m, 10)}/{y} · {fmtDMY(period.start)} – {fmtDMY(period.end)}</div>
                            </div>
                            <dl className="rp-who">
                                <div><dt>Họ tên</dt><dd>{profile.name || '—'}</dd></div>
                                <div><dt>Mã NV</dt><dd>{profile.empId || '—'}</dd></div>
                                <div><dt>Chức vụ</dt><dd>{profile.position || '—'}</dd></div>
                                <div><dt>Phòng ban</dt><dd>{profile.dept || '—'}</dd></div>
                                <div><dt>Lịch làm việc</dt><dd>{LaborVN.SCHEDULES[sch].short}</dd></div>
                            </dl>
                        </header>

                        <section className="rp-kpis" aria-label="Số liệu chính">
                            <div className="rp-kpi"><span>Tổng giờ làm việc</span><b>{fmtH(d.total)}<small> giờ</small></b><em>{d.workDays} ngày có làm việc</em></div>
                            <div className="rp-kpi"><span>Giờ công thường</span><b className="rp-blue">{fmtH(d.normal)}<small> giờ</small></b><em>{fmtPct(pct(d.normal, d.total))} tổng giờ</em></div>
                            <div className="rp-kpi"><span>Tăng ca (OT)</span><b className="rp-orange">{fmtH(d.ot)}<small> giờ</small></b><em>{fmtPct(pct(d.ot, d.total))} tổng giờ</em></div>
                            <div className="rp-kpi"><span>Nghỉ</span><b>{d.leaveDays}<small> ngày</small></b><em>{d.leaveHours > 0 ? `${fmtH(d.leaveHours)} giờ` : 'không có'}</em></div>
                            <div className={`rp-kpi ${d.missing.length ? 'rp-warn' : ''}`}><span>Ngày chưa chấm</span><b>{d.missing.length}<small> ngày</small></b>
                                <em>{d.missing.length ? '⚠ ' + d.missing.map(fmtDM).join(', ') : '✓ đủ ngày làm việc'}</em></div>
                        </section>

                        <section className="rp-sec">
                            <h2>Giờ làm theo ngày</h2>
                            <div className="rp-chartwrap"><DailyChart days={d.days} h={120}/></div>
                            <div className="rp-legend">
                                <span><i style={{ background: '#1d4ed8' }}/>Giờ thường</span>
                                <span><i style={{ background: '#ea580c' }}/>Tăng ca</span>
                                <span><i style={{ background: '#fef3c7', border: '1px solid #fcd34d' }}/>Ngày lễ / nghỉ bù</span>
                                <span><i style={{ background: '#f1f5f9', border: '1px solid #cbd5e1' }}/>Ngày nghỉ hằng tuần</span>
                                <span><b className="rp-leave">P</b> Nghỉ phép / ốm</span>
                                <span><i className="rp-dot"/>Chưa chấm</span>
                            </div>
                        </section>

                        <section className="rp-sec">
                            <h2>Lộ trình trong kỳ (Gantt)</h2>
                            <div className="rp-chartwrap"><GanttChart days={d.days} gantt={d.gantt} compact/></div>
                            <GanttLegend short/>
                        </section>

                        <div className="rp-cols">
                            <section className="rp-sec">
                                <h2>Theo dự án</h2>
                                {d.projectList.length ? (
                                    <table className="rp-table">
                                        <thead><tr><th>Dự án / WBS</th><th className="r">Ngày</th><th className="r">Thường</th><th className="r">OT</th><th className="r">Tổng</th><th className="rp-wbar">Tỷ lệ</th></tr></thead>
                                        <tbody>
                                            {d.projectList.map(p => (
                                                <tr key={p.wbs + p.name}>
                                                    <td><div className="rp-name">{p.name}</div>{p.wbs && <div className="rp-mono">{p.wbs}</div>}</td>
                                                    <td className="r">{p.days}</td><td className="r">{fmtH(p.normal)}</td><td className="r">{fmtH(p.ot)}</td>
                                                    <td className="r b">{fmtH(p.total)}</td>
                                                    <td className="rp-wbar"><Bar value={p.total} max={maxProj}/><span className="rp-pct">{fmtPct(pct(p.total, d.total))}</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : <p className="rp-empty">Chưa có giờ làm việc trong kỳ.</p>}
                            </section>

                            <section className="rp-sec">
                                <h2>Theo hoạt động</h2>
                                {d.activityList.length ? (
                                    <React.Fragment>
                                        <table className="rp-table">
                                            <thead><tr><th>Mã · Hoạt động</th><th className="r">Giờ</th><th className="rp-wbar">Tỷ lệ</th></tr></thead>
                                            <tbody>
                                                {d.activityList.map(a => (
                                                    <tr key={a.code}>
                                                        <td><span className="rp-mono">{a.code}</span> {a.desc}</td>
                                                        <td className="r b">{fmtH(a.hours)}</td>
                                                        <td className="rp-wbar"><Bar value={a.hours} max={maxAct}/><span className="rp-pct">{fmtPct(pct(a.hours, d.total))}</span></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <h3>Theo nhóm công việc</h3>
                                        <ul className="rp-cats">
                                            {d.catList.map(c => <li key={c.cat}><span>{c.label}</span><b>{fmtH(c.hours)} giờ · {fmtPct(pct(c.hours, d.total))}</b></li>)}
                                        </ul>
                                    </React.Fragment>
                                ) : <p className="rp-empty">Chưa có hoạt động trong kỳ.</p>}
                            </section>
                        </div>

                        <div className="rp-cols">
                            <section className="rp-sec">
                                <h2>Giờ công theo loại</h2>
                                <table className="rp-table">
                                    <thead><tr><th>Loại giờ</th><th className="r">Hệ số</th><th className="r">Giờ</th><th className="r">Tỷ lệ</th></tr></thead>
                                    <tbody>
                                        {otTypes.length ? otTypes.map(t => (
                                            <tr key={t.code}><td>{t.label.replace(/ \(\d+%\)$/, '')}</td><td className="r">{LaborVN.OT_RATES[t.code]}%</td>
                                                <td className="r b">{fmtH(d.byType[t.code])}</td><td className="r">{fmtPct(pct(d.byType[t.code], d.total))}</td></tr>
                                        )) : <tr><td colSpan="4" className="rp-empty">Chưa có giờ làm việc.</td></tr>}
                                    </tbody>
                                    <tfoot><tr><td>Tổng</td><td/><td className="r b">{fmtH(d.total)}</td><td className="r">100%</td></tr>
                                        <tr><td colSpan="2">Giờ quy đổi theo hệ số</td><td className="r b">{fmtH(d.weighted)}</td><td/></tr></tfoot>
                                </table>
                            </section>

                            <section className="rp-sec">
                                <h2>Nghỉ & ngày lễ</h2>
                                <table className="rp-table">
                                    <thead><tr><th>Loại nghỉ</th><th className="r">Ngày</th><th className="r">Giờ</th></tr></thead>
                                    <tbody>
                                        {d.leaveList.length ? d.leaveList.map(l => (
                                            <tr key={l.code}><td>{l.label}<div className="rp-muted">{leaveDates(l)}</div></td><td className="r b">{l.days}</td><td className="r">{fmtH(l.hours)}</td></tr>
                                        )) : <tr><td colSpan="3" className="rp-empty">Không nghỉ phép / ốm / không lương trong kỳ.</td></tr>}
                                    </tbody>
                                </table>
                                <h3>Ngày lễ trong kỳ</h3>
                                {d.holidays.length
                                    ? <ul className="rp-list">{d.holidays.map(h => <li key={h.date}><b>{fmtDM(h.date)}</b> {h.name}</li>)}</ul>
                                    : <p className="rp-muted">Không có ngày lễ.</p>}
                            </section>
                        </div>

                        <footer className="rp-foot">
                            <p>Giờ tăng ca tính theo Bộ luật Lao động 2019 (Điều 98, 106) và Nghị định 145/2020 (Điều 57). Chi tiết từng dòng xem file bảng chấm công Excel.
                                Lập ngày {fmtDMY(getTodayLocal())} từ Timesheet cá nhân ({d.entries} dòng chấm công).</p>
                            <div className="rp-sign">
                                <div><span>Người lao động</span><i/>{profile.name || ''}</div>
                                <div><span>Giám sát (PM / PE) xác nhận</span><i/></div>
                            </div>
                        </footer>
                    </article>
                </div>
            );
        }


        // ================================================================
        //   GỬI MAIL CHO GIÁM SÁT
        //   Web tĩnh không tự gửi được thư → mở ứng dụng mail đã điền sẵn người nhận / tiêu đề / nội dung:
        //   - Chia sẻ (điện thoại, Windows, Mac): kèm luôn file Excel, chọn Gmail / Outlook trong bảng chia sẻ
        //   - mailto: (Outlook / ứng dụng mail mặc định), Gmail web, Outlook web: tải file Excel để đính kèm
        // ================================================================
        const EMAIL_RE = /^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/;
        const parseEmails = (s) => String(s || '').split(/[,;\s]+/).map(x => x.trim()).filter(Boolean);
        const MAILTO_MAX = 1900; // một số ứng dụng mail cắt / từ chối link mailto dài hơn ~2000 ký tự
        // chế độ Demo: thư tự soạn ghi rõ là thư demo (tiêu đề [DEMO] + dòng đầu thư)
        const IS_DEMO = typeof TsDemo !== 'undefined' && !!TsDemo.on;
        // demo: gợi ý gửi về chính email đăng nhập (người nhận thật trong dữ liệu mẫu chỉ là địa chỉ giả)
        const demoMyEmail = () => { try { const s = IS_DEMO && Session.current(); return (s && s.email) || ''; } catch (e) { return ''; } };
        const demoMark = (m) => (IS_DEMO ? {
            subject: '[DEMO] ' + m.subject,
            body: '*** THƯ DEMO — dữ liệu chạy thử, không phải bảng công thật ***\n\n' + m.body,
            shortBody: '*** THƯ DEMO — dữ liệu chạy thử ***\n\n' + m.shortBody,
        } : m);

        function buildMailText(d, profile, period, month, supervisorName, allowCalc) {
            const [y, m] = month.split('-');
            const kp = `kỳ lương tháng ${parseInt(m, 10)}/${y} (${fmtDMY(period.start)} – ${fmtDMY(period.end)})`;
            const name = profile.name || 'Nhân viên';
            const subject = `[Timesheet] ${name}${profile.empId ? ` (${profile.empId})` : ''} – Kỳ lương tháng ${parseInt(m, 10)}/${y} (${fmtDM(period.start)}–${fmtDM(period.end)}/${period.end.slice(0, 4)})`;
            const ots = OT_TYPES.filter(t => t.code !== 'NORMAL' && d.byType[t.code] > 0).map(t => `${t.code}: ${fmtH(d.byType[t.code])}`).join(' · ');
            const who = [`Nhân viên: ${name}`, profile.empId && `Mã NV: ${profile.empId}`, profile.position && `Chức vụ: ${profile.position}`, profile.dept && `Phòng ban: ${profile.dept}`].filter(Boolean).join(' – ');
            const head = [
                `Kính gửi Anh/Chị${supervisorName ? ' ' + supervisorName : ''},`, '',
                `Tôi xin gửi bảng chấm công ${kp}.`, '',
                who,
                `Tổng giờ làm việc: ${fmtH(d.total)} giờ (${d.workDays} ngày)`,
                `- Giờ thường: ${fmtH(d.normal)} giờ`,
                `- Tăng ca: ${fmtH(d.ot)} giờ${ots ? ` (${ots})` : ''}`,
            ];
            const leave = d.leaveDays
                ? `Nghỉ: ${d.leaveDays} ngày${d.leaveHours ? `, ${fmtH(d.leaveHours)} giờ` : ''} (${d.leaveList.map(l => `${l.label}: ${l.days} ngày`).join('; ')})`
                : 'Nghỉ: không';
            const top = d.projectList.slice(0, 5);
            const projects = top.length ? ['Dự án:', ...top.map(p => `- ${p.name}${p.wbs ? ` (${p.wbs})` : ''}: ${fmtH(p.total)} giờ`),
                ...(d.projectList.length > top.length ? [`- … và ${d.projectList.length - top.length} dự án khác`] : [])] : [];
            const missing = d.missing.length ? [`Ngày chưa chấm: ${d.missing.map(fmtDM).join(', ')}`] : [];
            const hasAllow = !!(allowCalc && allowCalc.rows.length);
            const allowLines = hasAllow ? [`Phụ cấp xe: ${TsAllowance.summary(allowCalc)}`] : [];
            const tail = ['', hasAllow ? 'File bảng chấm công Excel và Bảng phụ cấp xe đính kèm.' : 'File bảng chấm công Excel đính kèm.', '', 'Trân trọng,', name];
            const body = [...head, leave, ...allowLines, ...projects, ...missing, ...tail].join('\n');
            const shortBody = [...head, leave, ...allowLines, ...missing, ...tail].join('\n'); // cho link mailto quá dài
            return demoMark({ subject, body, shortBody });
        }

        // Thư báo cáo thi công trong ngày (fitter tự gửi giám sát / quản lý)
        function buildDailyMail(profile, date, rows, bdOf) {
            const name = profile.name || 'Nhân viên';
            const subject = `[Báo cáo thi công] ${name}${profile.empId ? ` (${profile.empId})` : ''} – ${WEEKDAYS[weekdayOf(date)]} ${fmtDMY(date)}`;
            const list = rows.filter(e => e.date === date).sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));
            const total = list.reduce((t, e) => t + sumBd(bdOf(e)), 0);
            const normal = list.reduce((t, e) => t + (bdOf(e).NORMAL || 0), 0);
            const lines = list.map((e, i) => {
                const meta = ACTIVITY_META.find(a => a.id === e.activityCode || a.code === e.activityCode);
                const ots = Object.keys(bdOf(e)).filter(k => k !== 'NORMAL' && bdOf(e)[k] > 0).map(k => `${k} ${fmtH(bdOf(e)[k])}`).join(', ');
                return [`${i + 1}) ${e.projectName || '(không ghi dự án)'}${e.workNumber ? ` (${e.workNumber})` : ''}`,
                    `   ${e.startTime}–${e.endTime} · ${fmtH(sumBd(bdOf(e)))} giờ${ots ? ` (tăng ca: ${ots})` : ''} · ${meta ? meta.desc.replace(/^\S+\s*-\s*/, '') : e.activityCode}`,
                    e.report ? `   Báo cáo: ${e.report}` : (e.remarks ? `   Ghi chú: ${e.remarks}` : '')].filter(Boolean).join('\n');
            });
            const head = ['Kính gửi Anh/Chị,', '', `Báo cáo thi công ngày ${WEEKDAYS_LONG[weekdayOf(date)]} ${fmtDMY(date)} của ${name}${profile.empId ? ` (${profile.empId})` : ''}:`, ''];
            const tail = ['', list.length ? `Tổng: ${fmtH(total)} giờ (thường ${fmtH(normal)}, tăng ca ${fmtH(total - normal)}).` : 'Hôm nay chưa có dòng chấm công.', '', 'Trân trọng,', name];
            const body = [...head, ...(lines.length ? lines.join('\n\n').split('\n') : []), ...tail].join('\n');
            return demoMark({ subject, body, shortBody: body.length > 1500 ? body.slice(0, 1400) + '\n…' : body });
        }

        const canShareFiles = () => {
            try { return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [new File(['x'], 'x.xlsx', { type: XLSX_MIME })] })); }
            catch (e) { return false; }
        };
        const qs = (o) => Object.keys(o).filter(k => o[k]).map(k => `${k}=${encodeURIComponent(o[k])}`).join('&');
        const crlf = (t) => t.replace(/\r?\n/g, '\r\n');
        const openLink = (url) => { // mở mailto: bằng thẻ <a> (không rời trang)
            const a = document.createElement('a'); a.href = url; a.rel = 'noopener';
            document.body.appendChild(a); a.click(); a.remove();
        };

        function MailPanel({ profile, setProfile, file, mail, supervisorName, onSent, onCancel, noFile, initTo, initCc, toLabel, toHint }) {
            const [to, setTo] = useState(initTo !== undefined ? initTo : (profile.mailTo || demoMyEmail()));
            const [cc, setCc] = useState(initCc !== undefined ? initCc : (profile.mailCc || ''));
            const [subject, setSubject] = useState(mail.subject);
            const [body, setBody] = useState(mail.body);
            const [touched, setTouched] = useState(false);
            const share = useMemo(canShareFiles, []) && !noFile;
            const toList = parseEmails(to), ccList = parseEmails(cc);
            const badTo = !toList.length ? 'Nhập email giám sát / quản lý.' : toList.find(e => !EMAIL_RE.test(e)) ? `Email không hợp lệ: ${toList.find(e => !EMAIL_RE.test(e))}` : '';
            const badCc = ccList.find(e => !EMAIL_RE.test(e)) ? `Email không hợp lệ: ${ccList.find(e => !EMAIL_RE.test(e))}` : '';
            const invalid = !!(badTo || badCc);
            const ready = !noFile && file && file.status === 'ready';
            const remember = () => { if (!noFile) setProfile({ ...profile, mailTo: toList.join(', '), mailCc: ccList.join(', ') }); };   // thư báo cáo ngày: người nhận theo dự án, không ghi đè địa chỉ đã nhớ của thư cuối kỳ
            const guard = () => { setTouched(true); if (invalid) return false; remember(); return true; };
            const extra = ready && file.extra ? file.extra : null;      // Bảng phụ cấp xe (nếu kỳ có phụ cấp)
            const download = () => { if (ready) { saveAs(file.blob, file.name); if (extra) setTimeout(() => saveAs(extra.blob, extra.name), 600); } };
            const attachNote = ready ? (extra ? ` — 2 file ${file.name} và ${extra.name} đã tải về máy, hãy đính kèm cả hai vào thư trước khi gửi.`
                : ` — file ${file.name} đã tải về máy, hãy đính kèm vào thư trước khi gửi.`) : '.';

            const viaShare = () => {
                if (!guard() || !ready) return;
                const files = [new File([file.blob], file.name, { type: XLSX_MIME })];
                if (extra) files.push(new File([extra.blob], extra.name, { type: XLSX_MIME }));
                try { navigator.clipboard && navigator.clipboard.writeText(toList.join(', ')).catch(() => {}); } catch (e) { /* bỏ qua */ }
                navigator.share({ files, title: subject, text: body })
                    .then(() => onSent(`Đã chuyển sang ứng dụng mail kèm ${files.map(f => f.name).join(' và ')}. Địa chỉ giám sát đã chép sẵn — dán vào ô Người nhận.`))
                    .catch(err => { if (err && err.name !== 'AbortError') alert('Không chia sẻ được: ' + err.message); });
            };
            const viaMailto = () => {
                if (!guard()) return;
                download();
                let url = `mailto:${toList.map(encodeURIComponent).join(',')}?` + qs({ cc: ccList.join(','), subject, body: crlf(body) });
                if (url.length > MAILTO_MAX) url = `mailto:${toList.map(encodeURIComponent).join(',')}?` + qs({ cc: ccList.join(','), subject, body: crlf(body === mail.body ? mail.shortBody : body.slice(0, 900) + '\n…') });
                openLink(url);
                onSent('Đã mở ứng dụng mail (Outlook / mail mặc định)' + attachNote);
            };
            const viaWeb = (kind) => {
                if (!guard()) return;
                download();
                const url = kind === 'gmail'
                    ? 'https://mail.google.com/mail/?view=cm&fs=1&' + qs({ to: toList.join(','), cc: ccList.join(','), su: subject, body })
                    : 'https://outlook.office.com/mail/deeplink/compose?' + qs({ to: toList.join(','), cc: ccList.join(','), subject, body });
                window.open(url, '_blank', 'noopener');
                onSent(`Đã mở ${kind === 'gmail' ? 'Gmail' : 'Outlook web'}` + attachNote);
            };

            const btnRow = 'w-full justify-start h-11';
            return (
                <div className="px-5 py-5 space-y-5">
                    <section className="space-y-3">
                        <Field label={toLabel || 'Gửi đến (email giám sát / quản lý)'} htmlFor="tsMailTo"
                            hint={toHint || (supervisorName ? `Giám sát theo dữ liệu nhân sự: ${supervisorName}. Nhiều địa chỉ cách nhau bằng dấu phẩy.` : 'Nhiều địa chỉ cách nhau bằng dấu phẩy. Lần sau tự điền lại.')}>
                            <input id="tsMailTo" data-autofocus type="email" multiple inputMode="email" autoComplete="email" className={inputCls}
                                value={to} onChange={e => setTo(e.target.value)} onBlur={() => setTouched(true)} placeholder="email@congty.com"
                                aria-invalid={touched && !!badTo} aria-describedby="tsMailErr"/>
                        </Field>
                        <Field label="CC (không bắt buộc)" htmlFor="tsMailCc">
                            <input id="tsMailCc" type="email" multiple inputMode="email" className={inputCls} value={cc} onChange={e => setCc(e.target.value)} placeholder="email@congty.com"/>
                        </Field>
                        <p id="tsMailErr" role="alert" className="text-sm text-rose-700 empty:hidden">{touched ? (badTo || badCc) : ''}</p>
                        <Field label="Tiêu đề" htmlFor="tsMailSubject">
                            <input id="tsMailSubject" type="text" className={inputCls} value={subject} onChange={e => setSubject(e.target.value)}/>
                        </Field>
                        <Field label="Nội dung" htmlFor="tsMailBody">
                            <textarea id="tsMailBody" rows={11} className={`${inputCls} h-auto py-2 leading-snug font-normal`} value={body} onChange={e => setBody(e.target.value)}/>
                            {(body !== mail.body || subject !== mail.subject) && (
                                <button type="button" onClick={() => { setBody(mail.body); setSubject(mail.subject); }} className="mt-1 text-sm font-medium text-blue-700 hover:text-blue-900">Soạn lại theo số liệu kỳ</button>
                            )}
                        </Field>
                        {!noFile && <div id="tsMailFile" className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm" aria-live="polite">
                            <span aria-hidden="true">📎</span>
                            {!file || file.status === 'loading' ? <span className="text-slate-500">Đang tạo file bảng chấm công Excel…</span>
                                : file.status === 'ready' ? <span><b>{file.name}</b> <span className="text-slate-500">· {Math.max(1, Math.round(file.blob.size / 1024))} KB</span>
                                    {extra && <React.Fragment><br/><b id="tsMailAllowFile">{extra.name}</b> <span className="text-slate-500">· {Math.max(1, Math.round(extra.blob.size / 1024))} KB · phụ cấp xe</span></React.Fragment>}</span>
                                : file.status === 'empty' ? <span className="text-amber-800">Kỳ này chưa có chấm công — thư sẽ không có file đính kèm.</span>
                                : <span className="text-rose-700">{file.error}</span>}
                        </div>}
                    </section>

                    <section className="space-y-2 pt-4 border-t border-slate-200">
                        <h3 className="font-semibold">Gửi bằng</h3>
                        {share && (
                            <React.Fragment>
                                <button id="tsMailShare" type="button" onClick={viaShare} disabled={!ready} className={`${btnPrimary} ${btnRow}`}>
                                    <Icons.Mail/> {extra ? 'Gửi kèm 2 file Excel' : 'Gửi kèm file Excel'}
                                </button>
                                <p className="text-xs text-slate-500 -mt-1">Mở bảng chia sẻ của máy với file đính kèm sẵn — chọn Gmail, Outlook… Địa chỉ giám sát được chép sẵn để dán vào ô Người nhận.</p>
                            </React.Fragment>
                        )}
                        <button id="tsMailApp" type="button" onClick={viaMailto} className={`${share ? btnGhost : btnPrimary} ${btnRow}`}>
                            <Icons.Mail/> Outlook / ứng dụng mail trên máy
                        </button>
                        <div className="grid grid-cols-2 gap-2">
                            <button id="tsMailGmail" type="button" onClick={() => viaWeb('gmail')} className={`${btnGhost} h-11`}>Gmail (web)</button>
                            <button id="tsMailOwa" type="button" onClick={() => viaWeb('owa')} className={`${btnGhost} h-11`}>Outlook web</button>
                        </div>
                        <p className="text-xs text-slate-500">{noFile ? 'Thư đã điền sẵn người nhận, tiêu đề, nội dung — kiểm tra lại rồi bấm Gửi trong ứng dụng mail.'
                            : 'Với 3 cách này, thư đã điền sẵn người nhận, tiêu đề, nội dung; file Excel tự tải về máy — trình duyệt không cho tự đính kèm, hãy kéo / chọn file vào thư rồi bấm Gửi.'}</p>
                        <button type="button" onClick={onCancel} className={`${btnGhost} w-full h-11 mt-2`}>Hủy</button>
                    </section>
                </div>
            );
        }

        function DailyMailPanel({ profile, setProfile, entries, bdOf, defaultDate, onSent, onCancel }) {
            const [date, setDate] = useState(defaultDate);
            const wbsKey = [...new Set(entries.filter(e => e.date === date).map(e => String(e.workNumber || '').trim()).filter(Boolean))].join(',');
            const [people, setPeople] = useState(null);     // gợi ý người nhận từ máy chủ (null = đang hỏi / không có)
            useEffect(() => {
                setPeople(null);
                if (!SERVER || !wbsKey) return;
                let live = true;
                fetch('/api/ts/approvers?wbs=' + encodeURIComponent(wbsKey), { credentials: 'same-origin', redirect: 'manual', cache: 'no-store' })
                    .then(r => (r.ok ? r.json() : { approvers: [] })).then(j => { if (live) setPeople(j.approvers || []); }).catch(() => { if (live) setPeople([]); });
                return () => { live = false; };
            }, [wbsKey]);
            const waiting = SERVER && wbsKey && people === null;
            const sup = (people || []).filter(p => p.level === 'sitesup').map(p => p.email), pms = (people || []).filter(p => p.level === 'pm').map(p => p.email);
            const initTo = sup.length ? sup.join(', ') : (pms.length ? pms.join(', ') : (profile.mailTo || ''));
            const initCc = sup.length ? pms.join(', ') : (profile.mailCc || '');
            const names = (people || []).map(p => `${p.name} (${p.level === 'pm' ? 'QLDA' : 'Site Sup'})`).join(', ');
            return (
                <div>
                    <div className="px-5 pt-5">
                        <Field label="Ngày báo cáo" htmlFor="tsDailyDate">
                            <input id="tsDailyDate" type="date" className={inputCls} value={date} max={getTodayLocal()} onChange={e => e.target.value && setDate(e.target.value)}/>
                        </Field>
                    </div>
                    {waiting ? <p className="px-5 py-8 text-sm text-slate-500">Đang tìm người phụ trách các dự án trong ngày…</p>
                        : <MailPanel key={date + '|' + (people ? people.map(p => p.empId).join(',') : '-')} noFile profile={profile} setProfile={setProfile}
                            mail={buildDailyMail(profile, date, entries, bdOf)} initTo={initTo} initCc={initCc}
                            toLabel="Gửi đến (Site Sup của dự án)"
                            toHint={names ? `Tự điền theo phân công dự án: ${names}. Sửa được.` : 'Nhiều địa chỉ cách nhau bằng dấu phẩy.'}
                            onSent={onSent} onCancel={onCancel}/>}
                </div>
            );
        }

        function Toast({ toast, onClose }) {
            return (
                <div role="status" className="fixed z-[60] left-1/2 -translate-x-1/2 bottom-24 md:bottom-6 w-max max-w-[92vw] bg-slate-900 text-white text-sm rounded-xl shadow-xl pl-4 pr-2 py-2 flex items-center gap-3">
                    <span className="py-1">{toast.message}</span>
                    {toast.action && (
                        <button type="button" onClick={() => { toast.action.run(); onClose(); }} className="h-8 px-3 rounded-lg font-semibold text-blue-300 hover:bg-white/10">{toast.action.label}</button>
                    )}
                    <button type="button" onClick={onClose} aria-label="Đóng thông báo" className="w-8 h-8 grid place-items-center rounded-lg text-slate-400 hover:bg-white/10"><Icons.X/></button>
                </div>
            );
        }

        function Field({ label, htmlFor, hint, children, className }) {
            return (
                <div className={className}>
                    <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                    {children}
                    {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
                </div>
            );
        }

        // ---------- Thông tin nhân viên (in ở đầu bảng chấm công Excel) ----------
        function ProfileCard({ profile, setProfile }) {
            const incomplete = !profile.name || !profile.empId;
            const [editing, setEditing] = useState(incomplete); // chưa đủ họ tên / mã NV → mở sẵn ô nhập
            const set = (k) => (e) => setProfile({ ...profile, [k]: e.target.value });
            const initial = (String(profile.name || '').trim().split(/\s+/).pop() || '?').charAt(0).toUpperCase();
            const facts = [
                ['Mã NV', profile.empId], ['Chức vụ', profile.position], ['Phòng ban', profile.dept],
                ['Lịch', LaborVN.SCHEDULES[scheduleOf(profile)].short],
            ];
            return (
                <section id="tsProfileCard" className="bg-white rounded-2xl border border-slate-200 p-4" aria-labelledby="tsProfileTitle">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-800 text-white grid place-items-center font-semibold shrink-0" aria-hidden="true">{initial}</div>
                        <div className="min-w-0 flex-1">
                            <h2 id="tsProfileTitle" className="text-xs font-medium text-slate-500">Thông tin nhân viên</h2>
                            <p className="font-semibold leading-6 truncate">{profile.name || <span className="text-rose-600">Chưa có họ tên</span>}</p>
                        </div>
                        <button type="button" onClick={() => setEditing(!editing)} aria-expanded={editing} aria-controls="tsProfileForm"
                            className={`${btnGhost} h-9 text-sm shrink-0`}>
                            {editing ? 'Xong' : <React.Fragment><Icons.Edit/> Sửa</React.Fragment>}
                        </button>
                    </div>
                    {!editing && (
                        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-slate-600">
                            {facts.map(([k, v]) => (
                                <div key={k} className="flex gap-1 min-w-0">
                                    <dt className="text-slate-400">{k}:</dt>
                                    <dd className={`truncate ${v ? '' : 'text-rose-600'}`}>{v || 'chưa nhập'}</dd>
                                </div>
                            ))}
                        </dl>
                    )}
                    {editing && (
                        <div id="tsProfileForm" className="mt-3 grid sm:grid-cols-2 gap-3">
                            <Field label="Họ và tên" htmlFor="tsName"><input id="tsName" className={inputCls} value={profile.name} onChange={set('name')} placeholder="Họ Tên" autoComplete="name"/></Field>
                            <Field label="Mã nhân viên" htmlFor="tsEmpId"><input id="tsEmpId" className={inputCls} value={profile.empId} onChange={set('empId')} placeholder="Mã NV"/></Field>
                            <Field label="Chức vụ" htmlFor="tsPosition"><input id="tsPosition" className={inputCls} value={profile.position} onChange={set('position')} placeholder="Chức vụ"/></Field>
                            <Field label="Phòng ban" htmlFor="tsDept"><input id="tsDept" className={inputCls} value={profile.dept} onChange={set('dept')} placeholder="Phòng ban"/></Field>
                            <Field label="Lịch làm việc (ngày nghỉ hằng tuần)" htmlFor="tsSchedule" className="sm:col-span-2"
                                hint="Dùng để tính OT ngày nghỉ hằng tuần (OT2 / OT5) và ngày nghỉ bù khi ngày lễ trùng ngày nghỉ.">
                                <select id="tsSchedule" className={inputCls} value={scheduleOf(profile)} onChange={set('schedule')}>
                                    {Object.keys(LaborVN.SCHEDULES).map(k => <option key={k} value={k}>{LaborVN.SCHEDULES[k].label}</option>)}
                                </select>
                            </Field>
                            <p className="sm:col-span-2 text-xs text-slate-500">Họ tên, mã NV, chức vụ, phòng ban in ở đầu bảng chấm công Excel. Tự lưu khi bạn gõ.</p>
                        </div>
                    )}
                </section>
            );
        }

        // ---------- Dữ liệu dự án (dùng chung với Thống kê giờ công, nguồn Google Drive) ----------
        const fmtSyncedAt = (iso) => {
            const d = new Date(iso);
            if (isNaN(d)) return '';
            const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            const day = toLocalISOString(d);
            return day === getTodayLocal() ? `${hm} hôm nay` : `${hm} ${fmtDMY(day)}`;
        };
        function ProjectSyncCard({ count, syncing, status, syncedAt, missing, onSync }) {
            const warn = missing || (status && !status.ok);
            const state = syncing ? { dot: 'bg-blue-500 animate-pulse', text: 'Đang đồng bộ…' }
                : warn ? { dot: 'bg-amber-500', text: 'Chưa đồng bộ được' }
                : syncedAt ? { dot: 'bg-emerald-500', text: `Đã đồng bộ lúc ${fmtSyncedAt(syncedAt)}` }
                : { dot: 'bg-slate-400', text: 'Đang dùng dữ liệu đã có trên máy' };
            return (
                <section id="tsProjectCard" aria-labelledby="tsProjectTitle"
                    className={`rounded-2xl border p-4 ${missing ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full grid place-items-center shrink-0 ${missing ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-700'}`} aria-hidden="true"><Icons.Database/></div>
                        <div className="min-w-0 flex-1">
                            <h2 id="tsProjectTitle" className="text-xs font-medium text-slate-500" title="Dùng chung với Thống kê giờ công dự án (nguồn Google Drive)">Dữ liệu dự án</h2>
                            <p className="font-semibold leading-6"><span className="tabular-nums">{count}</span> dự án</p>
                        </div>
                        <button type="button" onClick={onSync} disabled={syncing} className={`${btnGhost} h-9 text-sm shrink-0`}>
                            <Icons.Refresh/> {syncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}
                        </button>
                    </div>
                    <p className="mt-2 text-sm text-slate-600 flex items-center gap-2" aria-live="polite">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${state.dot}`} aria-hidden="true"/>{state.text}
                    </p>
                    {warn && !syncing && (
                        <p role="alert" className="mt-1 text-sm text-amber-900">
                            {missing && <b>Chưa có danh sách dự án trên máy này. </b>}
                            {status ? status.text : ''}
                            {missing ? ' Bạn vẫn chấm công bình thường; gợi ý tên dự án / WBS sẽ có sau khi đồng bộ.' : ''}
                        </p>
                    )}
                </section>
            );
        }

        // ---------- Sao lưu & khôi phục ----------
        function SettingsPanel({ onBackup, onRestore, onReset, onDone }) {
            return (
                <div className="px-5 py-5 space-y-6">
                    <section className="space-y-2">
                        <h3 className="font-semibold">Sao lưu &amp; khôi phục</h3>
                        <p className="text-xs text-slate-500">Dữ liệu Timesheet chỉ nằm trên trình duyệt này — nên sao lưu định kỳ hoặc trước khi đổi máy.</p>
                        <div className="grid grid-cols-2 gap-3">
                            <button type="button" onClick={onBackup} className={btnGhost}><Icons.Download/> Backup</button>
                            <label className={`${btnGhost} cursor-pointer`}><Icons.Upload/> Restore<input type="file" accept=".json,application/json" onChange={onRestore} className="sr-only"/></label>
                        </div>
                    </section>

                    <section className="space-y-2 pt-5 border-t border-slate-200">
                        <h3 className="font-semibold text-rose-700 flex items-center gap-2"><Icons.Alert/> Vùng nguy hiểm</h3>
                        <p className="text-xs text-slate-500">Xóa hết lịch sử chấm công và thông tin cá nhân trên máy này. Không thể khôi phục (trừ khi có bản Backup).</p>
                        <button type="button" onClick={onReset} className="inline-flex items-center justify-center h-10 px-4 rounded-lg border border-rose-300 text-rose-700 font-semibold hover:bg-rose-50">Xóa toàn bộ dữ liệu</button>
                    </section>

                    <div className="pt-2"><button type="button" onClick={onDone} className={`${btnPrimary} w-full`}>Xong</button></div>
                </div>
            );
        }

        // ---------- Form thêm / sửa chấm công ----------
        function EntryForm({ onSave, onCancel, onDelete, defaultDate, initialData, entries, projects, sch }) {
            const [formData, setFormData] = useState({
                date: defaultDate, startTime: '08:00', endTime: '17:00', breakTime: '1', otMode: 'auto',
                otType: 'NORMAL', projectName: '', workNumber: '', activityCode: '1110', dutyHour: '0', remarks: '', report: ''
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
                if (formData.breakTime !== b) setFormData(prev => ({ ...prev, breakTime: b }));
            }, [auto, breakTouched, formData.startTime, formData.endTime]);

            useEffect(() => {
                if (initialData) {
                    setFormData({ ...initialData, otMode: initialData.otMode || 'manual' }); // dòng cũ: giữ loại giờ đã chọn
                    const isStandard = ACTIVITY_META.some(opt => opt.id === initialData.activityCode);
                    if (!isStandard) { setCustomCode(initialData.activityCode); setFormData(prev => ({...prev, activityCode: 'OTHER'})); }
                } else {
                    fillFromDate(defaultDate);
                }
            }, [initialData]);

            const fillFromDate = (targetDate) => {
                 if (!entries || entries.length === 0) {
                    setFormData(prev => ({ ...prev, projectName: '', workNumber: '', activityCode: '1110' }));
                    return;
                 }
                 const prevDateStr = addDaysLocal(targetDate, -1);
                 let sourceEntry = entries.find(e => e.date === prevDateStr);
                 if (!sourceEntry) {
                    sourceEntry = entries.reduce((a, b) => (b.date > a.date ? b : a));
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
                        setFormData(prev => ({...prev, activityCode: 'OTHER'}));
                    }
                 } else {
                    setFormData(prev => ({ ...prev, projectName: '', workNumber: '', activityCode: '1110' }));
                 }
            };

            const handleDateChange = (e) => {
                const newDate = e.target.value;
                setFormData(prev => ({ ...prev, date: newDate }));
                if (!initialData) fillFromDate(newDate);
            };

            const handleActivityCodeChange = (e) => {
                const code = e.target.value;
                let newData = { ...formData, activityCode: code };
                if (code === '6090') {
                    newData.startTime = '';
                    newData.endTime = '';
                    newData.breakTime = '0';
                }
                setFormData(newData);
            };

            // Chọn tay một loại giờ cho cả dòng (như trước): giờ thường nghỉ 1 giờ, OT không nghỉ
            const handleOtChange = (e) => {
                const type = e.target.value;
                setFormData({ ...formData, otType: type, breakTime: type !== 'NORMAL' ? '0' : '1' });
            };
            const toggleAuto = (e) => {
                const on = e.target.checked;
                setFormData(prev => ({ ...prev, otMode: on ? 'auto' : 'manual',
                    otType: on ? prev.otType : LaborVN.dominant(preview) }));
                if (on) setBreakTouched(false);
            };

            const handleProjectNameSearch = (val) => {
                setFormData(prev => ({ ...prev, projectName: val }));
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

            const selectProject = (proj) => {
                setFormData(prev => ({ ...prev, workNumber: proj.workNumber, projectName: proj.projectName }));
                setSuggestions([]);
            };

            const handleSubmit = (ev) => {
                if (ev) ev.preventDefault();
                if (!formData.date) return alert("Vui lòng chọn ngày!");
                const finalData = { ...formData };
                if (finalData.activityCode === 'OTHER') {
                    if(!customCode) return alert("Vui lòng nhập mã code!");
                    finalData.activityCode = customCode;
                }
                if (finalData.otMode === 'auto') finalData.otType = LaborVN.dominant(preview); // loại giờ chính (hiển thị gọn / dữ liệu cũ)
                onSave(finalData);
            };

            const set = (k) => (e) => setFormData({ ...formData, [k]: e.target.value });
            const hours = calculateHours(formData.startTime, formData.endTime, formData.breakTime);
            const w = formData.date ? weekdayOf(formData.date) : null;
            const holi = holidayOf(formData.date, sch);
            const leave = LaborVN.LEAVE_CODES.includes(formData.activityCode === 'OTHER' ? customCode : formData.activityCode);
            // giờ thường / OT của dòng đang nhập, xét cả các dòng khác (OT7: đêm sau khi đã làm thêm buổi tối)
            const preview = useMemo(() => LaborVN.breakdown(
                { ...formData, id: initialData ? initialData.id : undefined, activityCode: formData.activityCode === 'OTHER' ? customCode : formData.activityCode },
                sch, entries, entryHours), [formData, customCode, sch, entries]);
            const dayNote = w === null ? null
                : holi ? `${WEEKDAYS_LONG[w]} — ${holi.name}: làm việc tính OT3 (ngày) / OT6 (đêm)`
                : LaborVN.isRestDay(formData.date, sch) ? `${WEEKDAYS_LONG[w]} — ngày nghỉ hằng tuần: làm việc tính OT2 (ngày) / OT5 (đêm)`
                : w === 6 && sch === 'mon-sat-am' ? 'Thứ 7 — sáng giờ thường, từ 12:00 tính OT2 (ngày nghỉ hằng tuần)'
                : WEEKDAYS_LONG[w];

            return (
                <form onSubmit={handleSubmit} className="min-h-full flex flex-col" noValidate>
                    <div className="px-5 py-5 space-y-6 flex-1">
                        {/* Thời gian */}
                        <section className="space-y-3">
                            <h3 className="font-semibold text-slate-900">Thời gian</h3>
                            <Field label="Ngày" htmlFor="tsDate" hint={dayNote}>
                                <input id="tsDate" data-autofocus type="date" value={formData.date} onChange={handleDateChange} className={inputCls} required/>
                            </Field>
                            <div className="grid grid-cols-3 gap-3">
                                <Field label="Từ" htmlFor="tsFrom"><input id="tsFrom" type="time" value={formData.startTime} onChange={set('startTime')} className={`${inputCls} text-center px-1`}/></Field>
                                <Field label="Đến" htmlFor="tsTo"><input id="tsTo" type="time" value={formData.endTime} onChange={set('endTime')} className={`${inputCls} text-center px-1`}/></Field>
                                <Field label="Nghỉ (giờ)" htmlFor="tsBreak"><input id="tsBreak" type="number" min="0" step="0.5" inputMode="decimal" value={formData.breakTime} onChange={(e) => { setBreakTouched(true); set('breakTime')(e); }} className={`${inputCls} text-center`}/></Field>
                            </div>
                            <div id="tsSplit" className="rounded-lg bg-slate-50 px-3 py-2 text-sm" aria-live="polite">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-600">Số giờ tính công</span>
                                    <span className="font-semibold tabular-nums">{fmtH(hours)} giờ</span>
                                </div>
                                {auto && (
                                    <div className="mt-2 pt-2 border-t border-slate-200">
                                        <HourPills bd={preview}/>
                                        <p className="mt-1.5 text-xs text-slate-500">
                                            {leave ? 'Nghỉ phép / ốm / không lương: không tính làm thêm giờ.'
                                                : 'Tự tính theo Bộ luật Lao động 2019 (Điều 98, 106) và NĐ 145/2020: giờ thường 08:00–12:00, 13:00–17:00; ban đêm 22:00–06:00.'}
                                        </p>
                                    </div>
                                )}
                            </div>
                            <label className="flex items-center gap-2 min-h-11 text-sm text-slate-700 cursor-pointer">
                                <input id="tsAuto" type="checkbox" checked={auto} onChange={toggleAuto} className="w-4 h-4 shrink-0 accent-blue-700"/>
                                <span>Tự tính giờ thường / OT theo Luật Lao động <span className="text-slate-500">(bỏ chọn để tự chọn một loại giờ cho cả dòng)</span></span>
                            </label>
                            <div className="grid sm:grid-cols-2 gap-3">
                                {!auto && (
                                    <Field label="Loại giờ" htmlFor="tsOt">
                                        <select id="tsOt" value={formData.otType} onChange={handleOtChange} className={inputCls}>
                                            {OT_TYPES.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
                                        </select>
                                    </Field>
                                )}
                                <Field label="Giờ trực (standby)" htmlFor="tsDuty">
                                    <input id="tsDuty" type="number" min="0" step="0.5" inputMode="decimal" value={formData.dutyHour} onChange={set('dutyHour')} className={inputCls}/>
                                </Field>
                            </div>
                        </section>

                        {/* Công việc */}
                        <section className="space-y-3 pt-5 border-t border-slate-200">
                            <h3 className="font-semibold text-slate-900">Công việc</h3>
                            <Field label="Mã công việc" htmlFor="tsAct">
                                <select id="tsAct" value={formData.activityCode} onChange={handleActivityCodeChange} className={`${inputCls} font-medium text-blue-900`}>
                                    {ACTIVITY_META.map(opt => <option key={opt.id} value={opt.id}>{opt.desc}</option>)}
                                    <option value="OTHER">Khác</option>
                                </select>
                                {formData.activityCode === 'OTHER' && <input type="text" value={customCode} onChange={e=>setCustomCode(e.target.value)} placeholder="Nhập mã code" aria-label="Mã công việc khác" className={`${inputCls} mt-2 bg-amber-50`}/>}
                            </Field>

                            <Field label="Tên dự án" htmlFor="tsProject" hint={projects.length ? `Gõ tên hoặc WBS để chọn trong ${projects.length} dự án.` : null}>
                                <div className="relative">
                                    <input id="tsProject" type="text" autoComplete="off" value={formData.projectName}
                                        role="combobox" aria-expanded={suggestions.length > 0} aria-controls="tsProjectList" aria-autocomplete="list"
                                        onChange={e=>handleProjectNameSearch(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter' && suggestions.length) { e.preventDefault(); selectProject(suggestions[0]); } if (e.key === 'Escape' && suggestions.length) { e.stopPropagation(); setSuggestions([]); } }}
                                        onBlur={() => setTimeout(() => setSuggestions([]), 150)}
                                        className={inputCls} placeholder="Nhập tên dự án..."/>
                                    {suggestions.length > 0 && (
                                        <div id="tsProjectList" className="suggestion-list" role="listbox">
                                            {suggestions.slice(0, 50).map((p, idx) => (
                                                <div key={idx} role="option" aria-selected={idx === 0} onMouseDown={(ev) => { ev.preventDefault(); selectProject(p); }} className="suggestion-item">
                                                    <span className="font-semibold">{p.projectName}</span><br/><span className="text-slate-500 text-xs font-mono">{p.workNumber}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </Field>

                            <Field label="Work Number / WBS / Mã chi phí" htmlFor="tsWbs">
                                {isHR ? (
                                    <select id="tsWbs" value={formData.workNumber} onChange={set('workNumber')} className={inputCls}>
                                        <option value="">-- Chọn loại nghỉ --</option>
                                        {HR_WORK_NUMBERS.map(wn => <option key={wn} value={wn}>{wn}</option>)}
                                    </select>
                                ) : (
                                    <input id="tsWbs" type="text" value={formData.workNumber} onChange={set('workNumber')} className={`${inputCls} font-mono`}/>
                                )}
                            </Field>

                            <Field label="Ghi chú" htmlFor="tsRemarks">
                                <input id="tsRemarks" type="text" value={formData.remarks || ''} onChange={set('remarks')} className={inputCls} placeholder="Ghi chú thêm..."/>
                            </Field>

                            <Field label="Báo cáo thi công trong ngày" htmlFor="tsReportText">
                                <textarea id="tsReportText" rows="3" maxLength="600" value={formData.report || ''} onChange={set('report')}
                                    className={`${inputCls} h-auto py-2`} placeholder="Hôm nay làm được gì, đến tầng nào, vướng mắc… (gửi giám sát & quản lý mỗi tối)"/>
                                <span className="block mt-1 text-xs text-slate-500">{(formData.report || '').length}/600 ký tự</span>
                            </Field>
                        </section>
                    </div>

                    <div className="sticky bottom-0 bg-white border-t border-slate-200 px-5 py-3 flex items-center gap-3">
                        {onDelete && (
                            <button type="button" onClick={onDelete} className="h-11 px-3 rounded-lg text-rose-700 font-semibold hover:bg-rose-50 inline-flex items-center gap-2"><Icons.Trash/> Xóa</button>
                        )}
                        <button type="button" onClick={onCancel} className={`${btnGhost} h-11 flex-1 md:flex-none md:ml-auto`}>Hủy</button>
                        <button type="submit" className={`${btnPrimary} h-11 flex-1 md:flex-none md:min-w-[8rem]`}>Lưu</button>
                    </div>
                </form>
            );
        }

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<App />);
