// Dự án (bảng Dự án của TrackingTS) → thông số cho công cụ SWAT Hour (tools/swat-hour) — dùng chung cho
// tab SWAT Hour (js/swat.js) và chức năng Incentive (tools/incentive). Không phụ thuộc trình duyệt.
(function (root) {
  'use strict';
  // SWAT chỉ áp dụng cho: Schindler 3300, ES1.x -> s3300; ES5.0 -> es50; Other Schindler Prod -> villa. Dòng khác -> ''.
  function detectProduct(desc) {
    const d = (desc || '').toString().toLowerCase();
    if (!d) return '';
    if (d.includes('5.0') || d.includes('es5') || d.includes('es 5')) return 'es50';
    if (d.includes('3300') || d.includes('es1') || d.includes('es 1')) return 's3300';
    if (d.includes('other schindler') || d.includes('otherschindler')) return 'villa';
    return '';
  }
  const isSwatProject = (p) => !!detectProduct(p && p.productLine);
  function spec(specs, ...keys) {
    if (!specs) return '';
    const norm = s => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const map = {};
    Object.keys(specs).forEach(k => { map[norm(k)] = specs[k]; });
    for (const k of keys) {
      const v = map[norm(k)];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return '';
  }
  function numTok(v) {
    if (v === '' || v == null) return null;
    const s = String(v).split('|')[0].replace(/,/g, '').replace(/\s/g, '').trim();
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }
  function toToolItem(p, usedHours) {
    const s = p.specs || {};
    const div = (val, d) => { const n = numTok(val); return n == null ? '' : Math.round((n / d) * 100) / 100; };
    return {
      label: `${p.projectName || '(không tên)'} (${p.wbs})`,
      pname: p.projectName || '',
      pref: p.wbs || '',
      product: detectProduct(p.productLine),
      load: numTok(spec(s, 'GQ')) || '',
      speed: numTok(spec(s, 'VKN')) || '',
      stops: numTok(spec(s, 'NUMBER_OF_STOPS', 'NUMBEROFSTOPS', 'STOPS')) || '',
      travel: numTok(spec(s, 'HQ')) || '',
      pit: div(spec(s, 'HSG'), 1000),
      over: div(spec(s, 'HSK'), 1000),
      shaft: div(spec(s, 'TS_MIN'), 1000),
      bef: numTok(spec(s, 'BRANCH_EFFICIENCY_FACTOR', 'BEF')) || '',
      // Giờ SHAPE (X extract) = X hour (cột GRP_INST_TIME_STANDARD, lấy theo tên)
      shape: numTok(spec(s, 'INST_TIME_STANDARD')) || (p.xHour != null && p.xHour !== '' ? p.xHour : '') || '',
      tsd: /low\s*pit/i.test(spec(s, 'HSG_TYPE')) || /reduced\s*head/i.test(spec(s, 'HSK_TYPE')),
      usedHours: usedHours,
      saved: p.swatState || null,   // trạng thái đã "xác nhận Swat" (nếu có)
      confirmed: !!p.targetSwat,
    };
  }
  // Giờ công tính cho SWAT / thưởng lắp đặt: KHÔNG tính mã 1194 (NI Quality Hour — open item: lỗi chất lượng, không phải lỗi lắp đặt)
  const SWAT_EXCLUDE = ['1194'];
  const actCode = (a) => String(a == null ? '' : a).replace(/\s+/g, '').slice(0, 4);
  const countsForSwat = (row) => !SWAT_EXCLUDE.includes(actCode(row && row.activities));
  const api = { detectProduct, isSwatProject, spec, numTok, toToolItem, SWAT_EXCLUDE, countsForSwat };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SwatItem = api;
})(typeof window !== 'undefined' ? window : globalThis);
