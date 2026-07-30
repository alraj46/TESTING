/*
 * In-memory abaya catalog store (MVP). Swap for a real DB by keeping this same
 * interface: list / get / create / update / remove. Seeded from the shared
 * sample catalog so the demo works out of the box.
 */
'use strict';

var sample = require('../shared/sample-catalog');

var store = new Map();
sample.forEach(function (a) {
  store.set(a.id, clone(a));
});

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

function slug(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function validate(a) {
  var errors = [];
  if (!a || typeof a !== 'object') return ['body must be an object'];
  if (!a.name) errors.push('name is required');
  if (!Array.isArray(a.lengths) || !a.lengths.length) {
    errors.push('lengths[] is required');
  } else {
    a.lengths.forEach(function (l, i) {
      if (typeof l.size !== 'number') errors.push('lengths[' + i + '].size must be a number');
      if (typeof l.garmentLength !== 'number') errors.push('lengths[' + i + '].garmentLength (cm) is required');
    });
  }
  if (!Array.isArray(a.widths) || !a.widths.length) {
    errors.push('widths[] is required');
  } else {
    a.widths.forEach(function (w, i) {
      if (!w.size) errors.push('widths[' + i + '].size (S/M/L) is required');
      if (typeof w.chest !== 'number') errors.push('widths[' + i + '].chest (cm) is required');
      if (typeof w.hip !== 'number') errors.push('widths[' + i + '].hip (cm) is required');
    });
  }
  return errors;
}

module.exports = {
  list: function () {
    return Array.from(store.values()).map(clone);
  },
  get: function (id) {
    var a = store.get(id);
    return a ? clone(a) : null;
  },
  create: function (data) {
    var errors = validate(data);
    if (errors.length) return { errors: errors };
    var id = data.id && !store.has(data.id) ? data.id : uniqueId(data.name);
    var item = Object.assign(
      { cut: 'straight', fabric: 'non-stretch', fitType: 'regular', color: '#111111' },
      clone(data),
      { id: id }
    );
    store.set(id, item);
    return { item: clone(item) };
  },
  update: function (id, data) {
    if (!store.has(id)) return { notFound: true };
    var merged = Object.assign(clone(store.get(id)), clone(data), { id: id });
    var errors = validate(merged);
    if (errors.length) return { errors: errors };
    store.set(id, merged);
    return { item: clone(merged) };
  },
  remove: function (id) {
    return store.delete(id);
  }
};

function uniqueId(name) {
  var base = slug(name) || 'abaya';
  var id = base;
  var n = 2;
  while (store.has(id)) id = base + '-' + n++;
  return id;
}
