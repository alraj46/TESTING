/*
 * Measurement providers — the seam between the Abaya Size Engine and however
 * the customer's body measurements are obtained.
 *
 * The engine only ever consumes NUMBERS (height, shoulder, bust, hip, sleeve).
 * A provider's whole job is to turn some input into those numbers. This keeps
 * the sizing IP independent of any single scanning vendor, and — importantly —
 * lets image processing happen wherever the vendor requires while the rest of
 * the system only touches numeric measurements.
 *
 * Providers implemented here:
 *   - 'manual'   : the customer typed measurements (gaps filled from height).
 *   - 'estimate' : only height (+ maybe bust/hip) given; the rest is estimated.
 *   - 'scan'     : DEMO simulator that mimics a mobile body-scan vendor by
 *                  deriving plausible measurements from height on-device.
 *   - 'vendor'   : stub showing exactly where a real API (3DLOOK / NetVirta)
 *                  is wired in. It throws until configured — by design.
 *
 * PRIVACY: no provider here uploads or stores a body image. The 'scan'
 * simulator runs purely on the given numbers; a real vendor integration should
 * be configured to return measurements and discard imagery per its policy.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./engine'));
  } else {
    root.AbayaProviders = factory(root.AbayaEngine);
  }
})(typeof self !== 'undefined' ? self : this, function (Engine) {
  'use strict';

  function manual(input) {
    var r = Engine.estimateMeasurements(Object.assign({}, input, { source: 'manual' }));
    return finalize(r);
  }

  function estimate(input) {
    var r = Engine.estimateMeasurements(Object.assign({}, input, { source: 'estimate' }));
    return finalize(r);
  }

  // Deterministic pseudo-variance from a seed so the demo scan feels "measured"
  // (slightly different per person) without Math.random making tests flaky.
  function jitter(seed, spread) {
    var x = Math.sin(seed) * 10000;
    return (x - Math.floor(x) - 0.5) * 2 * spread; // in [-spread, +spread]
  }

  // Simulate a mobile body scan: front + side photos would yield a body model;
  // here we synthesise believable measurements from height and an optional
  // shape hint. Marked source:'scan' with nothing "estimated" (it's "measured").
  function scan(input) {
    input = input || {};
    var height = parseFloat(input.height);
    if (!(height > 0)) throw new Error('height is required for the scan simulator');
    var seed = height + (input.seed || 0);
    var R = Engine._internals.RATIOS;
    var measurements = {
      height: Math.round(height * 10) / 10,
      shoulder: round1(height * R.shoulderWidth + jitter(seed + 1, 1.2)),
      bust: round1(height * R.bust + jitter(seed + 2, 6)),
      hip: round1(height * R.hip + jitter(seed + 3, 6)),
      sleeve: round1(height * R.sleeve + jitter(seed + 4, 1.5))
    };
    return { measurements: attach(measurements, [], 'scan'), estimated: [], source: 'scan' };
  }

  // Real vendor integration point (3DLOOK Mobile Tailor, NetVirta, etc.).
  // Wire the vendor SDK/API here; it must resolve to the same measurement shape.
  function vendor() {
    throw new Error(
      'vendor provider not configured — plug a real body-measurement API ' +
        '(e.g. 3DLOOK / NetVirta) in shared/providers.js:vendor()'
    );
  }

  function finalize(r) {
    return {
      measurements: attach(r.measurements, r.estimated, r.source),
      estimated: r.estimated,
      source: r.source
    };
  }

  // Stamp provenance onto the measurements object the engine will read.
  function attach(m, estimated, source) {
    m._estimated = estimated || [];
    m._source = source || 'manual';
    return m;
  }

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  var providers = { manual: manual, estimate: estimate, scan: scan, vendor: vendor };

  function get(name) {
    var p = providers[name];
    if (!p) throw new Error('unknown measurement provider: ' + name);
    return p;
  }

  return { get: get, providers: providers };
});
