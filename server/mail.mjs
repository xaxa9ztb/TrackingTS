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
// attachments: [{ name, content (base64) }] — Brevo nhận tệp đính kèm dạng base64 (tối đa ~4 MB tổng)
export async function sendMail(env, { to, cc = [], subject, html, attachments = [] }) {
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
  let toList = clean(to), ccList = clean(cc).filter(c => !toList.some(t => t.email === c.email));
  if (!toList.length) return { ok: false, skipped: true, error: 'Không có người nhận hợp lệ' };
  if (env.DEMO) {
    const d = await demoMail(env, toList, ccList, subject, html);
    if (!d.ok) return d;
    ({ subject, html } = d); toList = d.to; ccList = [];
  }
  const payload = {
    sender: { email: String(env.MAIL_FROM).trim(), name: senderName(env) },
    to: toList, subject: String(subject).slice(0, 250),
    htmlContent: html + `<p style="color:#6b7280;font-size:12px;margin-top:20px;font-family:Arial,Helvetica,sans-serif">Thư tự động từ ${esc(senderName(env))}. Vui lòng không trả lời thư này.</p>`,
  };
  if (ccList.length) payload.cc = ccList;
  if (attachments.length) payload.attachment = attachments.map(a => ({ name: String(a.name), content: String(a.content) }));
  return postBrevo(env, payload);
}

const footer = (env) => `<p style="color:#6b7280;font-size:12px;margin-top:20px;font-family:Arial,Helvetica,sans-serif">Thư tự động từ ${esc(senderName(env))}. Vui lòng không trả lời thư này.</p>`;

// Nhiều thư riêng (mỗi người một nội dung) trong MỘT lần gọi Brevo (messageVersions, tối đa 100 thư / lần gọi) —
// cho thư nhắc gửi nhiều người mà cron gói miễn phí giới hạn số lượt gọi ra ngoài. items: [{ to: {email, name}, subject, html }]
// Trả về { sent, failed, errors }. Demo: chỉ gửi vài thư đầu về người thử (như sendMail).
export async function sendMailBatch(env, items) {
  const out = { sent: 0, failed: 0, errors: [] };
  if (!mailConfigured(env)) { out.errors.push('Chưa cấu hình gửi email'); return out; }
  const list = (items || []).filter(it => it && it.to && EMAIL_RE.test(String(it.to.email || '').trim()));
  if (env.DEMO) {
    for (const it of list.slice(0, 3)) { const r = await sendMail(env, { to: [it.to], subject: it.subject, html: it.html }); if (r.ok) out.sent++; else { out.failed++; out.errors.push(r.error); } }
    return out;
  }
  for (let i = 0; i < list.length; i += 100) {
    const part = list.slice(i, i + 100);
    const version = (it) => ({ to: [it.to.name ? { email: String(it.to.email).trim().toLowerCase(), name: String(it.to.name).slice(0, 100) } : { email: String(it.to.email).trim().toLowerCase() }],
      subject: String(it.subject).slice(0, 250), htmlContent: it.html + footer(env) });
    const first = version(part[0]);
    const r = await postBrevo(env, { sender: { email: String(env.MAIL_FROM).trim(), name: senderName(env) }, subject: first.subject, htmlContent: first.htmlContent,
      messageVersions: part.map(version) });
    if (r.ok) out.sent += part.length; else { out.failed += part.length; out.errors.push(r.error); }
  }
  return out;
}

async function postBrevo(env, payload) {
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

// ---------- chế độ demo ----------
// Mọi thư chỉ tới email của người đang thử (env.DEMO_EMAIL); tiêu đề có [DEMO], đầu thư ghi rõ đây là thư demo
// và trong hệ thống thật thư sẽ gửi tới ai. Giới hạn số thư demo mỗi ngày để không dùng hết hạn mức Brevo của thư thật.
export const DEMO_MAILS_PER_DAY = 60;
async function demoMail(env, toList, ccList, subject, html) {
  const me = String(env.DEMO_EMAIL || '').trim().toLowerCase();
  if (!EMAIL_RE.test(me)) return { ok: false, skipped: true, error: 'Demo: không rõ email người đang thử' };
  const day = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
  try {
    const row = await env.DB.prepare('SELECT COUNT(*) n FROM mail_log WHERE key LIKE ?').bind(`demoq:${day}:%`).first();
    if (row && row.n >= DEMO_MAILS_PER_DAY) return { ok: false, skipped: true, error: `Demo: đã gửi đủ ${DEMO_MAILS_PER_DAY} thư hôm nay` };
    await env.DB.prepare('INSERT OR IGNORE INTO mail_log (key, sent_at) VALUES (?, ?)').bind(`demoq:${day}:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, new Date().toISOString()).run();
  } catch (e) { /* không đếm được thì vẫn gửi */ }
  const who = (list) => list.map(p => p.email === me ? (p.name ? `${p.name} — vai bạn đang đóng` : 'bạn') : (p.name || (/@demo\.invalid$/.test(p.email) ? 'nhân viên mẫu' : p.email))).join(', ');
  const real = who(toList) + (ccList.length ? ` (CC: ${who(ccList)})` : '');
  const banner = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;background:#fef3c7;border:2px solid #f59e0b;color:#78350f;border-radius:8px;padding:10px 12px;margin:0 0 14px">
<b>🧪 THƯ DEMO — chế độ chạy thử.</b> Đây là dữ liệu mẫu, không phải bảng công thật; không cần xử lý.<br>
Trong hệ thống thật, thư này sẽ gửi tới: <b>${esc(real)}</b>. Ở chế độ demo, mọi thư chỉ gửi về email của bạn.</div>`;
  return { ok: true, to: [{ email: me }], subject: '[DEMO] ' + String(subject), html: banner + html };
}

// Khung thư HTML đơn giản (hiển thị tốt trên điện thoại)
export function layout(title, bodyHtml, cta) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;max-width:640px">
<h2 style="font-size:17px;margin:0 0 10px">${esc(title)}</h2>${bodyHtml}
${cta && cta.url ? `<p style="margin:18px 0"><a href="${esc(cta.url)}" style="background:#1d4ed8;color:#fff;text-decoration:none;padding:9px 16px;border-radius:6px;display:inline-block">${esc(cta.label)}</a></p>` : ''}</div>`;
}
