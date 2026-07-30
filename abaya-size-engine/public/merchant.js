/*
 * Merchant catalog admin — thin client over the REST API (server/routes/catalog.js).
 * Demonstrates per-garment measurement entry (the data the engine reasons over).
 */
(function () {
  'use strict';

  var API = '/api/abayas';
  var editingId = null;

  var rows = document.getElementById('rows');
  var err = document.getElementById('err');
  var CUTS = { straight: 'مستقيمة', 'a-line': 'A-Line', bisht: 'بشت' };
  var FABRICS = { 'non-stretch': 'غير مطّاطي', stretch: 'مطّاطي' };

  var DEFAULT_LENGTHS = JSON.stringify(
    [52, 54, 56, 58, 60].map(function (s, i) { return { size: s, garmentLength: 128 + i * 5 }; }),
    null,
    0
  );
  var DEFAULT_WIDTHS = JSON.stringify(
    [{ size: 'S', chest: 108, hip: 116 }, { size: 'M', chest: 120, hip: 128 }, { size: 'L', chest: 132, hip: 140 }],
    null,
    0
  );

  function showErr(m) { err.textContent = m || ''; }

  function load() {
    fetch(API)
      .then(function (r) { return r.json(); })
      .then(function (d) { renderRows(d.abayas || []); })
      .catch(function (e) { showErr('تعذّر تحميل الكتالوج: ' + e.message); });
  }

  function renderRows(abayas) {
    rows.innerHTML = '';
    abayas.forEach(function (a) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + esc(a.name) + '<br><span class="hint" dir="ltr">' + esc(a.id) + '</span></td>' +
        '<td><span class="tag">' + (CUTS[a.cut] || a.cut) + '</span></td>' +
        '<td>' + (FABRICS[a.fabric] || a.fabric) + '</td>' +
        '<td>' + (a.lengths || []).map(function (l) { return l.size; }).join(' · ') + '</td>' +
        '<td>' + (a.widths || []).map(function (w) { return w.size; }).join(' · ') + '</td>' +
        '<td class="row-actions">' +
          '<button class="btn btn-ghost" data-edit="' + a.id + '">تعديل</button>' +
          '<button class="btn btn-ghost" data-del="' + a.id + '">حذف</button>' +
        '</td>';
      rows.appendChild(tr);
    });
    Array.prototype.forEach.call(rows.querySelectorAll('[data-edit]'), function (b) {
      b.addEventListener('click', function () { edit(b.dataset.edit); });
    });
    Array.prototype.forEach.call(rows.querySelectorAll('[data-del]'), function (b) {
      b.addEventListener('click', function () { del(b.dataset.del); });
    });
  }

  function edit(id) {
    fetch(API + '/' + id)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var a = d.abaya;
        editingId = a.id;
        document.getElementById('form-title').textContent = 'تعديل: ' + a.name;
        val('f-name', a.name); val('f-id', a.id); val('f-cut', a.cut);
        val('f-fabric', a.fabric); val('f-fit', a.fitType);
        val('f-lengths', JSON.stringify(a.lengths, null, 2));
        val('f-widths', JSON.stringify(a.widths, null, 2));
        document.getElementById('f-id').disabled = true;
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      });
  }

  function del(id) {
    if (!confirm('حذف هذه العباية؟')) return;
    fetch(API + '/' + id, { method: 'DELETE' }).then(function () { load(); if (editingId === id) resetForm(); });
  }

  function save() {
    showErr('');
    var payload;
    try {
      payload = {
        name: get('f-name'),
        cut: get('f-cut'),
        fabric: get('f-fabric'),
        fitType: get('f-fit'),
        lengths: JSON.parse(get('f-lengths') || '[]'),
        widths: JSON.parse(get('f-widths') || '[]')
      };
      if (!editingId && get('f-id')) payload.id = get('f-id');
    } catch (e) {
      return showErr('صيغة JSON غير صحيحة في الأطوال/العروض.');
    }

    var url = editingId ? API + '/' + editingId : API;
    var method = editingId ? 'PUT' : 'POST';
    fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) return showErr((res.d.errors || [res.d.error]).join('، '));
        resetForm();
        load();
      })
      .catch(function (e) { showErr(e.message); });
  }

  function resetForm() {
    editingId = null;
    document.getElementById('form-title').textContent = 'إضافة عباية جديدة';
    ['f-name', 'f-id'].forEach(function (id) { val(id, ''); });
    val('f-cut', 'straight'); val('f-fabric', 'non-stretch'); val('f-fit', 'regular');
    val('f-lengths', pretty(DEFAULT_LENGTHS)); val('f-widths', pretty(DEFAULT_WIDTHS));
    document.getElementById('f-id').disabled = false;
  }

  function pretty(s) { return JSON.stringify(JSON.parse(s), null, 2); }
  function get(id) { return document.getElementById(id).value.trim(); }
  function val(id, v) { document.getElementById(id).value = v == null ? '' : v; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  document.getElementById('save-btn').addEventListener('click', save);
  document.getElementById('reset-btn').addEventListener('click', resetForm);

  resetForm();
  load();
})();
