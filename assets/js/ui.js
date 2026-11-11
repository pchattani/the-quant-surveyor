/* UI pieces shared by every view: KPI strip, panels, sortable tables, in-cell bars, flag chips, controls.
   View state (sort column, filters, column set) lives in REI.state.view so it survives navigation and theme switches. */
REI.ui = (function () {
  const { fmt, esc, ok } = REI;
  const S = REI.state.view;
  const st = (id, init) => S[id] || (S[id] = init);
  const $ = id => document.getElementById(id);

  // ---------------------------------------------------------------- in-cell graphics
  /* Fair-value gap bar: the centre tick is fair value, the bar runs to the gap (clipped at ±clip), the thin whisker
     spans the lowest to the highest component measure. Amber = rich, blue = cheap. Colours come from CSS variables. */
  function gapBar(v, lo, hi, o = {}) {
    if (!ok(v)) return '<span class="mute">–</span>';
    const W = o.w || 96, H = 14, c = W / 2, clip = o.clip || 60, sc = (c - 2) / clip;
    const x = t => c + Math.max(-clip, Math.min(clip, t)) * sc;
    const col = v >= 0 ? 'var(--rich)' : 'var(--cheap)';
    const wh = ok(lo) && ok(hi) && hi - lo > 0.05
      ? `<line x1="${x(lo).toFixed(1)}" x2="${x(hi).toFixed(1)}" y1="7" y2="7" style="stroke:var(--ink2)" stroke-width="1"/><line x1="${x(lo).toFixed(1)}" x2="${x(lo).toFixed(1)}" y1="4.5" y2="9.5" style="stroke:var(--ink2)" stroke-width="1"/><line x1="${x(hi).toFixed(1)}" x2="${x(hi).toFixed(1)}" y1="4.5" y2="9.5" style="stroke:var(--ink2)" stroke-width="1"/>` : '';
    const x0 = Math.min(c, x(v)), w = Math.max(1, Math.abs(x(v) - c));
    const over = Math.abs(v) > clip ? `<path d="M${v > 0 ? W - 1 : 1} 3 l${v > 0 ? -3 : 3} 4 l${v > 0 ? 3 : -3} 4z" style="fill:var(--panel)"/>` : '';
    const tip = `${fmt.pct(v)} against fair value${ok(lo) && ok(hi) && hi - lo > 0.05 ? `; measures range ${fmt.pct(lo)} to ${fmt.pct(hi)}` : ''}${Math.abs(v) > clip ? ` (bar clipped at ±${clip}%)` : ''}`;
    return `<span class="gb" title="${esc(tip)}"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><rect x="0" y="6.5" width="${W}" height="1" style="fill:var(--line)"/><rect x="${x0.toFixed(1)}" y="3" width="${w.toFixed(1)}" height="8" style="fill:${col}"/>${over}${wh}<rect x="${c - 0.5}" y="0" width="1" height="${H}" style="fill:var(--mute)"/></svg><span class="gv">${fmt.pct(v)}</span></span>`;
  }
  /* z-score bar, centre = own mean, clipped at ±3. */
  function zBar(z, o = {}) {
    if (!ok(z)) return '<span class="mute">–</span>';
    const W = o.w || 64, H = 14, c = W / 2, sc = (c - 2) / 3, x = c + Math.max(-3, Math.min(3, z)) * sc;
    const col = z >= 0 ? 'var(--rich)' : 'var(--cheap)';
    const g = [-2, 2].map(k => `<rect x="${(c + k * sc - 0.5).toFixed(1)}" y="4" width="1" height="6" style="fill:var(--line2)"/>`).join('');
    return `<span class="gb" title="${fmt.sg(z, 2)} standard deviations from its own mean (ticks at ±2)"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><rect x="0" y="6.5" width="${W}" height="1" style="fill:var(--line)"/>${g}<rect x="${Math.min(c, x).toFixed(1)}" y="3" width="${Math.max(1, Math.abs(x - c)).toFixed(1)}" height="8" style="fill:${col}"/><rect x="${c - 0.5}" y="0" width="1" height="${H}" style="fill:var(--mute)"/></svg><span class="gv" style="min-width:40px">${fmt.sg(z, 2)}</span></span>`;
  }
  const FLAG = { 'very rich': 'rich', rich: 'rich', 'above trend': 'rich', 'premium stretched': 'rich', exuberant: 'rich',
    cheap: 'cheap', 'below trend': 'cheap', 'discount stretched': 'cheap',
    falling: 'risk', drawdown: 'risk', 'rate shock': 'risk', 'credit boom': 'risk', 'debt service high': 'risk', 'unemployment rising': 'risk' };
  const chips = fl => (fl && fl.length ? `<span class="chips">${fl.map(f => `<span class="chip ${FLAG[f] || ''}">${esc(f)}</span>`).join('')}</span>` : '<span class="mute">–</span>');
  /* signed number, coloured by direction (used for price changes only) */
  const chg = (v, d = 1, sfx = '%') => (ok(v) ? `<span class="${fmt.cls(v)}">${fmt.sg(v, d)}${sfx}</span>` : '<span class="mute">–</span>');
  const num = (v, d = 1, sfx = '') => (ok(v) ? fmt.fx(v, d) + sfx : '<span class="mute">–</span>');
  const sgn = (v, d = 1, sfx = '') => (ok(v) ? fmt.sg(v, d) + sfx : '<span class="mute">–</span>');
  const txt = v => (v == null || v === '' ? '<span class="mute">–</span>' : esc(v));

  /* inline sparkline; the last point is marked */
  function spark(vals, o = {}) {
    const v = (vals || []).filter(ok);
    if (v.length < 3) return '';
    const W = o.w || 72, H = o.h || 22, lo = Math.min(...v), hi = Math.max(...v), r = hi - lo || 1;
    const X = i => 1 + i * (W - 4) / (v.length - 1), Y = t => 2 + (H - 4) * (1 - (t - lo) / r);
    const z = lo < 0 && hi > 0 ? `<line x1="0" x2="${W}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}" style="stroke:var(--line2)" stroke-width="1"/>` : '';
    return `<svg class="sp" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${z}<polyline points="${v.map((t, i) => `${X(i).toFixed(1)},${Y(t).toFixed(1)}`).join(' ')}" fill="none" style="stroke:var(--ink2)" stroke-width="1.3"/><circle cx="${X(v.length - 1).toFixed(1)}" cy="${Y(v[v.length - 1]).toFixed(1)}" r="2" style="fill:var(--ink)"/></svg>`;
  }

  // ---------------------------------------------------------------- blocks
  const kpis = items => `<div class="kpis">${items.filter(Boolean).map(k => `<div class="kpi"${k.t ? ` title="${esc(k.t)}"` : ''}>${k.sp || ''}<div class="k">${esc(k.k)}</div><div class="v${k.cls ? ' ' + k.cls : ''}">${k.v}</div>${k.s ? `<div class="s">${k.s}</div>` : ''}</div>`).join('')}</div>`;
  const panel = (title, sub, body, o = {}) => `<section class="pnl"${o.id ? ` id="${o.id}"` : ''}><div class="pnl-h"><h2>${esc(title)}</h2>${sub ? `<span class="hs">${sub}</span>` : ''}</div><div class="pnl-b${o.flush ? ' flush' : ''}">${body}</div></section>`;
  const head = (title, sub, meta, crumbs) => `${crumbs ? `<div class="crumbs">${crumbs}</div>` : ''}<div class="ph"><div><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${meta ? `<div class="meta">${meta}</div>` : ''}</div>`;
  const badge = (t, warn) => `<span class="badge${warn ? ' warn' : ''}">${esc(t)}</span>`;
  const seg = (id, opts, cur) => `<span class="seg" id="${id}">${opts.map(([v, l]) => `<button type="button" data-v="${esc(v)}" class="${v === cur ? 'on' : ''}">${esc(l)}</button>`).join('')}</span>`;
  const select = (id, label, opts, cur) => `<label for="${id}">${esc(label)}</label><select id="${id}">${opts.map(([v, l]) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const search = (id, ph, cur) => `<input type="search" id="${id}" placeholder="${esc(ph)}" value="${esc(cur || '')}" aria-label="${esc(ph)}">`;
  function onSeg(id, fn) {
    const e = $(id); if (!e) return;
    e.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { e.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); fn(b.dataset.v); }));
  }
  const onChange = (id, fn) => { const e = $(id); if (e) e.addEventListener('change', () => fn(e.value)); };
  const onInput = (id, fn) => { const e = $(id); if (e) e.addEventListener('input', () => fn(e.value)); };

  // ---------------------------------------------------------------- sortable table
  /* cols: [{k, h, t (header tooltip), l (left-aligned), f(row) -> html, v(row) -> sort value, cls, ns (not sortable)}]
     o: {id, cols, rows, sort, dir, limit, cap, rowCls, empty, foot} */
  function table(host, o) {
    host = typeof host === 'string' ? $(host) : host;
    if (!host) return { update() {}, cols() {} };
    const s = st('tbl:' + o.id, { sort: o.sort, dir: o.dir || -1, all: false });
    function draw() {
      const cols = o.cols;
      if (!cols.some(c => c.k === s.sort)) { s.sort = o.sort && cols.some(c => c.k === o.sort) ? o.sort : null; }
      const c = cols.find(x => x.k === s.sort);
      const rows = o.rows.slice();
      if (c) {
        const val = c.v || (r => r[c.k]);
        rows.sort((a, b) => {
          const x = val(a), y = val(b), nx = x == null || x !== x, ny = y == null || y !== y;
          if (nx || ny) return nx - ny;
          return (typeof x === 'string' ? x.localeCompare(String(y)) : x - y) * s.dir;
        });
      }
      const n = rows.length, lim = s.all || !o.limit ? n : Math.min(n, o.limit);
      const th = cols.map(x => `<th class="${x.l ? 'l ' : ''}${x.ns ? 'ns ' : ''}${x.k === s.sort ? 'on' + (s.dir > 0 ? ' asc' : '') : ''}" data-k="${x.k}"${x.t ? ` title="${esc(x.t)}"` : ''}>${x.h}</th>`).join('');
      const body = rows.slice(0, lim).map(r => `<tr${o.rowCls && o.rowCls(r) ? ` class="${o.rowCls(r)}"` : ''}>${cols.map(x => `<td class="${x.l ? 'l ' : ''}${x.cls || ''}">${x.f ? x.f(r) : txt(r[x.k])}</td>`).join('')}</tr>`).join('');
      const more = lim < n ? `<button type="button" class="btn" data-all="1">Show all ${n.toLocaleString('en-GB')}</button>` : (s.all && o.limit && n > o.limit ? `<button type="button" class="btn" data-all="0">Show top ${o.limit}</button>` : '');
      const foot = (o.foot || more) ? `<div class="tbl-foot"><span>${o.foot ? o.foot(n, lim) : `${lim.toLocaleString('en-GB')} of ${n.toLocaleString('en-GB')} rows`}</span>${more}</div>` : '';
      host.innerHTML = n ? `<div class="tw${o.cap ? ' cap' : ''}"><table class="tbl"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>${foot}` : `<p class="empty">${esc(o.empty || 'No rows match these filters.')}</p>`;
      host.querySelectorAll('th[data-k]').forEach(h => h.addEventListener('click', () => {
        const col = cols.find(x => x.k === h.dataset.k);
        if (!col || col.ns) return;
        if (s.sort === col.k) s.dir = -s.dir; else { s.sort = col.k; s.dir = col.l ? 1 : -1; }
        draw();
      }));
      host.querySelectorAll('button[data-all]').forEach(b => b.addEventListener('click', () => { s.all = b.dataset.all === '1'; draw(); }));
    }
    draw();
    return { update(rows) { o.rows = rows; draw(); }, cols(cols) { o.cols = cols; draw(); }, set(rows, cols) { o.rows = rows; o.cols = cols; draw(); } };
  }

  return { st, $, gapBar, zBar, chips, chg, num, sgn, txt, spark, kpis, panel, head, badge, seg, select, search, onSeg, onChange, onInput, table, FLAG };
})();
