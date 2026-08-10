import { chromium, type Browser, type Page, type ViewportSize } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { SAMPLE_DECK, SAMPLE_DECK_OPP } from '../../meta-app/src/data/sampleDeck';

const port = Number(process.env.HISTORY_DECK_CAPTURE_PORT ?? 5332);
const baseURL = `http://127.0.0.1:${port}`;
const outputDir = path.resolve('.claude/research/ui/runtime-captures/2026-08-04-history-decks');
const deckSnapshot = (deck: typeof SAMPLE_DECK) => ({
  schemaVersion: 1,
  deckId: deck.id,
  name: deck.name,
  partner: deck.partner,
  case: deck.case,
  cards: deck.cards.map(({ num, count }) => ({ num, count })),
});
const fixture = [{
  id: 'history-deck-capture',
  recorded: Date.UTC(2026, 7, 4, 4, 20),
  won: true,
  deckName: SAMPLE_DECK.name,
  oppDeckName: SAMPLE_DECK_OPP.name,
  mode: 'solo',
  turns: 12,
  duration: 720,
  evidGot: 7,
  evidLost: 4,
  contacts: 2,
  hirameki: 1,
  misread: 0,
  p1Target: 7,
  p2Target: 7,
  selfDeckSnapshot: deckSnapshot(SAMPLE_DECK),
  oppDeckSnapshot: deckSnapshot(SAMPLE_DECK_OPP),
}];

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(baseURL)).ok) return;
    } catch {
      // The isolated Vite process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`history deck capture server did not start: ${baseURL}`);
}

async function waitForDeckImages(page: Page): Promise<void> {
  await page.waitForFunction(`(() => {
    const images = Array.from(document.querySelectorAll('.history-deck-dialog img'));
    return images.length > 0 && images.every((image) => image.complete && image.naturalWidth > 0);
  })()`);
  await page.waitForTimeout(300);
}

async function openViewer(browser: Browser, viewport: ViewportSize): Promise<Page> {
  const page = await browser.newPage({ viewport });
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript((history) => {
    localStorage.setItem('conan.meta.v1.history', JSON.stringify({ state: { history }, version: 1 }));
  }, fixture);
  await page.goto(`${baseURL}/#history`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /対戦デッキを見る/ }).click();
  await page.getByRole('dialog', { name: '対戦デッキ' }).waitFor();
  await waitForDeckImages(page);
  if (errors.length) throw new Error(`browser errors: ${errors.join(' | ')}`);
  return page;
}

await mkdir(outputDir, { recursive: true });
const server = spawn(process.execPath, [
  'node_modules/vite/bin/vite.js',
  '--config', 'meta-app/vite.config.meta.ts',
  '--host', '127.0.0.1',
  '--port', String(port),
  '--strictPort',
], { stdio: 'ignore', windowsHide: true });

let browser: Browser | undefined;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const desktop = await openViewer(browser, { width: 1440, height: 900 });
  await desktop.screenshot({ path: path.join(outputDir, 'history-decks-desktop-1440x900.png'), animations: 'disabled' });
  await desktop.close();

  const mobile = await openViewer(browser, { width: 851, height: 393 });
  await mobile.screenshot({ path: path.join(outputDir, 'history-decks-mobile-player-851x393.png'), animations: 'disabled' });
  await mobile.getByRole('tab', { name: /CPUのデッキ/ }).click();
  await waitForDeckImages(mobile);
  await mobile.screenshot({ path: path.join(outputDir, 'history-decks-mobile-cpu-851x393.png'), animations: 'disabled' });
  await mobile.close();
  console.log(outputDir);
} finally {
  await browser?.close();
  server.kill();
}
