/* MapLibre map with H3 hex layers rebuilt client-side from cell ids, and sold points at high zoom. */
REI.map = (function () {
  const STYLE = 'https://tiles.openfreemap.org/styles/dark';
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

  const PALETTES = {
    psm12: ['#1d4877', '#2e6fa5', '#7d93ff', '#9ecbff', '#ffd27f', '#ffb86b', '#ff6a4d', '#b62324'],
    med12: ['#1d4877', '#2e6fa5', '#7d93ff', '#9ecbff', '#ffd27f', '#ffb86b', '#ff6a4d', '#b62324'],
    chg: ['#b62324', '#ff6a4d', '#ffb86b', '#ffd27f', '#cfd8dc', '#8ddc9b', '#7d93ff', '#1a7f37'],
    n12: ['#1d4877', '#2e6fa5', '#7d93ff', '#9ecbff', '#c8e1ff'],
  };

  async function mount(container, cityKey, city, opts = {}) {
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    const map = new maplibregl.Map({ container: el, style: STYLE, center: opts.center || [-0.1, 51.5], zoom: opts.zoom || 9.3, attributionControl: true });
    map.on('error', e => { if (e && e.error && /style/i.test(String(e.error.message || '')) && map.getStyle()?.name !== 'fallback') map.setStyle(FALLBACK); });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    let metric = opts.metric || 'med12', res = RES_BY_ZOOM(map.getZoom()), legendEl = opts.legend;

    async function draw() {
      const layer = await REI.h3layer(cityKey, res);
      const gj = layerToGeoJSON(layer, metric);
      const vals = gj.features.map(f => f.properties.v);
      const pal = PALETTES[metric];
      const breaks = quantiles(vals, pal.map((_, i) => (i + 1) / pal.length).slice(0, -1));
      const stops = [];
      pal.forEach((c, i) => { stops.push(i === 0 ? -1e18 : breaks[i - 1], c); });
      const colorExpr = ['step', ['get', 'v'], pal[0]];
      for (let i = 1; i < pal.length; i++) colorExpr.push(breaks[i - 1], pal[i]);
      if (map.getSource('hex')) { map.getSource('hex').setData(gj); map.setPaintProperty('hex-fill', 'fill-color', colorExpr); }
      else {
        map.addSource('hex', { type: 'geojson', data: gj });
        map.addLayer({ id: 'hex-fill', type: 'fill', source: 'hex', paint: { 'fill-color': colorExpr, 'fill-opacity': 0.55 } });
        map.addLayer({ id: 'hex-line', type: 'line', source: 'hex', paint: { 'line-color': '#0d1117', 'line-width': 0.4, 'line-opacity': 0.6 } });
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
          pal.map((c, i) => `<i style="background:${c}" title="${i ? fmtv(breaks[i - 1]) : ''}"></i>`).join('') + `<span>${fmtv(breaks[0])} → ${fmtv(breaks[breaks.length - 1])}</span>`;
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
          map.addLayer({ id: 'pts', type: 'circle', source: 'pts', minzoom: 13, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 2.5, 16, 6], 'circle-color': '#ffd27f', 'circle-stroke-color': '#0d1117', 'circle-stroke-width': 0.6, 'circle-opacity': 0.85 } });
          map.on('click', 'pts', e => { const p = e.features[0].properties; location.hash = `#/sold/${cityKey}/${encodeURIComponent(p.sd)}/${p.pk}`; });
          map.on('mouseenter', 'pts', () => (map.getCanvas().style.cursor = 'pointer'));
          map.on('mouseleave', 'pts', () => (map.getCanvas().style.cursor = ''));
        };
        if (map.loaded()) add(); else map.on('load', add);
      },
    };
  }
  return { mount };
})();
