/* Interactive labs, part 1 (lessons 1-17). Each lab: LABS[id](host, lesson) renders into host. */
window.LABS = {};
(function () {
  const { $, $$, h, esc, num, pct, money, stats: S } = U;

  /* slider row: returns html; values read via val(host,id) */
  const sl = (id, label, min, max, step, v, unit = '') => `<label class="ctl"><span>${label}</span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${v}"><output data-for="${id}" data-unit="${unit}"></output></label>`;
  const nb = (id, label, v, unit = '') => `<label class="ctl ctl-num"><span>${label}</span><input type="number" inputmode="decimal" id="${id}" value="${v}"><em>${unit}</em></label>`;
  const sel = (id, label, opts, v) => `<label class="ctl ctl-sel"><span>${label}</span><select id="${id}">${opts.map((o) => `<option value="${esc(o[0])}"${o[0] == v ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>`;
  const val = (host, id) => { const el = $('#' + id, host); return el.type === 'checkbox' ? el.checked : (el.tagName === 'SELECT' ? el.value : Number(el.value)); };
  const bindOut = (host) => $$('output[data-for]', host).forEach((o) => { const i = $('#' + o.dataset.for, host); const f = () => { o.textContent = num(Number(i.value), i.step.includes('.') ? (i.step.split('.')[1].length) : 0) + o.dataset.unit; }; i.addEventListener('input', f); f(); });
  const live = (host, fn) => { bindOut(host); $$('input,select', host).forEach((i) => i.addEventListener(i.type === 'range' ? 'input' : 'change', () => fn())); fn(); };
  const kv = (rows) => `<div class="kv">${rows.map((r) => `<div class="${r[2] || ''}"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}</div>`;
  const loading = (host) => { host.innerHTML = '<div class="loading"><i></i>טוען נתוני שוק אמיתיים…</div>'; };
  const fail = (host, e) => { host.innerHTML = `<p class="note warn">לא הצלחתי לטעון את קובץ הנתונים (${esc(e.message)}). פתח את האפליקציה דרך שרת (למשל <code>python -m http.server</code>) ולא כקובץ מקומי.</p>`; };
  const src = (txt) => `<p class="src">${txt}</p>`;
  const tblRows = (head, rows) => `<div class="tbl-wrap"><table class="tbl"><tr>${head.map((x) => `<th>${x}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((x) => `<td>${x}</td>`).join('')}</tr>`).join('')}</table></div>`;
  LABS._h = { sl, nb, sel, val, live, kv, loading, fail, src, tblRows, bindOut };

  /* L1, L4 */
  LABS.compound = (host) => {
    host.innerHTML = `<div class="ctls">${sl('c-a', 'סכום התחלתי', 0, 100000, 1000, 10000, ' $')}${sl('c-m', 'הפקדה חודשית', 0, 3000, 50, 300, ' $')}${sl('c-r', 'תשואה שנתית', 0, 12, 0.1, 6.6, '%')}${sl('c-y', 'שנים', 1, 50, 1, 30, '')}${sl('c-f', 'דמי ניהול', 0, 2, 0.01, 0.07, '%')}</div><div class="out"></div><div class="chart-host"></div>`;
    live(host, () => {
      const a = val(host, 'c-a'), m = val(host, 'c-m'), r = val(host, 'c-r') / 100, y = val(host, 'c-y'), f = val(host, 'c-f') / 100;
      const run = (fee) => { let b = a, dep = a; const ys = [b]; for (let k = 1; k <= y * 12; k++) { b = (b + m) * Math.pow(1 + r - fee, 1 / 12); dep += m; if (k % 12 === 0) ys.push(b); } return { b, dep, ys }; };
      const noFee = run(0), withFee = run(f);
      $('.out', host).innerHTML = kv([['הפקדת בסך הכול', money(withFee.dep)], ['שווי בסוף (עם דמי ניהול)', money(withFee.b), 'hi'], ['רווח מריבית דריבית', money(withFee.b - withFee.dep), 'up'], ['עלות דמי הניהול לאורך הדרך', money(noFee.b - withFee.b), 'down'], ['זמן הכפלה (כלל 72)', r > 0 ? num(72 / (r * 100), 1) + ' שנים' : '—']]);
      U.lineChart($('.chart-host', host), { series: [{ name: 'בלי דמי ניהול', x: noFee.ys.map((_, i) => i), y: noFee.ys, color: 'var(--muted)', dash: '4 3' }, { name: 'עם דמי ניהול', x: withFee.ys.map((_, i) => i), y: withFee.ys, area: true }], xfmt: (x) => 'שנה ' + x, yfmt: (v) => money(v) });
    });
  };

  /* L2 */
  LABS.emergency = (host) => {
    host.innerHTML = `<div class="ctls">${nb('e-x', 'הוצאות חודשיות', 8000, '₪')}${nb('e-s', 'חיסכון נוכחי', 12000, '₪')}${nb('e-m', 'חיסכון חודשי', 3000, '₪')}${sl('e-t', 'יעד (חודשי הוצאות)', 3, 12, 1, 6, '')}<label class="chk"><input type="checkbox" id="e-d"> יש לי חוב בריבית גבוהה (אשראי, מינוס)</label><label class="chk"><input type="checkbox" id="e-n"> אצטרך חלק מהכסף ב-5 השנים הקרובות</label><label class="chk"><input type="checkbox" id="e-c"> אני שוקל CFD, אופציות או כסף מושאל</label></div><div class="out"></div>`;
    live(host, () => {
      const x = val(host, 'e-x'), s = val(host, 'e-s'), m = val(host, 'e-m'), t = val(host, 'e-t');
      const target = x * t, months = s >= target ? 0 : (m > 0 ? Math.ceil((target - s) / m) : Infinity);
      const checks = [[s >= target, 'כרית ביטחון מלאה'], [!val(host, 'e-d'), 'אין חוב בריבית גבוהה'], [!val(host, 'e-n'), 'הכסף לא נדרש ל-5 שנים'], [!val(host, 'e-c'), 'בלי מינוף ובלי CFD']];
      const ready = checks.every((c) => c[0]);
      $('.out', host).innerHTML = kv([['יעד קרן חירום', num(target) + ' ₪', 'hi'], ['חודשים עד היעד', isFinite(months) ? num(months) : 'לא יגיע בלי חיסכון'], ['בעוד', isFinite(months) && months > 0 ? new Date(Date.now() + months * 2629800000).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' }) : '—']]) +
        `<ul class="checklist">${checks.map((c) => `<li class="${c[0] ? 'ok' : 'no'}">${c[1]}</li>`).join('')}</ul><div class="verdict ${ready ? 'up' : 'down'}">${ready ? 'מוכן להשקיע: אפשר להתקדם לשלב 2' : 'עוד לא: קודם השלם את מה שמסומן באדום'}</div>`;
    });
  };

  /* L3 */
  LABS.fees = (host) => {
    host.innerHTML = `<div class="ctls">${sl('f-a', 'סכום', 10000, 500000, 10000, 100000, ' ₪')}${sl('f-y', 'שנים', 1, 40, 1, 30)}${sl('f-r', 'תשואה שנתית לפני עלויות', 2, 10, 0.5, 7, '%')}${sl('f-1', 'קרן סל ישראלית', 0.3, 1.2, 0.05, 0.7, '%')}${sl('f-2', 'קרן אירית בת"א', 0.03, 0.3, 0.01, 0.08, '%')}</div><div class="out"></div><div class="chart-host"></div>`;
    live(host, () => {
      const a = val(host, 'f-a'), y = val(host, 'f-y'), r = val(host, 'f-r') / 100, f1 = val(host, 'f-1') / 100, f2 = val(host, 'f-2') / 100;
      const s1 = [], s2 = []; for (let k = 0; k <= y; k++) { s1.push(a * Math.pow(1 + r - f1, k)); s2.push(a * Math.pow(1 + r - f2, k)); }
      $('.out', host).innerHTML = kv([['קרן ישראלית בסוף', num(s1[y]) + ' ₪'], ['קרן אירית בסוף', num(s2[y]) + ' ₪', 'hi'], ['ההפרש (אותו מדד בדיוק)', num(s2[y] - s1[y]) + ' ₪', 'up'], ['ההפרש כאחוז מהסכום הסופי', pct((s2[y] - s1[y]) / s2[y])]]);
      U.lineChart($('.chart-host', host), { series: [{ name: 'קרן ישראלית ' + num(f1 * 100, 2) + '%', x: s1.map((_, i) => i), y: s1, color: 'var(--down)' }, { name: 'קרן אירית ' + num(f2 * 100, 2) + '%', x: s2.map((_, i) => i), y: s2, color: 'var(--up)' }], xfmt: (x) => 'שנה ' + x, yfmt: (v) => num(v / 1000) + 'K' });
    });
  };

  /* L5: real S&P 500 drawdowns */
  LABS.history = async (host) => {
    loading(host);
    let d; try { d = await U.data('^GSPC'); } catch (e) { return fail(host, e); }
    host.innerHTML = `<div class="ctls row">${sel('h-p', 'תקופה', [['2000', '2000 עד היום'], ['2007', '2007–2013'], ['2020', '2020–2021'], ['2022', '2022–2024']], '2000')}<label class="chk"><input type="checkbox" id="h-l" checked> סקאלה לוגריתמית</label></div><div class="chart-host c1"></div><h4 class="lab-h">ירידה מהשיא</h4><div class="chart-host c2"></div><h4 class="lab-h">המפולות בנתונים (ירידה של 15% ומעלה)</h4><div class="eps"></div>${src('נתונים: מדד S&P 500 יומי, Yahoo Finance, מ-2000 ועד ' + d.dates[d.dates.length - 1].split('-').reverse().join('/') + '. תשואות מחיר, בלי דיבידנדים.')}`;
    // episodes on full series
    const eq = d.close, dd = S.dd(eq), eps = [];
    let i = 0; while (i < eq.length) { if (dd[i] < -0.15) { let pk = i; while (pk > 0 && dd[pk] < 0) pk--; let tr = i; let j = i; while (j < eq.length && dd[j] < 0) { if (dd[j] < dd[tr]) tr = j; j++; } eps.push({ pk, tr, rec: j < eq.length ? j : null, depth: dd[tr] }); i = j + 1; } else i++; }
    const mo = (a, b) => Math.round((new Date(d.dates[b]) - new Date(d.dates[a])) / 2629800000);
    $('.eps', host).innerHTML = tblRows(['שיא', 'שפל', 'ירידה', 'חזרה לשיא'], eps.map((e) => [d.dates[e.pk].split('-').reverse().join('/'), d.dates[e.tr].split('-').reverse().join('/'), `<b class="down">${pct(e.depth)}</b>`, e.rec ? `${num(mo(e.tr, e.rec))} חודשים מהשפל` : 'עוד לא']));
    const draw = () => {
      const p = val(host, 'h-p'), rng = { '2000': ['2000', null], '2007': ['2007-01', '2013-12-31'], '2020': ['2020-01', '2021-06-30'], '2022': ['2021-10', '2024-06-30'] }[p];
      const s = U.sliceFrom(d.dates, d.close, rng[0], rng[1]);
      U.lineChart($('.c1', host), { series: [{ name: 'S&P 500', x: s.dates, y: s.vals, area: true }], log: val(host, 'h-l') });
      const sdd = S.dd(s.vals);
      U.lineChart($('.c2', host), { series: [{ name: 'ירידה מהשיא', x: s.dates, y: sdd, color: 'var(--down)', area: true }], yfmt: (v) => pct(v, 0), tipfmt: (v) => pct(v), h: 150 });
    };
    live(host, draw);
  };

  /* L6: real volatility + currency risk */
  LABS.volatility = async (host) => {
    loading(host);
    let A; try { A = await Promise.all(['SPY', '^TA125.TA', 'TA35.TA', 'QQQ', 'BTC-USD', 'ILS=X'].map(U.data)); } catch (e) { return fail(host, e); }
    const [spy, ta125, ta35, qqq, btc, fx] = A;
    host.innerHTML = `<div class="ctls row">${sel('v-f', 'מתאריך', [['2005-01-01', '2005'], ['2010-01-01', '2010'], ['2015-01-01', '2015'], ['2020-01-01', '2020'], ['2023-01-01', '2023']], '2010-01-01')}</div><div class="out"></div><h4 class="lab-h">SPY בדולרים מול SPY בשקלים (שער יציג אמיתי)</h4><div class="chart-host"></div><div class="out2"></div>${src('נתונים: Yahoo Finance, מחירים מותאמים לדיבידנדים. תנודתיות = סטיית תקן יומית × √252.')}`;
    live(host, () => {
      const from = val(host, 'v-f');
      const rows = [[spy, 'SPY (S&P 500)'], [qqq, 'QQQ (נאסד"ק)'], [ta125, 'ת"א 125 (בשקלים)'], [ta35, 'ת"א 35 (בשקלים)'], [btc, 'ביטקוין']].map(([s, n]) => { const x = U.sliceFrom(s.dates, s.adj, from); if (x.vals.length < 50) return [n, '—', '—', '—']; const r = S.rets(x.vals); const ppy = s === btc ? 365 : 252; return [n, `<b>${pct(S.vol(r, ppy))}</b>`, pct(S.cagr(x.vals, ppy)), pct(S.maxdd(x.vals))]; });
      $('.out', host).innerHTML = tblRows(['נכס', 'תנודתיות שנתית', 'תשואה שנתית', 'ירידה מקסימלית'], rows);
      const al = U.align([spy, fx]); const i0 = al.dates.findIndex((d) => d >= from);
      const dts = al.dates.slice(i0), usd = al.cols[0].slice(i0), rate = al.cols[1].slice(i0);
      const ils = usd.map((v, i) => v * rate[i]);
      const nu = usd.map((v) => v / usd[0] * 100), ni = ils.map((v) => v / ils[0] * 100);
      U.lineChart($('.chart-host', host), { series: [{ name: 'בדולרים', x: dts, y: nu }, { name: 'בשקלים', x: dts, y: ni, color: 'var(--accent)' }], yfmt: (v) => num(v) });
      const ru = S.rets(usd), ri = S.rets(ils);
      $('.out2', host).innerHTML = kv([['תשואה שנתית בדולרים', pct(S.cagr(usd))], ['תשואה שנתית בשקלים', pct(S.cagr(ils)), 'hi'], ['תנודתיות בדולרים', pct(S.vol(ru))], ['תנודתיות בשקלים', pct(S.vol(ri))], ['דולר/שקל בתחילה → היום', num(rate[0], 3) + ' → ' + num(rate[rate.length - 1], 3)]]);
    });
  };

  /* L7: skewed single-stock outcomes (simulation calibrated to Bessembinder) */
  LABS.diversify = (host) => {
    host.innerHTML = `<div class="ctls">${sl('d-k', 'מניות בכל תיק', 1, 50, 1, 5)}${sl('d-s', 'סיבוב הגרלה', 1, 20, 1, 1)}</div><div class="out"></div><div class="chart-host"></div>${src('סימולציה: 50 מניות ל-20 שנה, תשואה צפויה זהה (7%) ותנודתיות ייחודית גבוהה (45%). כמו במחקר של Bessembinder, ההתפלגות מוטה: מעט מניות ענק, הרבה מפסידות.')}`;
    live(host, () => {
      const k = val(host, 'd-k'), rnd = U.rng(val(host, 'd-s') * 7919);
      const N = 50, Y = 20, sig = 0.45, mu = 0.07;
      const mult = Array.from({ length: N }, () => Math.exp((Math.log(1 + mu) - sig * sig / 2) * Y + sig * Math.sqrt(Y) * U.randn(rnd)));
      const all = S.mean(mult), allC = Math.pow(all, 1 / Y) - 1;
      const sorted = mult.slice().sort((a, b) => b - a), top = sorted.slice(0, 2).reduce((s, x) => s + x, 0) / mult.reduce((s, x) => s + x, 0);
      const losers = mult.filter((m) => m < Math.pow(1.03, Y)).length;
      const pf = Array.from({ length: 1000 }, () => { const pick = U.shuffle(mult.map((_, i) => i), rnd).slice(0, k); return Math.pow(S.mean(pick.map((i) => mult[i])), 1 / Y) - 1; });
      const beat = pf.filter((x) => x >= allC).length / pf.length;
      $('.out', host).innerHTML = kv([['תשואה שנתית של כל ה-50', pct(allC), 'hi'], ['חציון תיקים של ' + k + ' מניות', pct(S.pctile(pf, 0.5))], ['תיקים שהשיגו לפחות את המדד', pct(beat, 0), beat < 0.5 ? 'down' : ''], ['מניות שהפסידו לאג"ח (3%)', losers + ' מתוך 50'], ['חלק העושר מ-2 המניות הטובות', pct(top, 0)]]);
      U.histChart($('.chart-host', host), pf.map((x) => x * 100), { fmt: (v) => num(v, 0) + '%', refs: [{ v: allC * 100, label: 'כל ה-50', cls: 'acc' }] });
    });
  };

  /* L8 */
  LABS.feecalc = (host) => {
    host.innerHTML = `<h4 class="lab-h">טבלת ה-SEC: 100,000$ ב-4% ל-20 שנה</h4><div class="c1"></div><h4 class="lab-h">אחוז העלות של קנייה אחת לפי גודל</h4><div class="ctls">${sl('fc-a', 'גודל קנייה', 50, 5000, 50, 500, ' $')}</div><div class="out"></div><div class="c2"></div>`;
    U.barChart($('.c1', host), [0.25, 0.5, 1].map((f) => ({ label: 'דמי ניהול ' + f + '%', v: 100000 * Math.pow(1.04 - f / 100, 20) })), { fmt: (v) => money(v), lw: 130 });
    const B = [['IBKR', 0.0005, 0.35], ['One Zero', 0.001, 2], ['בנק (מחירון)', 0.006, 25], ['עמלה קבועה 6$', 0, 6]];
    const cost = (b, a) => Math.max(a * b[1], b[2]) / a;
    live(host, () => {
      const a = val(host, 'fc-a');
      $('.out', host).innerHTML = kv(B.map((b) => [b[0], pct(cost(b, a), 2), cost(b, a) > 0.01 ? 'down' : '']));
      const xs = []; for (let x = 50; x <= 5000; x += 50) xs.push(x);
      U.lineChart($('.c2', host), { series: B.map((b, i) => ({ name: b[0], x: xs, y: xs.map((x) => cost(b, x) * 100), color: ['var(--up)', 'var(--s1)', 'var(--down)', 'var(--muted)'][i] })), log: true, xfmt: (x) => x + '$', yfmt: (v) => num(v, v < 1 ? 2 : 1) + '%', marks: [] });
    });
  };

  /* L9: no-skill funds */
  LABS.funds = async (host) => {
    loading(host);
    let spy; try { spy = await U.data('SPY'); } catch (e) { return fail(host, e); }
    const ann = S.annualFromDaily(spy.dates, spy.adj).filter((a) => !a.partial).slice(-10);
    host.innerHTML = `<div class="ctls">${sl('fu-f', 'דמי ניהול', 0, 2, 0.1, 1, '%')}${sl('fu-t', 'סטייה מהמדד (tracking error)', 1, 10, 0.5, 5, '%')}${sl('fu-s', 'סיבוב', 1, 30, 1, 1)}<label class="chk"><input type="checkbox" id="fu-x"> מחק את 40% הגרועות ("קרנות שנסגרו")</label></div><div class="out"></div><div class="chart-host"></div>${src('תשואות השוק: SPY בפועל, ' + ann[0].y + '–' + ann[ann.length - 1].y + '. כל קרן = שוק + רעש אקראי − דמי ניהול. אין לאף אחת כישרון.')}`;
    live(host, () => {
      const fee = val(host, 'fu-f') / 100, te = val(host, 'fu-t') / 100, rnd = U.rng(val(host, 'fu-s') * 104729);
      const mkt = ann.map((a) => a.r), mktW = mkt.reduce((w, r) => w * (1 + r), 1);
      let funds = Array.from({ length: 1000 }, () => mkt.map((r) => r + te * U.randn(rnd) - fee));
      const wealth = (f) => f.reduce((w, r) => w * (1 + r), 1);
      const y1 = funds.map((f, i) => [i, f[0]]).sort((a, b) => b[1] - a[1]), topQ = new Set(y1.slice(0, 250).map((x) => x[0]));
      const y2 = funds.map((f, i) => [i, f[1] + f[2]]).sort((a, b) => b[1] - a[1]), stay = y2.slice(0, 250).filter((x) => topQ.has(x[0])).length / 250;
      let set = funds; if (val(host, 'fu-x')) set = funds.slice().sort((a, b) => wealth(b) - wealth(a)).slice(0, 600);
      const cag = set.map((f) => (Math.pow(wealth(f), 1 / f.length) - 1) * 100), mC = (Math.pow(mktW, 1 / mkt.length) - 1) * 100;
      const beat = cag.filter((c) => c > mC).length / cag.length;
      $('.out', host).innerHTML = kv([['קרנות שניצחו את המדד ב-10 שנים', pct(beat, 0), 'hi'], ['רבעון עליון שנשאר בו (שנתיים)', pct(stay, 0) + ' (מזל = 25%)'], ['תשואה ממוצעת של הקרנות בתמונה', num(S.mean(cag), 2) + '%'], ['תשואת המדד', num(mC, 2) + '%']]);
      U.histChart($('.chart-host', host), cag, { fmt: (v) => num(v, 1) + '%', refs: [{ v: mC, label: 'מדד', cls: 'acc' }] });
    });
  };

  /* L10: random traders on real SPY */
  LABS.trader = async (host) => {
    loading(host);
    let spy; try { spy = await U.data('SPY'); } catch (e) { return fail(host, e); }
    host.innerHTML = `<div class="ctls">${sl('t-n', 'עסקאות בשנה', 1, 250, 1, 50)}${sl('t-c', 'עלות לכל צד (מרווח + עמלה)', 0, 30, 1, 10, ' bp')}</div><div class="out"></div><h4 class="lab-h">תשואה שנתית נטו מול מספר העסקאות (חציון של 100 סוחרים אקראיים)</h4><div class="chart-host"></div>${src('נתונים: SPY יומי מותאם לדיבידנדים, 2000 עד היום. כל סוחר בשוק כמחצית מהזמן, ומחליף מצב בימים אקראיים.')}`;
    const r = S.rets(spy.adj), yrs = r.length / 252, bh = S.cagr(spy.adj);
    const sim = (tpy, cost, seed, nTr = 100) => { const rnd = U.rng(seed); const out = []; const p = Math.min(0.5, tpy * 2 / 252); for (let t = 0; t < nTr; t++) { let inM = rnd() < 0.5 ? 1 : 0, logw = 0; for (let i = 0; i < r.length; i++) { if (rnd() < p) { inM = 1 - inM; logw += Math.log(1 - cost / 10000); } if (inM) logw += Math.log(1 + r[i]); } out.push(Math.exp(logw / yrs) - 1); } return out; };
    const grid = [1, 2, 5, 10, 25, 50, 100, 250];
    live(host, () => {
      const n = val(host, 't-n'), c = val(host, 't-c');
      const res = sim(n, c, 99);
      const beat = res.filter((x) => x > bh).length;
      $('.out', host).innerHTML = kv([['קנה-והחזק SPY', pct(bh, 1), 'hi'], ['חציון הסוחרים', pct(S.pctile(res, 0.5), 1), 'down'], ['הסוחר הטוב ביותר מתוך 100', pct(Math.max(...res), 1)], ['סוחרים שניצחו את קנה-והחזק', beat + ' מתוך 100']]);
      const med = grid.map((g) => S.pctile(sim(g, c, 7, 40), 0.5) * 100);
      U.lineChart($('.chart-host', host), { series: [{ name: 'סוחר אקראי (חציון)', x: grid, y: med, color: 'var(--down)' }, { name: 'קנה-והחזק', x: grid, y: grid.map(() => bh * 100), color: 'var(--up)', dash: '5 4', noDot: true }], xfmt: (x) => x + ' בשנה', yfmt: (v) => num(v, 1) + '%', zero: true });
    });
  };

  /* L11: panic seller on real SPY */
  LABS.panic = async (host) => {
    loading(host);
    let spy; try { spy = await U.data('SPY'); } catch (e) { return fail(host, e); }
    host.innerHTML = `<div class="ctls">${sl('p-x', 'מוכר אחרי ירידה מהשיא של', 5, 40, 1, 20, '%')}${sel('p-r', 'קונה בחזרה', [['high', 'רק בשיא חדש'], ['half', 'אחרי שהשוק החזיר חצי מהירידה'], ['m6', 'אחרי 6 חודשים']], 'high')}</div><div class="out"></div><div class="chart-host"></div>${src('נתונים: SPY מותאם לדיבידנדים מ-2000. מתחילים עם 10,000$.')}`;
    live(host, () => {
      const th = -val(host, 'p-x') / 100, rule = val(host, 'p-r'), p = spy.adj;
      let pk = p[0], inM = true, cash = 0, units = 10000 / p[0], exits = 0, outSince = 0, troughOut = Infinity, exitPk = 0;
      const eq = [10000];
      for (let i = 1; i < p.length; i++) {
        pk = Math.max(pk, p[i]);
        if (inM && p[i] / pk - 1 <= th) { cash = units * p[i]; units = 0; inM = false; exits++; outSince = i; troughOut = p[i]; exitPk = pk; }
        else if (!inM) {
          troughOut = Math.min(troughOut, p[i]);
          const back = rule === 'high' ? p[i] >= exitPk : rule === 'half' ? p[i] >= troughOut + (exitPk - troughOut) / 2 && troughOut < p[i] : i - outSince >= 126;
          if (back) { units = cash / p[i]; cash = 0; inM = true; pk = p[i]; }
        }
        eq.push(inM ? units * p[i] : cash);
      }
      const hold = p.map((v) => v / p[0] * 10000);
      $('.out', host).innerHTML = kv([['מי שהחזיק', money(hold[hold.length - 1]), 'up'], ['המוכר בפאניקה', money(eq[eq.length - 1]), 'down'], ['פעמים שיצא מהשוק', exits], ['ההפרש', money(hold[hold.length - 1] - eq[eq.length - 1])]]);
      U.lineChart($('.chart-host', host), { series: [{ name: 'מחזיק', x: spy.dates, y: hold, color: 'var(--up)' }, { name: 'מוכר בפאניקה', x: spy.dates, y: eq, color: 'var(--down)' }], log: true, yfmt: (v) => money(v, 'USD', 0) });
    });
  };

  /* L12 */
  const FLAGS = [['מובטח', 3], ['מובטחת', 3], ['ללא סיכון', 3], ['בלי סיכון', 3], ['ביום', 3], ['בשבוע', 2], ['סודי', 2], ['סודית', 2], ['בוט', 2], ['AI', 1], ['בינה מלאכותית', 1], ['טלגרם', 2], ['Telegram', 2], ['וואטסאפ', 2], ['WhatsApp', 2], ['מקומות אחרונים', 2], ['עכשיו', 1], ['מהר', 1], ['רק היום', 2], ['הזדמנות', 1], ['מיליונר', 2], ['פסיבית', 1], ['לעולם לא מפסיד', 4], ['100%', 2], ['80%', 2], ['ביטקוין', 1], ['שלח', 1], ['קבוצת VIP', 2], ['VIP', 2], ['מומחה', 1], ['איתותים', 2], ['סיגנלים', 2], ['ממונף', 2], ['מינוף', 2], ['פי 10', 3]];
  const ADS = ['🚀 בוט AI סודי שמרוויח 20% ביום! מקומות אחרונים בקבוצת ה-VIP שלנו בטלגרם. הצטרפו עכשיו!', 'הזדמנות של פעם בחיים: תשואה מובטחת של 8% בחודש ללא סיכון. שלחו הודעה בוואטסאפ למומחה שלנו.', 'קרן מחקה על מדד S&P 500, דמי ניהול 0.07%, מנוהלת ע"י גוף בפיקוח רשות ניירות ערך. ביצועי עבר אינם מבטיחים תשואה עתידית.', 'איתותים יומיים מבוססי בינה מלאכותית, 94% הצלחה! תצטרף לקבוצה ותהיה מיליונר תוך שנה. רק היום: חינם!', 'דוח רבעוני: הכנסות החברה עלו 4%, הרווח הנקי ירד 2%. ההנהלה צופה צמיחה מתונה.'];
  LABS.redflag = (host) => {
    host.innerHTML = `<div class="chips">${ADS.map((_, i) => `<button class="chip" data-i="${i}">פרסום ${i + 1}</button>`).join('')}</div><label class="ctl ctl-area"><span>הדבק טקסט של פרסום או הודעה</span><textarea id="rf-t" rows="4">${esc(ADS[0])}</textarea></label><div class="out"></div>`;
    const run = () => {
      const t = $('#rf-t', host).value; let score = 0; const hits = [];
      FLAGS.forEach(([k, w]) => { if (t.toLowerCase().includes(k.toLowerCase())) { score += w; hits.push([k, w]); } });
      const pm = t.match(/(\d+(?:\.\d+)?)\s*%\s*(?:ב|ל)(יום|שבוע|חודש)/); if (pm) { const r = Number(pm[1]) / 100, per = { 'יום': 252, 'שבוע': 52, 'חודש': 12 }[pm[2]]; hits.push([`${pm[0]} = פי ${num(Math.pow(1 + r, per), 0)} בשנה`, 3]); score += 3; }
      const lvl = score >= 7 ? ['down', 'הונאה כמעט ודאית. אל תשלח כסף ואל תמסור פרטים.'] : score >= 3 ? ['warn', 'חשוד. בדוק רישיון ברשות ניירות ערך לפני כל צעד.'] : ['up', 'לא נמצאו סימני אזהרה בולטים. עדיין בדוק רישיון.'];
      $('.out', host).innerHTML = `<div class="meter"><i style="width:${Math.min(100, score * 8)}%" class="${lvl[0]}"></i></div><div class="verdict ${lvl[0]}">ציון חשד: ${score} · ${lvl[1]}</div>${hits.length ? `<div class="chips">${hits.map((x) => `<span class="tag down">${esc(x[0])} +${x[1]}</span>`).join('')}</div>` : ''}`;
    };
    $('#rf-t', host).addEventListener('input', run);
    $$('.chip[data-i]', host).forEach((b) => b.addEventListener('click', () => { $('#rf-t', host).value = ADS[b.dataset.i]; run(); U.tone('tap'); }));
    run();
  };

  /* L13: order types on a real day's range */
  LABS.orders = async (host) => {
    loading(host);
    let spy; try { spy = await U.data('SPY'); } catch (e) { return fail(host, e); }
    const day = (d) => spy.d[spy.dates.indexOf(d)];
    const SC = { calm: ['2019-07-10', 'יום רגיל (10/07/2019)'], storm: ['2020-03-12', 'יום סוער (12/03/2020)'], gap: ['2020-03-16', 'פתיחה בפער אחרי סופ"ש (16/03/2020)'] };
    host.innerHTML = `<div class="ctls">${sel('o-s', 'תרחיש (מחירי SPY אמיתיים)', Object.entries(SC).map(([k, v]) => [k, v[1]]), 'storm')}${sel('o-t', 'סוג פקודה', [['market', 'שוק (Market)'], ['limit', 'לימיט קנייה (Limit)'], ['stop', 'סטופ מכירה (Stop)']], 'limit')}${sl('o-p', 'מחיר הפקודה (% ממחיר הסגירה הקודם)', -12, 5, 0.5, -3, '%')}</div><button class="btn" id="o-go">הרץ את היום</button><div class="chart-host"></div><div class="out"></div>`;
    const go = () => {
      const k = val(host, 'o-s'), [date] = SC[k], i = spy.dates.indexOf(date), prev = spy.d[i - 1][4], [, o, hi, lo, c] = spy.d[i];
      const t = val(host, 'o-t'), lvl = prev * (1 + val(host, 'o-p') / 100);
      const path = SIM.dayPath(o, hi, lo, c, 60, U.rng(i));
      let fill = null, fi = null; const spread = 0.0002;
      for (let j = 0; j < path.length && !fill; j++) {
        const px = path[j];
        if (t === 'market') { fill = px * (1 + spread + 0.001 * (hi - lo) / prev * 10); fi = j; }
        if (t === 'limit' && px <= lvl) { fill = Math.min(lvl, px); fi = j; }
        if (t === 'stop' && px <= lvl) { fill = px * (1 - spread - 0.0015 * (hi - lo) / prev * 10); fi = j; }
      }
      const xs = [-1, ...path.map((_, j) => j)];
      U.lineChart($('.chart-host', host), { series: [{ name: 'SPY', x: xs, y: [prev, ...path] }, { name: t === 'market' ? 'מחיר שראית' : 'רמת הפקודה', x: xs, y: xs.map(() => t === 'market' ? prev : lvl), color: 'var(--accent)', dash: '5 4', noDot: true }], xfmt: (x) => x < 0 ? 'סגירה קודמת' : 'דקה ' + Math.round(x * 6.5), yfmt: (v) => num(v, 2), marks: fill ? [{ i: fi + 1, y: fill, label: 'ביצוע ' + num(fill, 2) }] : [] });
      const msg = { market: `פקודת שוק התבצעה מיד ב-${num(fill, 2)}. ציפית ל-${num(prev, 2)} (הסגירה הקודמת). הפער: ${pct(fill / prev - 1, 2, true)}. המחיר לא מובטח.`, limit: fill ? `הלימיט התבצע ב-${num(fill, 2)}, לא יותר מהמחיר שקבעת.` : `הלימיט לא התבצע: המחיר לא ירד ל-${num(lvl, 2)}. זה המחיר של הגנת המחיר.`, stop: fill ? `הסטופ הופעל ב-${num(lvl, 2)} והפך לפקודת שוק. בוצע ב-${num(fill, 2)}, ${pct(fill / lvl - 1, 2, true)} מרמת הסטופ.` : 'הסטופ לא הופעל.' }[t];
      $('.out', host).innerHTML = `<div class="verdict ${fill && t !== 'limit' && Math.abs(fill / (t === 'market' ? prev : lvl) - 1) > 0.01 ? 'down' : 'up'}">${msg}</div>` + kv([['פתיחה', num(o, 2)], ['גבוה', num(hi, 2)], ['נמוך', num(lo, 2)], ['סגירה', num(c, 2)]]);
      U.tone(fill ? 'fill' : 'tap');
    };
    bindOut(host); $('#o-go', host).addEventListener('click', go); go();
  };

  /* L14 */
  LABS.broker = (host) => {
    host.innerHTML = `<div class="ctls">${sl('b-m', 'הפקדה חודשית', 100, 5000, 50, 500, ' $')}${sl('b-n', 'קניות בשנה', 1, 24, 1, 12)}</div><div class="out"></div>${src('עמלות לפי הטבלה בשיעור (גלובס, Blink, GemelTop, IBKR, TheMarker). העמלות משתנות: בדוק לפני שפותחים חשבון.')}`;
    const B = [['One Zero', (a) => Math.max(a * 0.001, 2), 'מנוכה במקור'], ['Blink', (a, n) => (n <= 120 ? 0 : Math.max(1.5, a / 100 * 0.01)), 'מנוכה במקור'], ['בית השקעות (ת"א)', (a) => a * 0.0008, 'מנוכה במקור'], ['IBKR', (a) => Math.max(0.35, Math.min(a * 0.01, Math.ceil(a / 100) * 0.0035)), 'מדווחים לבד'], ['בנק (מחירון)', (a) => Math.max(25, a * 0.006), 'מנוכה במקור']];
    live(host, () => {
      const m = val(host, 'b-m'), n = val(host, 'b-n'), per = m * 12 / n;
      const items = B.map(([name, f, tax]) => ({ label: name, v: f(per, n) * n / (m * 12) * 100, tax })).sort((a, b) => a.v - b.v);
      $('.out', host).innerHTML = `<div class="c"></div>` + tblRows(['ברוקר', 'עלות שנתית', 'בדולרים', 'מס'], items.map((i) => [i.label, `<b>${num(i.v, 2)}%</b>`, money(i.v / 100 * m * 12, 'USD', 0), i.tax]));
      U.barChart($('.c', host), items.map((i) => ({ label: i.label, v: i.v, color: i.v > 1 ? 'var(--down)' : 'var(--s1)' })), { fmt: (v) => num(v, 2) + '%', lw: 130 });
    });
  };

  /* L15: Israeli capital gains with real USD/ILS */
  LABS.tax = async (host) => {
    loading(host);
    let fx; try { fx = await U.data('ILS=X'); } catch (e) { return fail(host, e); }
    const rateOn = (d) => { let i = fx.dates.findIndex((x) => x >= d); if (i < 0) i = fx.dates.length - 1; return [fx.close[i], fx.dates[i]]; };
    host.innerHTML = `<div class="ctls">${nb('tx-b', 'קנייה', 1000, '$')}${nb('tx-s', 'מכירה', 1050, '$')}<label class="ctl ctl-num"><span>תאריך קנייה</span><input type="date" id="tx-db" value="2024-04-15" min="2004-01-01"></label><label class="ctl ctl-num"><span>תאריך מכירה</span><input type="date" id="tx-ds" value="2025-12-01" min="2004-01-01"></label>${sl('tx-y', 'תשואת דיבידנד שנתית', 0, 5, 0.1, 1.5, '%')}</div><div class="out"></div>${src('שער דולר/שקל אמיתי (Yahoo Finance). חישוב פשוט, בלי התאמת אינפלציה. לפני החלטות, בדוק מול רואה חשבון.')}`;
    live(host, () => {
      const b = val(host, 'tx-b'), s = val(host, 'tx-s'); const [fb, db] = rateOn($('#tx-db', host).value), [fs, ds] = rateOn($('#tx-ds', host).value);
      const gUsd = s - b, gIls = s * fs - b * fb, tax = Math.max(0, gIls) * 0.25, y = val(host, 'tx-y') / 100;
      $('.out', host).innerHTML = kv([['שער בקנייה (' + db.split('-').reverse().join('/') + ')', num(fb, 3)], ['שער במכירה (' + ds.split('-').reverse().join('/') + ')', num(fs, 3)], ['רווח בדולרים', money(gUsd), gUsd >= 0 ? 'up' : 'down'], ['רווח בשקלים', num(gIls) + ' ₪', gIls >= 0 ? 'up' : 'down'], ['מס רווח הון (25%)', num(tax) + ' ₪', 'hi']]) +
        (gUsd > 0 && gIls < 0 ? '<div class="verdict up">הרווחת בדולרים אבל הפסדת בשקלים, ולכן אין מס. השקל התחזק.</div>' : '') +
        `<h4 class="lab-h">דיבידנד על 100,000$ בשנה</h4>` + kv([['ETF אמריקאי: 25% במקור (W-8BEN)', money(100000 * y * 0.75), ''], ['ETF אירי UCITS: כ-15% בתוך הקרן', money(100000 * y * 0.85), 'up'], ['ההפרש בשנה', money(100000 * y * 0.10), 'hi']]);
    });
  };

  /* L16: rebalancing on real SPY/TLT */
  LABS.rebalance = async (host) => {
    loading(host);
    let A; try { A = await Promise.all(['SPY', 'TLT'].map(U.data)); } catch (e) { return fail(host, e); }
    const al = U.align(A), ds = al.dates, [ps, pb] = al.cols;
    host.innerHTML = `<div class="ctls">${sl('r-w', 'משקל מניות', 0, 100, 5, 80, '%')}${sl('r-b', 'פס סטייה לאיזון', 1, 15, 1, 5, '%')}</div><div class="out"></div><div class="chart-host"></div>${src('נתונים: SPY ו-TLT (אג"ח ממשלת ארה"ב ארוכות) מותאמים לדיבידנדים, מ-' + ds[0].split('-').reverse().join('/') + '.')}`;
    const run = (w, rule, band) => { let s = w, b = 1 - w, trades = 0; const eq = [1]; let yr = ds[0].slice(0, 4);
      for (let i = 1; i < ds.length; i++) { s *= ps[i] / ps[i - 1]; b *= pb[i] / pb[i - 1]; const tot = s + b; const y = ds[i].slice(0, 4);
        if ((rule === 'annual' && y !== yr) || (rule === 'band' && Math.abs(s / tot - w) > band)) { s = tot * w; b = tot * (1 - w); trades++; }
        yr = y; eq.push(s + b); } return { eq, trades }; };
    live(host, () => {
      const w = val(host, 'r-w') / 100, band = val(host, 'r-b') / 100;
      const R = [['never', 'לעולם לא לאזן'], ['annual', 'פעם בשנה'], ['band', 'סטייה של ' + num(band * 100) + '%']].map(([k, n]) => ({ n, ...run(w, k, band) }));
      $('.out', host).innerHTML = tblRows(['כלל', 'CAGR', 'ירידה מקסימלית', 'פעולות איזון'], R.map((r) => [r.n, `<b>${pct(S.cagr(r.eq))}</b>`, pct(S.maxdd(r.eq)), r.trades]));
      U.lineChart($('.chart-host', host), { series: R.map((r, i) => ({ name: r.n, x: ds, y: r.eq.map((v) => v * 10000), color: ['var(--muted)', 'var(--s1)', 'var(--accent)'][i] })), log: true, yfmt: (v) => money(v, 'USD', 0) });
    });
  };

  /* L17: IPS builder */
  LABS.ips = (host) => {
    const saved = APP.state.ips || {};
    const f = (id, label, v, ph = '') => `<label class="ctl ctl-area"><span>${label}</span><textarea id="${id}" rows="2" placeholder="${esc(ph)}">${esc(saved[id] ?? v)}</textarea></label>`;
    host.innerHTML = `<p class="note">הטופס ממולא בדוגמה. החלף בפרטים שלך. הוא נשמר אוטומטית במחברת שלך.</p><div class="ctls">${f('goal', 'המטרה', 'חיסכון לטווח ארוך לעצמאות כלכלית', '')}${f('horizon', 'אופק זמן (שנים)', '20')}${f('alloc', 'חלוקת יעד', '90% מניות עולמיות / 10% אג"ח, איזון כשסוטה ב-5%')}${f('funds', 'נכסים מותרים', 'ETF אירי על S&P 500 או מדד עולמי (למשל 1159250), קרן אג"ח ממשלתית')}${f('banned', 'נכסים אסורים', 'מניות בודדות מעל 5%, CFD, אופציות, מינוף, "איתותים"')}${f('monthly', 'הפקדה חודשית אוטומטית', '1,000 ₪ ב-10 לחודש, פקודת לימיט')}${f('broker', 'ברוקר', 'One Zero (מנכה מס במקור)')}${f('crash', 'מה אעשה בשנה של −30%', 'ממשיך להפקיד, מאזן מחדש לפי הכלל, לא מוכר. לא בודק מחירים יותר מפעם בחודש.')}${f('bench', 'מדד השוואה', 'קרן המדד עצמה')}</div><div class="out"></div><button class="btn" id="ips-copy">העתק IPS.md</button>`;
    const md = (v) => `# IPS: תוכנית ההשקעות שלי\n\n- **מטרה:** ${v.goal}\n- **אופק:** ${v.horizon} שנים\n- **חלוקת יעד ואיזון:** ${v.alloc}\n- **מותר:** ${v.funds}\n- **אסור:** ${v.banned}\n- **הפקדה:** ${v.monthly}\n- **ברוקר:** ${v.broker}\n- **בשנה של −30%:** ${v.crash}\n- **מדד השוואה:** ${v.bench}\n\nנחתם: ${new Date().toLocaleDateString('he-IL')}`;
    const run = () => {
      const v = {}; $$('textarea', host).forEach((t) => v[t.id] = t.value.trim()); APP.state.ips = v; APP.persist();
      const checks = [[Number(String(v.horizon).replace(/\D/g, '')) >= 5, 'אופק של 5 שנים לפחות'], [/לא\s*מוכר|לא אמכור|ממשיך|לאזן|מאזן/.test(v.crash), 'תוכנית ל-−30% שלא כוללת מכירה בפאניקה'], [/%/.test(v.alloc), 'חלוקה באחוזים'], [/איזון|לאזן|סוטה/.test(v.alloc), 'כלל איזון'], [/CFD|מינוף|אופציות/.test(v.banned), 'מוצרים ממונפים אסורים'], [/אוטומטי|לחודש|חודשי/.test(v.monthly), 'הפקדה קבועה']];
      $('.out', host).innerHTML = `<ul class="checklist">${checks.map((c) => `<li class="${c[0] ? 'ok' : 'no'}">${c[1]}</li>`).join('')}</ul><pre class="code md">${esc(md(v))}</pre>`;
      host._md = md(v);
    };
    $$('textarea', host).forEach((t) => t.addEventListener('input', run)); run();
    $('#ips-copy', host).addEventListener('click', () => U.copy(host._md));
  };
})();
