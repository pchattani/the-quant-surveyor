/* Pages: home (cities), city, area, sold record, methodology. */
(function () {
  const { fmt, esc, route } = REI;

  function banner(s) {
    return `<span class="badge">Data through ${fmt.month(s.data_through)}</span>` +
      (s.provisional_from ? `<span class="badge prov">Provisional from ${fmt.month(s.provisional_from)}</span>` : '') +
      `<span class="badge">Published ${s.as_of}</span>`;
  }
  function tiles(ch, extra = []) {
    const t = [['1 month', ch.m1], ['3 months', ch.m3], ['12 months', ch.m12], ['5 years', ch.y5], ['10 years', ch.y10]]
      .map(([k, v]) => `<div class="tile"><div class="k">${k}</div><div class="v ${v == null ? '' : v >= 0 ? 'up' : 'down'}">${fmt.pct(v)}</div><div class="s">index, to last complete month</div></div>`);
    return `<div class="tiles">${t.join('')}${extra.join('')}</div>`;
  }
  function sortable(table) {
    const ths = table.querySelectorAll('th[data-k]');
    ths.forEach(th => th.addEventListener('click', () => {
      const k = th.dataset.k, tb = table.tBodies[0], rows = [...tb.rows];
      const dir = th.classList.contains('on') && th.dataset.dir !== 'desc' ? 'desc' : 'asc';
      ths.forEach(x => x.classList.remove('on')); th.classList.add('on'); th.dataset.dir = dir;
      rows.sort((a, b) => { const x = parseFloat(a.dataset[k]), y = parseFloat(b.dataset[k]); const xv = isNaN(x) ? a.dataset[k] : x, yv = isNaN(y) ? b.dataset[k] : y; return (xv > yv ? 1 : xv < yv ? -1 : 0) * (dir === 'asc' ? 1 : -1); });
      rows.forEach(r => tb.appendChild(r));
    }));
  }
  function areaTable(cityKey, rows, cur, title, hasArea) {
    const psmTd = r => hasArea ? `<td>${r.psm12 == null ? '–' : fmt.money(r.psm12, cur) + '/m²'}</td>` : '';
    const tr = rows.map(r => `<tr data-name="${esc(r.name)}" data-n12="${r.n12}" data-med12="${r.med12 ?? ''}" data-psm12="${r.psm12 ?? ''}" data-med12_chg="${r.med12_chg ?? ''}" data-idx_m12="${r.idx_m12 ?? ''}">
      <td><a href="#/area/${cityKey}/${encodeURIComponent(r.code)}">${esc(r.name)}</a>${r.name !== r.code && !/^8[0-9a-f]{14}$/.test(r.code) ? ` <span class="mute mono">${esc(r.code)}</span>` : ''}</td>
      <td>${fmt.num(r.n12)}</td><td>${fmt.money(r.med12, cur)}</td>${psmTd(r)}<td class="${fmt.cls(r.med12_chg)}">${fmt.pct(r.med12_chg)}</td><td class="${fmt.cls(r.idx_m12)}">${fmt.pct(r.idx_m12)}</td></tr>`).join('');
    const t = REI.el(`<div class="card"><h2>${esc(title)}</h2><table class="t"><thead><tr><th data-k="name">Area</th><th data-k="n12">Sales 12m</th><th data-k="med12">Median 12m</th>${hasArea ? '<th data-k="psm12">Median per m²</th>' : ''}<th data-k="med12_chg">Median vs prior 12m</th><th data-k="idx_m12">Index 12m</th></tr></thead><tbody>${tr}</tbody></table>
      <p class="note">Median change mixes composition; the index column is the quality-controlled repeat-sales measure (shrunk toward the parent where sales are thin).</p></div>`);
    sortable(t.querySelector('table'));
    return t;
  }

  // ------------------------------------------------------------ home
  route('/cities', async (app) => {
    const cities = await Promise.all(REI.state.meta.cities.map(c => REI.city(c.key)));
    const regions = {};
    for (const s of cities) (regions[s.country] = regions[s.country] || []).push(s);
    const regionOf = k => ((REI.state.meta.cities.find(c => c.key === k) || {}).region) || '';
    app.innerHTML = `<div class="sh"><div class="sh-main"><span class="kicker">Cities · ${cities.length}</span><h2 class="sh-title">Open a city</h2><p class="sh-sub">Sold-price analytics from open registers: repeat-sales indices to postcode district and neighbourhood, sold-record histories, tiers, liquidity and a map. Index-only cities show official or listings-based series.</p></div></div>
      <div class="cities">${cities.slice().sort((a, b) => (regionOf(a.key) + a.country + a.name).localeCompare(regionOf(b.key) + b.country + b.name)).map(s => `<a class="city-card" href="#/city/${s.key}"><div class="n">${esc(s.name)}</div><div class="m">${s.tier === 'A1' ? 'Address-level sold records' : s.tier === 'A2' ? 'Sold records, area-level' : (s.basis && s.basis.startsWith('official') ? 'Index only (official index)' : 'Index only (asking prices)')} · through ${s.tier === 'B' ? s.data_through : fmt.month(s.data_through)}</div>
        <div class="tiles" style="margin:.5rem 0 0"><div class="tile"><div class="k">12m</div><div class="v ${s.changes.m12 >= 0 ? 'up' : 'down'}">${fmt.pct(s.changes.m12)}</div></div><div class="tile"><div class="k">${s.tier === 'B' ? (s.levels[0].name + 's') : 'Sales 12m'}</div><div class="v">${fmt.num(s.tier === 'B' ? s.counts.areas : s.counts.sales_12m)}</div></div></div></a>`).join('')}</div>`;
    document.getElementById('attribution').textContent = cities.map(c => c.attribution).filter(Boolean).join(' ');
  });

  // ------------------------------------------------------------ city (tier B: index-only page)
  const q2m = p => p.replace(/Q(\d)$/, (m, q) => `-${(q * 3).toString().padStart(2, '0')}`);
  function tierB(app, key, s) {
    const am = s.area_metric || { key: 'psm12', label: 'Asking USD/m²', change_key: 'psm12_chg', change_label: 'vs year ago' };
    const fmtMetric = v => v == null ? '–' : am.format === 'money' ? fmt.money(v, s.currency) : am.key === 'psm12' ? '$' + Math.round(v).toLocaleString('en-US') : v.toFixed(1);
    const lv = s.levels[0];
    const plural = n => /[^aeiou]y$/.test(n) ? n.slice(0, -1) + 'ies' : n + 's';
    const rows = s.areas.filter(r => !r.level || r.level === lv.key).sort((a, b) => (b[am.key] || 0) - (a[am.key] || 0));
    const monthly = s.freq === 'M';
    app.innerHTML = `<div class="crumbs"><a href="#/">Cities</a> › ${esc(s.name)}</div>
      <div class="city-head"><h1>${esc(s.name)}</h1><span class="asof"><span class="badge prov">Index-only: ${esc(s.basis)}</span><span class="badge">Data through ${s.data_through}</span><span class="badge">Published ${s.as_of}</span></span></div>
      <div class="tiles">${[['1 month', s.changes.m1], ['3 months', s.changes.m3], ['12 months', s.changes.m12], ['5 years', s.changes.y5], ['10 years', s.changes.y10]].filter(([k, v]) => v !== undefined && !(k === '1 month' && v == null)).map(([k, v]) => `<div class="tile"><div class="k">${k}</div><div class="v ${v == null ? '' : v >= 0 ? 'up' : 'down'}">${fmt.pct(v)}</div><div class="s">${s.freq === 'M' ? 'to latest month' : 'to latest quarter'}</div></div>`).join('')}
        <div class="tile"><div class="k">${esc(plural(lv.name))}</div><div class="v">${lv.count != null ? lv.count : s.counts.areas}</div></div></div>
      <div class="grid2"><div class="card"><h2>${esc(s.name)}: index (${s.base_period} = 100)</h2><div id="c-index" class="chart"></div><p class="note">${esc(s.basis)}</p></div>
        <div class="card"><h2>${s.rent ? 'Asking rent (ARS per month), fixed-weight index' : (plural(lv.name) + ' vs ' + esc(s.name) + ', rebased')}</h2><div id="c-rent" class="chart"></div></div></div>
      <div class="card" style="margin-top:1rem"><h2>${esc(plural(lv.name))}, latest</h2><table class="t"><thead><tr><th>${esc(lv.name)}</th>${rows.some(r => r.parent) ? '<th>Parent</th>' : ''}<th>${esc(am.label)}</th><th>${esc(am.change_label)}</th></tr></thead><tbody>
        ${rows.map(r => `<tr><td><a href="#/area/${key}/${encodeURIComponent(r.code)}">${esc(r.name)}</a></td>${rows.some(x => x.parent) ? `<td>${esc(r.parent || '')}</td>` : ''}<td>${fmtMetric(r[am.key])}</td><td class="${fmt.cls(r[am.change_key])}">${fmt.pct(r[am.change_key])}</td></tr>`).join('')}</tbody></table>
        ${s.notes ? `<p class="note">${esc(s.notes)}</p>` : ''}<p class="note">${s.key === 'buenos_aires' ? 'Asking prices from listings, not sold prices: there is no open deed-level register for Buenos Aires. Prices are quoted in US dollars; rents in pesos under high inflation, so the rent index is nominal.' : 'An official index, not a register of sales: no sold records, no map. See the Methodology page for what an index-only city can and cannot show.'}</p></div>
      ${s.volume ? `<div class="card" style="margin-top:1rem"><h2>Deeds registered per month</h2><div id="c-vol" class="chart"></div><p class="note">${esc(s.volume.basis || '')}. Counts only: the register publishes no prices.</p></div>` : ''}
      ${s.long_index ? `<div class="card" style="margin-top:1rem"><h2>Long history, quarterly (${s.long_index.base_period} = 100)</h2><div id="c-long" class="chart"></div><p class="note">${esc(s.long_index.basis || '')}</p></div>` : ''}`;
    if (s.volume) REI.charts.volume(document.getElementById('c-vol'), s.volume, s.currency, null);
    if (s.long_index) REI.charts.index(document.getElementById('c-long'), { period: s.long_index.period.map(q2m), value: s.long_index.value, se: [] }, null, { base: s.long_index.base_period, name: s.name });
    REI.charts.index(document.getElementById('c-index'), { period: monthly ? s.index.period : s.index.period.map(q2m), value: s.index.value, se: [] }, null, { base: s.base_period, name: s.name });
    if (s.rent) REI.charts.index(document.getElementById('c-rent'), { period: s.rent.period, value: s.rent.value, se: [] }, null, { base: s.rent.period[0], name: 'Asking rent (ARS)' });
    else {
      Promise.all(rows.slice(0, 6).map(r => REI.area(key, r.code).catch(() => null))).then(areas => {
        const cmp = areas.filter(a => a && a.index).map((a, i) => ({ period: monthly ? a.index.period : a.index.period.map(q2m), value: a.index.value, name: a.name, color: ['#3987e5', '#d95926', '#199e70', '#c98500', '#8e9ab0', '#b62324'][i] }));
        REI.charts.index(document.getElementById('c-rent'), { period: monthly ? s.index.period : s.index.period.map(q2m), value: s.index.value, se: [] }, null, { base: s.base_period, name: s.name, compare: cmp });
      });
    }
    document.getElementById('attribution').textContent = s.attribution;
  }

  route('/city/:key', async (app, { key }) => {
    const s = await REI.city(key);
    if (s.tier === 'B') return tierB(app, key, s);
    const top = s.levels[0].key;
    app.innerHTML = `<div class="crumbs"><a href="#/">Cities</a> › ${esc(s.name)}</div>
      <div class="city-head"><h1>${esc(s.name)}</h1><span class="asof">${banner(s)}</span></div>
      ${tiles(s.changes, [`<div class="tile"><div class="k">Sales 12m</div><div class="v">${fmt.num(s.counts.sales_12m)}</div><div class="s">${fmt.num(s.counts.sales_total)} since ${s.index.period[0].slice(0, 4)}</div></div>`,
        `<div class="tile"><div class="k">Repeat-sale pairs</div><div class="v">${fmt.num(s.counts.pairs)}</div><div class="s">${fmt.num(s.counts.properties)} dwellings</div></div>`])}
      <div class="grid2"><div class="card"><h2>Repeat-sales index</h2><div id="c-index" class="chart"></div></div><div class="card"><h2>Volume and median price</h2><div id="c-vol" class="chart"></div></div></div>
      <div class="card" style="margin-top:1rem"><h2>Map</h2><div class="map-ctl"><span>Colour:</span><button data-m="med12" class="on">Median price</button>${s.has_area ? '<button data-m="psm12">Median per m²</button>' : ''}<button data-m="chg">12m median change</button><button data-m="n12">Sales count</button><span class="legend" id="legend"></span></div><div id="map" class="map"></div>
        <p class="note">Hexagons are H3 cells (resolution follows zoom). Zoom in past 13 inside an area page to see individual sales.</p></div>
      <div id="tiers" style="margin-top:1rem"></div>
      <div id="liq" style="margin-top:1rem"></div>
      <div id="tbl" style="margin-top:1rem"></div>`;
    REI.getJSON(`cities/${key}/tiers.json`).then(T => {
      const colors = { low: '#7d93ff', mid: '#7d93ff', high: '#ffb86b', flat: '#7d93ff', house: '#ffb86b', new: '#ffc94d', existing: '#8e9ab0' };
      const names = { low: 'Low tier (bottom third)', mid: 'Middle tier', high: 'High tier (top third)', flat: 'Flats', house: 'Houses', new: 'New build', existing: 'Existing' };
      const blocks = Object.entries(T).map(([kind, groups]) => {
        const id = `t-${kind}`;
        const tiles = Object.entries(groups).map(([g, s]) => `<span class="badge">${names[g] || g}: 12m ${fmt.pct(s.changes.m12)} · 5y ${fmt.pct(s.changes.y5)}</span>`).join('');
        return { id, kind, groups, html: `<div class="card"><h2>${kind === 'tier' ? 'Price tiers' : kind === 'ptype' ? 'Flats vs houses' : 'New build vs existing'}</h2><div>${tiles}</div><div id="${id}" class="chart"></div></div>` };
      });
      document.getElementById('tiers').innerHTML = `<div class="grid2">${blocks.map(b => b.html).join('')}</div><p class="note">Tiers follow the first-sale price against trailing-12-month tertile breakpoints (the Case-Shiller convention), so a dwelling does not change tier because of its own return. Each line is a separate repeat-sales fit on the subset of pairs.</p>`;
      for (const b of blocks) {
        REI.charts.index(document.getElementById(b.id), { period: s.index.period, value: s.index.value, se: [] }, s.provisional_from,
          { base: fmt.month(s.base_period), name: `${s.name} (all)`, compare: Object.entries(b.groups).map(([g, t]) => ({ period: t.period, value: t.value, name: names[g] || g, color: colors[g] })) });
      }
    }).catch(() => {});
    REI.charts.index(document.getElementById('c-index'), s.index, s.provisional_from, { base: fmt.month(s.base_period) });
    REI.charts.volume(document.getElementById('c-vol'), s.volume, s.currency, s.provisional_from);
    REI.getJSON(`cities/${key}/liquidity.json`).then(L => {
      const so = L.seller_outcomes, co = L.cohorts;
      document.getElementById('liq').innerHTML = `<div class="grid2"><div class="card"><h2>Seller outcomes by year of sale</h2><div id="l1" class="chart"></div>
        <p class="note">From repeat-sale pairs: median gross gain on resale, share of resales below the purchase price, and share resold within two years. Last year is provisional.</p></div>
        <div class="card"><h2>Realised return by year of purchase</h2><div id="l2" class="chart"></div><p class="note">Median annualised return on dwellings bought in that year and since resold. Recent cohorts have short, selected holding periods.</p></div></div>
        <div class="card" style="margin-top:1rem"><h2>Holding period at resale</h2><div id="l3" class="chart"></div></div>`;
      const base = { paper_bgcolor: '#0d1526', plot_bgcolor: '#0d1526', font: { color: '#c0c9da', size: 12 }, margin: { l: 56, r: 56, t: 16, b: 40 }, hovermode: 'x unified', xaxis: { gridcolor: '#1a2641' }, yaxis: { gridcolor: '#1a2641' }, legend: { orientation: 'h', y: 1.12 } };
      const cfg = { displayModeBar: false, responsive: true };
      const stacked = (top, bottom) => Object.assign({}, base, { height: 420, yaxis: Object.assign({}, base.yaxis, { domain: [0.56, 1], title: { text: top } }), yaxis2: Object.assign({}, base.yaxis, { domain: [0, 0.44], title: { text: bottom } }), xaxis2: Object.assign({}, base.xaxis, { anchor: 'y2', matches: 'x' }), xaxis: Object.assign({}, base.xaxis, { showticklabels: false }) });
      Plotly.newPlot('l1', [
        { x: so.sale_year, y: so.median_gross_pct, type: 'bar', name: 'Median gross gain %', marker: { color: 'rgba(125,147,255,0.6)' } },
        { x: so.sale_year, y: so.loss_share_pct, type: 'scatter', mode: 'lines+markers', name: 'Sold at a loss %', xaxis: 'x2', yaxis: 'y2', line: { color: '#ff6a4d' } },
        { x: so.sale_year, y: so.flip_share_pct, type: 'scatter', mode: 'lines+markers', name: 'Resold within 2y %', xaxis: 'x2', yaxis: 'y2', line: { color: '#ffc94d' } }],
        stacked('Gross gain %', 'Share %'), cfg);
      Plotly.newPlot('l2', [{ x: co.buy_year, y: co.median_annual_pct, type: 'bar', marker: { color: co.median_annual_pct.map(v => v >= 0 ? '#7d93ff' : '#ff6a4d') }, name: 'Median annualised %', hovertemplate: '%{y:.1f}% p.a.<extra></extra>' },
        { x: co.buy_year, y: co.loss_share_pct, type: 'scatter', mode: 'lines', xaxis: 'x2', yaxis: 'y2', name: 'Loss share %', line: { color: '#ff6a4d', width: 1.5 } }],
        stacked('Annualised %', 'Loss share %'), cfg);
      const hp = L.holding_periods, cols = ['#1d4877', '#2e6fa5', '#7d93ff', '#9ecbff', '#c8e1ff', '#ffd27f', '#ffb86b', '#ff6a4d', '#b62324'];
      Plotly.newPlot('l3', hp.bins.map((b, j) => ({ x: hp.sale_year, y: hp.share.map(r => 100 * r[j]), type: 'bar', name: b, marker: { color: cols[j] } })),
        Object.assign({}, base, { barmode: 'stack', yaxis: Object.assign({ title: { text: 'Share of resales %' } }, base.yaxis), legend: { orientation: 'h', y: 1.15 } }), cfg);
    }).catch(() => {});
    document.getElementById('tbl').appendChild(areaTable(key, s.areas.filter(a => a.level === top), s.currency, `${s.levels[0].name}s`, s.has_area));
    if (s.levels[1]) document.getElementById('tbl').appendChild(areaTable(key, s.areas.filter(a => a.level === s.levels[1].key), s.currency, `${s.levels[1].name}s`, s.has_area));
    try {
      const m = await REI.map.mount('map', key, s, { legend: document.getElementById('legend') });
      document.querySelectorAll('.map-ctl button').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('.map-ctl button').forEach(x => x.classList.remove('on')); b.classList.add('on'); m.setMetric(b.dataset.m); }));
    } catch (e) { const mp = document.getElementById('map'); if (mp) mp.innerHTML = '<p class="empty">Neighbourhood layers for this city are not published yet.</p>'; }
    document.getElementById('attribution').textContent = s.attribution;
  });

  // ------------------------------------------------------------ area
  route('/area/:key/:code', async (app, { key, code }) => {
    const s = await REI.city(key);
    let a;
    try { a = await REI.area(key, code); } catch (e) {
      app.innerHTML = `<div class="crumbs"><a href="#/cities">Cities</a> › <a href="#/city/${key}">${esc(s.name)}</a> › ${esc(code)}</div><div class="card"><h2>${esc(code)}</h2><p class="note">Neighbourhood pages for ${esc(s.name)} are built but not yet published to the public data repository. The city page, tiers, liquidity and the dashboard are live.</p></div>`;
      document.getElementById('attribution').textContent = s.attribution; return;
    }
    if (s.tier === 'B') {
      app.innerHTML = `<div class="crumbs"><a href="#/">Cities</a> › <a href="#/city/${key}">${esc(s.name)}</a> › ${esc(a.name)}</div>
        <div class="city-head"><h1>${esc(a.name)}</h1><span class="asof">${a.parent ? `<span class="badge">${esc(a.parent.name)}</span>` : ''}<span class="badge prov">${esc(a.basis || s.basis)}</span></span></div>
        <div class="tiles">${a.psm12 != null ? `<div class="tile"><div class="k">${esc((s.area_metric || {}).label || 'Asking USD/m²')}</div><div class="v">${(s.area_metric || {}).format === 'money' ? fmt.money(a.psm12, s.currency) : '$' + Math.round(a.psm12).toLocaleString('en-US')}</div><div class="s">latest ${s.freq === 'M' ? 'month' : 'quarter'}</div></div>` : ''}
          ${a.changes ? [['12 months', a.changes.m12], ['5 years', a.changes.y5]].map(([k, v]) => `<div class="tile"><div class="k">${k}</div><div class="v ${v == null ? '' : v >= 0 ? 'up' : 'down'}">${fmt.pct(v)}</div></div>`).join('') : ''}</div>
        <div class="card"><h2>${a.psm12 != null ? ((s.area_metric || {}).label || 'Asking price per m²') : 'Index'} vs ${esc(s.name)}, rebased</h2><div id="a-index" class="chart"></div></div>
        ${a.children && a.children.length ? `<div class="card" style="margin-top:1rem"><h2>Within this area</h2><table class="t"><thead><tr><th>Area</th><th>${esc((s.area_metric || {}).label || 'Latest')}</th><th>12m</th></tr></thead><tbody>${a.children.slice().sort((x, y) => (y.idx_m12 || 0) - (x.idx_m12 || 0)).map(c => `<tr><td><a href="#/area/${key}/${encodeURIComponent(c.code)}">${esc(c.name)}</a></td><td>${(s.area_metric || {}).format === 'money' ? fmt.money(c.psm12, s.currency) : (c.idx_value == null ? '–' : c.idx_value.toFixed(1))}</td><td class="${fmt.cls(c.idx_m12)}">${fmt.pct(c.idx_m12)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
      const mon = s.freq === 'M';
      if (a.index) REI.charts.index(document.getElementById('a-index'), { period: mon ? a.index.period : a.index.period.map(q2m), value: a.index.value, se: [] }, null, { base: a.index.period[0], name: a.name, compare: [{ period: mon ? s.index.period : s.index.period.map(q2m), value: s.index.value, name: s.name }] });
      document.getElementById('attribution').textContent = s.attribution;
      return;
    }
    const crumbs = [`<a href="#/">Cities</a>`, `<a href="#/city/${key}">${esc(s.name)}</a>`];
    if (a.parent) crumbs.push(`<a href="#/area/${key}/${encodeURIComponent(a.parent.code)}">${esc(a.parent.name)}</a>`);
    const lvName = (s.levels.find(l => l.key === a.level) || {}).name || a.level;
    const shrink = a.index ? a.index.shrink[a.index.period.indexOf(s.index_through || s.data_through)] : null;
    app.innerHTML = `<div class="crumbs">${crumbs.join(' › ')} › ${esc(a.name)}</div>
      <div class="city-head"><h1>${esc(a.name)}${a.name !== a.code ? ` <span class="mute mono">${esc(a.code)}</span>` : ''}</h1><span class="asof"><span class="badge">${esc(lvName)}</span>${banner(s)}</span></div>
      ${a.changes ? tiles(a.changes, [`<div class="tile"><div class="k">Sales 12m</div><div class="v">${fmt.num(a.n12)}</div><div class="s">median ${fmt.money(a.med12, s.currency)}</div></div>`,
        `<div class="tile"><div class="k">Own-data weight</div><div class="v">${shrink == null ? '–' : (100 * shrink).toFixed(0) + '%'}</div><div class="s">rest borrowed from ${a.parent ? esc(a.parent.name) : 'city'}${a.index && a.index.window > 1 ? ` · ${a.index.window}-month window` : ''}</div></div>`]) : ''}
      <div class="grid2"><div class="card"><h2>Repeat-sales index vs ${esc(s.name)}</h2><div id="a-index" class="chart"></div></div>
        <div class="card"><h2>Map</h2><div class="map-ctl"><span class="legend" id="legend"></span></div><div id="map" class="map" style="height:360px"></div></div></div>
      <div id="children" style="margin-top:1rem"></div>
      <div class="card" style="margin-top:1rem"><h2>Recent sales</h2><div class="list">${a.recent.map(r => `<a class="row" href="#/sold/${key}/${encodeURIComponent(r.sd)}/${r.pk}"><span>${esc(r.a)} <span class="m mono">${esc(r.pc || '')}</span></span><span>${fmt.money(r.p, s.currency)}${r.m2 ? ` <span class="m">${fmt.money(r.p / r.m2, s.currency)}/m² · ${r.m2} m²</span>` : ''} <span class="m">${fmt.ptype(r.t)}${r.n ? ' · new' : ''} · ${r.d}</span></span></a>`).join('')}</div></div>`;
    if (a.index) REI.charts.index(document.getElementById('a-index'), a.index, s.provisional_from, { base: fmt.month(s.base_period), name: a.name, compare: [{ period: s.index.period, value: s.index.value, name: s.name }] });
    if (a.children.length) document.getElementById('children').appendChild(areaTable(key, a.children.map(c => Object.assign({}, c, { med12_chg: null })), s.currency, 'Within this area', s.has_area));
    const pts = a.recent.filter(r => r.lat != null);
    const m = await REI.map.mount('map', key, s, { legend: document.getElementById('legend'), zoom: 12 });
    // an area at the shard level (or just below it) loads its shard's sales for points and bounds
    const dist = a.level === s.shard_level ? a.code : (a.parent && a.parent.level === s.shard_level ? a.parent.code : null);
    if (dist) {
      const rows = await REI.salesDistrict(key, dist);
      const mine = a.level === s.shard_level ? rows : rows.filter(r => a.level === 'sector' ? (r.pc || '').startsWith(a.code) : true);
      const recent = mine.filter(r => r.d >= `${+s.data_through.slice(0, 4) - 3}-01-01`);
      m.addPoints(recent, s.currency);
      const lats = recent.map(r => r.lat).filter(v => v != null), lons = recent.map(r => r.lon).filter(v => v != null);
      if (lats.length) m.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]]);
    } else if (pts.length) {
      m.fitBounds([[Math.min(...pts.map(p => p.lon)), Math.min(...pts.map(p => p.lat))], [Math.max(...pts.map(p => p.lon)), Math.max(...pts.map(p => p.lat))]]);
    }
    document.getElementById('attribution').textContent = s.attribution;
  });

  // ------------------------------------------------------------ sold record (property history)
  route('/sold/:key/:dist/:pk', async (app, { key, dist, pk }) => {
    const s = await REI.city(key);
    const rows = (await REI.salesDistrict(key, dist)).filter(r => r.pk === pk).sort((a, b) => a.d < b.d ? -1 : 1);
    if (!rows.length) throw new Error('No sold records for this property key in this district');
    const last = rows[rows.length - 1];
    const idx = s.index;
    const atIdx = d => { const i = idx.period.indexOf(d.slice(0, 7)); return i >= 0 ? idx.value[i] : null; };
    const lines = rows.map((r, i) => {
      const prev = rows[i - 1];
      let ret = '', ann = '', vsIdx = '';
      if (prev) {
        const g = r.p / prev.p - 1, yrs = (new Date(r.d) - new Date(prev.d)) / 3.15576e10;
        ret = fmt.pct(100 * g); ann = yrs > 0 ? fmt.pct(100 * (Math.pow(1 + g, 1 / yrs) - 1)) + '/yr' : '';
        const i0 = atIdx(prev.d), i1 = atIdx(r.d);
        if (i0 && i1) vsIdx = `index ${fmt.pct(100 * (i1 / i0 - 1))}`;
      }
      return `<div class="hist"><span>${r.d}</span><span>${fmt.ptype(r.t)}${r.n ? ' · new build' : ''} ${fmt.own(r.o) ? '· ' + fmt.own(r.o) : ''}${r.m2 ? ` · ${r.m2} m²` : ''}</span><span class="p">${fmt.money(r.p, s.currency)}${r.m2 ? `<br><span class="mute" style="font-weight:400">${fmt.money(r.p / r.m2, s.currency)}/m²</span>` : ''}</span><span class="r ${fmt.cls(parseFloat(ret))}">${ret} <span class="mute">${ann}</span><br><span class="mute">${vsIdx}</span></span></div>`;
    }).join('');
    const i1 = atIdx(last.d), iNow = idx.value[idx.period.indexOf(s.data_through)];
    const rolled = i1 && iNow ? last.p * iNow / i1 : null;
    app.innerHTML = `<div class="crumbs"><a href="#/">Cities</a> › <a href="#/city/${key}">${esc(s.name)}</a> › <a href="#/area/${key}/${encodeURIComponent(dist)}">${esc(dist)}</a> › Sold record</div>
      <div class="sold-head"><h1>${esc(last.a)}</h1><span class="pc">${esc(last.pc || '')}</span><span class="asof">${banner(s)}</span></div>
      <div class="tiles"><div class="tile"><div class="k">Last sold</div><div class="v">${fmt.money(last.p, s.currency)}</div><div class="s">${last.d}</div></div>
        <div class="tile"><div class="k">Index-implied value today</div><div class="v">${rolled ? fmt.money(rolled, s.currency) : '–'}</div><div class="s">last price × ${esc(s.name)} index since sale; not a valuation</div></div>
        <div class="tile"><div class="k">Sales on record</div><div class="v">${rows.length}</div><div class="s">since ${rows[0].d.slice(0, 4)}</div></div></div>
      <div class="card"><h2>Sold history</h2><div class="hist head"><span>Date</span><span>Type</span><span class="p">Price</span><span class="r">Change</span></div>${lines}
        <p class="note">${s.key === 'singapore' ? 'HDB publishes no unit numbers, so records are grouped by block, street, storey band, flat type and floor area: a "dwelling" here is a unit type within a block band, and consecutive sales may be different but near-identical flats.' : 'Records paired by normalised address from the register; a changed address format can split one dwelling into two keys.'} The index-implied value rolls the last price forward by the city repeat-sales index and carries that index's uncertainty plus the dwelling's own idiosyncratic risk (roughly 15% for a typical dwelling). An attribute-based valuation with calibrated intervals follows in a later release.</p></div>`;
    document.getElementById('attribution').textContent = s.attribution;
  });

  // ------------------------------------------------------------ methodology
  route('/methodology', async (app) => {
    app.innerHTML = `<div class="prose"><h1>Methodology</h1>
      <h2>Repeat-sales index</h2><p>Geometric Bailey-Muth-Nourse regression on log price changes between consecutive sales of the same dwelling, with Case-Shiller interval weights (pair variance grows with holding period). Pairs held under six months, with annualised log returns above 100%, or beyond four robust standard deviations are excluded, as are non-arm's-length records (Price Paid category B).</p>
      <p>Areas are estimated jointly with the city in one sparse regression: each area's index is the parent's index plus a penalised deviation. Where an area-month has few pairs its deviation shrinks toward the parent; where it has many, its own data dominate. Each area page shows the resulting own-data weight. Standard errors are approximate (residual sigma over the square root of effective pairs).</p>
      <h2>Provisional data</h2><p>Registers fill in after the month ends. The last two months of Price Paid Data typically hold well under 90% of their eventual rows, so they are drawn dotted and excluded from the headline changes. A measured completeness curve replaces this fixed rule once several monthly vintages have been archived.</p>
      <h2>How dwellings are matched across sales</h2><p>London: normalised address from the register (postcode, building, unit, street); a changed address format can split one dwelling into two keys. New York: tax lot (BBL) plus apartment number; co-ops are share prices and are kept as their own ownership form. Singapore HDB: no unit numbers are published, so a key is block, street, storey band, flat type and floor area; a pair can be two different near-identical flats, making it a unit-type repeat-sales index.</p>
      <h2>What is not shown</h2><p>No listings, asking prices or days on market: this site uses sold and registered transactions only, from open official sources. No raw median comparisons across cities with different dwelling mixes, and price per m² only where the register carries floor area on a stated basis (HDB exclusive area; New York gross square feet, mostly houses).</p>
      <h2>Sources</h2><p>HM Land Registry Price Paid Data (OGL v3) and OS Code-Point Open (OGL v3). HDB resale flat prices via data.gov.sg (Singapore Open Data Licence) and OneMap (Singapore Land Authority). NYC Department of Finance annualized sales via NYC Open Data. BIS residential property prices and OECD analytical house price indicators for the country layer. Basemap: OpenFreeMap / OpenMapTiles / OpenStreetMap contributors.</p></div>`;
  });
})();
