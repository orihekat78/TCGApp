import { test, expect, type Page } from '@playwright/test';
import {
  setupGamePage,
  buildGameState,
  dispatchAction,
  expectNoConsoleErrors,
} from '../helpers';
import type { GameStateLike } from '../helpers';

// Round 4j (`4dd2cd8`) + Round 4j-fix: hiramekiDraw パターン (アクション[事件] 経由のヒラメキドロー)
// を 2 カード集約検証。共通パターン spec 5/5 完了。
//
// 共通契約:
//   - ability.type === 'icon-flash' / scope === 'on-evidence'
//   - effect = { kind:'atom', verb:'draw', args:{ player:'self', n } }
//   - listener: src/engine/listeners/hirameki.ts が `evidence:remove-by-action` hook を購読し、
//     対象 cardId の def.abilities から type:'icon-flash' を抽出 → side-channel populate
//   - UI: dispatchEngineAction が auto-drain → store.pendingHirameki にセット
//   - hiramekiResolve(fire) で ability.effect を queue + runAllUntilEmpty → draw 実行
//
// 対象カード:
//   - D08013 a2 (character / 青 Lv4 / 吉田歩美): hiramekiDraw({ n:1, abilityId:'a2' })
//   - D08024 a2 (event / 青 Lv6): hiramekiDraw({ n:1, abilityId:'a2' })
//
// 検証層 (各カード):
//   1. shape (Round 4j): ability.type / scope / effect.kind / effect.verb / args.n / args.player
//   2. fire path (Round 4j-fix): action[case] dispatch → pendingHirameki populate (player='opp')
//      → hiramekiResolve('fire') → opp.hand +1
//   3. skip path (Round 4j-fix): 同 dispatch → pendingHirameki populate → hiramekiResolve('skip')
//      → opp.hand 不変
//   + negative: 非 hirameki カード (D08015) は abilities に type:'icon-flash' を含まない
//
// BUG-034 (Round 4j-fix で修正済): engine namespace re-export パターンで vite dev mode の
// module isolation を回避、dispatch 経路で listener fire → side-channel → store 転送が機能。

type FileCardLike = { type: 'card-back'; cardId: string };

async function probeAbility(
  page: Page,
  cardId: string,
  abilityId: string,
): Promise<{
  abilityExists: boolean;
  typeIsIconFlash: boolean;
  scopeIsOnEvidence: boolean;
  effectKind: string | null;
  effectVerb: string | null;
  effectArgN: number | null;
  effectArgPlayer: string | null;
}> {
  return (await page.evaluate(
    ({ cId, aId }) => {
      const w = (window as unknown as {
        __game: { read: { def: { card: (id: string) => unknown } } };
      }).__game;
      const def = w.read.def.card(cId) as
        | undefined
        | {
            abilities: {
              id: string;
              type?: string;
              scope?: string;
              effect?: { kind?: string; verb?: string; args?: { n?: number; player?: string } };
            }[];
          };
      const nullResult = {
        abilityExists: false,
        typeIsIconFlash: false,
        scopeIsOnEvidence: false,
        effectKind: null,
        effectVerb: null,
        effectArgN: null,
        effectArgPlayer: null,
      };
      if (!def) return nullResult;
      const ability = def.abilities.find((a) => a.id === aId);
      if (!ability) return nullResult;
      return {
        abilityExists: true,
        typeIsIconFlash: ability.type === 'triggered' && ability.trigger?.hook === 'evidence:remove-by-action' && ability.trigger?.optional === true, // 2026-05-27 Option C: icon-flash → triggered + optional
        scopeIsOnEvidence: ability.scope === 'on-evidence',
        effectKind: ability.effect?.kind ?? null,
        effectVerb: ability.effect?.verb ?? null,
        effectArgN: ability.effect?.args?.n ?? null,
        effectArgPlayer: ability.effect?.args?.player ?? null,
      };
    },
    { cId: cardId, aId: abilityId },
  )) as Awaited<ReturnType<typeof probeAbility>>;
}

async function hasIconFlashAbility(page: Page, cardId: string): Promise<boolean> {
  return (await page.evaluate((cId) => {
    const w = (window as unknown as {
      __game: { read: { def: { card: (id: string) => unknown } } };
    }).__game;
    const def = w.read.def.card(cId) as
      | undefined
      | { abilities: { type?: string }[] };
    if (!def) return false;
    return def.abilities.some((a) => a.type === 'triggered' && a.trigger?.hook === 'evidence:remove-by-action' && a.trigger?.optional === true);
  }, cardId)) as boolean;
}

async function getPendingHirameki(
  page: Page,
): Promise<{ player: string; cardId: string; abilityId: string } | null> {
  return (await page.evaluate(() => {
    const w = (window as unknown as {
      __game: { getState: () => { pendingHirameki: unknown } };
    }).__game;
    return w.getState().pendingHirameki ?? null;
  })) as Awaited<ReturnType<typeof getPendingHirameki>>;
}

async function getHandLength(page: Page, side: 'self' | 'opp'): Promise<number> {
  return (await page.evaluate((sd) => {
    const w = (window as unknown as {
      __game: { getState: () => { gameState: { players: { self: { hand: string[] }; opp: { hand: string[] } } } } };
    }).__game;
    return w.getState().gameState.players[sd as 'self' | 'opp'].hand.length;
  }, side)) as number;
}

async function dispatchActionCase(page: Page): Promise<void> {
  // opp が attacker → self が hirameki owner、useHiramekiFlowDriver は self owner では
  // 自動 resolve しないため、test が pending を観測可能。
  await dispatchAction(page, { type: 'actionAgainstCase', byUid: 'partner:opp', targetPlayer: 'self' });
}

type FixtureArg = { evidenceCardId: string };

function applyFixture(gs: GameStateLike, arg: FixtureArg): void {
  // 設計: opp を attacker、self を hirameki owner にすることで useHiramekiFlowDriver の
  // 自動 resolve (opp owner 時 AI 自動 fire/skip) を回避し、test が pending を観測してから
  // 明示的に hiramekiResolve dispatch できる。
  const self = gs.players.self as unknown as {
    partner: { cardId: string; state: string; location: string };
    hand: string[];
    deck: string[];
    evidence: { cardId: string; faceUp: boolean; origin: { turn: number; via: string } }[];
    case: { cardId: string; status: string; requiredEvidence: number; colors: string[] };
  };
  const opp = gs.players.opp as unknown as {
    partner: { cardId: string; state: string; location: string };
  };

  // attacker = opp.partner
  opp.partner.cardId = 'D11001';
  opp.partner.state = 'active';
  opp.partner.location = 'partner-area';

  // target = self
  self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['青'] };
  self.evidence = [
    { cardId: arg.evidenceCardId, faceUp: false, origin: { turn: 1, via: 'reasoning' } },
  ];
  self.deck = Array.from({ length: 25 }, (_, i) => `self-deck-${i}`);
  self.hand = []; // delta 計測のため空

  void ({} as FileCardLike);
  (gs as unknown as { pendingEffects: unknown[] }).pendingEffects = [];
}

const CARDS = [
  { cardId: 'D08013', abilityId: 'a2', kind: 'character (吉田歩美)' },
  { cardId: 'D08024', abilityId: 'a2', kind: 'event' },
] as const;

test.describe('hiramekiDraw — shape + fire/skip path (2 カード集約)', () => {
  for (const { cardId, abilityId, kind } of CARDS) {
    test(`${cardId} ${abilityId} (${kind}): shape (icon-flash / on-evidence / atom-draw n=1, args.player='self')`, async ({ page }) => {
      const { errors } = await setupGamePage(page);
      await buildGameState<FixtureArg>(page, applyFixture, { evidenceCardId: cardId });

      const probe = await probeAbility(page, cardId, abilityId);

      expect(probe.abilityExists, 'ability is defined').toBe(true);
      expect(probe.typeIsIconFlash, "type === 'icon-flash'").toBe(true);
      expect(probe.scopeIsOnEvidence, "scope === 'on-evidence'").toBe(true);
      expect(probe.effectKind, "effect.kind === 'atom'").toBe('atom');
      expect(probe.effectVerb, "effect.verb === 'draw'").toBe('draw');
      expect(probe.effectArgN, 'effect.args.n === 1').toBe(1);
      expect(probe.effectArgPlayer, "effect.args.player === 'self'").toBe('self');

      expectNoConsoleErrors(errors);
    });

    test(`${cardId} ${abilityId} (${kind}): fire path → opp.hand +1 (Round 4j-fix BUG-034 検証)`, async ({ page }) => {
      const { errors } = await setupGamePage(page);
      await buildGameState<FixtureArg>(page, applyFixture, { evidenceCardId: cardId });

      await dispatchActionCase(page);

      const pending = await getPendingHirameki(page);
      expect(pending, 'pendingHirameki populated').not.toBeNull();
      expect(pending?.player, 'pending.player === removed-from owner (self)').toBe('self');
      expect(pending?.cardId, `pending.cardId === ${cardId}`).toBe(cardId);
      expect(pending?.abilityId, `pending.abilityId === ${abilityId}`).toBe(abilityId);

      const handBefore = await getHandLength(page, 'self');
      await dispatchAction(page, { type: 'hiramekiResolve', choice: 'fire' });
      const handAfter = await getHandLength(page, 'self');

      expect(handAfter - handBefore, 'self.hand +1 after fire').toBe(1);
      expect(await getPendingHirameki(page), 'pendingHirameki cleared after resolve').toBeNull();

      expectNoConsoleErrors(errors);
    });

    test(`${cardId} ${abilityId} (${kind}): skip path → opp.hand 不変`, async ({ page }) => {
      const { errors } = await setupGamePage(page);
      await buildGameState<FixtureArg>(page, applyFixture, { evidenceCardId: cardId });

      await dispatchActionCase(page);

      const pending = await getPendingHirameki(page);
      expect(pending, 'pendingHirameki populated (skip 前)').not.toBeNull();

      const handBefore = await getHandLength(page, 'self');
      await dispatchAction(page, { type: 'hiramekiResolve', choice: 'skip' });
      const handAfter = await getHandLength(page, 'self');

      expect(handAfter, 'self.hand 不変 after skip').toBe(handBefore);
      expect(await getPendingHirameki(page), 'pendingHirameki cleared after skip').toBeNull();

      expectNoConsoleErrors(errors);
    });
  }

  // negative: 非 hirameki カード (D08015) は abilities に type:'icon-flash' を含まない
  test('non-hirameki card (D08015): abilities に icon-flash 非含有 + dispatch しても pendingHirameki null', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await buildGameState<FixtureArg>(page, applyFixture, { evidenceCardId: 'D08015' });

    expect(await hasIconFlashAbility(page, 'D08015'), 'D08015 は icon-flash 非持ち').toBe(false);
    expect(await hasIconFlashAbility(page, 'D08013'), 'D08013 (control) は icon-flash 持ち').toBe(true);

    // dispatch しても non-hirameki → pendingHirameki null
    await dispatchActionCase(page);
    expect(await getPendingHirameki(page), 'D08015 evidence では listener fire しない').toBeNull();

    expectNoConsoleErrors(errors);
  });
});
