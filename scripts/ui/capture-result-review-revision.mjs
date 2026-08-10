import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const source = path.resolve('.claude/research/ui/mockups/2026-08-04-review-revision/result-revised.html');
const output = path.dirname(source);
const targets = [
  ['result-desktop-1440x900-design-mock.png', { width: 1440, height: 900 }],
  ['result-mobile-851x393-design-mock.png', { width: 851, height: 393 }],
];

function pngSize(buffer) {
  if (buffer.subarray(1, 4).toString('ascii') !== 'PNG') throw new Error('not a PNG');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const browser = await chromium.launch();
try {
  for (const [filename, viewport] of targets) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(pathToFileURL(source).href, { waitUntil: 'load' });
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth || document.documentElement.scrollHeight > window.innerHeight)) throw new Error(`overflow at ${viewport.width}x${viewport.height}`);
    const panel = await page.locator('.result-panel').boundingBox();
    const expected = viewport.width === 1440
      ? { x: 240, y: 206, width: 960, height: 560 }
      : { x: 8, y: 62, width: 835, height: 323 };
    if (!panel || Object.entries(expected).some(([key, value]) => Math.abs(panel[key] - value) > .1)) throw new Error(`wrong panel bounds at ${viewport.width}x${viewport.height}: ${JSON.stringify(panel)}`);
    await page.screenshot({ path: path.join(output, filename), animations: 'disabled' });
    if (errors.length) throw new Error(`console errors: ${errors.join(' | ')}`);
    const image = await readFile(path.join(output, filename));
    const size = pngSize(image);
    if (size.width !== viewport.width || size.height !== viewport.height) throw new Error(`wrong PNG dimensions for ${filename}: ${size.width}x${size.height}`);
    if (new Set(image.subarray(64, Math.min(image.length, 8192))).size < 4) throw new Error(`possibly blank PNG: ${filename}`);
    await page.close();
  }
  console.log('RESULT revision mocks captured and validated.');
} finally {
  await browser.close();
}
