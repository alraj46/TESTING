#!/usr/bin/env node
'use strict';

/*
 * Build a single-file, no-server demo (standalone.html) by inlining the CSS and
 * the isomorphic engine/providers/catalog/widget into the product page. This is
 * the "just open it in a browser" version — same engine, zero backend.
 */

var fs = require('fs');
var path = require('path');

var root = path.join(__dirname, '..');
function read(p) { return fs.readFileSync(path.join(root, p), 'utf8'); }

var html = read('public/index.html');
var css = read('public/styles.css');
var scripts = [
  read('shared/engine.js'),
  read('shared/providers.js'),
  read('shared/sample-catalog.js'),
  read('public/widget.js')
].join('\n\n');

// Inline stylesheet.
html = html.replace(
  /<link rel="stylesheet" href="\/styles\.css" \/>/,
  '<style>\n' + css + '\n</style>'
);

// Neutralise server-only nav links in the standalone build.
html = html
  .replace('<a href="/merchant.html">لوحة التاجر</a>', '')
  .replace(
    '<a href="/README">التوثيق</a>',
    '<a href="https://github.com/alraj46/testing/tree/main/abaya-size-engine">التوثيق</a>'
  );

// Replace the four external <script src> tags with one inline bundle.
html = html.replace(
  /\s*<script src="\/shared\/engine\.js"><\/script>[\s\S]*?<script src="\/widget\.js"><\/script>/,
  '\n    <script>\n' + scripts + '\n    </script>'
);

var out = path.join(root, 'standalone.html');
fs.writeFileSync(out, html, 'utf8');
// eslint-disable-next-line no-console
console.log('Wrote ' + path.relative(root, out) + ' (' + Math.round(html.length / 1024) + ' KB)');
