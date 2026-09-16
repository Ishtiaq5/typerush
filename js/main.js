/* TypeRush - premium typing speed test (vanilla JS, no dependencies) */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Word pool
   * ------------------------------------------------------------------ */
  var POOL = ('the of and to in a is that it for you was with on as have but be they at one this from or had by hot word what some we can out other were all there when up use your how said an each she which do their time if will way about many then them would write like so these her long make thing see him two has look more day could go come did number sound no most people my over know water than call first who may down side been now find any new work part take get place made live where after back little only round man year came show every good me give our under name very through just form much great think say help low line before turn cause same mean differ move right boy old too does tell sentence set three want air well also play small end put home read hand port large spell add even land here must big high such follow act why ask men change went light kind off need house picture try us again animal point mother world near build self earth father head stand own page should country found answer school grow study still learn plant cover food sun four between state keep eye never last let thought city tree cross farm hard start might story saw far sea draw left late run while press close night real life few north open seem together next white children begin got walk example ease paper often always music those both mark book letter until mile river car feet care second group carry took rain eat room friend began idea fish mountain stop once base hear horse cut sure watch color face wood main enough plain girl usual young ready above ever red list though feel talk bird soon body dog family direct pose leave song measure door product black short numeral class wind question happen complete ship area half rock order fire south problem piece told knew pass since top whole king space heard best hour better true during hundred five remember step early hold west ground interest reach fast verb sing listen six table travel less morning ten simple several vowel toward war lay against pattern slow center love person money serve appear road map science rule govern pull cold notice voice fall power town fine certain fly unit lead cry dark machine note wait plan figure star box noun field rest correct able pound done beauty drive stood contain front teach week final gave green oh quick develop ocean warm free minute strong special mind behind clear tail produce fact street inch lot nothing course stay wheel full force blue object decide surface deep moon island foot yet busy test record boat common gold possible plane age dry wonder laugh thousand ago ran check game shape yes cool hot miss brought heat snow bed bring sit perhaps fill east weight language among')
    .split(' ');

  /* ------------------------------------------------------------------ *
   * Element refs
   * ------------------------------------------------------------------ */
  var $ = function (id) { return document.getElementById(id); };
  var els = {
    words: $('words'), stage: $('stage'), hint: $('hint'),
    wpm: $('stat-wpm'), acc: $('stat-acc'), time: $('stat-time'), err: $('stat-err'),
    bar: $('bar'), barFill: $('bar-fill'),
    results: $('results'),
    resWpm: $('res-wpm'), resAcc: $('res-acc'), resRaw: $('res-raw'),
    resCons: $('res-cons'), resErr: $('res-err'),
    gauge: $('gauge-fill'), chartLine: $('chart-line'), chartArea: $('chart-area'),
    newBest: $('new-best'), again: $('again'), share: $('share'),
    resetRecords: $('reset-records'),
    recWpm: $('rec-wpm'), recAcc: $('rec-acc'), recTests: $('rec-tests')
  };
  var modeButtons = Array.prototype.slice.call(document.querySelectorAll('.mode'));

  /* ------------------------------------------------------------------ *
   * Constants + state
   * ------------------------------------------------------------------ */
  var LINE_H = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--line')) || 44;
  var RING = 326.73;          // matches stroke-dasharray in styles.css
  var GAUGE_MAX = 140;        // wpm that fills the gauge
  var STORE_KEY = 'typerush.records.v1';

  var state = {
    duration: 30,
    words: [],
    typed: [],
    input: '',
    index: 0,
    started: false,
    finished: false,
    startTime: 0,
    timerId: 0,
    correct: 0,
    incorrect: 0,
    samples: [],
    lastSample: -1
  };

  /* ------------------------------------------------------------------ *
   * Helpers
   * ------------------------------------------------------------------ */
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function buildWords(count) {
    var out = [];
    while (out.length < count) out = out.concat(shuffle(POOL.slice()));
    return out.slice(0, count);
  }

  function loadRecords() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch (err) { return {}; }
  }

  function saveRecords(rec) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(rec)); } catch (err) { /* ignore */ }
  }

  function stopTimer() {
    if (state.timerId) { clearInterval(state.timerId); state.timerId = 0; }
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */
  function renderWords() {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < state.words.length; i++) {
      var span = document.createElement('span');
      span.className = 'word';
      span.textContent = state.words[i];
      frag.appendChild(span);
    }
    els.words.innerHTML = '';
    els.words.appendChild(frag);
  }

  function paint() {
    var total = state.words.length;
    var cur = state.index;
    var k, el, typed;

    for (k = 0; k < total; k++) {
      if (k === cur) continue;
      el = els.words.children[k];
      if (!el) continue;
      if (k > cur) {
        el.className = 'word';
        el.textContent = state.words[k];
      } else {
        typed = state.typed[k] || '';
        el.className = 'word ' + (typed === state.words[k] ? 'done-ok' : 'done-bad');
        el.textContent = state.words[k];
      }
    }

    el = els.words.children[cur];
    if (!el) return;
    var target = state.words[cur];
    var input = state.input;
    var html = '';
    var i;

    for (i = 0; i < target.length; i++) {
      if (i === input.length) html += '<span class="caret"></span>';
      var cls = 'char';
      if (input[i] !== undefined) cls += (input[i] === target[i] ? ' ok' : ' bad');
      html += '<span class="' + cls + '">' + esc(target[i]) + '</span>';
    }
    if (input.length > target.length) {
      for (i = target.length; i < input.length; i++) {
        html += '<span class="char extra">' + esc(input[i]) + '</span>';
      }
    }
    if (input.length >= target.length) html += '<span class="caret"></span>';

    el.className = 'word current';
    el.innerHTML = html;
  }

  function scrollToCurrent() {
    var el = els.words.children[state.index];
    if (!el) return;
    var line = Math.round(el.offsetTop / LINE_H);
    var y = Math.min(0, (1 - line) * LINE_H);
    els.words.style.transform = 'translateY(' + y + 'px)';
  }

  /* ------------------------------------------------------------------ *
   * Live metrics
   * ------------------------------------------------------------------ */
  function elapsedSeconds() {
    return state.started ? (Date.now() - state.startTime) / 1000 : 0;
  }

  function netWpm(elapsed) {
    if (!elapsed || elapsed < 0.4) return 0;
    return Math.round((state.correct / 5) / (elapsed / 60));
  }

  function rawWpm(elapsed) {
    if (!elapsed || elapsed < 0.4) return 0;
    return Math.round(((state.correct + state.incorrect) / 5) / (elapsed / 60));
  }

  function accuracy() {
    var total = state.correct + state.incorrect;
    if (!total) return 100;
    return Math.round((state.correct / total) * 100);
  }

  function updateLive() {
    els.wpm.textContent = String(Math.max(0, netWpm(elapsedSeconds())));
    els.acc.textContent = accuracy() + '%';
    els.err.textContent = String(state.incorrect);
  }

  function updateTimerUi(elapsed) {
    var remaining = Math.max(0, state.duration - elapsed);
    els.time.textContent = String(Math.ceil(remaining));
    var pct = Math.min(100, (elapsed / state.duration) * 100);
    els.barFill.style.width = pct + '%';
    els.bar.setAttribute('aria-valuenow', String(Math.round(pct)));
  }

  /* ------------------------------------------------------------------ *
   * Test lifecycle
   * ------------------------------------------------------------------ */
  function reset(duration) {
    stopTimer();
    if (duration) state.duration = duration;
    state.words = buildWords(Math.max(160, Math.round(state.duration * 2) + 60));
    state.typed = [];
    state.input = '';
    state.index = 0;
    state.started = false;
    state.finished = false;
    state.startTime = 0;
    state.correct = 0;
    state.incorrect = 0;
    state.samples = [];
    state.lastSample = -1;

    els.results.classList.add('is-hidden');
    els.newBest.classList.add('is-hidden');
    els.hint.classList.remove('is-hidden');
    els.wpm.textContent = '0';
    els.acc.textContent = '100%';
    els.err.textContent = '0';
    updateTimerUi(0);

    renderWords();
    paint();
    scrollToCurrent();
    renderRecords();
  }

  function startClock() {
    state.started = true;
    state.finished = false;
    state.startTime = Date.now();
    els.hint.classList.add('is-hidden');
    stopTimer();
    state.timerId = setInterval(tick, 100);
  }

  function tick() {
    var elapsed = elapsedSeconds();
    updateTimerUi(elapsed);
    updateLive();

    var sec = Math.floor(elapsed);
    if (sec >= 1 && sec > state.lastSample) {
      state.lastSample = sec;
      state.samples.push({ t: elapsed, wpm: rawWpm(elapsed) });
    }
    if (elapsed >= state.duration) finish();
  }

  function commitWord() {
    var target = state.words[state.index];
    var input = state.input;
    var i;
    for (i = input.length; i < target.length; i++) state.incorrect++;
    state.typed[state.index] = input;
    state.index++;
    state.input = '';
    paint();
    updateLive();
    scrollToCurrent();
  }

  function finish() {
    stopTimer();
    state.started = false;
    state.finished = true;

    var elapsed = state.duration;
    var net = Math.max(0, netWpm(elapsed));
    var raw = Math.max(0, rawWpm(elapsed));
    var acc = accuracy();
    var cons = consistency();

    els.resWpm.textContent = String(net);
    els.resAcc.textContent = acc + '%';
    els.resRaw.textContent = String(raw);
    els.resCons.textContent = cons + '%';
    els.resErr.textContent = String(state.incorrect);

    els.gauge.style.strokeDashoffset = String(RING);
    window.requestAnimationFrame(function () {
      var frac = Math.min(net / GAUGE_MAX, 1);
      els.gauge.style.strokeDashoffset = String(RING * (1 - frac));
    });

    drawChart();

    var rec = loadRecords();
    var isBest = net > (rec.bestWpm || 0) && net > 0;
    rec.bestWpm = Math.max(rec.bestWpm || 0, net);
    rec.bestAcc = Math.max(rec.bestAcc || 0, acc);
    rec.tests = (rec.tests || 0) + 1;
    saveRecords(rec);
    renderRecords();

    if (isBest) els.newBest.classList.remove('is-hidden');

    els.results.classList.remove('is-hidden');
  }

  function consistency() {
    var s = state.samples;
    if (s.length < 2) return 0;
    var mean = 0, i;
    for (i = 0; i < s.length; i++) mean += s[i].wpm;
    mean /= s.length;
    if (mean <= 0) return 0;
    var varsum = 0;
    for (i = 0; i < s.length; i++) varsum += Math.pow(s[i].wpm - mean, 2);
    var sd = Math.sqrt(varsum / s.length);
    var value = Math.round((1 - sd / mean) * 100);
    return Math.max(0, Math.min(100, value));
  }

  function drawChart() {
    var s = state.samples;
    if (!s.length) {
      els.chartLine.setAttribute('points', '');
      els.chartArea.setAttribute('d', '');
      return;
    }
    var max = 20, i;
    for (i = 0; i < s.length; i++) if (s[i].wpm > max) max = s[i].wpm;
    max *= 1.15;

    var pts = [];
    for (i = 0; i < s.length; i++) {
      var x = (s[i].t / state.duration) * 100;
      var y = 38 - (s[i].wpm / max) * 34;
      pts.push([Math.max(0, Math.min(100, x)), Math.max(2, Math.min(38, y))]);
    }
    var line = pts.map(function (p) { return p[0].toFixed(2) + ',' + p[1].toFixed(2); }).join(' ');
    els.chartLine.setAttribute('points', line);
    var area = 'M' + pts[0][0].toFixed(2) + ',40 ' + pts.map(function (p) {
      return 'L' + p[0].toFixed(2) + ',' + p[1].toFixed(2);
    }).join(' ') + ' L' + pts[pts.length - 1][0].toFixed(2) + ',40 Z';
    els.chartArea.setAttribute('d', area);
  }

  /* ------------------------------------------------------------------ *
   * Personal best board
   * ------------------------------------------------------------------ */
  function renderRecords() {
    var rec = loadRecords();
    els.recWpm.textContent = rec.bestWpm ? (rec.bestWpm + ' wpm') : '\u2014';
    els.recAcc.textContent = rec.bestAcc ? (rec.bestAcc + '%') : '\u2014';
    els.recTests.textContent = String(rec.tests || 0);
  }

  /* ------------------------------------------------------------------ *
   * Clipboard
   * ------------------------------------------------------------------ */
  function copyText(text, btn) {
    var old = btn.textContent;
    var flash = function () {
      btn.textContent = 'Copied!';
      window.setTimeout(function () { btn.textContent = old; }, 1600);
    };
    var fallback = function () {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', 'readonly');
      ta.style.position = 'absolute';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); flash(); } catch (err) { /* ignore */ }
      document.body.removeChild(ta);
    };
    if (window.navigator.clipboard && window.navigator.clipboard.writeText) {
      window.navigator.clipboard.writeText(text).then(flash, fallback);
    } else {
      fallback();
    }
  }

  /* ------------------------------------------------------------------ *
   * Input handling
   * ------------------------------------------------------------------ */
  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'Tab') {
      var t = e.target;
      if (t && t.closest && t.closest('button, a')) return;
      e.preventDefault();
      reset();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      reset();
      return;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (state.finished || !state.started) return;
      if (state.input.length) { state.input = state.input.slice(0, -1); paint(); }
      return;
    }
    if (e.key === ' ') {
      e.preventDefault();
      if (state.finished) return;
      if (!state.started) return;
      if (!state.input.length) return;
      commitWord();
      return;
    }
    if (e.key.length !== 1) return;
    if (state.finished) return;

    if (!state.started) startClock();

    var expected = state.words[state.index][state.input.length];
    if (expected !== undefined && e.key === expected) state.correct++;
    else state.incorrect++;

    state.input += e.key;
    paint();
    updateLive();
    scrollToCurrent();
  }

  /* ------------------------------------------------------------------ *
   * Wiring
   * ------------------------------------------------------------------ */
  document.addEventListener('keydown', onKeyDown);

  els.stage.addEventListener('click', function () { els.stage.focus(); });

  els.again.addEventListener('click', function () { reset(); els.stage.focus(); });

  els.share.addEventListener('click', function () {
    copyText(
      'TypeRush \u2014 ' + els.resWpm.textContent + ' wpm at ' + els.resAcc.textContent +
      ' accuracy on the ' + state.duration + 's test. Can you beat it?',
      els.share
    );
  });

  els.resetRecords.addEventListener('click', function () {
    try { localStorage.removeItem(STORE_KEY); } catch (err) { /* ignore */ }
    els.newBest.classList.add('is-hidden');
    renderRecords();
  });

  modeButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      modeButtons.forEach(function (b) {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      reset(parseInt(btn.getAttribute('data-seconds'), 10) || 30);
      els.stage.focus();
    });
  });

  reset(30);
})();
