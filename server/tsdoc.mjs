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
  const deleted = {};
  if (input.deleted && typeof input.deleted === 'object' && !Array.isArray(input.deleted)) {
    const keys = Object.keys(input.deleted).filter(k => /^\d{1,16}$/.test(k) && Number.isFinite(Number(input.deleted[k]))).slice(-MAX_TOMBS);
    keys.forEach(k => { deleted[k] = Number(input.deleted[k]); });
  }
  const data = JSON.stringify({ entries: out, deleted });
  if (data.length > MAX_DOC_CHARS) throw new Error('Bảng công quá lớn');
  return { data, count: out.length };
}
