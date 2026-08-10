import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const outputDir = path.resolve('.claude/research/ui/mockups/2026-08-04-review-revision');
const filename = 'match-mobile-851x393-actions-v5-design-mock.png';
const source = pathToFileURL(path.join(outputDir, 'match-mobile-v5.html')).href;
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 851, height: 393 } });
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(source, { waitUntil: 'load' });
  const overflow = await page.evaluate(() => [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight]);
  if (overflow.some((value) => value > 0)) throw new Error(`viewport overflow: ${overflow.join('x')}`);
  const labels = await page.locator('.action strong').allTextContents();
  if (labels[0] !== '手札を確認' || labels.includes('アクション')) throw new Error(`ACTIONS labels invalid: ${labels.join(',')}`);
  if ((await page.locator('.phase-label').textContent()) !== 'フェイズ') throw new Error('phase heading missing');
  const phaseHeights = await page.locator('.phase span').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
  if (phaseHeights.some((height) => height < 44)) throw new Error(`phase hit area invalid: ${phaseHeights.join(',')}`);
  const phase = await page.locator('.phase').boundingBox();
  const endTurn = await page.locator('.end-turn').boundingBox();
  if (!phase || !endTurn || endTurn.y - (phase.y + phase.height) < 12) throw new Error(`turn-end gap invalid: phase=${JSON.stringify(phase)} end=${JSON.stringify(endTurn)}`);
  if (endTurn.y + endTurn.height > 393) throw new Error(`turn end cut off: ${JSON.stringify(endTurn)}`);
  const backgroundSize = await page.locator('.playmat').evaluate((node) => getComputedStyle(node, '::before').backgroundSize);
  if (backgroundSize !== '763px 393px') throw new Error(`playmat no longer height-fit: ${backgroundSize}`);
  await page.screenshot({ path: path.join(outputDir, filename), animations: 'disabled' });
  await page.close();
} finally { await browser.close(); }
if (errors.length) throw new Error(`browser errors: ${errors.join('; ')}`);
const buffer = await readFile(path.join(outputDir, filename));
if (buffer.readUInt32BE(16) !== 851 || buffer.readUInt32BE(20) !== 393) throw new Error('dimension mismatch');
console.log(`PASS: ${filename} 851x393`);
