/* Market simulator: replay of real daily history (tick-by-tick inside each day) or a live crypto feed.
   Paper money only. Long-only, no leverage, matching the course rules. */
window.SIM = (function () {
  const { $, $$, h, esc, num, pct, money, stats: S } = U;
  const SIM = {};

  /* Intraday path through a real day's open/high/low/close. Order of high/low follows the candle color. */
  SIM.dayPath = (o, hi, lo, c, n, rnd) => {
    const upFirst = c < o ? rnd() < 0.7 : rnd() < 0.3; // red candles usually rally first, then fall
    const k1 = Math.max(1, Math.floor(n * (0.15 + rnd() * 0.3))), k2 = Math.min(n - 2, k1 + Math.floor(n * (0.2 + rnd() * 0.3)));
    const pts = [[0, o], [k1, upFirst ? hi : lo], [k2, upFirst ? lo : hi], [n - 1, c]];
    const out = [];
    for (let s = 0; s < pts.length - 1; s++) {
      const [i0, v0] = pts[s], [i1, v1] = pts[s + 1];
      for (let i = i0; i < i1; i++) { const t = (i - i0) / (i1 - i0); const noise = (rnd() - 0.5) * (hi - lo) * 0.12 * Math.sin(Math.PI * t); out.push(U.clamp(v0 + (v1 - v0) * t + noise, lo, hi)); }
    }
    out.push(c);
    out[pts[1][0]] = pts[1][1]; out[pts[2][0]] = pts[2][1];
    return out;
  };

  const SCEN = {
    blind: { n: 'עיוור: שנה אקראית, נכס ותאריכים מוסתרים', blind: true },
    recent: { n: 'השנה האחרונה' },
    covid: { n: 'קורונה 2020', from: '2020-01-02', to: '2020-12-31' },
    gfc: { n: 'המשבר הפיננסי 2007–2009', from: '2007-10-01', to: '2009-12-31' },
    bear22: { n: 'שוק דובי 2022', from: '2022-01-03', to: '2023-06-30' },
    dotcom: { n: 'בועת הדוט-קום 2000–2003', from: '2000-03-01', to: '2003-12-31' },
    tariff25: { n: 'ירידת המכסים 2025', from: '2025-01-02', to: '2025-09-30' },
    custom: { n: 'בחר תאריך התחלה' }
  };
  const SPEEDS = [[0, '❚❚'], [450, '1×'], [180, '3×'], [60, '10×'], [12, '50×']];
  const T = 26; // ticks per trading day (~15 minutes each)
  const FEES = {
    ibkr: { n: 'IBKR Tiered', f: (v, q, cur) => cur === 'ILS' ? Math.max(5, v * 0.0008) : Math.min(v * 0.01, Math.max(0.35, q * 0.0035)) },
    onezero: { n: 'One Zero (0.1%, מינ\' 2)', f: (v) => Math.max(2, v * 0.001) },
    bank: { n: 'בנק במחירון (0.6%, מינ\' 25)', f: (v) => Math.max(25, v * 0.006) },
    crypto: { n: 'בורסת קריפטו (0.1%)', f: (v) => v * 0.001 },
    zero: { n: 'אפס עמלה', f: () => 0 }
  };
  const REASONS = ['לפי התוכנית (IPS)', 'הפקדה חודשית', 'איזון מחדש', 'מגמה / ממוצע נע', 'חדשות', 'תחושת בטן', 'פחד מירידה', 'פחד לפספס (FOMO)'];

  let st = null, chart = null, cs = null, maS = null, maL = null, timer = null, root = null, ws = null, lines = {}, lastSave = 0, eqDrawT = 0;

  const fresh = () => ({ mode: 'replay', sym: 'SPY', scen: 'blind', fee: 'ibkr', speed: 1, cash: 100000, start: 100000, qty: 0, avg: 0, realized: 0, costs: { fee: 0, spread: 0, slip: 0 }, orders: [], trades: [], eq: [], coach: [], flags: {}, halted: false, done: false, oid: 1, peakEq: 100000 });

  /* ---------- rendering ---------- */
  SIM.mount = (host) => {
    root = host;
    const saved = APP.state.simSession;
    host.innerHTML = `
    <div class="sim">
      <div class="sim-top">
        <div class="seg" role="tablist" id="sm-mode"><button data-m="replay" class="on">היסטוריה אמיתית</button><button data-m="live">זמן אמת</button></div>
        <div class="sim-setup" id="sm-setup"></div>
      </div>
      <div class="sim-grid">
        <section class="sim-main">
          <div class="quote" id="sm-quote"><div class="q-name"></div><div class="q-px"></div><div class="q-ch"></div><div class="q-ba"></div><div class="q-date"></div></div>
          <div class="sim-chart" id="sm-chart"></div>
          <div class="sim-bar" id="sm-play"></div>
          <div class="trade-btns"><button class="btn buy" id="sm-buy">קנה <kbd>B</kbd></button><button class="btn sell" id="sm-sell">מכור <kbd>S</kbd></button></div>
        </section>
        <aside class="sim-side">
          <div class="ticket" id="sm-ticket" hidden></div>
          <div class="acct" id="sm-acct"></div>
          <div class="eq-host" id="sm-eq"></div>
        </aside>
      </div>
      <div class="sim-tabs"><div class="seg" id="sm-tabs"><button data-t="coach" class="on">המאמן</button><button data-t="orders">פקודות</button><button data-t="trades">יומן עסקאות</button><button data-t="history">סשנים קודמים</button></div><div id="sm-tab"></div></div>
    </div>`;
    $$('#sm-mode button', host).forEach((b) => b.addEventListener('click', () => { if (b.dataset.m === st.mode) return; switchMode(b.dataset.m); }));
    $$('#sm-tabs button', host).forEach((b) => b.addEventListener('click', () => { $$('#sm-tabs button', host).forEach((x) => x.classList.toggle('on', x === b)); renderTab(b.dataset.t); U.tone('tap'); }));
    $('#sm-buy', host).addEventListener('click', () => openTicket('buy'));
    $('#sm-sell', host).addEventListener('click', () => openTicket('sell'));
    document.addEventListener('keydown', keys);
    makeChart();
    if (saved && saved.mode === 'replay' && !saved.done) { st = Object.assign(fresh(), saved); st.speed = 0; resumeReplay(); }
    else { st = fresh(); st.fee = APP.state.simFee || 'ibkr'; renderSetup(); newReplay(); }
  };
  SIM.unmount = () => { stopTimer(); closeLive(); document.removeEventListener('keydown', keys); if (chart) { chart.remove(); chart = null; } persist(true); };
  SIM.refreshTheme = () => { if (chart) chart.applyOptions(chartOpts()); if (cs) cs.applyOptions(candleOpts()); };

  const keys = (e) => { if (!root || !document.body.contains(root) || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return; if (e.key === 'b' || e.key === 'B') openTicket('buy'); if (e.key === 's' || e.key === 'S') openTicket('sell'); if (e.key === ' ') { e.preventDefault(); setSpeed(st.speed ? 0 : 1); } if (e.key === 'Escape') closeTicket(); };

  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const chartOpts = () => ({ layout: { background: { type: 'solid', color: css('--surface') }, textColor: css('--muted'), fontFamily: css('--f-mono') || 'monospace' }, grid: { vertLines: { color: css('--line') }, horzLines: { color: css('--line') } }, rightPriceScale: { borderColor: css('--line') }, timeScale: { borderColor: css('--line'), timeVisible: st && st.mode === 'live', visible: !(st && st.blind) }, crosshair: { mode: 0 }, localization: { locale: 'he-IL', priceFormatter: (v) => U.price(v) } });
  const candleOpts = () => ({ upColor: css('--up'), downColor: css('--down'), wickUpColor: css('--up'), wickDownColor: css('--down'), borderVisible: false });
  const makeChart = () => {
    const el = $('#sm-chart', root);
    if (!window.LightweightCharts) { el.innerHTML = '<div class="fallback-chart"></div>'; return; }
    chart = LightweightCharts.createChart(el, Object.assign({ autoSize: true }, chartOpts()));
    cs = chart.addCandlestickSeries(candleOpts());
    maS = chart.addLineSeries({ color: css('--s2') || '#888', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    maL = chart.addLineSeries({ color: css('--accent') || '#c80', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  };

  const renderSetup = () => {
    const el = $('#sm-setup', root);
    if (st.mode === 'replay') {
      el.innerHTML = `<select id="sm-sym" aria-label="נכס">${Object.entries(U.ASSETS).filter(([k]) => k !== 'ILS=X').map(([k, v]) => `<option value="${k}"${k === st.sym ? ' selected' : ''}>${esc(v.name)}</option>`).join('')}</select><select id="sm-scen" aria-label="תרחיש">${Object.entries(SCEN).map(([k, v]) => `<option value="${k}"${k === st.scen ? ' selected' : ''}>${v.n}</option>`).join('')}</select><input type="date" id="sm-from" value="${st.customFrom || '2018-01-02'}" ${st.scen === 'custom' ? '' : 'hidden'} aria-label="תאריך התחלה"><select id="sm-fee" aria-label="עמלות">${Object.entries(FEES).map(([k, v]) => `<option value="${k}"${k === st.fee ? ' selected' : ''}>${v.n}</option>`).join('')}</select><button class="btn ghost" id="sm-new">סשן חדש</button>`;
      $('#sm-scen', el).addEventListener('change', (e) => { $('#sm-from', el).hidden = e.target.value !== 'custom'; });
      $('#sm-fee', el).addEventListener('change', (e) => { st.fee = e.target.value; APP.state.simFee = st.fee; APP.persist(); renderAcct(); });
      $('#sm-new', el).addEventListener('click', () => { st.sym = $('#sm-sym', el).value; st.scen = $('#sm-scen', el).value; st.customFrom = $('#sm-from', el).value; newReplay(); U.tone('tap'); });
    } else {
      el.innerHTML = `<select id="sm-live" aria-label="נכס חי"><option value="cb:BTC-USD">Bitcoin (Coinbase)</option><option value="cb:ETH-USD">Ethereum (Coinbase)</option><option value="cb:SOL-USD">Solana (Coinbase)</option>${APP.state.settings.finnhub ? ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA'].map((s) => `<option value="fh:${s}">${s} (Finnhub)</option>`).join('') : ''}</select><select id="sm-fee" aria-label="עמלות">${Object.entries(FEES).map(([k, v]) => `<option value="${k}"${k === st.fee ? ' selected' : ''}>${v.n}</option>`).join('')}</select><button class="btn ghost" id="sm-new">התחבר מחדש</button>`;
      $('#sm-fee', el).addEventListener('change', (e) => { st.fee = e.target.value; renderAcct(); });
      $('#sm-new', el).addEventListener('click', () => startLive($('#sm-live', el).value));
      $('#sm-live', el).addEventListener('change', (e) => startLive(e.target.value));
    }
  };

  const switchMode = (m) => {
    stopTimer(); closeLive(); persist(true);
    $$('#sm-mode button', root).forEach((b) => b.classList.toggle('on', b.dataset.m === m));
    st = fresh(); st.mode = m; st.fee = m === 'live' ? 'crypto' : (APP.state.simFee || 'ibkr');
    renderSetup();
    if (m === 'live') startLive('cb:BTC-USD'); else newReplay();
  };

  /* ---------- replay ---------- */
  async function newReplay() {
    stopTimer(); clearLines();
    const keep = { mode: 'replay', sym: st.sym, scen: st.scen, fee: st.fee, customFrom: st.customFrom };
    st = Object.assign(fresh(), keep);
    let d; try { d = await U.data(st.sym); } catch (e) { $('#sm-chart', root).innerHTML = `<p class="note warn">לא ניתן לטעון נתונים (${esc(e.message)}).</p>`; return; }
    const sc = SCEN[st.scen]; const n = d.d.length; let a, b;
    if (sc.blind) { const rnd = Math.random; const lo = Math.max(130, d.dates.findIndex((x) => x >= '2001')); a = lo + Math.floor(rnd() * (n - 260 - lo)); b = Math.min(n - 1, a + 251); st.blind = true; }
    else if (st.scen === 'recent') { a = n - 252; b = n - 1; }
    else if (st.scen === 'custom') { a = Math.max(130, d.dates.findIndex((x) => x >= (st.customFrom || '2018-01-02'))); b = Math.min(n - 1, a + 251); }
    else { a = d.dates.findIndex((x) => x >= sc.from); b = d.dates.findIndex((x) => x > sc.to); b = b < 0 ? n - 1 : b - 1; if (a < 0) { a = Math.max(130, n - 252); b = n - 1; U.toast('אין לנכס הזה נתונים בתקופה. עברתי לשנה האחרונה.', 'warn'); } }
    a = Math.max(a, 60);
    Object.assign(st, { a, b, i: a, tick: 0, scale: st.blind ? 100 / d.d[a - 1][4] : 1, cur: U.ASSETS[st.sym].cur });
    st.cash = st.start = st.peakEq = st.cur === 'ILS' ? 100000 : 100000;
    if (!st.fee || (st.fee === 'crypto' && U.ASSETS[st.sym].kind !== 'crypto')) st.fee = 'ibkr';
    if (U.ASSETS[st.sym].kind === 'crypto' && st.fee === 'ibkr') st.fee = 'crypto';
    st.bhUnits = st.start / (d.d[a][1] * st.scale);
    st.coach = []; coach('info', st.blind ? 'מצב עיוור: לא תדע איזה נכס ואיזו תקופה עד הסוף. כך אי אפשר להיעזר בזיכרון של מה שקרה (מידע מהעתיד, שיעור 27).' : `מתחילים ב-${dfmt(d.dates[a])} עם ${money(st.start, st.cur)} וירטואליים. השוואה: קנה-והחזק מאותו יום.`, 13);
    if (APP.state.stopRules && APP.state.stopRules.on) coach('info', `כללי עצירה פעילים: ירידה של ${APP.state.stopRules.dd}% מהשיא או פיגור של ${APP.state.stopRules.lag} נקודות אחרי המדד.`, 34);
    st.data = d; loadBars(); renderAll(); setSpeed(0);
  }
  async function resumeReplay() {
    renderSetup();
    let d; try { d = await U.data(st.sym); } catch (e) { return newReplay(); }
    st.data = d; loadBars(); renderAll(); setSpeed(0);
    U.toast('הסשן הקודם נטען. לחץ ▶ כדי להמשיך.', 'info');
  }
  const D = (k) => st.data.d[k];
  const sc = (v) => v * st.scale;
  const tOf = (k) => st.data.dates[k];
  const dfmt = (x) => x.split('-').reverse().join('/');

  function loadBars() {
    if (!cs) return;
    const from = Math.max(0, st.a - 120), bars = [];
    for (let k = from; k < st.i; k++) { const r = D(k); bars.push({ time: tOf(k), open: sc(r[1]), high: sc(r[2]), low: sc(r[3]), close: sc(r[4]) }); }
    cs.setData(bars); st.bars = bars;
    updateMAs(true);
    chart.applyOptions(chartOpts());
    startDay();
    redrawMarkers(); redrawLines();
    chart.timeScale().scrollToRealTime();
  }
  function startDay() {
    const r = D(st.i);
    st.path = SIM.dayPath(sc(r[1]), sc(r[2]), sc(r[3]), sc(r[4]), T, U.rng(st.i * 13 + 7));
    st.day = { time: tOf(st.i), open: st.path[0], high: st.path[0], low: st.path[0], close: st.path[0] };
    st.range = (r[2] - r[3]) / r[4];
    if (st.tick === 0) { st.px = st.path[0]; } else { st.px = st.path[st.tick]; st.day.high = Math.max(...st.path.slice(0, st.tick + 1)); st.day.low = Math.min(...st.path.slice(0, st.tick + 1)); st.day.close = st.px; }
    quoteFromPx(); if (cs) cs.update(st.day);
  }
  function quoteFromPx() {
    const base = U.ASSETS[st.sym] ? U.ASSETS[st.sym].spread : 5;
    const hs = (base / 2 + Math.min(20, (st.range || 0) * 100 * 1.2)) / 10000;
    st.bid = st.px * (1 - hs); st.ask = st.px * (1 + hs);
  }
  function updateMAs(all) {
    if (!maS || !st.bars) return;
    const closes = st.bars.map((b) => b.close).concat(st.day ? [st.day.close] : []), times = st.bars.map((b) => b.time).concat(st.day ? [st.day.time] : []);
    const m20 = S.sma(closes, 20), m50 = S.sma(closes, 50);
    if (all) { maS.setData(times.map((t, i) => m20[i] == null ? null : { time: t, value: m20[i] }).filter(Boolean)); maL.setData(times.map((t, i) => m50[i] == null ? null : { time: t, value: m50[i] }).filter(Boolean)); }
    else { const k = closes.length - 1; if (m20[k] != null) maS.update({ time: times[k], value: m20[k] }); if (m50[k] != null) maL.update({ time: times[k], value: m50[k] }); }
  }

  function step() {
    if (st.mode !== 'replay' || st.done || st.halted) return;
    st.tick++;
    if (st.tick >= T) { // close the day
      st.bars.push(Object.assign({}, st.day));
      endOfDay();
      if (st.done || st.halted) return;
      st.i++; st.tick = 0;
      if (st.i > st.b) return finish('end');
      startDay(); updateMAs(false);
      checkOrders(true); // gap at the open
    } else {
      st.px = st.path[st.tick]; st.day.close = st.px; st.day.high = Math.max(st.day.high, st.px); st.day.low = Math.min(st.day.low, st.px);
      quoteFromPx(); if (cs) cs.update(st.day); checkOrders(false);
    }
    renderQuote(); renderAcctLight();
    if (Date.now() - lastSave > 4000) persist();
  }
  function endOfDay() {
    const eq = equity(), bh = st.bhUnits * st.px;
    st.eq.push({ t: st.mode === 'live' ? Date.now() / 1000 : st.day.time, eq, bh });
    st.peakEq = Math.max(st.peakEq, eq);
    behaviourDaily();
    stopRules(eq, bh);
    if (Date.now() - eqDrawT > 700) { drawEq(); eqDrawT = Date.now(); }
  }
  const setSpeed = (k) => {
    st.speed = k; stopTimer();
    const ms = SPEEDS[k][0]; if (ms && st.mode === 'replay' && !st.done && !st.halted) timer = setInterval(step, ms);
    renderPlay();
  };
  const stopTimer = () => { if (timer) clearInterval(timer); timer = null; };
  const skipDays = (n) => { const was = st.speed; setSpeed(0); const target = st.i + n; let guard = 0; while (st.i < target && !st.done && !st.halted && guard++ < n * T + T) step(); if (st.speed !== was && was && !st.done) setSpeed(was); drawEq(); renderAll(); };

  /* ---------- live (Coinbase public feed, optional Finnhub) ---------- */
  function closeLive() { if (ws) { try { ws.onclose = null; ws.close(); } catch (e) {} ws = null; } if (st) st.liveOk = false; }
  async function startLive(key) {
    closeLive(); stopTimer(); clearLines();
    const keep = { mode: 'live', fee: st.fee === 'ibkr' ? 'crypto' : st.fee };
    st = Object.assign(fresh(), keep);
    const [src, sym] = key.split(':'); st.sym = sym; st.src = src; st.cur = 'USD'; st.scale = 1; st.bars = [];
    coach('info', 'זמן אמת: מחירים חיים, כסף וירטואלי. המרווח (Bid/Ask) אמיתי מספר הפקודות של הבורסה.', 34);
    renderAll();
    const failMsg = (why) => { $('#sm-quote .q-date', root).innerHTML = `<span class="down">${why}</span>`; coach('warn', why + ' אפשר להמשיך במצב היסטוריה אמיתית, או לפתוח את האפליקציה מהקבצים או מ-GitHub Pages, שם החיבור החי פתוח.', 0); renderTab('coach'); };
    if (src === 'cb') {
      try {
        const r = await fetch(`https://api.exchange.coinbase.com/products/${sym}/candles?granularity=60`);
        const arr = await r.json(); arr.sort((a, b) => a[0] - b[0]);
        st.bars = arr.map((c) => ({ time: c[0], open: c[3], high: c[2], low: c[1], close: c[4] }));
        const last = st.bars.pop(); st.day = last; st.px = last.close; st.bid = st.ask = st.px;
        if (cs) { cs.setData(st.bars.concat([st.day])); updateMAs(true); chart.applyOptions(chartOpts()); chart.timeScale().scrollToRealTime(); }
      } catch (e) { return failMsg('החיבור לנתונים חיים חסום בסביבה הזו.'); }
      try {
        ws = new WebSocket('wss://ws-feed.exchange.coinbase.com');
        ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe', product_ids: [sym], channels: ['ticker'] }));
        ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.type !== 'ticker') return; liveTick(Number(m.price), Number(m.best_bid), Number(m.best_ask), Date.parse(m.time) / 1000); };
        ws.onerror = () => failMsg('הזרם החי נקטע.');
        ws.onclose = () => { if (st.mode === 'live') setTimeout(() => { if (st.mode === 'live' && root && document.body.contains(root)) startLive(key); }, 4000); };
      } catch (e) { failMsg('החיבור לנתונים חיים חסום בסביבה הזו.'); }
    } else if (src === 'fh') {
      try {
        ws = new WebSocket('wss://ws.finnhub.io?token=' + encodeURIComponent(APP.state.settings.finnhub));
        ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe', symbol: sym }));
        ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.type !== 'trade') return; const t = m.data[m.data.length - 1]; const hs = (U.ASSETS[sym] ? U.ASSETS[sym].spread : 2) / 20000; liveTick(t.p, t.p * (1 - hs), t.p * (1 + hs), t.t / 1000); };
        ws.onerror = () => failMsg('Finnhub לא מגיב. בדוק את המפתח בהגדרות, ושהבורסה בארה"ב פתוחה.');
      } catch (e) { failMsg('החיבור לנתונים חיים חסום בסביבה הזו.'); }
    }
  }
  function liveTick(p, bid, ask, t) {
    if (!isFinite(p)) return;
    if (!st.liveOk) { st.liveOk = true; if (!st.bhUnits) st.bhUnits = st.start / p; coach('good', 'מחובר. כל מחיר שאתה רואה קרה עכשיו בשוק.', 0); }
    if (!st.bhUnits) st.bhUnits = st.start / p;
    const minute = Math.floor(t / 60) * 60;
    if (!st.day || minute > st.day.time) { if (st.day) { st.bars.push(st.day); endOfDay(); } st.day = { time: minute, open: p, high: p, low: p, close: p }; }
    st.day.close = p; st.day.high = Math.max(st.day.high, p); st.day.low = Math.min(st.day.low, p);
    st.px = p; st.bid = bid || p; st.ask = ask || p; st.range = (st.day.high - st.day.low) / p;
    if (cs) { cs.update(st.day); updateMAs(false); }
    checkOrders(false); renderQuote(); renderAcctLight();
  }

  /* ---------- orders & fills ---------- */
  const feeOf = (value, qty) => FEES[st.fee].f(value, qty, st.cur);
  const equity = () => st.cash + st.qty * (st.px || 0);
  const isCrypto = () => st.mode === 'live' || (U.ASSETS[st.sym] && U.ASSETS[st.sym].kind === 'crypto');
  const roundQty = (q) => isCrypto() ? Math.floor(q * 10000) / 10000 : Math.floor(q);
  const slipBp = (value) => (0.5 + Math.random() * (2 + (st.range || 0) * 100 * 2)) * (1 + value / 500000);

  function submit(o) {
    if (st.done || st.halted) return U.toast('הסשן הסתיים. פתח סשן חדש.', 'warn');
    if (!(o.qty > 0)) return U.toast('כמות לא תקינה', 'warn');
    if (o.side === 'sell' && o.qty > st.qty + 1e-9 - reservedSell()) return U.toast('אי אפשר למכור יותר ממה שאתה מחזיק. בקורס אין מכירה בחסר.', 'warn');
    if (o.side === 'buy') { const px = o.type === 'limit' ? o.limit : st.ask * 1.002; const need = o.qty * px + feeOf(o.qty * px, o.qty); if (need > st.cash - reservedCash() + 1e-6) return U.toast('אין מספיק מזומן. בקורס אין מינוף.', 'warn'); }
    o.id = st.oid++; o.t = st.mode === 'live' ? Date.now() / 1000 : tOf(st.i); o.px0 = st.px;
    behaviourOnOrder(o);
    if (o.type === 'market') fill(o, o.side === 'buy' ? st.ask : st.bid, true);
    else { st.orders.push(o); redrawLines(); U.toast(`${o.type === 'limit' ? 'לימיט' : 'סטופ'} ${o.side === 'buy' ? 'קנייה' : 'מכירה'} נרשם ב-${U.price(o.type === 'limit' ? o.limit : o.stop)}`, 'info'); U.tone('tap'); }
    renderAll(); persist(true);
  }
  const reservedCash = () => st.orders.filter((o) => o.side === 'buy').reduce((s, o) => s + o.qty * (o.limit || o.stop) * 1.002, 0);
  const reservedSell = () => st.orders.filter((o) => o.side === 'sell').reduce((s, o) => s + o.qty, 0);
  function checkOrders(atOpen) {
    if (!st.orders.length) return;
    const keep = [];
    for (const o of st.orders) {
      let fillPx = null, market = false;
      if (o.type === 'limit') { if (o.side === 'buy' && st.ask <= o.limit) fillPx = Math.min(o.limit, st.ask); if (o.side === 'sell' && st.bid >= o.limit) fillPx = Math.max(o.limit, st.bid); }
      if (o.type === 'stop') { if (o.side === 'sell' && st.bid <= o.stop) { fillPx = st.bid; market = true; } if (o.side === 'buy' && st.ask >= o.stop) { fillPx = st.ask; market = true; } }
      if (fillPx != null) { if (o.side === 'sell' && o.qty > st.qty) o.qty = st.qty; if (o.qty > 0) { fill(o, fillPx, market); if (o.type === 'stop' && atOpen) coach('warn', `הסטופ שלך הופעל בפתיחה עם פער: נקבע ב-${U.price(o.stop)} ובוצע ב-${U.price(o.fillPx)}. זה הסיכון של פקודת סטופ (שיעור 13).`, 13); } }
      else keep.push(o);
    }
    if (keep.length !== st.orders.length) { st.orders = keep; redrawLines(); renderAll(); }
  }
  function fill(o, px, market) {
    let slip = 0;
    if (market) { slip = slipBp(o.qty * px) / 10000; px = o.side === 'buy' ? px * (1 + slip) : px * (1 - slip); }
    const value = o.qty * px, fee = feeOf(value, o.qty), spreadCost = o.qty * Math.abs(px / (1 + (o.side === 'buy' ? slip : -slip)) - st.px);
    if (o.side === 'buy') { if (value + fee > st.cash + 1e-6) { o.qty = roundQty((st.cash - fee) / px); if (o.qty <= 0) return U.toast('הפקודה בוטלה: אין מספיק מזומן', 'warn'); } st.avg = (st.avg * st.qty + o.qty * px) / (st.qty + o.qty); st.qty += o.qty; st.cash -= o.qty * px + fee; }
    else { const pnl = (px - st.avg) * o.qty; st.realized += pnl; o.pnl = pnl - fee; o.holdDays = st.lastBuyIdx != null ? st.i - st.lastBuyIdx : null; st.qty -= o.qty; st.cash += o.qty * px - fee; if (st.qty < 1e-9) { st.qty = 0; st.avg = 0; } }
    if (o.side === 'buy') st.lastBuyIdx = st.i;
    st.costs.fee += fee; st.costs.spread += market ? spreadCost : 0; st.costs.slip += market ? o.qty * st.px * slip : 0;
    o.fillPx = px; o.fee = fee; o.ft = st.mode === 'live' ? Math.floor(Date.now() / 1000) : tOf(st.i); o.market = market;
    st.trades.push(o);
    U.tone('fill'); U.buzz(20);
    U.toast(`${o.side === 'buy' ? 'נקנו' : 'נמכרו'} ${num(o.qty, isCrypto() ? 4 : 0)} ב-${U.price(px)} · עמלה ${money(fee, st.cur, 2)}`, o.side === 'buy' ? 'good' : 'info');
    behaviourOnFill(o);
    redrawMarkers(); redrawLines();
  }
  function cancel(id) { st.orders = st.orders.filter((o) => o.id !== id); redrawLines(); renderAll(); U.tone('tap'); }

  /* ---------- coach: behaviour feedback tied to lessons ---------- */
  function coach(kind, text, lesson) {
    st.coach.unshift({ kind, text, lesson, t: st.mode === 'live' ? new Date().toLocaleTimeString('he-IL') : (st.blind ? 'יום ' + (st.i - st.a + 1) : (st.data ? dfmt(tOf(st.i)) : '')) });
    if (st.coach.length > 60) st.coach.pop();
    if (kind === 'warn' && root) { U.toast(text.length > 90 ? text.slice(0, 88) + '…' : text, 'warn', 4200); const tb = $('#sm-tabs [data-t="coach"]', root); if (tb) { tb.classList.remove('ping'); void tb.offsetWidth; tb.classList.add('ping'); } }
    if ($('#sm-tabs .on', root) && $('#sm-tabs .on', root).dataset.t === 'coach') renderTab('coach');
  }
  const flag = (k) => { st.flags[k] = (st.flags[k] || 0) + 1; };
  const recentChange = (days) => { const b = st.bars; if (!b || b.length < days + 1) return 0; return st.px / b[b.length - days].close - 1; };
  const ddFromHigh = (days) => { const b = st.bars; if (!b || !b.length) return 0; const hi = Math.max(...b.slice(-days).map((x) => x.high), st.px); return st.px / hi - 1; };
  function behaviourOnOrder(o) {
    const lag = st.mode === 'live' ? 15 : 5;
    if (o.reason === 'תחושת בטן') { flag('gut'); coach('warn', 'עסקה מ"תחושת בטן". רשום מראש כללים וקנה לפיהם (שיעור 11).', 11); }
    if (o.side === 'buy' && (recentChange(lag) > (st.mode === 'live' ? 0.01 : 0.06) || o.reason === 'פחד לפספס (FOMO)')) { flag('fomo'); coach('warn', `קנייה אחרי עלייה של ${pct(recentChange(lag), 1)} ב-${lag} ${st.mode === 'live' ? 'דקות' : 'ימים'}. זה הדפוס של משתמשי Robinhood שקנו בהמוניהם ופיגרו אחר כך (שיעור 10).`, 10); }
    if (o.side === 'sell' && (ddFromHigh(60) < -0.12 || o.reason === 'פחד מירידה') && o.qty > st.qty * 0.5) { flag('panic'); coach('warn', `מכירה של רוב הפוזיציה אחרי ירידה של ${pct(ddFromHigh(60), 0)} מהשיא. מוכר בפאניקה נועל את הירידה ומפספס את ההתאוששות (שיעור 11). מה ה-IPS שלך אומר?`, 11); }
    if (o.type === 'market' && (st.range > 0.03 || (U.ASSETS[st.sym] && U.ASSETS[st.sym].spread >= 10))) { flag('mkt'); coach('info', 'פקודת שוק ביום סוער או בנכס עם מרווח רחב. המחיר לא מובטח. שקול לימיט (שיעור 13).', 13); }
    if (o.type === 'limit') { flag('limit'); if ((st.flags.limit || 0) === 1) coach('good', 'שימוש בפקודת לימיט: אתה שולט במחיר. זה הכלל של הקורס.', 13); }
    if (['לפי התוכנית (IPS)', 'הפקדה חודשית', 'איזון מחדש'].includes(o.reason)) { flag('plan'); if (st.flags.plan === 1) coach('good', 'עסקה לפי תוכנית כתובה. זו התרופה הטובה ביותר להטיות.', 17); }
  }
  function behaviourOnFill(o) {
    const n = st.trades.length, days = Math.max(1, st.mode === 'live' ? 1 : st.i - st.a + 1);
    const perYear = n / days * 252;
    if (st.mode === 'replay' && n >= 6 && perYear > 50 && !st.flags.overtrade) { flag('overtrade'); coach('warn', `קצב של כ-${num(perYear)} עסקאות בשנה. במחקרים, יותר עסקאות = פחות תשואה. העלויות שלך עד עכשיו: ${money(st.costs.fee + st.costs.spread + st.costs.slip, st.cur)} (שיעור 10).`, 10); }
    if (o.side === 'sell' && o.pnl > 0 && o.holdDays != null && o.holdDays < 10 && st.qty > 0 && st.px < st.avg) { flag('disp'); coach('warn', 'מכרת מנצח מהר ומחזיק מפסיד. זה אפקט הדיספוזיציה (שיעור 11).', 11); }
    const conc = st.qty * st.px / equity();
    if (o.side === 'buy' && conc > 0.9 && U.ASSETS[st.sym] && U.ASSETS[st.sym].kind === 'stock' && !st.flags.conc) { flag('conc'); coach('info', `${pct(conc, 0)} מהתיק במניה אחת. בתיק אמיתי זה ריכוז מסוכן: רוב המניות מפסידות לאג"ח לאורך חייהן (שיעור 7).`, 7); }
    const costPct = (st.costs.fee + st.costs.spread + st.costs.slip) / st.start;
    if (costPct > 0.01 && !st.flags.cost1) { flag('cost1'); coach('warn', `העלויות הגיעו ל-${pct(costPct, 2)} מההון. זה כבר חלק ניכר מהתשואה הצפויה לשנה (שיעור 8).`, 8); }
  }
  function behaviourDaily() {
    if (st.mode !== 'replay') return;
    const dd = equity() / st.peakEq - 1;
    if (st.qty > 0 && dd < -0.1 && !st.flags.heldDD) { st.flags.heldDDstart = true; }
    if (st.flags.heldDDstart && dd > -0.02 && st.qty > 0 && !st.flags.heldDD) { flag('heldDD'); coach('good', 'החזקת דרך ירידה של יותר מ-10% וחזרת לשיא. זה בדיוק מה שמשקיע מצליח עושה.', 11); }
    const daysIn = st.i - st.a;
    if (daysIn === 60 && st.qty * st.px < equity() * 0.3) coach('info', `${pct(1 - st.qty * st.px / equity(), 0)} מהתיק במזומן כבר 60 ימי מסחר. ${st.bhUnits * st.px > st.start ? 'השוק עלה בינתיים: זמן מחוץ לשוק עולה כסף.' : 'מזומן הגן עליך הפעם, אבל לאורך שנים זמן בשוק מנצח תזמון.'} (שיעור 4)`, 4);
  }
  function stopRules(eq, bh) {
    const r = APP.state.stopRules; if (!r || !r.on || st.halted) return;
    const dd = eq / st.peakEq - 1, lag = (bh - eq) / st.start * 100;
    if (dd * 100 <= -r.dd) halt(`כלל עצירה: ירידה של ${pct(dd, 1)} מהשיא (הכלל: ${r.dd}%).`);
    else if (lag >= r.lag) halt(`כלל עצירה: פיגור של ${num(lag, 1)} נקודות אחרי קנה-והחזק (הכלל: ${r.lag}).`);
  }
  function halt(why) { st.halted = true; stopTimer(); coach('warn', why + ' לפי הכללים שכתבת מראש, המסחר נעצר. לא משנים כללים בדרך (שיעור 34).', 34); finish('halt'); }

  /* ---------- session end & report ---------- */
  function finish(why) {
    stopTimer(); st.done = true; drawEq(); renderAll();
    const eq = equity(), bh = st.bhUnits * st.px, ret = eq / st.start - 1, bhr = bh / st.start - 1;
    const eqs = st.eq.map((e) => e.eq), mdd = eqs.length ? S.maxdd([st.start, ...eqs]) : 0, costs = st.costs.fee + st.costs.spread + st.costs.slip;
    const bad = (st.flags.panic || 0) + (st.flags.fomo || 0) + (st.flags.gut || 0) + (st.flags.disp || 0) + (st.flags.overtrade ? 2 : 0);
    const good = (st.flags.limit ? 1 : 0) + (st.flags.plan ? 1 : 0) + (st.flags.heldDD ? 2 : 0);
    const proc = U.clamp(80 + good * 5 - bad * 10 - (costs / st.start > 0.01 ? 15 : 0), 0, 100);
    const grade = proc >= 90 ? 'A' : proc >= 75 ? 'B' : proc >= 60 ? 'C' : proc >= 45 ? 'D' : 'F';
    const rec = { at: Date.now(), sym: st.sym, name: U.ASSETS[st.sym] ? U.ASSETS[st.sym].name : st.sym, from: st.data ? tOf(st.a) : '', to: st.data ? tOf(Math.min(st.i, st.b)) : '', ret, bhr, mdd, trades: st.trades.length, costs: costs / st.start, grade, blind: !!st.blind, why };
    if (st.mode === 'replay') { APP.state.simHistory = [rec, ...(APP.state.simHistory || [])].slice(0, 30); APP.state.simSession = null; APP.addXP(30, 'סשן סימולטור'); APP.persist(); }
    const modal = h(`<div class="modal-bg"><div class="modal report" role="dialog" aria-label="דוח סשן">
      <h3>${why === 'halt' ? 'המסחר נעצר לפי הכללים' : 'סוף הסשן'}</h3>
      ${st.blind ? `<p class="reveal">הנכס היה <b>${esc(rec.name)}</b>, בתקופה ${dfmt(rec.from)}–${dfmt(rec.to)}.</p>` : ''}
      <div class="grade g-${grade}"><b>${grade}</b><span>ציון תהליך<br>${proc}/100</span></div>
      <div class="kv">${[['התשואה שלך', pct(ret, 2, true), ret >= 0 ? 'up' : 'down'], ['קנה-והחזק', pct(bhr, 2, true)], ['ההפרש', num((ret - bhr) * 100, 2) + ' נק\'', ret >= bhr ? 'up' : 'down'], ['ירידה מקסימלית', pct(mdd, 1)], ['עסקאות', st.trades.length], ['עלויות', money(costs, st.cur) + ' (' + pct(costs / st.start, 2) + ')']].map((r) => `<div class="${r[2] || ''}"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}</div>
      <ul class="checklist">${[[!st.flags.panic, 'לא מכרת בפאניקה'], [!st.flags.fomo, 'לא רדפת אחרי עליות'], [!st.flags.overtrade, 'לא סחרת יותר מדי'], [costs / st.start <= 0.005, 'עלויות מתחת ל-0.5%'], [!!st.flags.limit || !st.trades.length, 'השתמשת בפקודות לימיט']].map((c) => `<li class="${c[0] ? 'ok' : 'no'}">${c[1]}</li>`).join('')}</ul>
      <p class="note">${ret < bhr ? 'קנה-והחזק ניצח אותך. כך זה אצל רוב הסוחרים, ולכן תוכנית המדד היא הלב של התיק.' : 'ניצחת את קנה-והחזק בסשן הזה. זה סשן אחד: כמה מזה מזל? (שיעור 24)'}</p>
      <div class="ai-out"></div>
      <div class="row-btns"><button class="btn" data-a="new">סשן חדש</button><button class="btn ghost" data-a="ai" hidden>ניתוח של המאמן</button><button class="btn ghost" data-a="close">סגור</button></div></div></div>`);
    document.body.appendChild(modal);
    if (ret >= bhr && proc >= 75) U.confetti();
    modal.addEventListener('click', (e) => { const a = e.target.dataset.a; if (e.target === modal || a === 'close') modal.remove(); if (a === 'new') { modal.remove(); if (st.mode === 'replay') newReplay(); } if (a === 'ai') APP.tutor.simCoach(rec, st, $('.ai-out', modal)); });
    APP.tutor.available().then((ok) => { const b = $('[data-a="ai"]', modal); if (b && ok) b.hidden = false; });
  }

  /* ---------- UI pieces ---------- */
  function renderAll() { renderQuote(); renderAcct(); renderPlay(); const t = $('#sm-tabs .on', root); renderTab(t ? t.dataset.t : 'coach'); }
  function renderQuote() {
    const q = $('#sm-quote', root); if (!q || st.px == null) return;
    const prevClose = st.bars && st.bars.length ? st.bars[st.bars.length - 1].close : st.px, ch = st.px / prevClose - 1;
    const meta = U.ASSETS[st.sym];
    q.querySelector('.q-name').textContent = st.blind && !st.done ? 'נכס מוסתר' : (meta ? meta.name : st.sym);
    q.querySelector('.q-px').textContent = U.price(st.px);
    const c = q.querySelector('.q-ch'); c.textContent = pct(ch, 2, true); c.className = 'q-ch ' + (ch >= 0 ? 'up' : 'down');
    q.querySelector('.q-ba').innerHTML = `<span>Bid ${U.price(st.bid)}</span><span>Ask ${U.price(st.ask)}</span><span>מרווח ${num((st.ask - st.bid) / st.px * 10000, 1)} bp</span>`;
    if (st.mode === 'replay' && st.data) q.querySelector('.q-date').textContent = st.blind && !st.done ? `יום ${st.i - st.a + 1} מתוך ${st.b - st.a + 1}` : `${dfmt(tOf(st.i))} · ${st.tick >= T - 1 ? 'סגירה' : st.tick === 0 ? 'פתיחה' : 'שעה ' + (9.5 + st.tick * 0.25).toFixed(2).replace('.50', ':30').replace('.25', ':15').replace('.75', ':45').replace('.00', ':00')}`;
    else if (st.liveOk) q.querySelector('.q-date').innerHTML = `<span class="live-dot"></span> חי · ${new Date().toLocaleTimeString('he-IL')}`;
    else if (st.mode === 'live' && !q.querySelector('.q-date .down')) q.querySelector('.q-date').textContent = 'מתחבר…';
  }
  function renderPlay() {
    const el = $('#sm-play', root); if (!el) return;
    if (st.mode !== 'replay') { el.innerHTML = '<span class="muted">נרות של דקה. המחיר מתעדכן עם כל עסקה בבורסה.</span>'; return; }
    const prog = st.data ? (st.i - st.a) / Math.max(1, st.b - st.a) : 0;
    el.innerHTML = `<div class="seg speeds">${SPEEDS.map((s, k) => `<button data-k="${k}" class="${k === st.speed ? 'on' : ''}" aria-label="${k ? 'מהירות ' + s[1] : 'השהה'}">${k === 0 && st.speed === 0 ? '▶' : s[1]}</button>`).join('')}</div><button class="btn ghost sm" data-skip="1">יום ⏭</button><button class="btn ghost sm" data-skip="5">שבוע ⏭</button><div class="prog"><i style="width:${(prog * 100).toFixed(1)}%"></i></div><button class="btn ghost sm" data-end="1">סיים</button>`;
    $$('[data-k]', el).forEach((b) => b.addEventListener('click', () => { const k = Number(b.dataset.k); setSpeed(k === 0 && st.speed === 0 ? 1 : k); U.tone('tap'); }));
    $$('[data-skip]', el).forEach((b) => b.addEventListener('click', () => skipDays(Number(b.dataset.skip))));
    $('[data-end]', el).addEventListener('click', () => { if (!st.done) finish('end'); });
  }
  function renderAcctLight() {
    const a = $('#sm-acct', root); if (!a || !a.firstElementChild) return renderAcct();
    const eq = equity(), bh = st.bhUnits ? st.bhUnits * st.px : st.start;
    const set = (k, v, cls) => { const el = a.querySelector(`[data-k="${k}"]`); if (el) { el.textContent = v; if (cls != null) el.className = cls; } };
    set('eq', money(eq, st.cur)); set('pnl', pct(eq / st.start - 1, 2, true), eq >= st.start ? 'up' : 'down'); set('bh', pct(bh / st.start - 1, 2, true)); set('upl', st.qty ? money((st.px - st.avg) * st.qty, st.cur) : '—', st.px >= st.avg ? 'up' : 'down'); set('expo', pct(st.qty * st.px / eq, 0));
  }
  function renderAcct() {
    const a = $('#sm-acct', root); if (!a) return;
    const eq = equity(), bh = st.bhUnits ? st.bhUnits * (st.px || 0) : st.start, costs = st.costs.fee + st.costs.spread + st.costs.slip;
    a.innerHTML = `<div class="acct-head"><span>שווי החשבון</span><b data-k="eq">${money(eq, st.cur)}</b><em data-k="pnl" class="${eq >= st.start ? 'up' : 'down'}">${pct(eq / st.start - 1, 2, true)}</em></div>
      <div class="kv tight"><div><span>קנה-והחזק</span><b data-k="bh">${pct(bh / st.start - 1, 2, true)}</b></div><div><span>מזומן</span><b>${money(st.cash, st.cur)}</b></div><div><span>החזקה</span><b>${st.qty ? num(st.qty, isCrypto() ? 4 : 0) + ' @ ' + U.price(st.avg) : '—'}</b></div><div><span>רווח פתוח</span><b data-k="upl" class="${st.px >= st.avg ? 'up' : 'down'}">${st.qty ? money((st.px - st.avg) * st.qty, st.cur) : '—'}</b></div><div><span>חשיפה</span><b data-k="expo">${pct(st.qty * (st.px || 0) / eq, 0)}</b></div><div><span>עלויות ששולמו</span><b class="${costs / st.start > 0.005 ? 'down' : ''}">${money(costs, st.cur, 2)}</b></div></div>`;
  }
  function drawEq() {
    const el = $('#sm-eq', root); if (!el || st.eq.length < 2) { if (el) el.innerHTML = ''; return; }
    U.lineChart(el, { series: [{ name: 'אתה', x: st.eq.map((e) => st.blind && !st.done ? '' : (typeof e.t === 'number' ? new Date(e.t * 1000).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : e.t)), y: st.eq.map((e) => e.eq), color: 'var(--accent)' }, { name: 'קנה-והחזק', y: st.eq.map((e) => e.bh), x: [] }], h: 140, yfmt: (v) => money(v, st.cur, 0), xfmt: (x) => typeof x === 'string' && x.includes('-') ? x.slice(5).split('-').reverse().join('/') : x });
  }
  function renderTab(t) {
    const el = $('#sm-tab', root); if (!el) return;
    if (t === 'coach') el.innerHTML = st.coach.length ? `<ul class="coach">${st.coach.map((c) => `<li class="c-${c.kind}"><time>${esc(c.t)}</time><p>${esc(c.text)}</p>${c.lesson ? `<button class="link" data-l="${c.lesson}">שיעור ${c.lesson} ←</button>` : ''}</li>`).join('')}</ul>` : '<p class="muted">המאמן יגיב לכל עסקה שלך.</p>';
    if (t === 'orders') el.innerHTML = st.orders.length ? `<ul class="orders">${st.orders.map((o) => `<li><b class="${o.side === 'buy' ? 'up' : 'down'}">${o.side === 'buy' ? 'קנייה' : 'מכירה'}</b> ${o.type === 'limit' ? 'לימיט' : 'סטופ'} ${num(o.qty, isCrypto() ? 4 : 0)} @ ${U.price(o.limit || o.stop)} <button class="btn ghost sm" data-c="${o.id}">בטל</button></li>`).join('')}</ul>` : '<p class="muted">אין פקודות ממתינות. פקודות לימיט וסטופ תקפות עד ביטול.</p>';
    if (t === 'trades') el.innerHTML = st.trades.length ? `<div class="tbl-wrap"><table class="tbl"><tr><th>זמן</th><th>פעולה</th><th>כמות</th><th>מחיר</th><th>עמלה</th><th>רווח</th><th>סיבה</th></tr>${st.trades.slice().reverse().map((o) => `<tr><td>${st.blind && !st.done ? '' : esc(typeof o.ft === 'number' ? new Date(o.ft * 1000).toLocaleTimeString('he-IL') : dfmt(o.ft))}</td><td class="${o.side === 'buy' ? 'up' : 'down'}">${o.side === 'buy' ? 'קנייה' : 'מכירה'} ${o.type === 'market' ? 'שוק' : o.type === 'limit' ? 'לימיט' : 'סטופ'}</td><td>${num(o.qty, isCrypto() ? 4 : 0)}</td><td>${U.price(o.fillPx)}</td><td>${money(o.fee, st.cur, 2)}</td><td class="${(o.pnl || 0) >= 0 ? 'up' : 'down'}">${o.pnl != null ? money(o.pnl, st.cur) : ''}</td><td>${esc(o.reason || '')}</td></tr>`).join('')}</table></div>` : '<p class="muted">עוד לא בוצעו עסקאות.</p>';
    if (t === 'history') { const hs = APP.state.simHistory || []; el.innerHTML = hs.length ? `<div class="tbl-wrap"><table class="tbl"><tr><th>נכס</th><th>תקופה</th><th>אתה</th><th>קנה-והחזק</th><th>עסקאות</th><th>ציון</th></tr>${hs.map((r) => `<tr><td>${esc(r.name)}${r.blind ? ' <span class="tag">עיוור</span>' : ''}</td><td>${r.from ? dfmt(r.from) + '–' + dfmt(r.to) : ''}</td><td class="${r.ret >= 0 ? 'up' : 'down'}">${pct(r.ret, 1, true)}</td><td>${pct(r.bhr, 1, true)}</td><td>${r.trades}</td><td><b>${r.grade}</b></td></tr>`).join('')}</table></div><p class="note">ניצחת את קנה-והחזק ב-${hs.filter((r) => r.ret > r.bhr).length} מתוך ${hs.length} סשנים.</p>` : '<p class="muted">סשנים שתסיים יופיעו כאן.</p>'; }
    $$('[data-l]', el).forEach((b) => b.addEventListener('click', () => APP.go('lesson', Number(b.dataset.l))));
    $$('[data-c]', el).forEach((b) => b.addEventListener('click', () => cancel(Number(b.dataset.c))));
  }

  function openTicket(side) {
    if (st.px == null) return;
    const tk = $('#sm-ticket', root); tk.hidden = false; tk.classList.remove('in'); void tk.offsetWidth; tk.classList.add('in');
    const maxBuy = roundQty((st.cash - reservedCash()) / (st.ask * 1.003)), maxSell = roundQty(st.qty - reservedSell());
    tk.innerHTML = `<div class="tk-head"><div class="seg" id="tk-side"><button data-s="buy" class="${side === 'buy' ? 'on buy' : ''}">קנייה</button><button data-s="sell" class="${side === 'sell' ? 'on sell' : ''}">מכירה</button></div><button class="x" aria-label="סגור">✕</button></div>
      <div class="seg" id="tk-type"><button data-t="limit" class="on">לימיט</button><button data-t="market">שוק</button><button data-t="stop">סטופ</button></div>
      <label class="ctl ctl-num" id="tk-pl"><span>מחיר</span><input type="number" id="tk-p" step="any" inputmode="decimal" value="${(side === 'buy' ? st.bid : st.ask).toFixed(st.px < 20 ? 4 : 2)}"></label>
      <label class="ctl ctl-num"><span>כמות</span><input type="number" id="tk-q" step="${isCrypto() ? '0.0001' : '1'}" min="0" inputmode="decimal" value="${side === 'buy' ? roundQty(maxBuy * 0.25) : maxSell}"></label>
      <div class="chips" id="tk-pct">${[25, 50, 100].map((p) => `<button class="chip" data-p="${p}">${p}%</button>`).join('')}</div>
      <label class="ctl ctl-sel"><span>למה? (יומן)</span><select id="tk-r"><option value="">בחר סיבה (לא חובה)</option>${REASONS.map((r) => `<option>${r}</option>`).join('')}</select></label>
      <div class="tk-est" id="tk-est"></div>
      <button class="btn big" id="tk-go"></button>`;
    let s = side, type = 'limit';
    const est = () => {
      const q = Number($('#tk-q', tk).value), p = type === 'market' ? (s === 'buy' ? st.ask : st.bid) : Number($('#tk-p', tk).value);
      $('#tk-pl', tk).hidden = type === 'market'; $('#tk-pl span', tk).textContent = type === 'stop' ? 'מחיר הפעלה' : 'מחיר לימיט';
      const v = q * p, fee = feeOf(v, q);
      const hint = type === 'market' ? 'מתבצעת מיד במחיר הזמין. המחיר לא מובטח.' : type === 'limit' ? (s === 'buy' ? 'תתבצע רק במחיר הזה או נמוך יותר.' : 'תתבצע רק במחיר הזה או גבוה יותר.') : (s === 'sell' ? 'כשהמחיר יורד לרמה, הופכת לפקודת שוק.' : 'כשהמחיר עולה לרמה, הופכת לפקודת שוק.');
      $('#tk-est', tk).innerHTML = `<div class="kv tight"><div><span>שווי</span><b>${money(v, st.cur)}</b></div><div><span>עמלה (${FEES[st.fee].n})</span><b>${money(fee, st.cur, 2)} · ${pct(v ? fee / v : 0, 2)}</b></div></div><p class="muted">${hint}</p>`;
      const go = $('#tk-go', tk); go.textContent = `${s === 'buy' ? 'קנה' : 'מכור'} ${num(q || 0, isCrypto() ? 4 : 0)}`; go.className = 'btn big ' + s;
    };
    $$('#tk-side button', tk).forEach((b) => b.addEventListener('click', () => { s = b.dataset.s; $$('#tk-side button', tk).forEach((x) => { x.className = x === b ? 'on ' + s : ''; }); $('#tk-q', tk).value = s === 'sell' ? roundQty(st.qty - reservedSell()) : roundQty(maxBuy * 0.25); $('#tk-p', tk).value = (s === 'buy' ? st.bid : st.ask).toFixed(st.px < 20 ? 4 : 2); est(); }));
    $$('#tk-type button', tk).forEach((b) => b.addEventListener('click', () => { type = b.dataset.t; $$('#tk-type button', tk).forEach((x) => x.classList.toggle('on', x === b)); if (type === 'stop') $('#tk-p', tk).value = (st.px * (s === 'sell' ? 0.95 : 1.05)).toFixed(st.px < 20 ? 4 : 2); est(); }));
    $$('#tk-pct .chip', tk).forEach((b) => b.addEventListener('click', () => { const p = Number(b.dataset.p) / 100; const mb = roundQty((st.cash - reservedCash() - feeOf(st.cash, 1)) / (st.ask * 1.003)); $('#tk-q', tk).value = s === 'buy' ? roundQty(mb * p) : roundQty((st.qty - reservedSell()) * p); est(); U.tone('tap'); }));
    $$('input', tk).forEach((i) => i.addEventListener('input', est));
    $('.x', tk).addEventListener('click', closeTicket);
    $('#tk-go', tk).addEventListener('click', () => {
      const q = roundQty(Number($('#tk-q', tk).value)), p = Number($('#tk-p', tk).value);
      const o = { side: s, type, qty: q, reason: $('#tk-r', tk).value };
      if (type === 'limit') o.limit = p; if (type === 'stop') o.stop = p;
      if (type !== 'market' && !(p > 0)) return U.toast('הכנס מחיר', 'warn');
      submit(o); closeTicket();
    });
    est(); setTimeout(() => $('#tk-go', tk).focus(), 50);
  }
  function closeTicket() { const tk = $('#sm-ticket', root); if (tk) tk.hidden = true; }

  function redrawMarkers() {
    if (!cs) return;
    const ms = st.trades.map((o) => ({ time: o.ft, position: o.side === 'buy' ? 'belowBar' : 'aboveBar', color: o.side === 'buy' ? css('--up') : css('--down'), shape: o.side === 'buy' ? 'arrowUp' : 'arrowDown', text: (o.side === 'buy' ? 'B ' : 'S ') + num(o.qty, isCrypto() ? 3 : 0) }));
    ms.sort((a, b) => (a.time > b.time ? 1 : a.time < b.time ? -1 : 0));
    try { cs.setMarkers(ms); } catch (e) {}
  }
  function clearLines() { if (cs) Object.values(lines).forEach((l) => { try { cs.removePriceLine(l); } catch (e) {} }); lines = {}; }
  function redrawLines() {
    if (!cs) return; clearLines();
    st.orders.forEach((o) => { lines[o.id] = cs.createPriceLine({ price: o.limit || o.stop, color: o.side === 'buy' ? css('--up') : css('--down'), lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: (o.type === 'limit' ? 'LMT ' : 'STP ') + (o.side === 'buy' ? 'B' : 'S') }); });
    if (st.qty > 0) lines.avg = cs.createPriceLine({ price: st.avg, color: css('--muted'), lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: 'ממוצע' });
  }

  function persist(force) {
    if (!st || st.mode !== 'replay' || !st.data) return;
    lastSave = Date.now();
    const { data, bars, path, day, ...rest } = st;
    APP.state.simSession = st.done ? null : rest; APP.persist();
  }
  return SIM;
})();
