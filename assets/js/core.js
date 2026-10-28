/* Core: state, hash routing, loaders (JSON and gzip shards), formatting, search. */
window.REI = (function () {
  const state = { meta: null, cities: {}, areas: {}, sales: {}, h3: {}, route: null };
  const DATA = 'data/';
  // sold-record cities are served from regional data repos (their own Pages sites); meta.json carries each base
  function url(path) {
    const m = /^cities\/([^/]+)\/(areas|h3|sales)\//.exec(path);
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
  const area = (k, code) => memo('areas', `${k}/${code}`, () => getJSON(`cities/${k}/areas/${safe(code)}.json`));
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

  const safe = s => String(s).replace(/ /g, '_').replace(/\//g, '-');
  const fmt = {
    money(v, cur) { if (v == null || isNaN(v)) return '–'; const sym = { GBP: '£', USD: '$', EUR: '€', AUD: 'A$', SGD: 'S$', AED: 'AED ' }[cur] || ''; return sym + Math.round(v).toLocaleString('en-GB'); },
    moneyK(v, cur) { if (v == null || isNaN(v)) return '–'; const sym = { GBP: '£', USD: '$', EUR: '€' }[cur] || ''; return v >= 1e6 ? `${sym}${(v / 1e6).toFixed(2)}m` : `${sym}${Math.round(v / 1e3)}k`; },
    pct(v, d = 1) { if (v == null || isNaN(v)) return '–'; const s = v > 0 ? '+' : ''; return `${s}${v.toFixed(d)}%`; },
    num(v) { return v == null || isNaN(v) ? '–' : Math.round(v).toLocaleString('en-GB'); },
    cls(v) { return v == null || isNaN(v) ? 'mute' : v >= 0 ? 'pos' : 'neg'; },
    date(s) { return s ? s.slice(0, 10) : '–'; },
    month(p) { if (!p) return '–'; const [y, m] = p.split('-'); return new Date(+y, +m - 1, 1).toLocaleString('en-GB', { month: 'short', year: 'numeric' }); },
    ptype(t) { return { detached: 'Detached', semi: 'Semi-detached', terraced: 'Terraced', apartment: 'Flat', land: 'Land', other: 'Other' }[t] || t || '–'; },
    own(o) { return { fee_simple: 'Freehold', leasehold: 'Leasehold', condo: 'Condo', coop: 'Co-op', strata: 'Strata', hdb_lease: 'HDB lease' }[o] || ''; },
  };
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------------------------------------------------------------- routing
  const routes = [];
  function route(pattern, handler) { routes.push({ re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), handler }); }
  async function dispatch() {
    const hash = location.hash.replace(/^#/, '') || '/';
    const app = document.getElementById('app');
    for (const r of routes) {
      const m = hash.match(r.re);
      if (m) {
        app.innerHTML = '<div class="loading">Loading…</div>';
        try { await r.handler(app, Object.fromEntries(Object.entries(m.groups || {}).map(([k, v]) => [k, decodeURIComponent(v)]))); }
        catch (e) { app.innerHTML = `<div class="card"><h2>Could not load this page</h2><p class="note">${esc(e.message)}</p></div>`; console.error(e); }
        window.scrollTo(0, 0);
        return;
      }
    }
    app.innerHTML = '<div class="card"><h2>Not found</h2></div>';
  }

  // ---------------------------------------------------------------- search
  function setupSearch() {
    const q = document.getElementById('q'), out = document.getElementById('q-results');
    let items = [];
    const build = async () => {
      items = [];
      for (const c of state.meta.cities) {
        const s = await city(c.key);
        items.push({ t: s.name, k: `#/city/${c.key}`, m: 'city' });
        for (const a of s.areas) items.push({ t: a.name === a.code ? a.code : `${a.name} (${a.code})`, k: `#/area/${c.key}/${encodeURIComponent(a.code)}`, m: `${s.name} · ${a.level}`, code: a.code.toLowerCase() });
      }
    };
    build();
    q.addEventListener('input', () => {
      const v = q.value.trim().toLowerCase();
      if (!v) { out.style.display = 'none'; return; }
      const hits = items.filter(i => i.t.toLowerCase().includes(v) || (i.code && i.code.startsWith(v))).slice(0, 12);
      out.innerHTML = hits.map(h => `<a href="${h.k}">${esc(h.t)}<small>${esc(h.m)}</small></a>`).join('') || '<a>No matches</a>';
      out.style.display = 'block';
    });
    q.addEventListener('blur', () => setTimeout(() => (out.style.display = 'none'), 150));
    q.addEventListener('focus', () => { if (q.value.trim()) out.style.display = 'block'; });
  }

  /* Same guard for pages that call Plotly directly (country.js, liquidity and tiers blocks in pages.js). */
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
    setupSearch();
    window.addEventListener('hashchange', dispatch);
    dispatch();
  }

  return { state, getJSON, getGz, city, area, h3layer, salesIndex, salesShard, salesDistrict, fmt, el, esc, route, start, safe, __dispatch: dispatch };
})();
