// Quản lý dự án — mô hình dữ liệu + nhập / xuất Excel (theo file "Quản lý Lắp đặt NI" đang dùng).
//
// File Excel gồm 2 sheet:
//   "Nhân sự" — Fitter allocation: mỗi dòng một fitter, mỗi cột một ngày; tên dự án ghi trong ô và kéo dài
//               bằng ô gộp (merge) HOẶC tô cùng màu (tên có thể nằm giữa đoạn tô màu). Ô màu xám = dự kiến.
//   "Plan"    — Lịch trình dự án (bảng Excel): thông số thang, hàng về, bàn giao hố, lắp đặt, nhân sự, giám sát.
//               Cột ngày có thể là ngày thật, chữ "25.10.2026", hoặc trạng thái ("xong", "đã về", "chưa có"…).
//
// Nhập: dùng SheetJS (js/xlsx.full.min.js) — ExcelJS lỗi khi đọc file có bảng Excel (ListObject).
// Xuất: dùng ExcelJS (ghi được màu, ô gộp, độ rộng cột) — tái tạo đúng 2 sheet trên để vẫn dùng Excel như cũ.
// File JS thuần: chạy trong trình duyệt (window.PMIO) và Node (kiểm thử).
(function (root) {
    'use strict';

    // ---------------- tiện ích ----------------
    const pad = (n) => String(n).padStart(2, '0');
    const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
    const isISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
    // Số ngày Excel ↔ 'YYYY-MM-DD' — tính theo UTC (không phụ thuộc múi giờ máy, tránh lệch 1 ngày)
    const serialToISO = (n) => { const d = new Date(Math.round((Math.floor(n) - 25569) * 864e5)); return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); };
    const isoToUTCDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
    const addDays = (s, n) => { const d = isoToUTCDate(s); d.setUTCDate(d.getUTCDate() + n); return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); };
    const daysBetween = (a, b) => { const out = []; for (let d = a; d <= b; d = addDays(d, 1)) out.push(d); return out; };
    const validDate = (y, m, d) => { if (m < 1 || m > 12 || d < 1 || d > 31) return false; const t = isoToUTCDate(iso(y, m, d)); return t.getUTCMonth() === m - 1 && t.getUTCDate() === d; };
    const fmtVN = (s) => (isISO(s) ? s.split('-').reverse().join('/') : '');
    const plain = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, ' ').trim();
    let seq = 0;
    const uid = (p) => p + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 5);

    // ---------------- mô hình ----------------
    // Mốc tiến độ: { date: 'YYYY-MM-DD' | '', done: bool, note: '' , check?: 'YYYY-MM-DD' (gợi ý khi ngày có thể nhập nhầm định dạng) }
    const MILESTONES = [
        { key: 'factory', label: 'Xuất xưởng đã xác nhận', short: 'Xuất xưởng' },
        { key: 'port', label: 'Về đến cảng', short: 'Về cảng' },
        { key: 'arrival', label: 'Thời gian hàng về dự kiến', short: 'Hàng về' },
        { key: 'shaftReady', label: 'Thời gian XD bàn giao hố', short: 'XD giao hố' },
        { key: 'ownerStart', label: 'Thời gian Chủ nhà yêu cầu lắp đặt', short: 'CĐT yêu cầu lắp' },
        { key: 'teamStart', label: 'Kế hoạch Team nhận hố', short: 'Team nhận hố' },
        { key: 'handover', label: 'Kế hoạch bàn giao (nếu có)', short: 'Bàn giao' },
    ];
    // Cột sheet "Plan" theo đúng thứ tự file gốc (khớp theo tên cột khi nhập, nên đổi thứ tự cột vẫn đọc được)
    const PLAN_COLUMNS = [
        { h: 'STT', w: 6 },
        { h: 'Tên Dự án', k: 'name', w: 22 },
        { h: 'Địa chỉ dự án', k: 'address', w: 26 },
        { h: 'Dự án tỉnh', k: 'province', t: 'yesno', w: 10 },
        { h: 'Số lượng thang', k: 'liftCount', t: 'num', w: 9 },
        { h: 'Loại thang', k: 'liftType', w: 10 },
        { h: 'Hành trình', k: 'travel', w: 10 },
        { h: 'Tải trọng', k: 'load', w: 10 },
        { h: 'Số điểm dừng', k: 'stops', t: 'num', w: 8 },
        { h: 'Xuất xưởng đã xác nhận', k: 'factory', t: 'ms', w: 13 },
        { h: 'PT vận chuyển', k: 'transport', w: 14 },
        { h: 'Về đến cảng', k: 'port', t: 'ms', w: 13 },
        { h: 'Thời gian hàng về dự kiến', k: 'arrival', t: 'ms', w: 15 },
        { h: 'Thời gian XD bàn giao hố', k: 'shaftReady', t: 'ms', w: 15 },
        { h: 'Thời gian Chủ nhà yêu cầu lắp đặt', k: 'ownerStart', t: 'ms', w: 16 },
        { h: 'Kế hoạch Team nhận hố', k: 'teamStart', t: 'ms', w: 15 },
        { h: 'Nhân sự', k: 'teamPlan', w: 18 },
        { h: 'Kế hoạch bàn giao (nếu có)', k: 'handover', t: 'ms', w: 16 },
        { h: 'Ghi chú', k: 'note', w: 28 },
        { h: 'Giám sát', k: 'supervisor', w: 13 },
        { h: 'Đã hoàn thành', k: 'done', t: 'yesno', w: 12 },
    ];
    const emptyMs = () => ({ date: '', done: false, note: '' });
    function newProject(over) {
        const p = { id: uid('p'), name: '', address: '', province: null, liftCount: '', liftType: '', travel: '', load: '', stops: '',
            transport: '', teamPlan: '', note: '', supervisor: '', done: false, color: '', wbs: '' };
        MILESTONES.forEach(m => { p[m.key] = emptyMs(); });
        return Object.assign(p, over || {});
    }
    const emptyData = () => ({ version: 1, updatedAt: '', fitters: [], projects: [], alloc: {} });

    // ---------------- đọc giá trị ô ----------------
    const DONE_WORDS = /^(xong|da xong|da ve|roi|da roi|ok|done|hoan thanh|da hoan thanh|co|da)\b/;
    const EMPTY_WORDS = /^(chua|chua co|khong|khong co|n\/?a|-+)$/;
    // ô ngày / trạng thái → mốc. cell = ô SheetJS ({t, v, w, z}); ctx dùng cho cảnh báo
    function parseMilestone(cell, ctx, warnings) {
        const ms = emptyMs();
        if (!cell || cell.v === undefined || cell.v === null || cell.v === '') return ms;
        if (cell.t === 'n' && cell.v > 20000 && cell.v < 80000) {
            ms.date = serialToISO(cell.v);
            // Định dạng hiển thị kiểu Mỹ (tháng/ngày): người dùng Việt dễ gõ "6/11" nghĩa 6 tháng 11 nhưng Excel hiểu 11 tháng 6
            const fmt = String(cell.z || '');
            const [y, m, d] = ms.date.split('-').map(Number);
            if (/^\[?\$?[^dmy]*m{1,2}[/.\-]d/i.test(fmt) && d <= 12 && m <= 12 && d !== m) {
                ms.check = iso(y, d, m);
                warnings.push({ type: 'date', where: ctx, msg: `${ctx}: ô hiển thị “${cell.w}” đang lưu ${fmtVN(ms.date)} — có thể ý là ${fmtVN(ms.check)} (Excel định dạng tháng/ngày). Đã nhập ${fmtVN(ms.date)}, hãy kiểm tra.`, suggest: ms.check });
            }
            return ms;
        }
        const raw = String(cell.v).trim();
        const p = plain(raw);
        const dm = raw.match(/(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})/);
        if (dm) {
            let [d, m, y] = [Number(dm[1]), Number(dm[2]), Number(dm[3])];
            if (y < 100) y += 2000;
            if (validDate(y, m, d)) ms.date = iso(y, m, d);
            else if (validDate(y, d, m)) { ms.date = iso(y, d, m); warnings.push({ type: 'date', where: ctx, msg: `${ctx}: “${raw}” không phải ngày/tháng hợp lệ — đã hiểu là ${fmtVN(ms.date)}.` }); }
            const rest = plain(raw.replace(dm[0], ''));
            if (rest && DONE_WORDS.test(rest)) ms.done = true;
            else if (rest) ms.note = raw.replace(dm[0], '').trim();
            return ms;
        }
        if (DONE_WORDS.test(p)) { ms.done = true; if (!/^(xong|da xong|da ve|roi|ok|done)$/.test(p)) ms.note = raw; return ms; }
        if (EMPTY_WORDS.test(p)) return ms;
        ms.note = raw;
        return ms;
    }
    const yesNo = (v) => { const p = plain(v); if (!p) return null; if (/^(co|yes|x|roi|xong|da|da hoan thanh|hoan thanh|true|1)$/.test(p)) return true; if (/^(khong|no|chua|false|0)$/.test(p)) return false; return null; };
    const cellText = (c) => (c && c.v !== undefined && c.v !== null ? String(c.w !== undefined && c.t !== 'n' ? c.w : c.v).trim() : '');

    // ---------------- màu ô ----------------
    const fillOf = (cell) => {
        const s = cell && cell.s;
        if (!s) return '';
        if (s.patternType && s.patternType !== 'solid') return '';
        const c = s.fgColor && s.fgColor.rgb;
        if (!c || /^(FF)?FFFFFF$/i.test(c)) return '';
        return c.length === 8 ? c.slice(2).toUpperCase() : c.toUpperCase();
    };
    // màu xám (trung tính) → "dự kiến"
    const isGray = (hex) => { if (!hex) return false; const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16); return Math.max(r, g, b) - Math.min(r, g, b) < 12 && r < 235; };
    const TENTATIVE_FILL = 'B3B3B3';
    // bảng màu cho dự án chưa có màu (nền nhạt, chữ đậm vẫn đọc được)
    const PALETTE = ['66CCFF', 'FFCC66', '99FF99', 'FF99CC', 'B4A7F5', 'FFB27F', '7FE0C8', 'F5E26B', 'A9C8FF', 'E6A8FF', 'C2E07A', 'FF8F8F'];

    function assignColors(projects) {
        const used = new Set(projects.filter(p => p.color).map(p => p.color.replace('#', '').toUpperCase()));
        let i = 0;
        projects.forEach(p => {
            if (p.color) return;
            const free = PALETTE.find(c => !used.has(c));
            const c = free || PALETTE[i++ % PALETTE.length];
            used.add(c); p.color = '#' + c;
        });
    }

    // ---------------- khớp tên dự án (sheet Nhân sự ghi tên ngắn) ----------------
    const STOP = /\b(toa nha|du an|cong trinh|nha|biet thu)\b/g;
    function matchProject(label, projects) {
        const L = plain(label), Ls = L.replace(STOP, ' ').replace(/\s+/g, ' ').trim();
        if (!L) return { project: null, candidates: [] };
        const exact = projects.filter(p => plain(p.name) === L || (p.aliases || []).some(a => plain(a) === L));
        if (exact.length === 1) return { project: exact[0], candidates: exact };
        const wordIn = (hay, needle) => needle && (' ' + hay + ' ').includes(' ' + needle + ' ');
        const cand = projects.filter(p => { const N = plain(p.name), Ns = N.replace(STOP, ' ').replace(/\s+/g, ' ').trim(); return wordIn(N, L) || wordIn(L, N) || (Ls && Ns && (wordIn(Ns, Ls) || wordIn(Ls, Ns))); });
        return { project: cand.length === 1 ? cand[0] : null, candidates: cand };
    }

    // ---------------- NHẬP ----------------
    function findSheet(wb, re) { const n = wb.SheetNames.find(s => re.test(plain(s))); return n ? { name: n, ws: wb.Sheets[n] } : null; }

    function parseWorkbook(XLSX, wb) {
        const warnings = [], data = emptyData();
        const enc = (r, c) => XLSX.utils.encode_cell({ r, c });

        // ---- Plan ----
        const plan = findSheet(wb, /^plan|lich trinh|ke hoach/);
        if (plan) {
            const ws = plan.ws, rng = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
            let hr = -1, cols = {};
            for (let r = rng.s.r; r <= Math.min(rng.e.r, rng.s.r + 10) && hr < 0; r++) {
                for (let c = rng.s.c; c <= rng.e.c; c++) { if (plain(cellText(ws[enc(r, c)])) === 'ten du an') { hr = r; break; } }
            }
            if (hr >= 0) {
                for (let c = rng.s.c; c <= rng.e.c; c++) {
                    const h = plain(cellText(ws[enc(hr, c)]));
                    const col = PLAN_COLUMNS.find(x => x.k && plain(x.h) === h) || PLAN_COLUMNS.find(x => x.k && h && (plain(x.h).startsWith(h) || h.startsWith(plain(x.h))));
                    if (col && !cols[col.k]) cols[col.k] = { c, col };
                }
                for (let r = hr + 1; r <= rng.e.r; r++) {
                    const nameCell = cols.name && ws[enc(r, cols.name.c)];
                    const name = cellText(nameCell);
                    if (!name) continue;
                    const p = newProject({ name });
                    const nf = fillOf(nameCell); // màu dự án (bản xuất từ ứng dụng tô ô Tên dự án)
                    if (nf && !isGray(nf)) p.color = '#' + nf;
                    Object.keys(cols).forEach(k => {
                        const { c, col } = cols[k], cell = ws[enc(r, c)];
                        const ctx = `Plan ${enc(r, c)} (${name} · ${col.h})`;
                        if (col.t === 'ms') p[k] = parseMilestone(cell, ctx, warnings);
                        else if (col.t === 'yesno') p[k] = yesNo(cellText(cell)) ?? (k === 'done' ? false : null);
                        else if (col.t === 'num') { const v = cell && cell.v; p[k] = typeof v === 'number' ? v : (cellText(cell).match(/\d+/) ? Number(cellText(cell).match(/\d+/)[0]) : ''); }
                        else if (k === 'load') { const t = cellText(cell), m = t.match(/[\d.,]+/); p[k] = m ? Number(m[0].replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.')) : t; }
                        else if (k !== 'name') p[k] = cellText(cell);
                    });
                    data.projects.push(p);
                }
            } else warnings.push({ type: 'sheet', msg: `Sheet “${plan.name}”: không tìm thấy dòng tiêu đề có cột “Tên Dự án”.` });
        } else warnings.push({ type: 'sheet', msg: 'Không có sheet “Plan” (lịch trình dự án).' });

        // ---- Nhân sự (fitter allocation) ----
        const grid = findSheet(wb, /^nhan su|fitter|allocation|dieu phoi/);
        const gridStats = { fitters: 0, days: 0, cells: 0, tentative: 0 };
        if (grid) {
            const ws = grid.ws, rng = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
            // dòng ngày: dòng đầu tiên có ≥ 5 ô là ngày
            let dr = -1, dateCols = [];
            for (let r = rng.s.r; r <= Math.min(rng.e.r, rng.s.r + 10) && dr < 0; r++) {
                const ds = [];
                for (let c = rng.s.c; c <= rng.e.c; c++) { const x = ws[enc(r, c)]; if (x && x.t === 'n' && x.v > 30000 && x.v < 80000) ds.push({ c, date: serialToISO(x.v) }); }
                if (ds.length >= 5) { dr = r; dateCols = ds; }
            }
            if (dr >= 0) {
                // cột tên: ô "Tên" trên dòng ngày, mặc định cột ngay trước ngày đầu tiên
                let nc = dateCols[0].c - 1;
                for (let c = rng.s.c; c < dateCols[0].c; c++) if (plain(cellText(ws[enc(dr, c)])) === 'ten') nc = c;
                const merges = ws['!merges'] || [];
                const mergeAt = (r, c) => merges.find(m => r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c);
                gridStats.days = dateCols.length;
                const colorProject = {}; // màu → dự án (để gán ô tô màu không ghi tên)
                const rows = [];
                for (let r = dr + 1; r <= rng.e.r; r++) {
                    const name = cellText(ws[enc(r, nc)]);
                    if (!name) continue;
                    const fitter = { id: uid('f'), name, empId: '' };
                    data.fitters.push(fitter);
                    const days = dateCols.map(({ c, date }) => {
                        const m = mergeAt(r, c), top = m ? ws[enc(m.s.r, m.s.c)] : ws[enc(r, c)];
                        const own = ws[enc(r, c)];
                        return { date, text: cellText(top), color: fillOf(own) || fillOf(top), col: c };
                    });
                    rows.push({ fitter, days, r });
                }
                // nhãn → dự án
                const labelMap = {}, created = {};
                const projectFor = (label, color) => {
                    const key = plain(label);
                    if (labelMap[key]) return labelMap[key];
                    // chỉ khớp với dự án của sheet Plan (nhãn ngắn khác nhau trong lưới là các dự án khác nhau)
                    const { project, candidates } = matchProject(label, data.projects.filter(x => !x.fromGrid));
                    let p = project;
                    if (!p) {
                        p = newProject({ name: label, fromGrid: true });
                        data.projects.push(p);
                        created[key] = p;
                        if (candidates.length > 1) warnings.push({ type: 'match', msg: `Nhân sự: “${label}” khớp nhiều dự án (${candidates.map(c => c.name).join(', ')}) — đã tạo dự án riêng “${label}”, có thể gộp trong ứng dụng.` });
                    } else if (plain(p.name) !== key) {
                        p.aliases = (p.aliases || []).concat(label);
                    }
                    if (color && !isGray(color) && !p.color) p.color = '#' + color;
                    labelMap[key] = p;
                    return p;
                };
                rows.forEach(({ days }) => days.forEach(d => { if (d.text) { const p = projectFor(d.text, d.color); if (d.color && !isGray(d.color) && !colorProject[d.color]) colorProject[d.color] = p; } }));
                rows.forEach(({ fitter, days, r }) => {
                    const out = {};
                    // nhãn từng ngày: chữ của ô (hoặc ô gộp); ô không chữ lấy nhãn gần nhất trong đoạn cùng màu liền kề
                    days.forEach((d, i) => {
                        let label = d.text;
                        if (!label && d.color) {
                            for (let j = i - 1; j >= 0 && days[j].color === d.color; j--) if (days[j].text) { label = days[j].text; break; }
                            if (!label) for (let j = i + 1; j < days.length && days[j].color === d.color; j++) if (days[j].text) { label = days[j].text; break; }
                        }
                        if (!label && d.color && !isGray(d.color) && colorProject[d.color]) label = colorProject[d.color].name;
                        if (!label) {
                            if (d.color) warnings.push({ type: 'cell', msg: `Nhân sự ${enc(r, d.col)} (${fitter.name}, ${fmtVN(d.date)}): ô có màu nhưng không ghi dự án — bỏ qua.` });
                            return;
                        }
                        const p = projectFor(label, d.color);
                        const cellv = { p: p.id };
                        if (isGray(d.color)) { cellv.t = 1; gridStats.tentative++; }
                        out[d.date] = cellv;
                        gridStats.cells++;
                    });
                    data.alloc[fitter.id] = out;
                });
                gridStats.fitters = data.fitters.length;
                gridStats.from = dateCols[0].date; gridStats.to = dateCols[dateCols.length - 1].date;
            } else warnings.push({ type: 'sheet', msg: `Sheet “${grid.name}”: không tìm thấy dòng ngày.` });
        } else warnings.push({ type: 'sheet', msg: 'Không có sheet “Nhân sự” (điều phối fitter).' });

        // màu cho dự án chưa có màu: ưu tiên màu chưa dùng trong file
        assignColors(data.projects);
        data.updatedAt = new Date().toISOString();
        return { data, warnings, stats: { projects: data.projects.length, fromGrid: data.projects.filter(p => p.fromGrid).length, ...gridStats } };
    }

    // ---------------- XUẤT ----------------
    const WEEKDAY_FORMULA = (a) => `IF("Thứ "&WEEKDAY(${a})="Thứ 1","Chủ Nhật","Thứ "&WEEKDAY(${a}))`;
    const VN_WEEKDAY = (s) => { const w = isoToUTCDate(s).getUTCDay(); return w === 0 ? 'Chủ Nhật' : 'Thứ ' + (w + 1); };
    const thin = { style: 'thin', color: { argb: 'FFBFBFBF' } };
    const border = { top: thin, left: thin, bottom: thin, right: thin };

    // khoảng ngày có phân công (mở rộng tròn tuần T2 → CN)
    function allocRange(data) {
        let a = '', b = '';
        Object.values(data.alloc || {}).forEach(m => Object.keys(m).forEach(d => { if (!a || d < a) a = d; if (!b || d > b) b = d; }));
        return a ? { from: a, to: b } : null;
    }
    const msOut = (m) => {
        if (!m) return null;
        if (m.date && m.done) return `xong ${fmtVN(m.date)}`;
        if (m.date) return isoToUTCDate(m.date);
        if (m.done) return m.note || 'xong';
        return m.note || null;
    };

    function buildWorkbook(ExcelJS, data, opts) {
        const o = opts || {};
        const wb = new ExcelJS.Workbook();
        wb.creator = 'Bộ công cụ dự án — Quản lý dự án';
        const byId = {}; data.projects.forEach(p => { byId[p.id] = p; });

        // ---- Nhân sự ----
        const ws = wb.addWorksheet('Nhân sự', { views: [{ state: 'frozen', xSplit: 2, ySplit: 2 }] });
        const rg = o.from && o.to ? { from: o.from, to: o.to } : allocRange(data);
        const days = rg ? daysBetween(rg.from, rg.to) : [];
        ws.getColumn(1).width = 4; ws.getColumn(2).width = 14;
        days.forEach((d, i) => { ws.getColumn(3 + i).width = 11; });
        const r1 = ws.getRow(1), r2 = ws.getRow(2);
        r2.getCell(2).value = 'Tên';
        days.forEach((d, i) => {
            const c = 3 + i, a = ws.getRow(2).getCell(c).address;
            r1.getCell(c).value = { formula: WEEKDAY_FORMULA(a), result: VN_WEEKDAY(d) };
            r2.getCell(c).value = isoToUTCDate(d);
            r2.getCell(c).numFmt = 'dd/mm/yy';
            const sun = isoToUTCDate(d).getUTCDay() === 0;
            [r1.getCell(c), r2.getCell(c)].forEach(x => { x.alignment = { horizontal: 'center' }; x.font = { bold: true, color: { argb: sun ? 'FFC00000' : 'FF000000' } }; x.border = border; });
        });
        [r1.getCell(2), r2.getCell(2)].forEach(x => { x.font = { bold: true }; x.border = border; });
        data.fitters.forEach((f, fi) => {
            const r = 3 + fi, row = ws.getRow(r);
            row.getCell(1).value = fi + 1; row.getCell(2).value = f.name;
            row.getCell(2).font = { bold: true };
            for (let c = 1; c <= 2 + days.length; c++) row.getCell(c).border = border;
            const m = (data.alloc || {})[f.id] || {};
            // gom các ngày liền nhau cùng dự án + cùng trạng thái → 1 ô gộp có tên dự án
            let i = 0;
            while (i < days.length) {
                const v = m[days[i]];
                if (!v || !byId[v.p]) { i++; continue; }
                let j = i;
                while (j + 1 < days.length && m[days[j + 1]] && m[days[j + 1]].p === v.p && !!m[days[j + 1]].t === !!v.t) j++;
                const p = byId[v.p];
                const fill = v.t ? TENTATIVE_FILL : String(p.color || '#' + PALETTE[0]).replace('#', '').toUpperCase();
                for (let k = i; k <= j; k++) {
                    const cell = row.getCell(3 + k);
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + fill } };
                }
                const first = row.getCell(3 + i);
                first.value = p.name;
                first.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
                first.font = { bold: true };
                if (j > i) ws.mergeCells(r, 3 + i, r, 3 + j);
                i = j + 1;
            }
        });

        // ---- Plan ----
        const wp = wb.addWorksheet('Plan', { views: [{ state: 'frozen', ySplit: 1 }] });
        PLAN_COLUMNS.forEach((c, i) => { wp.getColumn(i + 1).width = c.w; });
        const hrow = wp.getRow(1);
        PLAN_COLUMNS.forEach((c, i) => {
            const x = hrow.getCell(i + 1); x.value = c.h;
            x.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
            x.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }; x.border = border;
        });
        hrow.height = 42;
        data.projects.forEach((p, pi) => {
            const row = wp.getRow(2 + pi);
            PLAN_COLUMNS.forEach((c, i) => {
                const x = row.getCell(i + 1);
                let v;
                if (!c.k) v = pi + 1;
                else if (c.t === 'ms') v = msOut(p[c.k]);
                else if (c.t === 'yesno') v = p[c.k] === true ? (c.k === 'done' ? 'Rồi' : 'có') : p[c.k] === false ? (c.k === 'done' ? 'Chưa' : 'không') : null;
                else if (c.k === 'load') v = p.load === '' || p.load == null ? null : (typeof p.load === 'number' ? `${p.load}kg` : p.load);
                else v = p[c.k] === '' || p[c.k] == null ? null : p[c.k];
                x.value = v;
                if (v instanceof Date) x.numFmt = 'dd/mm/yyyy';
                x.alignment = { vertical: 'top', wrapText: c.k === 'note' || c.k === 'address' || c.k === 'name' };
                x.border = border;
                if (c.k === 'name' && p.color) { x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + p.color.replace('#', '').toUpperCase() } }; x.font = { bold: true }; }
            });
        });
        wp.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: PLAN_COLUMNS.length } };
        return wb;
    }

    // ---------------- GỘP THAY ĐỔI (nhiều người cùng sửa) ----------------
    // Gộp 3 chiều: base = bản chung lúc máy này đồng bộ lần cuối, local = bản trên máy, remote = bản chung mới nhất.
    // Từng dự án / fitter / ô phân công (fitter + ngày): bên nào đổi so với base thì lấy bên đó; cả hai cùng đổi
    // khác nhau → `prefer` thắng (mặc định: máy đang lưu). base = null (lần đầu kết nối): gộp theo tên.
    const stable = (v) => (v && typeof v === 'object' ? (Array.isArray(v) ? '[' + v.map(stable).join(',') + ']'
        : '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}') : JSON.stringify(v));
    const same = (a, b) => stable(a) === stable(b);
    function threeWay(b, l, r, prefer, stat) {
        const keys = new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)]);
        const out = {};
        keys.forEach(k => {
            const lc = !same(b[k], l[k]), rc = !same(b[k], r[k]);
            let v;
            if (!lc) v = r[k];
            else if (!rc || same(l[k], r[k])) v = l[k];
            else { v = prefer === 'remote' ? r[k] : l[k]; stat.conflicts++; }
            if (v !== undefined) out[k] = v;
        });
        return out;
    }
    const byIdMap = (arr) => { const m = {}; (arr || []).forEach(x => { m[x.id] = x; }); return m; };
    const flatAlloc = (alloc) => { const m = {}; Object.keys(alloc || {}).forEach(f => Object.keys(alloc[f] || {}).forEach(d => { m[f + '|' + d] = alloc[f][d]; })); return m; };
    // lần đầu kết nối: fitter / dự án trùng tên với bản chung → dùng id của bản chung (tránh nhân đôi)
    function remapByName(local, remote) {
        const L = JSON.parse(JSON.stringify(local)), idmap = {};
        [['fitters', 'f'], ['projects', 'p']].forEach(([k]) => {
            const rn = {}; (remote[k] || []).forEach(x => { rn[plain(x.name)] = x.id; });
            (L[k] || []).forEach(x => { const id = rn[plain(x.name)]; if (id && id !== x.id) { idmap[x.id] = id; x.id = id; } });
        });
        const alloc = {};
        Object.keys(L.alloc || {}).forEach(f => {
            const nf = idmap[f] || f; alloc[nf] = alloc[nf] || {};
            Object.keys(L.alloc[f]).forEach(d => { const v = Object.assign({}, L.alloc[f][d]); v.p = idmap[v.p] || v.p; alloc[nf][d] = v; });
        });
        L.alloc = alloc;
        return L;
    }
    function merge(base, local, remote, prefer) {
        const stat = { conflicts: 0 };
        remote = remote || emptyData();
        if (!base) { local = remapByName(local || emptyData(), remote); base = emptyData(); prefer = prefer || 'remote'; }
        local = local || emptyData();
        const order = (k, m) => {
            const ids = [];
            (remote[k] || []).forEach(x => { if (m[x.id] && !ids.includes(x.id)) ids.push(x.id); });
            (local[k] || []).forEach(x => { if (m[x.id] && !ids.includes(x.id)) ids.push(x.id); });
            return ids.map(id => m[id]);
        };
        const fm = threeWay(byIdMap(base.fitters), byIdMap(local.fitters), byIdMap(remote.fitters), prefer, stat);
        const pm = threeWay(byIdMap(base.projects), byIdMap(local.projects), byIdMap(remote.projects), prefer, stat);
        const am = threeWay(flatAlloc(base.alloc), flatAlloc(local.alloc), flatAlloc(remote.alloc), prefer, stat);
        const out = emptyData();
        out.fitters = order('fitters', fm);
        out.projects = order('projects', pm);
        out.fitters.forEach(f => { out.alloc[f.id] = {}; });
        Object.keys(am).forEach(k => {
            const i = k.indexOf('|'), f = k.slice(0, i), d = k.slice(i + 1);
            if (out.alloc[f] && pm[am[k].p]) out.alloc[f][d] = am[k]; // bỏ ô của fitter / dự án đã bị xoá
        });
        out.updatedAt = new Date().toISOString();
        return { data: out, conflicts: stat.conflicts };
    }

    const api = { merge, same, assignColors, MILESTONES, PLAN_COLUMNS, TENTATIVE_FILL, PALETTE, newProject, emptyData, emptyMs, parseWorkbook, buildWorkbook, matchProject,
        parseMilestone, plain, uid, iso, isISO, addDays, daysBetween, fmtVN, serialToISO, isoToUTCDate, allocRange, isGray };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.PMIO = api;
})(typeof window !== 'undefined' ? window : globalThis);
