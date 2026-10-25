// Quy tắc cho bảng công cá nhân (Timesheet): kỳ lương và kiểm tra dữ liệu gửi lên.
// Kỳ lương 'YYYY-MM' = từ 16 của tháng trước đến 15 của tháng đó (khớp getSalaryPeriod trong tools/timesheet).

export const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n) => String(n).padStart(2, '0');

export function periodRange(period) {
  const [y, m] = period.split('-').map(Number);
  const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
  return { start: `${py}-${pad(pm)}-16`, end: `${y}-${pad(m)}-15` };
}

export const MAX_ENTRIES = 400;
export const MAX_ENTRY_CHARS = 2500;
export const MAX_DOC_CHARS = 300000;
const MAX_TOMBS = 400;

// Trả về {data (bản đã làm sạch), count} hoặc ném Error(message) khi dữ liệu không hợp lệ.
export function checkDoc(period, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Dữ liệu bảng công không hợp lệ');
  const entries = Array.isArray(input.entries) ? input.entries : null;
  if (!entries) throw new Error('Thiếu danh sách dòng chấm công');
  if (entries.length > MAX_ENTRIES) throw new Error(`Tối đa ${MAX_ENTRIES} dòng cho một kỳ`);
  const { start, end } = periodRange(period);
  const seen = new Set(), out = [];
  for (const e of entries) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) throw new Error('Có dòng chấm công không hợp lệ');
    if (e.id === undefined || e.id === null || !/^\d{1,16}$/.test(String(e.id))) throw new Error('Dòng chấm công thiếu mã (id)');
    const id = String(e.id);
    if (seen.has(id)) continue;                     // trùng id: giữ dòng đầu
    seen.add(id);
    if (typeof e.date !== 'string' || !DATE_RE.test(e.date)) throw new Error('Dòng chấm công có ngày không hợp lệ');
    if (e.date < start || e.date > end) throw new Error(`Ngày ${e.date} không thuộc kỳ lương ${start} → ${end}`);
    if (JSON.stringify(e).length > MAX_ENTRY_CHARS) throw new Error('Một dòng chấm công quá dài');
    out.push(e);
  }
  const sch = ['mon-sat-am', 'mon-fri', 'mon-sat'].includes(input.sch) ? input.sch : '';
  const deleted = {};
  if (input.deleted && typeof input.deleted === 'object' && !Array.isArray(input.deleted)) {
    const keys = Object.keys(input.deleted).filter(k => /^\d{1,16}$/.test(k) && Number.isFinite(Number(input.deleted[k]))).slice(-MAX_TOMBS);
    keys.forEach(k => { deleted[k] = Number(input.deleted[k]); });
  }
  const data = JSON.stringify(sch ? { entries: out, deleted, sch } : { entries: out, deleted });
  if (data.length > MAX_DOC_CHARS) throw new Error('Bảng công quá lớn');
  return { data, count: out.length };
}

// ---------- nộp bảng công: kiểm tra phân loại giờ do máy khách tính (labor.js nặng, không chạy được trên máy chủ gói miễn phí) ----------
export const BD_KEYS = ['NORMAL', 'OT1', 'OT2', 'OT3', 'OT4', 'OT5', 'OT6', 'OT7'];

// giống calculateHours của Timesheet: qua nửa đêm thì cộng 24 giờ, trừ giờ nghỉ
export function entryHours(e) {
  const t = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); return m ? +m[1] + +m[2] / 60 : null; };
  const a = t(e.startTime), b = t(e.endTime);
  if (a === null || b === null) return 0;
  let diff = b - a; if (diff < 0) diff += 24;
  return Math.max(0, diff - (parseFloat(e.breakTime) || 0));
}

// Mỗi dòng phải có bd (số giờ từng loại: thường / OT1…OT7) khớp tổng giờ tính từ giờ vào – ra – nghỉ. Trả về lỗi đầu tiên hoặc ''.
export function checkSubmitEntries(entries) {
  if (!entries.length) return 'Chưa có dòng chấm công nào trong kỳ này';
  for (const e of entries) {
    const bd = e.bd;
    const where = `Dòng ngày ${e.date}`;
    if (!bd || typeof bd !== 'object' || Array.isArray(bd)) return `${where} chưa có phân loại giờ — mở lại Timesheet (tải lại trang) rồi nộp lại`;
    let sum = 0;
    for (const k of Object.keys(bd)) {
      const v = bd[k];
      if (!BD_KEYS.includes(k) || typeof v !== 'number' || !(v >= 0) || v > 24) return `${where}: phân loại giờ không hợp lệ`;
      sum += v;
    }
    const want = entryHours(e);
    if (Math.abs(sum - want) > 0.1) return `${where}: tổng giờ phân loại (${sum}) không khớp giờ vào – ra (${Math.round(want * 100) / 100})`;
    if (typeof e.cat !== 'string' || e.cat.length > 12) return `${where} thiếu nhóm công việc — tải lại trang rồi nộp lại`;
  }
  return '';
}

// Dòng của bảng Theo dõi giờ công (cùng cấu trúc dòng nhập từ Excel: xem mapTimesheets trong js/importer.js)
export function trackingRow(e, owner, period) {
  const bd = e.bd || {};
  const n = (k) => Math.round((Number(bd[k]) || 0) * 100) / 100;
  const row = {
    source: 'approved', period,
    empId: owner.empId, empName: owner.name, date: e.date,
    timeFrom: String(e.startTime || ''), timeTo: String(e.endTime || ''),
    normal: n('NORMAL'), ot1: n('OT1'), ot2: n('OT2'), ot3: n('OT3'), ot4: n('OT4'), ot5: n('OT5'), ot6: n('OT6'), ot7: n('OT7'),
    activities: String(e.activityCode || '').slice(0, 20),
    projectNameFree: String(e.projectName || '').slice(0, 200),
    wbs: String(e.workNumber || '').trim().slice(0, 100),
    category: String(e.cat || ''),
    isFitter: !!owner.isFitter, isSiteSup: !!owner.isSiteSup,
  };
  row.total = Math.round((row.normal + row.ot1 + row.ot2 + row.ot3 + row.ot4 + row.ot5 + row.ot6 + row.ot7) * 100) / 100;
  return row;
}
