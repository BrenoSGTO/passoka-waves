// Busca de dados (Open-Meteo Marine + Forecast) e cálculo de condições.
(function () {
  const TZ = 'America/Sao_Paulo';
  const DAYS = 7;
  const CACHE_MIN = 30;

  const MARINE_VARS = [
    'wave_height', 'wave_direction', 'wave_period',
    'swell_wave_height', 'swell_wave_direction', 'swell_wave_period',
    'secondary_swell_wave_height', 'secondary_swell_wave_direction', 'secondary_swell_wave_period',
    'wind_wave_height', 'wind_wave_direction', 'wind_wave_period',
    'sea_surface_temperature', 'sea_level_height_msl',
  ];
  const WEATHER_VARS = [
    'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
    'temperature_2m', 'weather_code', 'cloud_cover', 'precipitation_probability',
  ];

  function cacheGet(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (Date.now() - obj.t > CACHE_MIN * 60000) return null;
      return obj.v;
    } catch (e) { return null; }
  }
  function cacheSet(key, v) {
    try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), v })); } catch (e) { /* cheio/bloqueado */ }
  }

  async function getJSON(url, tries = 3) {
    for (let i = 1; ; i++) {
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error('HTTP ' + r.status + ' em ' + url.split('?')[0]);
        return JSON.parse(await r.text());
      } catch (e) {
        if (i >= tries) throw e;
        await new Promise(res => setTimeout(res, 600 * i));
      }
    }
  }

  // Busca todas as praias de uma vez (a API aceita listas de coordenadas).
  async function fetchAll(force) {
    const key = 'pw:v4:all';
    if (!force) { const c = cacheGet(key); if (c) return c; }
    const B = window.BEACHES;
    const marineUrl = 'https://marine-api.open-meteo.com/v1/marine?' + new URLSearchParams({
      latitude: B.map(b => b.mlat).join(','),
      longitude: B.map(b => b.mlon).join(','),
      hourly: MARINE_VARS.join(','),
      timezone: TZ, forecast_days: DAYS, cell_selection: 'sea',
    });
    const weatherUrl = 'https://api.open-meteo.com/v1/forecast?' + new URLSearchParams({
      latitude: B.map(b => b.lat).join(','),
      longitude: B.map(b => b.lon).join(','),
      hourly: WEATHER_VARS.join(','),
      daily: 'sunrise,sunset',
      timezone: TZ, forecast_days: DAYS, wind_speed_unit: 'kmh',
    });
    const [marine, weather] = await Promise.all([getJSON(marineUrl), getJSON(weatherUrl)]);
    const M = Array.isArray(marine) ? marine : [marine];
    const W = Array.isArray(weather) ? weather : [weather];
    const out = {};
    B.forEach((b, i) => { out[b.id] = merge(b, M[i], W[i]); });
    const data = { fetchedAt: Date.now(), beaches: out };
    cacheSet(key, data);
    return data;
  }

  // Grade regular sobre Florianópolis para o mapa geral (~0,083°, mesma resolução do modelo de ondas).
  const GRID = { lat0: -27.125, lat1: -28.10, lon0: -48.79, lon1: -47.95, step: 0.0833 };
  function gridPoints(g) {
    const pts = [];
    for (let a = g.lat0; a >= g.lat1; a -= g.step)
      for (let o = g.lon0; o <= g.lon1; o += g.step) pts.push([+a.toFixed(4), +o.toFixed(4)]);
    return pts;
  }
  const r1 = v => v == null ? null : Math.round(v * 10) / 10;
  const r0 = v => v == null ? null : Math.round(v);

  // Cada célula tem vento; células no mar também têm ondas.
  async function fetchGrid(force) {
    const key = 'pw:v3:grid';
    if (!force) { const c = cacheGet(key); if (c) return c; }
    const pts = gridPoints(GRID);
    const lat = pts.map(p => p[0]).join(','), lon = pts.map(p => p[1]).join(',');
    const marineUrl = 'https://marine-api.open-meteo.com/v1/marine?' + new URLSearchParams({
      latitude: lat, longitude: lon,
      hourly: 'wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,wind_wave_height',
      timezone: TZ, forecast_days: DAYS, cell_selection: 'nearest',
    });
    const windUrl = 'https://api.open-meteo.com/v1/forecast?' + new URLSearchParams({
      latitude: lat, longitude: lon,
      hourly: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m',
      timezone: TZ, forecast_days: DAYS, wind_speed_unit: 'kmh',
    });
    const [M, W] = await Promise.all([getJSON(marineUrl), getJSON(windUrl)]);
    const seen = new Set();
    const cells = [];
    pts.forEach((p, i) => {
      const m = [].concat(M)[i], w = [].concat(W)[i];
      const wind = { s: w.hourly.wind_speed_10m.map(r0), d: w.hourly.wind_direction_10m.map(r0), g: w.hourly.wind_gusts_10m.map(r0) };
      const h = m.hourly;
      const sea = h.wave_height.some(v => v != null);
      let cLat = p[0], cLon = p[1], wave = null;
      if (sea) {
        cLat = m.latitude; cLon = m.longitude;
        const k = cLat.toFixed(3) + ',' + cLon.toFixed(3);
        if (seen.has(k)) return;
        seen.add(k);
        wave = {
          h: h.wave_height.map(r1), d: h.wave_direction.map(r0), p: h.wave_period.map(r0),
          sh: h.swell_wave_height.map(r1), sd: h.swell_wave_direction.map(r0), sp: h.swell_wave_period.map(r0),
          ww: h.wind_wave_height.map(r1),
        };
      }
      cells.push({ lat: cLat, lon: cLon, wave, wind });
    });
    const data = { fetchedAt: Date.now(), times: [].concat(M)[0].hourly.time, step: GRID.step, cells };
    cacheSet(key, data);
    return data;
  }

  function merge(beach, m, w) {
    const times = m.hourly.time;
    const wIdx = {};
    w.hourly.time.forEach((t, i) => { wIdx[t] = i; });
    const hours = times.map((t, i) => {
      const j = wIdx[t];
      const g = (src, k, idx) => (idx == null || !src.hourly[k]) ? null : src.hourly[k][idx];
      const h = { time: t };
      MARINE_VARS.forEach(k => { h[k] = g(m, k, i); });
      WEATHER_VARS.forEach(k => { h[k] = g(w, k, j); });
      return h;
    });
    hours.forEach(h => Object.assign(h, assess(beach, h)));
    const daily = w.daily.time.map((d, i) => ({ date: d, sunrise: w.daily.sunrise[i], sunset: w.daily.sunset[i] }));
    return { hours, daily, model: { lat: m.latitude, lon: m.longitude } };
  }

  // ---------- Avaliação de surf ----------
  const angDiff = (a, b) => { const d = Math.abs(((a - b) % 360 + 540) % 360 - 180); return d; };

  // Quanto de uma ondulação chega na praia, pelo ângulo entre a direção do swell e a orientação da praia.
  // Ondas que chegam de lado contornam costões e refratam no raso; períodos longos refratam mais.
  // Ex.: 82° fora do eixo -> ~30% da altura (antes ~7%); 0° -> 100%; acima de ~115° -> 5%.
  function exposure(beach, dir, tp) {
    if (dir == null) return 0;
    const d = angDiff(dir, beach.facing);
    const k = tp >= 10 ? 0.75 : 0.82;
    const a = Math.min(90, d * k);
    return Math.max(0.05, Math.cos(a * Math.PI / 180) ** 1.2);
  }

  // Estima altura de arrebentação a partir de cada componente (swell 1, 2 e vaga de vento).
  function surfHeight(beach, h) {
    const comp = [
      [h.swell_wave_height, h.swell_wave_direction, h.swell_wave_period],
      [h.secondary_swell_wave_height, h.secondary_swell_wave_direction, h.secondary_swell_wave_period],
      [h.wind_wave_height, h.wind_wave_direction, h.wind_wave_period],
    ];
    let energy = 0;
    comp.forEach(([hs, dir, tp]) => {
      if (!hs || dir == null) return;
      // Ondas mais longas crescem mais ao chegar no raso (shoaling aproximado).
      const shoal = tp ? Math.min(1.6, Math.max(0.75, 0.55 + tp * 0.07)) : 1;
      const e = hs * exposure(beach, dir, tp) * shoal;
      energy += e * e;
    });
    if (energy === 0 && h.wave_height != null) {
      const e = h.wave_height * exposure(beach, h.wave_direction, h.wave_period);
      energy = e * e;
    }
    return Math.sqrt(energy);
  }

  function windQuality(beach, speed, dir) {
    if (speed == null || dir == null) return { label: '—', factor: 1, kind: 'na' };
    const offshoreFrom = (beach.facing + 180) % 360;
    const d = angDiff(dir, offshoreFrom); // 0 = terral puro, 180 = maral puro
    let kind, label;
    if (speed < 7) { kind = 'calm'; label = 'Sem vento'; }
    else if (d <= 50) { kind = 'off'; label = 'Terral'; }
    else if (d <= 80) { kind = 'cross-off'; label = 'Lateral-terral'; }
    else if (d <= 110) { kind = 'cross'; label = 'Lateral'; }
    else if (d <= 145) { kind = 'cross-on'; label = 'Lateral-maral'; }
    else { kind = 'on'; label = 'Maral'; }
    let factor = 1;
    if (kind === 'off' || kind === 'calm') factor = speed > 35 ? 0.75 : 1.05;
    else if (kind === 'cross-off') factor = speed > 30 ? 0.75 : 0.95;
    else {
      const sev = kind === 'cross' ? 0.5 : kind === 'cross-on' ? 0.75 : 1;
      factor = Math.max(0.15, 1 - sev * Math.min(1, (speed - 7) / 25));
    }
    return { label, factor, kind };
  }

  // Energia da onda por área: E = ρ·g·H²/16 (J/m²)
  const RHO_G_16 = 1025 * 9.81 / 16;
  // Classe de cor pelo período (0 = curto, 5 = muito longo)
  function periodClass(T) {
    if (!T) return 0;
    return T < 7 ? 0 : T < 9 ? 1 : T < 11 ? 2 : T < 13 ? 3 : T < 15 ? 4 : 5;
  }

  function assess(beach, h) {
    const surf = surfHeight(beach, h);
    const wind = windQuality(beach, h.wind_speed_10m, h.wind_direction_10m);
    const tp = h.swell_wave_period || h.wave_period || 0;
    let size;
    if (surf < 0.25) size = 0;
    else if (surf < 0.5) size = 1 + (surf - 0.25) * 4;   // 1–2
    else if (surf < 1.0) size = 2 + (surf - 0.5) * 4;    // 2–4
    else if (surf < 2.2) size = 4 + (surf - 1.0) * 0.8;  // 4–5
    else size = Math.max(3, 5 - (surf - 2.2) * 0.8);     // grande demais p/ maioria
    const periodF = tp >= 12 ? 1.1 : tp >= 9 ? 1 : tp >= 7 ? 0.85 : 0.65;
    const rating = Math.max(0, Math.min(5, size * periodF * wind.factor)); // só para ordenar as praias
    const per = h.swell_wave_period || h.wave_period || null;
    const energy = h.wave_height == null ? null : RHO_G_16 * h.wave_height * h.wave_height;
    return { surf, rating, per, pc: periodClass(per), energy, windKind: wind.kind, windLabel: wind.label };
  }

  // Extremos de maré (preamar / baixa-mar) a partir da série horária, com interpolação parabólica.
  function tideExtremes(hours) {
    const out = [];
    for (let i = 1; i < hours.length - 1; i++) {
      const a = hours[i - 1].sea_level_height_msl, b = hours[i].sea_level_height_msl, c = hours[i + 1].sea_level_height_msl;
      if (a == null || b == null || c == null) continue;
      const isMax = b > a && b >= c, isMin = b < a && b <= c;
      if (!isMax && !isMin) continue;
      const den = a - 2 * b + c;
      const off = den !== 0 ? 0.5 * (a - c) / den : 0;
      const level = b - 0.25 * (a - c) * off;
      const t = new Date(hours[i].time).getTime() + off * 3600000;
      out.push({ type: isMax ? 'high' : 'low', time: t, level });
    }
    return out;
  }

  window.API = { fetchAll, fetchGrid, tideExtremes, angDiff, exposure, periodClass };
})();
