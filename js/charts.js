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
    // Valores a cada 3 h
    pts.forEach(p => {
      const hr = +p.time.slice(11, 13);
      if (hr % 3 !== 0 || hr === 0) return;
      const px = x(new Date(p.time).getTime()), py = y(p.sea_level_height_msl);
      el('circle', { cx: px, cy: py, r: 2, class: 'dot-small' }, svg);
      el('text', { x: px, y: py + 14, class: 'val', 'text-anchor': 'middle' }, svg).textContent = p.sea_level_height_msl.toFixed(2);
    });
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

  // Painel estilo Windguru: barras de surf com valores + linhas numéricas (swell, período, vento, rajada).
  function overviewChart(container, hours, onPick) {
    container.innerHTML = '<div class="ov"><div class="ov-left"></div><div class="ov-scroll"></div></div>';
    const left = container.querySelector('.ov-left'), scroller = container.querySelector('.ov-scroll');
    const n = hours.length;
    const LW = 74;
    const bw = 13, L = 4, R = 12, TOP = 22, BH = 150, ROW = 24;
    const rows = ['Hora', 'Período', 'Swell (m)', 'Energia J', 'Vento', 'Rajada', 'Dir. vento'];
    const yBars0 = TOP + 18, yBase = yBars0 + BH;
    const H = yBase + rows.length * ROW + 6;
    const W = L + n * bw + R;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'chart chart-wide', role: 'img', 'aria-label': 'Previsão de 7 dias com valores' }, scroller);
    const lsvg = el('svg', { viewBox: `0 0 ${LW} ${H}`, width: LW, height: H, class: 'chart chart-wide' }, left);
    const maxS = Math.max(1, ...hours.map(h => h.surf || 0)) * 1.2;
    const x = i => L + i * bw;
    const y = v => yBars0 + (1 - v / maxS) * BH;
    const windColor = v => (window.FloripaMap ? window.FloripaMap.windColor(v) : '#facc15');
    const arrowPath = (cx, cy, dir, size, fill, cls) => {
      const s = size / 24;
      el('path', {
        d: 'M12 1 L20 21 L12 16.5 L4 21 Z', ...(fill ? { fill } : {}), ...(cls ? { class: cls } : {}),
        transform: `translate(${cx - 12 * s},${cy - 12 * s}) scale(${s}) rotate(${(dir + 180) % 360} 12 12)`,
      }, svg);
    };

    for (let v = 0; v <= maxS; v += maxS > 3 ? 1 : 0.5) {
      el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid' }, svg);
      el('text', { x: LW - 6, y: y(v) + 4, class: 'axis', 'text-anchor': 'end' }, lsvg).textContent = v.toFixed(1) + ' m';
    }
    rows.forEach((name, r) => {
      const ry = yBase + r * ROW;
      if (r % 2 === 0) {
        el('rect', { x: 0, y: ry, width: W, height: ROW, class: 'row-band' }, svg);
        el('rect', { x: 0, y: ry, width: LW, height: ROW, class: 'row-band' }, lsvg);
      }
      el('text', { x: 8, y: ry + 16, class: 'row-name' }, lsvg).textContent = name;
    });

    hours.forEach((h, i) => {
      const d = new Date(h.time);
      const hr = d.getHours();
      if (hr === 0 || i === 0) {
        if (hr === 0) el('line', { x1: x(i), x2: x(i), y1: 4, y2: H, class: 'grid strong' }, svg);
        el('text', { x: x(i) + 5, y: 16, class: 'day-lbl' }, svg).textContent =
          d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
      }
      const hv = h.surf || 0;
      const rct = el('rect', { x: x(i) + 0.5, y: y(hv), width: bw - 1, height: Math.max(0, yBase - y(hv)), class: 'bar r' + h.pc, 'data-i': i }, svg);
      el('title', {}, rct).textContent = `${d.toLocaleString('pt-BR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })} · surf ${hv.toFixed(1)} m · ${h.per == null ? '—' : Math.round(h.per)} s`;

      // Valores a cada 3 h, centralizados na coluna de 3 horas
      if (hr % 3 !== 0) return;
      const cx = x(i) + bw * 1.5;
      if (i + 1 < n) el('text', { x: cx, y: y(hv) - 5, class: 'bar-val', 'text-anchor': 'middle' }, svg).textContent = hv.toFixed(1);
      const t = (r, txt, cls = 'cell') => { el('text', { x: cx, y: yBase + r * ROW + 16, class: cls, 'text-anchor': 'middle' }, svg).textContent = txt; };
      t(0, String(hr).padStart(2, '0') + 'h', 'cell muted-c');
      el('rect', { x: cx - 14, y: yBase + ROW + 4, width: 28, height: ROW - 8, class: 'r' + h.pc }, svg);
      t(1, h.per == null ? '—' : Math.round(h.per) + 's', 'cell dark');
      if (h.swell_wave_direction != null) arrowPath(cx - 12, yBase + 2 * ROW + 12, h.swell_wave_direction, 11, null, 'ar-sw');
      el('text', { x: cx + 5, y: yBase + 2 * ROW + 16, class: 'cell sw', 'text-anchor': 'middle' }, svg).textContent =
        h.swell_wave_height == null ? '—' : h.swell_wave_height.toFixed(1);
      t(3, h.energy == null ? '—' : String(Math.round(h.energy)));
      const ws = Math.round(h.wind_speed_10m || 0);
      el('rect', { x: cx - 14, y: yBase + 4 * ROW + 4, width: 28, height: ROW - 8, fill: windColor(ws), opacity: 0.75 }, svg);
      t(4, String(ws), 'cell dark');
      t(5, String(Math.round(h.wind_gusts_10m || 0)));
      if (h.wind_direction_10m != null) arrowPath(cx - 9, yBase + 6 * ROW + 12, h.wind_direction_10m, 12, null, 'ar-wd');
      el('text', { x: cx + 7, y: yBase + 6 * ROW + 16, class: 'cell small-c', 'text-anchor': 'middle' }, svg).textContent = COMPASS16(h.wind_direction_10m);
    });
    const now = Date.now();
    const ni = hours.findIndex(h => new Date(h.time).getTime() > now) - 1;
    if (ni >= 0) el('line', { x1: x(ni) + bw / 2, x2: x(ni) + bw / 2, y1: yBars0 - 10, y2: H, class: 'now' }, svg);
    if (onPick) svg.addEventListener('click', e => { const i = e.target.getAttribute('data-i'); if (i != null) onPick(+i); });
    return { scrollToIndex: i => { scroller.scrollLeft = Math.max(0, x(i) - 20); } };
  }
  const C16 = ['N', 'NNE', 'NE', 'ENE', 'L', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  const COMPASS16 = d => d == null ? '' : C16[Math.round(((d % 360) + 360) % 360 / 22.5) % 16];

  window.Charts = { tideChart, overviewChart, fmtHM };
})();
