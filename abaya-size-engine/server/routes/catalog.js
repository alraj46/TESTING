'use strict';

var express = require('express');
var router = express.Router();
var catalog = require('../catalog');

// GET /api/abayas — list all abayas
router.get('/', function (req, res) {
  res.json({ abayas: catalog.list() });
});

// GET /api/abayas/:id — one abaya
router.get('/:id', function (req, res) {
  var a = catalog.get(req.params.id);
  if (!a) return res.status(404).json({ error: 'abaya not found' });
  res.json({ abaya: a });
});

// POST /api/abayas — create (merchant)
router.post('/', function (req, res) {
  var r = catalog.create(req.body || {});
  if (r.errors) return res.status(400).json({ errors: r.errors });
  res.status(201).json({ abaya: r.item });
});

// PUT /api/abayas/:id — update (merchant)
router.put('/:id', function (req, res) {
  var r = catalog.update(req.params.id, req.body || {});
  if (r.notFound) return res.status(404).json({ error: 'abaya not found' });
  if (r.errors) return res.status(400).json({ errors: r.errors });
  res.json({ abaya: r.item });
});

// DELETE /api/abayas/:id — remove (merchant)
router.delete('/:id', function (req, res) {
  var ok = catalog.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'abaya not found' });
  res.status(204).end();
});

module.exports = router;
