// Reads Data v1.xlsx (sheets: EE DATA, Yan_COM, TS All) via SheetJS and maps into the app's data model.
const Importer = (() => {

  function excelSerialToISO(v) {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === 'number') {
      const d = new Date(Math.round((v - 25569) * 86400 * 1000));
      return d.toISOString().slice(0, 10);
    }
    if (typeof v === 'string') {
      const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    }
    return '';
  }

  async function readWorkbook(file) {
    const buf = await file.arrayBuffer();
    return XLSX.read(buf, { type: 'array', cellDates: false });
  }

  // find sheet by name (whitespace/case-insensitive); returns null if absent
  function findSheet(wb, names) {
    const norm = s => String(s).toLowerCase().replace(/\s+/g, '');
    for (const want of names) {
      const found = wb.SheetNames.find(n => norm(n) === norm(want));
      if (found) return wb.Sheets[found];
    }
    return null;
  }

  function toNum(v) {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }

  function mapEmployees(rows) {
    // EE DATA columns (0-indexed): 0 EmpID,1 PersonId,2 First,3 Last,4 FullNameVN,5 Username,
    // 6 DOB,7 Gender,8 HireDate,9 GroupStartDate,10 SeniorityStartDate(K),11 Position,12 Supervisor
    return rows.slice(1).filter(r => r[0] !== undefined && r[0] !== '').map(r => ({
      empId: String(r[0]).trim(),
      personId: r[1] !== undefined ? String(r[1]) : '',
      fullName: (r[4] || `${r[2] || ''} ${r[3] || ''}`.trim()),
      username: r[5] || '',
      dob: r[6] !== undefined ? String(r[6]) : '',
      gender: r[7] || '',
      hireDate: r[8] !== undefined ? String(r[8]) : '',
      startDate: r[10] !== undefined ? String(r[10]) : '',
      position: r[11] || '',
      supervisor: r[12] || '',
    }));
  }

  // Technical spec columns in Yan_COM: V (21) .. AR (43), headers taken from row 1
  const SPEC_START = 21, SPEC_END = 43;

  function mapProjects(rows, existingByWbs) {
    // Yan_COM columns (0-indexed): 3 WBS Element, 4 Project name, 5 Product Line Desc,
    // 8 Supervisor, 9 Customer, 12 Sales Rep, 13 Net Value, 42 GRP_INST_TIME_TOTAL (default target hour)
    const header = rows[0] || [];
    let specHeaders = [];
    let namedCount = 0;
    for (let i = SPEC_START; i <= SPEC_END; i++) {
      if (header[i]) namedCount++;
      specHeaders.push(String(header[i] || `Col${i}`).replace(/^GRP_/, ''));
    }
    // only trust the header row when most spec columns are actually named
    // (partial files may carry an incomplete header); otherwise reuse stored labels
    if (namedCount >= (SPEC_END - SPEC_START + 1) / 2) {
      try { localStorage.setItem('specHeaders', JSON.stringify(specHeaders)); } catch (e) { /* ignore */ }
    } else {
      try {
        const stored = JSON.parse(localStorage.getItem('specHeaders') || 'null');
        if (stored && stored.length === specHeaders.length) specHeaders = stored;
      } catch (e) { /* ignore */ }
    }

    return rows.slice(1).filter(r => r[3] !== undefined && r[3] !== '').map(r => {
      const wbs = String(r[3]).trim();
      const existing = existingByWbs && existingByWbs[wbs];
      const defaultTarget = toNum(r[42]) || toNum(r[41]) || 0;
      const specs = {};
      for (let i = SPEC_START; i <= SPEC_END; i++) {
        specs[specHeaders[i - SPEC_START]] = r[i] !== undefined ? String(r[i]) : '';
      }
      return {
        wbs,
        source: 'import',
        projectNumber: r[2] !== undefined ? String(r[2]) : '',
        projectName: r[4] || r[1] || '',
        customer: r[9] || '',
        productLine: r[5] || '',
        supervisor: r[8] || '',
        salesRep: r[12] || '',
        netValue: toNum(r[13]),
        specs,
        targetHour: (existing && existing.targetHourManual) ? existing.targetHour : defaultTarget,
        targetHourManual: existing ? !!existing.targetHourManual : false,
      };
    });
  }

  // Excel lưu giờ dạng số thập phân (phần lẻ của 1 ngày): 0.3125 = 07:30.
  // Nhận cả chuỗi "7:30" / "07h30" và Date; trả về 'HH:MM' hoặc ''.
  function excelTimeToHHMM(v) {
    if (v === undefined || v === null || v === '') return '';
    if (v instanceof Date) {
      return `${String(v.getHours()).padStart(2, '0')}:${String(v.getMinutes()).padStart(2, '0')}`;
    }
    if (typeof v === 'number') {
      if (v >= 1 && v % 1 === 0) return ''; // số nguyên lớn = serial ngày, không phải giờ
      const mins = Math.round((v % 1) * 24 * 60) % 1440;
      return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    }
    const m = String(v).trim().match(/^(\d{1,2})[:hH.](\d{2})/);
    if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
    return '';
  }

  // một dòng bảng công là TRÙNG khi cùng nhân viên + ngày + giờ làm việc
  // + dự án + hoạt động (nhân viên nhập 2 lần 1 ngày thì chỉ ghi nhận 1 dòng;
  // giờ From/To nằm trong khoá để không xoá nhầm ca sáng / ca tối tách dòng)
  function tsKey(r) {
    return [r.empId, r.date, r.timeFrom || '', r.timeTo || '', r.wbs || '', String(r.activities || '')].join('|');
  }

  function dedupeTimesheetRows(rows) {
    const seen = new Set();
    return rows.filter(r => {
      const k = tsKey(r);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  // dọn các dòng trùng lặp đã có sẵn trong database (giữ lại dòng nhập trước)
  async function removeDuplicateTimesheets() {
    const all = await DB.getAll('timesheets');
    const seen = new Set();
    const dupIds = [];
    for (const r of all) {
      const k = tsKey(r);
      if (seen.has(k)) dupIds.push(r.id);
      else seen.add(k);
    }
    if (!dupIds.length) return 0;
    await Backup.snapshot(`Trước khi xoá ${dupIds.length} dòng bảng công trùng lặp (tự động)`);
    await DB.bulkRemove('timesheets', dupIds);
    return dupIds.length;
  }

  // Các mẫu file khác nhau đặt tên/thứ tự cột khác nhau: bản xuất "TS All"
  // và template chấm công tháng "New TS" lệch nhau 1 cột ở nhóm Activities /
  // Project / Work Number, và header của "New TS" nằm ở dòng thứ 8. Vì vậy
  // ta xác định cột THEO TÊN TIÊU ĐỀ thay vì vị trí cố định; cột nào không
  // tìm được header thì lùi về vị trí cũ của "TS All".
  const TS_HEADER_PATTERNS = {
    empId: /employee\s*no|mã\s*nv|hrms/i,
    empName: /^\s*name|tên\s*nv/i,
    date: /date|ngày/i,
    timeFrom: /^\s*from\s*$/i,
    timeTo: /^\s*to\s*$/i,
    normal: /normal\s*hour|^\s*normal\s*$/i,
    ot1: /^\s*ot1/i, ot2: /^\s*ot2/i, ot3: /^\s*ot3/i, ot4: /^\s*ot4/i,
    ot5: /^\s*ot5/i, ot6: /^\s*ot6/i, ot7: /^\s*ot7/i,
    activities: /^\s*activities\s*$/i,
    projectName: /project\s*name|description/i,
    wbs: /work\s*number/i,
    category: /ni[\s\S]*mod[\s\S]*hr|^\s*category\s*$/i,
    isFitter: /^\s*fitter\s*$/i,
    isSiteSup: /site\s*sup/i,
  };
  // vị trí cột mặc định của "TS All" (dùng khi không dò được header)
  const TS_LEGACY_COLS = {
    empId: 0, empName: 1, date: 2, timeFrom: 4, timeTo: 5, normal: 6,
    ot1: 8, ot2: 9, ot3: 10, ot4: 11, ot5: 12, ot6: 13, ot7: 14,
    activities: 17, projectName: 18, wbs: 19, category: 20, isFitter: 54, isSiteSup: 55,
  };

  function detectTsColumns(rows) {
    const norm = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
    let headerRow = -1;
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const cells = (rows[i] || []).map(norm);
      const hasEmp = cells.some(c => TS_HEADER_PATTERNS.empId.test(c));
      const hasDate = cells.some(c => /date|ngày/i.test(c) && !/week\s*day/i.test(c));
      const hasHours = cells.some(c => TS_HEADER_PATTERNS.normal.test(c) || TS_HEADER_PATTERNS.timeFrom.test(c));
      if (hasEmp && hasDate && hasHours) { headerRow = i; break; }
    }
    const cols = { ...TS_LEGACY_COLS };
    if (headerRow >= 0) {
      const header = (rows[headerRow] || []).map(norm);
      for (const key of Object.keys(TS_HEADER_PATTERNS)) {
        const idx = header.findIndex(c => {
          if (!c) return false;
          if (key === 'date' && /week\s*day/i.test(c)) return false;
          return TS_HEADER_PATTERNS[key].test(c);
        });
        if (idx >= 0) cols[key] = idx;
      }
    }
    return { headerRow: headerRow >= 0 ? headerRow : 0, cols };
  }

  function mapTimesheets(rows) {
    const { headerRow, cols } = detectTsColumns(rows);
    const out = [];
    for (let i = headerRow + 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const empRaw = r[cols.empId];
      if (empRaw === undefined || empRaw === '') continue;
      const normal = toNum(r[cols.normal]);
      const ot1 = toNum(r[cols.ot1]), ot2 = toNum(r[cols.ot2]), ot3 = toNum(r[cols.ot3]);
      const ot4 = toNum(r[cols.ot4]), ot5 = toNum(r[cols.ot5]), ot6 = toNum(r[cols.ot6]), ot7 = toNum(r[cols.ot7]);
      const total = normal + ot1 + ot2 + ot3 + ot4 + ot5 + ot6 + ot7;
      const wbsRaw = r[cols.wbs];
      const wbs = (wbsRaw === undefined || wbsRaw === '' || wbsRaw === '#N/A') ? '' : String(wbsRaw).trim();
      const fitCell = r[cols.isFitter], supCell = r[cols.isSiteSup];
      out.push({
        source: 'import',
        empId: String(empRaw).trim(),
        empName: r[cols.empName] || '',
        date: excelSerialToISO(r[cols.date]),
        timeFrom: excelTimeToHHMM(r[cols.timeFrom]),
        timeTo: excelTimeToHHMM(r[cols.timeTo]),
        normal, ot1, ot2, ot3, ot4, ot5, ot6, ot7, total,
        activities: r[cols.activities] !== undefined && r[cols.activities] !== '' ? String(r[cols.activities]).trim() : '',
        projectNameFree: r[cols.projectName] || '',
        wbs,
        category: r[cols.category] || '',
        isFitter: fitCell === 'X' || fitCell === 'x',
        isSiteSup: supCell === 'X' || supCell === 'x',
      });
    }
    return out;
  }

  // Mode 1: full workbook (3 sheets) -> REPLACES the entire database.
  // Manually-set target hours are carried over for projects that still exist.
  async function importFile(file) {
    const wb = await readWorkbook(file);
    const eeSheet = findSheet(wb, ['EE DATA']);
    const projSheet = findSheet(wb, ['Yan_COM']);
    const tsSheet = findSheet(wb, ['TS All']);
    if (!eeSheet || !projSheet || !tsSheet) {
      throw new Error('Không tìm thấy đủ 3 sheet: EE DATA, Yan_COM, TS All');
    }

    const eeRows = XLSX.utils.sheet_to_json(eeSheet, { header: 1, defval: '' });
    const projRows = XLSX.utils.sheet_to_json(projSheet, { header: 1, defval: '' });
    const tsRows = XLSX.utils.sheet_to_json(tsSheet, { header: 1, defval: '' });

    const existingProjects = await DB.getAll('projects');
    const existingByWbs = {};
    existingProjects.forEach(p => existingByWbs[p.wbs] = p);

    const employees = mapEmployees(eeRows);
    const projects = mapProjects(projRows, existingByWbs);
    const rawTimesheets = mapTimesheets(tsRows);
    const timesheets = dedupeTimesheetRows(rawTimesheets);

    await Backup.snapshot('Trước khi cập nhật toàn bộ (tự động)');
    await DB.clear('employees');
    await DB.clear('projects');
    await DB.clear('timesheets');
    await DB.bulkPut('employees', employees);
    await DB.bulkPut('projects', projects);
    await DB.bulkPut('timesheets', timesheets);

    return {
      employees: employees.length,
      projects: projects.length,
      timesheets: timesheets.length,
      duplicates: rawTimesheets.length - timesheets.length,
    };
  }

  // Mode 2a: standalone Yan_COM file.
  // - WBS mới -> thêm dự án mới.
  // - WBS đã có -> KHÔNG ghi đè dữ liệu cũ, nhưng điền bổ sung vào các ô
  //   còn trống (kỹ thuật, giám sát, project number...) nếu file mới có giá trị.
  async function importProjectsFile(file) {
    const wb = await readWorkbook(file);
    const sheet = findSheet(wb, ['Yan_COM']) || wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    const mapped = mapProjects(rows, null);
    if (!mapped.length) {
      throw new Error(`File "${file.name}": không nhận dạng được dữ liệu dự án (cần cấu trúc cột như sheet Yan_COM, WBS Element ở cột D)`);
    }

    const existingProjects = await DB.getAll('projects');
    const byWbs = {};
    existingProjects.forEach(p => byWbs[p.wbs] = p);

    const toPut = [];
    let added = 0, updated = 0, skipped = 0;
    const isEmpty = v => v === undefined || v === null || v === '';

    for (const np of mapped) {
      const old = byWbs[np.wbs];
      if (!old) {
        toPut.push(np);
        added++;
        continue;
      }
      let changed = false;
      for (const f of ['projectNumber', 'projectName', 'customer', 'productLine', 'supervisor', 'salesRep']) {
        if (isEmpty(old[f]) && !isEmpty(np[f])) { old[f] = np[f]; changed = true; }
      }
      if (!old.netValue && np.netValue) { old.netValue = np.netValue; changed = true; }
      if (!old.targetHour && !old.targetHourManual && np.targetHour) { old.targetHour = np.targetHour; changed = true; }
      if (np.specs) {
        if (!old.specs) old.specs = {};
        for (const k of Object.keys(np.specs)) {
          if (!isEmpty(np.specs[k]) && isEmpty(old.specs[k])) { old.specs[k] = np.specs[k]; changed = true; }
        }
      }
      if (changed) { toPut.push(old); updated++; }
      else skipped++;
    }

    await DB.bulkPut('projects', toPut);
    return { added, updated, skipped };
  }

  // Mode 2b: standalone EE Data file -> only ADD new employees; duplicate
  // employee IDs are skipped
  async function importEmployeesFile(file) {
    const wb = await readWorkbook(file);
    const sheet = findSheet(wb, ['EE DATA', 'EE Data']) || wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const mapped = mapEmployees(rows);
    if (!mapped.length) {
      throw new Error(`File "${file.name}": không nhận dạng được dữ liệu nhân viên (cần cấu trúc cột như sheet EE DATA, mã NV ở cột A)`);
    }
    const existing = await DB.getAll('employees');
    const existingIds = new Set(existing.map(e => e.empId));
    const fresh = mapped.filter(e => !existingIds.has(e.empId));
    await DB.bulkPut('employees', fresh);
    return { added: fresh.length, skipped: mapped.length - fresh.length };
  }

  // Mode 2c: one or more monthly timesheet files (one per employee per month).
  // A row is a duplicate when the same employee + date + project + activity
  // already exists; duplicates are skipped, nothing is overwritten.
  async function importTimesheetFiles(files) {
    let allRows = [];
    for (const f of files) {
      const wb = await readWorkbook(f);
      const sheet = findSheet(wb, ['TS All', 'Timesheet', 'TS']) || wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      const mapped = mapTimesheets(rows).filter(r => r.date);
      if (!mapped.length) {
        throw new Error(`File "${f.name}": không nhận dạng được dữ liệu bảng công (cần cấu trúc cột như sheet TS All)`);
      }
      allRows = allRows.concat(mapped);
    }

    const existing = await DB.getAll('timesheets');
    const seenKeys = new Set(existing.map(tsKey));

    const fresh = [];
    for (const r of allRows) {
      const k = tsKey(r);
      if (!seenKeys.has(k)) {
        seenKeys.add(k); // also de-dupes within the imported batch itself
        fresh.push(r);
      }
    }
    await DB.bulkPut('timesheets', fresh);
    return { files: files.length, added: fresh.length, skipped: allRows.length - fresh.length };
  }

  async function exportWorkbook() {
    const employees = await DB.getAll('employees');
    const projects = await DB.getAll('projects');
    const timesheets = await DB.getAll('timesheets');

    const wb = XLSX.utils.book_new();

    const eeAoa = [['Employee ID', 'Person Id', 'Full Name', 'Username', 'DOB', 'Gender', 'Hire Date', 'Position', 'Supervisor']];
    employees.forEach(e => eeAoa.push([e.empId, e.personId, e.fullName, e.username, e.dob, e.gender, e.hireDate, e.position, e.supervisor]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(eeAoa), 'EE DATA');

    const projAoa = [['WBS Element', 'Project Number', 'Project Name', 'Customer', 'Product Line', 'Supervisor', 'Sales Rep', 'Net Value', 'Target Hour']];
    projects.forEach(p => projAoa.push([p.wbs, p.projectNumber || '', p.projectName, p.customer, p.productLine, p.supervisor || '', p.salesRep, p.netValue, p.targetHour]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(projAoa), 'Yan_COM');

    const tsAoa = [['Employee No', 'Name', 'Date', 'From', 'To', 'Normal', 'OT1', 'OT2', 'OT3', 'OT4', 'OT5', 'OT6', 'OT7', 'Total', 'Activities', 'Project Name', 'Work Number', 'Category', 'Fitter', 'Sitesup']];
    timesheets.forEach(t => tsAoa.push([t.empId, t.empName, t.date, t.timeFrom || '', t.timeTo || '', t.normal, t.ot1, t.ot2, t.ot3, t.ot4, t.ot5, t.ot6, t.ot7, t.total, t.activities, t.projectNameFree, t.wbs, t.category, t.isFitter ? 'X' : '', t.isSiteSup ? 'X' : '']));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tsAoa), 'TS All');

    XLSX.writeFile(wb, 'Timesheet_Export.xlsx');
  }

  return { importFile, importProjectsFile, importEmployeesFile, importTimesheetFiles, exportWorkbook, removeDuplicateTimesheets };
})();
