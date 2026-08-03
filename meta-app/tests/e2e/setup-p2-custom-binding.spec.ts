import { expect, test, type Page } from '@playwright/test';

const D08_CARDS: Array<{ num: string; count: number }> = [
  { num: 'D08003', count: 1 }, { num: 'D08004', count: 2 }, { num: 'D08005', count: 1 },
  { num: 'D08006', count: 2 }, { num: 'D08007', count: 1 }, { num: 'D08008', count: 2 },
  { num: 'D08009', count: 1 }, { num: 'D08010', count: 2 }, { num: 'D08011', count: 1 },
  { num: 'D08012', count: 2 }, { num: 'D08013', count: 1 }, { num: 'D08014', count: 2 },
  { num: 'D08015', count: 1 }, { num: 'D08016', count: 2 }, { num: 'D08017', count: 1 },
  { num: 'D08018', count: 2 }, { num: 'D08019', count: 1 }, { num: 'D08020', count: 2 },
  { num: 'D08021', count: 2 }, { num: 'D08022', count: 3 }, { num: 'D08023', count: 2 },
  { num: 'D08024', count: 3 }, { num: 'D08025', count: 3 },
];

// Keep the shipped legal D08 recipe shape, but replace one unique print so
// the main-deck multiset itself detects a P1/P2 reversal.
const CUSTOM_CARDS: Array<{ num: string; count: number }> = [
  { num: 'D02007', count: 1 },
  ...D08_CARDS.filter(({ num }) => num !== 'D08003'),
];

const D11_CARDS: Array<{ num: string; count: number }> = [
  { num: 'D11003', count: 1 }, { num: 'D11004', count: 2 }, { num: 'D11005', count: 1 },
  { num: 'D11006', count: 2 }, { num: 'D11007', count: 1 }, { num: 'D11008', count: 2 },
  { num: 'D11009', count: 1 }, { num: 'D11010', count: 2 }, { num: 'D11011', count: 3 },
  { num: 'D11012', count: 3 }, { num: 'D11013', count: 3 }, { num: 'D11014', count: 3 },
  { num: 'D11015', count: 3 }, { num: 'D11016', count: 3 }, { num: 'D11017', count: 3 },
  { num: 'D11018', count: 3 }, { num: 'D11019', count: 2 }, { num: 'D11020', count: 2 },
];

function expanded(cards: Array<{ num: string; count: number }>): string[] {
  return cards.flatMap(({ num, count }) => Array.from({ length: count }, () => num)).sort();
}

type BindingSnapshot = {
  self: { partner: string; caseId: string; cards: string[] };
  opp: { partner: string; caseId: string; cards: string[] };
};

type PlayerProbe = {
  partner: { cardId: string };
  case: { cardId: string };
  deck: string[];
  hand: string[];
  file: Array<{ cardId: string }>;
  evidence: Array<{ cardId: string }>;
  remove: string[];
  scene: Array<{ cardId: string }>;
};

async function installDecks(page: Page): Promise<void> {
  await page.addInitScript(({ d08, d11Cards, custom }) => {
    const d11 = {
      id: 'sample-d11', name: '警察・標準', partner: 'D11001', case: 'D11021', modified: 1,
      cards: d11Cards,
    };
    localStorage.setItem('conan.meta.v1.decks', JSON.stringify({
      version: 3,
      state: {
        decks: [
          { id: 'sample-d08', name: '少年探偵団・標準', partner: 'D08001', case: 'D08026', modified: 1, cards: d08 },
          d11,
          { id: 'custom-p2', name: 'TEST-P2-専用', partner: 'PR220', case: 'B06043', modified: 1, cards: custom },
        ],
        _hasHydrated: true,
      },
    }));
  }, { d08: D08_CARDS, d11Cards: D11_CARDS, custom: CUSTOM_CARDS });
}

async function startAndRead(page: Page): Promise<BindingSnapshot> {
  await page.getByRole('button', { name: 'あなた', exact: true }).click();
  await page.locator('.meta-btn-ready').click();
  await page.waitForURL(/#match/);
  await page.locator('button.mulligan-skip').click();
  await expect(page.locator('button.mulligan-skip')).not.toBeVisible({ timeout: 10_000 });
  const readBindings = () => page.evaluate(async () => {
    const storeUrl = performance.getEntriesByType('resource')
      .map((entry) => entry.name)
      .find((name) => name.includes('/src/ui/state/store.ts'));
    if (!storeUrl) return null;
    const { useGameStateStore } = await import(/* @vite-ignore */ storeUrl) as {
      useGameStateStore: { getState: () => { gameState: { players: Record<'self' | 'opp', PlayerProbe> } | null } };
    };
    const gs = useGameStateStore.getState().gameState;
    if (gs === null) return null;
    const read = (p: 'self' | 'opp') => {
      const ps = gs.players[p];
      return {
        partner: ps.partner.cardId,
        caseId: ps.case.cardId,
        cards: [
          ...ps.deck,
          ...ps.hand,
          ...ps.file.map((c) => c.cardId),
          ...ps.evidence.map((c) => c.cardId),
          ...ps.remove,
          ...ps.scene.map((c) => c.cardId),
        ].sort(),
      };
    };
    return { self: read('self'), opp: read('opp') };
  });
  await expect.poll(readBindings, { timeout: 10_000 }).not.toBeNull();
  const result = await readBindings();
  if (result === null) throw new Error('game state disappeared after setup');
  return result;
}

async function chooseDeck(page: Page, side: 'あなた' | 'CPU', deckName: string): Promise<void> {
  await page.getByRole('button', { name: `使用デッキを変更（${side}）` }).click();
  const dialog = page.getByRole('dialog', { name: '使用デッキを選択' });
  await dialog.locator('.home-deck-choice').filter({ hasText: deckName }).click();
  await dialog.getByRole('button', { name: 'このデッキを使用' }).click();
}

test('BUG-215: P2 custom selection binds to CPU and remains correct after reverse-order new session', async ({ page }) => {
  await installDecks(page);
  await page.goto('/#setup');
  await expect(page.getByRole('heading', { name: 'ゲームセッティング' })).toBeVisible();

  await chooseDeck(page, 'あなた', '少年探偵団・標準');
  await chooseDeck(page, 'CPU', 'TEST-P2-専用');
  const first = await startAndRead(page);
  expect(first.self).toEqual({ partner: 'D08001', caseId: 'D08026', cards: expanded(D08_CARDS) });
  expect(first.opp).toEqual({ partner: 'PR220', caseId: 'B06043', cards: expanded(CUSTOM_CARDS) });

  // Stay in the same SPA. Hash navigation closes the old match session and
  // exercises the reverse binding without a reload masking stale state.
  await page.evaluate(() => { location.hash = '#setup'; });
  await page.waitForURL(/#setup/);
  await expect(page.getByRole('heading', { name: 'ゲームセッティング' })).toBeVisible();
  await chooseDeck(page, 'あなた', 'TEST-P2-専用');
  await chooseDeck(page, 'CPU', '少年探偵団・標準');
  const second = await startAndRead(page);
  expect(second.self).toEqual({ partner: 'PR220', caseId: 'B06043', cards: expanded(CUSTOM_CARDS) });
  expect(second.opp).toEqual({ partner: 'D08001', caseId: 'D08026', cards: expanded(D08_CARDS) });
});
