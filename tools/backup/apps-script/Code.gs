/**
 * Cầu nối Google Drive cho tính năng Sao lưu & khôi phục của Bộ công cụ dự án (TrackingTS).
 * Chạy dưới tài khoản Google của người triển khai — bản sao lưu nằm trong Drive của tài khoản đó.
 * Máy chủ (Cloudflare) và GitHub Actions gọi Web app này bằng POST JSON có kèm mã bí mật (BACKUP_TOKEN).
 *
 * Thao tác: list (danh sách bản sao lưu) · get (tải 1 bản, trả base64) · upload (lưu bản mới, tự xoá bản cũ, giữ tối đa MAX_KEEP).
 * Cài đặt: xem HUONG-DAN.md cùng thư mục.
 */
var MAX_KEEP = 10;
var FOLDER_NAME = 'TrackingTS-Backup';
var NAME_RE = /^trackingts-backup-[A-Za-z0-9_.\-]{1,80}\.json\.gz$/;

function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); } catch (x) { return out_({ error: 'Yêu cầu không phải JSON' }); }
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('BACKUP_TOKEN');
  if (!token || token.length < 24) return out_({ error: 'Chưa đặt BACKUP_TOKEN (Project Settings → Script properties), tối thiểu 24 ký tự' });
  if (!req || req.token !== token) return out_({ error: 'Sai mã bí mật' });
  var folder = folder_(props);
  if (req.action === 'list') return out_({ files: list_(folder), keep: MAX_KEEP });
  if (req.action === 'get') {
    var f = byId_(folder, String(req.id || ''));
    if (!f) return out_({ error: 'Không tìm thấy bản sao lưu' });
    return out_({ name: f.getName(), b64: Utilities.base64Encode(f.getBlob().getBytes()) });
  }
  if (req.action === 'upload') {
    var name = String(req.name || '');
    if (!NAME_RE.test(name)) return out_({ error: 'Tên file không hợp lệ' });
    var bytes = Utilities.base64Decode(String(req.b64 || ''));
    if (!bytes.length || (bytes[0] & 0xff) !== 0x1f || (bytes[1] & 0xff) !== 0x8b) return out_({ error: 'Nội dung phải là file .json.gz' });
    var file = folder.createFile(Utilities.newBlob(bytes, 'application/gzip', name));
    if (req.note) file.setDescription(String(req.note).slice(0, 500));
    return out_({ ok: true, file: info_(file), pruned: prune_(folder) });
  }
  return out_({ error: 'Thao tác không hợp lệ' });
}

function doGet() { return out_({ ok: true, service: 'trackingts-backup' }); }   // chỉ để kiểm tra Web app đã chạy — không trả dữ liệu

function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function folder_(props) {
  var id = props.getProperty('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (x) { /* thư mục đã bị xoá → tạo lại */ } }
  var it = DriveApp.getRootFolder().getFoldersByName(FOLDER_NAME);
  var f = it.hasNext() ? it.next() : DriveApp.getRootFolder().createFolder(FOLDER_NAME);
  props.setProperty('FOLDER_ID', f.getId());
  return f;
}

function files_(folder) {
  var out = [], it = folder.getFiles();
  while (it.hasNext()) { var f = it.next(); if (!f.isTrashed() && NAME_RE.test(f.getName())) out.push(f); }
  out.sort(function (a, b) { return b.getDateCreated().getTime() - a.getDateCreated().getTime(); });   // mới nhất trước
  return out;
}

function info_(f) {
  return { id: f.getId(), name: f.getName(), size: f.getSize(), created: f.getDateCreated().toISOString(), note: f.getDescription() || '' };
}

function list_(folder) { return files_(folder).map(info_); }

function byId_(folder, id) {
  var all = files_(folder);
  for (var i = 0; i < all.length; i++) if (all[i].getId() === id) return all[i];
  return null;
}

// giữ MAX_KEEP bản mới nhất, chuyển các bản cũ hơn vào Thùng rác
function prune_(folder) {
  var all = files_(folder), n = 0;
  for (var i = MAX_KEEP; i < all.length; i++) { all[i].setTrashed(true); n++; }
  return n;
}
