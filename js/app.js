/* App shell: state, routing, lesson engine, home/course/progress views, glossary, tutor. */
window.APP = (function () {
  const { $, $$, h, esc, num, pct } = U;
  const L = COURSE.lessons, byId = (id) => L.find((x) => x.id === id);
  const today = () => new Date().toISOString().slice(0, 10);
  const DEF = { v: 1, xp: 0, streak: { n: 0, last: null }, lessons: {}, wrong: {}, settings: { theme: 'system', sound: true, haptics: true, unlockAll: false, finnhub: '' }, plan: { days: [0, 2, 4], time: '20:00', place: '', miss: 'משלים באותו שבוע ביום הפנוי הבא' }, stopRules: { dd: 15, lag: 8, on: true }, simHistory: [], xpLog: {} };
  const APP = { state: Object.assign({}, DEF, U.load('state', {})) };
  APP.state.settings = Object.assign({}, DEF.settings, APP.state.settings);
  APP.persist = () => U.save('state', APP.state);
  const ls = (id) => (APP.state.lessons[id] = APP.state.lessons[id] || { step: 0, done: false, best: 0, xp: {} });
  APP.unlocked = (id) => id === 1 || APP.state.settings.unlockAll || (APP.state.lessons[id - 1] && APP.state.lessons[id - 1].done);
  APP.nextLesson = () => (L.find((l) => !(APP.state.lessons[l.id] || {}).done && APP.unlocked(l.id)) || L[L.length - 1]);
  APP.doneCount = () => L.filter((l) => (APP.state.lessons[l.id] || {}).done).length;

  /* XP once per key, streak by day */
  APP.addXP = (n, why, key, el) => {
    if (key) { if (APP.state.xpLog[key]) return false; APP.state.xpLog[key] = 1; }
    APP.state.xp += n;
    const s = APP.state.streak, t = today();
    if (s.last !== t) { const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10); s.n = s.last === y ? s.n + 1 : 1; s.last = t; if (s.n > 1) U.toast(`🔥 רצף של ${s.n} ימים`, 'good'); }
    APP.persist(); renderTop();
    if (el) U.floatXP(el, n);
    return true;
  };

  /* ---------- theme ---------- */
  const applyTheme = () => { const t = APP.state.settings.theme; if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); if (window.SIM && SIM.refreshTheme) setTimeout(SIM.refreshTheme, 50); };

  /* ---------- top bar & tabs ---------- */
  function renderTop() {
    const d = APP.doneCount();
    $('#top-stats').innerHTML = `<span class="pill" title="נקודות ניסיון"><b>${num(APP.state.xp)}</b> XP</span><span class="pill" title="ימים ברצף">🔥 <b>${APP.state.streak.n || 0}</b></span><span class="pill" title="שיעורים שהושלמו"><b>${d}</b>/35</span>`;
  }
  const TABS = [['home', 'בית', 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z'], ['course', 'קורס', 'M4 5h7v14H4zM13 5h7v14h-7z'], ['sim', 'סימולטור', 'M3 17l5-6 4 3 6-8 3 3M3 21h18'], ['me', 'התקדמות', 'M12 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10zM4 21c1-4 4-6 8-6s7 2 8 6']];
  function renderTabs(active) {
    $('#tabs').innerHTML = TABS.map(([k, n, d]) => `<button data-v="${k}" class="${k === active ? 'on' : ''}" aria-label="${n}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg><span>${n}</span></button>`).join('');
    $$('#tabs button').forEach((b) => b.addEventListener('click', () => { U.tone('tap'); APP.go(b.dataset.v); }));
  }

  /* ---------- router ---------- */
  let cur = null;
  APP.go = (view, arg, opts = {}) => {
    if (view === 'lesson' && !APP.unlocked(arg)) { U.toast(`שיעור ${arg} נעול. סיים קודם את שיעור ${arg - 1} עם 80% בבוחן.`, 'warn'); U.bad(); return; }
    if (cur === 'sim' && view !== 'sim' && window.SIM) SIM.unmount();
    const main = $('#main');
    const dir = opts.back ? 'back' : 'fwd';
    main.classList.remove('enter-fwd', 'enter-back'); void main.offsetWidth; main.classList.add('enter-' + dir);
    cur = view;
    document.body.dataset.view = view;
    renderTabs(view === 'lesson' || view === 'review' ? 'course' : view);
    const hash = view === 'lesson' ? 'lesson-' + arg : view;
    try { if (location.hash.slice(1) !== hash) history.replaceState(null, '', '#' + hash); } catch (e) {}
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    ({ home: viewHome, course: viewCourse, sim: viewSim, me: viewMe, lesson: viewLesson, review: viewReview })[view](main, arg);
  };

  /* ---------- HOME ---------- */
  function viewHome(main) {
    const nx = APP.nextLesson(), s = ls(nx.id), d = APP.doneCount(), ph = COURSE.phases[nx.ph - 1];
    const allDone = d === 35;
    const plan = APP.state.plan, DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
    const nextSlot = (() => { const now = new Date(); for (let k = 0; k < 8; k++) { const dt = new Date(now.getTime() + k * 864e5); if (plan.days.includes(dt.getDay())) { const [hh, mm] = (plan.time || '20:00').split(':').map(Number); dt.setHours(hh, mm, 0, 0); if (dt > now) return k === 0 ? 'היום ב-' + plan.time : k === 1 ? 'מחר ב-' + plan.time : 'יום ' + DAYS[dt.getDay()] + "' ב-" + plan.time; } } return null; })();
    const R = 46, C = 2 * Math.PI * R;
    main.innerHTML = `
      <section class="hero">
        <div class="hero-txt"><p class="eyebrow">קורס שוק ההון · 35 שיעורים</p><h1>להרוויח כמו השוק.<br>לבדוק כל הבטחה.</h1><p class="lede">קרן מחקה זולה, הפקדה קבועה וסבלנות. ואז כלים לבדוק בעצמך כל טענה של "AI שחוזה מניות", על נתונים אמיתיים.</p></div>
        <div class="ring" aria-label="${d} מתוך 35 שיעורים"><svg viewBox="0 0 110 110"><circle cx="55" cy="55" r="${R}" class="ring-bg"/><circle cx="55" cy="55" r="${R}" class="ring-fg" style="stroke-dasharray:${C};stroke-dashoffset:${C * (1 - d / 35)}"/></svg><div><b>${d}</b><span>מתוך 35</span></div></div>
      </section>
      <section class="card next">
        <p class="eyebrow">${allDone ? 'סיימת את הקורס' : `שלב ${ph.id}: ${esc(ph.t)} · שיעור ${nx.id}`}</p>
        <h2>${esc(nx.t)}</h2>
        <p class="muted">${esc(nx.goals)}</p>
        <div class="steps-mini">${STEPS.map((x, i) => `<i class="${i < s.step || s.done ? 'on' : ''}"></i>`).join('')}</div>
        <button class="btn big" id="h-go">${s.done ? 'חזור לשיעור' : s.step ? 'המשך מאיפה שעצרת' : 'התחל שיעור ' + nx.id}</button>
      </section>
      <div class="quick">
        <button class="qa" id="h-rev"><b>חזרה מהירה</b><span>5 שאלות משיעורים שלמדת</span></button>
        <button class="qa" id="h-sim"><b>סימולטור שוק</b><span>נתונים אמיתיים, כסף וירטואלי</span></button>
        <button class="qa" id="h-gl"><b>מילון מונחים</b><span>${Object.keys(COURSE.glossary).length} מושגים מוסברים</span></button>
      </div>
      <section class="card">
        <h3>ארבעה מספרים שמסבירים את הקורס</h3>
        <div class="facts">
          <div><b>6.6%</b><span>תשואה שנתית מעל האינפלציה של מניות ארה"ב, 1900–2025 (UBS)</span></div>
          <div><b>85.6%</b><span>ממנהלי הקרנות בארה"ב פיגרו אחרי ה-S&P 500 לאורך 10 שנים (SPIVA)</span></div>
          <div><b>&lt;1%</b><span>מהסוחרים היומיים בטייוואן הרוויחו באופן עקבי (Barber et al.)</span></div>
          <div><b>0.4%</b><span>מהתנודות החודשיות שהמודלים הטובים במחקר מסבירים (Gu, Kelly & Xiu)</span></div>
        </div>
      </section>
      <section class="card plan">
        <h3>התוכנית השבועית שלך</h3>
        <p class="muted">קביעת מתי, איפה ואיך תלמד העלתה סיום קורסים מ-13.8% ל-17.7% (Yeomans & Reich). מומלץ: 4–5 משבצות של 60–90 דקות.</p>
        <div class="days">${DAYS.map((dd, i) => `<button data-d="${i}" class="${plan.days.includes(i) ? 'on' : ''}" aria-pressed="${plan.days.includes(i)}">${dd}'</button>`).join('')}</div>
        <div class="ctls row"><label class="ctl ctl-num"><span>שעה</span><input type="time" id="pl-t" value="${esc(plan.time)}"></label><label class="ctl ctl-num"><span>מקום</span><input type="text" id="pl-p" value="${esc(plan.place)}" placeholder="שולחן בחדר"></label></div>
        <label class="ctl ctl-num"><span>אם פספסתי</span><input type="text" id="pl-m" value="${esc(plan.miss)}"></label>
        <p class="plan-next">${nextSlot ? 'המפגש הבא: <b>' + nextSlot + '</b>' : 'בחר ימים'} · ${plan.days.length} מפגשים בשבוע</p>
      </section>
      <section class="card">
        <h3>מפת הקורס</h3>
        <ol class="phases">${COURSE.phases.map((p) => { const ls2 = L.filter((l) => l.ph === p.id), dn = ls2.filter((l) => (APP.state.lessons[l.id] || {}).done).length; return `<li class="${dn === ls2.length ? 'done' : p.id === nx.ph ? 'cur' : ''}"><b>${p.id}</b><div><span>${esc(p.t)}</span><em>שיעורים ${p.r} · ${p.h} שעות · ${esc(p.goal)}</em><i style="--w:${dn / ls2.length * 100}%"></i></div></li>`; }).join('')}</ol>
      </section>`;
    $('#h-go').addEventListener('click', () => APP.go('lesson', nx.id));
    $('#h-rev').addEventListener('click', () => APP.go('review'));
    $('#h-sim').addEventListener('click', () => APP.go('sim'));
    $('#h-gl').addEventListener('click', () => glossary());
    $$('.days button').forEach((b) => b.addEventListener('click', () => { const i = Number(b.dataset.d), a = plan.days; const k = a.indexOf(i); k >= 0 ? a.splice(k, 1) : a.push(i); APP.persist(); U.tone('tap'); viewHome(main); }));
    [['pl-t', 'time'], ['pl-p', 'place'], ['pl-m', 'miss']].forEach(([id, k]) => $('#' + id).addEventListener('change', (e) => { plan[k] = e.target.value; APP.persist(); if (k === 'time') viewHome(main); }));
  }

  /* ---------- COURSE MAP ---------- */
  function viewCourse(main) {
    main.innerHTML = `<h1 class="page-h">35 שיעורים, 7 שלבים</h1><p class="muted page-sub">כ-170–190 שעות: 6–7 חודשים ב-6–8 שעות בשבוע. כל שיעור נפתח אחרי 80% בבוחן של הקודם.</p>` + COURSE.phases.map((p) => `
      <section class="phase-sec"><header><b>שלב ${p.id}</b><h2>${esc(p.t)}</h2><span>${p.h} שעות · אבן דרך: ${esc(p.goal)}</span></header>
      <ul class="lessons">${L.filter((l) => l.ph === p.id).map((l) => { const s = APP.state.lessons[l.id] || {}, un = APP.unlocked(l.id); return `<li><button data-l="${l.id}" class="${s.done ? 'done' : un ? 'open' : 'locked'}" ${un ? '' : 'aria-disabled="true"'}><i class="st">${s.done ? '✓' : un ? l.id : '🔒'}</i><span><b>${esc(l.t)}</b><em>${l.h} שעות${s.done ? ` · בוחן ${s.best}%` : s.step ? ' · בתהליך' : ''}</em></span></button></li>`; }).join('')}</ul></section>`).join('');
    $$('[data-l]', main).forEach((b) => b.addEventListener('click', () => { U.tone('tap'); APP.go('lesson', Number(b.dataset.l)); }));
  }

  /* ---------- SIM ---------- */
  function viewSim(main) {
    main.innerHTML = '<div id="sim-root"></div>';
    SIM.mount($('#sim-root'));
    if (!APP.state.simIntro) {
      APP.state.simIntro = 1; APP.persist();
      const m = h(`<div class="modal-bg"><div class="modal"><h3>סימולטור השוק</h3><ul class="intro-list"><li><b>נתונים אמיתיים.</b> מחירים יומיים אמיתיים מ-Yahoo Finance (2000 עד אתמול), שמתנגנים בתוך היום כמו מסחר חי. במצב "זמן אמת": מחירים חיים מהבורסה.</li><li><b>כסף וירטואלי.</b> 100,000 להתחלה. עמלות, מרווח והחלקה מחושבים כמו בעולם האמיתי.</li><li><b>מאמן.</b> כל עסקה מקבלת משוב: פאניקה, FOMO, מסחר יתר, עלויות.</li><li><b>הרף:</b> קנה-והחזק מאותו יום. אם לא ניצחת אותו, זו התשובה.</li></ul><button class="btn big">הבנתי, בוא נתחיל</button></div></div>`);
      document.body.appendChild(m); $('.btn', m).addEventListener('click', () => m.remove());
    }
  }

  /* ---------- LESSON ENGINE ---------- */
  const STEPS = [['review', 'חזרה'], ['guess', 'נחש'], ['learn', 'הסבר'], ['example', 'דוגמה ומעבדה'], ['practice', 'תרגול'], ['task', 'תרגיל'], ['quiz', 'בוחן'], ['explain', 'הסבר לי'], ['done', 'סיכום']];
  APP.STEPS = STEPS;
  let LS = null; // current lesson session
  function viewLesson(main, id) {
    const l = byId(id), s = ls(id);
    LS = { l, s, chunk: 0 };
    main.innerHTML = `<div class="lesson">
      <header class="l-head"><button class="icon-btn" id="l-back" aria-label="חזרה למפת הקורס">→</button><div><p class="eyebrow">שיעור ${l.id} · ${l.h} שעות</p><h1>${esc(l.t)}</h1></div></header>
      <nav class="stepper" aria-label="שלבי השיעור">${STEPS.map((x, i) => `<button data-s="${i}" aria-label="${x[1]}"><i></i><span>${x[1]}</span></button>`).join('')}</nav>
      <div class="l-body" id="l-body"></div>
      <footer class="l-foot"><button class="btn ghost" id="l-prev">הקודם</button><button class="btn" id="l-next">הבא</button></footer>
      <button class="fab" id="l-ask" aria-label="שאל את המורה"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H8l-4 4z"/></svg><span>שאל את המורה</span></button>
    </div>`;
    $('#l-back').addEventListener('click', () => APP.go('course', null, { back: true }));
    $('#l-prev').addEventListener('click', () => { if (LS.s.step === 2 && LS.chunk > 0) { LS.chunk--; renderStep('back'); } else if (LS.s.step > 0) gotoStep(LS.s.step - 1, 'back'); });
    $('#l-next').addEventListener('click', next);
    $('#l-ask').addEventListener('click', () => APP.tutor.open(l));
    $$('.stepper button').forEach((b) => b.addEventListener('click', () => { const i = Number(b.dataset.s); if (i <= maxStep()) gotoStep(i, i < LS.s.step ? 'back' : 'fwd'); else { U.bad(b); U.toast('השלב הזה ייפתח אחרי שתסיים את הקודמים', 'warn'); } }));
    if (s.done && s.step >= STEPS.length - 1) s.step = 0;
    renderStep();
  }
  const maxStep = () => Math.max(LS.s.reached || 0, LS.s.step, LS.s.done ? STEPS.length - 1 : 0);
  function gotoStep(i, dir) { LS.s.step = i; LS.s.reached = Math.max(LS.s.reached || 0, i); if (i === 2 && dir === 'back') LS.chunk = LS.l.chunks.length - 1; else if (i === 2) LS.chunk = 0; APP.persist(); renderStep(dir); }
  function next() {
    const k = STEPS[LS.s.step][0];
    if (k === 'learn' && LS.chunk < LS.l.chunks.length - 1) { LS.chunk++; APP.addXP(2, '', `c${LS.l.id}-${LS.chunk}`); return renderStep('fwd'); }
    if (k === 'guess' && LS.s.guess == null) { U.bad($('#l-body')); return U.toast('בחר תשובה קודם. אין עונש על טעות.', 'warn'); }
    if (k === 'practice' && !LS.s.practiceOk && !LS.s.practiceShown) { U.bad($('#l-body')); return U.toast('נסה לפתור, או פתח את הפתרון', 'warn'); }
    if (k === 'quiz' && !LS.s.done) { U.bad($('#l-body')); return U.toast('צריך 80% בבוחן כדי להמשיך', 'warn'); }
    if (k === 'done') { const nx = byId(LS.l.id + 1); return nx ? APP.go('lesson', nx.id) : APP.go('home'); }
    gotoStep(LS.s.step + 1, 'fwd');
  }
  function renderStep(dir = 'fwd') {
    const { l, s } = LS, k = STEPS[s.step][0], body = $('#l-body');
    $$('.stepper button').forEach((b, i) => { b.classList.toggle('on', i === s.step); b.classList.toggle('done', i < maxStep() || (s.done && i <= maxStep())); b.classList.toggle('locked', i > maxStep()); });
    const curBtn = $('.stepper .on'); if (curBtn && curBtn.scrollIntoView) curBtn.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    body.classList.remove('slide-fwd', 'slide-back'); void body.offsetWidth; body.classList.add('slide-' + dir);
    const nextBtn = $('#l-next'); nextBtn.textContent = 'הבא'; nextBtn.disabled = false; $('#l-prev').disabled = s.step === 0 && LS.chunk === 0;
    ({ review: stReview, guess: stGuess, learn: stLearn, example: stExample, practice: stPractice, task: stTask, quiz: stQuiz, explain: stExplain, done: stDone })[k](body, l, s, nextBtn);
    linkTerms(body);
    if (dir !== 'none') { const top = $('.l-head'); if (top && window.scrollY > top.offsetTop + 40) window.scrollTo({ top: top.offsetTop - 8, behavior: 'smooth' }); }
  }

  /* MCQ widget with instant feedback. onAnswer(correct, idx) */
  function mcq(q, opts = {}) {
    const order = opts.order || U.shuffle(q.o.map((_, i) => i));
    const el = h(`<div class="mcq"><p class="q">${q.q}</p><div class="opts">${order.map((i) => `<button class="opt" data-i="${i}">${q.o[i]}</button>`).join('')}</div><div class="fb" aria-live="polite"></div></div>`);
    let answered = false;
    $$('.opt', el).forEach((b) => b.addEventListener('click', () => {
      if (answered) return; answered = true;
      const i = Number(b.dataset.i), ok = i === q.a;
      $$('.opt', el).forEach((x) => { x.disabled = true; if (Number(x.dataset.i) === q.a) x.classList.add('right'); });
      if (!ok) b.classList.add('wrong');
      $('.fb', el).innerHTML = `<div class="fb-in ${ok ? 'ok' : opts.soft ? 'soft' : 'no'}"><b>${ok ? (opts.okText || 'נכון!') : (opts.badText || 'לא בדיוק.')}</b> ${q.e || ''}</div>`;
      ok ? U.good(b) : (opts.soft ? U.tone('tap') : U.bad(b));
      opts.onAnswer && opts.onAnswer(ok, i, b);
    }));
    if (opts.preset != null) { const b = $(`.opt[data-i="${opts.preset}"]`, el); if (b) { answered = false; b.click(); } }
    return el;
  }
  const qid = (lid, qi) => lid + ':' + qi;

  function stReview(body, l) {
    const done = L.filter((x) => x.id < l.id && (APP.state.lessons[x.id] || {}).done);
    const pool = []; done.forEach((x) => x.quiz.forEach((q, qi) => pool.push({ q, id: qid(x.id, qi), w: 1 + (APP.state.wrong[qid(x.id, qi)] || 0) * 3 + (x.id === l.id - 1 ? 2 : 0), l: x.id })));
    const picks = []; const P = pool.slice(); for (let k = 0; k < 2 && P.length; k++) { const tot = P.reduce((s, x) => s + x.w, 0); let r = Math.random() * tot, j = 0; while ((r -= P[j].w) > 0) j++; picks.push(P.splice(j, 1)[0]); }
    const prev = byId(l.id - 1);
    body.innerHTML = `<div class="card goals"><p class="eyebrow">מטרות השיעור</p><p>${esc(l.goals)}</p>${prev ? `<p class="muted">ידע נדרש: שיעור ${prev.id}, ${esc(prev.t)}.</p>` : '<p class="muted">לא צריך ידע קודם. אם אתה מתחיל מאפס ב-Python, עשה במקביל לשיעורים 1–10 את הקורסים החינמיים של Kaggle ב-Python וב-Pandas.</p>'}</div>` +
      (picks.length ? `<h3 class="st-h">חזרה קצרה</h3><p class="muted">שאלות משיעורים קודמים. שאלות שטעית בהן חוזרות יותר.</p><div class="rev"></div>` : `<div class="card soft"><h3>איך השיעור עובד</h3><ol class="howto">${STEPS.slice(1).map((x) => `<li>${x[1]}</li>`).join('')}</ol><p class="muted">בכל שלב יש כפתור "הבא". אפשר לשאול את המורה בכל רגע.</p></div>`);
    picks.forEach((p) => $('.rev', body).appendChild(mcq(p.q, { onAnswer: (ok) => { if (ok) { APP.addXP(5, '', 'r' + p.id + today()); if (APP.state.wrong[p.id]) APP.state.wrong[p.id]--; } else APP.state.wrong[p.id] = (APP.state.wrong[p.id] || 0) + 1; APP.persist(); } })));
  }
  function stGuess(body, l, s) {
    body.innerHTML = `<h3 class="st-h">נחש קודם</h3><p class="muted">ניחוש לפני ההסבר עוזר לזכור (גם כשטועים). אין ניקוד שלילי.</p>`;
    body.appendChild(mcq(l.guess, { soft: true, okText: 'ניחוש מצוין!', badText: 'רוב האנשים טועים כאן.', preset: s.guess, onAnswer: (ok, i, b) => { if (s.guess == null) { s.guess = i; APP.addXP(5, '', 'g' + l.id, b); APP.persist(); } } }));
  }
  function stLearn(body, l, s, nextBtn) {
    const c = l.chunks[LS.chunk], n = l.chunks.length;
    body.innerHTML = `<div class="chunk-prog">${l.chunks.map((_, i) => `<i class="${i <= LS.chunk ? 'on' : ''}"></i>`).join('')}<span>${LS.chunk + 1}/${n}</span></div><article class="card chunk"><h3>${c.h}</h3><div class="prose">${c.b}</div></article>${LS.chunk === n - 1 ? `<div class="card why"><p class="eyebrow">למה זה חשוב</p><p>${l.why}</p></div>` : ''}`;
    nextBtn.textContent = LS.chunk < n - 1 ? 'הבנתי, המשך' : 'לדוגמה';
  }
  function stExample(body, l) {
    body.innerHTML = `<article class="card ex"><p class="eyebrow">דוגמה פתורה</p><h3>${l.ex.h}</h3><div class="prose">${l.ex.b}</div></article><section class="card lab"><p class="eyebrow">מעבדה אינטראקטיבית</p><div id="lab-host"></div></section>`;
    const host = $('#lab-host', body);
    if (LABS[l.lab]) { try { LABS[l.lab](host, l); } catch (e) { host.innerHTML = '<p class="note warn">המעבדה נכשלה בטעינה: ' + esc(e.message) + '</p>'; } }
    host.addEventListener('input', () => APP.addXP(10, '', 'lab' + l.id), { once: true });
    host.addEventListener('click', (e) => { if (e.target.closest('button,input,select')) APP.addXP(10, '', 'lab' + l.id); }, { once: true });
  }
  function stPractice(body, l, s) {
    const p = l.practice; const used = s.hints || 0;
    body.innerHTML = `<h3 class="st-h">תרגול מודרך</h3><div class="card practice"><p class="q">${p.q}</p><div class="ans"><input id="pr-in" type="text" inputmode="decimal" autocomplete="off" placeholder="התשובה שלך" value="${s.practiceVal != null ? esc(s.practiceVal) : ''}"><em>${p.unit || ''}</em><button class="btn" id="pr-ck">בדוק</button></div><div class="fb" aria-live="polite"></div><div class="hints">${p.hints.filter(Boolean).map((hh, i) => `<div class="hint ${i < used ? 'show' : ''}"><b>רמז ${i + 1}</b> ${hh}</div>`).join('')}</div><div class="row-btns"><button class="btn ghost" id="pr-h">${used < p.hints.filter(Boolean).length ? 'רמז' : 'הצג פתרון'}</button></div><div class="sol ${s.practiceShown || s.practiceOk ? 'show' : ''}"><b>פתרון:</b> ${p.sol}</div></div>`;
    const inp = $('#pr-in', body), fb = $('.fb', body);
    const check = () => {
      const v = U.parseNum(inp.value); s.practiceVal = inp.value;
      if (!isFinite(v)) { fb.innerHTML = '<div class="fb-in soft">הכנס מספר.</div>'; return U.bad(inp); }
      const ok = p.tol === 0 ? Math.abs(v - p.a) < 1e-9 + 0.0001 * Math.abs(p.a) : Math.abs(v - p.a) <= Math.max(Math.abs(p.a) * p.tol, 0.005);
      if (ok) { s.practiceOk = true; fb.innerHTML = `<div class="fb-in ok"><b>נכון!</b> ${s.hints ? 'עם ' + s.hints + ' רמזים.' : 'בלי רמזים. מצוין.'}</div>`; U.good(inp.parentElement); APP.addXP(Math.max(5, 15 - (s.hints || 0) * 4), '', 'p' + l.id, inp); $('.sol', body).classList.add('show'); }
      else { const close = Math.abs(v - p.a) <= Math.abs(p.a) * 0.1; fb.innerHTML = `<div class="fb-in no"><b>${close ? 'קרוב!' : 'עוד לא.'}</b> ${close ? 'בדוק עיגול או סימן.' : v * 100 === p.a || v / 100 === p.a ? 'שים לב ליחידות: אחוזים או שבר?' : 'נסה רמז.'}</div>`; U.bad(inp.parentElement); }
      APP.persist();
    };
    $('#pr-ck', body).addEventListener('click', check);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); });
    $('#pr-h', body).addEventListener('click', () => { const nH = p.hints.filter(Boolean).length; if ((s.hints || 0) < nH) { s.hints = (s.hints || 0) + 1; } else { s.practiceShown = true; } APP.persist(); stPractice(body, l, s); U.tone('tap'); });
  }
  function stTask(body, l, s) {
    s.task = s.task || [];
    body.innerHTML = `<h3 class="st-h">תרגיל מעשי ב-Python</h3><p class="muted">עשה את זה במחשב שלך (JupyterLab). המורה זמין במצב למידה: מסביר ומשאיר לך את השורות החשובות.</p><ul class="checklist interactive">${l.task.steps.map((t, i) => `<li><label class="chk"><input type="checkbox" data-i="${i}" ${s.task[i] ? 'checked' : ''}> ${esc(t)}</label></li>`).join('')}</ul><div class="code-wrap"><div class="code-bar"><span>קוד התחלה</span><button class="btn ghost sm" id="tk-copy">העתק</button></div><pre class="code" dir="ltr"><code>${esc(l.task.code)}</code></pre></div><p class="note">מחקר של Anthropic: מי שהעביר את כתיבת הקוד ל-AI הבין 50% מהחומר, לעומת 67% אצל מי שכתב בעצמו.</p>`;
    $('#tk-copy', body).addEventListener('click', () => U.copy(l.task.code));
    $$('input[data-i]', body).forEach((c) => c.addEventListener('change', () => { s.task[c.dataset.i] = c.checked; APP.persist(); if (c.checked) { U.good(c.closest('li')); if (s.task.filter(Boolean).length === l.task.steps.length) APP.addXP(20, '', 't' + l.id, c); } }));
  }
  function stQuiz(body, l, s, nextBtn) {
    const qs = l.quiz; let k = 0, right = 0; const order = U.shuffle(qs.map((_, i) => i));
    const draw = () => {
      if (k >= qs.length) return result();
      const qi = order[k];
      body.innerHTML = `<h3 class="st-h">בוחן סיום</h3><div class="quiz-prog"><i style="width:${k / qs.length * 100}%"></i></div><p class="muted">שאלה ${k + 1} מתוך ${qs.length} · צריך ${Math.ceil(qs.length * 0.8)} נכונות כדי לפתוח את השיעור הבא</p>`;
      body.appendChild(mcq(qs[qi], { onAnswer: (ok) => { const id = qid(l.id, qi); if (ok) { right++; APP.addXP(10, '', 'q' + id); } else { APP.state.wrong[id] = (APP.state.wrong[id] || 0) + 1; APP.persist(); } const b = h(`<button class="btn" style="margin-top:12px">${k + 1 < qs.length ? 'לשאלה הבאה' : 'לתוצאה'}</button>`); body.appendChild(b); b.focus({ preventScroll: true }); b.addEventListener('click', () => { k++; draw(); }); } }));
      nextBtn.disabled = !s.done;
    };
    const result = () => {
      const sc = Math.round(right / qs.length * 100), pass = sc >= 80;
      s.best = Math.max(s.best || 0, sc);
      const first = pass && !s.done;
      if (pass) { s.done = true; s.reached = Math.max(s.reached || 0, 7); APP.addXP(50, '', 'pass' + l.id); }
      APP.persist(); renderTop();
      body.innerHTML = `<div class="result ${pass ? 'pass' : 'fail'}"><div class="big-num"><b id="sc">0</b>%</div><h3>${pass ? (first ? `שיעור ${l.id + 1 <= 35 ? l.id + 1 : ''} נפתח!` : 'עברת שוב') : 'עוד לא 80%'}</h3><p>${pass ? 'מעולה. עכשיו הסבר בחזרה במילים שלך כדי לקבע.' : 'חזור על ההסבר ונסה שוב. השאלות יעורבבו.'}</p><div class="row-btns">${pass ? '' : '<button class="btn" id="qz-again">נסה שוב</button><button class="btn ghost" id="qz-learn">חזרה להסבר</button>'}</div></div>`;
      U.countUp($('#sc', body), sc, (x) => num(x));
      if (pass) { U.tone('win'); if (first) U.confetti(); nextBtn.disabled = false; }
      else { U.bad(); $('#qz-again', body).addEventListener('click', () => stQuiz(body, l, s, nextBtn)); $('#qz-learn', body).addEventListener('click', () => gotoStep(2, 'back')); nextBtn.disabled = true; }
    };
    if (s.done && !s.retakeQuiz) {
      body.innerHTML = `<div class="result pass"><div class="big-num"><b>${s.best}</b>%</div><h3>עברת את הבוחן</h3><div class="row-btns"><button class="btn ghost" id="qz-re">עשה שוב לתרגול</button></div></div>`;
      $('#qz-re', body).addEventListener('click', () => { s.retakeQuiz = true; stQuiz(body, l, s, nextBtn); s.retakeQuiz = false; });
      return;
    }
    draw();
  }
  function stExplain(body, l, s) {
    body.innerHTML = `<h3 class="st-h">הסבר לי בחזרה</h3><p class="muted">הסבר כאילו אתה מלמד חבר. כתיבה במילים שלך היא הדרך הכי טובה לגלות מה עוד לא ברור.</p><div class="card"><p class="q">${l.explain.p}</p><textarea id="ex-t" rows="6" placeholder="כתוב כאן…">${esc(s.explainText || '')}</textarea><div class="row-btns"><button class="btn" id="ex-ck">בדוק את ההסבר שלי</button><span class="muted" id="ex-wc"></span></div><div class="fb" id="ex-fb" aria-live="polite"></div></div>`;
    const t = $('#ex-t', body), wc = () => { $('#ex-wc', body).textContent = t.value.trim().split(/\s+/).filter(Boolean).length + ' מילים'; };
    t.addEventListener('input', () => { s.explainText = t.value; wc(); APP.persist(); }); wc();
    $('#ex-ck', body).addEventListener('click', () => APP.tutor.grade(l, t.value, $('#ex-fb', body)));
    if (s.explainFb) $('#ex-fb', body).innerHTML = s.explainFb;
  }
  function stDone(body, l, s, nextBtn) {
    const nx = byId(l.id + 1);
    body.innerHTML = `<div class="result pass"><h3>סיכום שיעור ${l.id}</h3><p>${l.why}</p></div><div class="card"><p class="eyebrow">נשמר במחברת שלך</p>${s.explainText ? `<blockquote>${esc(s.explainText)}</blockquote>` : '<p class="muted">לא כתבת הסבר. אפשר לחזור לשלב הקודם.</p>'}<div class="kv"><div><span>בוחן</span><b>${s.best || 0}%</b></div><div><span>תרגול</span><b>${s.practiceOk ? 'נפתר' : s.practiceShown ? 'ראית פתרון' : '—'}</b></div><div><span>תרגיל</span><b>${(s.task || []).filter(Boolean).length}/${l.task.steps.length}</b></div></div></div>${l.id === 13 || l.id === 34 || l.id === 10 || l.id === 11 ? '<div class="card soft"><p>תרגל את מה שלמדת בסימולטור, על נתונים אמיתיים.</p><button class="btn ghost" id="dn-sim">פתח את הסימולטור</button></div>' : ''}`;
    if ($('#dn-sim', body)) $('#dn-sim', body).addEventListener('click', () => APP.go('sim'));
    nextBtn.textContent = nx ? (APP.unlocked(nx.id) ? `לשיעור ${nx.id}` : 'לבית') : 'סיימת את הקורס! לבית';
    if (s.done) APP.addXP(5, '', 'fin' + l.id);
  }

  /* ---------- quick review ---------- */
  function viewReview(main) {
    const done = L.filter((x) => (APP.state.lessons[x.id] || {}).done);
    const src = done.length ? done : [L[0]];
    const pool = []; src.forEach((x) => x.quiz.forEach((q, qi) => pool.push({ q, id: qid(x.id, qi), l: x, w: 1 + (APP.state.wrong[qid(x.id, qi)] || 0) * 4 })));
    const picks = []; const P = pool.slice(); for (let k = 0; k < 5 && P.length; k++) { const tot = P.reduce((s, x) => s + x.w, 0); let r = Math.random() * tot, j = 0; while ((r -= P[j].w) > 0) j++; picks.push(P.splice(j, 1)[0]); }
    let k = 0, right = 0;
    const draw = () => {
      if (k >= picks.length) { main.innerHTML = `<div class="result ${right >= 4 ? 'pass' : ''}"><div class="big-num"><b>${right}</b>/${picks.length}</div><h3>${right === picks.length ? 'מושלם!' : right >= 3 ? 'טוב מאוד' : 'כדאי לחזור על החומר'}</h3><div class="row-btns"><button class="btn" id="rv-again">עוד סבב</button><button class="btn ghost" id="rv-home">לבית</button></div></div>`; if (right === picks.length) U.confetti(); $('#rv-again').addEventListener('click', () => viewReview(main)); $('#rv-home').addEventListener('click', () => APP.go('home', null, { back: true })); return; }
      const p = picks[k];
      main.innerHTML = `<h1 class="page-h">חזרה מהירה</h1><div class="quiz-prog"><i style="width:${k / picks.length * 100}%"></i></div><p class="muted">משיעור ${p.l.id}: ${esc(p.l.t)}${done.length ? '' : ' (עוד לא סיימת שיעורים, אז מתחילים משיעור 1)'}</p>`;
      main.appendChild(mcq(p.q, { onAnswer: (ok) => { if (ok) { right++; APP.addXP(5, '', 'rv' + p.id + today()); if (APP.state.wrong[p.id]) APP.state.wrong[p.id]--; } else APP.state.wrong[p.id] = (APP.state.wrong[p.id] || 0) + 1; APP.persist(); const b = h('<button class="btn" style="margin-top:12px">הבא</button>'); main.appendChild(b); b.addEventListener('click', () => { k++; draw(); }); } }));
    };
    draw();
  }

  /* ---------- PROGRESS / NOTEBOOK / SETTINGS ---------- */
  function viewMe(main) {
    const st = APP.state, done = L.filter((l) => (st.lessons[l.id] || {}).done), avg = done.length ? Math.round(done.reduce((s, l) => s + st.lessons[l.id].best, 0) / done.length) : 0;
    const hs = st.simHistory || [];
    const notes = L.filter((l) => (st.lessons[l.id] || {}).explainText);
    main.innerHTML = `<h1 class="page-h">ההתקדמות שלך</h1>
      <div class="tiles"><div><b>${done.length}</b><span>שיעורים</span></div><div><b>${avg}%</b><span>ממוצע בחנים</span></div><div><b>${num(st.xp)}</b><span>XP</span></div><div><b>${st.streak.n || 0}</b><span>ימים ברצף</span></div><div><b>${hs.length}</b><span>סשנים בסימולטור</span></div><div><b>${hs.filter((r) => r.ret > r.bhr).length}</b><span>ניצחת את המדד</span></div></div>
      <section class="card"><h3>לפי שלב</h3>${COURSE.phases.map((p) => { const ls2 = L.filter((l) => l.ph === p.id), dn = ls2.filter((l) => (st.lessons[l.id] || {}).done).length; return `<div class="pbar"><span>${p.id}. ${esc(p.t)}</span><div><i style="width:${dn / ls2.length * 100}%"></i></div><b>${dn}/${ls2.length}</b></div>`; }).join('')}</section>
      <section class="card"><h3>המחברת שלי</h3><p class="muted">ההסברים שכתבת, ה-IPS ועמוד המסקנה. אפשר להעתיק הכול כ-Markdown לפרויקט.</p>${notes.length ? notes.map((l) => `<details><summary>שיעור ${l.id}: ${esc(l.t)}</summary><blockquote>${esc(st.lessons[l.id].explainText)}</blockquote></details>`).join('') : '<p class="muted">עוד אין הסברים. הם נוצרים בשלב "הסבר לי" בכל שיעור.</p>'}${st.ips ? '<details><summary>IPS: תוכנית ההשקעות שלי</summary><blockquote>' + esc(Object.values(st.ips).join(' · ')) + '</blockquote></details>' : ''}<button class="btn ghost" id="me-copy">העתק את המחברת</button></section>
      <section class="card"><h3>הגדרות</h3>
        <div class="seg" id="me-theme">${[['system', 'לפי המערכת'], ['light', 'בהיר'], ['dark', 'כהה']].map(([k, n]) => `<button data-t="${k}" class="${st.settings.theme === k ? 'on' : ''}">${n}</button>`).join('')}</div>
        <label class="chk"><input type="checkbox" id="me-snd" ${st.settings.sound ? 'checked' : ''}> צלילי משוב</label>
        <label class="chk"><input type="checkbox" id="me-hap" ${st.settings.haptics ? 'checked' : ''}> רטט (בטלפון)</label>
        <label class="chk"><input type="checkbox" id="me-un" ${st.settings.unlockAll ? 'checked' : ''}> מצב חופשי: פתח את כל השיעורים</label>
        <label class="ctl ctl-num"><span>מפתח Finnhub (לא חובה, למניות בזמן אמת)</span><input type="text" id="me-fh" value="${esc(st.settings.finnhub || '')}" placeholder="מפתח חינמי מ-finnhub.io" dir="ltr"></label>
      </section>
      <section class="card"><h3>גיבוי</h3><p class="muted">ההתקדמות נשמרת בדפדפן הזה. כדי לעבור למכשיר אחר, העתק את קוד הגיבוי והדבק אותו שם.</p><div class="row-btns"><button class="btn ghost" id="me-bk">העתק קוד גיבוי</button><button class="btn ghost" id="me-rs">שחזר מגיבוי</button><button class="btn ghost danger" id="me-reset">אפס התקדמות</button></div><div id="me-x"></div></section>
      <p class="src">התוכן מבוסס על "קורס שוק ההון ב-35 שיעורים". עמלות, כללי מס ותנאי פלטפורמות משתנים: בדוק לפני שמפקידים כסף. זה לא ייעוץ השקעות.</p>`;
    $('#me-copy').addEventListener('click', () => U.copy(['# המחברת שלי', ...notes.map((l) => `## שיעור ${l.id}: ${l.t}\n\n${st.lessons[l.id].explainText}`), st.ips ? '## IPS\n\n' + Object.entries(st.ips).map(([k, v]) => `- ${k}: ${v}`).join('\n') : '', st.capstone && st.capstone.text ? '## מסקנת הגמר\n\n' + st.capstone.text : ''].filter(Boolean).join('\n\n')));
    $$('#me-theme button').forEach((b) => b.addEventListener('click', () => { st.settings.theme = b.dataset.t; APP.persist(); applyTheme(); viewMe(main); }));
    [['me-snd', 'sound'], ['me-hap', 'haptics'], ['me-un', 'unlockAll']].forEach(([id, k]) => $('#' + id).addEventListener('change', (e) => { st.settings[k] = e.target.checked; APP.persist(); U.tone('tap'); }));
    $('#me-fh').addEventListener('change', (e) => { st.settings.finnhub = e.target.value.trim(); APP.persist(); U.toast('נשמר. מניות זמינות במצב "זמן אמת" בסימולטור.', 'good'); });
    $('#me-bk').addEventListener('click', () => { const code = btoa(unescape(encodeURIComponent(JSON.stringify(Object.assign({}, st, { simSession: null }))))); U.copy(code); });
    $('#me-rs').addEventListener('click', () => { $('#me-x').innerHTML = '<textarea id="me-code" rows="3" placeholder="הדבק כאן את קוד הגיבוי" dir="ltr"></textarea><button class="btn" id="me-do">שחזר</button>'; $('#me-do').addEventListener('click', () => { try { const o = JSON.parse(decodeURIComponent(escape(atob($('#me-code').value.trim())))); if (!o.lessons) throw 0; APP.state = Object.assign({}, DEF, o); APP.persist(); U.toast('שוחזר', 'good'); renderTop(); viewMe(main); } catch (e) { U.toast('הקוד לא תקין. העתק אותו שוב במלואו.', 'warn'); } }); });
    $('#me-reset').addEventListener('click', () => { $('#me-x').innerHTML = '<div class="confirm"><p>למחוק את כל ההתקדמות, ההסברים והסשנים? אי אפשר לבטל.</p><button class="btn danger" id="me-yes">כן, אפס הכול</button><button class="btn ghost" id="me-no">ביטול</button></div>'; $('#me-no').addEventListener('click', () => $('#me-x').innerHTML = ''); $('#me-yes').addEventListener('click', () => { APP.state = JSON.parse(JSON.stringify(DEF)); APP.persist(); renderTop(); U.toast('ההתקדמות אופסה', 'info'); APP.go('home'); }); });
  }

  /* ---------- glossary: linked terms + searchable sheet ---------- */
  const TERMS = Object.keys(COURSE.glossary).sort((a, b) => b.length - a.length);
  function linkTerms(root) {
    $$('.term', root).forEach((t) => { if (t.tagName === 'BUTTON') return; const k = t.textContent.trim(); const key = TERMS.find((x) => x === k) || TERMS.find((x) => k.startsWith(x) || x.startsWith(k)); if (!key) return; const b = h(`<button class="term" data-k="${esc(key)}">${t.innerHTML}</button>`); t.replaceWith(b); });
    $$('button.term', root).forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); termPop(b, b.dataset.k); }));
  }
  function termPop(anchor, k) {
    $$('.pop').forEach((p) => p.remove());
    const p = h(`<div class="pop" role="dialog"><b>${esc(k)}</b><p>${esc(COURSE.glossary[k])}</p><button class="link">כל המונחים ←</button></div>`);
    document.body.appendChild(p);
    const r = anchor.getBoundingClientRect(); p.style.top = (r.bottom + window.scrollY + 6) + 'px'; p.style.left = Math.max(12, Math.min(window.innerWidth - p.offsetWidth - 12, r.left + r.width / 2 - p.offsetWidth / 2)) + 'px';
    $('.link', p).addEventListener('click', () => { p.remove(); glossary(k); });
    setTimeout(() => document.addEventListener('click', function off(e) { if (!p.contains(e.target)) { p.remove(); document.removeEventListener('click', off); } }), 0);
    U.tone('tap');
  }
  function glossary(focus) {
    const sh = sheet('מילון מונחים', `<input type="search" id="gl-q" placeholder="חפש מונח…" value="${focus ? esc(focus) : ''}"><dl class="gloss"></dl>`);
    const draw = () => { const q = $('#gl-q', sh).value.trim(); $('.gloss', sh).innerHTML = Object.entries(COURSE.glossary).filter(([k, v]) => !q || k.includes(q) || v.includes(q)).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('') || '<p class="muted">לא נמצא. נסה לשאול את המורה.</p>'; };
    $('#gl-q', sh).addEventListener('input', draw); draw();
  }
  function sheet(title, html) {
    $$('.sheet-bg').forEach((x) => x.remove());
    const bg = h(`<div class="sheet-bg"><div class="sheet" role="dialog" aria-label="${esc(title)}"><header><h3>${esc(title)}</h3><button class="x" aria-label="סגור">✕</button></header><div class="sheet-body">${html}</div></div></div>`);
    document.body.appendChild(bg);
    const close = () => { bg.classList.add('out'); setTimeout(() => bg.remove(), 220); };
    bg.addEventListener('click', (e) => { if (e.target === bg) close(); }); $('.x', bg).addEventListener('click', close);
    document.addEventListener('keydown', function esc2(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc2); } });
    return $('.sheet', bg);
  }
  APP.glossary = glossary;

  /* ---------- tutor (Claude via the artifact runtime; offline fallback) ---------- */
  let samplePromise = null;
  const getSample = () => { if (!samplePromise) samplePromise = (window.claude && window.claude.use) ? window.claude.use('sample').catch(() => null) : Promise.resolve(null); return samplePromise; };
  const RULES = (l) => `אתה המורה של "קורס שוק ההון ב-35 שיעורים", אפליקציה בעברית למתחילים. ענה תמיד בעברית פשוטה וברורה, בקצרה (עד 150 מילים אלא אם ביקשו יותר). עבוד במצב למידה: הסבר, תן דוגמה מספרית, ושאל שאלה אחת שבודקת הבנה. בקוד: אל תכתוב פתרון מלא. תן מבנה, רמזים, והשאר סימוני TODO(human) בשורות החשובות. אל תמליץ על ניירות ערך ספציפיים לקנייה ואל תיתן ייעוץ השקעות אישי. העמדה של הקורס: קרן מחקה זולה ורחבה היא הלב של התיק; רוב הניסיונות לנצח את השוק נכשלים אחרי עלויות; כל טענת חיזוי נבדקת בכנות.${l ? `\n\nהשיעור הנוכחי: שיעור ${l.id}, "${l.t}". מטרות: ${l.goals}\nתוכן השיעור:\n${l.chunks.map((c) => '- ' + c.h + ': ' + c.b.replace(/<[^>]+>/g, '')).join('\n')}` : ''}`;
  const offlineAnswer = (q, l) => {
    const words = q.replace(/[?.,!״"׳']/g, ' ').split(/\s+/).filter((w) => w.length > 2);
    const hitsG = Object.entries(COURSE.glossary).map(([k, v]) => [k, v, words.filter((w) => k.includes(w) || w.includes(k)).length * 3 + words.filter((w) => v.includes(w)).length]).filter((x) => x[2] > 0).sort((a, b) => b[2] - a[2]).slice(0, 3);
    const chunks = []; L.forEach((ll) => ll.chunks.forEach((c) => { const t = c.b.replace(/<[^>]+>/g, ''); const sc = words.filter((w) => t.includes(w) || c.h.includes(w)).length + (l && ll.id === l.id ? 1 : 0); if (sc > 1) chunks.push([ll, c, sc]); }));
    chunks.sort((a, b) => b[2] - a[2]);
    if (!hitsG.length && !chunks.length) return '<p>לא מצאתי את זה בחומר. נסה לנסח במילים אחרות, או חפש במילון המונחים.</p>';
    return (hitsG.length ? '<p class="eyebrow">מהמילון</p>' + hitsG.map((x) => `<p><b>${esc(x[0])}:</b> ${esc(x[1])}</p>`).join('') : '') + (chunks.length ? '<p class="eyebrow">מהשיעורים</p>' + chunks.slice(0, 2).map((x) => `<div class="cite"><b>שיעור ${x[0].id} · ${x[1].h}</b><div>${x[1].b}</div></div>`).join('') : '');
  };
  const md = (t) => esc(t).replace(/```([\s\S]*?)```/g, (m, c) => `<pre class="code" dir="ltr">${c.replace(/^\w*\n/, '')}</pre>`).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
  const errText = (e) => ({ not_granted: 'המורה צריך הרשאה כדי לענות. אפשר לאשר בפעם הבאה.', rate_limited: 'יותר מדי שאלות ברגע. חכה דקה ונסה שוב.' })[e && e.code] || 'המורה לא זמין כרגע.';
  APP.tutor = {
    available: () => getSample().then((s) => !!s),
    open(l) {
      const sh = sheet('שאל את המורה', `<div class="chat" id="ch-log"><div class="msg bot">${l ? `שאל אותי כל דבר על <b>${esc(l.t)}</b>, או על כל נושא אחר בקורס.` : 'שאל אותי כל דבר על הקורס.'}</div></div><div class="chips" id="ch-sug">${(l ? ['תסביר לי שוב במילים פשוטות', 'תן לי דוגמה מספרית', 'למה זה חשוב לי?', 'בחן אותי בשאלה'] : ['מה זה קרן מחקה?', 'למה לא לבחור מניות?']).map((x) => `<button class="chip">${x}</button>`).join('')}</div><form id="ch-f" class="chat-in"><input id="ch-q" autocomplete="off" placeholder="כתוב שאלה…" aria-label="שאלה"><button class="btn" type="submit">שלח</button></form><p class="muted tiny" id="ch-mode"></p>`);
      const log = $('#ch-log', sh), turns = []; let ctl = null;
      getSample().then((s) => { $('#ch-mode', sh).textContent = s ? 'המורה הוא Claude. השאלות שלך נשלחות אליו.' : 'מצב לא מקוון: התשובות נשלפות מהמילון ומהשיעורים.'; });
      const ask = async (q) => {
        if (!q.trim()) return;
        log.appendChild(h(`<div class="msg me">${esc(q)}</div>`));
        const bot = h('<div class="msg bot typing"><i></i><i></i><i></i></div>'); log.appendChild(bot); log.scrollTop = log.scrollHeight;
        const s = await getSample();
        if (!s) { setTimeout(() => { bot.classList.remove('typing'); bot.innerHTML = offlineAnswer(q, l); linkTerms(bot); log.scrollTop = log.scrollHeight; }, 350); return; }
        turns.push({ role: 'user', content: q }); ctl = new AbortController();
        try {
          const { text } = await s([{ role: 'user', content: RULES(l) + '\n\nהשאלות של התלמיד יבואו עכשיו.' }, { role: 'assistant', content: 'מוכן. מה השאלה?' }, ...turns], { cache: false, signal: ctl.signal, onText: ({ text }) => { bot.classList.remove('typing'); bot.innerHTML = md(text); log.scrollTop = log.scrollHeight; } });
          bot.classList.remove('typing'); bot.innerHTML = md(text); turns.push({ role: 'assistant', content: text });
        } catch (e) { turns.pop(); bot.classList.remove('typing'); bot.innerHTML = (e.text ? md(e.text) + '<br>' : '') + `<span class="muted">${errText(e)}</span><hr>` + offlineAnswer(q, l); }
        log.scrollTop = log.scrollHeight;
      };
      $('#ch-f', sh).addEventListener('submit', (e) => { e.preventDefault(); const q = $('#ch-q', sh).value; $('#ch-q', sh).value = ''; ask(q); });
      $$('#ch-sug .chip', sh).forEach((b) => b.addEventListener('click', () => ask(b.textContent)));
      setTimeout(() => $('#ch-q', sh).focus(), 100);
    },
    async grade(l, text, out) {
      const s = ls(l.id); text = text.trim();
      if (text.split(/\s+/).length < 8) { out.innerHTML = '<div class="fb-in soft">כתוב לפחות 2–3 משפטים, כדי שיהיה מה לבדוק.</div>'; return U.bad(out); }
      const kw = l.explain.k.map((g) => [g[0], g.some((w) => text.toLowerCase().includes(w.toLowerCase()))]);
      const local = Math.round(kw.filter((x) => x[1]).length / kw.length * 100);
      const localHtml = `<ul class="checklist">${kw.map(([w, ok]) => `<li class="${ok ? 'ok' : 'no'}">${ok ? 'הזכרת' : 'חסר'}: ${esc(w)}</li>`).join('')}</ul>`;
      const smp = await getSample();
      const finish = (score, html) => { out.innerHTML = `<div class="fb-in ${score >= 60 ? 'ok' : 'soft'}"><b>${score >= 80 ? 'הסבר מצוין' : score >= 60 ? 'הסבר טוב' : 'כמעט'}: ${score}/100</b></div>` + html; s.explainFb = out.innerHTML; s.explainScore = score; APP.persist(); if (score >= 60) { U.good(out); APP.addXP(20, '', 'x' + l.id); } else U.tone('tap'); };
      if (!smp) return finish(local, localHtml + '<p class="muted tiny">נבדק לפי מושגי המפתח של השיעור.</p>');
      out.innerHTML = '<div class="loading"><i></i>המורה קורא את ההסבר שלך…</div>';
      try {
        const r = await smp.json(`${RULES(l)}\n\nהתלמיד ענה על "${l.explain.p}":\n"""${text}"""\n\nמושגי מפתח שהסבר טוב יכלול: ${l.explain.k.map((g) => g[0]).join(', ')}.\nהחזר רק JSON: {"score": מספר 0-100 לפי הבנה ודיוק, "good": [עד 2 דברים נכונים שכתב], "fix": [עד 2 טעויות או חוסרים, בעדינות], "question": "שאלת המשך אחת שבודקת הבנה"}`, { modelTier: 'quick' });
        const sc = Math.round(U.clamp(Number(r.score) || local, 0, 100));
        finish(sc, `${(r.good || []).length ? `<p class="eyebrow">מה טוב</p><ul class="checklist">${r.good.map((x) => `<li class="ok">${esc(x)}</li>`).join('')}</ul>` : ''}${(r.fix || []).length ? `<p class="eyebrow">לשפר</p><ul class="checklist">${r.fix.map((x) => `<li class="no">${esc(x)}</li>`).join('')}</ul>` : ''}${r.question ? `<div class="card soft"><b>שאלת המשך:</b> ${esc(r.question)}</div>` : ''}`);
      } catch (e) { finish(local, localHtml + `<p class="muted tiny">${errText(e)} נבדק לפי מושגי המפתח.</p>`); }
    },
    async review(cap, items, out) {
      const missing = items.filter((_, i) => !cap.checks[i]);
      const local = () => `<div class="card soft"><b>הבודק הסקפטי (לא מקוון):</b><ul class="checklist">${missing.length ? missing.map((m) => `<li class="no">למה לא: ${esc(m)}?</li>`).join('') : '<li class="ok">כל הסעיפים מסומנים.</li>'}${!/נעול|נעולה/.test(cap.text) ? '<li class="no">המסקנה לא מזכירה את התקופה הנעולה.</li>' : ''}${!/עלו|bp|נקודות בסיס/.test(cap.text) ? '<li class="no">איפה העלויות במסקנה?</li>' : ''}${!/ניסיונות|וריאציות/.test(cap.text) ? '<li class="no">כמה ניסיונות עשית בסך הכול?</li>' : ''}${!/משנה את דעתי|ישנה את דעתי/.test(cap.text) ? '<li class="no">חסר "מה היה משנה את דעתי".</li>' : ''}</ul></div>`;
      const smp = await getSample();
      if (!smp) { out.innerHTML = local(); return; }
      out.innerHTML = '<div class="loading"><i></i>הבודק קורא…</div>';
      try { let acc = ''; await smp(`${RULES(null)}\n\nאתה עכשיו בודק סקפטי של פרויקט גמר. חפש חורים: מידע מהעתיד, הטיית שרידות, עלויות, חיפוש יתר בנתונים, שינויי משטר, ומספר ניסיונות. היה ישיר אבל הוגן. 5 נקודות לכל היותר, ואז ציון תהליך מ-0 עד 100.\n\nסעיפים שהתלמיד סימן כבוצעו: ${items.filter((_, i) => cap.checks[i]).join('; ') || 'אין'}.\nסעיפים חסרים: ${missing.join('; ') || 'אין'}.\nעמוד המסקנה:\n"""${cap.text || '(ריק)'}"""`, { onText: ({ text }) => { acc = text; out.innerHTML = `<div class="card soft">${md(text)}</div>`; } }); }
      catch (e) { out.innerHTML = `<p class="muted">${errText(e)}</p>` + local(); }
    },
    async simCoach(rec, st, out) {
      const smp = await getSample(); if (!smp) return;
      out.innerHTML = '<div class="loading"><i></i>המאמן מנתח…</div>';
      const trades = st.trades.slice(-25).map((o) => `${o.side === 'buy' ? 'קנייה' : 'מכירה'} ${o.type} ${o.qty} @ ${U.price(o.fillPx)}${o.reason ? ' (' + o.reason + ')' : ''}`).join('\n');
      try { await smp(`${RULES(null)}\n\nנתח סשן בסימולטור של משקיע מתחיל. התשואה שלו ${pct(rec.ret, 2)} מול קנה-והחזק ${pct(rec.bhr, 2)}. ירידה מקסימלית ${pct(rec.mdd, 1)}. ${rec.trades} עסקאות, עלויות ${pct(rec.costs, 2)} מההון. דגלי התנהגות: ${JSON.stringify(st.flags)}.\nעסקאות:\n${trades || 'אין'}\n\nכתוב 3–4 תובנות קצרות על ההתנהגות (לא על המזל), כל אחת עם הפניה לשיעור רלוונטי בקורס, ותרגיל אחד לסשן הבא.`, { onText: ({ text }) => { out.innerHTML = `<div class="card soft">${md(text)}</div>`; } }); }
      catch (e) { out.innerHTML = `<p class="muted">${errText(e)}</p>`; }
    }
  };

  /* ---------- boot ---------- */
  APP.start = () => {
    applyTheme(); renderTop();
    $('#btn-gloss').addEventListener('click', () => glossary());
    $('#btn-ask').addEventListener('click', () => APP.tutor.open(LS && cur === 'lesson' ? LS.l : null));
    const hsh = (location.hash || '').slice(1), m = hsh.match(/^lesson-(\d+)$/);
    if (m && byId(Number(m[1])) && APP.unlocked(Number(m[1]))) APP.go('lesson', Number(m[1]));
    else if (['course', 'sim', 'me', 'review'].includes(hsh)) APP.go(hsh);
    else APP.go('home');
    matchMedia('(prefers-color-scheme: dark)').addEventListener && matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => window.SIM && SIM.refreshTheme && SIM.refreshTheme());
  };
  return APP;
})();
document.addEventListener('DOMContentLoaded', APP.start);
