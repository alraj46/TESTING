/*
 * Abaya Size Engine — customer widget.
 *
 * A self-contained flow that mounts into any storefront. It runs the SAME
 * engine the backend runs (loaded via <script>), so sizing happens on-device:
 * for the scan mode, imagery would be processed by the body-scan vendor and
 * only numeric measurements reach this code — no body image is uploaded here.
 *
 * Optional server mode: set window.ABAYA_API = 'https://.../api' to route the
 * final recommendation through POST /api/recommend instead of computing locally.
 */
(function () {
  'use strict';

  var Engine = window.AbayaEngine;
  var Providers = window.AbayaProviders;
  var CATALOG = window.AbayaSampleCatalog || [];

  var overlay = document.getElementById('overlay');
  var body = document.getElementById('widget-body');
  var stepsEl = document.getElementById('steps');
  var modalAbaya = document.getElementById('modal-abaya');
  var select = document.getElementById('abaya-select');

  // Populate product selector.
  CATALOG.forEach(function (a) {
    var o = document.createElement('option');
    o.value = a.id;
    o.textContent = a.name;
    select.appendChild(o);
  });

  function currentAbaya() {
    return CATALOG.find(function (a) { return a.id === select.value; }) || CATALOG[0];
  }

  var CUTS = { straight: 'قصّة مستقيمة', 'a-line': 'قصّة A-Line', bisht: 'بشت' };
  var FABRICS = { stretch: 'قماش مطّاطي', 'non-stretch': 'قماش غير مطّاطي' };

  function syncProductInfo() {
    var a = currentAbaya();
    document.getElementById('p-name').textContent = a.name;
    document.getElementById('p-meta').textContent =
      (CUTS[a.cut] || a.cut) + ' · ' + (FABRICS[a.fabric] || a.fabric);
  }
  select.addEventListener('change', syncProductInfo);
  syncProductInfo();

  // ---- widget state ----------------------------------------------------------
  var state = { step: 1, mode: 'scan', input: {}, prefs: { hem: 'standard', fit: null } };

  function open() {
    state = { step: 1, mode: 'scan', input: {}, prefs: { hem: 'standard', fit: null } };
    modalAbaya.textContent = currentAbaya().name;
    overlay.classList.add('open');
    render();
  }
  function close() { overlay.classList.remove('open'); }

  document.getElementById('open-widget').addEventListener('click', open);
  document.getElementById('close-widget').addEventListener('click', close);
  document.getElementById('how-link').addEventListener('click', function (e) { e.preventDefault(); open(); });
  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

  function setSteps() {
    var dots = stepsEl.children;
    for (var i = 0; i < dots.length; i++) {
      dots[i].className = 'dot' + (i + 1 < state.step ? ' done' : i + 1 === state.step ? ' active' : '');
    }
  }

  // ---- rendering -------------------------------------------------------------
  function render() {
    setSteps();
    if (state.step === 1) return renderMeasure();
    if (state.step === 2) return renderPrefs();
    if (state.step === 3) return renderResult();
  }

  function renderMeasure() {
    body.innerHTML =
      '<div class="h-step">١ — قياساتك</div>' +
      '<div class="sub">اختاري طريقة القياس. لا نحفظ أي صورة — نستخرج الأرقام فقط.</div>' +
      '<div class="mode-tabs">' +
        tab('scan', '📷 مسح بالكاميرا') +
        tab('manual', '✍️ إدخال يدوي') +
        tab('estimate', '⚡ تقدير سريع') +
      '</div>' +
      '<div id="mode-body"></div>' +
      '<div class="error" id="err"></div>';

    Array.prototype.forEach.call(body.querySelectorAll('.mode-tabs button'), function (b) {
      b.addEventListener('click', function () { state.mode = b.dataset.mode; renderMeasure(); });
    });
    renderModeBody();
  }

  function tab(mode, label) {
    return '<button data-mode="' + mode + '" class="' + (state.mode === mode ? 'active' : '') + '">' + label + '</button>';
  }

  function heightField() {
    return (
      '<div class="field"><label for="f-height">طولك (سم)</label>' +
      '<input type="number" id="f-height" min="120" max="210" placeholder="مثال: 163" value="' +
      (state.input.height || '') + '" /></div>'
    );
  }

  function renderModeBody() {
    var el = document.getElementById('mode-body');
    if (state.mode === 'manual') {
      el.innerHTML =
        heightField() +
        '<div class="grid2" style="margin-top:12px">' +
          numField('shoulder', 'عرض الكتف (سم)', 'اختياري') +
          numField('bust', 'محيط الصدر (سم)', 'اختياري') +
          numField('hip', 'محيط الورك (سم)', 'اختياري') +
          numField('sleeve', 'طول الذراع (سم)', 'اختياري') +
        '</div>' +
        nextButton('التالي');
      wireInputs(el);
    } else if (state.mode === 'estimate') {
      el.innerHTML =
        heightField() +
        '<div class="grid2" style="margin-top:12px">' +
          numField('bust', 'محيط الصدر (سم)', 'اختياري — يحسّن الدقة') +
          numField('hip', 'محيط الورك (سم)', 'اختياري — يحسّن الدقة') +
        '</div>' +
        '<div class="note">التقدير السريع يستنتج باقي القياسات من طولك. لأعلى دقة استخدمي المسح بالكاميرا.</div>' +
        nextButton('التالي');
      wireInputs(el);
    } else {
      el.innerHTML =
        heightField() +
        '<div class="scanner" id="scanner">' +
          '<div class="scan-line"></div>' +
          '<div class="silhouette" id="sil">🧍🏻‍♀️</div>' +
          '<div class="turn" id="scan-turn">ضعي الجوال أمامك على مستوى الخصر</div>' +
          '<div class="hint" id="scan-hint">أدخلي طولك ثم ابدئي المسح</div>' +
        '</div>' +
        '<button class="btn btn-gold" id="scan-btn" style="margin-top:14px">ابدئي المسح</button>';
      wireInputs(el);
      document.getElementById('scan-btn').addEventListener('click', runScan);
    }
  }

  function numField(name, label, hint) {
    return (
      '<div class="field"><label for="f-' + name + '">' + label + '</label>' +
      '<input type="number" id="f-' + name + '" min="20" max="200" placeholder="' + (hint || '') + '" value="' +
      (state.input[name] || '') + '" /></div>'
    );
  }

  function wireInputs(scope) {
    Array.prototype.forEach.call(scope.querySelectorAll('input[type=number]'), function (inp) {
      var key = inp.id.replace('f-', '');
      inp.addEventListener('input', function () {
        var v = parseFloat(inp.value);
        if (isFinite(v) && v > 0) state.input[key] = v; else delete state.input[key];
      });
    });
    var nb = scope.querySelector('#next-btn');
    if (nb) nb.addEventListener('click', function () {
      if (!state.input.height) return showErr('الرجاء إدخال طولك أولًا.');
      state.step = 2; render();
    });
  }

  function nextButton(label) {
    return '<button class="btn btn-gold" id="next-btn" style="margin-top:16px">' + label + '</button>';
  }

  function showErr(msg) {
    var e = document.getElementById('err');
    if (e) e.textContent = msg || '';
  }

  // Staged scan simulator: front photo -> turn 90° -> side photo -> analyzing.
  function runScan() {
    if (!state.input.height) return showErr('أدخلي طولك قبل بدء المسح.');
    showErr('');
    var scanner = document.getElementById('scanner');
    var turn = document.getElementById('scan-turn');
    var hint = document.getElementById('scan-hint');
    var sil = document.getElementById('sil');
    var btn = document.getElementById('scan-btn');
    btn.disabled = true;
    scanner.classList.add('scanning');

    var stages = [
      { t: 'صورة أمامية 📸', h: 'ابقي ثابتة…', s: '🧍🏻‍♀️', ms: 1200 },
      { t: 'استديري ٩٠° ↻', h: 'الجانب الآن', s: '🚶🏻‍♀️', ms: 1100 },
      { t: 'صورة جانبية 📸', h: 'ابقي ثابتة…', s: '🧍🏻‍♀️', ms: 1200 },
      { t: 'جاري تحليل المقاسات…', h: 'لا يتم حفظ الصور', s: '✨', ms: 1200 }
    ];
    var i = 0;
    (function nextStage() {
      if (i >= stages.length) {
        // Vendor would return measurements here; the simulator derives them.
        finishMeasureAndAdvance();
        return;
      }
      var st = stages[i++];
      turn.textContent = st.t;
      hint.textContent = st.h;
      sil.textContent = st.s;
      setTimeout(nextStage, st.ms);
    })();
  }

  function finishMeasureAndAdvance() {
    state.step = 2;
    render();
  }

  function renderPrefs() {
    body.innerHTML =
      '<div class="h-step">٢ — تفضيلاتك</div>' +
      '<div class="sub">علشان نضبط الطول والقصّة على ذوقك.</div>' +
      '<label class="field"><small>الطول المفضّل</small></label>' +
      '<div class="chip-row" id="hem">' +
        chip('hem', 'standard', 'قياسي') +
        chip('hem', 'floor', 'يلامس الأرض') +
        chip('hem', 'heels', 'مع كعب') +
        chip('hem', 'shorter', 'أقصر قليلًا') +
      '</div>' +
      '<label class="field" style="margin-top:14px"><small>القصّة على الجسم</small></label>' +
      '<div class="chip-row" id="fit">' +
        chip('fit', 'slim', 'ضيّقة') +
        chip('fit', 'regular', 'عادية') +
        chip('fit', 'oversized', 'واسعة') +
      '</div>' +
      '<div class="foot-actions">' +
        '<button class="btn btn-ghost" id="back-btn">رجوع</button>' +
        '<button class="btn btn-gold btn-block" id="show-btn">أظهري مقاسي ✨</button>' +
      '</div>' +
      '<div class="error" id="err"></div>';

    wireChips('hem');
    wireChips('fit');
    document.getElementById('back-btn').addEventListener('click', function () { state.step = 1; render(); });
    document.getElementById('show-btn').addEventListener('click', compute);
  }

  function chip(group, value, label) {
    var active = state.prefs[group] === value ? ' active' : '';
    return '<button class="chip' + active + '" data-group="' + group + '" data-value="' + value + '">' + label + '</button>';
  }
  function wireChips(group) {
    Array.prototype.forEach.call(document.querySelectorAll('#' + group + ' .chip'), function (c) {
      c.addEventListener('click', function () {
        state.prefs[group] = c.dataset.value;
        wireChipsRefresh(group);
      });
    });
  }
  function wireChipsRefresh(group) {
    Array.prototype.forEach.call(document.querySelectorAll('#' + group + ' .chip'), function (c) {
      c.classList.toggle('active', c.dataset.value === state.prefs[group]);
    });
  }

  // ---- compute ---------------------------------------------------------------
  function compute() {
    var abaya = currentAbaya();
    var prefs = { hem: state.prefs.hem || 'standard', fit: state.prefs.fit || abaya.fitType };

    body.innerHTML =
      '<div class="analyzing"><div class="spinner"></div>' +
      '<div>جاري حساب مقاسك على «' + abaya.name + '»…</div></div>';

    setTimeout(function () {
      var apiBase = window.ABAYA_API;
      if (apiBase) {
        computeViaApi(apiBase, abaya, prefs);
      } else {
        try {
          var measured = Providers.get(state.mode)(state.input);
          var rec = Engine.recommend(measured.measurements, abaya, prefs);
          state.recommendation = rec;
          state.step = 3;
          render();
        } catch (e) {
          state.step = 2; render();
          showErr(e.message || 'تعذّر حساب المقاس.');
        }
      }
    }, 700);
  }

  function computeViaApi(apiBase, abaya, prefs) {
    fetch(apiBase.replace(/\/$/, '') + '/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ abayaId: abaya.id, provider: state.mode, input: state.input, prefs: prefs })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error || d.errors) throw new Error(d.error || d.errors.join('، '));
        state.recommendation = d.recommendation;
        state.step = 3; render();
      })
      .catch(function (e) { state.step = 2; render(); showErr(e.message); });
  }

  // ---- result ----------------------------------------------------------------
  var COMFORT_BADGE = {
    tight: 'bad', snug: 'warn', comfortable: 'ok', loose: 'warn', very_loose: 'warn'
  };

  function renderResult() {
    var r = state.recommendation;
    var est = r.basis.estimatedFields || [];
    var privacyNote =
      r.basis.source === 'scan'
        ? 'تم تحليل الصور على جهازك واستخراج الأرقام فقط — لم تُحفظ أي صورة.'
        : est.length
          ? 'تم تقدير بعض القياسات من طولك (' + est.length + '). للدقة القصوى استخدمي المسح بالكاميرا.'
          : 'اعتمدنا القياسات التي أدخلتِها.';

    body.innerHTML =
      '<div class="result-hero">' +
        '<div class="eyebrow">مقاسك المثالي لهذه العباية</div>' +
        '<div class="size"><b>' + r.recommended.length + '</b></div>' +
        '<div class="width">العرض: ' + r.recommended.width + '</div>' +
      '</div>' +
      '<div class="confidence">' +
        '<div class="lbl"><span>دقة التوصية</span><b>' + r.confidence + '%</b></div>' +
        '<div class="bar"><i style="width:' + r.confidence + '%"></i></div>' +
      '</div>' +
      '<div class="fitcards">' +
        fitCard('عند الصدر', r.fit.chest) +
        fitCard('عند الورك', r.fit.hip) +
      '</div>' +
      '<div class="alts">' +
        altRow('لو تحبينها تلامس الأرض', r.alternatives.touchesFloor) +
        altRow('لو تلبسينها مع كعب', r.alternatives.withHeels) +
        altRow('لو تحبينها أقصر قليلًا', r.alternatives.shorter) +
      '</div>' +
      '<div class="note">🔒 ' + privacyNote + '</div>' +
      '<div class="foot-actions">' +
        '<button class="btn btn-ghost" id="again-btn">إعادة</button>' +
        '<button class="btn btn-gold btn-block" id="pick-btn">اعتماد المقاس ' + r.recommended.length + ' / ' + r.recommended.width + '</button>' +
      '</div>';

    document.getElementById('again-btn').addEventListener('click', function () { state.step = 1; render(); });
    document.getElementById('pick-btn').addEventListener('click', function () {
      close();
      alert('تم اختيار المقاس ' + r.recommended.length + ' — ' + r.recommended.width + ' ✨');
    });
  }

  function fitCard(label, f) {
    var badge = COMFORT_BADGE[f.comfort.key] || 'warn';
    return (
      '<div class="fitcard"><div class="k">' + label + '</div>' +
      '<div class="v"><span class="badge ' + badge + '">' + f.comfort.label + '</span></div></div>'
    );
  }
  function altRow(label, size) {
    return '<div class="row"><span>' + label + '</span><b>' + size + '</b></div>';
  }
})();
