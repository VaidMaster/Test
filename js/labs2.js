/* Interactive labs, part 2 (lessons 18-35). */
(function () {
  const { $, $$, h, esc, num, pct, money, stats: S } = U;
  const { sl, nb, sel, val, live, kv, loading, fail, src, tblRows, bindOut } = LABS._h;
  const ASSET_OPTS = [['SPY', 'SPY (S&P 500)'], ['QQQ', 'QQQ (נאסד"ק 100)'], ['^TA125.TA', 'ת"א 125'], ['TA35.TA', 'ת"א 35'], ['GLD', 'זהב'], ['TLT', 'אג"ח ארוכות'], ['AAPL', 'Apple'], ['NVDA', 'NVIDIA'], ['BTC-USD', 'Bitcoin']];
  const dfmt = (d) => d.split('-').reverse().join('/');

  /* L18 */
  LABS.statements = (host) => {
    host.innerHTML = `<p class="note">מספרים לדוגמה (במיליוני $). החלף במספרים מדוח אמיתי מ-SEC EDGAR.</p><div class="ctls">${nb('s-rev', 'הכנסות', 400)}${nb('s-ni', 'רווח נקי', 60)}${nb('s-cfo', 'תזרים מפעילות שוטפת', 120)}${nb('s-cap', 'השקעות הוניות (CapEx)', 45)}${nb('s-sh', 'מספר מניות (מיליונים)', 10)}${nb('s-p', 'מחיר מניה', 150, '$')}${sl('s-ind', 'מכפיל ממוצע בענף (דמודרן)', 5, 60, 1, 22)}</div><div class="out"></div>`;
    live(host, () => {
      const rev = val(host, 's-rev'), ni = val(host, 's-ni'), cfo = val(host, 's-cfo'), cap = val(host, 's-cap'), sh = val(host, 's-sh'), p = val(host, 's-p'), ind = val(host, 's-ind');
      const eps = ni / sh, pe = p / eps, fcf = cfo - cap, mc = p * sh;
      $('.out', host).innerHTML = kv([['שולי רווח נקי', pct(ni / rev)], ['תזרים חופשי', num(fcf) + 'M$', fcf > 0 ? 'up' : 'down'], ['רווח למניה (EPS)', money(eps, 'USD', 2)], ['מכפיל רווח (P/E)', num(pe, 1), 'hi'], ['תשואת רווח (E/P)', pct(1 / pe)], ['תשואת תזרים חופשי', pct(fcf / mc)], ['מזומן מול רווח', num(cfo / ni, 2) + '×', cfo / ni < 1 ? 'down' : 'up']]) +
        `<div class="verdict">${pe < ind * 0.7 ? 'המכפיל נמוך מהענף. ייתכן שזול, וייתכן שזול מסיבה טובה (מלכודת ערך).' : pe > ind * 1.3 ? 'המכפיל גבוה מהענף: השוק מצפה לצמיחה. אם היא לא תגיע, המחיר ייפגע.' : 'המכפיל קרוב לממוצע הענף.'} ${cfo < ni ? 'שים לב: הרווח גבוה מהמזומן שנכנס. בדוק למה.' : ''}</div>`;
    });
  };

  /* L19 */
  LABS.dcf = (host) => {
    host.innerHTML = `<div class="ctls">${nb('dc-f', 'תזרים חופשי שנה הבאה', 100, 'M$')}${sl('dc-g', 'צמיחה ב-10 השנים הקרובות', 0, 10, 0.5, 5, '%')}${sl('dc-t', 'צמיחה לנצח אחרי כן', 0, 3, 0.25, 2, '%')}${sl('dc-r', 'שיעור היוון', 6, 12, 0.5, 9, '%')}</div><div class="out"></div><h4 class="lab-h">מפת רגישות: שווי לפי צמיחה (שורות) והיוון (עמודות)</h4><div class="heat"></div>`;
    const dcf = (f, g, tg, r) => { let pv = 0, cf = f; for (let t = 1; t <= 10; t++) { pv += cf / Math.pow(1 + r, t); if (t < 10) cf *= 1 + g; } return pv + cf * (1 + tg) / (r - tg) / Math.pow(1 + r, 10); };
    live(host, () => {
      const f = val(host, 'dc-f'), g = val(host, 'dc-g') / 100, tg = val(host, 'dc-t') / 100, r = val(host, 'dc-r') / 100;
      const base = dcf(f, g, tg, r);
      const G = [0, 2, 4, 6, 8, 10], R = [6, 7, 8, 9, 10, 11, 12];
      const grid = G.map((gg) => R.map((rr) => dcf(f, gg / 100, tg, rr / 100)));
      const flat = grid.flat(), lo = Math.min(...flat), hi = Math.max(...flat);
      $('.out', host).innerHTML = kv([['שווי הוגן (הנחות נוכחיות)', num(base) + 'M$', 'hi'], ['טווח בכל המפה', num(lo) + ' עד ' + num(hi) + 'M$'], ['פי כמה בין הקצוות', num(hi / lo, 1) + '×', 'down'], ['שינוי ב-1% היוון', pct(dcf(f, g, tg, r + 0.01) / base - 1, 0, true)]]);
      $('.heat', host).innerHTML = `<div class="tbl-wrap"><table class="tbl heat-t"><tr><th>צמיחה \\ היוון</th>${R.map((x) => `<th>${x}%</th>`).join('')}</tr>${grid.map((row, i) => `<tr><th>${G[i]}%</th>${row.map((v, j) => { const k = (Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo)); const cur = Math.abs(G[i] / 100 - g) < 0.011 && Math.abs(R[j] / 100 - r) < 0.006; return `<td style="--k:${k.toFixed(2)}" class="${cur ? 'cur' : ''}">${num(v)}</td>`; }).join('')}</tr>`).join('')}</table></div>`;
    });
  };

  /* L20, L26: moving-average crossover on real data */
  LABS.ma = async (host, lesson) => {
    host.innerHTML = `<div class="ctls">${sel('m-a', 'נכס', ASSET_OPTS, 'SPY')}${sl('m-f', 'ממוצע מהיר (ימים)', 5, 100, 5, 50)}${sl('m-s', 'ממוצע איטי (ימים)', 50, 300, 10, 200)}${sl('m-c', 'עלות לכל צד', 0, 30, 1, 5, ' bp')}<label class="chk"><input type="checkbox" id="m-x" checked> מזיז את הסיגנל ביום (shift)</label></div><div class="lab-body"></div>`;
    const body = $('.lab-body', host);
    const run = async () => {
      loading(body); let d; try { d = await U.data(val(host, 'm-a')); } catch (e) { return fail(body, e); }
      const p = d.adj, f = val(host, 'm-f'), s = Math.max(val(host, 'm-s'), f + 5), c = val(host, 'm-c'), lag = val(host, 'm-x');
      const mf = S.sma(p, f), ms = S.sma(p, s), sig = p.map((_, i) => ms[i] != null && mf[i] > ms[i] ? 1 : 0);
      const r = S.rets(p).slice(s), pos = sig.slice(s, s + r.length + 1);
      const position = lag ? pos.slice(0, r.length) : pos.slice(1, r.length + 1); // r[k] = p[s+k+1]/p[s+k]-1
      const st = S.strat(r, position, c), bh = r;
      const A = S.summary(st), B = S.summary(bh), dts = d.dates.slice(s);
      const eqS = S.equity(st), eqB = S.equity(bh);
      // next-month average return when signal on/off (lesson 20)
      let on = [], off = []; for (let i = s; i + 21 < p.length; i += 21) (sig[i] ? on : off).push(p[i + 21] / p[i] - 1);
      body.innerHTML = `<div class="chart-host"></div>` + tblRows(['', 'אסטרטגיה', 'קנה-והחזק'], [['CAGR', `<b>${pct(A.cagr)}</b>`, pct(B.cagr)], ['תנודתיות', pct(A.vol), pct(B.vol)], ['שארפ', num(A.sharpe, 2), num(B.sharpe, 2)], ['ירידה מקסימלית', pct(A.mdd), pct(B.mdd)], ['מספר החלפות', st.trades, '1'], ['זמן בשוק', pct(S.mean(position), 0), '100%']]) +
        kv([['תשואה ממוצעת בחודש שאחרי, סיגנל דלוק', pct(S.mean(on), 2)], ['סיגנל כבוי', pct(S.mean(off), 2)]]) +
        (!lag ? '<div class="verdict down">הסיגנל לא מוזז: האסטרטגיה סוחרת על מידע של אותו יום. כאן ההשפעה קטנה כי ממוצעים זזים לאט, אבל בסיגנלים מהירים זה מייצר תוצאות דמיוניות (שיעור 27).</div>' : '') +
        `<div class="verdict ${A.cagr > B.cagr ? 'up' : ''}">${A.cagr > B.cagr ? 'בנתונים האלה האסטרטגיה ניצחה. לפני שמתלהבים: כמה חלונות ניסית? (שיעור 25) האם זה שורד walk-forward? (שיעור 29)' : 'האסטרטגיה לא ניצחה את קנה-והחזק. זו התוצאה הנפוצה.'}</div>` + src(`נתונים: ${esc(d.n)} מותאם לדיבידנדים, ${dfmt(dts[0])}–${dfmt(dts[dts.length - 1])}.`);
      U.lineChart($('.chart-host', body), { series: [{ name: `MA ${f}/${s}`, x: dts, y: eqS.slice(1).map((v) => v * 10000), color: 'var(--accent)' }, { name: 'קנה-והחזק', x: dts, y: eqB.slice(1).map((v) => v * 10000) }], log: true, yfmt: (v) => money(v, 'USD', 0) });
    };
    bindOut(host); $$('input,select', host).forEach((i) => i.addEventListener('change', run)); run();
  };

  /* L21: anomaly decay after publication (simulation) */
  LABS.factor = (host) => {
    host.innerHTML = `<div class="ctls">${sl('fa-p', 'פרמיה לפני פרסום', 2, 10, 0.5, 6, '%')}${sl('fa-d', 'ירידה אחרי פרסום', 0, 100, 2, 58, '%')}${sl('fa-v', 'תנודתיות הפקטור', 5, 20, 1, 12, '%')}${sl('fa-s', 'סיבוב', 1, 30, 1, 3)}</div><div class="out"></div><div class="chart-host"></div>${src('סימולציה: 30 שנות מחקר ואז 25 שנה אחרי פרסום. מספרי הדעיכה לפי McLean & Pontiff.')}`;
    live(host, () => {
      const pre = val(host, 'fa-p') / 100, dec = val(host, 'fa-d') / 100, v = val(host, 'fa-v') / 100, rnd = U.rng(val(host, 'fa-s') * 31);
      const yrs = 55, pub = 30, r = Array.from({ length: yrs }, (_, i) => (i < pub ? pre : pre * (1 - dec)) + v * U.randn(rnd));
      const eq = S.equity(r); const roll = r.map((_, i) => i < 9 ? null : (Math.pow(eq[i + 1] / eq[i - 9], 0.1) - 1) * 100);
      const tstat = (a) => S.mean(a) / (S.std(a) / Math.sqrt(a.length));
      const tPre = tstat(r.slice(0, pub)), tPost = tstat(r.slice(pub));
      const worst = (() => { let best = 0; for (let i = 0; i < r.length; i++) for (let j = i + 1; j <= r.length; j++) if (eq[j] < eq[i]) best = Math.max(best, j - i); return best; })();
      $('.out', host).innerHTML = kv([['t לפני פרסום', num(tPre, 2), tPre > 3 ? 'up' : ''], ['t אחרי פרסום', num(tPost, 2), tPost < 2 ? 'down' : ''], ['פרמיה צפויה אחרי פרסום', pct(pre * (1 - dec), 2)], ['תקופת הפסד ארוכה ביותר', worst + ' שנים']]);
      U.lineChart($('.chart-host', host), { series: [{ name: 'תשואה מתגלגלת 10 שנים', x: r.map((_, i) => 1970 + i), y: roll, area: true }], xfmt: (x) => String(x), yfmt: (v) => num(v, 1) + '%', zero: true, bands: [{ i0: pub, i1: yrs - 1, label: 'אחרי פרסום' }] });
    });
  };

  /* L22 */
  LABS.returns = async (host) => {
    host.innerHTML = `<div class="ctls row">${sel('rt-a', 'נכס', ASSET_OPTS, 'SPY')}<label class="chk"><input type="checkbox" id="rt-s"> הצג signal.shift(1)</label></div><div class="lab-body"></div>`;
    const body = $('.lab-body', host);
    const run = async () => {
      loading(body); let d; try { d = await U.data(val(host, 'rt-a')); } catch (e) { return fail(body, e); }
      const n = d.dates.length, k = n - 8, show = val(host, 'rt-s');
      const rows = []; for (let i = k; i < n; i++) { const r = d.adj[i] / d.adj[i - 1] - 1, rp = d.adj[i - 1] / d.adj[i - 2] - 1; rows.push([dfmt(d.dates[i]), num(d.close[i], 2), pct(r, 2, true), num(Math.log(1 + r) * 100, 3) + '%', `<span class="${r > 0 ? 'up' : 'down'}">${r > 0 ? 1 : 0}</span>`, show ? `<b>${rp > 0 ? 1 : 0}</b>` : '<span class="muted">—</span>']); }
      let gaps = 0, maxGap = 0; for (let i = 1; i < n; i++) { const g = (new Date(d.dates[i]) - new Date(d.dates[i - 1])) / 864e5; if (g > 4) gaps++; maxGap = Math.max(maxGap, g); }
      const mo = U.monthly(d.dates, d.adj), mr = S.rets(mo.vals);
      const sim = d.adj[n - 1] / d.adj[0] - 1, logSum = S.rets(d.adj).reduce((s, r) => s + Math.log(1 + r), 0);
      body.innerHTML = tblRows(['תאריך', 'סגירה', 'תשואה פשוטה', 'לוגריתמית', 'signal (עלה היום?)', 'shift(1)'], rows) +
        `<p class="note">${show ? 'עם shift(1), הסיגנל של כל שורה הוא מה שידעת <b>אתמול</b>. רק אותו מותר להכפיל בתשואה של היום.' : 'סמן shift(1) כדי לראות מה ידעת ברגע ההחלטה.'}</p>` +
        kv([['ימי מסחר בקובץ', num(n)], ['פערים של יותר מ-4 ימים', num(gaps) + ' (מקסימום ' + num(maxGap) + ' ימים)'], ['חודשים אחרי resample', num(mo.vals.length)], ['תנודתיות חודשית × √12', pct(S.vol(mr, 12))], ['תשואה מצטברת (מכפלת פשוטות)', pct(sim, 0)], ['סכום לוגריתמיות → exp − 1', pct(Math.exp(logSum) - 1, 0), 'up']]) + src('נתונים: ' + esc(d.n) + ', Yahoo Finance.');
    };
    $$('select,input', host).forEach((i) => i.addEventListener('change', run)); run();
  };

  /* L23 */
  LABS.metrics = async (host) => {
    host.innerHTML = `<div class="ctls">${sel('mt-a', 'נכס', ASSET_OPTS, 'SPY')}${sel('mt-f', 'מתאריך', [['2005-01-01', '2005'], ['2010-01-01', '2010'], ['2015-01-01', '2015'], ['2020-01-01', '2020']], '2010-01-01')}${sl('mt-r', 'ריבית חסרת סיכון', 0, 5, 0.25, 2, '%')}</div><div class="lab-body"></div><h4 class="lab-h">שני נכסים: איך מתאם נמוך מוריד סיכון</h4><div class="ctls">${sel('mt-b', 'נכס שני', [['TLT', 'אג"ח ארוכות (TLT)'], ['GLD', 'זהב (GLD)'], ['QQQ', 'QQQ']], 'TLT')}${sl('mt-w', 'משקל SPY', 0, 100, 5, 60, '%')}</div><div class="lab-body2"></div>`;
    const run = async () => {
      const b1 = $('.lab-body', host); loading(b1);
      let d, spy; try { [d, spy] = await Promise.all([U.data(val(host, 'mt-a')), U.data('SPY')]); } catch (e) { return fail(b1, e); }
      const from = val(host, 'mt-f'), rf = val(host, 'mt-r') / 100, ppy = d.s.includes('BTC') ? 365 : 252;
      const x = U.sliceFrom(d.dates, d.adj, from), r = S.rets(x.vals), m = S.summary(r, ppy, rf), dd = S.ddInfo(x.vals, x.dates);
      const al = U.align([d, spy]); const i0 = al.dates.findIndex((q) => q >= from); const ra = S.rets(al.cols[0].slice(i0)), rb = S.rets(al.cols[1].slice(i0));
      b1.innerHTML = kv([['CAGR', pct(m.cagr), 'hi'], ['תנודתיות שנתית', pct(m.vol)], ['שארפ', num(m.sharpe, 2)], ['סורטינו', num(m.sortino, 2)], ['ירידה מקסימלית', pct(m.mdd), 'down'], ['שפל', dd.troughDate ? dfmt(dd.troughDate) : '—'], ['חזרה לשיא', dd.recoverDate ? dfmt(dd.recoverDate) : 'עוד לא'], ['קלמר', num(m.calmar, 2)], ['ימים עולים', pct(m.win, 0)], ['היום הטוב / הגרוע', pct(Math.max(...r), 1) + ' / ' + pct(Math.min(...r), 1)], ['בטא מול SPY', num(S.beta(ra, rb), 2)], ['מתאם מול SPY', num(S.corr(ra, rb), 2)]]) + src(esc(d.n) + ' מותאם לדיבידנדים, ' + dfmt(x.dates[0]) + '–' + dfmt(x.dates[x.dates.length - 1]) + '. אפשר להשוות לתוצאות של QuantStats.');
      run2();
    };
    const run2 = async () => {
      const b2 = $('.lab-body2', host); let a, b; try { [a, b] = await Promise.all([U.data('SPY'), U.data(val(host, 'mt-b'))]); } catch (e) { return fail(b2, e); }
      const al = U.align([a, b]), from = val(host, 'mt-f'), i0 = al.dates.findIndex((q) => q >= from), ra = S.rets(al.cols[0].slice(i0)), rb = S.rets(al.cols[1].slice(i0));
      const w = val(host, 'mt-w') / 100, rp = ra.map((x, i) => w * x + (1 - w) * rb[i]);
      const ws = Array.from({ length: 21 }, (_, k) => k / 20), vols = ws.map((ww) => S.vol(ra.map((x, i) => ww * x + (1 - ww) * rb[i])) * 100);
      b2.innerHTML = kv([['מתאם', num(S.corr(ra, rb), 2), 'hi'], ['תנודתיות SPY', pct(S.vol(ra))], ['תנודתיות נכס שני', pct(S.vol(rb))], ['תנודתיות התיק', pct(S.vol(rp)), 'up'], ['ממוצע משוקלל (אם מתאם = 1)', pct(w * S.vol(ra) + (1 - w) * S.vol(rb))]]) + '<div class="chart-host"></div>';
      U.lineChart($('.chart-host', b2), { series: [{ name: 'תנודתיות התיק', x: ws.map((x) => x * 100), y: vols, area: true }], xfmt: (x) => num(x) + '% SPY', yfmt: (v) => num(v, 1) + '%', h: 170, marks: [{ i: Math.round(w * 20), y: vols[Math.round(w * 20)], label: 'אתה כאן' }] });
    };
    bindOut(host);
    ['mt-a', 'mt-f', 'mt-r'].forEach((id) => $('#' + id, host).addEventListener('change', run));
    ['mt-b', 'mt-w'].forEach((id) => $('#' + id, host).addEventListener('change', run2));
    $('#mt-w', host).addEventListener('input', U.debounce ? U.debounce(run2, 120) : run2);
    run();
  };

  /* L24 */
  LABS.bootstrap = async (host) => {
    loading(host);
    let g; try { g = await U.data('^GSPC'); } catch (e) { return fail(host, e); }
    const ann = S.annualFromDaily(g.dates, g.close).filter((a) => !a.partial).map((a) => a.r);
    host.innerHTML = `<div class="ctls">${sl('bs-n', 'כמה שנים יש לך ברקורד', 2, ann.length, 1, ann.length)}${sl('bs-s', 'סיבוב', 1, 20, 1, 1)}</div><div class="out"></div><div class="chart-host"></div><h4 class="lab-h">years_needed(edge, vol, t)</h4><div class="ctls">${sl('bs-e', 'יתרון שנתי', 0.5, 10, 0.5, 2, '%')}${sl('bs-v', 'רעש שנתי', 5, 30, 1, 15, '%')}${sl('bs-t', 'רף t', 1.5, 4, 0.5, 2)}</div><div class="out2"></div>${src('נתונים: תשואות שנתיות של מדד S&P 500 (מחיר), ' + g.dates[0].slice(0, 4) + '–' + (Number(g.dates[g.dates.length - 1].slice(0, 4)) - 1) + '. 5,000 דגימות.')}`;
    live(host, () => {
      const n = val(host, 'bs-n'), rnd = U.rng(val(host, 'bs-s') * 977), sample = ann.slice(-n);
      const boot = Array.from({ length: 5000 }, () => { let s = 0; for (let k = 0; k < n; k++) s += sample[Math.floor(rnd() * n)]; return s / n * 100; });
      const lo = S.pctile(boot, 0.025), hi = S.pctile(boot, 0.975), m = S.mean(sample) * 100;
      $('.out', host).innerHTML = kv([['ממוצע שנתי', num(m, 1) + '%', 'hi'], ['רווח סמך 95%', num(lo, 1) + '% עד ' + num(hi, 1) + '%'], ['רוחב הטווח', num(hi - lo, 1) + ' נקודות', 'down'], ['t של הממוצע', num(m / (S.std(sample) * 100 / Math.sqrt(n)), 2)]]);
      U.histChart($('.chart-host', host), boot, { fmt: (v) => num(v, 0) + '%', refs: [{ v: lo, label: '2.5%' }, { v: hi, label: '97.5%' }] });
      const e = val(host, 'bs-e'), v = val(host, 'bs-v'), t = val(host, 'bs-t'), yrs = Math.pow(t * v / e, 2);
      $('.out2', host).innerHTML = kv([['שנים נדרשות', num(yrs, 0) + ' שנים', yrs > 50 ? 'down' : 'up']]) + '<div class="c"></div>';
      const es = Array.from({ length: 20 }, (_, k) => 0.5 + k * 0.5);
      U.lineChart($('.c', $('.out2', host)), { series: [{ name: 'שנים', x: es, y: es.map((x) => Math.pow(t * v / x, 2)), area: true }], log: true, xfmt: (x) => num(x, 1) + '% יתרון', yfmt: (y) => num(y, 0), h: 160 });
    });
  };

  /* L25: 200 random strategies on real SPY */
  LABS.snooping = async (host) => {
    loading(host);
    let spy; try { spy = await U.data('SPY'); } catch (e) { return fail(host, e); }
    host.innerHTML = `<div class="ctls">${sl('sn-n', 'מספר אסטרטגיות אקראיות', 10, 500, 10, 200)}${sl('sn-s', 'סיבוב', 1, 30, 1, 1)}</div><div class="out"></div><h4 class="lab-h">כל נקודה היא אסטרטגיה: ביצועים 2005–2015 (אופקי) מול 2016–2025 (אנכי)</h4><div class="chart-host"></div>${src('נתונים: SPY יומי מותאם. כל אסטרטגיה מחליטה כל חודש בהטלת מטבע אם להיות בשוק.')}`;
    const mo = U.monthly(spy.dates, spy.adj), r = S.rets(mo.vals), dts = mo.dates.slice(1);
    const ins = dts.map((d) => d >= '2005' && d < '2016'), oos = dts.map((d) => d >= '2016' && d < '2026');
    live(host, () => {
      const N = val(host, 'sn-n'), rnd = U.rng(val(host, 'sn-s') * 7717);
      const res = Array.from({ length: N }, () => { const sg = r.map(() => rnd() < 0.5 ? 1 : 0); let a = 0, b = 0, na = 0, nb2 = 0; r.forEach((x, i) => { const v = Math.log(1 + sg[i] * x); if (ins[i]) { a += v; na++; } if (oos[i]) { b += v; nb2++; } }); return [(Math.exp(a * 12 / na) - 1) * 100, (Math.exp(b * 12 / nb2) - 1) * 100]; });
      const best = res.reduce((m, x) => x[0] > m[0] ? x : m, res[0]), avgO = S.mean(res.map((x) => x[1]));
      const bhI = (() => { let a = 0, n = 0; r.forEach((x, i) => { if (ins[i]) { a += Math.log(1 + x); n++; } }); return (Math.exp(a * 12 / n) - 1) * 100; })();
      const rk = S.corr(res.map((x) => x[0]), res.map((x) => x[1]));
      const sig = res.filter((x) => x[0] > bhI * 0.5 + 4).length;
      $('.out', host).innerHTML = kv([['הטובה ב-2005–2015', num(best[0], 1) + '% בשנה', 'up'], ['אותה אסטרטגיה ב-2016–2025', num(best[1], 1) + '% בשנה', 'hi'], ['ממוצע כל האסטרטגיות 2016–2025', num(avgO, 1) + '% בשנה'], ['מתאם בין התקופות', num(rk, 2), Math.abs(rk) < 0.2 ? 'down' : ''], ['כמה "נראו מבריקות" במקרה', sig]]);
      // scatter
      const W = Math.max(280, $('.chart-host', host).clientWidth || 600), H = 240, pad = 30;
      const xs = res.map((x) => x[0]), ys = res.map((x) => x[1]); const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const X = (v) => pad + (v - x0) / (x1 - x0) * (W - 2 * pad), Y = (v) => H - pad - (v - y0) / (y1 - y0) * (H - 2 * pad);
      const pts = res.map((p) => `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="${p === best ? 6 : 3}" class="${p === best ? 'mark' : 'dot'}"/>`).join('');
      $('.chart-host', host).innerHTML = `<div class="chart-wrap"><svg class="chart" viewBox="0 0 ${W} ${H}"><line x1="${pad}" x2="${W - pad}" y1="${H - pad}" y2="${H - pad}" class="grid"/><line x1="${pad}" x2="${pad}" y1="${pad}" y2="${H - pad}" class="grid"/>${pts}<text x="${W - pad}" y="${H - 8}" class="ax" text-anchor="end">2005–2015: ${num(x0, 0)}% עד ${num(x1, 0)}%</text><text x="${pad + 4}" y="${pad - 8}" class="ax">2016–2025</text><text x="${X(best[0]) - 8}" y="${Y(best[1]) - 10}" class="ax mark-l" text-anchor="end">"הגאון"</text></svg></div>`;
    });
  };

  /* L27: find the bugs */
  LABS.lookahead = async (host) => {
    loading(host);
    let A; try { A = await Promise.all(['SPY', 'AAPL', 'MSFT', 'NVDA', 'AMZN'].map(U.data)); } catch (e) { return fail(host, e); }
    const spy = A[0];
    host.innerHTML = `<p class="note">ה-backtest הזה מחזיק SPY רק כשהמחיר מעל הממוצע (z-score חיובי). הוא נראה מבריק. הדלק ותקן כל באג וראה מה נשאר.</p><div class="ctls"><label class="chk"><input type="checkbox" id="lk-1" checked> באג 1: בלי shift (סוחר על הסגירה של היום)</label><label class="chk"><input type="checkbox" id="lk-2" checked> באג 2: נרמול על כל התקופה (כולל העתיד)</label><label class="chk"><input type="checkbox" id="lk-3" checked> באג 3: בלי עלויות</label></div><div class="out"></div><div class="chart-host"></div><h4 class="lab-h">הטיית שרידות: "תיק של מניות גדולות" מ-2000</h4><div class="out2"></div>`;
    const p = spy.adj, r = S.rets(p), lp = p.map(Math.log);
    live(host, () => {
      const b1 = val(host, 'lk-1'), b2 = val(host, 'lk-2'), b3 = val(host, 'lk-3');
      const W = 20; let z;
      if (b2) { const mu = S.mean(r), sd = S.std(r); z = r.map((x) => (x - mu) / sd); }
      else { z = r.map((x, i) => { if (i < 252) return 0; const w = r.slice(i - 252, i); return (x - S.mean(w)) / S.std(w); }); }
      // signal from short momentum of normalized returns
      const sig = z.map((_, i) => { if (i < W) return 0; let s = 0; for (let k = i - W + 1; k <= i; k++) s += z[k]; return s > 0 ? 1 : 0; });
      // without shift: today's signal includes today's return
      const pos = b1 ? sig : [0, ...sig.slice(0, -1)];
      const st = S.strat(r, pos, b3 ? 0 : 5);
      const A1 = S.summary(st), B1 = S.summary(r);
      const bugs = [b1, b2, b3].filter(Boolean).length;
      $('.out', host).innerHTML = kv([['CAGR של ה-backtest', pct(A1.cagr), bugs ? 'up' : 'hi'], ['קנה-והחזק', pct(B1.cagr)], ['שארפ', num(A1.sharpe, 2)], ['באגים פעילים', bugs + ' מתוך 3', bugs ? 'down' : 'up']]) + `<div class="verdict ${bugs ? 'down' : ''}">${b1 ? 'באג 1 הוא הגדול: הסיגנל "יודע" את התשואה של היום שבו הוא סוחר.' : bugs ? 'כמעט נקי. גם נרמול על כל התקופה ובלי עלויות מנפחים תוצאות.' : 'עכשיו זו בדיקה כנה. זה מה שהיה קורה באמת.'}</div>`;
      U.lineChart($('.chart-host', host), { series: [{ name: 'backtest', x: spy.dates.slice(1), y: S.equity(st).slice(1), color: 'var(--accent)' }, { name: 'קנה-והחזק', x: spy.dates.slice(1), y: S.equity(r).slice(1) }], log: true, yfmt: (v) => num(v, v < 10 ? 1 : 0) + '×' });
    });
    const al = U.align(A); const ew = al.dates.map((_, i) => S.mean(al.cols.slice(1).map((c) => c[i] / c[0])));
    $('.out2', host).innerHTML = kv([['Apple, Microsoft, NVIDIA, Amazon (שווה משקל)', pct(S.cagr(ew)) + ' בשנה', 'up'], ['SPY', pct(S.cagr(al.cols[0])) + ' בשנה']]) + '<p class="note">התוצאה נראית מדהימה כי בחרנו את המניות לפי מה שאנחנו יודעים <b>היום</b>. ב-2000 אף אחד לא ידע ש-NVIDIA תהיה ענקית, ורבות מהחברות הגדולות של אז (Enron, WorldCom, Lucent) קרסו. זו הטיית שרידות.</p>';
  };

  /* L28: costs vs net return */
  LABS.costs = async (host) => {
    loading(host);
    let spy; try { spy = await U.data('SPY'); } catch (e) { return fail(host, e); }
    host.innerHTML = `<div class="ctls">${sel('cs-k', 'אסטרטגיה', [['50/200', 'ממוצע נע 50/200 (איטית)'], ['10/30', 'ממוצע נע 10/30'], ['3/10', 'ממוצע נע 3/10 (מהירה)']], '10/30')}${sl('cs-c', 'עלות לכל צד', 0, 50, 1, 10, ' bp')}</div><div class="out"></div><h4 class="lab-h">CAGR נטו לפי עלות</h4><div class="chart-host"></div>${src('נתונים: SPY מותאם לדיבידנדים מ-2000.')}`;
    const p = spy.adj, r = S.rets(p);
    const posFor = (k) => { const [f, s] = k.split('/').map(Number); const mf = S.sma(p, f), ms = S.sma(p, s); const sig = p.map((_, i) => ms[i] != null && mf[i] > ms[i] ? 1 : 0); return sig.slice(0, r.length); };
    live(host, () => {
      const pos = posFor(val(host, 'cs-k')), c = val(host, 'cs-c');
      const cs = Array.from({ length: 26 }, (_, k) => k * 2), cur = cs.map((x) => S.cagr(S.equity(S.strat(r, pos, x))) * 100), bh = S.cagr(p) * 100;
      const st = S.strat(r, pos, c), net = S.cagr(S.equity(st));
      const be = cs.find((x, i) => cur[i] < bh);
      const zero = cs.find((x, i) => cur[i] < 0);
      $('.out', host).innerHTML = kv([['החלפות פוזיציה', num(st.trades) + ' (' + num(st.trades / (r.length / 252), 1) + ' בשנה)'], ['CAGR נטו בעלות שבחרת', pct(net), net * 100 > bh ? 'up' : 'down'], ['קנה-והחזק', pct(bh / 100)], ['מתחת לקנה-והחזק החל מ-', be == null ? 'לא בטווח' : be + ' bp', 'hi'], ['הפסדית החל מ-', zero == null ? 'לא בטווח' : zero + ' bp']]);
      U.lineChart($('.chart-host', host), { series: [{ name: 'אסטרטגיה נטו', x: cs, y: cur, color: 'var(--accent)' }, { name: 'קנה-והחזק', x: cs, y: cs.map(() => bh), dash: '5 4', noDot: true }], xfmt: (x) => x + ' bp', yfmt: (v) => num(v, 1) + '%', zero: true, marks: [{ i: Math.round(c / 2), y: cur[Math.round(c / 2)], label: 'אתה כאן' }] });
    });
  };

  /* L29: walk-forward vs in-sample optimum */
  LABS.walkforward = async (host) => {
    loading(host);
    let spy; try { spy = await U.data('SPY'); } catch (e) { return fail(host, e); }
    const p = spy.adj, r = S.rets(p), dts = spy.dates.slice(1);
    const F = [5, 10, 20, 50, 100], L = [50, 100, 150, 200, 250];
    const grid = []; F.forEach((f) => L.forEach((s) => { if (s > f) { const mf = S.sma(p, f), ms = S.sma(p, s); grid.push({ f, s, pos: p.slice(0, r.length).map((_, i) => ms[i] != null && mf[i] > ms[i] ? 1 : 0) }); } }));
    host.innerHTML = `<div class="ctls">${sl('wf-c', 'עלות לכל צד', 0, 20, 1, 5, ' bp')}${sel('wf-t', 'שנת מבחן ראשונה', [['2008', '2008'], ['2010', '2010'], ['2013', '2013']], '2010')}</div><div class="out"></div><div class="chart-host"></div><div class="picks"></div>${src(grid.length + ' שילובי חלונות. walk-forward: בכל שנה בוחרים את השילוב הטוב ביותר על כל הנתונים עד אז, ומחזיקים אותו שנה.')}`;
    live(host, () => {
      const c = val(host, 'wf-c'), t0 = val(host, 'wf-t');
      const yearIdx = (y) => dts.findIndex((d) => d >= y);
      const st0 = yearIdx(t0); const perf = (g, a, b) => { const s = S.strat(r.slice(a, b), g.pos.slice(a, b), c); return s.reduce((x, v) => x + Math.log(1 + v), 0); };
      // in-sample: best over whole test span (cheating)
      const ins = grid.reduce((m, g) => perf(g, st0, r.length) > perf(m, st0, r.length) ? g : m, grid[0]);
      const wf = new Array(r.length - st0).fill(0); const picks = [];
      for (let y = Number(t0); y <= Number(dts[dts.length - 1].slice(0, 4)); y++) {
        const a = yearIdx(String(y)), b0 = yearIdx(String(y + 1)), b = b0 < 0 ? r.length : b0; if (a < 0) break;
        const best = grid.reduce((m, g) => perf(g, 200, a) > perf(m, 200, a) ? g : m, grid[0]); picks.push([y, best.f + '/' + best.s]);
        const s = S.strat(r.slice(a, b), best.pos.slice(a, b), c); s.forEach((v, k) => wf[a - st0 + k] = v);
      }
      const insR = S.strat(r.slice(st0), ins.pos.slice(st0), c), bh = r.slice(st0);
      const C = (x) => S.cagr(S.equity(x));
      $('.out', host).innerHTML = kv([['"הטוב ביותר" בדיעבד (' + ins.f + '/' + ins.s + ')', pct(C(insR)), 'down'], ['walk-forward כנה', pct(C(wf)), 'hi'], ['קנה-והחזק', pct(C(bh))], ['הפער בין בדיעבד לכנה', num((C(insR) - C(wf)) * 100, 2) + ' נקודות בשנה']]);
      U.lineChart($('.chart-host', host), { series: [{ name: 'בדיעבד (מרמה)', x: dts.slice(st0), y: S.equity(insR).slice(1), color: 'var(--down)', dash: '5 3' }, { name: 'walk-forward', x: dts.slice(st0), y: S.equity(wf).slice(1), color: 'var(--accent)' }, { name: 'קנה-והחזק', x: dts.slice(st0), y: S.equity(bh).slice(1) }], log: true, yfmt: (v) => num(v, 2) + '×' });
      $('.picks', host).innerHTML = `<div class="chips">${picks.map((q) => `<span class="tag">${q[0]}: ${q[1]}</span>`).join('')}</div>`;
    });
  };

  /* L30: honest benchmark table */
  LABS.report = async (host) => {
    loading(host);
    let A; try { A = await Promise.all(['SPY', 'TLT', 'GLD', '^TA125.TA'].map(U.data)); } catch (e) { return fail(host, e); }
    host.innerHTML = `<div class="ctls">${sl('rp-n', 'כמה וריאציות ניסית בסך הכול', 1, 200, 1, 30)}${sl('rp-c', 'עלות לכל צד', 0, 20, 1, 5, ' bp')}</div><div class="out"></div>${src('נתונים: SPY, TLT, GLD מותאמים, ות"א 125 (במטבע מקומי), 2005 עד היום.')}`;
    const al = U.align(A.slice(0, 3)); const i0 = al.dates.findIndex((d) => d >= '2005'); const [ps, pb, pg] = al.cols.map((c) => c.slice(i0)); const dts = al.dates.slice(i0);
    const rs = S.rets(ps), rb = S.rets(pb), rg = S.rets(pg);
    const ta = U.sliceFrom(A[3].dates, A[3].adj, '2005'), rta = S.rets(ta.vals);
    live(host, () => {
      const n = val(host, 'rp-n'), c = val(host, 'rp-c'), yrs = rs.length / 252;
      const mix = (w) => rs.map((x, i) => w[0] * x + w[1] * rb[i] + (w[2] || 0) * rg[i]);
      const mf = S.sma(ps, 50), msl = S.sma(ps, 200), pos = ps.slice(0, rs.length).map((_, i) => msl[i] != null && mf[i] > msl[i] ? 1 : 0), ma = S.strat(rs, pos, c);
      const turn = ma.trades / rs.length, rnd = U.rng(42);
      const randS = Array.from({ length: 50 }, () => { let inM = 1; const pp = rs.map(() => { if (rnd() < turn) inM = 1 - inM; return inM; }); return S.summary(S.strat(rs, pp, c)); });
      const rowsOf = (n2, m) => [n2, pct(m.cagr), pct(m.vol), num(m.sharpe, 2), pct(m.mdd)];
      const avg = (k) => S.mean(randS.map((x) => x[k]));
      const emax = Math.sqrt(2 * Math.log(Math.max(n, 2))) / Math.sqrt(yrs);
      const maS = S.summary(ma);
      $('.out', host).innerHTML = tblRows(['', 'CAGR', 'תנודתיות', 'שארפ', 'ירידה מקס\''], [
        rowsOf('<b>MA 50/200 (האסטרטגיה)</b>', maS), rowsOf('קנה-והחזק SPY', S.summary(rs)), rowsOf('ת"א 125', S.summary(rta)), rowsOf('60/40 (SPY/TLT)', S.summary(mix([0.6, 0.4]))), rowsOf('1/N (SPY/TLT/GLD)', S.summary(mix([1 / 3, 1 / 3, 1 / 3]))), ['סיגנל אקראי, אותה תדירות (ממוצע 50)', pct(avg('cagr')), pct(avg('vol')), num(avg('sharpe'), 2), pct(avg('mdd'))]]) +
        kv([['שארפ שצפוי מהטובה מבין ' + n + ' ניסיונות במזל בלבד', '≈ ' + num(emax, 2), 'hi'], ['השארפ של האסטרטגיה', num(maS.sharpe, 2), maS.sharpe > emax + S.summary(rs).sharpe ? 'up' : 'down']]) +
        `<div class="verdict">כלל אצבע של שארפ מנוכה: האסטרטגיה צריכה לנצח את קנה-והחזק בפער גדול מ-${num(emax, 2)} בשארפ כדי לומר שזה לא מזל של ${n} ניסיונות.</div>`;
    });
  };

  /* monthly S&P features shared by ML labs */
  const mlData = async () => {
    const g = await U.data('^GSPC'); const mo = U.monthly(g.dates, g.close); const p = mo.vals, rows = [];
    for (let i = 13; i < p.length - 1; i++) { const r1 = p[i] / p[i - 1] - 1, r3 = p[i] / p[i - 3] - 1, r12 = p[i - 1] / p[i - 12] - 1; const v = S.std([0, 1, 2, 3, 4, 5].map((k) => p[i - k] / p[i - k - 1] - 1)); rows.push({ d: mo.dates[i + 1], x: [r1, r3, r12, v], y: p[i + 1] > p[i] ? 1 : 0, ret: p[i + 1] / p[i] - 1 }); }
    return rows;
  };
  const acc = (m, X, y) => X.reduce((s, x, i) => s + ((m.predict(x) > 0.5 ? 1 : 0) === y[i] ? 1 : 0), 0) / X.length;

  /* L31: leakage in cross-validation */
  LABS.mlleak = async (host) => {
    loading(host);
    let rows; try { rows = await mlData(); } catch (e) { return fail(host, e); }
    host.innerHTML = `<button class="btn" id="ml-go">הרץ את הניסוי</button><div class="out"></div>${src('נתונים: S&P 500 חודשי מ-2000 (' + rows.length + ' חודשים). רגרסיה לוגיסטית שרצה בדפדפן שלך.')}`;
    const go = () => {
      const rnd = U.rng(11), y = rows.map((r) => r.y), n = rows.length;
      // part A: 200 pure-noise features, select top 10 by correlation on ALL data (leak) vs inside train fold
      const noise = rows.map(() => Array.from({ length: 200 }, () => U.randn(rnd)));
      const topK = (idx) => { const yy = idx.map((i) => y[i]); return Array.from({ length: 200 }, (_, j) => [j, Math.abs(S.corr(idx.map((i) => noise[i][j]), yy))]).sort((a, b) => b[1] - a[1]).slice(0, 10).map((x) => x[0]); };
      const cv = (folds, selectInside) => { const allSel = topK([...Array(n).keys()]); return S.mean(folds.map(([tr, te]) => { const cols = selectInside ? topK(tr) : allSel; const sub = (I) => I.map((i) => cols.map((j) => noise[i][j])); const [Xtr, Xte] = S.standardize(sub(tr), sub(te)); const m = S.logit(Xtr, tr.map((i) => y[i]), 200, 0.2); return acc(m, Xte, te.map((i) => y[i])); })); };
      const order = U.shuffle([...Array(n).keys()], rnd), k = 5, sz = Math.floor(n / k);
      const kf = Array.from({ length: k }, (_, f) => { const te = order.slice(f * sz, (f + 1) * sz); const s = new Set(te); return [order.filter((i) => !s.has(i)), te]; });
      const ts = Array.from({ length: k }, (_, f) => { const end = Math.floor(n * (f + 2) / (k + 1)), stt = Math.floor(n * (f + 1) / (k + 1)); return [[...Array(stt - 1).keys()], [...Array(end - stt).keys()].map((q) => q + stt)]; });
      const leak = cv(kf, false), fair = cv(ts, true);
      // part B: real features, shuffled vs time split
      const X = rows.map((r) => r.x);
      const cvReal = (folds) => S.mean(folds.map(([tr, te]) => { const [Xtr, Xte] = S.standardize(tr.map((i) => X[i]), te.map((i) => X[i])); const m = S.logit(Xtr, tr.map((i) => y[i])); return acc(m, Xte, te.map((i) => y[i])); }));
      const base = S.mean(y);
      $('.out', host).innerHTML = `<h4 class="lab-h">ניסוי א: 200 משתנים של רעש טהור</h4>` + kv([['בחירת משתנים על כל הנתונים + KFold מעורבב', pct(leak, 1), 'down'], ['בחירה בתוך האימון + TimeSeriesSplit', pct(fair, 1), 'up'], ['ניחוש: תמיד "עלייה"', pct(base, 1)]]) +
        `<h4 class="lab-h">ניסוי ב: מומנטום ותנודתיות אמיתיים</h4>` + kv([['KFold מעורבב', pct(cvReal(kf), 1)], ['TimeSeriesSplit', pct(cvReal(ts), 1), 'hi'], ['תמיד "עלייה"', pct(base, 1)]]) +
        `<div class="verdict">בניסוי א אין שום מידע אמיתי, ובכל זאת הבדיקה הדולפת נראית ${leak > base ? 'טובה מהניחוש' : 'סבירה'}. רק הבדיקה הנקייה מראה את האמת: אין כאן כלום.</div>`;
      U.tone('good');
    };
    $('#ml-go', host).addEventListener('click', () => { $('.out', host).innerHTML = '<div class="loading"><i></i>מאמן מודלים…</div>'; setTimeout(go, 30); });
  };

  /* L32: predict next month direction, judge as a strategy */
  LABS.mlpredict = async (host) => {
    loading(host);
    let rows; try { rows = await mlData(); } catch (e) { return fail(host, e); }
    host.innerHTML = `<div class="ctls">${sl('mp-c', 'עלות לכל צד', 0, 30, 1, 10, ' bp')}${sl('mp-t', 'סף ביטחון לכניסה', 50, 70, 1, 50, '%')}</div><button class="btn" id="mp-go">אמן walk-forward וחזה</button><div class="out"></div><div class="chart-host"></div>${src('רגרסיה לוגיסטית על S&P 500 חודשי, מאומנת מחדש כל חודש על כל העבר (walk-forward). משתנים: מומנטום 1, 3, 12-1 חודשים ותנודתיות 6 חודשים.')}`;
    const go = () => {
      const c = val(host, 'mp-c'), th = val(host, 'mp-t') / 100, start = 60, preds = [];
      for (let i = start; i < rows.length; i++) { const tr = rows.slice(0, i); const [Xtr, Xte] = S.standardize(tr.map((r) => r.x), [rows[i].x]); const m = S.logit(Xtr, tr.map((r) => r.y), 150, 0.2); preds.push(m.predict(Xte[0])); }
      const test = rows.slice(start), hit = test.filter((r, k) => (preds[k] > 0.5 ? 1 : 0) === r.y).length / test.length, upRate = S.mean(test.map((r) => r.y));
      const pos = preds.map((p) => p > th ? 1 : 0), st = S.strat(test.map((r) => r.ret), pos, c), bh = test.map((r) => r.ret);
      const C = (x) => S.cagr(S.equity(x), 12);
      $('.out', host).innerHTML = kv([['דיוק המודל', pct(hit, 1), 'hi'], ['דיוק "תמיד עלייה"', pct(upRate, 1)], ['CAGR מודל אחרי עלויות', pct(C(st))], ['CAGR קנה-והחזק', pct(C(bh))], ['חודשים בשוק', pct(S.mean(pos), 0)]]) + `<div class="verdict ${C(st) > C(bh) && hit > upRate ? 'up' : 'down'}">${hit <= upRate ? 'המודל לא ניצח את קו הבסיס הטיפש. זו התוצאה הכנה הנפוצה.' : C(st) > C(bh) ? 'המודל ניצח בנתונים האלה. רשום את הניסוי ביומן וחשב כמה ניסיונות עשית.' : 'דיוק טוב יותר, אבל כאסטרטגיה הוא מפסיד לקנה-והחזק.'}</div>`;
      U.lineChart($('.chart-host', host), { series: [{ name: 'מודל ML', x: test.map((r) => r.d), y: S.equity(st).slice(1), color: 'var(--accent)' }, { name: 'קנה-והחזק', x: test.map((r) => r.d), y: S.equity(bh).slice(1) }], log: true, yfmt: (v) => num(v, 2) + '×' });
      U.tone('good');
    };
    bindOut(host);
    $('#mp-go', host).addEventListener('click', () => { $('.out', host).innerHTML = '<div class="loading"><i></i>מאמן ' + (rows.length - 60) + ' מודלים…</div>'; setTimeout(go, 30); });
  };

  /* L33: volatility targeting with EWMA, plus LLM batch cost */
  LABS.voltarget = async (host) => {
    loading(host);
    let spy; try { spy = await U.data('SPY'); } catch (e) { return fail(host, e); }
    host.innerHTML = `<div class="ctls">${sl('vt-t', 'יעד תנודתיות', 5, 25, 1, 15, '%')}${sl('vt-l', 'λ של EWMA', 0.8, 0.99, 0.01, 0.94)}${sl('vt-c', 'עלות לכל צד', 0, 20, 1, 5, ' bp')}</div><div class="out"></div><div class="chart-host"></div><h4 class="lab-h">מחשבון עלות: דירוג כותרות עם Haiku 4.5 ב-Batch</h4><div class="ctls">${sl('vt-h', 'כותרות', 100, 5000, 100, 300)}${sl('vt-in', 'טוקנים לכותרת (קלט)', 50, 500, 10, 150)}</div><div class="out2"></div>${src('נתונים: SPY מותאם מ-2000. החשיפה מתעדכנת פעם בשבוע, בלי מינוף (תקרה 100%).')}`;
    const p = spy.adj, r = S.rets(p);
    live(host, () => {
      const tgt = val(host, 'vt-t') / 100, lam = val(host, 'vt-l'), c = val(host, 'vt-c');
      let v2 = S.std(r.slice(0, 60)) ** 2; const fc = [], pos = []; let w = 1;
      for (let i = 0; i < r.length; i++) { const vol = Math.sqrt(v2 * 252); fc.push(vol); if (i % 5 === 0) w = Math.min(1, tgt / vol); pos.push(w); v2 = lam * v2 + (1 - lam) * r[i] * r[i]; }
      const st = S.strat(r, pos, c), A = S.summary(st), B = S.summary(r);
      const absR = r.slice(60).map(Math.abs), corrVol = S.corr(fc.slice(60), absR);
      const mom = r.map((_, i) => i < 21 ? 0 : p[i] / p[i - 21] - 1), corrRet = S.corr(mom.slice(60), r.slice(60));
      $('.out', host).innerHTML = tblRows(['', 'יעד תנודתיות', 'קנה-והחזק'], [['CAGR', pct(A.cagr), pct(B.cagr)], ['תנודתיות', `<b>${pct(A.vol)}</b>`, pct(B.vol)], ['שארפ', num(A.sharpe, 2), num(B.sharpe, 2)], ['ירידה מקסימלית', `<b>${pct(A.mdd)}</b>`, pct(B.mdd)], ['חשיפה ממוצעת', pct(S.mean(pos), 0), '100%']]) +
        kv([['מתאם: תנודתיות חזויה ↔ גודל התנועה מחר', num(corrVol, 2), 'up'], ['מתאם: מומנטום ↔ תשואה מחר', num(corrRet, 3), 'down']]) + '<p class="note">תנודתיות "דביקה" ולכן ניתנת לחיזוי. הכיוון כמעט לא.</p>';
      U.lineChart($('.chart-host', host), { series: [{ name: 'יעד תנודתיות', x: spy.dates.slice(1), y: S.equity(st).slice(1), color: 'var(--accent)' }, { name: 'קנה-והחזק', x: spy.dates.slice(1), y: S.equity(r).slice(1) }], log: true, yfmt: (v) => num(v, 1) + '×' });
      const nH = val(host, 'vt-h'), tin = val(host, 'vt-in');
      $('.out2', host).innerHTML = kv([['קלט', money(nH * tin / 1e6 * 0.5, 'USD', 4)], ['פלט (כ-10 טוקנים לכותרת)', money(nH * 10 / 1e6 * 2.5, 'USD', 4)], ['סך הכול', money(nH * tin / 1e6 * 0.5 + nH * 10 / 1e6 * 2.5, 'USD', 4), 'hi']]);
    });
  };

  /* L34 */
  LABS.paper = (host) => {
    const rl = APP.state.stopRules || { dd: 15, lag: 8 };
    host.innerHTML = `<p class="note">הכללים נשמרים ויחולו בסימולטור: כשאחד מהם מופר, המסחר נעצר ומקבלים דוח.</p><div class="ctls">${sl('pp-d', 'עצירה בירידה מהשיא של', 5, 40, 1, rl.dd, '%')}${sl('pp-l', 'עצירה בפיגור אחרי המדד של', 2, 30, 1, rl.lag, ' נק\'')}</div><button class="btn" id="pp-go">שמור ופתח את הסימולטור</button>`;
    bindOut(host);
    const saveR = () => { APP.state.stopRules = { dd: val(host, 'pp-d'), lag: val(host, 'pp-l'), on: true }; APP.persist(); };
    $$('input', host).forEach((i) => i.addEventListener('change', saveR));
    $('#pp-go', host).addEventListener('click', () => { saveR(); APP.go('sim'); });
  };

  /* L35 */
  const CAP = ['רשמתי מראש השערה, תקופה נעולה ועלויות', 'הרצתי קנה-והחזק, סיגנל אקראי ו"תמיד עלייה"', 'בדקתי אסטרטגיית כללים עם walk-forward', 'בדקתי אסטרטגיית ML עם walk-forward', 'כל הסיגנלים מוזזים ביום (בלי מידע מהעתיד)', 'בדקתי הטיית שרידות ביקום המניות', 'עלויות כלולות, עם ניתוח רגישות 0–50 bp', 'פרסמתי את כל הניסיונות (יומן) ושארפ מנוכה', 'הרצתי את התקופה הנעולה פעם אחת בלבד', 'כתבתי עמוד מסקנה עם "מה היה משנה את דעתי"', 'IPS סופי עם תוכנית לשנה של −30%', '3–6 חודשי מסחר נייר עם כללי עצירה'];
  LABS.capstone = (host) => {
    const st = APP.state.capstone || { checks: [], text: '' };
    host.innerHTML = `<ul class="checklist interactive">${CAP.map((c, i) => `<li><label class="chk"><input type="checkbox" data-i="${i}" ${st.checks[i] ? 'checked' : ''}> ${c}</label></li>`).join('')}</ul><div class="meter"><i class="up"></i></div><label class="ctl ctl-area"><span>עמוד המסקנה שלך</span><textarea id="cp-t" rows="6" placeholder="בדקתי X וריאציות... בתקופה הנעולה... המסקנה... מה היה משנה את דעתי...">${esc(st.text)}</textarea></label><button class="btn" id="cp-ai">בקש ביקורת מהבודק הסקפטי</button><div class="out"></div>`;
    const upd = () => { const ch = $$('input[data-i]', host).map((i) => i.checked); st.checks = ch; st.text = $('#cp-t', host).value; APP.state.capstone = st; APP.persist(); $('.meter i', host).style.width = (ch.filter(Boolean).length / CAP.length * 100) + '%'; };
    $$('input[data-i]', host).forEach((i) => i.addEventListener('change', () => { upd(); if (i.checked) U.good(i.closest('li')); }));
    $('#cp-t', host).addEventListener('input', upd); upd();
    $('#cp-ai', host).addEventListener('click', () => APP.tutor.review(st, CAP, $('.out', host)));
  };
})();
