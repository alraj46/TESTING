'use strict';
// Browser smoke test: drive the served widget and the standalone file end-to-end.
var { chromium } = require('playwright-core');
var path = require('path');
var app = require('../server/index');

function findChromium() {
  var base = '/opt/pw-browsers';
  var fs = require('fs');
  var dirs = fs.readdirSync(base).filter(function (d) { return d.indexOf('chromium-') === 0; });
  dirs.sort();
  return path.join(base, dirs[dirs.length - 1], 'chrome-linux', 'chrome');
}

(async function () {
  var server = app.listen(4321);
  var browser = await chromium.launch({ executablePath: findChromium() });
  var fails = 0;
  function check(cond, msg) { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fails++; }

  async function runFlow(page, label) {
    console.log('\n• ' + label);
    // open widget
    await page.click('#open-widget');
    await page.waitForSelector('.mode-tabs');
    check(await page.isVisible('.mode-tabs'), 'widget opens with mode tabs');
    // manual mode
    await page.click('.mode-tabs button[data-mode="manual"]');
    await page.fill('#f-height', '163');
    await page.fill('#f-bust', '88');
    await page.fill('#f-hip', '98');
    await page.click('#next-btn');
    await page.waitForSelector('#hem');
    check(await page.isVisible('#hem'), 'advances to preferences');
    await page.click('.chip[data-group="hem"][data-value="floor"]');
    await page.click('.chip[data-group="fit"][data-value="regular"]');
    await page.click('#show-btn');
    await page.waitForSelector('.result-hero .size', { timeout: 5000 });
    var size = (await page.textContent('.result-hero .size')).trim();
    var conf = (await page.textContent('.confidence .lbl b')).trim();
    check(/^[0-9]{2}$/.test(size), 'shows a length size: ' + size);
    check(/%$/.test(conf), 'shows confidence: ' + conf);
    check(await page.isVisible('.alts'), 'shows alternatives');
    // reset for next run
    await page.click('#close-widget').catch(function () {});
  }

  // 1) served app
  var page = await browser.newPage();
  var errs = [];
  page.on('pageerror', function (e) { errs.push(e.message); });
  await page.goto('http://localhost:4321/');
  await runFlow(page, 'served widget (http://localhost:4321)');

  // 2) scan simulator path
  console.log('\n• scan simulator');
  await page.click('#open-widget');
  await page.waitForSelector('.mode-tabs');
  await page.click('.mode-tabs button[data-mode="scan"]');
  await page.fill('#f-height', '170');
  await page.click('#scan-btn');
  await page.waitForSelector('#hem', { timeout: 8000 });
  check(await page.isVisible('#hem'), 'scan simulator completes and advances');
  await page.click('.chip[data-group="fit"][data-value="oversized"]');
  await page.click('#show-btn');
  await page.waitForSelector('.result-hero .size', { timeout: 5000 });
  check((await page.textContent('.note')).indexOf('لم تُحفظ') !== -1, 'scan result states no image stored');
  await page.click('#close-widget');

  // 3) standalone file
  var page2 = await browser.newPage();
  page2.on('pageerror', function (e) { errs.push('standalone: ' + e.message); });
  await page2.goto('file://' + path.join(__dirname, '..', 'standalone.html'));
  await runFlow(page2, 'standalone.html (file://)');

  check(errs.length === 0, 'no uncaught page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));

  await browser.close();
  server.close();
  console.log('\n' + (fails ? fails + ' checks FAILED' : 'all smoke checks passed'));
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
