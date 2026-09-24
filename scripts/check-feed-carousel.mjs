import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import assert from 'node:assert/strict';

const server = createServer(async (request, response) => {
  let file = `dist/${new URL(request.url, 'http://localhost').pathname.replace(/^\/Viziunea\/?/, '')}`;
  try {
    if ((await stat(file)).isDirectory()) file += '/index.html';
    const body = await readFile(file);
    response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream');
    response.end(body);
  } catch { response.writeHead(404); response.end('Not found'); }
});

await new Promise(resolve => server.listen(4188, resolve));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const visibleCard = () => page.locator('.feed-post:visible');
const assertOne = async () => {
  const count = await visibleCard().count();
  assert.equal(count, 1, `Expected one visible card, got ${count}`);
  return visibleCard().locator('h3').textContent();
};

try {
  await page.goto('http://localhost:4188/Viziunea/auth/');
  await page.getByRole('button', { name: 'Continuă ca Zametheea' }).click();
  await page.waitForURL('**/feed');
  await page.locator('[data-feed-next]').waitFor();
  const first = await assertOne();
  const counter = await page.locator('.feed-carousel-controls>span').textContent();
  const total = Number(counter.split('/')[1].trim());
  assert.ok(total >= 2, `Expected several posts, got ${total}`);
  assert.equal(await page.locator('[data-feed-prev]').isDisabled(), true);
  await page.locator('[data-feed-next]').click();
  await page.waitForFunction(() => document.querySelector('.feed-carousel-controls>span')?.textContent.trim().startsWith('2 /'));
  await page.waitForTimeout(320);
  const second = await assertOne();
  assert.notEqual(second, first);
  assert.equal(await page.locator('[data-feed-prev]').isDisabled(), false);
  await page.locator('[data-feed-prev]').click();
  assert.equal(await assertOne(), first);
  await page.locator('[data-feed-next]').click();
  await page.waitForTimeout(550);
  assert.equal(await assertOne(), second);
  for (let position = 2; position <= total; position++) {
    await page.locator('[data-feed-next]').click();
    await page.waitForTimeout(550);
    if (position < total) {
      assert.equal(await page.locator('.feed-carousel-controls>span').textContent(), `${position + 1} / ${total}`);
      await assertOne();
    }
  }
  assert.equal(await visibleCard().count(), 0);
  await page.locator('[data-feed-history-open]').click();
  assert.equal(await page.locator('.feed-history-item').count(), total);
  assert.ok(await page.locator('.feed-history-day').count() >= 1);
  await page.locator('.feed-history-item').first().click();
  await page.locator('.feed-post-detail-dialog').waitFor();
  await page.locator('.feed-post-detail-dialog .detail-close').click();
  await page.evaluate(() => {
    const key = 'viziunea.feed.seen.v1';
    const records = JSON.parse(localStorage.getItem(key));
    records[0].seenAt = new Date(Date.now() - 86_400_000).toISOString();
    localStorage.setItem(key, JSON.stringify(records));
  });
  await page.reload();
  await page.locator('[data-feed-history-open]').waitFor();
  await page.locator('[data-feed-history-open]').click();
  assert.equal(await page.locator('.feed-history-item').count(), total);
  assert.equal(await page.locator('.feed-history-day').count(), 2);
  await page.goto('http://localhost:4188/Viziunea/auth/');
  await page.getByRole('button', { name: 'Intră pe profilul Radu Călin' }).click();
  await page.waitForURL('**/feed');
  await page.locator('[data-feed-next]').waitFor();
  await assertOne();
  assert.equal(await page.locator('.feed-history-item').count(), 0);
  await page.locator('.feed-preferences-toggle').click();
  await page.locator('[data-feed-interest="Spații"]').click();
  await page.locator('[data-feed-next]').waitFor();
  await assertOne();
  await page.locator('[data-feed-radius]').selectOption('250');
  await page.locator('[data-feed-next]').waitFor();
  await assertOne();
  assert.deepEqual(errors, []);
  console.log(`PASS: one card at a time, back/next through ${total} posts, last card, dated history, detail, refresh, separate accounts`);
} finally {
  await browser.close();
  server.close();
}
