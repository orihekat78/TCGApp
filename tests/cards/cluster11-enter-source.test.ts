// cluster11 — BUG-146 (効果/能力による登場で entered char の【登場時】(selfOnly) が不発火) の修正 +
// 新 condition enterSource の挙動テスト。engine拡張 wave#2 cluster11 (2026-06-15, BUG-146 coupled)。
//
// 検証 (実 engine 経路 runEffect sceneEnter atom → enter hook → runAllUntilEmpty で駆動。
//   既存【登場時】test は runEffect で effect を直接駆動し enter hook を踏まないため本 bug を覆わない = 防止策):
//   1. enterSource cond primitive (evalCond) — viaEffect / kind / level / color / undefined / partner gate。
//   2. BUG-146 core — 効果登場した【登場時】キャラ (B01021) が enter hook 経由で発火する (旧: 永久不発)。
//   3. 原因カードの【登場時】が **誤発火しない** (旧: source=原因カードで selfOnly 誤一致)。
//   4. 【疾風】も効果登場で正しく発火 (同 selfOnly 不一致が原因だった)。
//   5. viaEffect:false (手動登場相当) では enterSource:false (cluster11 は効果登場専用)。
//   6. cluster11 カード e2e — B01014 (sleep Lv≤5) / B07019 (解決編+緑event+self-sleep gate)。
// rules: 17-icons.md (§【登場時】/§【疾風】), 15, 03, 24-qa-naming-stun.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { evalCond } from '@/engine/cond/eval';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerAll } from '@/cards/index';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks, applyOptionalAndContinuation, _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { _peekPendingEffectOptionalSide, _clearPendingEffectOptionalSide, _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../helpers/fixtures';
import type { CardDef, Condition, Effect, EffectCtx, GameState } from '@/engine/types';

// ---- synthetic source / target defs ----
function pchar(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['白'], level: 3, ap: 5000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
function pevent(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'event', names: [id], colors: ['白'], level: 5, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
function ppartner(id: string): CardDef {
  return { id, no: `9/${id}`, kind: 'partner', names: [id], colors: ['白'], lp: 7, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] } as unknown as CardDef;
}

const setHuman = (side: 'self' | 'opp' | null) => { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = side; };

const C5 = 'SRC_C5';     // char Lv5
const C2 = 'SRC_C2';     // char Lv2
const E3G = 'SRC_E3G';   // event Lv3 緑
const E3R = 'SRC_E3R';   // event Lv3 赤
const E5W = 'SRC_E5W';   // event Lv5 白
const PART = 'SRC_PART'; // partner

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  registerAll(); // cluster11 cards (B01014/B01015/B01021/B07019) 込み
  registerCardDef(pchar(C5, { level: 5 }));
  registerCardDef(pchar(C2, { level: 2 }));
  registerCardDef(pevent(E3G, { level: 3, colors: ['緑'] }));
  registerCardDef(pevent(E3R, { level: 3, colors: ['赤'] }));
  registerCardDef(pevent(E5W, { level: 5, colors: ['白'] }));
  registerCardDef(ppartner(PART));
  registerTriggeredListener();
});

function ctxWithPayload(payload: unknown): EffectCtx {
  return { source: { cardId: 'X', uid: 'x#1', abilityId: 'a', player: 'self', area: 'scene' }, bindings: {}, triggerPayload: payload } as EffectCtx;
}

// sceneEnter を効果登場として駆動する effect (literal cardId + target area)
function summonFrom(area: 'remove' | 'hand', cardId: string, viaEffect = true): Effect {
  return { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId, viaEffect, target: { query: { area, side: 'self' } } } } as unknown as Effect;
}
function srcCtx(cardId: string, uid = 'src#1'): EffectCtx {
  return { source: { cardId, uid, abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} } as EffectCtx;
}

// ===================================================================================
describe('cluster11 §1 — enterSource cond primitive (evalCond)', () => {
  const s = createEmptyGameState();
  const charGate: Condition = { kind: 'enterSource', viaEffect: true, sourceFilter: { kind: 'character', levelMin: 3 } };
  const eventGate: Condition = { kind: 'enterSource', viaEffect: true, sourceFilter: { kind: 'event', levelMin: 3 } };
  const greenEvent: Condition = { kind: 'enterSource', viaEffect: true, sourceFilter: { kind: 'event', color: '緑' } };
  // B01014/15/21 の合成 gate (「レベル3以上のキャラの能力 や レベル3以上のイベントの効果」)
  const lv3Gate: Condition = { kind: 'or', cs: [charGate, eventGate] };

  it('viaEffect gate: payload.viaEffect 一致でのみ true', () => {
    const justVia: Condition = { kind: 'enterSource', viaEffect: true };
    expect(evalCond(s, justVia, ctxWithPayload({ viaEffect: true }))).toBe(true);
    expect(evalCond(s, justVia, ctxWithPayload({ viaEffect: false }))).toBe(false);
    expect(evalCond(s, justVia, ctxWithPayload({}))).toBe(false); // viaEffect 不在 = false
  });

  it('character levelMin: Lv5 char→true / Lv2 char→false / event→false (kind不一致)', () => {
    expect(evalCond(s, charGate, ctxWithPayload({ viaEffect: true, sourceCardId: C5 }))).toBe(true);
    expect(evalCond(s, charGate, ctxWithPayload({ viaEffect: true, sourceCardId: C2 }))).toBe(false);
    expect(evalCond(s, charGate, ctxWithPayload({ viaEffect: true, sourceCardId: E5W }))).toBe(false);
  });

  it('event levelMin: Lv5 event→true / Lv3緑 event→true / char→false (kind不一致)', () => {
    expect(evalCond(s, eventGate, ctxWithPayload({ viaEffect: true, sourceCardId: E5W }))).toBe(true);
    expect(evalCond(s, eventGate, ctxWithPayload({ viaEffect: true, sourceCardId: E3G }))).toBe(true);
    expect(evalCond(s, eventGate, ctxWithPayload({ viaEffect: true, sourceCardId: C5 }))).toBe(false);
  });

  it('event color: 緑 event→true / 赤 event→false / 白 event→false', () => {
    expect(evalCond(s, greenEvent, ctxWithPayload({ viaEffect: true, sourceCardId: E3G }))).toBe(true);
    expect(evalCond(s, greenEvent, ctxWithPayload({ viaEffect: true, sourceCardId: E3R }))).toBe(false);
    expect(evalCond(s, greenEvent, ctxWithPayload({ viaEffect: true, sourceCardId: E5W }))).toBe(false);
  });

  it('sourceCardId 不在 → false (安全側、EffectStackEntrySource.cardId は optional)', () => {
    expect(evalCond(s, charGate, ctxWithPayload({ viaEffect: true }))).toBe(false);
    expect(evalCond(s, charGate, ctxWithPayload(undefined))).toBe(false);
  });

  it('partner-summon: 原因カードが partner なら char/event gate とも false (kind 不一致)', () => {
    expect(evalCond(s, charGate, ctxWithPayload({ viaEffect: true, sourceCardId: PART }))).toBe(false);
    expect(evalCond(s, eventGate, ctxWithPayload({ viaEffect: true, sourceCardId: PART }))).toBe(false);
  });

  it('B01014/15/21 合成 gate or([char≥3,event≥3]): char5/event5/event3緑=true, char2/partner/viaEffect:false=false', () => {
    expect(evalCond(s, lv3Gate, ctxWithPayload({ viaEffect: true, sourceCardId: C5 }))).toBe(true);
    expect(evalCond(s, lv3Gate, ctxWithPayload({ viaEffect: true, sourceCardId: E5W }))).toBe(true);
    expect(evalCond(s, lv3Gate, ctxWithPayload({ viaEffect: true, sourceCardId: E3G }))).toBe(true);
    expect(evalCond(s, lv3Gate, ctxWithPayload({ viaEffect: true, sourceCardId: C2 }))).toBe(false);
    expect(evalCond(s, lv3Gate, ctxWithPayload({ viaEffect: true, sourceCardId: PART }))).toBe(false);
    expect(evalCond(s, lv3Gate, ctxWithPayload({ viaEffect: false, sourceCardId: C5 }))).toBe(false);
  });
});

// ===================================================================================
describe('cluster11 §2 — BUG-146 core: 効果登場した【登場時】が enter hook 経由で発火', () => {
  it('B01021 (登場時 draw) を Lv5 char 能力で効果登場 → draw 1 発火', () => {
    let s = createEmptyGameState();
    s.players.self.deck = ['Z1', 'Z2'];
    s.players.self.remove = ['B01021'];
    s = produce(s, (d) => {
      runEffect(d, summonFrom('remove', 'B01021'), srcCtx(C5)); // ctx.source = Lv5 char
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.find((c) => c.cardId === 'B01021'), 'B01021 が登場').toBeTruthy();
    expect(s.players.self.hand, 'B01021 の登場時 draw が発火し 1 枚引いた').toHaveLength(1);
  });

  it('B01021 を Lv2 char 能力で効果登場 → enterSource (char≥3/event≥3) 不成立で draw 不発', () => {
    let s = createEmptyGameState();
    s.players.self.deck = ['Z1', 'Z2'];
    s.players.self.remove = ['B01021'];
    s = produce(s, (d) => {
      runEffect(d, summonFrom('remove', 'B01021'), srcCtx(C2)); // Lv2 char
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.find((c) => c.cardId === 'B01021')).toBeTruthy();
    expect(s.players.self.hand, 'Lv2 原因では登場時 draw 不発').toHaveLength(0);
  });

  it('viaEffect:false (手動登場相当) → B01021 enterSource:false で draw 不発 (効果登場専用)', () => {
    let s = createEmptyGameState();
    s.players.self.deck = ['Z1', 'Z2'];
    s.players.self.remove = ['B01021'];
    s = produce(s, (d) => {
      runEffect(d, summonFrom('remove', 'B01021', /*viaEffect*/ false), srcCtx(C5));
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.find((c) => c.cardId === 'B01021')).toBeTruthy();
    expect(s.players.self.hand, 'viaEffect:false では登場時 draw 不発').toHaveLength(0);
  });
});

// ===================================================================================
describe('cluster11 §3 — 原因カードの【登場時】が誤発火しない (旧 spurious self-fire の解消)', () => {
  it('登場時draw を持つ SUMMONER が別キャラを効果登場させても、自身の登場時 は発火しない', () => {
    const SUMMONER = 'SUMMONER';
    const summonerA1 = { id: 'a1', type: 'triggered' as const, scope: 'on-scene' as const, trigger: { hook: 'enter' as const, selfOnly: true }, effect: { kind: 'atom' as const, verb: 'draw', args: { player: 'self', n: 1 } }, description: '【登場時】draw', ruleRefs: [] };
    registerCardDef(pchar(SUMMONER, { level: 5, abilities: [summonerA1 as never] }));
    registerCardDef(pchar('VAN', { level: 1 })); // 登場時 を持たない vanilla
    let s = createEmptyGameState();
    s.players.self.deck = ['Z1', 'Z2', 'Z3'];
    s.players.self.remove = ['VAN'];
    s.players.self.scene = [sceneChar(SUMMONER, 'sum#1')]; // 既に在場 (登場時は消費済)
    s = produce(s, (d) => {
      // SUMMONER の能力が VAN を効果登場させる (ctx.source = SUMMONER)
      runEffect(d, summonFrom('remove', 'VAN'), srcCtx(SUMMONER, 'sum#1'));
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.find((c) => c.cardId === 'VAN'), 'VAN が登場').toBeTruthy();
    expect(s.players.self.hand, 'SUMMONER 自身の登場時 draw は誤発火しない (post-BUG-146)').toHaveLength(0);
  });
});

// ===================================================================================
describe('cluster11 §4 — 【疾風】も効果登場で発火 (同 selfOnly 不一致が原因)', () => {
  it('疾風(enterOrderEquals:1)+draw のキャラを 1番目に効果登場 → draw 発火', () => {
    const SHIPPU = 'SHIPPU';
    const shippuA1 = { id: 'a1', type: 'triggered' as const, scope: 'on-scene' as const, trigger: { hook: 'enter' as const, selfOnly: true, matcherCondition: { kind: 'enterOrderEquals' as const, n: 1 } }, effect: { kind: 'atom' as const, verb: 'draw', args: { player: 'self', n: 1 } }, description: '【疾風】draw', ruleRefs: [] };
    registerCardDef(pchar(SHIPPU, { level: 5, abilities: [shippuA1 as never] }));
    let s = createEmptyGameState();
    s.players.self.deck = ['Z1', 'Z2'];
    s.players.self.remove = ['SHIPPU'];
    s = produce(s, (d) => {
      runEffect(d, summonFrom('remove', 'SHIPPU'), srcCtx(C5));
      runAllUntilEmpty(d);
    });
    const entered = s.players.self.scene.find((c) => c.cardId === 'SHIPPU');
    expect(entered, 'SHIPPU が登場').toBeTruthy();
    expect(entered?.enterOrderThisTurn, 'このターン1番目の登場').toBe(1);
    expect(s.players.self.hand, '疾風 draw が効果登場で発火').toHaveLength(1);
  });
});

// ===================================================================================
describe('cluster11 §5 — cluster11 カード e2e (実 atom + pick drain)', () => {
  it('B01014: Lv3 event 効果で登場 → Lv≤5 のキャラ1枚をスリープ (Lv6 decoy は対象外)', () => {
    let s = createEmptyGameState();
    s.players.self.remove = ['B01014'];
    // 対象候補: TGT5 (Lv5=対象) / 妨害: TGT6 (Lv6=filter外)
    registerCardDef(pchar('TGT5', { level: 5 }));
    registerCardDef(pchar('TGT6', { level: 6 }));
    s.players.opp.scene = [sceneChar('TGT5', 'tgt5#1'), sceneChar('TGT6', 'tgt6#1')];
    s = produce(s, (d) => {
      runEffect(d, summonFrom('remove', 'B01014'), srcCtx(E3G)); // 緑Lv3 event 原因
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.find((c) => c.cardId === 'B01014'), 'B01014 登場').toBeTruthy();
    const tgt5 = s.players.opp.scene.find((c) => c.uid === 'tgt5#1');
    const tgt6 = s.players.opp.scene.find((c) => c.uid === 'tgt6#1');
    expect(tgt5?.state, 'Lv5 はスリープ').toBe('sleep');
    expect(tgt6?.state, 'Lv6 decoy は active のまま (levelMax:5 filter)').toBe('active');
  });

  it('B07019: 事件編 では発火しない (【解決編】gate)', () => {
    let s = setCaseStatus(createEmptyGameState(), '事件編');
    s.players.self.remove = ['B07019'];
    registerCardDef(pchar('VICT', { level: 7 }));
    s.players.opp.scene = [sceneChar('VICT', 'v#1')];
    s = produce(s, (d) => {
      runEffect(d, summonFrom('remove', 'B07019'), srcCtx(E3G));
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    });
    expect(s.players.opp.scene.find((c) => c.uid === 'v#1'), '事件編では remove 不発').toBeTruthy();
  });

  it('B07019: 解決編 + 緑event 効果登場 → (optional 取得) self-sleep + Lv≤7 を1枚リムーブ', () => {
    setHuman('self'); // optional は human 側でのみ surface (certify-harvest-wave3 と同 pattern)
    let s = setCaseStatus(createEmptyGameState(), '解決編');
    s.players.self.remove = ['B07019'];
    registerCardDef(pchar('VICT', { level: 7 }));
    s.players.opp.scene = [sceneChar('VICT', 'v#1')];
    s = produce(s, (d) => {
      runEffect(d, summonFrom('remove', 'B07019'), srcCtx(E3G));
      runAllUntilEmpty(d);
      const p = _peekPendingEffectOptionalSide();
      expect(p, '「スリープさせてもよい」optional が surface').not.toBeNull();
      applyOptionalAndContinuation(d, p!, true); // 取得 (sleep + remove へ)
      _drainAllEffectPicksForTest(d, new HeuristicPolicy()); // remove の pick を AI 解決
      runAllUntilEmpty(d);
    });
    setHuman(null);
    _clearPendingEffectOptionalSide();
    _clearPendingEffectPickQueue();
    const self19 = s.players.self.scene.find((c) => c.cardId === 'B07019');
    expect(self19, 'B07019 登場').toBeTruthy();
    expect(self19?.state, 'このキャラはスリープ (self-sleep)').toBe('sleep');
    expect(s.players.opp.scene.find((c) => c.uid === 'v#1'), 'Lv7 VICT はリムーブされた').toBeFalsy();
    expect(s.players.opp.remove, 'VICT は相手リムーブへ').toContain('VICT');
  });

  // qa: card:B07019:2ac36a628488dd7fcb62f9d2873454623005fcfe75b98f02ac098e2d298e4477
  it('B07019: 緑eventでスリープ登場 → triggerはqueue、解決時active gateで効果なし (公式Q&A)', () => {
    let s = setCaseStatus(createEmptyGameState(), '解決編');
    s.players.self.remove = ['B07019'];
    registerCardDef(pchar('VICT', { level: 7 }));
    s.players.opp.scene = [sceneChar('VICT', 'v#1')];
    s = produce(s, (d) => {
      // enterSleep:true 相当 = スリープ状態で効果登場
      runEffect(d, { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId: 'B07019', viaEffect: true, enterSleep: true, target: { query: { area: 'remove', side: 'self' } } } } as unknown as Effect, srcCtx(E3G));
      expect(d.pendingEffects.some((p) => p.source?.cardId === 'B07019' && p.triggeredBy?.hook === 'enter')).toBe(true);
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.find((c) => c.cardId === 'B07019')?.state, 'スリープ状態で登場').toBe('sleep');
    expect(s.players.opp.scene.find((c) => c.uid === 'v#1'), '解決時active gateで remove 不発').toBeTruthy();
  });
});

// 事件 status を直接立てる helper (caseStatus gate 用)。createEmptyGameState は mutable plain object のため
// in-place 代入 (produce で freeze すると後続の s.players.self.remove 代入が read-only error になる)。
function setCaseStatus(s: GameState, status: '事件編' | '解決編'): GameState {
  s.players.self.case = { cardId: 'CASE', status, requiredEvidence: 7, colors: ['緑'], declaredUseCount: {} } as GameState['players']['self']['case'];
  return s;
}
