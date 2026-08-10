import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const port = Number(process.env.HISTORY_REVIEW_PORT ?? 5328);
const baseURL = `http://127.0.0.1:${port}`;
const outputDir = path.resolve('.claude/research/ui/mockups/2026-08-04-review-revision');
const fixture = [
  { id: 'review-win', recorded: Date.UTC(2026, 7, 3, 9, 58), won: true, deckName: '少年探偵団・事件', oppDeckName: '警察・事件', mode: 'solo', turns: 12, duration: 720, evidGot: 7, evidLost: 4, contacts: 2, hirameki: 1, misread: 0, p1Target: 7, p2Target: 6 },
  { id: 'review-loss', recorded: Date.UTC(2026, 7, 2, 9, 55), won: false, deckName: '警察・事件', oppDeckName: '黒ずくめの組織', mode: 'solo', turns: 15, duration: 900, evidGot: 5, evidLost: 7, contacts: 1, hirameki: 0, misread: 2, p1Target: 7, p2Target: 6 },
  { id: 'review-win-2', recorded: Date.UTC(2026, 7, 1, 9, 58), won: true, deckName: '少年探偵団・事件', oppDeckName: '怪盗キッド', mode: 'solo', turns: 10, duration: 600, evidGot: 7, evidLost: 3, contacts: 3, hirameki: 2, misread: 0, p1Target: 7, p2Target: 6 },
];

async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseURL);
      if (response.ok) return;
    } catch {
      // The fresh Vite process has not bound the port yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`history review server did not start: ${baseURL}`);
}

async function capture(browser, filename, viewport) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript((history) => {
    localStorage.setItem('conan.meta.v1.history', JSON.stringify({ state: { history }, version: 1 }));
  }, fixture);
  await page.goto(`${baseURL}/#history`, { waitUntil: 'networkidle' });
  await page.getByRole('table', { name: '対戦履歴一覧' }).waitFor();
  const rows = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'リプレイ利用不可' }) });
  const turns = await rows.evaluateAll((items) => items.map((row) => row.querySelectorAll('td')[5]?.textContent?.trim()));
  if (JSON.stringify(turns) !== JSON.stringify(['12', '15', '10'])) throw new Error(`unexpected turn values: ${JSON.stringify(turns)}`);
  if (errors.length) throw new Error(`browser errors: ${errors.join(' | ')}`);
  await page.screenshot({ path: path.join(outputDir, filename), animations: 'disabled' });
  await page.close();
}

await mkdir(outputDir, { recursive: true });
const server = spawn(process.execPath, [
  'node_modules/vite/bin/vite.js',
  '--config', 'meta-app/vite.config.meta.ts',
  '--host', '127.0.0.1',
  '--port', String(port),
  '--strictPort',
], { stdio: 'ignore', windowsHide: true });

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  await capture(browser, 'history-desktop-1440x900-runtime.png', { width: 1440, height: 900 });
  await capture(browser, 'history-mobile-851x393-runtime.png', { width: 851, height: 393 });
  console.log(outputDir);
} finally {
  await browser?.close();
  server.kill();
}
