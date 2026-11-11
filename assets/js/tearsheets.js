/* Tear-sheets: one page per country and per city. Valuation first, then prices, then the backdrop and the detail. */
(function () {
  const { fmt, esc, ok } = REI, U = REI.ui, C = REI.charts, V = REI.vu;
  const setAttr = t => { const a = document.getElementById('attribution'); if (a) a.textContent = t || ''; };
  const last = (a, q) => { if (!a) return [null, null]; for (let i = a.length - 1; i >= 0; i--) if (ok(a[i])) return [a[i], q ? q[i] : null]; return [null, null]; };
  const has = a => Array.isArray(a) && a.some(ok);

  /* The model's panels on a country page: price against fitted fair value, the gap with its range and its history as
     known at the time, what moved fair value, and the plain-figure reading. Countries without the model keep the reading. */
  const dd = (kk, val, small) => `<div><dt>${kk}</dt><dd>${val}${small ? `<small>${small}</small>` : ''}</dd></div>`;
  function reading(r, v) {
    const parts = x => (x ? `base ${fmt.sg(x.base, 1)}${ok(x.gap) ? ` · gap ${fmt.sg(x.gap, 1)}` : ''} · momentum ${fmt.sg(x.mom, 1)}` : '');
    const rng = (lo, hi) => (ok(lo) && ok(hi) ? `past errors ${fmt.sg(lo, 0)} to ${fmt.sg(hi, 0)} · ` : '');
    return [
      ok(r.exp_1y) ? dd('Expected real change, next year', `${fmt.sg(r.exp_1y, 1)}%`, rng(r.exp_1y_lo, r.exp_1y_hi) + parts(r.exp_1y_parts)) : '',
      ok(r.exp_3y) ? dd('Expected real change, next 3 years', `${fmt.sg(r.exp_3y, 1)}% a year`, rng(r.exp_3y_lo, r.exp_3y_hi) + parts(r.exp_3y_parts)) : '',
      ok(r.rate_sens) ? dd('Fair value if the lending rate were 1 point higher', `${fmt.sg(r.rate_sens, 1)}%`) : '',
      ok(r.inc_growth) ? dd('Real income per head, 10 years', `${fmt.sg(r.inc_growth, 1)}% a year`, ok(r.inc_years) ? `${r.inc_years > 60 ? 'more than 60' : fmt.fx(r.inc_years, 0)} years of it would close the gap with real prices flat` : '') : '',
      ok(r.be_rate) ? dd('Rate that restores average affordability', `${fmt.fx(r.be_rate, 2)}%`, `lending rate now ${fmt.fx(r.lend, 2)}% · ${r.be_gap >= 0 ? 'room of' : 'needs a fall of'} ${fmt.fx(Math.abs(r.be_gap), 2)} points`) : r.be_none ? dd('Rate that restores average affordability', 'none', 'even a zero rate would leave the payment above its average share of income') : '',
      ok(r.rti) ? dd('Rent to income', `${fmt.sg(r.rti, 0)}%`, 'against its own long-run mean') : '',
      ok(r.rent_real_1y) ? dd('Real rents, 1 year', `${fmt.sg(r.rent_real_1y, 1)}%`) : '',
      ok(r.uw_q) ? dd('Real price peak', r.uw_q === 0 ? 'now' : esc(fmt.qtr(r.peak)), r.uw_q ? `${fmt.fx(r.uw_q / 4, 1)} years ago · ${fmt.pct(r.dd, 1)} from it` : '') : '',
    ].join('');
  }
  function modelBlock(r, d, v) {
    const rd = reading(r, v);
    if (!rd && !has(d.fv)) return '';
    const sub = r.exp_basis ? `expected change from ${esc(r.exp_basis)} · <a href="#/model">the model and its record</a>` : '';
    const dl = `<dl class="dl one">${rd}</dl>`;
    if (!has(d.fv)) return U.panel('Outlook and affordability', sub, dl);
    const W = { 4: '1 year', 12: '3 years', 40: '10 years' };
    const rows = (r.fv_parts || []).map(x => `<tr><td class="l">${W[x.q] || x.q + ' quarters'}</td><td>${fmt.sg(x.income, 1)}%</td><td>${fmt.sg(x.rates, 1)}%</td><td>${fmt.sg(x.fair, 1)}%</td><td>${fmt.sg(x.price, 1)}%</td><td>${fmt.sg(100 * ((1 + x.price / 100) / (1 + x.fair / 100) - 1), 1)}</td></tr>`).join('');
    const B = r.fv_tier === 2 ? v.model.proxy.beta : v.model.beta;
    const unfit = r.fv_unfit ? `<p class="note caveat"><b>The model does not fit ${esc(r.name)}.</b> Since ${esc(fmt.qtr(r.fv_from))} its model gap has been ${fmt.fx(100 * r.fv_trend_r2, 0)}% a straight line (${fmt.sg(r.fv_drift, 1)}% a year) and has crossed fair value ${r.fv_cross === 1 ? 'once' : r.fv_cross + ' times'}: price and income have drifted apart and never come back, so the reading of ${fmt.pct(r.fv_gap, 0)} says how far they have drifted, not that the market is ${r.fv_gap < 0 ? 'cheap' : 'rich'}. ${esc(r.name)} is therefore valued on ${r.basis === 'ratios' ? 'the four-ratio composite' : 'the trend basis'}, and the chart and table below are for reference.</p>` : '';
    const proxy = r.fv_unfit ? unfit : r.fv_tier === 2 ? `<p class="note caveat"><b>Proxy income.</b> The OECD publishes no disposable-income series for ${esc(r.name)}, so the model here runs on ${esc(r.fv_basis || 'an income proxy')}: annual, a wider income concept than what households have to spend${r.fv_rolled ? `, and carried forward ${r.fv_rolled} quarter${r.fv_rolled > 1 ? 's' : ''} at its recent pace` : ''}. ${r.fv_no_rate ? 'No lending, bond or policy rate is on the site for this country, so its fair value moves with income alone. ' : `Lending rate: ${esc(r.fv_rate || 'see below')}. `}Read the gap as less reliable than for countries valued on disposable income; where an official price index understates how far prices have risen, the gap overstates how cheap the market is. The expected change uses momentum only.</p>` : '';
    return `${proxy}<div class="g g2">${U.panel('Price against model fair value', `real index, latest price = 100 · fair value from ${esc(V.basisShort(r))} and borrowing cost`, '<div class="chart" id="cs-fv"></div>')}
        ${U.panel('Outlook and affordability', sub, dl)}</div>
      ${U.panel('What moved fair value', 'percent over each window', `<div class="tw"><table class="tbl"><thead><tr><th class="l ns">Over</th><th class="ns" title="Contribution of real income per head">Income</th><th class="ns" title="Contribution of the lending rate through the annuity factor">Borrowing cost</th><th class="ns">Fair value</th><th class="ns">Real price</th><th class="ns" title="Change in the model gap, points">Gap, pts</th></tr></thead><tbody>${rows}</tbody></table></div>
        <p class="note" style="padding:0 14px 12px">Fair value moves with real income per head (slope ${fmt.fx(B.y, 2)}) and with the cost of a loan (slope ${fmt.sg(B.a, 2)} on the annuity factor). The gap widens when the price outruns the two.${r.fv_tier === 1 && r.fv_rolled ? ` Income is published later than prices: its last ${r.fv_rolled} quarter${r.fv_rolled > 1 ? 's are' : ' is'} carried forward at its recent pace.` : ''}</p>`, { flush: true })}`;
  }

  // ------------------------------------------------------------------------------------------ country
  REI.route('/country/:iso', async (app, { iso }) => {
    iso = iso.toUpperCase();
    const v = await REI.val(), r = v.countries.find(c => c.iso2 === iso);
    if (!r) throw new Error(`No country ${iso} in the valuation table`);
    const d = await REI.vcountry(iso), nm = V.names(v), ratio = V.valued(r), mdl = r.basis === 'model';
    const hasM = ['pir', 'prr', 'pti', 'ptr'].some(k => has((d.measures || {})[k]));
    const cities = v.cities.filter(c => c.country === iso), mapped = cities.filter(c => ok(c.lat) && !c.stale);
    const m0 = mapped.some(c => ok(c.gap)) ? 'gap' : 'real';            // no valued city yet: colour by price change
    const rn = d.rate_note || {};
    const lendTxt = r.lend_basis === 'mortgage' ? 'published mortgage rate' : r.lend_basis ? `10-year yield + ${fmt.fx(r.spread || rn.spread, 1)} points` : 'no rate series';
    app.innerHTML = U.head(esc(r.name), `${esc(r.region || '')} · ${mdl ? `fair value from the model on ${esc(V.basisShort(r))}` : ratio ? `fair value from ${r.n} measures` : 'outside the model: gap to own real price trend'} · prices through ${fmt.qtr(r.price_through || r.through)}`,
      `${U.chips(r.flags)}${r.stale ? '<br>' + U.badge(`Stale: data ends ${fmt.qtr(r.through)}`, 1) : ''}`, `<a href="#/countries">Countries</a> › ${esc(r.name)}`) +
      U.kpis([
        { k: ratio ? 'Fair-value gap' : 'Gap to trend', v: U.sgn(r.gap, 1, '%'), cls: V.gapCls(r.gap), s: ratio ? `${mdl ? 'slopes' : 'measures'} ${fmt.pct(r.lo, 0)} to ${fmt.pct(r.hi, 0)} · Δ1y ${fmt.sg(r.gap_1y, 1)}` : 'real price against its 20-year trend', sp: U.spark((d.gap || []).slice(-40)) },
        ratio ? { k: 'Percentile', v: U.num(r.pct, 0), s: 'of its own history (100 = richest)' } : null,
        mdl && ok(r.ratio_gap) ? { k: 'Four-ratio composite', v: U.sgn(r.ratio_gap, 1, '%'), cls: V.gapCls(r.ratio_gap), s: `${r.ratio_n} measures ${fmt.pct(r.ratio_lo, 0)} to ${fmt.pct(r.ratio_hi, 0)}${r.ratio_stale ? ' · stale' : ''}`,
          t: 'The older measure: the average of price to income, price to rent and the two payment ratios, each against its own long-run mean' } : null,
        ok(r.exp_1y) ? { k: 'Expected real change, 1 year', v: U.chg(r.exp_1y), s: `past errors ${fmt.sg(r.exp_1y_lo, 0)} to ${fmt.sg(r.exp_1y_hi, 0)}${ok(r.exp_3y) ? ` · 3 years ${fmt.sg(r.exp_3y, 1)}% a year` : ''}`,
          t: `Model estimate from ${r.exp_basis}. The range is the 10th to 90th percentile of past forecast errors; the record is on the Model page.` } : null,
        { k: 'Real price, 1 year', v: U.chg(r.real_1y), s: `5 years ${fmt.pct(r.real_5y)} a year · nominal 1y ${fmt.pct(r.nominal_1y)}`, sp: U.spark((d.real || []).slice(-40)) },
        { k: 'From 10-year peak', v: U.chg(r.dd10), s: `vol ${fmt.fx(r.vol, 1)}% · half-life ${ok(r.half_life) ? fmt.fx(r.half_life, 1) + 'y' : '–'}` },
        { k: 'Lending rate', v: U.num(r.lend, 2, '%'), s: `${esc(lendTxt)} · Δ3y ${fmt.sg(r.lend_3y, 2)}`, sp: U.spark((d.rate || []).slice(-40)) },
        { k: 'Policy rate', v: U.num(r.policy, 2, '%'), s: `Δ1y ${fmt.sg(r.policy_1y, 2)} · real 10y ${fmt.fx(r.real_long, 2)}%` },
        has(d.dsr) || has(d.credit_gap) ? { k: 'Debt service', v: U.num(r.dsr, 1, '%'), s: `${fmt.sg(r.dsr_dev, 1)} vs mean · credit gap ${fmt.sg(r.credit_gap, 1)}` } : null,
        has(d.unemp) ? { k: 'Unemployment', v: U.num(r.unemp, 1, '%'), s: `Δ1y ${fmt.sg(r.unemp_1y, 1)} · CPI ${fmt.fx(r.cpi_yoy, 1)}%` } : null,
      ]) +
      `<div class="g g2">${U.panel(ratio ? 'Fair-value gap' : 'Gap to trend', mdl ? 'the model: its range across re-estimated slopes shaded, and the gap as it was known at the time' : ratio ? 'composite, the range of its measures shaded, and the gap as it was known at the time' : '% above or below the real price trend', '<div class="chart" id="cs-g"></div>')}
        ${hasM ? U.panel('The four ratios', '% from each ratio\'s own long-run mean · dotted: their average', '<div class="chart" id="cs-m"></div>') : U.panel('Real price and trend', 'index, latest = 100', '<div class="chart" id="cs-t"></div>')}</div>
      <div class="g g2">${hasM ? U.panel('Real price and trend', 'index, latest = 100', '<div class="chart" id="cs-t"></div>') : ''}${U.panel('Rates', '%', '<div class="chart" id="cs-r"></div>')}${hasM ? '' : U.panel('Inflation', 'CPI, % on a year earlier', '<div class="chart" id="cs-i"></div>')}</div>
      ${modelBlock(r, d, v)}
      <div class="g g3">${has(d.credit_gap) ? U.panel('Credit-to-GDP gap', 'points (BIS)', '<div class="chart short" id="cs-c"></div>') : ''}${has(d.dsr) ? U.panel('Debt service ratio', `% of income (${esc(r.dsr_kind || 'BIS')})`, '<div class="chart short" id="cs-d"></div>') : ''}
        ${has(d.unemp) ? U.panel('Unemployment', '%', '<div class="chart short" id="cs-u"></div>') : ''}${hasM && has(d.cpi_yoy) ? U.panel('Inflation', 'CPI, % on a year earlier', '<div class="chart short" id="cs-i"></div>') : ''}${has(d.hh_credit) ? U.panel('Household credit', '% of GDP', '<div class="chart short" id="cs-h"></div>') : ''}${has(d.rti) ? U.panel('Rent to income', '% from its own mean · the renter\'s burden', '<div class="chart short" id="cs-ri"></div>') : ''}</div>
      ${mapped.length > 1 ? `<section class="pnl"><div class="pnl-h"><h2>Cities in ${esc(r.name)}: map</h2><span class="hs">${mapped.length} cities · click a city</span></div>
        <div class="map-ctl">${U.seg('cs-mm', Object.entries(V.MAPM).map(([k, m]) => [k, m.label]), m0)}<span class="legend" id="cs-lg"></span></div><div class="map" id="cs-map"></div></section>` : ''}
      ${cities.length ? U.panel(`Cities in ${r.name}`, `${cities.length} · implied gap = country gap compounded with the city's premium against its own mean`, '<div id="cs-k"></div>', { flush: true }) : ''}
      ${has(d.pig) ? U.panel(`Price to ${esc((d.pig_basis || 'GDP per head').toLowerCase())}`, '% from its own mean · descriptive, not part of the gap', '<div class="chart short" id="cs-pg"></div>') +
        `<p class="note caveat"><b>Read with care.</b> No price-to-income ratio is published for ${esc(r.name)}. This is the national price index over ${esc((d.pig_basis || 'GDP per head').toLowerCase())} (${d.pig_basis === 'GDP per head' ? 'World Bank, annual' : 'national statistics, annual'}), against its own mean. Where incomes have grown much faster than the price index it simply trends down, so it is shown for reference and is not used in the gap, the flags or the rankings.${r.deflated ? ` Real prices here are the nominal series deflated by ${esc(r.deflated)}.` : ''}${r.national_source ? ` National series: ${esc(r.national_source)}.` : ''}</p>` : ''}
      <p class="note">Lending rate: ${esc(lendTxt)}${rn.from ? ` (series from ${esc(fmt.qtr(rn.from))})` : ''}. ${ratio ? 'Measures: price to income, price to rent, mortgage payment to income and to rent, each against its own long-run mean.' : ''} The point-in-time line recomputes the gap each quarter with only the data available then; the gap to that line is how much hindsight changes the picture. <a href="#/methodology">Methodology</a>.</p>`;
    const p = REI.pal(), q = d.q;
    if (ratio) C.lines('cs-g', [{ x: q, y: d.gap, name: mdl ? 'Model gap' : 'Composite gap' }, { x: q, y: d.gap_pit, name: 'As known at the time', color: p.neutral, dash: 'dot', width: 1.5 }],
      { suffix: '%', zero: true, band: { x: q, lo: d.lo, hi: d.hi, name: mdl ? 'Range across slopes' : 'Range of measures' } });
    else C.lines('cs-g', [{ x: q, y: d.trend_gap }], { suffix: '%', zero: true });
    if (hasM) {
      const M = [['pir', 'Price/income'], ['prr', 'Price/rent'], ['pti', 'Payment/income'], ['ptr', 'Payment/rent']].filter(([k]) => has(d.measures[k]));
      const comp = mdl ? (d.ratio || {}).gap : d.gap;
      C.lines('cs-m', M.map(([k, n], i) => ({ x: q, y: d.measures[k], name: n, color: p.cat[i], width: 1.6 })).concat(has(comp) ? [{ x: q, y: comp, name: 'Composite', color: p.ink, dash: 'dot', width: 1.6 }] : []), { suffix: '%', zero: true });
    }
    C.lines('cs-t', [{ x: q, y: d.real, name: 'Real price' }, { x: q, y: d.trend, name: 'Trend', color: p.neutral, dash: 'dash', width: 1.5 }], {});
    const R = [['policy', 'Policy rate', true], ['long', '10-year yield'], ['rate', r.lend_basis === 'mortgage' ? 'Mortgage rate' : 'Lending rate (10y + spread)']].filter(([k]) => has(d[k]));
    C.lines('cs-r', R.map(([k, n, st], i) => ({ x: q, y: d[k], name: n, color: p.cat[i], step: st, fmt: '.2f' })), { suffix: '%' });
    if (has(d.credit_gap)) C.lines('cs-c', [{ x: q, y: d.credit_gap }], { zero: true, height: 200, hlines: [{ y: v.params.flags.credit_gap, text: 'boom flag' }] });
    if (has(d.dsr)) C.lines('cs-d', [{ x: q, y: d.dsr }], { suffix: '%', height: 200 });
    if (has(d.unemp)) C.lines('cs-u', [{ x: q, y: d.unemp }], { suffix: '%', height: 200 });
    if (has(d.cpi_yoy)) C.lines('cs-i', [{ x: q, y: d.cpi_yoy }], { suffix: '%', zero: true, height: hasM ? 200 : 280 });
    if (has(d.pig)) C.lines('cs-pg', [{ x: q, y: d.pig }], { suffix: '%', zero: true, height: 200 });
    if (has(d.hh_credit)) C.lines('cs-h', [{ x: q, y: d.hh_credit }], { suffix: '%', height: 200 });
    if (has(d.rti)) C.lines('cs-ri', [{ x: q, y: d.rti }], { suffix: '%', zero: true, height: 200 });
    if (has(d.fv)) C.lines('cs-fv', [{ x: q, y: d.real, name: 'Real price' }, { x: q, y: d.fv, name: 'Model fair value', color: p.cat[1], width: 1.8 }], {});
    if (mapped.length > 1) {
      const mo = k => { const m = V.MAPM[k]; return { kind: m.kind, span: m.span, unit: m.unit, label: m.label, legend: U.$('cs-lg'), maxZoom: 9 }; };
      const mp = REI.map.points('cs-map', V.cityPts(mapped, m0, null), mo(m0));
      U.onSeg('cs-mm', x => { if (mp) mp.set(V.cityPts(mapped, x, null), mo(x), false); });
    }
    if (cities.length) U.table('cs-k', { id: 'cs-k', sort: 'gap', dir: -1, limit: 40, rows: cities, rowCls: c => (c.stale ? 'stale' : ''), cols: [
      { k: 'name', h: 'City', l: 1, f: c => `<a href="#/city/${c.key}">${esc(c.name)}</a>${c.tier !== 'B' ? V.tag('sold records') : ''}${c.stale ? V.tag('stale') : ''}` },
      { k: 'gap', h: 'Implied gap', f: c => U.gapBar(c.gap) }, { k: 'exp_1y', h: 'Expected 1y', f: c => U.chg(c.exp_1y), t: 'Expected real change over the next year' },
      { k: 'prem', h: 'Premium', f: c => U.sgn(c.prem, 0, '%') }, { k: 'prem_z', h: 'Premium z', f: c => U.zBar(c.prem_z) },
      { k: 'real_1y', h: 'Real 1y', f: c => U.chg(c.real_1y) }, { k: 'rel_mom', h: 'vs country', f: c => U.chg(c.rel_mom, 1, '') }, { k: 'dd10', h: 'From 10y peak', f: c => U.chg(c.dd10) },
      { k: 'yield', h: 'Yield', f: c => U.num(c.yield, 1, '%') }, { k: 'pti_years', h: 'Price/income', f: c => U.num(c.pti_years, 1, '×') }, { k: 'through', h: 'Through', f: V.through }] });
    setAttr('');
  });

  // ------------------------------------------------------------------------------------------ city
  REI.route('/city/:key', async (app, { key }) => {
    const v = await REI.val();
    const r = v.cities.find(c => c.key === key) || null;
    const [vk, s] = await Promise.all([REI.vcity(key).catch(() => null), REI.city(key).catch(() => null)]);
    if (!r && !s) throw new Error(`No city "${key}"`);
    const nm = V.names(v), m = (REI.state.meta.cities || []).find(c => c.key === key) || {};
    const name = (r || s).name, iso = (r || s).country, cur = (s && s.currency) || (r && r.currency);
    const sold = s && s.tier !== 'B';
    const basisTxt = sold ? 'Repeat-sales index from the sold-price register' : s ? s.basis : '';
    const R = r || {}, CR = v.countries.find(c => c.iso2 === iso) || {};
    const prov = s && s.provisional_from ? U.badge(`Provisional from ${fmt.month(s.provisional_from)}`, 1) : '';
    app.innerHTML = U.head(esc(name), `${esc(nm[iso] || iso)} · ${esc(basisTxt || '')}`,
      `${U.chips(R.flags)}<br>${U.badge('Through ' + (s ? fmt.month(s.data_through) : fmt.qtr(R.through)))} ${prov}`,
      `<a href="#/cities">Cities</a> › <a href="#/country/${iso}">${esc(nm[iso] || iso)}</a> › ${esc(name)}`) +
      U.kpis([
        { k: 'Implied gap', v: U.sgn(R.gap, 1, '%'), cls: V.gapCls(R.gap), s: ok(R.c_gap) ? `country ${fmt.pct(R.c_gap, 0)}${R.c_basis === 'trend' ? ' (trend basis)' : R.fv_tier === 2 ? ' (proxy income)' : ''}${ok(R.ratio_gap) ? ` · on the four ratios ${fmt.pct(R.ratio_gap, 0)}` : ''}` : 'needs a valued country', t: 'The country\'s fair-value gap (from the model) compounded with the city premium\'s distance from its own mean' },
        ok(R.exp_1y) ? { k: 'Expected real change, 1 year', v: U.chg(R.exp_1y), s: `country ${fmt.sg(R.exp_country, 1)} · city against it ${fmt.sg(R.exp_rel, 1)}${ok(R.exp_1y_lo) ? ` · past errors ${fmt.sg(R.exp_1y_lo, 0)} to ${fmt.sg(R.exp_1y_hi, 0)}` : ''}`,
          t: 'Model estimate: the country\'s expected real change plus what the city\'s premium and its recent change against the country have meant for the following year. The record is on the Model page.' } : null,
        { k: 'Premium to country', v: U.sgn(R.prem, 1, '%'), s: `z ${fmt.sg(R.prem_z, 2)} · percentile ${fmt.fx(R.prem_pct, 0)}`, t: 'Real city index over the national index, against its own long-run mean' },
        { k: 'Real price, 1 year', v: U.chg(ok(R.real_1y) ? R.real_1y : null), s: `nominal ${fmt.pct(R.mom)} · vs country ${fmt.sg(R.rel_mom, 1)} pts` },
        { k: '3 years, a year', v: U.chg(R.mom_3y), s: `USD 1y ${fmt.pct(R.usd_1y)}` },
        { k: 'From 10-year peak', v: U.chg(R.dd10), s: `real ${fmt.pct(R.real_dd10)} · vol ${fmt.fx(R.vol, 1)}%` },
        { k: 'Beta to country', v: U.num(R.beta, 2), s: `correlation ${fmt.fx(R.corr, 2)}` },
        ok(R.yield) ? { k: 'Gross yield', v: U.num(R.yield, 2, '%'), s: `${fmt.sg(R.yield_spread, 2)} over the 10-year` } : null,
        ok(R.pti_years) ? { k: 'Price to income', v: U.num(R.pti_years, 1, '×'), s: esc(R.inc_basis || '') } : null,
        ok(R.wage_m2) ? { k: 'A year of income buys', v: U.num(R.wage_m2, 1, ' m²'), s: `${esc(R.inc_basis || '')} · ${R.wage_m2_year}` + (ok(R.price_psm) ? ` · ${fmt.money(R.price_psm, cur)}/m² (${R.price_psm_year})` : '') } : null,
      ]) +
      (vk && has(vk.prem) ? `<div class="g g2">${U.panel('Premium to country', `% from its own mean · lines at ±1 and ±2 standard deviations (${fmt.fx(vk.prem_sd, 1)} pts)`, '<div class="chart" id="cy-p"></div>')}
        ${U.panel('Real price and trend', 'index, latest = 100', '<div class="chart" id="cy-t"></div>')}</div>` : '') +
      cityLend(R, CR, v) +
      `<div id="cy-x"></div><div id="cy-d"></div><div id="cy-m"></div>` +
      (R.long_used ? `<p class="note">The current series is too short to value on its own, so the premium, trend and changes above use the city's longer published history: ${esc(R.long_used)}.</p>` : '') +
      (R.annual ? `<p class="note caveat"><b>Annual source.</b> This city is published once or twice a year. The quarters between published points lie on a straight line, so one-year changes are real but volatility, beta and the premium z-score are smoother than a quarterly series would give.</p>` : '') +
      (m.caveat ? `<p class="note caveat"><b>Read with care:</b> ${esc(m.caveat)}</p>` : '') + (s && s.notes ? `<p class="note">${esc(s.notes)}</p>` : '');
    const p = REI.pal();
    if (vk && has(vk.prem)) {
      const sd = vk.prem_sd;
      C.lines('cy-p', [{ x: vk.q, y: vk.prem }], { suffix: '%', zero: true, hlines: ok(sd) ? [{ y: sd, text: '+1 sd' }, { y: -sd, text: '−1 sd' }, { y: 2 * sd, text: '+2 sd', dash: 'dash' }, { y: -2 * sd, text: '−2 sd', dash: 'dash' }] : [] });
      C.lines('cy-t', [{ x: vk.q, y: vk.real, name: 'Real price' }, { x: vk.q, y: vk.trend, name: 'Trend', color: p.neutral, dash: 'dash', width: 1.5 }], {});
    }
    if (s) (sold ? soldBlocks : indexBlocks)(U.$('cy-x'), key, s);
    districts(U.$('cy-d'), key, vk, s, cur, v.params.micro_min_weight);
    cityMaps(U.$('cy-m'), key, R, v, vk, nm, sold);
    setAttr(s ? s.attribution : '');
  });

  /* What the country's lending rate makes of the city's published price, rent and income levels, and where the price
     stands against its own peak. */
  function cityLend(R, CR, v) {
    const P = v.params, tile = (kk, val, s) => `<div><div class="k">${kk}</div><div class="v">${val}</div><div class="s">${s}</div></div>`;
    const loan = `${Math.round((P.ltv || 0.8) * 100)}% loan over ${P.term_years} years at ${fmt.fx(CR.lend, 2)}%`;
    const tiles = [
      ok(R.pay_share) ? tile('Mortgage payment to income', `${fmt.fx(R.pay_share, 0)}%`, `${loan} · ${esc(R.inc_basis || 'published income')}`) : '',
      ok(R.own_rent) ? tile('Owning against renting', `${fmt.fx(R.own_rent, 2)}×`, `the same payment over the annual rent · above 1 the loan costs more than renting`) : '',
      ok(R.carry) ? tile('Yield less lending rate', `${fmt.sg(R.carry, 2)} <small>pts</small>`, `gross yield ${fmt.fx(R.yield, 2)}% against a lending rate of ${fmt.fx(CR.lend, 2)}%`) : '',
      ok(R.uw_q) ? tile(R.peak_real ? 'Real price peak' : 'Price peak', R.uw_q === 0 ? 'Now' : esc(fmt.qtr(R.peak)), R.uw_q === 0 ? 'the index is at its highest' : `${fmt.fx(R.uw_q / 4, 1)} years ago · ${fmt.pct(R.peak_real && ok(R.real_dd) ? R.real_dd : R.dd, 1)} from it${ok(R.up8) ? ` · rose in ${R.up8} of the last 8 quarters` : ''}`) : '',
    ].filter(Boolean);
    return tiles.length ? U.panel('At today\'s lending rate, and against the peak', ok(R.pay_share) || ok(R.own_rent) ? 'compare cities inside one country: income and rent definitions differ across countries' : '', `<div class="ev">${tiles.join('')}</div>`) : '';
  }

  /* Maps for a city page. Sold-record cities already draw hexagons from their own sales. Index-only cities get their
     districts as points where a gazetteer places them (US ZIP codes), and every city gets a map of where it sits among
     the other covered cities of its country, on the same colour scale as the Cities page. */
  async function cityMaps(host, key, R, v, vk, nm, sold) {
    const geo = sold || !R.pts ? null : await REI.areaPoints(key);
    const D = ((vk && vk.districts) || []).filter(d => geo && geo.pts[d.code]);
    const peers = v.cities.filter(c => c.country === R.country && ok(c.lat) && !c.stale);
    const here = ok(R.lat) && !peers.some(c => c.key === key) ? peers.concat([R]) : peers;
    const p0 = here.some(c => ok(c.gap)) ? 'gap' : 'real';
    const DM = { z: { label: 'Relative value z', kind: 'value', span: 2.5, unit: '', get: d => d.z, txt: d => `relative value z ${fmt.sg(d.z, 2)}` },
      mom: { label: '1-year change', kind: 'change', span: 10, get: d => d.mom, txt: d => `1 year ${fmt.pct(d.mom)}` },
      rel: { label: '1 year against the city', kind: 'change', span: 6, unit: ' pts', get: d => d.rel_mom, txt: d => `${fmt.sg(d.rel_mom, 1)} pts against the city` } };
    host.innerHTML = (D.length ? `<section class="pnl"><div class="pnl-h"><h2>District map</h2><span class="hs">${D.length} districts · ${esc(geo.basis)} · click a district</span></div>
        <div class="map-ctl">${U.seg('cm-dm', Object.entries(DM).map(([k, m]) => [k, m.label]), 'z')}<span class="legend" id="cm-dl"></span></div><div class="map" id="cm-d"></div></section>` : '') +
      (here.length ? `<section class="pnl"><div class="pnl-h"><h2>${here.length > 1 ? `${esc(R.name)} and the other covered cities: ${esc(nm[R.country] || R.country)}` : 'Location'}</h2><span class="hs">${here.length > 1 ? `${here.length} covered cities · this city ringed · click a city` : 'the only covered city in this country'}</span></div>
        <div class="map-ctl">${U.seg('cm-pm', Object.entries(V.MAPM).map(([k, m]) => [k, m.label]), p0)}<span class="legend" id="cm-pl"></span></div><div class="map" id="cm-p"></div></section>` : '');
    if (D.length) {
      const dp = k => D.map(d => ({ lat: geo.pts[d.code][0], lon: geo.pts[d.code][1], v: ok(DM[k].get(d)) && !d.noisy ? DM[k].get(d) : null, href: `#/area/${key}/${encodeURIComponent(d.code)}`,
        tip: `<b>${esc(d.name || d.code)}</b><br>${ok(DM[k].get(d)) ? esc(DM[k].txt(d)) : 'no reading'}${d.noisy ? ' · thin' : ''}` }));
      const dopt = k => ({ kind: DM[k].kind, span: DM[k].span, unit: DM[k].unit, label: DM[k].label, legend: U.$('cm-dl'), maxZoom: 12, radius: 0.9 });
      const dm = REI.map.points('cm-d', dp('z'), dopt('z'));
      U.onSeg('cm-dm', x => { if (dm) dm.set(dp(x), dopt(x), false); });
    }
    if (here.length) {
      const po = k => { const m = V.MAPM[k]; return { kind: m.kind, span: m.span, unit: m.unit, label: m.label, legend: U.$('cm-pl'), maxZoom: 8, zoom: 7 }; };
      const pm = REI.map.points('cm-p', V.cityPts(here, p0, null, key), po(p0));
      U.onSeg('cm-pm', x => { if (pm) pm.set(V.cityPts(here, x, null, key), po(x), false); });
    }
  }

  /* District valuation: scatter of relative value against relative momentum, and the table, filtered by level. */
  function districts(host, key, vk, s, cur, minw) {
    const D = (vk && vk.districts) || [];
    if (!D.length) {
      if (!(s && s.areas && s.areas.length && s.tier !== 'B')) return;
      const top = s.levels[0];
      host.innerHTML = U.panel(`${top.name}s`, 'medians mix dwelling types; the index column is the quality-controlled repeat-sales measure', '<div id="cd-t"></div>', { flush: true });
      U.table('cd-t', { id: 'areas:' + key, sort: 'n12', dir: -1, limit: 60, rows: s.areas.filter(a => a.level === top.key), cols: [
        { k: 'name', h: top.name, l: 1, f: a => `<a href="#/area/${key}/${encodeURIComponent(a.code)}">${esc(a.name)}</a>` }, { k: 'n12', h: 'Sales 12m', f: a => fmt.num(a.n12) },
        { k: 'med12', h: 'Median 12m', f: a => fmt.money(a.med12, cur) }, ...(s.has_area ? [{ k: 'psm12', h: 'Per m²', f: a => (ok(a.psm12) ? fmt.money(a.psm12, cur) : '<span class="mute">–</span>') }] : []),
        { k: 'med12_chg', h: 'Median vs prior 12m', f: a => U.chg(a.med12_chg) }, { k: 'idx_m12', h: 'Index 12m', f: a => U.chg(a.idx_m12) }] });
      return;
    }
    const lvNames = Object.fromEntries(((s && s.levels) || []).map(l => [l.key, l.name]));
    const levels = [...new Set(D.map(d => d.level))];
    const st = U.st('dist:' + key, { level: levels[0], q: '' });
    if (!levels.includes(st.level)) st.level = levels[0];
    const plural = n => (/[^aeiou]y$/.test(n) ? n.slice(0, -1) + 'ies' : /s$/.test(n) ? n : n + 's');
    host.innerHTML = U.panel('Districts against the city', 'relative value z (district price over city price, against its own mean) across; 1-year change less the city\'s up · click a district', '<div class="chart tall" id="cd-s"></div>') +
      `<section class="pnl"><div class="ctl">${levels.length > 1 ? U.seg('cd-lv', levels.map(l => [l, plural(lvNames[l] || l)]), st.level) : ''}${U.search('cd-q', 'Filter districts', st.q)}<span class="count" id="cd-n"></span></div><div id="cd-t"></div></section>
      <p class="note">Level = median price${D.some(d => ok(d.psm)) ? ' (or price per m²)' : ''} against the city's sales-weighted median at the same level. Own-data weight: the share of the district's index that comes from its own sales rather than its parent's; districts tagged <i>thin</i> fall below ${Math.round(100 * (minw || 0.3))}% or are too noisy to rank. Relative value has not predicted district returns in the record (<a href="#/evidence">evidence</a>).</p>`;
    const rows = () => D.filter(d => d.level === st.level && V.match(d, st.q));
    const ann = D.some(d => d.annual);
    const cols = [{ k: 'name', h: 'District', l: 1, f: d => `<a href="#/area/${key}/${encodeURIComponent(d.code)}">${esc(d.name || d.code)}</a>${d.noisy ? V.tag('thin') : ''}${d.parent ? `<span class="sub">${esc(d.parent)}</span>` : ''}` },
      { k: 'z', h: 'Relative value z', f: d => U.zBar(d.z) }, { k: 'rv', h: 'vs own mean', f: d => U.sgn(d.rv, 0, '%') }, { k: 'pct', h: 'Pctile', f: d => U.num(d.pct, 0) },
      { k: 'mom', h: '1y', f: d => U.chg(d.mom) }, { k: 'rel_mom', h: 'vs city', f: d => U.chg(d.rel_mom, 1, '') }, { k: 'dd', h: 'From peak', f: d => U.chg(d.dd) },
      { k: 'lvl', h: 'Level vs city', f: d => U.sgn(d.lvl, 0, '%'), t: 'Price level against the city median at this level' },
      { k: 'med', h: 'Median', f: d => (ok(d.med) ? fmt.moneyK(d.med, cur) : '<span class="mute">–</span>') }, { k: 'psm', h: 'Per m²', f: d => (ok(d.psm) ? fmt.money(d.psm, cur) : '<span class="mute">–</span>') },
      { k: 'n12', h: 'Sales 12m', f: d => (ok(d.n12) ? fmt.num(d.n12) : '<span class="mute">–</span>') }, { k: 'w', h: 'Own weight', f: d => (ok(d.w) ? fmt.fx(100 * d.w, 0) + '%' : '<span class="mute">–</span>') }]
      .filter(c => (c.k !== 'psm' || D.some(d => ok(d.psm))) && (c.k !== 'n12' || D.some(d => ok(d.n12))) && (c.k !== 'w' || D.some(d => ok(d.w))));
    const t = U.table('cd-t', { id: 'dist:' + key, cols, rows: rows(), sort: 'z', dir: -1, limit: 60, rowCls: d => (d.noisy ? 'stale' : '') });
    const p = REI.pal();
    const sc = () => C.scatter('cd-s', rows().filter(d => !d.noisy).map(d => ({ x: d.z, y: d.rel_mom, label: d.name, tip: d.name, href: `#/area/${key}/${encodeURIComponent(d.code)}`, color: d.z >= 0 ? p.rich : p.cheap })),
      { x: 'Relative value z', y: '1y vs city', ys: ' pts', height: 380, xrange: [-4, 4], corners: ['cheap vs own history, outperforming', 'rich, outperforming', 'cheap, lagging', 'rich, lagging'] });
    const redraw = (scat) => { const x = rows(); t.update(x); U.$('cd-n').textContent = `${x.length} ${plural((lvNames[st.level] || st.level).toLowerCase())}${ann ? ' · some annual series' : ''}`; if (scat) sc(); };
    U.onSeg('cd-lv', x => { st.level = x; redraw(true); }); U.onInput('cd-q', x => { st.q = x; redraw(false); }); redraw(true);
  }

  // ------------------------------------------------------------------------------------------ sold-record city blocks
  function soldBlocks(host, key, s) {
    const ch = s.changes || {};
    host.innerHTML = U.kpis([['1 month', ch.m1], ['3 months', ch.m3], ['12 months', ch.m12], ['5 years', ch.y5], ['10 years', ch.y10]].map(([k, x]) => ({ k: `Index, ${k}`, v: U.chg(x), s: 'to the last complete month' }))
        .concat([{ k: 'Sales, 12 months', v: fmt.num(s.counts.sales_12m), s: `${fmt.num(s.counts.sales_total)} since ${s.index.period[0].slice(0, 4)}` }, { k: 'Repeat-sale pairs', v: fmt.num(s.counts.pairs), s: `${fmt.num(s.counts.properties)} dwellings` }])) +
      `<div class="g g2">${U.panel('Repeat-sales index', `nominal, ${esc(fmt.month(s.base_period))} = 100, ±1.96 standard errors shaded`, '<div class="chart" id="sb-i"></div>')}${U.panel('Sales and median price', 'monthly; lighter bars are still filling', '<div class="chart" id="sb-v"></div>')}</div>
      <section class="pnl"><div class="pnl-h"><h2>Map</h2><span class="hs">H3 hexagons; resolution follows zoom</span></div>
        <div class="map-ctl">${U.seg('sb-m', [['med12', 'Median price'], ...(s.has_area ? [['psm12', 'Per m²']] : []), ['chg', '12m median change'], ['n12', 'Sales']], 'med12')}<span class="legend" id="legend"></span></div><div id="map" class="map"></div></section>
      <div id="sb-tiers"></div><div id="sb-liq"></div>`;
    C.index('sb-i', s.index, s.provisional_from, { base: fmt.month(s.base_period), name: s.name });
    C.volume('sb-v', s.volume, s.currency, s.provisional_from);
    REI.map.mount('map', key, s, { legend: U.$('legend') }).then(mp => U.onSeg('sb-m', x => mp.setMetric(x)))
      .catch(() => { const e = U.$('map'); if (e) e.innerHTML = '<p class="empty">Neighbourhood layers for this city are not published yet.</p>'; });
    REI.getJSON(`cities/${key}/tiers.json`).then(T => tiers(U.$('sb-tiers'), s, T)).catch(() => {});
    REI.getJSON(`cities/${key}/liquidity.json`).then(L => liquidity(U.$('sb-liq'), L)).catch(() => {});
  }
  const TN = { low: 'Low tier (bottom third)', mid: 'Middle tier', high: 'High tier (top third)', flat: 'Flats', house: 'Houses', new: 'New build', existing: 'Existing' };
  const TT = { tier: 'Price tiers', ptype: 'Flats and houses', new: 'New build and existing' };
  function tiers(host, s, T) {
    const kinds = Object.keys(T).filter(k => T[k] && Object.keys(T[k]).length);
    if (!host || !kinds.length) return;
    host.innerHTML = `<div class="g ${kinds.length > 1 ? 'g' + Math.min(kinds.length, 3) : ''}">${kinds.map(k => U.panel(TT[k] || k, Object.entries(T[k]).map(([g, x]) => `${TN[g] || g} ${fmt.pct(x.changes && x.changes.m12)}`).join(' · ') + ' over 12m', `<div class="chart" id="tr-${k}"></div>`)).join('')}</div>
      <p class="note">Tiers follow the first-sale price against trailing 12-month tertile breakpoints, so a dwelling does not change tier because of its own return. Each line is a separate repeat-sales fit on its subset of pairs.</p>`;
    const p = REI.pal();
    for (const k of kinds) C.index(`tr-${k}`, { period: s.index.period, value: s.index.value, se: [] }, null,
      { base: fmt.month(s.base_period), name: `${s.name}, all`, color: p.neutral, compare: Object.entries(T[k]).slice(0, 3).map(([g, x], i) => ({ period: x.period, value: x.value, name: TN[g] || g, color: p.cat[i] })) });
  }
  function liquidity(host, L) {
    if (!host || !L) return;
    const so = L.seller_outcomes, co = L.cohorts, hp = L.holding_periods, p = REI.pal();
    host.innerHTML = `<div class="g g2">${U.panel('Seller outcomes by year of sale', 'from repeat-sale pairs; the last year is provisional', '<div class="chart tall" id="lq-1"></div>')}
      ${U.panel('Realised return by year of purchase', 'median annualised, dwellings since resold', '<div class="chart tall" id="lq-2"></div>')}</div>
      ${hp ? U.panel('Holding period at resale', 'share of resales, %', '<div class="chart" id="lq-3"></div>') : ''}
      <p class="note">Recent purchase cohorts have short, selected holding periods: only the dwellings already resold are counted.</p>`;
    const yr = { type: 'linear', dtick: 2, hoverformat: 'd' };
    if (so) C.stacked('lq-1', [{ x: so.sale_year, y: so.median_gross_pct, type: 'bar', name: 'Median gross gain', marker: { color: REI.rgba(p.neutral, 0.75) }, hovertemplate: '%{y:.1f}%<extra>Median gross gain</extra>' }],
      [{ x: so.sale_year, y: so.loss_share_pct, type: 'scatter', mode: 'lines+markers', marker: { size: 5 }, name: 'Sold below purchase price', line: { color: p.cat[0], width: 2 }, hovertemplate: '%{y:.1f}%<extra>Sold at a loss</extra>' },
        { x: so.sale_year, y: so.flip_share_pct, type: 'scatter', mode: 'lines+markers', marker: { size: 5 }, name: 'Resold within 2 years', line: { color: p.cat[1], width: 2 }, hovertemplate: '%{y:.1f}%<extra>Resold within 2y</extra>' }],
      'Gross gain, %', 'Share of resales, %', { xaxis: yr, layout: { height: 420 } });
    if (co) C.stacked('lq-2', [{ x: co.buy_year, y: co.median_annual_pct, type: 'bar', name: 'Median annualised return', marker: { color: co.median_annual_pct.map(x => (x >= 0 ? p.up : p.down)) }, hovertemplate: '%{y:.1f}% a year<extra></extra>' }],
      [{ x: co.buy_year, y: co.loss_share_pct, type: 'scatter', mode: 'lines', name: 'Share sold at a loss', line: { color: p.ink, width: 1.8 }, hovertemplate: '%{y:.1f}%<extra>Sold at a loss</extra>' }],
      'Annualised, %', 'Loss share, %', { xaxis: yr, layout: { height: 420, showlegend: false } });
    if (hp) {
      const n = hp.bins.length, rmp = C.ramp(n);
      C.plot('lq-3', hp.bins.map((b, j) => ({ x: hp.sale_year, y: hp.share.map(row => 100 * row[j]), type: 'bar', name: b, marker: { color: rmp[j], line: { color: p.panel, width: 1 } }, hovertemplate: `%{y:.1f}%<extra>${esc(b)}</extra>` })),
        { barmode: 'stack', showlegend: true, height: 320, hovermode: 'x unified', xaxis: yr, yaxis: { ticksuffix: '%', range: [0, 100] } });
    }
  }

  // ------------------------------------------------------------------------------------------ index-only city blocks
  function indexBlocks(host, key, s) {
    const am = s.area_metric || { key: 'idx_value', label: 'Index', change_key: 'idx_m12', change_label: '12m change', format: 'number' };
    const lv = (s.levels || [])[0] || { key: null, name: 'Area' };
    const fm = x => (!ok(x) ? '<span class="mute">–</span>' : am.format === 'money' ? fmt.money(x, s.currency) : am.key === 'psm12' ? '$' + Math.round(x).toLocaleString('en-US') : fmt.fx(x, 1));
    const ch = s.changes || {};
    const areas = (s.areas || []).filter(a => !a.level || a.level === lv.key);
    const per = s.freq === 'M' ? 'month' : 'quarter';
    host.innerHTML = U.kpis([['1 month', ch.m1], ['3 months', ch.m3], ['12 months', ch.m12], ['5 years', ch.y5], ['10 years', ch.y10]].filter(([k, x]) => x !== undefined && !(k === '1 month' && x == null))
        .map(([k, x]) => ({ k: `Index, ${k}`, v: U.chg(x), s: `to the latest ${per}` }))) +
      `<div class="g g2">${U.panel(`${s.name}: published index`, `nominal, ${esc(fmt.month(s.base_period))} = 100`, '<div class="chart" id="ib-i"></div>')}
        ${U.panel(s.rent ? 'Asking rent, fixed-weight index' : `${s.name} against its ${areas.length > 1 ? 'areas' : 'comparators'}`, 'rebased', '<div class="chart" id="ib-c"></div>')}</div>
      ${areas.length ? U.panel(`${lv.name}: latest`, esc(am.label), '<div id="ib-t"></div>', { flush: true }) : ''}
      ${s.volume ? U.panel('Deeds registered per month', esc(s.volume.basis || 'counts only: the register publishes no prices'), '<div class="chart" id="ib-v"></div>') : ''}
      ${s.long_index ? U.panel(`Long history (${esc(fmt.month(s.long_index.base_period))} = 100)`, esc(s.long_index.basis || ''), '<div class="chart" id="ib-l"></div>') : ''}
      <p class="note">${s.key === 'buenos_aires' ? 'Asking prices from listings, not sold prices: there is no open deed-level register for Buenos Aires. Prices are in US dollars; rents in pesos under high inflation, so the rent index is nominal.' : 'A published index, not a register of sales: no sold records and no map for this city.'}</p>`;
    const idx = { period: s.index.period, value: s.index.value, se: [] };
    C.index('ib-i', idx, null, { base: fmt.month(s.base_period), name: s.name });
    if (s.rent) C.index('ib-c', { period: s.rent.period, value: s.rent.value, se: [] }, null, { base: fmt.month(s.rent.period[0]), name: 'Asking rent' });
    else Promise.all(areas.filter(a => a.name !== s.name).slice(0, 3).map(a => REI.area(key, a.code).catch(() => null))).then(as => {
      const p = REI.pal();
      C.index('ib-c', idx, null, { base: fmt.month(s.base_period), name: s.name, compare: as.filter(a => a && a.index).map((a, i) => ({ period: a.index.period, value: a.index.value, name: a.name, color: p.cat[i] })) });
    });
    if (areas.length) U.table('ib-t', { id: 'ib:' + key, sort: am.key, dir: -1, limit: 50, rows: areas, cols: [
      { k: 'name', h: lv.name, l: 1, f: a => `<a href="#/area/${key}/${encodeURIComponent(a.code)}">${esc(a.name)}</a>${a.parent ? `<span class="sub">${esc(a.parent)}</span>` : ''}` },
      { k: am.key, h: esc(am.label), f: a => fm(a[am.key]) }, { k: am.change_key, h: esc(am.change_label), f: a => U.chg(a[am.change_key]) }] });
    if (s.volume) C.volume('ib-v', s.volume, s.currency, null);
    if (s.long_index) C.index('ib-l', { period: s.long_index.period, value: s.long_index.value, se: [] }, null, { base: fmt.month(s.long_index.base_period), name: s.name });
  }
})();
