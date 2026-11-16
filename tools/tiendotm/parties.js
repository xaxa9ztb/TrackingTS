// Hồ sơ Dự án — nhận diện các bên trong hợp đồng (Chủ đầu tư / Nhà thầu) từ chữ đã quét / đọc.
// Chủ đầu tư = Bên Mua / Bên Giao thầu / Bên A / Bên Đặt hàng / Bên Thuê; Nhà thầu = Bên Bán / Bên Nhận thầu / Bên B / Nhà cung cấp.
// Hỗ trợ 2 bố cục hợp đồng VN:
//   A) nhãn ĐẦU khối:  "BÊN GIAO THẦU (gọi tắt là Bên A): CÔNG TY …"  rồi các dòng địa chỉ, đại diện…
//   B) chi tiết TRƯỚC, cuối khối mới ghi:  "… (dưới đây gọi là “Bên Mua”)"
// Hàm thuần — kiểm thử bằng Node: test/client/parties.test.mjs
(function (root) {
  'use strict';
  const MAP = (() => { const g = { a: 'àáảãạăằắẳẵặâầấẩẫậ', e: 'èéẻẽẹêềếểễệ', i: 'ìíỉĩị', o: 'òóỏõọôồốổỗộơờớởỡợ', u: 'ùúủũụưừứửữự', y: 'ỳýỷỹỵ', d: 'đ' }; const m = {}; for (const b in g) for (const c of g[b]) m[c] = b; return m; })();
  // bỏ dấu + chữ thường, GIỮ NGUYÊN độ dài & vị trí ký tự (để cắt chuỗi gốc theo index)
  function deacc(s) { let o = ''; for (let i = 0; i < s.length; i++) { const lc = s[i].toLowerCase(); o += (lc.length === 1 ? (MAP[lc] || lc) : s[i]); } return o; }

  // vai trò (trên chữ không dấu)
  const OWNER = String.raw`(?:ben\s*mua|ben\s*giao\s*thau|ben\s*dat\s*hang|ben\s*thue|ben\s*a|chu\s*dau\s*tu)`;
  const CONTRACTOR = String.raw`(?:ben\s*ban|ben\s*nhan\s*thau|ben\s*cung\s*cap|ben\s*b|nha\s*thau(?:\s*thi\s*cong)?|nha\s*cung\s*cap)`;
  // nhãn đầu dòng: "BÊN MUA:", "BÊN GIAO THẦU (gọi tắt là Bên A):", "1. Bên A -", "A. CHỦ ĐẦU TƯ:"
  const head = (role) => new RegExp(String.raw`(?:^|\n)[ \t]*(?:[0-9ivx]{1,3}[.)]|[ab][.)]|[-•*])?[ \t]*${role}\b[ \t]*(?:\([^)\n]{0,60}\))?[ \t]*[:\-–]`, 'g');
  // cụm "gọi (tắt) là Bên Mua" — bố cục B
  const call = (role) => new RegExp(String.raw`(?:duoi\s*day\s*|sau\s*day\s*)?(?:duoc\s*)?goi\s*(?:tat\s*)?la[\s"'“”)(]*${role}\b`, 'g');
  const isHeadLine = (P, idx) => { const ls = P.lastIndexOf('\n', idx) + 1; return new RegExp(String.raw`^[ \t]*(?:[0-9ivx]{1,3}[.)]|[ab][.)]|[-•*])?[ \t]*(?:${OWNER}|${CONTRACTOR})\b`).test(P.slice(ls, idx)); };
  const first = (re, P, from) => { re.lastIndex = from || 0; const m = re.exec(P); return m ? m.index : -1; };

  // → { owner: {s, e} | null, contractor: {s, e} | null, style: 'A' | 'B' | '' }
  function blocks(R) {
    const P = deacc(R);
    // phần đầu hợp đồng (trước điều 1) — các bên luôn nằm ở đây; tránh bắt nhầm "chủ đầu tư" ở các điều khoản phía sau
    let lim = first(/(?:^|\n)[ \t]*dieu\s*(?:1|i)\b[ \t]*[:.\-–]/g, P, 200);
    if (lim < 0 || lim < 300) lim = Math.min(P.length, 6000);
    const top = P.slice(0, lim);
    // bố cục B: cụm "gọi là Bên …" KHÔNG nằm trên dòng nhãn
    const callAt = (role) => { const re = call(role); let m; re.lastIndex = 0; while ((m = re.exec(top))) if (!isHeadLine(top, m.index)) return m; return null; };
    const cO = callAt(OWNER), cC = callAt(CONTRACTOR);
    if (cO || cC) {
      const out = { owner: null, contractor: null, style: 'B' };
      const giua = /\b(?:giua|gom)\s*:?/g;
      if (cO) { let g, gs = -1; giua.lastIndex = 0; while ((g = giua.exec(top))) { if (g.index < cO.index) gs = g.index + g[0].length; else break; } out.owner = { s: gs >= 0 ? gs : Math.max(0, cO.index - 750), e: cO.index }; }
      if (cC) { const s = cO && cO.index < cC.index ? cO.index + cO[0].length : Math.max(0, cC.index - 750); out.contractor = { s, e: cC.index }; }
      return out;
    }
    // bố cục A: nhãn đầu dòng
    const iO = first(head(OWNER), top), iC = first(head(CONTRACTOR), top);
    if (iO < 0 && iC < 0) return { owner: null, contractor: null, style: '' };
    const end = (a, b) => (b > a ? b : Math.min(top.length, a + 900));
    return { owner: iO >= 0 ? { s: iO, e: end(iO, iC) } : null, contractor: iC >= 0 ? { s: iC, e: end(iC, iO) } : null, style: 'A' };
  }

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').replace(/^[\s:.\-–"'“”]+|[\s.;,"'“”]+$/g, '').trim();
  // bỏ đuôi "(sau đây gọi là Bên A)", "(Bên A)", mã số thuế… ở cuối tên
  const tidy = (s) => clean(String(s || '').replace(/\s*\((?:[^)]*(?:goi|gọi|bên|ben|party)[^)]*)\)\s*$/i, '').replace(/\s*[,;]\s*(?:mã số thuế|mst|địa chỉ).*$/i, ''));
  const SKIP = /^(dia\s*chi|dien\s*thoai|so\s*dien|ma\s*so|masothue|mst|email|fax|tai\s*khoan|so\s*tai|dai\s*dien|chuc\s*vu|va$|so\s*[:\-]|ngan\s*hang|giay\s*(?:chung\s*nhan|uy\s*quyen)|theo\s*giay)/;
  function pick(R, P, blk, res) {
    if (!blk) return null;
    const t = R.slice(blk.s, blk.e), p = P.slice(blk.s, blk.e);
    for (const re of res) { re.lastIndex = 0; const m = re.exec(p); if (m && m.indices && m.indices[1]) { const v = tidy(t.slice(m.indices[1][0], m.indices[1][1])); if (v && v.length >= 3 && !new RegExp(`^${OWNER}$|^${CONTRACTOR}$`).test(deacc(v))) return v; } }
    return null;
  }
  function firstLine(R, P, blk, skipFirst) {
    if (!blk) return null;
    const ls = R.slice(blk.s, blk.e).split('\n'), lp = P.slice(blk.s, blk.e).split('\n');
    for (let i = skipFirst ? 1 : 0; i < ls.length; i++) {
      const ln = ls[i].trim(), d = lp[i].trim();
      if (ln.length < 5 || SKIP.test(d) || /^["'“”(]/.test(ln)) continue;
      return tidy(ln);
    }
    return null;
  }
  const ORG = String.raw`(?:chi\s*nhanh\s*)?(?:cong\s*ty|tong\s*cong\s*ty|ban\s*quan\s*ly|ban\s*qlda|uy\s*ban|trung\s*tam|doanh\s*nghiep|hop\s*tac\s*xa|benh\s*vien|truong|so\s|bo\s|tap\s*doan|ngan\s*hang)`;

  // → { owner: { name, rep, addr }, contractor: { name }, style }
  function parse(raw) {
    const R = String(raw || '').normalize('NFC'), P = deacc(R), b = blocks(R);
    const ownerRes = [
      new RegExp(String.raw`${OWNER}[ \t]*(?:\([^)\n]{0,60}\))?[ \t]*[:\-–][ \t]*([^\n]{4,120})`, 'd'),
      /(?:ten(?:\s*(?:cong\s*ty|khach\s*hang|don\s*vi|to\s*chuc|chu\s*dau\s*tu))?|don\s*vi(?:\s*mua)?)\s*[:\-]\s*([^\n]{3,120})/d,
      new RegExp(String.raw`(?:^|\n)\s*(${ORG}[^\n]{2,110})`, 'd'),
    ];
    const conRes = [
      new RegExp(String.raw`${CONTRACTOR}[ \t]*(?:\([^)\n]{0,60}\))?[ \t]*[:\-–][ \t]*([^\n]{4,120})`, 'd'),
      /(?:ten(?:\s*(?:cong\s*ty|don\s*vi|nha\s*thau))?|don\s*vi\s*ban)\s*[:\-]\s*([^\n]{3,120})/d,
      new RegExp(String.raw`(?:^|\n)\s*(${ORG}[^\n]{2,110})`, 'd'),
    ];
    let owner = pick(R, P, b.owner, ownerRes) || firstLine(R, P, b.owner, b.style === 'A');
    let con = pick(R, P, b.contractor, conRes) || firstLine(R, P, b.contractor, b.style === 'A');
    // Chủ đầu tư không bao giờ là Schindler — nếu bắt nhầm (đảo khối) thì đổi chỗ
    if (owner && /schindler/i.test(owner) && (!con || !/schindler/i.test(con))) { const t = owner; owner = con && !/schindler/i.test(con) ? con : null; con = t; }
    const ob = b.owner ? { t: R.slice(b.owner.s, b.owner.e), p: P.slice(b.owner.s, b.owner.e) } : null;
    const inO = (re) => { if (!ob) return null; re.lastIndex = 0; const m = re.exec(ob.p); return m && m.indices && m.indices[1] ? clean(ob.t.slice(m.indices[1][0], m.indices[1][1])) : null; };
    let rep = inO(/(?:nguoi\s*)?dai\s*dien(?:\s*(?:theo\s*phap\s*luat|boi|la))?\s*[:\-]?\s*(?:ong|ba|mr|ms|mrs)?\.?\s*([a-z][^\n,;(]{2,45})/d);
    if (rep) rep = rep.replace(/\s*[-–].*$/, '').replace(/\s*(?:chuc\s*vu|chức\s*vụ).*$/i, '').trim();
    const addr = inO(/(?:dia\s*chi|tru\s*so(?:\s*chinh)?)\s*[:\-]?\s*([^\n]{5,140})/d);
    return { owner: { name: owner || null, rep: rep || null, addr: addr || null }, contractor: { name: con || null }, style: b.style };
  }

  const api = { deacc, blocks, parse };
  root.HsParties = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
