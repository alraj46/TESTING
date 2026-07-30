/*
 * Sample abaya catalog.
 *
 * Each abaya carries its OWN measurements — this is what lets the engine
 * recommend per-garment instead of against a generic size chart.
 *
 * length options:  { size: 52|54|56|58|60, garmentLength }  garmentLength =
 *                  shoulder-seam-to-hem in cm (what actually decides floor reach).
 * width options:   { size: 'S'|'M'|'L', chest, hip }  = finished garment
 *                  circumference in cm (ease is garment - body).
 * fabric:          'stretch' | 'non-stretch'  (stretch adds fit tolerance).
 * cut:             'straight' | 'a-line' | 'bisht' (informational).
 * fitType:         default fit intent if the customer states no preference.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AbayaSampleCatalog = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // A standard length ladder used by several models (garmentLength in cm).
  function ladder(base) {
    return [52, 54, 56, 58, 60].map(function (s, i) {
      return { size: s, garmentLength: base + i * 5 };
    });
  }

  return [
    {
      id: 'classic-black-straight',
      name: 'عباية كلاسيك سوداء — قصّة مستقيمة',
      cut: 'straight',
      fabric: 'non-stretch',
      fitType: 'regular',
      color: '#111111',
      lengths: ladder(128), // 128,133,138,143,148
      widths: [
        { size: 'S', chest: 108, hip: 116 },
        { size: 'M', chest: 120, hip: 128 },
        { size: 'L', chest: 132, hip: 140 }
      ]
    },
    {
      id: 'aline-crepe',
      name: 'عباية كريب — قصّة A-Line',
      cut: 'a-line',
      fabric: 'non-stretch',
      fitType: 'regular',
      color: '#2b2b3a',
      lengths: ladder(130),
      widths: [
        { size: 'S', chest: 112, hip: 128 },
        { size: 'M', chest: 124, hip: 142 },
        { size: 'L', chest: 138, hip: 156 }
      ]
    },
    {
      id: 'bisht-formal',
      name: 'عباية بشت — رسمية واسعة',
      cut: 'bisht',
      fabric: 'non-stretch',
      fitType: 'oversized',
      color: '#1a1a1a',
      lengths: ladder(132),
      widths: [
        { size: 'S', chest: 124, hip: 132 },
        { size: 'M', chest: 138, hip: 146 },
        { size: 'L', chest: 152, hip: 160 }
      ]
    },
    {
      id: 'jersey-stretch',
      name: 'عباية جيرسيه — قماش مطّاطي',
      cut: 'straight',
      fabric: 'stretch',
      fitType: 'slim',
      color: '#22222a',
      lengths: ladder(126),
      widths: [
        { size: 'S', chest: 100, hip: 110 },
        { size: 'M', chest: 112, hip: 122 },
        { size: 'L', chest: 124, hip: 134 }
      ]
    }
  ];
});
