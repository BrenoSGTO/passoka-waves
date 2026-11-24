// Gráficos SVG leves (sem dependências).
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const pad2 = n => String(n).padStart(2, '0');
  const fmtHM = t => { const d = new Date(t); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // Curva de maré de um dia, com marcação de preamar/baixa-mar e "agora".
  function tideChart(container, dayHours, extremes, sun) {
    container.innerHTML = '';
    const W = 720, H = 220, L = 40, R = 12, T = 28, B = 28;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': 'Gráfico de maré' }, container);
    const pts = dayHours.filter(h => h.sea_level_height_msl != null);
    if (!pts.length) { container.innerHTML = '<p class="muted">Sem dados de maré.</p>'; return; }
    const t0 = new Date(dayHours[0].time).getTime(), t1 = t0 + 24 * 3600000;
    const vals = pts.map(p => p.sea_level_height_msl);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const m = Math.max(0.1, (hi - lo) * 0.2); lo -= m; hi += m;
    const x = t => L + (t - t0) / (t1 - t0) * (W - L - R);
    const y = v => T + (hi - v) / (hi - lo) * (H - T - B);

    // Noite sombreada
    if (sun) {
      const sr = new Date(sun.sunrise).getTime(), ss = new Date(sun.sunset).getTime();
      el('rect', { x: L, y: T, width: Math.max(0, x(sr) - L), height: H - T - B, class: 'night' }, svg);
      el('rect', { x: x(ss), y: T, width: Math.max(0, W - R - x(ss)), height: H - T - B, class: 'night' }, svg);
    }
    // Grade
    for (let hh = 0; hh <= 24; hh += 3) {
      const xx = x(t0 + hh * 3600000);
      el('line', { x1: xx, x2: xx, y1: T, y2: H - B, class: 'grid' }, svg);
      const tx = el('text', { x: xx, y: H - 8, class: 'axis', 'text-anchor': 'middle' }, svg);
      tx.textContent = pad2(hh % 24) + 'h';
    }
    const step = (hi - lo) > 1 ? 0.5 : 0.2;
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid' }, svg);
      const tx = el('text', { x: L - 6, y: y(v) + 4, class: 'axis', 'text-anchor': 'end' }, svg);
      tx.textContent = v.toFixed(1);
    }
    // Área + linha
    const line = pts.map((p, i) => (i ? 'L' : 'M') + x(new Date(p.time).getTime()).toFixed(1) + ',' + y(p.sea_level_height_msl).toFixed(1)).join(' ');
    const lastX = x(new Date(pts[pts.length - 1].time).getTime()), firstX = x(new Date(pts[0].time).getTime());
    el('path', { d: line + ` L${lastX},${H - B} L${firstX},${H - B} Z`, class: 'tide-area' }, svg);
    el('path', { d: line, class: 'tide-line' }, svg);
    // Extremos
    extremes.filter(e => e.time >= t0 && e.time < t1).forEach(e => {
      const cx = x(e.time), cy = y(e.level);
      el('circle', { cx, cy, r: 4, class: e.type === 'high' ? 'dot-high' : 'dot-low' }, svg);
      const tx = el('text', { x: cx, y: e.type === 'high' ? cy - 10 : cy + 18, class: 'label', 'text-anchor': 'middle' }, svg);
      tx.textContent = `${fmtHM(e.time)} · ${e.level.toFixed(2)}m`;
    });
    // Agora
    const now = Date.now();
    if (now >= t0 && now < t1) {
      el('line', { x1: x(now), x2: x(now), y1: T - 6, y2: H - B, class: 'now' }, svg);
    }
  }

  // Barras de altura de surf + linha de vento para toda a previsão (estilo Windguru).
  function overviewChart(container, hours, onPick) {
    container.innerHTML = '';
    const n = hours.length;
    const bw = 7, W = Math.max(700, n * bw + 50), H = 200, L = 34, T = 14, B = 30, R = 16;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'chart chart-wide', role: 'img', 'aria-label': 'Altura das ondas e vento' }, container);
    const maxS = Math.max(1, ...hours.map(h => h.surf || 0)) * 1.15;
    const maxW = Math.max(30, ...hours.map(h => h.wind_gusts_10m || 0));
    const x = i => L + i * bw;
    const y = v => T + (1 - v / maxS) * (H - T - B);
    const yw = v => T + (1 - v / maxW) * (H - T - B);
    for (let v = 0; v <= maxS; v += maxS > 3 ? 1 : 0.5) {
      el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid' }, svg);
      el('text', { x: L - 6, y: y(v) + 4, class: 'axis', 'text-anchor': 'end' }, svg).textContent = v.toFixed(1) + 'm';
    }
    hours.forEach((h, i) => {
      const d = new Date(h.time);
      if (d.getHours() === 0) {
        el('line', { x1: x(i), x2: x(i), y1: T, y2: H - B + 6, class: 'grid strong' }, svg);
        el('text', { x: x(i) + 4, y: H - 8, class: 'axis' }, svg).textContent =
          d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' });
      }
      const hv = h.surf || 0;
      const r = el('rect', { x: x(i) + 0.5, y: y(hv), width: bw - 1, height: Math.max(0, y(0) - y(hv)), class: 'bar r' + Math.round(h.rating), 'data-i': i }, svg);
      const tt = el('title', {}, r);
      tt.textContent = `${d.toLocaleString('pt-BR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })} · surf ${hv.toFixed(1)}m · vento ${Math.round(h.wind_speed_10m || 0)} km/h`;
    });
    const wl = hours.map((h, i) => (i ? 'L' : 'M') + (x(i) + bw / 2).toFixed(1) + ',' + yw(h.wind_speed_10m || 0).toFixed(1)).join(' ');
    el('path', { d: wl, class: 'wind-line' }, svg);
    const now = Date.now();
    const ni = hours.findIndex(h => new Date(h.time).getTime() > now) - 1;
    if (ni >= 0) el('line', { x1: x(ni) + bw / 2, x2: x(ni) + bw / 2, y1: T, y2: H - B, class: 'now' }, svg);
    if (onPick) svg.addEventListener('click', e => { const i = e.target.getAttribute('data-i'); if (i != null) onPick(+i); });
    return { scrollToIndex: i => { container.scrollLeft = Math.max(0, x(i) - 60); } };
  }

  window.Charts = { tideChart, overviewChart, fmtHM };
})();
