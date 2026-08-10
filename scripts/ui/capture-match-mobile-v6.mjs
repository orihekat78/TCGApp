import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const outputDir = path.resolve('.claude/research/ui/mockups/2026-08-04-review-revision');
const baseURL = process.env.MOCK_BASE_URL ?? 'http://127.0.0.1:5217';
const desktopViewport = { width: 1702, height: 786 };
const mobileViewport = { width: 851, height: 393 };
const desktopFilename = 'match-desktop-1702x786-runtime-reference-v6.png';
const mobileFilename = 'match-mobile-851x393-desktop-canvas-v6-design-mock.png';
const mobileSource = pathToFileURL(path.join(outputDir, 'match-mobile-v6.html')).href;
const errors = [];

function pngDimensions(buffer) {
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('PNG signature missing');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function watchErrors(page, label) {
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${label}: console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`${label}: pageerror: ${error.message}`));
}

const browser = await chromium.launch({ headless: true });
try {
  const desktop = await browser.newPage({ viewport: desktopViewport });
  watchErrors(desktop, 'desktop-runtime');
  await desktop.goto(`${baseURL}/#setup`, { waitUntil: 'domcontentloaded' });
  const ready = desktop.locator('.meta-btn-ready').first();
  if (!await ready.count()) throw new Error('MATCH setup ready button missing');
  await ready.click();
  const skip = desktop.locator('button.mulligan-skip');
  await skip.waitFor({ state: 'visible', timeout: 10_000 });
  await skip.click();
  await skip.waitFor({ state: 'hidden', timeout: 10_000 });
  await desktop.locator('#scaler').waitFor({ state: 'visible', timeout: 10_000 });
  await desktop.addStyleTag({ content: '.effect-stack-panel { display: none !important; }' });
  const actions = desktop.locator('.actions-panel').first();
  await actions.waitFor({ state: 'visible', timeout: 10_000 });
  const [scaler, actionsBox] = await Promise.all([
    desktop.locator('#scaler').boundingBox(),
    actions.boundingBox(),
  ]);
  if (!scaler || !actionsBox || actionsBox.x <= scaler.x || actionsBox.x + actionsBox.width > desktopViewport.width) {
    throw new Error(`desktop canvas/action panel geometry invalid: scaler=${JSON.stringify(scaler)} actions=${JSON.stringify(actionsBox)}`);
  }
  await desktop.screenshot({ path: path.join(outputDir, desktopFilename), animations: 'disabled' });
  await desktop.close();

  const mobile = await browser.newPage({ viewport: mobileViewport });
  watchErrors(mobile, 'mobile-scale');
  await mobile.goto(mobileSource, { waitUntil: 'load' });
  await mobile.locator('.desktop-reference').waitFor({ state: 'visible' });
  const proof = await mobile.evaluate(() => {
    const canvas = document.querySelector('.desktop-canvas');
    const image = document.querySelector('.desktop-reference');
    if (!(canvas instanceof HTMLElement) || !(image instanceof HTMLImageElement)) return null;
    const rect = image.getBoundingClientRect();
    return {
      sourceImages: document.images.length,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      renderedX: rect.x,
      renderedY: rect.y,
      renderedWidth: rect.width,
      renderedHeight: rect.height,
      transform: getComputedStyle(canvas).transform,
      overflowX: document.documentElement.scrollWidth - innerWidth,
      overflowY: document.documentElement.scrollHeight - innerHeight,
    };
  });
  const expected = { sourceImages: 1, naturalWidth: 1702, naturalHeight: 786, renderedX: 0, renderedY: 0, renderedWidth: 851, renderedHeight: 393 };
  if (!proof || Object.entries(expected).some(([key, value]) => proof[key] !== value) || proof.transform !== 'matrix(0.5, 0, 0, 0.5, 0, 0)' || proof.overflowX !== 0 || proof.overflowY !== 0) {
    throw new Error(`mobile single-canvas proof invalid: ${JSON.stringify(proof)}`);
  }
  await mobile.screenshot({ path: path.join(outputDir, mobileFilename), animations: 'disabled' });
  await mobile.close();
} finally {
  await browser.close();
}

if (errors.length) throw new Error(`browser errors: ${errors.join('; ')}`);
for (const [filename, expected] of [[desktopFilename, desktopViewport], [mobileFilename, mobileViewport]]) {
  const actual = pngDimensions(await readFile(path.join(outputDir, filename)));
  if (actual.width !== expected.width || actual.height !== expected.height) {
    throw new Error(`${filename}: expected ${expected.width}x${expected.height}, got ${actual.width}x${actual.height}`);
  }
}
console.log(`PASS: ${mobileFilename}; one 1702x786 desktop canvas at a uniform 0.5 scale`);
