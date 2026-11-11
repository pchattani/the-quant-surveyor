/* Cycle & risk, Returns and Evidence. */
(function () {
  const { fmt, esc, ok } = REI, U = REI.ui, C = REI.charts, V = REI.vu;
  const kv = x => (x && ok(x.value) ? x.value : null);

  // ------------------------------------------------------------------------------------------ cycle & risk
  REI.route('/cycle', async app => {
    const [v, d] = await Promise.all([REI.val(), REI.dash()]);
    const w = v.world, T = V.trim(w), F = v.params.flags, live = v.countries.filter(c => !c.stale);
    const cnt = f => live.filter(c => (c.flags || []).includes(f)).length;
    const dc = Object.fromEntries((d.countries || []).map(c => [c.iso2, c]));
    const g = d.global || {};
    app.innerHTML = U.head('Cycle & risk', 'The financing and credit backdrop, how broad price falls are, and which countries carry stress flags.', U.badge('World series through ' + fmt.qtr(T.q))) +
      U.kpis([
        { k: 'Rate shock', v: cnt('rate shock'), s: `lending rate up more than ${F.rate_shock} points in 3 years` },
        { k: 'Credit boom', v: cnt('credit boom'), s: `credit-to-GDP gap above ${F.credit_gap} points` },
        { k: 'Debt service high', v: cnt('debt service high'), s: `more than ${F.dsr_dev} points above own mean` },
        { k: 'Unemployment rising', v: cnt('unemployment rising'), s: `up more than ${F.unemployment} point in a year` },
        { k: 'In drawdown', v: cnt('drawdown'), s: `more than ${Math.abs(F.drawdown)}% below the 10-year peak` },
        { k: 'Exuberance test', v: cnt('exuberant'), s: 'explosive price behaviour (GSADF above its 95% value)' },
      ]) +
      `<div class="g g2">${U.panel('Rates', 'median across countries, %', '<div class="chart" id="cy-r"></div>')}${U.panel('Real house prices', 'median country, % change on a year earlier', '<div class="chart" id="cy-p"></div>')}</div>
      <div class="g g2">${U.panel('Breadth of falls', 'share of countries with real prices below a year earlier, %', '<div class="chart" id="cy-f"></div>')}
        ${U.panel('Co-movement', `average pairwise correlation of real price changes, rolling ${(g.rolling_corr && g.rolling_corr.window_quarters) || 40} quarters`, '<div class="chart" id="cy-c"></div>')}</div>
      <section class="pnl"><div class="pnl-h"><h2>Country risk monitor</h2><span class="hs">sorted by number of risk flags</span></div><div id="cy-t"></div></section>
      <p class="note">Flags are fixed thresholds, set in advance and listed in the <a href="#/methodology">methodology</a>. Exuberance is the GSADF test on real prices: it marks price paths that have been explosive, not prices that are high. The GSADF column tests the whole history for an explosive episode; the exuberant flag uses the latest quarter only. Global R² is how much of a country's quarterly real price variance the first common factor across ${g.countries || ''} countries explains (${fmt.fx(100 * (g.explained || 0), 0)}% on average).</p>`;
    const p = REI.pal(), q = T.cut(w.q);
    C.lines('cy-r', [{ x: q, y: T.cut(w.policy_median), name: 'Policy rate', color: p.cat[0], step: true }, { x: q, y: T.cut(w.real_long_median), name: 'Real 10-year yield', color: p.cat[1] }], { suffix: '%', fmt: '.2f', zero: true });
    C.lines('cy-p', [{ x: q, y: T.cut(w.real_yoy_median) }], { suffix: '%', zero: true });
    C.lines('cy-f', [{ x: q, y: T.cut(w.share_falling) }], { suffix: '%', fmt: '.0f', range: [0, 100], hlines: [{ y: 50, text: 'half of countries' }] });
    if (g.rolling_corr) C.lines('cy-c', [{ x: g.rolling_corr.period, y: g.rolling_corr.value }], { fmt: '.2f' });
    const RISK = ['rate shock', 'credit boom', 'debt service high', 'unemployment rising', 'drawdown', 'falling', 'exuberant'];
    const rows = v.countries.map(c => Object.assign({}, c, { risk: (c.flags || []).filter(f => RISK.includes(f)), r2_g: (dc[c.iso2] || {}).r2, gsadf: (dc[c.iso2] || {}).gsadf, cv: (dc[c.iso2] || {}).gsadf_cv95 }));
    U.table('cy-t', { id: 'cycle', sort: 'nrisk', dir: -1, rows, rowCls: r => (r.stale ? 'stale' : ''), cols: [
      { k: 'name', h: 'Country', l: 1, f: V.cl }, { k: 'nrisk', h: 'Risk flags', l: 1, v: r => r.risk.length, f: r => U.chips(r.risk) },
      { k: 'gap', h: 'Gap', f: r => U.gapBar(r.gap, null, null, { w: 64 }) }, { k: 'real_1y', h: 'Real 1y', f: r => U.chg(r.real_1y) }, { k: 'dd10', h: 'From 10y peak', f: r => U.chg(r.dd10) },
      { k: 'lend_3y', h: 'Lending Δ 3y', f: r => U.sgn(r.lend_3y, 2) }, { k: 'real_lend', h: 'Real lending', f: r => U.num(r.real_lend, 2, '%') }, { k: 'credit_gap', h: 'Credit gap', f: r => U.sgn(r.credit_gap, 1) },
      { k: 'dsr_dev', h: 'DSR vs mean', f: r => U.sgn(r.dsr_dev, 1) }, { k: 'unemp_1y', h: 'Unemp. Δ 1y', f: r => U.sgn(r.unemp_1y, 1) },
      { k: 'gsadf', h: 'GSADF, history', f: r => (ok(r.gsadf) ? `${fmt.fx(r.gsadf, 2)}<span class="sub">95%: ${fmt.fx(r.cv, 2)}</span>` : '<span class="mute">–</span>'), t: 'Whole-history test: was there an explosive episode at any point? The exuberant flag asks whether the latest quarter is explosive.' },
      { k: 'r2_g', h: 'Global R²', f: r => (ok(r.r2_g) ? fmt.fx(100 * r.r2_g, 0) + '%' : '<span class="mute">–</span>'), t: 'Share of the country\'s quarterly real price variance explained by the common global factor' }, { k: 'clock', h: 'Clock', l: 1, f: r => U.txt(r.clock) }] });
  });

  // ------------------------------------------------------------------------------------------ returns
  REI.route('/returns', async app => {
    const [v, d] = await Promise.all([REI.val(), REI.dash()]);
    const x = d.xsection, K = d.kpis || {}, nm = V.names(v), s = U.st('returns', { region: '' });
    app.innerHTML = U.head('Returns', 'What prices have done: city indices by region, how many cities are rising, how far they have spread apart, and risk against return.',
      U.badge('City indices through ' + fmt.month(x.period[x.period.length - 1]))) +
      U.kpis([
        { k: 'Median city, 12 months', v: U.chg(kv(K.median_m12)), sp: U.spark((K.median_m12 || {}).spark), s: 'nominal, local currency' },
        { k: 'Cities rising', v: U.num(kv(K.breadth_cities), 0, '%'), sp: U.spark((K.breadth_cities || {}).spark), s: 'higher than 12 months ago' },
        { k: 'Dispersion', v: U.num(kv(K.dispersion), 1, ' pts'), sp: U.spark((K.dispersion || {}).spark), s: 'spread of 12-month changes across cities' },
        { k: 'Countries rising, real', v: U.num(kv(K.countries_real_up), 0, '%'), s: esc((K.countries_real_up || {}).sub || '') },
        { k: 'Cities tracked', v: fmt.num(kv(K.cities)), s: esc((K.cities || {}).sub || '') },
      ]) +
      `${U.panel('City price indices by region', 'equal-weighted across cities, nominal local currency, rebased', '<div class="chart tall" id="re-i"></div>')}
      <div class="g g2">${U.panel('Cities rising', 'share with prices above 12 months earlier, %', '<div class="chart" id="re-b"></div>')}${U.panel('Dispersion', 'spread of 12-month changes across cities, points', '<div class="chart" id="re-d"></div>')}</div>
      ${U.panel('Risk against return', 'volatility across, 3-year change a year up · click a city', '<div class="chart tall" id="re-s"></div>')}
      <section class="pnl"><div class="pnl-h"><h2>City returns</h2></div><div class="ctl">${U.select('re-reg', 'Region', V.opt('All regions', V.regions(d.cities)), s.region)}<span class="count" id="re-n"></span></div><div id="re-t"></div></section>`;
    const p = REI.pal(), R = ['Europe', 'Americas', 'APAC', 'MENA'].filter(r => x.index[r]);
    /* a regional index sits flat at its base value until its first city reports: blank that run rather than draw it */
    for (const k of Object.keys(x.index)) { const y = x.index[k]; let j = 0; while (j < y.length - 1 && y[j + 1] === y[0]) j++; if (j >= 6) for (let i = 0; i < j; i++) y[i] = null; }
    C.lines('re-i', R.map((r, i) => ({ x: x.period, y: x.index[r], name: r, color: p.cat[i] })).concat(x.index.All ? [{ x: x.period, y: x.index.All, name: 'All cities', color: p.neutral, dash: 'dot' }] : []), { monthly: true, height: 360, y: 'Index' });
    C.lines('re-b', [{ x: x.period, y: x.breadth }], { monthly: true, suffix: '%', fmt: '.0f', range: [0, 100] });
    C.lines('re-d', [{ x: x.period, y: x.dispersion }], { monthly: true, fmt: '.1f' });
    C.scatter('re-s', v.cities.filter(c => !c.stale).map(c => ({ x: c.vol, y: c.mom_3y, label: c.name, tip: `${c.name} (${nm[c.country] || c.country})`, href: `#/city/${c.key}` })),
      { x: 'Volatility', y: '3-year change a year', xs: '%', ys: '%', height: 400, labels: false });
    const rows = () => d.cities.filter(c => !s.region || c.region === s.region);
    const t = U.table('re-t', { id: 'returns', sort: 'm12', dir: -1, limit: 100, rows: rows(), cols: [
      { k: 'name', h: 'City', l: 1, f: r => `<a href="#/city/${r.key}">${esc(r.name)}</a><span class="sub">${esc(nm[r.country] || r.country)}</span>` },
      { k: 'm1', h: '1m', f: r => U.chg(r.m1) }, { k: 'm3', h: '3m', f: r => U.chg(r.m3) }, { k: 'm12', h: '12m', f: r => U.chg(r.m12) }, { k: 'real_m12', h: 'Real 12m', f: r => U.chg(r.real_m12) },
      { k: 'dd', h: 'From peak', f: r => U.chg(r.dd) }, { k: 'dd_max', h: 'Worst fall', f: r => U.chg(r.dd_max) }, { k: 'peak', h: 'Peak', f: r => U.txt(r.peak && fmt.month(r.peak)) },
      { k: 'sales_12m', h: 'Sales 12m', f: r => (ok(r.sales_12m) ? fmt.num(r.sales_12m) : '<span class="mute">–</span>') }, { k: 'data_through', h: 'Through', f: r => U.txt(r.data_through && fmt.month(String(r.data_through).slice(0, 7))) }] });
    const redraw = () => { const r = rows(); t.update(r); U.$('re-n').textContent = `${r.length} cities`; };
    U.onChange('re-reg', y => { s.region = y; redraw(); }); redraw();
  });

  // ------------------------------------------------------------------------------------------ evidence
  REI.route('/evidence', async app => {
    const [v, m] = await Promise.all([REI.val(), REI.micro()]), E = v.evidence, ec = E.country, ek = E.city, o = m.evidence.overall;
    const H = ec.horizons, hy = h => `${h / 4}y`;
    const fvE = (ec.signals.find(s => s.key === 'head') || ec.signals.find(s => s.key === 'fv') || {}).h, gE = (ec.signals.find(s => s.key === 'gap') || { h: {} }).h;
    const icRow = s => `<tr><td class="l">${esc(s.label)}</td>${H.map(h => { const x = s.h[String(h)]; return x ? `<td>${fmt.sg(x.ic, 3)}</td><td class="dim">${fmt.fx(x.t, 1)}</td><td class="dim">${ok(x.hit) ? fmt.fx(x.hit, 0) + '%' : '–'}</td>` : '<td>–</td><td>–</td><td>–</td>'; }).join('')}</tr>`;
    const icTable = grp => `<div class="tw"><table class="tbl"><thead><tr><th class="l ns">Signal</th>${H.map(h => `<th class="ns">IC ${hy(h)}</th><th class="ns">t</th><th class="ns">hit</th>`).join('')}</tr></thead><tbody>${grp.signals.map(icRow).join('')}</tbody></table></div>`;
    app.innerHTML = U.head('Evidence', 'The measured record of every signal on this site. A signal that does not predict is shown as such.', `Country tests from ${fmt.qtr(ec.start)}`) +
      `<p class="note">Method: each quarter, rank markets on the signal as it could have been known then (data lagged ${ec.lag_q} quarters for countries, ${ek.lag_q} for cities; long-run means use only earlier data), and correlate the ranks with the real price change that followed. The information coefficient (IC) is the average of those rank correlations; the t-statistic uses non-overlapping periods only. Signals are oriented so that a positive IC means the cheap or strong market went on to do better. Hit = share of periods with a positive correlation.</p>
      ${U.panel('Countries', `at least ${ec.min_xs} countries per quarter · horizons of 1, 3 and 5 years`, icTable(ec), { flush: true })}
      ${U.panel('Country gap and momentum through time', 'rank correlation with the real change over the next 5 years, by start quarter', '<div class="chart" id="ev-s"></div>')}
      <div class="g g2">${U.panel('What followed each level of the gap', 'average real price change a year over the next 5 years, %; observations overlap', '<div class="chart" id="ev-b"></div>')}
        ${U.panel('Value and momentum together', 'starting regime, then real % a year over the next 3 years', '<div id="ev-q"></div>', { flush: true })}</div>
      ${U.panel('Cities against their country', `${ek.cities} cities · at least ${ek.min_xs} per quarter · real change relative to the country`, icTable(ek), { flush: true })}
      ${U.panel('Districts against their city', 'average rank correlation across cities', `<div class="ev">${[['Momentum, 1 year', o.mom_4], ['Momentum, 3 years', o.mom_12], ['Relative value, 1 year', o.rv_4], ['Relative value, 3 years', o.rv_12]].map(([k, x]) =>
        `<div><div class="k">${k}</div><div class="v">IC ${fmt.sg(x.mean_ic, 3)}</div><div class="s">positive in ${fmt.fx(x.positive, 0)}% of ${x.cities} cities</div></div>`).join('')}</div>`)}
      <p class="note caveat">Reading: momentum is the one signal with a clear record at every level, strongest over one year. ${fvE && fvE['20'] ? `The <a href="#/model">model's</a> fair-value gap, which estimates how much income and borrowing cost matter instead of averaging four fixed ratios, has ranked later changes better than the four-ratio composite at every horizon (${fmt.sg(fvE['20'].ic, 2)} against ${fmt.sg(gE['20'].ic, 2)} over five years), but its t-statistics stay near 2.` : 'The fair-value gap has helped only over five years and only weakly (t below 2).'} District relative value has no measured edge. History starts in ${String(ec.start).slice(0, 4)} and covers few independent five-year periods, so long-horizon numbers are uncertain.</p>`;
    const p = REI.pal(), sg = k => ec.signals.find(s => s.key === k);
    const ser = [['head', 'Fair-value gap (model)', p.cat[0]], ['gap', 'Four-ratio composite', p.cat[2]], ['mom', 'Momentum', p.cat[1]]].map(([k, n, c]) => { const s = sg(k); return s && s.series ? { x: s.series.q, y: s.series.ic, name: n, color: c, fmt: '.2f' } : null; }).filter(Boolean);
    if (ser.length) C.lines('ev-s', ser, { zero: true, y: 'Rank correlation', fmt: '.2f' });
    const lab = b => (b.lo == null ? `below ${b.hi}%` : b.hi == null ? `above +${b.lo}%` : `${b.lo > 0 ? '+' : ''}${b.lo} to ${b.hi > 0 ? '+' : ''}${b.hi}%`);
    C.bars('ev-b', ec.buckets.map(lab), ec.buckets.map(b => b.mean), { suffix: '%', y: 'Real % a year', text: ec.buckets.map(b => fmt.sg(b.mean, 1)), colors: ec.buckets.map((b, i) => (i < 3 ? p.cheap : p.rich)),
      tips: ec.buckets.map(b => `<br>${b.n} observations · rose in ${fmt.fx(b.up, 0)}%`) });
    U.table('ev-q', { id: 'ev-q', rows: ec.quadrants, cols: [{ k: 'name', h: 'Starting regime', l: 1, ns: 1, f: r => V.regime(r.name) }, { k: 'mean', h: 'Mean', ns: 1, f: r => U.chg(r.mean) }, { k: 'median', h: 'Median', ns: 1, f: r => U.chg(r.median) },
      { k: 'up', h: 'Rose in', ns: 1, f: r => U.num(r.up, 0, '%') }, { k: 'n', h: 'Observations', ns: 1, f: r => fmt.num(r.n) }] });
  });
})();
