// Duyệt tăng ca theo ngày + đơn nghỉ phép / ốm — phần dùng chung cho trình duyệt (Timesheet, Duyệt bảng công) và máy chủ.
//
// Tăng ca: mỗi NGÀY có giờ OT là một yêu cầu duyệt. sig = dấu vân tay các dòng chấm công của ngày (giờ vào–ra–nghỉ,
// mã công việc, WBS, cách tính OT) — sửa bất kỳ dòng nào của ngày thì sig đổi và ngày đó phải duyệt lại.
// Nghỉ: đơn (loại, từ ngày → đến ngày) được duyệt trước ngày bắt đầu; duyệt xong ghi mỗi ngày làm việc một dòng nghỉ.
// Hàm thuần — kiểm thử bằng Node (test/client/otleave.test.mjs).
(function (root) {
  'use strict';

  const LEAVE_CODES = ['6010', '6020', '6090'];
  const LEAVE_TYPES = {
    '6010': { label: 'Nghỉ phép năm', short: 'Phép năm', wn: 'PAID LEAVE' },
    '6020': { label: 'Nghỉ ốm', short: 'Ốm', wn: 'PAID LEAVE' },
    '6090': { label: 'Nghỉ không lương', short: 'Không lương', wn: 'UNPAID LEAVE' },
  };
  const MAX_LEAVE_DAYS = 31;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const norm = (s) => String(s == null ? '' : s).trim().toUpperCase();
  const r2 = (n) => Math.round(n * 100) / 100;

  // dấu vân tay các dòng chấm công của một ngày (thứ tự cố định)
  function daySig(entries, date) {
    return (entries || []).filter((e) => e && e.date === date)
      .map((e) => [e.startTime || '', e.endTime || '', String(e.breakTime == null ? '' : e.breakTime), String(e.activityCode || ''),
        norm(e.workNumber), e.otMode || '', e.otMode === 'auto' ? '' : (e.otType || '')].join('|'))
      .sort().join(';');
  }

  // Các ngày có tăng ca → [{date, ot, total, sig, wbs:[…], items:[…]}]. bdOf(e) = {NORMAL: h, OT1: h, …} của dòng.
  function otDays(entries, bdOf) {
    const by = new Map();
    (entries || []).forEach((e) => {
      if (!e || !DATE_RE.test(String(e.date)) || LEAVE_CODES.includes(String(e.activityCode))) return;
      const bd = bdOf(e) || {};
      const tot = Object.values(bd).reduce((a, v) => a + (+v || 0), 0), ot = tot - (+bd.NORMAL || 0);
      const d = by.get(e.date) || { date: e.date, ot: 0, total: 0, rows: [] };
      d.ot += ot; d.total += tot; d.rows.push(e);
      by.set(e.date, d);
    });
    return [...by.values()].filter((d) => d.ot > 0.01).sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({
      date: d.date, ot: r2(d.ot), total: r2(d.total), sig: daySig(entries, d.date),
      wbs: [...new Set(d.rows.map((e) => String(e.workNumber || '').trim()).filter(Boolean))],
      items: d.rows.slice().sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || ''))).map((e) => ({
        start: e.startTime || '', end: e.endTime || '', brk: String(e.breakTime || '0'), code: String(e.activityCode || ''),
        wbs: String(e.workNumber || '').trim(), project: String(e.projectName || '').trim(), report: String(e.report || '').trim(),
      })),
    }));
  }

  // ---------- nghỉ ----------
  const addDay = (s, n) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
  // Ngày làm việc trong [from, to] theo lịch (LaborVN.SCHEDULES): bỏ ngày nghỉ hằng tuần, ngày lễ / nghỉ bù;
  // ngày chỉ làm buổi sáng (vd T7 của lịch "T2–T6, sáng T7") → nửa ngày.
  function leaveDays(from, to, sch, Labor) {
    if (!DATE_RE.test(String(from)) || !DATE_RE.test(String(to)) || to < from) return [];
    const S = Labor.SCHEDULES[sch] ? sch : Labor.DEFAULT_SCHEDULE, conf = Labor.SCHEDULES[S], out = [];
    for (let d = from, k = 0; d <= to && k < 400; d = addDay(d, 1), k++) {
      if (Labor.isRestDay(d, S) || Labor.isHoliday(d, S)) continue;
      const w = new Date(d + 'T00:00:00Z').getUTCDay(), slots = conf.normal[w] || [];
      if (!slots.length) continue;
      out.push({ date: d, half: slots.length === 1 });
    }
    return out;
  }
  const dayCount = (days) => (days || []).reduce((a, d) => a + (d.half ? 0.5 : 1), 0);

  // Dòng chấm công nghỉ cho một ngày (id: số, theo thời điểm duyệt). 6090: không tính giờ.
  function leaveEntry(day, type, reqId, id, u) {
    const T = LEAVE_TYPES[type];
    const unpaid = type === '6090';
    return {
      id, date: day.date, startTime: unpaid ? '' : '08:00', endTime: unpaid ? '' : (day.half ? '12:00' : '17:00'),
      breakTime: unpaid || day.half ? '0' : '1', otMode: 'auto', otType: 'NORMAL', projectName: T.label, workNumber: T.wn,
      activityCode: type, dutyHour: '0', remarks: `Đơn nghỉ #${reqId} đã duyệt`, report: '', lv: String(reqId), u,
    };
  }

  const api = { LEAVE_CODES, LEAVE_TYPES, MAX_LEAVE_DAYS, daySig, otDays, leaveDays, dayCount, leaveEntry, addDay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TsOtLeave = api;
})(typeof window !== 'undefined' ? window : globalThis);
