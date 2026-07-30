'use strict';

/*
 * Lightweight tests for the Abaya Size Engine (no test framework — run with
 * `npm test` / `node test/engine.test.js`). Exit code is non-zero on failure.
 */

var Engine = require('../shared/engine');
var Providers = require('../shared/providers');
var sample = require('../shared/sample-catalog');

var passed = 0;
var failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    // eslint-disable-next-line no-console
    console.error('  ✗ ' + msg);
  }
}
function section(name) {
  // eslint-disable-next-line no-console
  console.log('\n• ' + name);
}

var classic = sample.find(function (a) { return a.id === 'classic-black-straight'; });
var stretch = sample.find(function (a) { return a.id === 'jersey-stretch'; });

// --- estimateMeasurements -----------------------------------------------------
section('estimateMeasurements');
(function () {
  var r = Engine.estimateMeasurements({ height: 165 });
  assert(r.measurements.height === 165, 'keeps given height');
  assert(r.estimated.indexOf('bust') !== -1, 'flags bust as estimated when missing');
  assert(r.estimated.indexOf('shoulder') !== -1, 'flags shoulder as estimated');
  assert(r.measurements.shoulder > 30 && r.measurements.shoulder < 50, 'shoulder estimate is plausible');

  var r2 = Engine.estimateMeasurements({ height: 165, bust: 90, hip: 100 });
  assert(r2.estimated.indexOf('bust') === -1, 'does not flag bust when provided');
  assert(r2.measurements.bust === 90, 'uses provided bust verbatim');

  var threw = false;
  try { Engine.estimateMeasurements({}); } catch (e) { threw = true; }
  assert(threw, 'throws without height');
})();

// --- length selection ---------------------------------------------------------
section('length selection scales with height');
(function () {
  function bestLength(height, hem) {
    var m = Engine.estimateMeasurements({ height: height }).measurements;
    m._estimated = [];
    var rec = Engine.recommend(m, classic, { hem: hem || 'standard' });
    return rec.recommended.length;
  }
  var short = bestLength(155);
  var tall = bestLength(178);
  assert(tall >= short, 'taller customer gets an equal-or-longer abaya (' + short + ' -> ' + tall + ')');

  // Floor / heels should never be shorter than standard for the same person.
  var std = bestLength(165, 'standard');
  var floor = bestLength(165, 'floor');
  var heels = bestLength(165, 'heels');
  var shorter = bestLength(165, 'shorter');
  assert(floor >= std, 'floor-touch >= standard');
  assert(heels >= floor, 'with-heels >= floor-touch');
  assert(shorter <= std, 'shorter <= standard');
})();

// --- width / fit --------------------------------------------------------------
section('width selection and fit read');
(function () {
  var m = Engine.estimateMeasurements({ height: 163, bust: 88, hip: 98 }).measurements;
  m._estimated = [];
  var rec = Engine.recommend(m, classic, { fit: 'regular' });
  assert(['S', 'M', 'L'].indexOf(rec.recommended.width) !== -1, 'returns a valid width size');
  assert(rec.fit.chest.comfort.key, 'reports a chest comfort read');
  assert(rec.fit.hip.comfort.key, 'reports a hip comfort read');

  // A much larger body should push toward a larger width.
  var big = Engine.estimateMeasurements({ height: 163, bust: 120, hip: 130 }).measurements;
  big._estimated = [];
  var recBig = Engine.recommend(big, classic, { fit: 'regular' });
  var order = { S: 0, M: 1, L: 2 };
  assert(order[recBig.recommended.width] >= order[rec.recommended.width], 'larger body => equal-or-larger width');

  // Oversized preference should not choose a smaller size than slim.
  var slim = Engine.recommend(m, classic, { fit: 'slim' }).recommended.width;
  var over = Engine.recommend(m, classic, { fit: 'oversized' }).recommended.width;
  assert(order[over] >= order[slim], 'oversized >= slim in width (' + slim + ' -> ' + over + ')');
})();

// --- stretch fabric -----------------------------------------------------------
section('stretch fabric adds tolerance');
(function () {
  var m = Engine.estimateMeasurements({ height: 165, bust: 108, hip: 118 }).measurements;
  m._estimated = [];
  var recStretch = Engine.recommend(m, stretch, { fit: 'regular' });
  // Stretch chest ease is computed against a reduced effective body.
  assert(recStretch.fit.chest.ease >= 0, 'stretch keeps non-negative usable chest ease');
})();

// --- confidence ---------------------------------------------------------------
section('confidence reflects data quality');
(function () {
  // Go through the providers so measurement provenance (_estimated) is attached
  // exactly as it is for real callers.
  var full = Providers.get('manual')({ height: 165, shoulder: 38, bust: 90, hip: 100, sleeve: 56 }).measurements;
  var fullRec = Engine.recommend(full, classic, {});
  var sparse = Providers.get('estimate')({ height: 165 }).measurements;
  var sparseRec = Engine.recommend(sparse, classic, {});
  assert(fullRec.confidence > sparseRec.confidence, 'full measurements beat height-only (' + sparseRec.confidence + ' < ' + fullRec.confidence + ')');
  assert(fullRec.confidence >= 40 && fullRec.confidence <= 99, 'confidence stays in [40,99]');

  var scan = Providers.get('scan')({ height: 165 });
  var scanRec = Engine.recommend(scan.measurements, classic, {});
  assert(scanRec.basis.source === 'scan', 'scan source is carried through');
})();

// --- providers ----------------------------------------------------------------
section('providers');
(function () {
  var scan = Providers.get('scan')({ height: 170, seed: 1 });
  assert(scan.source === 'scan' && scan.estimated.length === 0, 'scan reports measured (nothing estimated)');
  assert(scan.measurements.bust > 60, 'scan yields a plausible bust');

  var scan2 = Providers.get('scan')({ height: 170, seed: 1 });
  assert(scan2.measurements.bust === scan.measurements.bust, 'scan is deterministic for a given seed');

  var threw = false;
  try { Providers.get('vendor')({ height: 170 }); } catch (e) { threw = true; }
  assert(threw, 'vendor provider throws until configured');

  var unknown = false;
  try { Providers.get('nope'); } catch (e) { unknown = true; }
  assert(unknown, 'unknown provider name throws');
})();

// --- summary ------------------------------------------------------------------
// eslint-disable-next-line no-console
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
