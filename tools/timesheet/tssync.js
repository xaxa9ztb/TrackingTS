// Đồng bộ Timesheet cá nhân với máy chủ (chỉ bản Cloudflare — xem /api/ts/docs trong server/api.mjs).
//
// Cách hoạt động: dữ liệu vẫn nằm trên máy (localStorage) để chấm công được cả khi mất sóng ở công trường.
// Mỗi KỲ LƯƠNG ('YYYY-MM' = tháng kết thúc kỳ) là một "bảng công" trên máy chủ, có số phiên bản:
//   - sửa / xoá một dòng → kỳ đó được đánh dấu "chưa gửi"; sau ít giây (hoặc khi có mạng lại) gửi lên;
//   - máy chủ có bản mới hơn (vd. sửa trên điện thoại) → tải về và GỘP theo từng dòng (dòng sửa sau thắng, dòng xoá được nhớ);
//   - hai máy cùng gửi một lúc → máy chủ trả 409, gộp rồi gửi lại.
// Các hàm thuần (periodOf, mergeDoc, applyChanges) không đụng mạng / trình duyệt để kiểm thử được bằng Node.
(function (root) {
  'use strict';

  const KEY = 'ts_sync_v1';
  const TOMB_KEEP_MS = 90 * 864e5;   // nhớ dòng đã xoá 90 ngày

  // 'YYYY-MM-DD' → kỳ lương 'YYYY-MM' (ngày 16 trở đi thuộc kỳ của tháng sau)
  function periodOf(date) {
    let y = +date.slice(0, 4), m = +date.slice(5, 7);
    if (+date.slice(8, 10) >= 16) { m += 1; if (m > 12) { m = 1; y += 1; } }
    return y + '-' + String(m).padStart(2, '0');
  }

  const stamp = (e) => Number(e && e.u) || 0;

  // Gộp dòng của MỘT kỳ trên máy với bản trên máy chủ.
  // local: mảng dòng của kỳ (trên máy); localTomb / remote.deleted: {id: thời điểm xoá}
  // → { entries (kết quả), tomb (các dòng đã xoá còn nhớ), differsFromRemote }
  function mergeDoc(local, localTomb, remote) {
    const tomb = {};
    const addTomb = (o) => { Object.keys(o || {}).forEach(k => { tomb[k] = Math.max(tomb[k] || 0, Number(o[k]) || 0); }); };
    addTomb(remote && remote.deleted); addTomb(localTomb);
    const byId = new Map();
    ((remote && remote.entries) || []).forEach(e => byId.set(String(e.id), e));
    (local || []).forEach(e => {
      const id = String(e.id), r = byId.get(id);
      if (!r || stamp(e) >= stamp(r)) byId.set(id, e);       // cùng thời điểm: bản trên máy thắng
    });
    const entries = [];
    byId.forEach((e, id) => { if (!(tomb[id] >= stamp(e) && tomb[id] > 0)) entries.push(e); });   // xoá sau lần sửa cuối → bỏ
    const now = Date.now();
    Object.keys(tomb).forEach(k => { if (now - tomb[k] > TOMB_KEEP_MS) delete tomb[k]; });
    const remoteIds = new Map(((remote && remote.entries) || []).map(e => [String(e.id), e]));
    const differs = entries.length !== remoteIds.size || entries.some(e => remoteIds.get(String(e.id)) !== undefined && JSON.stringify(remoteIds.get(String(e.id))) !== JSON.stringify(e) || !remoteIds.has(String(e.id)))
      || Object.keys(tomb).some(k => !(remote && remote.deleted && remote.deleted[k] >= tomb[k]));
    return { entries, tomb, differs };
  }

  // Phụ cấp xe của kỳ ({rows, u}): cả khối, bản có thời điểm sửa (u) sau thắng; bằng nhau thì bản trên máy thắng
  function mergeAllow(local, remote) {
    if (!remote) return local || null;
    if (!local) return remote;
    return stamp(local) >= stamp(remote) ? local : remote;
  }

  // Áp kết quả đồng bộ lên mảng dòng HIỆN TẠI (người dùng có thể đã sửa tiếp trong lúc đồng bộ):
  // chỉ thay các dòng của kỳ đã đồng bộ khi dòng đó chưa bị sửa tiếp sau thời điểm bắt đầu.
  function applyChanges(current, period, merged, startedAt) {
    const out = [], keep = new Map();
    current.forEach(e => {
      if (periodOf(e.date) !== period) { out.push(e); return; }
      keep.set(String(e.id), e);
    });
    const used = new Set();
    merged.forEach(e => {
      const id = String(e.id), cur = keep.get(id);
      used.add(id);
      out.push(cur && stamp(cur) > Math.max(startedAt, stamp(e)) ? cur : e);   // sửa tiếp trong lúc đồng bộ → giữ bản mới
    });
    keep.forEach((e, id) => { if (!used.has(id) && stamp(e) > startedAt) out.push(e); });  // dòng mới thêm trong lúc đồng bộ
    return out;
  }

  // ---------- trạng thái lưu trên máy ----------
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && typeof s === 'object') return { versions: {}, dirty: {}, tomb: {}, status: {}, ...s }; } catch (e) { /* bỏ qua */ }
    return { versions: {}, dirty: {}, tomb: {}, status: {} };
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* hết dung lượng */ } }

  function markDirty(dates) {
    const s = load();
    [].concat(dates).forEach(d => { if (d) { const p = periodOf(d); s.dirty[p] = (s.dirty[p] || 0) + 1; } });
    save(s);
  }
  function markPeriodDirty(period) {   // phụ cấp xe của kỳ vừa sửa
    const s = load();
    s.dirty[period] = (s.dirty[period] || 0) + 1;
    save(s);
  }
  function markDeleted(entry) {
    const s = load();
    s.tomb[String(entry.id)] = Date.now();
    save(s);
  }
  function unmarkDeleted(entry) {   // Hoàn tác xoá
    const s = load();
    delete s.tomb[String(entry.id)];
    save(s);
  }

  // ---------- mạng ----------
  async function call(method, path, body) {
    let resp;
    try {
      resp = await fetch(path, {
        method, credentials: 'same-origin', redirect: 'manual', cache: 'no-store',
        headers: body === undefined ? {} : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) { const err = new Error('offline'); err.offline = true; throw err; }
    if (resp.type === 'opaqueredirect' || (resp.status >= 300 && resp.status < 400) || resp.status === 401) {
      const err = new Error('Phiên đăng nhập đã hết hạn — tải lại trang (F5) để đăng nhập lại.'); err.auth = true; throw err;
    }
    let data = {};
    try { data = await resp.json(); } catch (e) { /* không phải JSON */ }
    return { status: resp.status, data };
  }

  let running = null;

  // Đồng bộ toàn bộ: lấy danh sách kỳ trên máy chủ, tải kỳ mới hơn, gộp, gửi kỳ có thay đổi.
  // getEntries(): mảng dòng hiện tại; onMerged(period, mergedEntries, startedAt): cập nhật giao diện;
  // getAllow(period) / onAllow(period, allow): phụ cấp xe của kỳ trên máy / nhận bản gộp (bản trên máy chủ mới hơn);
  // trả { ok, statuses:{period:status}, error?, offline?, pushed, pulled }
  function sync({ getEntries, onMerged, getSch, getAllow, onAllow }) {
    if (running) return running;
    running = (async () => {
      const result = { ok: false, statuses: {}, notes: {}, pushed: 0, pulled: 0 };
      try {
        const listing = await call('GET', '/api/ts/docs');
        if (listing.status !== 200) throw new Error(listing.data.error || ('Máy chủ báo lỗi (HTTP ' + listing.status + ')'));
        const remote = {}; (listing.data.docs || []).forEach(d => { remote[d.period] = d; result.notes[d.period] = d.note || ''; });
        let st = load();
        // lần đầu trên máy này: các kỳ đã có dòng mà máy chủ chưa có → gửi lên
        const localPeriods = new Set(getEntries().map(e => periodOf(e.date)));
        localPeriods.forEach(p => { if (!remote[p] && !st.versions[p] && !st.dirty[p]) st.dirty[p] = 1; });
        const periods = new Set([...Object.keys(remote), ...Object.keys(st.dirty)]);
        let budget = 24;       // tối đa số kỳ xử lý mỗi lượt (lần đầu có thể nhiều); phần còn lại để lượt sau
        for (const p of [...periods].sort().reverse()) {
          if (budget-- <= 0) break;
          const startedAt = Date.now();
          const seq = st.dirty[p] || 0;
          const r = remote[p];
          let version = r ? r.version : 0, status = r ? r.status : (st.status[p] || 'draft');
          result.statuses[p] = status;
          if (!seq && r && r.version === (st.versions[p] || 0)) continue;     // không có gì mới
          // base = bản trên máy chủ cần gộp; null = máy chủ chưa đổi kể từ lần trước nên gửi thẳng
          let base = null;
          if (!r) base = { entries: [], deleted: {} };
          else if (r.version !== (st.versions[p] || 0)) {
            const g = await call('GET', '/api/ts/docs/' + p);
            if (g.status !== 200) throw new Error(g.data.error || 'Không tải được bảng công kỳ ' + p);
            base = g.data.data; version = g.data.version; status = g.data.status; result.pulled++;
          }
          for (let attempt = 0; attempt < 3; attempt++) {
            const localOfP = getEntries().filter(e => periodOf(e.date) === p);
            const localAllow = getAllow ? getAllow(p) || null : null;
            let merged, allow = localAllow;
            if (base) {
              merged = mergeDoc(localOfP, load().tomb, base);
              onMerged(p, merged.entries, startedAt);
              st = load(); st.tomb = { ...st.tomb, ...merged.tomb }; save(st);
              allow = mergeAllow(localAllow, base.allow);
              if (allow !== localAllow && onAllow) onAllow(p, allow);
              if (JSON.stringify(allow || null) !== JSON.stringify(base.allow || null)) merged.differs = true;
            } else merged = { entries: localOfP, tomb: load().tomb, differs: seq > 0 };
            result.statuses[p] = status;
            if (LOCKED.includes(status) || (!seq && !merged.differs)) {
              st = load(); st.versions[p] = version; st.status[p] = status; save(st); break;
            }
            const put = await call('PUT', '/api/ts/docs/' + p, { baseVersion: version, data: { entries: merged.entries, deleted: merged.tomb, sch: getSch ? getSch() : undefined, allow: allow || undefined } });
            if (put.status === 200) {
              result.pushed++;
              st = load(); st.versions[p] = put.data.version; st.status[p] = status;
              if ((st.dirty[p] || 0) === seq) delete st.dirty[p];          // sửa tiếp trong lúc gửi → giữ dấu "chưa gửi"
              save(st); break;
            }
            if (put.status === 409) { version = put.data.version; status = put.data.status; base = put.data.data; continue; }   // gộp lại với bản mới
            if (put.status === 423) {
              status = put.data.status; result.statuses[p] = status;
              st = load(); st.versions[p] = put.data.version; st.status[p] = status; save(st); break;
            }
            throw new Error(put.data.error || ('Máy chủ báo lỗi (HTTP ' + put.status + ')'));
          }
        }
        result.ok = true;
      } catch (e) {
        if (e.offline) result.offline = true; else result.error = e.message;
      }
      return result;
    })().finally(() => { running = null; });
    return running;
  }

  // Nộp bảng công kỳ `period`: máy khách đã gắn phân loại giờ (bd) vào từng dòng và đồng bộ xong; baseVersion = phiên bản đã đồng bộ
  async function submit(period) {
    const st = load();
    const r = await call('POST', '/api/ts/docs/' + period + '/submit', { baseVersion: st.versions[period] || 0 });
    if (r.status === 200) { st.status[period] = 'submitted'; save(st); }
    return r;
  }
  async function withdraw(period) {
    const r = await call('POST', '/api/ts/docs/' + period + '/withdraw', {});
    if (r.status === 200) { const st = load(); st.status[period] = 'draft'; save(st); }
    return r;
  }

  const LOCKED = ['submitted', 'sitesup_ok', 'approved'];
  const api = { periodOf, mergeDoc, mergeAllow, applyChanges, markDirty, markPeriodDirty, markDeleted, unmarkDeleted, sync, submit, withdraw, load, LOCKED, request: call };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TsSync = api;
})(typeof window !== 'undefined' ? window : globalThis);
