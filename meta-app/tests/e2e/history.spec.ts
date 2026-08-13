import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { buildReplayLogV3, canonicalReplayJson } from '../../../src/ai/replay/state-frame';
import { appendCausal, startCausalSession } from '../../../src/engine/log/causal';
import { mutate } from '../../../src/engine/mutate';
import { createEmptyGameState } from '../../../src/engine/state-factory';
import { SAMPLE_DECK, SAMPLE_DECK_OPP } from '../../src/data/sampleDeck';
import { encodeDeck } from '../../src/util/deckCode';
import { expectReadyMetaRoute } from './landscape-test-helpers';

const OFFICIAL_CARD_IMAGE_URL =
  'https://www.takaratomy.co.jp/products/conan-cardgame/storage/card/**';
const DETERMINISTIC_CARD_IMAGE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="3"><rect width="2" height="3" fill="#123"/></svg>';

const snapshot = (deck: typeof SAMPLE_DECK) => ({
  schemaVersion: 1,
  deckId: deck.id,
  name: deck.name,
  partner: deck.partner,
  case: deck.case,
  cards: deck.cards.map(({ num, count }) => ({ num, count })),
});

const history = [
  {
    id: 'history-win', recorded: 1_722_477_600_000, won: true,
    deckName: '少年探偵団・標準', oppDeckName: '警察・標準', mode: 'solo', turns: 8,
    duration: 480, evidGot: 7, evidLost: 4, contacts: 2, hirameki: 1, misread: 0, p1Target: 7, p2Target: 7,
    selfDeckSnapshot: snapshot(SAMPLE_DECK),
    oppDeckSnapshot: snapshot(SAMPLE_DECK_OPP),
  },
  {
    id: 'history-loss', recorded: 1_722_391_200_000, won: false, deckName: '警察・標準', mode: 'solo', turns: 11,
    duration: 660, evidGot: 5, evidLost: 7, contacts: 1, hirameki: 0, misread: 2, p1Target: 7, p2Target: 7,
    selfDeckSnapshot: snapshot(SAMPLE_DECK),
  },
];

function exactReplayBundle() {
  const sessionId = 'history-public-replay-e2e';
  const artifactId = `replay-${sessionId}`;
  const initial = createEmptyGameState();
  initial.turn.number = 1;
  initial.turn.phase = 'main';
  initial.players.self.partner.cardId = SAMPLE_DECK.partner;
  initial.players.self.case.cardId = SAMPLE_DECK.case;
  initial.players.self.hand = ['D08003'];
  initial.players.opp.partner.cardId = SAMPLE_DECK_OPP.partner;
  initial.players.opp.case.cardId = SAMPLE_DECK_OPP.case;
  initial.players.opp.hand = ['D11003'];
  startCausalSession(initial, sessionId);

  const terminal = structuredClone(initial);
  appendCausal(terminal, {
    actor: 'opp',
    kind: 'draw',
    targets: [],
    outcome: { type: 'count', amount: 1, unit: 'card' },
  });
  mutate.gameResult.set(terminal, 'self', 'evidence');

  const log = buildReplayLogV3({
    artifactId,
    sessionId,
    viewerMode: 'solo-self',
    states: [initial, terminal],
  });
  const serialized = canonicalReplayJson(log);
  const digest = `sha256-${createHash('sha256').update(serialized).digest('hex')}`;
  const byteLength = new TextEncoder().encode(serialized).byteLength;
  const replayRef = {
    storageSchemaVersion: 1 as const,
    replaySchemaVersion: 3 as const,
    artifactId,
    digest,
    byteLength,
  };
  const row = {
    id: sessionId,
    sessionId,
    recorded: 2_000_000_000_000,
    won: true,
    deckName: SAMPLE_DECK.name,
    oppDeckName: SAMPLE_DECK_OPP.name,
    mode: 'solo' as const,
    turns: 1,
    duration: 15,
    evidGot: 7,
    evidLost: 0,
    contacts: 0,
    hirameki: 0,
    misread: 0,
    p1Target: 7 as const,
    p2Target: 6 as const,
    selfDeckSnapshot: snapshot(SAMPLE_DECK),
    oppDeckSnapshot: snapshot(SAMPLE_DECK_OPP),
    replayRef,
  };
  return {
    row,
    artifact: {
      storageSchemaVersion: 1 as const,
      artifactId,
      rowId: row.id,
      sessionId,
      digest,
      byteLength,
      log,
    },
  };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((records) => localStorage.setItem('conan.meta.v1.history', JSON.stringify({ state: { history: records }, version: 1 })), history);
});

test('HISTORY: table filters matches and keeps replay honestly unavailable', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#history');
  await expect(page.getByRole('img', { name: 'DETECTIVE CONAN' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'メインナビゲーション' }).getByRole('button'))
    .toHaveText(['ホーム', 'デッキ', 'カード', 'ゲーム開始', 'チュートリアル', '履歴', '設定']);
  await expect(page.getByRole('heading', { name: '対戦履歴' })).toBeVisible();
  await expect(page.getByRole('table', { name: '対戦履歴一覧' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '日時' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '結果' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '対戦相手デッキ' })).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(3);
  await page.getByRole('button', { name: '勝利' }).click();
  await expect(page.getByRole('row')).toHaveCount(2);
  await expect(page.getByRole('cell', { name: '勝利' })).toBeVisible();
  await page.getByRole('button', { name: 'すべて' }).click();
  await page.getByLabel('使用デッキで絞り込み').selectOption('警察・標準');
  await expect(page.getByRole('row')).toHaveCount(2);
  const replay = page.getByRole('row').filter({ hasText: '警察・標準' })
    .getByRole('button', { name: 'リプレイ利用不可' });
  await expect(page.locator('#history-replay-unavailable'))
    .toContainText('完全なイベント記録が保存されていないため、この対戦はリプレイできません');
  await expect(replay).toHaveAttribute('disabled', '');
  await expect(page).toHaveURL(/#history/);
  await expect(page.getByRole('row').filter({ hasText: 'デッキ内容未保存' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('HISTORY: switches immutable PLAYER and CPU decks in one full-width viewer and copies either deck code', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#history');

  const trigger = page.getByRole('button', { name: /2024.*対戦デッキを見る/ });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '対戦デッキ' });
  await expect(dialog).toBeVisible();
  const playerPanel = page.getByRole('tabpanel', { name: /PLAYERのデッキ\s*内容/ });
  const cpuPanel = page.getByRole('tabpanel', { name: /CPUのデッキ\s*内容/ });
  await expect(playerPanel).toBeVisible();
  await expect(cpuPanel).toBeHidden();
  await expect(playerPanel.getByRole('group', { name: /パートナー、江戸川コナン/ })).toBeVisible();
  await expect(dialog.getByRole('listitem', { name: /D08003.*1枚/ })).toBeVisible();
  await expect(playerPanel.getByTestId('history-deck-cost-chart')).toBeVisible();
  await expect(playerPanel.getByTestId('history-deck-type-summary')).toContainText('キャラ');
  await expect(playerPanel.getByTestId('history-deck-type-summary')).toContainText('イベント');
  const playerDeckGrid = playerPanel.getByTestId('history-deck-card-grid');
  await expect(playerDeckGrid).toBeVisible();
  await expect(playerDeckGrid).toHaveCSS('justify-content', 'start');
  expect(await playerDeckGrid.evaluate((grid) => (
    getComputedStyle(grid).gridTemplateColumns.split(' ').every((column) => column === '84px')
  ))).toBe(true);

  await dialog.getByRole('button', { name: 'PLAYERのデッキコードをコピー' }).click();
  await expect(playerPanel.locator('.history-deck-copy-status')).toHaveText('コピーしました');
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(encodeDeck(SAMPLE_DECK));

  const playerTab = dialog.getByRole('tab', { name: 'PLAYERのデッキ' });
  const cpuTab = dialog.getByRole('tab', { name: 'CPUのデッキ' });
  await expect(playerTab).toHaveAttribute('aria-selected', 'true');
  await cpuTab.click();
  await expect(cpuTab).toHaveAttribute('aria-selected', 'true');
  await expect(playerPanel).toBeHidden();
  await expect(cpuPanel).toBeVisible();
  await expect(cpuPanel.getByRole('group', { name: /パートナー、萩原千速/ })).toBeVisible();
  await expect(cpuPanel.getByRole('listitem', { name: /D11004.*2枚/ })).toBeVisible();
  await dialog.getByRole('button', { name: 'CPUのデッキコードをコピー' }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(encodeDeck(SAMPLE_DECK_OPP));

  await dialog.getByRole('button', { name: '対戦デッキを閉じる' }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  const close = page.getByRole('dialog', { name: '対戦デッキ' })
    .getByRole('button', { name: '対戦デッキを閉じる' });
  await expect(close).toBeFocused();
  await page.keyboard.press('Tab');
  const reopenedDialog = page.getByRole('dialog', { name: '対戦デッキ' });
  await expect(reopenedDialog.getByRole('tab', { name: 'PLAYERのデッキ' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(reopenedDialog.getByRole('tab', { name: 'CPUのデッキ' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(reopenedDialog.getByRole('button', { name: 'PLAYERのデッキコードをコピー' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(reopenedDialog.getByRole('button', { name: 'PLAYERのデッキコードをコピー' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '対戦デッキ' })).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(errors).toEqual([]);
});

test('HISTORY: 851x393 switches the two saved decks in the compact viewer without overflow', async ({ page }) => {
  const errors: string[] = [];
  let officialCardImageRequests = 0;
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route(OFFICIAL_CARD_IMAGE_URL, async (route) => {
    officialCardImageRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: DETERMINISTIC_CARD_IMAGE,
    });
  });
  await page.setViewportSize({ width: 851, height: 393 });
  await page.goto('/#history');
  await page.getByRole('button', { name: /2024.*対戦デッキを見る/ }).click();

  const dialog = page.getByRole('dialog', { name: '対戦デッキ' });
  const playerPanel = page.getByRole('tabpanel', { name: /PLAYERのデッキ\s*内容/ });
  const cpuPanel = page.getByRole('tabpanel', { name: /CPUのデッキ\s*内容/ });
  await expect(dialog.getByText('日時')).toBeVisible();
  await expect(playerPanel).toBeVisible();
  await expect(cpuPanel).toBeHidden();
  await expect(playerPanel.locator('.history-deck-scroll-hint')).toBeVisible();
  await expect(playerPanel.locator('.history-deck-card-id').first()).toBeVisible();
  await expect(playerPanel.locator('.history-deck-card-id').first()).toHaveCSS('font-size', '10px');
  await expect(playerPanel.getByTestId('history-deck-cost-chart').locator('strong').first()).toHaveCSS('font-size', '10px');
  await expect(playerPanel.locator('.history-deck-copy-button')).toHaveCSS('min-height', '44px');
  const playerTab = dialog.getByRole('tab', { name: 'PLAYERのデッキ' });
  const cpuTab = dialog.getByRole('tab', { name: 'CPUのデッキ' });
  await expect(cpuTab).toHaveCSS('min-height', '44px');
  await playerTab.focus();
  await page.keyboard.press('ArrowRight');
  await expect(cpuTab).toBeFocused();
  await expect(cpuTab).toHaveAttribute('aria-selected', 'true');
  await expect(cpuPanel).toBeVisible();
  await expect(playerPanel).toBeHidden();
  await expect(cpuPanel).toHaveAttribute('aria-busy', 'false');
  await expect.poll(async () => cpuPanel.locator('img').evaluateAll((images) => (
    images.length > 0 && images.every((image) => image.complete && image.naturalWidth > 0)
  ))).toBe(true);
  expect(officialCardImageRequests).toBeGreaterThan(0);
  await expect(dialog.getByText('萩原千速').first()).toBeVisible();

  const geometry = await dialog.evaluate((element) => ({
    left: element.getBoundingClientRect().left,
    right: element.getBoundingClientRect().right,
    width: element.getBoundingClientRect().width,
    scrollWidth: element.scrollWidth,
  }));
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(851);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
  expect(errors).toEqual([]);
});

test('HISTORY: 851x393 exposes the exact deck code when clipboard access is rejected', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')),
      },
    });
  });
  await page.setViewportSize({ width: 851, height: 393 });
  await page.goto('/#history');
  await page.getByRole('button', { name: /2024.*対戦デッキを見る/ }).click();
  const playerPanel = page.getByRole('tabpanel', { name: /PLAYERのデッキ\s*内容/ });
  await playerPanel.getByRole('button', { name: 'PLAYERのデッキコードをコピー' }).click();

  const fallback = playerPanel.getByRole('textbox', { name: 'PLAYERのデッキコード' });
  await expect(fallback).toBeVisible();
  await expect(fallback).toHaveValue(encodeDeck(SAMPLE_DECK));
  await expect(fallback).toHaveCSS('height', '44px');
  await expect(playerPanel).toContainText('下のコードを選択してください');
  await page.keyboard.press('Tab');
  await expect(fallback).toBeFocused();
  await expect.poll(() => fallback.evaluate((input: HTMLInputElement) => ({
    start: input.selectionStart,
    end: input.selectionEnd,
    length: input.value.length,
  }))).toEqual({ start: 0, end: encodeDeck(SAMPLE_DECK).length, length: encodeDeck(SAMPLE_DECK).length });
});

test('HISTORY: stalled card images stop blocking the saved card numbers and counts', async ({ page }) => {
  await page.addInitScript(() => {
    const originalRequestAnimationFrame = window.requestAnimationFrame.bind(window);
    let callbackCount = 0;
    window.requestAnimationFrame = (callback) => originalRequestAnimationFrame((time) => {
      callbackCount += 1;
      callback(time);
    });
    Object.defineProperty(window, '__historyDeckRafCallbackCount', {
      configurable: true,
      get: () => callbackCount,
    });
  });
  let releaseRequests = () => undefined;
  const stalled = new Promise<void>((resolve) => { releaseRequests = resolve; });
  await page.route(OFFICIAL_CARD_IMAGE_URL, async (route) => {
    await stalled;
    await route.abort();
  });

  try {
    await page.setViewportSize({ width: 851, height: 393 });
    await page.goto('/#history');
    await page.getByRole('button', { name: /2024.*対戦デッキを見る/ }).click();
    const playerPanel = page.getByRole('tabpanel', { name: /PLAYERのデッキ\s*内容/ });
    await expect(playerPanel.getByText('デッキ画像を読み込み中')).toBeVisible();
    await expect(playerPanel.getByText('一部の画像を読み込めません')).toBeVisible({ timeout: 5_000 });
    await expect(playerPanel.getByText('デッキ画像を読み込み中')).toBeHidden();
    await expect(playerPanel.getByRole('listitem', { name: /D08003.*1枚/ })).toBeVisible();
    await expect(playerPanel).toHaveAttribute('aria-busy', 'false');
    const callbacksAtRecovery = await page.evaluate(() => (
      (window as typeof window & { __historyDeckRafCallbackCount: number }).__historyDeckRafCallbackCount
    ));
    await page.waitForTimeout(500);
    const callbacksAfterIdle = await page.evaluate(() => (
      (window as typeof window & { __historyDeckRafCallbackCount: number }).__historyDeckRafCallbackCount
    ));
    expect(callbacksAfterIdle - callbacksAtRecovery).toBeLessThanOrEqual(3);
  } finally {
    releaseRequests();
  }
});

test('HISTORY: 851x393 keeps header, columns, and replay controls inside the viewport', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 851, height: 393 });
  await page.goto('/#history');
  const required = [
    page.getByRole('heading', { name: '対戦履歴' }),
    page.getByRole('columnheader', { name: '日時' }),
    page.getByRole('columnheader', { name: 'リプレイ' }),
    page.getByRole('row').filter({ hasText: '少年探偵団・標準' })
      .getByRole('button', { name: 'リプレイ利用不可' }),
  ];
  const boxes = await Promise.all(required.map(async (locator) => {
    await expect(locator).toBeVisible();
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    return box!;
  }));
  for (const box of boxes) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(851);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(393);
  }
  const contrast = await page.getByRole('columnheader', { name: '日時' }).evaluate((element) => {
    const parse = (color: string) => color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const luminance = ([red, green, blue]: number[]) => {
      const channels = [red!, green!, blue!].map((value) => {
        const normalized = value / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
    };
    const style = getComputedStyle(element);
    const foreground = luminance(parse(style.color));
    const background = luminance(parse(style.backgroundColor));
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  expect(errors).toEqual([]);
});

test('HISTORY: turn counts are clean numerals in an aligned column with the shared themed scrollbar', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  const scrollHistory = Array.from({ length: 20 }, (_, index) => ({
    ...history[0],
    id: `history-scroll-${index}`,
    recorded: history[0]!.recorded + index,
    turns: index + 1,
  }));
  await page.addInitScript((records) => {
    localStorage.setItem('conan.meta.v1.history', JSON.stringify({ state: { history: records }, version: 1 }));
  }, scrollHistory);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#history');

  const turnHeader = page.getByRole('columnheader', { name: 'ターン数' });
  const firstTurn = page.getByRole('row').filter({ hasText: '少年探偵団・標準' }).first().getByRole('cell').nth(5);
  await expect(firstTurn).toHaveText('20');
  await expect(turnHeader).toHaveCSS('text-align', 'right');

  const scroll = page.locator('.history-table-scroll');
  const scrollbar = await scroll.evaluate((element) => {
    const style = getComputedStyle(element);
    const rail = getComputedStyle(element, '::-webkit-scrollbar');
    const thumb = getComputedStyle(element, '::-webkit-scrollbar-thumb');
    return {
      color: style.scrollbarColor,
      width: style.scrollbarWidth,
      webkitWidth: rail.width,
      webkitHeight: rail.height,
      webkitThumbColor: thumb.backgroundColor,
    };
  });
  expect(scrollbar).toEqual({
    color: 'rgba(121, 212, 236, 0.55) rgba(0, 0, 0, 0)',
    width: 'thin',
    webkitWidth: '5px',
    webkitHeight: '5px',
    webkitThumbColor: 'rgba(121, 212, 236, 0.55)',
  });

  const lastDeckDetails = scroll.locator('.history-deck-open-button').last();
  await lastDeckDetails.focus();
  await expect(lastDeckDetails).toBeFocused();
  await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('HISTORY: malformed saved timestamps render a recoverable label', async ({ page }) => {
  await page.addInitScript(() => {
    const malformed = [{
      id: 'history-invalid-date', recorded: 'not-a-date', won: true,
      deckName: '少年探偵団・標準', mode: 'solo', turns: 1, duration: 0,
      evidGot: 0, evidLost: 0, contacts: 0, hirameki: 0, misread: 0,
      p1Target: 7, p2Target: 7,
    }];
    localStorage.setItem('conan.meta.v1.history', JSON.stringify({ state: { history: malformed }, version: 1 }));
  });
  await page.goto('/#history');

  await expect(page.getByRole('cell', { name: '日時不明' })).toBeVisible();
  await expect(page.getByText(/Invalid Date/i)).toHaveCount(0);
});

test('HISTORY: current-version non-array saved history reaches the empty state without an error', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('conan.meta.v1.history', JSON.stringify({
      state: { history: { stale: 'record' } },
      version: 2,
    }));
  });

  await page.goto('/#history');

  await expect(page.getByRole('heading', { name: '対戦履歴' })).toBeVisible();
  await expect(page.getByText('記録なし')).toBeVisible();
  expect(errors).toEqual([]);
});

test('HISTORY: malformed saved rows are normalized while a valid legacy row remains usable', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('conan.meta.v1.history', JSON.stringify({
      state: {
        history: [
          null,
          42,
          { id: 'broken-row', recorded: {}, won: 'yes', deckName: { unsafe: true } },
          {
            id: 'legacy-valid', recorded: 1_722_477_600_000, won: true,
            deckName: '少年探偵団・標準', mode: 'solo', turns: 8, duration: 480,
            evidGot: 7, evidLost: 4, contacts: 2, hirameki: 1, misread: 0,
            p1Target: 7, p2Target: 7,
          },
        ],
      },
      version: 1,
    }));
  });

  await page.goto('/#history');

  await expect(page.getByRole('table', { name: '対戦履歴一覧' })).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(3);
  await expect(page.getByRole('cell', { name: '不明のデッキ' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '少年探偵団・標準' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('HISTORY: opens an exact saved replay through the public route and returns focus to its row', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 851, height: 393 });
  await page.goto('/');

  const bundle = exactReplayBundle();
  await page.evaluate(async ({ row, artifact }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('conan-history-replay-v1', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('historyRows')) {
          const rows = db.createObjectStore('historyRows', { keyPath: 'id' });
          rows.createIndex('recorded', 'recorded');
        }
        if (!db.objectStoreNames.contains('replayArtifacts')) {
          db.createObjectStore('replayArtifacts', { keyPath: 'artifactId' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(['historyRows', 'replayArtifacts'], 'readwrite');
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB seed failed'));
        transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB seed aborted'));
        transaction.objectStore('historyRows').put(row);
        transaction.objectStore('replayArtifacts').put(artifact);
      });
    } finally {
      database.close();
    }
  }, bundle);

  await page.goto('/?replay-e2e=1#history');
  const replayButton = page.locator(`[data-replay-artifact-id="${bundle.artifact.artifactId}"]`);
  await expect(replayButton).toBeVisible();
  await expect(replayButton).toHaveText('リプレイを開く');
  await replayButton.click();

  await expect(page).toHaveURL(new RegExp(`#replay/${bundle.artifact.artifactId}$`));
  await expectReadyMetaRoute(page, '.replay-runtime');
  await expect(page.locator('.replay-runtime')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.replay-board')).toBeVisible();
  await expect(page.locator('.replay-control-rail')).toBeVisible();
  await expect(page.locator('.replay-screen > .home-header')).toBeVisible();
  await expect(page.locator('.replay-exit-control')).toBeVisible();
  await expect(page.locator('[data-testid="replay-hand-strip"] .hand-mini-card')).toHaveCount(1);
  await expect(page.locator('[data-testid="replay-hand-strip"]')).toContainText('江戸川コナン');
  await expect(page.locator('[data-testid="replay-hand-strip"] .replay-hand-card-back')).toHaveCount(0);
  await expect(page.locator('.replay-board')).toContainText('萩原千速');
  await expect(page.getByRole('button', { name: '再生' })).toBeFocused();
  await page.getByRole('button', { name: '1件進む' }).click();
  await expect(page.locator('.replay-control-heading strong')).toHaveText('1 / 1');
  await expect(page.locator('.replay-manual-announcement')).toContainText('リプレイ 1 / 1');

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
    { width: 851, height: 393 },
    { width: 720, height: 393 },
  ]) {
    await page.setViewportSize(viewport);
    const header = page.locator('.replay-screen > .home-header');
    await expect(header).toBeVisible();
    await expect(header.locator('.home-brand')).toBeVisible();
    const navItems = header.locator('.home-navigation button');
    await expect(navItems).toHaveCount(7);
    for (let index = 0; index < 7; index += 1) {
      await expect(navItems.nth(index)).toBeVisible();
    }

    const geometry = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      clientHeight: document.documentElement.clientHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
    expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight + 1);

    const controlHeights = await page.locator(
      '.replay-control-rail button, .replay-speed-control, .replay-speed-control select',
    ).evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
    expect(controlHeights).not.toHaveLength(0);
    expect(controlHeights.every((height) => height >= 44)).toBe(true);

    const headerBoxes = await header.locator('.home-brand, .home-navigation button').evaluateAll(
      (elements) => elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { x: box.x, right: box.right, height: box.height };
      }),
    );
    expect(headerBoxes).toHaveLength(8);
    for (const box of headerBoxes) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(viewport.width);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  }
  await page.getByRole('button', { name: 'リプレイを終了' }).click();
  await expect(page).toHaveURL(/#history$/);
  await expect(replayButton).toBeFocused();
  expect(errors).toEqual([]);
});
