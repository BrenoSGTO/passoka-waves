// "Mapas e espectro": satélite da praia + espectro polar direcional (período × direção, cor = energia),
// setas dos componentes (vagas, swell 1, swell 2), vento e linha do tempo.
(function () {
  const COMPASS8 = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];
  const C16 = ['N', 'NNE', 'NE', 'ENE', 'L', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  const c16 = d => d == null ? '—' : C16[Math.round(((d % 360) + 360) % 360 / 22.5) % 16];
  const RHO_G_16 = 1025 * 9.81 / 16; // E = ρ g H² / 16  (J/m²)

  // Escala de energia (J/m²)
  const ENERGY = [
    [6, '#1e2a6e'], [15, '#2f6fe0'], [30, '#45a6e0'], [40, '#4fd0d6'], [60, '#4fdba0'], [80, '#5ad65a'],
    [100, '#a6e04a'], [130, '#e6e04a'], [170, '#e8bb3c'], [210, '#ec8f35'], [260, '#ea6a2c'],
    [290, '#d93030'], [340, '#b8305a'], [400, '#c03aa0'], [460, '#a070c0'],
  ];
  const energyColor = e => {
    let c = null;
    for (const [v, col] of ENERGY) if (e >= v) c = col;
    return c;
  };

  const COMP = [
    { key: 'wind_wave', label: 'Vagas', color: '#7ee08a', sigD: 28, sigT: 0.16 },
    { key: 'swell_wave', label: 'Swell 1', color: '#f0908a', sigD: 14, sigT: 0.09 },
    { key: 'secondary_swell_wave', label: 'Swell 2', color: '#9a9cf5', sigD: 14, sigT: 0.09 },
  ];

  const NS = 'http://www.w3.org/2000/svg';
  const rad = d => d * Math.PI / 180;

  // ---------- desenho do espectro (string SVG) ----------
  function spectrumSvg(beach, h, S) {
    const C = S / 2, R = S / 2 - 34; // raio do anel de 20 s
    const TMAX = 20;
    const rT = T => Math.min(1.12, T / TMAX) * R;
    const P = (dir, r) => [C + r * Math.sin(rad(dir)), C - r * Math.cos(rad(dir))];
    const half = 100; // semi-abertura (graus) do setor desenhado, voltado para o mar
    const f = beach.facing;
    let out = '';

    // Bins do espectro: 6° × 1 s
    const bins = {};
    COMP.forEach(c => {
      const H = h[c.key + '_height'], D = h[c.key + '_direction'], T = h[c.key + '_period'];
      if (!H || D == null || !T) return;
      const E = RHO_G_16 * H * H;
      for (let dd = -3 * c.sigD; dd <= 3 * c.sigD; dd += 6) {
        for (let t = Math.max(2, Math.round(T - 3 * c.sigT * T)); t <= Math.min(24, Math.round(T + 3 * c.sigT * T)); t++) {
          const g = Math.exp(-0.5 * (dd / c.sigD) ** 2) * Math.exp(-0.5 * ((t - T) / (c.sigT * T)) ** 2);
          const dir = Math.round((D + dd) / 6) * 6;
          const k = ((dir % 360) + 360) % 360 + '|' + t;
          bins[k] = (bins[k] || 0) + E * g;
        }
      }
    });
    const wedge = (d0, d1, r0, r1) => {
      const [x0, y0] = P(d0, r0), [x1, y1] = P(d1, r0), [x2, y2] = P(d1, r1), [x3, y3] = P(d0, r1);
      return `M${x0.toFixed(1)},${y0.toFixed(1)} A${r0},${r0} 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)} A${r1},${r1} 0 0 0 ${x3.toFixed(1)},${y3.toFixed(1)} Z`;
    };
    Object.entries(bins).sort((a, b) => a[1] - b[1]).forEach(([k, e]) => {
      const col = energyColor(e);
      if (!col) return;
      const [dir, t] = k.split('|').map(Number);
      out += `<path d="${wedge(dir - 3, dir + 3, rT(t - 0.5), rT(t + 0.5))}" fill="${col}" fill-opacity="0.92"><title>${t}s · ${dir}° · ${Math.round(e)} J</title></path>`;
    });

    // Anéis de período (arcos tracejados no lado do mar)
    [5, 10, 15, 20].forEach(T => {
      const r = rT(T);
      const [ax, ay] = P(f - half, r), [bx, by] = P(f + half, r);
      out = `<path d="M${ax},${ay} A${r},${r} 0 ${half * 2 > 180 ? 1 : 0} 1 ${bx},${by}" class="sp-ring"/>` + out;
    });
    // Raios cardeais dentro do setor
    for (let i = 0; i < 8; i++) {
      const d = i * 45;
      if (API.angDiff(d, f) > half) continue;
      const [x, y] = P(d, rT(20)), [lx, ly] = P(d, rT(20) + 14);
      out = `<line x1="${C}" y1="${C}" x2="${x}" y2="${y}" class="sp-spoke"/>` + out;
      out += `<text x="${lx}" y="${ly + 4}" class="sp-card" text-anchor="middle">${COMPASS8[i]}</text>`;
    }
    // Rótulos de período ao longo do raio da orientação da praia
    [5, 10, 15, 20].forEach(T => {
      const [x, y] = P(f, rT(T));
      out += `<text x="${x}" y="${y + 4}" class="sp-tick" text-anchor="middle">${T}</text>`;
    });

    // Setas dos componentes, na borda, apontando para o centro
    COMP.forEach(c => {
      const H = h[c.key + '_height'], D = h[c.key + '_direction'];
      if (!H || H < 0.05 || D == null) return;
      const r0 = rT(20) + 4, len = 26;
      const [x, y] = P(D, r0);
      const rot = D; // ponta no anel, apontando para o centro
      out += `<g transform="translate(${x},${y}) rotate(${rot})">
        <path d="M-5,-${len} L5,-${len} L5,-11 L10,-11 L0,0 L-10,-11 L-5,-11 Z" fill="${c.color}" stroke="#0b1d2e" stroke-width="1"/></g>`;
      const [lx, ly] = P(D, r0 + len + 14);
      out += `<g class="sp-lbl"><rect x="${lx - 22}" y="${ly - 15}" width="44" height="30" rx="4" fill="#132f45" fill-opacity=".92" stroke="${c.color}"/>
        <text x="${lx}" y="${ly - 2}" text-anchor="middle">${H.toFixed(1)}m</text>
        <text x="${lx}" y="${ly + 11}" text-anchor="middle" class="sm">${Math.round(D)}°</text></g>`;
    });

    // Vento: pino amarelo no centro apontando para onde o vento sopra
    const ws = h.wind_speed_10m, wd = h.wind_direction_10m;
    if (ws != null && wd != null) {
      const len = Math.max(26, Math.min(R * 0.55, 18 + ws * 2.2));
      const to = (wd + 180) % 360;
      const [ex, ey] = P(to, len);
      const [hx1, hy1] = P(to - 160, 11), [hx2, hy2] = P(to + 160, 11);
      out += `<line x1="${C}" y1="${C}" x2="${ex}" y2="${ey}" stroke="#0b1d2e" stroke-width="6" stroke-linecap="round"/>
        <line x1="${C}" y1="${C}" x2="${ex}" y2="${ey}" stroke="#facc15" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M${ex},${ey} L${ex + hx1 - C},${ey + hy1 - C} L${ex + hx2 - C},${ey + hy2 - C} Z" fill="#facc15" stroke="#0b1d2e" stroke-width="1"/>
        <circle cx="${C}" cy="${C}" r="7" fill="#facc15" stroke="#0b1d2e" stroke-width="1.5"/>`;
      const [tx, ty] = P(wd, 22);
      out += `<g class="sp-lbl"><rect x="${tx - 26}" y="${ty - 10}" width="52" height="20" rx="3" fill="#fff"/>
        <text x="${tx}" y="${ty + 4}" text-anchor="middle" class="dark">${Math.round(ws)} km/h</text></g>`;
    }
    return `<svg xmlns="${NS}" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" class="spec-svg">${out}</svg>`;
  }

  // ---------- componente ----------
  function mount(container, beachData, opts = {}) {
    const B = window.BEACHES;
    let beach = B.find(b => b.id === opts.beachId) || B.find(b => b.id === 'joaquina');
    let hours = beachData[beach.id].hours;
    const now = Date.now();
    let idx = 0;
    hours.forEach((h, i) => { if (new Date(h.time).getTime() <= now) idx = i; });
    let timer = null;

    container.innerHTML = `
      <div class="spec">
        ${opts.selector === false ? '' : `<div class="spec-beaches">${B.map(b => `<button data-b="${b.id}">${b.name}</button>`).join('')}</div>`}
        <div class="spec-legend">
          <div class="spec-comp"><span class="t">Componentes</span>
            ${COMP.map(c => `<span class="ci"><svg width="16" height="18" viewBox="-10 -26 20 28"><path d="M-5,-26 L5,-26 L5,-11 L10,-11 L0,0 L-10,-11 L-5,-11 Z" fill="${c.color}"/></svg>${c.label}</span>`).join('')}
            <span class="ci"><svg width="22" height="18" viewBox="0 0 22 18"><line x1="4" y1="14" x2="17" y2="4" stroke="#facc15" stroke-width="3" stroke-linecap="round"/><circle cx="4" cy="14" r="3.5" fill="#facc15"/></svg>Vento</span>
          </div>
        </div>
        <div class="spec-map-wrap">
          <div class="spec-badge">SATÉLITE</div>
          <div class="spec-map"></div>
        </div>
        <div class="spec-info"></div>
        <div class="spec-energy">
          <div class="t">Energia (J/m²)</div>
          <div class="bar">${ENERGY.map(([v, c]) => `<span style="background:${c}">${v}</span>`).join('')}</div>
        </div>
        <div class="spec-time">
          <button class="spec-play" title="Animar">▶</button>
          <div class="spec-days"></div>
        </div>
      </div>`;

    const mapEl = container.querySelector('.spec-map');
    const map = L.map(mapEl, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18, attribution: 'Imagens &copy; Esri, Maxar, comunidade GIS',
    }).addTo(map);
    let marker = null;

    function size() { return Math.max(240, Math.min(400, mapEl.clientWidth - 20, mapEl.clientHeight - 10)); }
    function center(b) {
      // centro do espectro ~600 m mar adentro
      const d = 0.0055, r = rad(b.facing);
      return [b.lat + d * Math.cos(r), b.lon + d * Math.sin(r) / Math.cos(rad(b.lat))];
    }
    function placeBeach(b, animate) {
      beach = b; hours = beachData[b.id].hours;
      const c = center(b);
      // desloca a vista para o lado do mar, para caber o espectro
      const z = mapEl.clientWidth < 500 ? 14 : 15;
      // desloca a vista para o lado do mar (~20% da largura), para caber o espectro e ainda mostrar a praia
      const px = mapEl.clientWidth * 0.2;
      const off = L.point(px * Math.sin(rad(b.facing)), -px * Math.cos(rad(b.facing)));
      const view = map.unproject(map.project(L.latLng(c[0], c[1]), z).add(off), z);
      if (animate) map.flyTo(view, z, { duration: 0.8 }); else map.setView(view, z);
      if (marker) marker.remove();
      marker = L.marker(c, { interactive: false, keyboard: false, icon: L.divIcon({ className: 'spec-wrap' }) }).addTo(map);
      container.querySelectorAll('.spec-beaches button').forEach(x => x.classList.toggle('active', x.dataset.b === b.id));
      const act = container.querySelector('.spec-beaches .active');
      if (act) act.scrollIntoView({ block: 'nearest', inline: 'center', behavior: animate ? 'smooth' : 'auto' });
      render();
    }

    function buildDays() {
      const days = {};
      hours.forEach((h, i) => {
        const hr = +h.time.slice(11, 13);
        if (hr % 3) return;
        const k = h.time.slice(0, 10);
        (days[k] = days[k] || []).push(i);
      });
      container.querySelector('.spec-days').innerHTML = Object.entries(days).map(([k, ids]) => {
        const d = new Date(k + 'T12:00');
        const lbl = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase() + ' ' + d.getDate();
        return `<div class="sd"><div class="sd-hours">${ids.map(i => `<button data-i="${i}" title="${hours[i].time.slice(11, 16)}">${+hours[i].time.slice(11, 13)}h</button>`).join('')}</div><div class="sd-lbl">${lbl}</div></div>`;
      }).join('');
      container.querySelectorAll('.spec-days button').forEach(b => b.onclick = () => { stop(); idx = +b.dataset.i; render(); });
    }

    function render() {
      const h = hours[idx];
      const S = size();
      marker.setIcon(L.divIcon({ className: 'spec-wrap', iconSize: [S, S], iconAnchor: [S / 2, S / 2], html: spectrumSvg(beach, h, S) }));
      const d = new Date(h.time);
      const comp = COMP.map(c => {
        const H = h[c.key + '_height'];
        return `<div class="si"><i style="background:${c.color}"></i><span class="k">${c.label}</span>
          <b>${H == null ? '—' : H.toFixed(1) + ' m'}</b> ${h[c.key + '_period'] != null ? Math.round(h[c.key + '_period']) + 's' : ''}
          ${h[c.key + '_direction'] != null ? c16(h[c.key + '_direction']) + ' ' + Math.round(h[c.key + '_direction']) + '°' : ''}</div>`;
      }).join('');
      container.querySelector('.spec-info').innerHTML = `
        <div class="si-head"><a href="#/praia/${beach.id}"><b>${beach.name}</b></a> · ${d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })} ${h.time.slice(11, 16)}
          <span class="si-surf">Surf ~${h.surf.toFixed(1)} m · nota ${h.rating.toFixed(1)}</span></div>
        <div class="si-row">${comp}
          <div class="si"><i style="background:#facc15"></i><span class="k">Vento</span><b>${Math.round(h.wind_speed_10m)} km/h</b>
            ${Math.round(h.wind_speed_10m / 1.852)} kt · ${c16(h.wind_direction_10m)} <em class="wk ${h.windKind}">${h.windLabel}</em></div>
        </div>`;
      container.querySelectorAll('.spec-days button').forEach(b => b.classList.toggle('active', +b.dataset.i === idx));
      const nowB = container.querySelector('.spec-days button.active');
      if (nowB && !render.scrolled) { nowB.scrollIntoView({ block: 'nearest', inline: 'center' }); render.scrolled = true; }
      if (opts.onTime) opts.onTime(idx);
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; container.querySelector('.spec-play').textContent = '▶'; } }
    container.querySelector('.spec-play').onclick = e => {
      if (timer) return stop();
      e.target.textContent = '⏸';
      timer = setInterval(() => {
        let n = idx + 3; while (n < hours.length && +hours[n].time.slice(11, 13) % 3) n++;
        idx = n >= hours.length ? 0 : n; render();
      }, 900);
    };
    container.querySelectorAll('.spec-beaches button').forEach(b => b.onclick = () => placeBeach(B.find(x => x.id === b.dataset.b), true));
    if (idx % 3) idx -= +hours[idx].time.slice(11, 13) % 3;

    buildDays();
    placeBeach(beach, false);
    const onResize = () => render();
    window.addEventListener('resize', onResize);
    return { map, remove() { stop(); window.removeEventListener('resize', onResize); map.remove(); } };
  }

  window.Spectrum = { mount, spectrumSvg };
})();
