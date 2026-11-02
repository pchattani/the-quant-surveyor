/* The Quant Surveyor: Screen (systematic opportunity screen with each factor's track record) and Health (housing
   market health and pockets of distress) from data/signals.json and data/dashboard.json. innerHTML templating and
   Plotly.newPlot only (the headless check runs this in a DOM stub). */
(function () {
  const { esc, route } = REI;
  let SG = null, DB = null;
  const sig = async () => SG || (SG = await REI.getJSON('signals.json'));
  const dash = async () => DB || (DB = await REI.getJSON('dashboard.json'));
  const num = v => typeof v === 'number' && isFinite(v);
  const f = (v, d = 1, s = true) => !num(v) ? '–' : (s && v > 0 ? '+' : '') + v.toFixed(d);
  const cls = v => !num(v) ? '' : v > 0 ? 'up' : v < 0 ? 'down' : '';
  const wash = (v, vmax) => !num(v) ? '' : `background:rgba(var(--${v < 0 ? 'down' : 'up'}-rgb),${(Math.min(1, Math.abs(v) / vmax) * 0.55).toFixed(3)})`;
  const chip = (v, d = 1, vmax = 10, suf = '%') => `<span class="chip" style="${wash(v, vmax)}">${num(v) ? f(v, d) + suf : '–'}</span>`;
  const T = { bg: '#0d1526', grid: '#1a2641', axis: '#3a4b70', ink2: '#c0c9da', ink3: '#8e9ab0', up: '#7d93ff', down: '#ff6a4d', amber: '#ffb224', sky: '#5ec8f0', plum: '#c39be8', leaf: '#8fd16a', slate: '#3b4a6b' };
  const MONO = 'IBM Plex Mono, ui-monospace, monospace';
  const REG = { Europe: '#7d93ff', Americas: '#ff6a4d', APAC: '#5ec8f0', MENA: '#c39be8', Africa: '#8fd16a' };
  const FLAG = { falling: 'falling 12m', drawdown: 'drawdown >10%', decelerating: 'decelerating', q_down: 'last qtr < −5% ann.', volume_collapse: 'volume collapse', losses_rising: 'seller losses rising', real_falling: 'real falling', stretched: 'stretched P/I', exuberant: 'exuberant' };
  const SORTKEY = { mom: 'Momentum', comp: 'Composite', acc: 'Acceleration', val: 'Value' };

  function layout(o = {}) {
    const ax = { gridcolor: T.grid, zerolinecolor: T.axis, linecolor: T.axis, tickcolor: T.axis, tickfont: { color: T.ink3, family: MONO, size: 10.5 } };
    const L = Object.assign({ paper_bgcolor: T.bg, plot_bgcolor: T.bg, font: { family: 'Barlow, system-ui, sans-serif', color: T.ink2, size: 12 }, margin: { l: 52, r: 14, t: 14, b: 40 },
      hovermode: 'closest', showlegend: false, legend: { orientation: 'h', y: 1.12, x: 0, font: { color: T.ink2 } },
      hoverlabel: { bgcolor: '#132038', bordercolor: T.slate, font: { color: '#f2f5fb', family: MONO, size: 12 } } }, o);
    L.xaxis = Object.assign({}, ax, o.xaxis || {}); L.yaxis = Object.assign({}, ax, o.yaxis || {});
    ['xaxis', 'yaxis'].forEach(a => { if (o[a] && o[a].title) L[a].title = Object.assign({ font: { color: T.ink3 } }, typeof o[a].title === 'string' ? { text: o[a].title } : o[a].title); });
    return L;
  }
  function plot(id, tr, lay) {
    const d = document.getElementById(id); if (!d) return;
    if (!window.Plotly || !window.Plotly.newPlot) { d.innerHTML = '<p class="note">Chart library did not load; tables are unaffected.</p>'; return; }
    window.Plotly.newPlot(d, tr, layout(lay), { displayModeBar: false, responsive: true });
  }
  const qd = q => `${q.slice(0, 4)}-${String(+q.slice(-1) * 3).padStart(2, '0')}-28`;
  const hero = (kicker, title, sub) => `<div class="sh lg"><div class="sh-main"><span class="kicker">${kicker}</span><h2 class="sh-title">${title}</h2><p class="sh-sub">${sub}</p></div></div>`;
  const card = (id, title, ctx, span = '') => `<figure class="card ${span}"><figcaption><h3>${title} ${ctx ? `<span class="ctx">${ctx}</span>` : ''}</h3></figcaption><div id="${id}" class="plot"></div></figure>`;
  const tile = (label, value, sub) => `<div class="tile"><div class="label eyebrow">${label}</div><div class="value">${value}</div><div class="delta">${sub || '&nbsp;'}</div></div>`;
  const seg = (id, opts, cur) => `<div class="seg" id="${id}" role="group">${opts.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${v === cur}">${l}</button>`).join('')}</div>`;
  const onSeg = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', e => { const b = e.target.closest ? e.target.closest('button[data-v]') : null; if (!b) return; [...el.querySelectorAll('button')].forEach(x => x.setAttribute('aria-pressed', String(x === b))); fn(b.dataset.v); }); };
  const flags = (r, withRisk = true) => (r.flags || []).map(k => `<span class="tag flag">${FLAG[k] || k}</span>`).join(' ') + (withRisk ? (r.risk || []).map(k => ` <span class="tag risk">${FLAG[k] || k}</span>`).join('') : '');
  const city = r => `<a href="#/city/${r.key}">${esc(r.name)}</a>${r.kind === 'index' ? ' <span class="tag">index</span>' : ''}${r.thin ? ' <span class="tag risk" title="thin or volatile official series: read with care">thin</span>' : ''}`;
  function table(id, cols, rows, { sort = null, desc = true, limit = 0 } = {}) {
    let key = sort, down = desc;
    const render = () => {
      const el = document.getElementById(id); if (!el) return;
      const s = rows.slice();
      if (key) s.sort((a, b) => { const x = a[key], y = b[key]; if (x == null) return 1; if (y == null) return -1; const c = (num(x) && num(y)) ? x - y : String(x).localeCompare(String(y)); return down ? -c : c; });
      const sl = limit ? s.slice(0, limit) : s;
      el.innerHTML = `<table class="data"><thead><tr>${cols.map(c => `<th data-k="${c.k}" class="${c.num ? 'n' : ''}" title="${esc(c.title || '')}" ${key === c.k ? `aria-sort="${down ? 'descending' : 'ascending'}"` : ''}>${c.label}${key === c.k ? (down ? ' ▾' : ' ▴') : ''}</th>`).join('')}</tr></thead>
        <tbody>${sl.map(r => `<tr>${cols.map(c => `<td class="${c.num ? 'n' : ''}">${c.render ? c.render(r[c.k], r) : esc(r[c.k] ?? '–')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    };
    render();
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', e => { const th = e.target.closest ? e.target.closest('th[data-k]') : null; if (!th) return; if (key === th.dataset.k) down = !down; else { key = th.dataset.k; down = true; } render(); });
  }

  // ── Screen ───────────────────────────────────────────────────────────────────────────────────────────
  route('/screen', async (app) => {
    const S = await sig();
    const B = S.backtest, H = B.horizons || {};
    let by = 'mom', region = 'All', kind = 'all';
    const best = Object.entries(B.summary).sort((a, b) => (b[1].mean_ic || -9) - (a[1].mean_ic || -9))[0];
    app.innerHTML = hero(`Opportunity screen · ${S.cities.length} cities · ${S.districts.n} districts · through ${esc(S.latest_q)}`, 'Where prices are going next, ranked.',
      `Every city scored on momentum, acceleration, value and liquidity, ranked cross-sectionally, with each factor's record at predicting the next year across our own history. Over ${B.dates.length} quarters, ${esc(SORTKEY[best[0]] || best[0])} has the best record (rank correlation ${f(best[1].mean_ic, 2, false)}); the screen ranks by it unless you choose otherwise.`)
      + `<div class="grid">
        <figure class="card half"><figcaption><h3>Track record <span class="ctx">rank correlation of each signal with the next change, across cities, per quarter</span></h3></figcaption>
          <div class="tablewrap"><table class="data"><thead><tr><th>Signal</th><th class="n">1 year</th><th class="n">t</th><th class="n">Hit rate</th><th class="n">Top − bottom third</th><th class="n">3 years</th><th class="n">5 years</th><th class="n">Last 3y</th></tr></thead><tbody>
          ${S.factors.map(x => { const s = B.summary[x.key] || {}; const h12 = (H['12'] || {})[x.key] || {}, h20 = (H['20'] || {})[x.key] || {};
            return `<tr><td><b>${esc(x.label)}</b><div class="mute" style="font-size:12px">${esc(x.desc)}</div></td><td class="n">${chip(s.mean_ic, 2, 0.5, '')}</td><td class="n">${f(s.t_stat, 1, false)}</td><td class="n">${f(s.hit, 0, false)}%</td><td class="n">${f(s.spread, 1)} pp</td><td class="n">${chip(h12.mean_ic, 2, 0.5, '')}</td><td class="n">${chip(h20.mean_ic, 2, 0.5, '')}</td><td class="n">${chip(s.recent_ic, 2, 0.5, '')}</td></tr>`; }).join('')}
          </tbody></table></div>
          <p class="note">Signals use data through the previous quarter (a publication lag); the forward change starts at the quarter. t uses non-overlapping dates. Top − bottom third: average next-year change of the top third of cities less the bottom third. Read with care: indices are smoothed and revised, which inflates persistence, and an index cannot be traded; treat this as evidence about where prices move, not a backtested return. Value (distance below the 5-year mean) has not predicted reversal at any horizon in this sample.</p></figure>
        ${card('c-ic', 'Signal strength through time', 'rank correlation per quarter, 1-year horizon; line = 8-quarter average', 'half')}
      </div>
      <div class="filters" style="margin-top:14px"><span class="filter-label">Rank by</span>${seg('f-by', Object.entries(SORTKEY), by)}
        <span class="filter-label">Region</span>${seg('f-reg', [['All', 'All'], ['Europe', 'Europe'], ['Americas', 'Americas'], ['APAC', 'APAC'], ['MENA', 'MENA'], ['Africa', 'Africa']], region)}
        <span class="filter-label">Data</span>${seg('f-kind', [['all', 'All'], ['sold', 'Sold records'], ['index', 'Official index']], kind)}<span class="spacer"></span><span class="filter-label" id="scr-n"></span></div>
      <div class="grid">
        <figure class="card"><figcaption><h3>The screen <span class="ctx">quintile 5 = strongest on the chosen signal · arrows = quintile change on the quarter · click a column to sort</span></h3></figcaption><div class="tablewrap" id="screen" style="max-height:640px"></div></figure>
        ${card('c-quad', 'Momentum and acceleration', '12-month change against last quarter annualised less 12m · colour by region', 'seventwelfths')}
        <figure class="card fivetwelfths"><figcaption><h3>What changed this quarter <span class="ctx">signal flips, quintile jumps, new drawdowns</span></h3></figcaption><div class="tablewrap" id="changes" style="max-height:420px"></div></figure>
        <figure class="card"><figcaption><h3>District screen <span class="ctx">${S.districts.n} neighbourhood indices in ${S.districts.cities} sold-record cities with mostly their own data · ranked on the same signals</span></h3></figcaption>
          <div class="filters">${seg('f-dist', [['top', 'Strongest'], ['recovery', 'Turning up from below trend'], ['hot', 'Hottest']], 'top')}</div><div class="tablewrap" id="dscreen" style="max-height:520px"></div></figure>
      </div>`;
    // IC through time
    const ics = B.ic.mom.map(x => x), roll = ics.map((_, i) => { const w = ics.slice(Math.max(0, i - 7), i + 1).filter(num); return w.length ? w.reduce((a, b) => a + b, 0) / w.length : null; });
    const drawIC = k => { const v = B.ic[k]; const r = v.map((_, i) => { const w = v.slice(Math.max(0, i - 7), i + 1).filter(num); return w.length ? w.reduce((a, b) => a + b, 0) / w.length : null; });
      plot('c-ic', [{ x: B.dates.map(qd), y: v, type: 'bar', marker: { color: v.map(x => (x || 0) >= 0 ? T.up : T.down), opacity: 0.55 }, hovertemplate: '%{x|%Y Q%q}: %{y:.2f}<extra></extra>', name: 'Quarter' },
        { x: B.dates.map(qd), y: r, type: 'scatter', mode: 'lines', line: { color: T.amber, width: 2 }, name: '8-quarter average', hovertemplate: '%{y:.2f}<extra>8q avg</extra>' }],
        { yaxis: { title: `Rank correlation · ${SORTKEY[k]}`, range: [-1, 1] }, bargap: 0.15 }); };
    void ics; void roll;
    const rows = () => S.cities.filter(r => (region === 'All' || r.region === region) && (kind === 'all' || r.kind === kind));
    const renderScreen = () => {
      const k = by === 'comp' ? 'score' : by;
      const rs = rows().map(r => Object.assign({}, r, { _s: r[k] }));
      const sorted = rs.filter(r => num(r._s)).sort((a, b) => a._s - b._s);
      sorted.forEach((r, i) => { r._q = 1 + Math.floor(5 * i / sorted.length); });
      const n = document.getElementById('scr-n'); if (n) n.textContent = `${rs.length} cities`;
      const qmove = r => r.quintile && r.prev_quintile && by === 'comp' ? (r.quintile > r.prev_quintile ? ' <span class="up">▲</span>' : r.quintile < r.prev_quintile ? ' <span class="down">▼</span>' : '') : '';
      table('screen', [
        { k: 'name', label: 'City', render: (v, r) => city(r) },
        { k: 'region', label: 'Region' },
        { k: 'through', label: 'Through' },
        { k: '_q', label: 'Quintile', num: true, render: (v, r) => num(v) ? `<span class="qn q${v}">${v}</span>${qmove(r)}` : '–' },
        { k: 'mom', label: '12m', num: true, title: 'momentum: 12-month change', render: v => chip(v, 1, 12) },
        { k: 'q_ann', label: 'Last qtr ann.', num: true, render: v => chip(v, 1, 15) },
        { k: 'acc', label: 'Accel.', num: true, title: 'last quarter annualised less the 12-month change', render: v => chip(v, 1, 10) },
        { k: 'val', label: 'Value', num: true, title: 'below the 5-year mean is positive', render: v => chip(v, 1, 15) },
        { k: 'liq', label: 'Volume z', num: true, title: 'sales volume vs its own year (sold-record cities)', render: v => num(v) ? f(v, 1) : '–' },
        { k: 'score', label: 'Composite', num: true, render: v => num(v) ? f(v, 2) : '–' },
        { k: 'dd', label: 'From peak', num: true, render: v => num(v) ? (v < -0.5 ? `<span class="down">${v.toFixed(1)}%</span>` : 'at high') : '–' },
        { k: 'distress', label: 'Health flags', render: (v, r) => flags(r) || '<span class="mute">none</span>' },
      ], rs, { sort: '_s', desc: true });
      const pts = rows().filter(r => num(r.mom) && num(r.acc));
      const regs = [...new Set(pts.map(r => r.region))];
      plot('c-quad', regs.map(g => { const p = pts.filter(r => r.region === g); return { x: p.map(r => r.mom), y: p.map(r => r.acc), text: p.map(r => r.name), type: 'scatter', mode: 'markers', name: g,
        marker: { size: 8, color: REG[g] || T.ink3, line: { color: T.bg, width: 1.5 }, opacity: 0.85 }, hovertemplate: '%{text}<br>12m %{x:.1f}% · accel %{y:.1f}<extra></extra>' }; }),
        { showlegend: true, margin: { l: 52, r: 14, t: 30, b: 44 }, xaxis: { title: '12-month change, %', zeroline: true }, yaxis: { title: 'Acceleration, pp', zeroline: true },
          annotations: [['Accelerating', 1, 1], ['Rolling over', 1, 0], ['Turning up', 0, 1], ['Falling faster', 0, 0]].map(([t, x, y]) => ({ text: t, xref: 'paper', yref: 'paper', x: x ? 0.98 : 0.02, y: y ? 0.98 : 0.02, xanchor: x ? 'right' : 'left', yanchor: y ? 'top' : 'bottom', showarrow: false, font: { color: T.ink3, size: 11, family: 'Barlow Condensed' } })) });
      drawIC(by);
    };
    renderScreen();
    onSeg('f-by', v => { by = v; renderScreen(); });
    onSeg('f-reg', v => { region = v; renderScreen(); });
    onSeg('f-kind', v => { kind = v; renderScreen(); });
    const TYPE = { momentum_up: ['up', 'Turned up'], momentum_down: ['down', 'Turned down'], quintile_up: ['up', 'Quintile up'], quintile_down: ['down', 'Quintile down'], drawdown_entry: ['down', 'New drawdown'] };
    table('changes', [{ k: 'type', label: 'Change', render: v => `<span class="${(TYPE[v] || [])[0]}">${(TYPE[v] || [, v])[1]}</span>` }, { k: 'name', label: 'City', render: (v, r) => `<a href="#/city/${r.key}">${esc(v)}</a>` }, { k: 'text', label: 'Detail' }], S.changes, { sort: 'type', desc: false });
    const D = S.districts;
    const dcols = [{ k: 'name', label: 'District', render: (v, r) => `<a href="#/area/${r.city}/${encodeURIComponent(r.code)}">${esc(v)}</a> <span class="mute">${esc(r.level)}</span>` },
      { k: 'city_name', label: 'City', render: (v, r) => `<a href="#/city/${r.city}">${esc(v)}</a>` }, { k: 'through', label: 'Through' },
      { k: 'mom', label: '12m', num: true, render: v => chip(v, 1, 12) }, { k: 'acc', label: 'Accel.', num: true, render: v => chip(v, 1, 10) }, { k: 'val', label: 'Value', num: true, render: v => chip(v, 1, 15) },
      { k: 'rel', label: 'vs city 12m', num: true, render: v => chip(v, 1, 10) }, { k: 'dd', label: 'From 10y peak', num: true, render: v => num(v) ? (v < -0.5 ? `<span class="down">${v.toFixed(1)}%</span>` : 'at high') : '–' },
      { k: 'score', label: 'Composite', num: true, render: v => num(v) ? f(v, 2) : '–' }];
    const drawD = w => table('dscreen', dcols, D[w] || [], { sort: w === 'top' ? 'score' : w === 'hot' ? 'mom' : 'val', desc: true });
    drawD('top'); onSeg('f-dist', drawD);
    document.getElementById('attribution').textContent = 'Signals computed from the published city and district indices; sources are listed on each city page.';
  });

  // ── Health ───────────────────────────────────────────────────────────────────────────────────────────
  route('/health', async (app) => {
    const [S, Dd] = await Promise.all([sig(), dash()]);
    const H = S.health, n = H.dates.length - 1;
    const C = S.cities;
    const share = k => 100 * C.filter(r => (r.flags || []).includes(k)).length / Math.max(1, C.length);
    const dist = Object.values(S.districts.breadth || {});
    const dFall = dist.length ? dist.reduce((a, b) => a + (b.falling || 0) * b.n, 0) / dist.reduce((a, b) => a + b.n, 0) : null;
    const lossL = H.loss_median[H.loss_median.length - 1], lossP = H.loss_median[H.loss_median.length - 4];
    const stressed = (Dd.countries || []).filter(c => (c.pir_z || 0) > 1 || c.exuberant || (c.real_1y || 0) < -2);
    app.innerHTML = hero(`Housing health · ${C.length} cities · ${(Dd.countries || []).length} countries · through ${esc(S.latest_q)}`, 'Where the housing market is cracking.',
      `For discretionary macro: how many markets are falling, how deep the drawdowns are, where volume is drying up and sellers are taking losses, and which districts are the pockets of distress. Flags are mechanical thresholds on each city's own data; the more flags, the more distress.`)
      + `<section class="kpis">
        ${tile('Cities falling · 12m', f(H.falling[n], 0, false) + '<span class="unit">%</span>', `${f(H.falling[n] - (H.falling[n - 4] ?? H.falling[n]), 0)} pts on a year ago`)}
        ${tile('In drawdown > 10%', f(H.drawdown10[n], 0, false) + '<span class="unit">%</span>', `${f(H.drawdown10[n] - (H.drawdown10[n - 4] ?? H.drawdown10[n]), 0)} pts on a year ago`)}
        ${tile('Last quarter < −5% ann.', f(H.q_down[n], 0, false) + '<span class="unit">%</span>', 'of cities, the sharpest falls')}
        ${tile('Median city · 12m', f(H.median_mom[n], 1) + '<span class="unit">%</span>', `${f(H.median_mom[n] - (H.median_mom[n - 4] ?? H.median_mom[n]), 1)} pp on a year ago`)}
        ${tile('Districts falling', dFall == null ? '–' : f(dFall, 0, false) + '<span class="unit">%</span>', `of ${S.districts.n} neighbourhoods`)}
        ${tile('Sellers at a loss', lossL == null ? '–' : f(lossL, 1, false) + '<span class="unit">%</span>', lossP == null ? '' : `median city, ${H.loss_years[H.loss_years.length - 1]}; ${f(lossL - lossP, 1)} pp on 3y`)}
      </section>
      <div class="grid">
        ${card('c-breadth', 'Distress breadth', 'share of cities falling over 12 months, in drawdown > 10%, and falling faster than 5% a year last quarter', 'half')}
        ${card('c-med', 'The median city', '12-month change, quarterly, all cities with history', 'half')}
        <figure class="card"><figcaption><h3>Distress monitor <span class="ctx">cities ranked by the number of health flags · coral = price and liquidity flags, amber = valuation risk at the country level</span></h3></figcaption>
          <div class="filters">${seg('f-hreg', [['All', 'All'], ['Europe', 'Europe'], ['Americas', 'Americas'], ['APAC', 'APAC'], ['MENA', 'MENA'], ['Africa', 'Africa']], 'All')}</div><div class="tablewrap" id="distress" style="max-height:600px"></div></figure>
        <figure class="card"><figcaption><h3>Pockets of distress <span class="ctx">districts down more than 3% over 12 months and more than 8% below their 10-year peak, deepest first</span></h3></figcaption><div class="tablewrap" id="pockets" style="max-height:520px"></div></figure>
        ${card('c-loss', 'Sellers at a loss', 'median share of resales below the purchase price, sold-record cities, by sale year', 'half')}
        <figure class="card half"><figcaption><h3>Country stress <span class="ctx">stretched on price/income (z > 1), exuberant (GSADF) or real prices falling</span></h3></figcaption><div class="tablewrap" id="cstress" style="max-height:420px"></div></figure>
      </div>`;
    const X = H.dates.map(qd);
    plot('c-breadth', [
      { x: X, y: H.falling, type: 'scatter', mode: 'lines', name: 'Falling 12m', line: { color: T.down, width: 2 }, hovertemplate: 'Falling %{y:.0f}%<extra></extra>' },
      { x: X, y: H.drawdown10, type: 'scatter', mode: 'lines', name: 'Drawdown > 10%', line: { color: T.amber, width: 2 }, hovertemplate: 'Drawdown %{y:.0f}%<extra></extra>' },
      { x: X, y: H.q_down, type: 'scatter', mode: 'lines', name: 'Last qtr < −5% ann.', line: { color: T.plum, width: 1.6 }, hovertemplate: 'Sharp fall %{y:.0f}%<extra></extra>' }],
      { showlegend: true, margin: { l: 52, r: 14, t: 30, b: 40 }, hovermode: 'x unified', yaxis: { title: 'Share of cities, %', range: [0, 100] } });
    plot('c-med', [{ x: X, y: H.median_mom, type: 'scatter', mode: 'lines', fill: 'tozeroy', fillcolor: 'rgba(125,147,255,0.12)', line: { color: T.up, width: 2 }, hovertemplate: '%{y:.1f}%<extra></extra>' }],
      { yaxis: { title: '12-month change, %', zeroline: true } });
    plot('c-loss', [{ x: H.loss_years, y: H.loss_median, type: 'bar', marker: { color: T.down, opacity: 0.75 }, hovertemplate: '%{x}: %{y:.1f}%<extra></extra>' }], { yaxis: { title: 'Share of resales at a loss, %' } });
    const drawDist = reg => table('distress', [
      { k: 'name', label: 'City', render: (v, r) => city(r) }, { k: 'region', label: 'Region' },
      { k: 'distress', label: 'Flags', num: true, render: v => `<span class="qn ${v >= 3 ? 'hot' : ''}">${v}</span>` },
      { k: 'mom', label: '12m', num: true, render: v => chip(v, 1, 12) }, { k: 'q_ann', label: 'Last qtr ann.', num: true, render: v => chip(v, 1, 15) },
      { k: 'dd', label: 'From peak', num: true, render: v => num(v) ? (v < -0.5 ? `<span class="down">${v.toFixed(1)}%</span>` : 'at high') : '–' },
      { k: 'real_m12', label: 'Real 12m', num: true, render: v => chip(v, 1, 12) },
      { k: 'vol_z', label: 'Volume z', num: true, render: v => num(v) ? `<span class="${v < -1.5 ? 'down' : ''}">${f(v, 1)}</span>` : '–' },
      { k: 'loss_share', label: 'Sellers at loss', num: true, render: (v, r) => num(v) ? `${v.toFixed(1)}%${num(r.loss_prev) ? ` <span class="mute">(${r.loss_prev.toFixed(1)})</span>` : ''}` : '–' },
      { k: 'dist_falling', label: 'Districts falling', num: true, render: v => num(v) ? `${v.toFixed(0)}%` : '–' },
      { k: 'flags', label: 'Flags', render: (v, r) => flags(r) || '<span class="mute">none</span>' },
    ], C.filter(r => reg === 'All' || r.region === reg), { sort: 'distress', desc: true });
    drawDist('All'); onSeg('f-hreg', drawDist);
    table('pockets', [{ k: 'name', label: 'District', render: (v, r) => `<a href="#/area/${r.city}/${encodeURIComponent(r.code)}">${esc(v)}</a> <span class="mute">${esc(r.level)}</span>` },
      { k: 'city_name', label: 'City', render: (v, r) => `<a href="#/city/${r.city}">${esc(v)}</a>` }, { k: 'through', label: 'Through' },
      { k: 'dd', label: 'From 10y peak', num: true, render: v => `<span class="down">${f(v, 1)}%</span>` }, { k: 'mom', label: '12m', num: true, render: v => chip(v, 1, 12) },
      { k: 'acc', label: 'Accel.', num: true, render: v => chip(v, 1, 10) }, { k: 'rel', label: 'vs city 12m', num: true, render: v => chip(v, 1, 10) }, { k: 'n12', label: 'Sales 12m', num: true, render: v => num(v) ? v.toLocaleString('en-US') : '–' }],
      S.districts.distress, { sort: 'dd', desc: false });
    table('cstress', [{ k: 'name', label: 'Country', render: (v, r) => `<a href="#/country/${r.iso2}">${esc(v)}</a>` },
      { k: 'pir_z', label: 'P/I z', num: true, render: v => num(v) ? `<span class="${v > 1 ? 'down' : ''}">${f(v, 1)}</span>` : '–' },
      { k: 'real_1y', label: 'Real 1y', num: true, render: v => chip(v, 1, 10) }, { k: 'dd_current', label: 'Real from peak', num: true, render: v => num(v) ? `${v.toFixed(1)}%` : '–' },
      { k: 'exuberant', label: 'GSADF', render: v => v ? '<span class="tag risk">exuberant</span>' : '' }], stressed, { sort: 'pir_z', desc: true });
    document.getElementById('attribution').textContent = 'Health flags computed from the published city and district indices, seller outcomes and the BIS country layer.';
  });
})();
