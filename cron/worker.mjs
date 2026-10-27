// Worker chạy theo lịch (Cloudflare Cron Triggers) — Pages Functions không có lịch riêng nên tách ra đây.
// Dùng chung D1 và mã soạn thư với API (server/notify.mjs). Không mở địa chỉ web nào.
//   18:30 giờ Việt Nam (11:30 UTC): báo cáo thi công trong ngày gửi Site Sup / Quản lý dự án
//   08:00 giờ Việt Nam (01:00 UTC): nhắc hạn nộp bảng công (ngày 9 và 11 hằng tháng)
import { runDigest, runReminders } from '../server/notify.mjs';

export default {
  async scheduled(event, env) {
    const r = event.cron === '30 11 * * *' ? await runDigest(env) : event.cron === '0 1 * * *' ? await runReminders(env) : null;
    console.log(JSON.stringify({ cron: event.cron, result: r }));
  },
};
