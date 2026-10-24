// Quy định lao động Việt Nam dùng cho Timesheet: ngày nghỉ lễ, Tết và phân loại giờ công / làm thêm giờ.
//
// Căn cứ:
//  - Bộ luật Lao động 2019, Điều 112 (nghỉ lễ, Tết), Điều 111 khoản 3 (nghỉ bù khi trùng ngày nghỉ hằng tuần),
//    Điều 98 (tiền lương làm thêm giờ, làm việc ban đêm), Điều 106 (ban đêm: 22 giờ – 6 giờ sáng hôm sau).
//  - Nghị định 145/2020/NĐ-CP, Điều 57 (làm thêm giờ vào ban đêm: 200% / 210% / 270% / 390%).
//  - Nghị quyết 28/2026/QH16 (hiệu lực 01/7/2026): 24/11 hằng năm là Ngày Văn hóa Việt Nam, nghỉ hưởng nguyên lương.
//
// Cột OT trong mẫu bảng chấm công Schindler (I..O):
//   OT1 ngày thường 150% · OT2 ngày nghỉ hằng tuần 200% · OT3 ngày lễ 300%
//   OT4 đêm ngày thường 200% · OT5 đêm ngày nghỉ hằng tuần 270% · OT6 đêm ngày lễ 390%
//   OT7 đêm ngày thường, đã làm thêm 17:00–22:00 trước đó 210%
//
// File JS thuần (không JSX): chạy trong trình duyệt (window.LaborVN) và trong Node (kiểm thử).
(function (root) {
    'use strict';

    // ------------------------------------------------------------------
    //  Âm lịch (thuật toán Hồ Ngọc Đức, múi giờ +7) — tính Tết, Giỗ Tổ
    // ------------------------------------------------------------------
    const INT = Math.floor;
    const TZ = 7;
    function jdFromDate(dd, mm, yy) {
        const a = INT((14 - mm) / 12), y = yy + 4800 - a, m = mm + 12 * a - 3;
        let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
        if (jd < 2299161) jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
        return jd;
    }
    function jdToDate(jd) {
        let b, c;
        if (jd > 2299160) { const a = jd + 32044; b = INT((4 * a + 3) / 146097); c = a - INT((b * 146097) / 4); }
        else { b = 0; c = jd + 32082; }
        const d = INT((4 * c + 3) / 1461), e = c - INT((1461 * d) / 4), m = INT((5 * e + 2) / 153);
        return [e - INT((153 * m + 2) / 5) + 1, m + 3 - 12 * INT(m / 10), b * 100 + d - 4800 + INT(m / 10)];
    }
    function newMoon(k) {
        const T = k / 1236.85, T2 = T * T, T3 = T2 * T, dr = Math.PI / 180;
        let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
        jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
        const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
        const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
        const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
        let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
        C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
        C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
        C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
        C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
        C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
        C1 = C1 + 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
        const deltat = T < -11
            ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
            : -0.000278 + 0.000265 * T + 0.000262 * T2;
        return jd1 + C1 - deltat;
    }
    function sunLongitude(jdn) {
        const T = (jdn - 2451545.0) / 36525, T2 = T * T, dr = Math.PI / 180;
        const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
        const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
        let DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
        DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M);
        let L = (L0 + DL) * dr;
        L = L - Math.PI * 2 * INT(L / (Math.PI * 2));
        return L;
    }
    const sunSector = (dayNumber) => INT(sunLongitude(dayNumber - 0.5 - TZ / 24) / Math.PI * 6);
    const newMoonDay = (k) => INT(newMoon(k) + 0.5 + TZ / 24);
    function lunarMonth11(yy) {
        const k = INT((jdFromDate(31, 12, yy) - 2415021) / 29.530588853);
        const nm = newMoonDay(k);
        return sunSector(nm) >= 9 ? newMoonDay(k - 1) : nm;
    }
    function leapMonthOffset(a11) {
        const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
        let last, i = 1, arc = sunSector(newMoonDay(k + i));
        do { last = arc; i++; arc = sunSector(newMoonDay(k + i)); } while (arc !== last && i < 14);
        return i - 1;
    }
    // ngày âm (tháng không nhuận) → 'YYYY-MM-DD' dương lịch
    function lunarToSolar(lDay, lMonth, lYear) {
        const a11 = lMonth < 11 ? lunarMonth11(lYear - 1) : lunarMonth11(lYear);
        const b11 = lMonth < 11 ? lunarMonth11(lYear) : lunarMonth11(lYear + 1);
        const k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853);
        let off = lMonth - 11;
        if (off < 0) off += 12;
        if (b11 - a11 > 365 && off >= leapMonthOffset(a11)) off += 1;
        const [d, m, y] = jdToDate(newMoonDay(k + off) + lDay - 1);
        return iso(y, m, d);
    }

    // ------------------------------------------------------------------
    //  Ngày tháng (chuỗi 'YYYY-MM-DD', theo giờ địa phương)
    // ------------------------------------------------------------------
    const pad = (n) => String(n).padStart(2, '0');
    const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
    const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
    const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
    const weekday = (s) => parse(s).getDay(); // 0 = CN … 6 = T7

    // ------------------------------------------------------------------
    //  Lịch làm việc của người lao động (ngày nghỉ hằng tuần do doanh nghiệp quy định)
    // ------------------------------------------------------------------
    //   restFrom[weekday] = phút trong ngày bắt đầu nghỉ hằng tuần (0 = cả ngày; không có = ngày làm việc)
    //   normal[weekday]   = các khung giờ làm việc bình thường [phút bắt đầu, phút kết thúc)
    const AM = [8 * 60, 12 * 60], PM = [13 * 60, 17 * 60];
    const SCHEDULES = {
        'mon-sat-am': { short: 'T2–T6, sáng T7', label: 'T2–T6 cả ngày, sáng T7 (nghỉ chiều T7 và CN)', restFrom: { 0: 0, 6: 12 * 60 },
            normal: { 1: [AM, PM], 2: [AM, PM], 3: [AM, PM], 4: [AM, PM], 5: [AM, PM], 6: [AM] } },
        'mon-fri': { short: 'T2–T6', label: 'T2–T6 (nghỉ T7 và CN)', restFrom: { 0: 0, 6: 0 },
            normal: { 1: [AM, PM], 2: [AM, PM], 3: [AM, PM], 4: [AM, PM], 5: [AM, PM] } },
        'mon-sat': { short: 'T2–T7', label: 'T2–T7 (nghỉ CN)', restFrom: { 0: 0 },
            normal: { 1: [AM, PM], 2: [AM, PM], 3: [AM, PM], 4: [AM, PM], 5: [AM, PM], 6: [AM, PM] } },
    };
    const DEFAULT_SCHEDULE = 'mon-sat-am';
    const sched = (id) => SCHEDULES[id] || SCHEDULES[DEFAULT_SCHEDULE];
    // cả ngày là ngày nghỉ hằng tuần?
    const isRestDay = (s, id) => sched(id).restFrom[weekday(s)] === 0;

    // ------------------------------------------------------------------
    //  Ngày nghỉ lễ, Tết (Điều 112) + nghỉ bù (Điều 111 khoản 3)
    // ------------------------------------------------------------------
    // Ngày nghỉ thêm dịp Quốc khánh (1/9 hoặc 3/9) do Thủ tướng quyết định hằng năm — các năm đã công bố:
    const NATIONAL_DAY_EXTRA = { 2021: '09-03', 2022: '09-01', 2023: '09-01', 2024: '09-03', 2025: '09-01', 2026: '09-01' };
    // Năm chưa công bố: chọn ngày liền kề tạo kỳ nghỉ dài (thứ 2 hoặc thứ 6), nếu không thì ngày sau.
    function nationalDayExtra(y) {
        if (NATIONAL_DAY_EXTRA[y]) return `${y}-${NATIONAL_DAY_EXTRA[y]}`;
        const before = `${y}-09-01`, after = `${y}-09-03`;
        const wb = weekday(before), wa = weekday(after);
        if (wa === 1 || wa === 5) return after;
        if (wb === 1 || wb === 5) return before;
        if (wa === 0 || wa === 6) return before;
        return after;
    }
    // Tết Âm lịch 05 ngày: mặc định ngày cuối năm âm + mùng 1 → mùng 4 (phương án phổ biến;
    // doanh nghiệp có thể chọn phương án khác — xem README).
    function statutoryHolidays(y) {
        const list = [];
        const add = (date, name) => list.push({ date, name });
        add(`${y}-01-01`, 'Tết Dương lịch');
        const tet = lunarToSolar(1, 1, y);
        add(addDays(tet, -1), 'Tết Âm lịch (ngày cuối năm)');
        for (let i = 0; i < 4; i++) add(addDays(tet, i), `Tết Âm lịch (mùng ${i + 1})`);
        add(lunarToSolar(10, 3, y), 'Giỗ Tổ Hùng Vương (10/3 âm lịch)');
        add(`${y}-04-30`, 'Ngày Chiến thắng 30/4');
        add(`${y}-05-01`, 'Ngày Quốc tế Lao động 1/5');
        const extra = nationalDayExtra(y);
        if (extra < `${y}-09-02`) add(extra, 'Quốc khánh (nghỉ thêm)');
        add(`${y}-09-02`, 'Quốc khánh 2/9');
        if (extra > `${y}-09-02`) add(extra, 'Quốc khánh (nghỉ thêm)');
        if (y >= 2026) add(`${y}-11-24`, 'Ngày Văn hóa Việt Nam 24/11');
        return list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    }
    const cache = {};
    // Map 'YYYY-MM-DD' → { name, compensatory } của năm y (gồm cả ngày nghỉ bù có thể rơi sang năm sau)
    function holidayMap(y, scheduleId) {
        const key = y + '|' + (SCHEDULES[scheduleId] ? scheduleId : DEFAULT_SCHEDULE);
        if (cache[key]) return cache[key];
        const map = {};
        const stat = statutoryHolidays(y);
        stat.forEach(h => { map[h.date] = { name: h.name, compensatory: false }; });
        // Ngày lễ trùng ngày nghỉ hằng tuần → nghỉ bù vào ngày làm việc kế tiếp (không trùng ngày lễ / nghỉ bù khác)
        stat.forEach(h => {
            if (!isRestDay(h.date, scheduleId)) return;
            let d = addDays(h.date, 1);
            while (isRestDay(d, scheduleId) || map[d]) d = addDays(d, 1);
            map[d] = { name: `Nghỉ bù ${h.name}`, compensatory: true };
        });
        cache[key] = map;
        return map;
    }
    // Thông tin ngày lễ của một ngày (hoặc null). Xét cả nghỉ bù của năm trước tràn sang đầu năm.
    function holidayInfo(s, scheduleId) {
        if (!s) return null;
        const y = Number(s.slice(0, 4));
        return holidayMap(y, scheduleId)[s] || holidayMap(y - 1, scheduleId)[s] || null;
    }
    const isHoliday = (s, scheduleId) => !!holidayInfo(s, scheduleId);
    function holidaysBetween(start, end, scheduleId) {
        const out = [];
        for (let d = start; d <= end; d = addDays(d, 1)) {
            const h = holidayInfo(d, scheduleId);
            if (h) out.push({ date: d, name: h.name, compensatory: h.compensatory });
        }
        return out;
    }

    // ------------------------------------------------------------------
    //  Phân loại giờ công (Điều 98, Điều 105, Điều 106 BLLĐ 2019; Điều 57 NĐ 145/2020)
    // ------------------------------------------------------------------
    const OT_RATES = { NORMAL: 100, OT1: 150, OT2: 200, OT3: 300, OT4: 200, OT5: 270, OT6: 390, OT7: 210 };
    const CATS = ['NORMAL', 'OT1', 'OT2', 'OT3', 'OT4', 'OT5', 'OT6', 'OT7'];
    // Mã công việc nghỉ phép / ốm / không lương: không phải làm việc → không tính làm thêm giờ
    const LEAVE_CODES = ['6010', '6020', '6090'];
    const NIGHT_START = 22 * 60, NIGHT_END = 6 * 60, LUNCH = [12 * 60, 13 * 60];
    const toMin = (t) => { if (!t) return null; const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };

    // Loại ngày tại thời điểm `minute` của ngày `s`: 'holiday' | 'rest' | 'work'
    function dayKind(s, minute, scheduleId) {
        if (isHoliday(s, scheduleId)) return 'holiday';
        const rf = sched(scheduleId).restFrom[weekday(s)];
        return rf !== undefined && minute >= rf ? 'rest' : 'work';
    }
    const inNormal = (s, minute, scheduleId) =>
        (sched(scheduleId).normal[weekday(s)] || []).some(([a, b]) => minute >= a && minute < b);

    // Phân loại từng phút của một lần làm việc. Ca đêm 22:00 → 06:00 thuộc về NGÀY BẮT ĐẦU ca đêm
    // (đúng như mẫu: "22:00 – 6:00 hôm sau – ngày CN / ngày lễ / ngày thường").
    // Trả về { mins: {cat: phút}, ot1Days: {ngày có OT1}, nights: {ngày sở hữu ca đêm: phút OT4} }
    function classify(entry, scheduleId) {
        const mins = {}, ot1Days = {}, nights = {};
        const start = toMin(entry.startTime), end0 = toMin(entry.endTime);
        if (start === null || end0 === null || !entry.date) return { mins, ot1Days, nights, span: 0 };
        let end = end0;
        if (end <= start) end += 24 * 60; // qua nửa đêm
        const span = end - start;
        // nghỉ giữa giờ: trừ trước vào giờ nghỉ trưa 12:00–13:00 (nếu ca có đi qua), phần còn lại trừ sau
        let brk = Math.min(span, Math.round((parseFloat(entry.breakTime) || 0) * 60));
        const lunchSkip = Math.min(brk, Math.max(0, Math.min(end, LUNCH[1]) - Math.max(start, LUNCH[0])));
        brk -= lunchSkip;
        let lunchLeft = lunchSkip;
        for (let t = start; t < end; t++) {
            if (lunchLeft > 0 && t >= LUNCH[0] && t < LUNCH[1]) { lunchLeft--; continue; }
            const dayOff = INT(t / 1440), minute = t % 1440;
            const date = addDays(entry.date, dayOff);
            const night = minute >= NIGHT_START || minute < NIGHT_END;
            // ca đêm sau 0 giờ thuộc về ngày hôm trước
            const owner = night && minute < NIGHT_END ? addDays(date, -1) : date;
            const kind = night ? dayKind(owner, NIGHT_START, scheduleId) : dayKind(date, minute, scheduleId);
            let cat;
            if (kind === 'holiday') cat = night ? 'OT6' : 'OT3';
            else if (kind === 'rest') cat = night ? 'OT5' : 'OT2';
            else if (night) { cat = 'OT4'; nights[owner] = (nights[owner] || 0) + 1; }
            else if (inNormal(date, minute, scheduleId)) cat = 'NORMAL';
            else { cat = 'OT1'; ot1Days[date] = true; }
            mins[cat] = (mins[cat] || 0) + 1;
        }
        // nghỉ còn lại (không rơi vào giờ trưa): trừ vào loại giờ nhiều nhất
        if (brk > 0) {
            const top = Object.keys(mins).sort((a, b) => mins[b] - mins[a])[0];
            if (top) {
                mins[top] -= brk;
                if (top === 'OT4') { // giữ số phút ca đêm theo ngày khớp với tổng
                    let left = brk;
                    Object.keys(nights).sort().reverse().forEach(d => { const x = Math.min(left, nights[d]); nights[d] -= x; left -= x; });
                }
            }
        }
        return { mins, ot1Days, nights, span };
    }

    const round2 = (x) => Math.round(x * 100) / 100;
    function toHours(mins) {
        const out = {};
        CATS.forEach(c => { if (mins[c] > 0) out[c] = round2(mins[c] / 60); });
        return out;
    }
    const isAuto = (e) => e && e.otMode === 'auto' && !LEAVE_CODES.includes(String(e.activityCode));

    // Phân loại giờ cho nhiều dòng chấm công cùng lúc (cần để biết OT7: đêm ngày thường có làm thêm
    // 17:00–22:00 trước đó — kể cả khi phần làm thêm buổi tối nằm ở một dòng khác cùng ngày).
    // `hoursOf(e)` = tổng giờ tính công của dòng (dùng cho dòng nhập tay / nghỉ phép).
    // Trả về Map id → { NORMAL?: giờ, OT1?: giờ, … }
    function breakdownAll(entries, scheduleId, hoursOf) {
        const out = new Map();
        const ot1Days = {};
        const parts = [];
        (entries || []).forEach(e => {
            if (isAuto(e)) {
                const c = classify(e, scheduleId);
                Object.assign(ot1Days, c.ot1Days);
                parts.push([e, c]);
            } else {
                const code = LEAVE_CODES.includes(String(e.activityCode)) ? 'NORMAL' : (e.otType || 'NORMAL');
                if (code === 'OT1') ot1Days[e.date] = true;
                const h = hoursOf ? hoursOf(e) : 0;
                out.set(e.id, h > 0 ? { [code]: round2(h) } : {});
            }
        });
        parts.forEach(([e, c]) => {
            const mins = Object.assign({}, c.mins);
            // đêm ngày thường: OT7 nếu ngày đó đã làm thêm ban ngày (OT1), nếu không là OT4
            Object.keys(c.nights).forEach(d => {
                if (ot1Days[d] && c.nights[d] > 0) {
                    mins.OT4 = (mins.OT4 || 0) - c.nights[d];
                    mins.OT7 = (mins.OT7 || 0) + c.nights[d];
                }
            });
            out.set(e.id, toHours(mins));
        });
        return out;
    }
    // Một dòng (dùng cho xem trước trong form): `others` = các dòng khác để xét OT7
    function breakdown(entry, scheduleId, others, hoursOf) {
        const id = entry.id != null ? entry.id : '__preview__';
        const list = (others || []).filter(o => o.id !== entry.id).concat([Object.assign({}, entry, { id })]);
        return breakdownAll(list, scheduleId, hoursOf).get(id) || {};
    }
    // Loại giờ chính của một dòng (nhiều giờ nhất) — giữ trường otType cho dữ liệu cũ / hiển thị gọn
    function dominant(bd) {
        const keys = Object.keys(bd || {}).filter(k => bd[k] > 0);
        if (!keys.length) return 'NORMAL';
        return keys.sort((a, b) => bd[b] - bd[a])[0];
    }
    // Ca có đi qua trọn giờ nghỉ trưa 12:00–13:00 không (để gợi ý "Nghỉ 1 giờ")
    function coversLunch(startTime, endTime) {
        const s = toMin(startTime), e0 = toMin(endTime);
        if (s === null || e0 === null) return false;
        const e = e0 <= s ? e0 + 1440 : e0;
        return s <= LUNCH[0] && e >= LUNCH[1];
    }

    const api = {
        SCHEDULES, DEFAULT_SCHEDULE, OT_RATES, CATS, LEAVE_CODES,
        lunarToSolar, statutoryHolidays, holidayInfo, isHoliday, holidaysBetween, isRestDay,
        breakdownAll, breakdown, dominant, coversLunch, isAuto,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.LaborVN = api;
})(typeof window !== 'undefined' ? window : globalThis);
