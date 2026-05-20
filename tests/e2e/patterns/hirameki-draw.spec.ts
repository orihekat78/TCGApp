import { test, expect, type Page } from '@playwright/test';
import { setupGamePage, buildGameState, expectNoConsoleErrors } from '../helpers';
import type { GameStateLike } from '../helpers';

// Round 4j: hiramekiDraw パターン (アクション[事件] 経由のヒラメキドロー) を 2 カード集約検証。
// 共通パターン spec 4/5 → 5/5 完了を達成する round。
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
//     D08024 a1 は Round 4i-fix で selfOnly 追加済 (本 round では a2 のみ対象)
//
// ⚠️ Round 4j 限定スコープ (BUG-034 として別途登録):
//   action[case] dispatch → pendingHirameki populate の実機検証は本 spec から **除外**。
//   理由: vite dev mode で `_pendingHiramekiSideChannel` の module instance 分離問題により
//   dispatch 経路の listener fire が store に反映されない (Round 4j 探索で発見、tests/integration/
//   hirameki-e2e.test.ts は jsdom で正常動作)。fix は Round 4j-fix で予定。
//
// 検証層 (各カード、本 spec で実施):
//   1. shape: ability.type / scope / effect.kind / effect.verb / args.n / args.player
//   + negative: 非 hirameki カード (D08015) は abilities に type:'icon-flash' を含まない

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
        typeIsIconFlash: ability.type === 'icon-flash',
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
    return def.abilities.some((a) => a.type === 'icon-flash');
  }, cardId)) as boolean;
}

type FixtureArg = { evidenceCardId: string };

function applyFixture(gs: GameStateLike, arg: FixtureArg): void {
  const self = gs.players.self as unknown as {
    partner: { cardId: string; state: string; location: string };
  };
  const opp = gs.players.opp as unknown as {
    evidence: { cardId: string; faceUp: boolean; origin: { turn: number; via: string } }[];
    case: { cardId: string; status: string; requiredEvidence: number; colors: string[] };
  };

  self.partner.cardId = 'D08001';
  self.partner.state = 'active';
  self.partner.location = 'partner-area';

  opp.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['青'] };
  opp.evidence = [
    { cardId: arg.evidenceCardId, faceUp: false, origin: { turn: 1, via: 'reasoning' } },
  ];

  // FileCardLike 型は applyFixture では使わないが、参照だけ残しておく (型整合のため)
  void ({} as FileCardLike);

  (gs as unknown as { pendingEffects: unknown[] }).pendingEffects = [];
}

const CARDS = [
  { cardId: 'D08013', abilityId: 'a2', kind: 'character (吉田歩美)' },
  { cardId: 'D08024', abilityId: 'a2', kind: 'event' },
] as const;

test.describe('hiramekiDraw — shape verification (2 カード集約)', () => {
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
  }

  // negative: 非 hirameki カード (D08015) は abilities に type:'icon-flash' を含まない
  test('non-hirameki card (D08015): abilities に icon-flash 非含有', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await buildGameState<FixtureArg>(page, applyFixture, { evidenceCardId: 'D08015' });

    expect(await hasIconFlashAbility(page, 'D08015'), 'D08015 は icon-flash 非持ち').toBe(false);
    expect(await hasIconFlashAbility(page, 'D08013'), 'D08013 (control) は icon-flash 持ち').toBe(true);

    expectNoConsoleErrors(errors);
  });
});
