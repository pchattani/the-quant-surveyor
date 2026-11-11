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
  const cl = c => `<a href="#/country/${c.iso2}">${esc(c.name)}</a>${c.basis === 'trend' ? tag('trend') : ''}${c.stale ? tag('stale') : ''}`;
  const kl = (c, names) => `<a href="#/city/${c.key}">${esc(c.name)}</a>${c.stale ? tag('stale') : ''}<span class="sub">${esc((names && names[c.country]) || c.country)}${c.tier && c.tier !== 'B' ? ' · sold records' : ''}</span>`;
  const names = v => Object.fromEntries(v.countries.map(c => [c.iso2, c.name]));
  const REG = { 'rich & rising': 'Rich, rising', 'rich & falling': 'Rich, falling', 'cheap & rising': 'Cheap, rising', 'cheap & falling': 'Cheap, falling' };
  const regime = q => (q ? esc(REG[q] || q) : '<span class="mute">–</span>');
  const through = r => `<span class="${r.stale ? 'mute' : ''}">${esc(fmt.qtr(r.through))}</span>`;
  const gapCls = v => (!ok(v) ? '' : v > 0 ? 'rich' : v < 0 ? 'cheap' : '');
  const regions = rows => [...new Set(rows.map(r => r.region).filter(Boolean))].sort();
  const opt = (all, list) => [['', all]].concat(list.map(x => (Array.isArray(x) ? x : [x, x])));
  /* text filter over a row's name and key */
  const match = (r, q) => !q || (r.name + ' ' + (r.key || r.iso2 || '') + ' ' + (r.country || '')).toLowerCase().includes(q.toLowerCase());
  return { trim, tag, cl, kl, names, regime, through, gapCls, regions, opt, match };
})();

(function () {
  const { fmt, esc, ok } = REI, U = REI.ui, C = REI.charts, V = REI.vu;

  REI.redirect('/screen', '/cities');
  REI.redirect('/health', '/cycle');
  REI.redirect('/macro', '/cycle');
  REI.redirect('/xsection', '/returns');
  REI.redirect('/country', '/countries');

  REI.route('/', async app => {
    const v = await REI.val();
    const w = v.world, k = v.kpis, T = V.trim(w), i = T.last, nm = V.names(v);
    const ratio = v.countries.filter(c => c.basis === 'ratios' && !c.stale && ok(c.gap));
    const trend = v.countries.filter(c => c.basis !== 'ratios');
    const lastOf = a => { for (let j = Math.min(i, a.length - 1); j >= 0; j--) if (ok(a[j])) return a[j]; return null; };
    const tail = a => T.cut(a).slice(-60);

    app.innerHTML = U.head('Global residential valuation',
      `Where housing is rich or cheap against income, rents and financing cost, and which way prices are moving. ${k.countries} countries, ${k.cities} cities, ${k.districts.toLocaleString('en-GB')} districts.`,
      `${U.badge('World series through ' + fmt.qtr(T.q))}<br>${k.countries_ratio} countries on valuation ratios, ${k.countries - k.countries_ratio} on trend only`) +
      U.kpis([
        { k: 'Median country gap', v: U.sgn(w.gap_median[i], 1, '%'), cls: V.gapCls(w.gap_median[i]), sp: U.spark(tail(w.gap_median)),
          s: `Middle half ${fmt.pct(w.gap_q25[i], 0)} to ${fmt.pct(w.gap_q75[i], 0)} · ${w.n[i]} countries`, t: 'Median fair-value gap across countries on the ratio basis. Positive = prices above what income, rents and mortgage cost have supported in that country\'s own history.' },
        { k: 'Rich, gap > +10%', v: U.num(w.share_rich[i], 0, '%'), sp: U.spark(tail(w.share_rich)), s: 'share of countries' },
        { k: 'Cheap, gap < −10%', v: U.num(w.share_cheap[i], 0, '%'), sp: U.spark(tail(w.share_cheap)), s: 'share of countries' },
        { k: 'Countries falling', v: U.num(w.share_falling[i], 0, '%'), sp: U.spark(tail(w.share_falling)), s: 'real prices down over a year' },
        { k: 'Cities falling', v: U.num(k.city_share_falling, 0, '%'), s: `of ${k.cities} cities, real 1-year change` },
        { k: 'Median policy rate', v: U.num(lastOf(w.policy_median), 2, '%'), sp: U.spark(tail(w.policy_median)), s: `median real 10-year yield ${fmt.fx(lastOf(w.real_long_median), 2)}%` },
      ]) +
      `<div class="g g32">${U.panel('Fair-value gap by country', 'blue = cheap, amber = rich, grey = trend basis only · click a country', '<div class="chart tall" id="ov-map"></div>', { flush: true })}
        ${U.panel('Value against momentum', 'gap (%) across, real 1-year price change (%) up', '<div class="chart tall" id="ov-sc"></div>')}</div>
      <div class="g g2">${U.panel('The gap through time', 'median country and the middle half of countries', '<div class="chart" id="ov-gap"></div>')}
        ${U.panel('Breadth', 'share of countries, %', '<div class="chart" id="ov-br"></div>')}</div>
      <div class="g g2">${U.panel('Richest countries', 'composite gap, with the range of its measures', '<div id="ov-rich"></div>', { flush: true })}
        ${U.panel('Cheapest countries', 'composite gap, with the range of its measures', '<div id="ov-cheap"></div>', { flush: true })}</div>
      <div class="g g3">${U.panel('Rich and falling cities', 'largest implied gap with real prices down', '<div id="ov-c1"></div>', { flush: true })}
        ${U.panel('Cheapest cities', 'lowest implied gap', '<div id="ov-c2"></div>', { flush: true })}
        ${U.panel('Stretched against own country', 'premium furthest from its own mean', '<div id="ov-c3"></div>', { flush: true })}</div>
      ${U.panel('Does any of this predict prices?', '<a href="#/evidence">full record</a>', `<div class="ev" id="ov-ev"></div>`)}`;

    C.choropleth('ov-map', ratio.map(c => ({ iso3: c.iso3, iso2: c.iso2, name: c.name, v: c.gap, tip: `Gap ${fmt.pct(c.gap)} · real 1y ${fmt.pct(c.real_1y)}` })),
      trend.concat(v.countries.filter(c => c.basis === 'ratios' && c.stale)).filter(c => c.iso3).map(c => ({ iso3: c.iso3, iso2: c.iso2, name: c.name, v: 0, tip: c.stale ? `Data ends ${fmt.qtr(c.through)}` : `Trend gap ${fmt.pct(c.gap)} · no ratio data` })), { height: 420 });
    const p = REI.pal();
    C.scatter('ov-sc', ratio.map(c => ({ x: c.gap, y: c.real_1y, label: c.iso2, tip: c.name, href: `#/country/${c.iso2}`, color: c.gap >= 0 ? p.rich : p.cheap })),
      { x: 'Fair-value gap', y: 'Real 1-year change', xs: '%', ys: '%', height: 420, corners: ['cheap, rising', 'rich, rising', 'cheap, falling', 'rich, falling'] });
    C.lines('ov-gap', [{ x: T.cut(w.q), y: T.cut(w.gap_median), name: 'Median country' }],
      { suffix: '%', zero: true, y: 'Fair-value gap', band: { x: T.cut(w.q), lo: T.cut(w.gap_q25), hi: T.cut(w.gap_q75), name: 'Middle half of countries' } });
    C.lines('ov-br', [{ x: T.cut(w.q), y: T.cut(w.share_rich), name: 'Rich (gap above +10%)', color: p.rich }, { x: T.cut(w.q), y: T.cut(w.share_cheap), name: 'Cheap (gap below −10%)', color: p.cheap },
      { x: T.cut(w.q), y: T.cut(w.share_falling), name: 'Real prices falling', color: p.neutral, dash: 'dot' }], { suffix: '%', fmt: '.0f', range: [0, 100] });

    const ccols = [{ k: 'name', h: 'Country', l: 1, f: V.cl }, { k: 'gap', h: 'Gap', f: r => U.gapBar(r.gap, r.lo, r.hi), t: 'Composite fair-value gap; the whisker spans the lowest to the highest measure' },
      { k: 'pct', h: 'Pctile', f: r => U.num(r.pct, 0), t: 'Where the gap sits in the country\'s own history (100 = richest ever)' }, { k: 'real_1y', h: 'Real 1y', f: r => U.chg(r.real_1y) }];
    const by = (rows, key, dir) => rows.slice().sort((a, b) => (a[key] - b[key]) * dir);
    U.table('ov-rich', { id: 'ov-rich', cols: ccols, rows: by(ratio, 'gap', -1).slice(0, 10), sort: 'gap', dir: -1 });
    U.table('ov-cheap', { id: 'ov-cheap', cols: ccols, rows: by(ratio, 'gap', 1).slice(0, 10), sort: 'gap', dir: 1 });

    const cities = v.cities.filter(c => !c.stale && ok(c.gap) && c.basis === 'ratios');
    const kc = [{ k: 'name', h: 'City', l: 1, f: r => V.kl(r, nm), ns: 1 }, { k: 'gap', h: 'Implied gap', f: r => U.gapBar(r.gap, null, null, { w: 72 }), ns: 1 }, { k: 'real_1y', h: 'Real 1y', f: r => U.chg(ok(r.real_1y) ? r.real_1y : r.mom), ns: 1 }];
    U.table('ov-c1', { id: 'ov-c1', cols: kc, rows: by(cities.filter(c => (ok(c.real_1y) ? c.real_1y : c.mom) < 0), 'gap', -1).slice(0, 8) });
    U.table('ov-c2', { id: 'ov-c2', cols: kc, rows: by(cities, 'gap', 1).slice(0, 8) });
    const kz = [kc[0], { k: 'prem_z', h: 'Premium z', f: r => U.zBar(r.prem_z), ns: 1 }, { k: 'prem', h: 'Premium', f: r => U.sgn(r.prem, 0, '%'), ns: 1, t: 'Real price relative to the country index, against the city\'s own long-run mean' }];
    U.table('ov-c3', { id: 'ov-c3', cols: kz, rows: v.cities.filter(c => !c.stale && ok(c.prem_z)).sort((a, b) => Math.abs(b.prem_z) - Math.abs(a.prem_z)).slice(0, 8) });

    const ev = v.evidence, sig = (grp, key) => (grp.signals.find(s => s.key === key) || { h: {} }).h;
    const cell = (kk, h, s) => `<div><div class="k">${esc(kk)}</div><div class="v">${h ? `IC ${fmt.sg(h.ic, 2)} <small>t ${fmt.fx(h.t, 1)}</small>` : '–'}</div><div class="s">${s}</div></div>`;
    U.$('ov-ev').innerHTML = cell('Country gap, 5 years ahead', sig(ev.country, 'gap')['20'], 'cheap countries did a little better; weak') +
      cell('Country momentum, 1 year ahead', sig(ev.country, 'mom')['4'], 'the strongest signal in the record') +
      cell('City momentum against country, 1 year', sig(ev.city, 'rel_mom')['4'], `${ev.city.cities} cities`) +
      cell('City premium, 5 years ahead', sig(ev.city, 'prem')['20'], 'premiums revert slowly');
  });
})();
