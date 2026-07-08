// Per-column filter row for data tables. Matching is diacritic-insensitive (via Combo.normalize).
const TableFilter = (() => {
  // cols: array where each entry is true (filter input), false (empty cell),
  // or 'chk' (empty cell carrying the checkbox-column class so it hides with it).
  // Returns a live array of normalized filter values (one per column).
  function build(thead, cols, onChange) {
    const old = thead.querySelector('.filter-row');
    if (old) old.remove();
    const tr = document.createElement('tr');
    tr.className = 'filter-row';
    const values = cols.map(() => '');
    cols.forEach((col, i) => {
      const th = document.createElement('th');
      if (col === 'chk') {
        th.className = 'chk-col';
      } else if (col) {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.placeholder = 'Lọc...';
        inp.addEventListener('input', () => {
          values[i] = Combo.normalize(inp.value);
          onChange();
        });
        th.appendChild(inp);
      }
      tr.appendChild(th);
    });
    thead.appendChild(tr);
    return values;
  }

  // cells: array of display strings for one row.
  // offset: how many leading filter columns (e.g. the checkbox column) to skip.
  function match(values, cells, offset) {
    if (!values || !values.length) return true;
    const off = offset || 0;
    return cells.every((c, i) => {
      const v = values[i + off];
      return !v || Combo.normalize(c === undefined ? '' : c).includes(v);
    });
  }

  return { build, match };
})();
