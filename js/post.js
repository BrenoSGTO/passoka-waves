// Gera imagens de post: vertical (1080×1350) com o boletim de um horário, ou horizontal
// (1920×1080) que soma o dia inteiro: ondas hora a hora, vento e tábua de maré.
(function () {
  const W = 1080, H = 1350;
  const C16 = ['N', 'NNE', 'NE', 'ENE', 'L', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  const c16 = d => d == null ? '—' : C16[Math.round(((d % 360) + 360) % 360 / 22.5) % 16];
  const rad = d => d * Math.PI / 180;
  const INK = '#15181b', PAPER = '#f2eee5', CARD = '#faf8f3', LINE = '#d6cfbf', MUTED = '#6d6a62', ACCENT = '#d9481a';
  const SERIF = "'Instrument Serif', Georgia, serif";
  const MONO = "'IBM Plex Mono', ui-monospace, monospace";
  const SANS = "'IBM Plex Sans', system-ui, sans-serif";
  const PER_COLORS = ['#d8d1c1', '#a9c7d6', '#5fa394', '#e3b53c', '#e2702c', '#b8322a'];

  const COMP = [
    { key: 'swell_wave', label: 'Swell 1', color: '#1f4f7a' },
    { key: 'secondary_swell_wave', label: 'Swell 2', color: '#5fa394' },
    { key: 'wind_wave', label: 'Vagas', color: '#9a8f7a' },
  ];
  const WIND_COLOR = ACCENT;

  const surfRange = s => s < 0.2 ? 'flat' : `${(s * 0.8).toFixed(1)}–${(s * 1.25).toFixed(1)}`;
  const n0 = v => v == null ? '—' : String(Math.round(v));
  const n1 = v => v == null ? '—' : v.toFixed(1);

  async function fontsReady() {
    try {
      await Promise.all([
        document.fonts.load(`400 100px ${SERIF}`), document.fonts.load(`italic 400 100px ${SERIF}`),
        document.fonts.load(`500 40px ${MONO}`), document.fonts.load(`600 40px ${MONO}`),
        document.fonts.load(`400 30px ${SANS}`),
      ]);
    } catch (e) { /* segue com fontes do sistema */ }
  }

  function text(ctx, s, x, y, font, color, align = 'left', spacing = 0) {
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align;
    if ('letterSpacing' in ctx) ctx.letterSpacing = spacing + 'px';
    ctx.fillText(s, x, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
  function hline(ctx, x0, x1, y, w = 2, color = INK) {
    ctx.fillStyle = color; ctx.fillRect(x0, y, x1 - x0, w);
  }

  // Seta (ponta em 0,0, apontando para +y) desenhada no sistema atual.
  function arrowHead(ctx, size) {
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-size * 0.55, -size); ctx.lineTo(0, -size * 0.7); ctx.lineTo(size * 0.55, -size);
    ctx.closePath();
  }

  // Rosa com a costa da praia, swells chegando da borda e vento cruzando o centro.
  function drawRose(ctx, beach, h, cx, cy, R) {
    const P = (dir, r) => [cx + r * Math.sin(rad(dir)), cy - r * Math.cos(rad(dir))];
    ctx.save();
    // fundo
    ctx.fillStyle = CARD; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    // terra: metade oposta à direção para onde a praia olha
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    ctx.translate(cx, cy); ctx.rotate(rad(beach.facing));
    ctx.fillStyle = '#e3dccb';
    ctx.fillRect(-R, R * 0.18, 2 * R, R);
    ctx.fillStyle = INK; ctx.fillRect(-R, R * 0.18, 2 * R, 3);
    ctx.restore();
    // anéis
    ctx.strokeStyle = LINE; ctx.lineWidth = 2;
    [0.5, 1].forEach(k => { ctx.beginPath(); ctx.arc(cx, cy, R * k, 0, Math.PI * 2); ctx.stroke(); });
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    // marcas e pontos cardeais
    for (let d = 0; d < 360; d += 22.5) {
      const major = d % 90 === 0;
      const [x0, y0] = P(d, R), [x1, y1] = P(d, R - (major ? 22 : 11));
      ctx.strokeStyle = INK; ctx.lineWidth = major ? 3 : 1.5;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
    ['N', 'L', 'S', 'O'].forEach((l, i) => {
      const [x, y] = P(i * 90, R + 30);
      text(ctx, l, x, y + 10, `600 28px ${MONO}`, INK, 'center');
    });
    // praia (nome curto sobre a faixa de terra)
    {
      const [x, y] = P(beach.facing + 180, R * 0.55);
      text(ctx, 'TERRA', x, y + 8, `500 18px ${MONO}`, MUTED, 'center', 3);
      const [mx, my] = P(beach.facing, R * 0.32);
      text(ctx, 'MAR', mx, my + 8, `500 18px ${MONO}`, MUTED, 'center', 3);
    }
    // componentes: seta grossa vindo da borda para dentro
    COMP.forEach(c => {
      const Hs = h[c.key + '_height'], D = h[c.key + '_direction'];
      if (!Hs || Hs < 0.05 || D == null) return;
      const len = Math.max(0.35, Math.min(0.75, 0.3 + Hs * 0.22)) * R;
      const [sx, sy] = P(D, R + 6), [ex, ey] = P(D, R + 6 - len);
      ctx.strokeStyle = c.color; ctx.lineWidth = 14; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(...P(D, R + 6 - len + 26)); ctx.stroke();
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(rad(D)); // aponta para o centro
      arrowHead(ctx, 40); ctx.fillStyle = c.color; ctx.fill();
      ctx.restore();
    });
    // vento: atravessa o centro, ponta para onde sopra
    const ws = h.wind_speed_10m, wd = h.wind_direction_10m;
    if (ws != null && wd != null) {
      const len = Math.max(0.35, Math.min(0.8, 0.25 + ws / 60)) * R;
      const to = (wd + 180) % 360;
      const [ax, ay] = P(wd, len * 0.6), [bx, by] = P(to, len);
      ctx.strokeStyle = WIND_COLOR; ctx.lineWidth = 7; ctx.setLineDash([16, 10]);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(...P(to, len - 20)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.save(); ctx.translate(bx, by); ctx.rotate(rad(to) + Math.PI); arrowHead(ctx, 34); ctx.fillStyle = WIND_COLOR; ctx.fill(); ctx.restore();
    }
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function draw(canvas, beach, h) {
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const M = 72;
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(30, 30, W - 60, H - 60);

    const d = new Date(h.time);
    const dateTxt = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });

    // cabeçalho
    text(ctx, 'BOLETIM DE ONDAS', M, 104, `600 24px ${MONO}`, ACCENT, 'left', 5);
    text(ctx, 'PASSOKA WAVES', W - M, 104, `500 24px ${MONO}`, INK, 'right', 5);
    hline(ctx, M, W - M, 126, 3);
    text(ctx, beach.name, M - 4, 240, `400 124px ${SERIF}`, INK);
    text(ctx, `${dateTxt} · ${h.time.slice(11, 16)}`.toUpperCase(), M, 298, `500 28px ${MONO}`, MUTED, 'left', 2);

    // tamanho
    hline(ctx, M, W - M, 322, 1, LINE);
    text(ctx, 'NA ARREBENTAÇÃO', M, 360, `500 22px ${MONO}`, MUTED, 'left', 4);
    const sr = surfRange(h.surf);
    ctx.font = `500 140px ${MONO}`;
    const srW = ctx.measureText(sr).width;
    text(ctx, sr, M - 6, 492, `500 140px ${MONO}`, INK, 'left', -6);
    if (sr !== 'flat') text(ctx, 'm', M + srW - 6 * sr.length + 8, 492, `500 64px ${MONO}`, MUTED);

    // 4 números
    const top = 530, cellH = 160, cw = (W - 2 * M) / 4;
    hline(ctx, M, W - M, top, 3);
    const stats = [
      ['Ondas', n1(h.wave_height), 'm', null],
      ['Período', n0(h.per), 's', PER_COLORS[h.pc]],
      ['Energia', n0(h.energy), 'J/m²', null],
      ['Vento', n0(h.wind_speed_10m), 'km/h', null],
    ];
    stats.forEach(([k, v, u, col], i) => {
      const x = M + i * cw + (i ? 22 : 0);
      if (i) { ctx.fillStyle = LINE; ctx.fillRect(M + i * cw, top + 22, 2, cellH - 40); }
      if (col) { ctx.fillStyle = col; ctx.fillRect(x, top + 26, 14, 14); }
      text(ctx, k.toUpperCase(), x + (col ? 24 : 0), top + 41, `500 20px ${MONO}`, MUTED, 'left', 3);
      text(ctx, v, x - 2, top + 114, `500 74px ${MONO}`, INK, 'left', -3);
      text(ctx, u, x, top + 144, `500 22px ${MONO}`, MUTED);
    });
    hline(ctx, M, W - M, top + cellH, 1, LINE);

    // rosa + componentes
    const roseTop = top + cellH + 36;
    const R = 205, cx = M + R + 34, cy = roseTop + R + 52;
    drawRose(ctx, beach, h, cx, cy, R);

    const lx = cx + R + 80, lw = W - M - lx;
    let y = roseTop + 22;
    text(ctx, 'DIREÇÕES', lx, y, `600 20px ${MONO}`, ACCENT, 'left', 4);
    y += 22;
    drawDirRows(ctx, h, lx, lw, y, 118);

    // rodapé
    const fy = H - 92;
    hline(ctx, M, W - M, fy, 3);
    text(ctx, `Florianópolis · água ${n1(h.sea_surface_temperature)} °C`, M, fy + 42, `400 22px ${MONO}`, MUTED);
    text(ctx, 'previsão modelada', W - M, fy + 42, `italic 400 30px ${SERIF}`, INK, 'right');
  }

  // Componentes (swells, vagas e vento) listados ao lado da rosa — usado nos dois formatos.
  function dirRows(h) {
    const rows = COMP.map(c => {
      const Hs = h[c.key + '_height'], D = h[c.key + '_direction'], T = h[c.key + '_period'];
      return { label: c.label, color: c.color, main: Hs ? `${n1(Hs)} m · ${n0(T)} s` : '—', sub: D == null || !Hs ? '' : `de ${c16(D)} ${n0(D)}°` };
    });
    rows.push({
      label: 'Vento', color: WIND_COLOR, dashed: true,
      main: `${n0(h.wind_speed_10m)} km/h`, tag: h.windLabel,
      sub: `de ${c16(h.wind_direction_10m)} ${n0(h.wind_direction_10m)}° · raj. ${n0(h.wind_gusts_10m)}`,
    });
    return rows;
  }
  function drawDirRows(ctx, h, lx, lw, y, step) {
    dirRows(h).forEach(r => {
      hline(ctx, lx, lx + lw, y, 1, LINE);
      ctx.fillStyle = r.color;
      if (r.dashed) { ctx.fillRect(lx, y + 26, 12, 7); ctx.fillRect(lx + 18, y + 26, 12, 7); }
      else ctx.fillRect(lx, y + 22, 30, 14);
      text(ctx, r.label.toUpperCase(), lx + 42, y + 36, `600 20px ${MONO}`, INK, 'left', 3);
      if (r.tag) text(ctx, r.tag.toUpperCase(), lx + lw, y + 36, `500 18px ${MONO}`, WIND_COLOR, 'right', 2);
      text(ctx, r.main, lx, y + 76, `500 32px ${MONO}`, INK);
      if (r.sub) text(ctx, r.sub, lx, y + 104, `400 21px ${MONO}`, MUTED);
      y += step;
    });
  }

  // Reduz a fonte até o texto caber na largura.
  function fitSize(ctx, s, maxW, size, family, weight = 400) {
    while (size > 40) {
      ctx.font = `${weight} ${size}px ${family}`;
      if (ctx.measureText(s).width <= maxW) break;
      size -= 4;
    }
    return size;
  }
  const hm = t => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

  // Formato horizontal (1920×1080): boletim do horário + ondas do dia inteiro, vento e maré.
  function drawWide(canvas, beach, h, dayHours, extra = {}) {
    const WW = 1920, HH = 1080, M = 72;
    canvas.width = WW; canvas.height = HH;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, WW, HH);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(30, 30, WW - 60, HH - 60);

    const d = new Date(h.time);
    const dateTxt = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
    text(ctx, 'BOLETIM DE ONDAS', M, 96, `600 24px ${MONO}`, ACCENT, 'left', 5);
    text(ctx, `${dateTxt} · ${h.time.slice(11, 16)}`.toUpperCase(), WW / 2, 96, `500 24px ${MONO}`, MUTED, 'center', 3);
    text(ctx, 'PASSOKA WAVES', WW - M, 96, `500 24px ${MONO}`, INK, 'right', 5);
    hline(ctx, M, WW - M, 118, 3);

    // ----- esquerda: nome, tamanho e números
    const LW = 900;
    const ns = fitSize(ctx, beach.name, LW, 120, SERIF);
    text(ctx, beach.name, M - 4, 236, `400 ${ns}px ${SERIF}`, INK);
    text(ctx, `${beach.region} da ilha · voltada para ${c16(beach.facing)} ${beach.facing}°`.toUpperCase(), M, 282, `500 21px ${MONO}`, MUTED, 'left', 2);
    hline(ctx, M, M + LW, 306, 1, LINE);
    text(ctx, 'NA ARREBENTAÇÃO', M, 344, `500 20px ${MONO}`, MUTED, 'left', 4);
    const sr = surfRange(h.surf);
    ctx.font = `500 124px ${MONO}`;
    const srW = ctx.measureText(sr).width;
    text(ctx, sr, M - 6, 458, `500 124px ${MONO}`, INK, 'left', -6);
    if (sr !== 'flat') text(ctx, 'm', M + srW - 6 * sr.length + 8, 458, `500 56px ${MONO}`, MUTED);

    const top = 486, cellH = 130, cw = LW / 4;
    hline(ctx, M, M + LW, top, 3);
    [
      ['Ondas', n1(h.wave_height), 'm', null],
      ['Período', n0(h.per), 's', PER_COLORS[h.pc]],
      ['Energia', n0(h.energy), 'J/m²', null],
      ['Água', n1(h.sea_surface_temperature), '°C', null],
    ].forEach(([k, v, u, col], i) => {
      const x = M + i * cw + (i ? 22 : 0);
      if (i) { ctx.fillStyle = LINE; ctx.fillRect(M + i * cw, top + 20, 2, cellH - 36); }
      if (col) { ctx.fillStyle = col; ctx.fillRect(x, top + 22, 14, 14); }
      text(ctx, k.toUpperCase(), x + (col ? 24 : 0), top + 37, `500 19px ${MONO}`, MUTED, 'left', 3);
      text(ctx, v, x - 2, top + 98, `500 60px ${MONO}`, INK, 'left', -3);
      text(ctx, u, x, top + 124, `500 20px ${MONO}`, MUTED);
    });

    // ----- direita: rosa + direções
    const R = 168, cx = M + LW + 90 + R, cy = 118 + 52 + R + 20;
    drawRose(ctx, beach, h, cx, cy, R);
    const lx = cx + R + 70, lw = WW - M - lx;
    text(ctx, 'DIREÇÕES', lx, 160, `600 20px ${MONO}`, ACCENT, 'left', 4);
    drawDirRows(ctx, h, lx, lw, 176, 112);

    // ----- gráficos do dia
    hline(ctx, M, WW - M, 634, 3);
    const t0 = new Date(dayHours[0].time.slice(0, 10) + 'T00:00').getTime(), DAY = 86400000;
    const pTop = 712, pBot = 858;
    const sun = extra.sun;
    const shadeNight = (x0, x1) => {
      if (!sun) return;
      const X = t => x0 + Math.max(0, Math.min(1, (t - t0) / DAY)) * (x1 - x0);
      const a = X(new Date(sun.sunrise).getTime()), b = X(new Date(sun.sunset).getTime());
      ctx.fillStyle = 'rgba(21,24,27,.06)';
      ctx.fillRect(x0, pTop - 24, a - x0, pBot - pTop + 24);
      ctx.fillRect(b, pTop - 24, x1 - b, pBot - pTop + 24);
    };

    // ondas hora a hora + vento a cada 3 h
    {
      const x0 = M, x1 = 1150, slot = (x1 - x0) / 24, bw = slot * 0.74;
      text(ctx, 'ONDAS AO LONGO DO DIA', x0, 674, `600 20px ${MONO}`, ACCENT, 'left', 4);
      text(ctx, 'arrebentação (m) · cor = período · vento km/h', x1, 674, `400 18px ${MONO}`, MUTED, 'right');
      shadeNight(x0, x1);
      const vmax = Math.max(1, ...dayHours.map(x => x.surf || 0)) * 1.18;
      const selHr = +h.time.slice(11, 13);
      dayHours.forEach(x => {
        const hr = +x.time.slice(11, 13), v = x.surf || 0, sel = hr === selHr;
        const bx = x0 + hr * slot + (slot - bw) / 2, bh = Math.max(2, v / vmax * (pBot - pTop));
        ctx.fillStyle = PER_COLORS[x.pc] || PER_COLORS[0];
        ctx.fillRect(bx, pBot - bh, bw, bh);
        if (sel) { ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(bx - 1.5, pBot - bh - 1.5, bw + 3, bh + 3); }
        if (hr % 3 === 0 || sel) text(ctx, n1(v), bx + bw / 2, pBot - bh - 10, `${sel ? 600 : 500} 17px ${MONO}`, sel ? ACCENT : INK, 'center');
      });
      hline(ctx, x0, x1, pBot, 2);
      for (let hr = 0; hr < 24; hr += 3) {
        const c = x0 + hr * slot + slot / 2;
        text(ctx, String(hr).padStart(2, '0') + 'h', c, pBot + 26, `500 16px ${MONO}`, MUTED, 'center');
        const w = dayHours.find(x => +x.time.slice(11, 13) === hr);
        if (!w || w.wind_direction_10m == null) continue;
        // seta apontando para onde o vento sopra
        ctx.save(); ctx.translate(c, pBot + 52); ctx.rotate(rad(w.wind_direction_10m));
        ctx.translate(0, 10); arrowHead(ctx, 20); ctx.fillStyle = WIND_COLOR; ctx.fill(); ctx.restore();
        text(ctx, n0(w.wind_speed_10m), c, pBot + 90, `600 17px ${MONO}`, INK, 'center');
      }
    }

    // maré
    {
      const x0 = 1220, x1 = WW - M;
      const X = t => x0 + (t - t0) / DAY * (x1 - x0);
      text(ctx, 'MARÉ', x0, 674, `600 20px ${MONO}`, ACCENT, 'left', 4);
      text(ctx, 'nível do mar (m)', x1, 674, `400 18px ${MONO}`, MUTED, 'right');
      shadeNight(x0, x1);
      const pts = dayHours.filter(x => x.sea_level_height_msl != null);
      if (pts.length > 1) {
        const vals = pts.map(p => p.sea_level_height_msl);
        let lo = Math.min(...vals), hi = Math.max(...vals);
        const m = Math.max(0.08, (hi - lo) * 0.35); lo -= m; hi += m;
        const Y = v => pTop + (hi - v) / (hi - lo) * (pBot - pTop);
        const PX = p => X(new Date(p.time).getTime());
        ctx.beginPath();
        pts.forEach((p, i) => i ? ctx.lineTo(PX(p), Y(p.sea_level_height_msl)) : ctx.moveTo(PX(p), Y(p.sea_level_height_msl)));
        ctx.strokeStyle = '#1f4f7a'; ctx.lineWidth = 4; ctx.stroke();
        ctx.lineTo(PX(pts[pts.length - 1]), pBot); ctx.lineTo(PX(pts[0]), pBot); ctx.closePath();
        ctx.fillStyle = 'rgba(31,79,122,.13)'; ctx.fill();
        (extra.extremes || []).filter(e => e.time >= t0 && e.time < t0 + DAY).forEach(e => {
          const ex = X(e.time), ey = Y(e.level), isHi = e.type === 'high', col = isHi ? '#1f4f7a' : ACCENT;
          ctx.fillStyle = col; ctx.beginPath(); ctx.arc(ex, ey, 7, 0, Math.PI * 2); ctx.fill();
          const al = ex < x0 + 70 ? 'left' : ex > x1 - 70 ? 'right' : 'center';
          text(ctx, `${isHi ? '▲' : '▼'} ${hm(e.time)} · ${e.level.toFixed(2)}`, ex, isHi || ey + 32 > pBot - 6 ? ey - 18 : ey + 32, `600 16px ${MONO}`, col, al);
        });
        const sx = X(new Date(h.time).getTime());
        ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.moveTo(sx, pTop - 20); ctx.lineTo(sx, pBot); ctx.stroke(); ctx.setLineDash([]);
      } else text(ctx, 'sem dados de maré', (x0 + x1) / 2, (pTop + pBot) / 2, `400 20px ${MONO}`, MUTED, 'center');
      hline(ctx, x0, x1, pBot, 2);
      for (let hr = 0; hr <= 24; hr += 6) {
        text(ctx, String(hr % 24).padStart(2, '0') + 'h', X(t0 + hr * 3600000), pBot + 26, `500 16px ${MONO}`, MUTED, hr === 0 ? 'left' : hr === 24 ? 'right' : 'center');
      }
      if (sun) text(ctx, `nascer do sol ${sun.sunrise.slice(11, 16)} · pôr ${sun.sunset.slice(11, 16)}`, x0, pBot + 90, `400 18px ${MONO}`, MUTED);
    }

    // rodapé
    const fy = HH - 92;
    hline(ctx, M, WW - M, fy, 3);
    text(ctx, 'Florianópolis · Open-Meteo (ECMWF WAM, MFWAM, GFS)', M, fy + 42, `400 22px ${MONO}`, MUTED);
    text(ctx, 'previsão modelada', WW - M, fy + 42, `italic 400 30px ${SERIF}`, INK, 'right');
  }

  // ---------- modal ----------
  let FORMAT = 'v';
  function open(beach, dayHours, startIdx, extra = {}) {
    close();
    const wrap = document.createElement('div');
    wrap.className = 'post-modal';
    wrap.innerHTML = `
      <div class="post-box" role="dialog" aria-modal="true" aria-label="Gerar post">
        <div class="post-bar">
          <span class="k">Post · ${beach.name}</span>
          <button class="icon-btn post-x" title="Fechar">✕</button>
        </div>
        <div class="seg post-fmt"><button data-f="v">Vertical 4:5</button><button data-f="h">Horizontal 16:9</button></div>
        <div class="post-hours">${dayHours.map((h, i) => `<button data-i="${i}">${h.time.slice(11, 13)}h</button>`).join('')}</div>
        <div class="post-prev"><canvas></canvas></div>
        <div class="post-actions">
          <button class="btn post-dl">Baixar imagem</button>
          ${navigator.canShare ? '<button class="btn post-share">Compartilhar</button>' : ''}
        </div>
      </div>`;
    document.body.appendChild(wrap);
    document.body.style.overflow = 'hidden';
    const canvas = wrap.querySelector('canvas');
    let idx = startIdx;
    const fileName = () => `passoka-${beach.id}-${dayHours[idx].time.slice(0, 13).replace('T', '-')}h${FORMAT === 'h' ? '-horizontal' : ''}.png`;

    async function render() {
      wrap.querySelectorAll('.post-hours button').forEach(b => b.classList.toggle('active', +b.dataset.i === idx));
      wrap.querySelectorAll('.post-fmt button').forEach(b => b.classList.toggle('active', b.dataset.f === FORMAT));
      wrap.querySelector('.post-box').classList.toggle('wide', FORMAT === 'h');
      await fontsReady();
      if (FORMAT === 'h') drawWide(canvas, beach, dayHours[idx], dayHours, extra);
      else draw(canvas, beach, dayHours[idx]);
    }
    const blob = () => new Promise(res => canvas.toBlob(res, 'image/png'));

    wrap.querySelectorAll('.post-hours button').forEach(b => b.onclick = () => { idx = +b.dataset.i; render(); });
    wrap.querySelectorAll('.post-fmt button').forEach(b => b.onclick = () => { FORMAT = b.dataset.f; render(); });
    wrap.querySelector('.post-x').onclick = close;
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    wrap.querySelector('.post-dl').onclick = async () => {
      const url = URL.createObjectURL(await blob());
      const a = document.createElement('a');
      a.href = url; a.download = fileName(); a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    };
    const sh = wrap.querySelector('.post-share');
    if (sh) sh.onclick = async () => {
      const file = new File([await blob()], fileName(), { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: `${beach.name} · Passoka Waves` }); } catch (e) { /* cancelado */ }
      } else wrap.querySelector('.post-dl').click();
    };
    document.addEventListener('keydown', onKey);
    const act = () => wrap.querySelector('.post-hours .active');
    render().then(() => { const a = act(); if (a) a.scrollIntoView({ block: 'nearest', inline: 'center' }); });
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  function close() {
    const m = document.querySelector('.post-modal');
    if (m) m.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
  }

  window.Post = { open, close, draw, drawWide, drawRose, fontsReady };
})();
