/*
 * AbayaEngine — the AI Abaya Size Engine.
 *
 * This is the product's core IP: it does NOT rely on a generic size chart.
 * It takes a customer's body measurements and compares them against the
 * measurements of a *specific* abaya to recommend the best length (52–60),
 * the best width (S/M/L), a comfort/fit read at chest and hips, a confidence
 * score, and length alternatives (touches the floor / with heels / shorter).
 *
 * Pure, dependency-free, and isomorphic: it runs identically on the Node
 * server and in the browser (customer widget + standalone demo), so the number
 * a customer sees is exactly the number the merchant's backend computes.
 *
 * All body/garment measurements are in centimetres unless noted.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AbayaEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Anthropometric constants used to fill in measurements the customer didn't
  // provide. Ratios are relative to standing height and are deliberately
  // conservative averages for adult women; any field derived this way is
  // flagged as "estimated" and lowers the recommendation confidence.
  // ---------------------------------------------------------------------------
  var RATIOS = {
    shoulderHeight: 0.818, // floor -> shoulder seam
    shoulderWidth: 0.232, // biacromial (shoulder) breadth
    sleeve: 0.335, // shoulder seam -> wrist
    bust: 0.53, // fallback bust circumference (weak correlation; low confidence)
    hip: 0.585 // fallback hip circumference (weak correlation; low confidence)
  };

  var HEEL_CM = 6; // assumed heel height when "with heels" is chosen
  var HEM_GAP = {
    // desired gap between hem and floor for each preference (cm).
    // negative => garment should be longer than shoulder height (puddle / heels).
    standard: 2.5,
    floor: 0,
    heels: -HEEL_CM,
    shorter: 9
  };

  var PREF_EASE = {
    // preferred garment-minus-body ease (cm) around the chest for each fit.
    // Abayas are loose garments, so even "slim" keeps generous ease.
    slim: 14,
    regular: 22,
    oversized: 34
  };

  var STRETCH_ALLOWANCE = 6; // effective body reduction (cm) for stretch fabric

  function round(n, d) {
    var f = Math.pow(10, d || 0);
    return Math.round(n * f) / f;
  }
  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  // ---------------------------------------------------------------------------
  // estimateMeasurements — normalise a raw input object into a complete
  // measurement set, filling gaps from height and reporting what was estimated.
  //
  // input: { height, shoulder?, bust?, hip?, sleeve? }  (cm)
  // returns: { measurements: {...}, estimated: [fieldNames], source }
  // ---------------------------------------------------------------------------
  function estimateMeasurements(input) {
    input = input || {};
    var estimated = [];
    var height = num(input.height);
    if (!height) {
      throw new Error('height is required to estimate measurements');
    }

    function pick(field, ratio) {
      var v = num(input[field]);
      if (v) return v;
      estimated.push(field);
      return round(height * ratio, 1);
    }

    var measurements = {
      height: round(height, 1),
      shoulder: pick('shoulder', RATIOS.shoulderWidth),
      bust: pick('bust', RATIOS.bust),
      hip: pick('hip', RATIOS.hip),
      sleeve: pick('sleeve', RATIOS.sleeve)
    };

    return {
      measurements: measurements,
      estimated: estimated,
      source: input.source || 'manual'
    };
  }

  // ---------------------------------------------------------------------------
  // Length selection — choose the abaya length option (52…60) whose garment
  // length best reaches the customer's floor given the hem preference.
  // ---------------------------------------------------------------------------
  function scoreLengths(measurements, abaya, prefs) {
    var shoulderHeight = measurements.height * RATIOS.shoulderHeight;
    var gap = HEM_GAP[prefs.hem] != null ? HEM_GAP[prefs.hem] : HEM_GAP.standard;
    // Ideal garment length so the hem sits `gap` cm off the floor.
    var ideal = shoulderHeight - gap;

    return (abaya.lengths || [])
      .map(function (opt) {
        var diff = opt.garmentLength - ideal; // + => too long (puddles), - => too short
        // Too-short is worse than slightly-long for an abaya, so weight it harder.
        var penalty = diff >= 0 ? diff : Math.abs(diff) * 1.6;
        return {
          size: opt.size,
          garmentLength: opt.garmentLength,
          diff: round(diff, 1),
          penalty: penalty
        };
      })
      .sort(function (a, b) {
        return a.penalty - b.penalty;
      });
  }

  // ---------------------------------------------------------------------------
  // Width selection — choose S/M/L by matching garment ease to the customer's
  // fit preference, accounting for stretch fabric. Ease is measured at the
  // tightest relevant point (max of chest and hip demand).
  // ---------------------------------------------------------------------------
  function scoreWidths(measurements, abaya, prefs) {
    var stretch = abaya.fabric === 'stretch' ? STRETCH_ALLOWANCE : 0;
    var bodyChest = measurements.bust - stretch;
    var bodyHip = measurements.hip - stretch;
    var target = PREF_EASE[prefs.fit] != null ? PREF_EASE[prefs.fit] : PREF_EASE.regular;

    return (abaya.widths || [])
      .map(function (opt) {
        var chestEase = opt.chest - bodyChest;
        var hipEase = opt.hip - bodyHip;
        // The garment must physically fit: negative ease anywhere is disqualifying-ish.
        var minEase = Math.min(chestEase, hipEase);
        var refEase = minEase; // fit is governed by the tightest point
        var penalty = Math.abs(refEase - target);
        if (minEase < 4) penalty += (4 - minEase) * 4; // heavy penalty for too tight
        return {
          size: opt.size,
          chestEase: round(chestEase, 1),
          hipEase: round(hipEase, 1),
          minEase: round(minEase, 1),
          penalty: penalty
        };
      })
      .sort(function (a, b) {
        return a.penalty - b.penalty;
      });
  }

  function easeToComfort(ease) {
    if (ease < 4) return { key: 'tight', label: 'ضيّق' };
    if (ease < 12) return { key: 'snug', label: 'مناسب بحدود' };
    if (ease < 26) return { key: 'comfortable', label: 'مريح' };
    if (ease < 40) return { key: 'loose', label: 'واسع قليلًا' };
    return { key: 'very_loose', label: 'واسع' };
  }

  // Confidence: starts high, penalised by measurement fit and by estimated inputs.
  function computeConfidence(bestLength, bestWidth, estimated, hasScan) {
    var score = 100;
    // Length closeness: every cm off the ideal hem costs a little.
    score -= clamp(Math.abs(bestLength.diff) * 1.1, 0, 22);
    // Width appropriateness.
    score -= clamp(bestWidth.penalty * 0.9, 0, 24);
    // Each estimated (not measured) body value reduces trust.
    // bust/hip drive fit most, so they cost more than shoulder/sleeve.
    (estimated || []).forEach(function (f) {
      if (f === 'bust' || f === 'hip') score -= 9;
      else score -= 4;
    });
    // A real scan (front+side) is more reliable than typed numbers.
    if (hasScan) score += 4;
    return clamp(Math.round(score), 40, 99);
  }

  // ---------------------------------------------------------------------------
  // recommend — the main entry point.
  //
  //   recommend(measurements, abaya, prefs?)
  //
  // measurements: { height, shoulder, bust, hip, sleeve, _estimated?, _source? }
  // abaya:        a catalog item (see catalog.js for shape)
  // prefs:        { hem: 'standard'|'floor'|'heels'|'shorter', fit: 'slim'|'regular'|'oversized' }
  //
  // returns a structured recommendation object ready to render.
  // ---------------------------------------------------------------------------
  function recommend(measurements, abaya, prefs) {
    if (!measurements || !measurements.height) {
      throw new Error('measurements.height is required');
    }
    if (!abaya || !abaya.lengths || !abaya.widths) {
      throw new Error('abaya must include lengths[] and widths[]');
    }
    prefs = prefs || {};
    prefs.hem = prefs.hem || 'standard';
    prefs.fit = prefs.fit || abaya.fitType || 'regular';

    var estimated = measurements._estimated || [];
    var hasScan = (measurements._source || '') === 'scan';

    var lengths = scoreLengths(measurements, abaya, prefs);
    var widths = scoreWidths(measurements, abaya, prefs);
    var bestLength = lengths[0];
    var bestWidth = widths[0];

    var chestComfort = easeToComfort(bestWidth.chestEase);
    var hipComfort = easeToComfort(bestWidth.hipEase);
    var confidence = computeConfidence(bestLength, bestWidth, estimated, hasScan);

    // Length alternatives for the common "what if" questions.
    var byPref = {};
    ['floor', 'heels', 'shorter'].forEach(function (hem) {
      var scored = scoreLengths(measurements, abaya, { hem: hem });
      byPref[hem] = scored[0] ? scored[0].size : bestLength.size;
    });

    return {
      abayaId: abaya.id,
      abayaName: abaya.name,
      recommended: {
        length: bestLength.size,
        width: bestWidth.size
      },
      confidence: confidence,
      fit: {
        chest: { ease: bestWidth.chestEase, comfort: chestComfort },
        hip: { ease: bestWidth.hipEase, comfort: hipComfort }
      },
      alternatives: {
        touchesFloor: byPref.floor,
        withHeels: byPref.heels,
        shorter: byPref.shorter
      },
      basis: {
        measurements: {
          height: measurements.height,
          shoulder: measurements.shoulder,
          bust: measurements.bust,
          hip: measurements.hip,
          sleeve: measurements.sleeve
        },
        estimatedFields: estimated,
        source: measurements._source || 'manual'
      },
      // full ranking for debugging / merchant analytics
      ranking: { lengths: lengths, widths: widths }
    };
  }

  function num(v) {
    if (v === null || v === undefined || v === '') return 0;
    var n = parseFloat(v);
    return isFinite(n) && n > 0 ? n : 0;
  }

  return {
    estimateMeasurements: estimateMeasurements,
    recommend: recommend,
    // exposed for testing / tuning
    _internals: {
      RATIOS: RATIOS,
      PREF_EASE: PREF_EASE,
      HEM_GAP: HEM_GAP,
      easeToComfort: easeToComfort,
      scoreLengths: scoreLengths,
      scoreWidths: scoreWidths
    }
  };
});
