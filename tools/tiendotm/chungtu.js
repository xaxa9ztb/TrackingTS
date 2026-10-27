// Nhận diện & trích số chứng từ hàng hoá (C/O, C/Q, Packing List, Vận đơn HBL) từ văn bản OCR / lớp text của PDF.
// Hàm thuần — không đụng trình duyệt, kiểm thử được bằng Node (test/client/chungtu.test.mjs).
// Kết quả chỉ là GỢI Ý: người dùng luôn sửa lại được trên form (OCR có thể đọc sai ký tự).
(function (root) {
  'use strict';

  const LOAI = {
    co:  'C/O (chứng nhận xuất xứ)',
    cq:  'C/Q (chứng nhận chất lượng)',
    pl:  'Packing List',
    hbl: 'Vận đơn (HBL)',
  };

  // bỏ dấu + hoa: các từ khoá tiếng Việt / Anh so khớp cùng một kiểu
  const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase();

  // từ khoá nhận diện loại chứng từ: [mẫu, điểm]. Tiêu đề ở đầu văn bản được nhân 3.
  const KEYS = {
    hbl: [[/BILL\s+OF\s+LADING/, 4], [/\bHOUSE\s+B\/?L\b|\bHBL\b|\bH\.?B\/L\b/, 4], [/\bB\/L\b/, 2], [/VAN\s+DON/, 4], [/SHIPPER/, 1], [/CONSIGNEE/, 1], [/PORT\s+OF\s+(?:LOADING|DISCHARGE)/, 1]],
    pl:  [[/PACKING\s+LIST/, 5], [/DANH\s+MUC\s+DONG\s+GOI|PHIEU\s+DONG\s+GOI/, 5], [/\bPACKING\b/, 1], [/GROSS\s+WEIGHT|G\.?W\b/, 1], [/NET\s+WEIGHT|N\.?W\b/, 1], [/MEASUREMENT|CBM/, 1]],
    co:  [[/CERTIFICATE\s+OF\s+ORIGIN/, 6], [/GIAY\s+CHUNG\s+NHAN\s+XUAT\s+XU|CHUNG\s+NHAN\s+XUAT\s+XU/, 6], [/\bC\/O\b/, 3], [/\bFORM\s+[A-Z]{1,2}\b/, 2], [/COUNTRY\s+OF\s+ORIGIN/, 1], [/ORIGIN\s+CRITERION/, 3]],
    cq:  [[/CERTIFICATE\s+OF\s+(?:QUALITY|CONFORMITY|COMPLIANCE|INSPECTION)/, 6], [/QUALITY\s+(?:CERTIFICATE|REPORT|INSPECTION)/, 6], [/CHUNG\s+NHAN\s+CHAT\s+LUONG|PHIEU\s+KIEM\s+TRA\s+CHAT\s+LUONG/, 6], [/\bC\/Q\b/, 3], [/FACTORY\s+INSPECTION|TEST\s+REPORT/, 2], [/INSPECTION\s+RESULT/, 1]],
  };

  // Đoán loại chứng từ. fileName chỉ làm điểm cộng nhẹ (người dùng hay đặt tên CO.pdf, HBL.pdf…).
  function detect(text, fileName) {
    const t = fold(text), head = t.slice(0, 700), fn = fold(fileName);
    const score = { co: 0, cq: 0, pl: 0, hbl: 0 };
    for (const k in KEYS) KEYS[k].forEach(([re, w]) => {
      if (re.test(head)) score[k] += w * 3;
      else if (re.test(t)) score[k] += w;
    });
    const byName = { hbl: /HBL|B[-_ ]?L\b|VAN[-_ ]?DON|LADING/, pl: /PACK|\bPL\b|DONG[-_ ]?GOI/, co: /\bCO\b|C[-_ ]O\b|ORIGIN|XUAT[-_ ]?XU|FORM[-_ ]?[A-Z]\b/, cq: /\bCQ\b|C[-_ ]Q\b|QUALITY|CHAT[-_ ]?LUONG/ };
    for (const k in byName) if (byName[k].test(fn)) score[k] += 6;
    let best = null, bs = 0;
    for (const k of ['hbl', 'pl', 'co', 'cq']) if (score[k] > bs) { bs = score[k]; best = k; }
    return bs >= 4 ? best : null;
  }

  const MON = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, SEPT: 9, OCT: 10, NOV: 11, DEC: 12 };
  const p2 = (n) => String(n).padStart(2, '0');
  function iso(y, m, d) {
    y = +y; m = +m; d = +d;
    if (y < 100) y += 2000;
    if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return '';
    return y + '-' + p2(m) + '-' + p2(d);
  }
  // tìm ngày đầu tiên trong chuỗi — dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd, 12 JAN 2026, JAN 12, 2026
  function findDate(s) {
    s = fold(s);
    let m = s.match(/\b(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})\b/);
    if (m) { const r = iso(m[1], m[2], m[3]); if (r) return r; }
    m = s.match(/\b(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})\b/);
    if (m) { const r = iso(m[3], m[2], m[1]); if (r) return r; }
    m = s.match(/\b(\d{1,2})(?:ST|ND|RD|TH)?[\s,.-]+([A-Z]{3,4})[A-Z]*\.?[\s,.-]+(\d{2,4})\b/);
    if (m && MON[m[2]]) { const r = iso(m[3], MON[m[2]], m[1]); if (r) return r; }
    m = s.match(/\b([A-Z]{3,4})[A-Z]*\.?\s+(\d{1,2})(?:ST|ND|RD|TH)?,?\s+(\d{4})\b/);
    if (m && MON[m[1]]) { const r = iso(m[3], MON[m[1]], m[2]); if (r) return r; }
    return '';
  }

  // Số chứng từ: ít nhất 4 ký tự, có chữ số, không phải ngày. OCR hay thêm dấu chấm/phẩy cuối → cắt.
  const TOKEN = '([A-Z0-9][A-Z0-9\\-\\/_.]{2,34})';
  function cleanNo(v) {
    v = String(v || '').replace(/[.,;:]+$/, '');
    if (!/\d/.test(v) || v.length < 4) return '';
    if (/^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}$/.test(v)) return '';   // là ngày
    return v;
  }
  function firstNo(t, labels) {
    for (const lb of labels) {
      const re = new RegExp('\\b' + lb + '\\s*(?:NO|NUMBER|NR|N0|SO)?\\.?\\s*[:#：.\\-]*\\s*' + TOKEN, 'g');
      let m;
      while ((m = re.exec(t))) { const v = cleanNo(m[1]); if (v) return v; re.lastIndex = m.index + 1; }   // lùi lại: đoạn vừa khớp có thể nuốt nhãn kế tiếp
    }
    return '';
  }

  const LABELS = {
    hbl: ['HOUSE\\s+B\\/?L', 'HBL', 'H\\.?B\\/L', 'B\\/L', 'BILL\\s+OF\\s+LADING', 'VAN\\s+DON'],
    pl:  ['PACKING\\s+LIST', 'P\\/L', 'PL', 'DANH\\s+MUC\\s+DONG\\s+GOI'],
    co:  ['REFERENCE', 'CERTIFICATE', 'C\\/O', 'REF\\.?', 'GIAY\\s+CHUNG\\s+NHAN'],
    cq:  ['CERTIFICATE', 'CERT\\.?', 'REPORT', 'QUALITY\\s+CERTIFICATE', 'C\\/Q'],
  };
  const COUNTRY = { CHINA: 'Trung Quốc', PRC: 'Trung Quốc', 'P.R. CHINA': 'Trung Quốc', 'PEOPLE\'S REPUBLIC OF CHINA': 'Trung Quốc', VIETNAM: 'Việt Nam', 'VIET NAM': 'Việt Nam', 'VIET NAM.': 'Việt Nam', GERMANY: 'Đức', JAPAN: 'Nhật Bản', KOREA: 'Hàn Quốc', 'SOUTH KOREA': 'Hàn Quốc', ITALY: 'Ý', FRANCE: 'Pháp', INDIA: 'Ấn Độ', THAILAND: 'Thái Lan', MALAYSIA: 'Malaysia', INDONESIA: 'Indonesia', TAIWAN: 'Đài Loan', SPAIN: 'Tây Ban Nha', FINLAND: 'Phần Lan', SWITZERLAND: 'Thụy Sỹ', USA: 'Hoa Kỳ', 'UNITED STATES': 'Hoa Kỳ', SINGAPORE: 'Singapore' };

  // Trích số + ngày (+ xuất xứ với C/O, số kiện với Packing List). type: 'co'|'cq'|'pl'|'hbl'
  function extract(type, text) {
    const t = fold(text).replace(/[ \t]+/g, ' ');
    const out = { so: '', ngay: '' };
    out.so = firstNo(t, LABELS[type] || []);
    // ngày: ưu tiên dòng có chữ DATE / NGAY, sau đó ngày đầu tiên trong văn bản
    // ưu tiên ngày PHÁT HÀNH (HBL còn có ngày xếp hàng), rồi mới tới nhãn DATE chung
    for (const re of [/(?:DATE\s+OF\s+ISSUE|DATE\s+OF\s+ISSUANCE|ISSUED?\s+(?:ON|DATE)|NGAY\s+(?:CAP|LAP))\s*[:：.\-]*\s*([^\n]{4,40})/,
                      /\bDATE\s*[:：.\-]*\s*([^\n]{4,40})/, /\bNGAY\s*[:：.\-]*\s*([^\n]{4,40})/]) {
      const dm = t.match(re);
      if (dm && findDate(dm[1])) { out.ngay = findDate(dm[1]); break; }
    }
    if (!out.ngay) out.ngay = findDate(t);
    if (type === 'co') {
      const cm = t.match(/(?:COUNTRY\s+OF\s+ORIGIN|MADE\s+IN|XUAT\s+XU)\s*[:：.\-]*\s*([A-Z][A-Z.' ]{2,40}?)(?:\n|\s{2,}|$|[,;])/);
      if (cm) {
        const k = cm[1].trim().replace(/\s+/g, ' ');
        out.xuatxu = COUNTRY[k] || COUNTRY[k.replace(/\.$/, '')] || '';
        if (!out.xuatxu) for (const c in COUNTRY) if (k.indexOf(c) === 0) { out.xuatxu = COUNTRY[c]; break; }
      }
    }
    if (type === 'pl') {
      const km = t.match(/(?:TOTAL|TTL)\s*[:：]?\s*(\d{1,4})\s*(?:PACKAGES?|PKGS?|CASES?|CTNS?|CARTONS?|CRATES?|PALLETS?|KIEN)\b/)
              || t.match(/(?:TOTAL\s+)?(?:PACKAGES?|PKGS?|CASES?|CTNS?|KIEN)\s*[:：]\s*(\d{1,4})\b/);
      if (km) out.kien = km[1];
    }
    return out;
  }

  const api = { LOAI, fold, detect, findDate, extract };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ChungTu = api;
})(typeof window !== 'undefined' ? window : globalThis);
