/* Core: state, hash routing, loaders (JSON and gzip shards), theme and palette, formatting, search. */
window.REI = (function () {
  const state = { meta: null, cities: {}, areas: {}, sales: {}, h3: {}, pts: {}, misc: {}, view: {} };
  const DATA = 'data/';
  // sold-record cities are served from regional data repos (their own Pages sites); meta.json carries each base
  function url(path) {
    const m = /^cities\/([^/]+)\/sales\//.exec(path);   // only sold-record shards live in the regional data repos
    if (m && state.meta) { const c = state.meta.cities.find(x => x.key === m[1]); if (c && c.base) return c.base + path; }
    return DATA + path;
  }

  async function getJSON(path) {
    const r = await fetch(url(path), { cache: 'no-cache' });
    if (!r.ok) throw new Error(`${path}: ${r.status}`);
    return r.json();
  }
  async function getGz(path) {
    const r = await fetch(url(path), { cache: 'no-cache' });
    if (!r.ok) throw new Error(`${path}: ${r.status}`);
    // GitHub Pages serves .gz as-is (content-encoding not set), so decompress client-side.
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('json') && !path.endsWith('.gz')) return r.json();
    if (typeof DecompressionStream === 'undefined') throw new Error('browser lacks DecompressionStream');
    const ds = new DecompressionStream('gzip');
    const txt = await new Response(r.body.pipeThrough(ds)).text();
    return JSON.parse(txt);
  }

  const memo = (bucket, key, fn) => state[bucket][key] || (state[bucket][key] = fn().catch(e => { delete state[bucket][key]; throw e; }));
  const city = k => memo('cities', k, () => getJSON(`cities/${k}/summary.json`));
  const area = (k, code) => memo('areas', `${k}/${code}`, () => getGz(`cities/${k}/areas/${safe(code)}.json.gz`));
  const areaPoints = k => memo('pts', k, () => getJSON(`cities/${k}/points.json`).catch(() => null));
  const h3layer = (k, res) => memo('h3', `${k}/${res}`, () => getJSON(`cities/${k}/h3/r${res}.json`));
  const salesIndex = k => memo('sales', `${k}/index`, () => getJSON(`cities/${k}/sales/index.json`));
  const salesShard = (k, dist, year) => memo('sales', `${k}/${dist}/${year}`, () => getGz(`cities/${k}/sales/${safe(dist)}/${year}.json.gz`));
  async function salesDistrict(k, dist) {
    const idx = await salesIndex(k);
    const e = idx.districts[dist];
    if (!e) return [];
    const shards = await Promise.all(e.years.map(y => salesShard(k, dist, y)));
    const rows = [];
    for (const s of shards) for (const r of s.rows) rows.push(Object.fromEntries(s.cols.map((c, i) => [c, r[i]])));
    return rows;
  }
  // the valuation layer and the older cross-section payload
  const val = () => memo('misc', 'val', () => getJSON('valuation.json'));
  const micro = () => memo('misc', 'micro', () => getJSON('valuation_micro.json'));
  const dash = () => memo('misc', 'dash', () => getJSON('dashboard.json'));
  const vcountry = iso => memo('misc', `vc/${iso}`, () => getJSON(`valuation/countries/${iso}.json`));
  const vcity = k => memo('misc', `vk/${k}`, () => getJSON(`valuation/cities/${k}.json`));

  const safe = s => String(s).replace(/ /g, '_').replace(/\//g, '-');
  const ok = v => v != null && !isNaN(v);
  const fmt = {
    money(v, cur) { if (!ok(v)) return '–'; const sym = { GBP: '£', USD: '$', EUR: '€', AUD: 'A$', SGD: 'S$', AED: 'AED ' }[cur] || ''; return sym + Math.round(v).toLocaleString('en-GB'); },
    moneyK(v, cur) { if (!ok(v)) return '–'; const sym = { GBP: '£', USD: '$', EUR: '€' }[cur] || ''; return v >= 1e6 ? `${sym}${(v / 1e6).toFixed(2)}m` : `${sym}${Math.round(v / 1e3)}k`; },
    pct(v, d = 1) { if (!ok(v)) return '–'; return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}%`; },
    sg(v, d = 1) { if (!ok(v)) return '–'; return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}`; },
    fx(v, d = 1) { return ok(v) ? (v < 0 ? '−' : '') + Math.abs(v).toFixed(d) : '–'; },
    num(v) { return ok(v) ? Math.round(v).toLocaleString('en-GB') : '–'; },
    cls(v) { return !ok(v) || v === 0 ? '' : v > 0 ? 'pos' : 'neg'; },
    date(s) { return s ? s.slice(0, 10) : '–'; },
    month(p) { if (!p) return '–'; if (/Q\d$/.test(p)) return p.replace(/(\d{4})Q(\d)/, 'Q$2 $1'); const [y, m] = p.split('-'); return new Date(+y, +m - 1, 1).toLocaleString('en-GB', { month: 'short', year: 'numeric' }); },
    qtr(p) { return p ? String(p).replace(/(\d{4})Q(\d)/, 'Q$2 $1') : '–'; },
    ptype(t) { return { detached: 'Detached', semi: 'Semi-detached', terraced: 'Terraced', apartment: 'Flat', land: 'Land', other: 'Other' }[t] || t || '–'; },
    own(o) { return { fee_simple: 'Freehold', leasehold: 'Leasehold', condo: 'Condo', coop: 'Co-op', strata: 'Strata', hdb_lease: 'HDB lease' }[o] || ''; },
  };
  /* '2026Q2' -> '2026-05-15' (mid-quarter) and '2026-06' passes through: one date axis for quarterly and monthly series */
  const q2d = p => { const m = /^(\d{4})Q(\d)$/.exec(p); return m ? `${m[1]}-${String(m[2] * 3 - 1).padStart(2, '0')}-15` : p; };
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------------------------------------------------------------- theme and palette
  /* The Quant Macro family colours (the-quant-macro/assets/base.css): navy planes, cobalt and amber, green and red-orange. */
  const PAL = {
    dark: { panel: '#0d1526', panel2: '#132038', line: '#1b2740', grid: '#1a2641', axis: '#3a4b70', ink: '#f2f5fb', ink2: '#c0c9da', mute: '#8e9ab0',
      cheap: '#7d93ff', rich: '#ffb224', mid: '#4b5873', up: '#5fd38a', down: '#ff6a4d', neutral: '#8e9ab0',
      cat: ['#7d93ff', '#ffb224', '#5ec8f0', '#c39be8'], land: '#0f1930', nodata: '#26324f' },
    light: { panel: '#ffffff', panel2: '#eef1f7', line: '#d9dfec', grid: '#e6eaf3', axis: '#aab4c9', ink: '#0a1020', ink2: '#3a4660', mute: '#66728c',
      cheap: '#3f55d6', rich: '#b06f00', mid: '#c2c9d8', up: '#1b8748', down: '#d23c1e', neutral: '#7a859c',
      cat: ['#3f55d6', '#b06f00', '#0f86b0', '#8a55c9'], land: '#e6eaf3', nodata: '#d5dbe8' },
  };
  const theme = () => (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  const pal = () => PAL[theme()];
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  function setupTheme() {
    const b = document.getElementById('theme-btn');
    if (!b) return;
    const label = () => { b.textContent = theme() === 'dark' ? 'Light' : 'Dark'; };
    label();
    b.addEventListener('click', () => {
      const t = theme() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', t);
      try { localStorage.setItem('rei-theme', t); } catch (e) { /* private window: the choice lasts for this view */ }
      label(); dispatch(true);
    });
  }

  // ---------------------------------------------------------------- routing
  const routes = [];
  function route(pattern, handler) { routes.push({ re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), handler }); }
  const TAB_OF = { country: 'countries', city: 'cities', area: 'cities', sold: 'cities' };
  async function dispatch(keepScroll) {
    const hash = location.hash.replace(/^#/, '') || '/';
    const app = document.getElementById('app');
    const seg = hash.split('/')[1] || '';
    const tab = TAB_OF[seg] || seg;
    const tabs = document.querySelectorAll ? document.querySelectorAll('#nav .tab') : [];
    for (const t of tabs) t.classList.toggle('on', t.dataset.tab === tab);
    for (const r of routes) {
      const m = hash.match(r.re);
      if (m) {
        if (keepScroll !== true) app.innerHTML = '<div class="loading">Loading…</div>';
        try { await r.handler(app, Object.fromEntries(Object.entries(m.groups || {}).map(([k, v]) => [k, decodeURIComponent(v)]))); }
        catch (e) { app.innerHTML = `<div class="pnl"><div class="pnl-h"><h2>Could not load this page</h2></div><div class="pnl-b"><p class="note">${esc(e.message)}</p></div></div>`; console.error(e); }
        if (keepScroll !== true) window.scrollTo(0, 0);
        return;
      }
    }
    app.innerHTML = '<div class="pnl"><div class="pnl-h"><h2>Not found</h2></div><div class="pnl-b"><p class="note">No page at this address. <a href="#/">Back to the overview</a>.</p></div></div>';
  }
  const redirect = (from, to) => route(from, async () => { location.hash = '#' + to; });

  // ---------------------------------------------------------------- search (countries and cities, from the valuation table)
  function setupSearch() {
    const q = document.getElementById('q'), out = document.getElementById('q-results');
    if (!q || !out) return;
    let items = null;
    const build = async () => {
      const v = await val();
      items = v.countries.map(c => ({ t: c.name, k: `#/country/${c.iso2}`, m: 'country', x: (c.name + ' ' + c.iso2).toLowerCase() }))
        .concat(v.cities.map(c => ({ t: c.name, k: `#/city/${c.key}`, m: c.country, x: (c.name + ' ' + c.key.replace(/_/g, ' ')).toLowerCase() })));
    };
    q.addEventListener('focus', () => { if (!items) build().catch(() => { items = []; }); if (q.value.trim()) out.style.display = 'block'; });
    q.addEventListener('input', () => {
      const v = q.value.trim().toLowerCase();
      if (!v || !items) { out.style.display = 'none'; return; }
      const hits = items.filter(i => i.x.includes(v)).sort((a, b) => (a.x.startsWith(v) ? 0 : 1) - (b.x.startsWith(v) ? 0 : 1)).slice(0, 14);
      out.innerHTML = hits.map(h => `<a href="${h.k}"><span>${esc(h.t)}</span><small>${esc(h.m)}</small></a>`).join('') || '<a><span>No matches</span></a>';
      out.style.display = 'block';
    });
    q.addEventListener('keydown', e => { if (e.key === 'Enter') { const a = out.querySelector('a[href]'); if (a) { location.hash = a.getAttribute('href'); q.value = ''; out.style.display = 'none'; q.blur(); } } });
    q.addEventListener('blur', () => setTimeout(() => (out.style.display = 'none'), 150));
  }

  /* If the charting library failed to load, show a notice in the chart slot instead of throwing and blanking the page. */
  if (typeof window.Plotly === 'undefined') {
    window.addEventListener('load', () => {
      if (typeof window.Plotly === 'undefined') window.Plotly = { newPlot(div) {
        const d = typeof div === 'string' ? document.getElementById(div) : div;
        if (d) d.innerHTML = '<p class="note">Chart library did not load (network or content blocker). Data and tables are unaffected; reload to retry.</p>';
      } };
    });
  }

  async function start() {
    state.meta = await getJSON('meta.json');
    setupTheme();
    setupSearch();
    const a = document.getElementById('asof-top');
    if (a && state.meta.built) a.textContent = `Built ${state.meta.built}`;
    window.addEventListener('hashchange', () => dispatch());
    dispatch();
  }

  return { state, getJSON, getGz, city, area, h3layer, areaPoints, salesIndex, salesShard, salesDistrict, val, micro, dash, vcountry, vcity,
    fmt, ok, q2d, el, esc, route, redirect, start, safe, theme, pal, rgba, __dispatch: dispatch };
})();
