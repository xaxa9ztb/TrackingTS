// Khớp "tên giám sát ghi trong dự án" với nhân viên — hàm thuần, không đụng database (dễ kiểm thử).
import { plain, rolesFromPosition } from './roles.mjs';

export const keyOf = (s) => plain(s);                               // khoá chuẩn hoá để gom nhóm
const words = (s) => plain(s).split(' ').filter(Boolean);
const sortedKey = (s) => words(s).sort().join(' ');

// Trả về { match, how, candidates } cho một tên giám sát.
//   alias:  admin đã chọn trước đó (aliasEmpId)
//   exact:  trùng tên sau khi bỏ dấu, chữ thường
//   words:  cùng các từ nhưng khác thứ tự ("Nguyen Van A" ↔ "A Nguyen Van")
//   subset: mọi từ của tên giám sát đều nằm trong tên nhân viên (≥ 2 từ) — vd. thiếu tên đệm
// Nhiều người khớp cùng mức: ưu tiên người có chức danh Site Sup; còn nhiều hơn một → không tự chọn, trả về danh sách gợi ý.
export function matchSupervisor(text, employees, aliasEmpId) {
  const active = employees.filter(e => e.active !== 0 && e.active !== false);
  if (aliasEmpId) {
    const e = active.find(x => x.emp_id === aliasEmpId);
    if (e) return { match: e, how: 'alias', candidates: [] };
  }
  const k = keyOf(text), sk = sortedKey(text), w = words(text);
  const levels = [
    ['exact', (e) => keyOf(e.full_name) === k],
    ['words', (e) => sortedKey(e.full_name) === sk],
    ['subset', (e) => w.length >= 2 && w.every(x => words(e.full_name).includes(x))],
  ];
  let firstCands = [];
  for (const [how, test] of levels) {
    let hits = active.filter(test);
    if (!hits.length) continue;
    if (hits.length > 1) {
      const sups = hits.filter(e => rolesFromPosition(e.position).includes('sitesup'));
      if (sups.length >= 1) hits = sups;
    }
    if (hits.length === 1) return { match: hits[0], how, candidates: [] };
    if (!firstCands.length) firstCands = hits;
  }
  return { match: null, how: '', candidates: firstCands.slice(0, 8) };
}
