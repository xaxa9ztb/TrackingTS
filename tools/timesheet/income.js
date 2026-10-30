// Thu nhập DỰ KIẾN của một kỳ lương cho Timesheet cá nhân: lương cơ bản (người dùng tự nhập) + tiền làm thêm giờ (OT) + trợ cấp xe − nghỉ không lương.
// Chỉ là ước tính: không gồm các khoản khác (thưởng, phụ cấp khác, bảo hiểm, thuế…). Lương cơ bản chỉ lưu trên máy người dùng
// (localStorage 'ts_salary_v1'), KHÔNG gửi lên máy chủ, không có trong sao lưu / báo cáo / email. Hàm thuần — kiểm thử bằng Node (test/client/income.test.mjs).
(function (root) {
  'use strict';

  const WORK_DAYS = 26;      // ngày công chuẩn / tháng để quy ra lương ngày, lương giờ
  const DAY_HOURS = 8;
  // tỷ lệ % lương giờ cho từng loại giờ (Điều 98 BLLĐ 2019, NĐ 145/2020): khớp LaborVN.OT_RATES
  const RATES = { OT1: 150, OT2: 200, OT3: 300, OT4: 200, OT5: 270, OT6: 390, OT7: 210 };
  const LEAVE_UNPAID = '6090';
  const r0 = (n) => Math.round(n);

  // base: lương cơ bản tháng (đ); entries: các dòng của kỳ; bdOf(e) → {NORMAL, OT1…}; allowance: tổng trợ cấp xe của kỳ (đ)
  function compute({ base, entries, bdOf, allowance }) {
    const b = Math.max(0, Number(base) || 0);
    const dayPay = b / WORK_DAYS, hourly = dayPay / DAY_HOURS;
    const hours = {};
    const unpaid = new Set();
    (entries || []).forEach((e) => {
      if (!e) return;
      if (String(e.activityCode) === LEAVE_UNPAID) { unpaid.add(e.date); return; }
      const bd = bdOf(e) || {};
      Object.keys(RATES).forEach((k) => { if (bd[k] > 0) hours[k] = (hours[k] || 0) + (+bd[k]); });
    });
    const ot = Object.keys(RATES).filter((k) => hours[k] > 0).map((k) => ({ cat: k, rate: RATES[k], hours: Math.round(hours[k] * 100) / 100, amount: r0(hours[k] * hourly * RATES[k] / 100) }));
    const otPay = ot.reduce((a, x) => a + x.amount, 0);
    const deduction = r0(dayPay * unpaid.size);
    const allow = Math.max(0, r0(Number(allowance) || 0));
    return { base: r0(b), hourly: r0(hourly), ot, otHours: Math.round(ot.reduce((a, x) => a + x.hours, 0) * 100) / 100, otPay, unpaidDays: unpaid.size, deduction, allowance: allow,
      total: r0(b) - deduction + otPay + allow };
  }

  // '12.500.000' / '12500000' / '12,5 tr' không hỗ trợ — chỉ lấy chữ số
  const parseMoney = (s) => { const d = String(s == null ? '' : s).replace(/[^\d]/g, ''); return d ? Math.min(Number(d), 9e9) : 0; };
  const fmtMoney = (n) => Math.round(Number(n) || 0).toLocaleString('vi-VN');

  const api = { WORK_DAYS, DAY_HOURS, RATES, compute, parseMoney, fmtMoney };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TsIncome = api;
})(typeof window !== 'undefined' ? window : globalThis);
