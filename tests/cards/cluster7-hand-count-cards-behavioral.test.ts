// cluster7 — engine変更0 card-authoring 2枚 (B07067 沖矢昴 / B07070 新出智明) を実 engine 経路で駆動。
// (2026-06-14)。両カードは handAtMost / handCountAtLeastOther 条件の **最初の消費者** のため、
// 条件 handler の挙動を専用テストで pin する (BUG-132 教訓: smoke green は no-op 回帰のみ)。
//
// 検証 (公式テキスト + qAndA と 1対1):
//   B07070 a1: 自分の手札2枚以下のとき レベル7以上【赤】キャラ1枚に AP+1000・突撃 (turn) / 3枚以上は gate off /
//     filter (level7+ かつ 赤) を満たさない decoy は対象外。
//   B07067 a1: 相手手札 >= 自分手札 のとき レベル8以下キャラ1枚リムーブ / 相手手札<自分手札は gate off /
//     等枚数は成立 (handCountAtLeastOther は >= 、qAndA)。
//   B07067 a2 宣言ゲート: 自分の手札2枚以下 ∧ このキャラが sleep/stun のときだけ canDeclaredAbility=true。
// rules: 15 / 17 / 21 / 24 + cards-data ct-p07 qAndA

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { run as runEffect } from '@/engine/effect/resolver';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { read } from '@/engine/read/index';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerAll } from '@/cards/index';
import { event } from '@/engine/event/index';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../helpers/fixtures';
import { B07070 } from '@/cards/ct-p07/B07070';
import { B07067 } from '@/cards/ct-p07/B07067';
import type { CardDef, GameState, EffectCtx } from '@/engine/types';

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['赤'], level: 5, ap: 5000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
function turnSelf(s: GameState): void {
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}
function fillHand(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `H${i}`);
}
function aiCtx(): EffectCtx {
  return { source: { player: 'self', cardId: 'SRC', uid: 'src', abilityId: 'a1', area: 'scene' }, bindings: {} } as unknown as EffectCtx;
}
// charModifyAP / sceneRemove は PA 短縮形 (resolve-picks.ts:438「PA は実行時 atom-handler 側で解決」)。
// runEffect が pending pick を queue → AI drain で解決 (cluster4 と同型)。produce 2 段 (queue→drain) で
// draft proxy 境界を跨ぐ (BUG-132)。返り値の新 state を assert する。
function aiRun(effect: unknown, s: GameState): GameState {
  const ctx = aiCtx();
  let after = produce(s, (d) => { runEffect(d, effect as never, ctx); });
  after = produce(after, (d) => { _drainAllEffectPicksForTest(d, new HeuristicPolicy()); });
  return after;
}

describe('cluster7 — hand-count first-consumer cards (B07067 / B07070)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    resetDefRegistry();
    _clearPendingEffectPickQueue();
    registerAll();
    registerCardDef(ch('AKA7', { level: 7, colors: ['赤'], ap: 5000 })); // 有効 target (level7 赤)
    registerCardDef(ch('AKA6', { level: 6, colors: ['赤'], ap: 4000 })); // decoy: level6 (levelMin7 不適)
    registerCardDef(ch('AO7', { level: 7, colors: ['青'], ap: 4000 }));  // decoy: 青 (color赤 不適)
    registerCardDef(ch('OPPT', { level: 5, colors: ['青'], ap: 3000 })); // B07067 a1 リムーブ対象 (level<=8)
    registerTriggeredListener();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  // ===== B07070 a1: handAtMost gate + pick-share AP+1000 / 突撃 =====
  it('B07070 a1: 手札2枚以下 → レベル7以上赤(AKA7)に AP+1000 & 突撃(turn) / decoy は対象外', () => {
    const s = createEmptyGameState();
    turnSelf(s);
    s.players.self.hand = fillHand(2); // 2枚以下
    s.players.self.scene = [sceneChar('AKA7', 'tgt'), sceneChar('AKA6', 'd6'), sceneChar('AO7', 'd7')];

    const after = aiRun(B07070.abilities[0].effect, s);

    expect(read.char.ap(after, 'tgt'), 'AKA7 は AP+1000 (5000→6000)').toBe(6000);
    expect(read.char.hasKeyword(after, 'tgt', '突撃'), 'AKA7 に突撃付与').toBe(true);
    // decoy: filter 不適 → 未 buff
    expect(read.char.ap(after, 'd6'), 'level6 赤 decoy は対象外').toBe(4000);
    expect(read.char.hasKeyword(after, 'd6', '突撃'), 'd6 に突撃なし').toBe(false);
    expect(read.char.ap(after, 'd7'), 'level7 青 decoy は対象外').toBe(4000);
    expect(read.char.hasKeyword(after, 'd7', '突撃'), 'd7 に突撃なし').toBe(false);
  });

  it('B07070 a1: 手札3枚以上 → gate off (AP/突撃 付与なし)', () => {
    const s = createEmptyGameState();
    turnSelf(s);
    s.players.self.hand = fillHand(3); // 3枚 (>2)
    s.players.self.scene = [sceneChar('AKA7', 'tgt')];

    const after = aiRun(B07070.abilities[0].effect, s);

    expect(read.char.ap(after, 'tgt'), '手札3枚 → handAtMost:2 false → 未 buff').toBe(5000);
    expect(read.char.hasKeyword(after, 'tgt', '突撃'), '突撃付与なし').toBe(false);
  });

  // ===== B07067 a1: handCountAtLeastOther gate + sceneRemove =====
  it('B07067 a1: 相手手札 >= 自分手札 → レベル8以下キャラ(OPPT)をリムーブ', () => {
    const s = createEmptyGameState();
    turnSelf(s);
    s.players.self.hand = fillHand(1);
    s.players.opp.hand = fillHand(2); // opp(2) >= self(1)
    s.players.opp.scene = [sceneChar('OPPT', 'victim')];

    const after = aiRun(B07067.abilities[0].effect, s);

    expect(after.players.opp.scene.find((c) => c.uid === 'victim'), 'OPPT はリムーブされた').toBeUndefined();
  });

  it('B07067 a1: 相手手札 < 自分手札 → gate off (リムーブなし)', () => {
    const s = createEmptyGameState();
    turnSelf(s);
    s.players.self.hand = fillHand(3);
    s.players.opp.hand = fillHand(1); // opp(1) < self(3)
    s.players.opp.scene = [sceneChar('OPPT', 'victim')];

    const after = aiRun(B07067.abilities[0].effect, s);

    expect(after.players.opp.scene.find((c) => c.uid === 'victim'), 'gate off → OPPT 残存').toBeDefined();
  });

  it('B07067 a1: 相手手札 == 自分手札 (等枚数) → 成立 (>=、qAndA)', () => {
    const s = createEmptyGameState();
    turnSelf(s);
    s.players.self.hand = fillHand(2);
    s.players.opp.hand = fillHand(2); // 等枚数
    s.players.opp.scene = [sceneChar('OPPT', 'victim')];

    const after = aiRun(B07067.abilities[0].effect, s);

    expect(after.players.opp.scene.find((c) => c.uid === 'victim'), '等枚数でもリムーブ (qAndA)').toBeUndefined();
  });

  // ===== B07067 a2: 宣言ゲート (handAtMost:2 ∧ 自身 sleep/stun) =====
  it('B07067 a2: 宣言可否 = 自分の手札2枚以下 ∧ このキャラが sleep/stun', () => {
    const build = (state: 'active' | 'sleep' | 'stun', handN: number): GameState => {
      const s = createEmptyGameState();
      turnSelf(s);
      s.players.self.hand = fillHand(handN);
      s.players.self.scene = [sceneChar('B07067', 'oki', { state })];
      return s;
    };
    // active + 手札2 → 自身 active なので不可
    expect(canDeclaredAbility(build('active', 2), 'oki', 'a2'), 'active → 宣言不可').toBe(false);
    // sleep + 手札2 → 可
    expect(canDeclaredAbility(build('sleep', 2), 'oki', 'a2'), 'sleep + 手札2以下 → 宣言可').toBe(true);
    // stun + 手札2 → 可
    expect(canDeclaredAbility(build('stun', 2), 'oki', 'a2'), 'stun + 手札2以下 → 宣言可').toBe(true);
    // sleep + 手札3 → handAtMost:2 false で不可
    expect(canDeclaredAbility(build('sleep', 3), 'oki', 'a2'), 'sleep でも手札3枚 → 宣言不可').toBe(false);
  });
});
