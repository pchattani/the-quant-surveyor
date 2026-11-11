/* MapLibre map with H3 hex layers rebuilt client-side from cell ids, and sold points at high zoom. */
REI.map = (function () {
  const STYLES = { dark: 'https://tiles.openfreemap.org/styles/dark', light: 'https://tiles.openfreemap.org/styles/positron' };
  const FALLBACK = 'https://tiles.openfreemap.org/styles/positron';
  const RES_BY_ZOOM = z => (z < 10.5 ? 7 : z < 12.5 ? 8 : 9);

  function hexFeature(cell, props) {
    const ring = h3.cellToBoundary(cell, true);           // [lng, lat] pairs when geoJson=true
    ring.push(ring[0]);
    return { type: 'Feature', properties: Object.assign({ h3: cell }, props), geometry: { type: 'Polygon', coordinates: [ring] } };
  }
  function layerToGeoJSON(layer, metric) {
    const feats = [];
    if (!layer[metric]) return { type: 'FeatureCollection', features: feats };
    for (let i = 0; i < layer.h3.length; i++) {
      const v = layer[metric][i];
      if (v == null) continue;
      feats.push(hexFeature(layer.h3[i], { v, n12: layer.n12[i], med12: layer.med12[i], chg: layer.chg[i] }));
    }
    return { type: 'FeatureCollection', features: feats };
  }
  function quantiles(vals, qs) { const s = vals.filter(v => v != null && isFinite(v)).sort((a, b) => a - b); return qs.map(q => s[Math.min(s.length - 1, Math.floor(q * s.length))]); }

  /* Colours from the site theme: one hue, light to dark, for levels and counts; a diverging scale with a grey middle for
     price change (red down, green up). In the dark theme the sequential ramp runs dark to light so high values stand out. */
  function palette(metric) {
    const p = REI.pal(), C = REI.charts;
    if (metric === 'chg') return [0, 1, 2, 3].map(i => C.mix(p.down, p.mid, i / 3.5)).concat([0, 1, 2, 3].map(i => C.mix(p.mid, p.up, (i + 0.5) / 3.5)));
    return C.ramp(metric === 'n12' ? 5 : 7);
  }

  async function mount(container, cityKey, city, opts = {}) {
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    const map = new maplibregl.Map({ container: el, style: STYLES[REI.theme()], center: opts.center || [0, 20], zoom: opts.zoom || 9.3, attributionControl: true });
    map.on('error', e => { if (e && e.error && /style/i.test(String(e.error.message || '')) && map.getStyle()?.name !== 'fallback') map.setStyle(FALLBACK); });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    let metric = opts.metric || 'med12', res = RES_BY_ZOOM(map.getZoom()), legendEl = opts.legend, fitted = !!opts.center;

    async function draw() {
      const layer = await REI.h3layer(cityKey, res);
      const gj = layerToGeoJSON(layer, metric);
      const vals = gj.features.map(f => f.properties.v);
      const pal = palette(metric), P = REI.pal();
      const breaks = quantiles(vals, pal.map((_, i) => (i + 1) / pal.length).slice(0, -1));
      const stops = [];
      pal.forEach((c, i) => { stops.push(i === 0 ? -1e18 : breaks[i - 1], c); });
      const colorExpr = ['step', ['get', 'v'], pal[0]];
      for (let i = 1; i < pal.length; i++) colorExpr.push(breaks[i - 1], pal[i]);
      if (!fitted && gj.features.length) {   // centre on the city's own cells: no hard-coded centre
        fitted = true;
        const xs = [], ys = [];
        for (const f of gj.features) { const c = f.geometry.coordinates[0][0]; xs.push(c[0]); ys.push(c[1]); }
        xs.sort((a, b) => a - b); ys.sort((a, b) => a - b);
        const q = (a, t) => a[Math.floor(t * (a.length - 1))];
        map.fitBounds([[q(xs, 0.02), q(ys, 0.02)], [q(xs, 0.98), q(ys, 0.98)]], { padding: 16, duration: 0 });
      }
      if (map.getSource('hex')) { map.getSource('hex').setData(gj); map.setPaintProperty('hex-fill', 'fill-color', colorExpr); }
      else {
        map.addSource('hex', { type: 'geojson', data: gj });
        map.addLayer({ id: 'hex-fill', type: 'fill', source: 'hex', paint: { 'fill-color': colorExpr, 'fill-opacity': 0.62 } });
        map.addLayer({ id: 'hex-line', type: 'line', source: 'hex', paint: { 'line-color': P.panel, 'line-width': 0.4, 'line-opacity': 0.6 } });
        const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });
        map.on('mousemove', 'hex-fill', e => {
          const p = e.features[0].properties;
          popup.setLngLat(e.lngLat).setHTML(`<b>${REI.fmt.money(p.med12, city.currency)}</b> median (12m)<br>${REI.fmt.num(p.n12)} sales · ${REI.fmt.pct(p.chg)} vs prior 12m<br><span class="mono">${p.h3}</span>`).addTo(map);
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'hex-fill', () => { popup.remove(); map.getCanvas().style.cursor = ''; });
      }
      if (legendEl) {
        const fmtv = v => metric === 'chg' ? REI.fmt.pct(v, 0) : metric === 'n12' ? REI.fmt.num(v) : metric === 'psm12' ? REI.fmt.money(v, city.currency) + '/m²' : REI.fmt.moneyK(v, city.currency);
        legendEl.innerHTML = `<span>${{ med12: 'Median price, 12m', psm12: 'Median per m², 12m', chg: 'Median change vs prior 12m', n12: 'Sales, 12m' }[metric]}</span>` +
          pal.map((c, i) => `<i style="background:${c}" title="${i ? 'from ' + fmtv(breaks[i - 1]) : 'below ' + fmtv(breaks[0])}"></i>`).join('') + `<span>${fmtv(breaks[0])} → ${fmtv(breaks[breaks.length - 1])}</span>`;
      }
    }
    map.on('load', draw);
    map.on('zoomend', () => { const r = RES_BY_ZOOM(map.getZoom()); if (r !== res) { res = r; draw(); } });
    return {
      map,
      setMetric(m) { metric = m; draw(); },
      fitBounds(b) { map.fitBounds(b, { padding: 20, duration: 0 }); },
      addPoints(rows, cur) {
        const gj = { type: 'FeatureCollection', features: rows.filter(r => r.lat != null).map(r => ({ type: 'Feature', properties: { p: r.p, d: r.d, a: r.a, pc: r.pc, pk: r.pk, t: r.t, sd: r.sd }, geometry: { type: 'Point', coordinates: [r.lon, r.lat] } })) };
        const add = () => {
          if (map.getSource('pts')) { map.getSource('pts').setData(gj); return; }
          map.addSource('pts', { type: 'geojson', data: gj });
          map.addLayer({ id: 'pts', type: 'circle', source: 'pts', minzoom: 13, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 2.5, 16, 6], 'circle-color': REI.pal().rich, 'circle-stroke-color': REI.pal().panel, 'circle-stroke-width': 0.6, 'circle-opacity': 0.85 } });
          map.on('click', 'pts', e => { const p = e.features[0].properties; location.hash = `#/sold/${cityKey}/${encodeURIComponent(p.sd)}/${p.pk}`; });
          map.on('mouseenter', 'pts', () => (map.getCanvas().style.cursor = 'pointer'));
          map.on('mouseleave', 'pts', () => (map.getCanvas().style.cursor = ''));
        };
        if (map.loaded()) add(); else map.on('load', add);
      },
    };
  }

  /* Point map: one circle per place, coloured on a diverging scale around zero (two hues and a grey middle).
     pts: [{ lat, lon, v, tip, href, hl }]; opts.kind 'value' (cheap blue to rich amber) or 'change' (red to green);
     opts.span = value at which the colour saturates; opts.legend = element for the key. */
  function points(container, pts, opts = {}) {
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el || typeof maplibregl === 'undefined') return null;
    const map = new maplibregl.Map({ container: el, style: STYLES[REI.theme()], center: [10, 25], zoom: 1, attributionControl: { compact: true }, renderWorldCopies: false });
    map.on('error', e => { if (e && e.error && /style/i.test(String(e.error.message || '')) && map.getStyle()?.name !== 'fallback') map.setStyle(FALLBACK); });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    let cur = { pts, opts };
    const geo = rows => ({ type: 'FeatureCollection', features: rows.filter(r => r.lat != null && r.lon != null).map(r => ({ type: 'Feature',
      properties: { v: r.v == null || !isFinite(r.v) ? null : r.v, has: r.v != null && isFinite(r.v), tip: r.tip || '', href: r.href || '', hl: !!r.hl },
      geometry: { type: 'Point', coordinates: [r.lon, r.lat] } })) });
    function paint(o) {
      const P = REI.pal(), ch = o.kind === 'change', span = o.span || 30;
      const lo = ch ? P.down : P.cheap, hi = ch ? P.up : P.rich;
      const mid = REI.theme() === 'dark' ? '#737b87' : '#9aa0a8';        // the neutral middle, light enough to see on the basemap
      return { color: ['case', ['get', 'has'], ['interpolate', ['linear'], ['get', 'v'], -span, lo, 0, mid, span, hi], P.neutral], lo, hi, mid, span, P };
    }
    function legend(o, pt) {
      if (!o.legend) return;
      const f = x => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x) + (o.unit == null ? '%' : o.unit);
      o.legend.innerHTML = `<span>${REI.esc(o.label || '')}</span><span>${f(-pt.span)}</span><i style="width:90px;background:linear-gradient(90deg,${pt.lo},${pt.mid},${pt.hi})"></i><span>${f(pt.span)}</span>` +
        (cur.pts.some(r => r.v == null) ? `<i style="width:8px;height:8px;border:1.2px solid ${pt.P.neutral};border-radius:50%;background:none"></i><span>no reading</span>` : '');
    }
    function fit(rows) {
      const g = rows.filter(r => r.lat != null && r.lon != null);
      if (!g.length) return;
      if (g.length === 1) { map.jumpTo({ center: [g[0].lon, g[0].lat], zoom: cur.opts.zoom || 8 }); return; }
      const xs = g.map(r => r.lon), ys = g.map(r => r.lat);
      map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 36, duration: 0, maxZoom: cur.opts.maxZoom || 10 });
    }
    function draw() {
      const pt = paint(cur.opts), gj = geo(cur.pts), big = cur.opts.radius || 1;
      if (map.getSource('pp')) { map.getSource('pp').setData(gj); map.setPaintProperty('pp', 'circle-color', pt.color); }
      else {
        map.addSource('pp', { type: 'geojson', data: gj });
        map.addLayer({ id: 'pp', type: 'circle', source: 'pp', paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, ['case', ['get', 'hl'], 6 * big, 3.2 * big], 5, ['case', ['get', 'hl'], 9 * big, 5.5 * big], 10, ['case', ['get', 'hl'], 12 * big, 8 * big]],
          'circle-color': pt.color, 'circle-opacity': ['case', ['get', 'has'], 0.92, 0],
          'circle-stroke-color': ['case', ['get', 'hl'], pt.P.ink || '#fff', ['get', 'has'], pt.P.panel, pt.P.neutral], 'circle-stroke-width': ['case', ['get', 'hl'], 2, ['get', 'has'], 0.8, 1.1] } });
        const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });
        map.on('mousemove', 'pp', e => { const f = e.features[0]; popup.setLngLat(f.geometry.coordinates).setHTML(f.properties.tip).addTo(map); map.getCanvas().style.cursor = f.properties.href ? 'pointer' : ''; });
        map.on('mouseleave', 'pp', () => { popup.remove(); map.getCanvas().style.cursor = ''; });
        map.on('click', 'pp', e => { const h = e.features[0].properties.href; if (h) location.hash = h; });
      }
      legend(cur.opts, pt);
    }
    map.on('load', () => { draw(); fit(cur.pts); });
    return { map, set(rows, o, refit) { cur = { pts: rows, opts: Object.assign({}, cur.opts, o || {}) }; if (map.loaded()) { draw(); if (refit) fit(rows); } } };
  }
  return { mount, points };
})();
