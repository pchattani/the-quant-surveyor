/* Screens: the country table, the city screen and the district screen. Column sets switch without losing filters. */
(function () {
  const { fmt, esc, ok } = REI, U = REI.ui, C = REI.charts, V = REI.vu;
  const tip = { gap: 'Fair-value gap from the model: the price against what income and borrowing cost have supported. The whisker is the gap\'s range across re-estimated slopes. Countries tagged trend show the gap to their own real price trend.',
    rg: 'The older measure: the average of price to income, price to rent and the two payment ratios, each against its own long-run mean',
    pct: 'Percentile of the gap in the market\'s own history (100 = the richest it has been)',
    pir: 'Price to income against its own long-run mean', prr: 'Price to rent against its own long-run mean',
    pti: 'Mortgage payment to income against its own long-run mean', ptr: 'Mortgage payment to rent against its own long-run mean',
    trend: 'Real price against its own long-run trend', dd10: 'Fall from the 10-year peak', hl: 'Years for half of a gap to close, estimated on the country\'s own history',
    cg: 'Credit-to-GDP gap (BIS), percentage points', dsr: 'Debt service ratio (BIS), % of income', prem: 'City real price relative to the country index, against the city\'s own mean',
    beta: 'Sensitivity of the city\'s quarterly real change to its country\'s', ys: 'Gross rental yield less the 10-year government yield' };

  // ------------------------------------------------------------------------------------------ countries
  const CC = {
    val: [{ k: 'gap', h: 'Gap', f: r => U.gapBar(r.gap, r.lo, r.hi), t: tip.gap }, { k: 'pct', h: 'Pctile', f: r => U.num(r.pct, 0), t: tip.pct }, { k: 'gap_1y', h: 'Δ 1y', f: r => U.sgn(r.gap_1y, 1), t: 'Change in the gap over a year, points' },
      { k: 'ratio_gap', h: 'Four ratios', f: r => U.sgn(r.ratio_stale ? null : r.ratio_gap, 0, '%'), v: r => (r.ratio_stale ? null : r.ratio_gap), t: tip.rg },
      { k: 'pir', h: 'P/Income', f: r => U.sgn(r.pir, 0, '%'), t: tip.pir }, { k: 'prr', h: 'P/Rent', f: r => U.sgn(r.prr, 0, '%'), t: tip.prr },
      { k: 'pti', h: 'Pay/Income', f: r => U.sgn(r.pti, 0, '%'), t: tip.pti }, { k: 'ptr', h: 'Pay/Rent', f: r => U.sgn(r.ptr, 0, '%'), t: tip.ptr },
      { k: 'real_1y', h: 'Real 1y', f: r => U.chg(r.real_1y) },
      { k: 'quadrant', h: 'Regime', l: 1, f: r => V.regime(r.quadrant) }, { k: 'flags', h: 'Flags', l: 1, ns: 1, f: r => U.chips(r.flags) }, { k: 'through', h: 'Through', f: V.through }],
    px: [{ k: 'real_1y', h: 'Real 1y', f: r => U.chg(r.real_1y) }, { k: 'real_3y', h: 'Real 3y p.a.', f: r => U.chg(r.real_3y) }, { k: 'real_5y', h: 'Real 5y p.a.', f: r => U.chg(r.real_5y) }, { k: 'real_10y', h: 'Real 10y p.a.', f: r => U.chg(r.real_10y) },
      { k: 'nominal_1y', h: 'Nominal 1y', f: r => U.chg(r.nominal_1y) }, { k: 'usd_1y', h: 'USD 1y', f: r => U.chg(r.usd_1y) }, { k: 'fx_1y', h: 'FX 1y', f: r => U.chg(r.fx_1y), t: 'Currency against the US dollar over a year' },
      { k: 'trend_gap', h: 'Trend gap', f: r => U.sgn(r.trend_gap, 0, '%'), t: tip.trend }, { k: 'dd10', h: 'From 10y peak', f: r => U.chg(r.dd10), t: tip.dd10 }, { k: 'dd', h: 'From peak', f: r => U.chg(r.dd) }, { k: 'vol', h: 'Vol', f: r => U.num(r.vol, 1, '%'), t: 'Annualised volatility of quarterly real changes' },
      { k: 'pig', h: 'P/GDP per head', f: r => U.sgn(r.pig, 0, '%'), t: 'Countries without ratio data only: national price index over GDP per head (or household income), % from its own mean. Descriptive: it trends in fast-growing economies and is not part of the gap.' }, { k: 'half_life', h: 'Half-life (y)', f: r => U.num(r.half_life, 1), t: tip.hl }, { k: 'clock', h: 'Clock', l: 1, f: r => U.txt(r.clock) }, { k: 'through', h: 'Through', f: V.through }],
    mac: [{ k: 'policy', h: 'Policy', f: r => U.num(r.policy, 2, '%') }, { k: 'policy_1y', h: 'Δ 1y', f: r => U.sgn(r.policy_1y, 2) }, { k: 'policy_3y', h: 'Δ 3y', f: r => U.sgn(r.policy_3y, 2) },
      { k: 'long', h: '10y', f: r => U.num(r.long, 2, '%') }, { k: 'real_long', h: 'Real 10y', f: r => U.num(r.real_long, 2, '%') },
      { k: 'lend', h: 'Lending', f: r => `${U.num(r.lend, 2, '%')}${r.lend_basis && r.lend_basis !== 'mortgage' ? '<span class="sub">10y + spread</span>' : ''}`, t: 'Mortgage rate where one is published, otherwise the 10-year yield plus a spread' },
      { k: 'lend_3y', h: 'Δ 3y', f: r => U.sgn(r.lend_3y, 2) }, { k: 'cpi_yoy', h: 'CPI', f: r => U.num(r.cpi_yoy, 1, '%') },
      { k: 'hh_credit', h: 'HH credit/GDP', f: r => U.num(r.hh_credit, 0, '%') }, { k: 'hh_credit_3y', h: 'Δ 3y', f: r => U.sgn(r.hh_credit_3y, 1) }, { k: 'credit_gap', h: 'Credit gap', f: r => U.sgn(r.credit_gap, 1), t: tip.cg },
      { k: 'dsr', h: 'DSR', f: r => U.num(r.dsr, 1, '%'), t: tip.dsr }, { k: 'dsr_dev', h: 'vs mean', f: r => U.sgn(r.dsr_dev, 1) }, { k: 'unemp', h: 'Unemp.', f: r => U.num(r.unemp, 1, '%') }, { k: 'unemp_1y', h: 'Δ 1y', f: r => U.sgn(r.unemp_1y, 1) }],
  };
  const X = (v, lo, hi) => V.expCell(v, lo, hi);
  CC.mdl = [{ k: 'gap', h: 'Gap', f: r => U.gapBar(r.gap, r.lo, r.hi), t: tip.gap },
    { k: 'exp_1y', h: 'Expected 1y', f: r => X(r.exp_1y, r.exp_1y_lo, r.exp_1y_hi), t: 'Expected real change over the next year; under it the 10th to 90th percentile of past forecast errors. Countries without income data use momentum alone.' },
    { k: 'exp_3y', h: 'Expected 3y p.a.', f: r => X(r.exp_3y, r.exp_3y_lo, r.exp_3y_hi), t: 'Expected real change a year over the next three years' },
    { k: 'rate_sens', h: '+1 pt rate', f: r => U.sgn(r.fv_stale ? null : r.rate_sens, 1, '%'), t: 'Change in model fair value if the lending rate were one point higher' },
    { k: 'inc_years', h: 'Years to grow in', f: r => (ok(r.inc_years) && !r.fv_stale ? (r.inc_years > 60 ? '60+' : fmt.fx(r.inc_years, 0)) : '<span class="mute">–</span>'), t: 'Rich markets only: years of real income growth at the ten-year pace that would close the model gap with real prices flat' },
    { k: 'be_rate', h: 'Break-even rate', f: r => (ok(r.be_rate) ? `${fmt.fx(r.be_rate, 2)}%<span class="sub">${fmt.sg(r.be_gap, 2)}</span>` : r.be_none ? '<span class="mute">none</span>' : '<span class="mute">–</span>'), t: 'The lending rate at which the mortgage payment on today\'s price would take its long-run average share of income, with the distance from today\'s rate. None: even a zero rate would not do it.' },
    { k: 'rti', h: 'Rent/income', f: r => U.sgn(r.rti, 0, '%'), t: 'Rent over income against its own long-run mean: the renter\'s burden' }, { k: 'rent_real_1y', h: 'Real rent 1y', f: r => U.chg(r.rent_real_1y) },
    { k: 'uw_q', h: 'Since real peak', f: r => (ok(r.uw_q) ? (r.uw_q === 0 ? 'at peak' : `${fmt.fx(r.uw_q / 4, 1)}y`) : '<span class="mute">–</span>'), t: 'Years since the real price index was last at its highest' },
    { k: 'fv_basis', h: 'Valued on', l: 1, cls: 'dim', v: r => V.basisShort(r), f: r => esc(V.basisShort(r)), t: 'What the gap rests on: the model on disposable income, the model on an income proxy (less reliable), or the real price trend' }];
  const NAMEC = { k: 'name', h: 'Country', l: 1, f: r => `${V.cl(r)}<span class="sub">${esc(r.region || '')}</span>` };

  REI.route('/countries', async app => {
    const v = await REI.val(), s = U.st('countries', { set: 'val', region: '', q: '' });
    app.innerHTML = U.head('Countries', 'Fair-value gaps, price history and the rate and credit backdrop, one row per country. Click a column to sort and a country for its tear-sheet.',
      `${v.kpis.countries_model} valued by the model · ${v.kpis.countries_tier2} of them on proxy income · ${v.kpis.countries - v.kpis.countries_ratio} on trend only or stale`) +
      `<section class="pnl"><div class="ctl">${U.seg('co-set', [['val', 'Valuation'], ['mdl', 'Outlook'], ['px', 'Prices'], ['mac', 'Rates & credit']], s.set)}
        ${U.select('co-reg', 'Region', V.opt('All regions', V.regions(v.countries)), s.region)}${U.search('co-q', 'Filter countries', s.q)}<span class="count" id="co-n"></span></div>
        <div id="co-t"></div></section>
      <p class="note">Gap = how far prices sit above (+) or below (−) the level that incomes and borrowing costs have supported, from the <a href="#/model">fair-value model</a>; the whisker is its range when the model's two slopes are re-estimated. Countries tagged <i>proxy income</i> have no disposable-income series in the OECD's tables and are valued on GNI per head instead, which is less reliable. Countries tagged <i>trend</i> are out of the model's reach and show the gap to their own real price trend. <i>Four ratios</i> is the older measure, kept beside the model. Rows tagged <i>stale</i> stopped publishing more than ${v.params.stale_q} quarters ago. <i>Outlook</i> shows the expected real change with the range of its past errors, and what would close the gap.</p>`;
    const rows = () => v.countries.filter(c => (!s.region || c.region === s.region) && V.match(c, s.q));
    const cols = () => [NAMEC].concat(CC[s.set]);
    const t = U.table('co-t', { id: 'countries', cols: cols(), rows: rows(), sort: 'gap', dir: -1, rowCls: r => (r.stale ? 'stale' : '') });
    const redraw = () => { const r = rows(); t.set(r, cols()); U.$('co-n').textContent = `${r.length} countries`; };
    U.onSeg('co-set', x => { s.set = x; redraw(); }); U.onChange('co-reg', x => { s.region = x; redraw(); }); U.onInput('co-q', x => { s.q = x; redraw(); });
    U.$('co-n').textContent = `${rows().length} countries`;
  });

  // ------------------------------------------------------------------------------------------ cities
  const r1 = r => (ok(r.real_1y) ? r.real_1y : null);
  const v0 = { term_years: 25, ltv: 0.8 };            // read from the build's parameters when the Cities page opens
  const KC = {
    val: [{ k: 'gap', h: 'Implied gap', f: r => U.gapBar(r.gap), t: 'Country gap plus the city\'s premium to the country, against the premium\'s own mean' }, { k: 'c_gap', h: 'Country gap', f: r => U.sgn(r.c_gap, 0, '%') },
      { k: 'prem', h: 'Premium', f: r => U.sgn(r.prem, 0, '%'), t: tip.prem }, { k: 'prem_z', h: 'Premium z', f: r => U.zBar(r.prem_z) }, { k: 'prem_pct', h: 'Pctile', f: r => U.num(r.prem_pct, 0), t: 'Percentile of the premium in the city\'s own history' },
      { k: 'real_1y', h: 'Real 1y', f: r => U.chg(r1(r)) }, { k: 'yield', h: 'Yield', f: r => U.num(r.yield, 1, '%'), t: 'Gross rental yield from published rent and price levels' },
      { k: 'quadrant', h: 'Regime', l: 1, f: r => V.regime(r.quadrant) },
      { k: 'flags', h: 'Flags', l: 1, ns: 1, f: r => U.chips(r.flags) }, { k: 'through', h: 'Through', f: V.through }],
    mom: [{ k: 'mom', h: 'Nominal 1y', f: r => U.chg(r.mom) }, { k: 'real_1y', h: 'Real 1y', f: r => U.chg(r1(r)) }, { k: 'rel_mom', h: 'vs country', f: r => U.chg(r.rel_mom, 1, ''), t: '1-year change less the country\'s, points' },
      { k: 'mom_3y', h: '3y p.a.', f: r => U.chg(r.mom_3y) }, { k: 'usd_1y', h: 'USD 1y', f: r => U.chg(r.usd_1y) }, { k: 'dd10', h: 'From 10y peak', f: r => U.chg(r.dd10), t: tip.dd10 }, { k: 'real_dd10', h: 'Real', f: r => U.chg(r.real_dd10), t: 'Real fall from the 10-year peak' },
      { k: 'vol', h: 'Vol', f: r => U.num(r.vol, 1, '%') }, { k: 'beta', h: 'Beta', f: r => U.num(r.beta, 2), t: tip.beta }, { k: 'corr', h: 'Corr.', f: r => U.num(r.corr, 2) },
      { k: 'mfall', h: 'Districts falling', v: r => r.micro && r.micro.falling, f: r => U.num(r.micro && r.micro.falling, 0, '%') }, { k: 'mdisp', h: 'Dispersion', v: r => r.micro && r.micro.disp, f: r => U.num(r.micro && r.micro.disp, 1), t: 'Spread of district relative value inside the city, points' },
      { k: 'through', h: 'Through', f: V.through }],
    mdl: [{ k: 'gap', h: 'Implied gap', f: r => U.gapBar(r.gap), t: 'Country gap plus the city\'s premium to the country, against the premium\'s own mean' }, { k: 'ratio_gap', h: 'Four ratios', f: r => U.sgn(r.ratio_gap, 0, '%'), t: 'The same, from the country\'s four-ratio composite' },
      { k: 'exp_1y', h: 'Expected 1y', f: r => V.expCell(r.exp_1y, r.exp_1y_lo, r.exp_1y_hi), t: 'Expected real change over the next year: the country\'s, plus what the city\'s premium and recent change against the country have meant. Under it, the range of past errors.' },
      { k: 'exp_country', h: 'Country', f: r => U.sgn(r.exp_country, 1, '%'), t: 'The country\'s expected real change' }, { k: 'exp_rel', h: 'City vs country', f: r => U.sgn(r.exp_rel, 1), t: 'Expected change against the country, points' },
      { k: 'prem_z', h: 'Premium z', f: r => U.zBar(r.prem_z) }, { k: 'real_1y', h: 'Real 1y', f: r => U.chg(r1(r)) },
      { k: 'uw_q', h: 'Since peak', f: r => (ok(r.uw_q) ? (r.uw_q === 0 ? 'at peak' : `${fmt.fx(r.uw_q / 4, 1)}y`) : '<span class="mute">–</span>'), t: 'Years since the price index (real where a deflator exists) was last at its highest' },
      { k: 'up8', h: 'Up quarters', f: r => (ok(r.up8) ? `${r.up8}/8` : '<span class="mute">–</span>'), t: 'Quarters with a rise among the last eight' }, { k: 'through', h: 'Through', f: V.through }],
    lev: [{ k: 'yield', h: 'Gross yield', f: r => U.num(r.yield, 2, '%') }, { k: 'yield_spread', h: 'Yield − 10y', f: r => U.sgn(r.yield_spread, 2), t: tip.ys }, { k: 'pti_years', h: 'Price/income', f: r => U.num(r.pti_years, 1, '×') },
      { k: 'rent_share', h: 'Rent/income', f: r => U.num(r.rent_share, 0, '%'), t: 'Annual rent as a share of household income' },
      { k: 'pay_share', h: 'Payment/income', f: r => U.num(r.pay_share, 0, '%'), t: `Annual payment on a ${v0.term_years}-year mortgage for ${Math.round(v0.ltv * 100)}% of the price at the country's current lending rate, as a share of the stated income` },
      { k: 'own_rent', h: 'Own/rent', f: r => U.num(r.own_rent, 2, '×'), t: 'The same mortgage payment over the annual rent: above 1, the loan costs more than renting' },
      { k: 'carry', h: 'Yield − lending', f: r => U.sgn(r.carry, 2), t: 'Gross rental yield less the country\'s lending rate, points' },
      { k: 'wage_m2', h: 'm² per year of income', f: r => U.num(r.wage_m2, 1), t: 'Square metres of housing that one year of the stated income buys at the published price per m². Shown where only a price per m² is published, so no dwelling size is assumed.' }, { k: 'inc_basis', h: 'Income basis', l: 1, f: r => U.txt(r.inc_basis), cls: 'wrap dim' },
      { k: 'levels_year', h: 'Year', f: r => U.txt(r.levels_year) }, { k: 'gap', h: 'Implied gap', f: r => U.gapBar(r.gap, null, null, { w: 72 }) }],
  };

  REI.route('/cities', async app => {
    const v = await REI.val(), nm = V.names(v), s = U.st('cities', { set: 'val', region: '', country: '', tier: '', quad: '', flag: '', q: '', mm: 'gap' });
    Object.assign(v0, { term_years: v.params.term_years, ltv: v.params.ltv || 0.8 });
    const ctry = [...new Set(v.cities.map(c => c.country))].map(c => [c, nm[c] || c]).sort((a, b) => a[1].localeCompare(b[1]));
    const flags = [...new Set(v.cities.flatMap(c => c.flags || []))].sort();
    app.innerHTML = U.head('Cities', 'Each city against its own country: the premium it trades at, how unusual that premium is, and the gap this implies. Yields and price-to-income where levels are published.',
      `${v.kpis.cities} cities · ${v.kpis.cities_valued} with a valuation · ${v.cities.filter(c => ok(c.yield)).length} with yields`) +
      `<section class="pnl"><div class="pnl-h"><h2>Where the cities are</h2><span class="hs">${v.kpis.cities_mapped || 0} cities placed · the filters below apply · click a city</span></div>
        <div class="map-ctl">${U.seg('ci-mm', Object.entries(V.MAPM).map(([k, m]) => [k, m.label]), s.mm)}<span class="legend" id="ci-lg"></span></div><div class="map" id="ci-map"></div></section>` +
      U.panel('Premium against relative momentum', 'premium z-score across, 1-year change less the country\'s (points) up · click a city', '<div class="chart tall" id="ci-sc"></div>') +
      `<section class="pnl"><div class="ctl">${U.seg('ci-set', [['val', 'Valuation'], ['mdl', 'Outlook'], ['mom', 'Momentum & risk'], ['lev', 'Yields & affordability']], s.set)}
        ${U.select('ci-reg', 'Region', V.opt('All', V.regions(v.cities)), s.region)}${U.select('ci-co', 'Country', V.opt('All', ctry), s.country)}
        ${U.select('ci-tier', 'Data', [['', 'All'], ['sold', 'Sold records'], ['B', 'Index']], s.tier)}
        ${U.select('ci-quad', 'Regime', V.opt('All', ['rich & rising', 'rich & falling', 'cheap & rising', 'cheap & falling']), s.quad)}
        ${U.select('ci-flag', 'Flag', V.opt('Any', flags), s.flag)}${U.search('ci-q', 'Filter cities', s.q)}<span class="count" id="ci-n"></span></div><div id="ci-t"></div></section>
      <p class="note">Implied gap = the country's fair-value gap plus how far the city's premium to its country sits from that premium's own long-run mean. It needs a country valued by the model and at least ${v.params.city_min_q} quarters of city history. Yields and price-to-income compare cities inside one country; definitions differ across countries (see <a href="#/methodology">methodology</a>).</p>`;
    const rows = () => v.cities.filter(c => (!s.region || c.region === s.region) && (!s.country || c.country === s.country) && (!s.tier || (s.tier === 'B' ? c.tier === 'B' : c.tier !== 'B')) &&
      (!s.quad || c.quadrant === s.quad) && (!s.flag || (c.flags || []).includes(s.flag)) && V.match(c, s.q) && (s.set !== 'lev' || ok(c.yield) || ok(c.pti_years) || ok(c.wage_m2)));
    const NAMEK = { k: 'name', h: 'City', l: 1, f: r => V.kl(r, nm) };
    const cols = () => [NAMEK].concat(KC[s.set]);
    const p = REI.pal();
    const scat = r => C.scatter('ci-sc', r.filter(c => !c.stale).map(c => ({ x: c.prem_z, y: c.rel_mom, label: c.name, tip: `${c.name} (${nm[c.country] || c.country})`, href: `#/city/${c.key}`, color: c.prem_z >= 0 ? p.rich : p.cheap })),
      { x: 'Premium z-score', y: 'Relative momentum', ys: ' pts', height: 400, xrange: [-4, 4], corners: ['low premium, outperforming', 'high premium, outperforming', 'low premium, lagging', 'high premium, lagging'] });
    const t = U.table('ci-t', { id: 'cities', cols: cols(), rows: rows(), sort: 'gap', dir: -1, limit: 100, rowCls: r => (r.stale ? 'stale' : '') });
    const mopt = () => { const m = V.MAPM[s.mm]; return { kind: m.kind, span: m.span, unit: m.unit, label: m.label, legend: U.$('ci-lg') }; };
    const mp = REI.map.points('ci-map', V.cityPts(rows().filter(c => !c.stale), s.mm, nm), mopt());
    const redraw = sc => { const r = rows(); t.set(r, cols()); U.$('ci-n').textContent = `${r.length} cities`; if (sc) { scat(r); if (mp) mp.set(V.cityPts(r.filter(c => !c.stale), s.mm, nm), mopt(), true); } };
    U.onSeg('ci-mm', x => { s.mm = x; if (mp) mp.set(V.cityPts(rows().filter(c => !c.stale), s.mm, nm), mopt(), false); });
    U.onSeg('ci-set', x => { s.set = x; redraw(true); });
    [['ci-reg', 'region'], ['ci-co', 'country'], ['ci-tier', 'tier'], ['ci-quad', 'quad'], ['ci-flag', 'flag']].forEach(([id, key]) => U.onChange(id, x => { s[key] = x; redraw(true); }));
    U.onInput('ci-q', x => { s.q = x; redraw(false); });
    redraw(true);
  });

  // ------------------------------------------------------------------------------------------ districts
  REI.route('/micro', async app => {
    const [v, m] = await Promise.all([REI.val(), REI.micro()]), nm = V.names(v), s = U.st('micro', { list: 'cheap', country: '' });
    const ctry = [...new Set(m.cities.map(c => c.country))].map(c => [c, nm[c] || c]).sort((a, b) => a[1].localeCompare(b[1]));
    const o = m.evidence.overall;
    app.innerHTML = U.head('Districts', 'Relative value inside cities: each district\'s price against its own city, compared with that relationship\'s history.',
      `${m.n.toLocaleString('en-GB')} districts in ${m.cities.length} cities`) +
      U.kpis([{ k: 'Districts valued', v: m.n.toLocaleString('en-GB'), s: `${m.cities.length} cities` },
        { k: 'Median city: districts falling', v: U.num(med(m.cities.map(c => c.falling)), 0, '%'), s: 'nominal 1-year change below zero' },
        { k: 'Median dispersion', v: U.num(med(m.cities.map(c => c.disp)), 1, ' pts'), s: 'spread of relative value inside a city' },
        { k: 'Momentum IC, 1 year', v: fmt.sg(o.mom_4.mean_ic, 3), s: `positive in ${fmt.fx(o.mom_4.positive, 0)}% of ${o.mom_4.cities} cities` },
        { k: 'Relative value IC, 1 year', v: fmt.sg(o.rv_4.mean_ic, 3), s: `positive in ${fmt.fx(o.rv_4.positive, 0)}% of ${o.rv_4.cities} cities` }]) +
      `<p class="note caveat">Read these as a map of where prices have diverged, not as a ranking of what to buy. In the record, cheap districts did not go on to outperform their city (information coefficient near zero), and district momentum carried over only weakly. <a href="#/evidence">Evidence</a>.</p>
      <section class="pnl"><div class="pnl-h"><h2>District screen</h2><span class="hs">z = relative value against the district's own history, in standard deviations</span></div>
        <div class="ctl">${U.seg('mi-list', [['cheap', 'Cheapest against own city'], ['rich', 'Richest'], ['falling', 'Falling fastest']], s.list)}${U.select('mi-co', 'Country', V.opt('All', ctry), s.country)}<span class="count" id="mi-n"></span></div><div id="mi-t"></div></section>
      ${U.panel('Cities by internal dispersion', 'how far districts have pulled apart inside each city', '<div id="mi-c"></div>', { flush: true })}`;
    const dc = [{ k: 'name', h: 'District', l: 1, f: r => `<a href="#/area/${r.city}/${encodeURIComponent(r.code)}">${esc(r.name || r.code)}</a>${r.noisy ? V.tag('thin') : ''}<span class="sub">${esc(r.city_name)} · ${esc(nm[r.country] || r.country)}</span>` },
      { k: 'z', h: 'Relative value z', f: r => U.zBar(r.z) }, { k: 'rv', h: 'vs own mean', f: r => U.sgn(r.rv, 0, '%'), t: 'District price relative to its city, against that ratio\'s own mean' }, { k: 'pct', h: 'Pctile', f: r => U.num(r.pct, 0) },
      { k: 'mom', h: '1y', f: r => U.chg(r.mom) }, { k: 'rel_mom', h: 'vs city', f: r => U.chg(r.rel_mom, 1, '') }, { k: 'dd', h: 'From peak', f: r => U.chg(r.dd) }, { k: 'n12', h: 'Sales 12m', f: r => (ok(r.n12) ? fmt.num(r.n12) : '<span class="mute">–</span>') }];
    const rows = () => (m[s.list] || []).filter(r => !s.country || r.country === s.country);
    const t = U.table('mi-t', { id: 'micro', cols: dc, rows: rows(), limit: 50, cap: 1 });
    const redraw = () => { const r = rows(); t.update(r); U.$('mi-n').textContent = `${r.length} districts`; };
    U.onSeg('mi-list', x => { s.list = x; redraw(); }); U.onChange('mi-co', x => { s.country = x; redraw(); }); redraw();
    U.table('mi-c', { id: 'micro-c', sort: 'disp', dir: -1, limit: 40, rows: m.cities, cols: [
      { k: 'name', h: 'City', l: 1, f: r => `<a href="#/city/${r.key}">${esc(r.name)}</a><span class="sub">${esc(nm[r.country] || r.country)}</span>` }, { k: 'n', h: 'Districts', f: r => fmt.num(r.n) },
      { k: 'mom', h: 'City 1y', f: r => U.chg(r.mom) }, { k: 'mom_med', h: 'Median district 1y', f: r => U.chg(r.mom_med) }, { k: 'disp', h: 'Dispersion', f: r => U.num(r.disp, 1) },
      { k: 'falling', h: 'Falling', f: r => U.num(r.falling, 0, '%') }, { k: 'rich', h: 'z above +1', f: r => U.num(r.rich, 0, '%') }, { k: 'cheap', h: 'z below −1', f: r => U.num(r.cheap, 0, '%') }] });
  });
  function med(a) { const x = a.filter(ok).sort((p, q) => p - q); return x.length ? (x[(x.length - 1) >> 1] + x[x.length >> 1]) / 2 : null; }
})();
