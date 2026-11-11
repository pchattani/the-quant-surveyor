/* Area and sold-record pages. */
(function () {
  const { fmt, esc, ok } = REI, U = REI.ui, C = REI.charts, V = REI.vu;
  const setAttr = t => { const a = document.getElementById('attribution'); if (a) a.textContent = t || ''; };
  const crumbs0 = (key, s) => `<a href="#/cities">Cities</a> › <a href="#/country/${s.country}">${esc(s.country)}</a> › <a href="#/city/${key}">${esc(s.name)}</a>`;
  const changeKpis = (ch, sub) => [['12 months', ch.m12], ['5 years', ch.y5], ['10 years', ch.y10]].filter(([, x]) => x !== undefined).map(([k, x]) => ({ k: `Index, ${k}`, v: U.chg(x), s: sub }));

  // ------------------------------------------------------------ area
  REI.route('/area/:key/:code', async (app, { key, code }) => {
    const s = await REI.city(key);
    let a;
    try { a = await REI.area(key, code); } catch (e) {
      app.innerHTML = U.head(esc(code), esc(s.name), '', `${crumbs0(key, s)} › ${esc(code)}`) +
        `<p class="note">Neighbourhood pages for ${esc(s.name)} are built but not yet published to the public data repository. The city tear-sheet is live.</p>`;
      setAttr(s.attribution); return;
    }
    const vk = await REI.vcity(key).catch(() => null);
    const vd = vk && (vk.districts || []).find(d => d.code === a.code);
    const valKpis = vd ? [{ k: 'Relative value z', v: U.sgn(vd.z, 2), cls: V.gapCls(vd.z), s: `${fmt.pct(vd.rv, 0)} vs own mean · percentile ${fmt.fx(vd.pct, 0)}` },
      { k: '1y vs city', v: U.chg(vd.rel_mom, 1, ' pts'), s: `level ${fmt.pct(vd.lvl, 0)} vs city median` }] : [];
    if (s.tier === 'B') {
      const am = s.area_metric || {};
      app.innerHTML = U.head(esc(a.name), `${esc(s.name)} · ${esc(a.basis || s.basis)}`, a.parent ? U.badge(a.parent.name) : '', `${crumbs0(key, s)} › ${esc(a.name)}`) +
        U.kpis([ok(a.psm12) ? { k: am.label || 'Latest', v: am.format === 'money' ? fmt.money(a.psm12, s.currency) : '$' + Math.round(a.psm12).toLocaleString('en-US'), s: `latest ${s.freq === 'M' ? 'month' : 'quarter'}` } : null]
          .concat(a.changes ? changeKpis(a.changes, '') : [], valKpis)) +
        U.panel(`${a.name} against ${s.name}`, 'rebased', '<div class="chart" id="ar-i"></div>') +
        (a.children && a.children.length ? U.panel('Within this area', '', '<div id="ar-c"></div>', { flush: true }) : '');
      if (a.index) C.index('ar-i', { period: a.index.period, value: a.index.value, se: [] }, null, { base: fmt.month(a.index.period[0]), name: a.name, compare: [{ period: s.index.period, value: s.index.value, name: s.name, color: REI.pal().neutral, dash: 'dash' }] });
      if (a.children && a.children.length) U.table('ar-c', { id: 'arc:' + key, sort: 'idx_m12', dir: -1, rows: a.children, cols: [
        { k: 'name', h: 'Area', l: 1, f: c => `<a href="#/area/${key}/${encodeURIComponent(c.code)}">${esc(c.name)}</a>` },
        { k: 'idx_value', h: esc(am.label || 'Latest'), f: c => (am.format === 'money' ? fmt.money(c.psm12, s.currency) : U.num(c.idx_value, 1)) }, { k: 'idx_m12', h: '12m', f: c => U.chg(c.idx_m12) }] });
      setAttr(s.attribution); return;
    }
    const cr = [crumbs0(key, s)];
    if (a.parent) cr.push(`<a href="#/area/${key}/${encodeURIComponent(a.parent.code)}">${esc(a.parent.name)}</a>`);
    const lvName = (s.levels.find(l => l.key === a.level) || {}).name || a.level;
    const shrink = a.index && a.index.shrink ? a.index.shrink[a.index.period.indexOf(s.index_through || s.data_through)] : null;
    app.innerHTML = U.head(`${esc(a.name)}${a.name !== a.code ? ` <span class="mute mono">${esc(a.code)}</span>` : ''}`, `${esc(lvName)} in ${esc(s.name)}`,
      `${U.badge('Through ' + fmt.month(s.data_through))}${s.provisional_from ? ' ' + U.badge('Provisional from ' + fmt.month(s.provisional_from), 1) : ''}`, `${cr.join(' › ')} › ${esc(a.name)}`) +
      U.kpis((a.changes ? changeKpis(a.changes, 'to the last complete month') : []).concat([
        { k: 'Sales, 12 months', v: fmt.num(a.n12), s: `median ${fmt.money(a.med12, s.currency)}` },
        { k: 'Own-data weight', v: ok(shrink) ? (100 * shrink).toFixed(0) + '%' : '–', s: `rest borrowed from ${a.parent ? esc(a.parent.name) : 'the city'}${a.index && a.index.window > 1 ? ` · ${a.index.window}-month window` : ''}` }], valKpis)) +
      `<div class="g g2">${U.panel(`Repeat-sales index against ${s.name}`, `${esc(fmt.month(s.base_period))} = 100`, '<div class="chart" id="ar-i"></div>')}
        ${U.panel('Map', 'recent sales as points', '<div class="map-ctl"><span class="legend" id="legend"></span></div><div id="map" class="map" style="height:340px"></div>', { flush: true })}</div>
      ${a.children && a.children.length ? U.panel('Within this area', '', '<div id="ar-c"></div>', { flush: true }) : ''}
      ${U.panel('Recent sales', 'click a sale for the dwelling\'s full history', `<div class="list">${(a.recent || []).map(r => `<a class="row" href="#/sold/${key}/${encodeURIComponent(r.sd)}/${r.pk}"><span>${esc(r.a)} <span class="m mono">${esc(r.pc || '')}</span></span><span>${fmt.money(r.p, s.currency)}${r.m2 ? ` <span class="m">${fmt.money(r.p / r.m2, s.currency)}/m² · ${r.m2} m²</span>` : ''} <span class="m">${fmt.ptype(r.t)}${r.n ? ' · new' : ''} · ${r.d}</span></span></a>`).join('') || '<p class="empty">No recent sales.</p>'}</div>`, { flush: true })}`;
    if (a.index) C.index('ar-i', a.index, s.provisional_from, { base: fmt.month(s.base_period), name: a.name, compare: [{ period: s.index.period, value: s.index.value, name: s.name, color: REI.pal().neutral, dash: 'dash' }] });
    if (a.children && a.children.length) U.table('ar-c', { id: 'arc:' + key, sort: 'n12', dir: -1, limit: 40, rows: a.children, cols: [
      { k: 'name', h: 'Area', l: 1, f: c => `<a href="#/area/${key}/${encodeURIComponent(c.code)}">${esc(c.name)}</a>` }, { k: 'n12', h: 'Sales 12m', f: c => fmt.num(c.n12) },
      { k: 'med12', h: 'Median 12m', f: c => fmt.money(c.med12, s.currency) }, ...(s.has_area ? [{ k: 'psm12', h: 'Per m²', f: c => (ok(c.psm12) ? fmt.money(c.psm12, s.currency) : '<span class="mute">–</span>') }] : []),
      { k: 'idx_m12', h: 'Index 12m', f: c => U.chg(c.idx_m12) }] });
    setAttr(s.attribution);
    try {
      const pts = (a.recent || []).filter(r => r.lat != null);
      const m = await REI.map.mount('map', key, s, { legend: U.$('legend'), zoom: 12 });
      const dist = a.level === s.shard_level ? a.code : (a.parent && a.parent.level === s.shard_level ? a.parent.code : null);
      let P = pts;
      if (dist) {
        const rows = await REI.salesDistrict(key, dist);
        const mine = a.level === s.shard_level ? rows : rows.filter(r => (a.level === 'sector' ? (r.pc || '').startsWith(a.code) : true));
        P = mine.filter(r => r.d >= `${+s.data_through.slice(0, 4) - 3}-01-01`);
        m.addPoints(P, s.currency);
      }
      const la = P.map(r => r.lat).filter(x => x != null), lo = P.map(r => r.lon).filter(x => x != null);
      if (la.length) m.fitBounds([[Math.min(...lo), Math.min(...la)], [Math.max(...lo), Math.max(...la)]]);
    } catch (e) { const mp = U.$('map'); if (mp) mp.innerHTML = '<p class="empty">Map layers for this area are not published yet.</p>'; }
  });

  // ------------------------------------------------------------ sold record (property history)
  REI.route('/sold/:key/:dist/:pk', async (app, { key, dist, pk }) => {
    const s = await REI.city(key);
    const rows = (await REI.salesDistrict(key, dist)).filter(r => r.pk === pk).sort((a, b) => (a.d < b.d ? -1 : 1));
    if (!rows.length) throw new Error('No sold records for this property key in this district');
    const last = rows[rows.length - 1], idx = s.index;
    const atIdx = d => { const i = idx.period.indexOf(d.slice(0, 7)); return i >= 0 ? idx.value[i] : null; };
    const lines = rows.map((r, i) => {
      const prev = rows[i - 1];
      let ret = '', ann = '', vsIdx = '', g = null;
      if (prev) {
        g = r.p / prev.p - 1; const yrs = (new Date(r.d) - new Date(prev.d)) / 3.15576e10;
        ret = fmt.pct(100 * g); ann = yrs > 0 ? fmt.pct(100 * (Math.pow(1 + g, 1 / yrs) - 1)) + ' a year' : '';
        const i0 = atIdx(prev.d), i1 = atIdx(r.d);
        if (i0 && i1) vsIdx = `city index ${fmt.pct(100 * (i1 / i0 - 1))}`;
      }
      return `<div class="hist"><span class="mono">${r.d}</span><span>${fmt.ptype(r.t)}${r.n ? ' · new build' : ''}${fmt.own(r.o) ? ' · ' + fmt.own(r.o) : ''}${r.m2 ? ` · ${r.m2} m²` : ''}</span><span class="p">${fmt.money(r.p, s.currency)}${r.m2 ? `<br><span class="mute">${fmt.money(r.p / r.m2, s.currency)}/m²</span>` : ''}</span><span class="r"><span class="${fmt.cls(g)}">${ret}</span> <span class="mute">${ann}</span><br><span class="mute">${vsIdx}</span></span></div>`;
    }).join('');
    const i1 = atIdx(last.d), iNow = idx.value[idx.period.indexOf(s.index_through || s.data_through)];
    const rolled = i1 && iNow ? last.p * iNow / i1 : null;
    app.innerHTML = U.head(esc(last.a), `${esc(last.pc || '')} · ${esc(s.name)}`, U.badge('Through ' + fmt.month(s.data_through)), `${crumbs0(key, s)} › <a href="#/area/${key}/${encodeURIComponent(dist)}">${esc(dist)}</a> › Sold record`) +
      U.kpis([{ k: 'Last sold', v: fmt.money(last.p, s.currency), s: last.d },
        { k: 'Index-implied value today', v: rolled ? fmt.money(rolled, s.currency) : '–', s: `last price × the ${esc(s.name)} index since; not a valuation` },
        { k: 'Sales on record', v: rows.length, s: `since ${rows[0].d.slice(0, 4)}` }]) +
      U.panel('Sold history', '', `<div class="hist head"><span>Date</span><span>Dwelling</span><span class="p">Price</span><span class="r">Change</span></div>${lines}
        <p class="note">${s.key === 'singapore' ? 'HDB publishes no unit numbers, so records are grouped by block, street, storey band, flat type and floor area: consecutive sales may be different but near-identical flats.' : 'Records paired by normalised address from the register; a changed address format can split one dwelling into two keys.'} The index-implied value rolls the last price forward by the city repeat-sales index and carries that index's uncertainty plus the dwelling's own risk (roughly 15% for a typical dwelling).</p>`);
    setAttr(s.attribution);
  });
})();
