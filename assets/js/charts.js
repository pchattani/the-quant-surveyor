/* Plotly wrappers. One theme read from REI.pal() at draw time, so a theme switch redraws in the new colours.
   Rules kept throughout: one y-scale per chart, a legend only for two or more series, text in ink colours,
   cobalt = cheap and amber = rich on a neutral midpoint, green and red-orange only for price direction. Colours and
   type are the family's (The Quant Macro). */
REI.charts = (function () {
  const SANS = '"Barlow", system-ui, sans-serif', MONO = '"IBM Plex Mono", ui-monospace, monospace';
  const cfg = { displayModeBar: false, responsive: true };
  /* If the charting library failed to load, show a notice in the chart slot instead of throwing and blanking the page. */
  const Plotly = new Proxy({}, { get: (_, k) => (window.Plotly && window.Plotly[k]) ? window.Plotly[k].bind(window.Plotly) : (div) => {
    const d = typeof div === 'string' ? document.getElementById(div) : div;
    if (d) d.innerHTML = '<p class="note">Chart library did not load (network or content blocker). Data and tables are unaffected; reload to retry.</p>';
  } });
  const node = d => (typeof d === 'string' ? document.getElementById(d) : d);

  function axis(p, over) {
    return Object.assign({ gridcolor: p.grid, gridwidth: 1, zeroline: false, linecolor: p.axis, tickcolor: p.axis, ticks: 'outside', ticklen: 3,
      tickfont: { color: p.mute, family: MONO, size: 10.5 }, title: { text: '', font: { color: p.ink2, family: SANS, size: 11 }, standoff: 8 }, automargin: true }, over || {});
  }
  function layout(over) {
    const p = REI.pal(), o = over || {};
    const L = Object.assign({
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { family: SANS, color: p.ink2, size: 12 },
      margin: { l: 46, r: 14, t: 8, b: 30 }, height: 280, hovermode: 'x unified', showlegend: false,
      hoverlabel: { bgcolor: p.panel2, bordercolor: p.axis, font: { color: p.ink, family: MONO, size: 11.5 } },
      legend: { orientation: 'h', y: 1.02, yanchor: 'bottom', x: 0, xanchor: 'left', font: { color: p.ink2, size: 11.5, family: SANS }, bgcolor: 'rgba(0,0,0,0)' },
    }, o);
    L.xaxis = axis(p, o.xaxis); L.yaxis = axis(p, o.yaxis);
    if (o.xaxis2) L.xaxis2 = axis(p, o.xaxis2);
    if (o.yaxis2) L.yaxis2 = axis(p, o.yaxis2);
    if (L.showlegend) L.margin = Object.assign({}, L.margin, { t: Math.max(L.margin.t, 30) });
    return L;
  }
  const ytitle = t => (t ? { title: { text: t, font: { color: REI.pal().ink2, family: SANS, size: 11 }, standoff: 8 } } : {});
  const zero = p => ({ type: 'line', xref: 'paper', x0: 0, x1: 1, yref: 'y', y0: 0, y1: 0, line: { color: p.axis, width: 1 } });
  const plot = (div, traces, over) => Plotly.newPlot(node(div), traces, layout(over), cfg);
  const dates = x => x.map(REI.q2d);

  /* Time series. series: [{x, y, name, color, dash, width, fmt}]; opts: {y, suffix, zero, band {x, lo, hi, name, color}, hlines [{y, text, dash}], height, quarterly} */
  function lines(div, series, opts = {}) {
    const p = REI.pal(), sfx = opts.suffix || '', traces = [];
    if (opts.band) {
      const b = opts.band, c = b.color || p.neutral;
      traces.push({ x: dates(b.x), y: b.hi, type: 'scatter', mode: 'lines', line: { width: 0 }, hoverinfo: 'skip', showlegend: false });
      traces.push({ x: dates(b.x), y: b.lo, type: 'scatter', mode: 'lines', line: { width: 0 }, fill: 'tonexty', fillcolor: REI.rgba(c, 0.16), hoverinfo: 'skip', name: b.name || 'Range', showlegend: !!b.name && series.length + 1 >= 2 });
    }
    series.forEach((s, i) => traces.push({ x: dates(s.x), y: s.y, type: 'scatter', mode: 'lines', connectgaps: false, name: s.name || '',
      line: { color: s.color || (series.length === 1 ? p.ink : p.cat[i % p.cat.length]), width: s.width || 2, dash: s.dash || 'solid', shape: s.step ? 'hv' : 'linear' },
      hovertemplate: `%{y:${s.fmt || opts.fmt || '.1f'}}${sfx}<extra>${REI.esc(s.name || '')}</extra>` }));
    const shapes = [];
    if (opts.zero) shapes.push(zero(p));
    const ann = [];
    for (const h of opts.hlines || []) {
      shapes.push({ type: 'line', xref: 'paper', x0: 0, x1: 1, yref: 'y', y0: h.y, y1: h.y, line: { color: p.mute, width: 1, dash: h.dash || 'dot' } });
      if (h.text) ann.push({ xref: 'paper', x: 1, xanchor: 'right', yref: 'y', y: h.y, yanchor: 'bottom', text: h.text, showarrow: false, font: { color: p.mute, family: MONO, size: 10 } });
    }
    const named = series.filter(s => s.name).length + (opts.band && opts.band.name ? 1 : 0);
    return plot(div, traces, { height: opts.height || 280, showlegend: named >= 2, shapes, annotations: ann,
      xaxis: { type: 'date', hoverformat: opts.monthly ? '%b %Y' : 'Q%q %Y' },
      yaxis: Object.assign({ ticksuffix: opts.ticksuffix == null ? sfx : opts.ticksuffix }, ytitle(opts.y), opts.range ? { range: opts.range } : {}) });
  }

  /* Labelled scatter with zero cross-hairs. pts: [{x, y, label, href, tip, color}]; opts {x, y, xs, ys, labels, height, color} */
  function scatter(div, pts, opts = {}) {
    const p = REI.pal(), d = node(div);
    pts = pts.filter(q => REI.ok(q.x) && REI.ok(q.y));
    const lab = opts.labels !== false && pts.length <= 70;
    const tr = { x: pts.map(q => q.x), y: pts.map(q => q.y), text: pts.map(q => q.label), customdata: pts.map(q => [q.tip || q.label, q.href || '']),
      type: pts.length > 400 ? 'scattergl' : 'scatter', mode: lab ? 'markers+text' : 'markers', textposition: 'top center', cliponaxis: false,
      textfont: { color: p.ink2, family: MONO, size: 10 },
      marker: { color: pts.map(q => q.color || opts.color || p.ink2), size: opts.size || (pts.length > 150 ? 6 : 9), opacity: pts.length > 150 ? 0.75 : 0.95, line: { color: p.panel, width: pts.length > 150 ? 0.5 : 1.5 } },
      hovertemplate: `<b>%{customdata[0]}</b><br>${opts.x || 'x'}: %{x:.1f}${opts.xs || ''}<br>${opts.y || 'y'}: %{y:.1f}${opts.ys || ''}<extra></extra>` };
    const shapes = [zero(p), { type: 'line', yref: 'paper', y0: 0, y1: 1, xref: 'x', x0: 0, x1: 0, line: { color: p.axis, width: 1 } }];
    const ann = (opts.corners || []).map((t, i) => ({ xref: 'paper', yref: 'paper', x: i % 2 ? 0.995 : 0.005, y: i < 2 ? 0.995 : 0.005, xanchor: i % 2 ? 'right' : 'left', yanchor: i < 2 ? 'top' : 'bottom', text: t, showarrow: false, font: { color: p.mute, family: SANS, size: 10.5 } }));
    const r = plot(d, [tr], { height: opts.height || 380, hovermode: 'closest', shapes, annotations: ann, margin: { l: 50, r: 16, t: 12, b: 40 },
      xaxis: Object.assign({ ticksuffix: opts.xs || '', range: opts.xrange }, ytitle(opts.x)), yaxis: Object.assign({ ticksuffix: opts.ys || '', range: opts.yrange }, ytitle(opts.y)) });
    if (d && d.on) d.on('plotly_click', e => { const h = e.points && e.points[0] && e.points[0].customdata[1]; if (h) location.hash = h; });
    return r;
  }

  /* World map of the fair-value gap. rows: [{iso3, iso2, name, v, tip}]; other: countries on the trend basis, drawn neutral. */
  function choropleth(div, rows, other, opts = {}) {
    const p = REI.pal(), d = node(div), lim = opts.clip || 60;
    const mk = (rs, scale, show) => ({ type: 'choropleth', locationmode: 'ISO-3', locations: rs.map(r => r.iso3), z: rs.map(r => Math.max(-lim, Math.min(lim, r.v))),
      customdata: rs.map(r => [r.name, r.tip, r.iso2]), zmin: -lim, zmax: lim, colorscale: scale, showscale: show,
      marker: { line: { color: p.panel, width: 0.6 } }, hovertemplate: '<b>%{customdata[0]}</b><br>%{customdata[1]}<extra></extra>',
      colorbar: { orientation: 'h', thickness: 8, len: 0.42, x: 0.5, xanchor: 'center', y: 0.02, yanchor: 'bottom', outlinewidth: 0, ticksuffix: '%', tickvals: [-lim, -lim / 2, 0, lim / 2, lim],
        ticktext: [`≤ −${lim}`, `−${lim / 2}`, 'fair value', `+${lim / 2}`, `≥ +${lim}`], tickfont: { color: p.ink2, family: MONO, size: 10 }, ticklen: 2, tickcolor: p.axis } });
    const traces = [mk(rows, [[0, p.cheap], [0.5, p.mid], [1, p.rich]], true)];
    if (other && other.length) traces.push(mk(other, [[0, p.nodata], [1, p.nodata]], false));
    const r = Plotly.newPlot(d, traces, { paper_bgcolor: 'rgba(0,0,0,0)', height: opts.height || 400, margin: { l: 0, r: 0, t: 0, b: 0 }, dragmode: false,
      font: { family: SANS, color: p.ink2, size: 12 }, hoverlabel: { bgcolor: p.panel2, bordercolor: p.axis, font: { color: p.ink, family: MONO, size: 11.5 } },
      geo: { projection: { type: 'natural earth' }, bgcolor: 'rgba(0,0,0,0)', showframe: false, showcoastlines: false, showland: true, landcolor: p.land, showcountries: true, countrycolor: p.line, countrywidth: 0.5,
        showocean: false, showlakes: false, lataxis: { range: [-56, 82] }, lonaxis: { range: [-168, 180] } } }, Object.assign({}, cfg, { scrollZoom: false, doubleClick: false }));
    if (d && d.on) d.on('plotly_click', e => { const c = e.points && e.points[0] && e.points[0].customdata; if (c && c[2]) location.hash = `#/country/${c[2]}`; });
    return r;
  }

  /* Categorical bars. opts {y, suffix, colors, height, text} */
  function bars(div, cats, vals, opts = {}) {
    const p = REI.pal();
    return plot(div, [{ x: cats, y: vals, type: 'bar', width: 0.62, marker: { color: opts.colors || vals.map(() => p.neutral), line: { width: 0 } },
      text: opts.text, textposition: 'outside', cliponaxis: false, textfont: { color: p.ink2, family: MONO, size: 10.5 },
      customdata: opts.tips || cats.map(() => ''), hovertemplate: `<b>%{x}</b><br>%{y:.2f}${opts.suffix || ''}%{customdata}<extra></extra>` }],
      { height: opts.height || 260, hovermode: 'closest', bargap: 0.3, shapes: [zero(p)], margin: { l: 46, r: 14, t: 18, b: 36 },
        xaxis: { type: 'category', showgrid: false }, yaxis: Object.assign({ ticksuffix: opts.suffix || '' }, ytitle(opts.y)) });
  }

  /* Index line with a shaded ±1.96 SE band (SE in log points) and the provisional tail dotted; optional comparison lines. */
  function index(div, idx, provFrom, opts = {}) {
    const p = REI.pal(), per = dates(idx.period), v = idx.value, se = idx.se || [];
    const k = provFrom ? Math.max(0, idx.period.indexOf(provFrom)) : per.length;
    const main = opts.color || p.ink, cmp = opts.compare || [], traces = [];
    if (se.some(x => x != null)) {
      traces.push({ x: per, y: v.map((x, i) => se[i] != null ? x * Math.exp(1.96 * se[i]) : null), type: 'scatter', mode: 'lines', line: { width: 0 }, hoverinfo: 'skip', showlegend: false });
      traces.push({ x: per, y: v.map((x, i) => se[i] != null ? x * Math.exp(-1.96 * se[i]) : null), type: 'scatter', mode: 'lines', line: { width: 0 }, fill: 'tonexty', fillcolor: REI.rgba(p.neutral, 0.2), hoverinfo: 'skip', showlegend: false });
    }
    cmp.forEach((c, i) => traces.push({ x: dates(c.period), y: c.value, type: 'scatter', mode: 'lines', line: { color: c.color || p.cat[i % p.cat.length], width: 1.5, dash: c.dash || 'solid' }, name: c.name, hovertemplate: `%{y:.1f}<extra>${REI.esc(c.name)}</extra>` }));
    traces.push({ x: per.slice(0, k + 1), y: v.slice(0, k + 1), type: 'scatter', mode: 'lines', line: { color: main, width: 2 }, name: opts.name || 'Index', hovertemplate: `%{y:.1f}<extra>${REI.esc(opts.name || 'Index')}</extra>` });
    const prov = k < per.length - 1;
    if (prov) traces.push({ x: per.slice(k), y: v.slice(k), type: 'scatter', mode: 'lines', line: { color: main, width: 2, dash: 'dot' }, name: 'Provisional (register still filling)', hovertemplate: '%{y:.1f} provisional<extra></extra>' });
    return plot(div, traces, { height: opts.height || 280, showlegend: cmp.length > 0 || prov, xaxis: { type: 'date', hoverformat: '%b %Y' }, yaxis: ytitle(`Index (${opts.base || ''} = 100)`) });
  }

  /* Two stacked panels sharing the time axis, each with its own scale (small multiples, not a second axis on one plot). */
  function stacked(div, top, bottom, topTitle, bottomTitle, over = {}) {
    for (const t of bottom) { t.xaxis = 'x2'; t.yaxis = 'y2'; }
    const n = top.filter(t => t.name).length + bottom.filter(t => t.name).length;
    return plot(div, top.concat(bottom), Object.assign({ height: 400, showlegend: n >= 2,
      yaxis: Object.assign({ domain: [0.56, 1] }, ytitle(topTitle)), yaxis2: Object.assign({ domain: [0, 0.44], anchor: 'x2' }, ytitle(bottomTitle)),
      xaxis: Object.assign({ showticklabels: false, ticks: '' }, over.xaxis || {}), xaxis2: Object.assign({ anchor: 'y2', matches: 'x' }, over.xaxis || {}) }, over.layout || {}));
  }

  /* Monthly sales bars (provisional months lighter) above the 12-month median price. */
  function volume(div, vol, cur, provFrom) {
    const p = REI.pal(), per = vol.period, k = provFrom ? Math.max(0, per.indexOf(provFrom)) : per.length;
    const barsT = { x: per, y: vol.n, type: 'bar', marker: { color: per.map((_, i) => REI.rgba(p.neutral, i >= k ? 0.35 : 0.8)) }, hovertemplate: '%{y:,} sales<extra></extra>' };
    if (!vol.median) return plot(div, [barsT], { xaxis: { type: 'date', hoverformat: '%b %Y' }, yaxis: ytitle('Sales per month'), bargap: 0.1 });
    return stacked(div, [barsT], [{ x: per, y: vol.median, type: 'scatter', mode: 'lines', line: { color: p.ink, width: 1.8 }, hovertemplate: '%{y:,.0f}<extra>Median price</extra>' }],
      'Sales per month', `Median price (${cur})`, { xaxis: { type: 'date', hoverformat: '%b %Y' }, layout: { bargap: 0.1, yaxis2: Object.assign({ domain: [0, 0.44], anchor: 'x2', tickformat: '~s' }, ytitle(`Median price (${cur})`)) } });
  }

  /* Price distribution histogram (log x). */
  function hist(div, prices, cur) {
    const p = REI.pal(), logs = prices.filter(x => x > 1000).map(x => Math.log10(x));
    return plot(div, [{ x: logs, type: 'histogram', nbinsx: 60, marker: { color: REI.rgba(p.neutral, 0.8) }, hovertemplate: '%{y} sales<extra></extra>' }],
      { hovermode: 'closest', xaxis: Object.assign({ tickvals: [4.5, 5, 5.5, 6, 6.5, 7], ticktext: ['30k', '100k', '300k', '1m', '3m', '10m'] }, ytitle(`Price (${cur}, log scale)`)), yaxis: ytitle('Sales (12m)') });
  }

  /* Sequential ramp in one hue (the "cheap" blue), n steps from low to high. Dark theme: grey-blue to a light tint;
     light theme: pale tint to a deep blue. Used for ordered categories and the map's levels. */
  const mix = (a, b, t) => { const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
    const c = k => Math.round(((A >> k) & 255) * (1 - t) + ((B >> k) & 255) * t);
    return '#' + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1); };
  /* Correlation heatmap: names on both axes, -1 cobalt, 0 the panel colour, +1 amber (a diverging scale with a neutral
     midpoint); one cell per pair, hover gives the pair and the value. */
  function heat(div, names, z, opts = {}) {
    const p = REI.pal(), tf = { color: p.mute, family: MONO, size: 9.5 };
    const tr = { type: 'heatmap', x: names, y: names, z, zmin: -1, zmax: 1, xgap: 1, ygap: 1,
      colorscale: [[0, p.cheap], [0.5, p.panel2], [1, p.rich]], hovertemplate: '%{y} and %{x}: %{z:.2f}<extra></extra>',
      colorbar: { thickness: 10, len: 0.6, outlinewidth: 0, tickfont: tf, tickvals: [-1, -0.5, 0, 0.5, 1] } };
    return plot(div, [tr], { height: opts.height || 600, hovermode: 'closest', margin: { l: 36, r: 8, t: 8, b: 36 },
      xaxis: { tickangle: -90, tickfont: tf, showgrid: false, ticks: '' }, yaxis: { autorange: 'reversed', tickfont: tf, showgrid: false, ticks: '' } });
  }
  function ramp(n) {
    const p = REI.pal(), dark = REI.theme() === 'dark';
    const a = dark ? mix(p.mid, p.cheap, 0.15) : mix('#ffffff', p.cheap, 0.18), b = p.cheap, c = dark ? mix(p.cheap, '#ffffff', 0.55) : mix(p.cheap, '#000000', 0.5);
    return Array.from({ length: n }, (_, i) => { const t = n === 1 ? 1 : i / (n - 1); return t < 0.5 ? mix(a, b, t * 2) : mix(b, c, (t - 0.5) * 2); });
  }

  return { heat, plot, lines, scatter, choropleth, bars, index, stacked, volume, hist, ramp, mix };
})();
