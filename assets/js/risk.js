/* Risk: volatility and correlation corrected for index smoothing, drawdown history, stress through the model, historical
   replays and nowcasts. Also the Evidence page's paper portfolios, real-time range coverage and nowcast record
   (REI.risk.evidence). Every number is read from valuation.json and analytics.json. */
(function () {
  const { fmt, esc, ok } = REI, U = REI.ui, C = REI.charts, V = REI.vu;
  const pct = (v, d = 1) => U.num(v, d, '%');
  const q = x => (x ? fmt.qtr(x) : '–');

  REI.route('/risk', async app => {
    const [v, an] = await Promise.all([REI.val(), REI.an()]);
    const K = an.kpis, W = an.params.windows, nm = V.names(v), s = U.st('risk', { cc: '' });
    const live = v.countries.filter(c => c.risk && c.risk.vol_u != null);
    const corr = an.corr || {};
    app.innerHTML = U.head('Risk', 'Volatility and correlation corrected for the smoothing in house price indices, the history of falls and recoveries, the model\'s stress tests and three historical replays.',
      U.badge(`${K.countries} countries · ${fmt.num(K.cities)} cities`)) +
      U.kpis([
        { k: 'Volatility, median country', v: pct(K.vol_u), s: `real, de-smoothed · ${fmt.fx(K.vol_raw, 1)}% as published`, t: 'Annualised volatility of quarterly real returns after the Geltner correction for smoothing, and before it' },
        { k: 'Smoothing, median', v: fmt.fx(K.phi, 2), s: 'first-order autocorrelation of quarterly returns', t: 'φ: 0 = no smoothing; housing returns are also genuinely persistent, so the correction is an upper bound on true volatility' },
        { k: 'Volatility, median city', v: pct(K.city_vol_u), s: `de-smoothed · ${fmt.fx(K.city_vol_raw, 1)}% as published` },
        { k: 'Average correlation', v: fmt.fx(K.avg_corr, 2), s: `country pairs, de-smoothed · ${fmt.fx(K.avg_corr_raw, 2)} as published` },
        { k: 'Independent markets', v: fmt.fx(K.effective_n, 1), s: `effective number among ${corr.n || '–'} countries · first factor ${fmt.fx(100 * (corr.first_pc || 0), 0)}% of variance`, t: '(Σλ)² / Σλ² over the eigenvalues of the correlation matrix: 1 means one market, N means N unrelated ones' },
        { k: 'Rich on every method', v: K.agree_rich, s: `cheap on every method: ${K.agree_cheap} · model, four ratios, trend`, t: `A method calls a market rich (cheap) when its gap is above (below) ±${an.params.agree_pts}%` },
      ]) +
      `<section class="pnl"><div class="pnl-h"><h2>Country risk</h2><span class="hs">real prices · quarterly returns · volatility a year</span></div><div id="rk-t"></div></section>
      <section class="pnl"><div class="pnl-h"><h2>Stress tests</h2><span class="hs">fair value through the model's own elasticities, then real price changes over three past episodes</span></div><div id="rk-s"></div></section>
      <div class="g g2">${U.panel('Correlation of country returns', `de-smoothed quarterly real returns since ${String(an.params.corr_start).slice(0, 4)} · ordered by clustering`, '<div class="chart" id="rk-h" style="height:600px"></div>')}
        ${U.panel(`Nowcast to ${q(an.target_country)}`, 'markets whose data stop earlier, carried forward on their own momentum · model output, not data', '<div id="rk-n"></div>', { flush: true })}</div>
      <section class="pnl"><div class="pnl-h"><h2>City risk</h2><span class="hs">real where a national deflator exists, otherwise nominal</span></div>
        <div class="ctl">${U.select('rk-cc', 'Country', V.opt('All countries', [...new Set(v.cities.map(c => c.country))].sort().map(c => [c, nm[c] || c])), s.cc)}<span class="count" id="rk-cn"></span></div><div id="rk-c"></div></section>
      <p class="note"><b>Smoothing.</b> House price indices are smoothed: appraisals lag the market, many official series are moving averages, and deeds are recorded months after the price was agreed. Smoothing shows up as positive autocorrelation in quarterly returns (φ) and makes volatility and correlation look lower than the market's. The de-smoothed figures use the standard correction (Geltner 1993): u<sub>t</sub> = (r<sub>t</sub> − φ r<sub>t−1</sub>) / (1 − φ). House prices also have genuine momentum, so the corrected volatility is an upper bound and the published one a lower bound. Series with φ above ${0.9} are corrected at 0.9 and tagged.</p>
      <p class="note"><b>Stress tests.</b> A lending rate 1 or 2 points higher, or real income per head 5% lower, moves fair value by the model's estimated elasticities (<a href="#/model">Model</a>), everything else held; the gap after the shock assumes prices do not move. Countries without a lending-rate series (tier 2 on a flat borrowing cost) have no rate stress. The historical replays are the real price change between fixed quarters: ${W.map(w => `${esc(w.label)} (${q(w.start)} to ${q(w.end)})`).join('; ')}.</p>
      <p class="note"><b>Nowcasts.</b> An AR(1) on each market's last ${an.params.nowcast_window_q} quarterly returns carries its index from the last published quarter to ${q(an.target_country)} (the latest quarter at least a quarter of countries have published), with an 80% range from the AR(1) forecast-error variance. Its out-of-sample record is on the <a href="#/evidence">Evidence</a> page. Model output: never spliced into the published index.</p>`;

    const R = r => r.risk || {};
    U.table('rk-t', { id: 'risk-c', sort: 'vol_u', dir: -1, rows: live, rowCls: r => (r.stale ? 'stale' : ''), cols: [
      { k: 'name', h: 'Country', l: 1, f: V.cl },
      { k: 'ret', h: 'Real p.a.', v: r => R(r).ret, f: r => U.chg(R(r).ret), t: 'Average real price change a year over the whole series' },
      { k: 'vol_raw', h: 'Vol, published', v: r => R(r).vol_raw, f: r => pct(R(r).vol_raw) },
      { k: 'vol_u', h: 'Vol, de-smoothed', v: r => R(r).vol_u, f: r => `${pct(R(r).vol_u)}${R(r).smoothed ? V.tag('φ capped') : ''}` },
      { k: 'phi', h: 'φ', v: r => R(r).phi, f: r => U.num(R(r).phi, 2), t: 'Smoothing: first-order autocorrelation of quarterly real returns' },
      { k: 'ret_risk', h: 'Return / risk', v: r => R(r).ret_risk, f: r => U.sgn(R(r).ret_risk, 2), t: 'Real return a year over de-smoothed volatility' },
      { k: 'max_dd', h: 'Worst real fall', v: r => R(r).max_dd, f: r => `${U.chg(R(r).max_dd, 0)}<span class="sub">${q(R(r).dd_peak)} to ${q(R(r).dd_trough)}</span>` },
      { k: 'rec_q', h: 'Recovered in', v: r => (R(r).dd_recovered ? R(r).rec_q : 999), f: r => (R(r).dd_recovered ? `${R(r).rec_q} q<span class="sub">${q(R(r).dd_recovered)}</span>` : (R(r).max_dd != null ? '<span class="neg">not yet</span>' : '<span class="mute">–</span>')), t: 'Quarters from the trough of the worst fall back to the previous peak' },
      { k: 'under_q', h: 'Longest below peak', v: r => R(r).under_q, f: r => (ok(R(r).under_q) ? `${fmt.fx(R(r).under_q / 4, 1)} y` : '<span class="mute">–</span>') },
      { k: 'es_1y', h: '1y shortfall 5%', v: r => R(r).es_1y, f: r => U.chg(R(r).es_1y), t: 'Average of the worst 5% of one-year real changes (overlapping windows)' },
      { k: 'now_dd', h: 'Below peak now', v: r => R(r).now_dd, f: r => U.chg(R(r).now_dd) },
      { k: 'agree', h: 'Methods', ns: 1, f: r => agree(r.agree), t: 'Valuation methods (model, four ratios, trend) calling the market rich or cheap' }] });

    const S = r => r.stress || {};
    const srows = v.countries.filter(c => (c.stress && ok(c.fv_gap)) || (c.risk && W.some(w => ok(c.risk['w_' + w.key]))));
    U.table('rk-s', { id: 'risk-s', sort: 'rate2', dir: 1, rows: srows, rowCls: r => (r.stale ? 'stale' : ''), cols: [
      { k: 'name', h: 'Country', l: 1, f: V.cl },
      { k: 'fv_gap', h: 'Model gap', f: r => U.gapBar(r.fv_unfit || r.fv_stale ? null : r.fv_gap, null, null, { w: 64 }), v: r => (r.fv_unfit || r.fv_stale ? null : r.fv_gap) },
      { k: 'rate1', h: 'Rate +1 pt', v: r => S(r).rate1, f: r => U.chg(S(r).rate1), t: 'Change in fair value if the lending rate were 1 point higher' },
      { k: 'rate2', h: 'Rate +2 pts', v: r => S(r).rate2, f: r => `${U.chg(S(r).rate2)}${ok(S(r).gap_rate2) && !r.fv_unfit ? `<span class="sub">gap ${fmt.sg(S(r).gap_rate2, 0)}%</span>` : ''}` },
      { k: 'inc5', h: 'Income −5%', v: r => S(r).inc5, f: r => `${U.chg(S(r).inc5)}${ok(S(r).gap_inc5) && !r.fv_unfit ? `<span class="sub">gap ${fmt.sg(S(r).gap_inc5, 0)}%</span>` : ''}` },
      ...W.map(w => ({ k: 'w_' + w.key, h: esc(w.label.split(':')[0]), v: r => R(r)['w_' + w.key], f: r => U.chg(R(r)['w_' + w.key]), t: `${w.label}: real price change ${q(w.start)} to ${q(w.end)}` }))] });

    if (corr.names) C.heat('rk-h', corr.names, corr.corr, { height: 600 });
    const nrows = v.countries.filter(c => c.nowcast && c.nowcast.k > 0);
    U.table('rk-n', { id: 'risk-n', sort: 'k', dir: -1, rows: nrows, empty: 'Every country has published the target quarter.', cols: [
      { k: 'name', h: 'Country', l: 1, f: V.cl }, { k: 'price_through', h: 'Data to', f: r => q(r.price_through) },
      { k: 'k', h: 'Quarters', v: r => r.nowcast.k, f: r => r.nowcast.k },
      { k: 'chg', h: 'Nowcast', v: r => r.nowcast.chg, f: r => `${U.chg(r.nowcast.chg)}<span class="sub">${fmt.sg(r.nowcast.lo, 1)} to ${fmt.sg(r.nowcast.hi, 1)}</span>`, t: 'Real change from the last published quarter to the target quarter, with an 80% range' }] });

    const crow = () => v.cities.filter(c => c.risk && c.risk.vol_u != null && (!s.cc || c.country === s.cc));
    const ct = U.table('rk-c', { id: 'risk-k', sort: 'vol_u', dir: -1, limit: 100, rows: crow(), rowCls: r => (r.stale ? 'stale' : ''), cols: [
      { k: 'name', h: 'City', l: 1, f: r => V.kl(r, nm) },
      { k: 'ret', h: 'p.a.', v: r => R(r).ret, f: r => `${U.chg(R(r).ret)}${R(r).basis === 'nominal' ? V.tag('nominal') : ''}` },
      { k: 'vol_raw', h: 'Vol, published', v: r => R(r).vol_raw, f: r => pct(R(r).vol_raw) },
      { k: 'vol_u', h: 'Vol, de-smoothed', v: r => R(r).vol_u, f: r => `${pct(R(r).vol_u)}${R(r).smoothed ? V.tag('φ capped') : ''}` },
      { k: 'phi', h: 'φ', v: r => R(r).phi, f: r => U.num(R(r).phi, 2) },
      { k: 'max_dd', h: 'Worst fall', v: r => R(r).max_dd, f: r => `${U.chg(R(r).max_dd, 0)}<span class="sub">${q(R(r).dd_trough)}${R(r).dd_recovered ? '' : ' · not recovered'}</span>` },
      { k: 'es_1y', h: '1y shortfall 5%', v: r => R(r).es_1y, f: r => U.chg(R(r).es_1y) },
      ...W.map(w => ({ k: 'w_' + w.key, h: esc(w.label.split(':')[0]), v: r => R(r)['w_' + w.key], f: r => U.chg(R(r)['w_' + w.key]) })),
      { k: 'nowcast', h: `To ${q(an.target_city)}`, v: r => (r.nowcast && r.nowcast.k ? r.nowcast.chg : null), f: r => (r.nowcast && r.nowcast.k ? `${U.chg(r.nowcast.chg)}<span class="sub">${r.nowcast.k} q · ${fmt.sg(r.nowcast.lo, 1)} to ${fmt.sg(r.nowcast.hi, 1)}</span>` : '<span class="mute">–</span>'), t: 'Nowcast from the last published quarter, model output' }] });
    const redraw = () => { const r = crow(); ct.update(r); U.$('rk-cn').textContent = `${fmt.num(r.length)} cities`; };
    U.onChange('rk-cc', x => { s.cc = x; redraw(); }); redraw();
  });

  /* how many valuation methods call the market rich or cheap */
  function agree(a) {
    if (!a) return '<span class="mute">–</span>';
    if (a.rich === a.of) return `<span class="chip rich">rich ${a.rich}/${a.of}</span>`;
    if (a.cheap === a.of) return `<span class="chip cheap">cheap ${a.cheap}/${a.of}</span>`;
    return `<span class="mute">${a.rich ? `rich ${a.rich}` : ''}${a.rich && a.cheap ? ' · ' : ''}${a.cheap ? `cheap ${a.cheap}` : ''}${!a.rich && !a.cheap ? 'near' : ''} of ${a.of}</span>`;
  }

  // ------------------------------------------------------------------------------------------ evidence additions
  const portTable = (P, unit) => {
    const keys = Object.keys(P || {});
    if (!keys.length) return '<p class="empty">Not enough markets per quarter.</p>';
    const row = k => { const x = P[k], l = x.long_short || {}, t = x.tilt || {}, h = x.halves || {};
      return `<tr><td class="l">${esc(x.label)}<span class="sub">${x.groups} groups · ${fmt.fx(x.names, 0)} ${unit} a quarter · ${q(l.first)} to ${q(l.last)}</span></td>
        <td>${U.chg(l.ret, 1)}</td><td class="dim">${fmt.fx(l.t_nw, 1)}</td><td>${U.num(l.vol_u, 1, '%')}</td><td>${U.sgn(l.ratio_u, 2)}</td><td class="dim">${U.num(l.hit, 0, '%')}</td><td>${U.chg(l.max_dd, 0)}</td>
        <td>${U.chg(t.ret, 1)}</td><td class="dim">${fmt.fx(t.t_nw, 1)}</td><td class="dim">${U.num(x.turnover, 0, '%')}</td>
        <td>${h.early ? `${U.chg(h.early.ret, 1)} <span class="mute">/</span> ${U.chg(h.late.ret, 1)}` : '–'}</td></tr>`; };
    return `<div class="tw"><table class="tbl"><thead><tr><th class="l ns">Ranked on</th>
      <th class="ns" title="Top group minus bottom group, next-quarter real change, % a year">Long-short</th><th class="ns" title="Newey-West t-statistic, 4 lags">t</th>
      <th class="ns" title="Volatility of the spread after the smoothing correction">Vol</th><th class="ns" title="Return over de-smoothed volatility">Ratio</th>
      <th class="ns" title="Share of quarters the spread was positive">Hit</th><th class="ns" title="Largest fall of the cumulative spread">Max fall</th>
      <th class="ns" title="Top group minus the equal-weighted universe: a long-only tilt">Tilt</th><th class="ns">t</th>
      <th class="ns" title="Share of the top group replaced each quarter">Turnover</th><th class="ns" title="Long-short in the first and second half of the record">Halves</th></tr></thead>
      <tbody>${keys.map(row).join('')}</tbody></table></div>`;
  };
  const covRow = (name, c) => (c && ok(c.coverage) ? `<tr><td class="l">${esc(name)}</td><td>${fmt.fx(c.nominal, 0)}%</td><td>${fmt.fx(c.coverage, 0)}%</td><td class="dim">${fmt.fx(c.width, 1)} pts</td><td class="dim">${fmt.num(c.obs)}</td></tr>` : '');

  function evidence(an) {
    const P = an.portfolios || {}, cal = an.calibration || {}, nr = an.nowcast_record || {};
    const nrow = (name, x) => (x && ok(x.rmse) ? `<tr><td class="l">${esc(name)}</td><td>${fmt.fx(x.rmse, 2)}</td><td>${fmt.fx(x.rmse_flat, 2)}</td><td>${fmt.fx(x.rmse_last, 2)}</td><td>${fmt.fx(x.coverage, 0)}%</td><td class="dim">${fmt.num(x.obs)}</td></tr>` : '');
    return U.panel('Paper portfolios: countries', 'each quarter, rank countries on what was known then, hold equal weights for one quarter, record the real change', portTable(P.country, 'countries'), { flush: true }) +
      U.panel('Cumulative long-short, countries', 'top group minus bottom group, sum of quarterly log changes ×100', '<div class="chart" id="ev-pc"></div>') +
      U.panel('Paper portfolios: cities against their country', 'returns relative to the country, so the country cycle drops out', portTable(P.city, 'cities'), { flush: true }) +
      U.panel('Cumulative long-short, cities', 'relative to the country, sum of quarterly log changes ×100', '<div class="chart" id="ev-pk"></div>') +
      `<div class="g g2">${U.panel('Forecast ranges, set in real time', 'share of outcomes inside the published 10th-90th percentile range when the range uses only errors already known', `<div class="tw"><table class="tbl"><thead><tr><th class="l ns">Forecast</th><th class="ns">Nominal</th><th class="ns">Actual</th><th class="ns">Width</th><th class="ns">Obs</th></tr></thead><tbody>
        ${covRow('Countries, 1 year (gap and momentum)', cal.full_4)}${covRow('Countries, 3 years a year', cal.full_12)}${covRow('Countries, 1 year (momentum only)', cal.mom_4)}${covRow('Countries, 3 years (momentum only)', cal.mom_12)}${covRow('Cities against country, 1 year', cal.city_4)}${covRow('Cities against country, 3 years', cal.city_12)}</tbody></table></div>`, { flush: true })}
        ${U.panel(`Nowcasts: the record`, `${nr.country && nr.country.k ? nr.country.k : 2} quarters ahead, root mean squared error of the cumulative real change, % · lower is better`, `<div class="tw"><table class="tbl"><thead><tr><th class="l ns">Markets</th><th class="ns">AR(1) nowcast</th><th class="ns" title="Assume no change">No change</th><th class="ns" title="Carry the last quarter's change forward">Last change</th><th class="ns" title="Share inside the 80% range">In 80% range</th><th class="ns">Obs</th></tr></thead><tbody>
        ${nrow('Countries', nr.country)}${nrow('Cities', nr.city)}</tbody></table></div>`, { flush: true })}</div>
      <p class="note caveat"><b>Paper portfolios are not investable returns.</b> House price indices cannot be bought; physical property costs 5-10% of value to buy and sell, takes months to trade and carries rent, maintenance and tax not counted here. The spreads measure how much information a ranking carried, in the units an equity quant uses: they are what a perfectly liquid, costless, unlevered position in the indices would have earned. Groups are rebalanced every quarter, so returns do not overlap; the t-statistic uses a Newey-West variance to allow for the smoothing that remains. Signals are lagged for publication and forecasts are fitted only on outcomes already published. Smoothing also makes quarterly index returns partly predictable from their own past, which flatters momentum here: the strong momentum spreads are real information about the published indices, and an upper bound on what the market itself offered.</p>`;
  }
  function evidenceCharts(an) {
    const p = REI.pal(), P = an.portfolios || {};
    const ser = (G, keys) => keys.filter(([k]) => G && G[k] && G[k].path).map(([k, n, c]) => ({ x: G[k].path.q, y: G[k].path.ls.map(x => 100 * x), name: n, color: c, fmt: '.1f' }));
    const pc = ser(P.country, [['model', 'Expected change (model)', p.cat[0]], ['momentum', 'Momentum', p.cat[1]], ['value', 'Fair-value gap', p.cat[2]]]), pk = ser(P.city, [['model', 'Expected change', p.cat[0]], ['rel_mom', 'Relative momentum', p.cat[1]], ['premium', 'Discount to country', p.cat[2]]]);
    if (pc.length) C.lines('ev-pc', pc, { zero: true, y: 'Cumulative, log ×100', fmt: '.1f' });
    if (pk.length) C.lines('ev-pk', pk, { zero: true, y: 'Cumulative, log ×100', fmt: '.1f' });
  }
  REI.risk = { evidence, evidenceCharts, agree };
})();
