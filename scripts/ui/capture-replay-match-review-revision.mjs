import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const outputDir = path.resolve('.claude/research/ui/mockups/2026-08-04-review-revision');
const baseURL = process.env.MOCK_BASE_URL ?? 'http://127.0.0.1:5217';
const replay = pathToFileURL(path.join(outputDir, 'replay-revised.html')).href;
const match = pathToFileURL(path.join(outputDir, 'match-revised.html')).href;
const jobs = [
  ['replay-mobile-851x393-design-mock.png', replay, { width: 851, height: 393 }],
  ['match-mobile-851x393-resolution-design-mock.png', `${match}?state=resolution`, { width: 851, height: 393 }],
  ['match-mobile-851x393-target-selection-design-mock.png', `${match}?state=target`, { width: 851, height: 393 }],
];
const browserErrors = [];

function watchBrowserErrors(page, label) {
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`${label}: console: ${message.text()}`);
  });
  page.on('pageerror', (error) => browserErrors.push(`${label}: pageerror: ${error.message}`));
}

function dimensions(buffer) {
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('PNG signature missing');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  watchBrowserErrors(page, 'match-desktop');
  await page.goto(`${baseURL}/#setup`, { waitUntil: 'domcontentloaded' });
  const ready = page.locator('.meta-btn-ready').first();
  if (await ready.count()) await ready.click();
  else throw new Error('MATCH setup ready button missing');
  const skip = page.locator('button.mulligan-skip');
  await skip.waitFor({ state: 'visible', timeout: 10_000 });
  await skip.click();
  await skip.waitFor({ state: 'hidden', timeout: 10_000 });
  await page.locator('#scaler').waitFor({ state: 'visible', timeout: 10_000 });
  await page.addStyleTag({ content: '.effect-stack-panel { display: none !important; }' });
  const effectStack = page.locator('.effect-stack-panel');
  if (await effectStack.count() && await effectStack.first().isVisible()) throw new Error('effect-stack panel remained visible after temporary capture CSS');
  await page.screenshot({ path: path.join(outputDir, 'match-desktop-1440x900-design-mock.png'), animations: 'disabled' });
  await page.close();
  for (const [filename, url, viewport] of jobs) {
    const page = await browser.newPage({ viewport });
    watchBrowserErrors(page, filename);
    await page.goto(url, { waitUntil: 'load' });
    await page.screenshot({ path: path.join(outputDir, filename), animations: 'disabled' });
    await page.close();
  }
} finally {
  await browser.close();
}

if (browserErrors.length > 0) {
  throw new Error(`Browser errors detected:\n${browserErrors.join('\n')}`);
}

for (const [filename, expected] of [['match-desktop-1440x900-design-mock.png', { width: 1440, height: 900 }], ...jobs.map(([filename, , viewport]) => [filename, viewport])]) {
  const buffer = await readFile(path.join(outputDir, filename));
  const actual = dimensions(buffer);
  if (actual.width !== expected.width || actual.height !== expected.height) throw new Error(`${filename}: expected ${expected.width}x${expected.height}, got ${actual.width}x${actual.height}`);
  if (new Set(buffer.subarray(32)).size < 2) throw new Error(`${filename}: unexpectedly blank`);
}
console.log(`PASS: ${jobs.length + 1} exact-dimension, nonblank review-revision PNGs`);
