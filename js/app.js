(function () {
  const $app = document.getElementById('app');
  const B = window.BEACHES;
  const byId = Object.fromEntries(B.map(b => [b.id, b]));
  let DATA = null;
  let leafletMap = null;

  // ---------- utilidades ----------
  const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'L', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  const compass = d => d == null ? '—' : COMPASS[Math.round(((d % 360) + 360) % 360 / 22.5) % 16];
  const f1 = v => v == null ? '—' : v.toFixed(1);
  const f0 = v => v == null ? '—' : Math.round(v);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pad2 = n => String(n).padStart(2, '0');

  // Seta apontando para onde a onda/vento VAI (dir é de onde vem).
  const arrow = (dir, cls = '') => dir == null ? '' :
    `<svg class="arrow ${cls}" viewBox="0 0 24 24" style="transform:rotate(${(dir + 180) % 360}deg)" aria-hidden="true"><path d="M12 2 L19 20 L12 16 L5 20 Z"/></svg>`;

  const RATING_TXT = ['Flat', 'Fraco', 'Regular', 'Bom', 'Muito bom', 'Clássico'];
  const ratingTxt = r => RATING_TXT[Math.max(0, Math.min(5, Math.round(r)))];
  const stars = r => {
    const n = Math.round(r);
    return `<span class="stars" title="${ratingTxt(r)} (${r.toFixed(1)}/5)">${'★'.repeat(n)}<i>${'★'.repeat(5 - n)}</i></span>`;
  };
  const surfRange = s => {
    if (s < 0.2) return 'flat';
    const lo = s * 0.8, hi = s * 1.25;
    return `${lo.toFixed(1)}–${hi.toFixed(1)} m`;
  };
  const WX = {
    0: ['☀️', 'Céu limpo'], 1: ['🌤️', 'Poucas nuvens'], 2: ['⛅', 'Parcialmente nublado'], 3: ['☁️', 'Nublado'],
    45: ['🌫️', 'Neblina'], 48: ['🌫️', 'Neblina'], 51: ['🌦️', 'Garoa'], 53: ['🌦️', 'Garoa'], 55: ['🌧️', 'Garoa forte'],
    61: ['🌧️', 'Chuva fraca'], 63: ['🌧️', 'Chuva'], 65: ['🌧️', 'Chuva forte'], 80: ['🌦️', 'Pancadas'], 81: ['🌧️', 'Pancadas'],
    82: ['⛈️', 'Pancadas fortes'], 95: ['⛈️', 'Trovoadas'], 96: ['⛈️', 'Trovoadas'], 99: ['⛈️', 'Trovoadas'],
  };
  const wx = c => WX[c] || ['·', ''];

  function nowIndex(hours) {
    const now = Date.now();
    let idx = 0;
    hours.forEach((h, i) => { if (new Date(h.time).getTime() <= now) idx = i; });
    return idx;
  }
  const dayKey = t => t.slice(0, 10);
  const dayLabel = (d, short) => {
    const dt = new Date(d + 'T12:00');
    const today = new Date(); today.setHours(12, 0, 0, 0);
    const diff = Math.round((dt - today) / 86400000);
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Amanhã';
    return dt.toLocaleDateString('pt-BR', short ? { weekday: 'short', day: '2-digit' } : { weekday: 'long', day: '2-digit', month: '2-digit' });
  };

  // ---------- dados ----------
  let GRID = null;
  async function load(force) {
    DATA = await API.fetchAll(force);
    if (force) GRID = null;
    return DATA;
  }

  // Monta o mapa geral (grade de ondas + vento) dentro de #elId.
  async function mountFloripaMap(elId, opts) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = '<div class="loading">Carregando mapa de ondas e vento…</div>';
    try {
      if (!GRID) GRID = await API.fetchGrid();
    } catch (e) {
      el.innerHTML = `<p class="muted">Não foi possível carregar o mapa (${esc(e.message)}).</p>`;
      return;
    }
    if (!document.body.contains(el)) return; // usuário mudou de página
    if (leafletMap) leafletMap.remove();
    leafletMap = FloripaMap.mount(el, GRID, DATA.beaches, opts);
  }

  function setNav(name) {
    document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === name));
  }

  function updatedLine() {
    const d = new Date(DATA.fetchedAt);
    return `<span class="muted">Atualizado ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
      <button class="btn-link" id="refresh">Atualizar</button>`;
  }
  function bindRefresh() {
    const b = document.getElementById('refresh');
    if (b) b.onclick = async () => { b.disabled = true; b.textContent = 'Atualizando…'; await load(true); route(); };
  }

  // ---------- HOME ----------
  function dailyBest(hours) {
    const days = {};
    hours.forEach(h => {
      const hr = +h.time.slice(11, 13);
      if (hr < 6 || hr > 18) return; // só horário de luz
      const k = dayKey(h.time);
      if (!days[k] || h.rating > days[k].rating) days[k] = h;
    });
    return Object.entries(days).map(([k, h]) => ({ day: k, h }));
  }

  function beachCard(b) {
    const d = DATA.beaches[b.id];
    const h = d.hours[nowIndex(d.hours)];
    const strip = dailyBest(d.hours).map(({ day, h: dh }) =>
      `<span class="day-chip r${Math.round(dh.rating)}" title="${dayLabel(day)} · melhor ${surfRange(dh.surf)} · ${ratingTxt(dh.rating)}">${dayLabel(day, true).replace('.', '').slice(0, 3)}</span>`
    ).join('');
    return `
      <a class="card beach-card r-border${Math.round(h.rating)}" href="#/praia/${b.id}">
        <div class="card-head">
          <h3>${esc(b.name)}</h3>
          ${stars(h.rating)}
        </div>
        <div class="surf-big">${surfRange(h.surf)}</div>
        <div class="metrics">
          <div><span class="k">Swell</span>${f1(h.swell_wave_height)}m · ${f0(h.swell_wave_period)}s ${arrow(h.swell_wave_direction)} ${compass(h.swell_wave_direction)}</div>
          <div><span class="k">Vento</span>${f0(h.wind_speed_10m)} km/h ${arrow(h.wind_direction_10m, 'wind')} ${compass(h.wind_direction_10m)} <em class="wk ${h.windKind}">${h.windLabel}</em></div>
          <div><span class="k">Água</span>${f1(h.sea_surface_temperature)}°C</div>
        </div>
        <div class="strip">${strip}</div>
      </a>`;
  }

  function renderHome() {
    setNav('home');
    const ranked = B.map(b => {
      const d = DATA.beaches[b.id];
      return { b, h: d.hours[nowIndex(d.hours)] };
    }).sort((a, c) => c.h.rating - a.h.rating);
    const top = ranked.slice(0, 3);
    const ref = DATA.beaches.joaquina;
    const ex = API.tideExtremes(ref.hours).filter(e => e.time > Date.now()).slice(0, 2);
    const sea = ref.hours[nowIndex(ref.hours)];

    const regions = ['Norte', 'Leste', 'Sul'];
    $app.innerHTML = `
      <section class="hero">
        <div>
          <h1>Previsão de ondas em Florianópolis</h1>
          <p class="muted">Swell, vento, maré e temperatura da água para ${B.length} praias da ilha. ${updatedLine()}</p>
        </div>
        <div class="hero-side">
          <div class="pill"><span class="k">Ondulação offshore</span>${f1(sea.wave_height)} m · ${f0(sea.wave_period)}s ${arrow(sea.wave_direction)} ${compass(sea.wave_direction)}</div>
          <div class="pill"><span class="k">Próximas marés</span>${ex.map(e => `${e.type === 'high' ? '▲ Cheia' : '▼ Seca'} ${Charts.fmtHM(e.time)}`).join(' · ') || '—'}</div>
        </div>
      </section>

      <section>
        <h2>Mapa geral · ondulação e vento</h2>
        <p class="muted small">Setas brancas = direção das ondas, com altura (m) e período (s). Setas coloridas = vento, com velocidade em km/h.
        Use o controle de tempo para ver os próximos 7 dias. Toque em qualquer ponto para detalhes.</p>
        <div id="fmap-home"></div>
      </section>

      <section>
        <h2>Melhores agora</h2>
        <div class="top-list">
          ${top.map(({ b, h }, i) => `
            <a class="top-item" href="#/praia/${b.id}">
              <span class="rank">${i + 1}</span>
              <span class="name">${esc(b.name)}</span>
              <span>${surfRange(h.surf)}</span>
              ${stars(h.rating)}
            </a>`).join('')}
        </div>
      </section>

      ${regions.map(r => `
        <section>
          <h2>${r} da ilha</h2>
          <div class="grid">${B.filter(b => b.region === r).map(beachCard).join('')}</div>
        </section>`).join('')}
    `;
    bindRefresh();
    mountFloripaMap('fmap-home', { height: 540 });
  }

  // ---------- PRAIA ----------
  function renderBeach(id, dayParam) {
    setNav('');
    const b = byId[id];
    if (!b) { $app.innerHTML = '<p>Praia não encontrada. <a href="#/">Voltar</a></p>'; return; }
    const d = DATA.beaches[id];
    const ni = nowIndex(d.hours);
    const h = d.hours[ni];
    const days = [...new Set(d.hours.map(x => dayKey(x.time)))];
    const sel = days.includes(dayParam) ? dayParam : days[0];
    const dayHours = d.hours.filter(x => dayKey(x.time) === sel);
    const rows = dayHours.filter(x => +x.time.slice(11, 13) % 3 === 0);
    const extremes = API.tideExtremes(d.hours);
    const sun = d.daily.find(x => x.date === sel);
    const dayEx = extremes.filter(e => localDay(e.time) === sel);
    const hourNow = d.hours[ni].time;

    $app.innerHTML = `
      <a href="#/" class="back">← Todas as praias</a>
      <section class="beach-head">
        <div>
          <h1>${esc(b.name)}</h1>
          <p class="muted">Região ${b.region} · praia voltada para ${compass(b.facing)} (${b.facing}°) · ${updatedLine()}</p>
        </div>
        <div class="now-box r-border${Math.round(h.rating)}">
          <div class="now-label">Agora</div>
          <div class="surf-big">${surfRange(h.surf)}</div>
          ${stars(h.rating)} <span class="muted">${ratingTxt(h.rating)}</span>
        </div>
      </section>

      <section class="stats">
        <div class="stat"><span class="k">Swell primário</span><b>${f1(h.swell_wave_height)} m</b><span>${f0(h.swell_wave_period)}s ${arrow(h.swell_wave_direction)} ${compass(h.swell_wave_direction)} ${f0(h.swell_wave_direction)}°</span></div>
        <div class="stat"><span class="k">Swell secundário</span><b>${f1(h.secondary_swell_wave_height)} m</b><span>${f0(h.secondary_swell_wave_period)}s ${arrow(h.secondary_swell_wave_direction)} ${compass(h.secondary_swell_wave_direction)}</span></div>
        <div class="stat"><span class="k">Vento</span><b>${f0(h.wind_speed_10m)} km/h</b><span>raj. ${f0(h.wind_gusts_10m)} ${arrow(h.wind_direction_10m, 'wind')} ${compass(h.wind_direction_10m)} · <em class="wk ${h.windKind}">${h.windLabel}</em></span></div>
        <div class="stat"><span class="k">Água</span><b>${f1(h.sea_surface_temperature)} °C</b><span>Ar ${f0(h.temperature_2m)}°C ${wx(h.weather_code)[0]}</span></div>
        <div class="stat"><span class="k">Nível do mar</span><b>${f1(h.sea_level_height_msl)} m</b><span>${(() => { const n = extremes.find(e => e.time > Date.now()); return n ? (n.type === 'high' ? 'enchendo até ' : 'secando até ') + Charts.fmtHM(n.time) : ''; })()}</span></div>
      </section>

      <section>
        <h2>Próximos 7 dias</h2>
        <p class="muted small">Barras = altura estimada na arrebentação em metros (cor = qualidade). Abaixo: nota, swell (m, seta = para onde vai), período, vento e rajada (km/h) a cada 3 h. Clique numa barra para abrir o dia.</p>
        <div class="ov-card" id="overview"></div>
      </section>

      <section>
        <div class="day-tabs">
          ${days.map(dd => `<a href="#/praia/${id}/${dd}" class="${dd === sel ? 'active' : ''}">${dayLabel(dd, true)}</a>`).join('')}
        </div>
        <h2 class="day-title">${dayLabel(sel)}</h2>
        <div class="table-wrap">
          <table class="fc">
            <thead><tr>
              <th>Hora</th><th>Nota</th><th>Surf</th><th>Swell 1</th><th>Swell 2</th><th>Vaga vento</th><th>Vento</th><th>Tempo</th>
            </tr></thead>
            <tbody>
              ${rows.map(x => `
                <tr class="${x.time <= hourNow && hourNow < addH(x.time, 3) ? 'is-now' : ''}">
                  <td class="t">${x.time.slice(11, 16)}</td>
                  <td><span class="rate r${Math.round(x.rating)}">${x.rating.toFixed(1)}</span></td>
                  <td class="b">${surfRange(x.surf)}</td>
                  <td>${f1(x.swell_wave_height)}m <span class="muted">${f0(x.swell_wave_period)}s</span> ${arrow(x.swell_wave_direction)}<span class="muted">${compass(x.swell_wave_direction)}</span></td>
                  <td>${x.secondary_swell_wave_height ? `${f1(x.secondary_swell_wave_height)}m <span class="muted">${f0(x.secondary_swell_wave_period)}s</span> ${arrow(x.secondary_swell_wave_direction)}<span class="muted">${compass(x.secondary_swell_wave_direction)}</span>` : '—'}</td>
                  <td>${f1(x.wind_wave_height)}m <span class="muted">${f0(x.wind_wave_period)}s</span></td>
                  <td><span class="wind-cell ${x.windKind}">${f0(x.wind_speed_10m)}<small>/${f0(x.wind_gusts_10m)}</small></span> ${arrow(x.wind_direction_10m, 'wind')}<span class="muted">${compass(x.wind_direction_10m)}</span></td>
                  <td title="${wx(x.weather_code)[1]}">${wx(x.weather_code)[0]} ${f0(x.temperature_2m)}° ${x.precipitation_probability ? `<span class="muted">${x.precipitation_probability}%</span>` : ''}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </section>

      <section class="two-col">
        <div class="card">
          <h2>Maré · ${dayLabel(sel)}</h2>
          <div id="tide"></div>
          <div class="tide-list">
            ${dayEx.map(e => `<span class="${e.type}">${e.type === 'high' ? '▲ Preamar' : '▼ Baixa-mar'} <b>${Charts.fmtHM(e.time)}</b> ${e.level.toFixed(2)} m</span>`).join('')}
          </div>
          <p class="muted small">☀️ Nascer ${sun ? sun.sunrise.slice(11, 16) : '—'} · 🌙 Pôr ${sun ? sun.sunset.slice(11, 16) : '—'}.
          Maré modelada (nível do mar com maré astronômica + efeitos meteorológicos). Para navegação use a tábua oficial da Marinha.</p>
        </div>
        <div class="card">
          <h2>Mapa ao vivo (Windy)</h2>
          <div class="windy-tabs" id="wtabs">
            <button data-o="waves" class="active">Ondas</button><button data-o="swell1">Swell</button><button data-o="wind">Vento</button>
          </div>
          <iframe id="windy" class="windy small" loading="lazy" title="Mapa Windy" src="${windyUrl('waves', b.mlat, b.mlon, 10, b)}"></iframe>
        </div>
      </section>
    `;
    bindRefresh();
    Charts.tideChart(document.getElementById('tide'), dayHours, extremes, sun);
    const ov = Charts.overviewChart(document.getElementById('overview'), d.hours, i => {
      location.hash = `#/praia/${id}/${dayKey(d.hours[i].time)}`;
    });
    const firstOfDay = d.hours.findIndex(x => dayKey(x.time) === sel);
    ov.scrollToIndex(sel === days[0] ? ni : firstOfDay);
    bindWindyTabs('wtabs', 'windy', b.mlat, b.mlon, 10, b);
  }
  const localDay = t => { const d = new Date(t); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
  const addH = (t, n) => { const d = new Date(t); d.setHours(d.getHours() + n); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:00`; };

  // ---------- WINDY ----------
  function windyUrl(overlay, lat, lon, zoom, marker) {
    const product = overlay === 'wind' ? 'ecmwf' : 'ecmwfWaves';
    const p = new URLSearchParams({
      type: 'map', location: 'coordinates', metricRain: 'mm', metricTemp: '°C', metricWind: 'km/h',
      zoom, overlay, product, level: 'surface', lat, lon, message: 'true',
    });
    if (marker) { p.set('detailLat', marker.lat); p.set('detailLon', marker.lon); p.set('detail', 'true'); }
    return 'https://embed.windy.com/embed.html?' + p.toString();
  }
  function bindWindyTabs(tabsId, frameId, lat, lon, zoom, marker) {
    const tabs = document.getElementById(tabsId), frame = document.getElementById(frameId);
    tabs.querySelectorAll('button').forEach(btn => btn.onclick = () => {
      tabs.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === btn));
      frame.src = windyUrl(btn.dataset.o, lat, lon, zoom, marker);
    });
  }

  // ---------- MAPA ----------
  function renderMap() {
    setNav('mapa');
    $app.innerHTML = `
      <section>
        <h1>Mapa geral de Florianópolis</h1>
        <p class="muted">Ondulação (cor e setas brancas com altura e período) e vento (setas coloridas com velocidade em km/h).
        Os pontinhos nas praias mostram a nota de surf no horário escolhido. ${updatedLine()}</p>
        <div id="fmap-page"></div>
      </section>
      <section>
        <h2>Windy · animação de ondas e vento</h2>
        <div class="windy-tabs" id="wtabs2">
          <button data-o="waves" class="active">Ondas</button><button data-o="swell1">Swell</button><button data-o="wind">Vento</button>
        </div>
        <iframe id="windy2" class="windy" loading="lazy" title="Mapa Windy" src="${windyUrl('waves', -27.62, -48.35, 8)}"></iframe>
      </section>`;
    bindRefresh();
    mountFloripaMap('fmap-page', { height: 680 });
    bindWindyTabs('wtabs2', 'windy2', -27.62, -48.35, 8);
  }

  // ---------- SOBRE ----------
  function renderAbout() {
    setNav('sobre');
    $app.innerHTML = `
      <section class="prose card">
        <h1>De onde vêm os dados</h1>
        <h3>🌊 Ondas e swell — Open-Meteo Marine API</h3>
        <p><a href="https://open-meteo.com/en/docs/marine-weather-api" target="_blank" rel="noopener">marine-api.open-meteo.com</a> —
        combina os modelos <b>ECMWF WAM</b>, <b>Météo-France MFWAM</b>, <b>DWD EWAM/GWAM</b> e <b>NOAA GFS Wave</b>. Fornece por hora:
        altura significativa, período e direção da onda total, do swell primário, do swell secundário e da vaga de vento, além da
        temperatura da superfície do mar. Gratuita, sem chave e com CORS liberado (por isso roda direto no GitHub Pages).</p>
        <p>Para cada praia o site consulta um ponto ~8 km mar adentro (uma célula da grade do modelo), na direção para onde a praia está voltada.</p>

        <h3>🌀 Maré — Open-Meteo Marine (<code>sea_level_height_msl</code>)</h3>
        <p>Nível do mar modelado (maré astronômica + efeitos de vento/pressão) em resolução de ~8 km. Preamar e baixa-mar são
        calculadas a partir da curva. Em Floripa a amplitude é pequena (micro-maré, ~0,5–1,2 m). A referência oficial é a
        <a href="https://www.marinha.mil.br/chm/tabuas-de-mare" target="_blank" rel="noopener">tábua de marés da Marinha (CHM/DHN)</a>
        — estação Porto de Florianópolis — que só é publicada em PDF, sem API.</p>

        <h3>💨 Vento e tempo — Open-Meteo Forecast API</h3>
        <p><a href="https://open-meteo.com/en/docs" target="_blank" rel="noopener">api.open-meteo.com</a> — escolhe automaticamente o melhor
        modelo para a região (ICON, GFS, ECMWF IFS). Vento a 10 m, rajadas, temperatura, nuvens, chuva, nascer e pôr do sol.</p>

        <h3>🗺️ Mapas — Windy embed + OpenStreetMap</h3>
        <p>Animações de ondas, swell e vento via <a href="https://www.windy.com/" target="_blank" rel="noopener">embed.windy.com</a>
        (modelos ECMWF).</p>
        <p><b>Mapa geral</b>: grade de ~9 km sobre a região (mesma resolução do modelo de ondas), com ondas da Marine API e vento da Forecast API em cada ponto, desenhada com Leaflet sobre o mapa base da Esri (dados OpenStreetMap).</p>

        <h3>⭐ Como a nota é calculada</h3>
        <ul>
          <li><b>Surf estimado</b>: cada componente (swell 1, swell 2, vaga de vento) é ponderado pela exposição da praia
          (ângulo entre a direção do swell e a orientação da praia) e por um fator de período (ondas longas crescem mais no raso).</li>
          <li><b>Vento</b>: comparado com a orientação da praia — <em>terral</em> (do continente para o mar) melhora, <em>maral</em> piora proporcional à velocidade.</li>
          <li><b>Período</b>: ≥ 12 s bonifica, &lt; 7 s penaliza.</li>
        </ul>
        <p class="muted">É uma estimativa automática — fundo, bancadas e correntes de cada pico não são considerados.</p>

        <h3>Outras fontes avaliadas</h3>
        <ul>
          <li><b>Stormglass.io</b> — ondas/maré de vários modelos; exige chave e tem limite de 10 req/dia no plano grátis (chave ficaria exposta no navegador).</li>
          <li><b>NOAA WaveWatch III (NOMADS/ERDDAP)</b> — dados brutos GRIB/NetCDF, exigiria backend para processar.</li>
          <li><b>Copernicus Marine (CMEMS)</b> — ótima qualidade, mas precisa de conta e não serve JSON direto ao navegador.</li>
          <li><b>SiMCosta / PNBOIA (boias)</b> — medições reais da costa brasileira; sem API pública estável com CORS.</li>
        </ul>
      </section>`;
  }

  // ---------- roteador ----------
  async function route() {
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    if (leafletMap) { leafletMap.remove(); leafletMap = null; }
    if (parts[0] === 'sobre') { renderAbout(); window.scrollTo(0, 0); return; }
    try {
      if (!DATA) await load();
    } catch (e) {
      $app.innerHTML = `<div class="card error"><h2>Não foi possível carregar a previsão</h2><p>${esc(e.message)}</p><button class="btn" onclick="location.reload()">Tentar de novo</button></div>`;
      return;
    }
    const prevPath = route.last;
    route.last = parts.slice(0, 2).join('/');
    if (parts[0] === 'praia') renderBeach(parts[1], parts[2]);
    else if (parts[0] === 'mapa') renderMap();
    else renderHome();
    if (prevPath !== route.last) window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', route);
  route();
})();
