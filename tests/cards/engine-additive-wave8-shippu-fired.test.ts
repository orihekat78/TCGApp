// engine additive wave-8 (2026-07-02, P15) — 疾風発動 per-turn 記録 + 推理不可付与 (canReason gate)。
//
// 2 部品 (engine-only、consumer カードは card-wave で追加):
//   [A] shippuFiredThisTurn: 疾風 (abilityIsShippu = enter + enterOrderEquals) が全 gate 通過 =
//       実際に発動した時点で、listeners/triggered.ts が発動キャラ owner 側 turnState.shippuFiredThisTurn
//       を true にする。「このターン中、自分のキャラの【疾風】が発動していた場合」(B09072 横溝重悟 a1) は
//       汎用 Condition {kind:'flag', player:'self', key:'shippuFiredThisTurn', v:true} で読む (新 Condition kind 不要)。
//       清掃は endTurn (両プレイヤー、primary) + resetTurnFlags (driver 層 backstop)。キャラ離場後も
//       boolean 履歴として残る (per-char ではない) ため「発動疾風キャラが後にリムーブされても条件成立」。
//   [B] cannotReason: 「このキャラは推理できない。」(B09072 a2、ターン終了時まで) は既存 charSetTurnEffect verb が
//       turnEffects['cannotReason']=true を立て、canReason が gate、clearTurnEffects('turn') が endTurn で削除。
//
// 既存カードは shippuFiredThisTurn を読まず (write-only)、cannotReason を立てない ⇒ 挙動不変 (smoke baseline 不変)。
// consumer B09072 は a2 の「1枚まで選び、アクティブにし、推理不可を与える」が pick-bind carrier を要する
// (sceneSetState/charSetTurnEffect は bind 非対応) ため card-wave に DEFER (DEFERRED-INDEX 参照)。
//
// rules: 11(推理: LP/名乗り/迅速と独立の可否), 13/17(疾風=enter+enterOrderEquals), 15(「〜まで」), 24(発動=解決不能でも発動扱い)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { evalCond } from '@/engine/cond/eval';
import { mutate } from '@/engine/mutate/index';
import { canReason } from '@/engine/flow/main/reasoning';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { endTurn } from '@/engine/flow/turn';
import { makeCtx } from '../helpers/fixtures';
import type { CardDef, GameState, Condition, Effect, AbilityDef } from '@/engine/types';

function pchar(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['黄'], level: 5, ap: 5000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
function summonFrom(cardId: string, player: 'self' | 'opp' = 'self'): Effect {
  // side は source 相対。opp 召喚は oppCtx (source.player='opp') と合わせ side:'self'=opp の remove を指す。
  return { kind: 'atom', verb: 'sceneEnter', args: { player, cardId, viaEffect: true, target: { query: { area: 'remove', side: 'self' } } } } as unknown as Effect;
}
const srcCtx = makeCtx({ source: { cardId: 'SRC', uid: 'src#1', abilityId: 'a1', player: 'self', area: 'scene' } });

// 疾風 a1 (enter + enterOrderEquals:1 + draw) — cluster11 §4 正準形状
const shippuA1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true, matcherCondition: { kind: 'enterOrderEquals', n: 1 } },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【疾風】draw', ruleRefs: [],
};
// 【登場時】a1 (enter、matcherCondition 無し = 非疾風) — record 誤発火の decoy
const enterA1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【登場時】draw', ruleRefs: [],
};

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  registerTriggeredListener();
});

// ============================================================
// [A] shippuFiredThisTurn 記録 (実 enter → 疾風発動)
// ============================================================
describe('wave8 [A] shippuFiredThisTurn record', () => {
  it('疾風 (enterOrderEquals:1) が効果登場で発動 → owner 側 turnState.shippuFiredThisTurn=true', () => {
    registerCardDef(pchar('SHIPPU', { abilities: [shippuA1] }));
    let s = createEmptyGameState();
    s.players.self.deck = ['Z1', 'Z2'];
    s.players.self.remove = ['SHIPPU'];
    s = produce(s, (d) => {
      runEffect(d, summonFrom('SHIPPU'), srcCtx);
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.find(c => c.cardId === 'SHIPPU'), 'SHIPPU 登場').toBeTruthy();
    expect(s.players.self.hand, '疾風 draw 発火').toHaveLength(1);
    expect(s.turnState.self.shippuFiredThisTurn, '疾風発動記録').toBe(true);
    expect(s.turnState.opp.shippuFiredThisTurn, '相手側は無記録').not.toBe(true);
  });

  it('【登場時】(matcherCondition 無し = 非疾風) は記録しない (abilityIsShippu gate)', () => {
    registerCardDef(pchar('ENTER', { abilities: [enterA1] }));
    let s = createEmptyGameState();
    s.players.self.deck = ['Z1', 'Z2'];
    s.players.self.remove = ['ENTER'];
    s = produce(s, (d) => {
      runEffect(d, summonFrom('ENTER'), srcCtx);
      runAllUntilEmpty(d);
    });
    expect(s.players.self.hand, '登場時 draw は発火 (能力自体は動く)').toHaveLength(1);
    expect(s.turnState.self.shippuFiredThisTurn, '非疾風 enter は記録しない').not.toBe(true);
  });

  it('疾風発動キャラが後にリムーブされても記録は残る (boolean 履歴、B09072 条件の departed-safe)', () => {
    registerCardDef(pchar('SHIPPU', { abilities: [shippuA1] }));
    let s = createEmptyGameState();
    s.players.self.deck = ['Z1', 'Z2'];
    s.players.self.remove = ['SHIPPU'];
    s = produce(s, (d) => {
      const uid = runEffect(d, summonFrom('SHIPPU'), srcCtx) as unknown; // 疾風発動 → flag set
      runAllUntilEmpty(d);
      const shippu = d.players.self.scene.find(c => c.cardId === 'SHIPPU')!;
      mutate.scene.removeToRemove(d, shippu.uid, 'effect'); // 発動後にリムーブ
      void uid;
    });
    expect(s.players.self.scene.find(c => c.cardId === 'SHIPPU'), 'SHIPPU 離場済').toBeUndefined();
    expect(s.turnState.self.shippuFiredThisTurn, '離場後も記録は残る (per-char ではなく turnState boolean)').toBe(true);
  });

  // 注: opp 側 record (card.player='opp') は collectCardsInPlay の {player:p} 構築で保証される (両 scene 走査)。
  //   opp 召喚は sceneEnter の player/side 相対解決が絡み test が脆くなるため、self-side + departed で機構を担保する。

  it('疾風条件 (enterOrderEquals:1) 未成立 (2番目登場) は記録しない = 実発動時のみ', () => {
    registerCardDef(pchar('VAN'));                                   // 1番目 (vanilla)
    registerCardDef(pchar('SHIPPU2', { abilities: [shippuA1] }));    // 2番目 = enterOrderEquals:1 不成立
    let s = createEmptyGameState();
    s.players.self.deck = ['Z1'];
    s.players.self.remove = ['VAN', 'SHIPPU2'];
    s = produce(s, (d) => {
      runEffect(d, summonFrom('VAN'), srcCtx);
      runAllUntilEmpty(d);
      runEffect(d, summonFrom('SHIPPU2'), srcCtx);
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.find(c => c.cardId === 'SHIPPU2'), 'SHIPPU2 登場').toBeTruthy();
    expect(s.turnState.self.shippuFiredThisTurn, '2番目登場で疾風未発動 → 未記録').not.toBe(true);
  });
});

// ============================================================
// [A] Condition {kind:'flag', key:'shippuFiredThisTurn'} で読む (B09072 a1)
// ============================================================
describe('wave8 [A] flag condition read', () => {
  const cond: Condition = { kind: 'flag', player: 'self', key: 'shippuFiredThisTurn', v: true };
  const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'x' } });

  it('flag true → condition 成立', () => {
    const s = produce(createEmptyGameState(), (d) => { d.turnState.self.shippuFiredThisTurn = true; });
    expect(evalCond(s, cond, ctx)).toBe(true);
  });
  it('flag 未設定 (undefined) → 不成立', () => {
    expect(evalCond(createEmptyGameState(), cond, ctx)).toBe(false);
  });
  it('相手側 flag true でも player:self は不成立 (owner scope)', () => {
    const s = produce(createEmptyGameState(), (d) => { d.turnState.opp.shippuFiredThisTurn = true; });
    expect(evalCond(s, cond, ctx)).toBe(false);
  });
});

// ============================================================
// [A] 清掃: endTurn (primary, 両プレイヤー) + resetTurnFlags (backstop)
// ============================================================
describe('wave8 [A] shippuFiredThisTurn reset', () => {
  function withBoth(): GameState {
    return produce(createEmptyGameState(), (d) => {
      d.turnState.self.shippuFiredThisTurn = true;
      d.turnState.opp.shippuFiredThisTurn = true;
    });
  }
  it('endTurn が両プレイヤーの記録を解除 (primary、driver 非依存)', () => {
    const after = produce(withBoth(), (d) => { endTurn(d, 'self'); });
    expect(after.turnState.self.shippuFiredThisTurn).toBe(false);
    expect(after.turnState.opp.shippuFiredThisTurn).toBe(false);
  });
  it('resetTurnFlags が記録を解除 (backstop)', () => {
    const after = produce(withBoth(), (d) => { mutate.flag.resetTurnFlags(d, 'self'); });
    expect(after.turnState.self.shippuFiredThisTurn).toBe(false);
  });
});

// ============================================================
// [B] cannotReason (reason-ban) canReason gate + clearTurnEffects 清掃
// ============================================================
describe('wave8 [B] cannotReason gate', () => {
  function board(): { s: GameState; uid: string } {
    let uid = '';
    const s = produce(createEmptyGameState(), (d) => {
      uid = mutate.scene.enter(d, 'self', 'C', {}).uid;
      const c = d.players.self.scene.find(x => x.uid === uid)!;
      c.state = 'active'; c.isNamed = false;
    });
    return { s, uid };
  }
  beforeEach(() => { registerCardDef(pchar('C')); });

  it('cannotReason 未設定の active 非名乗り char → 推理可', () => {
    const { s, uid } = board();
    expect(canReason(s, uid)).toBe(true);
  });
  it('cannotReason=true → 推理不可 (charSetTurnEffect verb で付与)', () => {
    const { s, uid } = board();
    const after = produce(s, (d) => {
      runEffect(d, { kind: 'atom', verb: 'charSetTurnEffect', args: { uid, key: 'cannotReason', val: true } } as unknown as Effect, srcCtx);
    });
    expect(after.players.self.scene.find(c => c.uid === uid)!.turnEffects['cannotReason']).toBe(true);
    expect(canReason(after, uid)).toBe(false);
  });
  it('cannotReason は名乗り+迅速 char にも優先する絶対制限 (rules/11、gate 配置が isNamed/迅速 分岐より前)', () => {
    registerCardDef(pchar('SWIFT', { keywords: ['迅速'] }));
    let uid = '';
    const base = produce(createEmptyGameState(), (d) => {
      uid = mutate.scene.enter(d, 'self', 'SWIFT', {}).uid;
      const c = d.players.self.scene.find(x => x.uid === uid)!;
      c.state = 'active'; c.isNamed = true; // 名乗り中
    });
    // baseline: 名乗り+迅速 → 迅速例外で推理可
    expect(canReason(base, uid)).toBe(true);
    // cannotReason 付与 → 迅速例外を上書きして推理不可
    const banned = produce(base, (d) => { d.players.self.scene.find(c => c.uid === uid)!.turnEffects['cannotReason'] = true; });
    expect(canReason(banned, uid)).toBe(false);
  });

  it("clearTurnEffects('turn') が cannotReason を解除 → 推理可に復帰 (ターン終了で失効)", () => {
    const { s, uid } = board();
    const banned = produce(s, (d) => { d.players.self.scene.find(c => c.uid === uid)!.turnEffects['cannotReason'] = true; });
    expect(canReason(banned, uid)).toBe(false);
    const cleared = produce(banned, (d) => { mutate.char.clearTurnEffects(d, uid, 'turn'); });
    expect(cleared.players.self.scene.find(c => c.uid === uid)!.turnEffects['cannotReason']).toBeUndefined();
    expect(canReason(cleared, uid)).toBe(true);
  });
});
