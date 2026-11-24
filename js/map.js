// Mapa geral de Florianópolis: ondulação (cor + seta + altura/período) e vento (seta + km/h),
// com controle de tempo para navegar pelos 7 dias de previsão.
(function () {
  const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'L', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  const compass = d => d == null ? '—' : COMPASS[Math.round(((d % 360) + 360) % 360 / 22.5) % 16];

  // Escalas de cor
  const WAVE_STOPS = [[0, '#1e3a8a'], [0.5, '#2563eb'], [1, '#06b6d4'], [1.5, '#10b981'], [2, '#eab308'], [2.5, '#f97316'], [3, '#ef4444'], [4, '#a21caf']];
  const WIND_STOPS = [[0, '#cbd5e1'], [10, '#86efac'], [20, '#facc15'], [30, '#fb923c'], [40, '#ef4444'], [55, '#d946ef']];
  function lerpColor(stops, v) {
    if (v == null) return '#334155';
    if (v <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) {
      if (v <= stops[i][0]) {
        const [a, ca] = stops[i - 1], [b, cb] = stops[i];
        const t = (v - a) / (b - a);
        const p = c => [1, 3, 5].map(j => parseInt(c.slice(j, j + 2), 16));
        const A = p(ca), B = p(cb);
        return '#' + A.map((x, j) => Math.round(x + (B[j] - x) * t).toString(16).padStart(2, '0')).join('');
      }
    }
    return stops[stops.length - 1][1];
  }
  const waveColor = v => lerpColor(WAVE_STOPS, v);
  const windColor = v => lerpColor(WIND_STOPS, v);

  // Seta que aponta para onde vai (dir = de onde vem)
  const arrowSvg = (dir, color, size) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="transform:rotate(${(dir + 180) % 360}deg)"><path d="M12 1 L20 21 L12 16.5 L4 21 Z" fill="${color}" stroke="#04141f" stroke-width="1.4" stroke-linejoin="round"/></svg>`;

  function legendHtml() {
    const grad = (stops, max) => 'linear-gradient(90deg,' + stops.map(([v, c]) => `${c} ${(v / max * 100).toFixed(0)}%`).join(',') + ')';
    return `
      <div class="lg"><span class="lg-t">Ondas (m)</span><div class="lg-bar" style="background:${grad(WAVE_STOPS, 4)}"></div>
        <div class="lg-ticks"><span>0</span><span>1</span><span>2</span><span>3</span><span>4+</span></div></div>
      <div class="lg"><span class="lg-t">Vento (km/h)</span><div class="lg-bar" style="background:${grad(WIND_STOPS, 55)}"></div>
        <div class="lg-ticks"><span>0</span><span>10</span><span>20</span><span>30</span><span>40</span><span>55+</span></div></div>`;
  }

  const fmtTime = t => {
    const d = new Date(t);
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '') + ' · ' + t.slice(11, 16);
  };

  /**
   * container: elemento onde o mapa será montado.
   * grid: resultado de API.fetchGrid(); beaches: DATA.beaches (opcional).
   */
  function mount(container, grid, beachData, opts = {}) {
    const times = grid.times;
    const now = Date.now();
    let idx = 0;
    times.forEach((t, i) => { if (new Date(t).getTime() <= now) idx = i; });
    let mode = 'both';
    const narrow = container.clientWidth < 600;
    let timer = null;

    container.innerHTML = `
      <div class="fmap">
        <div class="fmap-bar">
          <div class="seg" role="group" aria-label="Camadas">
            <button data-m="waves">Ondulação</button>
            <button data-m="wind">Vento</button>
            <button data-m="both" class="active">Ambos</button>
          </div>
          <div class="time-ctl">
            <button class="icon-btn" data-step="-3" title="−3 h">⏮</button>
            <button class="icon-btn play" title="Animar">▶</button>
            <button class="icon-btn" data-step="3" title="+3 h">⏭</button>
            <span class="time-label"></span>
            <button class="btn-link now-btn">Agora</button>
          </div>
        </div>
        <input type="range" class="time-slider" min="0" max="${times.length - 1}" step="1" value="${idx}" aria-label="Horário da previsão">
        <div class="fmap-map" style="height:${narrow ? 520 : (opts.height || 560)}px"></div>
        <div class="fmap-legend">${legendHtml()}</div>
      </div>`;

    const mapEl = container.querySelector('.fmap-map');
    const map = L.map(mapEl, { scrollWheelZoom: false, zoomSnap: 0.5 }).setView([-27.62, narrow ? -48.46 : -48.40], opts.zoom || 10);
    const esri = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/';
    L.tileLayer(esri + 'World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 16, attribution: 'Tiles &copy; Esri, HERE, Garmin, &copy; OpenStreetMap',
    }).addTo(map);
    map.createPane('labels');
    map.getPane('labels').style.zIndex = 450;
    map.getPane('labels').style.pointerEvents = 'none';
    L.tileLayer(esri + 'World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16, pane: 'labels' }).addTo(map);

    const half = grid.step / 2;
    const rectLayer = L.layerGroup().addTo(map);
    const cellLayer = L.layerGroup().addTo(map);
    const beachLayer = L.layerGroup().addTo(map);

    // Uma célula = retângulo colorido (ondas) + marcador com seta/valor de ondas e de vento.
    const cells = grid.cells.map(c => {
      const rect = c.wave ? L.rectangle([[c.lat - half, c.lon - half], [c.lat + half, c.lon + half]], {
        stroke: false, fillOpacity: 0.38, interactive: false,
      }).addTo(rectLayer) : null;
      const mk = L.marker([c.lat, c.lon], { icon: L.divIcon({ className: 'cell-wrap', iconSize: [64, 60], iconAnchor: [32, 30] }) }).addTo(cellLayer);
      mk.bindPopup(() => {
        const i = idx, w = c.wave, v = c.wind;
        return `<b>${fmtTime(times[i])}</b><br>` +
          (w ? `Ondas <b>${w.h[i] ?? '—'} m</b> · ${w.p[i] ?? '—'} s · de ${compass(w.d[i])} (${w.d[i] ?? '—'}°)<br>
          &nbsp;&nbsp;&nbsp;Swell: ${w.sh[i] ?? '—'} m · ${w.sp[i] ?? '—'} s · de ${compass(w.sd[i])}<br>
          &nbsp;&nbsp;&nbsp;Vaga de vento: ${w.ww[i] ?? '—'} m<br>` : '') +
          `Vento <b>${v.s[i]} km/h</b> (rajada ${v.g[i]}) de ${compass(v.d[i])} (${v.d[i]}°)`;
      });
      return { c, rect, mk };
    });

    // Praias
    const beaches = (window.BEACHES || []).filter(b => beachData && beachData[b.id]);
    const beachMk = beaches.map(b => {
      const hrs = beachData[b.id].hours;
      const tIdx = {}; hrs.forEach((h, i) => { tIdx[h.time] = i; });
      const mk = L.marker([b.lat, b.lon], { icon: L.divIcon({ className: 'bch-wrap', iconSize: [10, 10], iconAnchor: [5, 5] }), zIndexOffset: 1000 }).addTo(beachLayer);
      mk.bindPopup(() => {
        const h = hrs[tIdx[times[idx]]];
        if (!h) return b.name;
        return `<b>${b.name}</b> · ${fmtTime(times[idx])}<br>
          Surf ~<b>${h.surf.toFixed(1)} m</b> · nota ${h.rating.toFixed(1)}/5<br>
          Vento ${Math.round(h.wind_speed_10m)} km/h ${compass(h.wind_direction_10m)} (${h.windLabel})<br>
          <a href="#/praia/${b.id}">Ver previsão →</a>`;
      });
      mk.bindTooltip(b.name, { direction: 'left', offset: [-6, 0], className: 'bch-tip' });
      return { b, mk, hrs, tIdx };
    });

    function render() {
      container.querySelector('.time-label').textContent = fmtTime(times[idx]);
      container.querySelector('.time-slider').value = idx;
      cells.forEach(({ c, rect, mk }) => {
        const w = c.wave, v = c.wind;
        let html = '';
        if (w && w.h[idx] != null) {
          rect.setStyle({ fillColor: waveColor(w.h[idx]) });
          html += `<div class="wv">${w.d[idx] != null ? arrowSvg(w.d[idx], '#e0f2fe', 16) : ''}<span><b>${w.h[idx].toFixed(1)}</b>m<small>${w.p[idx] ?? ''}s</small></span></div>`;
        }
        const s = v.s[idx];
        if (s != null) {
          html += `<div class="wd">${arrowSvg(v.d[idx], windColor(s), 13 + Math.min(9, s / 4))}<span style="color:${windColor(s)}">${s}<small>km/h</small></span></div>`;
        }
        mk.setIcon(L.divIcon({ className: 'cell-wrap' + (w ? '' : ' land'), iconSize: [64, 60], iconAnchor: [32, 30], html: `<div class="cell">${html}</div>` }));
      });
      beachMk.forEach(({ mk, hrs, tIdx }) => {
        const h = hrs[tIdx[times[idx]]];
        const r = h ? Math.round(h.rating) : 0;
        mk.setIcon(L.divIcon({ className: 'bch-wrap', iconSize: [10, 10], iconAnchor: [5, 5], html: `<i class="bch r${r}"></i>` }));
      });
      if (opts.onTime) opts.onTime(idx);
    }

    function setMode(m) {
      mode = m;
      container.querySelectorAll('.seg button').forEach(b => b.classList.toggle('active', b.dataset.m === m));
      if (m === 'wind') map.removeLayer(rectLayer); else rectLayer.addTo(map);
      mapEl.classList.toggle('mode-waves', m === 'waves');
      mapEl.classList.toggle('mode-wind', m === 'wind');
    }
    function setIdx(i) { idx = Math.max(0, Math.min(times.length - 1, i)); render(); }
    function stop() { if (timer) { clearInterval(timer); timer = null; container.querySelector('.play').textContent = '▶'; } }

    container.querySelectorAll('.seg button').forEach(b => b.onclick = () => setMode(b.dataset.m));
    container.querySelectorAll('[data-step]').forEach(b => b.onclick = () => { stop(); setIdx(idx + +b.dataset.step); });
    container.querySelector('.time-slider').oninput = e => { stop(); setIdx(+e.target.value); };
    container.querySelector('.now-btn').onclick = () => {
      stop(); let i = 0; times.forEach((t, j) => { if (new Date(t).getTime() <= Date.now()) i = j; }); setIdx(i);
    };
    container.querySelector('.play').onclick = e => {
      if (timer) return stop();
      e.target.textContent = '⏸';
      timer = setInterval(() => setIdx(idx + 3 >= times.length ? 0 : idx + 3), 700);
    };
    // Em zoom baixo, esconde os números para não poluir
    const zoomCls = () => mapEl.classList.toggle('compact', map.getZoom() < 10);
    map.on('zoomend', zoomCls); zoomCls();

    setMode(mode);
    render();
    return { map, remove() { stop(); map.remove(); } };
  }

  window.FloripaMap = { mount, waveColor, windColor };
})();
