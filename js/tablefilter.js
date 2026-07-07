// Per-column filter row for data tables. Matching is diacritic-insensitive (via Combo.normalize).
const TableFilter = (() => {
  // cols: array of booleans - true = show a filter input for that column.
  // Returns a live array of normalized filter values (one per column).
  function build(thead, cols, onChange) {
    const old = thead.querySelector('.filter-row');
    if (old) old.remove();
    const tr = document.createElement('tr');
    tr.className = 'filter-row';
    const values = cols.map(() => '');
    cols.forEach((enabled, i) => {
      const th = document.createElement('th');
      if (enabled) {
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

  // cells: array of display strings for one row
  function match(values, cells) {
    if (!values || !values.length) return true;
    return values.every((v, i) => !v || Combo.normalize(cells[i] === undefined ? '' : cells[i]).includes(v));
  }

  return { build, match };
})();
