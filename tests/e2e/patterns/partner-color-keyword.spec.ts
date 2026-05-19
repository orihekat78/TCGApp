import { test, expect, type Page } from '@playwright/test';
import { setupGamePage, buildGameState, expectNoConsoleErrors } from '../helpers';
import type { GameStateLike } from '../helpers';

// Round 4f Phase 2: partnerColorKeyword 共通クラスを使う 5 カードを 1 spec で集約検証。
//
// 共通クラス: src/cards/_shared/partnerColorKeyword.ts
//   - 【パートナー色】でキーワード付与する常時有効型 (type: 'continuous')
//   - 効果は continuousModifier.grantKeywords で resolve **される予定**
//
// ⚠️ engine 制約 (BUG-030 として別途登録):
//   現在 `src/engine/read/char.ts:61-74 keywords()` は continuousModifier.grantKeywords を
//   評価していない (Phase 5 abilities 展開未実装、コメント L70 参照)。
//   `read.char.hasKeyword(state, uid, kw)` は **false** を返す。
//
//   そのため本 spec は「engine が将来 resolve するための前提条件」を以下 3 層で検証:
//   1. cardDef.abilities に partnerColorKeyword ability が存在
//   2. ability.type === 'continuous' かつ continuousModifier.grantKeywords が [kw] を返す
//   3. ability.condition を `cond.evalCond(state, condition, ctx)` で評価して期待値と一致
//      (positive: 条件満たす場合 true、negative: 解決編条件未達なら false)
//
// 対象カード:
//   - D08009 (青, 突撃)、D08022 (青, 迅速)
//   - D11007 (黄, 突撃, 解決編条件)、D11009 (黄, 突撃[キャラ])、D11011 (黄, 迅速, 解決編条件)
//
// シナリオ:
//   - sample state: self.partner=黄(D11001), opp.partner=青(D08001)
//   - 青系 → opp.scene 配置 (opp.partner 青 match)、黄系 → self.scene 配置 (self.partner 黄 match)
//   - 解決編条件カードは self.case.status='解決編' で活性化、'事件編' で非活性 (negative case)

async function evalCondition(
  page: Page,
  cardId: string,
  uid: string,
  side: 'self' | 'opp',
): Promise<{
  abilityExists: boolean;
  conditionMet: boolean;
  grantedKeywords: string[] | null;
}> {
  return (await page.evaluate(
    ({ cId, u, sd }) => {
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
        | { abilities: { type: string; condition?: unknown; continuousModifier?: { grantKeywords?: (s: unknown, u: string) => string[] } }[] };
      if (!def) return { abilityExists: false, conditionMet: false, grantedKeywords: null };
      const ability = def.abilities.find((a) => a.type === 'continuous' && a.continuousModifier?.grantKeywords);
      if (!ability) return { abilityExists: false, conditionMet: false, grantedKeywords: null };
      const conditionMet = ability.condition
        ? w.cond.eval(gs, ability.condition, { source: { player: sd, uid: u } })
        : true;
      const grantedKeywords = ability.continuousModifier?.grantKeywords
        ? ability.continuousModifier.grantKeywords(gs, u)
        : null;
      return { abilityExists: true, conditionMet, grantedKeywords };
    },
    { cId: cardId, u: uid, sd: side },
  )) as Awaited<ReturnType<typeof evalCondition>>;
}

const PARTNER_COLOR_KEYWORD_CARDS: ReadonlyArray<{
  cardId: string;
  keyword: string;
  partnerColor: '青' | '黄';
  requireResolved?: boolean;
}> = [
  { cardId: 'D08009', keyword: '突撃', partnerColor: '青' },
  { cardId: 'D08022', keyword: '迅速', partnerColor: '青' },
  { cardId: 'D11007', keyword: '突撃', partnerColor: '黄' },
  { cardId: 'D11009', keyword: '突撃[キャラ]', partnerColor: '黄' },
  { cardId: 'D11011', keyword: '迅速', partnerColor: '黄', requireResolved: true },
];

test.describe('partnerColorKeyword — partner 色一致で keyword 付与 (5 カード集約)', () => {
  for (const { cardId, keyword, partnerColor, requireResolved } of PARTNER_COLOR_KEYWORD_CARDS) {
    test(`${cardId}: partner ${partnerColor} + ${requireResolved ? '解決編 ' : ''}→ ${keyword} 付与`, async ({ page }) => {
      const { errors } = await setupGamePage(page);

      // 配置先 side を partner 色に合わせて決定 (青 → opp 側、黄 → self 側)
      const side: 'self' | 'opp' = partnerColor === '青' ? 'opp' : 'self';
      // 配置 uid: side ごとに 1 番目の scene 枠を使う
      const uid = `${side}-1`;

      await buildGameState(
        page,
        (gs: GameStateLike, arg: { cardId: string; side: 'self' | 'opp'; uid: string; resolved: boolean }) => {
          const ch = gs.players[arg.side].scene.find((s) => s.uid === arg.uid);
          if (!ch) throw new Error(`fixture missing ${arg.uid}`);
          ch.cardId = arg.cardId;
          ch.state = 'active';
          ch.isNamed = false;
          if (arg.resolved) {
            const caseObj = (gs.players[arg.side] as unknown as { case: { status: string } }).case;
            caseObj.status = '解決編';
          }
        },
        { cardId, side, uid, resolved: !!requireResolved },
      );

      // 検証:
      //  (1) cardDef.abilities に continuous + grantKeywords ability あり
      //  (2) ability.condition は state で TRUE と評価される (partnerColor match)
      //  (3) grantKeywords は [keyword] を返す
      const result = await evalCondition(page, cardId, uid, side);
      expect(result.abilityExists, 'partnerColorKeyword ability is defined').toBe(true);
      expect(result.conditionMet, 'partnerColor (+ additionalCondition) is met').toBe(true);
      expect(result.grantedKeywords, 'grantKeywords returns target kw').toContain(keyword);

      expectNoConsoleErrors(errors);
    });

    if (requireResolved) {
      test(`${cardId}: 事件編のままなら ${keyword} の condition が false (negative case)`, async ({ page }) => {
        const { errors } = await setupGamePage(page);

        // 解決編条件カードを self.scene 配置 + self.case は sample 既定 '事件編' のまま
        const uid = 'self-1';

        await buildGameState(
          page,
          (gs: GameStateLike, arg: { cardId: string; uid: string }) => {
            const ch = gs.players.self.scene.find((s) => s.uid === arg.uid);
            if (!ch) throw new Error(`fixture missing ${arg.uid}`);
            ch.cardId = arg.cardId;
            ch.state = 'active';
            ch.isNamed = false;
            // self.case.status は sample 既定 '事件編' のまま
          },
          { cardId, uid },
        );

        // negative: AND 条件のうち caseStatus='解決編' が未達 → 全体 false
        const result = await evalCondition(page, cardId, uid, 'self');
        expect(result.abilityExists, 'partnerColorKeyword ability is defined').toBe(true);
        expect(result.conditionMet, '事件編 のため AND 条件 false').toBe(false);

        expectNoConsoleErrors(errors);
      });
    }
  }
});
