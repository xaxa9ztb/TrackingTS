// Xác thực người dùng qua Cloudflare Access.
// Access đứng trước trang: chỉ email trong danh sách được phép mới qua được, và mỗi yêu cầu tới
// máy chủ mang theo một JWT (header Cf-Access-Jwt-Assertion) do Access ký. Máy chủ KHÔNG tin
// header này một cách mù quáng: kiểm tra chữ ký (khoá công khai của team), aud, iss, hạn dùng.

const KEY_TTL_MS = 10 * 60 * 1000;
let keyCache = { url: '', at: 0, keys: [] };
const keyObjects = new Map();

// "trackingts-team" | "trackingts-team.cloudflareaccess.com" | "https://…" → "trackingts-team.cloudflareaccess.com"
export function teamHost(teamDomain) {
  const t = String(teamDomain || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (!t) return '';
  return t.includes('.') ? t : `${t}.cloudflareaccess.com`;
}

function b64urlBytes(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const b64urlJson = (s) => JSON.parse(new TextDecoder().decode(b64urlBytes(s)));

async function fetchKeys(host, force) {
  const url = `https://${host}/cdn-cgi/access/certs`;
  if (!force && keyCache.url === url && Date.now() - keyCache.at < KEY_TTL_MS) return keyCache.keys;
  const resp = await fetch(url);
  if (!resp.ok) throw new AuthError(503, 'Không tải được khoá xác thực của Cloudflare Access');
  const j = await resp.json();
  keyCache = { url, at: Date.now(), keys: Array.isArray(j.keys) ? j.keys : [] };
  return keyCache.keys;
}

export class AuthError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Trả về { email } nếu hợp lệ, ném AuthError nếu không.
// opts.getKeys(force) — chỉ dùng trong kiểm thử để thay nguồn khoá.
export async function verifyAccessJwt(token, env, opts = {}) {
  const host = teamHost(env.ACCESS_TEAM_DOMAIN);
  const aud = String(env.ACCESS_AUD || '').trim();
  if (!host || !aud) throw new AuthError(503, 'Máy chủ chưa cấu hình đăng nhập (ACCESS_TEAM_DOMAIN / ACCESS_AUD)');
  if (!token) throw new AuthError(401, 'Chưa đăng nhập');

  const parts = String(token).split('.');
  if (parts.length !== 3) throw new AuthError(401, 'Phiên đăng nhập không hợp lệ');
  let header, payload;
  try { header = b64urlJson(parts[0]); payload = b64urlJson(parts[1]); }
  catch (e) { throw new AuthError(401, 'Phiên đăng nhập không hợp lệ'); }
  if (header.alg !== 'RS256') throw new AuthError(401, 'Phiên đăng nhập không hợp lệ');

  const getKeys = opts.getKeys || ((force) => fetchKeys(host, force));
  let jwk = (await getKeys(false)).find(k => k.kid === header.kid);
  if (!jwk) jwk = (await getKeys(true)).find(k => k.kid === header.kid); // khoá vừa được xoay vòng
  if (!jwk) throw new AuthError(401, 'Phiên đăng nhập không hợp lệ');

  // Nạp khoá một lần cho mỗi khoá công khai (tiết kiệm thời gian xử lý mỗi yêu cầu — gói miễn phí giới hạn ~10 ms CPU)
  const fp = jwk.kid + '|' + jwk.n;
  let key = keyObjects.get(fp);
  if (!key) {
    key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    if (keyObjects.size > 20) keyObjects.clear();
    keyObjects.set(fp, key);
  }
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(parts[2]),
    new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!ok) throw new AuthError(401, 'Phiên đăng nhập không hợp lệ');

  const now = Math.floor(Date.now() / 1000);
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(aud)) throw new AuthError(401, 'Phiên đăng nhập không dành cho ứng dụng này');
  if (payload.iss !== `https://${host}`) throw new AuthError(401, 'Phiên đăng nhập không hợp lệ');
  if (typeof payload.exp !== 'number' || payload.exp < now - 60) throw new AuthError(401, 'Phiên đăng nhập đã hết hạn — tải lại trang để đăng nhập lại');
  if (typeof payload.nbf === 'number' && payload.nbf > now + 60) throw new AuthError(401, 'Phiên đăng nhập không hợp lệ');
  const email = String(payload.email || '').trim().toLowerCase();
  if (!email) throw new AuthError(401, 'Phiên đăng nhập không có email');
  return { email };
}
