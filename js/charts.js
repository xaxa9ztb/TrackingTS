// Lightweight canvas/SVG chart helpers (no external chart library needed)
const Charts = (() => {

  const PALETTE = ['#2f7ed8', '#1b4f8a', '#e08030', '#8e44ad', '#d63384', '#27ae60', '#f2b705', '#16a085', '#c0392b', '#7f8c8d'];

  function colorFor(index) {
    return PALETTE[index % PALETTE.length];
  }

  function renderPie(canvas, slices) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    const W = Math.max(320, rect.width);
    const H = Math.max(260, rect.height);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const total = slices.reduce((s, x) => s + x.value, 0);
    const cx = W / 2, cy = H / 2;
    const r = Math.max(55, Math.min(W / 2 - 130, H / 2 - 40));

    if (total <= 0) {
      ctx.fillStyle = '#9aa5b1';
      ctx.font = '13px Segoe UI';
      ctx.textAlign = 'center';
      ctx.fillText('Không có dữ liệu', cx, cy);
      return;
    }

    // draw slices
    let start = -Math.PI / 2;
    const labels = [];
    slices.forEach(s => {
      const angle = (s.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, start + angle);
      ctx.closePath();
      ctx.fillStyle = s.color;
      ctx.fill();

      const mid = start + angle / 2;
      const pct = (s.value / total) * 100;
      labels.push({
        name: s.label,
        pct: pct.toFixed(1).replace('.', ',') + '%',
        mid,
        side: Math.cos(mid) >= 0 ? 1 : -1,
      });
      start += angle;
    });

    // outside labels with leader lines, spaced vertically per side to avoid overlap
    const lineH = 13, blockH = lineH * 2 + 4;
    ['left', 'right'].forEach(sideName => {
      const side = sideName === 'right' ? 1 : -1;
      const group = labels.filter(l => l.side === side);
      group.sort((a, b) => (cy + Math.sin(a.mid) * r) - (cy + Math.sin(b.mid) * r));
      // initial desired y, then push down to enforce spacing, then pull back within canvas
      group.forEach(l => l.y = cy + Math.sin(l.mid) * (r + 18));
      for (let i = 1; i < group.length; i++) {
        if (group[i].y - group[i - 1].y < blockH) group[i].y = group[i - 1].y + blockH;
      }
      const maxY = H - blockH / 2;
      for (let i = group.length - 1; i >= 0; i--) {
        if (group[i].y > maxY) group[i].y = maxY;
        if (i < group.length - 1 && group[i + 1].y - group[i].y < blockH) {
          group[i].y = group[i + 1].y - blockH;
        }
      }
      group.forEach(l => {
        const ax = cx + Math.cos(l.mid) * r;
        const ay = cy + Math.sin(l.mid) * r;
        const ex = cx + Math.cos(l.mid) * (r + 10);
        const labelX = side === 1 ? cx + r + 34 : cx - r - 34;

        ctx.strokeStyle = '#9aa5b1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ex, l.y);
        ctx.lineTo(labelX - side * 4, l.y);
        ctx.stroke();

        ctx.fillStyle = '#333';
        ctx.textAlign = side === 1 ? 'left' : 'right';
        ctx.font = '12px Segoe UI';
        ctx.fillText(l.name, labelX, l.y - 2);
        ctx.font = 'bold 12px Segoe UI';
        ctx.fillText(l.pct, labelX, l.y + lineH);
      });
    });
  }

  // Semi-circle gauge: value vs max (can exceed max, shown in red overflow arc)
  function renderGauge(svg, value, max) {
    const w = 240, h = 140;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const cx = w / 2, cy = h - 10, r = 100;

    function polar(cx, cy, r, angleDeg) {
      const a = (angleDeg - 180) * Math.PI / 180;
      return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    }
    function arcPath(startAngle, endAngle) {
      const p1 = polar(cx, cy, r, startAngle);
      const p2 = polar(cx, cy, r, endAngle);
      const largeArc = (endAngle - startAngle) > 180 ? 1 : 0;
      return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y}`;
    }

    const safeMax = max > 0 ? max : (value > 0 ? value : 1);
    const ratio = Math.min(value / safeMax, 1);
    const overflow = value > safeMax;
    const filledAngle = 180 * (overflow ? 1 : ratio);

    let html = '';
    html += `<path d="${arcPath(0, 180)}" fill="none" stroke="#e2e6ea" stroke-width="18" stroke-linecap="round"/>`;
    html += `<path d="${arcPath(0, filledAngle)}" fill="none" stroke="${overflow ? '#c0392b' : '#2f7ed8'}" stroke-width="18" stroke-linecap="round"/>`;
    svg.innerHTML = html;
  }

  return { renderPie, renderGauge, colorFor, PALETTE };
})();
