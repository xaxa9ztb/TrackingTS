// Gửi email qua Brevo (gói miễn phí 300 thư / ngày). Không bao giờ ném lỗi: thư lỗi không được làm hỏng việc chính (nộp / duyệt bảng công).
// Cấu hình: BREVO_API_KEY (khoá API), MAIL_FROM (địa chỉ đã xác minh ở Brevo), MAIL_FROM_NAME (tên hiển thị).
// env.MAIL_FETCH chỉ dùng khi kiểm thử (thay cho fetch thật).

const API = 'https://api.brevo.com/v3/smtp/email';
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const senderName = (env) => String((env && env.MAIL_FROM_NAME) || 'Bộ công cụ dự án').trim().slice(0, 100) || 'Bộ công cụ dự án';

export function mailConfigured(env) {
  return !!(env && String(env.BREVO_API_KEY || '').trim() && EMAIL_RE.test(String(env.MAIL_FROM || '').trim()));
}

// to / cc: [{ email, name? }]; trả về { ok, error?, skipped? }
export async function sendMail(env, { to, cc = [], subject, html }) {
  if (!mailConfigured(env)) return { ok: false, skipped: true, error: 'Chưa cấu hình gửi email (BREVO_API_KEY, MAIL_FROM)' };
  const clean = (list) => {
    const seen = new Set(), out = [];
    for (const p of list || []) {
      const email = String(p && p.email || '').trim().toLowerCase();
      if (!EMAIL_RE.test(email) || seen.has(email)) continue;
      seen.add(email); out.push(p.name ? { email, name: String(p.name).slice(0, 100) } : { email });
    }
    return out;
  };
  const toList = clean(to), ccList = clean(cc).filter(c => !toList.some(t => t.email === c.email));
  if (!toList.length) return { ok: false, skipped: true, error: 'Không có người nhận hợp lệ' };
  const payload = {
    sender: { email: String(env.MAIL_FROM).trim(), name: senderName(env) },
    to: toList, subject: String(subject).slice(0, 250),
    htmlContent: html + `<p style="color:#6b7280;font-size:12px;margin-top:20px;font-family:Arial,Helvetica,sans-serif">Thư tự động từ ${esc(senderName(env))}. Vui lòng không trả lời thư này.</p>`,
  };
  if (ccList.length) payload.cc = ccList;
  const doFetch = env.MAIL_FETCH || fetch;
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), 8000) : null;
  try {
    const resp = await doFetch(API, {
      method: 'POST', signal: ctl ? ctl.signal : undefined,
      headers: { 'api-key': String(env.BREVO_API_KEY).trim(), 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    if (resp.ok) return { ok: true };
    let detail = '';
    try { const j = await resp.json(); detail = j.message || j.code || ''; } catch (e) { /* không phải JSON */ }
    return { ok: false, error: `Brevo báo lỗi HTTP ${resp.status}${detail ? ': ' + detail : ''}` };
  } catch (e) {
    return { ok: false, error: e && e.name === 'AbortError' ? 'Brevo không phản hồi (quá 8 giây)' : 'Không kết nối được Brevo' };
  } finally { if (timer) clearTimeout(timer); }
}

// Khung thư HTML đơn giản (hiển thị tốt trên điện thoại)
export function layout(title, bodyHtml, cta) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;max-width:640px">
<h2 style="font-size:17px;margin:0 0 10px">${esc(title)}</h2>${bodyHtml}
${cta && cta.url ? `<p style="margin:18px 0"><a href="${esc(cta.url)}" style="background:#1d4ed8;color:#fff;text-decoration:none;padding:9px 16px;border-radius:6px;display:inline-block">${esc(cta.label)}</a></p>` : ''}</div>`;
}
