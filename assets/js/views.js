/* Shared view helpers and the Overview. Screens, cycle, returns and evidence live in their own files. */
REI.vu = (function () {
  const { fmt, esc, ok } = REI, U = REI.ui;
  /* The newest quarters hold only the countries that have already published. Charts and headline numbers stop at
     the last quarter with at least 85% of the widest cross-section, so a thin quarter never moves the median. */
  function trim(w) {
    const nmax = Math.max(...w.n);
    let last = w.n.length - 1;
    while (last > 0 && w.n[last] < 0.85 * nmax) last--;
    return { last, q: w.q[last], cut: a => (a || []).slice(0, last + 1) };
  }
  const tag = t => `<span class="tag">${esc(t)}</span>`;
  const valued = c => c.basis === 'model' || c.basis === 'ratios';
  const cl = c => `<a href="#/country/${c.iso2}">${esc(c.name)}</a>${c.basis === 'trend' ? tag('trend') : c.basis === 'ratios' ? tag('four ratios') : ''}${c.fv_unfit && c.basis !== 'model' ? `<span class="tag" title="The model does not fit this market: its gap has only drifted, never closed, so the gap shown rests on the ${c.basis === 'ratios' ? 'four-ratio composite' : 'real price trend'}.">model does not fit</span>` : ''}${c.basis === 'model' && c.fv_tier === 2 ? `<span class="tag" title="Valued on ${esc(c.fv_basis || 'an income proxy')}: no disposable-income series is published in the OECD's tables. Less reliable than the countries without this tag.">proxy income</span>` : ''}${c.stale ? tag('stale') : ''}`;
  const basisShort = c => (c.basis !== 'model' ? (c.basis === 'ratios' ? 'four ratios' : 'trend') : c.fv_tier === 1 ? 'disposable income' : String(c.fv_basis || 'income proxy').replace(/ \(.*\)$/, ''));
  const kl = (c, names) => `<a href="#/city/${c.key}">${esc(c.name)}</a>${c.annual ? tag('annual') : ''}${c.stale ? tag('stale') : ''}<span class="sub">${esc((names && names[c.country]) || c.country)}${c.tier && c.tier !== 'B' ? ' · sold records' : ''}</span>`;
  const names = v => Object.fromEntries(v.countries.map(c => [c.iso2, c.name]));
  const REG = { 'rich & rising': 'Rich, rising', 'rich & falling': 'Rich, falling', 'cheap & rising': 'Cheap, rising', 'cheap & falling': 'Cheap, falling' };
  const regime = q => (q ? esc(REG[q] || q) : '<span class="mute">–</span>');
  const through = r => `<span class="${r.stale ? 'mute' : ''}">${esc(fmt.qtr(r.through))}</span>`;
  const gapCls = v => (!ok(v) ? '' : v > 0 ? 'rich' : v < 0 ? 'cheap' : '');
  const regions = rows => [...new Set(rows.map(r => r.region).filter(Boolean))].sort();
  const opt = (all, list) => [['', all]].concat(list.map(x => (Array.isArray(x) ? x : [x, x])));
  /* text filter over a row's name and key */
  const match = (r, q) => !q || (r.name + ' ' + (r.key || r.iso2 || '') + ' ' + (r.country || '')).toLowerCase().includes(q.toLowerCase());
  /* City map metrics: what colours the points, on which scale. */
  const MAPM = {
    gap: { label: 'Implied gap', kind: 'value', span: 30, get: c => c.gap, txt: c => `implied gap ${fmt.sg(c.gap, 1)}%` },
    real: { label: 'Real 1-year change', kind: 'change', span: 10, get: c => (ok(c.real_1y) ? c.real_1y : c.mom), txt: c => `1 year ${fmt.pct(ok(c.real_1y) ? c.real_1y : c.mom)}${ok(c.real_1y) ? ' real' : ' nominal'}` },
    z: { label: 'Premium z-score', kind: 'value', span: 2.5, unit: '', get: c => c.prem_z, txt: c => `premium z ${fmt.sg(c.prem_z, 2)}` },
    exp: { label: 'Expected 1-year change', kind: 'change', span: 5, get: c => c.exp_1y, txt: c => `expected real change, next year ${fmt.pct(c.exp_1y)}` },
  };
  const cityPts = (rows, m, nm, hl) => rows.filter(c => ok(c.lat) && ok(c.lon)).map(c => ({ lat: c.lat, lon: c.lon, v: ok(MAPM[m].get(c)) ? MAPM[m].get(c) : null, hl: c.key === hl,
    href: `#/city/${c.key}`, tip: `<b>${esc(c.name)}</b>${nm ? ' · ' + esc(nm[c.country] || c.country) : ''}<br>${ok(MAPM[m].get(c)) ? esc(MAPM[m].txt(c)) : 'no reading'}` }));
  /* The strip under the section nav, as on the sister sites: the most stretched country gaps, each a link. */
  function ticker(v) {
    const host = document.getElementById('ticker');
    if (!host) return;
    const rows = v.countries.filter(c => valued(c) && !c.stale && ok(c.gap)).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)).slice(0, 12);
    if (!rows.length) return;
    host.innerHTML = `<div class="ticker-in"><div class="tick-head">Furthest from<br>fair value</div>${rows.map(c =>
      `<a class="tick" href="#/country/${c.iso2}" title="${esc(c.name)}"><span class="code">${esc(c.iso2)}</span><span class="when ${c.gap >= 0 ? 'rich' : 'cheap'}">${fmt.sg(c.gap, 0)}% ${c.gap >= 0 ? 'rich' : 'cheap'}</span><span class="tone">real 1y ${fmt.pct(c.real_1y)} · pctile ${fmt.fx(c.pct, 0)}</span></a>`).join('')}</div>`;
    host.hidden = false;
  }
  return { trim, tag, cl, kl, names, regime, through, gapCls, regions, opt, match, MAPM, cityPts, ticker, valued, basisShort };
})();

(function () {
  const { fmt, esc, ok } = REI, U = REI.ui, C = REI.charts, V = REI.vu;

  REI.redirect('/screen', '/cities');
  REI.redirect('/health', '/cycle');
  REI.redirect('/macro', '/cycle');
  REI.redirect('/xsection', '/returns');
  REI.redirect('/country', '/countries');

  REI.val().then(V.ticker).catch(() => {});

  REI.route('/', async app => {
    const v = await REI.val();
    const w = v.world, k = v.kpis, T = V.trim(w), i = T.last, nm = V.names(v);
    const ratio = v.countries.filter(c => V.valued(c) && !c.stale && ok(c.gap));
    const trend = v.countries.filter(c => !V.valued(c));
    const lastOf = a => { for (let j = Math.min(i, a.length - 1); j >= 0; j--) if (ok(a[j])) return a[j]; return null; };
    const tail = a => T.cut(a).slice(-60);

    app.innerHTML = U.head('Every housing market, against its own history.',
      `Where housing is rich or cheap against what incomes and borrowing costs have supported, and which way prices are moving: ${k.countries} countries, ${k.cities} cities and ${k.districts.toLocaleString('en-GB')} districts, each measured against its own record.`,
      `${U.badge('World series through ' + fmt.qtr(T.q))}<br>${k.countries_model} countries valued by the model (${k.countries_tier2} on proxy income), ${k.countries - k.countries_ratio} on trend or stale`,
      `Global residential valuation · ${k.countries} countries · ${k.cities} cities`, true) +
      U.kpis([
        { k: 'Median country gap', v: U.sgn(w.gap_median[i], 1, '%'), cls: V.gapCls(w.gap_median[i]), sp: U.spark(tail(w.gap_median)),
          s: `Middle half ${fmt.pct(w.gap_q25[i], 0)} to ${fmt.pct(w.gap_q75[i], 0)} · ${w.n[i]} countries`, t: 'Median gap to the fair-value model across the countries it values. Positive = prices above what incomes and borrowing costs have supported. See the Model page.' },
        { k: 'Rich, gap > +10%', v: U.num(w.share_rich[i], 0, '%'), sp: U.spark(tail(w.share_rich)), s: 'share of countries' },
        { k: 'Cheap, gap < −10%', v: U.num(w.share_cheap[i], 0, '%'), sp: U.spark(tail(w.share_cheap)), s: 'share of countries' },
        ok(k.ratio_median) ? { k: 'Four-ratio composite, median', v: U.sgn(k.ratio_median, 1, '%'), cls: V.gapCls(k.ratio_median), s: `${k.ratio_countries} countries · price and payment ratios against their own means`, t: 'The older measure, kept for comparison: the average of price to income, price to rent and the two payment ratios, each against its own long-run mean. It assumes rates feed one for one into prices.' } : null,
        ok(k.ratio_share_rich) ? { k: 'Rich on the four ratios', v: U.num(k.ratio_share_rich, 0, '%'), s: 'composite above +10%' } : null,
        { k: 'Countries falling', v: U.num(w.share_falling[i], 0, '%'), sp: U.spark(tail(w.share_falling)), s: 'real prices down over a year' },
        { k: 'Cities falling', v: U.num(k.city_share_falling, 0, '%'), s: `of ${k.cities} cities, real 1-year change` },
        { k: 'Median policy rate', v: U.num(lastOf(w.policy_median), 2, '%'), sp: U.spark(tail(w.policy_median)), s: `median real 10-year yield ${fmt.fx(lastOf(w.real_long_median), 2)}%` },
      ]) +
      `<div class="g g32">${U.panel('Fair-value gap by country', 'cobalt = cheap, amber = rich, dark slate = trend basis only or stale · click a country', '<div class="chart tall" id="ov-map"></div>', { flush: true })}
        ${U.panel('Value against momentum', 'gap (%) across, real 1-year price change (%) up', '<div class="chart tall" id="ov-sc"></div>')}</div>
      <div class="g g2">${U.panel('The gap through time', 'median country and the middle half of countries', '<div class="chart" id="ov-gap"></div>')}
        ${U.panel('Breadth', 'share of countries, %', '<div class="chart" id="ov-br"></div>')}</div>
      <div class="g g2">${U.panel('Richest countries', 'model gap, with its range across re-estimated slopes', '<div id="ov-rich"></div>', { flush: true })}
        ${U.panel('Cheapest countries', 'model gap, with its range across re-estimated slopes', '<div id="ov-cheap"></div>', { flush: true })}</div>
      <div class="g g3">${U.panel('Rich and falling cities', 'largest implied gap with real prices down', '<div id="ov-c1"></div>', { flush: true })}
        ${U.panel('Cheapest cities', 'lowest implied gap', '<div id="ov-c2"></div>', { flush: true })}
        ${U.panel('Stretched against own country', 'premium furthest from its own mean', '<div id="ov-c3"></div>', { flush: true })}</div>
      ${U.panel('Does any of this predict prices?', '<a href="#/evidence">full record</a> · <a href="#/model">the model</a>', `<div class="ev" id="ov-ev"></div>`)}`;

    C.choropleth('ov-map', ratio.map(c => ({ iso3: c.iso3, iso2: c.iso2, name: c.name, v: c.gap, tip: `Gap ${fmt.pct(c.gap)} · real 1y ${fmt.pct(c.real_1y)}` })),
      trend.concat(v.countries.filter(c => V.valued(c) && c.stale)).filter(c => c.iso3).map(c => ({ iso3: c.iso3, iso2: c.iso2, name: c.name, v: 0, tip: c.stale ? `Data ends ${fmt.qtr(c.through)}` : `Trend gap ${fmt.pct(c.gap)} · no ratio data` })), { height: 420 });
    const p = REI.pal();
    C.scatter('ov-sc', ratio.map(c => ({ x: c.gap, y: c.real_1y, label: c.iso2, tip: c.name, href: `#/country/${c.iso2}`, color: c.gap >= 0 ? p.rich : p.cheap })),
      { x: 'Fair-value gap', y: 'Real 1-year change', xs: '%', ys: '%', height: 420, corners: ['cheap, rising', 'rich, rising', 'cheap, falling', 'rich, falling'] });
    C.lines('ov-gap', [{ x: T.cut(w.q), y: T.cut(w.gap_median), name: 'Median country' }],
      { suffix: '%', zero: true, y: 'Fair-value gap', band: { x: T.cut(w.q), lo: T.cut(w.gap_q25), hi: T.cut(w.gap_q75), name: 'Middle half of countries' } });
    C.lines('ov-br', [{ x: T.cut(w.q), y: T.cut(w.share_rich), name: 'Rich (gap above +10%)', color: p.rich }, { x: T.cut(w.q), y: T.cut(w.share_cheap), name: 'Cheap (gap below −10%)', color: p.cheap },
      { x: T.cut(w.q), y: T.cut(w.share_falling), name: 'Real prices falling', color: p.neutral, dash: 'dot' }], { suffix: '%', fmt: '.0f', range: [0, 100] });

    const ccols = [{ k: 'name', h: 'Country', l: 1, f: V.cl }, { k: 'gap', h: 'Gap', f: r => U.gapBar(r.gap, r.lo, r.hi), t: 'Gap to the fair-value model; the whisker is its range across re-estimated slopes' },
      { k: 'pct', h: 'Pctile', f: r => U.num(r.pct, 0), t: 'Where the gap sits in the country\'s own history (100 = richest ever)' }, { k: 'real_1y', h: 'Real 1y', f: r => U.chg(r.real_1y) }];
    const by = (rows, key, dir) => rows.slice().sort((a, b) => (a[key] - b[key]) * dir);
    U.table('ov-rich', { id: 'ov-rich', cols: ccols, rows: by(ratio, 'gap', -1).slice(0, 10), sort: 'gap', dir: -1 });
    U.table('ov-cheap', { id: 'ov-cheap', cols: ccols, rows: by(ratio, 'gap', 1).slice(0, 10), sort: 'gap', dir: 1 });

    const cities = v.cities.filter(c => !c.stale && ok(c.gap) && V.valued(c));
    const kc = [{ k: 'name', h: 'City', l: 1, f: r => V.kl(r, nm), ns: 1 }, { k: 'gap', h: 'Implied gap', f: r => U.gapBar(r.gap, null, null, { w: 52 }), ns: 1 }, { k: 'real_1y', h: 'Real 1y', f: r => U.chg(ok(r.real_1y) ? r.real_1y : r.mom), ns: 1 }];
    U.table('ov-c1', { id: 'ov-c1', cols: kc, rows: by(cities.filter(c => (ok(c.real_1y) ? c.real_1y : c.mom) < 0), 'gap', -1).slice(0, 8) });
    U.table('ov-c2', { id: 'ov-c2', cols: kc, rows: by(cities, 'gap', 1).slice(0, 8) });
    const kz = [kc[0], { k: 'prem_z', h: 'Premium z', f: r => U.zBar(r.prem_z), ns: 1 }, { k: 'prem', h: 'Premium', f: r => U.sgn(r.prem, 0, '%'), ns: 1, t: 'Real price relative to the country index, against the city\'s own long-run mean' }];
    U.table('ov-c3', { id: 'ov-c3', cols: kz, rows: v.cities.filter(c => !c.stale && ok(c.prem_z)).sort((a, b) => Math.abs(b.prem_z) - Math.abs(a.prem_z)).slice(0, 8) });

    const ev = v.evidence, sig = (grp, key) => (grp.signals.find(s => s.key === key) || { h: {} }).h;
    const cell = (kk, h, s) => `<div><div class="k">${esc(kk)}</div><div class="v">${h ? `IC ${fmt.sg(h.ic, 2)} <small>t ${fmt.fx(h.t, 1)}</small>` : '–'}</div><div class="s">${s}</div></div>`;
    const g5 = sig(ev.country, 'gap')['20'];
    const hd = sig(ev.country, 'head')['20'] || sig(ev.country, 'fv')['20'];
    U.$('ov-ev').innerHTML = (hd ? cell('Fair-value gap, 5 years ahead', hd, `cheap countries did better; the four-ratio composite scored ${g5 ? fmt.sg(g5.ic, 2) : '–'}`)
      : cell('Country gap, 5 years ahead', g5, 'cheap countries did a little better; weak')) +
      cell('Country momentum, 1 year ahead', sig(ev.country, 'mom')['4'], 'the strongest signal in the record') +
      cell('City momentum against country, 1 year', sig(ev.city, 'rel_mom')['4'], `${ev.city.cities} cities`) +
      cell('City premium, 5 years ahead', sig(ev.city, 'prem')['20'], 'premiums revert slowly');
  });
})();
