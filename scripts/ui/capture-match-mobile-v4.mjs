import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const outputDir = path.resolve('.claude/research/ui/mockups/2026-08-04-review-revision');
const filename = 'match-mobile-851x393-actions-v4-design-mock.png';
const viewport = { width: 851, height: 393 };
const source = pathToFileURL(path.join(outputDir, 'match-mobile-v4.html')).href;
const dimensions = (buffer) => ({ width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) });
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport });
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(source, { waitUntil: 'load' });
  const overflow = await page.evaluate(() => [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight]);
  if (overflow.some((value) => value > 0)) throw new Error(`viewport overflow: ${overflow.join('x')}`);
  const [playmat, actions, hand, endTurn] = await Promise.all([
    page.locator('.playmat').boundingBox(), page.locator('.actions').boundingBox(), page.locator('.playmat').evaluate((node) => getComputedStyle(node, '::before').backgroundSize), page.locator('.end-turn').boundingBox(),
  ]);
  if (!playmat || playmat.x !== 0 || playmat.width !== 670 || playmat.height !== 393) throw new Error(`playmat geometry invalid: ${JSON.stringify(playmat)}`);
  if (!actions || actions.x !== 670 || actions.width !== 181 || actions.height !== 393) throw new Error(`ACTIONS geometry invalid: ${JSON.stringify(actions)}`);
  if (hand !== '763px 393px') throw new Error(`playmat no longer height-fit: ${hand}`);
  if (!endTurn || endTurn.y + endTurn.height > 393) throw new Error(`turn end cut off: ${JSON.stringify(endTurn)}`);
  await page.screenshot({ path: path.join(outputDir, filename), animations: 'disabled' });
  await page.close();
} finally { await browser.close(); }
if (errors.length) throw new Error(`browser errors: ${errors.join('; ')}`);
const actual = dimensions(await readFile(path.join(outputDir, filename)));
if (actual.width !== 851 || actual.height !== 393) throw new Error(`dimension mismatch: ${actual.width}x${actual.height}`);
console.log(`PASS: ${filename} ${actual.width}x${actual.height}`);
