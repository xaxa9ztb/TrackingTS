// Searchable dropdown (autocomplete). Matching is case- and diacritic-insensitive
// so typing "duong" finds "ĐƯỜNG". Empty input = no filter.
const Combo = (() => {
  function normalize(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  }

  function create(container, opts) {
    container.classList.add('combo');
    container.innerHTML =
      '<input type="text" autocomplete="off"><button type="button" class="combo-clear" tabindex="-1">&times;</button><div class="combo-list" hidden></div>';
    const input = container.querySelector('input');
    const clearBtn = container.querySelector('.combo-clear');
    const list = container.querySelector('.combo-list');
    input.placeholder = (opts && opts.placeholder) || '';

    let items = [];
    let value = '';
    let active = -1;
    let currentMatches = [];

    function fire() { if (opts && opts.onChange) opts.onChange(value); }

    function labelOf(v) {
      const it = items.find(i => String(i.value) === String(v));
      return it ? it.label : '';
    }

    function renderList() {
      const q = normalize(input.value);
      currentMatches = (q ? items.filter(i => normalize(i.label).includes(q)) : items).slice(0, 100);
      list.innerHTML = currentMatches.length
        ? currentMatches.map((i, idx) => `<div class="combo-item${idx === active ? ' active' : ''}" data-v="${i.value}">${i.label}</div>`).join('')
        : '<div class="combo-empty">Không tìm thấy</div>';
      list.hidden = false;
      list.querySelectorAll('.combo-item').forEach(el => {
        // mousedown fires before the input's blur, so the click still registers
        el.addEventListener('mousedown', (e) => { e.preventDefault(); select(el.dataset.v); });
      });
      const activeEl = list.querySelector('.combo-item.active');
      if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
    }

    function select(v) {
      value = String(v);
      input.value = labelOf(v);
      list.hidden = true;
      active = -1;
      fire();
    }

    function clear(fireChange) {
      value = '';
      input.value = '';
      list.hidden = true;
      active = -1;
      if (fireChange !== false) fire();
    }

    input.addEventListener('focus', () => { active = -1; renderList(); });
    input.addEventListener('input', () => {
      active = -1;
      renderList();
      if (input.value === '' && value !== '') { value = ''; fire(); }
    });
    input.addEventListener('keydown', (e) => {
      if (list.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, currentMatches.length - 1); renderList(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); renderList(); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (active >= 0 && currentMatches[active]) select(currentMatches[active].value);
        else if (currentMatches.length === 1) select(currentMatches[0].value);
      }
      else if (e.key === 'Escape') { list.hidden = true; }
    });
    input.addEventListener('blur', () => {
      setTimeout(() => {
        list.hidden = true;
        input.value = value ? labelOf(value) : '';
      }, 150);
    });
    clearBtn.addEventListener('click', () => { clear(); input.focus(); });

    return {
      setItems(newItems) {
        items = newItems;
        if (value && !items.some(i => String(i.value) === String(value))) {
          clear(false);
        } else if (value) {
          input.value = labelOf(value);
        }
      },
      getValue: () => value,
      setValue(v) {
        if (v === '' || v === null || v === undefined) { clear(false); }
        else { value = String(v); input.value = labelOf(v); }
      },
    };
  }

  return { create, normalize };
})();
