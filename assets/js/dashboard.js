/* The Quant Surveyor dashboard: Monitor, Macro, Cross-section and Micro panels built from data/dashboard.json,
   plus the section-nav highlight. Templating is innerHTML strings (the headless check runs the same code in a
   DOM stub), charts are Plotly with one dark theme, one y-axis per chart, colours fixed per entity. */
(function () {
  const { fmt, esc, route } = REI;
  let D = null;
  const dash = async () => D || (D = await REI.getJSON('dashboard.json'));
  const num = v => typeof v === 'number' && isFinite(v);
  const sgn = v => !num(v) ? '' : v > 0 ? 'up' : v < 0 ? 'down' : '';
  const f1 = (v, d = 1, s = true) => !num(v) ? '–' : (s && v > 0 ? '+' : '') + v.toFixed(d);
  const wash = (v, vmax) => !num(v) ? '' : `background:rgba(var(--${v < 0 ? 'down' : 'up'}-rgb),${(Math.min(1, Math.abs(v) / vmax) * 0.55).toFixed(3)})`;
  const chip = (v, d = 1, vmax = 10, suffix = '%') => `<span class="chip" style="${wash(v, vmax)}">${num(v) ? f1(v, d) + suffix : '–'}</span>`;
  const zbar = (v, vmax = 3) => { if (!num(v)) return '–'; const w = Math.min(1, Math.abs(v) / vmax) * 50; return `<span class="zbar" title="${v.toFixed(2)}"><i class="${sgn(v)}" style="${v < 0 ? `right:50%;width:${w}%` : `left:50%;width:${w}%`}"></i></span>`; };
  const REGION_COLOR = { Europe: '#7d93ff', Americas: '#ff6a4d', APAC: '#5ec8f0', MENA: '#c39be8', Africa: '#8fd16a' };
  const REGIONS = ['Europe', 'Americas', 'APAC', 'MENA', 'Africa'];
  const T = { bg: '#0d1526', elev: '#132038', ink1: '#f2f5fb', ink2: '#c0c9da', ink3: '#8e9ab0', grid: '#1a2641', axis: '#3a4b70', up: '#7d93ff', down: '#ff6a4d', volt: '#ffb224', slate: '#3b4a6b',
    seq: ['#7d93ff', '#ff6a4d', '#5ec8f0', '#c39be8', '#8fd16a', '#8fdcc8', '#ffb224'] };
  const DIV = [[0, T.down], [0.5, T.slate], [1, T.up]];
  const CFG = { displayModeBar: false, responsive: true };

  function layout(o = {}) {
    const ax = { gridcolor: T.grid, zerolinecolor: T.axis, linecolor: T.axis, tickcolor: T.axis, tickfont: { color: T.ink3, family: 'IBM Plex Mono, ui-monospace, monospace', size: 10.5 }, title: { text: '', font: { color: T.ink2 } } };
    const base = { paper_bgcolor: T.bg, plot_bgcolor: T.bg, font: { family: 'Barlow, system-ui, sans-serif', color: T.ink2, size: 12 }, margin: { l: 56, r: 16, t: 16, b: 40 },
      hovermode: 'closest', colorway: T.seq, legend: { orientation: 'h', y: 1.12, x: 0, font: { color: T.ink2 } },
      hoverlabel: { bgcolor: T.elev, bordercolor: T.slate, font: { color: T.ink1, family: 'Barlow Condensed, sans-serif', size: 12 } } };
    const out = Object.assign({}, base, o);
    out.xaxis = Object.assign({}, ax, o.xaxis || {}); out.yaxis = Object.assign({}, ax, o.yaxis || {});
    if (o.xaxis && o.xaxis.title) out.xaxis.title = Object.assign({ font: { color: T.ink2 } }, typeof o.xaxis.title === 'string' ? { text: o.xaxis.title } : o.xaxis.title);
    if (o.yaxis && o.yaxis.title) out.yaxis.title = Object.assign({ font: { color: T.ink2 } }, typeof o.yaxis.title === 'string' ? { text: o.yaxis.title } : o.yaxis.title);
    return out;
  }
  function plot(id, traces, lay) {
    const d = document.getElementById(id); if (!d) return;
    if (!window.Plotly || !window.Plotly.newPlot) { d.innerHTML = '<p class="note">Chart library did not load (network or content blocker). Tables are unaffected; reload to retry.</p>'; return; }
    window.Plotly.newPlot(d, traces, layout(lay), CFG);
  }
  const month = p => p && p.length === 7 ? p + '-01' : p;

  // ── small components ─────────────────────────────────────────────────────
  function sparkSvg(vals, { w = 100, h = 22, cls = 'spark', zero = true } = {}) {
    const v = (vals || []).filter(num); if (v.length < 2) return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" aria-hidden="true"></svg>`;
    const lo = Math.min(...v, zero ? 0 : Infinity), hi = Math.max(...v, zero ? 0 : -Infinity), span = (hi - lo) || 1, pad = 2;
    const y = x => h - pad - (x - lo) / span * (h - 2 * pad);
    const pts = v.map((x, i) => [i / (v.length - 1) * w, y(x)]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const last = pts[pts.length - 1];
    return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${zero ? `<line x1="0" x2="${w}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}"/>` : ''}<path d="${d}"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2"/></svg>`;
  }
  function tile(label, value, { unit = '', d = 1, signed = false, delta = null, note = '', spark = null, sub = '' } = {}) {
    const dl = num(delta) ? `${delta > 0 ? '▲' : delta < 0 ? '▼' : '•'} ${f1(delta, d)} ${note}` : (sub || '');
    return `<div class="tile"><span class="label eyebrow">${label}</span><span class="value">${num(value) ? f1(value, d, signed) : (value ?? '–')}${unit ? `<span class="unit">${unit}</span>` : ''}</span><span class="delta">${esc(dl)}</span>${spark ? sparkSvg(spark) : ''}</div>`;
  }
  function seg(id, options, value) {
    return `<div class="seg" id="${id}" role="group">${options.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${v === value}">${l}</button>`).join('')}</div>`;
  }
  function onSeg(id, cb) {
    const el = document.getElementById(id); if (!el) return;
    el.addEventListener('click', e => { const b = e.target.closest ? e.target.closest('button[data-v]') : null; if (!b) return;
      (el.querySelectorAll ? [...el.querySelectorAll('button')] : []).forEach(x => x.setAttribute('aria-pressed', String(x === b))); cb(b.dataset.v); });
  }
  /* Sortable table from column specs: {k, label, num, render(v,row), title}. Re-renders on header click. */
  function table(id, cols, rows, { sort = null, desc = true } = {}) {
    let key = sort, down = desc;
    const render = () => {
      const el = document.getElementById(id); if (!el) return;
      const sorted = rows.slice();
      if (key) sorted.sort((a, b) => { const x = a[key], y = b[key]; if (x == null) return 1; if (y == null) return -1; const c = (num(x) && num(y)) ? x - y : String(x).localeCompare(String(y)); return down ? -c : c; });
      el.innerHTML = `<table class="data"><thead><tr>${cols.map(c => `<th data-k="${c.k}" class="${c.num ? 'n' : ''}" ${key === c.k ? `data-dir="${down ? 'desc' : 'asc'}" aria-sort="${down ? 'descending' : 'ascending'}"` : ''} title="${esc(c.title || '')}" role="button">${c.label}</th>`).join('')}</tr></thead>
        <tbody>${sorted.map(r => `<tr>${cols.map(c => `<td class="${c.num ? 'n' : (c.mono ? 't' : '')}">${c.render ? c.render(r[c.k], r) : (c.num ? f1(r[c.k], c.d ?? 1, c.signed ?? false) : esc(r[c.k] ?? '–'))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    };
    render();
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', e => { const th = e.target.closest ? e.target.closest('th[data-k]') : null; if (!th) return; const k = th.dataset.k; const c = cols.find(x => x.k === k); if (key === k) down = !down; else { key = k; down = !!(c && c.num); } render(); });
  }
  const hero = (kicker, title, sub, links = []) => `<div class="sh lg"><div class="sh-main"><span class="kicker">${kicker}</span><h2 class="sh-title">${title}</h2><p class="sh-sub">${sub}</p></div>
    <div class="sh-side">${links.map(([h, b, s]) => `<a class="sh-link" href="${h}"><b>${b} →</b><span>${s}</span></a>`).join('')}</div></div>`;
  const card = (id, title, ctx, span = '', extra = '') => `<figure class="card ${span}"><figcaption><h3>${title} ${ctx ? `<span class="ctx">${ctx}</span>` : ''}</h3>${extra}</figcaption><div id="${id}" class="plot"></div></figure>`;
  const cityLink = (r) => `<a href="#/city/${r.key}">${esc(r.name)}</a>`;
  const tierTag = r => r.tier === 'B' ? ' <span class="tag">index only</span>' : '';

  function setTab() {
    const hash = location.hash.replace(/^#/, '') || '/';
    const nav = document.getElementById('nav'); if (!nav || !nav.querySelectorAll) return;
    const key = hash.startsWith('/city/') || hash.startsWith('/area/') || hash.startsWith('/sold/') ? '/cities' : hash.startsWith('/country/') ? '/countries' : hash;
    [...nav.querySelectorAll('a.tab')].forEach(a => a.setAttribute('aria-selected', String(a.dataset.tab === key || (a.dataset.tab !== '/' && key.startsWith(a.dataset.tab)))));
  }
  window.addEventListener('hashchange', setTab);
  setTimeout(setTab, 0);


  // ── the movers tape (every route) and the month in five lines (Monitor) ─────────────────────────────────
  const fresh = (cs) => { const yrs = cs.map(c => +(c.data_through || '0').slice(0, 4)); const top = Math.max(...yrs); return cs.filter(c => +(c.data_through || '0').slice(0, 4) >= top - 1 && num(c.m12)); };
  async function tape() {
    const el = document.getElementById('ticker'); if (!el || el.dataset.done) return;
    let d; try { d = await dash(); } catch (e) { return; }
    const cs = fresh(d.cities).sort((a, b) => b.m12 - a.m12);
    const tick = c => `<a class="tick ${sgn(c.m12)}" href="#/city/${c.key}" title="${esc(c.name)}: ${f1(c.m12)}% over 12 months, through ${esc(c.data_through)}"><span class="nm">${esc(c.name)}</span><span class="chg">${f1(c.m12)}%</span><span class="thr">${esc(c.country)} · ${esc(c.data_through)}${c.tier === 'B' ? ' · index' : ''}</span></a>`;
    el.innerHTML = `<div class="ticker-in"><span class="tick-head">12m<br>leaders</span>${cs.slice(0, 12).map(tick).join('')}<span class="tick-sep"></span><span class="tick-head">12m<br>laggards</span>${cs.slice(-12).reverse().map(tick).join('')}</div>`;
    el.hidden = false; el.dataset.done = '1';
  }
  setTimeout(tape, 0);
  function fiveLines(d) {
    const cs = fresh(d.cities);
    if (!cs.length) return '';
    const by = (k, dir = 1) => cs.filter(c => num(c[k])).sort((a, b) => dir * (b[k] - a[k]))[0];
    const top = by('m12'), bot = by('m12', -1);
    const turns = cs.filter(c => num(c.m3) && Math.sign(c.m3) !== Math.sign(c.m12) && Math.abs(c.m3) > 0.5 && Math.abs(c.m12) > 1).sort((a, b) => Math.abs(b.m3) - Math.abs(a.m3));
    const turn = turns[0];
    const ctry = (d.countries || []).filter(c => num(c.pir_z)).sort((a, b) => b.pir_z - a.pir_z)[0];
    const K = d.kpis.breadth_cities;
    const t = (href, k, v, cls, p) => `<a class="week-tile" href="${href}"><span class="k">${k}</span><span class="v ${cls}">${v}</span><p>${p}</p></a>`;
    const tiles = [
      t(`#/city/${top.key}`, 'Biggest riser', `${f1(top.m12)}%`, 'up', `${esc(top.name)} over 12 months, through ${esc(top.data_through)}${top.tier === 'B' ? ' (official index)' : ''}.`),
      t(`#/city/${bot.key}`, 'Biggest faller', `${f1(bot.m12)}%`, bot.m12 < 0 ? 'down' : 'up', `${esc(bot.name)} over 12 months, through ${esc(bot.data_through)}.`),
      turn ? t(`#/city/${turn.key}`, turn.m3 > 0 ? 'Turning up' : 'Turning down', `${f1(turn.m3)}%`, sgn(turn.m3), `${esc(turn.name)}: three months against a 12-month ${f1(turn.m12)}%.`)
           : t('#/xsection', 'No turns', '–', '', 'No city has a 3-month move against its 12-month trend.'),
      t('#/xsection', 'Breadth', `${f1(K.value, 0, false)}%`, '', `of ${cs.length} cities rising over 12 months${num(K.delta) ? `, ${f1(K.delta, 0)} pts on a year ago` : ''}.`),
      ctry ? t(`#/country/${ctry.iso2}`, 'Most stretched', `z ${f1(ctry.pir_z, 1)}`, 'down', `${esc(ctry.name)}: price-to-income against its own 20-year history.`) : '',
    ];
    return `<div class="sh week-head"><div class="sh-main"><span class="kicker">The month in five lines</span></div></div><section class="week" aria-label="The month in five lines">${tiles.join('')}</section>`;
  }

  // ── Monitor ──────────────────────────────────────────────────────────────
  route('/', async (app) => {
    const d = await dash(); const K = d.kpis; const X = d.xsection;
    const asof = document.getElementById('asof-top'); if (asof) asof.innerHTML = `Cities through <b>${esc(d.data_through.cities)}</b> · countries <b>${esc(d.data_through.countries || '–')}</b> · built <b>${esc(d.as_of)}</b>`;
    let region = 'All', horizon = 'm12';
    const HZ = { m3: '3 months', m12: '12 months', y5: '5 years', y10: '10 years', real_m12: 'Real 12m' };
    app.innerHTML = hero(`Global residential real estate · ${d.cities.length} cities · ${d.countries.length} countries · through ${esc(d.data_through.cities)} · built ${esc(d.as_of)}`, 'Every market, by the numbers.',
      `Repeat-sales indices from open deed registers in ${d.cities.filter(c => c.tier !== 'B').length} cities down to the neighbourhood, official city and district indices in ${d.cities.filter(c => c.tier === 'B').length} more, with price tiers, seller outcomes and liquidity; real prices, valuation, exuberance tests and a common factor across ${d.countries.length} countries. Nothing scraped, nothing paid for, nothing you cannot audit.`,
      [['#/macro', 'Macro', 'Countries, valuation, exuberance'], ['#/xsection', 'Cross-section', 'Who moves together'], ['#/micro', 'Micro', 'Tiers, liquidity, sellers']])
      + `<section class="kpis" aria-label="Global indicators">
        ${tile('Cities rising · 12m', K.breadth_cities.value, { unit: '%', d: 0, delta: K.breadth_cities.delta, note: 'pts vs 1y ago', spark: K.breadth_cities.spark })}
        ${tile('Median city · 12m', K.median_m12.value, { unit: '%', signed: true, delta: K.median_m12.delta, note: 'pts vs 1y ago', spark: K.median_m12.spark })}
        ${tile('Dispersion · 12m', K.dispersion.value, { unit: 'pp', d: 1, spark: K.dispersion.spark, sub: 'cross-city sd of 12m change' })}
        ${K.factor ? tile('Global factor · 4q', K.factor.value, { d: 2, signed: true, delta: K.factor.delta, note: 'vs 1y ago', spark: K.factor.spark }) : ''}
        ${tile('Countries · real up 1y', K.countries_real_up.value, { unit: '%', d: 0, sub: K.countries_real_up.sub })}
        ${tile('Exuberant · GSADF', K.exuberant.value, { d: 0, sub: `${K.stretched.value} stretched on price/income` })}
      </section>
      ${fiveLines(d)}
      <div class="filters"><span class="filter-label">Region</span>${seg('f-region', [['All', 'All'], ...REGIONS.map(r => [r, r])], region)}
        <span class="filter-label">Horizon</span>${seg('f-horizon', Object.entries(HZ), horizon)}<span class="spacer"></span><span class="filter-label" id="mon-count"></span></div>
      <div class="grid">
        <figure class="card"><figcaption><h3>City board <span class="ctx">repeat-sales indices from registers and official city indices · changes to the last complete period · click a column to sort</span></h3></figcaption><div class="tablewrap" id="board" style="max-height:640px"></div>
          <p class="note">Real 12m: nominal less the country's CPI inflation implied by the BIS nominal and real indices (approximate). Vol: annualised sd of monthly log changes, 3y. Drawdown: from the all-time high. Gap: log level vs its 5-year mean. z12: the 12-month change against the city's own history. Tier spread: top-third minus bottom-third 12m change. Loss share: resales below the purchase price, last full year. Vol z: 12-month sales count against its history.</p></figure>
        ${card('c-ladder', 'Momentum ladder', 'ranked · coral falling, cobalt rising', 'seventwelfths')}
        ${card('c-phase', 'Phase diagram', '12m change × 3m change · colour by region', 'fivetwelfths')}
        <figure class="card"><figcaption><h3>All cities <span class="ctx">10 years, rebased · value is the 12m change · select to open</span></h3></figcaption><div class="multiples" id="multiples"></div></figure>
        ${card('c-breadth', 'Breadth', 'share of cities with a positive 12m change', 'half')}
        ${card('c-median', 'Median and dispersion', 'median city 12m change, band = ±1 cross-city sd', 'half')}
        <figure class="card"><figcaption><h3>Coverage <span class="ctx">registers, spans, sample sizes</span></h3></figcaption><div class="tablewrap" id="coverage" style="max-height:420px"></div></figure>
      </div>`;
    const rows = () => d.cities.filter(c => region === 'All' || c.region === region);
    const renderBoard = () => {
      const rs = rows();
      const cnt = document.getElementById('mon-count'); if (cnt) cnt.textContent = `${rs.length} cities`;
      table('board', [
        { k: 'name', label: 'City', render: (v, r) => cityLink(r) + tierTag(r) },
        { k: 'region', label: 'Region' },
        { k: 'data_through', label: 'Through', mono: true },
        { k: 'm1', label: '1m', num: true, render: v => chip(v, 1, 3) },
        { k: 'm3', label: '3m', num: true, render: v => chip(v, 1, 5) },
        { k: 'm12', label: '12m', num: true, render: v => chip(v, 1, 10) },
        { k: 'real_m12', label: 'Real 12m', num: true, render: v => chip(v, 1, 10) },
        { k: 'y5', label: '5y', num: true, render: v => chip(v, 0, 50) },
        { k: 'y10', label: '10y', num: true, render: v => chip(v, 0, 100) },
        { k: 'vol', label: 'Vol', num: true, title: 'annualised sd of monthly log changes, 3y', render: v => num(v) ? v.toFixed(1) + '%' : '–' },
        { k: 'dd', label: 'Drawdown', num: true, render: v => num(v) ? (v < -0.05 ? `<span class="down">${v.toFixed(1)}%</span>` : 'at high') : '–' },
        { k: 'trend_gap', label: 'Gap 5y', num: true, title: 'log level vs 5-year mean', render: v => chip(v, 1, 15) },
        { k: 'z12', label: 'z12', num: true, render: v => zbar(v) },
        { k: 'tier_spread', label: 'Tier spread', num: true, render: v => chip(v, 1, 5) },
        { k: 'loss_share', label: 'Loss share', num: true, render: v => num(v) ? v.toFixed(1) + '%' : '–' },
        { k: 'vol_z', label: 'Vol z', num: true, render: v => zbar(v) },
      ], rs, { sort: 'm12', desc: true });
      renderLadder(); renderPhase(); renderMultiples(); renderCoverage();
    };
    const renderLadder = () => {
      const rs = rows().filter(r => num(r[horizon])).sort((a, b) => a[horizon] - b[horizon]);
      plot('c-ladder', [{ type: 'bar', orientation: 'h', x: rs.map(r => r[horizon]), y: rs.map(r => r.name), marker: { color: rs.map(r => r[horizon] < 0 ? T.down : T.up) },
        text: rs.map(r => f1(r[horizon], 1) + '%'), textposition: 'outside', textfont: { color: T.ink2, size: 11 }, cliponaxis: false, hovertemplate: '%{y}: %{x:+.1f}%<extra></extra>' }],
        { height: Math.max(360, 18 * rs.length + 60), margin: { l: 150, r: 60, t: 10, b: 36 }, xaxis: { title: `${HZ[horizon]} change, %`, zeroline: true }, yaxis: { tickfont: { size: 11 } }, showlegend: false, bargap: 0.25 });
    };
    const renderPhase = () => {
      const rs = rows().filter(r => num(r.m12) && num(r.m3));
      const traces = REGIONS.filter(g => rs.some(r => r.region === g)).map(g => { const s = rs.filter(r => r.region === g); return { type: 'scatter', mode: 'markers+text', name: g, x: s.map(r => r.m12), y: s.map(r => r.m3), text: s.map(r => r.name), textposition: 'top center', textfont: { size: 10, color: T.ink3 },
        marker: { size: 9, color: REGION_COLOR[g], line: { color: T.bg, width: 1.5 } }, hovertemplate: '%{text}<br>12m %{x:+.1f}% · 3m %{y:+.1f}%<extra></extra>' }; });
      plot('c-phase', traces, { height: 420, xaxis: { title: '12-month change, %', zeroline: true }, yaxis: { title: '3-month change, %', zeroline: true },
        shapes: [{ type: 'line', x0: 0, x1: 0, yref: 'paper', y0: 0, y1: 1, line: { color: T.axis, width: 1 } }, { type: 'line', y0: 0, y1: 0, xref: 'paper', x0: 0, x1: 1, line: { color: T.axis, width: 1 } }],
        annotations: [['Rising, accelerating', 1, 1], ['Falling, bouncing', 0, 1], ['Falling, falling', 0, 0], ['Rising, cooling', 1, 0]].map(([t, x, y]) => ({ text: t, xref: 'paper', yref: 'paper', x: x ? 0.99 : 0.01, y: y ? 0.98 : 0.02, xanchor: x ? 'right' : 'left', yanchor: y ? 'top' : 'bottom', showarrow: false, font: { color: T.ink3, size: 11 } })) });
    };
    const renderMultiples = () => {
      const el = document.getElementById('multiples'); if (!el) return;
      const rs = rows().filter(r => r.spark && r.spark.length > 12).sort((a, b) => (b.m12 ?? -99) - (a.m12 ?? -99));
      el.innerHTML = rs.map(r => {
        const v = r.spark, w = 150, h = 56, lo = Math.min(...v), hi = Math.max(...v), span = (hi - lo) || 1, y = x => 4 + (hi - x) / span * (h - 8);
        const pts = v.map((x, i) => [i / (v.length - 1) * w, y(x)]);
        const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
        const y100 = y(100), area = `M0 ${y100.toFixed(1)} ` + pts.map(p => `L${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ') + ` L${w} ${y100.toFixed(1)} Z`;
        return `<a class="mini" href="#/city/${r.key}" title="${esc(r.name)} · since ${r.spark_start}"><span class="t">${esc(r.name)}</span><span class="v ${sgn(r.m12)}">${f1(r.m12)}%</span>
          <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path class="${v[v.length - 1] >= 100 ? 'area-up' : 'area-down'}" d="${area}"/><line class="zero" x1="0" x2="${w}" y1="${y100.toFixed(1)}" y2="${y100.toFixed(1)}"/><path class="ln" d="${d}"/></svg>
          <span class="name">${esc(r.region || '')} · ${f1(v[v.length - 1] - 100, 0)}% over ${Math.round(v.length / (r.freq === 'Q' ? 4 : 12))}y</span></a>`;
      }).join('');
    };
    const renderCoverage = () => table('coverage', [
      { k: 'name', label: 'City', render: (v, r) => cityLink(r) + tierTag(r) }, { k: 'country', label: 'Country', mono: true }, { k: 'tier', label: 'Tier', mono: true },
      { k: 'start', label: 'From', mono: true }, { k: 'data_through', label: 'Through', mono: true }, { k: 'last_complete', label: 'Complete to', mono: true },
      { k: 'sales_total', label: 'Sales', num: true, render: v => fmt.num(v) }, { k: 'sales_12m', label: 'Sales 12m', num: true, render: v => fmt.num(v) }, { k: 'pairs', label: 'Repeat pairs', num: true, render: v => fmt.num(v) },
      { k: 'currency', label: 'Currency', mono: true },
    ], rows(), { sort: 'sales_total', desc: true });
    renderBoard();
    plot('c-breadth', [{ type: 'scatter', mode: 'lines', x: X.period.map(month), y: X.breadth, name: 'Breadth', line: { color: T.up, width: 2 }, fill: 'tozeroy', fillcolor: 'rgba(125,147,255,0.12)', connectgaps: false, hovertemplate: '%{x|%b %Y}: %{y:.0f}%<extra></extra>' }],
      { height: 320, hovermode: 'x unified', yaxis: { title: 'Cities with a positive 12m change, %', range: [0, 100] }, showlegend: false, shapes: [{ type: 'line', y0: 50, y1: 50, xref: 'paper', x0: 0, x1: 1, line: { color: T.axis, width: 1, dash: 'dot' } }] });
    const up = X.median_m12.map((m, i) => (m == null || X.dispersion[i] == null) ? null : m + X.dispersion[i]), dn = X.median_m12.map((m, i) => (m == null || X.dispersion[i] == null) ? null : m - X.dispersion[i]);
    plot('c-median', [
      { type: 'scatter', mode: 'lines', x: X.period.map(month), y: up, line: { width: 0 }, showlegend: false, hoverinfo: 'skip', connectgaps: false },
      { type: 'scatter', mode: 'lines', x: X.period.map(month), y: dn, line: { width: 0 }, fill: 'tonexty', fillcolor: 'rgba(147,155,171,0.18)', name: '±1 sd', hoverinfo: 'skip', connectgaps: false },
      { type: 'scatter', mode: 'lines', x: X.period.map(month), y: X.median_m12, name: 'Median city 12m', line: { color: T.volt, width: 2 }, connectgaps: false, hovertemplate: '%{x|%b %Y}: %{y:+.1f}%<extra></extra>' }],
      { height: 320, hovermode: 'x unified', yaxis: { title: '12-month change, %', zeroline: true } });
    onSeg('f-region', v => { region = v; renderBoard(); });
    onSeg('f-horizon', v => { horizon = v; renderLadder(); });
    document.getElementById('attribution').textContent = 'City payloads carry their own register attributions; see each city page. ' + (d.country_attribution || '');
  });

  // ── Macro ────────────────────────────────────────────────────────────────
  route('/macro', async (app) => {
    const d = await dash(); const C = d.countries.filter(r => r.last_period); const G = d.global; const H = d.country_heat;
    const real = C.filter(r => num(r.real_1y));
    const med = a => { const s = a.filter(num).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
    app.innerHTML = hero(`Macro · ${C.length} countries · BIS and OECD · through ${esc(d.data_through.countries || '')}`, 'Real prices, valuation, exuberance.',
      'Country house prices deflated by CPI, standardised price-to-income and price-to-rent against each country\'s own twenty-year history, drawdowns from the real peak, a property clock, a GSADF test for explosive dynamics and the common factor across countries.',
      [['#/', 'Monitor', 'The city board'], ['#/countries', 'Countries', 'The templated read and property clock'], ['#/xsection', 'Cross-section', 'Cities together']])
      + `<section class="kpis">
        ${tile('Real prices up · 1y', d.kpis.countries_real_up.value, { unit: '%', d: 0, sub: `${real.length} countries with data` })}
        ${tile('Median real · 1y', med(real.map(r => r.real_1y)), { unit: '%', signed: true })}
        ${tile('Median real · 5y', med(C.map(r => r.real_5y)), { unit: '%', signed: true })}
        ${tile('Stretched · P/I z > 1', d.kpis.stretched.value, { d: 0, sub: `${C.filter(r => (r.pir_z || 0) < -1).length} cheap on the same test` })}
        ${tile('Exuberant · GSADF', d.kpis.exuberant.value, { d: 0, sub: (G && G.flagged_now || []).join(', ') || 'none flagged' })}
        ${d.kpis.factor ? tile('Global factor · 4q', d.kpis.factor.value, { d: 2, signed: true, delta: d.kpis.factor.delta, note: 'vs 1y ago', spark: d.kpis.factor.spark }) : ''}
      </section>
      <div class="grid">
        <figure class="card"><figcaption><h3>Country board <span class="ctx">real = CPI-deflated · z against own 20y history · click to sort</span></h3></figcaption><div class="tablewrap" id="cboard" style="max-height:620px"></div>
          <p class="note">Clock phases from the sign of the real 1y change and its acceleration: boom (rising, accelerating), slowdown (rising, decelerating), downturn (falling, decelerating), recovery (falling, improving). Half-life: AR(1) on the trend gap. Beta and R²: against the first principal component of real returns across countries since 1990. Exuberant: backward sup-ADF above its 95% Monte Carlo value in the latest quarter.</p></figure>
        ${card('c-realrank', 'Real house prices, 1 year', 'ranked', 'half')}
        ${card('c-valuation', 'Valuation vs momentum', 'price/income z-score × real 1y change', 'half')}
        ${card('c-clock', 'Property clock', 'real 1y change × acceleration (pts)', 'half')}
        ${card('c-drawdown', 'Distance from the real peak', 'current drawdown, %', 'half')}
        ${card('c-heat', 'Country × year', 'real house price change, % · coral falling, cobalt rising', '')}
        ${G ? card('c-factor', 'Global housing factor', `first principal component · ${(100 * G.explained).toFixed(0)}% of variance · bars quarterly, line 4q average`, 'half') : ''}
        ${G ? card('c-corr', 'Co-movement', `mean pairwise correlation of real returns · trailing ${G.rolling_corr.window_quarters / 4}y`, 'half') : ''}
      </div>`;
    table('cboard', [
      { k: 'name', label: 'Country', render: (v, r) => `<a href="#/country/${r.iso2}">${esc(v)}</a>` }, { k: 'region', label: 'Region' }, { k: 'last_period', label: 'Through', mono: true },
      { k: 'nominal_1y', label: 'Nominal 1y', num: true, render: v => chip(v, 1, 10) }, { k: 'real_1y', label: 'Real 1y', num: true, render: v => chip(v, 1, 10) },
      { k: 'real_5y', label: 'Real 5y', num: true, render: v => chip(v, 0, 30) }, { k: 'real_10y', label: 'Real 10y', num: true, render: v => chip(v, 0, 60) },
      { k: 'pir_z', label: 'P/I z', num: true, render: v => zbar(v, 2.5) }, { k: 'prr_z', label: 'P/R z', num: true, render: v => zbar(v, 2.5) },
      { k: 'dd_current', label: 'Drawdown', num: true, render: v => num(v) ? (v < -0.5 ? `<span class="down">${v.toFixed(1)}%</span>` : 'at high') : '–' },
      { k: 'trend_gap', label: 'Trend gap', num: true, render: v => chip(v, 1, 20) }, { k: 'accel', label: 'Accel', num: true, render: v => chip(v, 1, 5, ' pts') },
      { k: 'clock', label: 'Clock', render: v => v ? `<span class="tag ${v === 'boom' || v === 'recovery' ? 'up' : 'down'}">${esc(v)}</span>` : '–' },
      { k: 'half_life_years', label: 'Half-life', num: true, render: v => num(v) ? v.toFixed(1) + 'y' : '–' },
      { k: 'beta', label: 'Beta', num: true, render: v => num(v) ? (100 * v).toFixed(2) : '–', title: 'per 1 sd of the factor, % real' }, { k: 'r2', label: 'R²', num: true, render: v => num(v) ? v.toFixed(2) : '–' },
      { k: 'exuberant', label: 'GSADF', render: (v, r) => v ? `<span class="tag volt">exuberant</span>` : (num(r.gsadf) ? `<span class="mute">${r.gsadf.toFixed(2)} / ${(r.gsadf_cv95 || 0).toFixed(2)}</span>` : '–') },
    ], C, { sort: 'real_1y', desc: true });
    const rk = real.slice().sort((a, b) => a.real_1y - b.real_1y);
    plot('c-realrank', [{ type: 'bar', orientation: 'h', x: rk.map(r => r.real_1y), y: rk.map(r => r.name), marker: { color: rk.map(r => r.real_1y < 0 ? T.down : T.up) }, text: rk.map(r => f1(r.real_1y) + '%'), textposition: 'outside', textfont: { color: T.ink2, size: 10 }, cliponaxis: false, hovertemplate: '%{y}: %{x:+.1f}%<extra></extra>' }],
      { height: Math.max(420, 16 * rk.length + 50), margin: { l: 130, r: 56, t: 10, b: 36 }, xaxis: { title: 'Real house prices, 1y %', zeroline: true }, yaxis: { tickfont: { size: 10 } }, showlegend: false, bargap: 0.25 });
    const vr = C.filter(r => num(r.pir_z) && num(r.real_1y));
    const byRegion = (rs, xk, yk, hover) => Object.keys(REGION_COLOR).filter(g => rs.some(r => r.region === g)).map(g => { const s = rs.filter(r => r.region === g); return { type: 'scatter', mode: 'markers+text', name: g, x: s.map(r => r[xk]), y: s.map(r => r[yk]), text: s.map(r => r.iso2), textposition: 'top center', textfont: { size: 10, color: T.ink3 }, marker: { size: 9, color: REGION_COLOR[g], line: { color: T.bg, width: 1.5 } }, customdata: s.map(r => r.name), hovertemplate: hover }; });
    plot('c-valuation', byRegion(vr, 'pir_z', 'real_1y', '%{customdata}<br>P/I z %{x:.2f} · real 1y %{y:+.1f}%<extra></extra>'), { height: 420, xaxis: { title: 'Price-to-income, z-score vs own 20y', zeroline: true }, yaxis: { title: 'Real house prices, 1y %', zeroline: true },
      annotations: [['Expensive and rising', 1, 1], ['Cheap and rising', 0, 1], ['Cheap and falling', 0, 0], ['Expensive and falling', 1, 0]].map(([t, x, y]) => ({ text: t, xref: 'paper', yref: 'paper', x: x ? 0.99 : 0.01, y: y ? 0.98 : 0.02, xanchor: x ? 'right' : 'left', yanchor: y ? 'top' : 'bottom', showarrow: false, font: { color: T.ink3, size: 11 } })) });
    const ck = C.filter(r => num(r.yoy) && num(r.accel));
    plot('c-clock', byRegion(ck, 'yoy', 'accel', '%{customdata}<br>real 1y %{x:+.1f}% · accel %{y:+.1f} pts<extra></extra>'), { height: 420, xaxis: { title: 'Real house prices, 1y %', zeroline: true }, yaxis: { title: 'Acceleration: 1y change minus a year earlier, pts', zeroline: true },
      annotations: [['Boom', 1, 1], ['Recovery', 0, 1], ['Downturn', 0, 0], ['Slowdown', 1, 0]].map(([t, x, y]) => ({ text: t, xref: 'paper', yref: 'paper', x: x ? 0.99 : 0.01, y: y ? 0.98 : 0.02, xanchor: x ? 'right' : 'left', yanchor: y ? 'top' : 'bottom', showarrow: false, font: { color: T.ink3, size: 11 } })) });
    const dd = C.filter(r => num(r.dd_current)).sort((a, b) => a.dd_current - b.dd_current);
    plot('c-drawdown', [{ type: 'bar', orientation: 'h', x: dd.map(r => r.dd_current), y: dd.map(r => r.name), marker: { color: dd.map(r => r.dd_current < -10 ? T.down : T.slate) }, hovertemplate: '%{y}: %{x:.1f}% from the real peak<extra></extra>' }],
      { height: Math.max(420, 16 * dd.length + 50), margin: { l: 130, r: 16, t: 10, b: 36 }, xaxis: { title: 'Real price vs all-time high, %' }, yaxis: { tickfont: { size: 10 } }, showlegend: false, bargap: 0.25 });
    if (H && H.rows.length) {
      const hr = H.rows.slice().sort((a, b) => (a.region || '').localeCompare(b.region || '') || a.name.localeCompare(b.name));
      plot('c-heat', [{ type: 'heatmap', x: H.years, y: hr.map(r => r.name), z: hr.map(r => r.values), colorscale: DIV, zmid: 0, zmin: -20, zmax: 20, xgap: 2, ygap: 2, colorbar: { title: { text: '%' }, tickfont: { color: T.ink3, family: 'IBM Plex Mono, ui-monospace, monospace', size: 10.5 }, outlinewidth: 0, thickness: 10 }, hovertemplate: '%{y} · %{x}: %{z:+.1f}%<extra></extra>' }],
        { height: Math.max(520, 16 * hr.length + 60), margin: { l: 130, r: 16, t: 10, b: 36 }, yaxis: { tickfont: { size: 10 }, autorange: 'reversed' } });
    }
    if (G) {
      plot('c-factor', [{ type: 'bar', x: G.factor.period.map(month), y: G.factor.value, name: 'Quarterly', marker: { color: 'rgba(125,147,255,0.45)' }, hovertemplate: '%{x|%b %Y}: %{y:.2f}<extra></extra>' },
        { type: 'scatter', mode: 'lines', x: G.factor_4q.period.map(month), y: G.factor_4q.value, name: '4-quarter average', line: { color: T.volt, width: 2 }, connectgaps: false, hovertemplate: '%{x|%b %Y}: %{y:.2f}<extra></extra>' }],
        { height: 340, hovermode: 'x unified', yaxis: { title: 'Factor score (sd units)', zeroline: true } });
      plot('c-corr', [{ type: 'scatter', mode: 'lines', x: G.rolling_corr.period.map(month), y: G.rolling_corr.value, name: 'Mean pairwise correlation', line: { color: '#8fdcc8', width: 2 }, connectgaps: false, hovertemplate: '%{x|%b %Y}: %{y:.2f}<extra></extra>' }],
        { height: 340, hovermode: 'x unified', yaxis: { title: 'Correlation', zeroline: true }, showlegend: false });
    }
    document.getElementById('attribution').textContent = d.country_attribution || '';
  });

  // ── Cross-section ────────────────────────────────────────────────────────
  route('/xsection', async (app) => {
    const d = await dash(); const X = d.xsection; const R = d.corr;
    const pickDefault = ['london', 'new_york', 'sydney', 'paris', 'singapore', 'sao_paulo'].filter(k => d.cities.some(c => c.key === k && c.tier !== 'B'));
    let picked = new Set(pickDefault);
    const A = d.cities.filter(c => c.tier !== 'B');
    app.innerHTML = hero(`Cross-section · ${A.length} sold-record cities`, 'Who moves together.',
      'Equal-weight regional indices, the breadth of rising cities, the dispersion of their 12-month changes, pairwise correlations of quarterly changes and a compare tool on a common base.',
      [['#/', 'Monitor', 'The city board'], ['#/macro', 'Macro', 'Countries'], ['#/micro', 'Micro', 'Tiers and liquidity']])
      + `<div class="grid">
        ${card('c-regions', 'Regional indices', 'equal-weight mean of city log changes · 2015 = 100 · months with at least three cities', 'twothirds')}
        ${card('c-disp', 'Dispersion', 'cross-city sd of 12m changes, pp', 'third')}
        <figure class="card twothirds"><figcaption><h3>Compare cities <span class="ctx">rebased to 100 at the first common month · pick the cities to show</span></h3></figcaption>
          <div class="chips" id="pick"></div><div id="c-compare" class="plot"></div></figure>
        <figure class="card third"><figcaption><h3>City vs nation <span class="ctx">city 12m less the national nominal 1y, pts</span></h3></figcaption><div class="tablewrap" id="vsnation" style="max-height:520px"></div>
          <p class="note">A positive premium means the city outran its national index over the past year. National figures are BIS, through the latest quarter.</p></figure>
        <figure class="card"><figcaption><h3>Correlation of quarterly changes <span class="ctx">${R.years}y window · at least 24 overlapping quarters · coral negative, cobalt positive</span></h3></figcaption><div id="c-corrmat" class="plot"></div></figure>
      </div>`;
    const groups = Object.keys(X.index);
    const gcolor = { All: T.volt, Europe: REGION_COLOR.Europe, Americas: REGION_COLOR.Americas, APAC: REGION_COLOR.APAC };
    plot('c-regions', groups.map(g => ({ type: 'scatter', mode: 'lines', x: X.period.map(month), y: X.index[g], name: g, line: { color: gcolor[g] || T.ink3, width: g === 'All' ? 2.5 : 1.8 }, connectgaps: false, hovertemplate: '%{x|%b %Y}: %{y:.1f}<extra>' + g + '</extra>' })),
      { height: 400, hovermode: 'x unified', yaxis: { title: 'Index, 2015 = 100' } });
    plot('c-disp', [{ type: 'scatter', mode: 'lines', x: X.period.map(month), y: X.dispersion, name: 'Dispersion', line: { color: '#c39be8', width: 2 }, connectgaps: false, hovertemplate: '%{x|%b %Y}: %{y:.1f} pp<extra></extra>' }],
      { height: 400, hovermode: 'x unified', yaxis: { title: 'sd of 12m changes across cities, pp', rangemode: 'tozero' }, showlegend: false });
    const vs = A.map(c => { const n = d.countries.find(r => r.iso2 === c.country); return Object.assign({}, c, { nation: n ? n.nominal_1y : null, premium: n && num(n.nominal_1y) && num(c.m12) ? c.m12 - n.nominal_1y : null, nation_real: n ? n.real_1y : null }); });
    table('vsnation', [
      { k: 'name', label: 'City', render: (v, r) => cityLink(r) }, { k: 'm12', label: 'City 12m', num: true, render: v => chip(v, 1, 10) },
      { k: 'nation', label: 'Nation 1y', num: true, render: v => chip(v, 1, 10) }, { k: 'premium', label: 'Premium', num: true, render: v => chip(v, 1, 8, ' pts') },
      { k: 'real_m12', label: 'City real', num: true, render: v => chip(v, 1, 10) },
    ], vs, { sort: 'premium', desc: true });
    if (R.keys.length) {
      plot('c-corrmat', [{ type: 'heatmap', x: R.names, y: R.names, z: R.matrix, colorscale: DIV, zmid: 0, zmin: -1, zmax: 1, xgap: 2, ygap: 2, colorbar: { tickfont: { color: T.ink3, family: 'IBM Plex Mono, ui-monospace, monospace', size: 10.5 }, outlinewidth: 0, thickness: 10 }, hovertemplate: '%{y} × %{x}: %{z:.2f}<extra></extra>' }],
        { height: Math.max(520, 20 * R.names.length + 120), margin: { l: 150, r: 16, t: 10, b: 130 }, xaxis: { tickangle: -60, tickfont: { size: 10 } }, yaxis: { tickfont: { size: 10 }, autorange: 'reversed' } });
    }
    const renderPick = () => {
      const el = document.getElementById('pick'); if (!el) return;
      el.innerHTML = A.map((c, i) => `<button type="button" class="chip-btn" data-k="${c.key}" aria-pressed="${picked.has(c.key)}" style="--c:${T.seq[[...picked].indexOf(c.key) % T.seq.length] || T.axis}"><i></i>${esc(c.name)}</button>`).join('');
    };
    const renderCompare = async () => {
      const keys = [...picked];
      const sums = await Promise.all(keys.map(k => REI.city(k).catch(() => null)));
      const series = sums.filter(Boolean).map(s => ({ name: s.name, p: s.index.period, v: s.index.value }));
      if (!series.length) { const el = document.getElementById('c-compare'); if (el) el.innerHTML = '<p class="empty">Pick at least one city.</p>'; return; }
      const start = series.map(s => s.p[0]).sort().slice(-1)[0];
      const traces = series.map((s, i) => { const j = s.p.indexOf(start) >= 0 ? s.p.indexOf(start) : 0; const base = s.v[j]; return { type: 'scatter', mode: 'lines', name: s.name, x: s.p.slice(j).map(month), y: s.v.slice(j).map(x => 100 * x / base), line: { color: T.seq[i % T.seq.length], width: 1.8 }, hovertemplate: '%{x|%b %Y}: %{y:.1f}<extra>' + esc(s.name) + '</extra>' }; });
      plot('c-compare', traces, { height: 420, hovermode: 'x unified', yaxis: { title: `Index, ${start} = 100` } });
    };
    renderPick(); renderCompare();
    const pk = document.getElementById('pick');
    if (pk) pk.addEventListener('click', e => { const b = e.target.closest ? e.target.closest('button[data-k]') : null; if (!b) return; const k = b.dataset.k; if (picked.has(k)) picked.delete(k); else if (picked.size < 7) picked.add(k); renderPick(); renderCompare(); });
    document.getElementById('attribution').textContent = 'City payloads carry their own register attributions; see each city page.';
  });

  // ── Micro ────────────────────────────────────────────────────────────────
  route('/micro', async (app) => {
    const d = await dash(); const A = d.cities.filter(c => c.tier !== 'B');
    app.innerHTML = hero(`Micro · ${A.length} sold-record cities`, 'Tiers, segments, sellers.',
      'Inside each city: the bottom, middle and top price tiers (Case-Shiller convention), flats against houses, new build against existing, and what sellers realised: the share of resales below the purchase price, quick resales, holding periods and the 12-month volume against its own history.',
      [['#/', 'Monitor', 'The city board'], ['#/xsection', 'Cross-section', 'Cities together'], ['#/cities', 'Cities', 'Open a city, area or sold record']])
      + `<div class="grid">
        <figure class="card seventwelfths"><figcaption><h3>Tier and segment spreads <span class="ctx">12m change differences, pts · last full data</span></h3></figcaption><div class="tablewrap" id="tiers" style="max-height:560px"></div>
          <p class="note">Tier spread: top-third minus bottom-third 12m change (a positive spread means the expensive end is leading). Flats − houses and new − existing likewise. Tiers follow the first-sale price against trailing tertile breakpoints.</p></figure>
        ${card('c-tierbars', 'Tier spread', 'top third minus bottom third, 12m, pts', 'fivetwelfths')}
        <figure class="card seventwelfths"><figcaption><h3>Seller outcomes <span class="ctx">from repeat-sale pairs · last full year</span></h3></figcaption><div class="tablewrap" id="liq" style="max-height:560px"></div>
          <p class="note">Loss share: resales below the purchase price. Flip share: resold within two years. Hold: median years between purchase and resale. Gross gain: median resale gain. Vol z: the 12-month sales count against the city's own history (sd units).</p></figure>
        ${card('c-loss', 'Losses vs prices', 'loss share × 12m change · colour by region', 'fivetwelfths')}
      </div>`;
    table('tiers', [
      { k: 'name', label: 'City', render: (v, r) => cityLink(r) }, { k: 'm12', label: 'All 12m', num: true, render: v => chip(v, 1, 10) },
      { k: 'tier_low_m12', label: 'Low tier', num: true, render: v => chip(v, 1, 10) }, { k: 'tier_high_m12', label: 'High tier', num: true, render: v => chip(v, 1, 10) },
      { k: 'tier_spread', label: 'Spread', num: true, render: v => chip(v, 1, 5, ' pts') }, { k: 'flat_house', label: 'Flats − houses', num: true, render: v => chip(v, 1, 5, ' pts') },
      { k: 'new_existing', label: 'New − existing', num: true, render: v => chip(v, 1, 5, ' pts') },
    ], A, { sort: 'tier_spread', desc: true });
    const ts = A.filter(r => num(r.tier_spread)).sort((a, b) => a.tier_spread - b.tier_spread);
    plot('c-tierbars', [{ type: 'bar', orientation: 'h', x: ts.map(r => r.tier_spread), y: ts.map(r => r.name), marker: { color: ts.map(r => r.tier_spread < 0 ? T.down : T.up) }, hovertemplate: '%{y}: %{x:+.1f} pts<extra></extra>' }],
      { height: Math.max(360, 18 * ts.length + 50), margin: { l: 150, r: 16, t: 10, b: 36 }, xaxis: { title: 'High tier minus low tier, 12m, pts', zeroline: true }, yaxis: { tickfont: { size: 11 } }, showlegend: false, bargap: 0.25 });
    table('liq', [
      { k: 'name', label: 'City', render: (v, r) => cityLink(r) }, { k: 'loss_year', label: 'Year', mono: true },
      { k: 'loss_share', label: 'Loss share', num: true, render: v => num(v) ? v.toFixed(1) + '%' : '–' }, { k: 'flip_share', label: 'Flip share', num: true, render: v => num(v) ? v.toFixed(1) + '%' : '–' },
      { k: 'hold_years', label: 'Hold', num: true, render: v => num(v) ? v.toFixed(1) + 'y' : '–' }, { k: 'gross_gain', label: 'Gross gain', num: true, render: v => num(v) ? f1(v, 0) + '%' : '–' },
      { k: 'sales_12m', label: 'Sales 12m', num: true, render: v => fmt.num(v) }, { k: 'vol_z', label: 'Vol z', num: true, render: v => zbar(v) },
    ], A, { sort: 'loss_share', desc: true });
    const ls = A.filter(r => num(r.loss_share) && num(r.m12));
    plot('c-loss', REGIONS.filter(g => ls.some(r => r.region === g)).map(g => { const s = ls.filter(r => r.region === g); return { type: 'scatter', mode: 'markers+text', name: g, x: s.map(r => r.m12), y: s.map(r => r.loss_share), text: s.map(r => r.name), textposition: 'top center', textfont: { size: 10, color: T.ink3 }, marker: { size: 9, color: REGION_COLOR[g], line: { color: T.bg, width: 1.5 } }, hovertemplate: '%{text}<br>12m %{x:+.1f}% · loss share %{y:.1f}%<extra></extra>' }; }),
      { height: 420, xaxis: { title: '12-month index change, %', zeroline: true }, yaxis: { title: 'Resales below purchase price, %', rangemode: 'tozero' } });
    document.getElementById('attribution').textContent = 'City payloads carry their own register attributions; see each city page.';
  });
})();
