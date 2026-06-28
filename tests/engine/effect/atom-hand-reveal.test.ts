// engine additive wave — effect atom `handReveal`。
// 「手札から filter 一致カードを1枚公開してもよい。そうした場合〜」(B08082 a1 / B07022)。
// 公開は zone 変化なし (公式Q&A B08082: 解決後に手札へ戻してよい)。atomDiscard との差は **2点**:
// (1) mutate.hand.discardToRemove を除去 (= zone 変化なし) (2) resolved 0枚で chainStepNoApply を立てる
// (atomDiscard は resolved target:[] で gate を立てない)。これで「そうした場合」を gate する
// (mill の gate と同型、reveal は他効果ゼロゆえ無条件 gate-on-0)。既存カードは handReveal 未使用 → 回帰0 (additive)。
//
// 検証:
//   §1 resolved target 1枚 → zone 変化なし (手札残存) + bind 書き込み + chainStepNoApply 立たない。
//   §2 resolved target 0枚 → chainStepNoApply=true (gate)。
//   §3 chain [handReveal(1枚), draw] → reveal 成立で後続 draw 実行 (手札 net +1、公開カードは残る)。
//   §4 chain [handReveal(0枚), draw] → chain break で後続 draw skip。
//   §5 短縮形 (target 無, 候補有) → awaiting-pick enqueue (pick infra 継承, 手札は即時変化しない)。
//   §6 短縮形 (候補0) → chainStepNoApply=true (候補無し = 公開不可)。
// rules: 15-abilities-effects.md, 13-keywords.md (突撃付与の gate)
// spec: .claude/specs/engine-additive-handreveal-design.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { run as runEffect } from '@/engine/effect/resolver';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { CardDef, GameState, EffectCtx, Effect } from '@/engine/types';

function pchar(id: string, colors: string[], traits: string[] = []): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors, level: 3, ap: 1000, lp: 1,
    traits, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}

const ctxBare = (): EffectCtx => ({ source: { cardId: 'X', uid: 'u-x', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} } as EffectCtx);

beforeEach(() => {
  resetDefRegistry();
  _resetUidCounter();
  registerCardDef(pchar('BLUE1', ['青'], ['高校生']));
  registerCardDef(pchar('BLUE2', ['青']));
  registerCardDef(pchar('RED1', ['赤']));
  registerCardDef(pchar('GREEN1', ['緑']));
});

describe('handReveal §1-2 — atom semantics (zone 不変 / bind / gate)', () => {
  it('§1 resolved target 1枚 → 手札残存 + bind + chainStepNoApply 立たない', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.hand = ['BLUE1', 'RED1'];
    const ctx = ctxBare();
    runEffect(s, { kind: 'atom', verb: 'handReveal' as never, args: { player: 'self', target: ['BLUE1'], bind: '$revealed' } }, ctx);
    expect(s.players.self.hand).toEqual(['BLUE1', 'RED1']); // zone 変化なし
    expect((ctx.bindings as Record<string, unknown>)['$revealed']).toEqual([{ cardId: 'BLUE1' }]);
    expect(ctx.dyn?.chainStepNoApply).toBeFalsy();
  });

  it('§2 resolved target 0枚 → chainStepNoApply=true (「そうした場合」gate)', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.hand = ['RED1'];
    const ctx = ctxBare();
    runEffect(s, { kind: 'atom', verb: 'handReveal' as never, args: { player: 'self', target: [] } }, ctx);
    expect(ctx.dyn?.chainStepNoApply).toBe(true);
    expect(s.players.self.hand).toEqual(['RED1']); // 変化なし
  });
});

describe('handReveal §3-4 — chain gate (「そうした場合」)', () => {
  const chain = (revealTarget: string[]): Effect => ({
    kind: 'chain',
    steps: [
      { kind: 'atom', verb: 'handReveal' as never, args: { player: 'self', target: revealTarget } },
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    ],
  } as Effect);

  it('§3 reveal 成立 (1枚) → 後続 draw 実行 (公開カードは手札に残る)', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.hand = ['BLUE1'];
    s.players.self.deck = ['DK1', 'DK2'];
    runEffect(s, chain(['BLUE1']), ctxBare());
    expect(s.players.self.hand).toContain('BLUE1'); // 公開カードは残存
    expect(s.players.self.hand).toContain('DK1');   // draw された
    expect(s.players.self.deck).toEqual(['DK2']);
  });

  it('§4 reveal 0枚 → chain break で後続 draw skip', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.hand = ['RED1'];
    s.players.self.deck = ['DK1', 'DK2'];
    runEffect(s, chain([]), ctxBare());
    expect(s.players.self.hand).toEqual(['RED1']); // draw されない
    expect(s.players.self.deck).toEqual(['DK1', 'DK2']);
  });
});

describe('handReveal §5-6 — 短縮形 (pick infra 継承)', () => {
  it('§5 短縮形 (候補有, target 無) → awaiting-pick enqueue (手札は即時変化しない)', () => {
    const g = globalThis as { __pendingEffectPickQueue?: unknown[] };
    g.__pendingEffectPickQueue = [];
    const s: GameState = createEmptyGameState();
    s.players.self.hand = ['BLUE1', 'BLUE2', 'RED1'];
    const before = [...s.players.self.hand];
    runEffect(s, { kind: 'atom', verb: 'handReveal' as never, args: { player: 'self', max: 1, filter: { color: '青' } } }, ctxBare());
    expect(g.__pendingEffectPickQueue!.length).toBeGreaterThan(0); // pick が enqueue された
    expect(s.players.self.hand).toEqual(before); // 即時の zone 変化なし
    g.__pendingEffectPickQueue = [];
  });

  it('§6 短縮形 (候補0) → chainStepNoApply=true', () => {
    const g = globalThis as { __pendingEffectPickQueue?: unknown[] };
    g.__pendingEffectPickQueue = [];
    const s: GameState = createEmptyGameState();
    s.players.self.hand = ['RED1']; // 青 候補なし
    const ctx = ctxBare();
    runEffect(s, { kind: 'atom', verb: 'handReveal' as never, args: { player: 'self', max: 1, filter: { color: '青' } } }, ctx);
    expect(ctx.dyn?.chainStepNoApply).toBe(true);
    expect(g.__pendingEffectPickQueue!.length).toBe(0); // 候補0は pick 不要
    g.__pendingEffectPickQueue = [];
  });
});

// review concern (edge-test-adequacy 最重要) を反映: bind した $revealed を下流 conditional が
// boundMatchesFilter で読む load-bearing contract をロックする。B07022 第2句「公開が【緑】以外なら AP+1000」
// のミニ再現。bind の shape ({cardId} 配列、uid 無し) が boundMatchesFilter (bound[0].cardId→lookupCardDef)
// と互換であることを end-to-end で固定する ($revealed 色読み companion の足場検証)。
describe('handReveal §7 — bind downstream consumption (boundMatchesFilter $revealed)', () => {
  const chainColorGate = (revealTarget: string[]): Effect => ({
    kind: 'chain',
    steps: [
      { kind: 'atom', verb: 'handReveal' as never, args: { player: 'self', target: revealTarget, bind: '$revealed' } },
      {
        kind: 'conditional',
        if: { kind: 'boundMatchesFilter', bindKey: '$revealed', filter: { colorNot: '緑' } },
        then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      },
    ],
  } as unknown as Effect);

  it('§7a 公開が【緑】以外 (赤) → boundMatchesFilter true → 下流 draw 実行', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.hand = ['RED1'];
    s.players.self.deck = ['DK1', 'DK2'];
    runEffect(s, chainColorGate(['RED1']), ctxBare());
    expect(s.players.self.hand).toContain('DK1'); // 緑以外 = fire
    expect(s.players.self.hand).toContain('RED1'); // 公開カードは残存
  });

  it('§7b 公開が【緑】 → boundMatchesFilter false → 下流 draw skip', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.hand = ['GREEN1'];
    s.players.self.deck = ['DK1', 'DK2'];
    runEffect(s, chainColorGate(['GREEN1']), ctxBare());
    expect(s.players.self.hand).toEqual(['GREEN1']); // 緑 = skip (draw されない)
    expect(s.players.self.deck).toEqual(['DK1', 'DK2']);
  });
});

describe('handReveal §8 — max>1 multi-reveal', () => {
  it('§8 2枚公開 → 両方手札残存 + chain 継続 (count>0、bind は先頭1枚 = boundMatchesFilter 仕様)', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.hand = ['BLUE1', 'BLUE2'];
    s.players.self.deck = ['DK1'];
    const ctx = ctxBare();
    runEffect(s, {
      kind: 'chain',
      steps: [
        { kind: 'atom', verb: 'handReveal' as never, args: { player: 'self', target: ['BLUE1', 'BLUE2'], bind: '$revealed' } },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      ],
    } as Effect, ctx);
    expect(s.players.self.hand).toContain('BLUE1');
    expect(s.players.self.hand).toContain('BLUE2');
    expect(s.players.self.hand).toContain('DK1'); // 公開2枚で chain 継続 → draw
    expect((ctx.bindings as Record<string, unknown>)['$revealed']).toEqual([{ cardId: 'BLUE1' }, { cardId: 'BLUE2' }]);
  });
});

// review concern (false-green 回避 / carrier-reuse human-path) を反映: 短縮形 handReveal を chain 内で使い、
// AI pick drain (_drainAllEffectPicksForTest) で pick 解決 → continuation で remainder chain step が走る
// end-to-end 経路を1本通す。直渡し resolved target ではない実カード経路 (短縮形→enqueue→pick→continuation→下流)。
describe('handReveal §9 — 短縮形 → AI pick drain → continuation 下流実行', () => {
  it('§9 短縮形 handReveal(候補1) → drain で公開解決 → 後続 draw が continuation で実行', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.hand = ['BLUE1', 'RED1'];
    s.players.self.deck = ['DK1', 'DK2'];
    const after = produce(s, (d) => {
      runEffect(d, {
        kind: 'chain',
        steps: [
          { kind: 'atom', verb: 'handReveal' as never, args: { player: 'self', max: 1, filter: { color: '青' } } },
          { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        ],
      } as Effect, ctxBare());
      _drainAllEffectPicksForTest(d);
    });
    expect(after.players.self.hand).toContain('BLUE1'); // 公開しても手札に残る (zone 変化なし)
    expect(after.players.self.hand).toContain('DK1');   // continuation で draw 実行
    expect(after.players.self.deck).toEqual(['DK2']);
  });
});
