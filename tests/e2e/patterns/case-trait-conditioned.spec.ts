import { test, expect, type Page } from '@playwright/test';
import { setupGamePage, buildGameState, expectNoConsoleErrors } from '../helpers';
import type { GameStateLike } from '../helpers';

// Round 4h: caseTraitConditioned 共通クラスを使う 2 カードを 1 spec で集約検証。
//
// 共通クラス: src/cards/_shared/caseTraitConditioned.ts
//   - inner ability の condition に { kind: 'caseTrait', trait } を AND wrap
//   - description に【事件{trait}】 prefix を追加
//   - ruleRefs に rules/17-icons.md を追加 (重複除去)
//
// 対象カード:
//   - D11003 a2 (declared, sleepSelf + sceneHas 警察 ≥2 + 婚活 trait wrap)
//   - D11005 a1 (triggered enter, sceneRemove + 婚活 trait wrap)
//
// 検証層:
//   1. cardDef.abilities に対象 ability が存在し、description に【事件婚活】 prefix
//   2. ability.condition は { kind: 'and', cs: [{ kind: 'caseTrait', trait: '婚活' }, ...] }
//   3. cond.eval で婚活 trait 持ち事件 (D11021) → true、なし事件 (D08026) → false (negative)
//
// 注: effect 実行 (choice/sceneRemove pick) は engine 統合テストで検証済。本 E2E では
// wrapper 構造 + condition resolve 経路を集中確認。

async function evalAbility(
  page: Page,
  cardId: string,
  abilityId: string,
  side: 'self' | 'opp',
  uid: string,
): Promise<{
  abilityExists: boolean;
  descriptionHasCaseTraitPrefix: boolean;
  conditionShape: 'caseTrait' | 'and-with-caseTrait' | 'other' | 'none';
  conditionMet: boolean;
}> {
  return (await page.evaluate(
    ({ cId, aId, sd, u }) => {
      const w = (window as unknown as {
        __game: {
          getState: () => { gameState: unknown };
          read: { def: { card: (id: string) => unknown } };
          cond: { eval: (s: unknown, c: unknown, ctx: unknown) => boolean };
        };
      }).__game;
      const gs = w.getState().gameState;
      const def = w.read.def.card(cId) as
        | undefined
        | { abilities: { id: string; condition?: { kind: string; cs?: { kind: string; trait?: string }[]; trait?: string }; description?: string }[] };
      if (!def) {
        return { abilityExists: false, descriptionHasCaseTraitPrefix: false, conditionShape: 'none' as const, conditionMet: false };
      }
      const ability = def.abilities.find((a) => a.id === aId);
      if (!ability) {
        return { abilityExists: false, descriptionHasCaseTraitPrefix: false, conditionShape: 'none' as const, conditionMet: false };
      }
      const desc = ability.description ?? '';
      const descPrefix = /^【事件婚活】/.test(desc);
      let shape: 'caseTrait' | 'and-with-caseTrait' | 'other' | 'none' = 'none';
      const cond = ability.condition;
      if (!cond) {
        shape = 'none';
      } else if (cond.kind === 'caseTrait' && cond.trait === '婚活') {
        shape = 'caseTrait';
      } else if (cond.kind === 'and' && cond.cs?.some((c) => c.kind === 'caseTrait' && c.trait === '婚活')) {
        shape = 'and-with-caseTrait';
      } else {
        shape = 'other';
      }
      const conditionMet = cond ? w.cond.eval(gs, cond, { source: { player: sd, uid: u } }) : true;
      return { abilityExists: true, descriptionHasCaseTraitPrefix: descPrefix, conditionShape: shape, conditionMet };
    },
    { cId: cardId, aId: abilityId, sd: side, u: uid },
  )) as Awaited<ReturnType<typeof evalAbility>>;
}

const CARDS: ReadonlyArray<{ cardId: string; abilityId: string; kind: string }> = [
  { cardId: 'D11003', abilityId: 'a2', kind: 'declared + 警察≥2' },
  { cardId: 'D11005', abilityId: 'a1', kind: 'triggered-enter + AP≤8000' },
];

test.describe('caseTraitConditioned — 事件特徴で条件発動 (2 カード集約)', () => {
  for (const { cardId, abilityId, kind } of CARDS) {
    test(`${cardId} ${abilityId} (${kind}): self.case=D11021 (婚活) → condition true`, async ({ page }) => {
      const { errors } = await setupGamePage(page);

      // sample state: self.case.cardId = 'D11021' (婚活 trait 持ち) は既定
      // D11003/D11005 は traits ['警察', '神奈川県警']、self.scene に置く (sceneHas '警察' ≥2 のため D11003 a2 では 2 枚必要)
      await buildGameState(
        page,
        (gs: GameStateLike, arg: { cardId: string }) => {
          // self.scene[0] と self.scene[1] を arg.cardId に差し替え (警察 trait 2 枚で sceneHas ≥2 を満たす)
          const ch1 = gs.players.self.scene.find((s) => s.uid === 'self-1');
          const ch2 = gs.players.self.scene.find((s) => s.uid === 'self-2');
          if (ch1) {
            ch1.cardId = arg.cardId;
            ch1.state = 'active';
            ch1.isNamed = false;
          }
          if (ch2) {
            ch2.cardId = arg.cardId;
            ch2.state = 'active';
            ch2.isNamed = false;
          }
        },
        { cardId },
      );

      const result = await evalAbility(page, cardId, abilityId, 'self', 'self-1');

      expect(result.abilityExists, 'ability is defined').toBe(true);
      expect(result.descriptionHasCaseTraitPrefix, '【事件婚活】 prefix in description').toBe(true);
      expect(['caseTrait', 'and-with-caseTrait'], 'condition wraps caseTrait 婚活').toContain(result.conditionShape);
      expect(result.conditionMet, 'condition is met (婚活 trait 持ち事件 + AND inner satisfied)').toBe(true);

      expectNoConsoleErrors(errors);
    });

    test(`${cardId} ${abilityId} (${kind}): self.case=別事件 (婚活なし) → condition false (negative)`, async ({ page }) => {
      const { errors } = await setupGamePage(page);

      await buildGameState(
        page,
        (gs: GameStateLike, arg: { cardId: string }) => {
          const ch1 = gs.players.self.scene.find((s) => s.uid === 'self-1');
          const ch2 = gs.players.self.scene.find((s) => s.uid === 'self-2');
          if (ch1) {
            ch1.cardId = arg.cardId;
            ch1.state = 'active';
            ch1.isNamed = false;
          }
          if (ch2) {
            ch2.cardId = arg.cardId;
            ch2.state = 'active';
            ch2.isNamed = false;
          }
          // self.case を CT-D08「青の古城探索事件」(D08026, 婚活 trait なし) に差し替え
          (gs.players.self as unknown as { case: { cardId: string } }).case.cardId = 'D08026';
        },
        { cardId },
      );

      const result = await evalAbility(page, cardId, abilityId, 'self', 'self-1');

      expect(result.abilityExists, 'ability is defined').toBe(true);
      expect(['caseTrait', 'and-with-caseTrait'], 'condition wraps caseTrait 婚活').toContain(result.conditionShape);
      expect(result.conditionMet, '別事件 (婚活なし) のため condition false').toBe(false);

      expectNoConsoleErrors(errors);
    });
  }
});
