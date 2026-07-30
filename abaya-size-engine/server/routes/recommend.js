'use strict';

var express = require('express');
var router = express.Router();
var catalog = require('../catalog');
var Engine = require('../../shared/engine');
var Providers = require('../../shared/providers');

/*
 * POST /api/recommend
 * body: {
 *   abayaId: string,
 *   provider?: 'manual' | 'estimate' | 'scan' | 'vendor',   (default 'manual')
 *   input: { height, shoulder?, bust?, hip?, sleeve?, seed? },
 *   prefs?: { hem?: 'standard'|'floor'|'heels'|'shorter', fit?: 'slim'|'regular'|'oversized' }
 * }
 *
 * Returns the engine's recommendation. Only numeric measurements are handled
 * here — no images are ever received or stored by this endpoint.
 */
router.post('/', function (req, res) {
  var body = req.body || {};
  var abaya = catalog.get(body.abayaId);
  if (!abaya) return res.status(404).json({ error: 'abaya not found: ' + body.abayaId });

  var providerName = body.provider || 'manual';
  var provider;
  try {
    provider = Providers.get(providerName);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  var measured;
  try {
    measured = provider(body.input || {});
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  var recommendation;
  try {
    recommendation = Engine.recommend(measured.measurements, abaya, body.prefs || {});
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  res.json({ recommendation: recommendation });
});

module.exports = router;
