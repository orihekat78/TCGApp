import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const outputDir = path.resolve('.claude/research/ui/mockups/2026-08-04-review-revision');
const source = (name) => pathToFileURL(path.join(outputDir, name)).href;
const jobs = [
  {
    filename: 'history-deck-entry-v3-desktop-1440x900-design-mock.png',
    url: source('history-deck-entry-v3.html'),
    viewport: { width: 1440, height: 900 },
    verify: async (page) => {
      const frame = await page.locator('.history-frame').boundingBox();
      if (!frame || frame.width < 1170 || frame.height > 390) throw new Error(`HISTORY desktop frame geometry invalid: ${JSON.stringify(frame)}`);
    },
  },
  {
    filename: 'history-deck-entry-v3-mobile-851x393-design-mock.png',
    url: source('history-deck-entry-v3.html'),
    viewport: { width: 851, height: 393 },
    verify: async (page) => {
      const frame = await page.locator('.history-frame').boundingBox();
      if (!frame || frame.x !== 8 || frame.width !== 835 || frame.y + frame.height > 385) throw new Error(`HISTORY mobile frame geometry invalid: ${JSON.stringify(frame)}`);
    },
  },
  {
    filename: 'match-mobile-851x393-expanded-resolution-design-mock.png',
    url: `${source('match-revised.html')}?state=resolution`,
    viewport: { width: 851, height: 393 },
    verify: async (page) => {
      const board = await page.locator('.board').boundingBox();
      const actions = await page.locator('.actions').boundingBox();
      if (!board || board.x !== 0 || board.width !== 699 || board.height !== 393) throw new Error(`MATCH board geometry invalid: ${JSON.stringify(board)}`);
      if (!actions || actions.x !== 699 || actions.width !== 152 || actions.height !== 393) throw new Error(`MATCH ACTIONS geometry invalid: ${JSON.stringify(actions)}`);
    },
  },
  {
    filename: 'match-mobile-851x393-expanded-target-design-mock.png',
    url: `${source('match-revised.html')}?state=target`,
    viewport: { width: 851, height: 393 },
    verify: async (page) => {
      if (!(await page.locator('.stage').evaluate((node) => node.classList.contains('target')))) throw new Error('MATCH target state missing');
      const candidate = await page.locator('.candidate').boundingBox();
      if (!candidate || candidate.width < 44 || candidate.height < 44) throw new Error(`MATCH candidate target too small: ${JSON.stringify(candidate)}`);
    },
  },
  {
    filename: 'replay-mobile-851x393-headerless-design-mock.png',
    url: source('replay-revised.html'),
    viewport: { width: 851, height: 393 },
    verify: async (page) => {
      const board = await page.locator('.board').boundingBox();
      const remote = await page.locator('.remote').boundingBox();
      if (!board || board.x !== 8 || board.y !== 8 || board.width !== 627 || board.height !== 377) throw new Error(`REPLAY board geometry invalid: ${JSON.stringify(board)}`);
      if (!remote || remote.x !== 643 || remote.y !== 8 || remote.width !== 200 || remote.height !== 377) throw new Error(`REPLAY remote geometry invalid: ${JSON.stringify(remote)}`);
      const buttonHeights = await page.locator('.remote-controls button').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
      if (buttonHeights.length !== 5 || buttonHeights.some((height) => height < 44)) throw new Error(`REPLAY controls invalid: ${buttonHeights.join(',')}`);
    },
  },
  {
    filename: 'replay-mobile-851x393-playing-state-design-mock.png',
    url: `${source('replay-revised.html')}?state=playing`,
    viewport: { width: 851, height: 393 },
    verify: async (page) => {
      if ((await page.locator('#replay-status').textContent()) !== '再生中') throw new Error('REPLAY playing status missing');
      if ((await page.locator('#play-control').textContent()) !== '一時停止') throw new Error('REPLAY pause action missing');
    },
  },
  {
    filename: 'replay-mobile-851x393-speed-menu-design-mock.png',
    url: `${source('replay-revised.html')}?state=speed`,
    viewport: { width: 851, height: 393 },
    verify: async (page) => {
      const menu = await page.locator('#speed-menu').boundingBox();
      if (!menu || menu.x < 643 || menu.y < 8 || menu.x + menu.width > 843 || menu.y + menu.height > 385) throw new Error(`REPLAY speed menu invalid: ${JSON.stringify(menu)}`);
      if ((await page.locator('#speed-control').getAttribute('aria-expanded')) !== 'true') throw new Error('REPLAY speed menu state missing');
    },
  },
];
const selectedJobs = jobs.slice(0, 2);

function dimensions(buffer) {
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('PNG signature missing');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const browserErrors = [];
try {
  for (const job of selectedJobs) {
    const page = await browser.newPage({ viewport: job.viewport });
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(`${job.filename}: console: ${message.text()}`);
    });
    page.on('pageerror', (error) => browserErrors.push(`${job.filename}: pageerror: ${error.message}`));
    await page.goto(job.url, { waitUntil: 'load' });
    await page.evaluate(async () => document.fonts.ready);
    const overflow = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth - innerWidth,
      height: document.documentElement.scrollHeight - innerHeight,
    }));
    if (overflow.width > 0 || overflow.height > 0) throw new Error(`${job.filename}: viewport overflow ${JSON.stringify(overflow)}`);
    await job.verify(page);
    await page.screenshot({ path: path.join(outputDir, job.filename), animations: 'disabled' });
    await page.close();
  }
} finally {
  await browser.close();
}

if (browserErrors.length > 0) throw new Error(`Browser errors detected:\n${browserErrors.join('\n')}`);

for (const job of selectedJobs) {
  const buffer = await readFile(path.join(outputDir, job.filename));
  const actual = dimensions(buffer);
  if (actual.width !== job.viewport.width || actual.height !== job.viewport.height) {
    throw new Error(`${job.filename}: expected ${job.viewport.width}x${job.viewport.height}, got ${actual.width}x${actual.height}`);
  }
  if (new Set(buffer.subarray(32)).size < 2) throw new Error(`${job.filename}: unexpectedly blank`);
}

console.log(`PASS: ${selectedJobs.length} exact-dimension, nonblank, overflow-free HISTORY v3 PNGs`);
