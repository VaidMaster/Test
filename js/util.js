/* Shared helpers: DOM, storage, feedback, market data, statistics, SVG charts. */
(function () {
  const U = {};
  window.U = U;

  /* ---------- DOM ---------- */
  U.$ = (s, r = document) => r.querySelector(s);
  U.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  U.h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  U.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  U.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  U.shuffle = (a, rnd = Math.random) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* ---------- number formatting ---------- */
  const nf = (d) => new Intl.NumberFormat('he-IL', { minimumFractionDigits: d, maximumFractionDigits: d });
  const NF = [nf(0), nf(1), nf(2), nf(3), nf(4)];
  U.num = (x, d = 0) => (x == null || !isFinite(x)) ? '—' : NF[d].format(x);
  U.pct = (x, d = 1, sign = false) => (x == null || !isFinite(x)) ? '—' : (sign && x > 0 ? '+' : '') + NF[d].format(x * 100) + '%';
  U.money = (x, cur = 'USD', d) => {
    if (x == null || !isFinite(x)) return '—';
    if (d == null) d = Math.abs(x) >= 1000 ? 0 : 2;
    const sym = cur === 'ILS' ? '₪' : '$';
    return (x < 0 ? '−' : '') + sym + NF[d].format(Math.abs(x));
  };
  U.price = (x) => U.num(x, x < 20 ? 4 : 2);
  U.parseNum = (s) => { if (s == null) return NaN; s = String(s).replace(/[,\s₪$%]/g, '').replace('−', '-'); return s === '' ? NaN : Number(s); };

  /* ---------- storage (localStorage, guarded) ---------- */
  U.load = (k, def) => { try { const v = localStorage.getItem('mkt.' + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } };
  U.save = (k, v) => { try { localStorage.setItem('mkt.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } };

  /* ---------- feedback: toast, haptics, sound, floating XP ---------- */
  U.settings = () => window.APP ? APP.state.settings : { sound: true, haptics: true };
  U.toast = (msg, kind = 'info', ms = 2600) => {
    const host = U.$('#toasts'); if (!host) return;
    const t = U.h(`<div class="toast toast-${kind}" role="status">${msg}</div>`);
    host.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms);
  };
  U.buzz = (pattern) => { if (U.settings().haptics && navigator.vibrate) try { navigator.vibrate(pattern); } catch (e) {} };
  let actx = null;
  U.tone = (kind) => {
    if (!U.settings().sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const notes = { good: [660, 880], bad: [220, 180], tap: [520], win: [523, 659, 784, 1047], fill: [740, 990] }[kind] || [440];
      notes.forEach((f, i) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = kind === 'bad' ? 'triangle' : 'sine'; o.frequency.value = f;
        const t0 = actx.currentTime + i * 0.09;
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.08, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
        o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + 0.2);
      });
    } catch (e) {}
  };
  U.good = (el, xp) => { U.tone('good'); U.buzz(15); if (el) { el.classList.remove('pulse-good'); void el.offsetWidth; el.classList.add('pulse-good'); } if (xp) U.floatXP(el, xp); };
  U.bad = (el) => { U.tone('bad'); U.buzz([30, 40, 30]); if (el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); } };
  U.floatXP = (el, xp) => {
    const r = (el || document.body).getBoundingClientRect();
    const f = U.h(`<div class="xp-float">+${xp} XP</div>`);
    f.style.left = (r.left + r.width / 2) + 'px'; f.style.top = (r.top + 10) + 'px';
    document.body.appendChild(f); setTimeout(() => f.remove(), 1100);
  };
  U.confetti = () => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = U.h('<canvas class="confetti"></canvas>'); document.body.appendChild(c);
    const ctx = c.getContext('2d'), W = c.width = innerWidth, H = c.height = innerHeight;
    const cs = getComputedStyle(document.documentElement);
    const cols = ['--accent', '--up', '--ink', '--down'].map((v) => cs.getPropertyValue(v).trim() || '#c80');
    const P = Array.from({ length: 120 }, () => ({ x: W / 2, y: H * 0.35, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 12 - 4, s: 4 + Math.random() * 5, r: Math.random() * 6, c: cols[Math.floor(Math.random() * cols.length)] }));
    let n = 0;
    (function step() {
      ctx.clearRect(0, 0, W, H);
      P.forEach((p) => { p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.r += 0.2; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
      if (++n < 110) requestAnimationFrame(step); else c.remove();
    })();
  };
  U.countUp = (el, to, fmt = (x) => U.num(x), ms = 700) => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    (function f(t) { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(to * e); if (k < 1) requestAnimationFrame(f); })(t0);
  };
  U.copy = async (text, btn) => {
    try { await navigator.clipboard.writeText(text); U.toast('הועתק', 'good'); }
    catch (e) {
      const ta = U.h('<textarea class="copy-fallback"></textarea>'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); U.toast('הועתק', 'good'); } catch (e2) { U.toast('סמן את הטקסט והעתק ידנית', 'warn'); }
      setTimeout(() => ta.remove(), 50);
    }
  };

  /* ---------- seeded randomness ---------- */
  U.rng = (seed = 1) => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  U.randn = (rnd) => { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  /* ---------- market data (real Yahoo Finance history shipped in /data) ---------- */
  const cache = {};
  U.ASSETS = {
    'SPY': { file: 'SPY.json', name: 'SPDR S&P 500 ETF', cur: 'USD', spread: 1, kind: 'etf' },
    'QQQ': { file: 'QQQ.json', name: 'Invesco QQQ (Nasdaq-100)', cur: 'USD', spread: 1, kind: 'etf' },
    'AAPL': { file: 'AAPL.json', name: 'Apple', cur: 'USD', spread: 2, kind: 'stock' },
    'MSFT': { file: 'MSFT.json', name: 'Microsoft', cur: 'USD', spread: 2, kind: 'stock' },
    'NVDA': { file: 'NVDA.json', name: 'NVIDIA', cur: 'USD', spread: 3, kind: 'stock' },
    'AMZN': { file: 'AMZN.json', name: 'Amazon', cur: 'USD', spread: 2, kind: 'stock' },
    'TSLA': { file: 'TSLA.json', name: 'Tesla', cur: 'USD', spread: 3, kind: 'stock' },
    'GLD': { file: 'GLD.json', name: 'זהב (GLD)', cur: 'USD', spread: 2, kind: 'etf' },
    'TLT': { file: 'TLT.json', name: 'אג"ח ארה"ב ארוכות (TLT)', cur: 'USD', spread: 2, kind: 'etf' },
    'TA35.TA': { file: 'TA35_TA.json', name: 'ת"א 35', cur: 'ILS', spread: 10, kind: 'index' },
    '^TA125.TA': { file: 'TA125_TA.json', name: 'ת"א 125', cur: 'ILS', spread: 10, kind: 'index' },
    '^GSPC': { file: 'GSPC.json', name: 'מדד S&P 500', cur: 'USD', spread: 1, kind: 'index' },
    'BTC-USD': { file: 'BTC-USD.json', name: 'Bitcoin', cur: 'USD', spread: 5, kind: 'crypto' },
    'ETH-USD': { file: 'ETH-USD.json', name: 'Ethereum', cur: 'USD', spread: 6, kind: 'crypto' },
    'ILS=X': { file: 'ILSX.json', name: 'דולר/שקל', cur: 'ILS', spread: 3, kind: 'fx' }
  };
  /* returns { s, n, cur, d: [[date,o,h,l,c,adjFactor]...], dates[], close[], adj[] } */
  U.data = async (sym) => {
    if (cache[sym]) return cache[sym];
    const meta = U.ASSETS[sym];
    cache[sym] = fetch('data/' + meta.file).then((r) => { if (!r.ok) throw new Error('data ' + r.status); return r.json(); }).then((j) => {
      j.dates = j.d.map((r) => r[0]); j.close = j.d.map((r) => r[4]); j.adj = j.d.map((r) => r[4] * r[5]);
      return j;
    }).catch((e) => { delete cache[sym]; throw e; });
    return cache[sym];
  };
  /* align several series on common dates; returns {dates, cols:[[...]]} using adjusted closes */
  U.align = (series) => {
    const maps = series.map((s) => { const m = new Map(); s.dates.forEach((d, i) => m.set(d, s.adj[i])); return m; });
    const dates = series[0].dates.filter((d) => maps.every((m) => m.has(d)));
    return { dates, cols: maps.map((m) => dates.map((d) => m.get(d))) };
  };
  U.monthly = (dates, vals) => { const out = { dates: [], vals: [] }; for (let i = 0; i < dates.length; i++) { const m = dates[i].slice(0, 7); if (i === dates.length - 1 || dates[i + 1].slice(0, 7) !== m) { out.dates.push(dates[i]); out.vals.push(vals[i]); } } return out; };
  U.sliceFrom = (dates, vals, from, to) => { const i0 = dates.findIndex((d) => d >= from); let i1 = to ? dates.findIndex((d) => d > to) : dates.length; if (i1 < 0) i1 = dates.length; return { dates: dates.slice(i0, i1), vals: vals.slice(i0, i1) }; };

  /* ---------- statistics ---------- */
  const S = U.stats = {};
  S.rets = (p) => { const r = new Array(p.length - 1); for (let i = 1; i < p.length; i++) r[i - 1] = p[i] / p[i - 1] - 1; return r; };
  S.mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  S.std = (a) => { const m = S.mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1)); };
  S.equity = (r, start = 1) => { const e = [start]; for (const x of r) e.push(e[e.length - 1] * (1 + x)); return e; };
  S.cagr = (eq, ppy = 252) => Math.pow(eq[eq.length - 1] / eq[0], ppy / (eq.length - 1)) - 1;
  S.vol = (r, ppy = 252) => S.std(r) * Math.sqrt(ppy);
  S.sharpe = (r, rf = 0, ppy = 252) => { const ex = r.map((x) => x - rf / ppy); return S.mean(ex) / S.std(ex) * Math.sqrt(ppy); };
  S.sortino = (r, rf = 0, ppy = 252) => { const ex = r.map((x) => x - rf / ppy); const dn = Math.sqrt(ex.reduce((s, x) => s + (x < 0 ? x * x : 0), 0) / ex.length); return S.mean(ex) / dn * Math.sqrt(ppy); };
  S.dd = (eq) => { let pk = -Infinity; return eq.map((v) => { pk = Math.max(pk, v); return v / pk - 1; }); };
  S.maxdd = (eq) => Math.min(...S.dd(eq));
  S.ddInfo = (eq, dates) => { let pk = eq[0], pki = 0, best = { dd: 0 }; for (let i = 0; i < eq.length; i++) { if (eq[i] > pk) { pk = eq[i]; pki = i; } const d = eq[i] / pk - 1; if (d < best.dd) best = { dd: d, peak: pki, trough: i }; } if (best.trough != null) { const rec = eq.findIndex((v, i) => i > best.trough && v >= eq[best.peak]); best.recover = rec; } if (dates) { best.peakDate = dates[best.peak]; best.troughDate = dates[best.trough]; best.recoverDate = best.recover > 0 ? dates[best.recover] : null; } return best; };
  S.sma = (a, n) => { const o = new Array(a.length).fill(null); let s = 0; for (let i = 0; i < a.length; i++) { s += a[i]; if (i >= n) s -= a[i - n]; if (i >= n - 1) o[i] = s / n; } return o; };
  S.corr = (a, b) => { const ma = S.mean(a), mb = S.mean(b); let n = 0, da = 0, db = 0; for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; } return n / Math.sqrt(da * db); };
  S.beta = (a, b) => { const mb = S.mean(b), ma = S.mean(a); let c = 0, v = 0; for (let i = 0; i < a.length; i++) { c += (a[i] - ma) * (b[i] - mb); v += (b[i] - mb) ** 2; } return c / v; };
  S.pctile = (a, p) => { const s = a.slice().sort((x, y) => x - y); const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
  S.annualFromDaily = (dates, p) => { const out = []; let y0 = dates[0].slice(0, 4), start = p[0]; for (let i = 1; i < dates.length; i++) { const y = dates[i].slice(0, 4); if (y !== y0) { out.push({ y: y0, r: p[i - 1] / start - 1 }); start = p[i - 1]; y0 = y; } } out.push({ y: y0, r: p[p.length - 1] / start - 1, partial: true }); return out; };
  /* strategy: position in [0,1] already lagged; cost in bp per unit traded */
  S.strat = (r, pos, costBp = 0) => { const o = new Array(r.length); let prev = 0, trades = 0; for (let i = 0; i < r.length; i++) { const p = pos[i] || 0; const tr = Math.abs(p - prev); if (tr > 0) trades++; o[i] = p * r[i] - tr * costBp / 10000; prev = p; } o.trades = trades; return o; };
  S.summary = (r, ppy = 252, rf = 0) => { const eq = S.equity(r); const mdd = S.maxdd(eq); const c = S.cagr(eq, ppy); return { cagr: c, vol: S.vol(r, ppy), sharpe: S.sharpe(r, rf, ppy), sortino: S.sortino(r, rf, ppy), mdd, calmar: c / Math.abs(mdd), total: eq[eq.length - 1] - 1, win: r.filter((x) => x > 0).length / r.filter((x) => x !== 0).length }; };
  /* tiny logistic regression (batch gradient descent with L2), features standardized by caller */
  S.logit = (X, y, iters = 400, lr = 0.1, l2 = 0.01) => {
    const k = X[0].length; let w = new Array(k).fill(0), b = 0;
    for (let it = 0; it < iters; it++) {
      const gw = new Array(k).fill(0); let gb = 0;
      for (let i = 0; i < X.length; i++) { let z = b; for (let j = 0; j < k; j++) z += w[j] * X[i][j]; const p = 1 / (1 + Math.exp(-z)); const e = p - y[i]; gb += e; for (let j = 0; j < k; j++) gw[j] += e * X[i][j]; }
      b -= lr * gb / X.length; for (let j = 0; j < k; j++) w[j] -= lr * (gw[j] / X.length + l2 * w[j]);
    }
    return { w, b, predict: (x) => { let z = b; for (let j = 0; j < k; j++) z += w[j] * x[j]; return 1 / (1 + Math.exp(-z)); } };
  };
  S.standardize = (Xtr, Xte) => { const k = Xtr[0].length, m = [], s = []; for (let j = 0; j < k; j++) { const col = Xtr.map((r) => r[j]); m[j] = S.mean(col); s[j] = S.std(col) || 1; } const f = (X) => X.map((r) => r.map((v, j) => (v - m[j]) / s[j])); return [f(Xtr), f(Xte)]; };

  /* ---------- SVG charts ---------- */
  const NS = 'http://www.w3.org/2000/svg';
  const fmtDate = (d) => typeof d === 'string' ? d.slice(0, 7).split('-').reverse().join('/') : U.num(d);
  /* line chart. opts: {series:[{name,x[],y[],color,width,dash,area}], log, yfmt, xfmt, h, zero, bands:[{x0,x1,label}], marks:[{x,y,label}]} */
  U.lineChart = (host, opts) => {
    const W = Math.max(280, host.clientWidth || 600), H = opts.h || 240, pad = { l: 10, r: 56, t: 14, b: 26 };
    const ser = opts.series.filter((s) => s.y.length);
    const tf = opts.log ? (v) => Math.log(Math.max(v, 1e-9)) : (v) => v;
    let ymin = Infinity, ymax = -Infinity; ser.forEach((s) => s.y.forEach((v) => { if (v == null || !isFinite(v)) return; const t = tf(v); if (t < ymin) ymin = t; if (t > ymax) ymax = t; }));
    if (opts.zero) { ymin = Math.min(ymin, 0); ymax = Math.max(ymax, 0); }
    if (ymin === ymax) { ymin -= 1; ymax += 1; }
    const yr = ymax - ymin; ymin -= yr * 0.05; ymax += yr * 0.05;
    const n = Math.max(...ser.map((s) => s.y.length));
    const X = (i) => pad.l + (W - pad.l - pad.r) * (n <= 1 ? 0 : i / (n - 1));
    const Y = (v) => pad.t + (H - pad.t - pad.b) * (1 - (tf(v) - ymin) / (ymax - ymin));
    const yfmt = opts.yfmt || ((v) => U.num(v, Math.abs(v) < 10 ? 2 : 0));
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'chart'); svg.setAttribute('role', 'img');
    let g = '';
    // y grid: 4 ticks
    for (let k = 0; k <= 4; k++) {
      const tv = ymin + (ymax - ymin) * k / 4; const v = opts.log ? Math.exp(tv) : tv; const y = Y(v);
      g += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}" class="grid"/><text x="${W - pad.r + 6}" y="${y + 4}" class="ax">${yfmt(v)}</text>`;
    }
    if (opts.zero && ymin < 0) g += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${Y(0)}" y2="${Y(0)}" class="zero"/>`;
    // x labels: ~5
    const xs = ser[0].x || [];
    for (let k = 0; k < 5; k++) { const i = Math.round((n - 1) * k / 4); if (xs[i] == null) continue; const anchor = k === 0 ? 'start' : k === 4 ? 'end' : 'middle'; g += `<text x="${X(i)}" y="${H - 8}" class="ax" text-anchor="${anchor}">${(opts.xfmt || fmtDate)(xs[i])}</text>`; }
    (opts.bands || []).forEach((b) => { g += `<rect x="${X(b.i0)}" y="${pad.t}" width="${Math.max(1, X(b.i1) - X(b.i0))}" height="${H - pad.t - pad.b}" class="band"/>${b.label ? `<text x="${(X(b.i0) + X(b.i1)) / 2}" y="${pad.t + 12}" class="ax" text-anchor="middle">${b.label}</text>` : ''}`; });
    ser.forEach((s, si) => {
      const step = Math.max(1, Math.floor(s.y.length / (W * 1.5)));
      let d = '', started = false, first = null, last = null;
      for (let i = 0; i < s.y.length; i += step) { const v = s.y[i]; if (v == null || !isFinite(v) || (opts.log && v <= 0)) { started = false; continue; } const px = X(i), py = Y(v); d += (started ? 'L' : 'M') + px.toFixed(1) + ' ' + py.toFixed(1); started = true; if (!first) first = [px, py]; last = [px, py, v]; }
      const iL = s.y.length - 1; if (s.y[iL] != null && isFinite(s.y[iL])) { const px = X(iL), py = Y(s.y[iL]); d += 'L' + px.toFixed(1) + ' ' + py.toFixed(1); last = [px, py, s.y[iL]]; }
      const col = s.color || `var(--s${si + 1})`;
      if (s.area && first && last) g += `<path d="${d}L${last[0]} ${H - pad.b}L${first[0]} ${H - pad.b}Z" style="fill:${col};opacity:.12"/>`;
      g += `<path d="${d}" style="fill:none;stroke:${col};stroke-width:${s.width || 1.8};${s.dash ? 'stroke-dasharray:' + s.dash : ''}" stroke-linejoin="round"${s.dash ? '' : ' pathLength="1" class="draw"'}/>`;
      if (last && !s.noDot) g += `<circle cx="${last[0]}" cy="${last[1]}" r="3.2" style="fill:${col}"/>`;
    });
    (opts.marks || []).forEach((m) => { g += `<circle cx="${X(m.i)}" cy="${Y(m.y)}" r="4" class="mark"/>${m.label ? `<text x="${X(m.i)}" y="${Y(m.y) + (m.below ? 16 : -8)}" class="ax mark-l" text-anchor="middle">${m.label}</text>` : ''}`; });
    g += `<line class="xhair" y1="${pad.t}" y2="${H - pad.b}" x1="0" x2="0" style="opacity:0"/>`;
    svg.innerHTML = g;
    const wrap = U.h('<div class="chart-wrap"></div>'); wrap.appendChild(svg);
    if (ser.length > 1 || opts.legend) {
      const lg = U.h('<div class="legend"></div>');
      ser.forEach((s, si) => lg.appendChild(U.h(`<span><i style="background:${s.color || `var(--s${si + 1})`}"></i>${U.esc(s.name || '')}</span>`)));
      wrap.prepend(lg);
    }
    const tip = U.h('<div class="tip" hidden></div>'); wrap.appendChild(tip);
    const xh = svg.querySelector('.xhair');
    const move = (ev) => {
      const r = svg.getBoundingClientRect(); const px = (ev.clientX - r.left) * W / r.width;
      const i = U.clamp(Math.round((px - pad.l) / (W - pad.l - pad.r) * (n - 1)), 0, n - 1);
      xh.setAttribute('x1', X(i)); xh.setAttribute('x2', X(i)); xh.style.opacity = 1;
      tip.hidden = false;
      tip.innerHTML = `<b>${xs[i] != null ? (opts.xfmt ? opts.xfmt(xs[i]) : (typeof xs[i] === 'string' ? xs[i].split('-').reverse().join('/') : xs[i])) : ''}</b>` + ser.map((s, si) => `<div><i style="background:${s.color || `var(--s${si + 1})`}"></i>${U.esc(s.name || '')} ${s.y[i] == null ? '—' : (opts.tipfmt || yfmt)(s.y[i])}</div>`).join('');
      const tx = (ev.clientX - r.left); tip.style.left = U.clamp(tx - tip.offsetWidth / 2, 0, r.width - tip.offsetWidth) + 'px';
    };
    svg.addEventListener('pointermove', move); svg.addEventListener('pointerdown', move);
    svg.addEventListener('pointerleave', () => { tip.hidden = true; xh.style.opacity = 0; });
    host.innerHTML = ''; host.appendChild(wrap);
    return { X, Y };
  };
  /* histogram of values with optional reference lines [{v,label,cls}] */
  U.histChart = (host, vals, opts = {}) => {
    const W = Math.max(280, host.clientWidth || 600), H = opts.h || 200, pad = { l: 8, r: 8, t: 18, b: 26 }, bins = opts.bins || 30;
    let lo = opts.min ?? Math.min(...vals), hi = opts.max ?? Math.max(...vals); (opts.refs || []).forEach((r) => { lo = Math.min(lo, r.v); hi = Math.max(hi, r.v); }); if (lo === hi) hi = lo + 1;
    const cnt = new Array(bins).fill(0); vals.forEach((v) => cnt[U.clamp(Math.floor((v - lo) / (hi - lo) * bins), 0, bins - 1)]++);
    const mx = Math.max(...cnt), bw = (W - pad.l - pad.r) / bins, X = (v) => pad.l + (v - lo) / (hi - lo) * (W - pad.l - pad.r);
    let g = cnt.map((c, i) => `<rect x="${pad.l + i * bw + 1}" y="${H - pad.b - (H - pad.t - pad.b) * c / mx}" width="${Math.max(1, bw - 2)}" height="${(H - pad.t - pad.b) * c / mx}" class="bar"/>`).join('');
    const fmt = opts.fmt || ((v) => U.num(v, 1));
    [lo, (lo + hi) / 2, hi].forEach((v, k) => g += `<text x="${X(v)}" y="${H - 8}" class="ax" text-anchor="${['start', 'middle', 'end'][k]}">${fmt(v)}</text>`);
    (opts.refs || []).forEach((r) => g += `<line x1="${X(r.v)}" x2="${X(r.v)}" y1="${pad.t - 4}" y2="${H - pad.b}" class="ref ${r.cls || ''}"/><text x="${X(r.v)}" y="${pad.t - 6}" class="ax ref-l" text-anchor="middle">${r.label}</text>`);
    host.innerHTML = `<div class="chart-wrap"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${g}</svg></div>`;
  };
  /* bar chart for labeled values */
  U.barChart = (host, items, opts = {}) => {
    const W = Math.max(280, host.clientWidth || 600), rowH = 30, H = items.length * rowH + 10, lw = opts.lw || 120;
    const mx = Math.max(...items.map((i) => Math.abs(i.v)), 1e-9), hasNeg = items.some((i) => i.v < 0);
    const x0 = hasNeg ? lw + (W - lw - 70) / 2 : lw, scale = (hasNeg ? (W - lw - 70) / 2 : W - lw - 70) / mx;
    const fmt = opts.fmt || ((v) => U.num(v, 1));
    let g = items.map((it, i) => { const y = 6 + i * rowH, w = Math.abs(it.v) * scale, x = it.v >= 0 ? x0 : x0 - w; return `<text x="${lw - 8}" y="${y + 17}" class="ax lbl" text-anchor="end">${U.esc(it.label)}</text><rect x="${x}" y="${y + 4}" width="${Math.max(1, w)}" height="${rowH - 10}" rx="3" style="fill:${it.color || (it.v < 0 ? 'var(--down)' : 'var(--s1)')}" class="grow"/><text x="${it.v >= 0 ? x + w + 6 : x - 6}" y="${y + 17}" class="ax" text-anchor="${it.v >= 0 ? 'start' : 'end'}">${fmt(it.v)}</text>`; }).join('');
    if (hasNeg) g += `<line x1="${x0}" x2="${x0}" y1="0" y2="${H}" class="zero"/>`;
    host.innerHTML = `<div class="chart-wrap"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" style="direction:ltr">${g}</svg></div>`;
  };
})();
