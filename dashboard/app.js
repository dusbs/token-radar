/* Token Radar — the dashboard. Static page, no network: it reads window.RADAR
   (the generated data.js beside it) and renders the board, a detail view for
   every protocol, filters, and the "already trading" list. */
'use strict';

const D = (typeof window !== 'undefined' && window.RADAR) || null;

/* --------------------------------------------------------------- helpers */

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function money(n) {
  return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function pct(n) {
  if (n === null || n === undefined) return '—';
  return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
}
function shortChains(row) {
  const list = row.ch.slice(0, 2).join(', ');
  return row.cn > row.ch.length ? list + ' +' + (row.cn - row.ch.length) + ' more' : list;
}

/* --------------------------------------------------------------- farm steps
   == farm steps: begin ==
   The same four templates main.ts uses for board.json, so the plan a reader
   sees on the page is the plan the board holds. Derived only from the
   protocol's own record (category, chains, TVL, age) — never a hand-written
   list of names, never promising a token, an airdrop or a date. */

function stepText(step) {
  let s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
  if (s.length > 600) s = s.slice(0, 596) + '...';
  if (s.length < 20) s = s + ' Keep the position open and check the protocol\'s own page.';
  return s;
}
function chainOfRow(row) {
  return row.ch.length > 0 ? row.ch[0] : 'its main chain';
}
function capitalForRow(row) {
  if (row.t >= 5000000000) return 500;
  if (row.t >= 1000000000) return 250;
  if (row.t >= 100000000) return 150;
  return 100;
}
function holdDaysForRow(age) {
  if (age === null || age === undefined) return 60;
  if (age < 180) return 90;
  if (age < 365) return 60;
  return 45;
}
function actionForRow(row, capital, chain) {
  const c = (row.c || '').toLowerCase();
  const name = row.n;
  if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' as a lender and keep the deposit open.';
  if (c.indexOf('dex') >= 0) return 'Add $' + capital + ' of liquidity to ' + name + '\'s deepest pool on ' + chain + ' and keep the position open.';
  if (c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0 || c.indexOf('farm') >= 0) return 'Deposit $' + capital + ' of USDC into ' + name + '\'s highest-yield vault on ' + chain + ' and keep the shares.';
  if (c.indexOf('derivative') >= 0 || c.indexOf('basis trading') >= 0 || c.indexOf('options') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' (' + chain + ') and open one small hedged position.';
  if (c.indexOf('rwa') >= 0) return 'Mint $' + capital + ' of ' + name + '\'s yield-bearing asset on ' + chain + ' and hold it.';
  if (c.indexOf('risk curator') >= 0 || c.indexOf('capital allocator') >= 0) return 'Deposit $' + capital + ' of USDC into a ' + name + ' curator vault on ' + chain + ' and keep the shares.';
  if (c.indexOf('restak') >= 0 || c.indexOf('staking pool') >= 0) return 'Stake $' + capital + ' of the chain\'s native asset through ' + name + ' on ' + chain + ' and keep the receipt.';
  if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy active.';
  if (c.indexOf('payment') >= 0 || c.indexOf('crypto card') >= 0) return 'Route $' + capital + ' of spending through ' + name + ' on ' + chain + ' and keep the account active.';
  if (c.indexOf('stablecoin wrapper') >= 0 || c.indexOf('dual-token') >= 0 || c.indexOf('algo-stable') >= 0) return 'Mint $' + capital + ' of the stable asset through ' + name + ' on ' + chain + ' and hold it.';
  if (c.indexOf('liquidity manager') >= 0) return 'Deposit $' + capital + ' of USDC into a ' + name + ' managed pool on ' + chain + ' and keep the position open.';
  if (c === 'chain') return 'Bridge $' + capital + ' of USDC to ' + name + ' and use it in one app on the chain.';
  if (c.indexOf('anchor btc') >= 0 || c.indexOf('decentralized btc') >= 0) return 'Deposit $' + capital + ' of BTC through ' + name + ' and keep the receipt.';
  if (c.indexOf('governance incentive') >= 0) return 'Lock $' + capital + ' of the governance asset through ' + name + ' and vote once.';
  return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
}
function farmStepsFor(row) {
  const chain = chainOfRow(row);
  const capital = capitalForRow(row);
  const hold = holdDaysForRow(row.a);
  const gas = capital >= 250 ? 10 : 5;
  return [
    stepText({ text: 'Open a fresh wallet for this farm and keep its seed phrase offline, never in a screenshot or a chat.', cost: 'no cost to create the wallet', time: '5 minutes' }),
    stepText({ text: actionForRow(row, capital, chain), cost: '$' + capital + ' of capital plus about $' + gas + ' of gas', time: 'about 15 minutes to set up' }),
    stepText({ text: 'Repeat one qualifying action each week — a deposit, a swap, a vote or a borrow — and keep the position open for at least ' + hold + ' days.', cost: 'about $2 of gas a week on top of the $' + capital + ' already in the position', time: '10 minutes a week for ' + hold + ' days' }),
    stepText({ text: 'Check the protocol\'s own rewards page, if it publishes one, and claim only through a link it publishes; then write the wallet, the dates and every transaction in a farm log.', cost: 'nothing to check; never pay a fee to claim', time: '10 minutes' }),
  ];
}
// == farm steps: end ==

/* --------------------------------------------------------------- state */

const state = { view: 'board', slug: '', q: '', cat: '', chain: '', minTvl: '', pos: false, sort: 'r', dir: 1 };

function parseHash() {
  const h = location.hash || '';
  state.view = 'board'; state.slug = ''; state.q = ''; state.cat = ''; state.chain = ''; state.minTvl = ''; state.pos = false; state.sort = 'r'; state.dir = 1;
  let m = h.match(/^#\/protocol\/([A-Za-z0-9._-]+)/);
  if (m) { state.view = 'detail'; state.slug = decodeURIComponent(m[1]); return; }
  m = h.match(/^#\/filter\?(.*)$/);
  if (m) {
    const p = new URLSearchParams(m[1]);
    state.q = p.get('q') || '';
    state.cat = p.get('cat') || '';
    state.chain = p.get('chain') || '';
    state.minTvl = p.get('min') || '';
    state.pos = p.get('pos') === '1';
    const s = p.get('sort');
    if (s === 'r' || s === 'v' || s === 't' || s === 'g') state.sort = s;
    state.dir = p.get('dir') === 'desc' ? -1 : 1;
  }
}

function writeHash() {
  if (state.view === 'detail') { location.hash = '#/protocol/' + encodeURIComponent(state.slug); return; }
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  if (state.cat) p.set('cat', state.cat);
  if (state.chain) p.set('chain', state.chain);
  if (state.minTvl) p.set('min', state.minTvl);
  if (state.pos) p.set('pos', '1');
  if (state.sort !== 'r') p.set('sort', state.sort);
  if (state.dir === -1) p.set('dir', 'desc');
  const q = p.toString();
  location.hash = q ? '#/filter?' + q : '#/';
}

/* --------------------------------------------------------------- data views */

function filteredRows() {
  const q = state.q.trim().toLowerCase();
  const min = state.minTvl === '' ? 0 : Number(state.minTvl) || 0;
  let rows = D.rows.filter(function (r) {
    if (q && r.n.toLowerCase().indexOf(q) < 0 && r.s.toLowerCase().indexOf(q) < 0) return false;
    if (state.cat && r.c !== state.cat) return false;
    if (state.chain && r.ch.indexOf(state.chain) < 0) return false;
    if (r.t < min) return false;
    if (state.pos && !(r.g !== null && r.g > 0)) return false;
    return true;
  });
  const key = state.sort;
  const dir = state.dir;
  rows = rows.slice().sort(function (a, b) {
    let d = 0;
    if (key === 'r') d = a.r - b.r;
    else if (key === 'v') d = a.v - b.v;
    else if (key === 't') d = a.t - b.t;
    else d = (a.g === null ? -Infinity : a.g) - (b.g === null ? -Infinity : b.g);
    if (d === 0) d = a.s < b.s ? -1 : 1;
    return d * dir;
  });
  return rows;
}

function growthClass(g) {
  if (g === null) return 'flat';
  return g > 0 ? 'up' : g < 0 ? 'down' : 'flat';
}

function optionList(values, current, label) {
  let h = '<option value="">' + esc(label) + '</option>';
  values.forEach(function (v) {
    h += '<option value="' + esc(v) + '"' + (v === current ? ' selected' : '') + '>' + esc(v) + '</option>';
  });
  return h;
}

function controlsHtml() {
  const cats = [];
  const chains = [];
  D.rows.forEach(function (r) {
    if (r.c && cats.indexOf(r.c) < 0) cats.push(r.c);
    r.ch.forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
  });
  cats.sort();
  chains.sort();
  return '<section aria-label="Filters"><div class="controls">'
    + '<div class="field search"><label for="q">Search</label><input id="q" type="search" placeholder="Name or slug…" value="' + esc(state.q) + '"></div>'
    + '<div class="field"><label for="cat">Category</label><select id="cat">' + optionList(cats, state.cat, 'All categories') + '</select></div>'
    + '<div class="field"><label for="chain">Chain</label><select id="chain">' + optionList(chains, state.chain, 'All chains') + '</select></div>'
    + '<div class="field"><label for="min">Min TVL ($)</label><input id="min" type="number" min="0" step="1000000" placeholder="0" value="' + esc(state.minTvl) + '"></div>'
    + '<label class="field check"><input id="pos" type="checkbox"' + (state.pos ? ' checked' : '') + '> Growing only (7d &gt; 0)</label>'
    + '</div></section>';
}

function tableHtml(rows) {
  const arrow = function (key) {
    if (state.sort !== key) return '';
    return state.dir === 1 ? ' ▲' : ' ▼';
  };
  if (rows.length === 0) {
    return '<div class="empty">No protocol matches these filters. <a href="#/">Clear the filters</a>.</div>';
  }
  let h = '<div style="overflow-x:auto"><table class="board"><thead><tr>'
    + '<th><button data-sort="r">Rank' + arrow('r') + '</button></th>'
    + '<th>Protocol</th><th>Category</th><th>Chains</th>'
    + '<th class="num"><button data-sort="t">TVL' + arrow('t') + '</button></th>'
    + '<th class="num"><button data-sort="g">7d' + arrow('g') + '</button></th>'
    + '<th class="num"><button data-sort="v">Implied value' + arrow('v') + '</button></th>'
    + '</tr></thead><tbody>';
  rows.forEach(function (r) {
    h += '<tr data-slug="' + esc(r.s) + '"><td class="rank">' + r.r + '</td>'
      + '<td class="name"><b>' + esc(r.n) + '</b><span>' + esc(r.s) + '</span>' + (r.w ? '<span class="tag">WATCHLIST</span>' : '') + '</td>'
      + '<td>' + esc(r.c || '—') + '</td>'
      + '<td>' + esc(shortChains(r)) + '</td>'
      + '<td class="num">' + money(r.t) + '</td>'
      + '<td class="num ' + growthClass(r.g) + '">' + pct(r.g) + '</td>'
      + '<td class="num"><b>' + money(r.v) + '</b></td></tr>';
  });
  return h + '</tbody></table></div>';
}

function countHtml(n) {
  return 'Showing ' + n + ' of ' + D.rows.length + ' ranked protocols · click a row for its detail view and farm plan · click a column header to sort.';
}

function boardHtml(rows) {
  return controlsHtml()
    + '<p class="count" id="boardcount">' + countHtml(rows.length) + '</p>'
    + '<div id="boardtable">' + tableHtml(rows) + '</div>';
}

function detailHtml(row) {
  const m = D.model;
  const base = Math.round(row.t * m.base_multiple);
  const growthShown = row.g === null ? 0 : Math.max(m.growth_floor, Math.min(m.growth_cap, row.g));
  const raw = Math.round(base * row.gm * row.mm);
  const steps = farmStepsFor(row);
  let h = '<a class="back" href="#/">← Back to the board</a>'
    + '<article class="detail"><h2>' + esc(row.n) + (row.w ? '<span class="tag">ON THE HOUSE WATCHLIST</span>' : '') + '</h2>'
    + '<p class="sub">' + esc(row.s) + ' · ' + esc(row.c || 'no category named') + ' · ' + esc(row.ch.join(', ')) + (row.cn > row.ch.length ? ' +' + (row.cn - row.ch.length) + ' more' : '') + ' · rank ' + row.r + ' of ' + D.rows.length + '</p>'
    + '<p>This protocol <b>records no token</b> in the snapshot: no market cap, no CoinGecko id, no symbol. That is what the record says — not proof it has none — and it is why the board ranks it as a launch candidate.</p>'
    + '<h3>Implied value — how the number is built</h3><div class="formula">'
    + 'TVL&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + money(row.t) + '<br>'
    + '× base multiple&nbsp;&nbsp;' + m.base_multiple + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;→ base&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + money(base) + '<br>'
    + '× growth&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + (row.g === null ? 'not reported → 0.0%' : pct(row.g) + ' → clamped ' + pct(growthShown)) + '&nbsp;&nbsp;→ ×' + row.gm.toFixed(4) + '<br>'
    + '× age&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + (row.a === null ? 'listing date not reported → 730 days assumed' : row.a + ' days since listing') + '&nbsp;&nbsp;→ ×' + row.mm.toFixed(4) + '<br>'
    + '= raw value&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + money(raw) + '<br>'
    + (row.tb !== 0 ? 'rank tie-break&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + money(row.tb) + '<br>' : '')
    + '= <b>implied value&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + money(row.v) + '</b>'
    + '</div>'
    + '<h3>Farm plan — four steps</h3><ol class="steps">';
  steps.forEach(function (s) { h += '<li>' + esc(s) + '</li>'; });
  h += '</ol><p style="color:var(--mut)">Costs are in US dollars of capital and gas; times are wall-clock time. Nothing here promises a token, an airdrop or a date — the plan is what to do so that, if this protocol ever issues one, the position is already there.</p></article>';
  return h;
}

function methodHtml() {
  const m = D.model;
  return '<section class="method"><h2>Methodology — model ' + esc(D.mv) + '</h2>'
    + '<p>Implied value = <code>TVL × ' + m.base_multiple + '</code> × <code>1 + clamp(7d growth, ' + m.growth_floor + '%, ' + m.growth_cap + '%) / 100 × ' + m.growth_weight + '</code> × <code>' + m.age_floor + ' + ' + m.age_range + ' × min(age, ' + m.age_days + ' days) / ' + m.age_days + '</code>. Age is days from listing to the snapshot date (' + esc(D.asof) + '); when no listing date is reported, 730 days is assumed. Growth is clamped because one week in the snapshot runs to +4,448% — a spike is not a valuation. Both multipliers are rounded to four decimals before they are multiplied, so the arithmetic in each detail view reconciles exactly from the figures it shows. After ranking, any tie from rounding is broken by shaving $1 per step so ranks are strictly ordered; the shave is shown as the tie-break in each detail view.</p>'
    + '<p>The board holds the whole house watchlist (' + D.wl + ' protocols at or above the ' + money(D.floor) + ' floor that record no token and are not wrapped, staked or bridged products) plus the ' + D.es + ' highest-TVL pre-token protocols below the floor that pass the same exclusion rule. Protocols whose token already trades are not ranked: they are listed separately below, at the market\'s own values. Every figure comes from the sealed snapshot alone; no name is ever special-cased.</p></section>';
}

function liveHtml() {
  let h = '<section class="live"><h2>Already trading — not ranked</h2>'
    + '<p>These protocols record a token that already trades, so the board does not rank them. Their values below are the market\'s own market caps from the snapshot, not this entry\'s model. The top ' + D.live.length + ' by market cap:</p>'
    + '<div style="overflow-x:auto"><table><thead><tr><th>Protocol</th><th>Category</th><th class="num">TVL</th><th class="num">Market cap</th></tr></thead><tbody>';
  D.live.forEach(function (r) {
    h += '<tr><td><b>' + esc(r.n) + '</b> <span style="color:var(--dim);font:12px var(--mono)">' + esc(r.s) + '</span></td><td>' + esc(r.c || '—') + '</td><td class="num">' + money(r.t) + '</td><td class="num">' + money(r.m || 0) + '</td></tr>';
  });
  return h + '</tbody></table></div></section>';
}

function statsHtml() {
  const top = D.rows[0];
  return '<ul class="stats">'
    + '<li><b>' + D.rows.length + '</b><span>protocols ranked</span></li>'
    + '<li><b>' + D.wl + '</b><span>on the watchlist</span></li>'
    + '<li><b>' + D.es + '</b><span>early finds below the floor</span></li>'
    + '<li><b>' + money(D.floor) + '</b><span>watchlist floor (TVL)</span></li>'
    + '<li><b>' + money(top ? top.v : 0) + '</b><span>top implied value' + (top ? ' · ' + esc(top.n) : '') + '</span></li>'
    + '</ul>';
}

/* --------------------------------------------------------------- render */

function render() {
  const app = document.getElementById('app');
  if (!D) {
    app.innerHTML = '<div class="empty">The dashboard data did not load. The page needs data.js beside it.</div>';
    app.setAttribute('aria-busy', 'false');
    return;
  }
  document.getElementById('meta').textContent = 'Snapshot ' + D.asof + ' · ' + D.src + ' · ' + D.rows.length + ' ranked · ' + D.live.length + ' already trading, shown separately';
  let h = statsHtml();
  if (state.view === 'detail') {
    const row = D.rows.find(function (r) { return r.s === state.slug; });
    h += row ? detailHtml(row) : '<div class="empty">“' + esc(state.slug) + '” is not on this board. <a href="#/">Back to the board</a>.</div>';
  } else {
    h += boardHtml(filteredRows());
    h += methodHtml();
    h += liveHtml();
  }
  app.innerHTML = h;
  app.setAttribute('aria-busy', 'false');
  bind();
}

/* Re-render only the table and the count, so typing in a filter never loses
   focus; the hash is written on a short delay while typing. */
let hashTimer = null;
function scheduleHash() {
  if (hashTimer) clearTimeout(hashTimer);
  hashTimer = setTimeout(writeHash, 400);
}
function updateBoard() {
  const rows = filteredRows();
  const count = document.getElementById('boardcount');
  if (count) count.textContent = countHtml(rows.length);
  const table = document.getElementById('boardtable');
  if (table) { table.innerHTML = tableHtml(rows); bindTable(); }
}

function bindTable() {
  const app = document.getElementById('app');
  app.querySelectorAll('th button[data-sort]').forEach(function (b) {
    b.addEventListener('click', function () {
      const k = b.getAttribute('data-sort');
      if (state.sort === k) state.dir = -state.dir;
      else { state.sort = k; state.dir = k === 'r' ? 1 : -1; }
      updateBoard();
      writeHash();
    });
  });
  app.querySelectorAll('tr[data-slug]').forEach(function (tr) {
    tr.addEventListener('click', function () {
      state.view = 'detail';
      state.slug = tr.getAttribute('data-slug');
      writeHash();
    });
  });
}

function bind() {
  const q = document.getElementById('q');
  if (q) q.addEventListener('input', function () { state.q = q.value; updateBoard(); scheduleHash(); });
  const cat = document.getElementById('cat');
  if (cat) cat.addEventListener('change', function () { state.cat = cat.value; updateBoard(); writeHash(); });
  const chain = document.getElementById('chain');
  if (chain) chain.addEventListener('change', function () { state.chain = chain.value; updateBoard(); writeHash(); });
  const min = document.getElementById('min');
  if (min) min.addEventListener('input', function () { state.minTvl = min.value; updateBoard(); scheduleHash(); });
  const pos = document.getElementById('pos');
  if (pos) pos.addEventListener('change', function () { state.pos = pos.checked; updateBoard(); writeHash(); });
  bindTable();
}

function init() {
  parseHash();
  render();
  window.addEventListener('hashchange', function () { parseHash(); render(); });
}

if (typeof document !== 'undefined' && document.getElementById) init();
