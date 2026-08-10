import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const outputDir = path.resolve('.claude/research/ui/mockups/2026-08-04-review-revision');
const source = pathToFileURL(path.join(outputDir, 'match-mobile-v3.html')).href;
const filename = 'match-mobile-851x393-actions-v3-design-mock.png';
const viewport = { width: 851, height: 393 };

function dimensions(buffer) {
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('PNG signature missing');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const browser = await chromium.launch({ headless: true });
const browserErrors = [];
try {
  const page = await browser.newPage({ viewport });
  page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()); });
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await page.goto(source, { waitUntil: 'load' });
  const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth - innerWidth, height: document.documentElement.scrollHeight - innerHeight }));
  if (overflow.width > 0 || overflow.height > 0) throw new Error(`viewport overflow: ${JSON.stringify(overflow)}`);
  const board = await page.locator('.playmat').boundingBox();
  const actions = await page.locator('.actions').boundingBox();
  if (!board || board.x !== 0 || board.width !== 670 || board.height !== 393) throw new Error(`playmat geometry invalid: ${JSON.stringify(board)}`);
  if (!actions || actions.x !== 670 || actions.width !== 181 || actions.height !== 393) throw new Error(`ACTIONS geometry invalid: ${JSON.stringify(actions)}`);
  const actionHeights = await page.locator('.action').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
  if (actionHeights.some((height) => height < 39)) throw new Error(`action hit area invalid: ${actionHeights.join(',')}`);
  await page.screenshot({ path: path.join(outputDir, filename), animations: 'disabled' });
  await page.close();
} finally {
  await browser.close();
}

if (browserErrors.length) throw new Error(`browser errors: ${browserErrors.join('; ')}`);
const result = dimensions(await readFile(path.join(outputDir, filename)));
if (result.width !== viewport.width || result.height !== viewport.height) throw new Error(`dimension mismatch: ${result.width}x${result.height}`);
console.log(`PASS: ${filename} ${result.width}x${result.height}`);
