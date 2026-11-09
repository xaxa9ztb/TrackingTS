// Khảo sát Bracket hố thang (Z Bracket & Omega Bracket) — phần tính toán dùng chung cho trình duyệt và kiểm thử Node.
//
// Quy tắc đánh giá giống hệt công thức của "Phiếu khảo sát trước khi đặt hàng" (sheet Phieu_khao_sat, cột D/F),
// theo thứ tự ưu tiên:
//   1. Đạt: số đo trong [min, max] của bracket đã đặt hàng
//   2. Vượt max ≤ 10 mm  → Đệm bản mã 10mm (không cần đổi bracket)
//   3. Nhỏ hơn min ≤ 10 mm → Đục tỉa chân bracket (không cần đổi bracket)
//   4. Ngoài toàn bộ dải (Z: cả dòng AL/CL/CHL/CH đã đặt; Omega: cả danh mục) → KHÔNG PHÙ HỢP, chỉnh sửa hố thang
//   5. Còn lại → đề xuất bracket khác: bracket chứa số đo có dải hẹp nhất; không có thì bracket gần nhất
// Dung sai: J 45350713 Ae25 (Z Bracket Selection Rule, ES1 & ES5.0, SC-AP) và J 44928432 Ae29 (Omega, Family A & B).
// fillXlsx: điền phiếu vào mẫu Excel (bracket-template.xlsx) bằng cách sửa thẳng XML của sheet — giữ nguyên
// công thức, định dạng có điều kiện, danh sách chọn; Excel tự tính lại khi mở (fullCalcOnLoad).
(function (root) {
  'use strict';

  // [tên, SFmin, SFmax, dòng] — J 45350713 Ae25 (2026-10-24) mục 5.1, chỉ các loại có SC-AP ở ES1 hoặc ES5.0,
  // đúng thứ tự bảng gốc. Ae25 bỏ khỏi SC-AP so với danh mục cũ: Z-AL2, Z-AL3, Z-AL7, Z-AL9 (chỉ IN / LA / EU),
  // Z-CHL3, Z-CHL4, Z-CHL7 (chỉ IN / LA).
  const Z = [
    ['Z-AL11', 50, 90, 'AL'], ['Z-AL12', 55, 105, 'AL'], ['Z-AL4', 105, 200, 'AL'], ['Z-AL5', 150, 250, 'AL'], ['Z-AL6', 200, 325, 'AL'],
    ['Z-AL8', 310, 450, 'AL'],
    ['Z-CL1', 38, 82, 'CL'], ['Z-CL11', 50, 90, 'CL'], ['Z-CHL2', 52, 105, 'CHL'], ['Z-CL12', 55, 105, 'CL'], ['Z-CL3', 70, 155, 'CL'],
    ['Z-CL4', 105, 200, 'CL'], ['Z-CL5', 150, 250, 'CL'], ['Z-CL6', 200, 325, 'CL'], ['Z-CL7', 275, 360, 'CL'], ['Z-CL8', 310, 450, 'CL'],
    ['Z-CL9', 400, 550, 'CL'],
    ['Z-CH13', 38, 75, 'CH'], ['Z-CH1', 40, 87, 'CH'], ['Z-CH11', 50, 90, 'CH'], ['Z-CH2', 52, 105, 'CH'], ['Z-CH12', 55, 105, 'CH'],
    ['Z-CH3', 70, 155, 'CH'], ['Z-CH4', 105, 200, 'CH'], ['Z-CH5', 150, 250, 'CH'], ['Z-CH6', 200, 325, 'CH'], ['Z-CH7', 275, 360, 'CH'],
    ['Z-CH8', 310, 450, 'CH'], ['Z-CH9', 400, 550, 'CH'],
  ].map(([name, min, max, fam]) => ({ name, min, max, fam }));
  // [tên, SGmin, SGmax] — J 44928432 Ae29 mục 4.3, Family A & B, gộp mọi BG (SG giống nhau ở mọi BG, trừ ghi chú NOTE_O).
  // Tên giữ nguyên 2 dấu cách như trong file mẫu để khớp danh sách chọn của Excel.
  const O = [
    ['O-A1 / O-A2  106-1', 63, 123], ['O-A1 / O-A2  106-2', 83, 143], ['O-A1 / O-A2  106-3', 93, 173], ['O-A2  106-4', 123, 223],
    ['O-A2  106-5', 173, 305], ['O-A1 / O-A2  160-1', 95, 179], ['O-A2  160-2', 129, 209], ['O-A2  160-3', 159, 308],
    ['O-A2  160-4', 258, 500], ['O-A2  106-1 LH', 63, 123], ['O-B  106-1', 63, 125], ['O-B  106-2', 95, 162], ['O-B  106-3', 112, 205],
    ['O-B  106-4', 155, 305], ['O-B  160-1', 95, 177], ['O-B  160-2', 127, 242], ['O-B  160-3', 192, 310], ['O-B  160-4', 260, 440],
    ['O-B  160-5', 390, 500], ['O-B  190-1', 120, 200], ['O-B  190-2', 150, 265], ['O-B  190-3', 215, 305], ['O-B  190-4', 255, 440],
    ['O-B  190-5', 390, 500], ['O-B  106-1 LH', 63, 125],
  ].map(([name, min, max]) => ({ name, min, max }));
  // khác biệt theo BG cần lưu ý khi khảo sát (hiện ở app, không đổi dải dùng để đánh giá)
  const NOTE_O = { 'O-A1 / O-A2  160-1': 'BG = 850 mm: SGmin = 100 mm (các BG khác 95 mm)' };
  const SOURCE = 'J 45350713 Ae25 (Z Bracket, ES1 & ES5.0, SC-AP) · J 44928432 Ae29 (Omega, Family A & B)';
  const FAMILIES = ['AL', 'CL', 'CHL', 'CH'];
  const MAX_ROWS = 30;          // số dòng khảo sát của mẫu Excel (dòng 26–55)
  const TOL = 10;               // lệch ≤ 10 mm: xử lý tại công trường

  const findZ = (name) => Z.find((b) => b.name === name) || null;
  const findO = (name) => O.find((b) => b.name === name) || null;
  // số đo hợp lệ: số ≥ 0; ô trống / chữ → null
  function num(v) {
    if (v === null || v === undefined || String(v).trim() === '') return null;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  // Đề xuất bracket trong `list` cho số đo x (đã biết x nằm trong [min nhỏ nhất, max lớn nhất] của list)
  function suggest(list, x) {
    const hit = list.filter((b) => b.min <= x && b.max >= x);
    if (hit.length) {
      const w = Math.min(...hit.map((b) => b.max - b.min));
      return hit.find((b) => b.max - b.min === w);               // dải hẹp nhất, gặp trước trong danh mục
    }
    const above = list.filter((b) => b.min >= x), below = list.filter((b) => b.max <= x);
    const minAbove = above.length ? Math.min(...above.map((b) => b.min)) : null;
    const maxBelow = below.length ? Math.max(...below.map((b) => b.max)) : null;
    if (minAbove !== null && !(maxBelow !== null && minAbove - x > x - maxBelow)) return list.find((b) => b.min === minAbove);
    return list.find((b) => b.max === maxBelow) || null;
  }

  // Đánh giá một số đo → { text (giống ô Excel), status, flag, suggest }
  // status: ok | pad (đệm bản mã) | trim (đục tỉa) | change (đổi bracket) | pit (chỉnh sửa hố thang) | none (chưa chọn bracket)
  function evaluate(kind, value, orderedName) {
    const x = num(value);
    if (x === null) return { text: '', status: '', flag: '' };
    const ordered = kind === 'z' ? findZ(orderedName) : findO(orderedName);
    if (!ordered) return { text: kind === 'z' ? 'Chưa chọn loại Z Bracket' : 'Chưa chọn loại Omega Bracket', status: 'none', flag: '' };
    if (x >= ordered.min && x <= ordered.max) return { text: `Đạt (trong dung sai ${ordered.name})`, status: 'ok', flag: 1 };
    const lech = (d) => String(Math.round(d));
    if (x > ordered.max && x - ordered.max <= TOL) return { text: `Không đạt (lệch ${lech(x - ordered.max)}mm) - Đệm bản mã 10mm - không cần đổi bracket`, status: 'pad', flag: 0, dev: Math.round(x - ordered.max) };
    if (x < ordered.min && ordered.min - x <= TOL) return { text: `Không đạt (lệch ${lech(ordered.min - x)}mm) - Đục tỉa chân bracket - không cần đổi bracket`, status: 'trim', flag: 0, dev: Math.round(ordered.min - x) };
    const list = kind === 'z' ? Z.filter((b) => b.fam === ordered.fam) : O;
    const lo = Math.min(...list.map((b) => b.min)), hi = Math.max(...list.map((b) => b.max));
    if (x < lo || x > hi) {
      return { text: kind === 'z' ? `KHÔNG PHÙ HỢP - Vượt dung sai toàn bộ dòng ${ordered.fam}, cần chỉnh sửa hố thang` : 'KHÔNG PHÙ HỢP - Vượt dung sai toàn bộ bracket, cần chỉnh sửa hố thang', status: 'pit', flag: 0, fam: kind === 'z' ? ordered.fam : '' };
    }
    const s = suggest(list, x);
    return { text: `Không đạt - Đề xuất: ${s ? s.name : 'xem lại danh mục'}`, status: 'change', flag: 0, suggest: s ? s.name : '' };
  }

  // Kiểm tra SF2 / SG theo bản vẽ với bracket đã chọn (ô E17 / E18)
  function designCheck(kind, value, orderedName) {
    const x = num(value);
    if (x === null) return { text: '', ok: null };
    const b = kind === 'z' ? findZ(orderedName) : findO(orderedName);
    if (b && x >= b.min && x <= b.max) return { text: `Phù hợp với ${b.name}`, ok: true };
    return { text: 'KHÔNG phù hợp - kiểm tra lại bản vẽ / bracket', ok: false };
  }

  // Kết quả từng dòng + phần Kết luận (D58–D67)
  function compute(survey) {
    const s = survey || {};
    const rows = (Array.isArray(s.rows) ? s.rows : []).slice(0, MAX_ROWS).map((r) => ({
      ...r, z: evaluate('z', r.sf2, s.zBracket), o: evaluate('o', r.sg, s.oBracket),
    }));
    const has = (r, k) => num(r[k]) !== null;
    const zs = rows.filter((r) => has(r, 'sf2')), os = rows.filter((r) => has(r, 'sg'));
    const cnt = (list, side, pred) => list.filter((r) => pred(r[side])).length;
    const summary = {
      total: zs.length,                                                            // COUNTA(C26:C55)
      pass: rows.filter((r) => r.z.flag === 1 && r.o.flag === 1).length,
      zChange: cnt(zs, 'z', (e) => e.flag === 0),
      zSite: cnt(zs, 'z', (e) => e.status === 'pad' || e.status === 'trim'),
      zSwap: cnt(zs, 'z', (e) => e.status === 'change'),
      oChange: cnt(os, 'o', (e) => e.flag === 0),
      oSite: cnt(os, 'o', (e) => e.status === 'pad' || e.status === 'trim'),
      oSwap: cnt(os, 'o', (e) => e.status === 'change'),
      zPit: cnt(zs, 'z', (e) => e.status === 'pit'),
      oPit: cnt(os, 'o', (e) => e.status === 'pit'),
    };
    const zb = findZ(s.zBracket), ob = findO(s.oBracket);
    return {
      rows, summary, zb, ob,
      design: { z: designCheck('z', s.sf2Design, s.zBracket), o: designCheck('o', s.sgDesign, s.oBracket) },
    };
  }

  // ---------- Excel: sửa XML của mẫu ----------
  const xmlEsc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  // 'YYYY-MM-DD' → số ngày Excel
  function excelDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5) + 25569 : null;
  }
  // Ghi giá trị vào ô `ref` trong sheet XML, giữ kiểu định dạng (s=…). Ô công thức: chỉ thay kết quả lưu sẵn.
  function setCell(xml, ref, value) {
    const re = new RegExp(`<c r="${ref}"((?: [a-zA-Z:]+="[^"]*")*)\\s*(/>|>([\\s\\S]*?)</c>)`);
    const m = re.exec(xml);
    if (!m) return xml;
    const attrs = m[1].replace(/ t="[^"]*"/, '');
    const inner = m[3] || '';
    const f = /<f[ >][\s\S]*?<\/f>|<f[^>]*\/>/.exec(inner);
    let out;
    const empty = value === null || value === undefined || value === '';
    if (f) {                                                     // ô công thức: giữ công thức, cập nhật kết quả
      if (empty) out = `<c r="${ref}"${attrs} t="str">${f[0]}<v></v></c>`;
      else if (typeof value === 'number') out = `<c r="${ref}"${attrs} t="n">${f[0]}<v>${value}</v></c>`;
      else out = `<c r="${ref}"${attrs} t="str">${f[0]}<v>${xmlEsc(value)}</v></c>`;
    } else if (empty) out = `<c r="${ref}"${attrs}/>`;
    else if (typeof value === 'number') out = `<c r="${ref}"${attrs} t="n"><v>${value}</v></c>`;
    else out = `<c r="${ref}"${attrs} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(value)}</t></is></c>`;
    return xml.slice(0, m.index) + out + xml.slice(m.index + m[0].length);
  }

  // Ô của mẫu (sheet Phieu_khao_sat)
  const INFO_CELLS = { project: 'C5', location: 'C6', contract: 'C7', surveyor: 'C8', date: 'C9', liftId: 'C10', bs: 'C11', ts: 'C12', load: 'C13', stops: 'C14' };
  const NUM_FIELDS = ['bs', 'ts', 'load', 'stops'];
  const ROW0 = 26;

  // Ghi toàn bộ phiếu vào XML của sheet → XML mới
  function fillSheetXml(xml, survey) {
    const s = survey || {};
    const c = compute(s);
    let x = xml;
    for (const [k, ref] of Object.entries(INFO_CELLS)) {
      let v = s[k];
      if (k === 'date') v = excelDate(v);
      else if (NUM_FIELDS.includes(k)) v = num(v) === null ? (String(v || '').trim() || null) : num(v);
      else v = String(v || '').trim();
      x = setCell(x, ref, v);
    }
    x = setCell(x, 'C17', num(s.sf2Design));
    x = setCell(x, 'C18', num(s.sgDesign));
    x = setCell(x, 'C19', c.zb ? c.zb.name : '');
    x = setCell(x, 'C20', c.ob ? c.ob.name : '');
    x = setCell(x, 'E17', c.design.z.text);
    x = setCell(x, 'E18', c.design.o.text);
    x = setCell(x, 'E19', c.zb ? c.zb.min : '');
    x = setCell(x, 'F19', c.zb ? c.zb.max : '');
    x = setCell(x, 'G19', c.zb ? c.zb.fam : '');
    x = setCell(x, 'E20', c.ob ? c.ob.min : '');
    x = setCell(x, 'F20', c.ob ? c.ob.max : '');
    for (let i = 0; i < MAX_ROWS; i++) {
      const r = c.rows[i] || { line: '', sf2: '', sg: '', z: { text: '', flag: '' }, o: { text: '', flag: '' } };
      const n = ROW0 + i;
      x = setCell(x, `B${n}`, String(r.line || '').trim());
      x = setCell(x, `C${n}`, num(r.sf2));
      x = setCell(x, `E${n}`, num(r.sg));
      x = setCell(x, `D${n}`, r.z.text);
      x = setCell(x, `F${n}`, r.o.text);
      x = setCell(x, `G${n}`, r.z.flag === '' ? '' : r.z.flag);
      x = setCell(x, `H${n}`, r.o.flag === '' ? '' : r.o.flag);
    }
    const S = c.summary;
    [['D58', S.total], ['D59', S.pass], ['D60', S.zChange], ['D61', S.zSite], ['D62', S.zSwap], ['D63', S.oChange],
      ['D64', S.oSite], ['D65', S.oSwap], ['D66', S.zPit], ['D67', S.oPit]].forEach(([ref, v]) => { x = setCell(x, ref, v); });
    return x;
  }

  // JSZip + ArrayBuffer của mẫu → Uint8Array của file đã điền
  async function fillXlsx(JSZip, templateBuf, survey) {
    const zip = await JSZip.loadAsync(templateBuf);
    const wbXml = await zip.file('xl/workbook.xml').async('string');
    const rels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
    const sheet = /<sheet [^>]*name="Phieu_khao_sat"[^>]*r:id="([^"]+)"/.exec(wbXml) || /<sheet [^>]*r:id="([^"]+)"/.exec(wbXml);
    const target = new RegExp(`Id="${sheet[1]}"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="${sheet[1]}"`).exec(rels);
    const path = 'xl/' + String(target[1] || target[2]).replace(/^\/?xl\//, '');
    const xml = await zip.file(path).async('string');
    zip.file(path, fillSheetXml(xml, survey));
    // Excel tính lại mọi công thức khi mở (kết quả lưu sẵn đã đúng cho trình xem không tính công thức)
    zip.file('xl/workbook.xml', /<calcPr\b/.test(wbXml)
      ? wbXml.replace(/<calcPr\b([^>]*?)(\/?)>/, (m0, a, sl) => `<calcPr${a.replace(/ fullCalcOnLoad="[^"]*"/, '')} fullCalcOnLoad="1"${sl}>`)
      : wbXml.replace('</workbook>', '<calcPr fullCalcOnLoad="1"/></workbook>'));
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  }

  const plain = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const fileName = (s) => `Khao_sat_bracket_${[plain(s && s.project), plain(s && s.liftId)].filter(Boolean).join('_') || 'phieu'}.xlsx`;

  const api = { Z, O, NOTE_O, SOURCE, FAMILIES, MAX_ROWS, TOL, findZ, findO, num, evaluate, designCheck, compute, setCell, fillSheetXml, fillXlsx, excelDate, fileName, INFO_CELLS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Bracket = api;
})(typeof window !== 'undefined' ? window : globalThis);
