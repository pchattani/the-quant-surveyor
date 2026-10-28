/* Plotly wrappers with one dark theme. Every chart shows the as-of / provisional banner via the caller. */
REI.charts = (function () {
  const base = {
    paper_bgcolor: '#14171d', plot_bgcolor: '#14171d', font: { family: 'Barlow, system-ui, sans-serif', color: '#c3c9d4', size: 12 },
    margin: { l: 56, r: 16, t: 24, b: 44 }, hovermode: 'x unified', colorway: ['#7d93ff', '#ff6a4d', '#5ec8f0', '#c39be8', '#8fd16a', '#8fdcc8', '#d4ff3a'],
    hoverlabel: { bgcolor: '#1c2028', bordercolor: '#3a4150', font: { color: '#f3f5f8', family: 'Barlow Condensed, sans-serif', size: 12 } },
    xaxis: { gridcolor: '#232833', zeroline: false, linecolor: '#596171', tickfont: { color: '#939bab' }, title: { text: '' } },
    yaxis: { gridcolor: '#232833', zeroline: false, linecolor: '#596171', tickfont: { color: '#939bab' }, title: { text: '' } },
    legend: { orientation: 'h', y: 1.12, x: 0 },
  };
  const cfg = { displayModeBar: false, responsive: true };
  const merge = (a, b) => Object.assign({}, a, b, { xaxis: Object.assign({}, a.xaxis, b.xaxis || {}), yaxis: Object.assign({}, a.yaxis, b.yaxis || {}) });
  /* If the charting library failed to load, show a notice in the chart slot instead of throwing and blanking the page. */
  const Plotly = new Proxy({}, { get: (_, k) => (window.Plotly && window.Plotly[k]) ? window.Plotly[k].bind(window.Plotly) : (div) => {
    const d = typeof div === 'string' ? document.getElementById(div) : div;
    if (d) d.innerHTML = '<p class="note">Chart library did not load (network or content blocker). Data and tables are unaffected; reload to retry.</p>';
  } });

  /* Index line with a shaded ±1.96 SE band (SE is in log points: band = value*exp(±1.96 se)) and the provisional tail dashed. */
  function index(div, idx, provFrom, opts = {}) {
    const p = idx.period, v = idx.value, se = idx.se || [];
    const k = provFrom ? Math.max(0, p.indexOf(provFrom)) : p.length;
    const hi = v.map((x, i) => se[i] != null ? x * Math.exp(1.96 * se[i]) : null);
    const lo = v.map((x, i) => se[i] != null ? x * Math.exp(-1.96 * se[i]) : null);
    const traces = [
      { x: p, y: hi, type: 'scatter', mode: 'lines', line: { width: 0 }, hoverinfo: 'skip', showlegend: false },
      { x: p, y: lo, type: 'scatter', mode: 'lines', line: { width: 0 }, fill: 'tonexty', fillcolor: 'rgba(125,147,255,0.12)', hoverinfo: 'skip', showlegend: false, name: '95% band' },
      { x: p.slice(0, k + 1), y: v.slice(0, k + 1), type: 'scatter', mode: 'lines', line: { color: '#7d93ff', width: 2 }, name: opts.name || 'Repeat-sales index', hovertemplate: '%{y:.1f}<extra></extra>' },
    ];
    if (k < p.length - 1) traces.push({ x: p.slice(k), y: v.slice(k), type: 'scatter', mode: 'lines', line: { color: '#ffc94d', width: 2, dash: 'dot' }, name: 'Provisional (register incomplete)', hovertemplate: '%{y:.1f} (prov.)<extra></extra>' });
    if (opts.compare) for (const c of opts.compare) traces.push({ x: c.period, y: c.value, type: 'scatter', mode: 'lines', line: { color: c.color || '#939bab', width: 1.5 }, name: c.name, hovertemplate: '%{y:.1f}<extra></extra>' });
    Plotly.newPlot(div, traces, merge(base, { yaxis: { title: { text: `Index (${opts.base || ''} = 100)` } }, xaxis: { type: 'date' } }), cfg);
  }

  /* Monthly volume bars with 12-month median price line on a second axis. */
  function volume(div, vol, cur, provFrom) {
    const p = vol.period, k = provFrom ? Math.max(0, p.indexOf(provFrom)) : p.length;
    const colors = p.map((_, i) => i >= k ? 'rgba(255,201,77,0.7)' : 'rgba(125,147,255,0.55)');
    const traces = [
      { x: p, y: vol.n, type: 'bar', marker: { color: colors }, name: 'Sales (month)', hovertemplate: '%{y:,} sales<extra></extra>' },
    ];
    const layout = { yaxis: { title: { text: 'Sales per month' } }, xaxis: { type: 'date' } };
    if (vol.median) {
      traces.push({ x: p, y: vol.median, type: 'scatter', mode: 'lines', xaxis: 'x2', yaxis: 'y2', line: { color: '#8fd16a', width: 1.5 }, name: 'Median price', hovertemplate: '%{y:,.0f}<extra></extra>' });
      layout.height = 420;
      layout.yaxis = { domain: [0.56, 1], title: { text: 'Sales per month' } };
      layout.yaxis2 = Object.assign({}, base.yaxis, { domain: [0, 0.44], title: { text: `Median (${cur})` }, tickformat: '~s' });
      layout.xaxis = { type: 'date', showticklabels: false };
      layout.xaxis2 = Object.assign({}, base.xaxis, { type: 'date', anchor: 'y2', matches: 'x' });
    }
    Plotly.newPlot(div, traces, merge(base, layout), cfg);
  }

  /* Horizontal bar ranking. */
  function ranking(div, labels, values, opts = {}) {
    const order = values.map((v, i) => i).sort((a, b) => (values[a] ?? -1e9) - (values[b] ?? -1e9));
    const l = order.map(i => labels[i]), v = order.map(i => values[i]);
    Plotly.newPlot(div, [{ x: v, y: l, type: 'bar', orientation: 'h', marker: { color: v.map(x => x >= 0 ? '#7d93ff' : '#ff6a4d') }, hovertemplate: `%{y}: %{x:.1f}${opts.suffix || ''}<extra></extra>` }],
      merge(base, { margin: { l: 160, r: 16, t: 8, b: 36 }, height: Math.max(260, 18 * l.length + 60), xaxis: { title: { text: opts.xtitle || '' } }, hovermode: 'closest' }), cfg);
  }

  /* Price distribution histogram (log x). */
  function hist(div, prices, cur) {
    const logs = prices.filter(p => p > 1000).map(p => Math.log10(p));
    Plotly.newPlot(div, [{ x: logs, type: 'histogram', nbinsx: 60, marker: { color: 'rgba(125,147,255,0.6)' }, hovertemplate: '%{y} sales<extra></extra>' }],
      merge(base, { xaxis: { title: { text: `Price (${cur}, log scale)` }, tickvals: [4.5, 5, 5.5, 6, 6.5, 7], ticktext: ['30k', '100k', '300k', '1m', '3m', '10m'] }, yaxis: { title: { text: 'Sales (12m)' } }, hovermode: 'closest' }), cfg);
  }

  return { index, volume, ranking, hist };
})();
