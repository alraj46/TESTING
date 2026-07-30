'use strict';

var path = require('path');
var express = require('express');

var app = express();
app.use(express.json({ limit: '256kb' }));

// Permissive CORS so the widget can be embedded on any storefront
// (Shopify / Salla / Zid). Lock this down to known origins in production.
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use('/api/abayas', require('./routes/catalog'));
app.use('/api/recommend', require('./routes/recommend'));

app.get('/api/health', function (req, res) {
  res.json({ ok: true, service: 'abaya-size-engine' });
});

// Serve the project docs (linked from the demo nav).
app.get('/README', function (req, res) {
  res.type('text/plain; charset=utf-8').sendFile(path.join(__dirname, '..', 'README.md'));
});

// Static demo UI (customer widget + merchant catalog).
app.use(express.static(path.join(__dirname, '..', 'public')));
// Expose the shared engine/providers to the browser demo without a bundler.
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));

var PORT = process.env.PORT || 4100;
if (require.main === module) {
  app.listen(PORT, function () {
    // eslint-disable-next-line no-console
    console.log('Abaya Size Engine running on http://localhost:' + PORT);
  });
}

module.exports = app;
