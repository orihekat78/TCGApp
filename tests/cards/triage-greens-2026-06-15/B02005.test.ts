// gate5 RUNTIME behavior — B02005 沖野ヨーコ (character, 青/アイドル, Lv5 AP4000 LP1)
//   公式テキスト:
//     【宣言】【ターン1】自分の現場にいる〚カード名［毛利小五郎］〛を1枚まで選び、ターン終了時までAP＋2000し、
//       〚突撃〛（登場したターンからすぐにアクションできる）を与える。
//   rules: 13-keywords.md (突撃=名乗り中アクション可), 15-abilities-effects.md (「〜まで」=0枚可/必ず発動),
//          17-icons.md (【ターン1】= ターン1回制限), 19-special-rules.md (cardName split-name),
//          21-declared-ability-cost.md (宣言能力: コスト無=本文に':'無し / active 不要), 24-qa-naming-stun.md
//
// 検証の核 (BUG-117/118 教訓: DSL に filter を書いても engine が実評価する保証はない):
//   step1 charModifyAP 短縮形 carrier {max:1, side:'self', filter:{cardName:'毛利小五郎'}, delta:2000,
//     scope:'turn', bind:'$picked'} の cardName filter + side:'self' を engine が **実際に評価** しているか。
//   atom-handlers.ts:101-105 (短縮形 matcher) + candidates.ts:261-263 が allCardNameComponentsForDef 経由で
//   cardName を honor。paShortFormAwait → buildShortFormPick が side:'self'+filter を candidate query へ。
//   step2 charGrantKeyword {uid:'$picked.uid', kw:'突撃', scope:'turn'} が resolveBindRef で $picked.uid を解決。
//
// decoy/negative (filter/side が実評価されている証明):
//   D1: 自現場に 非毛利小五郎キャラ (DEC_B02005_DECOY) を置く。filter が無視されるなら候補に混ざる/効果が及ぶ。
//       filter が honor されるなら候補外・効果なし。
//   D2: 相手現場に 毛利小五郎 (DEC_B02005_OPPKOGORO) を置く。side:'self' が無視されるなら候補/効果対象になる。
//       honor されるなら候補外・効果なし。
//   N1: 「1枚まで」(rules/15) human decline (0-pick) → 毛利小五郎が居ても AP/突撃を付与しない。
//       【ターン1】は発動済み扱いでカウント (rules/24) → 2回目宣言不可。
//   N2: 自現場に 毛利小五郎 が 1 枚も無い → 候補0、効果なし。ただし発動済み扱いで declaredUseCount=1 (rules/24)。
//   L1: 【ターン1】— 1回使用後 canDeclaredAbility=false。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import { cards as engineCards } from '@/engine/cards/index';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { canDeclaredAbility, useDeclaredAbility } from '@/engine/flow/main/declared-ability';
import {
  drainAiEffectPicks,
  _drainAllEffectPicksForTest,
  applyPickSkipAndContinuation,
} from '@/engine/effect/apply-pick';
import {
  _clearPendingEffectPickQueue,
  _peekPendingEffectPickQueueLength,
} from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { char as readChar } from '@/engine/read/char';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../../helpers/fixtures';
import { B02005 } from '@/cards/ct-p02/B02005';
import type { GameState, CardDef, EffectCtx, AbilityDef } from '@/engine/types';

const setHuman = (s: 'self' | 'opp' | null) => {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s;
};
const queue = (): PendingEffectPickSide[] =>
  (globalThis as { __pendingEffectPickQueue?: PendingEffectPickSide[] }).__pendingEffectPickQueue ?? [];

// synthetic 毛利小五郎 (cardName filter match 用、AP3000 で +2000 の delta を可視化)
function kogoro(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9999/${id}`, kind: 'character', names: ['毛利小五郎'], colors: ['青'],
    level: 5, ap: 3000, lp: 1, traits: ['探偵'], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...over,
  };
}
// 非毛利小五郎 decoy (cardName filter で弾かれるべき)
function decoyChar(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9999/${id}`, kind: 'character', names: ['工藤新一'], colors: ['青'],
    level: 5, ap: 3000, lp: 1, traits: ['探偵'], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...over,
  };
}

function declareCtx(): EffectCtx {
  return { source: { cardId: 'B02005', uid: 'oki#1', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} };
}

describe('B02005 沖野ヨーコ — gate5 runtime behavior (declared: 毛利小五郎 に AP+2000 + 突撃)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    resetCardDefRegistry();
    registerAll();
    engineCards.register(kogoro('DEC_B02005_KOGORO'));
    engineCards.register(kogoro('DEC_B02005_OPPKOGORO'));
    engineCards.register(decoyChar('DEC_B02005_DECOY'));
    registerTriggeredListener();
    _clearPendingEffectPickQueue();
    setHuman(null);
  });

  // ===== 本道 + DECOY: 候補集合は 自現場の毛利小五郎のみ (非毛利/相手側 除外)、AP+2000 & 突撃付与 =====
  it('a1 + DECOY: 自現場の毛利小五郎(AP3000)のみ候補→AP5000化&突撃付与 / 非毛利・相手側毛利は不変', () => {
    setHuman('self'); // pending pick を覗いて候補集合を decoy 検証
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [
      sceneChar('B02005', 'oki#1'),
      sceneChar('DEC_B02005_KOGORO', 'kogoro#1'),  // match (自現場・毛利小五郎)
      sceneChar('DEC_B02005_DECOY', 'decoy#1'),    // cardName decoy (工藤新一) → 候補外
    ];
    s.players.opp.scene = [
      sceneChar('DEC_B02005_OPPKOGORO', 'oppkogoro#1'), // side decoy (相手現場・毛利小五郎) → 候補外
    ];

    expect(canDeclaredAbility(s, 'oki#1', 'a1'), '宣言可').toBe(true);
    // 発火前の AP / keyword スナップショット
    expect(readChar.ap(s, 'kogoro#1'), '毛利小五郎の素 AP3000').toBe(3000);
    expect(readChar.keywords(s, 'kogoro#1')).not.toContain('突撃');

    s = produce(s, (d) => {
      useDeclaredAbility(d, 'oki#1', 'a1', declareCtx());
      runAllUntilEmpty(d);
    });

    // ---- DECOY 主張: 候補集合は 自現場の毛利小五郎 (kogoro#1) のみ ----
    expect(_peekPendingEffectPickQueueLength(), 'pick が surface').toBe(1);
    const pending = queue()[0]!;
    expect(pending.atomVerb, 'charModifyAP の pick').toBe('charModifyAP');
    expect(pending.nMin, '「〜まで」=0枚可 (nMin 0)').toBe(0);
    const cand = pending.candidates.map((c) => c.uid).sort();
    expect(cand, '自現場の毛利小五郎のみ (非毛利/相手側は除外)').toEqual(['kogoro#1']);

    // ---- pick を解決して実 mutation を確認 ----
    s = produce(s, (d) => _drainAllEffectPicksForTest(d, new HeuristicPolicy()));
    expect(readChar.ap(s, 'kogoro#1'), '毛利小五郎 AP+2000 → 5000').toBe(5000);
    expect(readChar.keywords(s, 'kogoro#1'), '毛利小五郎に突撃付与').toContain('突撃');

    // DECOY: 非毛利キャラ (工藤新一) は AP/突撃 不変
    expect(readChar.ap(s, 'decoy#1'), 'decoy(非毛利) AP 不変').toBe(3000);
    expect(readChar.keywords(s, 'decoy#1'), 'decoy(非毛利) 突撃なし').not.toContain('突撃');
    // DECOY: 相手側 毛利小五郎 は AP/突撃 不変 (side:'self')
    expect(readChar.ap(s, 'oppkogoro#1'), '相手側 毛利小五郎 AP 不変').toBe(3000);
    expect(readChar.keywords(s, 'oppkogoro#1'), '相手側 毛利小五郎 突撃なし').not.toContain('突撃');
  });

  // ===== AI 経路: 候補唯一の毛利小五郎に自動付与 (human 不在でも flow が完結) =====
  it('a1 (AI): 候補唯一の自現場毛利小五郎へ AP+2000 & 突撃を自動付与', () => {
    setHuman(null); // AI 経路 (drainAiEffectPicks)
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [
      sceneChar('B02005', 'oki#1'),
      sceneChar('DEC_B02005_KOGORO', 'kogoro#1'),
      sceneChar('DEC_B02005_DECOY', 'decoy#1'),
    ];

    s = produce(s, (d) => {
      useDeclaredAbility(d, 'oki#1', 'a1', declareCtx());
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });

    expect(readChar.ap(s, 'kogoro#1'), 'AI: 毛利小五郎 AP5000').toBe(5000);
    expect(readChar.keywords(s, 'kogoro#1'), 'AI: 突撃付与').toContain('突撃');
    expect(readChar.ap(s, 'decoy#1'), 'AI: decoy 不変').toBe(3000);
    expect(readChar.keywords(s, 'decoy#1')).not.toContain('突撃');
    // 【ターン1】発動済み → 2回目不可
    expect(canDeclaredAbility(s, 'oki#1', 'a1'), '【ターン1】使用済 → 再宣言不可').toBe(false);
  });

  // ===== N1: 「1枚まで」human decline (0-pick) — 毛利小五郎が居ても付与しない / 【ターン1】はカウント (rules/24) =====
  it('a1 N1: human decline (0-pick) — 毛利小五郎が居ても AP/突撃なし、【ターン1】は発動済みでカウント', () => {
    setHuman('self');
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [
      sceneChar('B02005', 'oki#1'),
      sceneChar('DEC_B02005_KOGORO', 'kogoro#1'),
    ];

    s = produce(s, (d) => {
      useDeclaredAbility(d, 'oki#1', 'a1', declareCtx());
      runAllUntilEmpty(d);
    });
    const pending = queue()[0]!;
    expect(pending.nMin, '0枚可').toBe(0);

    // decline (0枚)
    _clearPendingEffectPickQueue();
    s = produce(s, (d) => {
      applyPickSkipAndContinuation(d, pending);
    });
    expect(readChar.ap(s, 'kogoro#1'), 'decline: AP 不変 (3000)').toBe(3000);
    expect(readChar.keywords(s, 'kogoro#1'), 'decline: 突撃なし').not.toContain('突撃');
    // rules/24: 発動済み扱い → declaredUseCount=1 → 再宣言不可
    expect(readChar.declaredUseCount(s, 'oki#1', 'a1'), '【ターン1】発動済み').toBe(1);
    expect(canDeclaredAbility(s, 'oki#1', 'a1'), 'decline でも再宣言不可').toBe(false);
  });

  // ===== N2: 候補0 (自現場に毛利小五郎なし) — 効果なし、ただし発動済み扱い (rules/24) =====
  it('a1 N2: 自現場に毛利小五郎が無い → 効果なし、ただし発動済み扱いで declaredUseCount=1', () => {
    setHuman(null);
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [
      sceneChar('B02005', 'oki#1'),
      sceneChar('DEC_B02005_DECOY', 'decoy#1'), // 非毛利のみ
    ];
    s.players.opp.scene = [sceneChar('DEC_B02005_OPPKOGORO', 'oppkogoro#1')]; // 相手側のみ

    s = produce(s, (d) => {
      useDeclaredAbility(d, 'oki#1', 'a1', declareCtx());
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });

    expect(readChar.keywords(s, 'decoy#1'), '非毛利 decoy に効果なし').not.toContain('突撃');
    expect(readChar.ap(s, 'decoy#1')).toBe(3000);
    expect(readChar.keywords(s, 'oppkogoro#1'), '相手側 毛利小五郎 に効果なし (side:self)').not.toContain('突撃');
    expect(readChar.ap(s, 'oppkogoro#1')).toBe(3000);
    // rules/24: 候補0でも発動した扱い
    expect(readChar.declaredUseCount(s, 'oki#1', 'a1'), '候補0でも発動済み').toBe(1);
    expect(canDeclaredAbility(s, 'oki#1', 'a1'), '再宣言不可').toBe(false);
  });

  // ===== L1: 【ターン1】limit — 連続宣言不可 (canDeclaredAbility gate) =====
  it('a1 L1: 【ターン1】— 1回使用後 canDeclaredAbility=false', () => {
    setHuman(null);
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [
      sceneChar('B02005', 'oki#1'),
      sceneChar('DEC_B02005_KOGORO', 'kogoro#1'),
    ];
    expect(canDeclaredAbility(s, 'oki#1', 'a1'), '初回は宣言可').toBe(true);
    s = produce(s, (d) => {
      useDeclaredAbility(d, 'oki#1', 'a1', declareCtx());
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });
    expect(canDeclaredAbility(s, 'oki#1', 'a1'), '2回目は不可').toBe(false);
  });

  // ===== descriptor 構造 sanity =====
  it('descriptor: a1 = declared/turn1, step1 charModifyAP{cardName:毛利小五郎,side:self,delta2000,bind$picked}, step2 charGrantKeyword{突撃 on $picked.uid}', () => {
    const a1 = B02005.abilities[0] as AbilityDef;
    expect(a1).toMatchObject({ type: 'declared', scope: 'on-scene', limit: { kind: 'turn', n: 1 } });
    const steps = (a1.effect as { kind: string; steps: Array<{ verb?: string; args?: Record<string, unknown> }> });
    expect(steps.kind).toBe('sequence');
    expect(steps.steps[0]).toMatchObject({
      verb: 'charModifyAP',
      args: { max: 1, side: 'self', filter: { cardName: '毛利小五郎' }, delta: 2000, scope: 'turn', bind: '$picked' },
    });
    expect(steps.steps[1]).toMatchObject({
      verb: 'charGrantKeyword',
      args: { uid: '$picked.uid', kw: '突撃', scope: 'turn' },
    });
    // コスト無し (本文に':'無し → rules/21)
    expect(a1.cost, 'コストなし宣言能力').toBeUndefined();
  });
});
